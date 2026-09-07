/**
 * Hero Quest tuning registry — every named constant in the game.
 *
 * Nothing numeric lives at a call site. A magic number in `combat.ts` is a bug even when
 * the value is correct; this file is what makes the balance script and playtest tuning a
 * one-file edit (`docs/games/hero-quest/CLAUDE.md` §3).
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
 *
 * ── TUNED ✓ ────────────────────────────────────────────────────────────────────────────
 * A `✓` marks the opposite: a value **derived from measurement and confirmed in playtest**,
 * not a placeholder. Changing one is a design decision with a known cost, and the cost is
 * written into the constant's own comment — sweeps, campaign-walk timings, the shape that
 * broke at the neighbouring values. Read that before moving it.
 *
 *     rg '✓' shared/utils/hero-quest/constants.ts
 *
 * A **derived** constant carries no marker of its own; it inherits the status of whatever it
 * is computed from, and is never set directly.
 */

import type { HqStatKey, StatTier } from './types'

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
export const WAVE_PACK_SIZE = 6
export const ELITE_PACK_SIZE = 6

/**
 * Minions standing with a boss or super boss. The boss itself is always exactly one, so a
 * boss encounter holds `BOSS_MINION_COUNT + 1` bodies.
 *
 * Deliberately smaller than a wave pack: the boss is the fight, and its escort is there to
 * split the party's attention and give AoE something to answer, not to become the fight. The
 * `BOSS_TIMER_SECONDS` gate covers the **whole encounter**, so every minion is time taken off
 * the boss — which is what makes clearing adds a real decision rather than free damage.
 */
export const BOSS_MINION_COUNT = 2

/**
 * Fraction of a pack still swinging, averaged over one stage attempt.
 *
 * Under focus fire an encounter's live attackers walk N → N-1 → … → 1, so the mean over an
 * attempt is exactly `(N+1)/2` — which `0.5` reproduces. `1.0` is the conservative endpoint
 * (every member swinging for the whole attempt). Whatever it holds, N = 1 yields exactly one
 * stream, so bosses and every pre-pack number stay bit-identical.
 */
export const PACK_LIVE_STREAM_FRACTION = 0.5 // TUNED ✓

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
export const ENEMY_STEP_BASE = 1.08 // TUNED ✓

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

/**
 * The World 1 Stage 1 enemy, before the `b^n` ramp touches it. Cut hard in the session-2
 * playtest — HP 30 → 10, PWR 10 → 3, DEF 5 → 2 — because the opening was measurably slow:
 * 6.5s to kill one trash mob, 3m 16s to clear a single wave stage, and a solo Hero blocked
 * outright at the World 1 Stage 5 boss (`--report=world --level=1`). It now reads 1.8s per
 * kill, 54s per stage, and World 1 clears end to end in 8m 29s with no blocker.
 *
 * `BASE_ENEMY_HP` and `BASE_ENEMY_DEF` are the *pace* dials and only that — both divide
 * straight into time-to-kill and neither survives a level or two of stat growth. Halving DEF
 * is worth about 6% off a stage clear; the 3× HP cut is where the speed-up actually comes
 * from. Because they wash out, the campaign end state is nearly identical at DEF 2 and DEF 3
 * (same wall, same level, ~2% apart on total time), so do not reach for DEF expecting depth.
 *
 * `BASE_ENEMY_PWR` is the one that moves the campaign, and since `ENEMY_PACE_RATIO` holds
 * `enemyPwr / heroDef` fixed for the life of a run, **it is now the single dial that sets how
 * dangerous the whole game is** — not just the opening. Pick it once against the level-1 class
 * spread and every depth inherits the same answer.
 *
 * Raised 3 → 7 for exactly that reason. At `K` 4 the Beginner's DEF 10 puts the mitigation
 * clamp at enemy PWR 2.5, so 7 lands 64% of each hit at level 1 and holds that share forever;
 * at the old 3 the clamp swallowed the first ~130 stages whole. Measured on the party the
 * campaign walk fields, at every depth from World 1 to prestige 3:
 *
 *     wave stages    ~3.3x survival — a stage attempt costs about 30% of the party's pool
 *     elite stages   ~2.3x          — about 43%
 *     boss stages    ~50x           — a gate is a DPS check, not an endurance one
 *
 * The old three-values-of-PWR comparison this replaced is no longer meaningful: it measured
 * where the clamp broke, and the clamp no longer moves.
 *
 * `BASE_ENEMY_HP` is **how long a fight is**, and with `ENEMY_HP_STEP_EXPONENT` covering the
 * party's DPS growth it is that at every depth rather than just on the first screen. Raised
 * 10 → 60 for the one-week first prestige: a wave stage goes from 15 seconds — the
 * `MIN_SECONDS_PER_KILL` floor, which is where every stage in the game used to sit — to about
 * three and a half minutes, and a whole prestige loop from 20 minutes of fighting to just
 * under five hours.
 *
 * ⚠ **It is bounded above by `BOSS_TIMER_SECONDS`, which is fixed.** A gate is `packSize`
 * bodies inside 30 seconds, so `secondsPerKill` at a gate cannot exceed 10s however deep the
 * run goes. Past roughly 60 the early gates stop being passable at any level a fresh account
 * can reach, and the wall arrives before the content does — measured, W8S10 at 60 becomes
 * W5S10 at 175. Raising this further means raising the timer with it.
 */
export const BASE_ENEMY_HP = 60 // TUNED ✓
export const BASE_ENEMY_PWR = 7 // TUNED ✓
export const BASE_ENEMY_DEF = 2 // TUNED ✓
export const ELITE_STAT_MULT = 1.2 // TUNED ✓

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
export const BOSS_HP_MULT = 3 // TUNED ✓
export const SUPER_BOSS_HP_MULT = 6 // TUNED ✓

export const BOSS_ATK_MULT = 1.2 // TUNED ✓
export const SUPER_BOSS_ATK_MULT = 1.5 // TUNED ✓

// ── Combat ─────────────────────────────────────────  classes-and-combat.md §7

