# Hack Ops — Gem Farming Analysis

Analysis of theoretical max gem gain in the Hack Ops game, based on `shared/utils/hack-config.ts`
and `server/api/hack/ops/{dispatch,collect}.post.ts`.

## Mechanics recap

- **Success roll**: `min(1, max(0, (power/minPower - 0.1) / 1.3))`. Needs `power ≥ 1.4× minPower`
  for guaranteed 100% success. A failed op pays zero gems regardless of gem chance.
- **Gem chance** is a pass/fail probability, not a multiplier: `effectiveGemChance = min(0.95,
  op.baseGemChance + Σ gem_chance from traits/gear/class passives)`.
- **Gem amount** on a hit: `randomInt(op.baseGemCount) + gemBonus`, where `gemBonus` is a flat,
  uncapped sum of `gem_bonus` traits + gear mods.
- **Duration**: each agent's speed% compounds multiplicatively on the remaining time (diminishing
  returns), floored at 7% of base duration (`MAX_TOTAL_SPEED = 0.93`) — never below that regardless
  of stacking.
- **Power cap per agent by rarity**: ghost 200 / operative 300 / specialist 400 / elite 500 /
  **phantom 600**. This is a hard ceiling — no build gets past it.
- **Concurrency**: agents are only "busy" while assigned to an active, uncollected op
  (`dispatch.post.ts`). No cap on concurrent *operations* — only on how many of your
  `MAX_ROSTER_SLOTS = 6` active agents are free. You can run a 4-agent op + a 2-agent op, or two
  3-agent ops, fully in parallel.

## Key findings

- **Max single-operation payout**: Project Zero, up to **56 gems** (8 base + 48 flat bonus from a
  maxed 4-phantom squad), but its power cap (2400 total) barely exceeds its `minPower` (2300), so
  success chance caps at only **~72.6%** no matter how the squad is built. Combined with its 44h
  base duration (floored to ~3.08h), it's actually the **worst** op for gems/hour (~12.2/hr) despite
  having the highest ceiling per run.
- Ops that hit **guaranteed 100% success** and have a **short base duration** dominate for
  sustained gems/hour, because the flat `gem_bonus` stacks so heavily that duration — not per-hit
  reward — is what determines throughput.
- The 7%-duration floor is only reachable with a **4-agent** squad (`0.44 × 0.54³ ≈ 6.9%` with 1
  infiltrator + 3 others). With 2 or 3 agents, the floor is never reached, so speed keeps paying off
  continuously and every agent should be an infiltrator.

### Best op per squad size (full phantom-maxed agents)

| Squad size | Speed floor reached? | Optimal class mix | Best op | Duration | Gems/hour |
|---|---|---|---|---|---|
| 4 | Yes | 1 infiltrator + 3 social_engineer | NSA Breach | 1.54h | 29.1 |
| 3 | No | all infiltrator | Mil Intel | 0.94h | 17.8 |
| 2 | No | all infiltrator | Bank Skim / Ransomware Drop (tied) | 0.97h | 6.2 |

### Portfolio comparison (splitting a 6-agent roster)

| Split | Combined gems/hour |
|---|---|
| Single 4-agent squad only (NSA Breach) | 29.1 |
| 4-agent (NSA Breach) + 2-agent (Bank Skim) | ≈35.3 |
| Two 3-agent squads (Mil Intel × 2) | ≈35.5 |

The 4+2 and 3+3 splits are essentially tied (within ~1%) — the real gain (~+20%) comes from not
leaving idle roster slots, not from which specific split you pick.

## Chosen strategy: 3+3 split on Mil Intel

Two squads of 3, both running Mil Intel back-to-back. Target ≈**35.5 gems/hour** combined.

Mil Intel's `minPower` (180) is trivially cleared by any level-20 phantom squad (three agents at
level 20 alone already have ~600 power vs. the ~252 needed for guaranteed success), so **power
stats are wasted here** — every trait/gear slot should go to gem/speed stats instead.

