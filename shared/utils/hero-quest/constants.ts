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

// ── Enemy packs ────────────────────────────────────  classes-and-combat.md §7, §6
//
// How many enemies stand in one encounter. **No design doc owns this number** — the combat
// model was single-enemy until now, which left every "AoE", "3 random enemies" and "chain to
// a second enemy" in both ability rosters with nothing to hit, and left the Tank's threat
// modifier with nothing to re-weight.
//
// `BASE_KILL_COUNT` still counts **individual enemies**, not encounters: a wave stage is 30
// bodies that now arrive in bursts of N. Keeping that unit is what leaves `goldPerKill`,
// `xpPerKill`, `MIN_SECONDS_PER_KILL` and the whole `PRESTIGE_GOLD_FACTOR[]` chain untouched,
// and what lets the persisted `hq_state.kill_count` keep its meaning with no migration.
//
// Because pack HP and party DPS both scale by N against a homogeneous pack, `secondsPerKill`
// is algebraically unchanged at any size. Packs move difficulty **entirely onto
// survivability** — one lever, one axis.

/**
 * Six per encounter divides `BASE_KILL_COUNT` exactly — a wave or elite stage is **5 packs**,
 * not 30 lone enemies trickling past. Keep any retune a divisor of 30 or the last pack of a
 * stage is a ragged remainder.
 */
export const WAVE_PACK_SIZE = 6 // UNTUNED ╧
export const ELITE_PACK_SIZE = 6 // UNTUNED ╧

/**
 * Minions standing with a boss or super boss. The boss itself is always exactly one, so a
 * boss encounter holds `BOSS_MINION_COUNT + 1` bodies.
 *
 * Deliberately smaller than a wave pack: the boss is the fight, and its escort is there to
 * split the party's attention and give AoE something to answer, not to become the fight. The
 * `BOSS_TIMER_SECONDS` gate covers the **whole encounter**, so every minion is time taken off
 * the boss — which is what makes clearing adds a real decision rather than free damage.
 */
export const BOSS_MINION_COUNT = 2 // UNTUNED ╧

/**
 * Fraction of a pack still swinging, averaged over one stage attempt.
 *
 * Under focus fire an encounter's live attackers walk N → N-1 → … → 1, so the mean over an
 * attempt is exactly `(N+1)/2` — which `0.5` reproduces. `1.0` is the conservative endpoint
 * (every member swinging for the whole attempt). Whatever it holds, N = 1 yields exactly one
 * stream, so bosses and every pre-pack number stay bit-identical.
 */
export const PACK_LIVE_STREAM_FRACTION = 0.5 // UNTUNED ╧

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
 * mitigation is 100% — and damage floors at `MIN_DAMAGE`, not at 0.
 */
export const K = 2 // UNTUNED ╧

/**
 * The damage floor. **A hit never deals less than this, however far DEF outruns PWR.**
 *
 * ## Why this exists
 *
 * The clamped mitigation form used to bottom out at exactly 0, which made every wall in the
 * game a *hard* wall rather than a slow one: the Phase 2 campaign sim reported `STALLED
 * (0 dmg)` at essentially every elite stage, because the enemy's DEF had passed `PWR × K` and
 * the party's damage was not merely small but literally nothing. A player in that state has
 * no feedback that they are close, no partial progress, and no way to tell a 1%-short wall
 * from a 90%-short one.
 *
 * A floor of 1 changes the *kind* of wall without meaningfully changing its position: against
 * an enemy with 10^40 HP, 1 damage per hit is not a route through, so the gate still gates.
 * What it buys is that progress is always non-zero and always measurable, and that no party
 * is ever perfectly immortal either — the floor is symmetric, so an over-armoured party takes
 * 1 per hit rather than being untouchable.
 *
 * Applied in `rawHitDamage`, which is the one place pairwise damage is derived, and mirrored
 * in `partyDps` and `fight.rollDamage` where the pooled path computes damage directly.
 */
export const MIN_DAMAGE = 1 // UNTUNED ╧

/** Locked at 60%, leaving headroom for EVA sources added after Traits. */
export const MAX_EVASION = 0.60

// ── Status effects ─────────────────────────────────  classes-and-combat.md §7 (new)
//
// No design doc defines a status system, but both ability rosters assume one — stacking DoTs,
// refreshed debuffs, shields, cleanses, debuff immunity, "extend all active debuffs". These
// are the rules that assumption needs, decided here rather than transcribed.

/**
 * Ceiling on stacks of one effect on one unit.
 *
 * Reapplication refreshes duration *and* adds a stack, so without a cap a maintained DoT grows
 * without bound — and Frostbind's "at max stacks, fully disables" needs a max to point at.
 */
export const STATUS_MAX_STACKS = 5 // UNTUNED ╧

/**
 * The grid periodic effects pay out on.
 *
 * Deliberately **not** `FIGHT_TICK_SECONDS`: paying per combat tick would tie every DoT's
 * strength to the sim's resolution, so halving the tick would halve every burn. A fixed grid
 * keeps "damage per second" a property of the effect rather than of the simulator.
 */
