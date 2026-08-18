/**
 * Rate-based accrual: kills, Gold, XP and stage advancement.
 *
 * This is the pure math half. The DB-writing `settleHq` — row lock as mutex, transaction,
 * `tx` threading — is a Phase 1 `server/utils/` file that calls into this one. There are no
 * background workers and no cron anywhere in this game; progress accrues lazily on read.
 */

import {
    BASE_ENEMY_DEF,
    BASE_ENEMY_HP,
    BASE_ENEMY_PWR,
    BASE_GOLD,
    BASE_KILL_COUNT,
    BASE_OFFLINE_EFFICIENCY,
    BOSS_ATK_MULT,
    BOSS_HP_MULT,
    BOSS_MINION_COUNT,
    BOSS_STAGE,
    ELITE_PACK_SIZE,
    ELITE_STAGE_MAX,
    ELITE_STAGE_MIN,
    ELITE_STAT_MULT,
    FORMATION_ROW_CAPACITY,
    ENEMY_PRESTIGE_STEP_MULT,
    ENEMY_STEP_BASE,
    GOLD_BOUND_HORIZON_DAYS,
    GOLD_PLATFORM_DISCOUNT,
    GOLD_STEP_BASE,
    GOLD_TENURE_CEILING,
    GOLD_TENURE_CRAWL,
    GOLD_TENURE_DAYS,
    MAX_OFFLINE_CAP_LEVEL,
    MAX_OFFLINE_EFFICIENCY,
    MIN_SECONDS_PER_KILL,
    OFFLINE_CAP_BASE_HOURS,
    OFFLINE_CAP_HOURS_PER_LEVEL,
    OFFLINE_CAP_MAX_HOURS,
    OFFLINE_EFFICIENCY_PER_LEVEL,
    PACK_LIVE_STREAM_FRACTION,
    PRESTIGE_INDEX_STEPS,
    STAGES_PER_WORLD,
    SUPER_BOSS_HP_MULT,
    SUPER_BOSS_STAGE,
    SUPER_BOSS_ATK_MULT,
    WORLD_COUNT,
    XP_BASE_PER_KILL,
    XP_STEP_BASE,
    XP_TO_LEVEL_BASE,
    XP_TO_LEVEL_GROWTH,
    WAVE_PACK_SIZE
} from './constants'
import { attacksPerSecondFor, expectedIncomingDps, partyDps, targetingOrder } from './combat'
import { economyBonuses, partyUnitStats } from './stats'
import {
    partyAbilityDps,
    projectAbilities,
    sustainedIncoming
} from './projection'
import type { AbilityModifiers } from './projection'
import { D, ZERO, decPow } from './numbers'
import type { Decimal } from './numbers'
import type { EnemyPack, EnemyStats, FormationRow, HeroSnapshot, RunPosition, SettleInput, SettleResult, StageArchetype, UnitStats } from './types'

/**
 * How far into the game a position is, as one number.
 *
 *     n = prestige × 100 + (world-1) × 10 + (stage-1)
 *
 * Every difficulty-facing curve rides this index, which is what makes their relative growth
 * a single comparable exponent instead of three bases per curve that have to be reasoned
 * about pairwise. Strictly increasing along the play order, with no seam at a world or
 * prestige boundary.
 */
export function curveIndex(prestige: number, world: number, stage: number): number {
    return prestige * PRESTIGE_INDEX_STEPS + (world - 1) * STAGES_PER_WORLD + (stage - 1)
}

/**
 * The enemy power curve — the single swap point for the whole game.
 *
 *     b^n,  b = ENEMY_CURVE_T^(1/100)
 *
 * Replaces `5^prestige × 1.6^(world-1) × 1.15^(stage-1)` (`open-items.md` #10). Nothing
 * else in the codebase computes an enemy scalar, so replacing it again is one edit here.
 *
 * `ENEMY_PRESTIGE_STEP_MULT` is 1 under the continuous curve; it is the documented lever
 * for restoring a prestige difficulty reset, and multiplies out to nothing otherwise.
 */
export function enemyMultiplier(prestige: number, world: number, stage: number): Decimal {
    return decPow(ENEMY_STEP_BASE, curveIndex(prestige, world, stage))
        .mul(decPow(ENEMY_PRESTIGE_STEP_MULT, prestige))
}

export function stageArchetype(stage: number): StageArchetype {
    if (stage === BOSS_STAGE) return 'boss'
    if (stage === SUPER_BOSS_STAGE) return 'super_boss'
    if (stage >= ELITE_STAGE_MIN && stage <= ELITE_STAGE_MAX) return 'elite'
    return 'wave'
}

/**
 * Per-archetype layer on top of the stage's regular-mob baseline. Boss and super-boss HP
 * are both expressed relative to trash HP, not to each other.
 */
export function stageStatMultiplier(stage: number): { hp: number; atk: number; def: number } {
    switch (stageArchetype(stage)) {
        case 'elite':
            return { hp: ELITE_STAT_MULT, atk: ELITE_STAT_MULT, def: ELITE_STAT_MULT }
        case 'boss':
            return { hp: BOSS_HP_MULT, atk: BOSS_ATK_MULT, def: 1 }
        case 'super_boss':
            return { hp: SUPER_BOSS_HP_MULT, atk: SUPER_BOSS_ATK_MULT, def: 1 }
        default:
            return { hp: 1, atk: 1, def: 1 }
    }
}

