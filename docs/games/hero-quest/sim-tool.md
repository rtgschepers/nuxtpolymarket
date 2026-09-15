# Combat Sim — Usage

`bun run sim:hero-quest` — the tuning workhorse for Hero Quest combat.

Every number it prints comes out of the shared pure functions (`shared/utils/hero-quest/combat.ts`,
`stats.ts`, `settle.ts`, `projection.ts`, `explain.ts`) — the same code the game runs. Rates go
through `rateAt`, the helper `settle()` itself uses, so buffs, debuffs and ability damage are
counted exactly as the idle game counts them. No formula is restated inside the tool, so a result
that looks wrong here is wrong in the game too.

**What it is not:** crit-averaged, matching how offline settle resolves (`idle-mechanics.md` §4).
There is no per-hit rolling, so there is no variance and no win rate. A verdict means *"wins on
expected values"*, not *"wins 60% of the time"*. Rolled, seeded boss fights are `fight.ts`; the
idle projection agrees with them within −30% / +70% (`projection.spec.ts`), so gate verdicts
within a few percent of the timer are a coin flip in the real fight.

*Refreshed 2026-09-15 against the tuned constants. Every example output below is real output at
that commit.*

---

## Quick start

```bash
bun run sim:hero-quest                              # World 1 walk, level 1, hero levels as it goes
bun run sim:hero-quest --report=gates               # min level for all 20 boss gates — the fastest read
bun run sim:hero-quest --report=campaign --party=3  # how far a run gets, and where it walls
bun run sim:hero-quest --report=stats --level=40    # where every stat comes from
bun run sim:hero-quest --sweep=K=8,16,32            # sweep a dial and tabulate the effect
```

---

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--report=` | `world` | `stage` · `world` · `campaign` · `gates` · `classes` · `stats` |
| `--class=` | `class_beginner` | Any of the 16 class IDs. Bad IDs fail immediately. |
| `--level=` | `1` | Hero level. Starting level for `world`, fixed level for the others. |
| `--world=` | `1` | 1–10 |
| `--stage=` | `10` | 1–10. Used by `stage` and `classes`. |
| `--prestige=` | `0` | Adds 100 to the curve index — one prestige loop deeper. |
| `--party=` | `1` | Total units including the Hero. Champions are stand-ins — see *Caveats*. Real parties run 3–6. |
| `--tenure-days=` | `3650` | Account age the Gold column is read at. Verdicts never touch it. The campaign walk ignores it and runs its own clock. |
| `--no-levelup` | off | `world` only — hold level fixed instead of levelling through the walk. |
| `--max-prestige=` | `10` | `campaign` only — prestiges to walk before giving up on finding a wall. |
| `--grind-hours=` | `72` | `campaign` only — farming allowed per blocked stage before it counts as a wall. Sized against a ~week-long prestige; a tighter budget reports intended late-gate grinds as walls. |
| `--max-level=` | `5000` | `campaign` only — level-search ceiling. Past this, a stage reads as unclearable. |
| `--sweep-levels=` | — | `stats` only — e.g. `1,20,50,200`, the scaling view. |
| `--set=` | — | Override a constant for this run. Repeatable. |
| `--sweep=` | — | Sweep a constant across a range. |
| `--json` | off | Machine-readable output. |

---

## The six reports

### `--report=stage` — one stage in detail

Everything about a single fight: can you kill it, how fast, and do you survive doing so.

```
bun run sim:hero-quest --report=stage --world=1 --stage=5 --level=20
```
```
class_beginner @ level 20 — prestige 0
World 1, stage 5 — boss

  party DPS             37.47
  enemy EHP            865.83   DEF 2.72
  time to kill          29.7s   vs 30s timer  PASS
  margin                +1.0%

  incoming DPS           1.37
  hero EHP             294.13
  time to die          3m 35s
  must survive          29.7s   (whole boss fight)
  survival               7.2x

  verdict               CLEAR
