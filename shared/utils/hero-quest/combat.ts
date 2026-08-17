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
    MIN_DAMAGE,
    OVERFLOW_CONVERSION_RATE,
    SPD_ATTACK_RATE_PER_POINT,
    WEALTH_FACTOR_MAX,
    WEALTH_FACTOR_MIN,
    WEALTH_NEUTRAL_HOURS
} from './constants'
import { D, ONE, ZERO, decMax, decMin } from './numbers'
import type { Decimal, DecimalSource } from './numbers'
import type { EnemyStats, UnitStats } from './types'

/**
 * mitigation = min(1, DEF / (PWR × K))
 *
 * A clamped ratio, not an asymptotic curve: once a defender's DEF reaches `K` times the
 * attacker's PWR, mitigation is exactly 100%. Damage past that point does **not** reach 0 —
 * it floors at `MIN_DAMAGE`, applied in `rawHitDamage` rather than here, so this stays a
 * pure statement of the ratio.
 *
 * This is the **pairwise** contract — one attacker against one defender. A party does not
 * experience this directly: it pools its PWR first (`partyMitigation`), which is what lets
 * unit count move the mitigation threshold instead of only scaling the residual below it.
 */
export function mitigation(attackerPwr: DecimalSource, defenderDef: DecimalSource): Decimal {
    const pwr = D(attackerPwr)
    const def = D(defenderDef)
    if (pwr.lte(0)) return ONE
    return decMin(ONE, def.div(pwr.mul(K)))
}

/**
 * damage = PWR > 0 ? max(MIN_DAMAGE, PWR × (1 - mitigation) × abilityMultiplier) : 0
 *
 * The floor is the whole reason a fully-mitigated attacker still chips: see `MIN_DAMAGE` for
 * why a hard 0 was replaced. It applies to the finished hit, so an ability multiplier cannot
 * lift a fully-mitigated hit above the floor and nothing can push it below.
 *
 * **The zero-PWR guard is not an edge-case nicety.** `MIN_DAMAGE` is a floor on what
 * *mitigation* may reduce a hit to, not a guarantee that every swing hurts. An attacker with
 * no PWR deals nothing, exactly as before — otherwise "immune" would stop being expressible
 * anywhere in the model, and a genuinely powerless unit would grind down a wall given enough
 * time.
 */
export function rawHitDamage(attackerPwr: DecimalSource, defenderDef: DecimalSource, abilityMultiplier = 1): Decimal {
    const pwr = D(attackerPwr)
    if (pwr.lte(0)) return ZERO
    const reduced = pwr.mul(ONE.sub(mitigation(pwr, defenderDef))).mul(abilityMultiplier)
    return decMax(MIN_DAMAGE, reduced)
}

/**
 * Crit chance converts linearly from LCK until it hits 100%; LCK beyond that isn't wasted,
 * it overflows into bonus crit damage at a reduced rate.
 *
 * `critChance` comes back as a `number` because it is a probability clamped to [0, 1] — there
 * is nothing for a Decimal to hold. `overflow` stays Decimal: LCK is unbounded, so the
 * surplus past 100% is too.
 */
export function critChanceFor(lck: DecimalSource): { critChance: number; overflow: Decimal } {
    const raw = D(lck).mul(CRIT_CHANCE_PER_POINT)
    return {
        critChance: Math.min(1, raw.toNumber()),
        overflow: decMax(ZERO, raw.sub(ONE))
    }
}

/** The multiplier a critical hit applies — 1 + IMP scaling + overflow LCK scaling. */
export function critMultiplierFor(lck: DecimalSource, imp: DecimalSource): Decimal {
    const { overflow } = critChanceFor(lck)
    return ONE
        .add(D(imp).mul(CRIT_DAMAGE_PER_POINT))
        .add(overflow.mul(OVERFLOW_CONVERSION_RATE))
}

export function maxHpFor(vit: DecimalSource): Decimal {
    return D(vit).mul(HP_PER_VIT).add(BASE_HP)
}

/**
 * Every unit attacks once per 3s at SPD 0; higher SPD shortens the interval down to a hard
 * floor of 1/3s, i.e. 3 attacks per second. Basic attacks only — skill cooldowns are a
 * separate model.
 *
 *     attackInterval(spd) = clamp(3 / (1 + spd × rate), 1/3, 3)
 */
export function attackIntervalFor(spd: DecimalSource): number {
    // Clamped at both ends, so the result is always a small real number however large SPD
    // grows — a Decimal return would carry no information the clamp hasn't already removed.
    const divisor = D(spd).max(0).mul(SPD_ATTACK_RATE_PER_POINT).add(1)
    const scaled = D(BASE_ATTACK_INTERVAL_SECONDS).div(divisor).toNumber()
    return Math.min(BASE_ATTACK_INTERVAL_SECONDS, Math.max(MIN_ATTACK_INTERVAL_SECONDS, scaled))
}

export function attacksPerSecondFor(spd: DecimalSource): number {
    return 1 / attackIntervalFor(spd)
}