export function enemyStatsAt(pos: RunPosition): EnemyStats {
    const mult = enemyMultiplier(pos.prestige, pos.world, pos.stage)
    const layer = stageStatMultiplier(pos.stage)
    return {
        hp: D(BASE_ENEMY_HP).mul(mult).mul(layer.hp),
        pwr: D(BASE_ENEMY_PWR).mul(mult).mul(layer.atk),
        def: D(BASE_ENEMY_DEF).mul(mult).mul(layer.def)
    }
}

// ── Packs ──────────────────────────────────────────────────────────────────────────────

/** How many bodies stand in one encounter at this stage, boss and escort together. */
export function packSizeFor(stage: number): number {
    switch (stageArchetype(stage)) {
        case 'boss':
        case 'super_boss':
            return 1 + Math.max(0, Math.floor(BOSS_MINION_COUNT))
        case 'elite':
            return Math.max(1, Math.floor(ELITE_PACK_SIZE))
        default:
            return Math.max(1, Math.floor(WAVE_PACK_SIZE))
    }
}

/**
 * A boss's escort: trash-tier bodies at the stage's own depth.
 *
 * Built from the same curve index as everything else but with the **wave** stat layer rather
 * than the boss layer, so a minion is an ordinary mob of that depth standing next to a ×3-HP
 * boss. Deriving them from the shared curve rather than a bespoke number is what keeps them
 * scaling automatically when `ENEMY_STEP_BASE` moves.
 */
function bossMinionStats(pos: RunPosition): EnemyStats {
    const mult = enemyMultiplier(pos.prestige, pos.world, pos.stage)
    return {
        hp: D(BASE_ENEMY_HP).mul(mult),
        pwr: D(BASE_ENEMY_PWR).mul(mult),
        def: D(BASE_ENEMY_DEF).mul(mult)
    }
}

/**
 * The encounter at a run position.
 *
 * Wave and elite stages are homogeneous. **Boss stages are not** — they hold the boss plus
 * `BOSS_MINION_COUNT` trash minions, which is the first genuinely mixed pack in the game and
 * exactly what the addressable `members[]` shape was built for.
 *
 * **Minions come first, the boss last.** The party chews through the escort before reaching
 * the boss, which matches the "lowest-HP% enemy" targeting three of the four class paths use,
 * and makes the member order the fight resolves in the same order `rawSecondsPerPack` sums —
 * so the projection and the fight can never disagree about how long an encounter takes.
 */
export function enemyPackAt(pos: RunPosition): EnemyPack {
    const archetype = stageArchetype(pos.stage)
    if (archetype === 'boss' || archetype === 'super_boss') {
        const minions = Math.max(0, Math.floor(BOSS_MINION_COUNT))
        const minion = bossMinionStats(pos)
        return { members: [...Array.from({ length: minions }, () => minion), enemyStatsAt(pos)] }
    }
    const member = enemyStatsAt(pos)
    return { members: Array.from({ length: packSizeFor(pos.stage) }, () => member) }
}

export function packSize(pack: EnemyPack): number {
    return Math.max(1, pack.members.length)
}

/**
 * Where a pack member stands, derived purely from its index and the pack's size.
 *
 * Enemies occupy the **same 3-wide, two-deep grid the party does**, which is what makes the
 * Archer path's abilities expressible at all — "hits all enemies in a row", "the front
 * column", "each spot" are statements about a shape, and a flat list has no shape.
 *
 * Front holds `ceil(size / 2)` up to the row capacity, which lands exactly where it should at
 * both sizes that matter: a 6-strong wave pack splits 3 and 3, and a boss encounter puts its
 * two minions in front with the boss behind them — the escort screening its boss, for free,
 * with no boss-specific branch.
 */
export function enemyPosition(index: number, size: number): { row: FormationRow; col: number } {
    const front = Math.min(FORMATION_ROW_CAPACITY, Math.ceil(Math.max(1, size) / 2))
    return index < front
        ? { row: 'front', col: index }
        : { row: 'back', col: index - front }
}

/** Indices of every member sharing a column with `index` — the pierce line, front to back. */
export function columnOf(index: number, size: number): number[] {
    const { col } = enemyPosition(index, size)
    const members: number[] = []
    for (let candidate = 0; candidate < size; candidate++) {
        if (enemyPosition(candidate, size).col === col) members.push(candidate)
    }
    return members
}

/** Indices of every member standing in `row`. */
export function rowOf(row: FormationRow, size: number): number[] {
    const members: number[] = []
    for (let index = 0; index < size; index++) {
        if (enemyPosition(index, size).row === row) members.push(index)
    }
    return members
}

export function packHp(pack: EnemyPack): Decimal {
    return pack.members.reduce((total, member) => total.add(member.hp), ZERO)
}

