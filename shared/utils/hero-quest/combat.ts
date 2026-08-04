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

/** Folds strikesPerAttack, so Hunter's triple and Beast Master's quad need no special case. */
export function unitDps(unit: UnitStats, defenderDef: DecimalSource, defenderEva = 0): Decimal {
    return expectedHitDamage(unit, defenderDef, 1, defenderEva)
        .mul(unit.strikesPerAttack)
        .mul(unit.attacksPerSecond)
}

export function partyDps(units: readonly UnitStats[], defenderDef: DecimalSource, defenderEva = 0): Decimal {
    return units.reduce((total, unit) => total.add(unitDps(unit, defenderDef, defenderEva)), ZERO)
}

/** Incoming damage from an enemy, used for survivability projections. */
export function expectedIncomingDps(enemy: EnemyStats, defender: UnitStats): Decimal {
    return rawHitDamage(enemy.pwr, defender.def)
        .mul(hitChanceAgainst(defender.eva))
        .mul(attacksPerSecondFor(0))
}
