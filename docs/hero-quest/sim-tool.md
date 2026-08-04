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
| `--report=` | `world` | `stage` · `world` · `gates` · `classes` |
| `--class=` | `class_beginner` | Any of the 16 class IDs. Bad IDs fail immediately. |
| `--level=` | `1` | Hero level. Starting level for `world`, fixed level for the others. |
| `--world=` | `1` | 1–10 |
| `--stage=` | `10` | 1–10. Used by `stage` and `classes`. |
| `--prestige=` | `0` | Feeds `5^prestige` into the enemy curve. |
| `--no-levelup` | off | `world` only — hold level fixed instead of levelling through the walk. |
| `--set=` | — | Override a constant for this run. Repeatable. |
| `--sweep=` | — | Sweep a constant across a range. |
| `--json` | off | Machine-readable output. |

---

## The four reports

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

Sweep always reports against `--world`, combines with `--class` / `--level` / `--prestige`, and
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
| `minLevelForGate(classId, prestige, world, stage, maxLevel?)` | `number \| null` |
| `gateTable(classId, prestige, worlds?)` | `GateRow[]` |
| `compareClasses(prestige, world, stage, level)` | `ClassRow[]`, DPS-sorted |

Types exported alongside: `StageReport`, `WorldReport`, `GateRow`, `ClassRow`, `Verdict`.

Note `--set` overrides do **not** apply when importing — they need the plugin registered before
`constants.ts` loads, which only the CLI does.

---

## Caveats

**Survivability rests on an undefined rule.** No design doc covers whether HP carries between
kills within a wave stage, or regenerates. The tool takes the optimistic reading: the survival
window is one kill for wave stages, the whole fight for bosses. If HP actually persists across
all 30 kills with no regen, **every wave-stage survival number here is optimistic.** Phase 1 has
to settle this.

**No party, no gear, no traits.** Phase 0 is a solo Hero. Champions (Phase 2), Gear (Phase 3) and
Traits (Phase 4) all change combat and none exist yet. `partyDps` sums a list that is currently
length 1.

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