/**
 * Mitigation ratio threshold: once a defender's DEF reaches `K` times the attacker's PWR,
 * mitigation is 100% — and damage floors at `MIN_DAMAGE`, not at 0.
 *
 * ## Why 4 rather than 2
 *
 * **`K` sets how wide the band between "immune" and "dead" is**, and 2 made it too narrow to
 * play inside. Damage taken is `PWR − DEF/K`, so `DEF/K` is the whole of what the enemy has to
 * out-scale; the smaller `K` is, the larger that subtrahend, and the smaller the *share* of a
 * hit that ever lands. Measured at World 9 on the party the campaign walk fields, holding the
 * stage fixed and moving only hero level:
 *
 *     K = 2     on trajectory 3.4x survival → +20 levels and the party is untouchable
 *     K = 4     on trajectory 3.2x survival → +40 levels, and the ramp between is smooth
 *
 * Twenty levels is four or five stages of grinding — an ordinary thing to do at a wall — so at
 * 2 the reward for grinding was the `MIN_DAMAGE` readout coming back.
 *
 * **It is close to a defence-only dial, despite being shared.** Offence goes through
 * `partyMitigation`, which pools the party's PWR before dividing, and pooled PWR runs orders of
 * magnitude above enemy DEF at every depth — mitigation on that side is already ~0 and halving
 * it again changes nothing that shows up in a clear time. The defensive side is pairwise and
 * sits right on the clamp, which is where the whole effect lands.
 */
export const K = 4 // TUNED ✓

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
 *
 * ⚠ **This used to be the number the party actually took, for a third of a run.** With DEF at
 * `STAT_PACE_RATIO` and `K` at 2 the mitigation clamp bound for the first ~130 stages, so every
 * incoming hit read exactly 1 whatever the enemy's PWR was. `ENEMY_PACE_RATIO` and `K` 4
 * between them push the clamp off the trajectory entirely, and this is back to being what it
 * was designed as: the reading on the far side of a wall, not the reading during normal play.
 */
export const MIN_DAMAGE = 1 // TUNED ✓

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
export const STATUS_MAX_STACKS = 5 // TUNED ✓

/**
 * The grid periodic effects pay out on.
 *
 * Deliberately **not** `FIGHT_TICK_SECONDS`: paying per combat tick would tie every DoT's
 * strength to the sim's resolution, so halving the tick would halve every burn. A fixed grid
 * keeps "damage per second" a property of the effect rather than of the simulator.
 */
export const STATUS_TICK_SECONDS = 1 // TUNED ✓

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

/**
 * Crit chance per point of LCK.
 *
 * With `LCK_BASE_SCALE` at 0.75 that is a Marksman opening at LCK 12 → 12% and a Warrior at
 * LCK 3.75 → 3.8%. Those are also the numbers they *keep*: LCK is off the level curve, so
 * nothing but the collection passive and equipment lines moves them again.
 */
export const CRIT_CHANCE_PER_POINT = 0.01 // TUNED ✓

/**
 * Crit damage per point of IMP: IMP 10 → ×1.2.
 *
 * Cut 0.05 → 0.02 by the session-2 playtest. Unlike LCK, IMP **does** ride the level curve, so
 * this is a per-point rate on an exponentially growing stat and it is the only thing bounding
 * how fast the crit multiplier runs away: at 0.05 a level-200 Hero carried IMP 464 for a ×24
 * crit multiplier, and with crit chance capped at 100% by that point it was a flat ×24 on
 * everything the party swung.
 *
 * The *shape* — linear and unbounded in IMP — is load-bearing and was left alone deliberately;
 * see `STAT_SCALES_WITH_LEVEL` for why it is what makes `DPS_STAT_EXPONENT` 2.
 */
export const CRIT_DAMAGE_PER_POINT = 0.02 // TUNED ✓

/**
 * LCK past 100% crit chance converts to crit damage at this rate. Must sit well below
 * CRIT_DAMAGE_PER_POINT — overflow is a "nothing wasted" valve, not a rival to IMP.
 *
 * ⚠ **Rarely reached now.** With LCK off the level curve (`STAT_SCALES_WITH_LEVEL`) a unit only
 * passes 100% crit chance by stacking collection passives and LCK lines deliberately, so this
 * went from "every Hero, from mid-game onward" to "a built crit Hero, late". It is still live
 * code and still the right behaviour when it fires; it is no longer a rate that shapes the
 * average run, and if `LCK_BASE_SCALE` is cut much further it stops firing at all.
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
 * 100 → 2000 in the session-1 playtest, back to 100 in session 2 when `BASE_ENEMY_PWR` fell to
 * 3 and the mitigation clamp — not the pool — was what carried the opening. Now 150.
 *
 * ## Why it is small, and why that is the point
 *
 * A first pass at the constant-pressure retune put this at 1500: the pool that holds a **solo,
 * level-1** Hero at roughly the survival ratio it sees for the rest of the run, so nothing in
 * the opening ever wipes. It worked, and it was the wrong shape. Flat 1500 against a level-1
 * VIT contribution of 100 meant **the flat term was 93% of the pool**, so for the first twenty
 * levels VIT was decorative — the stat that is supposed to be the survivability dial bought
 * nothing a player could feel, and the game's own stat breakdown said so in as many words.
 *
 * At 150 the flat term is 60% of a level-1 pool and under half by level 20, so VIT carries the
 * pool almost immediately. **The trade is that the opening is now lethal**, and deliberately:
 * a level-1 Beginner sits at 0.6x–0.7x on World 1's wave stages and 0.3x on its elites.
 *
 * ## Why a lethal opening is not a broken one
 *
 * `settle.killsBeforeWipe` banks every kill landed before the party drops and restarts *that
 * same stage*, so a wipe costs no ground and pays full XP and Gold. A level-1 Hero banks 21 of
 * the 30 kills World 1 Stage 1 asks for, wipes, and levels out of it in a few minutes. What
 * used to be a two-minute walk through World 1 is now **1h 5m across 8 blocked stages**, and
 * World 2 another 38m, before the curve settles — an opening that is actually played rather
 * than watched, and the first honest step toward a first prestige measured in days.
 *
 * The run's end state is untouched: solo still walls at P4 W9S6 after 3d 17h, because this
 * term is arithmetic noise long before then.
 *
 * ## If the opening proves too punishing
 *
 * Raise `HP_PER_VIT`, not this. That keeps VIT carrying the pool instead of handing the job
 * back to a flat constant — but note it is multiplicative, so it lifts survivability at *every*
 * depth and `BASE_ENEMY_PWR` has to rise with it to hold the steady-state ratio. Doing that as
 * a pair also shrinks `DEF / K` as a share of each hit, which quietly makes DEF a weaker stat;
 * scale the class DEF spread by the same factor if that matters.
 */