```

`survival` is `time to die / must survive`. Below `1.0x` is a wipe; `2.0x` means twice the HP you
need. It separates *"can't kill it fast enough"* from *"dies trying"* — two problems with
completely different fixes. **"Must survive" is the whole stage attempt for waves too**: HP is one
pool across all thirty kills and refills only on a clear or a wipe.

Note the margin: +1.0% is a pass on expected values and a coin flip in the seeded fight. That is
why `BOSS_HP_MULT` is sized so a solo Beginner *arrives* at this gate failing it clearly.

### `--report=world` — the full ten-stage walk

Default report. Feeds each stage's XP back in before the next, so it projects a real playthrough
rather than a frozen snapshot. Pass `--no-levelup` to see one power level's reach instead.

```
bun run sim:hero-quest --world=1
```
```
┌───────┬────────────┬─────┬──────────┬───────────┬───────────┬────────┬───────┬────────┬──────────────┬──────────┬────────────┐
│ stage │ type       │ lvl │ enemy HP │ enemy DEF │ party DPS │ s/kill │ kills │ clear  │ timer margin │ survival │ verdict    │
├───────┼────────────┼─────┼──────────┼───────────┼───────────┼────────┼───────┼────────┼──────────────┼──────────┼────────────┤
│ 1     │ wave       │ 1   │ 60       │ 2         │ 22.02     │ 2.72   │ 30    │ 1m 22s │ —            │ 1.9x     │ CLEAR      │
│ 4     │ wave       │ 10  │ 103.23   │ 2.52      │ 28.18     │ 3.66   │ 30    │ 1m 50s │ —            │ 1.1x     │ CLEAR      │
│ 5     │ boss       │ 13  │ 865.83   │ 2.72      │ 30.65     │ 12.11  │ —     │ 36.3s  │ -21.1%       │ 5.2x     │ TIMER FAIL │
│ 6     │ elite      │ 13  │ 177.85   │ 3.53      │ 30.57     │ 5.82   │ 30    │ 2m 55s │ —            │ 0.5x     │ WIPE       │
│ 9     │ elite      │ 25  │ 305.98   │ 4.44      │ 43.18     │ 7.09   │ 30    │ 3m 33s │ —            │ 0.3x     │ WIPE       │
│ 10    │ super_boss │ 29  │ 2.75K    │ 4.00      │ 48.70     │ 23.00  │ —     │ 1m 9s  │ -130.0%      │ 1.9x     │ TIMER FAIL │
└───────┴────────────┴─────┴──────────┴───────────┴───────────┴────────┴───────┴────────┴──────────────┴──────────┴────────────┘
Total: 21m 5s   level 1 → 29   gold 104
First blocker: stage 5 — TIMER FAIL
```

*(rows 2, 3, 7, 8 trimmed here for width — the real output prints all ten.)*

This is the intended opening for a **solo** Beginner: Stages 1–4 clear, the Stage 5 timer fails by
a clear margin, and a starting party of three passes it on sight. Two things to read here:

- **Survival shrinks across a world, then resets.** Hero DEF and VIT pace enemy PWR exactly
  (`ENEMY_PACE_RATIO`), but a level-up only lands between stages while fights lengthen within one.
- **Elite wave `WIPE`s are soft.** A wave wipe restarts the same stage with its kills banked, so
  the Hero levels out of it — the campaign walk treats these as grinds, not walls.

### `--report=campaign` — stages, worlds and prestiges until something stops you

`world` gives up at its first blocker. `campaign` doesn't: a failed stage sends the run back to
farm — the soft-fail rule — and it keeps walking, world after world, prestige after prestige,
until farming stops working. **That stopping point is the output.** Everything above it is
context for it. It runs its own clock, so Gold is read through the tenure ceiling at the account
age the walk has reached.

```bash
bun run sim:hero-quest --report=campaign
bun run sim:hero-quest --report=campaign --party=3 --grind-hours=100 --max-prestige=3
```
```
Grind budget 72h per blocked stage, level ceiling 5000, up to 10 prestige(s)