### Per-agent build (×6 agents total)

- **Rarity: Phantom** — gives 5 of 7 trait slots and the highest artifact-cap ceiling per trait.
- **Class: Infiltrator**, all six agents. With only 3 agents per squad the speed floor is never
  reached (`0.44³ ≈ 8.5%` > 7% floor), so shaving duration keeps helping continuously — swapping in
  a social_engineer for +1% gem chance costs more in duration than it gains (measured: ~14.8
  gems/hr vs ~17.8 gems/hr with all-infiltrator).
- **Level: 20** (max) — cheap, and on its own clears the power requirement.
- **Traits — target these 5** (phantom rolls 5 of 7 types randomly; keep/pull agents that land on
  this set, reroll/bench ones that waste a slot on `power_flat`/`power_percent`):
  - `gem_chance` → artifact to max (**0.05**)
  - `gem_bonus` → artifact to max (**3**)
  - `speed_percent` → artifact to max (**10%**)
  - `loot_percent`, `xp_boost` — free upside, don't affect gems/hr but the 2 leftover slots have to
    go somewhere and power traits are dead weight for this job.
- **Gear: 3 phantom items (tool/software/hardware), level 20 each.** When rerolling mods, lock in
  and prioritize:
  - `speed_percent` → up to **12%** per item (×3 = 36%)
  - `gem_chance` → up to **0.02** per item (×3 = 0.06)
  - `gem_bonus` → up to **3** per item (×3 = 9)
  - Reroll away `power_flat` and `item_chance` — neither helps this specific farm.

### Per-agent totals once fully built

| Stat | Traits | Gear (×3) | Total/agent |
|---|---|---|---|
| Speed | 10% | 36% | 46% + 10% class = **56%** |
| Gem chance | 0.05 | 0.06 | **0.11** |
| Gem bonus | 3 | 9 | **12** |

Squad-wide on Mil Intel: effective gem chance `0.12 (base) + 0.33 = 0.45`, flat gem bonus `36`,
duration `11h × 0.44³ ≈ 0.94h`. Two squads running this back-to-back ≈ **35.5 gems/hour** total.

### Practical notes

- Trait *types* are randomly rolled when an agent is generated/pulled — you can't hand-pick them,
  only pull/reroll until you get phantom agents whose 5 traits include `gem_chance`, `gem_bonus`,
  and `speed_percent`, then spend Artifacts to max those specific traits.
- Gear mods work the same way (`rerollCost` = 1 gem/mod + a locking surcharge) — reroll until an
  item's slots include the three key mods, then lock them in.
- Re-dispatch both squads promptly after each collection — at ~0.94h/cycle that's ~25-26 runs/day
  per squad if kept busy.

## Full function / endpoint reference

### API endpoints — `server/api/hack/`

