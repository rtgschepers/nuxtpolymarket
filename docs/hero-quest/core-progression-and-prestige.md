# Core Progression & Prestige System

Status: **Locked** — decisions confirmed, ready to reference for implementation planning.

## Structure recap
- 1 prestige run = **10 worlds (fixed)** × 10 stages each
- Stage 10 of every world = super boss encounter
- Player prestiges after clearing World 10, Stage 10, resetting into a harder run

---

## 1. Enemy Power Curve

Base multiplier applied to enemy stats. Every position in the game collapses to **one index**,
and the curve is a single exponential over it.

```
n = prestige × 100 + (world-1) × 10 + (stage-1)

enemyMultiplier(prestige, world, stage) = b^n
```
(world and stage both range 1–10, so `n` advances by exactly 1 per stage, forever)

- `b` = **per-stage growth**, `ENEMY_STEP_BASE`, currently **1.08** (+8% per stage)
- `T` = `b^100` ≈ **2,200** — the multiplier across one full 100-stage prestige loop, derived

This **replaces** the earlier `5^prestige × 1.6^(world-1) × 1.15^(stage-1)`, which was three
bases on three axes and stepped unevenly: a world boundary was a ×1.6 jump where a stage step
was ×1.15, and because stage reset from 10 to 1 across that boundary the curve actually *fell*
×0.455 at every world change and ×0.021 at every prestige. It was a sawtooth, not a ramp. The
single index removes both seams — n=99 → n=100 is one ordinary step like any other.

**Consequence, deliberate and worth stating plainly: there is no prestige difficulty reset.**
Under the old curve a new prestige started ~52× weaker than where you just were, so prestige
meant re-climbing familiar ground. It no longer does. A single continuous base cannot express
both a per-run ramp and a smaller per-prestige jump — under one index they are the same number.
`ENEMY_PRESTIGE_STEP_MULT` in `constants.ts` is the escape hatch if the dip is wanted back.

**Elite mob stats** (stages 6–9 within a world), layered on top of the regular-mob multiplier for that stage:
- Stats ≈ ×1.2–1.5 that stage's regular-mob baseline — same base roster, stat-buffed variants with a slight design variation (e.g. recolor or minor visual tweak) so players can tell them apart from regular mobs at a glance, without needing full new art.

**Boss stats** (Stage 5 of every world), layered on top of the trash-mob multiplier for that stage:
- HP ≈ **×3** trash-mob HP
- ATK ≈ ×1.2 trash-mob ATK

**Super boss stats** (Stage 10 of each world), also expressed against **trash-mob** HP so the two
gates stay directly comparable while balancing:
- HP ≈ **×6** trash-mob HP
- ATK ≈ ×1.5 trash-mob ATK

Both boss numbers are down hard from the original ×8–12 (and the super boss's ×2-of-stage-boss,
which compounded to ×16–24 of trash). The super boss is now the heavier of the two on purpose:
against a fixed `BOSS_TIMER_SECONDS`, a gate is a pure DPS check, and party DPS is exactly what
Champions add. Making the *gate* the wall rather than the wave ramp is what turns "this got
slow" into "this needs a party."

All constants above are tunable starting points; adjust via playtesting rather than theory.

### Hero pacing against the curve

Hero stat growth is now **geometric**, not flat-additive, and is expressed as a fraction of the enemy curve rather than as an independent number:

```
STAT_PER_LEVEL_GROWTH = ENEMY_STEP_BASE ^ (STAT_PACE_RATIO / DPS_STAT_EXPONENT)
```

- `STAT_PACE_RATIO` — **how much of one stage's difficulty one level of DPS buys.** At 1.0 the Hero tracks the curve exactly and never walls; below it the shortfall compounds, and filling that shortfall is the entire job of the gacha collections, prestige-shop multipliers and Traits. Currently 0.5.
- `DPS_STAT_EXPONENT = 2` — damage is `PWR × critMultiplier × …`, and **both** ride the stat block (`critMultiplier` through IMP), so DPS grows as the stat curve *squared*. Missing this is what makes an apparently pace-matched Hero run away from the curve.

⚠ **`STAT_PACE_RATIO = 1.0` removes gating entirely.** If the Hero tracks the curve exactly, "can I beat World N's super boss" has the same answer for every N, progression becomes purely time-gated, and the gacha turns into a speed multiplier rather than a gate. That is a legitimate design — it is just a deliberate choice, not the default.