┌───┬───────┬───────────┬─────────┬────────┬──────────┬────────┬────────┐
│ P │ world │ lvl       │ fights  │ grind  │ blockers │ gold   │        │
├───┼───────┼───────────┼─────────┼────────┼──────────┼────────┼────────┤
│ 0 │ 1     │ 1 → 56    │ 14m 39s │ 38m 4s │ 6        │ 360    │        │
│ 0 │ 2     │ 56 → 108  │ 16m 22s │ 1h 26m │ 8        │ 759    │        │
│ 0 │ 3     │ 108 → 157 │ 17m 27s │ 2h 19m │ 7        │ 1,301  │        │
│ 0 │ 4     │ 157 → 226 │ 21m 21s │ 14h 9m │ 5        │ 6,037  │        │
│ 0 │ 5     │ 226 → 283 │ 22m 13s │ 1d 14h │ 2        │ 16,331 │        │
│ 0 │ 6     │ 283 → 334 │ 22m 3s  │ 2d 15h │ 2        │ 32,781 │        │
│ 0 │ 7     │ 334 → 382 │ 21m 57s │ 3d 21h │ 2        │ 57,324 │        │
│ 0 │ 8     │ 382 → 401 │ 21m 43s │ 1d 12h │ 1        │ 32,360 │ ← WALL │
└───┴───────┴───────────┴─────────┴────────┴──────────┴────────┴────────┘

GRIND WALL — clearable, but not in the time budget
  at             P0 W8S10 (super_boss)
  hero level     401   needs 430
  why            needs level 430 (from 401) — 4.3d of farming W8S9, over the 3.0d budget

Reached: 0 prestige(s) completed, level 1 → 401
Time:    10d 11h total — 2h 38m fighting, 10d 8h grinding
Gold:    147,254
```

*(the "Forced grinds" table, which lists every blocker farmed through, is trimmed.)*

`fights` vs `grind` is the number to read. Once grind dwarfs fights, the world is no longer
being played — it's being waited out. Fighting time per world is nearly flat by construction
(enemy HP is set against party DPS growth); grind is what `XP_PACE_SLACK` and
`FIGHT_LENGTH_DRIFT` move. The same walk with `--party=3` completes its first prestige in about
6½ days and walls at P1 W2S10.

**Three walls, three different fixes:**

| Wall | Meaning | Dial |
|---|---|---|
| `GRIND WALL` | Clearable, but the farming exceeds `--grind-hours`. | Pacing: `XP_PACE_SLACK`, `FIGHT_LENGTH_DRIFT`, `SUPER_BOSS_HP_MULT` |
| `UNCLEARABLE` | No level inside `--max-level` clears it — the curve has outrun the hero. | `FIGHT_LENGTH_DRIFT` past ~0.35, enemy bases, `BOSS_TIMER_SECONDS` |
| `UNFARMABLE` | Nowhere left to earn XP. Means the real wall is already behind you. | — |

`NO WALL` means the run finished `--max-prestige` loops without getting stuck; raise it to keep
walking.

Farming is modelled at the deepest clearable stage, matching where a stuck player actually stands.
XP and enemy HP ride the same index, so farming shallower buys nothing and the deepest stage is the
right one. A boss counts as one kill for both Gold and XP here, where `--report=world` credits its
Gold but not its XP — one kill in thirty.

### `--report=gates` — min level for every boss gate

The fastest read on whether the enemy curve holds. Binary-searches the lowest level that clears
each gate (valid because damage rises monotonically with level).

```
bun run sim:hero-quest --report=gates
```
```
┌───────┬──────────────┬────────────────┬─────┐
│ world │ stage 5 boss │ stage 10 super │ gap │
├───────┼──────────────┼────────────────┼─────┤
│ 1     │ 20           │ 56             │ 36  │
│ 2     │ 77           │ 108            │ 31  │
│ 5     │ 249          │ 283            │ 34  │
│ 8     │ 401          │ 430            │ 29  │
│ 10    │ 496          │ 524            │ 28  │
└───────┴──────────────┴────────────────┴─────┘
Level to clear the game: 524
```

`gap` is levels between a world's two gates. **A flat gap is the design** — four levels per stage
(`LEVELS_PER_STAGE`) plus the super boss's extra HP, every world. A growing gap would mean the super
boss back-loads difficulty harder every world. With `--party=3` World 1's boss drops to level 1
and the game clears at 494. A world showing `unreachable` means the enemy curve outruns levelling
entirely at that prestige — the tool says so explicitly rather than hanging.

### `--report=classes` — all 16 side by side

Whether the three paths actually diverge, at one level and stage.

```
bun run sim:hero-quest --report=classes --level=20 --world=1 --stage=9
```
```
┌──────────────┬──────────┬────────┬────────┬────────┬────────┬─────────┐
│ class        │ tier     │ DPS    │ EHP    │ s/kill │ clear  │ verdict │
├──────────────┼──────────┼────────┼────────┼────────┼────────┼─────────┤
│ Sorcerer     │ master   │ 251.62 │ 164.41 │ 1.22   │ 36.5s  │ WIPE    │
│ Beast Master │ master   │ 185.64 │ 294.13 │ 1.65   │ 49.4s  │ CLEAR   │
│ Hunter       │ elite    │ 126.51 │ 294.13 │ 2.42   │ 1m 13s │ WIPE    │
│ ...          │          │        │        │        │        │         │
│ Paladin      │ master   │ 49.67  │ 438.27 │ 6.16   │ 3m 5s  │ CLEAR   │
│ Knight       │ elite    │ 42.48  │ 438.27 │ 7.20   │ 3m 36s │ CLEAR   │
│ Beginner     │ beginner │ 37.29  │ 294.13 │ 8.21   │ 4m 6s  │ WIPE    │
│ Warrior      │ base     │ 29.05  │ 380.61 │ 10.53  │ 5m 16s │ WIPE    │
└──────────────┴──────────┴────────┴────────┴────────┴────────┴─────────┘
```

Sorted by DPS. The multi-strike kits (Hunter ×3, Beast Master ×4, and now the Beginner's ×2)
move this column by construction — a kit property, not a stat one. Ability magnitudes are still
`// UNTUNED ╧`, so the spread between kits here is not yet a statement about balance.