/**
 * How many of a pack are swinging at once, averaged over a stage attempt.
 *
 * See `PACK_LIVE_STREAM_FRACTION`. Always exactly 1 at size 1, which is the property that
 * makes every pre-pack number reproduce bit-for-bit.
 */
export function effectiveStreams(size: number): number {
    return 1 + (Math.max(1, size) - 1) * PACK_LIVE_STREAM_FRACTION
}

/**
 * Seconds to clear a whole encounter, killing members one at a time.
 *
 * Focus fire, so each member is fought at its own mitigation — a sum of at most a handful of
 * terms, closed-form, and correct for a mixed pack without special-casing one.
 */
export function rawSecondsPerPack(
    units: readonly UnitStats[],
    pack: EnemyPack,
    /**
     * Pass the hero to fold **ability damage** into the rate as well as autoattacks. Omitted,
     * this is the autoattack-only model it has always been — which is what keeps every caller
     * that does not care about abilities behaving exactly as before.
     */
    hero?: HeroSnapshot
): number {
    let total = 0
    for (const member of pack.members) {
        const dps = hero
            ? partyDps(units, member.def).add(partyAbilityDps(hero, units, member.def, packSize(pack)))
            : partyDps(units, member.def)
        if (dps.lte(0)) return Number.POSITIVE_INFINITY
        const seconds = member.hp.div(dps).toNumber()
        if (!Number.isFinite(seconds)) return Number.POSITIVE_INFINITY
        total += seconds
    }
    return total
}

/**
 * Apply a projection's party-side factors by rewriting the units themselves.
 *
 * Transforming the *input* rather than threading multipliers through `partyDps`,
 * `partyMitigation` and everything downstream means the formulas never learn that buffs exist
 * — a buffed party is just a stronger party, and pooled mitigation picks the change up for
 * free rather than needing its own buff-aware branch.
 */
export function buffedUnits(units: readonly UnitStats[], mods: AbilityModifiers): UnitStats[] {
    if (mods.pwrFactor === 1 && mods.spdFactor === 1) return [...units]
    return units.map((unit) => {
        const spd = unit.spd.mul(mods.spdFactor)
        return {
            ...unit,
            pwr: unit.pwr.mul(mods.pwrFactor),
            spd,
            // Recomputed rather than scaled: the attack-rate curve clamps at both ends, so
            // doubling SPD does *not* double the swing rate near the cap. Scaling the derived
            // value would quietly break that ceiling.
            attacksPerSecond: attacksPerSecondFor(spd)
        }
    })
}

/**
 * Everything the idle rate needs at one position, resolved once.
 *
 * `settle()`, the campaign sim and the projection specs all need the *same* four things —
 * projected modifiers, buffed party, debuffed pack, and the resulting seconds-per-kill — and
 * an earlier version of this had each of them assemble it independently. They drifted
 * immediately: a spec that skipped `buffedUnits` was measuring a party the game does not
 * field. One function, three callers.
 */
export interface RateContext {
    abilities: AbilityModifiers
    units: UnitStats[]
    pack: EnemyPack
    secondsPerKill: number
}

export function rateAt(hero: HeroSnapshot, position: RunPosition): RateContext {
    const baseUnits = partyUnitStats(hero)
    const basePack = enemyPackAt(position)
    const abilities = projectAbilities(hero, baseUnits, packSize(basePack))
    const units = buffedUnits(baseUnits, abilities)
    const pack = debuffedPack(basePack, abilities)
    return { abilities, units, pack, secondsPerKill: secondsPerKill(units, pack, hero) }
}

/**
 * How many hours of the player's *current* income they are sitting on in banked Gold.
 *
 * The only input the Gambler's Strike family takes (`skills-gacha.md` §4¹). Lives here rather
 * than on the server because it is arithmetic over the rate model, and both the server and the
 * campaign sim need the same answer.
 *
 * ⚠ **Resolved against the wealth-neutral rate, deliberately — this is one fixed-point
 * iteration, not a converged answer.** The quantity is self-referential: a wealth-scaled ability
 * raises DPS, which raises Gold per hour, which lowers the banked-hours figure, which lowers the
 * ability. Iterating to a fixed point would be exact and would also make every rate read in the
 * game a loop. One pass, computed from a party whose wealth factor is 1.0, is stable, cheap and
 * within a factor bounded by `WEALTH_FACTOR_MAX` of the converged answer — and the factor it
 * feeds is clamped anyway. Stated rather than hidden.
 */
export function wealthHoursFor(
    hero: HeroSnapshot,
    position: RunPosition,
    bankedGold: number,
    tenureDays: number
): number {
    if (!Number.isFinite(bankedGold) || bankedGold <= 0) return 0
    // `wealthHours` stripped so the rate this is measured against cannot depend on itself.
    const neutral: HeroSnapshot = { ...hero, wealthHours: undefined }
    const { secondsPerKill: spk } = rateAt(neutral, position)
    if (!Number.isFinite(spk) || spk <= 0) return 0

    const perKill = goldPerKill(position.prestige, position.world, position.stage, tenureDays)
    const goldPerHour = (3600 / spk) * perKill * (1 + economyBonuses(neutral).goldPct)
    if (!Number.isFinite(goldPerHour) || goldPerHour <= 0) return 0
    return bankedGold / goldPerHour
}

