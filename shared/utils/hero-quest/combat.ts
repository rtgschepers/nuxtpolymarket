/**
 * Combat math (`classes-and-combat.md` §7).
 *
 * One formula, one stat, for every unit in the game — Hero, Champions and enemies all
 * resolve damage the same way.
 *
 * This module holds the *crit-averaged* path, which is what `settle.ts` consumes offline
 * and online alike. The per-hit rolled path (seeded boss and Arena fights) is `fight.ts`
 * in Phase 1 and does not exist yet.
 */

import {
    BASE_ATTACK_INTERVAL_SECONDS,
    BASE_HP,
    CRIT_CHANCE_PER_POINT,
    CRIT_DAMAGE_PER_POINT,
    HP_PER_VIT,
    K,
    MAX_EVASION,
    MIN_ATTACK_INTERVAL_SECONDS,
    MIN_COOLDOWN_SECONDS,
    OVERFLOW_CONVERSION_RATE,
    SPD_ATTACK_RATE_PER_POINT
} from './constants'
import { D, ONE, ZERO, decMin } from './numbers'
import type { Decimal, DecimalSource } from './numbers'
import type { EnemyStats, UnitStats } from './types'

/**
 * mitigation = min(1, DEF / (PWR × K))
 *
 * A clamped ratio, not an asymptotic curve: once a defender's DEF reaches `K` times the
 * attacker's PWR, mitigation is exactly 100% and damage floors at exactly 0. That hard
 * floor is the point of the clamped form.
 *
 * This is the **pairwise** contract — one attacker against one defender. A party does not
 * experience this directly: it pools its PWR first (`partyMitigation`), which is what lets
 * unit count move the zero-damage threshold instead of only scaling the residual below it.
 */
export function mitigation(attackerPwr: DecimalSource, defenderDef: DecimalSource): Decimal {
    const pwr = D(attackerPwr)
    const def = D(defenderDef)
    if (pwr.lte(0)) return ONE
    return decMin(ONE, def.div(pwr.mul(K)))
}

/** damage = PWR × (1 - mitigation) × abilityMultiplier */
export function rawHitDamage(attackerPwr: DecimalSource, defenderDef: DecimalSource, abilityMultiplier = 1): Decimal {
    const pwr = D(attackerPwr)
    const reduced = pwr.mul(ONE.sub(mitigation(pwr, defenderDef))).mul(abilityMultiplier)
    return reduced.lt(0) ? ZERO : reduced
}

/**
 * Crit chance converts linearly from LCK until it hits 100%; LCK beyond that isn't wasted,
 * it overflows into bonus crit damage at a reduced rate.
 */
export function critChanceFor(lck: number): { critChance: number; overflow: number } {
    const raw = lck * CRIT_CHANCE_PER_POINT
    return {
        critChance: Math.min(1, raw),
        overflow: Math.max(0, raw - 1)
    }
}

/** The multiplier a critical hit applies — 1 + IMP scaling + overflow LCK scaling. */
export function critMultiplierFor(lck: number, imp: number): number {
    const { overflow } = critChanceFor(lck)
    return 1 + imp * CRIT_DAMAGE_PER_POINT + overflow * OVERFLOW_CONVERSION_RATE
}

export function maxHpFor(vit: number): Decimal {
    return D(BASE_HP + vit * HP_PER_VIT)
}

/**
 * Every unit attacks once per 3s at SPD 0; higher SPD shortens the interval down to a hard
 * floor of 1/3s, i.e. 3 attacks per second. Basic attacks only — skill cooldowns are a
 * separate model.
 *
 *     attackInterval(spd) = clamp(3 / (1 + spd × rate), 1/3, 3)
 */
export function attackIntervalFor(spd: number): number {
    const scaled = BASE_ATTACK_INTERVAL_SECONDS / (1 + Math.max(0, spd) * SPD_ATTACK_RATE_PER_POINT)
    return Math.min(BASE_ATTACK_INTERVAL_SECONDS, Math.max(MIN_ATTACK_INTERVAL_SECONDS, scaled))
}

export function attacksPerSecondFor(spd: number): number {
    return 1 / attackIntervalFor(spd)
}

