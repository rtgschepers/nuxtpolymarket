# Idle game architecture — how Xeno and Colony integrate

Structural map of the idle-game vertical slice, derived from reading the Xeno and Colony
implementations (2026-08-01). Use this as the template when adding a new idle game.

## Two game categories, two integration paths

| | Casino games | Idle games |
| --- | --- | --- |
| Examples | dice, limbo, wheel, xenoslot, spinata | Miner, Xeno, Hack Ops, Colony |
| Registration | `shared/utils/gamelogic/<name>.ts` + an entry in `GAMES_REGISTRY` (`shared/utils/games-registry.ts`) | none — own tables, own API namespace, own composable |
| Server state | none — pure `play(bet, options) → { payout }` | `<game>*` tables keyed on `userId` |
| Endpoints | one shared play endpoint | `server/api/<game>/**` |
| Nav group | `slotItems` / `activeGameItems` in `app/layouts/default.vue` | `idleGameItems` (same file, line ~34) |

**An idle game never touches `GAMES_REGISTRY`.** That registry only exists so a stateless bet can be
resolved generically. Idle games are vertical slices.

## The slice, layer by layer

### 1. Pure logic — `shared/utils/<game>.ts`

`shared/utils/colony.ts` (693 lines) and `shared/utils/xeno/*.ts`
(`plants.ts`, `hybrids.ts`, `mutations.ts`, `artifacts.ts`, `upgrades.ts`, `sprites.ts`).

Config tables and math only: species definitions, cost curves, `effectiveTickMs`,
`deriveCapacity`, `deriveTrackModifiers`, `habitatLevelUpCost`, `researchCost`.

Rules:
- no DB access, no auth, no `#server` imports — it must run in the browser
- both sides import it, so the client renders a cost without a round-trip while the server stays
  the sole authority on applying it
- 4-space indent, no semicolons (per `CLAUDE.md` code style for `shared/`)

Split into a directory once it outgrows one file — Xeno did, Colony has not.

### 2. Tables — `server/database/schema.ts`

Colony occupies `schema.ts:396-493`, Xeno `schema.ts:310-383`.

- every table prefixed with the game name: `colonyState`, `colonyBugs`, `colonyLoot`,
  `colonyItems`, `colonyUpgrades`, `colonyBugResearch`
- every table keyed on `userId` with an explicit index:
  `t => [index('colony_bugs_userId_idx').on(t.userId)]`
- one singleton `<game>State` row per user, holding the settle clock (`lastSettledAt`) and any
  scalar progression (`habitatLevel`, `nutrition`, `gemNutrition`)
- child tables for collections, with `unique(...)` constraints on `(userId, typeId)` where the row
  is a counter rather than an entity (`colony_loot_unique`, `colony_items_unique`,
  `colony_upgrades_unique`, `colony_bug_research_unique`)
- cross-table references use `onDelete: 'set null'` for optional attachments
  (`xenoGridSlots.plantId`, `xenoGridSlots.artifactId`)

The schema is also where the settle contract is documented — see the block comment above
`colonyState` explaining that there is no server-side loop.

### 3. Domain layer — `server/utils/<game>.ts`

`server/utils/colony.ts` (689 lines), `server/utils/xeno.ts` (232 lines).

Contains the state accessors (`getColonyState`, `ensureColonyState`), the level readers
(`getUpgradeLevels`, `getResearchLevels`), the serializers consumed by `state.get.ts`, and the
central piece:

#### Lazy settle — the entire idle mechanic

**There is no cron, no interval, no background worker.** Offline progress is computed on demand.
`settleColony` (`server/utils/colony.ts:134`):

1. opens `db.transaction`
2. `insert(...).onConflictDoNothing()` then `select(...).for('update')` — locks the state row
3. `elapsedMs = now - state.lastSettledAt.getTime()`; returns early if `<= 0`
4. advances every placed entity's `tickProgressMs`, banks completed ticks into `colonyLoot`,
   credits gems for gem-producing bugs
