# Combat Sim — Usage

`bun run sim:hero-quest` — the tuning workhorse for Hero Quest combat.

Every number it prints comes out of the shared pure functions (`shared/utils/hero-quest/combat.ts`,
`stats.ts`, `settle.ts`) — the same code the game runs. No formula is restated inside the tool,
so a result that looks wrong here is wrong in the game too.

**What it is not:** crit-averaged, matching how offline settle resolves (`idle-mechanics.md` §4).
There is no per-hit rolling, so there is no variance and no win rate. A verdict means *"wins on
expected values"*, not *"wins 60% of the time"*. Rolled, seeded fights are `fight.ts` — Phase 1.

---

## Quick start

```bash
bun run sim:hero-quest                    # World 1 walk, level 1, hero levels as it goes
bun run sim:hero-quest --report=gates     # min level for all 20 boss gates — the fastest read
bun run sim:hero-quest --sweep=K=1..4:0.5 # sweep a dial and tabulate the effect
```

---

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--report=` | `world` | `stage` · `world` · `campaign` · `gates` · `classes` |
| `--class=` | `class_beginner` | Any of the 16 class IDs. Bad IDs fail immediately. |
| `--level=` | `1` | Hero level. Starting level for `world`, fixed level for the others. |
| `--world=` | `1` | 1–10 |
| `--stage=` | `10` | 1–10. Used by `stage` and `classes`. |
| `--prestige=` | `0` | Adds 100 to the curve index — one prestige loop deeper. |
| `--party=` | `1` | Total units including the Hero. Champions are un-invested clones riding the Hero's level, so a measured party gain is a floor. Real parties run 3–6. |
| `--no-levelup` | off | `world` only — hold level fixed instead of levelling through the walk. |
| `--max-prestige=` | `10` | `campaign` only — prestiges to walk before giving up on finding a wall. |
| `--grind-hours=` | `24` | `campaign` only — farming allowed per blocked stage before it counts as a wall. |
| `--max-level=` | `5000` | `campaign` only — level-search ceiling. Past this, a stage reads as unclearable. |
| `--set=` | — | Override a constant for this run. Repeatable. |
| `--sweep=` | — | Sweep a constant across a range. |
| `--json` | off | Machine-readable output. |

---

## The five reports

### `--report=stage` — one stage in detail

Everything about a single fight: can you kill it, how fast, and do you survive doing so.

```
bun run sim:hero-quest --report=stage --world=1 --stage=10 --level=14
```
```
class_beginner @ level 14 — prestige 0
World 1, stage 10 — super_boss

  party DPS              8.74
  enemy EHP            316.61   DEF 17.59
  time to kill          36.2s   vs 30s timer  FAIL
  margin               -20.7%

  incoming DPS          13.76
  hero EHP                330
  time to die           24.0s
  must survive          36.2s   (whole boss fight)
  survival               0.7x

  verdict                WIPE
