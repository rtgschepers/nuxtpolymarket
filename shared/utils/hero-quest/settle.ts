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
    BOSS_STAGE,
    ELITE_STAGE_MAX,
    ELITE_STAGE_MIN,
    ELITE_STAT_MULT,
    ENEMY_PRESTIGE_BASE,
    ENEMY_STAGE_BASE,
    ENEMY_WORLD_BASE,
    GOLD_PLATEAU_GROWTH,
    GOLD_PRESTIGE_CAP,
    GOLD_STAGE_BASE,
    GOLD_WORLD_BASE,
    MAX_OFFLINE_CAP_LEVEL,
    MAX_OFFLINE_EFFICIENCY,
    MIN_SECONDS_PER_KILL,
    OFFLINE_CAP_BASE_HOURS,
    OFFLINE_CAP_HOURS_PER_LEVEL,
    OFFLINE_CAP_MAX_HOURS,
    OFFLINE_EFFICIENCY_PER_LEVEL,
    PRESTIGE_GOLD_FACTOR,
    STAGES_PER_WORLD,
    SUPER_BOSS_HP_MULT,
    SUPER_BOSS_STAGE,
    SUPER_BOSS_ATK_MULT,
    WORLD_COUNT,
    XP_BASE_PER_KILL,
    XP_PRESTIGE_BASE,
    XP_STAGE_BASE,
    XP_TO_LEVEL_BASE,
    XP_TO_LEVEL_GROWTH,
    XP_WORLD_BASE
} from './constants'
import { partyDps } from './combat'
import { partyUnitStats } from './stats'
import { D, ZERO, decPow } from './numbers'
import type { Decimal } from './numbers'
import type { EnemyStats, RunPosition, SettleInput, SettleResult, StageArchetype } from './types'

/**
 * The enemy power curve — the single swap point for the whole game.
 *
 *     5^prestige × 1.6^(world-1) × 1.15^(stage-1)
 *
 * A continuous `b^n` replacement was parked mid-tuning (`open-items.md` #8, #10). Nothing
 * else in the codebase computes an enemy scalar, so replacing it is one edit here.
 */
export function enemyMultiplier(prestige: number, world: number, stage: number): Decimal {
    return decPow(ENEMY_PRESTIGE_BASE, prestige)
        .mul(decPow(ENEMY_WORLD_BASE, world - 1))
        .mul(decPow(ENEMY_STAGE_BASE, stage - 1))
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

/**
 * secondsPerKill = max(MIN_SECONDS_PER_KILL, enemyEHP / partyDPS)
 *
 * The floor bounds the *rate* half of Gold/hour. A bounded per-kill value times an
 * unbounded kill rate is still unbounded income, so both halves are load-bearing. Live and
 * offline call this same function, so the two can never disagree.
 */
export function secondsPerKill(dps: Decimal, enemy: EnemyStats): number {
    if (dps.lte(0)) return Number.POSITIVE_INFINITY
    const raw = enemy.hp.div(dps).toNumber()
    if (!Number.isFinite(raw)) return Number.POSITIVE_INFINITY
    return Math.max(MIN_SECONDS_PER_KILL, raw)
}

/** Boss stages have no kill requirement — they're cleared by the fight, not by a counter. */
export function killsRequired(pos: RunPosition): number {
    const archetype = stageArchetype(pos.stage)
    return archetype === 'boss' || archetype === 'super_boss' ? 0 : BASE_KILL_COUNT
}

// ── Currency curves ────────────────────────────────────────────────────────────────────

/**
 * Config table rather than a closed form: the growth rate itself has to decay, which no
 * single `G^p` produces. Past the cap it crawls at +2% per prestige instead of going flat.
 */
export function prestigeGoldFactor(prestige: number): number {
    const lastIndex = Math.min(GOLD_PRESTIGE_CAP, PRESTIGE_GOLD_FACTOR.length - 1)
    if (prestige <= lastIndex) return PRESTIGE_GOLD_FACTOR[Math.max(0, prestige)] ?? 1
    return (PRESTIGE_GOLD_FACTOR[lastIndex] ?? 1) * Math.pow(GOLD_PLATEAU_GROWTH, prestige - lastIndex)
}

/**
 * Gold is deliberately decoupled from the exponential enemy curve — its within-run growth
 * (1.25/1.05) is far shallower than the enemy's (1.6/1.15), and its prestige growth is
 * capped outright. That's what keeps Gold inside the shared `user.balance` numeric column.
 */
export function goldPerKill(prestige: number, world: number, stage: number): number {
    return BASE_GOLD
        * Math.pow(GOLD_WORLD_BASE, world - 1)
        * Math.pow(GOLD_STAGE_BASE, stage - 1)
        * prestigeGoldFactor(prestige)
}

export function xpPerKill(prestige: number, world: number, stage: number): Decimal {
    return D(XP_BASE_PER_KILL)
        .mul(decPow(XP_WORLD_BASE, world - 1))
        .mul(decPow(XP_STAGE_BASE, stage - 1))
        .mul(decPow(XP_PRESTIGE_BASE, prestige))
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
    return boosted * offlineEfficiency(input.hero.offlineEfficiencyLevel)
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
 */
export function settle(input: SettleInput): SettleResult {
    const units = partyUnitStats(input.hero)
    const startEnemy = enemyStatsAt(input.position)
    const dps = partyDps(units, startEnemy.def)
    const spk = secondsPerKill(dps, startEnemy)

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
        effectiveSeconds
    }
    if (!Number.isFinite(spk) || spk <= 0 || effectiveSeconds <= 0) return empty

    const totalKills = Math.floor(effectiveSeconds / spk)
    if (totalKills <= 0) return empty

    const goldMultiplier = 1 + input.hero.goldBonusPct
    let pos: RunPosition = { ...input.position }
    let remaining = totalKills
    let gold = 0
    let xp = ZERO
    let blockedAtBoss = false

    while (remaining > 0) {
        if (isBossStage(pos.stage)) {
            // Gate. Every remaining kill farms the preceding wave stage; position stays put.
            blockedAtBoss = true
            const farm = offlineFarmStage(pos)
            gold += remaining * goldPerKill(pos.prestige, farm.world, farm.stage) * goldMultiplier
            xp = xp.add(xpPerKill(pos.prestige, farm.world, farm.stage).mul(remaining))
            remaining = 0
            break
        }

        const needed = killsRequired(pos) - pos.killsInStage
        const applied = Math.min(remaining, Math.max(0, needed))
        if (applied <= 0) {
            pos = nextStage(pos)
            continue
        }

        gold += applied * goldPerKill(pos.prestige, pos.world, pos.stage) * goldMultiplier
        xp = xp.add(xpPerKill(pos.prestige, pos.world, pos.stage).mul(applied))
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
        kills: totalKills,
        goldEarned: gold,
        xpEarned: xp,
        heroLevel: levelled.level,
        heroXp: levelled.xp,
        secondsPerKill: spk,
        blockedAtBoss,
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
 * Evaluated at `GOLD_PRESTIGE_CAP` and the deepest stage. Past the cap the factor table
 * crawls at +2%/prestige by design — decades of prestiging still lands within one order of
 * magnitude of the plateau, versus a column ceiling six orders away.
 */
export function maxGoldPerHour(goldStack = 1, battleSpeed = 1): number {
    const maxGoldPerKill = goldPerKill(GOLD_PRESTIGE_CAP, WORLD_COUNT, STAGES_PER_WORLD)
    return maxGoldPerKill * (3600 / MIN_SECONDS_PER_KILL) * goldStack * battleSpeed
}
