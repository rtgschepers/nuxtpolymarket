# What Needs Clarification or Tuning Before Continuing

Current state of all 20 docs (18 design docs + `index.md` + this doc), refreshed as of the asset-list pass. Several items originally listed here have since been resolved in later sessions — this version reflects that; nothing below is stale.

---

## ✅ Resolved since this doc was first written

For the record — these were open items here and are now settled:

| Item | Resolution |
|---|---|
| `hqCollection` — one table or four? | **Single table**, `system` enum, locked in `tech-architecture.md` §3 |
| The game's real name | **Hero Quest** — applied throughout as `hq`/`hero-quest` naming |
| Trait Raid preferred-Loadout | **Yes** — included in the 5-entry raid-preference map, `loadouts.md` §4 |
| Arena Shop selling Gems | **Yes, at a deliberately unfavorable rate** — calibrated so a full day's Medals convert to less than one Battle Speed block, `arena.md` §6 |
| Combined class system | **Removed entirely** — cut from both prestige-shop sink lists, no longer referenced anywhere |
| `MAX_EVASION` | **Locked at 60%** — headroom left for future evasion sources |
| STR/DEX/INT → PWR merge | **Applied** across all affected docs |
| Hero level persistence across prestige/class-switch | **Applied** — `core-progression-and-prestige.md` §3, `classes-and-combat.md` §4–5 |
| Full asset list (characters, VFX, icons, backgrounds) | **Delivered** — see `asset-list.md`, all ten fidelity questions answered |

---

## 🔷 Design clarifications — still open, need your input

### 1. Should Arena get its own preferred-Loadout auto-apply for attacking?
Every raid auto-applies a preferred Loadout on engage (`loadouts.md` §4). Arena still doesn't — the attacker fights with whatever's live, manually pre-swapped if desired. `arena.md`'s Implementation Note flags this as a natural extension, not yet requested.

### 2. Arena matchmaking band width
`ARENA_MATCH_BAND_PCT` — how close in GPN does an opponent need to be to appear as a real candidate before Training Dummy fills the slot? Design-feel question as much as a number.

### 3. Boss/Raid fight crit model — seeded or averaged?
`tech-architecture.md` §4c/§9 recommends seeded RNG crits for live boss and raid fights, but it's a recommendation, not a lock.

### 4. Three small asset follow-ups from `asset-list.md`
- Champion skins (48): recolor-of-silhouette, or fuller per-rarity redesign?
- Do Training Grounds Active skills (18) get the same custom-VFX treatment as Hero/Champion abilities?
- Artifact procs (Lucky Dig, Windfall, etc.) — small flash on trigger, or silent/log-only?

---

## 🔶 Structural follow-ups — mechanical work, not open questions

### 5. World naming still hasn't closed the loop with Void Shards
`economy-and-currencies.md` names Void Shards after "The Void," described as World 10 — `core-progression-and-prestige.md` §5 now carries a matching note pre-committing World 10 to that name, but the world pass itself still hasn't happened.

*(The `tech-architecture.md` schema-catch-up item that used to be here — Gear/Loadouts/Traits/Holidays missing tables and routes — is **done**. All four now have full schema, routes, and content modules in `tech-architecture.md` §3, §5, §2. The `SEAL_LADDER_GROWTH[gear]` gap is also **resolved** — set to `1.0011`, derived from Gear's roster shape matching Skills', in `gold-economy.md` §7.)*

---

## 🔴 Genuinely undesigned — full passes, not edits

### 6. World & enemy design — the big one
10 worlds, names, art direction, enemy rosters, boss identities. This is the only remaining greenfield system, and it's a **hard dependency**: `gold-economy.md` §9's entire prestige→calendar calibration is waiting on this, and so is `asset-list.md`'s entire "Enemies" and "World backgrounds" sections. Recommend this is the next design session.