export const BASE_HP = 150 // TUNED ✓

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
 * ## What it does now, and why it stayed at 10
 *
 * Two things retired the old reasoning. VIT paces the enemy exactly (`ENEMY_PACE_RATIO`), so
 * this no longer sets a *depth* — the party's margin is the same at World 1 and at prestige 6,
 * and halving this halves that margin everywhere at once rather than moving a wall. And walls
 * are `FIGHT_LENGTH_DRIFT`'s job now: every blocker in the campaign walk is a boss timer, which
 * no amount of HP answers.
 *
 * So what is left is almost entirely the **opening**, where `BASE_HP` is still most of the pool
 * and this is the part that grows. Swept against the one-week campaign, party of 3, and against
 * a level-1 solo Hero on World 1 Stage 1 (which must bank kills to be farmable at all):
 *
 *      5    6d 8h    lvl-1 pool 200, dies at 30.5s — banks 2 of 30 kills
 *     10    6d 9h    lvl-1 pool 250, dies at 38.1s — banks 3 of 30 kills   ← here
 *     25    6d 11h   lvl-1 pool 400, dies at 1m 1s
 *     60    6d 13h   lvl-1 pool 750, dies at 1m 54s
 *
 * **The campaign barely moves across a 12× range** — five hours out of six days — because the
 * run is paced by boss gates and those are a DPS check. Left at 10 for the reason the session-2
 * cut chose it: it is the value that keeps `BASE_HP` a *small* share of the level-1 pool (60%
 * here, against 93% when this was last raised), so VIT is carrying the pool almost from the
 * start instead of a flat constant carrying it for twenty levels.
 *
 * ⚠ **It is coupled to fight length, not to depth.** `BASE_ENEMY_HP` 10 → 60 made every stage
 * attempt six times longer and so cost six times more HP; that is the change that would force
 * this one, and the pair has to be re-derived together if fight length moves again.
 */
export const HP_PER_VIT = 10 // TUNED ✓

// ── Attack rate ────────────────────────────────────  basic attacks only

/**
 * Every unit — Hero, Champion, enemy, boss — attacks once per this many seconds at SPD 0.
 *
 * Cut 3 → 2.4 in the session-1 playtest, which puts the beginner (SPD 10) at exactly 2.0s
 * between swings instead of 2.5s. This was chosen over raising `SPD_ATTACK_RATE_PER_POINT`
 * deliberately: SPD should need real investment before it reaches the cap, and inflating the
 * per-point rate would have handed that away at level 1.
 *
 * ⚠ **This lever moves both sides of the fight.** Enemies resolve at SPD 0, so their rate is
 * `1 / BASE_ATTACK_INTERVAL_SECONDS` exactly — cutting the base speeds them up by the same 25%
 * it speeds up the party. It shortens fights rather than tilting them; see the playtest notes
 * for the measured effect on survivability.
 */
export const BASE_ATTACK_INTERVAL_SECONDS = 2.4 // TUNED ✓

/**
 * Hard ceiling of **5 attacks per second**, however high SPD climbs.
 *
 * Raised from 3/sec in the session-1 playtest, alongside `SPD_ATTACK_RATE_PER_POINT`. The two
 * move together on purpose: quadrupling the rate-per-point without lifting the ceiling would
 * just make every build reach the same wall four times sooner, turning SPD into a stat that
 * stops mattering early instead of one that scales.
 */
export const MIN_ATTACK_INTERVAL_SECONDS = 1 / 5 // TUNED ✓

/**
 * Reaches the 5/sec ceiling at SPD 550.
 *
 * **Deliberately left low.** The session-1 playtest wanted a faster opening and briefly raised
 * this to 0.05; it was put back because SPD should have to be *invested in* to approach the cap,
 * and a fat per-point rate hands that progression away at level 1. The opening speed came from
 * `BASE_ATTACK_INTERVAL_SECONDS` instead, which is the flat term rather than the scaling one.
 */
export const SPD_ATTACK_RATE_PER_POINT = 0.02 // TUNED ✓

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
export const MIN_COOLDOWN_SECONDS = 0.5 // TUNED ✓

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
/**
 * Cut 8 → 6.4 in the session-1 playtest — **the same 0.8× applied to
 * `BASE_ATTACK_INTERVAL_SECONDS`, not an independent judgement.**
 *
 * Shortening the autoattack interval alone would have been a stealth rebalance rather than a
 * speed-up: autoattacks would land 25% more often while every skill kept its old cadence, so the
 * game would quietly tilt away from kits and toward basic attacks. Two specs caught exactly that
 * — a Hero that used to survive to its first volley began dying before casting anything, and the
 * idle projection's over-promise band widened as fights shortened against a fixed cooldown.
 *
 * Scaling both by the same factor restores the ratio the design assumes, and is what let those
 * two specs pass again untouched. **If one of these moves, the other moves with it** — that
 * invariant matters more than either value.
 */
export const SKILL_BASE_COOLDOWN_SECONDS = 6.4 // TUNED ✓
export const SKILL_BASE_ABILITY_MULTIPLIER = 2 // TUNED ✓

// ── Ability effect magnitudes ──────────────────────  classes-and-combat.md §7, §3
//
// Every ability in both rosters is described in prose and given no numbers anywhere — "a
// short duration", "a portion", "small", "solid". These are the shapes that prose implies,
// as one named set rather than 44 literals scattered through content files, so the eventual
// balance pass is a single edit here.
//
// The relative *ordering* is the design content and is deliberate: wide AoE pays for its
// reach, a pierce beats a basic attack by a little, and single-target burst beats both.
//
// ⚠ **This block stayed UNTUNED through the pass that marked the combat progression TUNED,
// deliberately.** Everything the campaign walk measures — seconds per stage, survival ratios,
// where the boss gates bite — was measured on a Beginner, whose whole kit is one self-buff,
// plus un-invested Common stand-in Champions carrying one ability each. So the run that paces
// at 6d 9h barely touches these numbers, and a playtest that confirms the *progression* says
// almost nothing about whether Arrow Rain is correctly priced against Piercing Arrow.
//
// What would settle them is a different measurement than the campaign walk: `fight.ts` seeded
// fights across the class roster at a fixed depth, comparing damage per cooldown-second
// between kits. Note `projection.ts` only has to agree with that within ±30%/+70%
// (`test/hero-quest/projection.spec.ts`), so the idle model cannot resolve differences finer
// than that either.

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
export const MAX_SUSTAIN_MITIGATION = 0.9 // TUNED ✓

/**
 * Tick granularity of the seeded boss simulation (`fight.ts`).
 *
 * Bounds the work: `BOSS_TIMER_SECONDS / FIGHT_TICK_SECONDS` iterations, fixed, regardless
 * of party strength or depth. Finer ticks resolve cooldowns and attack intervals more
 * exactly at the cost of a longer replay log the client has to animate.
 */
export const FIGHT_TICK_SECONDS = 0.1 // TUNED ✓