/** The same trick on the enemy side: shredded armour is just a softer pack. */
export function debuffedPack(pack: EnemyPack, mods: AbilityModifiers): EnemyPack {
    if (mods.enemyDefFactor === 1 && mods.incomingFactor === 1) return pack
    return {
        members: pack.members.map(member => ({
            ...member,
            def: member.def.mul(mods.enemyDefFactor),
            pwr: member.pwr.mul(mods.incomingFactor)
        }))
    }
}

/** Throughput against a whole encounter — pack HP over the time it takes to clear. Display only. */
export function packDps(units: readonly UnitStats[], pack: EnemyPack): Decimal {
    const seconds = rawSecondsPerPack(units, pack)
    if (!Number.isFinite(seconds) || seconds <= 0) return ZERO
    return packHp(pack).div(seconds)
}

/** Seconds to clear one whole encounter, floor included. */
export function secondsPerPack(units: readonly UnitStats[], pack: EnemyPack): number {
    return secondsPerKill(units, pack) * packSize(pack)
}

/**
 * secondsPerKill = max(MIN_SECONDS_PER_KILL, secondsToClearPack / packSize)
 *
 * **Amortized per enemy, deliberately.** `BASE_KILL_COUNT` counts individual bodies, so this
 * has to stay "seconds per body" for the kill loop, `goldPerKill` and `xpPerKill` to keep
 * their units. Against a homogeneous pack both halves scale by N and it comes out *exactly*
 * what the single-enemy model returned — packs cost nothing on the offense axis by design.
 *
 * The floor bounds the *rate* half of Gold/hour. A bounded per-kill value times an unbounded
 * kill rate is still unbounded income, so both halves are load-bearing. Live and offline call
 * this same function, so the two can never disagree.
 */
export function secondsPerKill(
    units: readonly UnitStats[],
    pack: EnemyPack,
    /** Pass the hero to count ability damage as well as autoattacks. */
    hero?: HeroSnapshot
): number {
    const raw = rawSecondsPerPack(units, pack, hero)
    if (!Number.isFinite(raw)) return Number.POSITIVE_INFINITY
    return Math.max(MIN_SECONDS_PER_KILL, raw / packSize(pack))
}

// ── Survivability ──────────────────────────────────────────────────────────────────────

/**
 * Incoming DPS against whoever is currently being targeted — the **front-most living unit**,
 * not the whole party.
 *
 * The enemy has one attack stream, so only one defender is taking damage at a time. This
 * used to sum across every fielded unit, which modelled the enemy as attacking all of them
 * simultaneously: N bodies then brought N× HP *and* took N× damage, and time-to-die came out
 * party-size-invariant (`open-items.md` #11.2). It also disagreed with `fight.ts`, which has
 * always resolved one stream against one target.
 */
export function incomingDps(units: readonly UnitStats[], pack: EnemyPack): Decimal {
    const target = targetingOrder(units)[0]
    return target ? incomingDpsAgainst(pack, target) : ZERO
}

/**
 * What one defender takes from a whole pack.
 *
 * **Every member focuses the same defender**, so this is the mean member's output times the
 * number still swinging — not a sum across members hitting different people. Spreading the
 * streams across the party would hand N bodies both N× HP and N× incoming, which is exactly
 * how time-to-die became party-size-invariant before (`open-items.md` #11.2) and how the Tank
 * archetype lost its function the first time.
 */
function incomingDpsAgainst(pack: EnemyPack, defender: UnitStats): Decimal {
    const size = packSize(pack)
    const mean = pack.members
        .reduce((total, member) => total.add(expectedIncomingDps(member, defender)), ZERO)
        .div(size)
    return mean.mul(effectiveStreams(size))
}

/**
 * How long the party survives one uninterrupted stage attempt, from full HP.
 *
 * One attack stream, front row first: the enemy spends `hp / dps` seconds on each defender
 * in turn, so the total is the sum over the targeting order. **Party size is now a real
 * survivability lever** — and a high-DEF body standing in front is worth more than its own
 * HP suggests, because its own mitigation applies for the whole time it is the target.
 *
 * **No party is immortal any more.** Incoming damage floors at `MIN_DAMAGE` rather than 0, so
 * a fully-mitigated defender still takes chip damage and every unit is eventually worn down.
 * The remaining `Infinity` guards cover the degenerate cases only — an empty party, or HP so
 * large the division overflows a JS number — not "the enemy cannot hurt us", which used to be
 * reachable and no longer is.
 */
