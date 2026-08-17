# Design Doc Index

Master navigation for the project. **23 files**: 18 design docs (all **Locked** except `idea-backlog.md`, a running list) plus 5 project-meta docs catalogued in §1a.

> **Read first:** `open-items.md` lists everything still open — design questions, undesigned passes, and the standing constant-tuning list. Anything below marked ⚠️ points at a section two docs disagree about; there are currently none outstanding.

---

## 1. Document Catalog

Ordered roughly by dependency — earlier docs are prerequisites for later ones.

| # | Doc | Owns | Depends on |
|---|---|---|---|
| 1 | `core-progression-and-prestige.md` | Enemy curve, 10×10 run structure, stage archetypes, fail states, prestige reset table, prestige shop | — |
| 2 | `classes-and-combat.md` | 16-node class tree, 6-stat spread (+HP, +EVA), cooldown system, damage/crit/HP math, targeting, formation | 1 |
| 3 | `gacha-shared-system.md` | Rarity tiers, gacha leveling 1–10, drop rates, dupes/stars, crafting, Essence naming | — |
| 4 | `champions-guild-gacha.md` | 48 Champions, 4 archetypes, PWR model, 28-ability pool, naming, passive collection bonus | 2, 3 |
| 5 | `skills-gacha.md` | Training Grounds, 36 skills (18 Active / 18 Passive), universality rules, slot unlocks, UI split | 2, 3 |
| 6 | `artifacts-dig-site-gacha.md` | 48 Artifacts, 4 effect categories, 33-effect pool, party-wide passives, stacking | 3, 4 |
| 7 | `gear-equipment.md` | The Forge (4th gacha), 6 Hero slots, 36 pieces, single-stat model, rarity progression guarantee, manual equip | 2, 3 |
| 8 | `idle-mechanics.md` | Idle vs active, auto-battle, Battle Speed, offline formula, offline cap/efficiency, boss wall | 1, 2 |
| 9 | `gold-economy.md` | Gold curve, calendar anchors, throughput floor, Seal price ladder, burst denomination | 1, 3, 8 |
| 10 | `economy-and-currencies.md` | Consolidated currency list, Gold/Gems/Void Shards/Seals/Essence/Trait Gems/Keys/Medals | 1, 3, 9 |
| 11 | `raid-system.md` | 5 raids, level ladders, Keys, quick-clear, 4 fight types, rampaging boss | 4–7, 10 |
| 12 | `traits.md` | 5 trait slots, roll/lock, 8 stats × 9 grades, 5 Sets, save slots | 2, 10, 11 |
| 13 | `loadouts.md` | Loadout snapshot contents, save/apply, 2→10 slots, per-raid auto-apply | 4–7, 11 |
| 14 | `global-power-number.md` | GPN formula, EHP definition, live-snapshot behavior, what flows in | 2, 4, 8 |
| 15 | `arena.md` | Async PvP, Defense GPN, matchmaking, Training Dummy, Elo, Medals, Arena Shop, seasons | 13, 14 |
| 16 | `holiday-events.md` | Holiday calendar, claim windows, gift bundle structure | 9, 10 |
| 17 | `tech-architecture.md` | Integration path, shared logic layout, schema, server authority, API surface, tests, client | all |
| 18 | `idea-backlog.md` | Running idea list with implementation checkboxes | — |

---

## 1a. Project-Meta Docs

Not design docs — they describe the *state* of the project rather than the game. Unnumbered deliberately, so the dependency numbering above stays stable.

| Doc | Owns | When to read it |
|---|---|---|
| `index.md` | This file — catalog, topic lookup, currency/formula indexes, roster sizes | Any time you need to find where something is specified |
| `open-items.md` | Every open question, undesigned pass, and untuned constant. **The freshest doc in the project** | Before implementing anything numeric or contested; before starting a design session |
| `implementation-plan.md` | 5-phase build order, per-phase scope + deferral lists, how to brief Claude Code | Before writing any code |
| `asset-list.md` | Full art/VFX/icon/background production list, all 10 fidelity decisions locked | Art production planning; blocked on world design for enemies + backgrounds |
| `playtest-notes.md` | Raw session observations, the sim's falsifiable predictions, and what is known-inert so it isn't chased | While playing; and before any tuning pass, since it holds the *why* behind what `open-items.md` decided |