export const STATUS_TICK_SECONDS = 1 // UNTUNED ╧

/**
 * Threat weight of a unit with no aggro identity — the baseline every multiplier is against.
 *
 * Threat re-weights *within* the row the enemy is already allowed to hit; it never overrides
 * front-row-first eligibility (`champions-guild-gacha.md` §8.4, which is explicit that a
 * back-lined Tank's taunt stays inert while the front row stands).
 */
export const BASE_THREAT = 1

/**
 * What a Tank archetype and the Warrior class path multiply their threat by.
 *
 * `champions-guild-gacha.md` §8.2 calls Tank "the primary aggro anchor for the party" and
 * `classes-and-combat.md` §7 gives the Warrior path "a threat modifier pulling a share of
 * enemy attacks onto itself" — neither assigns a number, so this is the placeholder that makes
 * both real. Any value above 1 is enough to put a Tank in front of its own row-mates; the
 * magnitude only matters once threat becomes a contested, continuous quantity.
 */
export const TANK_THREAT_MULTIPLIER = 3 // UNTUNED ╧

/** What an active taunt multiplies threat by, on top of whatever the unit already carries. */
export const TAUNT_THREAT_MULTIPLIER = 10 // UNTUNED ╧

/** Archer's LCK 16 → 16% crit; Warrior's LCK 5 → 5%. */
export const CRIT_CHANCE_PER_POINT = 0.01 // UNTUNED ╧

/** IMP 10 → 1.5× crit damage. */
export const CRIT_DAMAGE_PER_POINT = 0.05 // UNTUNED ╧

/**
 * LCK past 100% crit chance converts to crit damage at this rate. Must sit well below
 * CRIT_DAMAGE_PER_POINT — overflow is a "nothing wasted" valve, not a rival to IMP.
 */
export const OVERFLOW_CONVERSION_RATE = 0.01 // UNTUNED ╧

/**
 * HP = BASE_HP + VIT × HP_PER_VIT
 *
 * **The early-game survivability lever, and only that.** Flat, so it dominates at level 1 and
 * is arithmetic noise by the time VIT has compounded — which used to make it useless and is
 * now exactly why it is load-bearing. It carries the level-1 solo opening on its own, freeing
 * `HP_PER_VIT` to be tuned for how a *levelled party* feels without breaking a fresh account.
 *
 * Raised 100 → 2000 in the session-1 playtest pass, alongside the `HP_PER_VIT` cut below.
 * Verified irrelevant past the opening: a party of 3 walls at exactly P2 W2S6 / level 808 for
 * every value from 1000 to 8000. Solo needs ≥2000 — at 1000 a level-1 Hero still cannot clear
 * World 1 Stage 1 and the campaign is unfarmable from the first screen.
 */
export const BASE_HP = 2000 // UNTUNED ╧

/**
 * **The levelled-party survivability dial.** Cut 200 → 10 by the session-1 playtest.
 *
 * HP is **one pool across a whole stage attempt** (`settle.killsBeforeWipe`), so the number a
 * wave stage asks for is not "survive an enemy" but "survive thirty of them back to back" —
 * about five minutes of uninterrupted fire at World 1. That is why it was ever this large.
 *
 * ## Why it moved
 *
 * The playtest reported taking **zero damage across three worlds**, and the sim agrees
 * outright: at 100 and at 200 the campaign is byte-identical — same wall, same level, same
 * prestige count, solo *and* with a party. The top half of the old value was doing nothing at
 * all. Survivability was simply not a constraint anywhere in the run.
 *
 * ## Why Phase 1's derivation was still right at the time
 *
 * Phase 1 raised this from 10 to 200 because at 10 a level-1 solo Hero had 200 HP against 476
 * damage over a Stage 1 attempt: it wiped at kill 12 and the campaign never completed a single
 * prestige. That reasoning holds and the failure still reproduces — a straight cut back to 10
 * with `BASE_HP` at 100 makes World 1 Stage 1 unfarmable, so a brand-new account cannot start.
 *
 * What resolves it is that the two ends want different levers. `BASE_HP` at 2000 carries the
 * opening; this carries everything after. Phase 1 lacked that split because it was tuning a
 * solo Hero, where the two are the same number.
 *
 * ## What it cost
 *
 * Damage is now a real constraint, and the campaign is correspondingly shorter: a party of 3
 * falls from P4 W3S6 / 4 prestiges to **P2 W2S6 / 2 prestiges**, and grind time rises from
 * 4d 0h to 4d 13h. Chosen deliberately over 25 (3 prestiges, 3d 7h) and 50 (3 prestiges,
 * 2d 22h), both of which are also safe at `BASE_HP` 2000 if this proves too punishing.
 *
 * Note `BASE_ENEMY_PWR` remains the wrong lever for this: mitigation clamps to 100% the moment
 * enemy PWR drops under `heroDef / K`, flipping the party from fragile to immortal with nothing
 * in between.
 */