### `--report=stats` — where every stat comes from

Every source on every unit, itemised, and **priced in stages of enemy curve** — the one common
denominator the game has. "×1.36 on this stat" is unanswerable; "worth 4 stages" compares directly
with the 100 stages a prestige loop costs. Rendered from `explain.ts`, the same structure the
in-game stat panel reads, so the two can never disagree.

```
bun run sim:hero-quest --report=stats --level=40
bun run sim:hero-quest --report=stats --party=3 --sweep-levels=1,20,50,200
```
```
Beginner  (Hero)
┌──────────┬──────┬──────┬───────────┬─────────────────────┬───────────────────────────┬───────┬────────┐
│ stat     │ tier │ base │ Level 40  │ Champion collection │ Gear / Skills / Artifacts │ final │ stages │
├──────────┼──────┼──────┼───────────┼─────────────────────┼───────────────────────────┼───────┼────────┤
│ Power    │ high │ 16   │ ×2.1178 ∞ │ ×1.0000             │ ×1.0000                   │ 33.88 │ 9.7    │
│ Luck     │ mid  │ 7.5  │ ×1.0000   │ ×1.0000             │ ×1.0000                   │ 7.50  │ 0.0    │
│ ...      │      │      │           │                     │                           │       │        │
└──────────┴──────┴──────┴───────────┴─────────────────────┴───────────────────────────┴───────┴────────┘
  Crit chance                  7.5%   lck 7.50 × 0.01 + modifiers
                                      ⚠ LCK is off the level curve — levelling will not move this

Pacing — the common denominator
  stat growth / level   ×1.019427
  enemy growth / stage  ×1.08
  → one level buys       0.50 stages
  → one 100-stage loop   200 levels
```

Two things the report says outright and are worth internalising:

- **Additive within a stage, multiplicative between stages.** Gear, Skill and Artifact lines sum as
  fractions before converting, so Gear +50% and a Skill +50% are ×2.00, not ×2.25. The report never
  shows per-source multipliers for the reader to multiply.
- **Only levels compound.** Every other source is a fixed multiplier on a moving number: it shifts a
  wall by a constant number of stages and then never helps again.

---

## Verdicts

| Verdict | Meaning |
|---|---|
| `CLEAR` | Kills it, survives it, and beats the timer if there is one. |
| `TIMER FAIL` | Survives fine, but the boss encounter (boss + escort) outlasts `BOSS_TIMER_SECONDS`. |
| `WIPE` | Dies before the clear lands. Checked before the timer — a wipe outranks a timer fail. |
| `STALLED` | The party cannot kill anything — `secondsPerKill` is not finite. |