`CLAUDE.md` (the implementation brief for Claude Code) lives with the code, not here.

---

## 2. Topic → Location Lookup

### Core loop & progression
| Topic | Doc | § |
|---|---|---|
| Enemy scaling `b^n` (continuous index) | `core-progression-and-prestige.md` | §1 |
| Elite / boss / super-boss stat modifiers | `core-progression-and-prestige.md` | §1 |
| Stage archetypes (waves / boss / elite / super boss) | `core-progression-and-prestige.md` | §2 |
| Kill count (`BASE_KILL_COUNT` = 30), boss timer (30s) | `core-progression-and-prestige.md` | §2 |
| Fail state / soft fallback | `core-progression-and-prestige.md` | §2 |
| What resets on prestige (run position only — level persists) | `core-progression-and-prestige.md` | §3 |
| Void Shards earning formula | `core-progression-and-prestige.md` §4, `economy-and-currencies.md` §3 | |
| Prestige shop track list | `core-progression-and-prestige.md` | §4 |
| World themes (fixed pool, no reskins) | `core-progression-and-prestige.md` | §5 |
| Class-switch rules at prestige (no level reset) | `classes-and-combat.md` | §5 |

### Combat
| Topic | Doc | § |
|---|---|---|
| 16-node class tree + skill per node | `classes-and-combat.md` | §1 |
| 6 stats (PWR/SPD/LCK/IMP/VIT/DEF) + per-class spreads | `classes-and-combat.md` | §2 |
| Flat cooldowns, SPD reduces cooldown | `classes-and-combat.md` | §3 |
| Everything auto-casts — no manual mode *(toggle deleted game-wide, `tech-architecture.md` §9.2)* | `classes-and-combat.md` | §3 |
| Leveling vs specializing | `classes-and-combat.md` | §4 |
| Formation, front/back rows | `classes-and-combat.md` §6, `champions-guild-gacha.md` §8 | |
| Damage formula + clamped mitigation (PWR-based) | `classes-and-combat.md` | §7 |
| Crit (LCK linear, IMP damage, overflow conversion) | `classes-and-combat.md` | §7 |
| HP = baseHP + VIT × HPperVIT | `classes-and-combat.md` | §7 |
| Multi-strike (Hunter triple, Beast Master quad) | `classes-and-combat.md` | §7 |
| Autoattack targeting — Hero paths | `classes-and-combat.md` | §7 |
| Autoattack targeting — Champion archetypes | `champions-guild-gacha.md` | §8 |
| Champion damage/heal/debuff via PWR | `champions-guild-gacha.md` | §2 |

### Gacha (all four)
| Topic | Doc | § |
|---|---|---|
| 6 rarity tiers + colors | `gacha-shared-system.md` | §1 |
| Gacha leveling curve, pulls-to-level table | `gacha-shared-system.md` | §2 |
| Drop rate table per gacha level | `gacha-shared-system.md` | §3 |
| Pull cost, 10-pull discount, extra-Seal ladder | `gacha-shared-system.md` §4, `gold-economy.md` §7 | |
| No pity | `gacha-shared-system.md` | §5 |
| `dupesToLevelUp`, stars, 1,066-dupe max | `gacha-shared-system.md` | §6 |
| Crafting + Essence value/cost (×5 per tier) | `gacha-shared-system.md` | §6 |
| Champions: 48 roster, archetypes, ability pool | `champions-guild-gacha.md` | §1, §6 |
| Champions: naming convention | `champions-guild-gacha.md` | §5 |
| Champions: passive collection bonus → Hero | `champions-guild-gacha.md` | §7 |
| Skills: 36 roster, Active/Passive split | `skills-gacha.md` | §3, §4 |
| Skills: universality rule (path-agnostic buckets) | `skills-gacha.md` | §3 |
| Skills: equip rules, no duplicate slotting | `skills-gacha.md` | §5 |
| Skills: square vs circle UI convention | `skills-gacha.md` | §7 |
| Artifacts: 4 categories, 33-effect pool | `artifacts-dig-site-gacha.md` | §2, §3 |
| Artifacts: stacking rules, no set bonuses | `artifacts-dig-site-gacha.md` | §4 |
| Gear: 6 slots + stat mapping | `gear-equipment.md` | §1 |
| Gear: `equippedBonus` / `passiveBonus` formulas | `gear-equipment.md` | §2, §3 |
| Gear: rarity progression guarantee (6× ceiling) | `gear-equipment.md` | §2 |
| Slot progression 2→5 (Champion / Skill / Artifact) | `champions-guild-gacha.md` §1, `skills-gacha.md` §6, `artifacts-dig-site-gacha.md` §7 | |