// ── Hero stats ─────────────────────────────────────  classes-and-combat.md §2

/**
 * The class spread table is qualitative — `high`, `mid`, `low`. These are the numbers
 * those words map to, and the single highest-leverage entry in this file.
 */
export const STAT_TIER_VALUES: Record<StatTier, number> = { // TUNED ✓
    low: 5,
    mid: 10,
    mid_high: 13,
    high: 16
}

/** §2's delta table gives directions and qualifiers ("modest", "extreme"), not magnitudes. */
export const DELTA_MODEST = 2 // TUNED ✓
export const DELTA_NORMAL = 4 // TUNED ✓
export const DELTA_EXTREME = 8 // TUNED ✓

/**
 * What every class's and archetype's **accumulated** LCK base is multiplied by.
 *
 * Applied after the tier value and the whole class path's deltas, so it lowers every unit's
 * starting crit chance without disturbing the relative spread — a Marksman still out-crits a
 * Warrior by the same ratio it always did.
 *
 * This is now the *only* dial on crit chance, because LCK is off the level curve
 * (`STAT_SCALES_WITH_LEVEL`): base LCK **is** the crit chance a unit carries forever, give or
 * take what the collection passive and the Gear/Skill/Artifact lines multiply onto it. So it
 * trades directly against `CRIT_CHANCE_PER_POINT` — the two move the same number, and halving
 * either halves crit chance at every level for every class.
 *
 * ⚠ Pushed far enough down, the 100% cap and `OVERFLOW_CONVERSION_RATE` stop being reachable at
 * all and the overflow valve becomes dead code. At 0.75 the cap is still very much reachable,
 * but only deliberately: a Marksman opens at LCK 12 → 12%, and **three maxed Precision Edge
 * Artifacts take it to exactly 100%** — three of the five Offense slots `artifacts-dig-site-
 * gacha.md` §4 allows, spent on one stat. That is the intended "crit is a build, not a
 * birthright" shape. Cutting this much further turns it into an unreachable one.
 */
export const LCK_BASE_SCALE = 0.75 // TUNED ✓

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
export const STAT_PER_LEVEL_FLAT = 0 // TUNED ✓

/**
 * How many factors of the stat curve one point of DPS carries.
 *
 * Damage is `PWR × critMultiplier × attacksPerSecond × strikes`, and **two of those ride the
 * stat block**: PWR directly, and `critMultiplier` through IMP. So DPS grows as the stat
 * curve *squared*, not linearly — at level 156 that is PWR 7.6e6 × critMult 380,260, and the
 * Hero outruns a curve it appears on paper to be matching.
 *
 * 2 is the asymptotic value, once attack rate has hit its ceiling. Below that SPD scales too,
 * so the true exponent is nearer 3 and early levels are worth somewhat more than this says.
 *
 * It used to be nearer **4**. LCK rode the level curve as well, so crit chance grew with it
 * until it capped, and that was a whole extra factor of the stat curve inside DPS.
 * `STAT_SCALES_WITH_LEVEL` took LCK off the curve and removed that term outright — the early
 * exponent dropped by a full point, and the early game now behaves much closer to the model
 * this constant describes. The asymptote is unchanged, because crit chance was already capped
 * and contributing nothing by the time it applied.
 *
 * The remaining gap is a real wrinkle in the model and not one a single constant can express —
 * it is why `STAT_PACE_RATIO` still wants playtesting rather than solving.
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
 *     solo Hero        walls at prestige 4, World 9      (3d 17h)
 *     + 2 Champions    walls at prestige 6, World 1      (1d 8h)
 *     + 5 Champions    walls at prestige 7, World 1      (1d 18h)
 *
 * ⚠ Those walls are **grind walls now, not wipes.** Every blocker the campaign walk used to
 * report was a wipe, produced by defensive stats falling behind the enemy; `ENEMY_PACE_RATIO`
 * stops them falling behind, so what remains is income against level cost. This ratio, the XP
 * curve and `MIN_SECONDS_PER_KILL` are therefore the *only* things gating a run — which is a
 * much larger share of the job than they carried before.
 *
 * ⚠ **1.0 removes gating entirely.** If the Hero tracks the curve exactly then "can I beat
 * World N's super boss" has the same answer for every N, and progression is purely time-
 * gated — the gacha becomes a speed multiplier rather than a gate. That may well be the
 * better game; it is a deliberate choice, not a safe default, so it is not the value here.
 */
export const STAT_PACE_RATIO = 0.5 // TUNED ✓

/** Derived, never set directly — move `STAT_PACE_RATIO`. */
export const STAT_PER_LEVEL_GROWTH = Math.pow(ENEMY_STEP_BASE, STAT_PACE_RATIO / DPS_STAT_EXPONENT)

/**
 * Which stats the hero-level curve is allowed to touch.
 *
 * **LCK is deliberately excluded.** Crit chance is `LCK × CRIT_CHANCE_PER_POINT` clamped to
 * 100%, so putting LCK on a geometric curve made the cap a question of *when* and never of
 * *whether*: a Marksman opening at 16% crossed 100% around level 96 — inside the first prestige
 * loop — and every level after that was LCK poured into the overflow valve. Frozen at base,
 * crit chance is something the collection passive, Gear, Skills and Artifacts have to buy,
 * which is what `champions-guild-gacha.md` §7 and `gear-equipment.md` §2 intended their LCK
 * lines to be for.
 *
 * ⚠ **This changes what `DPS_STAT_EXPONENT` describes early on** — see its comment. It does not
 * touch the asymptotic value: crit chance had already capped there and was contributing
 * nothing, so freezing it removes over-performance the pacing model never priced in rather
 * than removing growth the model was counting on.
 *
 * **IMP stays on the curve on purpose.** `critMultiplier = 1 + IMP × CRIT_DAMAGE_PER_POINT` is
 * unbounded and linear in IMP, and that is exactly what makes `DPS_STAT_EXPONENT` 2 rather than
 * 1. Taking IMP off the curve as well would halve the exponent DPS rides and force
 * `STAT_PER_LEVEL_GROWTH` to be re-derived — a much larger change than lowering its rate.
 */
export const STAT_SCALES_WITH_LEVEL: Readonly<Record<HqStatKey, boolean>> = {
    pwr: true,
    spd: true,
    lck: false,
    imp: true,
    vit: true,
    def: true
}

