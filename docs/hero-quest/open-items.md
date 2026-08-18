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

Still open here: `b` itself, `XP_STEP_EXPONENT`, and the boss multipliers are all playtest starting points (`// UNTUNED ╧`). **The World & Enemy Design session (#6) still owns the final values** — what's settled is the shape, not the numbers.

That session also referenced "the world doc's §3 difficulty table," implying a worlds document that isn't currently in this project.

---

### 11. Consequences of pooled mitigation and geometric stat growth — **new, from the Phase 1 math pass**

Mitigation is now pooled across the fielded party (`classes-and-combat.md` §7) and Hero stats grow geometrically against the enemy curve (`core-progression-and-prestige.md` §1). Five things surfaced here. **Four are now resolved** and are kept struck-through rather than deleted, because each records a decision and the reasoning behind it; only #3 is still open.

1. ~~**`HqStatBlock` is `number`, not Decimal.**~~ **Resolved — converted.** `HqStatBlock` is now `Record<HqStatKey, Decimal>`, so the float ceiling at hero level ~10,400 is gone (verified finite at level 1,000,000). `UnitStats.spd` and `UnitStats.critMultiplier` moved with it, since SPD and IMP are both unbounded; `critChance` stayed a `number` because it is a probability clamped to [0, 1], and `attacksPerSecond` stayed a `number` because its formula clamps at both ends. Authored class deltas stay plain numbers via the new `HqStatDelta` type — content is converted once, at `baseSpreadFor`, rather than 16 content rows wrapping every entry in `D()`.
2. ~~**Champions add exactly zero survivability.**~~ **Resolved at the Phase 2 kickoff — positional aggro via formation.** The survivability model summed incoming damage *and* HP across the party, so time-to-die was party-size-invariant and the Tank archetype had no mechanical function. Rejected alternatives: pooled party DEF (symmetric with `partyMitigation`, but makes party size a survivability stat, which `combat.ts` refuses by design) and shipping Tank as a stat spread only.

   What this locks: **enemy single-target attacks resolve against the front row and only fall through to the back row when the front is empty or dead** (`classes-and-combat.md` §6, `champions-guild-gacha.md` §8.4 — both already specify exactly this; the model simply never implemented it). Time-to-die therefore stops being party-size-invariant, and a Tank earns its keep by *standing in front*, with no new stat and no new pooling rule. A back-lined Tank's threat modifier stays inert while the front row stands, per §8.4's clarification.

   Consequence for `settle.ts`: `incomingDps` can no longer sum across the whole party. It resolves against the front row, which means the wave-survivability model now reads formation — the first time run position and loadout interact.
3. **DPS is quadratic in the stat curve.** `critMultiplier` scales linearly with IMP while damage scales with PWR, so both compound. Below the crit-chance and attack-rate caps, LCK and SPD scale too and the exponent is nearer 4 — meaning early levels are worth substantially more than late ones, and no single constant expresses that. Capping or flattening the crit-damage contribution is the obvious lever if it proves a problem. **Still open**, and deferred to playtest with the rest of the tuning.

4. ~~**Prestige-shop stat multiplier scope is still undefined**~~ **Resolved by removing the upgrade.** Rather than answer Hero-only vs party-wide, the global stat multiplier is **cut from the prestige shop entirely** — the question only existed because the sink lists named an upgrade nobody had specified, and it was never built (`SHOP_TRACKS` has only Offline Efficiency, Offline Cap and Champion Slots). Struck from the sink lists in `core-progression-and-prestige.md` §4 and `economy-and-currencies.md` §4, from the shop table in `tech-architecture.md` §3, and from the GPN inputs in `global-power-number.md` §3.

   **What this leaves open:** it was one of the multiplicative sources expected to fill the `STAT_PACE_RATIO` shortfall, so that shortfall now has one fewer answer. Void Shards keep their remaining sinks (slots, offline tracks, kill-count reduction, boss-timer extension, Raid Keys), and closing the pace gap falls to the gachas and to `STAT_PER_LEVEL_GROWTH` itself. Revisit at playtest if the run cannot keep pace.
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

**2. The Artifact roster ships with placeholder names, overriding the earlier "do not generate 48 names" guidance.** The Dig-site needs content to roll, and shipping partial would have kept every other gacha paying for content this one had not authored. Names come from a placeholder title pool plus the rarity epithet, the same treatment Worlds already get; `ARTIFACT_TITLES` is the naming pass's one edit. The per-Artifact effect assignment is a shared distribution table, not 48 authored choices, so it is equally re-cuttable.

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

## ⚪ Standing numeric tuning — **all of it deferred to playtest**

Almost all of these are named constants with a formula shape already locked, just waiting on a value. Consolidated so the tuning pass has one list instead of hunting through 20 docs. `SEAL_LADDER_GROWTH[gear]` is no longer here since it's set (`gold-economy.md` section 7).

**Decided: none of this is tuned before playtesting.** Every value below stays at its `// UNTUNED ╧` placeholder until there is a real session to calibrate against. The reasoning is that the balance script and campaign sim can only project *what the formulas say*, and the formulas are still moving — the `MIN_DAMAGE` floor, positional aggro and firing Champion abilities all landed after most of these were first written down. Deriving numbers against a model that keeps changing means deriving them repeatedly, and a projected value that feels wrong in play is worth less than no value at all, because it looks settled.

What this changes in practice: **do not treat any of these as blocking a phase.** They are not a gate on Phase 3, and the "balance-script pass" once listed in the suggested order below is now a playtest activity rather than a prerequisite. The script stays useful for *sanity* — showing that a curve is monotonic, that a wall exists, that income is not absurd — just not for settling values.

Two rows are not constants in the strict sense: the archetype stat spreads are a table, and `SEAL_LADDER_BASE_GOLD` *is* specified. Both are listed anyway because the same pass answers them.

| Constant(s) | Doc | Note |
|---|---|---|
| Offline Efficiency / Offline Cap `BASE_COST` (×2) | `idle-mechanics.md` §4 | Formula shapes locked, no anchor value |
| `K_ATTACK`, `K_DEFEND`, `MEDAL_BASE_WIN`, `MEDAL_BASE_LOSS`, `MEDAL_UPSET_BONUS`, `ARENA_MATCH_BAND_PCT`, `ARENA_SHOP_GEM_PRICE` | `arena.md` | `ARENA_MATCH_BAND_PCT` also a design question, see #2. `ARENA_SHOP_GEM_PRICE` has an explicit calibration target (under 1 Battle Speed block per day's Medals) |
| `EHP_DEF_CONSTANT` | `global-power-number.md` §2 | |
| `RAID_BASE_STATS`, `RAID_LEVEL_GROWTH`, `RAID_REWARD_BASE/GROWTH`, `RAID_ENRAGE_SECONDS`, `RAID_RAMPAGE_DMG/POWER_BASE/GROWTH` | `raid-system.md` | Per-raid |
| `SLOT_BASE_BONUS` ×6, `GEAR_PASSIVE_COEFFICIENT` | `gear-equipment.md` §2 | Built. The six slot coefficients are deliberately *identical* — no doc ranks the stats against each other, so six different values would encode a spread nobody decided. `GEAR_PASSIVE_COEFFICIENT` must stay well under them or manual equip stops mattering |
| `SKILL_PASSIVE_MAGNITUDE[]`, `SKILL_ECONOMY_COEFFICIENT` | `skills-gacha.md` §4 | The whole 36-skill magnitude ladder, indexed by rarity. §4 authors it as "small" → "large" and assigns no number anywhere; the *relative ordering* is design content, so retune the set rather than entries |
| `SKILL_POTENCY_PER_POINT` | none — see #18 | What one point of a Skill copy's `(star × 10 + level)` scalar adds to its effect potency. **Identity at minimum**, so §4's authored bands stay the reference and only levelling multiplies up — ×2.18 at 5★/Lv10 on the placeholder. Its own constant rather than reusing `CHAMPION_INVESTMENT_PER_POINT` (×3.95 at max) because a Champion's scalar is its *only* growth axis while a Skill already carries a rarity band |
| `GOLD_BURST_MINUTES[]`, `GOLD_BURST_COOLDOWN_SECONDS` | `gold-economy.md` §6 | Burst size in minutes of income, and the cadence it repays over. The cooldown is a **decision, not a transcription** — at the shared 8s skill base, a 0.5-minute burst repays +375% Gold, two orders past §5's ×3 stack target |
| `SKILL_COOLDOWN_REFUND_FRACTION` | none — see #18 | How much shorter a "chance to refund / reset / re-trigger" Active's cooldown is rendered as. One constant for all three such Skills, so the approximation retunes in one place |
| `WEALTH_FACTOR_MIN/MAX`, `WEALTH_NEUTRAL_HOURS` | `skills-gacha.md` §4¹ | The Gambler's Strike family's bounded modulation. §4¹ suggests ×0.5–×2.0 explicitly and calls it not locked; the neutral point is where the factor passes through 1.0 |
| `ARTIFACT_EFFECT_PER_POINT`, `ARTIFACT_ECONOMY_COEFFICIENT` | `artifacts-dig-site-gacha.md` §6 | Per *point* of the investment scalar, unlike Skills' flat magnitude — §6 states the scaling for Artifacts and no doc states it for Skills. See #18's closing note |
| `SKILL_SLOT_BASE_COST`/`_GROWTH`, `ARTIFACT_SLOT_BASE_COST`/`_GROWTH` | `skills-gacha.md` §6, `artifacts-dig-site-gacha.md` §7 | Both mirror the Champion slot track exactly, so all three want deriving together — and all three compete with the two offline tracks for the same Void Shards |
| `GOLD_PRESTIGE_CAP`, `prestigeGoldFactor[]`, `MIN_SECONDS_PER_KILL` | `gold-economy.md` §3–4 | Balance-script outputs — need re-derivation post level-persistence (see #10) and post world-design (#6) |
| `LOADOUT_SLOT_BASE_COST_GEMS` (8-level doubling) | `loadouts.md` §3 | Built. Two firsts at once, which §3 flags as a genuine unknown: the first time the doubling short-track shape stretches past 5 levels (128× the base at the top), and the first time it is paired with Gems. Now checkable against real Gem income (Trait/Arena sinks exist) |
| `ONLINE_THRESHOLD_MS`, refresh interval | `tech-architecture.md` §9 | |
| `MAX_EVASION` | `classes-and-combat.md` §7 | **Locked at 0.60** — not open, listed for completeness |
| `K` (mitigation ratio) | `classes-and-combat.md` §7 | |
| `critChancePerPoint`, `critDamagePerPoint`, `overflowConversionRate` | `classes-and-combat.md` §7 | |
| `SEAL_GRANT_PER_BOSS`, `SEAL_GRANT_PER_WORLD_CLEAR`, `SEAL_GRANT_PER_PRESTIGE` | `economy-and-currencies.md` §5 | The milestone batch sizes. Doc gives only the shape — "small per World clear, larger per Prestige" — and defers the values to the world/enemy pass (#6). Built and paying out |
| `SEAL_GRANT_INTERVAL_HOURS`, `SEAL_GRANT_AMOUNT`, `SEAL_GRANT_BANK_CAP_DAYS` | `economy-and-currencies.md` §5 | The free time-gated grant. Sets the floor on pull income for a player who never spends Gold, so it bounds how slow the collection loop can get |
| `wealthFactor` clamp range for Gambler's Strike family | `skills-gacha.md` §4 | Suggested ×0.5–×2.0, not locked |
| `CHAMPION_SLOT_BASE_COST`, `CHAMPION_SLOT_COST_GROWTH` | `champions-guild-gacha.md` §1 | Void Shard price of party slots 3→5. Competes directly with the two offline tracks for the same currency, so all three want deriving together |
| `CHAMPION_PASSIVE_PER_POINT` | `champions-guild-gacha.md` §7 | The §7 collection passive. Doc fixes which archetype buffs which stat and states no magnitude anywhere. At 0.002 the full 12-Champion roster maxed is ≈+36% on each of the six Hero stats |
| `CHAMPION_INVESTMENT_PER_POINT` | `champions-guild-gacha.md` §2 | What a copy's `star × 10 + level` scalar is worth. Sets the payoff on dupe levelling, so it decides whether pulling wide or levelling deep is correct |
| Archetype base stat spreads (`ARCHETYPE_DEFINITIONS[].spread`) | `champions-guild-gacha.md` §2 | Not a constant but the same problem: §2 states outright there is no Champion equivalent of the Hero's §2 table, so all four spreads are a reading of the archetype identities rather than a specified number |
| `SKILL_BASE_COOLDOWN_SECONDS`, `SKILL_BASE_ABILITY_MULTIPLIER` | `classes-and-combat.md` §7 | Shared placeholder pair behind every ability in the game. Newly load-bearing: since #12 these scale Champion kits too, and they set the size of the boss-vs-wave damage gap |
| `SEAL_LADDER_BASE_GOLD` | `gold-economy.md` §7 | Doc-specified at 1,000,000. Uncapped per day by design — see the note below |
| `WAVE_PACK_SIZE`, `ELITE_PACK_SIZE`, `PACK_LIVE_STREAM_FRACTION` | none — see #13 | Enemies per encounter, and how many are still swinging on average. **No doc owns enemies-per-stage**; the model was single-enemy until Stage 1. Offense-neutral by construction, so these move survivability only. Keep the sizes divisors of `BASE_KILL_COUNT` |
| `BOSS_MINION_COUNT` | none — see #13 | A boss's escort. Directly trades against `BOSS_TIMER_SECONDS`: escort HP is time the gate has to cover, and at 2 it already turns the World 1 boss from a pass into a fail |
| `STATUS_MAX_STACKS`, `STATUS_TICK_SECONDS` | none — see #14 | Stack ceiling and the grid periodic effects pay out on. `STATUS_MAX_STACKS` is also what Frostbind's "at max stacks, fully disables" points at, so it is a design number as much as a tuning one |
| `TANK_THREAT_MULTIPLIER`, `TAUNT_THREAT_MULTIPLIER` | none — see #14 | How hard the two documented aggro anchors pull. Any value above 1 already puts a Tank in front of its row-mates; the magnitude only starts mattering once threat becomes contested and continuous |
| `MAX_SUSTAIN_MITIGATION` | none — see #16 | How much of an incoming wave party healing may cancel in the *projection only*. A safety floor rather than a balance dial: at 1.0 a single Support makes the idle model immortal |
| `FROSTBIND_STACKS_PER_CAST`, `FROSTBIND_FREEZE_STACKS` | none — see #15 | How fast Frostbind's slow builds and how deep it must get before the freeze lands. Two dials so time-to-freeze can be retuned from either end; a threshold above `STATUS_MAX_STACKS` turns the freeze off entirely |
| The `SKILL_*` magnitude set, `ENRAGE_*`, `KILL_SHOT_CRIT_MULTIPLIER`, `EXECUTE_BONUS`, `FOCUSED_BARRAGE_HITS`, `REVIVE_HP_FRACTION` | none — see #15 | Every ability magnitude in the game. Both rosters describe effects entirely in prose ("a short duration", "a portion", "small") and assign no numbers anywhere. The *relative ordering* is design content and deliberate — wide AoE pays for reach, a pierce beats a basic attack by a little — so retune the set, not individual entries. `HASTE_SPD_BONUS` is excluded: §3 states the doubling |

**On `SEAL_LADDER_BASE_GOLD` — reviewed and closed.** Gold buys nothing in the game except Seals, so this price is the entire Gold sink. The campaign sim banks ~4.9B Gold by prestige 4, which at the base rung and `SEAL_LADDER_GROWTH[champion] = 1.0007` converts to roughly **2,100 Seals in a single sitting** — about two full 1,066-dupe Champions — because `MAX_SEALS_PER_PURCHASE` bounds the per-call size and nothing bounds the per-day total.

**That is intended, and no daily cap is being added.** A player willing to spend an exponentially increasing amount of Gold should be able to keep buying; the ladder's compounding *is* the brake, and it is a smooth one rather than a wall that stops the session dead. Converting a large Gold pile into a large collection is what the pile is for. `SEAL_LADDER_BASE_GOLD` stays an ordinary tuning value in the table above, calibrated at playtest against real Gold income like everything else — not a structural problem to solve first.

---

## Suggested order

1. ~~**Phase 3 — the remaining three gachas**~~ **Done — see #18.** The fold is deleted rather than narrowed, and the ability-effects pass that used to sit at step 3 was absorbed: the 18 Training Grounds Actives were authored against the *existing* `AbilityEffect` descriptor, which is what the effects pass was for.
2. **World & Enemy Design (#6)** — the largest remaining greenfield design item. Resolves #5 (world naming) and settles the enemy-curve values parked in #10.
3. **The four remaining quick calls (#1-4)** — all answerable in one short pass, none depend on anything else.
4. **Phase 4 — endgame systems** (`implementation-plan.md`). Raids, Traits, Arena, Holidays, Battle Speed, plus the two things Phase 3 deliberately left: `global-power-number.md` and `loadouts.md` §4's per-raid auto-apply.
5. **Passive Skill Tree (#7)** — the last unbuilt major system; good candidate for its own dedicated session.
6. **Playtest, then tune.** The full constant list is settled here and nowhere earlier — see the standing-tuning section. The balance script and campaign sim stay in use throughout for sanity checks, not for picking values.

**On that last step's position in this list.** It is written sixth because tuning wants every system present, and that is still the right place to *finish*. But it is no longer the right place to *start*: `implementation-plan.md` Phase 1 says "stop here and actually play it before continuing", which this order has now overridden twice, and the harness (#19) removed the practical obstacle that made overriding it reasonable. Playing before step 2 is cheap now and World design is partly downstream of it — nothing settles how long a world should take like having felt one. Read step 6 as "the tuning pass lands here", not "nobody plays until then".

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

### The whole standing-tuning table

Every `// UNTUNED ╧` constant is now explicitly a playtest deliverable rather than a pre-phase chore — see the standing-tuning section for the reasoning. The watchlist is where they get answered.