5. writes the new `lastSettledAt` and per-entity remainders

Two concurrent settles cannot double-pay: the loser blocks on the row lock, then reads the advanced
timestamp and exits at step 3.

It is called from `state.get.ts` **and** from every mutation that depends on accrued progress, so
reads and writes always see a settled world. Partial progress is refunded on teardown via
`creditPartialTick` (`server/utils/colony.ts:348`), which must run *before* the entity row is
deleted.

### 4. API — `server/api/<game>/`

```
server/api/colony/          server/api/xeno/
  state.get.ts                state.get.ts
  init.post.ts                init.post.ts
  leaderboard.get.ts          leaderboard.get.ts
  feed.post.ts                grid/{plant,plant-all,harvest,unlock,remove-plant,
  bugs/{buy,place,remove,unplace}.post.ts    attach-artifact,remove-artifact}.post.ts
  market/sell.post.ts         breeder/{start,collect,cancel,unlock,
  habitat/upgrade.post.ts               attach-artifact,remove-artifact}.post.ts
  loot/collect.post.ts        market/{buy,sell,roll-hybrid}.post.ts
  research/sacrifice.post.ts  artifacts/{buy,delete}.post.ts
  upgrades/{start,collect}.post.ts   upgrades/buy.post.ts
```

Conventions:
- one file per verb, nested into a directory per subsystem
- `requireUserId(event)` at the top of every handler (never raw `getSession` — see `docs/code-audit.md` A1)
- `init.post.ts` is explicit; `state.get.ts` does **not** auto-create. It returns
  `initialized: false` with the *same payload shape* as the founded case (`state.get.ts:40-71`) so
  the client composable needs no branching.

#### Concurrency

Every mutation obeys the claim-then-reward rule from `CLAUDE.md`. Canonical example,
`server/api/colony/market/sell.post.ts:24` — the decrement itself is the mutex:

```ts
const [claimed] = await tx.update(colonyItems)
  .set({ quantity: sql`${colonyItems.quantity} - ${quantity}` })
  .where(and(
    eq(colonyItems.userId, userId),
    eq(colonyItems.itemTypeId, body.itemTypeId),
    gte(colonyItems.quantity, quantity)
  ))
  .returning({ quantity: colonyItems.quantity })
if (!claimed) throw createError({ statusCode: 400, statusMessage: `No ${type.name} to sell` })
```

Where there is no flag to flip and the old value is needed, use lock-then-read (`settleColony`).
Never CAS on a `timestamp` column.

#### Economy

Money crosses the boundary only through `server/utils/balance.ts` — `credit`, `debit`,
`creditGems`, `debitGems` — tagged with the game's category (`'colony'`, `'xeno'`), and always with
the enclosing `tx` passed as the final argument when a lock is held. Never write `user.balance`
directly.

### 5. Client composable — `app/composables/use<Game>.ts`

`app/composables/useColony.ts` (169 lines), `app/composables/useXeno.ts` (196 lines).

Shape:
- one `useFetch('/api/colony/state', { key: 'colony-state', default: () => null })`
- a `computed` per field, each with a fallback, so pages never touch `state.value?.…`
- one private `call(url, body, successMsg)` helper: `$fetch` POST → success toast → `refresh()`,
  with `catch` surfacing `e?.data?.message` as an error toast
- each action is then three lines; those that move money additionally `await fetchSession()` so the
  header balance stays in sync
- returns `{ state, pending, refresh, ...computeds, ...actions }`

Pages contain zero fetch logic.

### 6. Pages and components

- `app/pages/<game>.vue` — thin parent (~40 lines): a tab strip of `NuxtLink`s with
  `activeTab = computed(() => route.path)`, wrapping `<NuxtPage />`
- `app/pages/<game>/*.vue` — one file per tab. Colony: `index` (Terrarium), `market`, `habitat`,
  `research`, `encyclopedia`, `leaderboard`. Xeno: `index`, `market`, `breeder`, `artifacts`,
  `encyclopedia`, `leaderboard`