```

`survival` is the number to watch: `time to die / must survive`. Below `1.0x` is a wipe; `2.0x`
means twice the HP you need. It separates *"can't kill it fast enough"* from *"dies trying"* —
two problems with completely different fixes.

### `--report=world` — the full ten-stage walk

Default report. Feeds each stage's XP back in before the next, so it projects a real playthrough
rather than a frozen snapshot. Pass `--no-levelup` to see one power level's reach instead.

```
bun run sim:hero-quest --world=1
```
```
┌───────┬────────────┬─────┬──────────┬───────────┬───────────┬────────┬───────┬────────┬──────────────┬──────────┬─────────┐
│ stage │ type       │ lvl │ enemy HP │ enemy DEF │ party DPS │ s/kill │ kills │ clear  │ timer margin │ survival │ verdict │
├───────┼────────────┼─────┼──────────┼───────────┼───────────┼────────┼───────┼────────┼──────────────┼──────────┼─────────┤
│ 1     │ wave       │ 1   │ 30       │ 5         │ 3.15      │ 9.52   │ 30    │ 4m 46s │ —            │ 12.6x    │ CLEAR   │
│ 4     │ wave       │ 7   │ 45.63    │ 7.60      │ 6.05      │ 7.54   │ 30    │ 3m 46s │ —            │ 14.4x    │ CLEAR   │
│ 5     │ boss       │ 9   │ 104.94   │ 8.75      │ 7.18      │ 14.62  │ —     │ 14.6s  │ +51.3%       │ 4.8x     │ CLEAR   │
│ 6     │ elite      │ 9   │ 81.46    │ 13.58     │ 5.91      │ 13.79  │ 30    │ 6m 54s │ —            │ 3.4x     │ CLEAR   │
│ 9     │ elite      │ 13  │ 123.89   │ 20.65     │ 6.96      │ 17.80  │ 30    │ 8m 54s │ —            │ 1.8x     │ CLEAR   │
│ 10    │ super_boss │ 14  │ 316.61   │ 17.59     │ 8.74      │ 36.22  │ —     │ 36.2s  │ -20.7%       │ 0.7x     │ WIPE    │
└───────┴────────────┴─────┴──────────┴───────────┴───────────┴────────┴───────┴────────┴──────────────┴──────────┴─────────┘
Total: 48m 52s   level 1 → 14   gold 1,485
First blocker: stage 10 — WIPE
```

*(rows 2, 3, 7, 8 trimmed here for width — the real output prints all ten.)*

Watch for the **DPS drop crossing stage 5→6**: `ELITE_STAT_MULT` raises enemy DEF and mitigation
is DEF-relative, so party DPS falls even though the hero got stronger. The elite band is a real
difficulty step, not just a stat bump.

### `--report=campaign` — stages, worlds and prestiges until something stops you

`world` gives up at its first blocker. `campaign` doesn't: a failed stage sends the run back to
farm — the soft-fail rule — and it keeps walking, world after world, prestige after prestige,
until farming stops working. **That stopping point is the output.** Everything above it is
context for it.

```bash
bun run sim:hero-quest --report=campaign
bun run sim:hero-quest --report=campaign --grind-hours=100 --max-prestige=3
```
```
┌───┬───────┬─────────┬─────────┬─────────┬──────────┬────────┬────────┐
│ P │ world │ lvl     │ fights  │ grind   │ blockers │ gold   │        │
├───┼───────┼─────────┼─────────┼─────────┼──────────┼────────┼────────┤
│ 0 │ 1     │ 1 → 17  │ 48m 43s │ 23m 49s │ 1        │ 2,150  │        │
│ 0 │ 2     │ 17 → 29 │ 37m 19s │ 3h 10m  │ 1        │ 7,397  │        │
│ 0 │ 3     │ 29 → 44 │ 34m 55s │ 17h 53m │ 2        │ 44,519 │        │
│ 0 │ 4     │ 44 → 51 │ 28m 49s │ 18h 59m │ 2        │ 66,380 │ ← WALL │
└───┴───────┴─────────┴─────────┴─────────┴──────────┴────────┴────────┘

Forced grinds
┌──────────┬────────────┬────────┬─────────┬───────┬─────────┐
│ at       │ blocked by │ farmed │ lvl     │ kills │ time    │
├──────────┼────────────┼────────┼─────────┼───────┼─────────┤
│ P0 W1S10 │ WIPE       │ W1S9   │ 14 → 17 │ 90    │ 23m 49s │
│ P0 W3S10 │ WIPE       │ W3S9   │ 33 → 44 │ 3,332 │ 16h 20s │
│ P0 W4S9  │ WIPE       │ W4S8   │ 45 → 51 │ 4,294 │ 17h 56m │
└──────────┴────────────┴────────┴─────────┴───────┴─────────┘

GRIND WALL — clearable, but not in the time budget
  at             P0 W4S10 (super_boss)
  hero level     51   needs 62
  why            needs level 62 (from 51) — 3.3d of farming W4S9, over the 1.0d budget

Reached: 0 prestige(s) completed, level 1 → 51
Time:    1d 19h total — 2h 30m fighting, 1d 16h grinding
```

`fights` vs `grind` is the number to read. Once grind dwarfs fights, the world is no longer
being played — it's being waited out.

**Three walls, three different fixes:**

| Wall | Meaning | Dial |
|---|---|---|
| `GRIND WALL` | Clearable, but the farming exceeds `--grind-hours`. | Pacing: XP curve, `STAT_PER_LEVEL_*`, enemy bases |
| `UNCLEARABLE` | No level inside `--max-level` clears it — usually DEF hitting `PWR × K`, the `STALLED` verdict. | Math: `K`, stat growth model |
| `UNFARMABLE` | Nowhere left to earn XP. Means the real wall is already behind you. | — |

`NO WALL` means the run finished `--max-prestige` loops without getting stuck; raise it to keep
walking.

Two things to know before trusting a grind number. **Farming is modelled at the deepest
clearable stage**, matching where a stuck player actually stands. That used to understate the
grind, back when XP and enemy HP rode separate bases and XP/second decayed with depth; since
both now ride the same index (`XP_STEP_EXPONENT`), farming shallower buys nothing and the
deepest stage is also the right one. And a boss counts as one kill for both Gold and XP here,
where `--report=world` credits its Gold but not its XP; the difference is one kill in thirty and
shows up nowhere but the last decimal.

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
│ 1     │ 4            │ 17             │ 13  │
│ 2     │ 9            │ 29             │ 20  │
│ 5     │ 45           │ 86             │ 41  │
│ 8     │ 137          │ 267            │ 130 │
│ 10    │ 314          │ 633            │ 319 │
└───────┴──────────────┴────────────────┴─────┘
Level to clear the game: 633
```