XP income is pinned to the same frame: `XP_STEP_EXPONENT = XP_PACE_SLACK × ln(XP_TO_LEVEL_GROWTH) / ln(STAT_PER_LEVEL_GROWTH)`, where the break-even is the value at which seconds-per-stage stays constant forever. `XP_PACE_SLACK` below 1.0 is what lets the run eventually stop being worth grinding.

Measured at the current values, a solo Hero walls at prestige 2 / World 8; the starting party of 3 reaches prestige 4 / World 3; a full party of 6 clears five prestiges without walling.

Note: by roughly prestige 15–20, raw numbers will exceed standard float precision. Plan for scientific notation display or a big-number library (e.g. `break_eternity.js`) ahead of time.

---

## 2. Stage Types & Completion Rules

Each world's 10 stages break down into four archetypes:

| Stages | Type | Enemies | Progression rule |
|---|---|---|---|
| 1–4 | Regular wave | Regular mobs | Kill count required to advance |
| 5 | Boss | Boss + a couple regular mobs | Defeat boss within time limit |
| 6–9 | Elite wave | Buffed ("elite") variants of regular mobs | Kill count required to advance |
| 10 | Super boss | Super boss | Defeat super boss within time limit |

- **Kill count:** baseline **30**, does not scale with world/prestige — difficulty comes from enemy stats, not enemy count. This should be implemented as a single easily-tunable constant (e.g. `BASE_KILL_COUNT`) rather than hardcoded per stage, since it's expected to change often during balancing. It can later be reduced via prestige-shop upgrades (Section 4) or other future mechanics.
- **Boss/super boss timer:** flat 30 seconds, same at both Stage 5 and Stage 10.
- **Fail state:** if the boss (or super boss) isn't killed within the time limit, **or** the party dies, the player is sent back one stage to farm — Stage 5 failure returns the player to Stage 4, Stage 10 failure returns the player to Stage 9. The boss fight is **not** auto-retried; the player must manually choose to re-engage once ready. This gives a natural grind-and-retry loop: fall back, farm the previous wave for gold/XP/levels, then attempt the boss again at will.

---

## 3. Prestige Reset Rules

**Revised — Hero level now persists too.** The only things that reset are run position and run-scoped run state:

| Resets on prestige | Persists on prestige |
|---|---|
| World/stage position → World 1, Stage 1 | **Hero level & XP** (revised — no longer resets) |
| Stage kill-count flags, run-scoped buffs | Hero's class node & "already seen" node history |
| | Champion roster, levels, stars/dupes (Guild gacha) |
| | Skill roster & levels (Training Grounds gacha) |
| | Artifact roster & levels (Dig-site gacha) |
| | Gear roster & levels (Forge gacha) |
| | Trait slots, Trait save slots |
| | Loadouts, formation, equipped everything |
| | Raid state (frontier levels, Key balances) |
| | Arena state (Medals, defense loadout; Rating resets by *season*, not prestige) |
| | Gold, Gems, Void Shards, all Seals/Essence/Keys/Trait Gems |
| | Prestige-shop purchases |
| | Lifetime stats/achievements |

**Locked: Hero level never resets — not on prestige, and not when switching class.** The player carries their level through every prestige, and carries it *across* a class switch as well: picking Warrior after a run as a Mage keeps the level intact, only the node (and therefore the stat spread and inherited kit) changes. There is no relevel-from-1 anywhere in the game.

**What this changes, stated plainly, since it's a large shift:**
- **The class picker becomes a genuine build choice rather than a cost.** Previously, switching class and staying put were mechanically identical (both reset you to level 1), so "try something else" carried an invisible tax of re-earning your level in the new node. Now the level is yours; the only thing that changes is which spread it multiplies into. Experimenting across the 16-node tree is free.
- **The "steamroll the early worlds" feel gets much stronger.** A post-prestige player re-enters World 1 with their full level *and* their full collection against a ×5-per-tier enemy bump. That's intended — the early worlds are meant to be a victory lap, with the wall arriving later in the run.
- **XP stops being run-scoped.** `gold-economy.md` §2 lists XP as *"free to follow enemy value — it's run-scoped (Hero resets to Lv1 at prestige)."* That justification no longer holds; XP is now a permanent, unbounded-growth quantity and needs the same Decimal/text treatment as combat stats (`tech-architecture.md` §2 already stores `heroXp` as text/Decimal, so the implementation is already correct — only the reasoning was stale).
- **Pacing needs a re-check.** `gold-economy.md` §9's prestige→calendar mapping models run duration assuming a per-prestige relevel grind. Without it, later prestiges resolve faster than modelled, which shifts every calendar anchor. Flagged for the balance-script pass rather than guessed at here.