| Endpoint | File | What it does |
|---|---|---|
| `GET state` | `state.get.ts` | Fetches (and lazily initializes) the full game state: agents, items, active ops, artifacts, roster/inventory caps, op template list with per-op status/success-chance preview. |
| `GET history` | `history.get.ts` | Last 100 completed ops + lifetime totals (ops run, successes, cash, gems, items). |
| `GET leaderboard` | `leaderboard.get.ts` | Cross-user ranking by total active power. |
| `POST recruit` | `recruit.post.ts` | Pulls a new agent from a tier (cash or gems) — random rarity (tier-weighted), random class, random trait *types and values* (`generateAgentDef`). New agent auto-activates if a roster slot is free. |
| `POST roster/expand` | `roster/expand.post.ts` | Pays cash to add +1 active roster slot, up to `MAX_ROSTER_SLOTS = 6`. |
| `POST agents/active` | `agents/active.post.ts` | Moves an agent between active roster and storage. Can't bench an agent currently on an op. |
| `POST agents/fire` | `agents/fire.post.ts` | Permanently deletes an agent (unequips its gear first). No refund. |
| `POST agents/rename` | `agents/rename.post.ts` | Cosmetic rename only. |
| `POST artifacts/apply` | `artifacts/apply.post.ts` | Spends one Artifact to push **one already-rolled trait's value** up toward its max. Does not change trait types. |
| `POST items/pull` | `items/pull.post.ts` | Buys a random item crate (cash) — random rarity (tier-weighted) → random slot + random mod types/values (`generateItem`). |
| `POST items/reroll` | `items/reroll.post.ts` | Gem-cost reroll of an **existing** item's mods — see reroll mechanics below. |
| `POST items/upgrade` | `items/upgrade.post.ts` | Gem-cost item leveling (+2 power/level, up to `ITEM_MAX_LEVEL = 20`). Doesn't touch mod values. |
| `POST items/sell` | `items/sell.post.ts` | Sells an item for a flat cash price by rarity (`itemSellPrice`). |
| `POST items/equip` | `items/equip.post.ts` | Equips/unequips an item to an agent's tool/software/hardware slot. |
| `POST ops/dispatch` | `ops/dispatch.post.ts` | Starts an op with chosen agents — validates squad size, agent availability, computes duration/success chance, inserts the op row. |
| `POST ops/collect` | `ops/collect.post.ts` | Claims a completed op's reward (claim-then-reward pattern) — rolls cash/gems/item/artifacts, applies per-agent XP/leveling, logs history. |
| `POST ops/cancel` | `ops/cancel.post.ts` | Cancels an undispatched-yet-uncollected op (dispatch is free, so nothing to refund — agents just free up). |

### Core game-logic functions — `shared/utils/hack-config.ts`

| Function | Purpose |
|---|---|
| `generateAgentDef(rarity, takenNames)` | Creates a brand-new agent: random class, random unique trait *types* (count set by `AGENT_TRAIT_COUNT[rarity]`), each trait value rolled uniformly across its full range. **This is the only place trait types are assigned.** |
| `generateItem(rarity, slot?)` | Creates a brand-new item: random unique mod *types* (count set by `RARITY_MOD_COUNT[rarity]`), each value rolled uniformly across its full range. |
| `rollMod(type)` | Rolls one mod's value within `MOD_RANGES[type]`. |
| `rerollItemMods(mods, lockedTypes)` | Rerolls every **unlocked** mod on an item to a fresh type+value; locked mods keep their exact value. |
| `rerollCost(modCount, lockedCount)` | Gem cost for a reroll: `modCount + (2×lockedCount − 1 if any locked, else 0)`. |
| `itemUpgradeCost(level)` / `itemUpgradeCostForLevels` | Gem cost curve for item leveling (~13%/level). |
| `itemPower(item)` | `itemLevel × 2 + Σ power_flat mods`. |
| `agentPower(agent, items, traits)` | Full power calc, capped at `RARITY_POWER_CAP[rarity]`. |
| `agentSpeedPercent(agent)` / `effectiveDurationMs` | Speed aggregation and squad duration compounding (floored at 7% of base). |
| `opSuccessChance(power, minPower)` | `min(1, max(0, (power/minPower − 0.1) / 1.3))`. |
| `agentLootPercent` / `agentXpGain` | Per-agent loot% and XP-per-op calculations. |
| `collectBonuses(agents)` | Sums gem chance, gem bonus, loot%, item-find%, level bonus across a squad. |
| `effectiveCashRange` / `effectiveGemChance` / `effectiveItemDropChance` | Applies squad bonuses on top of an op's base values (gem chance capped at 0.95, item chance at 0.9). |
| `rollOpReward(template, agents, totalPower, inventoryFull)` | The master payout function — rolls success, cash, gems, item drop, artifact drops. |
| `rollRarity(weights)` | Weighted rarity roll, used by both agent pulls and item pulls. |
| `itemSellPrice(rarity)` | Flat sell price table. |
| `agentBonusStats(agents)` | UI-facing aggregator (same math as `collectBonuses`, formatted for display). |