export function secondsToDie(
    units: readonly UnitStats[],
    pack: EnemyPack,
    /** Party healing per second, which extends every defender's life proportionally. */
    healingPerSecond: Decimal = ZERO,
    /**
     * Flat damage-reduction factor from passive modifiers (Artifacts' Defense category, Skills'
     * Adaptive Plating). Applied to the **finished** incoming number rather than to enemy PWR,
     * because mitigation is non-linear in PWR: routing a flat reduction through the enemy's stat
     * line would make a "−20% damage taken" line worth considerably more than 20%.
     */
    damageTakenFactor = 1
): number {
    let total = 0
    for (const unit of targetingOrder(units)) {
        const raw = incomingDpsAgainst(pack, unit).mul(Math.max(0, damageTakenFactor))
        // Sustain is subtracted from the stream, floored so healing can never fully cancel it
        // — see `MAX_SUSTAIN_MITIGATION` for why an immortal projection is the failure mode.
        const incoming = sustainedIncoming(raw, healingPerSecond)
        if (incoming.lte(0)) return Number.POSITIVE_INFINITY
        const seconds = unit.maxHp.div(incoming).toNumber()
        if (!Number.isFinite(seconds)) return Number.POSITIVE_INFINITY
        total += seconds
    }
    return total
}

/**
 * How many kills a wave stage yields before the party drops.
 *
 * **HP carries across the whole stage attempt** and refills only when the stage clears or
 * restarts — the answer to the question `scripts/hero-quest/sim.ts` parked as "no design doc
 * covers whether HP carries between kills". A wave wipe is not a fallback: the *same* stage
 * restarts at 0 kills, so the run never loses ground, it just stops gaining any.
 *
 * That makes an unsurvivable wave a self-resolving wall rather than a dead end. Kills still
 * land at `secondsPerKill` right up to the wipe, so Gold and XP keep flowing at the usual
 * rate and the Hero levels its way out. Returns `Infinity` only for a party `secondsToDie`
 * calls undying, which since the `MIN_DAMAGE` floor means an empty party and nothing else.
 */
export function killsBeforeWipe(
    units: readonly UnitStats[],
    pack: EnemyPack,
    spk: number,
    healingPerSecond: Decimal = ZERO,
    damageTakenFactor = 1
): number {
    const survives = secondsToDie(units, pack, healingPerSecond, damageTakenFactor)
    if (!Number.isFinite(survives)) return Number.POSITIVE_INFINITY
    if (!Number.isFinite(spk) || spk <= 0) return 0
    return Math.floor(survives / spk)
}

/** Boss stages have no kill requirement — they're cleared by the fight, not by a counter. */
export function killsRequired(pos: RunPosition): number {
    const archetype = stageArchetype(pos.stage)
    return archetype === 'boss' || archetype === 'super_boss' ? 0 : BASE_KILL_COUNT
}

// ── Currency curves ────────────────────────────────────────────────────────────────────

/**
 * How much progress alone says a kill is worth, before the calendar gets a say.
 *
 * `GOLD_STEP_BASE^n` on the shared `curveIndex` — the same shape as `enemyMultiplier`, at a
 * far shallower base. Strictly increasing along the play order with no seam at a world or
 * prestige boundary, which the old table-times-two-bases form could not manage: it paid x11.6
 * across a run and only x2.8 for the prestige, so looping back to World 1 cut Gold per kill.
 *
 * Unbounded, and that is fine — `goldPerKill` mins it against the tenure ceiling, so the
 * ceiling is what bounds Gold at every position. This curve owns no cap of its own.
 */
export function goldProgressionFactor(prestige: number, world: number, stage: number): number {
    return Math.pow(GOLD_STEP_BASE, curveIndex(prestige, world, stage))
}

/**
 * The largest progression factor an account this old is allowed to be paid on.
 *
 * Geometric interpolation between the `GOLD_TENURE_DAYS` rungs, then `GOLD_TENURE_CRAWL` per
 * day past the last one. Geometric rather than linear because the platform economies this is
 * derived from grow geometrically — interpolating them linearly would sag between rungs.
 *
 * `GOLD_PLATFORM_DISCOUNT` is applied last, on the way out, so the table itself stays readable
 * as the platform curve and the discount stays one number rather than twelve.
 *
 * See `GOLD_TENURE_CEILING` in `constants.ts` for why tenure is wall-clock account age and not
 * playtime, progression, or time-in-run.
 */
export function goldTenureCeiling(tenureDays: number): number {
    return GOLD_PLATFORM_DISCOUNT * platformCeiling(tenureDays)
}

/** The undiscounted platform curve, as a factor. Exported for the balance script's comparison. */
export function platformCeiling(tenureDays: number): number {
    const days = Number.isFinite(tenureDays) ? Math.max(0, tenureDays) : 0
    const last = GOLD_TENURE_DAYS.length - 1
    const lastDay = GOLD_TENURE_DAYS[last] ?? 0
    const lastCeiling = GOLD_TENURE_CEILING[last] ?? 1

    if (days >= lastDay) return lastCeiling * Math.pow(GOLD_TENURE_CRAWL, days - lastDay)

    for (let i = 1; i <= last; i++) {
        const hiDay = GOLD_TENURE_DAYS[i] ?? 0
        if (days > hiDay) continue
        const loDay = GOLD_TENURE_DAYS[i - 1] ?? 0
        const lo = GOLD_TENURE_CEILING[i - 1] ?? 1
        const hi = GOLD_TENURE_CEILING[i] ?? 1
        const span = hiDay - loDay
        if (span <= 0) return hi
        return lo * Math.pow(hi / lo, (days - loDay) / span)
    }
    return GOLD_TENURE_CEILING[0] ?? 1
}