/**
 * Which stats ride the **enemy-paced** curve rather than `STAT_PER_LEVEL_GROWTH`.
 *
 * The rule is not offence versus defence. It is **whether the stat is read against an enemy
 * stat of its own kind**, because those are the pairs a clamp can close on:
 *
 *     hero PWR      vs enemy DEF     `mitigation` — clamps at DEF ≥ PWR × K
 *     hero DEF      vs enemy PWR     the same clamp, from the other side
 *     hero VIT      vs enemy PWR     the pool that survives what mitigation lets through
 *
 * A stat in a matched pair that grows even slightly slower than its opposite number does not
 * "fall behind and catch up later" — the ratio drifts one way forever, the clamp closes, and
 * damage collapses to `MIN_DAMAGE`. So all three pace the enemy exactly; see
 * `ENEMY_PACE_RATIO`, declared after the XP block because it derives from `LEVELS_PER_STAGE`.
 *
 * SPD and IMP are **not** in matched pairs — they are pure multipliers with no enemy stat
 * opposing them (attack rate, crit damage), so a shortfall there is an honest "you are behind,
 * grind or pull" rather than a cliff. They stay on `STAT_PACE_RATIO`.
 *
 * ⚠ **PWR was the last one to move here, and its shortfall was live for a long time.** DEF and
 * VIT were paced first, on the reasoning that the clamp was a survivability problem; that fixed
 * one side of the same equation and left the other. PWR coverage was exactly `XP_PACE_SLACK`
 * (0.9), so pooled party PWR fell a tenth of a stage behind enemy DEF every stage, and the
 * offensive clamp closed around prestige 4–5 — which is what every late grind wall the campaign
 * walk reported actually was. Lowering `XP_PACE_SLACK` to slow the game down pulled that cliff
 * all the way in to P1 W2, where one world cost nearly two days of fighting.
 */
export const STAT_PACES_ENEMY_CURVE: Readonly<Record<HqStatKey, boolean>> = { // TUNED ✓
    pwr: true,
    spd: false,
    lck: false,
    imp: false,
    vit: true,
    def: true
}

/**
 * What one point of a Champion's `(star × 10 + level)` scalar is worth as a stat multiplier.
 * The scalar runs 1 → 60, so this sets the span between an unstarred pull and a maxed one:
 * at 0.05 that is ×1.0 → ×3.95 on top of the rarity multiplier.
 *
 * Phase 2 owns the real value — `champions-guild-gacha.md` §2 never states how the scalar
 * converts to stats for a Champion's own block, unlike Gear and Artifacts which both have
 * explicit formulas. Placeholder so the shape is testable.
 *
 * ⚠ **No measurement in the repo exercises this at all.** Both the campaign walk and every
 * party fixture field Champions at `investment: 1`, which is the identity end of the scalar —
 * so every pacing number ever quoted for a party is the value of *slots*, never the value of
 * investment. It is also the widest unmeasured lever left in combat: the scalar runs 1 → 60,
 * so this sets a ×1.0 → ×3.95 span on every fielded Champion's whole stat block, on top of
 * rarity. Deciding it will move the gacha gradient more than any constant marked TUNED did.
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
 * **This is the dial for "XP numbers are too big", and very nearly *only* that.**
 *
 * An earlier note said the opposite — that lowering this would mean more levels and a longer
 * run, with a sweep table showing 1.16 buying 2 prestiges against 1.06's 4. That table is
 * stale: it was measured before defensive stats were put on their own curve, when every wall
 * in the game was a wipe. Re-swept on the campaign walk, prestige 0 solo:
 *
 *     1.16   2h 36m total — 26m 49s fighting, 2h 9m grinding    ends level 362
 *     1.12   1h 52m total — 26m 49s fighting, 1h 25m grinding   ends level 363
 *     1.08   1h 22m total — 26m 47s fighting, 55m grinding      ends level 363
 *     1.05   1h 5m  total — 26m 43s fighting, 39m grinding      ends level 364   ← here
 *
 * **Fighting time and the end level are invariant.** That is not a coincidence, it is an
 * identity: `XP_STEP_BASE === XP_TO_LEVEL_GROWTH ^ LEVELS_PER_STAGE`, so income and cost scale
 * by exactly the same factor at every depth, and `LEVELS_PER_STAGE` has no dependence on this
 * constant at all. What is left is a second-order effect on *grinding* — clearing a Δ-level
 * deficit at a blocker costs `growth^Δ`, so a shallower curve makes catching up cheaper.
 *
 * ## Why 1.05
 *
 * `XP_TO_LEVEL_BASE` and `XP_BASE_PER_KILL` are already 10 and 1, so re-denomination is spent;
 * the magnitude comes entirely from compounding across the ~3.6 levels a stage hands out.
 * Measured on `xpToNextLevel`:
 *
 *                     level ~101    level ~361    level ~721
 *                     (P0 W3)       (P0 end)      (P2 end)
 *     1.16            3.1e7         1.6e24        2.6e47
 *     1.08            2.3e4         1.1e13        1.2e25
 *     1.05            1.4e3         4.2e8         1.8e16     ← here
 *
 * At 1.16 a level-300 Hero is looking at 1.9e20 XP for its next level. At 1.05 it is 22M, and
 * the whole of the first three prestiges stays inside `formatHq`'s named-suffix ladder rather
 * than falling off into scientific notation.
 *
 * Going shallower still is available and costs nothing structural — 1.04 puts the first
 * prestige's ceiling at 14M — but each step also shaves the grind, which is the one thing this
 * game is currently short of.
 */
export const XP_TO_LEVEL_GROWTH = 1.05 // TUNED ✓

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
 * So the slack has to be its own dial — and what that dial *does* has changed twice since the
 * paragraph above was written. It no longer decides whether the game has a wall (nothing here
 * walls any more; `FIGHT_LENGTH_DRIFT` owns gating), and it does not make seconds-per-stage
 * climb. It sets exactly three things:
 *
 *     LEVELS_PER_STAGE            = slack × DPS_STAT_EXPONENT / STAT_PACE_RATIO   → 3.6
 *     coverage of SPD and IMP     = slack                                         → 0.9
 *     DPS_COVERAGE_PER_STAGE      = ENEMY_PACE_RATIO + slack                      → 1.9
 *
 * ## What it is, measured: the grind dial
 *
 * Swept on the one-week campaign walk, prestige 0 with a party of 3:
 *
 *     0.9    6d 9h  — 3h 44m fighting, 6d 5h grinding    ends level 447   ← here
 *     0.7    2d 20h — 3h 39m fighting, 2d 17h grinding   ends level 355
 *     0.5    23h 11m— 3h 29m fighting, 19h 42m grinding  ends level 257
 *     0.35   8h 51m — 3h 3m fighting, 5h 48m grinding    ends level 181
 *
 * **Fighting time is invariant and nothing walls.** Both follow from the structure rather than
 * from luck: `ENEMY_HP_STEP_EXPONENT` is set against `DPS_COVERAGE_PER_STAGE`, which contains
 * this constant, so lowering it slows the party and the enemy's HP curve by the same amount and
 * fight length does not move. What is left is how far behind the natural pace a gate leaves
 * you, and therefore how long you sit in front of it — **this is the dial for how much of the
 * week is idle waiting**, and 0.9 is what makes that week a week.
 *
 * ⚠ **It used to be far more dangerous than that.** Before PWR joined `STAT_PACES_ENEMY_CURVE`,
 * PWR coverage was exactly this number, so anything under 1.0 walked pooled party PWR into the
 * offensive mitigation clamp — and lowering it to slow the game down pulled that cliff from
 * prestige 4 in to P1 W2, where a single world cost nearly two days of fighting. The sweep
 * above is only safe because that coupling is gone.
 */