export const HP_PER_VIT = 10 // UNTUNED ╧

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

// ── Ability effect magnitudes ──────────────────────  classes-and-combat.md §7, §3
//
// Every ability in both rosters is described in prose and given no numbers anywhere — "a
// short duration", "a portion", "small", "solid". These are the shapes that prose implies,
// as one named set rather than 44 literals scattered through content files, so the eventual
// balance pass is a single edit here.
//
// The relative *ordering* is the design content and is deliberate: wide AoE pays for its
// reach, a pierce beats a basic attack by a little, and single-target burst beats both.

/** Wide AoE trades magnitude for reach — it is hitting up to six bodies. */
export const SKILL_AOE_MULTIPLIER = 1.0 // UNTUNED ╧

/** A pierce hits two, so it sits between an autoattack and a full-power single hit. */
export const SKILL_PIERCE_MULTIPLIER = 1.3 // UNTUNED ╧

/** A line hit reaches up to three — between a pierce and a full-board storm. */
export const SKILL_LINE_MULTIPLIER = 1.2 // UNTUNED ╧

/** How long an ability-applied buff, debuff or control lasts. */
export const SKILL_STATUS_DURATION_SECONDS = 6 // UNTUNED ╧

/** Hard control is short by design — it denies actions outright rather than slowing them. */
export const SKILL_CONTROL_DURATION_SECONDS = 2 // UNTUNED ╧

/** Fractional shift a one-stat buff or debuff applies, per stack. */
export const SKILL_BUFF_FRACTION = 0.25 // UNTUNED ╧
export const SKILL_DEBUFF_FRACTION = 0.20 // UNTUNED ╧

/** Healing and shielding as a multiple of the caster's PWR (`champions-guild-gacha.md` §2). */
export const SKILL_HEAL_MULTIPLIER = 1.5 // UNTUNED ╧
export const SKILL_SHIELD_MULTIPLIER = 2.0 // UNTUNED ╧

/** Damage-over-time per tick, as a multiple of PWR. Lower than a hit; it lands repeatedly. */
export const SKILL_DOT_MULTIPLIER = 0.4 // UNTUNED ╧
export const SKILL_HOT_MULTIPLIER = 0.4 // UNTUNED ╧

/**
 * Haste doubles SPD — **the one ability magnitude any doc actually states**
 * (`classes-and-combat.md` §3). Expressed as the fraction added, so +1.0 is a doubling.
 * Not marked untuned: it is specified, not guessed. The duration is not.
 */
export const HASTE_SPD_BONUS = 1.0

/** Enrage's trade: PWR up, and more incoming damage taken, as `classes-and-combat.md` §2 has it. */
export const ENRAGE_PWR_BONUS = 0.6 // UNTUNED ╧
export const ENRAGE_DEF_PENALTY = 0.4 // UNTUNED ╧

/** Kill Shot always crits, and crits for this multiple of the normal crit. */
export const KILL_SHOT_CRIT_MULTIPLIER = 2 // UNTUNED ╧

/** How much an execute-style ability gains against a target at 0% HP. */
export const EXECUTE_BONUS = 1.5 // UNTUNED ╧

/** Reflected and redirected fractions, per stack. */
export const SKILL_REFLECT_FRACTION = 0.25 // UNTUNED ╧
export const SKILL_REDIRECT_FRACTION = 0.4 // UNTUNED ╧

/** How many separate rolls Focused Barrage splits its damage into — "more crit rolls per cast". */
export const FOCUSED_BARRAGE_HITS = 4 // UNTUNED ╧

/** Fraction of max HP a revived ally comes back on — Second Wind's "partial HP". */
export const REVIVE_HP_FRACTION = 0.3 // UNTUNED ╧

/**
 * Frostbind: "stacking slow; at max stacks, fully disables (freezes) the target".
 *
 * Two independent dials, deliberately. `STACKS_PER_CAST` is how fast the slow builds, and
 * `FREEZE_STACKS` is how deep it has to get before the freeze lands — so the *time to freeze*
 * can be retuned from either end without touching the other, or the freeze pushed out of reach
 * entirely by setting the threshold above `STATUS_MAX_STACKS`.
 *
 * The threshold is a stack count rather than "on the last application", so it stays meaningful
 * however many casts it takes to get there.
 */
export const FROSTBIND_STACKS_PER_CAST = 1 // UNTUNED ╧
export const FROSTBIND_FREEZE_STACKS = 3 // UNTUNED ╧

/**
 * The most of an incoming wave that party healing may cancel in the **idle projection**.
 *
 * Not a combat rule — `fight.ts` resolves heals for real and needs no cap. This exists because
 * the averaged rate model would otherwise let a party with one Support drive incoming damage
 * to zero and become immortal, restoring exactly what `MIN_DAMAGE` was introduced to remove,
 * in the one place no fight would ever contradict it.
 */
export const MAX_SUSTAIN_MITIGATION = 0.9 // UNTUNED ╧

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

