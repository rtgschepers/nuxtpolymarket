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
 * The continuous `b^n` curve from `open-items.md` #10, now applied.
 *
 *     n = prestige × 100 + (world-1) × 10 + (stage-1)
 *     enemyMultiplier = b^n,  b = T^(1/100)
 *
 * One index, one base, one smooth ramp. It replaces `5^p × 1.6^(w-1) × 1.15^(s-1)`, whose
 * three separate bases stepped unevenly — a world boundary jumped ×1.6 where a stage step
 * moved ×1.15, and every axis had to be reasoned about on its own. The single index is also
 * what lets the XP curve ride the *same* ramp, which is what stops XP/second decaying with
 * depth (see XP_STEP_EXPONENT).
 *
 * ⚠ This deliberately removes the prestige difficulty reset. Under the old curve P+1 W1S1
 * landed ~52× weaker than P W10S10, so prestige meant re-climbing familiar ground. Here
 * index 99 → 100 is one ordinary step and the ramp never dips. To put the dip back without
 * leaving this file: set PRESTIGE_INDEX_STEPS = 0 and ENEMY_PRESTIGE_STEP_MULT = 5.
 */

/** Index steps a prestige is worth. Deriving it from the run length keeps the ramp seamless. */
export const PRESTIGE_INDEX_STEPS = WORLD_COUNT * STAGES_PER_WORLD

/**
 * How much harder each single stage is than the one before it — the whole enemy curve, in
 * one number you can hold in your head. 1.08 is +8% per stage.
 *
 *     bun run sim:hero-quest --report=campaign --sweep=ENEMY_STEP_BASE=1.05,1.08,1.10
 *
 * Authored here rather than as the per-loop total `T`, because `T` is per *hundred* stages
 * and a solo Hero is only ever meant to cover a few dozen. Wanting the run to end around
 * Stage 30 forces T into the tens of thousands, which reads as a runaway number when it is
 * really just 1.08 raised to a large power. Tune the step; read the total.
 *
 * The trade this dial sets, and the reason it is not simply "as steep as feels hard": the
 * party pools its PWR (`partyMitigation`), so N units push the zero-damage threshold out by
 * `ln(N)/ln(b)` stages — at *every* depth, which is the point of pooling. The party runs
 * from 3 (Hero + 2 Champions) to 6 at full slot expansion, so at 1.08 that is +14.3 stages
 * at the start and +23.3 fully expanded. Steeper `b` shrinks both: at 1.14 a full party is
 * worth only 14 stages. **Steepening to force the gacha earlier also shrinks what the gacha
 * is worth when it arrives.**
 */
export const ENEMY_STEP_BASE = 1.08 // UNTUNED ╧

/**
 * Enemy multiplier across one full 100-stage loop, i.e. what one prestige costs you. Derived
 * — this is the `T` a prior design session was sliding on a Desmos slider (`open-items.md`
 * #10), kept as a named export because it is the number that describes prestige pacing.
 *
 * For reference, `1.6^9 × 1.15^9 = 241.7` is what the old three-base curve grew across one
 * run. The continuous curve cannot separate that from the old ×5 per prestige — under a
 * single index they are the same number. See ENEMY_PRESTIGE_STEP_MULT to keep them apart.
 */
export const ENEMY_CURVE_T = Math.pow(ENEMY_STEP_BASE, PRESTIGE_INDEX_STEPS)

/**
 * Extra multiplier applied per prestige on top of the ramp. 1 is the continuous curve as
 * designed; the escape hatch described above is the only reason it exists.
 */
export const ENEMY_PRESTIGE_STEP_MULT = 1

export const BASE_ENEMY_HP = 30 // UNTUNED ╧
export const BASE_ENEMY_PWR = 10 // UNTUNED ╧
export const BASE_ENEMY_DEF = 5 // UNTUNED ╧
export const ELITE_STAT_MULT = 1.2 // UNTUNED ╧

/**
 * Boss and super-boss HP, both relative to that stage's *trash-mob* HP so the two numbers
 * stay directly comparable while balancing. This replaces the contested ×8–12 / ×4–6 pair
 * outright with a clean-slate starting point.
 *
 * The super boss is deliberately the heavier of the two, because a gate against a fixed
 * `BOSS_TIMER_SECONDS` is a pure DPS check, and party DPS is exactly what Champions add.
 * Making the *gate* the wall — rather than the wave ramp — is what turns "this got slow"
 * into "this needs a party", which is the thing a player can act on.
 */