export const XP_PACE_SLACK = 0.9 // TUNED ✓

/** Derived. Move `XP_PACE_SLACK`, or the two curves it is measured against. */
export const XP_STEP_EXPONENT =
    XP_PACE_SLACK * Math.log(XP_TO_LEVEL_GROWTH) / Math.log(STAT_PER_LEVEL_GROWTH)

/** Per-step XP base. Derived from the exponent above. */
export const XP_STEP_BASE = Math.pow(ENEMY_STEP_BASE, XP_STEP_EXPONENT)

// ── Defensive pacing ───────────────────────────────  the constant-pressure curve
//
// Declared here rather than beside `STAT_PER_LEVEL_GROWTH` because it is derived from the
// XP curve above: how fast a defensive stat must grow *per level* depends on how many levels
// a stage hands out.

/**
 * Hero levels earned per stage of enemy curve, in steady state. **Derived, and exact.**
 *
 *     income per stage  ∝ XP_STEP_BASE^n          (kills per stage is constant)
 *     cost of level L   ∝ XP_TO_LEVEL_GROWTH^L
 *
 * Levels advance at a constant rate exactly when those two track, i.e. when
 * `L × ln(XP_TO_LEVEL_GROWTH) = n × ln(XP_STEP_BASE)`. Substituting `XP_STEP_EXPONENT` and
 * `STAT_PER_LEVEL_GROWTH` collapses every log away and leaves the ratio below — 3.6 at the
 * values here, which is what the campaign walk measures at every world past the first.
 *
 * The useful corollary: a level-scaled stat covers `LEVELS_PER_STAGE × STAT_PACE_RATIO /
 * DPS_STAT_EXPONENT = XP_PACE_SLACK` of a stage's enemy growth per stage. So *every* stat on
 * the ordinary curve — DEF and VIT included — has always fallen 10% of a stage behind the
 * enemy per stage. On the offensive side that is intended and `DPS_STAT_EXPONENT` more than
 * makes up for it. On the defensive side it was never priced, and it is the whole reason
 * survivability was the only thing that ever walled a run.
 */
export const LEVELS_PER_STAGE = XP_PACE_SLACK * DPS_STAT_EXPONENT / STAT_PACE_RATIO

/**
 * **How much of one stage's enemy growth a stage's worth of levels buys the matched stats** —
 * PWR, DEF and VIT (`STAT_PACES_ENEMY_CURVE`). Read against the same scale as
 * `STAT_PACE_RATIO`:
 *
 *     1.0   they track the enemy exactly, so every clamped ratio in the game — mitigation
 *           in both directions, and HP against incoming — is the *same number at every
 *           depth*                                                                  ← here
 *     0.9   what they used to get, by falling out of `XP_PACE_SLACK` rather than by
 *           anyone choosing it
 *
 * ## Why 1.0, and why anything less is not a difficulty dial
 *
 * `mitigation` is a hard clamp, so a matched pair that drifts does not get gradually harder —
 * it stays identical until the clamp closes and then collapses. Both sides showed it:
 *
 *     defensive   DEF started 2.67× above `enemyPwr × K` and converged at 1.08^0.1 per stage,
 *                 so the first ~130 stages took exactly `MIN_DAMAGE` per hit (World 5 measured
 *                 survival ratios of 155×–3785×) and then went unsurvivable within a few dozen
 *     offensive   pooled PWR fell 0.1 stages/stage behind enemy DEF, so damage dealt collapsed
 *                 to `MIN_DAMAGE` around prestige 4–5 — every late grind wall in the walk
 *
 * At 1.0 there is no drift to accumulate. `enemyPwr / heroDef` and `heroPwr / enemyDef` are
 * both fixed for the life of a run, so mitigation is fixed at both ends and the fraction of the
 * party's pool a stage attempt costs is fixed — set once, by `BASE_ENEMY_PWR` against the class
 * spread, and held forever.
 *
 * ⚠ **This deliberately removes the clamp as a source of walls, at both ends.** Gating is not
 * gone; it moved somewhere it can be tuned continuously — `FIGHT_LENGTH_DRIFT`, which lets
 * enemy HP outrun party DPS a little each stage. A ratio that clamps makes a cliff; a ratio
 * that never clamps makes a slope. Walls belong on the slope.
 */
export const ENEMY_PACE_RATIO = 1.0 // TUNED ✓

/** Derived, never set directly — move `ENEMY_PACE_RATIO`. */
export const STAT_PER_LEVEL_GROWTH_PACED =
    Math.pow(ENEMY_STEP_BASE, ENEMY_PACE_RATIO / LEVELS_PER_STAGE)

/**
 * **How fast the party's damage per second grows**, in stages of enemy curve per stage
 * advanced. Derived, and the number the enemy's HP curve has to be set against.
 *
 * `DPS = PWR × critMultiplier × attacksPerSecond × strikes`, and two of those ride the level
 * curve — PWR on the paced one, `critMultiplier` through IMP on the lagging one. (SPD rides it
 * too but `MIN_ATTACK_INTERVAL_SECONDS` caps attack rate, so it drops out asymptotically and
 * only makes early levels worth a little more than this says.)
 *
 *     DPS coverage = ENEMY_PACE_RATIO + XP_PACE_SLACK = 1.9
 *
 * Against enemy HP growing at 1.0, that is the whole reason every wave stage in the game sat
 * pinned at `MIN_SECONDS_PER_KILL`: the party outran the content by nine tenths of a stage
 * every stage, so a fight that started slow was back at the floor within a couple of worlds.
 * Note it cannot be tuned away through `STAT_PACE_RATIO` — IMP's share works out to exactly
 * `XP_PACE_SLACK` whatever that ratio is, and `XP_PACE_SLACK` also sets `LEVELS_PER_STAGE`.
 */