`STALLED` used to be the common wall: enemy DEF reached `PWR × K`, damage clamped to exactly 0.
Since `MIN_DAMAGE = 1` floors every hit and hero PWR paces enemy DEF exactly, it now only appears
for a degenerate party (zero PWR). An outmatched party chips and wipes instead.

---

## Overriding constants

`--set` rewrites `constants.ts` **at load time**, in memory. Nothing on disk changes.

```bash
bun run sim:hero-quest --set=K=8
bun run sim:hero-quest --set=K=8,BASE_HP=200          # comma-separated
bun run sim:hero-quest --set=K=8 --set=BASE_HP=200    # or repeated
bun run sim:hero-quest --set=STAT_TIER_VALUES.high=20 # object members via dot
```

Active overrides are echoed in the header so output can't be mistaken for a baseline run:

```
class_beginner @ level 1 — prestige 0  [K=8]
```

**A name that matches nothing aborts the run.** This is deliberate — silently reporting
un-overridden numbers is worse than failing:

```
error: --set matched no constant: NOT_A_CONSTANT
```

Only numeric constants are overridable. Arrays like `GOLD_TENURE_CEILING` are not — edit those in
`constants.ts`, or for the tenure ceiling, regenerate it from `scripts/lib/economy-stages.ts`.

⚠ **Override the dial, not the derived value.** `STAT_PER_LEVEL_GROWTH`, `XP_STEP_EXPONENT`,
`LEVELS_PER_STAGE`, `ENEMY_HP_STEP_EXPONENT` and the rest of the derived set are computed from their
inputs when `constants.ts` loads. Move `STAT_PACE_RATIO`, `XP_PACE_SLACK`, `ENEMY_PACE_RATIO` or
`FIGHT_LENGTH_DRIFT` instead.

## Sweeping

```bash
bun run sim:hero-quest --sweep=K=8..32:8                    # from..to:step
bun run sim:hero-quest --sweep=K=8,16,32                    # explicit list
bun run sim:hero-quest --report=campaign --party=3 --sweep=FIGHT_LENGTH_DRIFT=0.2,0.35,0.5
```

Sweep tabulates the `world` walk by default and the `campaign` wall when `--report=campaign` is
passed — sweeping a pacing dial against where the run stops is the main use. Any other `--report`
value falls back to the world walk. It combines with `--class` / `--level` / `--prestige` /
`--party`, and with `--set`:

```bash
bun run sim:hero-quest --report=campaign --party=3 --set=XP_PACE_SLACK=0.9 --sweep=SUPER_BOSS_HP_MULT=7,9,12
```

sweeps the gate *against* that slack rather than against the file's. The swept pair is applied
last, so sweeping a name that `--set` also fixes lets the sweep win. Each point runs in its own
subprocess (Bun caches modules, so re-importing `constants.ts` with a different override in-process
would just hand back the first one). A campaign point takes a few seconds; a world point is near
instant — sweep wide and narrow down after.

Constants documented as a pair must be swept as a pair: `K` with `BASE_ENEMY_PWR`,
`BASE_ATTACK_INTERVAL_SECONDS` with `SKILL_BASE_COOLDOWN_SECONDS`, `XP_BASE_PER_KILL` with
`XP_TO_LEVEL_BASE`. The comment on each in `constants.ts` says why.

---

## Using it as a library

If a report doesn't fit, import the analysis directly and write your own:

```ts
import { analyzeStage, analyzeWorld, gateTable, makeHero, makeParty, minLevelForGate, compareClasses, SIM_MATURE_TENURE_DAYS }
    from './scripts/hero-quest/sim'

const hero = makeParty('class_hunter', 40, 3)
const report = analyzeStage(hero, 0, 3, 10, SIM_MATURE_TENURE_DAYS)
console.log(report.survivalRatio, report.verdict)

// Lowest level that clears World 5's super boss at prestige 2
console.log(minLevelForGate('class_hunter', 2, 5, 10))
```

