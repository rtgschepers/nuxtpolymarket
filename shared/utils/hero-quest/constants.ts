/**
 * Hero Quest tuning registry — every named constant in the game.
 *
 * Nothing numeric lives at a call site. A magic number in `combat.ts` is a bug even when
 * the value is correct; this file is what makes the balance script and playtest tuning a
 * one-file edit (`docs/hero-quest/CLAUDE.md` §3).
 *
 * Constants stay plain `number` even where the value they feed becomes Decimal — `5` and
 * `1.6` are float-exact and the explosion lives in the exponent, not the base. Promotion
 * to Decimal happens in `settle.ts` / `combat.ts`.
 *
 * ── UNTUNED ╧ ──────────────────────────────────────────────────────────────────────────
 * A `╧` marks a constant with a locked formula shape but no design-doc value. Each ships
 * with a working placeholder so every calculation runs and every graph renders, but the
 * value is a guess and must not be treated as decided.
 *
 *     rg '╧' shared/utils/hero-quest/constants.ts
 *
 * lists the complete fill-in set.
 */

import type { StatTier } from './types'

// ── Run structure ──────────────────────────────────  core-progression-and-prestige.md §2

export const WORLD_COUNT = 10
export const STAGES_PER_WORLD = 10

/** Kills to clear a wave stage. Flat by design — difficulty comes from stats, not counts. */
export const BASE_KILL_COUNT = 30

/** Flat timer on both Stage 5 and Stage 10 fights. */
export const BOSS_TIMER_SECONDS = 30

export const BOSS_STAGE = 5
export const SUPER_BOSS_STAGE = 10
export const ELITE_STAGE_MIN = 6
export const ELITE_STAGE_MAX = 9

// ── Enemy curve ────────────────────────────────────  core-progression-and-prestige.md §1

/**
 * enemyMultiplier = 5^prestige × 1.6^(world-1) × 1.15^(stage-1)
 *
 * Locked, but a continuous `b^n` replacement was mid-tuning when that design session
 * ended (`open-items.md` #8, #10). It lives behind `settle.enemyMultiplier()` so swapping
 * it is a single edit.
 */
export const ENEMY_PRESTIGE_BASE = 5
export const ENEMY_WORLD_BASE = 1.6
export const ENEMY_STAGE_BASE = 1.15

export const BASE_ENEMY_HP = 30 // UNTUNED ╧
export const BASE_ENEMY_PWR = 10 // UNTUNED ╧
export const BASE_ENEMY_DEF = 5 // UNTUNED ╧
export const ELITE_STAT_MULT = 1.35 // UNTUNED ╧

/**
 * Boss and super-boss HP, both relative to that stage's *trash-mob* HP so the two numbers
 * stay directly comparable while balancing. This replaces the contested ×8–12 / ×4–6 pair
 * outright with a clean-slate starting point.
 */
export const BOSS_HP_MULT = 2 // UNTUNED ╧
export const SUPER_BOSS_HP_MULT = 3 // UNTUNED ╧

export const BOSS_ATK_MULT = 1.2
export const SUPER_BOSS_ATK_MULT = 1.5

// ── Combat ─────────────────────────────────────────  classes-and-combat.md §7

/**
 * Mitigation ratio threshold: once a defender's DEF reaches `K` times the attacker's PWR,
 * mitigation is 100% and damage floors at exactly 0.
 */
export const K = 2 // UNTUNED ╧

/** Locked at 60%, leaving headroom for EVA sources added after Traits. */
export const MAX_EVASION = 0.60

/** Archer's LCK 16 → 16% crit; Warrior's LCK 5 → 5%. */
export const CRIT_CHANCE_PER_POINT = 0.01 // UNTUNED ╧

/** IMP 10 → 1.5× crit damage. */
export const CRIT_DAMAGE_PER_POINT = 0.05 // UNTUNED ╧

/**
 * LCK past 100% crit chance converts to crit damage at this rate. Must sit well below
 * CRIT_DAMAGE_PER_POINT — overflow is a "nothing wasted" valve, not a rival to IMP.
 */
export const OVERFLOW_CONVERSION_RATE = 0.01 // UNTUNED ╧

/** HP = BASE_HP + VIT × HP_PER_VIT */
export const BASE_HP = 100 // UNTUNED ╧
export const HP_PER_VIT = 10 // UNTUNED ╧

// ── Attack rate ────────────────────────────────────  basic attacks only

/** Every unit — Hero, Champion, enemy, boss — attacks once per 3s at SPD 0. */
export const BASE_ATTACK_INTERVAL_SECONDS = 3

/** Hard ceiling of 3 attacks per second, however high SPD climbs. */
export const MIN_ATTACK_INTERVAL_SECONDS = 1 / 3

/** Reaches the 3/sec ceiling at SPD 400. */
export const SPD_ATTACK_RATE_PER_POINT = 0.02 // UNTUNED ╧

// ── Hero stats ─────────────────────────────────────  classes-and-combat.md §2

/**
 * The class spread table is qualitative — `high`, `mid`, `low`. These are the numbers
 * those words map to, and the single highest-leverage entry in this file.
 */