/**
 * Gold per kill: progression, speed-limited by the calendar.
 *
 * The `min` is the whole design. Progression is what earns Gold — pushing deeper and prestiging
 * both raise the first term, and an account that stops progressing stops growing. The ceiling
 * only refuses to pay out ahead of the clock, which is what stops a three-hour-old account
 * out-earning a two-month-old platform account by two orders of magnitude.
 *
 * `tenureDays` is **wall-clock age of the account**, and callers must evaluate it at the *start*
 * of the window being settled. The ceiling only rises with time, so the window's first instant
 * is its cheapest — settling a 72-hour offline window at its end price would pay three days of
 * kills at a ceiling the account only reached on the last of them.
 */
export function goldPerKill(prestige: number, world: number, stage: number, tenureDays: number): number {
    return BASE_GOLD * Math.min(goldProgressionFactor(prestige, world, stage), goldTenureCeiling(tenureDays))
}

/**
 * XP rides the same index as the enemy, at `XP_STEP_EXPONENT` relative growth. At exponent
 * 1 the two curves are the same shape, so XP per second neither decays nor climbs with
 * depth — the property the old three-base curve could not hold (it decayed ×0.91 per stage
 * and ×0.78 per world, so farming got strictly worse the deeper the run went).
 */
export function xpPerKill(prestige: number, world: number, stage: number): Decimal {
    return D(XP_BASE_PER_KILL).mul(decPow(XP_STEP_BASE, curveIndex(prestige, world, stage)))
}

export function xpToNextLevel(level: number): Decimal {
    return D(XP_TO_LEVEL_BASE).mul(decPow(XP_TO_LEVEL_GROWTH, Math.max(0, level - 1)))
}

/** Total XP spent climbing from level 1 to `level` — the geometric series of xpToNextLevel. */
export function totalXpForLevel(level: number): Decimal {
    const steps = Math.max(0, level - 1)
    if (steps === 0) return ZERO
    return D(XP_TO_LEVEL_BASE)
        .mul(decPow(XP_TO_LEVEL_GROWTH, steps).sub(1))
        .div(XP_TO_LEVEL_GROWTH - 1)
}

/**
 * Absorb earned XP into levels.
 *
 * Solved in closed form rather than looped: XP reaches magnitudes where a
 * one-level-at-a-time walk would run tens of thousands of Decimal iterations. Inverting
 * the geometric series gives the level directly, and a bounded correction step fixes the
 * off-by-one that float precision can introduce at the boundary.
 */
export function applyXp(level: number, currentXp: Decimal, earned: Decimal): { level: number; xp: Decimal } {
    const startLevel = Math.max(1, Math.floor(level))
    const total = totalXpForLevel(startLevel).add(currentXp).add(earned)
    if (!total.isFinite() || total.lte(0)) return { level: startLevel, xp: ZERO }

    // total >= B × (G^(L-1) - 1) / (G-1)   ⇒   L <= 1 + log_G(1 + total × (G-1) / B)
    const ratio = total.mul(XP_TO_LEVEL_GROWTH - 1).div(XP_TO_LEVEL_BASE).add(1)
    const solved = Math.floor(1 + ratio.ln().div(Math.log(XP_TO_LEVEL_GROWTH)).toNumber())

    let resolved = Math.max(startLevel, Number.isFinite(solved) ? solved : startLevel)
    while (reached(resolved + 1, total)) resolved++
    while (resolved > startLevel && !reached(resolved, total)) resolved--

    const spent = totalXpForLevel(resolved)
    const remainder = total.sub(spent)
    return { level: resolved, xp: remainder.lt(0) ? ZERO : remainder }
}

/**
 * Closing the geometric series costs a little float precision — `1.12**1 - 1` is
 * `0.12000000000000011`, so a hero landing *exactly* on a level threshold can compute as a
 * hair short of it. A relative tolerance keeps the boundary case honest.
 *
 * Not a tuning dial, so deliberately not in `constants.ts`: it is a property of IEEE-754,
 * not of the game, and nothing about balance changes if it moves.
 */
const LEVEL_THRESHOLD_EPSILON = 1e-12

function reached(level: number, total: Decimal): boolean {
    const needed = totalXpForLevel(level)
    return needed.lte(total.mul(1 + LEVEL_THRESHOLD_EPSILON).add(LEVEL_THRESHOLD_EPSILON))
}

// ── Offline window ─────────────────────────────────────────────────────────────────────

export function offlineCapHours(level: number): number {
    const clamped = Math.min(MAX_OFFLINE_CAP_LEVEL, Math.max(0, level))
    return Math.min(OFFLINE_CAP_MAX_HOURS, OFFLINE_CAP_BASE_HOURS + OFFLINE_CAP_HOURS_PER_LEVEL * clamped)
}

