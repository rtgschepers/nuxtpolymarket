# What Needs Clarification or Tuning Before Continuing

Current state of the project, **refreshed 2026-09-15 against the code on the `hero-quest` branch** (last commit `55ff15b`). Phases 0–3 are built; the combat and progression loop has been through a tuning pass (#22); Gold moved onto account age (#23). Items #22–#27 record what changed since the last refresh (the in-game wiki, #21). Several earlier items were resolved in later sessions and are kept struck through with their reasoning.

**These docs live in `docs/games/hero-quest/` and are gitignored** — kept local like the other games' design docs, and restored from git history (`0571f3b^`) on 2026-09-15. They are not versioned, so nothing but this refresh records the changes between 2026-08-18 and now.

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
`tech-architecture.md` §4c/§9 recommends seeded RNG crits for live boss and raid fights, but it's a recommendation, not a lock. **As built, boss fights roll seeded crits** (`fight.ts`). The question is whether that stays — with `BOSS_HP_MULT` sized so gates are not decided within a couple of seconds, the variance matters less than it did.

### 4. Three small asset follow-ups from `asset-list.md`
- Champion skins (48): recolor-of-silhouette, or fuller per-rarity redesign?
- Do Training Grounds Active skills (18) get the same custom-VFX treatment as Hero/Champion abilities?
- Artifact procs (Lucky Dig, Windfall, etc.) — small flash on trigger, or silent/log-only?

---

## 🔶 Structural follow-ups — mechanical work, not open questions

### 5. ~~World naming still hasn't closed the loop with Void Shards~~ — **closed 2026-09-15**
The naming pass (#6) kept World 10 as **The Void**, so Void Shards keeps its name and its lore tie. `worlds.spec.ts` still asserts it.

*(The `tech-architecture.md` schema-catch-up item that used to be here — Gear/Loadouts/Traits/Holidays missing tables and routes — is **done**. All four now have full schema, routes, and content modules in `tech-architecture.md` §3, §5, §2. The `SEAL_LADDER_GROWTH[gear]` gap is also **resolved** — set to `1.0011`, derived from Gear's roster shape matching Skills', in `gold-economy.md` §7.)*

---

## 🔴 Genuinely undesigned — full passes, not edits

### 6. World & enemy design — **naming pass landed 2026-09-15; art and enemy kits still open**

**Names, themes and rosters are done** (`shared/utils/hero-quest/content/worlds.ts`, `core-progression-and-prestige.md` §5). The run is a walk toward the source: Duskspire's archmage opened a door to the Void (World 6), the cracks spread outward, and a run starts at the far frontier and walks inward past the door and out through the edge of the world into The Void. Each world has a one-line theme, which is the art brief. Nothing numeric moved — enemy stats come only from the curve.

Three naming rules, because the UI depends on them, stated in the `worlds.ts` header: trash names pluralise with a plain "s" ("Bramble Goblins defeated" — documented, not tested), boss names never start with "The" (the button reads "Fight Old Gnarlhide"; it previously rendered "Fight the The Voidborn"), and no name reuses a Champion given name or title (six of the old placeholders did). `worlds.spec.ts` enforces the last two, plus unique names across worlds. World IDs were renamed to match (`world_thornwick_vale` …); nothing persists them — runs store the world as an integer.

**Still open:** art direction and production (`asset-list.md` §1.4 enemies, world backgrounds), and whether enemies get kits of their own — the one part of this pass that would change gameplay. Enemies are still HP/PWR/DEF stat blocks with no abilities, which is why `controlResist` is inert (#18.6). *(This no longer blocks Gold: `gold-economy.md` §9's prestige→calendar calibration was replaced by the account-age ceiling, #23.)*

**What the tuning pass (#22) hands the enemy-kit question:** the enemy *curve* is tuned and derived from a pacing model, so art and kits can be chosen without re-deciding numbers — but anything that changes fight length (enemy abilities, heals, shields, more escort bodies) moves `FIGHT_LENGTH_DRIFT`'s effective value and has to be re-measured on the campaign walk. A first prestige for a party of three is about a week, and a world takes from under an hour (World 1–2) to about two days (World 10), almost all of it grind in front of gates.

### 7. Passive Skill Tree (backlog item 3)
Unchecked. Hero-only passive tree, generic root splitting into 3 paths, nodes up to 5 levels each, purchased via its own dedicated raid, with Champion/item side-nodes allowed but never gating a path. Structurally sound to build (raids don't have to be gacha-paired) but has had no dedicated design session.

### 8. Alternative enemy-scaling formula (backlog item 9) — **applied, see #10**
Resolved together with #10: the continuous `b^n` curve is now the implemented one. The shape is settled; only `b` is still a tuning value.

### 9. Holiday gameplay events
Explicitly deferred scope — the gift-mechanic phase is locked, but limited-time modes/content were never started.

---

## ⚠️ A decision made verbally — **now applied**

### 10. The new enemy curve — implemented, values still tuning
The parked continuous `b^n` curve is **built and shipped** in `settle.enemyMultiplier()`, with `core-progression-and-prestige.md` §1 rewritten to match. The boss HP softening landed alongside it, harder than the ×4–6 that was in flight: **×3 trash HP for the Stage 5 boss, ×6 for the super boss**, both now expressed against trash rather than the super boss compounding off the boss.

Authored as a **per-stage** base rather than the per-100-stage `T`, because `T` is a five-digit number for any sane per-stage value and nobody can slide it by feel. `ENEMY_STEP_BASE = 1.08` is the dial; `ENEMY_CURVE_T = b^100 ≈ 2,200` is derived.

Three things this decided that were not previously written down anywhere:

1. **No prestige difficulty reset.** One continuous index cannot hold both a per-run ramp and a smaller per-prestige jump — they are the same number. The old curve's ×0.021 dip at prestige (and ×0.455 dip at *every world boundary* — it was a sawtooth, which nobody had noticed) is gone. `ENEMY_PRESTIGE_STEP_MULT` restores it if wanted.
2. **XP now rides the same index** at `XP_STEP_EXPONENT` relative growth, so XP/second no longer decays with depth. The old three-base XP curve sat at an effective exponent of ≈0.45 against the enemy curve, meaning farming got strictly worse the deeper you went.
3. **Boss gates, not the wave ramp, are the intended wall** — a gate against a fixed timer is a pure DPS check, and party DPS is what Champions add.

~~Still open here: `b` itself, `XP_STEP_EXPONENT`, and the boss multipliers are all playtest starting points (`// UNTUNED ╧`).~~ **Tuned in #22.** `ENEMY_STEP_BASE = 1.08` and the boss multipliers (now ×7 / ×9) are `// TUNED ✓`; `XP_STEP_EXPONENT` is derived. World & Enemy Design (#6) owns names, rosters and kits, not these values — unless a kit changes fight length.

That session also referenced "the world doc's §3 difficulty table," implying a worlds document that isn't currently in this project.

---

### 11. Consequences of pooled mitigation and geometric stat growth — **new, from the Phase 1 math pass**

Mitigation is now pooled across the fielded party (`classes-and-combat.md` §7) and Hero stats grow geometrically against the enemy curve (`core-progression-and-prestige.md` §1). Five things surfaced here. **Four are now resolved** and are kept struck-through rather than deleted, because each records a decision and the reasoning behind it; only #3 is still open.

1. ~~**`HqStatBlock` is `number`, not Decimal.**~~ **Resolved — converted.** `HqStatBlock` is now `Record<HqStatKey, Decimal>`, so the float ceiling at hero level ~10,400 is gone (verified finite at level 1,000,000). `UnitStats.spd` and `UnitStats.critMultiplier` moved with it, since SPD and IMP are both unbounded; `critChance` stayed a `number` because it is a probability clamped to [0, 1], and `attacksPerSecond` stayed a `number` because its formula clamps at both ends. Authored class deltas stay plain numbers via the new `HqStatDelta` type — content is converted once, at `baseSpreadFor`, rather than 16 content rows wrapping every entry in `D()`.
2. ~~**Champions add exactly zero survivability.**~~ **Resolved at the Phase 2 kickoff — positional aggro via formation.** The survivability model summed incoming damage *and* HP across the party, so time-to-die was party-size-invariant and the Tank archetype had no mechanical function. Rejected alternatives: pooled party DEF (symmetric with `partyMitigation`, but makes party size a survivability stat, which `combat.ts` refuses by design) and shipping Tank as a stat spread only.

   What this locks: **enemy single-target attacks resolve against the front row and only fall through to the back row when the front is empty or dead** (`classes-and-combat.md` §6, `champions-guild-gacha.md` §8.4 — both already specify exactly this; the model simply never implemented it). Time-to-die therefore stops being party-size-invariant, and a Tank earns its keep by *standing in front*, with no new stat and no new pooling rule. A back-lined Tank's threat modifier stays inert while the front row stands, per §8.4's clarification.

   Consequence for `settle.ts`: `incomingDps` can no longer sum across the whole party. It resolves against the front row, which means the wave-survivability model now reads formation — the first time run position and loadout interact.
3. ~~**DPS is quadratic in the stat curve.**~~ **Resolved in #22 — built into the pacing model rather than fought.** `critMultiplier` scales linearly with IMP while damage scales with PWR, so both compound; that is now `DPS_STAT_EXPONENT = 2`, and enemy HP is set against it (`ENEMY_HP_STEP_EXPONENT`). LCK was taken **off** the level curve, which removes it from the exponent and stops every class reaching 100% crit on a schedule. Crit damage per point was cut 0.05 → 0.02. What remains: below the attack-rate cap SPD still scales, so the true exponent is nearer 3 early and levels there are worth somewhat more than the constant says — a known wrinkle, not a problem so far.

4. ~~**Prestige-shop stat multiplier scope is still undefined**~~ **Resolved by removing the upgrade.** Rather than answer Hero-only vs party-wide, the global stat multiplier is **cut from the prestige shop entirely** — the question only existed because the sink lists named an upgrade nobody had specified, and it was never built (`SHOP_TRACKS` has only Offline Efficiency, Offline Cap and Champion Slots). Struck from the sink lists in `core-progression-and-prestige.md` §4 and `economy-and-currencies.md` §4, from the shop table in `tech-architecture.md` §3, and from the GPN inputs in `global-power-number.md` §3.

   ~~**What this leaves open:** it was one of the multiplicative sources expected to fill the `STAT_PACE_RATIO` shortfall.~~ **Moot since #22** — levels now keep pace with the enemy curve by construction, so no multiplicative source is needed to close a pace gap; the gachas move walls instead. Void Shards keep their remaining sinks (slots, offline tracks, kill-count reduction, boss-timer extension, Raid Keys).
5. ~~**Clamped mitigation bottoms out at exactly zero damage.**~~ **Resolved — `MIN_DAMAGE` is the new floor.** A hard zero made every wall in the game an *absolute* wall: the campaign sim reported `STALLED (0 dmg)` at essentially every elite stage, with no partial progress and no way to tell a near-miss from a hopeless one. Damage now floors at `MIN_DAMAGE = 1` in `rawHitDamage`, mirrored in `partyDps` and `fight.rollDamage`.

   The floor is **symmetric and guarded**: an over-armoured party takes chip damage too, so nothing is immortal any more, but an attacker with **zero PWR still deals zero** — `MIN_DAMAGE` is a floor on what *mitigation* may reduce a hit to, not a guarantee that every swing hurts. Without that guard "immune" would stop being expressible anywhere in the model.

   **What it changed, and what it deliberately did not.** Wall *positions* are unmoved: the campaign sim reports the same 4 prestiges, the same level 1,821, the same grind wall at P4 W10S6. Against an enemy with exponential HP, 1 damage per hit is not a route through. What changed is the *character* of a wall — the sim now reports `WIPE` where it reported `STALLED (0 dmg)`, because an outmatched party dies rather than standing immortal dealing nothing, and a wave wipe restarts the same stage without losing ground. Walls are slow, not sealed. Whether that reads better in play is on the playtest watchlist.

---

### 12. Champion abilities — **framework built, effects still placeholder**

Champion abilities were authored in the Phase 2 content pass but never reached combat: `fight.ts` built skill timers only for party index 0, so a Mythic's three abilities and a Common's one were both worth exactly nothing. The plumbing is now in — `ChampionSnapshot.abilities` (required, so an omission is a type error rather than silently inert Champions) and a per-unit kit list in `fight.ts`, the Hero's accumulated down the class path and each Champion's fixed by its rarity.

**What did not land, and is the actual open item:** the effects. Every ability in the game — 16 class skills, plus the 18 Champion abilities the 12-Champion roster currently reaches out of a 28-strong pool — still resolves as single-target damage on the shared `SKILL_BASE_COOLDOWN_SECONDS` / `SKILL_BASE_ABILITY_MULTIPLIER` pair. No doc assigns a magnitude, cooldown or targeting rule to any of them, so this is a content pass waiting to happen, not an implementation gap. Slotting real effects in requires no further change to the firing model.

Four consequences, none of them resolved:

1. **Ability count is now a real rarity payoff**, stacking multiplicatively on `RARITY_STAT_MULTIPLIER`. That is the intended shape (`champions-guild-gacha.md` §2 grants 1/1/1/2/2/3 by rarity) but the two have never been balanced against each other — see the playtest watchlist at the end of this doc.
2. **The boss-vs-wave damage gap widened roughly threefold.** `settle.ts` has no skill term at all, so a boss gate is fought with strictly more damage than the wave rate on screen implies. A full party of six now brings up to 19 skills to a gate — a Master-tier Hero's four plus five Mythics' three each — and still none to the idle rate. Since boss gates are the intended wall (#10.3) and `SKILL_BASE_ABILITY_MULTIPLIER` is untuned, the gates may now be *softer* than the grind wall standing in front of them — which would invert the intended difficulty shape.
3. **Champion SPD shortens that Champion's own cooldowns**, so a Mythic Damage Champion cycles its kit faster than the Hero standing beside it. Emergent from `cooldownFor` and the rarity multiplier rather than designed, and it makes ability *throughput* a third rarity payoff on top of stats and slot count.
4. **Support and Control still have no mechanical identity.** Tank earned one from positional aggro (#11.2), but a Support's Mending Light and a Control's Silence currently deal single-target damage exactly like a Damage Champion's Cleave. Two of the four archetypes are therefore stat spreads with flavour text until the effects pass lands — which makes archetype choice much shallower than the roster implies.

**Scheduling — revised, and now underway.** The ability-effects pass is **pulled forward out of Phase 5** on the strength of point 4, and has started. It runs as five checkpointed stages: (1) enemy packs, (2) status + threat engine, (3) the effects themselves, (4) a settle approximation, (5) the full 48-Champion roster. Stage 1 has landed — see #13.

---

### 13. Enemy packs — **landed, Stage 1 of the effects pass**

Combat was single-enemy everywhere: `EnemyStats` was one record, and a wave stage was 30 sequential solo kills. That left roughly ten abilities across both rosters ("AoE hit to the 2–3 frontmost enemies", "hits 3 random enemies", "chain to a second nearby enemy", "chains between enemies", "hit multiple targets") with **nothing to hit**, and the Tank's threat modifier with nothing to re-weight. It also contradicted the targeting rules, which select *among* enemies — "lowest-HP% enemy", "highest-PWR enemy" are meaningless against a set of one.

`EnemyPack` is now a list of individually addressable members. `EnemyStats` is unchanged and still means "one enemy's stats" — it was never a claim about how many there are — which is why `combat.ts` and `fight.ts` took **zero diff**. Bosses are always a pack of one, so `runFight` is untouched.

**A "kill" is still one enemy, not one encounter.** `BASE_KILL_COUNT = 30` is 30 bodies that now arrive in bursts of N. That choice is what leaves `goldPerKill`, `xpPerKill`, `MIN_SECONDS_PER_KILL`, `GOLD_PRESTIGE_CAP` and `PRESTIGE_GOLD_FACTOR[]` untouched, and what lets the persisted `hq_state.kill_count` keep its meaning with **no migration**.

**Packs cost nothing on the offense axis, by construction.** Against a homogeneous pack both the HP fought through and the bodies it buys scale by N, so `secondsPerKill = (N×hp)/(N×dps) = hp/dps` — algebraically identical at any size. Verified: the campaign report is byte-identical before and after, and identical again at pack sizes 1, 2 and 3.

**All of the difficulty lands on survivability**, which is the axis front rows, Tanks and AoE actually care about. N enemies focus the front-most living defender (spreading them would re-create #11.2 — N bodies bringing N× HP *and* soaking N× streams makes time-to-die party-size-invariant again). The live-attacker count thins as a pack dies, modelled as a time-average so `secondsToDie` stays closed-form — settle is rate math, never a tick loop. Measured: survivability scales by exactly `1/streams(N)` to ten decimal places.

**Sizes: six per wave and elite encounter, so a stage is five clean packs** — 6 divides `BASE_KILL_COUNT` exactly, and a size that does not would leave the last pack of every stage a ragged remainder. **Bosses stand with an escort** of `BOSS_MINION_COUNT` trash minions, drawn from the same curve index at the *wave* stat layer, so a minion is an ordinary mob of that depth rather than a shrunken boss. Escort first, boss last — the order `rawSecondsPerPack` sums and `runFight` focuses, which is what keeps the projection and the fight agreeing.

`runFight` did **not** stay at zero diff once bosses gained an escort. It now resolves a list of enemies, each with its own HP and its own attack timer, mitigation is recomputed per target (pooling enemy DEF would make each body individually harder to hurt), and `FightEvent` gained `enemyIndex`. `FightResult` gained `enemyMaxHps` — per body, because a mixed pack cannot be reconstructed by dividing the total, and without it the replay's HP bar jumps *up* when the party finishes a minion and turns to the boss.

**Three consequences, all real and none of them bugs:**

1. **The first boss no longer passes on arrival.** World 1 Stage 5 went from 29.6s against a 30s timer to **49.3s — a FAIL**. The escort is HP the timer has to cover, so the opening gate now needs a few levels of farming first. `BOSS_MINION_COUNT` and `BOSS_TIMER_SECONDS` are the levers.
2. **An early wave wipe wall appeared.** At six attackers per encounter (`streams(6) = 3.5`) a level-1 Hero wipes on World 1 Stage 2, and the natural levelling curve does not outrun elites until roughly level 35. It self-resolves — a wave wipe restarts the stage while income continues — but it is a felt change for a new account.
3. **The campaign barely notices.** Solo still reaches 2 prestiges at level 1,025 and a party of five still reaches 4 at level 1,821, same walls, ~4h more grind for the solo run across 3½ days. Survivability is not what binds the run at depth; DPS is.

New placeholders: `WAVE_PACK_SIZE = 6`, `ELITE_PACK_SIZE = 6`, `BOSS_MINION_COUNT = 2`, `PACK_LIVE_STREAM_FRACTION = 0.5`, all `// UNTUNED ╧`.

---

### 14. Status and threat engine — **landed, Stage 2 of the effects pass**

The infrastructure every ability effect needs, built with **no ability using it yet** — which is the point of the ordering: the engine gets tested on its own terms before content depends on it, and the campaign report is byte-identical to Stage 1 because nothing applies a status.

**The rules are decisions, not transcriptions.** No doc defines a status system while both rosters assume one; Unraveling Curse ("extends the remaining duration of all debuffs currently active on its target") settles it, since that can only be written against a queryable, mutable, per-unit registry. Every rule — stacking-and-refresh, refresh-to-longer, the fixed `STATUS_TICK_SECONDS` grid, multiplicative order-independent stat modifiers, shields absorbing *after* mitigation, silence-vs-stun, cleanse acting on hostile kinds only, resistance cutting duration rather than chance — is now written up in `classes-and-combat.md` §7 with the reasoning, so a later change argues with a stated rule instead of discovering an implicit one.

Two are worth repeating here because they are easy to get wrong later:

- **The periodic grid is not the combat tick.** Paying DoTs per `FIGHT_TICK_SECONDS` would tie every effect's strength to the simulator's resolution — halving the tick would halve every burn.
- **Shields sit behind mitigation, not in front of it.** In front, a fully-shielded unit takes literally nothing, which quietly restores the immortality `MIN_DAMAGE` was introduced to remove.

**Threat closes the last piece of #11.2.** Tank earned its keep by standing in front; it now also *pulls*. Row remains eligibility and threat sorts only within it, so §8.4's "a back-lined Tank's taunt is inert while the front row stands" falls out of the model rather than needing a special case. Ties are stable, so a party with no aggro anchor targets exactly as before — which is why all 262 pre-existing specs stayed green.

New placeholders: `STATUS_MAX_STACKS = 5`, `STATUS_TICK_SECONDS = 1`, `TANK_THREAT_MULTIPLIER = 3`, `TAUNT_THREAT_MULTIPLIER = 10`, all `// UNTUNED ╧`. `BASE_THREAT = 1` is the baseline, not a tuning value.

~~**Known gap, closing in Stage 3:**~~ **Closed.** The engine's wiring into `runFight` is now tested through the real path, because abilities apply statuses — see #15.

---

### 15. Ability effects — **landed, Stage 3 of the effects pass**

Every ability in the game now does what its description says. Before this, all 44 resolved as single-target damage on one shared multiplier, which is what left two of four Champion archetypes with no mechanical identity.

**The enemy grid was a prerequisite nobody had written down.** Four of the seven newly-specified class skills are stated in terms of enemy *position* — "all enemies in a row", "the front column", "each spot" — and `EnemyPack` was a flat list with no geometry. Enemies now occupy the same 3-wide, two-deep grid the party does, derived from index and pack size alone (`enemyPosition`). It lands correctly at both sizes that matter without a special case: a six-strong wave pack splits 3/3, and a boss encounter puts its two minions in front with the boss behind them — **the escort screens its boss for free**, which was not designed, just fell out.

**Where the two halves came from is recorded per ability, deliberately.** The 28 Champion abilities are transcribed from `champions-guild-gacha.md` §6, which describes each one; the doc's own wording is quoted above each entry. Nine class skills had a one-clause hint. **Seven had nothing but a name in a tree diagram** and were specified during this pass — each carries a comment saying so, because "the doc said this" and "we decided this" must not become indistinguishable later. The `effects.spec.ts` assertions for those seven *are* their specification; there is no doc to check them against.

**Approximations, stated rather than hidden.** Six clauses need machinery that does not exist, and each is rendered as the nearest honest thing with a comment saying what was dropped:

| Ability | Clause | Rendered as |
|---|---|---|
| ~~Frostbind~~ | ~~"at max stacks, fully disables"~~ | **Built in full** — see below |
| Iron Skin | "each hit taken raises DEF" | Stacking DEF buff on cast; needs an on-hit trigger |
| Guardian's Reflect, Chain Bind | "a chance to…" | Always-on; a proc roll would add variance on top of crit for no gain |
| Volley | "3 random enemies" | The front line — random selection would need the fight RNG inside the pure resolver |
| Rupture | "a second burst after a short delay" | A short, heavy DoT; no scheduled-event queue exists |
| Disciple, Man's Best Friend, Raise Dead | summons | Their *contribution* (party healing, a self buff) |

**Frostbind is complete.** The freeze is a **stack threshold**, added as a generic `escalation` on `AbilityEffect` rather than a Frostbind branch — "build a debuff, then it does something worse" is an obvious shape for later content to reuse. Two independent dials: `FROSTBIND_STACKS_PER_CAST` sets how fast the slow builds, `FROSTBIND_FREEZE_STACKS` how deep it must get. The threshold is checked against the stacks actually on the target after each application, so the freeze fires on whichever cast crosses the line however many casts that takes — not "on the last application" — and setting the threshold above `STATUS_MAX_STACKS` disables the freeze without touching the slow.

**Summons are settled, not deferred.** Disciple, Man's Best Friend and Raise Dead render as their contribution rather than as spawned units, and that is the intended model: they expire rather than persisting, so no unit lifecycle is needed. Removed from the open list.

**Still open:** Totem Storm and Raise Dead are described only as affecting "the party or battlefield" (§7), deliberately ambiguous between the two. Both were resolved as the party reading. **Deferred to playtest** — revisited once the game has a visual and there is play data, rather than decided on paper.

**A design consequence worth knowing:** utility abilities deal no damage at all — Support and Control now route through §2's `healAmount` and `debuffPotency` shapes rather than the damage formula, which is exactly what makes them distinct. That meant every ability firing needed to emit a `skill` event even at zero damage, or a replay would show a buff appearing with nothing having cast it.

New placeholders, all `// UNTUNED ╧`: the `SKILL_*` magnitude set (AoE, pierce and line multipliers, status durations, buff/debuff fractions, heal/shield/DoT/HoT multipliers), `ENRAGE_*`, `KILL_SHOT_CRIT_MULTIPLIER`, `EXECUTE_BONUS`, `FOCUSED_BARRAGE_HITS`, `REVIVE_HP_FRACTION`. `HASTE_SPD_BONUS = 1.0` is **not** untuned — a doubling is the one ability magnitude any doc actually states.

---

### 16. Ability effects reach the idle rate — **landed, Stage 4 of the effects pass**

`settle.ts` had **zero** skill references, so every effect built in Stage 3 was invisible during the ~97% of playtime that is idle wave farming. `projection.ts` closes that: each effect collapses to a scalar via `uptime = min(1, duration / cooldown)` and a coverage fraction for how much of a pack it reaches. Nothing iterates time — settle is one frozen rate per window, and a 72-hour offline settle still resolves in constant time.

**Applied by rewriting the inputs, not the formulas.** A buffed party is simply a stronger party (`buffedUnits`) and a shredded pack a softer one (`debuffedPack`), so pooled mitigation and everything downstream pick the change up without learning that buffs exist. `rateAt(hero, position)` is the single helper `settle()`, the campaign sim and the specs all share — an earlier version had each assemble the pipeline itself and they drifted immediately, with one spec measuring a party the game does not field.

**The tolerance spec found two real model bugs**, which is what it was for:

1. **`partyAbilityDps` applied the `MIN_DAMAGE` floor before the ability multiplier**, where `rawHitDamage` and `fight.rollDamage` apply it after. That paid `MIN_DAMAGE × multiplier` for a fully-mitigated ability and inflated every kit whose damage sat near the floor.
2. **Pierce coverage assumed every column is two deep.** A six-strong pack is three columns of two, but a three-body boss encounter is one column of two and one of one — and the boss encounter is precisely where pierce abilities get measured.

**The band is asymmetric, and the asymmetry is measured rather than asserted.** Under-promising is held to 30%; over-promising is allowed 70% for one quantified reason: an ability cannot fire at t=0, so a finite fight lands `floor(T / C)` casts where the steady-state rate prices `T / C`. A 6-second fight gets one cast against a projected 1.7. That is a **finite-window artifact that vanishes over the hours `settle` actually resolves** — at one hour the same cooldown loses under a percent — and a spec pins the explanation so the band rests on evidence.

**Consequences:** the solo campaign run drops from 3d 18h to 3d 13h, entirely from Haste's SPD buff finally raising the idle attack rate — the one doc-specified ability magnitude, worth nothing to the idle rate until now. The sim's stand-in Champions also gained one ability each: they previously carried none on the grounds that settle had no skill term, which stopped being true here and would have understated every real party.

New placeholder: `MAX_SUSTAIN_MITIGATION = 0.9` — the most of an incoming wave party healing may cancel in the projection. Not a combat rule; `fight.ts` resolves heals for real. It exists because the averaged model would otherwise let one Support drive incoming damage to zero and make the party immortal, restoring exactly what `MIN_DAMAGE` was introduced to remove, in the one place no fight would ever contradict it.

---

### 17. The full 48-Champion roster — **landed, Stage 5 of the effects pass**

All 48 exist: two per archetype per rarity across all six rarities, the complete roster §1 describes. This **deliberately overrides** `docs/hero-quest/CLAUDE.md` §6, which said Champion names were deferred by design and told implementers not to generate them; that guidance has been updated rather than left to contradict the code.

**Assembled from two tables, not written out.** `ROSTER` holds names and titles; `ABILITY_SLOTS` holds the ability draws, shared by all four archetypes. That makes the three structural rules — ability count per rarity, the ≤3 reuse cap, and variety within a rarity — consequences of one distribution rather than 48 separate chances to break one. Title pools expanded from 4 to 12 per archetype, since four cannot name twelve Champions.

**The twelve Phase 2 Champions keep their id, rarity and title**, so existing collection rows stay valid — `hqCollection` references `contentId` and nothing else. Only their ability draws moved, and those are not persisted. All four Phase 2 Commons happen to keep their original ability exactly.

**The distribution serves the stated goal: variety within a rarity, overlap across rarities.** Every rarity's pair is disjoint, and the six abilities appearing at Common/Uncommon/Rare are *exactly* the six the two Mythics carry — so nothing a low-rarity Champion does is missing from the top of the ladder. Counter-intuitively this is why the pool stayed at **7 with a cap of 3**: expanding it would work *against* the overlap goal, because a Common's one ability would be less likely to reappear on anything Mythic.

**A genuine tension, surfaced rather than reconciled.** §6's design table tiers abilities by rarity — a Support's revive and cleanse are described as the *third* ability a Mythic gets. That cannot hold at the same time as the two goals above: a 7-ability pool capped at 3 uses cannot put the basics on low rarities, mirror the low set onto the Mythics, *and* reserve the exotic abilities for high rarities. The arithmetic runs out. The overlap goal won, so a Rare Champion does draw from the back half of the pool — Second Wind, a revive, sits on a Rare. **The levers are the pool size and the reuse cap**, and moving either is a design call rather than an implementation one.

**`foldToAvailableRarity` is retired from the Champion path.** It existed because a partial roster left better than half of all rolls at gacha level 7+ naming a rarity with nothing in it. With all six populated it is the identity function — the exact condition its own docstring named for removal — so `championFromRoll` and the Guild serializer stopped calling it rather than passing an always-true predicate. The helper itself stays in `gacha.ts` for Gear, Skills and Artifacts, whose rosters are still partial; it is deleted outright when the last of those completes. A spec asserts every rarity is populated, so the claim "the fold is unnecessary" is tested rather than commented.

---

### 18. Phase 3 — the remaining three gachas and Loadouts — **landed**

Gear (Forge), Skills (Training Grounds), Artifacts (Dig-site) and Loadouts §1–3 are built. Seven things it decided that were not written down anywhere, listed because each is a judgement call rather than a transcription.

**1. `foldToAvailableRarity` is deleted, not merely unused.** All four rosters now populate all six rarities — Champions 48, Gear 36, Skills 36, Artifacts 48 — which made it the identity function everywhere. `content.spec.ts` asserts the coverage per system, so the claim is tested rather than commented, and the *reasoning* (why rounding down was the right repair for a partial roster) is preserved as a comment where the helper used to live.

**2. ~~The Artifact roster ships with placeholder names~~ — named 2026-09-15 (`artifacts-dig-site-gacha.md` §3a), overriding the earlier "do not generate 48 names" guidance.** The Dig-site needs content to roll, and shipping partial would have kept every other gacha paying for content this one had not authored. They first shipped as a placeholder title pool plus the rarity epithet (`ARTIFACT_TITLES`), replaced by authored names in `ARTIFACT_NAMES`. The per-Artifact effect assignment is a shared distribution table, not 48 authored choices, so it is equally re-cuttable.

**3. Three routes replaced twelve.** `gacha/pull`, `gacha/craft` and `gacha/buy-seals` each take `system` in the body per `tech-architecture.md` §5, and the Phase 2 `guild/*` copies were retired. `guild/party.post.ts` became `loadout/set.post.ts`, which sets any of the five loadout components — party, formation, Skills, Artifacts, Gear — because a formation is only valid against a specific party, and once a route has to take two together it may as well take the set a Loadout is *defined* as. `loadout/apply` then runs a saved preset through the identical validator, which is what keeps §1's "never goes stale" promise honest instead of assumed.

**4. Passive modifiers are one vocabulary for three systems.** Gear bonuses, Skill passives and Artifact effects all do the same job — always-on adjustments with no cooldown — so `modifiers.ts` defines one `HqModifier` kind set and each content module declares against it. What differs is **scope**, and only scope: Gear and Skills reach the Hero, Artifacts reach the whole fielded party. Stacking is additive throughout, per `artifacts-dig-site-gacha.md` §4 and `gold-economy.md` §5.

**5. Six effects are approximations, stated rather than hidden** — the same convention #15 established. Ramping-over-a-fight buffs (Momentum, Steady Ground, Flow State, Compound Interest) are rendered flat, because the idle rate is one frozen average per window and has no "later in the fight". On-kill and once-per-fight procs (Lucky Dig, Windfall, Unbroken, Bulwark's Legacy) become rates, since the model counts kills per hour. Three Skill clauses that refund or reset a cooldown become a permanently shorter one. Each carries a comment naming what was dropped.

**6. Two things are declared and inert, honestly.** `controlResist` (Artifacts' Unshaken, Skills' Unbreakable Will and Immortal Vanguard) has nothing to resist: `EnemyStats` is HP/PWR/DEF and enemies have no abilities, so nothing applies control to the party. It goes live the day enemy kits do, and was left pointing at what it *means* rather than re-pointed at a stat that happens to be wired up. Separately, `reflect` was the reverse case — **it turned out `fight.ts` had never resolved the reflect status at all**, so Guardian's Reflect had been inert since the effects pass. Wiring the passive line closed that gap for both.

**7. Skill copies now scale with investment — the one gap this phase found and then closed.** Artifact magnitudes scale with the `(star × 10 + level)` scalar because §6 says so; Skills did not, because `skills-gacha.md` never says they do. That left a levelled Skill copy worth **literally nothing** beyond the duplicates it consumed — not a design anyone chose, just a gap between two docs. `SKILL_POTENCY_PER_POINT` closes it on the terms the rest of the project already uses.

The shape is `championInvestmentMultiplier`'s — **identity at minimum** — not `artifactLineMagnitude`'s proportional curve, and the difference is the whole decision. Artifact magnitudes are proportional to the scalar (a fresh copy is 1/60th of a maxed one), which works there because §6 states that scaling and the per-point base is sized to match. Skills are authored as *complete* qualitative bands in §4 — "small", "medium", "large" — so a proportional curve would make a freshly-pulled Mythic 1/60th of its own described strength and silently rewrite the doc's ladder. At 0★/Lv1 potency is exactly 1.0, so §4 stays the reference point and levelling multiplies up from there: ×2.18 at 5★/Lv10 on the placeholder.

What scales is **magnitudes only** — the damage multiplier, heals, shields, status strengths, Gold/XP bursts — via `scaleEffect`, which is explicit about the exclusions and why. Durations, cooldowns, hit counts and stack thresholds do not: a longer buff is a different effect from a stronger one, the idle projection already prices a status at `duration / cooldown` uptime so scaling both would double-count, and scaling Frostbind's freeze threshold would make a levelled copy *slower* to freeze. Cadence stays SPD's job and Tempo's.

New placeholders, all `// UNTUNED ╧`: `SLOT_BASE_BONUS` (×6), `GEAR_PASSIVE_COEFFICIENT`, `SKILL_PASSIVE_MAGNITUDE[]`, `SKILL_ECONOMY_COEFFICIENT`, `GOLD_BURST_MINUTES[]`, `GOLD_BURST_COOLDOWN_SECONDS`, `SKILL_COOLDOWN_REFUND_FRACTION`, `WEALTH_FACTOR_MIN/MAX`, `WEALTH_NEUTRAL_HOURS`, `SKILL_POTENCY_PER_POINT`, `ARTIFACT_EFFECT_PER_POINT`, `ARTIFACT_ECONOMY_COEFFICIENT`, `SKILL_SLOT_BASE_COST`/`_GROWTH`, `ARTIFACT_SLOT_BASE_COST`/`_GROWTH`, `LOADOUT_SLOT_BASE_COST_GEMS`.

**Deferred out of the phase, deliberately:** `global-power-number.md` (Phase 3 only makes it *computable*; Phase 4's Traits is where its EVA term goes live) and `loadouts.md` §4's per-raid auto-apply, which has no caller until `raid/engage` exists and whose one real guarantee — the swap completing before Trait Raid's unconditional Key debit — can only be tested against a real raid route.

---

### 19. The playtest harness — **landed, and it unblocks the whole tuning list**

`server/utils/hero-quest-dev.ts` plus five routes under `server/api/hero-quest/dev/` and a `Dev` tab that only exists in development builds.

**Why it was built before Phase 4.** `implementation-plan.md` Phase 1 ends with "stop here and actually play it before continuing", and that had been deferred through two whole phases. The obstacle was never willingness — the campaign sim puts two prestiges at three and a half days of wall clock, the free Seal grant is on a 24-hour timer, and the Gold ladder resets on a date key, so an evening of honest play reaches World 2. Every constant in the section below is waiting on data that was, in practice, unobtainable. This is what makes it obtainable.

**What it does:** skip time (as one offline window, or as consecutive presence-length ones), grant any currency, own every roster entry at a chosen star/level, max the prestige shop, teleport the run, force `runCleared`, switch class node, and wipe back to unfounded so the first hour can be played twice.

**The one design rule it follows: it never reimplements game math.** Every function moves an *input* — the clock, a balance, a position, an owned row — and lets the production path do the work. `devSkip` does not compute what eight hours would have earned; it rewinds `lastSettledAt` and calls the real `settleHq`. A harness that models the game separately is one that lies to you about the game.

Three details worth knowing, because each is a place it could have been silently wrong:

- **Offline and online are two experiments, not a preference.** `settleHq` classifies a window by its own length, so there is no flag to pass. Eight offline hours is one window, which is what the cap and the efficiency tax apply to; eight online hours is 160 consecutive three-minute windows, which is what a present player would have produced. `skipPlan` is unit-tested for `chunkMs <= ONLINE_THRESHOLD_MS` specifically — one millisecond over and every "online" chunk settles at the offline rate while reporting otherwise.
- **Every clock moves together.** A skipped day rewinds `lastSealGrantAt` too, or the skip hands back a day of combat and none of the Seals that day owed. The Gold ladder is the exception it cannot rewind — it is keyed on a real calendar date — so a skip of a day or more clears it instead, which is the honest approximation and is documented as one.
- **The gate is `import.meta.dev` alone**, deliberately *not* the `devMode` runtime config that `server/api/pathwarden/*` also accepts. These routes mint Gold and Gems, which are shared balances across every polynux game rather than Hero Quest scrip, so a deploy-time flag must not be able to open them. It throws **404, not 403**, so the routes are indistinguishable from undeployed. Verified in the built bundle, not just in source: `import.meta.dev` folds to a literal `false` and the gate becomes unconditional.

`devReset` clears Hero Quest's five tables and **does not touch `balance` or `gems`** — granting into a shared balance is a dev convenience, silently deleting from one is data loss.

No new game constants; the harness's own limits live beside it rather than in `constants.ts`, since nothing about balance changes if they move.

---

### 20. The nine-tab layout collapsed to six — **landed, and it deviates from the docs**

Session-1 playtest, findings 4, 5 and 7 (see `playtest-notes.md` for the full record). The four gacha tabs — Forge, Guild, Training Grounds, Dig-site — are gone, replaced by **Gacha** (a 2×2 of pull cards) and **Collections** (one page, a submenu per system).

**This is the deviation, stated plainly:** several locked docs describe those four as *places* the player visits — `gear-equipment.md` §6 gives their tab order, `skills-gacha.md` §1 dresses the Training Grounds with class-specific art, and `artifacts-dig-site-gacha.md` and `champions-guild-gacha.md` both write in terms of "the tab". Those pages no longer exist. The names survive as card headings and submenu entries, so nothing in the fiction changed, and **no rule, formula, drop table or number moved** — this is navigation only. But it was decided on a playtest call rather than a doc revision, so it is recorded here rather than left to be discovered by whoever next opens `gear-equipment.md` §6.

The one piece of authored content that did not survive the move: `trainingGroundsArt` (Barracks / Archery Range / Wizard Tower, `skills-gacha.md` §1). It dressed the recruitment block, which is now a quarter-page card shared with three other systems. The server still serializes it; nothing renders it. Either the Gacha card grows a per-system art treatment or the field goes — worth deciding during the Pixi pass rather than now.

**What the split bought, and why it is not just tidying.** The four pages were 90% the same page. Collapsing them turned four copies of a collection grid into `CollectionCard.vue` + `CollectionToolbar.vue`, and four copies of a recruitment block into one `GachaCard.vue` — the same argument that makes `gacha/pull.post.ts` one route rather than four, now applied to the client. A fifth gacha, if one ever ships, is a row in a table on both sides.

**Sorting is the only logic in it**, and it is specced (`test/hero-quest/collection-sort.spec.ts`): rarity low→high, then the system's own axis, then name. The name tiebreak exists so that reordering a content array cannot reshuffle a grid the player has learned.

---

### 21. The in-game wiki — **landed, and it is generated**

Session-1 playtest, finding 6. `/hero-quest/wiki`, five pages: Basics, Combat, Economy, Gacha, Content. Plus `InfoTip.vue` on the battle screen's stat tiles.

**Why this belongs in an open-items list at all:** the wiki is the first thing in the project that *reads* the tuning constants for a player-facing purpose, which makes it the first thing that can be made wrong by the tuning pass itself. Two mechanisms stop that, and both are worth knowing before anyone edits either half:

- **Explainer pages interpolate every number from `constants.ts`.** Prose describes shape; magnitudes are never typed. `test/hero-quest/wiki.spec.ts` asserts each formula string contains its constant's rendered value, so swapping an interpolation for a literal fails. The expected substrings carry context (`never below 1`, not `1`) because `MIN_DAMAGE` is `1` and a bare-digit assertion would be vacuous — a detail worth preserving if those cases are ever extended.
- **The Content page is a `v-for` over the content modules.** Classes, Champions, Skills, Gear, Artifacts, the effect pool and Worlds all render from the arrays the gacha rolls against.

**The gap, stated plainly:** nothing can render *which* constants are still untuned, because `// UNTUNED ╧` is a comment rather than a value. Basics carries one banner saying so. If the tuning pass ever wants a real list, the marker has to move from comment into data — that is the change to make, and it is not made yet.

**The Economy page marks Trait Gems, Raid Keys and Arena Medals as not in this build.** When Phase 4 ships those systems, flipping `live: true` in `HQ_CURRENCY_DOCS` is the whole edit.

~~One consequence for the naming passes still owed: Artifact and World names were placeholders displayed to players.~~ **Both naming passes landed 2026-09-15** (#6, `artifacts-dig-site-gacha.md` §3a), and the Content page's placeholder banner is gone.

---

### 22. The combat and progression tuning pass — **landed, 2026-08-18 → 2026-09-15**

The core loop's numbers are no longer placeholders. **42 constants moved from `// UNTUNED ╧` to `// TUNED ✓`** (104 markers → 62), and the level curve was re-derived as a pacing model rather than a single ratio. `constants.ts` now distinguishes three states in its header: `UNTUNED ╧` (shape locked, value a guess), `TUNED ✓` (measured; its comment says what it trades against and what it is coupled to), and **derived** (no marker, never set directly).

**This reverses the standing decision below that nothing is tuned before playtesting**, for the combat and progression block specifically. The tuning ran on the campaign walk. ⚠ The `TUNED ✓` legend says "confirmed in playtest", but `playtest-notes.md` still records only session 1 — if there were further sessions, what was observed in them is not written down anywhere in these docs.

**Four stages, in order:**

1. **A faster opening** (`f125cf5`, `f03af61`, `bf3551c`). Autoattack 3s → **2.4s** with the skill cooldown 8s → **6.4s** by the same factor (so kits do not lose ground to basic attacks); the attack-rate cap 3/s → **5/s**. Enemy base stats re-cut to **HP 60 / PWR 1.75 / DEF 2** (from 30 / 10 / 5), hero `BASE_HP` 2000 → **150**, `K` 2 → **16**. A spec pins that a level-1 Hero clears World 1 Stage 1.
2. **Luck off the level curve** (`a218343`). `STAT_SCALES_WITH_LEVEL.lck = false`, `LCK_BASE_SCALE = 0.75`, `CRIT_DAMAGE_PER_POINT` 0.05 → **0.02**. A geometric LCK against a clamped crit chance put every class at 100% crit inside the first prestige; frozen, crit chance is something the collections have to buy.
3. **The constant-pressure pacing model** (`5113265`). The largest change, written up in full in `core-progression-and-prestige.md` §1:
   - **`ENEMY_PACE_RATIO = 1.0`** — PWR, DEF and VIT ride `STAT_PER_LEVEL_GROWTH_PACED` and track the enemy exactly. A matched pair read through the mitigation clamp cannot drift slowly; it holds for a hundred stages and then collapses to `MIN_DAMAGE`. So **the clamp is removed as a source of walls, at both ends.**
   - **Enemy HP gets its own exponent**, `ENEMY_HP_STEP_EXPONENT = DPS_COVERAGE_PER_STAGE + FIGHT_LENGTH_DRIFT = 2.35`, because HP is read against DPS, a product of two level-scaled stats. **`FIGHT_LENGTH_DRIFT = 0.35`** is the new source of walls: each stage's fight ~2.7% longer than the last, read as pass/fail only against boss timers. Past ~0.35 the run gets *shorter*, not longer.
   - **`XP_PACE_SLACK` 0.9 → 1.0** (the grind dial) and **`XP_TO_LEVEL_GROWTH` 1.16 → 1.05** (units only — `XP_STEP_BASE === XP_TO_LEVEL_GROWTH^LEVELS_PER_STAGE`). Four levels per stage.
   - Target: **a first prestige for a party of three in about a week**. The campaign grind budget went 24h → 72h per blocked stage to match, since intended late-gate grinds would otherwise read as walls.
4. **The Beginner and the first wall** (`fd0837a`). Beginner spread `high` PWR/SPD with a **double strike** (it has no damage in its kit and a new account fields it alone). `BOSS_HP_MULT` 3 → **7**, `SUPER_BOSS_HP_MULT` 6 → **9**. Result: a solo level-1 Beginner clears World 1 Stages 1–4 and fails the Stage 5 timer by a clear margin; a starting party of three passes it on sight.

**Measured shape** (`--report=campaign`, stand-in Champions at Common / investment 1, no Gear/Skills/Artifacts):

| | Wall | Level | Prestiges | Time | Gold |
|---|---|---|---|---|---|
| Solo | P0 W8S10 (needs 430) | 401 | 0 | 10d 11h | 147,254 |
| Party of 3 | P1 W2S10 (needs 588) | 559 | 1, in ~6½ days | 10d 13h | 311,851 |

Every blocker in the party's first prestige is a boss timer. World 1's boss needs level 20 solo, level 1 with a party of three; clearing the first loop needs 524 solo and 494 with a party.

**What the pass did not touch, deliberately:** the ability magnitude set (`SKILL_*`, `ENRAGE_*` and the rest — the walk measures a Beginner plus stand-ins and barely exercises them; settling them needs seeded `fight.ts` comparisons across the class roster), everything gacha and shop, `CHAMPION_INVESTMENT_PER_POINT` (no measurement fields an invested Champion at all), the collection passive, and every Gold constant beyond `MIN_SECONDS_PER_KILL`.

**Open consequences:**

1. **A solo account never completes a prestige** without pulling. That follows from making the gate the wall and Champions the answer to it — worth confirming it is intended rather than let it stand by default.
2. **The Gold curve was calibrated against the old loop speed** — see #23.3.
3. **`STAT_PACES_ENEMY_CURVE` is inert while `XP_PACE_SLACK` is 1.0**, because both stat curves are then numerically identical. Keep it: it starts mattering the moment slack moves.

---

### 23. Gold is paced on account age — **landed 2026-08-18, with open consequences**

`gold-economy.md` §3 and §3a have the full design. In one line: `goldPerKill = BASE_GOLD × min(1.017^n, tenureCeiling(accountAge))`, with the ceiling generated from Colony's and Xeno's income at equal account age and discounted to 0.85×. `PRESTIGE_GOLD_FACTOR[]`, `GOLD_PRESTIGE_CAP`, `GOLD_WORLD_BASE`, `GOLD_STAGE_BASE` and `GOLD_PLATEAU_GROWTH` are deleted; `hq_state.created_at` was added.

**Why:** §9's plan was to measure a prestige→calendar mapping and fit the prestige table to it. Measured, the mapping does not exist — at the time a party of Commons cleared four loops in under three hours and then spent 29 days on the fifth, while a strong roster cleared six in the same three hours. Prestige count tracks power, not time, and no prestige-indexed table can hit a calendar anchor. Account age is the one clock that cannot be front-loaded, farmed or lost. `BASE_GOLD` 5 → 0.4, since the old value put a three-hour-old account at ~500× platform day-one income.

**Open — three consequences, none reconciled:**

1. **The locked calendar anchors are gone.** `gold-economy.md` locked ~235M/hr at month 3 and ~0.71B/hr at month 6. The ceiling now pays a keeping-pace account ~28M/hr at day 90 and ~52M/hr at day 180 — roughly an order of magnitude less. That is a deliberate re-anchoring on the platform, but it replaced a *locked* decision in code; it is recorded here so it reads as a decision.
2. **The Seal ladder's calibration is stale.** `SEAL_LADDER_GROWTH` was sized so pure Gold-buying completes one gacha's roster in ~6 months at the old income (17B/day at month 6). At ~1.25B/day that target does not hold. The ladder's shape is fine; its growth rates want re-deriving against the tenure ceiling (`gold-economy.md` §7).
3. **`GOLD_STEP_BASE = 1.017` was measured before #22 slowed a prestige loop to a week.** It was chosen so the weakest simulated roster stayed inside the platform's 0.4–2.5× band, back when loops took hours. Now a prestige-0 account's progression factor tops out at `1.017^99 ≈ 5.3` — **at most ~15K Gold/hour before Gold%**, against ~975K/hour on the platform at day 7 — and the campaign walk's party of three earns 311,851 Gold over 10½ days. The ceiling does not bind for a new account; progression does, far below the platform. The "~89% of time ceiling-bound" figure behind `GOLD_PLATFORM_DISCOUNT` dates from the same fast-loop era. **Needs a decision:** whether a first-week account should earn near platform rates (steepen `GOLD_STEP_BASE`, raise `BASE_GOLD`, or both — re-run `economy-compare.ts` and the campaign walk) or whether low early Gold is acceptable given that Gold only buys Seals.

---

### 24. A settle is lossless now — **landed 2026-08-25**

Two bugs, both of the "progress silently disappears" kind.

**The part-kill carry.** Every read is a settle, and each window floored to whole kills, so up to one kill was lost per settle — and a player refreshing faster than `secondsPerKill` earned nothing at all. `hq_state.kill_fraction` now carries the remainder into the next window. It is carried **in kills, not seconds**: seconds are only worth kills at the rate that measured them, so a player parked at a wall would bank hours of unspent time and cash it all the moment an upgrade cut the rate. Values outside `[0, 1)` are dropped as corruption rather than clamped (a clamped `1` pays a free kill on every read). Reset to 0 on prestige, boss engage and dev position edits. Specced in `settle-carry.spec.ts`; `idle-mechanics.md` §4.

**The UTC pin** (`fced8fd`). On a non-UTC machine a new `hq_state` row's `defaultNow()` settle clock read back hours in the future, so every settle early-returned before writing and a new run accrued nothing for exactly the UTC offset — while the client's projection walked forward and snapped back on every refresh, looking like progress being wiped on reload. The database connection is now pinned to UTC; this affects every idle game on the platform, not only Hero Quest. `tech-architecture.md` §4a.

---

### 25. Bosses engage automatically while the page is visible — **landed 2026-08-18, a deviation from locked docs**

`core-progression-and-prestige.md` §2 said a failed boss is not auto-retried and the player re-engages manually; `idle-mechanics.md` §5 had the player return to a fight "ready to manually engage". **Both are superseded:** the client fires `boss/engage` on its own while `document.visibilityState` reads `visible`, on first arrival and on every re-arrival. A manual button remains.

**The invariant it keeps:** a hidden tab, a closed app and an offline settle never engage a boss, so Void Shards still cannot be earned from idle time. Presence is read from visibility rather than from a press.

**Decided in code rather than in a doc revision**, the same situation as #20 — recorded here so the locked text is not taken at face value. The details worth knowing:

- **One kill of grace** (`AUTO_ENGAGE_GRACE_KILLS`, clamped 1–10s). The client projects kills fractionally and the server floors them, so the screen reaches a gate before the server agrees. The early engage is rejected with a 400, which is now routine: swallowed and retried after 3s, never shown. **Do not soften the rejection server-side.**
- **Holds on a cleared run.** A won super boss leaves the run parked on its gate with `runCleared` set; firing there would re-fight it forever and pay Milestone Seals each time. ~~**Manual re-engage has the same shape and was flagged, not fixed.**~~ **Confirmed and fixed 2026-09-15.** `boss/engage` never checked `runCleared`, so a cleared run's final boss could be re-fought indefinitely by button or by script, each win paying the boss and world-clear Milestone Seals again (4 of every type) — and a burst on the *first* clear paid once per queued request, since the lock serializes them but a win there does not move the run. The fight now lives in `resolveBossEngage` (`server/utils/hero-quest.ts`), which rejects a cleared run under the row lock; the button is hidden on a cleared run; `boss-engage.spec.ts` bursts it against a real lock (verified to fail with the guard removed: 10 of 10 paid).
- An auto-engaged replay closes itself after 2.5s; a manual one waits for the player.

Decision logic is pure and specced (`app/utils/hero-quest-auto-boss.ts`, `auto-boss.spec.ts`). For the watchlist: whether an unattended boss loop reads as "the game plays itself" or as losing the one moment the game asked for attention.

---

### 26. Seeing the numbers — **stat attribution and a live battle screen, landed 2026-08-18**

Two presentation systems, both built so they cannot disagree with the model.

**Stat attribution** (`c72c3f5`). `shared/utils/hero-quest/explain.ts` re-walks the stat pipeline recording each step, and prices every source in **stages of enemy curve** — the only common denominator the game has. Rendered by `bun run sim:hero-quest --report=stats` and by `StatBreakdown.vue` via the new `stats.get.ts`. It refuses to show per-source multipliers, because Gear, Skill and Artifact lines sum as fractions before converting (Gear +50% and a Skill +50% are ×2.00, not ×2.25). Its central lesson, printed on every report: **only levels compound** — every other source shifts a wall by a constant number of stages. Answers session 1's "no idea what each stat means" at the model level, not only the tooltip level.

**The battle screen walks forward between payloads** (`b8dd672`, `3f1f101`). The server settles lazily and the client polled once a minute, so the screen was a minute-old photograph that jumped. `app/utils/hero-quest-battle.ts` projects the run forward — kills, stage, world, Gold, XP, level, live hero and pack HP — with the same pure helpers `settle()` uses and the rate the server served, holding `secondsPerKill` across stage boundaries exactly as `settle()` does. Nothing projected is sent back. This is what the Pixi scene will eventually draw from; it is still placeholder chrome.

Also: `settleHq` returns the shop levels and collections it read under the lock so the routes stop querying them twice (`de4c1bf`).

---

### 27. Status rules revised — **landed 2026-09-15**

Two fixes to `fight.ts` and `status.ts`, written into `classes-and-combat.md` §7.

1. **Boss fights read stat statuses live** (`b96a322`). Buffs and debuffs were applied and replayed but the seeded fight resolved hits, attack intervals and cooldowns from the unbuffed stat block — a PWR buff, a DEF shred or Haste changed nothing in a boss fight. Now PWR and DEF (both sides) and party SPD are read through live statuses at every hit and every timer reset. A caster's own half of an ability lands under `<skillId>_self`, so Enrage's PWR buff and DEF debuff no longer merge into one.
2. **Stat buffs and debuffs refresh instead of stacking** (`55ff15b`), unless the spec sets `stacks` (Frostbind, Iron Skin, two Training Grounds Skills). A buff outlasting its own cooldown otherwise compounds to the stack cap — Haste to ×6 SPD, a −20% debuff to −100%.

Consequence worth re-measuring: any boss-gate verdict from before `b96a322` understated kits built on buffs and debuffs. The idle projection priced them all along, so the fight and the projection now agree more closely than they did.

---

### 28. Global Power Number built, and every collection now raises stats — **landed 2026-09-15**

**GPN is built on the locked formula** (`global-power-number.md`, *As built*): `sqrt(party DPS × party effective HP) × GPN_DISPLAY_SCALE`. The square root was dropped 2026-09-15 to make the number bigger and **restored 2026-09-16** when the bare product overshot — it read as a balance, not a power rating. `GPN_DISPLAY_SCALE = 10` (UNTUNED) does the enlarging instead: a level-1 Hero opens at ~945 and crosses 1,000 in a few levels. Both steps are monotonic, so ranking is untouched either way (§2). Computed on read from the fielded party's real stats and shown as the battle screen's animated headline, with a wiki entry. It can go down, as locked.

**A different design was considered and rejected.** The proposal was an account-wide, never-decreasing number built from collection size and progress ("big number go bigger"). It was dropped because Arena matchmaking compares GPN with a defender's Defense GPN, and a number padded by collection size would stop predicting fights. The locked design stands.

**What came out of it: collection passives for Skills and Artifacts.** Before, only owned Champions and Gear raised stats while benched. Now an owned-but-unequipped Passive Skill or Artifact gives the Hero a tenth of its combat-stat lines, the same ratio Gear uses — which is how the collection reaches GPN without a separate term. Decisions taken with it:

- **Stat lines only** (`COLLECTION_PASSIVE_KINDS`: the six stats, max HP, crit chance, crit damage). Economy, cooldown, damage-taken, shred, control-resist and reflect lines stay equipped-only, so a wide collection cannot stack Gold% or cooldown reduction nobody slotted.
- **Hero only**, for Artifacts too — every collection passive in the game reaches only the Hero, and a party-wide one would multiply a collection by party size.
- **An equipped copy is never counted twice**, and a copy past the purchased slot count pays the unequipped share.
- **Unequipped Active Skills still add nothing** — they have no stat lines. If that feels wrong in play, the fix is to give Actives a stat line, not to widen the passive.

**Deviations, recorded:** GPN is not stored on `hqState` and not written on settle (nothing reads a stored value yet); DPS is against zero DEF and a single target, without projected ability buffs. **Not built:** leaderboard aggregate, profile display, Defense GPN.

New placeholders, all `// UNTUNED ╧`: `SKILL_COLLECTION_PASSIVE_FRACTION`, `ARTIFACT_COLLECTION_PASSIVE_FRACTION`, `EHP_DEF_CONSTANT` (now in use). None of these moves the campaign walk, which fields no collection.

---

## ⚪ Standing numeric tuning — **what is still `// UNTUNED ╧`**

Named constants with a formula shape locked and a placeholder value. Consolidated so a tuning pass has one list. `rg '╧' shared/utils/hero-quest/constants.ts` is the authority — **62 markers** as of 2026-09-15.

~~**Decided: none of this is tuned before playtesting.**~~ **Superseded for the combat and progression block by #22**, which tuned it on the campaign walk. The original reasoning still holds for everything that remains below: the balance script and campaign sim project *what the formulas say*, and a projected value that feels wrong in play is worth less than no value, because it looks settled. What remains is mostly the gacha, shop and ability-magnitude layers, which the campaign walk barely exercises — so they want play data or a different measurement, not another sim pass.

**Do not treat any of these as blocking a phase.**

Two rows are not constants in the strict sense: the archetype stat spreads are a table, and `SEAL_LADDER_BASE_GOLD` *is* specified. Both are listed anyway because the same pass answers them.

**Removed from this table by #22 / #23** (now `TUNED ✓`, derived, or deleted): `K`, `CRIT_CHANCE_PER_POINT`, `CRIT_DAMAGE_PER_POINT`, `SKILL_BASE_COOLDOWN_SECONDS`, `SKILL_BASE_ABILITY_MULTIPLIER`, `WAVE_PACK_SIZE`, `ELITE_PACK_SIZE`, `PACK_LIVE_STREAM_FRACTION`, `BOSS_MINION_COUNT`, `STATUS_MAX_STACKS`, `STATUS_TICK_SECONDS`, `MAX_SUSTAIN_MITIGATION`, `MIN_SECONDS_PER_KILL`, and `GOLD_PRESTIGE_CAP` / `prestigeGoldFactor[]` (deleted).

| Constant(s) | Doc | Note |
|---|---|---|
| Offline Efficiency / Offline Cap `BASE_COST` (×2) | `idle-mechanics.md` §4 | Formula shapes locked, no anchor value |
| `K_ATTACK`, `K_DEFEND`, `MEDAL_BASE_WIN`, `MEDAL_BASE_LOSS`, `MEDAL_UPSET_BONUS`, `ARENA_MATCH_BAND_PCT`, `ARENA_SHOP_GEM_PRICE` | `arena.md` | `ARENA_MATCH_BAND_PCT` also a design question, see #2 — set it against GPN's root form (#28, restored 2026-09-16); the flat `GPN_DISPLAY_SCALE` cancels in a ratio, so a percentage band means the same before and after it. `ARENA_SHOP_GEM_PRICE` has an explicit calibration target (under 1 Battle Speed block per day's Medals) |
| `EHP_DEF_CONSTANT` | `global-power-number.md` §2 | Built (#28). At 10 a level-1 Hero's DEF doubles its EHP; tune against how balanced parties should read against lopsided ones |
| `SKILL_COLLECTION_PASSIVE_FRACTION`, `ARTIFACT_COLLECTION_PASSIVE_FRACTION` | none — see #28 | What an unequipped Passive Skill or Artifact gives the Hero, as a fraction of equipping it. 0.1 mirrors Gear; tune together with `GEAR_PASSIVE_COEFFICIENT` so all three collections feel comparable |
| `RAID_BASE_STATS`, `RAID_LEVEL_GROWTH`, `RAID_REWARD_BASE/GROWTH`, `RAID_ENRAGE_SECONDS`, `RAID_RAMPAGE_DMG/POWER_BASE/GROWTH` | `raid-system.md` | Per-raid |
| `SLOT_BASE_BONUS` ×6, `GEAR_PASSIVE_COEFFICIENT` | `gear-equipment.md` §2 | Built. The six slot coefficients are deliberately *identical* — no doc ranks the stats against each other, so six different values would encode a spread nobody decided. `GEAR_PASSIVE_COEFFICIENT` must stay well under them or manual equip stops mattering |
| `SKILL_PASSIVE_MAGNITUDE[]`, `SKILL_ECONOMY_COEFFICIENT` | `skills-gacha.md` §4 | The whole 36-skill magnitude ladder, indexed by rarity. §4 authors it as "small" → "large" and assigns no number anywhere; the *relative ordering* is design content, so retune the set rather than entries |
| `SKILL_POTENCY_PER_POINT` | none — see #18 | What one point of a Skill copy's `(star × 10 + level)` scalar adds to its effect potency. **Identity at minimum**, so §4's authored bands stay the reference and only levelling multiplies up — ×2.18 at 5★/Lv10 on the placeholder. Its own constant rather than reusing `CHAMPION_INVESTMENT_PER_POINT` (×3.95 at max) because a Champion's scalar is its *only* growth axis while a Skill already carries a rarity band |
| `GOLD_BURST_MINUTES[]`, `GOLD_BURST_COOLDOWN_SECONDS` | `gold-economy.md` §6 | Burst size in minutes of income, and the cadence it repays over. The cooldown is a **decision, not a transcription** — at the shared 6.4s skill base, a 0.5-minute burst repays ~+470% Gold, two orders past §5's ×3 stack target |
| `SKILL_COOLDOWN_REFUND_FRACTION` | none — see #18 | How much shorter a "chance to refund / reset / re-trigger" Active's cooldown is rendered as. One constant for all three such Skills, so the approximation retunes in one place |
| `WEALTH_FACTOR_MIN/MAX`, `WEALTH_NEUTRAL_HOURS` | `skills-gacha.md` §4¹ | The Gambler's Strike family's bounded modulation. §4¹ suggests ×0.5–×2.0 explicitly and calls it not locked; the neutral point is where the factor passes through 1.0 |
| `ARTIFACT_EFFECT_PER_POINT`, `ARTIFACT_ECONOMY_COEFFICIENT` | `artifacts-dig-site-gacha.md` §6 | Per *point* of the investment scalar, unlike Skills' flat magnitude — §6 states the scaling for Artifacts and no doc states it for Skills. See #18's closing note |
| `SKILL_SLOT_BASE_COST`/`_GROWTH`, `ARTIFACT_SLOT_BASE_COST`/`_GROWTH` | `skills-gacha.md` §6, `artifacts-dig-site-gacha.md` §7 | Both mirror the Champion slot track exactly, so all three want deriving together — and all three compete with the two offline tracks for the same Void Shards |
| `GOLD_STEP_BASE`, `BASE_GOLD`, `GOLD_PLATFORM_DISCOUNT` | `gold-economy.md` §3, §3a | **Carry no marker but are open** — see #23.3. `GOLD_TENURE_CEILING` is generated, never tuned by hand: regenerate from `scripts/lib/economy-stages.ts` |
| `SEAL_LADDER_GROWTH[]` | `gold-economy.md` §7 | Set, but calibrated against the superseded Gold anchors — see #23.2 |
| `LOADOUT_SLOT_BASE_COST_GEMS` (8-level doubling) | `loadouts.md` §3 | Built. Two firsts at once, which §3 flags as a genuine unknown: the first time the doubling short-track shape stretches past 5 levels (128× the base at the top), and the first time it is paired with Gems. Now checkable against real Gem income (Trait/Arena sinks exist) |
| `ONLINE_THRESHOLD_MS`, refresh interval | `tech-architecture.md` §9 | |
| `MAX_EVASION` | `classes-and-combat.md` §7 | **Locked at 0.60** — not open, listed for completeness |
| `OVERFLOW_CONVERSION_RATE` | `classes-and-combat.md` §7 | The only crit constant still untuned. Rarely reachable: with LCK off the level curve only a deliberately built crit Hero passes 100% |
| `SEAL_GRANT_PER_BOSS`, `SEAL_GRANT_PER_WORLD_CLEAR`, `SEAL_GRANT_PER_PRESTIGE` | `economy-and-currencies.md` §5 | The milestone batch sizes. Doc gives only the shape — "small per World clear, larger per Prestige" — and defers the values to the world/enemy pass (#6). Built and paying out |
| `SEAL_GRANT_INTERVAL_HOURS`, `SEAL_GRANT_AMOUNT`, `SEAL_GRANT_BANK_CAP_DAYS` | `economy-and-currencies.md` §5 | The free time-gated grant. Sets the floor on pull income for a player who never spends Gold, so it bounds how slow the collection loop can get |
| `FREE_PULLS_PER_DAY`, `FREE_PULL_COOLDOWN_MINUTES` | none — session-1 playtest | Two free 10-pulls per gacha per day on a 30-minute cooldown, on top of the daily grant. With it a gacha gets 9 Seals plus 20 free pulls a day, ×4 systems; the collection curve, Essence income and crafting economy have not been re-derived against that |
| `VOID_SHARD_BASE`, `VOID_SHARD_GROWTH` | `economy-and-currencies.md` §3 | 100 × 2^prestige, the doc's "starting point". Only has to outpace shop costs, so derive it alongside the slot and offline tracks it pays for — and note that at ~a week per prestige (#22) the first shop purchase is a week in |
| `wealthFactor` clamp range for Gambler's Strike family | `skills-gacha.md` §4 | Suggested ×0.5–×2.0, not locked |
| `CHAMPION_SLOT_BASE_COST`, `CHAMPION_SLOT_COST_GROWTH` | `champions-guild-gacha.md` §1 | Void Shard price of party slots 3→5. Competes directly with the two offline tracks for the same currency, so all three want deriving together |
| `CHAMPION_PASSIVE_PER_POINT` | `champions-guild-gacha.md` §7 | The §7 collection passive. Doc fixes which archetype buffs which stat and states no magnitude anywhere. At 0.002 one maxed Champion is +12% to its archetype's stats, and the full 48-Champion roster maxed (12 per archetype) is +144% on each of the six |
| `CHAMPION_INVESTMENT_PER_POINT` | `champions-guild-gacha.md` §2 | What a copy's `star × 10 + level` scalar is worth. Sets the payoff on dupe levelling, so it decides whether pulling wide or levelling deep is correct |
| Archetype base stat spreads (`ARCHETYPE_DEFINITIONS[].spread`) | `champions-guild-gacha.md` §2 | Not a constant but the same problem: §2 states outright there is no Champion equivalent of the Hero's §2 table, so all four spreads are a reading of the archetype identities rather than a specified number |
| `SEAL_LADDER_BASE_GOLD` | `gold-economy.md` §7 | Doc-specified at 1,000,000. Uncapped per day by design — see the note below |
| `TANK_THREAT_MULTIPLIER`, `TAUNT_THREAT_MULTIPLIER` | none — see #14 | How hard the two documented aggro anchors pull. Any value above 1 already puts a Tank in front of its row-mates; the magnitude only starts mattering once threat becomes contested and continuous |
| `FROSTBIND_STACKS_PER_CAST`, `FROSTBIND_FREEZE_STACKS` | none — see #15 | How fast Frostbind's slow builds and how deep it must get before the freeze lands. Two dials so time-to-freeze can be retuned from either end; a threshold above `STATUS_MAX_STACKS` turns the freeze off entirely |
| The `SKILL_*` magnitude set, `ENRAGE_*`, `KILL_SHOT_CRIT_MULTIPLIER`, `EXECUTE_BONUS`, `FOCUSED_BARRAGE_HITS`, `REVIVE_HP_FRACTION` | none — see #15 | Every ability magnitude in the game. Both rosters describe effects entirely in prose ("a short duration", "a portion", "small") and assign no numbers anywhere. The *relative ordering* is design content and deliberate — wide AoE pays for reach, a pierce beats a basic attack by a little — so retune the set, not individual entries. `HASTE_SPD_BONUS` is excluded: §3 states the doubling |

**On `SEAL_LADDER_BASE_GOLD` — reviewed and closed.** Gold buys nothing in the game except Seals, so this price is the entire Gold sink. The campaign sim banks ~4.9B Gold by prestige 4, which at the base rung and `SEAL_LADDER_GROWTH[champion] = 1.0007` converts to roughly **2,100 Seals in a single sitting** — about two full 1,066-dupe Champions — because `MAX_SEALS_PER_PURCHASE` bounds the per-call size and nothing bounds the per-day total.

**That is intended, and no daily cap is being added.** A player willing to spend an exponentially increasing amount of Gold should be able to keep buying; the ladder's compounding *is* the brake, and it is a smooth one rather than a wall that stops the session dead. Converting a large Gold pile into a large collection is what the pile is for. `SEAL_LADDER_BASE_GOLD` stays an ordinary tuning value in the table above, calibrated at playtest against real Gold income like everything else — not a structural problem to solve first.

---

## Suggested order

1. ~~**Phase 3 — the remaining three gachas**~~ **Done — see #18.** The fold is deleted rather than narrowed, and the ability-effects pass that used to sit at step 3 was absorbed: the 18 Training Grounds Actives were authored against the *existing* `AbilityEffect` descriptor, which is what the effects pass was for.
2. **Close out the tuning pass (new, 2026-09-15)** — small, and it should come before anything is built on top of the loop:
   - **Play a session against the tuned loop** and log it in `playtest-notes.md`. The predictions table there is refreshed; session 1 is the only one on record.
   - **Decide the Gold consequences (#23)** — first-week income, the lost calendar anchors, and whether the Seal ladder is re-derived now or after world design.
   - **Confirm the solo shape (#22.1)** — no prestige without a party is a consequence of the design, not yet a stated choice.
   - ~~**Check the cleared-run manual re-engage** flagged in #25.~~ Fixed.
3. **World & Enemy Design (#6)** — names, themes and rosters done 2026-09-15 (closing #5). What remains is art direction and production, and the optional enemy-kit question; kits that change fight length have to be re-measured against #22.
4. **The four remaining quick calls (#1-4)** — all answerable in one short pass, none depend on anything else.
5. **Phase 4 — endgame systems** (`implementation-plan.md`). Raids, Traits, Arena, Holidays, Battle Speed, plus `loadouts.md` §4's per-raid auto-apply. ~~GPN~~ built (#28); the leaderboard aggregate and Defense GPN remain, with Arena.
6. **Passive Skill Tree (#7)** — the last unbuilt major system; good candidate for its own dedicated session.
7. **Playtest, then tune the rest.** The combat and progression block is tuned (#22); the gacha, shop, economy and ability-magnitude constants are settled here — see the standing-tuning section. The balance script and campaign sim stay in use throughout.

**On the playtest step's position.** Tuning the *remaining* constants wants every system present, so the last step is still the right place to *finish*. But the loop itself was tuned on the sim alone, and `implementation-plan.md` Phase 1's "stop here and actually play it before continuing" has now been overridden three times. The harness (#19) makes a session cheap, and world design is downstream of it — nothing settles how long a world should take like having felt one. That is why step 2 exists.

---

## 🔬 Watch during playtest

Things that are **built and working** but whose *feel* has never been observed against a real session. None of these is a bug or a blocked decision, so none belongs in the lists above — they are the questions only playing the game can answer.

**Raw observations go in `playtest-notes.md`, not here.** This section holds the questions and, eventually, the decisions; that file holds what actually happened. The split matters later: this doc will say *what* was changed, and that one will say *why it felt wrong*, which is the half that normally evaporates. It also carries the sim's falsifiable predictions and the known-inert list, so a session does not burn time re-deriving either.

### Champion rarity modifier — is a Mythic too far ahead of a Common?

`RARITY_STAT_MULTIPLIER` (Common 1.0 → Mythic 2.5) is doc-specified, and taken alone it is a reasonable spread. The thing to watch is that it is **no longer the only thing rarity buys.** As of #12 a Mythic also brings three abilities to a Common's one, and its higher stats shorten its own cooldowns on top of that. Three multiplicative payoffs now ride a single rarity roll:

| Payoff | Source | Common → Mythic |
|---|---|---|
| Stat magnitude | `RARITY_STAT_MULTIPLIER` | ×2.5 |
| Ability count | `RARITY_ABILITY_COUNT` (§2) | ×3 |
| Ability throughput | SPD → `cooldownFor`, emergent | unquantified |

The compounded gap was never the number anyone signed off on — ×2.5 was. Watch for whether a single Mythic pull trivialises a stretch of the run, whether a Common ever feels worth fielding once one Mythic is owned, and whether the gacha reads as rewarding or as a wall you cannot pass without a lucky roll. If it lands too hard, the cheapest lever is compressing `RARITY_STAT_MULTIPLIER` rather than touching ability counts, since the counts carry the kit identity and the multiplier carries nothing but itself.

Worth re-checking specifically **after** the ability-effects pass (#12) lands, since real Support and Control effects will change what a second and third ability are actually worth.

**Status: reviewed, no change.** Left as-is deliberately — the compounding is a plausible design and the alternative is guessing at a correction before anyone has felt the problem. Revisit here, with play data, not before.

### Does a slow wall read better than a hard one?

`MIN_DAMAGE` (#11.5) changed what hitting a wall *looks like*: instead of standing immortal dealing exactly nothing, an outmatched party now chips for 1 and wipes, and the same stage restarts without losing ground. Wall positions did not move.

The open question is purely about feel. A wipe-and-retry loop communicates "you are too weak here" far more clearly than a frozen zero, but it also means the player watches the party die repeatedly, which reads as punishing in a way an idle game may not want. Watch whether the wipe loop is legible or just demoralising, and whether "1 damage" reads as *nearly there* — a misleading signal, since 1 damage against exponential HP is not nearly anywhere. If it misleads, the display is the lever rather than the constant: showing time-to-kill instead of raw damage tells the truth without changing the model.

*(Added 2026-09-15: the tuning pass made both of these more concrete. Boss gates are now the only walls in a party's first prestige, and hero DEF paces enemy PWR exactly, so the `MIN_DAMAGE` chip is now a far-side-of-a-wall reading rather than something normal play shows. Elite wave wipes at the World 1 opening for a solo account are the one place a player will reliably watch the wipe loop.)*

### Is a week-long first prestige the right rhythm? — **new, from #22**

The loop was slowed from hours to about a week for a party of three, and nearly all of that week is idle waiting in front of Stage 5 and Stage 10 gates — fighting is ~3 hours of it. Watch whether the grind reads as anticipation (come back tomorrow, the boss falls) or as a stall, whether players understand *why* they are waiting (the stat breakdown, #26, is the in-game answer), and whether a first Void Shard purchase a week in is too late to feel the prestige shop at all. `XP_PACE_SLACK` is the dial for grind length without touching fight length.

### Do automatic boss fights keep the one moment of attention? — **new, from #25**

Bosses were the only thing that waited for the player. They now fire on their own while the tab is visible. Watch whether a boss still feels like an event when the player did not start it, whether the auto-closing replay is long enough to see what happened, and whether players miss the button.

### Does Gold feel like anything in week one? — **new, from #23**

A first-week account earns at most ~15K Gold an hour before Gold%, and the campaign walk's party averages nearer 1K (#23.3), and Gold buys only Seals. Watch whether the Gold ladder is ever used before week two, and whether the number reads as an income at all next to the platform's other games.

### The whole standing-tuning table

Every remaining `// UNTUNED ╧` constant is a playtest deliverable rather than a pre-phase chore — see the standing-tuning section for the reasoning. The watchlist is where they get answered.