export const STAT_TIER_VALUES: Record<StatTier, number> = { // UNTUNED ╧
    low: 5,
    mid: 10,
    mid_high: 13,
    high: 16
}

/** §2's delta table gives directions and qualifiers ("modest", "extreme"), not magnitudes. */
export const DELTA_MODEST = 2 // UNTUNED ╧
export const DELTA_NORMAL = 4 // UNTUNED ╧
export const DELTA_EXTREME = 8 // UNTUNED ╧

/** Floor for any derived stat. Sorcerer lands here on VIT/DEF, which is the design intent. */
export const MIN_STAT_VALUE = 1

/**
 * statAtLevel(base, level) = (base + FLAT × (level-1)) × GROWTH^(level-1)
 *
 * GROWTH = 1.0 is the pure flat-additive model the docs currently describe. Raising it is
 * the one-constant lever for testing whether a persistent Hero level can keep pace with a
 * ×5-per-prestige ceiling.
 */
export const STAT_PER_LEVEL_FLAT = 1 // UNTUNED ╧
export const STAT_PER_LEVEL_GROWTH = 1.0 // UNTUNED ╧

// ── XP ─────────────────────────────────────────────

export const XP_BASE_PER_KILL = 10 // UNTUNED ╧
export const XP_WORLD_BASE = 1.25 // UNTUNED ╧
export const XP_STAGE_BASE = 1.05 // UNTUNED ╧

/**
 * No design doc covers XP the way `gold-economy.md` covers Gold. Since Hero level now
 * persists across prestige, whether XP carries a prestige term at all decides whether
 * levels stall or keep pace. Flagged, not settled.
 */
export const XP_PRESTIGE_BASE = 2 // UNTUNED ╧

/** xpToNextLevel(level) = XP_TO_LEVEL_BASE × XP_TO_LEVEL_GROWTH^(level-1) */
export const XP_TO_LEVEL_BASE = 100 // UNTUNED ╧
export const XP_TO_LEVEL_GROWTH = 1.12 // UNTUNED ╧

// ── Gold ───────────────────────────────────────────  gold-economy.md §3–4

export const BASE_GOLD = 5 // UNTUNED ╧

/** Deliberately much shallower than the enemy 1.6/1.15 — Gold is decoupled from the curve. */
export const GOLD_WORLD_BASE = 1.25
export const GOLD_STAGE_BASE = 1.05

/** Where prestigeGoldFactor stops growing and the plateau crawl begins. Doc says ~17–18. */
export const GOLD_PRESTIGE_CAP = 17 // UNTUNED ╧

/**
 * Explicit config table, not a closed form — the growth *rate itself* has to decay
 * (≈×2.8/prestige early → ≈×1.4 by month 6 → ×1.0 at cap), which no single `G^p` produces.
 *
 * Generated by `bun run balance:hero-quest --solve=prestige-gold`, which interpolates
 * geometrically between §3's calendar anchors — so p=11 lands on 235M and p=16 on 710M by
 * construction. Re-run and paste back after BASE_GOLD moves; this is a multiplier chain,
 * not an absolute, so it only means anything relative to a calibrated BASE_GOLD.
 */
export const PRESTIGE_GOLD_FACTOR: readonly number[] = [ // UNTUNED ╧
    1,
    2.82843,
    8,
    37.1327,
    172.355,
    800,
    1972.97,
    4865.76,
    12000,
    23832.2,
    47331,
    94000,
    117264,
    146286,
    182491,
    227657,
    284000,
    340000
]

/** Past the cap the table continues at +2% per prestige instead of going flat. Locked. */
export const GOLD_PLATEAU_GROWTH = 1.02

/**
 * Throughput floor. Bounds the *rate* half of Gold/hour — a bounded per-kill value times
 * an unbounded kill rate is still unbounded income. Also the pacing floor the Pixi battle
 * scene needs. Live and offline use the identical function so the two always agree.
 */
export const MIN_SECONDS_PER_KILL = 0.5 // UNTUNED ╧

// ── Offline ────────────────────────────────────────  idle-mechanics.md §4

/** offlineCapHours(level) = 8 + 2 × level, level 0..32 → 72 hours at the top. Locked. */
export const OFFLINE_CAP_BASE_HOURS = 8
export const OFFLINE_CAP_HOURS_PER_LEVEL = 2
export const MAX_OFFLINE_CAP_LEVEL = 32
export const OFFLINE_CAP_MAX_HOURS = 72

/** 50 → 60 → 70 → 80 → 90 → 100% over 5 shop levels. Locked. */
export const BASE_OFFLINE_EFFICIENCY = 0.50
export const OFFLINE_EFFICIENCY_PER_LEVEL = 0.10
export const MAX_OFFLINE_EFFICIENCY = 1.0
export const MAX_OFFLINE_EFFICIENCY_LEVEL = 5

/** Short prestige-shop tracks double per level; the 32-level cap track uses a gentler base. */
export const OFFLINE_EFFICIENCY_BASE_COST = 50 // UNTUNED ╧
export const OFFLINE_EFFICIENCY_COST_GROWTH = 2
export const OFFLINE_CAP_BASE_COST = 25 // UNTUNED ╧
export const OFFLINE_CAP_COST_GROWTH = 1.72