/**
 * `extraSources` is the additive offline-efficiency% Skills and Artifacts contribute — Tycoon's
 * Vault, Emperor's Treasury, Night Owl.
 *
 * Still clamped at `MAX_OFFLINE_EFFICIENCY`, which matters: a maxed prestige-shop track is already
 * at 100%, and letting content push past it would mint income out of nothing rather than
 * recovering income lost to being away.
 */
export function offlineEfficiency(level: number, extraSources = 0): number {
    const raw = BASE_OFFLINE_EFFICIENCY + OFFLINE_EFFICIENCY_PER_LEVEL * Math.max(0, level) + extraSources
    return Math.min(MAX_OFFLINE_EFFICIENCY, raw)
}

export function cappedOfflineSeconds(realElapsed: number, capLevel: number): number {
    return Math.min(Math.max(0, realElapsed), offlineCapHours(capLevel) * 3600)
}

/**
 * Ordering is deliberate and load-bearing (`idle-mechanics.md` §4): the cap clamps real
 * elapsed time *first* — a boost can never extend how much offline time counts — then the
 * boost dilates the covered portion, then efficiency taxes the result.
 */
export function effectiveOfflineSeconds(input: SettleInput): number {
    const capped = cappedOfflineSeconds(input.elapsedSeconds, input.hero.offlineCapLevel)
    const boosted = applyBoost(capped, input)
    return boosted * offlineEfficiency(
        input.hero.offlineEfficiencyLevel,
        economyBonuses(input.hero).offlineEfficiencyPct
    )
}

function applyBoost(seconds: number, input: SettleInput): number {
    if (!input.speedBoost) return seconds
    const overlap = Math.min(Math.max(0, input.speedBoost.overlapSeconds), seconds)
    return overlap * input.speedBoost.multiplier + (seconds - overlap)
}

// ── Stage movement ─────────────────────────────────────────────────────────────────────

export function nextStage(pos: RunPosition): RunPosition {
    if (pos.stage < STAGES_PER_WORLD) {
        return { ...pos, stage: pos.stage + 1, killsInStage: 0 }
    }
    if (pos.world < WORLD_COUNT) {
        return { ...pos, world: pos.world + 1, stage: 1, killsInStage: 0 }
    }
    return { ...pos, killsInStage: 0 }
}

/** Soft-fail: a lost boss sends the player back one stage to farm. 5 → 4, 10 → 9. */
export function fallbackStage(pos: RunPosition): RunPosition {
    if (pos.stage <= 1) return { ...pos, killsInStage: 0 }
    return { ...pos, stage: pos.stage - 1, killsInStage: 0 }
}

/**
 * Where accrual is redirected when the run reaches a boss gate. Offline never engages a
 * boss, win or lose — surplus loops the preceding wave stage instead.
 */
export function offlineFarmStage(pos: RunPosition): RunPosition {
    const archetype = stageArchetype(pos.stage)
    if (archetype !== 'boss' && archetype !== 'super_boss') return pos
    return fallbackStage(pos)
}

// ── The settle itself ──────────────────────────────────────────────────────────────────

/**
 * Accrue an elapsed window into kills, Gold, XP and run position.
 *
 * Offline holds **one rate**: `secondsPerKill` is computed once from the stage the player
 * was on when they left and held for the whole window. Party stats are likewise frozen —
 * there is nothing to recompute mid-flight when nobody is playing.
 *
 * Run position still advances, because it has to: the boss wall is defined in terms of
 * kills carrying the run past a stage threshold. On reaching Stage 5 or Stage 10 accrual
 * stops advancing and the remainder loops the preceding wave stage. The player lands back
 * *at* the boss with the fight ready to engage manually.
 *
 * Wave stages have a second, softer stop: if the party dies before the stage's kill counter
 * fills (`killsBeforeWipe`), that stage restarts rather than advancing. Income continues at
 * the same rate, so the wall unsticks itself as the Hero levels.
 */
