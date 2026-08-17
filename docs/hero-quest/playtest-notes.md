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

| Prediction | Value |
|---|---|
| **Grind wall** | P2 W8S6 (elite) — level 1,025, needs 1,039 |
| Why it stalls | 1.1 days farming W8S4, against a 1.0-day budget |
| Prestiges reached | 2 |
| Hero level, start → end | 1 → 1,025 |
| Total time | 3d 13h — 2h 2m fighting, 3d 11h grinding |
| Gold earned | 91,572,455 |
| Live Gold/hr from W1S1 | 2.46K (8.28s/kill) |
| One-hour settle from a fresh account | reaches level 24, blocked at a boss |

**The single most valuable data point in a session is reaching P2 W8S6 and seeing whether it walls where and how the sim says.** If it feels *worse* than projected, the other power sources — Champions, Gear, Skills, Artifacts — are not carrying what the model thinks they carry, which is a larger finding than any individual constant.

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
- The gacha pages are very cluttered at the moment. Move all gacha's to one gacha page and place them in a 2x2 square 