`gap` is levels between a world's two gates. A growing gap means the super boss back-loads
difficulty harder every world. A world showing `unreachable` means the enemy curve outruns
levelling entirely at that prestige — the tool says so explicitly rather than hanging.

### `--report=classes` — all 16 side by side

Whether the three paths actually diverge, at one level and stage.

```
bun run sim:hero-quest --report=classes --level=20 --world=1 --stage=9
```
```
┌──────────────┬──────────┬───────┬─────┬────────┬────────┬─────────┐
│ class        │ tier     │ DPS   │ EHP │ s/kill │ clear  │ verdict │
├──────────────┼──────────┼───────┼─────┼────────┼────────┼─────────┤
│ Beast Master │ master   │ 98.16 │ 390 │ 1.26   │ 37.9s  │ CLEAR   │
│ Hunter       │ elite    │ 73.62 │ 390 │ 1.68   │ 50.5s  │ CLEAR   │
│ Sorcerer     │ master   │ 30.91 │ 300 │ 4.01   │ 2m 0s  │ CLEAR   │
│ ...          │          │       │     │        │        │         │
│ Knight       │ elite    │ 13.75 │ 490 │ 9.01   │ 4m 30s │ CLEAR   │
└──────────────┴──────────┴───────┴─────┴────────┴────────┴─────────┘
```

Sorted by DPS. The multi-strike kits (Hunter ×3, Beast Master ×4) dominate this column by
construction — worth remembering that's a kit property, not a stat one.

---

## Verdicts

| Verdict | Meaning |
|---|---|
| `CLEAR` | Kills it, survives it, and beats the timer if there is one. |
| `TIMER FAIL` | Survives fine, but the boss outlasts `BOSS_TIMER_SECONDS`. |
| `WIPE` | Dies before the kill lands. Checked first — a wipe outranks a timer fail. |
| `STALLED (0 dmg)` | Enemy DEF reached `PWR × K`, mitigation clamped to 100%, damage is exactly 0. |

`STALLED` is not a bug. It's the clamped-ratio formula working: enemy DEF rides the same
exponential as everything else, so a hero who stops levelling eventually deals literal zero.

---

## Overriding constants

`--set` rewrites `constants.ts` **at load time**, in memory. Nothing on disk changes.

```bash
bun run sim:hero-quest --set=K=3
bun run sim:hero-quest --set=K=3,BASE_HP=200          # comma-separated
bun run sim:hero-quest --set=K=3 --set=BASE_HP=200    # or repeated
bun run sim:hero-quest --set=STAT_TIER_VALUES.high=20 # object members via dot
```

Active overrides are echoed in the header so output can't be mistaken for a baseline run:

```
class_beginner @ level 9 — prestige 0  [K=3]
```

**A name that matches nothing aborts the run.** This is deliberate — silently reporting
un-overridden numbers is worse than failing:

```
error: --set matched no constant: NOT_A_CONSTANT
```

Only numeric constants are overridable. Arrays like `PRESTIGE_GOLD_FACTOR` are not — edit those
in `constants.ts`, or regenerate them with `bun run balance:hero-quest --solve=prestige-gold`.

## Sweeping

```bash
bun run sim:hero-quest --sweep=K=1..4:0.5     # from..to:step
bun run sim:hero-quest --sweep=K=1,2,4        # explicit list
bun run sim:hero-quest --report=campaign --sweep=ENEMY_CURVE_T=5,50,242,1000
```
```
Sweeping K over 4 values — world 1, levelling
┌───┬─────────┬─────────┬────────────┬──────┬─────────────┬───────┬───────────────┐
│ K │ W clear │ end lvl │ boss clear │ boss │ super clear │ super │ first blocker │
├───┼─────────┼─────────┼────────────┼──────┼─────────────┼───────┼───────────────┤
│ 1 │ 2h 57m  │ 14      │ 21.5s      │ PASS │ 1m 35s      │ WIPE  │ stage 9       │
│ 2 │ 48m 52s │ 14      │ 14.6s      │ PASS │ 36.2s       │ WIPE  │ stage 10      │
│ 3 │ 40m 57s │ 14      │ 13.2s      │ PASS │ 30.0s       │ WIPE  │ stage 10      │
│ 4 │ 37m 57s │ 14      │ 12.6s      │ PASS │ 27.7s       │ WIPE  │ stage 10      │
└───┴─────────┴─────────┴────────────┴──────┴─────────────┴───────┴───────────────┘
```

