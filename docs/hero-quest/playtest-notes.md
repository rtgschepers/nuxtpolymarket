# Playtest Notes

**Raw capture. Not a design doc — nothing here is decided.**

This is where observations land while playing, in whatever shape they arrive. They get distilled into `open-items.md` afterwards: model findings against the constants they move, presentation findings into the requirements list for the Pixi battle scene. Keeping the two files separate is the point — three months from now, `open-items.md` will say *what* changed and this will say *why it felt wrong*, which is the half that normally gets lost.

Append freely. Nothing here needs to be tidy, sorted, or complete.

---

## How to write an entry

Position, hero level, what you noticed. That's the whole format.

```
W3S4, ~level 180 — sat here 40 min, no idea what would break it
P1W5 — pulled a Mythic and the next two worlds were a walkover
Forge — couldn't tell which of two pieces was better
```

**Don't pre-sort.** You should not have to hold a taxonomy in your head while playing. Sorting happens later.

---

## Two buckets (for the distilling pass, not for you)

**Model findings survive the renderer untouched.** Kills per stage, whether hero level keeps pace with the ceiling, where walls land, whether a Mythic trivialises a stretch, whether you can afford to pull, whether a maxed Skill is numerically felt. `tech-architecture.md` §7 makes this structural, not incidental — the Pixi scene "renders, it never decides." Nearly all ~99 `// UNTUNED ╧` constants live here, and this is the entire reason playtesting on placeholder presentation is worth doing.

**Presentation findings are provisional but still worth capturing.** Whether the wipe loop reads as "you are too weak here", whether `1 damage` misleads, whether the screen ever says what would break a wall. These genuinely will change under a real battle scene — so they do not feed tuning. They feed **the spec for `BattleCanvas.vue`**, and they are far more accurate written during the confusion than reconstructed later.

`asset-list.md`'s own phase 0–1 row already anticipates this: *"even 1–2 of the 16 node appearances is enough to validate the loop before committing to all 80 spritesheets."* Playing against placeholder chrome is the sequencing the project chose, not a compromise being made.

---

## Falsifiable predictions to check against

The campaign sim (`bun run sim:hero-quest --report=campaign`) projects the run below. It projects *what the formulas say* — the value of playing is finding where lived experience departs from it.

**Current, after the session-1 HP change.** Run both — the solo figure is what a brand-new account experiences, and the two now diverge sharply.

| Prediction | Solo Hero (`--party=1`) | Party of 3 (`--party=3`) |
|---|---|---|
| **Grind wall** | P1 W1S6 (elite) | P2 W2S6 (elite) |
| Level at the wall | 410, needs 427 | 808, needs 825 |
| Prestiges reached | 1 | 2 |
| Total time | 3d 6h — 1h 9m fighting | 4d 14h — 49m fighting |
| Gold earned | 19,481,007 | 61,518,656 |
| Live Gold/hr from W1S1 | 2.46K (8.28s/kill) | — |
| One-hour settle, fresh account | reaches level 24, blocked at a boss | — |

**Pre-session-1 baseline, for comparison:** P2 W8S6, level 1,025, 2 prestiges, 3d 13h, 91.6M Gold solo — and P4 W3S6, level 1,567, 4 prestiges with a party. The HP cut roughly halved the run at both ends. That was the accepted price of making damage matter; **whether it reads as "tense" or "truncated" is the single most important thing to judge in session 2.**

**The most valuable data point is reaching the wall and seeing whether it walls where and how the sim says.** If it feels *worse* than projected, the other power sources — Champions, Gear, Skills, Artifacts — are not carrying what the model thinks they carry, which is a larger finding than any individual constant.

---

## The four questions Phase 1 exists to answer

From `implementation-plan.md`. Not a checklist to work through — just what to stay alert to.

1. **Does `ENEMY_STEP_BASE = 1.08` feel right?** The shape is settled; the value is not. Watch especially for the consequence nobody has felt yet: **there is no prestige difficulty reset any more.** P2 W1S1 is harder than P1 W10S10, continuously. Does the run keep a rhythm — push, wall, farm, break through — or is it one flat grind?
2. **Can a persistent, uncapped hero level keep pace with a ×T-per-prestige ceiling?** `classes-and-combat.md` §4 says flat-additive growth provably cannot on its own. Either the other power sources carry it, or the level curve has to change.
3. **Is boss-gating-requires-presence tolerable?** Prestige currency can never be earned offline, by design. Anticipation, or chore?
4. **Is 30 kills × 100 stages the right run length?**