/**
 * Re-denominated 10 → 1 by the session-1 playtest, together with `XP_TO_LEVEL_BASE` below.
 *
 * The pair moves together or not at all: level pace, level count and wall position are all set
 * by the **ratio** of XP earned to XP required, so dividing both by ten is provably neutral —
 * a pure change of units. Nothing about the run moves; the displayed numbers are one order of
 * magnitude smaller at every depth.
 */
export const XP_BASE_PER_KILL = 1 // UNTUNED ╧

/**
 * xpToNextLevel(level) = XP_TO_LEVEL_BASE × XP_TO_LEVEL_GROWTH^(level-1)
 *
 * How steeply a level's price climbs. Together with `STAT_PACE_RATIO` this sets the whole
 * pace of the game: the ratio decides how much *ground* a level buys, this decides how much
 * *time* a level costs.
 *
 * Declared ahead of the XP-income constants because `XP_STEP_EXPONENT` is derived from it.
 */
/** Re-denominated 100 → 10 with `XP_BASE_PER_KILL`. See its note — the two move as a pair. */
export const XP_TO_LEVEL_BASE = 10 // UNTUNED ╧

/**
 * ⚠ **Not the lever for "XP numbers are too big", despite being the obvious candidate.**
 *
 * The session-1 playtest asked for smaller XP numbers and this looks like the dial, since it is
 * what makes them climb. It is the wrong one: cheaper levels mean *more* levels, so lowering it
 * makes the displayed **level** larger while lengthening the run. Swept on the campaign report:
 *
 *     1.16 (here)   P2 W8S6   level 1,025   2 prestiges   3d 11h grind
 *     1.12          P3 W2S6   level 1,185   3 prestiges   5d 9h
 *     1.08          P3 W10S6  level 1,505   3 prestiges   9d 17h
 *     1.06          P4 W7S6   level 1,785   4 prestiges   11d 9h
 *
 * `XP_STEP_EXPONENT` below is derived from this and does compensate — but for XP *income*, not
 * for the level count, which is why the pace does not simply self-preserve. The re-denomination
 * on `XP_TO_LEVEL_BASE` is what addresses the legibility complaint; this stays put.
 *
 * Worth keeping in view for a different question: the same sweep shows lower growth buys 4
 * prestiges instead of 2 out of the identical curve, so this **is** the dial for *run length*.
 */
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

// ── Gacha ──────────────────────────────────────────  gacha-shared-system.md §2–6
//
// Shared by all four gachas. Champions are the only one built (Phase 2); Gear, Skills and
// Artifacts reuse every constant below unchanged, which is the whole point of the single
// `hqCollection` table.

/**
 * Pulls needed to advance a gacha from level L to L+1, indexed by L (1-based; index 0 unused).
 *
 * **Doc-specified table, not a live formula.** `gacha-shared-system.md` §2 gives the shape as
 * `roundDown(10 × 2.6^(L-1) × 1.5)` and then rounds each result "to a clean denomination"
 * — nearest 10 below 100, nearest 100 up to 10,000, nearest 1,000 above. The rounded values
 * are what the doc actually locks, so they are transcribed rather than recomputed; the raw
 * formula does not reproduce them.
 *
 * Cumulative to max a single gacha at level 10: ~50,240 pulls.
 */
export const PULLS_TO_LEVEL_UP: readonly number[] = [
    0, 10, 30, 100, 200, 600, 1_700, 4_600, 12_000, 31_000
]

export const MAX_GACHA_LEVEL = 10

/**
 * Drop rates by gacha level, `[common, uncommon, rare, epic, legendary, mythic]`.
 *
 * Index 0 is unused so the level indexes directly. Every row must sum to exactly 100% —
 * enforced in `test/hero-quest/content.spec.ts`, not asserted at boot.
 */
export const DROP_RATE_TABLE: readonly (readonly number[])[] = [
    [],
    [100.0, 0, 0, 0, 0, 0],
    [75.0, 25.0, 0, 0, 0, 0],
    [47.0, 43.0, 10.0, 0, 0, 0],
    [19.0, 56.0, 23.0, 2.0, 0, 0],
    [18.8, 32.0, 37.0, 12.0, 0.2, 0],
    [19.0, 22.0, 24.0, 34.0, 0.8, 0.2],
    [10.0, 10.0, 14.0, 60.0, 5.2, 0.8],
    [10.0, 10.0, 12.1, 54.5, 12.0, 1.4],
    [10.0, 10.0, 10.0, 49.0, 18.8, 2.2],
    [10.0, 10.0, 10.0, 42.0, 25.0, 3.0]
]

/**
 * Flat power multiplier per rarity, in ladder order (Common → Mythic).
 *
 * Doc-specified (`champions-guild-gacha.md` §2) and reused verbatim by Gear (`gear-equipment.md`
 * §2) and Artifacts. `gacha.ts` keys it onto the rarity ladder; nothing indexes this array
 * directly.
 *
 * ⚠ Every adjacent ratio must stay under `RARITY_ADJACENT_RATIO_CEILING`.
 */