Sweep tabulates the `world` walk by default and the `campaign` wall when `--report=campaign` is
passed — sweeping `ENEMY_STEP_BASE` against where the run stops is the enemy-curve slider from
`open-items.md` #10. Any other `--report` value falls back to the world walk. It combines with
`--class` / `--level` / `--prestige`, and with `--set`:

```bash
bun run sim:hero-quest --report=campaign --set=XP_TO_LEVEL_GROWTH=1.2 --sweep=SUPER_BOSS_HP_MULT=3,6,12
```

sweeps the gate *against* that XP curve rather than against the file's. The swept pair is applied
last, so sweeping a name that `--set` also fixes lets the sweep win. It
runs each point in its own subprocess (Bun caches modules, so re-importing `constants.ts` with a
different override in-process would just hand back the first one). It's cheap — a 7-point sweep
finishes in about half a second — so sweep wide and narrow down after.

The example above is worth reading as a lesson: `K` moves the super-boss clear from 95s to 27.7s
and the verdict *never changes*. That's a survivability problem, and `K` is the wrong dial for it.

---

## Using it as a library

If a report doesn't fit, import the analysis directly and write your own:

```ts
import { analyzeStage, analyzeWorld, gateTable, makeHero, minLevelForGate, compareClasses }
    from './scripts/hero-quest/sim'

const hero = makeHero('class_hunter', 40)
const report = analyzeStage(hero, 0, 3, 10)
console.log(report.survivalRatio, report.verdict)

// Lowest level that clears World 5's super boss at prestige 2
console.log(minLevelForGate('class_hunter', 2, 5, 10))
```

| Export | Returns |
|---|---|
| `makeHero(classId, level, overrides?)` | `HeroSnapshot` |
| `analyzeStage(hero, prestige, world, stage)` | `StageReport` |
| `analyzeWorld(hero, prestige, world, levelUp?)` | `WorldReport` — rows, end level, total time/gold, first blocker |
| `analyzeCampaign(hero, startPrestige?, options?)` | `CampaignReport` — per-world rows, forced grinds, the wall |
| `minLevelForGate(classId, prestige, world, stage, maxLevel?)` | `number \| null` |
| `minLevelToClear(hero, prestige, world, stage, fromLevel?, maxLevel?)` | `number \| null` — same search from a snapshot and a floor |
| `gateTable(classId, prestige, worlds?)` | `GateRow[]` |
| `compareClasses(prestige, world, stage, level)` | `ClassRow[]`, DPS-sorted |

Types exported alongside: `StageReport`, `WorldReport`, `CampaignReport`, `CampaignOptions`,
`CampaignWall`, `CampaignWorldRow`, `GrindEvent`, `GateRow`, `ClassRow`, `Verdict`, `WallReason`.

Note `--set` overrides do **not** apply when importing — they need the plugin registered before
`constants.ts` loads, which only the CLI does.

---

## Caveats

**Survivability rests on an undefined rule.** No design doc covers whether HP carries between
kills within a wave stage, or regenerates. The tool takes the optimistic reading: the survival
window is one kill for wave stages, the whole fight for bosses. If HP actually persists across
all 30 kills with no regen, **every wave-stage survival number here is optimistic.** Phase 1 has
to settle this.

**No Champion roster, no gear, no traits.** Gear (Phase 3) and Traits (Phase 4) change combat and
neither exists. Champions exist only as a *shape*: `--party=N` fields un-invested clones of the
Hero, which is enough to measure what party size is worth but says nothing about archetype spreads
or real Champion power — those are Phase 2.

**Party size is an offensive lever only.** Incoming damage and HP are both summed across the party,
so time-to-die is party-size-invariant and Champions add no survivability. A bigger party helps a
`WIPE` only by shortening the fight.

**Evasion is always 0.** Nothing sources EVA until Traits. The `1−EVA` term is wired and tested
but inert.

**Numbers rest on ~31 untuned constants.** Anything marked `// UNTUNED ╧` in `constants.ts` is a
placeholder, not a decision. `rg '╧' shared/utils/hero-quest/constants.ts` lists them. This tool
is how they get real values — sweep a dial, read the effect, fill it in.

---

## Companion script

`bun run balance:hero-quest` covers the economy side — Gold curves, offline accrual, the
Gold/hour ceiling, and `--solve=prestige-gold` which fits `PRESTIGE_GOLD_FACTOR[]` to
`gold-economy.md` §3's calendar anchors and prints a paste-ready array.

Rough split: **sim** answers *"can I beat this fight"*, **balance** answers *"is the economy
sane"*. Tune in the order the plan sets out — stat tiers → enemy base stats → `K` → `BASE_GOLD` →
`PRESTIGE_GOLD_FACTOR` — because each link feeds the next.