/**
 * A skill's cooldown after SPD shortens it — the same curve `attackIntervalFor` rides, with
 * the skill's own base in place of the flat 3s and its own floor.
 *
 *     cooldownFor(base, spd) = clamp(base × factor / (1 + spd × rate), MIN_COOLDOWN_SECONDS, base)
 *
 * `classes-and-combat.md` §3 gives SPD exactly one job — "reduces cooldown duration across
 * the board, for every skill on every path" — which is this. Sharing the rate constant with
 * the autoattack interval is what keeps SPD one stat with one shape rather than two dials
 * that happen to share a name.
 *
 * `factor` is the flat cooldown reduction passive modifiers grant (Artifacts' Tempo category —
 * Quickening, Slipstream, Chain Reaction, Double Cast). Deliberately a **separate multiplicand
 * rather than folded into SPD**: SPD also drives the autoattack rate, so routing a cooldown-only
 * bonus through it would silently speed up basic attacks too. `MIN_COOLDOWN_SECONDS` still
 * floors the result, so stacking Tempo can shorten a cooldown but never invert it.
 */
export function cooldownFor(baseSeconds: number, spd: DecimalSource, factor = 1): number {
    const base = Math.max(0, baseSeconds)
    const divisor = D(spd).max(0).mul(SPD_ATTACK_RATE_PER_POINT).add(1)
    const scaled = D(base).mul(Math.max(0, factor)).div(divisor).toNumber()
    return Math.min(base, Math.max(MIN_COOLDOWN_SECONDS, scaled))
}

/**
 * The Gambler's Strike family's bounded wealth factor (`skills-gacha.md` §4¹).
 *
 *     damage = PWR × abilityMultiplier × wealthFactorFor(bankedGold / goldPerHour)
 *
 * Linear in banked hours through `WEALTH_NEUTRAL_HOURS`, where it passes through exactly 1.0, and
 * clamped hard at both ends. The clamping is the whole design: unbounded in either direction the
 * family either trivialises combat for a hoarder or decays to nothing for a spender, and
 * `gold-economy.md` §8 rejected both readings.
 *
 * A caller that has no idea what the player has banked passes nothing and gets 1.0 — the
 * wealth-neutral answer, which is also what keeps every pre-existing spec's numbers unmoved.
 */
export function wealthFactorFor(bankedHours?: number): number {
    if (bankedHours === undefined || !Number.isFinite(bankedHours)) return 1
    const ratio = Math.max(0, bankedHours) / WEALTH_NEUTRAL_HOURS
    return Math.min(WEALTH_FACTOR_MAX, Math.max(WEALTH_FACTOR_MIN, ratio))
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
    return base.mul(expectedCritFactor(attacker)).mul(hitChanceAgainst(defenderEva))
}

/**
 * `1 + chance × (multiplier − 1)` — the crit-averaged multiplier `settle` and the DPS
 * projections use, as opposed to `fight.ts` which rolls it.
 *
 * Extracted because it is derived identically in two places and the Decimal form is no
 * longer a one-liner either reader can check at a glance.
 */
export function expectedCritFactor(unit: UnitStats): Decimal {
    return ONE.add(unit.critMultiplier.sub(ONE).mul(unit.critChance))
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

    return units.reduce((total, unit) => {
        const critFactor = expectedCritFactor(unit)
        // Floored per unit, matching `rawHitDamage` — a fully-mitigated party still chips at
        // MIN_DAMAGE per swing rather than stalling on exactly nothing, and a unit with no
        // PWR still contributes nothing.
        const perHit = unit.pwr.lte(0) ? ZERO : decMax(MIN_DAMAGE, unit.pwr.mul(penetration))
        const dps = perHit
            .mul(critFactor)
            .mul(hitChanceAgainst(defenderEva))
            .mul(unit.strikesPerAttack)
            .mul(unit.attacksPerSecond)
        return total.add(dps)
    }, ZERO)
}

/** Incoming damage from an enemy against one defender, used for survivability projections. */
export function expectedIncomingDps(enemy: EnemyStats, defender: UnitStats): Decimal {
    return rawHitDamage(enemy.pwr, defender.def)
        .mul(hitChanceAgainst(defender.eva))
        .mul(attacksPerSecondFor(0))
}

/**
 * The order a single enemy attack stream chews through the party: **front row first, back
 * row only once the front is empty or dead** (`classes-and-combat.md` §6,
 * `champions-guild-gacha.md` §8.4).
 *
 * An empty front row is legal, in which case the back row is targetable immediately — the
 * concatenation handles that with no special case.
 *
 * This is the whole mechanical basis of the Tank archetype. Both docs specified it from the
 * start; the Phase 1 model simply never implemented it, which is what left Tank as a
 * cosmetic tag (`open-items.md` #11.2).
 */
export function targetingOrder(units: readonly UnitStats[]): UnitStats[] {
    return [
        ...byThreat(units.filter(unit => unit.row === 'front')),
        ...byThreat(units.filter(unit => unit.row !== 'front'))
    ]
}

/**
 * Highest threat first, ties keeping their original order.
 *
 * Threat sorts **inside** a row and never across one, which is the whole of
 * `champions-guild-gacha.md` §8.4: row decides who is *eligible*, threat decides who among
 * them is *chosen*. A back-lined Tank therefore stays inert while the front row stands,
 * exactly as the doc requires, without needing a special case anywhere.
 *
 * A stable sort matters — with no aggro anchor fielded every unit carries `BASE_THREAT`, and
 * the order has to come out identical to the plain row split it replaced.
 */
function byThreat(units: readonly UnitStats[]): UnitStats[] {
    return units
        .map((unit, index) => ({ unit, index }))
        .sort((a, b) => b.unit.threat - a.unit.threat || a.index - b.index)
        .map(entry => entry.unit)
}