### Economy
| Topic | Doc | § |
|---|---|---|
| Full currency list | `economy-and-currencies.md` | §1 |
| Gold curve + calendar anchors | `gold-economy.md` | §3 |
| Throughput floor `MIN_SECONDS_PER_KILL` | `gold-economy.md` §4, `idle-mechanics.md` §4 | |
| Gold% stacking policy | `gold-economy.md` | §5 |
| Gold bursts denominated in earn-time | `gold-economy.md` | §6 |
| Per-gacha daily Seal price ladder | `gold-economy.md` | §7 |
| Gambler's Strike wealth-factor redesign | `gold-economy.md` §8, `skills-gacha.md` §4¹ | |
| Gold sinks | `economy-and-currencies.md` | §2 |
| Void Shards source/sinks | `economy-and-currencies.md` | §3 |
| Gems source/sinks | `economy-and-currencies.md` | §4 |
| Seal earn sources (milestone / daily / raid) | `economy-and-currencies.md` | §5 |
| Essence source/sink | `economy-and-currencies.md` | §6 |
| Trait Gems | `economy-and-currencies.md` | §8 |
| Raid Keys (×5) | `economy-and-currencies.md` §9, `raid-system.md` §3 | |
| Arena Medals | `economy-and-currencies.md` §10, `arena.md` §5 | |

### Idle & offline
| Topic | Doc | § |
|---|---|---|
| Idle-native vs active systems | `idle-mechanics.md` | §1 |
| Auto-battle, stage auto-advance | `idle-mechanics.md` | §2 |
| Battle Speed tiers, durations, Gem prices | `idle-mechanics.md` | §3 |
| Battle Speed scope — everywhere except Arena; offline applies to wave accrual only | `idle-mechanics.md` §3, `tech-architecture.md` §4b/§9.3 | |
| Offline formula, cap (8→72h), efficiency (50→100%) | `idle-mechanics.md` | §4 |
| Upgrade cost curves (doubling / 1.72^) | `idle-mechanics.md` | §4 |
| Boss wall — offline never engages a boss | `idle-mechanics.md` | §5 |

### Endgame & side systems
| Topic | Doc | § |
|---|---|---|
| Raid roster, pairing, fight types | `raid-system.md` | §1, §7 |
| Raid difficulty ladder | `raid-system.md` | §2 |
| Keys: 3/day, bank 21, win-gated | `raid-system.md` | §3 |
| Quick-clear | `raid-system.md` | §4 |
| Raid rewards formula | `raid-system.md` | §6 |
| Rampaging Boss (unkillable, level-on-damage) | `raid-system.md` | §7 |
| Trait roll mechanics + cost `5 + locked×5` | `traits.md` | §2 |
| Trait grade probability table | `traits.md` | §2 |
| Trait stat values by grade | `traits.md` | §4 |
| Trait Sets (5) | `traits.md` | §5 |
| Trait save slots (Gems 250/750/1250) | `traits.md` | §6 |
| Loadout contents (5 components) | `loadouts.md` | §1 |
| Loadout slots 2→10, Gems | `loadouts.md` | §3 |
| Per-raid loadout auto-apply | `loadouts.md` | §4 |
| GPN formula `sqrt(DPS × EHP)` | `global-power-number.md` | §2 |
| What flows into GPN | `global-power-number.md` | §4 |
| Arena defense loadout, Defense GPN | `arena.md` | §1, §2 |
| Training Dummy fallback | `arena.md` | §2a |
| Arena attempts (5/day, non-banking) | `arena.md` | §3 |
| Asymmetric Elo | `arena.md` | §4 |
| Arena Shop, seasons, battle log, leaderboard | `arena.md` | §6–9 |
| Holiday calendar + claim window | `holiday-events.md` | §1, §2 |
| Holiday gift bundle structure | `holiday-events.md` | §3 |