export const DPS_COVERAGE_PER_STAGE = ENEMY_PACE_RATIO + XP_PACE_SLACK

/**
 * **How much faster enemy HP grows than the party's DPS, per stage.** The one dial that
 * decides how long fights are, whether they stay that long, and where the run walls.
 *
 *     0     enemy HP tracks DPS exactly — every fight takes the same number of seconds at
 *           every depth, forever, and the game is purely time-gated with no wall ever
 *     0.35  a stage's fight is 1.08^0.35 ≈ +2.7% longer than the one before it   ← here
 *
 * At 0.35 the walls land on the **super bosses**, and only on them: `BOSS_TIMER_SECONDS` is a
 * fixed 30s, so a gate is the one place the drift is read as pass/fail rather than as a slower
 * grind. Measured on the campaign walk, prestige 0 with a party of 3 — every blocker is a
 * TIMER FAIL on a Stage 10, and the grind in front of each one runs 46m at World 2, 18h at
 * World 7, and 2d 11h at World 10, which is the point the run is asking for Champions rather
 * than levels.
 *
 * ⚠ **Above ~0.35 the run gets *shorter*, not longer.** The last gate of a loop has to make up
 * `drift × 100` stages of curve, and past this the level that needs is more than farming can
 * deliver — so the walk stops at World 8 or 9 instead of finishing. Measured: 0.40 walls at
 * W9S10, 0.45 and 0.50 at W8S10, 0.55 at W7S10.
 *
 * This is where gating lives now that no clamped ratio drifts (`ENEMY_PACE_RATIO`). It is a
 * *slope*, not a cliff: seconds-per-kill climbs geometrically but gently, so a stage is always
 * beatable given enough levels, boss gates tighten against `BOSS_TIMER_SECONDS` a little at a
 * time, and "grind or pull" is a continuous judgement rather than a wall you hit at full speed.
 *
 * ⚠ **Read it against `DPS_COVERAGE_PER_STAGE`, not against 1.0.** Enemy HP has to cover the
 * party's *whole* DPS growth before any of this is drift at all — HP rising at the same 1.0 the
 * rest of the enemy block rides is what pinned every wave stage to `MIN_SECONDS_PER_KILL`.
 * That is why this is the only enemy stat with its own exponent: PWR and DEF are in matched
 * pairs and pace the hero one-for-one, HP is matched against a *product* of two stats.
 */
export const FIGHT_LENGTH_DRIFT = 0.35 // TUNED ✓

/**
 * The exponent enemy HP rides on the shared curve index, against `ENEMY_STEP_BASE`.
 *
 * Derived — move `FIGHT_LENGTH_DRIFT`, or the coverage it is measured against.
 */
export const ENEMY_HP_STEP_EXPONENT = DPS_COVERAGE_PER_STAGE + FIGHT_LENGTH_DRIFT

// ── Gold ───────────────────────────────────────────  gold-economy.md §3–4

/**
 * Calibrated against the platform's rebalanced idle economies, not picked. At the tenure
 * ceiling's day-0 rung this puts a fresh account on ~4.2k Gold/hour, which is where Colony
 * and Xeno sit on their own first day (`scripts/lib/economy-stages.ts`).
 *
 * Was 5 while Gold was prestige-driven alone; that placed a three-hour-old account at ~500x
 * the platform's day-one income, because four prestige loops fit inside those three hours.
 */
export const BASE_GOLD = 0.4

/**
 * Gold's progression curve, on the same continuous index the enemy rides:
 *
 *     GOLD_STEP_BASE^n,  n = prestige x 100 + (world-1) x 10 + (stage-1)
 *
 * Replaces `PRESTIGE_GOLD_FACTOR[] x GOLD_WORLD_BASE^(w-1) x GOLD_STAGE_BASE^(s-1)`, the same
 * way `ENEMY_STEP_BASE` replaced the enemy's three-base product (`open-items.md` #10). The old
 * shape had a **seam nothing wanted**: the factor climbed x11.6 across a run and then the
 * prestige rung only paid x2.8, so finishing World 10 and looping back to World 1 *cut* Gold
 * per kill by about x4. One base over one index has no boundary to have a seam at.
 *
 * Two things follow from Gold sharing the enemy's index rather than owning its own bases:
 *
 * - **It needs no cap of its own.** `GOLD_PRESTIGE_CAP` and `GOLD_PLATEAU_GROWTH` existed to
 *   keep an unbounded prestige chain inside `numeric(19,4)`. `goldPerKill` takes the `min` of
 *   this and the tenure ceiling, so the ceiling is the bound — for every position, forever.
 * - **It is the only Gold progression dial left.** Nothing decays, nothing is tabulated.
 *
 * 1.017 is the shallowest base at which the weakest roster the campaign sim walks never leaves
 * the platform's 0.4-2.5x cross-game band (`scripts/economy-compare.ts`), while still spending
 * ~40% of its time below the ceiling — so falling behind on power still costs Gold, which is
 * the entire reason the progression term exists alongside the ceiling. Steeper pins every
 * roster to the ceiling permanently and progress stops paying; shallower drops a stalled
 * account to a tenth of platform income.
 */
export const GOLD_STEP_BASE = 1.017

// ── The tenure ceiling ─────────────────────────────  gold-economy.md §3, §9

/**
 * A speed limit on Gold, expressed as the largest `goldPerKill` factor an account of a given
 * age may use. `goldPerKill` takes `min(progression, ceiling)`, so this never *grants* income —
 * it only refuses to pay out progress the calendar has not caught up with yet.
 *
 * **Why a ceiling and not a curve of its own.** `gold-economy.md` §3 says the prestige column is
 * a placeholder and the calendar column is the commitment, and §9 assigns the balance script the
 * job of deriving the prestige→calendar mapping that connects them. That mapping was measured
 * (`scripts/hero-quest/sim.ts`, campaign walk) and **it does not exist**: a party of Commons
 * clears four prestige loops in under three hours and then spends 29 days on the fifth, and a
 * strong roster clears six in the same three hours. Prestige count tracks accumulated power, not
 * elapsed time, so no prestige-indexed table can hit a calendar anchor — whatever value sits at
 * `PRESTIGE_GOLD_FACTOR[5]`, one account reaches it in two hours and another in six weeks.
 *
 * Indexing on wall-clock account age instead is the one measure that cannot be front-loaded,
 * farmed, or lost. Every other candidate fails:
 *
 * - **Progression** is circular — the ceiling exists *because* progression is front-loaded.
 * - **Time since the run began** resets every prestige, i.e. every ~20 minutes early on, which
 *   would make the ceiling punish the loop the whole game is built around.
 * - **Settled playtime** is capped by `offlineCapHours` (8h before the shop track is bought), so
 *   a player who opens the game once a day would bank 8 hours of every 24 and carry that deficit
 *   forever. That is an engagement tax on an idle game, and it rewards leaving the tab open.
 *
 * Because it is a `min`, a dormant account is not a hole: six months of wall-clock buys a high
 * ceiling, but a Stage 1 hero's progression factor is still 1, so the ceiling is not what binds
 * and the account earns a Stage 1 rate. Waiting cannot skip the game.
 *
 * Consequence worth knowing: the ceiling binds for roughly the first two to eight weeks
 * depending on roster strength, which clamps `PRESTIGE_GOLD_FACTOR[0..4]` away entirely. Those
 * rungs are no longer load-bearing and tuning starts at p5.
 */