- `app/components/<game>/` — extracted heavy widgets: `colony/TerrariumCanvas.vue`,
  `xeno/{PlantIcon,PlantTooltipContent,InventoryPanel,GridArtifactBadge,StatLevel,TierLabel,
  LevelBadge,HarvestFloat}.vue`

Every idle game ships an in-game encyclopedia and its own leaderboard tab.

## `state.get.ts` is the integration surface

The state endpoint has **two** consumers, which is why it must return derived display values rather
than raw rows:

1. the page composable
2. the AI agent — `server/utils/ai/executors.ts:147` builds the player overview with
   `event.$fetch<ColonyState>('/api/colony/state', { headers })` and the Xeno equivalent

Consequences for its payload:
- return computed costs, rates and caps (`feedCost`, `gemFeedCost`, `nutritionDrainPerHour`,
  `habitatLevelUpCost`, `habitatLevelUpGemCost`, `capacity`, `maxTier`), not the inputs to them
- run everything through serializers (`serializePlacedBugs`, `serializeUpgradeTracks`,
  `serializeResearch`, `serializeBuilder`, `serializeSpeciesCatalog`)
- include `serverNow: Date.now()` so the client interpolates countdowns without clock drift
- reflect the *currently active* buff state in every display number (see the `gemBuffActive`
  comment at `state.get.ts:90-94`)
- fan out reads with `Promise.all`

One serializer, one read path, no duplication between UI and agent.

## Cross-cutting registration — the easy-to-miss checklist

Adding an idle game means touching these files outside the slice:

| File | What to add |
| --- | --- |
| `app/layouts/default.vue` (~line 34) | entry in `idleGameItems` — label, `i-lucide-*` icon, `to` |
| `server/api/leaderboard.get.ts` | progression aggregate — a `db.select(...)` in the top `Promise.all`, a `Map` by userId, and a contribution to `totalUpgrades` |
| `app/components/leaderboard/LeaderboardListRow.vue` | display of that metric |
| `app/components/leaderboard/LeaderboardPodiumRow.vue` | same |
| `shared/utils/ai-guard.ts` (~line 17) | capability entry `{ key, label, description, icon }` so users can toggle agent access |
| `shared/utils/ai-tools.ts` | tool definitions tagged `capability: '<game>'`, with `requiresConfirmation` set for anything that spends |
| `server/utils/ai/tools.ts` | tool schemas |
| `server/utils/ai/executors.ts` | overview aggregation via the state endpoint + one executor per tool |
| `app/pages/index.vue` | landing card |
| `app/pages/ai.vue` / `ai-wiki.vue` | agent capability surfacing |
| `content/changelog/<date>.md` | changelog entry |
| `test/<game>/` | balance + serializer specs (`test/colony/{balance,serializers}.spec.ts`, `test/xeno/upgrades.spec.ts`) |

Leaderboard aggregates worth mirroring: Colony contributes `habitatLevel` and
`sum(colonyBugResearch.level)`; Xeno contributes distinct unlocked species, unlocked grid slots and
unlocked breeder slots.

## Scaffolding order for a new idle game

1. `shared/utils/<game>.ts` — types, config tables, cost/rate math. Unit-test the curves first.
2. `server/database/schema.ts` — `<game>State` + child tables, indexes, unique constraints. Generate
   the migration.
3. `server/utils/<game>.ts` — `get<Game>State`, `ensure<Game>State`, `settle<Game>` with the
   `FOR UPDATE` lock, serializers.
4. `server/api/<game>/state.get.ts` and `init.post.ts` — nail the payload shape here; everything
   downstream keys off it.
5. `app/composables/use<Game>.ts` — state fetch + `call` helper.
6. `app/pages/<game>.vue` + `<game>/index.vue` — get one loop visible end to end.
7. Mutations one subsystem at a time, each claim-then-reward, each with a composable action and UI.
8. Encyclopedia + leaderboard tabs.
9. The cross-cutting checklist above.