### Implementation
| Topic | Doc | § |
|---|---|---|
| Platform integration path | `tech-architecture.md` | §1 |
| `shared/utils/hero-quest/` layout, big numbers | `tech-architecture.md` | §2 |
| Database schema | `tech-architecture.md` | §3 |
| Lazy settle contract | `tech-architecture.md` | §4a |
| Online/offline threshold | `tech-architecture.md` | §4b |
| Seeded boss fights + client replay | `tech-architecture.md` | §4c |
| Arena resolution | `tech-architecture.md` | §4d |
| API route list | `tech-architecture.md` | §5 |
| Tests + balance script | `tech-architecture.md` | §6 |
| Client pages + Pixi scene | `tech-architecture.md` | §7 |

---

## 3. Currency Index

| Currency | Type | Source | Sink | Spec |
|---|---|---|---|---|
| **Gold** | Platform, universal | Idle kill farming (own bounded curve) | Seal ladder; Arena Shop purchases | `gold-economy.md`, `economy-and-currencies.md` §2 |
| **Gems** | Platform, universal | Milestones, Holiday gifts, Arena Shop | Battle Speed, Loadout slots, Trait save slots, Arena refresh/attempts | `economy-and-currencies.md` §4 |
| **Void Shards** | Prestige | Full World 10/Stage 10 clear only | Prestige shop (stats, offline, slots, kill-count, Key rates) | `economy-and-currencies.md` §3 |
| **Guild Seals** | Pull | Milestones, daily grant, Guild Raid, Arena Shop, Gold ladder | Champion pulls | `champions-guild-gacha.md` §3 |
| **Skill Seals** | Pull | same pattern + Training Grounds Raid | Skill pulls | `skills-gacha.md` §2 |
| **Excavation Seals** | Pull | same pattern + Dig-site Raid | Artifact pulls | `artifacts-dig-site-gacha.md` §5 |
| **Forge Seals** | Pull | same pattern + Forge Raid | Gear pulls | `gear-equipment.md` §4 |
| **Champion / Skill / Artifact / Gear Essence** | Crafting | Post-max (5★ Lv10) duplicates only | Crafting a specific item | `gacha-shared-system.md` §6 |
| **Trait Gems** | Roll | Trait Raid | Roll action, trait save/load | `economy-and-currencies.md` §8 |
| **Guild / Skill / Excavation / Forge / Trait Keys** | Entry | 3/day per raid (banks to 21), Arena Shop | Raid entry (win-gated, except Trait) | `economy-and-currencies.md` §9 |
| **Arena Medals** | Reward | Arena attacks (attacker only), Training Dummy wins | Arena Shop | `economy-and-currencies.md` §10 |

---

## 4. Key Formula Index