export const GOLD_TENURE_DAYS: readonly number[] = [
    0, 0.14, 0.25, 0.5, 1.03, 1.23, 3, 3.93, 5.84, 11.62, 15.84, 34.35, 41.97, 81.91, 145.09, 229.47
]

/**
 * The ceiling at each rung of `GOLD_TENURE_DAYS`, geometrically interpolated between them.
 *
 * Derived, not chosen: each entry is the geometric mean of Colony and Xeno income (uninvested
 * and invested, both games) at that day, divided by `BASE_GOLD × 3600 / MIN_SECONDS_PER_KILL`.
 * That makes a Hero Quest account earn what a platform account of the same age earns while the
 * ceiling binds. Regenerate from `scripts/lib/economy-stages.ts` whenever those two economies
 * are retuned — the whole point is that this table is downstream of them.
 *
 * The rung days are not round because they are not arbitrary: they sit on **every Colony habitat
 * and Xeno tier boundary**, which is where the platform curve actually bends. Interpolating
 * across a bend is what costs accuracy — an evenly-spaced set of rungs sagged up to 22% below
 * the curve it is meant to reproduce, worst around day 4; landing on the bends holds it to 1.5%.
 */
export const GOLD_TENURE_CEILING: readonly number[] = [
    1.443, 3.098, 3.869, 6.181, 16.68, 21.9, 90.2, 157.2, 280, 718.6, 1110, 3223, 4446, 10870, 17190, 28510
]

/**
 * How far under the platform curve the ceiling actually sits.
 *
 * The table above is the platform curve itself, so on its own it would put Hero Quest at
 * parity. Parity is the wrong target: measured across the campaign walk, an invested roster
 * spends **~89% of its time** with the ceiling binding rather than progression, and takes
 * ~80% of its Gold from those stretches — so the ceiling is not an occasional cap, it is what
 * the economy pays. A game that idles at exactly the platform rate for nine tenths of its
 * lifetime is the platform's best idle game, which is not what this one is for.
 *
 * Kept as its own dial rather than folded into the table so the table stays literally "what
 * Colony and Xeno pay", regenerable and checkable against `scripts/lib/economy-stages.ts`,
 * with the deliberate discount visible as one number next to it.
 */
export const GOLD_PLATFORM_DISCOUNT = 0.85

/**
 * Per-day growth past the last rung, the tenure analogue of `GOLD_PLATEAU_GROWTH`.
 *
 * +20%/year, so a decade of play lifts the ceiling ~5.5x. Sized against the column rather than
 * picked: at a ten-year horizon the worst-case collect (max Gold stack, max Battle Speed, a full
 * 72-hour offline window) still clears `numeric(19,4)` by three orders of magnitude, which is
 * what `gold-economy.md` §9.4 asks the specs to assert.
 */
export const GOLD_TENURE_CRAWL = 1.0005

/**
 * The horizon the Gold/hour bound is stated at. The crawl above never goes flat, so "the maximum
 * Gold per hour" is only meaningful with a date attached; ten years is the one the specs use.
 */
export const GOLD_BOUND_HORIZON_DAYS = 3650

/**
 * Throughput floor. Bounds the *rate* half of Gold/hour — a bounded per-kill value times
 * an unbounded kill rate is still unbounded income. Also the pacing floor the Pixi battle
 * scene needs. Live and offline use the identical function so the two always agree.
 */
export const MIN_SECONDS_PER_KILL = 0.5 // TUNED ✓

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

// ── Automatic boss engagement ──────────────────────  tech-architecture.md §4b
//
// A boss fires on its own while `document.visibilityState` reads `visible`, which is the same
// presence the refresh interval above demonstrates — a backgrounded or closed tab still never
// engages one, so "bosses require the player to be present" holds unchanged.

/**
 * Kills of margin the client waits for before firing an automatic engage.
 *
 * **Not cosmetic, and not a debounce.** The client's projection counts kills fractionally so a
 * bar can move smoothly; `settle()` floors its budget into whole banked kills. The client
 * therefore crosses a stage boundary up to one kill *early* — up to `secondsPerKill` of wall
 * clock — and an engage sent in that window is rejected by `boss/engage.post.ts`, which settles
 * and then checks the position under its lock. Waiting a full kill is exactly what guarantees the
 * server's floored count has crossed the same boundary.
 *
 * Expressed in kills rather than seconds because the lead it covers *is* one kill: the right
 * wait is `secondsPerKill`, whatever that currently happens to be.
 */
export const AUTO_ENGAGE_GRACE_KILLS = 1

/**
 * Floor and ceiling on the wait that comes out of it, in seconds.
 *
 * The floor covers request latency at stages where a kill takes almost no time; the ceiling
 * stops a deep stage's minute-long `secondsPerKill` from making the gate feel broken, and is
 * safe because a rejected engage is retried rather than surfaced.
 */
export const AUTO_ENGAGE_MIN_DELAY_SECONDS = 1
export const AUTO_ENGAGE_MAX_DELAY_SECONDS = 10

/**
 * How long after a rejected automatic engage to try again.
 *
 * A rejection means the client ran ahead of the server, not that anything is wrong, so it is
 * swallowed rather than toasted and simply retried — see `useHqAutoBoss`.
 */
export const AUTO_ENGAGE_RETRY_SECONDS = 3

/**
 * How long an automatically-engaged replay holds on its outcome before closing itself.
 *
 * Long enough to read "Victory" or "Your hero fell" and the line under it. A *manually* engaged
 * fight never auto-closes — the player asked for that one and dismisses it themselves.
 */
export const AUTO_ENGAGE_REPLAY_HOLD_SECONDS = 2.5

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