export const RARITY_STAT_MULTIPLIERS: readonly number[] = [1.0, 1.15, 1.35, 1.6, 2.0, 2.5]

/**
 * The ceiling Gear's Rarity Progression Guarantee imposes on adjacent rarity multipliers
 * (`gear-equipment.md` §2).
 *
 * Both promises the doc makes — a scalar-50 current-tier piece beats a scalar-1 next-tier one,
 * and a maxed scalar-60 piece beats a scalar-10 next-tier one — reduce to this single
 * constraint, of which the second is the binding one. Locked as a tuning constraint rather than
 * a one-time check, because whoever retunes `RARITY_STAT_MULTIPLIERS` later has to respect it or
 * silently break the promise that investment is never wasted.
 */
export const RARITY_ADJACENT_RATIO_CEILING = 6

/**
 * Rarity epithets, in ladder order (`champions-guild-gacha.md` §5).
 *
 * Load-bearing for two rosters: it supplies the middle word of every Champion's display name,
 * and it *is* the entire naming scheme for all 36 Gear pieces (`<Epithet> <Slot>`).
 */
export const RARITY_EPITHETS: readonly string[] = [
    'Novice', 'Adept', 'Veteran', 'Vanguard', 'Exalted', 'Ascendant'
]

/** 1 Seal per pull; a 10-pull is 9 Seals but still counts as 10 toward gacha leveling. */
export const SINGLE_PULL_COST = 1
export const TEN_PULL_SIZE = 10
export const TEN_PULL_COST = 9

/**
 * dupesToLevelUp(star, level) = round(min((star × 10 + level) × DUPE_LEVEL_FACTOR, DUPE_LEVEL_CAP))
 *
 * `1.618` is the golden ratio, per the doc. The cap binds fast — everything from 1★ Lv3
 * onward is a flat 20 — which is what keeps a full 0★→5★ Lv10 max at 1,066 dupes.
 */
export const DUPE_LEVEL_FACTOR = 1.618
export const DUPE_LEVEL_CAP = 20

/** Items start at 0★, 10 levels per star, 5★ Lv10 is maxed. */
export const MAX_STAR = 5
export const LEVELS_PER_STAR = 10

/**
 * Essence gained per post-max duplicate, and the Essence price of crafting, by rarity index.
 *
 * Both ladders are ×5 per tier, and a rarity's craft cost is always exactly 5× its own dupe
 * value — so 15,625 Common duplicates buy one hand-crafted Mythic.
 */
export const ESSENCE_VALUE_PER_RARITY: readonly number[] = [1, 5, 25, 125, 625, 3_125]
export const CRAFT_COST_PER_RARITY: readonly number[] = [5, 25, 125, 625, 3_125, 15_625]

/**
 * Champion party slots, bought with Void Shards in the prestige shop
 * (`champions-guild-gacha.md` §1). Starts at 2, caps at 5, so 3 levels to buy.
 */
export const BASE_CHAMPION_SLOTS = 2
export const MAX_CHAMPION_SLOTS = 5
export const CHAMPION_SLOT_BASE_COST = 400 // UNTUNED ╧
export const CHAMPION_SLOT_COST_GROWTH = 3 // UNTUNED ╧

/** The flat 3-front / 3-back grid (`classes-and-combat.md` §6). Capacities, not quotas. */
export const FORMATION_ROW_CAPACITY = 3

/**
 * The §7 passive collection bonus, per point of a copy's `(star × 10 + level)` scalar.
 *
 * Multiplicative on the Hero's own stat, and paid by **every owned Champion whether or not it
 * is fielded** — that is the whole point of the mechanic: pulling broadly and levelling
 * everything has value independent of which 2–5 you actually field.
 *
 * `champions-guild-gacha.md` §7 fixes the *shape* (which archetype buffs which Hero stat, and
 * that it scales on the shared scalar) and states no magnitude anywhere, so this is a
 * placeholder. At 0.002 a single maxed Champion (scalar 60) is +12% to its archetype's stat,
 * and the 12-Champion Phase 2 roster fully maxed is roughly +36% on each of the six.
 */
export const CHAMPION_PASSIVE_PER_POINT = 0.002 // UNTUNED ╧

/**
 * Free Seal grant: a batch of each type per real-time interval, bankable up to a cap
 * (`economy-and-currencies.md` §5). Deliberately *not* a stage-clear drop — keeping Seals
 * discrete is what preserves "buy extra Seals with Gold" as a genuine choice.
 *
 * Raised 1 → `TEN_PULL_COST` by the session-1 playtest. The old value gave a new account a
 * single pull per gacha per day, which the playtest reported as the opening being unable to
 * demonstrate its own core loop. Tied to the 10-pull price rather than written as a literal 9,
 * so the grant stays "exactly one free 10-pull" if that price ever moves.
 */
export const SEAL_GRANT_INTERVAL_HOURS = 24 // UNTUNED ╧
export const SEAL_GRANT_AMOUNT = TEN_PULL_COST // UNTUNED ╧

