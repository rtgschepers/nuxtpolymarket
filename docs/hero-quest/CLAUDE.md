# Hero Quest — Implementation Brief

Hero Quest is an idle auto-battler shipping as a **vertical slice inside polynux**. Design is complete and locked across 19 documents in `docs/hero-quest/`. Implementation has not started.

Platform conventions (Nuxt 4, Vue, Bun, Postgres/Drizzle, vitest, code style, slice layout) are **inherited from the platform and its root guidance — this file does not restate them.** What follows is only what's specific to Hero Quest.

---

## 1. Read this much, and no more

**Never load all 19 docs.** They cross-reference heavily, which is an asset when scoped and a liability otherwise — a full load reliably produces attempts to build systems four phases early.

Per task, load:

1. `implementation-plan.md` — build order, and the deferred list for the current phase
2. `index.md` — topic → doc/§ lookup; use it to fetch *sections*, not whole files
3. The 2–4 docs owning the system being built
4. `open-items.md` — before implementing anything numeric or contested

`tech-architecture.md` (337 lines) is the biggest doc and is section-addressable. Fetch §3 for schema, §5 for routes, §2 for the shared layer — not the whole file.

---

## 2. Precedence when docs disagree

The docs were written across many sessions and revised in place. Conflicts exist. Resolve in this order:

| Question | Authority |
|---|---|
| Is this decided, or still open? | `open-items.md` — always. It is the freshest doc in the project. |
| How is it built (schema, routes, types, layering)? | `tech-architecture.md` |
| What is the rule / formula / number? | The owning system doc, per `index.md` §1 |
| What order do we build in, what's deferred? | `implementation-plan.md` |

**If a doc disagrees with `tech-architecture.md` §9, §9 wins** — that section is the running record of design consequences forced by the architecture, and it lists which cross-doc edits were applied.

**Never silently reconcile a contradiction.** Stop and surface it. Every past contradiction in this project was resolved by a deliberate decision, not by an implementer picking one.

---

## 3. Invariants — do not break these without asking

These are load-bearing and easy to violate by accident.

**Server authority.** All combat resolves server-side. The client is strictly an animation player driven by shared deterministic sim code and a seed. Gold and Gems are *shared balances across all polynux games* — the server never trusts a client-claimed earning or outcome. No exceptions for "just this one UI-only case."

**No background workers, no cron, no intervals.** Progress accrues via lazy settle (`settleHq`) called from `state.get.ts` and from every mutation that depends on accrued progress. Row lock is the mutex. If a feature seems to need a scheduled job, it doesn't — re-read `tech-architecture.md` §4a.

**Nothing numeric at a call site.** Every constant lives in `shared/utils/hero-quest/constants.ts` as a named export. This is what makes the balance script and playtest tuning a one-file edit. A magic number in `combat.ts` is a bug even if the value is correct.

**Big numbers are Decimal end to end.** `break_eternity.js` is the only new dependency this game adds. Enemy multipliers, stats, damage, HP, `heroXp`, and **Void Shards** are Decimal, persisted as `text` columns — Postgres `numeric` cannot hold `5^1000`, and the DB never does math on these. Safely plain integers: gacha levels, star/level, slot counts, shop levels, prestige count, Seal/Essence/Medal balances.

**`shared/` is pure.** No DB access, no auth, no `#server` imports. It runs in the browser. Both sides import it; only the server applies anything.

**Stable string IDs, never indices.** `champ_kaira`, `skill_coin_toss`, `world_the_void`. DB rows and loadouts reference IDs only. Reordering a content array must never change a save.

**Manual cast mode does not exist.** Every skill on every unit auto-fires the instant its cooldown completes. No toggle, no tap-to-fire, no ready-and-waiting state, no `manualMode` field. If you find a doc reference to a cast toggle, it is stale — flag it.

**One `hqCollection` table** for all four gachas, with a `system` enum over `contentId`. `applyDupe()`, `levelUp()`, and `craft()` are each written once and take `system` as an argument. Do not write per-gacha duplicates.

---

## 4. Untuned constants — the trap

Roughly 30 named constants have a **locked formula shape but no value yet**. The full list is in `open-items.md` under "Standing numeric tuning."