export const BOSS_HP_MULT = 3 // UNTUNED ╧
export const SUPER_BOSS_HP_MULT = 6 // UNTUNED ╧

export const BOSS_ATK_MULT = 1.2 // UNTUNED ╧
export const SUPER_BOSS_ATK_MULT = 1.5 // UNTUNED ╧

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

/**
 * Re-derived when Phase 1 settled the HP model, and the reason it is this large.
 *
 * HP is **one pool across a whole stage attempt** (`settle.killsBeforeWipe`), so the number
 * a wave stage asks for is not "survive an enemy" but "survive thirty of them back to back"
 * — about five minutes of uninterrupted fire at World 1. At the old value of 10 a level-1
 * Hero had 200 HP against 476 damage over a Stage 1 attempt: it wiped at kill 12, restarted,
 * and the campaign sim never completed a single prestige. Sized so that opening clears with
 * ~4× margin and every World 1 elite stage holds ≥1.6×.
 *
 * It is the only survivability lever that keeps working: `BASE_HP` is flat and goes
 * irrelevant within a few levels, and moving `BASE_ENEMY_PWR` instead sits on a knife edge —
 * mitigation clamps to 100% the moment enemy PWR drops under `heroDef / K`, flipping the
 * party from fragile to immortal with nothing in between.
 *
 * The wall did not move: the campaign still ends at prestige 2 / World 8 in 3d 14h, exactly
 * as before, because survivability was never what bound it at depth — party DPS is.
 */
export const HP_PER_VIT = 200 // UNTUNED ╧

// ── Attack rate ────────────────────────────────────  basic attacks only

/** Every unit — Hero, Champion, enemy, boss — attacks once per 3s at SPD 0. */
export const BASE_ATTACK_INTERVAL_SECONDS = 3

/** Hard ceiling of 3 attacks per second, however high SPD climbs. */
export const MIN_ATTACK_INTERVAL_SECONDS = 1 / 3

/** Reaches the 3/sec ceiling at SPD 400. */
export const SPD_ATTACK_RATE_PER_POINT = 0.02 // UNTUNED ╧

// ── Skill cooldowns ────────────────────────────────  classes-and-combat.md §3

/**
 * Floor on a SPD-shortened skill cooldown, the cooldown-side twin of
 * `MIN_ATTACK_INTERVAL_SECONDS`.
 *
 * ⚠ **SPD drives two things, and only one of them is in a design doc.**
 * `classes-and-combat.md` §3 states SPD's role as reducing *cooldown duration* and says
 * nothing about autoattack rate — but Phase 0 shipped `attackIntervalFor`, which shortens
 * the autoattack interval off the same stat, and `settle.ts` plus every campaign number
 * now depend on it. Rather than pick one and quietly drop the other, both ride the
 * identical `1 / (1 + SPD × SPD_ATTACK_RATE_PER_POINT)` curve: one stat, one shape, two
 * consumers. §3 should be amended to say so.
 */
export const MIN_COOLDOWN_SECONDS = 0.5 // UNTUNED ╧

/**
 * The starting cooldown and damage multiplier **every one of the 16 class skills** uses.
 *
 * Uniform on purpose. No design doc assigns a cooldown or a magnitude to any skill —
 * `classes-and-combat.md` §3 says only that "every skill's cooldown length will differ (set
 * later during balancing)". Handing out 16 different invented pairs would encode a spread
 * nobody decided and which would read three phases later as intentional. One shared pair
 * makes the absence obvious, and `ClassSkill` still carries the fields per node, so
 * differentiating them later is a content edit and nothing else.
 */
export const SKILL_BASE_COOLDOWN_SECONDS = 8 // UNTUNED ╧
export const SKILL_BASE_ABILITY_MULTIPLIER = 2 // UNTUNED ╧

/**
 * Tick granularity of the seeded boss simulation (`fight.ts`).
 *
 * Bounds the work: `BOSS_TIMER_SECONDS / FIGHT_TICK_SECONDS` iterations, fixed, regardless
 * of party strength or depth. Finer ticks resolve cooldowns and attack intervals more
 * exactly at the cost of a longer replay log the client has to animate.
 */