### 7. Passive Skill Tree (backlog item 3)
Unchecked. Hero-only passive tree, generic root splitting into 3 paths, nodes up to 5 levels each, purchased via its own dedicated raid, with Champion/item side-nodes allowed but never gating a path. Structurally sound to build (raids don't have to be gacha-paired) but has had no dedicated design session.

### 8. Alternative enemy-scaling formula (backlog item 9)
A candidate replacement enemy curve was parked, never evaluated against the locked `5^prestige × 1.6^(world-1) × 1.15^(stage-1)`. Worth folding into the World & Enemy Design session (#6) rather than treated separately, since it directly determines the curve that pass builds content against.

### 9. Holiday gameplay events
Explicitly deferred scope — the gift-mechanic phase is locked, but limited-time modes/content were never started.

---

## ⚠️ A decision made verbally, still not in the docs

### 10. A new enemy curve was mid-tuning and never finished
A prior session got partway through replacing the locked enemy formula with a continuous `b^n` version (`b = T^(1/100)`), mid-way through picking a `T` value via a Desmos slider when that conversation ended. Also in flight: **boss HP softening from ×8–12 down to ×4–6** — reads as decided, never applied to `core-progression-and-prestige.md` §1. That session also referenced "the world doc's §3 difficulty table," implying a worlds document that isn't currently in this project.

**Belongs in the World & Enemy Design session (#6)** — the `T` value determines the curve that pass would otherwise be building content against.

---

## ⚪ Standing numeric tuning — expected, not blocking

Every one of these is a named constant with a formula shape already locked, just waiting on a value. Consolidated so the eventual balance-script pass has one list instead of hunting through 20 docs. `SEAL_LADDER_GROWTH[gear]` is no longer here since it's set (`gold-economy.md` section 7).

| Constant(s) | Doc | Note |
|---|---|---|
| Offline Efficiency / Offline Cap `BASE_COST` (×2) | `idle-mechanics.md` §4 | Formula shapes locked, no anchor value |
| `K_ATTACK`, `K_DEFEND`, `MEDAL_BASE_WIN`, `MEDAL_BASE_LOSS`, `MEDAL_UPSET_BONUS`, `ARENA_MATCH_BAND_PCT`, `ARENA_SHOP_GEM_PRICE` | `arena.md` | `ARENA_MATCH_BAND_PCT` also a design question, see #2. `ARENA_SHOP_GEM_PRICE` has an explicit calibration target (under 1 Battle Speed block per day's Medals) |
| `EHP_DEF_CONSTANT` | `global-power-number.md` §2 | |
| `RAID_BASE_STATS`, `RAID_LEVEL_GROWTH`, `RAID_REWARD_BASE/GROWTH`, `RAID_ENRAGE_SECONDS`, `RAID_RAMPAGE_DMG/POWER_BASE/GROWTH` | `raid-system.md` | Per-raid |
| `SLOT_BASE_BONUS` ×6, `GEAR_PASSIVE_COEFFICIENT` | `gear-equipment.md` §2 | |
| `GOLD_PRESTIGE_CAP`, `prestigeGoldFactor[]`, `MIN_SECONDS_PER_KILL` | `gold-economy.md` §3–4 | Balance-script outputs — need re-derivation post level-persistence (see #10) and post world-design (#6) |
| Loadout `BASE_COST_GEMS` (8-level doubling) | `loadouts.md` §3 | Now checkable against real Gem income (Trait/Arena sinks exist) |
| `ONLINE_THRESHOLD_MS`, refresh interval | `tech-architecture.md` §9 | |
| `MAX_EVASION` | `classes-and-combat.md` §7 | **Locked at 0.60** — not open, listed for completeness |
| `K` (mitigation ratio) | `classes-and-combat.md` §7 | |
| `critChancePerPoint`, `critDamagePerPoint`, `overflowConversionRate` | `classes-and-combat.md` §7 | |
| Milestone Seal batch sizes, daily-grant cadence | `economy-and-currencies.md` §5 | Deferred to world/enemy pass |
| `wealthFactor` clamp range for Gambler's Strike family | `skills-gacha.md` §4 | Suggested ×0.5–×2.0, not locked |

---

## Suggested order

1. **World & Enemy Design (#6)** — genuinely blocking, not just outstanding. Resolves #5 (world naming) and #10 (the parked curve retune), and unblocks the entire Gold calibration chain.
2. **The four remaining quick calls (#1-4)** — all answerable in one short pass, none depend on anything else.
3. **Passive Skill Tree (#7)** — the last unbuilt major system; good candidate for its own dedicated session.
4. **Balance-script pass** absorbs the full constant list once #6 and #10 land, since several constants are explicitly waiting on world/enemy numbers to calibrate against.