| Formula | Doc |
|---|---|
| `enemyMultiplier = b^n`, `n = p×100 + (w-1)×10 + (s-1)` | `core-progression-and-prestige.md` §1 |
| `xpPerKill = XP_BASE × (b^XP_STEP_EXPONENT)^n` | `core-progression-and-prestige.md` §1 |
| `prestigeCurrencyEarned = 100 × 2^prestigeCompleted` | `core-progression-and-prestige.md` §4 |
| `mitigation = min(1, DEF / (PWR × K))` | `classes-and-combat.md` §7 |
| `damage = max(0, PWR − DEF/K) × abilityMultiplier` | `classes-and-combat.md` §7 |
| `critChance = min(1, LCK × critChancePerPoint)` + overflow | `classes-and-combat.md` §7 |
| `HP = baseHP + VIT × HPperVIT` | `classes-and-combat.md` §7 |
| `pullsToLevelUp(L) = ⌊10 × 2.6^(L-1) × 1.5⌋` | `gacha-shared-system.md` §2 |
| `dupesToLevelUp(x,y) = round(min((x×10+y) × 1.618, 20))` | `gacha-shared-system.md` §6 |
| `(star × 10 + level)` — the universal power scalar | `gacha-shared-system.md` §6 |
| `goldPerKill = BASE × 1.25^(w-1) × 1.05^(s-1) × prestigeGoldFactor[]` | `gold-economy.md` §3 |
| `secondsPerKill = max(MIN_SECONDS_PER_KILL, EHP / DPS)` | `gold-economy.md` §4, `idle-mechanics.md` §4 |
| `burstGold = MINUTES_OF_INCOME × goldPerHour / 60` | `gold-economy.md` §6 |
| `sealGoldCost(gacha, k) = 1M × GROWTH[gacha]^(k-1)` | `gold-economy.md` §7 |
| `offlineCapHours(level) = 8 + 2 × level` (max 72) | `idle-mechanics.md` §4 |
| `cost(level) = BASE × 2^(level-1)` — short tracks | `idle-mechanics.md` §4 |
| `cost(level) = BASE × 1.72^(level-1)` — offline cap | `idle-mechanics.md` §4 |
| `price(speed, 30min) = 50 × (speed/2)`, ×1.9 per duration step | `idle-mechanics.md` §3 |
| `equippedBonus = SLOT_BASE × RARITY_MULT × (star×10+level)` | `gear-equipment.md` §2 |
| `raidDifficulty(L) = RAID_BASE × RAID_GROWTH^(L-1)` | `raid-system.md` §2 |
| `raidRewardGranted(L) = REWARD_BASE × REWARD_GROWTH^(L-1)` | `raid-system.md` §6 |
| `rollCost(locked) = 5 + locked × 5` | `traits.md` §2 |
| `memberEHP = HP × (1 + DEF / EHP_DEF_CONSTANT)` | `global-power-number.md` §2 |
| `GPN = sqrt(partyEffectiveDPS × partyEffectiveEHP)` | `global-power-number.md` §2 |
| Asymmetric Elo (`K_ATTACK` ≠ `K_DEFEND`) | `arena.md` §4 |
| `medalsOnWin = BASE × (1 + UPSET × (1 − expectedAttacker))` | `arena.md` §5 |

---

## 5. Content Roster Sizes

| System | Count | Breakdown | Authored? |
|---|---|---|---|
| Class nodes | 16 | Beginner + 3 base + 6 Elite + 6 Master | ✅ named, skills named |
| Champions | 48 | 2 per archetype per rarity (4 × 6 × 2) | ❌ names + ability assignment deferred |
| Champion abilities | 28 | 7 per archetype | ✅ named + described |
| Skills | 36 | 6 per rarity, 3 Active / 3 Passive | ✅ full draft |
| Artifacts | 48 | 2 per category per rarity (4 × 6 × 2) | ❌ names + assignment deferred |
| Artifact effects | 33 | Offense 9 / Defense 8 / Tempo 9 / Fortune 7, max reuse 3 | ✅ named + described |
| Gear | 36 | 1 per slot per rarity (6 × 6) | ✅ fully named by the epithet table |
| Traits | 8 stats × 9 grades × 5 sets | — | ✅ all tables transcribed |
| Worlds | 10 | 10 stages each | ❌ **not started** — names, art, enemy rosters |
| Raids | 5 | 4 gacha-paired + Trait | ✅ structure; per-tier mechanic content deferred |
| Holidays | 4 | New Year, Lunar New Year, Halloween, Christmas | ❌ per-holiday bundle contents deferred |

---

## 6. What's Still Genuinely Undesigned

| Item | Status |
|---|---|
| **World & enemy design** (10 worlds, names, art, enemy rosters, boss identities) | The single biggest remaining greenfield pass. Blocks the prestige→calendar calibration in `gold-economy.md` §9 |
| **Passive Skill Tree** | `idea-backlog.md` item 3 — unchecked, no raid assigned |
| **Alternative enemy-scaling formula** | `idea-backlog.md` item 9 — parked, unevaluated |
| **Holiday gameplay events** (limited-time modes) | Explicitly deferred in `holiday-events.md` |
| **Champion / Artifact roster authoring** | Deferred to implementation by design |
| **Per-raid mechanic content** | Fight types locked, specifics deferred |
| **Balance-script calibration pass** | ~30 named constants awaiting values — see `open-items.md`, "Standing numeric tuning" |