export const FIGHT_TICK_SECONDS = 0.1 // UNTUNED ╧

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
 * GROWTH used to be 1.0 — pure flat-additive, which `classes-and-combat.md` §4 argued and
 * the campaign sim then demonstrated **cannot** chase an exponential enemy curve: required
 * level runs as `b^n` and required XP as `XP_TO_LEVEL_GROWTH^(b^n)`, doubly exponential. A
 * solo Hero stalled in World 3 and never completed a prestige, at any XP rate.
 */
/**
 * Additive term, on top of the geometric one. **0 by design now**: with compounding growth
 * an additive term is a pure early-game distortion — +1 on a base of 10 is +10% per level
 * against a curve moving +8% per stage, so the Hero sprints away from it for the first
 * dozen levels and never gives the lead back. Pure geometric growth is what makes the pacing
 * math below actually hold at every level rather than only asymptotically.
 */
export const STAT_PER_LEVEL_FLAT = 0 // UNTUNED ╧

/**
 * How many factors of the stat curve one point of DPS carries.
 *
 * Damage is `PWR × critMultiplier × attacksPerSecond × strikes`, and **two of those ride the
 * stat block**: PWR directly, and `critMultiplier` through IMP. So DPS grows as the stat
 * curve *squared*, not linearly — at level 156 that is PWR 7.6e6 × critMult 380,260, and the
 * Hero outruns a curve it appears on paper to be matching.
 *
 * 2 is the asymptotic value, once crit chance has capped at 100% and attack rate at its
 * ceiling. Below those caps LCK and SPD scale too and the true exponent is nearer 4, so
 * early levels are worth more than this says. That is a real wrinkle in the model and not
 * one a single constant can express — it is why `STAT_PACE_RATIO` still wants playtesting
 * rather than solving.
 */
export const DPS_STAT_EXPONENT = 2

/**
 * **How much of one stage's difficulty one level of DPS buys.** Expressed against the enemy
 * curve itself, and divided by `DPS_STAT_EXPONENT` because damage compounds the stat curve
 * twice over:
 *
 *     1.0   the Hero's DPS exactly tracks the enemy — one level per stage, forever
 *     0.5   a level buys half a stage, so the Hero bleeds half a stage each time   ← here
 *
 * Below 1.0 the shortfall compounds, and it is what the multiplicative power sources — the
 * four gacha collections, prestige-shop multipliers, Traits — are supposed to fill. That is
 * the design: levels carry most of the curve, and the remainder is the reason to engage with
 * everything else. Measured at 0.5, which is where the party earns its keep:
 *
 *     solo Hero        walls at prestige 2, World 8      (3d 14h)
 *     + 2 Champions    walls at prestige 4, World 3      (5d 8h)
 *     + 5 Champions    no wall inside five prestiges
 *
 * ⚠ **1.0 removes gating entirely.** If the Hero tracks the curve exactly then "can I beat
 * World N's super boss" has the same answer for every N, and progression is purely time-
 * gated — the gacha becomes a speed multiplier rather than a gate. That may well be the
 * better game; it is a deliberate choice, not a safe default, so it is not the value here.
 */
export const STAT_PACE_RATIO = 0.5 // UNTUNED ╧

/** Derived, never set directly — move `STAT_PACE_RATIO`. */
export const STAT_PER_LEVEL_GROWTH = Math.pow(ENEMY_STEP_BASE, STAT_PACE_RATIO / DPS_STAT_EXPONENT)

/**
 * What one point of a Champion's `(star × 10 + level)` scalar is worth as a stat multiplier.
 * The scalar runs 1 → 60, so this sets the span between an unstarred pull and a maxed one:
 * at 0.05 that is ×1.0 → ×3.95 on top of the rarity multiplier.
 *
 * Phase 2 owns the real value — `champions-guild-gacha.md` §2 never states how the scalar
 * converts to stats for a Champion's own block, unlike Gear and Artifacts which both have
 * explicit formulas. Placeholder so the shape is testable.
 */
export const CHAMPION_INVESTMENT_PER_POINT = 0.05 // UNTUNED ╧

// ── XP ─────────────────────────────────────────────

export const XP_BASE_PER_KILL = 10 // UNTUNED ╧