/**
 * Free 10-pulls on top of the daily Seal grant, per gacha, per day (session-1 playtest).
 *
 * A **true entitlement, not Seals**: it must be spent as a 10-pull and cannot be banked or split
 * into singles. That is the deliberate difference from `SEAL_GRANT_AMOUNT` above — Seals are
 * fungible and this is not, because the point is the 10-pull *moment* rather than the pull count.
 *
 * The cooldown gates the gap between claims, so an active player collects all of them inside an
 * hour and an idle one still finds them waiting. It is a re-engagement hook on a game whose whole
 * premise is not having to re-engage — worth watching in play, since that tension is real.
 *
 * ⚠ Together with the grant above this takes a gacha from 1 pull/day to 9 Seals plus 20 free
 * pulls/day — roughly 30× the volume, ×4 systems. The collection curve, Essence income and the
 * crafting economy all move with it, and none of them has been re-derived since.
 */
export const FREE_PULLS_PER_DAY = 2 // UNTUNED ╧
export const FREE_PULL_COOLDOWN_MINUTES = 30 // UNTUNED ╧
export const SEAL_GRANT_BANK_CAP_DAYS = 7 // UNTUNED ╧

/**
 * Milestone Seal grants (`economy-and-currencies.md` §5, source 1).
 *
 * Tied to core-progression milestones rather than to any gacha's own progress, so a milestone
 * grants **all four Seal types at once** — the four gachas are meant to advance in lockstep.
 * The doc defers the exact list and batch sizes to the World/enemy design pass and gives only
 * a starting shape: "small batches per World clear, larger batches per Prestige completion."
 * These are that shape, and nothing more.
 */
export const SEAL_GRANT_PER_BOSS = 1 // UNTUNED ╧
export const SEAL_GRANT_PER_WORLD_CLEAR = 3 // UNTUNED ╧
export const SEAL_GRANT_PER_PRESTIGE = 10 // UNTUNED ╧

// ── Gear / The Forge ───────────────────────────────  gear-equipment.md §1–3

/**
 * Per-slot magnitude of an **equipped** piece, per point of the `(star × 10 + level)` scalar:
 *
 *     equippedBonus(slot, rarity, star, level)
 *         = SLOT_BASE_BONUS[slot] × RARITY_STAT_MULTIPLIER[rarity] × (star × 10 + level)
 *
 * Six independent dials on purpose (`gear-equipment.md` §2): PWR, SPD, LCK, IMP, VIT and DEF
 * plug into fundamentally different downstream formulas — a cooldown fraction, a mitigation
 * ratio, a crit probability, flat HP — with no shared natural scale, so one shared coefficient
 * would mean six different things.
 *
 * Expressed as a **fraction of the stat**, matching how Skill passives and Artifact effects
 * express stat bonuses (§2 there). At 0.01 a maxed Mythic piece (scalar 60 × ×2.5) is +150% to
 * its stat, and a freshly-pulled Common is +1%.
 *
 * Deliberately identical across all six for now: no doc ranks the stats against each other, and
 * six invented values would read three phases later as a decided spread. The `SLOT` keys exist
 * so differentiating them is a one-line edit here.
 */
export const SLOT_BASE_BONUS: Readonly<Record<string, number>> = { // UNTUNED ╧
    weapon: 0.01,
    boots: 0.01,
    gauntlets: 0.01,
    charm: 0.01,
    armor: 0.01,
    helmet: 0.01
}

/**
 * What an **owned but unequipped** piece contributes, per point of the same scalar
 * (`gear-equipment.md` §3):
 *
 *     passiveBonus = GEAR_PASSIVE_COEFFICIENT × RARITY_STAT_MULTIPLIER[rarity] × (star×10+level)
 *
 * Mirrors the Champion collection passive exactly (`champions-guild-gacha.md` §7) — collecting
 * has value independent of what is actively equipped. Deliberately an order of magnitude under
 * `SLOT_BASE_BONUS`, or manual equip would stop mattering: the whole point of §3's upgrade
 * indicator is that a player who ignores it is leaving real power on the table.
 */
export const GEAR_PASSIVE_COEFFICIENT = 0.001 // UNTUNED ╧

// ── Skills / Training Grounds ──────────────────────  skills-gacha.md §3–6

/**
 * Hero-only Skill slots, bought with Void Shards. Starts at 2, caps at 5 — 3 purchase levels,
 * mirroring the Champion party-slot progression exactly (`skills-gacha.md` §6).
 */
export const BASE_SKILL_SLOTS = 2
export const MAX_SKILL_SLOTS = 5
export const SKILL_SLOT_BASE_COST = 400 // UNTUNED ╧
export const SKILL_SLOT_COST_GROWTH = 3 // UNTUNED ╧

/**
 * Magnitude of a Skill passive's stat line, by rarity band.
 *
 * `skills-gacha.md` §4 authors all 36 in prose — "small", "small–medium", "medium",
 * "medium–large", "large" — and assigns no number to any of them. These are that ladder, as one
 * named set: the *relative ordering* is the design content and is deliberate, so retune the set
 * rather than individual entries.
 *
 * Indexed by rarity, since the doc's qualifier tracks rarity one-for-one.
 */