### `server/utils/hack.ts`

| Function | Purpose |
|---|---|
| `equippedAgentPower(agent, itemsById)` | Resolves an agent's equipped item rows from a map and calls `agentPower` — used by `state.get.ts` and `leaderboard.get.ts` so power is computed identically everywhere. |

## Can you reroll a phantom agent you already have? — No.

**There is no agent-trait reroll endpoint.** Trait *types* are assigned exactly once, at creation, inside
`generateAgentDef` — called only from `recruit.post.ts` (pulling a new agent) and the one-time starter
agent seeded in `state.get.ts`. Nothing in the API ever calls `generateAgentDef` or reassigns the `traits`
array's *types* on an existing agent.

The only thing you can do to an existing agent's traits is **`POST /api/hack/artifacts/apply`**, and it is
strictly a value-booster, not a reroll:
- It only works on a trait type the agent **already has** — if your phantom agent didn't roll
  `speed_percent`, applying a Speed Artifact to it throws `"{name} has no speed_percent trait"`. It cannot
  add a missing trait type.
- It pushes that trait's existing value up by a fixed amount per Artifact rarity (`ARTIFACT_VALUE`),
  clamped at `AGENT_TRAIT_RANGES[type].max`. Once clamped, further Artifacts on it throw `"Trait already
  maxed"`.

**So if a phantom agent's 5 random trait types don't include the ones you want (e.g. it's missing
`gem_chance`), your only options are:**
1. Fire it (`agents/fire`) and recruit again, hoping the next phantom pull lands on the trait set you want, or
2. Keep it benched/active for whatever it's actually good at, and pull additional agents until you get one
   with the right 5 traits.

There's no gem sink that fixes a bad trait-type roll on an agent — it's pure recruit-and-hope. Budget for
this: `AGENT_PULL_TIERS`'s top tier ("Ghost Recruit", 3.5M cash) only guarantees specialist-or-better, and
phantom is a 20% slice of that roll — so landing a phantom with the specific 3 trait types you want (out of
`C(7,5) = 21` possible 5-type combinations) takes real luck across multiple pulls.

## Can you reroll gear you already have? — Yes.