**Design intent:** wiping the four gacha collections each prestige would erase real investment and kill retention. Keeping everything persistent while resetting only world position produces a satisfying "steamroll the early worlds" feel right after a prestige, tightening up again deeper into the run. Gold persists too — it's the platform's regular global currency (see Section 4), not a run-scoped resource, so there's no reason to zero it out on reset.

**Resolved:** no level-cap gating system, and no level reset either. Hero and Champion levels are uncapped *and* fully persistent across every prestige — the exponential enemy curve is bounded within a prestige tier, so continuous uncapped leveling alone is enough headroom without needing either a cap-raising mechanic or a reset.

---

## 4. Prestige Currency

**Platform context:** the target platform provides two global currencies out of the box — **Gold** (regular currency) and **Gems** (premium currency), both per-user, shared across every game on the platform (not shared between players, no real-money purchase path). Gold is earned from idle stage farming (kill-count progress, Section 2) and persists across prestige (Section 3), **but follows its own bounded curve deliberately decoupled from this doc's `enemyMultiplier`** — Gold cannot ride the exponential enemy curve since it lives on a fixed-precision shared platform column; see `gold-economy.md` (Locked) for the full formula and reasoning. **Resolved (was previously open): the prestige currency described below is Void Shards, a new currency dedicated to this game** — not Gems, not Gold; see `economy-and-currencies.md` §3 (Locked) for its full source/sink specification. The mechanics below describe the prestige currency's earning/spending shape; the concrete formula constants are calibrated in that doc.

**Earning:** fixed payout, granted only on a full clear of World 10 / Stage 10 — no partial credit for an incomplete run. Payout scales with which prestige tier is being completed, since a higher-prestige full clear represents far more difficulty:

```
prestigeCurrencyEarned(prestigeCompleted) =
    BASE_CURRENCY × CURRENCY_GROWTH^prestigeCompleted
```

Starting point: `BASE_CURRENCY = 100`, `CURRENCY_GROWTH = 2` → 100 / 200 / 400 / 800 / ... Keep `CURRENCY_GROWTH` well below the enemy curve's 5× jump; it only needs to outpace shop upgrade costs, not match the power curve 1:1. Exact tuning depends on the eventual shop cost curve.

**Design note:** this pairs with the soft fallback fail state — since a run can never permanently lose progress (only fall back a stage), "must reach World 10 to get paid" doesn't carry true failure risk, just time cost. If early playtesting shows the *first* prestige (before any shop bonuses exist) takes unreasonably long with zero payoff en route, that's the one assumption worth revisiting.

**Spends on (shop, permanent):**
- Global stat multipliers (ATK%, HP%, gold gain%)
- Idle/offline efficiency%
- **Slot expansions — same pattern across the three slot-based collectible systems:** Champion slots, (gacha) Skill slots, and Artifact slots each start at **2** and cap at **5**, via **3 permanent purchase levels** apiece (2→3, 3→4, 4→5) — 9 purchase levels total. See `champions-guild-gacha.md` §1, `skills-gacha.md` §6, and `artifacts-dig-site-gacha.md` §7. **Gear/Forge has no slot track** — all 6 of its slots are available from account start by design (`gear-equipment.md` §1).
- Kill-count reduction% (lowering the per-stage requirement below its base 30) or boss-timer extension (small, expensive)
- **Raid Key daily-grant-rate — 5 independent tracks, one per raid** (Guild/Training Grounds/Dig-site/Forge/Trait), each raising that raid's Key grant above the 3/day baseline, with its bank cap scaling to match the upgraded rate. Same one-track-per-system pattern as the slot expansions above, applied to `raid-system.md` §3's Key mechanic (Locked).

---

## 5. World Themes

**Fixed pool, no reskins** — the same 10 worlds, with the same art and the same enemy rosters, appear identically in every prestige run.

**One name is already pre-committed: World 10 is The Void.** `economy-and-currencies.md` §3 names the prestige currency **Void Shards** after it, with the lore tie "reach the end and reset stronger." The remaining 9 world identities are open, but this one is load-bearing on a locked currency name — the world-design pass either keeps it or renames Void Shards. No tier bumps or visual re-theming between prestiges — this keeps art scope minimal for a small team. Difficulty is communicated entirely through the stat curve (Section 1), not through visual differentiation between prestiges.

---

## Next sections to define
- **World themes & enemy/boss design (specific rosters)** — the only remaining greenfield design pass, and a dependency for `gold-economy.md` §9's calendar calibration.

*(Classes & combat, all four gacha systems, and idle mechanics & economy are all now Locked in their own docs — see `index.md`.)*