/**
 * A skill's cooldown after SPD shortens it — the same curve `attackIntervalFor` rides, with
 * the skill's own base in place of the flat 3s and its own floor.
 *
 *     cooldownFor(base, spd) = clamp(base / (1 + spd × rate), MIN_COOLDOWN_SECONDS, base)
 *
 * `classes-and-combat.md` §3 gives SPD exactly one job — "reduces cooldown duration across
 * the board, for every skill on every path" — which is this. Sharing the rate constant with
 * the autoattack interval is what keeps SPD one stat with one shape rather than two dials
 * that happen to share a name.
 */
export function cooldownFor(baseSeconds: number, spd: number): number {
    const base = Math.max(0, baseSeconds)
    const scaled = base / (1 + Math.max(0, spd) * SPD_ATTACK_RATE_PER_POINT)
    return Math.min(base, Math.max(MIN_COOLDOWN_SECONDS, scaled))
}

/** Flat accuracy check with no attacker-side ACC stat. Total EVA is clamped at MAX_EVASION. */
export function hitChanceAgainst(eva: number): number {
    return 1 - Math.min(MAX_EVASION, Math.max(0, eva))
}

/**
 * Expected damage for one hit, averaging crit rather than rolling it — the convention
 * `idle-mechanics.md` §4 sets for settle, which EVA follows as a flat multiplier.
 */
export function expectedHitDamage(attacker: UnitStats, defenderDef: DecimalSource, abilityMultiplier = 1, defenderEva = 0): Decimal {
    const base = rawHitDamage(attacker.pwr, defenderDef, abilityMultiplier)
    const critFactor = 1 + attacker.critChance * (attacker.critMultiplier - 1)
    return base.mul(critFactor).mul(hitChanceAgainst(defenderEva))
}

/**
 * Folds strikesPerAttack, so Hunter's triple and Beast Master's quad need no special case.
 *
 * Solo/pairwise: mitigates against this unit's own PWR. For a party, go through `partyDps`
 * — the two agree exactly at one unit, and diverge deliberately above it.
 */
export function unitDps(unit: UnitStats, defenderDef: DecimalSource, defenderEva = 0): Decimal {
    return expectedHitDamage(unit, defenderDef, 1, defenderEva)
        .mul(unit.strikesPerAttack)
        .mul(unit.attacksPerSecond)
}

/**
 * The party's mitigation, resolved **once** from its summed PWR.
 *
 * The clamp is a subtraction in disguise — a unit deals `PWR − DEF/K` — so evaluating it per
 * attacker means N units multiply whatever survives *below* the zero-damage threshold while
 * the threshold itself never moves. Measured on the old model: at World 9 a solo Hero and a
 * four-unit party had identical depth ceilings, and the party was worth about a third of a
 * stage. Champions could never open a wall the Hero could not.
 *
 * Pooling makes the party one body with `PWR = Σ`. Unit count now moves the ceiling, worth a
 * constant `ln(N)/ln(ENEMY_STEP_BASE)` stages at *every* depth rather than collapsing to
 * nothing at the clamp.
 *
 * Offense only, deliberately: incoming damage stays per-defender (`expectedIncomingDps`), so
 * party size does not silently become a survivability stat too.
 */
export function partyMitigation(units: readonly UnitStats[], defenderDef: DecimalSource): Decimal {
    const pooledPwr = units.reduce((total, unit) => total.add(unit.pwr), ZERO)
    return mitigation(pooledPwr, defenderDef)
}

/**
 * Each unit still swings its own PWR; only the mitigation they swing through is shared. A
 * weak Champion therefore adds its own damage *and* thins the armour for everyone else,
 * which is what makes filling a slot always worth something.
 */
export function partyDps(units: readonly UnitStats[], defenderDef: DecimalSource, defenderEva = 0): Decimal {
    if (units.length === 0) return ZERO
    const penetration = ONE.sub(partyMitigation(units, defenderDef))
    if (penetration.lte(0)) return ZERO

    return units.reduce((total, unit) => {
        const critFactor = 1 + unit.critChance * (unit.critMultiplier - 1)
        const dps = unit.pwr
            .mul(penetration)
            .mul(critFactor)
            .mul(hitChanceAgainst(defenderEva))
            .mul(unit.strikesPerAttack)
            .mul(unit.attacksPerSecond)
        return total.add(dps)
    }, ZERO)
}

/** Incoming damage from an enemy, used for survivability projections. */
export function expectedIncomingDps(enemy: EnemyStats, defender: UnitStats): Decimal {
    return rawHitDamage(enemy.pwr, defender.def)
        .mul(hitChanceAgainst(defender.eva))
        .mul(attacksPerSecondFor(0))
}