export function settle(input: SettleInput): SettleResult {
    /**
     * Ability effects, averaged into the rate (`projection.ts`).
     *
     * Applied by rewriting the units and the pack rather than by threading multipliers through
     * every formula: a buffed party is simply a stronger party, and a shredded pack a softer
     * one, so pooled mitigation and everything downstream pick the change up for free.
     */
    const { abilities, units, pack: startPack, secondsPerKill: spk } = rateAt(input.hero, input.position)

    const effectiveSeconds = input.online
        ? applyBoost(Math.max(0, input.elapsedSeconds), input)
        : effectiveOfflineSeconds(input)

    const empty: SettleResult = {
        position: { ...input.position },
        kills: 0,
        goldEarned: 0,
        xpEarned: ZERO,
        heroLevel: input.hero.heroLevel,
        heroXp: input.hero.heroXp,
        secondsPerKill: spk,
        blockedAtBoss: isBossStage(input.position.stage),
        wipedOnWave: false,
        effectiveSeconds
    }
    if (!Number.isFinite(spk) || spk <= 0 || effectiveSeconds <= 0) return empty

    const totalKills = Math.floor(effectiveSeconds / spk)
    if (totalKills <= 0) return empty

    /**
     * Two channels into one multiplier each, and they compose differently by design.
     *
     * `economyBonuses` sums the **passive** Gold%/XP% lines (Skills' ledger family, Artifacts'
     * Fortune category, plus `hero.goldBonusPct`) — additive across sources, per
     * `gold-economy.md` §5. `abilities.goldFactor` carries the **burst** family, which is already
     * a multiplier because a burst worth M minutes of income every C seconds *is* `1 + 60M/C`
     * times the rate. Multiplying the two is right: one says "your kills are worth more", the
     * other says "you also get paid for casting", and those are not the same claim.
     */
    const economy = economyBonuses(input.hero)
    const goldMultiplier = (1 + economy.goldPct) * abilities.goldFactor
    const xpMultiplier = D((1 + economy.xpPct) * abilities.xpFactor)
    let pos: RunPosition = { ...input.position }
    let remaining = totalKills
    let gold = 0
    let xp = ZERO
    let killsLanded = 0
    let blockedAtBoss = false
    let wipedOnWave = false

    // Survivability is frozen at the departure snapshot for exactly the reason `spk` is:
    // offline holds one rate, and the two halves of that rate have to agree. A window that
    // carries the run into deeper stages fights all of them at the departure stage's
    // difficulty — generous, and the same generosity `secondsPerKill` already grants.
    const wipeAt = killsBeforeWipe(units, startPack, spk, abilities.healingPerSecond, abilities.damageTakenFactor)

    while (remaining > 0) {
        if (isBossStage(pos.stage)) {
            // Gate. Every remaining kill farms the preceding wave stage; position stays put.
            blockedAtBoss = true
            const farm = offlineFarmStage(pos)
            gold += remaining * goldPerKill(pos.prestige, farm.world, farm.stage, input.tenureDays) * goldMultiplier
            xp = xp.add(xpPerKill(pos.prestige, farm.world, farm.stage).mul(remaining).mul(xpMultiplier))
            killsLanded += remaining
            remaining = 0
            break
        }

        const required = killsRequired(pos)

        // The party drops before the stage's counter fills, so the stage restarts from 0 and
        // can never be cleared at this power level. Resolve the whole remainder in one step —
        // walking it wipe-by-wipe would spin for the length of an offline window.
        if (wipeAt < required) {
            wipedOnWave = true
            if (wipeAt > 0) {
                gold += remaining * goldPerKill(pos.prestige, pos.world, pos.stage, input.tenureDays) * goldMultiplier
                xp = xp.add(xpPerKill(pos.prestige, pos.world, pos.stage).mul(remaining).mul(xpMultiplier))
                killsLanded += remaining
                // Where the current attempt stands, having restarted every `wipeAt` kills.
                pos = { ...pos, killsInStage: (pos.killsInStage + remaining) % wipeAt }
            } else {
                // Dies faster than it kills: no kills land at all, so nothing is earned.
                pos = { ...pos, killsInStage: 0 }
            }
            remaining = 0
            break
        }

        const needed = required - pos.killsInStage
        const applied = Math.min(remaining, Math.max(0, needed))
        if (applied <= 0) {
            pos = nextStage(pos)
            continue
        }

        gold += applied * goldPerKill(pos.prestige, pos.world, pos.stage, input.tenureDays) * goldMultiplier
        xp = xp.add(xpPerKill(pos.prestige, pos.world, pos.stage).mul(applied).mul(xpMultiplier))
        killsLanded += applied
        remaining -= applied
        pos = { ...pos, killsInStage: pos.killsInStage + applied }

        if (pos.killsInStage >= killsRequired(pos)) {
            pos = nextStage(pos)
        }
    }

    // Levels land once, here — the window itself was fought at the departure level.
    const levelled = applyXp(input.hero.heroLevel, input.hero.heroXp, xp)

    return {
        position: pos,
        kills: killsLanded,
        goldEarned: gold,
        xpEarned: xp,
        heroLevel: levelled.level,
        heroXp: levelled.xp,
        secondsPerKill: spk,
        blockedAtBoss,
        wipedOnWave,
        effectiveSeconds
    }
}

function isBossStage(stage: number): boolean {
    const archetype = stageArchetype(stage)
    return archetype === 'boss' || archetype === 'super_boss'
}

/**
 * The provable Gold/hour ceiling: bounded per-kill value × bounded kill rate.
 *
 * No position appears here any more. `goldProgressionFactor` grows without limit, so the `min`
 * in `goldPerKill` is the tenure ceiling for every position deep enough to matter — which makes
 * the ceiling the bound outright, rather than something evaluated at a hand-picked worst case.
 *
 * Takes a horizon because `GOLD_TENURE_CRAWL` never goes flat, so "the maximum" is only
 * meaningful with a date attached. `GOLD_BOUND_HORIZON_DAYS` is ten years.
 */
export function maxGoldPerHour(goldStack = 1, battleSpeed = 1, tenureDays = GOLD_BOUND_HORIZON_DAYS): number {
    const maxGoldPerKill = BASE_GOLD * goldTenureCeiling(tenureDays)
    return maxGoldPerKill * (3600 / MIN_SECONDS_PER_KILL) * goldStack * battleSpeed
}