export const SKILL_PASSIVE_MAGNITUDE: readonly number[] = [ // UNTUNED ╧
    0.05, 0.08, 0.12, 0.16, 0.22, 0.30
]

/**
 * Economy lines are held to a fraction of a stat line's magnitude.
 *
 * This is `gold-economy.md` §5's "keep Gold-granting bonuses small" given a number. Gold is the
 * platform's persistent, global currency: it is not run-scoped and it survives every prestige,
 * so it compounds forever where a stat bonus is re-earned each run. §5 sets the calibration
 * target — a maximal dedicated stack should land around ×3, ×5 worst case — and this coefficient
 * is the lever that keeps the Skills half of that stack inside it.
 */
export const SKILL_ECONOMY_COEFFICIENT = 0.4 // UNTUNED ╧

/**
 * What one point of a Skill copy's `(star × 10 + level)` scalar adds to its **effect potency**.
 *
 *     potency(star, level) = 1 + (star × 10 + level − 1) × SKILL_POTENCY_PER_POINT
 *
 * ## Why this exists, and why it is not the Artifact shape
 *
 * `gacha-shared-system.md` §6 makes the `(star × 10 + level)` scalar the universal "how strong is
 * this specific copy" number, and Gear, Artifacts and the Champion passive all read it. **Skills
 * did not**, because `skills-gacha.md` never says they do — which left a levelled Skill copy worth
 * literally nothing beyond having consumed the duplicates. That is not a design anyone chose; it
 * is a gap between two docs, and this closes it on the terms the rest of the project already uses.
 *
 * The *shape* is `championInvestmentMultiplier`'s, not `artifactLineMagnitude`'s, and the
 * difference matters. Artifact magnitudes are **proportional** to the scalar (a fresh copy is
 * 1/60th of a maxed one), which works there because §6 states that scaling and the per-point base
 * is tiny to match. Skills are authored as complete qualitative bands in §4 — "small", "medium",
 * "large" — so a proportional curve would make a freshly-pulled Mythic 1/60th of its own described
 * strength and silently rewrite the doc's ladder. **Identity at minimum** instead: a 0★/Lv1 copy
 * is exactly the authored magnitude, and levelling multiplies up from there.
 *
 * At 0.02 a maxed copy (scalar 60) is **×2.18** — each level is worth +2% of the base, which is
 * the "slight increase per level" this is meant to be rather than a second rarity ladder. Its own
 * constant rather than reusing `CHAMPION_INVESTMENT_PER_POINT` (0.05, ×3.95 at max) because a
 * Champion's scalar is that Champion's *only* growth axis, while a Skill's magnitude already
 * carries a rarity band; the two should be tunable apart.
 *
 * Applies to magnitudes only — damage multipliers, heals, shields, status strengths, bursts. **Not**
 * to durations, cooldowns, hit counts or stack thresholds: see `scaleEffect`.
 */
export const SKILL_POTENCY_PER_POINT = 0.02 // UNTUNED ╧

/**
 * Gold burst size, in **minutes of current income**, by rarity band.
 *
 * `gold-economy.md` §6 is explicit that flat-Gold effects must be denominated as a duration of
 * income rather than a fixed amount — that is what keeps Coin Toss correctly sized at prestige 0
 * and at prestige 20 with no per-stage retuning, ever. The doc's own worked example is
 * "Coin Toss ≈ 0.5–2 minutes' worth", which anchors the bottom of this ladder.
 */
export const GOLD_BURST_MINUTES: readonly number[] = [ // UNTUNED ╧
    0.5, 1, 2, 3, 5, 8
]

/**
 * Cooldown of the pure-economy Actives — Coin Toss and Prospector's Instinct.
 *
 * **Deliberately its own constant, and not the shared `SKILL_BASE_COOLDOWN_SECONDS`.** A burst
 * denominated in minutes of income is only meaningful against a cadence: at the shared 8-second
 * base, Coin Toss's 0.5 minutes of income would repay **+375% Gold income** continuously, which
 * is two orders of magnitude past `gold-economy.md` §5's calibration target of a maximal
 * dedicated stack landing around ×3. §4 describes these two as "deals no damage", so they trade
 * combat contribution for economy and a long cadence is the price of that trade.
 *
 * This is a *decision*, not a transcription — no doc assigns a cooldown to any skill, and the
 * §5 stack target is the only quantitative anchor either doc offers. It is the dial to move if
 * the Gold-burst family reads as too weak or too strong.
 */
export const GOLD_BURST_COOLDOWN_SECONDS = 120 // UNTUNED ╧

/**
 * How much shorter a "chance to refund / reset / re-trigger" Active's cooldown is rendered as.
 *
 * Three of the 36 carry such a clause — Executioner's Edge, Ragnarok Strike, Fortune's Gambit —
 * and none is expressible: there is no on-kill trigger, no cooldown-mutation channel and no
 * scheduled-event queue. All three become a permanently shorter cooldown, which is what all three
 * clauses actually buy. One constant for all three, because the same approximation should retune
 * in one place.
 */