Plus the two already queued in `open-items.md` §🔬: whether a Mythic is too far ahead of a Common (three compounding payoffs now ride one rarity roll, and only the ×2.5 was ever signed off), and whether the slow wall reads better than a hard one.

And three things Phase 3 shipped that nobody has ever felt: **Skill potency** (×2.18 at 5★/Lv10 — is levelling a Skill visible at all?), **reflect** (inert until Phase 3 wired it — does Guardian's Reflect now do anything?), and **whether you can actually afford to pull** against real income.

---

## Known-inert — not bugs, don't chase

- **`controlResist` does nothing.** Unshaken, Unbreakable Will and Immortal Vanguard are declared against a real modifier kind, but `EnemyStats` is HP/PWR/DEF and enemies have no abilities — there is no control to resist. Goes live the day enemy kits do.
- **Six effects are flat approximations.** Ramping-over-a-fight buffs (Momentum, Steady Ground, Flow State, Compound Interest) render flat because the idle rate is one frozen average per window with no "later in the fight". On-kill and once-per-fight procs (Lucky Dig, Windfall, Unbroken, Bulwark's Legacy) become rates.
- **Names are placeholders** — all 48 Artifacts, all 10 Worlds, and every enemy. World design has not happened. Do not evaluate flavour; do note if a *mechanic* is unreadable without it.
- **Presentation is placeholder chrome**, not the intended Pixi 8 canvas (`tech-architecture.md` §7).

---

## Harness shortcuts worth using

`/hero-quest/dev` (development builds only). Three comparisons it makes nearly free:

1. **Skip 8h offline, then 8h online.** That difference *is* the offline cap and the efficiency tax. Punishing enough to matter, or so small the shop track is pointless?
2. **Unlock everything at 0★/Lv1, then at 5★/Lv10.** The full `(star × 10 + level)` investment curve in two clicks. The top of it has never been observed.
3. **Wipe and replay the first hour.** Once you have seen the endgame the opening reads completely differently — and it is the only part of the game you normally get one shot at.

---

## Session log

<!--
Append below. Newest session at the bottom. Anything goes.
-->

### Session 1 — 2026-08-17
- Player health feels absurdly large compared to other stats from both the hero and enemies, especially because I haven't taken a single point of damage in 3 worlds. Can be lowered by a factor of 20.
- Hero level progression pace feels like, but the numbers feel a bit high. Lower everything by a factor of 10.
- I currently start out with 1 gacha pull for each gacha (I guess this resets daily to one). I want the players to 
  start out with enough seals for a 10-pull
- The gacha pages are very cluttered at the moment. Move all gacha's to one gacha page and place them in a 2x2 
  square. Also for each gacha add an information icon which shows its specific drop rates for all level when clicked.
- Collections should be moved to a generic collections page with a submenu per collection. There each collection 
  should firstly be sorted by rarity, then archetype. Add filters where it makes sense.
- A new player currently has no idea what each skill of stat means. Add more information icons, and also definitely 
  add a wiki page like some other games have.
- In the collections, instead of the word dupes add a small progress bar

#### Decisions taken on the above — 2026-08-17

Resolved item by item rather than assumed. Where a decision goes against something already written down, that is called out, because #1 and #2 both do.

**1 — HP. ✅ Applied.** `HP_PER_VIT` 200 → 10 **and `BASE_HP` 100 → 2000.** The second constant was not requested and is what makes the first one safe.

The sim confirmed the observation outright and then blocked the naive fix:

- **The complaint is real and larger than reported.** `HP_PER_VIT` at 100 and at 200 produce byte-identical campaigns — same wall, same level, same prestige count, solo *and* with a party. The top half of the old value was doing nothing whatsoever.
- **A straight cut breaks a fresh account.** Phase 1's derivation still reproduces: at `HP_PER_VIT` 10 with `BASE_HP` at 100, a level-1 solo Hero cannot clear World 1 Stage 1 and the run is unfarmable from the first screen. A new account *is* solo, so this was a hard blocker rather than a theoretical one.
- **`BASE_HP` resolves it because it is flat.** It dominates at level 1 and is arithmetic noise once VIT has compounded — a party of 3 walls at exactly P2 W2S6 / level 808 for every value from 1000 to 8000. So it carries the opening while `HP_PER_VIT` governs everything after. Phase 1 could not see this split because it was tuning a solo Hero, where the two ends are the same number.

Chosen over the two safer options at `BASE_HP` 2000: `HP_PER_VIT` 25 (3 prestiges, 3d 7h) and 50 (3 prestiges, 2d 22h). Both remain available if ÷20 proves too punishing.

Also still true and worth re-checking in play: mitigation is `min(1, DEF / (PWR × K))` with damage floored at `MIN_DAMAGE`, so **if the party has clamped to 100% mitigation, enemies deal 1 per hit regardless of pool size** and no HP change addresses it. The sim says HP was genuinely the binding issue here, but that is a model result — confirm it by actually taking damage next session.

**Four specs broke and were repaired rather than re-pinned.** Three encoded party durability against the old HP (`fight.spec` needed level 80 rather than 30 to reach the boss timer without wiping; `settle.spec`'s elite gate needed 80 rather than 40; the "unreachable wipe" threshold came from 1000 stage clears to 100, with the level-200 fixture kept). The fourth was more interesting: `applyXp`'s remainder spec hard-coded an overshoot of 25, which was a quarter of a level at `XP_TO_LEVEL_BASE` 100 and **more than two whole levels** at 10 — it had been asserting "overshoot by a bit" while supplying something else entirely, and only passed because the two coincided at the original base. It is now expressed as a fraction of the level's own price and survives any future re-denomination.

**2 — XP. ✅ Applied.** `XP_TO_LEVEL_BASE` 100 → 10 and `XP_BASE_PER_KILL` 10 → 1. A pure re-denomination: level pace, level count and wall position are all set by the *ratio* of the two, so dividing both is provably neutral. Confirmed empirically as well as on paper — the post-change campaign lands on exactly the levels (410 solo, 808 party) that the HP sweep produced while still running the old XP constants.

**Rejected: lowering `XP_TO_LEVEL_GROWTH`.** It was the intuitive lever and it is the wrong one — cheaper levels mean *more* levels, so it works against the stated goal. Swept, campaign report:

| `XP_TO_LEVEL_GROWTH` | Wall | Level | Prestiges | Grind |
|---|---|---|---|---|
| 1.16 (current) | P2 W8S6 | 1,025 | 2 | 3d 11h |
| 1.12 | P3 W2S6 | 1,185 | 3 | 5d 9h |
| 1.08 | P3 W10S6 | 1,505 | 3 | 9d 17h |
| 1.06 | P4 W7S6 | 1,785 | 4 | 11d 9h |

`XP_STEP_EXPONENT` is derived from the growth and compensates for XP *income*, not for the level count — which is why the pace does not self-preserve here. Worth keeping: the sweep also shows lower growth buys 4 prestiges instead of 2 out of the same curve, so it is a real lever for *run length* if that ever becomes the question.

**3 — Free pulls.** `SEAL_GRANT_AMOUNT` 1 → 9, so the daily grant is a free 10-pull (a 10-pull costs 9). Plus **2 further free 10-pulls per day per gacha**, as a true entitlement that must be spent as a 10-pull rather than as bankable Seals, unlocking on a 30-minute cooldown after each claim. Needs its own column and clock; the lazy-grant pattern in `dueSealGrants` is the shape to follow, so no cron.

⚠ **Consequence to watch next session:** this takes a gacha from 1 pull/day to 9 Seals plus 30 free pulls/day — around 120× the pull volume, ×4 systems. The collection curve, Essence income and crafting economy all move with it.

**4 — Gacha pages.** All four collapse to one page, 2×2. Each gets an info icon opening its drop rates across all 10 gacha levels.

**5 — Collections.** Own page with a submenu per collection. Sorted rarity **low→high**, then the system's own second axis (`archetype` for Champions, `slot` for Gear, active/passive for Skills, `category` for Artifacts). Unowned stay inline as locked `???`. Filters where they make sense. **Equipping moves here** — each collection shows its equipped slots above the grid, which is what frees the gacha page to be pull-only.

**6 — Wiki.** Static explainer (stats, damage/mitigation/crit, currencies, gacha/dupe/star, prestige) *plus* a reference section generated from the content modules, so it cannot go stale while ~99 constants are still moving.

**7 — Dupes.** Progress bar with the count inside it, replacing the word.