| Export | Returns |
|---|---|
| `makeHero(classId, level, overrides?)` | `HeroSnapshot`, solo |
| `makeParty(classId, level, size, overrides?)` | `HeroSnapshot` with `size − 1` stand-in Champions |
| `analyzeStage(hero, prestige, world, stage, tenureDays)` | `StageReport` |
| `analyzeWorld(hero, prestige, world, levelUp?, tenureDays?)` | `WorldReport` — rows, end level, total time/gold, first blocker |
| `analyzeCampaign(hero, startPrestige?, options?)` | `CampaignReport` — per-world rows, forced grinds, the wall |
| `minLevelForGate(classId, prestige, world, stage, maxLevel?)` | `number \| null` |
| `minLevelToClear(hero, prestige, world, stage, fromLevel?, maxLevel?)` | `number \| null` — same search from a snapshot and a floor |
| `gateTable(classId, prestige, worlds?, party?)` | `GateRow[]` |
| `compareClasses(prestige, world, stage, level, party?)` | `ClassRow[]`, DPS-sorted |

`tenureDays` only moves the Gold column. Pass `SIM_MATURE_TENURE_DAYS` for a pure combat question.
Stat attribution is `explainStats(hero)` in `shared/utils/hero-quest/explain.ts`.

Note `--set` overrides do **not** apply when importing — they need the plugin registered before
`constants.ts` loads, which only the CLI does.

---

## Caveats

**Champions are stand-ins.** `--party=N` fields `N − 1` Champions that are **Common and
un-invested** (investment scalar 1), ride the Hero's level, carry one ability each, and are added
Tank first, then Damage, Support, Control, Damage. It measures what *slots* are worth, never what a
lucky pull or a levelled copy is worth — so `CHAMPION_INVESTMENT_PER_POINT`, the widest unmeasured
lever in combat, is exercised by nothing here.

**No Gear, Skills, Artifacts or collection passive.** They are built and in the game, but the walk
fields none of them. Every campaign number is a floor for an account that pulls.

**Party size is offence and survival both.** Offence pools PWR before dividing by enemy DEF
(`partyMitigation`), worth a constant `ln(N)/ln(1.08)` stages at every depth. Incoming damage
resolves one stream at a time against the front-most living unit, so a bigger party — and a Tank
in front — is also real survival time.

**Ability magnitudes are untuned.** The campaign walk measures a Beginner (whose kit is one
self-buff) plus stand-ins, so it barely touches the `SKILL_*` set. Settling those needs seeded
`fight.ts` fights across the class roster at a fixed depth, not this tool.

**Evasion is always 0.** Nothing sources EVA until Traits. The `1−EVA` term is wired and tested
but inert.

**62 constants are still `// UNTUNED ╧`.** `rg '╧' shared/utils/hero-quest/constants.ts` lists them.
`// TUNED ✓` values each carry a comment saying what they trade against — re-measure with the
campaign walk before and after moving one.

---

## Companion script

`bun run balance:hero-quest --table=<name>` covers the economy side:

| Table | Shows |
|---|---|
| `time-to-boss` | Time to reach each gate at a given prestige/world |
| `offline` | Offline accrual across cap and efficiency levels |
| `gold-curve` | Progression factor per prestige at mid-run, and the account age from which the tenure ceiling stops binding |
| `tenure` | The tenure ceiling at every rung against the platform curve, and until which prestige it binds |
| `attack-rate` | Attacks per second across SPD |
| `level-curve` | XP cost and stat growth by level |
| `bound` | The provable Gold/hour ceiling at the ten-year horizon, and headroom under `numeric(19,4)` |

`--tenure-days=` sets the account age the tables read Gold at (default ten years). The old
`--solve=prestige-gold` solver is gone with the table it fitted (`gold-economy.md` §3a).

`bun scripts/economy-compare.ts` places a keeping-pace Hero Quest account against Colony and Xeno at
equal account age — the staleness check for the generated ceiling.

Rough split: **sim** answers *"can I beat this fight"*, **balance** answers *"is the economy
sane"*. Tuning order: stat tiers → enemy base stats → `K` → `BASE_GOLD` → `GOLD_STEP_BASE`, because
each link feeds the next.