**`POST /api/hack/items/reroll`** rerolls an existing item in place, and unlike agents you get real control
over the outcome:
- Pass `lockedTypes` — any mod type on the item you want to **keep exactly as-is**.
- Every mod slot *not* locked gets rerolled to a **fresh random type and value** (drawn from all 7 mod
  types minus whatever's locked, then a fresh `rollMod` on the full range) — so a reroll can still hand you
  a type you already had, there's no guaranteed improvement, but you can iteratively lock in good rolls and
  keep rerolling the rest.
- Cost (in gems) is `rerollCost(modCount, lockedCount)` = `modCount + (2×lockedCount − 1)` once you have
  ≥1 locked. Locking more gets steeply pricier, which pushes you toward rerolling everything at once early
  and only locking down mods once they've hit (near) max value.
- You must leave at least one mod unlocked — you can't "reroll" an item with everything locked.

Practical loop for the Mil Intel gear build: pull/generate a phantom item (5 mod slots), reroll with nothing
locked until you see `speed_percent`, `gem_chance`, and `gem_bonus` among the 5 types, then start locking
each one in as its rolled value gets close to its max (`MOD_RANGES` ceiling) and keep rerolling the
remaining unlocked slots. This is strictly better than agents — gear has a real, paid path to a fully
optimized item; agents do not have an equivalent for their trait *types*.

## Expected cost to build the full 3+3 setup (6 agents, 18 items)

These are **expected values** from the underlying probabilities, not guarantees — actual spend will vary
(geometric distributions have long tails both ways). Broken down by what you're actually paying for,
starting from zero.

### 1. Recruiting 6 useful phantom agents — cash

Only the top pull tier ("Ghost Recruit", `AGENT_PULL_TIERS`) offers phantom at all, and you additionally
need the roll to land on the 3 target trait types (`gem_chance`, `gem_bonus`, `speed_percent`) among its 5.

- Cost per pull: **3,500,000 cash**
- P(phantom rarity) = 20%
- P(5-of-7 trait draw includes all 3 target types) = `C(4,2) / C(7,5)` = 6/21 ≈ **28.6%**
- P(a single pull is "useful") = 0.20 × 0.286 ≈ 5.71% → **≈17.5 pulls expected** per useful agent
- **≈61,250,000 cash per agent → ≈367,500,000 cash for 6 agents**

### 2. Acquiring 18 phantom-rarity base items — cash

Op drops never reach phantom rarity (`itemDropRarity` tops out at `elite`) — phantom gear only comes from
the top item-pull tier ("Ghost Cache", `ITEM_PULL_TIERS`). This step is just for the phantom rarity/5-mod-slot
structure; mod *types* are fixed cheaply in step 3.

- Cost per pull: **2,000,000 cash**
- P(phantom rarity) = 35% → **≈2.86 pulls expected** per phantom item
- **≈5,714,000 cash per item → ≈102,850,000 cash for 18 items** (3 per agent × 6 agents)

**Cash subtotal: ≈470,350,000**

### 3. Rerolling item mods onto the right 3 types — gems

Once you have a phantom item (5 of 7 mod types), reroll with nothing locked (cheapest form,
`rerollCost(5, 0) = 5` gems/attempt) until the draw includes `speed_percent`, `gem_chance`, `gem_bonus`.
Same combinatorics as the agent trait draw (5-of-7, want 3 specific types):

- P(hit per reroll) ≈ 28.6% → **≈3.5 rerolls expected** per item
- **≈17.5 gems per item → ≈315 gems for 18 items**

### 4. Leveling 18 items to max (level 20) — gems

Deterministic, no luck involved — `itemUpgradeCostForLevels(1, 19)` sums to **70 gems per item** (per the
code comment: 1 gem for level 2 up to 9 gems for the final level).

- **70 gems per item → 1,260 gems for 18 items**

**Gem subtotal (currency-priced): ≈1,575 gems**

### 5. Maxing agent trait *values* via Artifacts — not purchasable, earned through play

Artifacts only drop from completed ops (never bought directly), so this isn't a currency cost — it's an
ops-run cost, and one you're already paying just by farming Mil Intel for gems. Rough sizing at Mil Intel's
drop table (`artifactRarityTable` tier bracket: specialist 60% / elite 30% / phantom 10%, type uniform
across all 7):

- Expected artifacts per completed op ≈ 2.75 (`0.25 × 11h`), only 1/7 of any type and only 10% phantom rarity
- To fully max `gem_chance` (0.05), `gem_bonus` (3), and `speed_percent` (10%) per agent from a mid-range
  starting roll takes roughly **~9 phantom-rarity artifacts** split across the 3 types (fewer needed if you
  use the far more common specialist/elite ones instead, at a slower per-artifact gain)
- Ballpark: **~70-100 completed ops per agent** before its 3 key traits are fully maxed out — but this
  overlaps entirely with the Mil Intel farming loop itself, so it's not additional grinding, just the
  natural timeline before the squad reaches its stated ~17.8 gems/hour ceiling.

### Grand total (currency-priced portion only)

| | Amount |
|---|---|
| Cash | ≈470,350,000 |
| Gems | ≈1,575 |
| Artifacts | free (drops), ~70-100 ops/agent to fully mature |

This is the cost of the theoretical *ceiling* build described above. A "good enough" squad — phantom
agents/gear with 2 of the 3 key traits/mods instead of all 3, or elite rarity instead of phantom — costs
dramatically less and still farms Mil Intel at a solid rate; treat the numbers above as the top of the
investment curve, not a minimum bar.