/**
 * xpToNextLevel(level) = XP_TO_LEVEL_BASE × XP_TO_LEVEL_GROWTH^(level-1)
 *
 * How steeply a level's price climbs. Together with `STAT_PACE_RATIO` this sets the whole
 * pace of the game: the ratio decides how much *ground* a level buys, this decides how much
 * *time* a level costs.
 *
 * Declared ahead of the XP-income constants because `XP_STEP_EXPONENT` is derived from it.
 */
export const XP_TO_LEVEL_BASE = 100 // UNTUNED ╧
export const XP_TO_LEVEL_GROWTH = 1.16 // UNTUNED ╧

/**
 * How XP income tracks difficulty, as an exponent on the enemy curve's own step:
 *
 *     < 1   XP/second decays with depth — the old three-base curve sat here (≈0.45)
 *     = 1   XP/second is exactly flat, at every depth and forever
 *     > 1   XP/second climbs with depth
 *
 * Flat is not the same as keeping pace. A level costs `XP_TO_LEVEL_GROWTH^level` and buys
 * `STAT_PER_LEVEL_GROWTH^level` of stats, so holding **wall-clock time per stage** constant
 * — the property that actually makes an idle game feel steady — needs
 *
 *     XP_STEP_EXPONENT = ln(XP_TO_LEVEL_GROWTH) / ln(STAT_PER_LEVEL_GROWTH)
 *
 * That break-even is the *whole* of the pacing question, and it swallows `STAT_PACE_RATIO`
 * completely: whatever ground a level fails to buy, the derived exponent hands back as extra
 * XP, so the run never walls at any ratio. Measured — at ratio 0.9 with no slack a solo Hero
 * clears four prestiges in 93 minutes without grinding once.
 *
 * So the slack has to be its own dial. It is the only thing that decides whether the game
 * has a wall at all:
 *
 *     1.0   income exactly matches the break-even — constant seconds per stage, forever,
 *           and no wall ever. The gacha becomes a speed multiplier, not a gate.
 *     0.9   income falls 10% short of break-even, so seconds-per-stage climbs geometrically
 *           and the run eventually stops being worth grinding.
 *
 * Everything else — party pooling, gacha multipliers, prestige upgrades — then reads as
 * "how much further before the slack catches up with you."
 */
export const XP_PACE_SLACK = 0.9 // UNTUNED ╧

/** Derived. Move `XP_PACE_SLACK`, or the two curves it is measured against. */
export const XP_STEP_EXPONENT =
    XP_PACE_SLACK * Math.log(XP_TO_LEVEL_GROWTH) / Math.log(STAT_PER_LEVEL_GROWTH)

/** Per-step XP base. Derived from the exponent above. */
export const XP_STEP_BASE = Math.pow(ENEMY_STEP_BASE, XP_STEP_EXPONENT)

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

// ── Presence ───────────────────────────────────────  tech-architecture.md §4b

/**
 * How often the open client re-reads state. Lazy settle erases the app-open/app-closed
 * distinction that offline efficiency and the offline cap depend on; a steady refresh is
 * what restores it, by *demonstrating* presence through the request pattern rather than
 * letting the client assert it.
 */
export const HQ_REFRESH_INTERVAL_MS = 60_000 // UNTUNED ╧

/**
 * Gap at or below which a settle window counts as **online** — full rate, no cap, no
 * efficiency tax. Anything longer is an offline chunk.
 *
 * Deliberately a few times the refresh interval: a closed app then looks identical to a
 * dead network, which is the correct failure direction (degrades to offline rules, never
 * inflates).
 */
export const ONLINE_THRESHOLD_MS = HQ_REFRESH_INTERVAL_MS * 3 // UNTUNED ╧

// ── Prestige currency ──────────────────────────────  economy-and-currencies.md §3

/**
 * voidShardsEarned(prestigeCompleted) = VOID_SHARD_BASE × VOID_SHARD_GROWTH^prestigeCompleted
 *
 * Paid only on a full World 10 / Stage 10 clear — no partial credit. Both values are the
 * doc's own "starting point" wording, not a decided number. `VOID_SHARD_GROWTH` is meant to
 * stay well below the enemy curve's per-loop factor: it only has to outpace shop costs, not
 * the power curve.
 *
 * Decimal, not integer — `2^prestige` overflows a 64-bit bigint around prestige 56, which
 * an infinite-prestige game reaches.
 */
export const VOID_SHARD_BASE = 100 // UNTUNED ╧
export const VOID_SHARD_GROWTH = 2 // UNTUNED ╧