export const SKILL_COOLDOWN_REFUND_FRACTION = 0.25 // UNTUNED ╧

/**
 * The Gambler's Strike family's bounded wealth factor (`skills-gacha.md` §4¹,
 * `gold-economy.md` §8).
 *
 *     damage = PWR × abilityMultiplier × wealthFactor(bankedGold / goldPerHour)
 *
 * Clamped at both ends, which is the whole reason the redesign works: the base stat keeps pace
 * with the enemy curve at every prestige, and the modulation can neither trivialise combat nor
 * decay to irrelevance. §4¹ suggests ×0.5–×2.0 explicitly and calls it "not locked".
 *
 * `WEALTH_NEUTRAL_HOURS` is where the factor passes through exactly 1.0 — the amount of banked
 * income that counts as neither hoarding nor spent down.
 */
export const WEALTH_FACTOR_MIN = 0.5 // UNTUNED ╧
export const WEALTH_FACTOR_MAX = 2.0 // UNTUNED ╧
export const WEALTH_NEUTRAL_HOURS = 4 // UNTUNED ╧

// ── Artifacts / Dig-site ───────────────────────────  artifacts-dig-site-gacha.md §3, §7

/** Party-wide Artifact slots, Void Shards, 2 → 5 over 3 levels (§7). Same shape as the others. */
export const BASE_ARTIFACT_SLOTS = 2
export const MAX_ARTIFACT_SLOTS = 5
export const ARTIFACT_SLOT_BASE_COST = 400 // UNTUNED ╧
export const ARTIFACT_SLOT_COST_GROWTH = 3 // UNTUNED ╧

/**
 * Magnitude of one Artifact effect line, per point of the `(star × 10 + level)` scalar (§6).
 *
 * Per *point*, unlike `SKILL_PASSIVE_MAGNITUDE` which is a flat fraction — and the asymmetry is
 * doc-mandated, not an oversight. §6 states outright that an Artifact's effect-line magnitudes
 * "scale with the same `(star × 10 + level)` scalar", the same way Gear and the Champion passive
 * do. `skills-gacha.md` never says that about Skills, so Skills are authored flat and levelled
 * copies are worth nothing extra — a gap worth flagging at the tuning pass rather than papering
 * over here, since inventing a Skill investment curve would be inventing design.
 *
 * Rarity multiplies on top, so a maxed Mythic Offense Artifact (60 × ×2.5 × 0.004) is +60% party
 * PWR per line, three lines deep.
 */
export const ARTIFACT_EFFECT_PER_POINT = 0.004 // UNTUNED ╧

/**
 * The same "keep Gold small" throttle as Skills', applied to the Fortune category.
 *
 * Separate constant rather than shared, because the two systems have different slot counts and
 * different stacking rules (§4 allows five Offense Artifacts at once) and therefore contribute
 * differently to §5's ×3 stack target.
 */
export const ARTIFACT_ECONOMY_COEFFICIENT = 0.3 // UNTUNED ╧

// ── Loadouts ───────────────────────────────────────  loadouts.md §3

/**
 * Saved Loadout slots. Starts at 2, caps at 10 — **8 purchase levels, priced in Gems**.
 *
 *     cost(level) = LOADOUT_SLOT_BASE_COST_GEMS × 2^(level-1)
 *
 * The first slot track in the game not priced in Void Shards, and deliberately so: every other
 * slot track gates real party power, while a Loadout slot gates only taps — a player with 2
 * slots can manually re-equip everything a 10-slot player can. Pure convenience, so it takes the
 * convenience currency.
 *
 * ⚠ **Two firsts at once, and the doc flags it as a genuine unknown.** This is the first time
 * the doubling short-track shape has been stretched past 5 levels (8 levels tops out at 128× the
 * base) and the first time it is paired with Gems. Worth the balance script's specific attention.
 */
export const BASE_LOADOUT_SLOTS = 2
export const MAX_LOADOUT_SLOTS = 10
export const LOADOUT_SLOT_BASE_COST_GEMS = 250 // UNTUNED ╧
export const LOADOUT_SLOT_COST_GROWTH = 2

/** Bounds the persisted name so a save cannot write an unbounded string into jsonb. */
export const LOADOUT_NAME_MAX_LENGTH = 32

/**
 * The daily escalating Gold ladder for extra Seals (`gold-economy.md` §7). Per-gacha
 * independent counter, one shared reset date.
 *
 *     price(n) = SEAL_LADDER_BASE_GOLD × SEAL_LADDER_GROWTH[system]^n
 *
 * where `n` is how many of *that* gacha's Seals were already bought with Gold today.
 */
export const SEAL_LADDER_BASE_GOLD = 1_000_000
export const SEAL_LADDER_GROWTH: Readonly<Record<string, number>> = {
    gear: 1.0011,
    champion: 1.0007,
    skill: 1.0011,
    artifact: 1.0007
}

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