When you hit one:

- Define it in `constants.ts` with a placeholder and a `// UNTUNED` comment
- **Do not invent a plausible value and move on.** A silently-chosen `K = 10` becomes load-bearing three phases later and nobody remembers it was a guess.
- Say which ones you placeholdered in your summary

Several are explicitly *balance-script outputs* (`GOLD_PRESTIGE_CAP`, `prestigeGoldFactor[]`, `MIN_SECONDS_PER_KILL`) — they get derived, not picked.

---

## 5. Scope discipline

`implementation-plan.md` defines five phases. **Build only the current phase.** Each phase names its deferred systems explicitly; treat that list as a prohibition, not a suggestion.

The most common failure here: Champions are central to the game's identity, so it's tempting to build the gacha during Phase 1. Phase 1 is a **solo Hero** validating the enemy curve, boss gates, offline pacing, and prestige rhythm. Tuning drop rates against an unvalidated loop is the specific waste this ordering exists to prevent.

---

## 6. Content authoring

Rosters are deliberately partial:

| System | Full roster | Build now |
|---|---|---|
| Class nodes | 16 | All 16 — small, and fully specified |
| Skills | 36 | All 36 — full draft already written |
| Gear | 36 | All 36 — fully named by the epithet table |
| Champions | 48 | **8–12** in Phase 2 (2 per archetype at Common/Rare/Mythic) |
| Artifacts | 48 | Effects pool first; names deferred |
| Worlds | 10 | **Placeholder names and enemies.** World design has not happened. |

Champion and Artifact names are deferred *by design*, not by oversight — they're pure content, addable later with zero code change. Do not generate 48 names to "fill in the gaps."

**World 10 must be named The Void**, or Void Shards needs renaming.

Structural invariants from the docs (drop-rate rows sum to 100%, ability reuse ≤ 3 per archetype, effect-line count matches rarity, every loadout-referenced ID exists) go in `test/hero-quest/content.spec.ts` as vitest specs — not boot asserts.

---

## 7. Known-unstable ground

- **The enemy curve changed, and its values are still moving.** The continuous `b^n` replacement is now applied — one index `n = p×100 + (w-1)×10 + (s-1)`, one base `ENEMY_STEP_BASE`, and the boss-HP softening landed with it (×3 / ×6 of trash). `open-items.md` #10 has the full record, including the two consequences that were not previously written down: there is no longer a prestige difficulty reset, and XP rides the same index so XP/second no longer decays with depth. `b`, `XP_STEP_EXPONENT` and the boss multipliers are `// UNTUNED ╧` playtest values — Phase 1 settles them empirically. The curve stays behind `settle.enemyMultiplier()` so swapping it again is one edit.
- **Hero level now persists across prestige and class switches.** This is a recent revision. `heroLevel`/`heroXp` are **not** reset by `settleHq`'s prestige path — it zeroes only the run-position group. Several Gold constants need re-derivation because of it.
- **`gold-economy.md` supersedes older Gold assumptions** in `gacha-shared-system.md`, `economy-and-currencies.md`, `skills-gacha.md`, and `core-progression-and-prestige.md`. Gold is decoupled from the exponential curve. Any flat 1,000,000-Gold Seal price you encounter is superseded by the daily escalating ladder (`gold-economy.md` §7).

---

## 8. Starting a phase

A good kickoff prompt names the phase, the docs, and the prohibition:

> Build Phase 1 (Playable Core Loop) per `implementation-plan.md`.
> Docs in scope: `core-progression-and-prestige.md`, `classes-and-combat.md`, `idle-mechanics.md`, `gold-economy.md` §3–4 §6, `tech-architecture.md` §4a–4c §7.
> Use `index.md` to locate anything else; ask before loading a doc outside this list.
> Do NOT build: any gacha, any raid, Arena, Traits, Loadouts, Gear, Holidays, GPN, Battle Speed, leaderboards, evasion.
> Read `CLAUDE.md` §3 before writing code, and §4 before writing any constant.

Phase 0 and Phase 1 are the proving ground. If the loop is fun with a solo Hero and placeholder enemies, everything after is layering.
