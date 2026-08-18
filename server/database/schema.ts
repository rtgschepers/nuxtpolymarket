import { relations, sql } from 'drizzle-orm'
import { pgTable, text, timestamp, boolean, index, numeric, integer, unique, jsonb, bigint } from 'drizzle-orm/pg-core'
import type {
  PathwardenGameState,
  PathwardenMapPlan
} from '#shared/types/pathwarden-save'
import type { FirewallRunSave } from '#shared/utils/gamelogic/firewall'
import type { CallOfXenoRunSave } from '#shared/utils/gamelogic/call-of-xeno-save'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  emblem: text('emblem'),
  balance: numeric('balance', { precision: 19, scale: 4 }).notNull().default('0'),
  rake: numeric('rake', { precision: 19, scale: 4 }).notNull().default('0'),
  rakebackUnlocked: boolean('rakeback_unlocked').notNull().default(false),
  gems: integer('gems').notNull().default(0),
  // Account-wide reset tier, 0-4. Raised only by server/utils/prestige.ts,
  // which wipes every game table in the same transaction.
  prestige: integer('prestige').notNull().default(0),
  // Paid out on each ascent (5/10/15/20) and spent in the prestige shop.
  prestigeTokens: integer('prestige_tokens').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull()
})

export const emblemHistory = pgTable(
  'emblem_history',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    emblem: text('emblem').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  table => [index('emblem_history_userId_createdAt_idx').on(table.userId, table.createdAt)]
)

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
    type: text('type').notNull(),
    category: text('category'),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  table => [index('transactions_userId_createdAt_idx').on(table.userId, table.createdAt)]
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
  },
  table => [index('session_userId_idx').on(table.userId)]
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  table => [index('account_userId_idx').on(table.userId)]
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  table => [index('verification_identifier_idx').on(table.identifier)]
)

export const minerState = pgTable('miner_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  rigLevel: integer('rig_level').notNull().default(1),
  vaultLevel: integer('vault_level').notNull().default(1),
  lastCollectedAt: timestamp('last_collected_at').defaultNow().notNull(),
  factoryLevel: integer('factory_level').notNull().default(1),
  factoryLastCollectedAt: timestamp('factory_last_collected_at').defaultNow().notNull(),
  lootboxSlots: integer('lootbox_slots').notNull().default(1),
  lootboxTodayOpens: integer('lootbox_today_opens').notNull().default(0),
  lootboxOpensDate: text('lootbox_opens_date').notNull().default(''),
  overclockLevel: integer('overclock_level').notNull().default(0),
  catalystLevel: integer('catalyst_level').notNull().default(0)
})

// ─── Pirates ──────────────────────────────────────────────────────────────

export const pirateState = pgTable('pirate_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  hullLevel: integer('hull_level').notNull().default(1),
  speedLevel: integer('speed_level').notNull().default(1),
  defenseLevel: integer('defense_level').notNull().default(1),
  ammoCapacityLevel: integer('ammo_capacity_level').notNull().default(1),
  // Passive hull regeneration track — every captain owns level 1 (+1 hull/sec)
  // for free; regen only ticks after PIRATE_REGEN_DELAY_MS without being hit.
  regenLevel: integer('regen_level').notNull().default(1),
  // Unlocked gun ports. Slot 0 starts equipped with a free starter cannon
  // (see pirateCannons) so a brand new player isn't defenseless.
  cannonSlots: integer('cannon_slots').notNull().default(1),
  ammoCount: integer('ammo_count').notNull().default(60),
  // Premium gem-bought shots, tracked separately from the coin-bought stock.
  gemAmmoCount: integer('gem_ammo_count').notNull().default(0),
  runsPlayed: integer('runs_played').notNull().default(0),
  totalCoinsEarned: integer('total_coins_earned').notNull().default(0),
  bestSurvivalMs: integer('best_survival_ms').notNull().default(0),
  bestRunPower: integer('best_run_power').notNull().default(0),
  bestRunLoot: integer('best_run_loot').notNull().default(0),
  ownedSkinIds: jsonb('owned_skin_ids').$type<string[]>().notNull().default(['starter']),
  equippedSkinId: text('equipped_skin_id').notNull().default('starter'),
  ownedAbilityIds: jsonb('owned_ability_ids').$type<string[]>().notNull().default(['bomb']),
  equippedAbilityId: text('equipped_ability_id').notNull().default('bomb'),
  // Per-ability upgrade track, keyed by ability id. A missing key means level
  // 1 — every owned ability starts there, so the map only stores what has
  // actually been paid for.
  abilityLevels: jsonb('ability_levels').$type<Record<string, number>>().notNull().default({}),
  // Set when a voyage starts, cleared on finish. Server computes elapsed time
  // from this instead of trusting the client, and snapshots the power level
  // so mid-run upgrades can't raise the finish-run payout ceiling.
  runStartedAt: timestamp('run_started_at'),
  runPowerSnapshot: integer('run_power_snapshot'),
  runDifficultySnapshot: integer('run_difficulty_snapshot'),
  // Only full six-minute clears advance this value. Difficulty 0 is the
  // universal starting tier, so -50 means a new captain has no clear yet.
  highestCompletedDifficulty: integer('highest_completed_difficulty').notNull().default(sql`'-50'`),
  bestCompletedLoot: integer('best_completed_loot').notNull().default(0),
  bestCompletedPower: integer('best_completed_power').notNull().default(0),
  bestCompletedSkinId: text('best_completed_skin_id').notNull().default('starter'),
  // Hull damage from the last voyage puts the ship in dry dock — up to 2h for
  // a total loss, proportional for a partial one. Set on finish-run, cleared
  // naturally once it elapses or immediately via the repair-rush endpoint.
  // hullRepairTotalMs is kept alongside so the client can render a progress
  // bar (it's the original duration this repair was scheduled for).
  hullRepairUntil: timestamp('hull_repair_until'),
  hullRepairTotalMs: integer('hull_repair_total_ms').notNull().default(0)
})

// Equipped cannons, one row per occupied gun port (0..cannonSlots-1). Selling
// removes the row; purchasePrice is stored per-instance (rather than re-read
// from the tier config) so the 20% sell refund stays correct even if tier
// prices are rebalanced later.
export const pirateCannons = pgTable('pirate_cannons', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  slotIndex: integer('slot_index').notNull(),
  tierId: text('tier_id').notNull(),
  purchasePrice: integer('purchase_price').notNull()
}, t => [index('pirate_cannons_userId_idx').on(t.userId)])

export const pirateRunHistory = pgTable('pirate_run_history', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  loot: integer('loot').notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  power: integer('power').notNull().default(0),
  difficulty: integer('difficulty').notNull().default(0),
  survived: boolean('survived').notNull().default(false),
  reason: text('reason').notNull(),
  kills: integer('kills').notNull().default(0),
  shotsFired: integer('shots_fired').notNull().default(0),
  skinId: text('skin_id').notNull().default('starter'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [
  index('pirate_run_history_userId_createdAt_idx').on(t.userId, t.createdAt)
])

// ─── SHAPEZZ ─────────────────────────────────────────────────────────────

export const shapezzState = pgTable('shapezz_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  coreLevel: integer('core_level').notNull().default(0),
  overclockLevel: integer('overclock_level').notNull().default(0),
  armorLevel: integer('armor_level').notNull().default(0),
  thrustersLevel: integer('thrusters_level').notNull().default(0),
  magnetLevel: integer('magnet_level').notNull().default(0),
  killHealLevel: integer('kill_heal_level').notNull().default(0),
  // Gem-bought, consumed the moment a run starts (see shapezzHeadStartCost) — not a permanent chassis level.
  headStartLevel: integer('head_start_level').notNull().default(0),
  weaponType: text('weapon_type').notNull().default('blaster'), // equipped weapon type
  blasterRarity: text('blaster_rarity').notNull().default('common'),
  blasterPurchasePrice: integer('blaster_purchase_price').notNull().default(0),
  launcherRarity: text('launcher_rarity'), // null = not owned
  launcherPurchasePrice: integer('launcher_purchase_price').notNull().default(0),
  shotgunRarity: text('shotgun_rarity'), // null = not owned
  shotgunPurchasePrice: integer('shotgun_purchase_price').notNull().default(0),
  arcCoilRarity: text('arc_coil_rarity'), // null = not owned
  arcCoilPurchasePrice: integer('arc_coil_purchase_price').notNull().default(0),
  runsPlayed: integer('runs_played').notNull().default(0),
  totalCoinsEarned: integer('total_coins_earned').notNull().default(0),
  bestSurvivalMs: integer('best_survival_ms').notNull().default(0),
  bestKills: integer('best_kills').notNull().default(0),
  bestCheckpoint: integer('best_checkpoint').notNull().default(0),
  runStartedAt: timestamp('run_started_at'),
  runDifficultySnapshot: text('run_difficulty_snapshot'),
  runPowerSnapshot: integer('run_power_snapshot'),
  // Set when a run settles as cashout or defeat (not abandoned) — the arena
  // cooldown is derived from this at read time, never stored.
  lastRunFinishedAt: timestamp('last_run_finished_at')
})

export const pathwardenState = pgTable('pathwarden_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  bulwarkLevel: integer('bulwark_level').notNull().default(0),
  artificerLevel: integer('artificer_level').notNull().default(0),
  lensLevel: integer('lens_level').notNull().default(0),
  reservoirLevel: integer('reservoir_level').notNull().default(0),
  bannerLevel: integer('banner_level').notNull().default(0),
  bountyLevel: integer('bounty_level').notNull().default(0),
  arcanistLevel: integer('arcanist_level').notNull().default(0),
  surgeCharges: integer('surge_charges').notNull().default(0),
  skipIntro: boolean('skip_intro').notNull().default(false),
  keyboardPan: boolean('keyboard_pan').notNull().default(false),
  claimedCheckpointWaves: jsonb('claimed_checkpoint_waves').$type<number[]>().notNull().default([]),
  ambientStoryIds: jsonb('ambient_story_ids').$type<number[]>().notNull().default([]),
  ambientRewardClaimed: boolean('ambient_reward_claimed').notNull().default(false),
  freeBoostCredits: integer('free_boost_credits').notNull().default(0),
  ownedDefenseIds: jsonb('owned_defense_ids').$type<string[]>().notNull().default(['bolt', 'mortar', 'frost']),
  ownedSkinIds: jsonb('owned_skin_ids').$type<string[]>().notNull().default(['warden-stone']),
  equippedSkinId: text('equipped_skin_id').notNull().default('warden-stone'),
  runsPlayed: integer('runs_played').notNull().default(0),
  totalCoinsEarned: numeric('total_coins_earned', { precision: 19, scale: 4 }).notNull().default('0'),
  bestWave: integer('best_wave').notNull().default(0),
  bestScore: integer('best_score').notNull().default(0),
  bestRealm: integer('best_realm').notNull().default(0),
  bestFlawless: integer('best_flawless').notNull().default(0),
  highestCompletedRealm: integer('highest_completed_realm').notNull().default(0),
  runStartedAt: timestamp('run_started_at'),
  runRealmSnapshot: integer('run_realm_snapshot'),
  runPowerSnapshot: integer('run_power_snapshot'),
  runSurgedSnapshot: boolean('run_surged_snapshot'),
  lastRunFinishedAt: timestamp('last_run_finished_at'),
  lastAmbientStoryAt: timestamp('last_ambient_story_at')
})

export const pathwardenRuns = pgTable('pathwarden_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull().default(0),
  saveVersion: integer('save_version').notNull(),
  generatorVersion: integer('generator_version').notNull(),
  seed: bigint('seed', { mode: 'number' }).notNull(),
  realm: integer('realm').notNull(),
  mapPlan: jsonb('map_plan').$type<PathwardenMapPlan>().notNull(),
  gameState: jsonb('game_state').$type<PathwardenGameState>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
})

/**
 * Grand-exchange-style limit orders. Placing a buy order escrows
 * `quantity × price` coins; placing a sell order escrows `quantity` gems.
 * `filled` advances as opposing orders match (partial fills allowed) and the
 * escrow for the unfilled remainder is returned on cancel. Matching runs under
 * a Postgres advisory lock (see server/utils/gem-exchange.ts) so the book is
 * only ever mutated by one request at a time.
 */
// ─── FIREWALL ────────────────────────────────────────────────────────────

// Permanent, coin-bought Mainframe levels plus the account records the
// difficulty gate reads. A run in progress is the `runStartedAt` lock here and
// the save blob in `firewallRuns` — the two are always written together.
export const firewallState = pgTable('firewall_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  bulwarkLevel: integer('bulwark_level').notNull().default(0),
  munitionsLevel: integer('munitions_level').notNull().default(0),
  foundryLevel: integer('foundry_level').notNull().default(0),
  grantLevel: integer('grant_level').notNull().default(0),
  salvageLevel: integer('salvage_level').notNull().default(0),
  capacitorLevel: integer('capacitor_level').notNull().default(0),
  charterLevel: integer('charter_level').notNull().default(0),
  arsenalLevel: integer('arsenal_level').notNull().default(0),
  runsPlayed: integer('runs_played').notNull().default(0),
  totalCoinsEarned: numeric('total_coins_earned', { precision: 19, scale: 4 }).notNull().default('0'),
  // Gates the higher difficulties. Only ever raised by a settled run.
  bestWave: integer('best_wave').notNull().default(0),
  bestKills: integer('best_kills').notNull().default(0),
  bestPayout: integer('best_payout').notNull().default(0),
  victories: integer('victories').notNull().default(0),
  runStartedAt: timestamp('run_started_at'),
  runDifficultySnapshot: text('run_difficulty_snapshot'),
  runPowerSnapshot: integer('run_power_snapshot'),
  // Salvage Rig is snapshotted at deploy so a level bought mid-run cannot
  // retroactively multiply coins the run already banked.
  runCoinMultiplierSnapshot: numeric('run_coin_multiplier_snapshot', { precision: 10, scale: 4 }),
  lastRunFinishedAt: timestamp('last_run_finished_at')
})

// One saved run per user, replaced wholesale on every uplink. `revision` is a
// compare-and-swap guard so two tabs cannot interleave saves.
export const firewallRuns = pgTable('firewall_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull().default(0),
  saveVersion: integer('save_version').notNull(),
  runState: jsonb('run_state').$type<FirewallRunSave>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
})

// ─── CALL OF XENO ────────────────────────────────────────────────────────

// Permanent, coin-bought upgrades plus the per-difficulty records that gate
// the harder tiers. The game itself is fully client-side; the server's job is
// owning the levels, stamping a run snapshot at deploy and settling the
// payout against a wall-clock ceiling at finish.
export const callOfXenoState = pgTable('call_of_xeno_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  warChestLevel: integer('war_chest_level').notNull().default(0),
  bodyArmorLevel: integer('body_armor_level').notNull().default(0),
  adrenalineLevel: integer('adrenaline_level').notNull().default(0),
  scavengerLevel: integer('scavenger_level').notNull().default(0),
  contractLevel: integer('contract_level').notNull().default(0),
  sidearmLevel: integer('sidearm_level').notNull().default(0),
  runsPlayed: integer('runs_played').notNull().default(0),
  totalEarned: numeric('total_earned', { precision: 19, scale: 4 }).notNull().default('0'),
  bestEarned: integer('best_earned').notNull().default(0),
  // Best round reached per difficulty tier — Veteran reads Recruit's, etc.
  bestRoundRecruit: integer('best_round_recruit').notNull().default(0),
  bestRoundVeteran: integer('best_round_veteran').notNull().default(0),
  bestRoundSurvivor: integer('best_round_survivor').notNull().default(0),
  bestRoundNightmare: integer('best_round_nightmare').notNull().default(0),
  // Active-run lock + the payout-relevant snapshot taken at deploy.
  runStartedAt: timestamp('run_started_at'),
  runDifficultySnapshot: text('run_difficulty_snapshot'),
  runPayoutMultSnapshot: numeric('run_payout_mult_snapshot', { precision: 10, scale: 4 }),
  // Round-boundary checkpoint of the active run, restored on resume.
  runSave: jsonb('run_save').$type<CallOfXenoRunSave>(),
  // Optimistic-concurrency token for runSave writes; reset at deploy.
  runSaveRevision: integer('run_save_revision').notNull().default(0),
  lastRunFinishedAt: timestamp('last_run_finished_at'),
  // The player's single best run — what the leaderboard shows.
  bestRunRounds: integer('best_run_rounds').notNull().default(0),
  bestRunDurationSeconds: integer('best_run_duration_seconds').notNull().default(0),
  bestRunDifficulty: text('best_run_difficulty')
})

export const gemOrders = pgTable('gem_orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  side: text('side').notNull(), // 'buy' | 'sell'
  price: numeric('price', { precision: 19, scale: 4 }).notNull(), // coins per gem
  quantity: integer('quantity').notNull(),
  filled: integer('filled').notNull().default(0),
  status: text('status').notNull().default('open'), // 'open' | 'filled' | 'cancelled'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
}, t => [
  index('gem_orders_book_idx').on(t.status, t.side, t.price),
  index('gem_orders_userId_createdAt_idx').on(t.userId, t.createdAt)
])

/** One row per executed match — doubles as the exchange's price history. */
export const gemTrades = pgTable('gem_trades', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  buyerId: text('buyer_id').references(() => user.id, { onDelete: 'set null' }),
  sellerId: text('seller_id').references(() => user.id, { onDelete: 'set null' }),
  takerId: text('taker_id').references(() => user.id, { onDelete: 'set null' }),
  price: numeric('price', { precision: 19, scale: 4 }).notNull(),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [index('gem_trades_createdAt_idx').on(t.createdAt)])

/**
 * A bank position is settled lazily whenever it is read or changed. `principal`
 * tracks user-funded savings only (earned interest is deliberately excluded),
 * while `maxPrincipal` is its all-time high-water mark for loan eligibility.
 */
export const bankState = pgTable('bank_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  balance: numeric('balance', { precision: 19, scale: 4 }).notNull().default('0'),
  principal: numeric('principal', { precision: 19, scale: 4 }).notNull().default('0'),
  maxPrincipal: numeric('max_principal', { precision: 19, scale: 4 }).notNull().default('0'),
  loanPrincipal: numeric('loan_principal', { precision: 19, scale: 4 }).notNull().default('0'),
  lastSettledAt: timestamp('last_settled_at').defaultNow().notNull(),
  // Bail-out ledger. The debt is lifted off `balance` and parked here: the 40%
  // levy pays it down into `bailoutRepaid`, and the penalty ends at whichever
  // comes first — `bailoutUntil` lapsing or the two meeting. `bailoutUntil` is
  // nulled the moment it is settled, which is also the flag for "no penalty".
  bailoutAt: timestamp('bailout_at'),
  bailoutUntil: timestamp('bailout_until'),
  bailoutDebt: numeric('bailout_debt', { precision: 19, scale: 4 }).notNull().default('0'),
  bailoutRepaid: numeric('bailout_repaid', { precision: 19, scale: 4 }).notNull().default('0')
})

/** Snapshot only at bank actions; the UI projects the latest point in real time. */
export const bankHistory = pgTable('bank_history', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  balance: numeric('balance', { precision: 19, scale: 4 }).notNull(),
  action: text('action').notNull(),
  amount: numeric('amount', { precision: 19, scale: 4 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [index('bank_history_userId_createdAt_idx').on(t.userId, t.createdAt)])

/**
 * Escrow for the live table. Every stake — opening bet, double, split, insurance
 * — writes a row in the same transaction as its debit, and settlement marks the
 * row settled in the same transaction as the payout. A process that dies
 * mid-round therefore leaves its unsettled stakes visible, and the recovery
 * sweep in server/plugins refunds them instead of pocketing the player's money.
 */
export const liveBlackjackWagers = pgTable(
  'live_blackjack_wagers',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    roundId: integer('round_id').notNull(),
    amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
    kind: text('kind').notNull(),
    settled: boolean('settled').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  table => [index('live_blackjack_wagers_settled_createdAt_idx').on(table.settled, table.createdAt)]
)

/**
 * Escrow for every table game built on the shared LiveTable base — roulette,
 * baccarat, three card poker, casino hold'em. Same contract as the blackjack
 * table above, with a `game` column instead of a table per game, so one
 * recovery sweep covers all of them.
 */
export const tableWagers = pgTable(
  'table_wagers',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    game: text('game').notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    roundId: integer('round_id').notNull(),
    amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
    kind: text('kind').notNull(),
    settled: boolean('settled').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  table => [index('table_wagers_settled_createdAt_idx').on(table.settled, table.createdAt)]
)

// ─── Xeno ──────────────────────────────────────────────────────────────────

/**
 * One row = one plant instance. typeId links to PLANT_TYPES config for
 * name/emoji/tier/baseTime/value. speed/yield are per-instance and can
 * differ from config defaults after breeding. Inventory groups by (typeId, speed, yield).
 */

export const xenoPlants = pgTable('xeno_plants', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  typeId: text('type_id').notNull(),
  speed: integer('speed').notNull(),
  yield: integer('yield').notNull()
}, t => [index('xeno_plants_userId_idx').on(t.userId)])

/**
 * Permanent record of every plant type a user has ever obtained. Unlocks are
 * never removed, so selling or breeding away every instance of a plant does not
 * soft-lock the player out of buying it again or seeing it in the encyclopedia.
 * Written via addPlants whenever plants are acquired.
 */

export const xenoPlantsUnlocked = pgTable('xeno_plants_unlocked', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  typeId: text('type_id').notNull(),
  unlockedAt: timestamp('unlocked_at').defaultNow().notNull()
}, t => [index('xeno_plants_unlocked_userId_idx').on(t.userId)])

/** Permanent account-wide Xeno market upgrades. */
export const xenoUpgrades = pgTable('xeno_upgrades', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  mutationLevel: integer('mutation_level').notNull().default(0),
  yieldLevel: integer('yield_level').notNull().default(0),
  speedLevel: integer('speed_level').notNull().default(0)
})

/** Artifact instances: each row is one artifact with its remaining charges */
export const xenoArtifacts = pgTable('xeno_artifacts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  typeId: text('type_id').notNull(),
  chargesRemaining: integer('charges_remaining').notNull(),
  /** Crafted with gems for +1 level on every one of its effects. */
  gemCrafted: boolean('gem_crafted').notNull().default(false)
}, t => [index('xeno_artifacts_userId_idx').on(t.userId)])

/** Grid slots: plantId references the specific plant instance growing. */
export const xenoGridSlots = pgTable('xeno_grid_slots', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  slotIndex: integer('slot_index').notNull(),
  plantId: text('plant_id').references(() => xenoPlants.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at'),
  artifactId: text('artifact_id').references(() => xenoArtifacts.id, { onDelete: 'set null' })
}, t => [index('xeno_grid_userId_idx').on(t.userId)])

/**
 * Breeder slots. Parents are consumed (deleted from xenoPlants) when breeding starts;
 * their type/speed/yield stored here for display. Result stats stored for deterministic collect.
 */
export const xenoBreederSlots = pgTable('xeno_breeder_slots', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  slotIndex: integer('slot_index').notNull(),
  plant1TypeId: text('plant1_type_id'),
  plant1Speed: integer('plant1_speed'),
  plant1Yield: integer('plant1_yield'),
  plant2TypeId: text('plant2_type_id'),
  plant2Speed: integer('plant2_speed'),
  plant2Yield: integer('plant2_yield'),
  startedAt: timestamp('started_at'),
  artifactId: text('artifact_id').references(() => xenoArtifacts.id, { onDelete: 'set null' }),
  resultTypeId: text('result_type_id'),
  resultSpeed: integer('result_speed'),
  resultYield: integer('result_yield'),
  resultQuantity: integer('result_quantity'),
  wasMutation: boolean('was_mutation'),
  collected: boolean('collected').notNull().default(false)
}, t => [index('xeno_breeder_userId_idx').on(t.userId)])

// ─── Colony ───────────────────────────────────────────────────────────────────

/**
 * One row per user. Bugs forage continuously rather than XENO's single-shot
 * grow cycle, so production is settled analytically from elapsed real time
 * (see server/utils/colony.ts:settleColony) every time state is read or a
 * colony action runs — there is no server-side interval/loop. lastSettledAt
 * is the anchor nutrition decay (and each bug's tick progress) is computed
 * from. Settling never credits items directly to the player — it only fills
 * colonyLoot, which must be claimed manually via the loot chest.
 */
export const colonyState = pgTable('colony_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  /** Gates which bug tiers are purchasable (tier N species require habitatLevel >= N). */
  habitatLevel: integer('habitat_level').notNull().default(1),
  /** Current nutrition units, capped by the derived nutrition_storage track max; bugs stop producing at 0 */
  nutrition: integer('nutrition').notNull().default(150),
  /**
   * Premium nutrition bought with gems (at least 200 points per gem, scaling
   * with tank size) instead of
   * coins — always drained BEFORE regular nutrition, and grants +1 yield
   * and +20% speed colony-wide (every non-gem bug) for as long as any is
   * left. Shares the same tank ceiling as `nutrition` (gemNutrition +
   * nutrition <= nutritionMax).
   */
  gemNutrition: integer('gem_nutrition').notNull().default(0),
  lastSettledAt: timestamp('last_settled_at').defaultNow().notNull()
})

/**
 * One row = one builder currently working. A colony has BASE_BUILDER_COUNT
 * builders plus whatever the prestige shop's Labour Contract granted, so the
 * number of concurrent rows is capped by the caller, not the schema.
 *
 * The unique (user, track) constraint is the real guard, not a convenience:
 * two builders on the same track would each collect "level N+1" and the
 * player would pay once for a level they got twice. HABITAT_BUILDER_JOB_ID
 * occupies the same namespace, so the habitat can also only ever have one
 * builder on it.
 */
export const colonyBuilderJobs = pgTable('colony_builder_jobs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  /** An UpgradeTrackId, or HABITAT_BUILDER_JOB_ID for a habitat level-up. */
  trackId: text('track_id').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull()
}, t => [
  index('colony_builder_jobs_userId_idx').on(t.userId),
  unique('colony_builder_jobs_unique').on(t.userId, t.trackId)
])

/**
 * One row = one bug instance. Buying a bug puts it in the player's inventory
 * (inTerrarium: false) — it only forages once manually placed into the
 * terrarium (up to capacity), mirroring XENO's buy-then-plant flow.
 * speed is a randomly-rolled percentage trait (0-25) that cuts tick time.
 * yield and eat are both fixed levels (not percentages) rolled once within
 * the species' range on purchase: yield is the exact item quantity dropped
 * per tick, eat is the exact nutrition spent per COMPLETED tick (so a
 * shorter effective tick from the speed trait means more meals per hour).
 */
export const colonyBugs = pgTable('colony_bugs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  typeId: text('type_id').notNull(),
  speed: integer('speed').notNull(),
  yield: integer('yield').notNull(),
  /** Nutrition spent per completed production tick — rolled once on purchase, like speed/yield. Defaults cover any pre-existing rows from before this column existed. */
  eat: integer('eat').notNull().default(8),
  /** Whether this bug is placed in the terrarium (foraging) or sitting in inventory. */
  inTerrarium: boolean('in_terrarium').notNull().default(false),
  /** Progress in ms toward this bug's next production tick, only advances while placed. */
  tickProgressMs: integer('tick_progress_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [index('colony_bugs_userId_idx').on(t.userId)])

/**
 * Loot a bug's production tick generates but the player hasn't claimed yet.
 * Settling fills this; the loot chest (loot/collect) moves it into colonyItems.
 */
export const colonyLoot = pgTable('colony_loot', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  itemTypeId: text('item_type_id').notNull(),
  quantity: integer('quantity').notNull().default(0)
}, t => [
  index('colony_loot_userId_idx').on(t.userId),
  unique('colony_loot_unique').on(t.itemTypeId, t.userId)
])

/** Claimed item inventory — spendable in the market and toward item-gated upgrades. */
export const colonyItems = pgTable('colony_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  itemTypeId: text('item_type_id').notNull(),
  quantity: integer('quantity').notNull().default(0)
}, t => [
  index('colony_items_userId_idx').on(t.userId),
  unique('colony_items_unique').on(t.itemTypeId, t.userId)
])

/** Leveled builder upgrade tracks (capacity, yield, speed, nutrition storage/efficiency). One row per track. */
export const colonyUpgrades = pgTable('colony_upgrades', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  trackId: text('track_id').notNull(),
  level: integer('level').notNull().default(0)
}, t => [
  index('colony_upgrades_userId_idx').on(t.userId),
  unique('colony_upgrades_unique').on(t.trackId, t.userId)
])

/**
 * Per-species research level (0-4) — paying coins on the Research page widens
 * the SPEED roll range every future purchase of that species uses, and
 * multiplies everything that species forages by up to 2x for bugs already
 * owned (see RESEARCH_SPEED_MIN/MAX and RESEARCH_RESOURCE_MULTIPLIERS in
 * shared/utils/colony.ts). One row per species the player has ever
 * researched; missing = level 0.
 */
export const colonyBugResearch = pgTable('colony_bug_research', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  typeId: text('type_id').notNull(),
  level: integer('level').notNull().default(0)
}, t => [
  index('colony_bug_research_userId_idx').on(t.userId),
  unique('colony_bug_research_unique').on(t.typeId, t.userId)
])

// ─── Prestige shop ────────────────────────────────────────────────────────────

/**
 * How many times this run has bought each prestige shop item. One row per
 * (user, item); missing means zero owned.
 *
 * This carries a `user_id` and is deliberately NOT on the prestige preserve
 * list, so ascending wipes it along with everything else the tokens bought.
 * That is what makes the token refund honest: the perks die in the same
 * transaction that hands the allowance back (see server/utils/prestige.ts).
 *
 * Some items apply their effect once, at purchase (plants, bugs, agents,
 * levels); others are read live from this count (the miner level ceilings,
 * see minerRigMaxLevel). Both kinds vanish here.
 */
export const prestigePurchases = pgTable('prestige_purchases', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  itemId: text('item_id').notNull(),
  count: integer('count').notNull().default(0)
}, t => [
  index('prestige_purchases_userId_idx').on(t.userId),
  unique('prestige_purchases_unique').on(t.userId, t.itemId)
])

// ─── Hack Ops ─────────────────────────────────────────────────────────────────

export const hackState = pgTable('hack_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  rosterSlots: integer('roster_slots').notNull().default(2),
  totalOpsCompleted: integer('total_ops_completed').notNull().default(0),
  totalRecruits: integer('total_recruits').notNull().default(0),
  shopItems: jsonb('shop_items').notNull().default([]),
  shopRefreshAt: timestamp('shop_refresh_at').notNull().defaultNow()
})

export const hackAgents = pgTable('hack_agents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  class: text('class').notNull(),
  rarity: text('rarity').notNull(),
  level: integer('level').notNull().default(1),
  xp: integer('xp').notNull().default(0),
  equippedTool: text('equipped_tool'),
  equippedSoftware: text('equipped_software'),
  equippedHardware: text('equipped_hardware'),
  traits: jsonb('traits').notNull().default([]),
  // Active agents count toward power and can be deployed on ops. Inactive agents
  // sit in storage (the roster holds up to `rosterSlots` active agents; storage
  // holds the rest up to MAX_AGENTS total).
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [index('hack_agents_userId_idx').on(t.userId)])

export const hackItems = pgTable('hack_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slot: text('slot').notNull(),
  // Items drop at level 1 and are upgraded with gems at the Crafting Bench.
  itemLevel: integer('item_level').notNull().default(1),
  rarity: text('rarity').notNull(),
  mods: jsonb('mods').notNull().default([]),
  equippedBy: text('equipped_by'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [index('hack_items_userId_idx').on(t.userId)])

export const hackArtifacts = pgTable('hack_artifacts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // One of the seven AgentTraitType values, e.g. 'power_flat'
  traitType: text('trait_type').notNull(),
  rarity: text('rarity').notNull(),
  count: integer('count').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [index('hack_artifacts_userId_idx').on(t.userId)])

export const hackOps = pgTable('hack_ops', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  templateId: text('template_id').notNull(),
  agentIds: jsonb('agent_ids').notNull().default([]),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completesAt: timestamp('completes_at').notNull(),
  collected: boolean('collected').notNull().default(false),
  reward: jsonb('reward')
}, t => [index('hack_ops_userId_idx').on(t.userId)])

// One row per collected op — a lightweight log of the outcome (success, loot, time
// taken) used by the player's history page and the leaderboard's ops-done count.
export const hackHistory = pgTable('hack_history', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  templateId: text('template_id').notNull(),
  success: boolean('success').notNull(),
  cash: numeric('cash', { precision: 19, scale: 4 }).notNull().default('0'),
  gems: integer('gems').notNull().default(0),
  itemName: text('item_name'),
  itemRarity: text('item_rarity'),
  agentCount: integer('agent_count').notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [index('hack_history_userId_idx').on(t.userId)])

/**
 * HERO QUEST — settle contract.
 *
 * The party fights continuously and there is no server-side interval, cron or worker
 * anywhere in this game. Kills, Gold, XP and stage advancement are computed analytically
 * from elapsed real time (see server/utils/hero-quest.ts:settleHq) on every state read and
 * before every mutation that depends on accrued progress. `lastSettledAt` is the anchor.
 *
 * The row lock taken over this row is the mutex — two concurrent settles would otherwise
 * both read the same `lastSettledAt` and both pay out the same window. The loser blocks,
 * then reads the advanced timestamp and returns having earned nothing.
 *
 * Presence is *demonstrated*, not asserted: a gap at or under ONLINE_THRESHOLD_MS counts as
 * online (full rate), anything longer is offline (cap + efficiency apply). A closed app is
 * therefore indistinguishable from a dead network, which is the correct failure direction.
 *
 * Two things settle never does. It never resolves a boss — Stage 5 and Stage 10 park the run
 * and wait for a live `boss/engage` (which is why Void Shards can never be earned offline) —
 * and it never resets `heroLevel`/`heroXp`, which persist across prestige and class switches.
 * Prestige writes four columns and increments `prestige`; everything else survives by simply
 * not being written.
 *
 * Gold lives on the shared `user.balance` and is only ever touched through
 * server/utils/balance.ts. Only Void Shards are Hero Quest's own currency, and it is `text`
 * rather than a numeric because its 100 × 2^prestige payout overflows a bigint by ~prestige 56.
 */
export const hqState = pgTable('hq_state', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  /** The settle clock. Never compare-and-swap on this — Postgres keeps microseconds, JS Dates don't. */
  lastSettledAt: timestamp('last_settled_at').defaultNow().notNull(),
  /**
   * Account age, the input to the Gold tenure ceiling (`GOLD_TENURE_CEILING`).
   *
   * Written once at row creation and never again — it is read-only for the whole lifetime of the
   * account, which is what keeps it clear of the compare-and-swap trap above.
   */
  createdAt: timestamp('created_at').defaultNow().notNull(),

  // Run position — the only group prestige resets.
  prestige: integer('prestige').notNull().default(0),
  world: integer('world').notNull().default(1),
  stage: integer('stage').notNull().default(1),
  /** Kills banked toward the current stage's requirement. */
  killCount: integer('kill_count').notNull().default(0),
  /** Parked at an unengaged Stage 5/10, waiting for the player to start the fight. */
  atBossGate: boolean('at_boss_gate').notNull().default(false),
  /**
   * The World 10 / Stage 10 super boss has been beaten, so prestige is available.
   *
   * Needed because a win there leaves the run standing on the same stage — position alone
   * cannot distinguish "cleared the game" from "walked up to the final boss and stopped".
   * Paying Void Shards off position would hand them out for merely arriving. Prestige clears
   * this along with the rest of the run-position group.
   */
  runCleared: boolean('run_cleared').notNull().default(false),

  // Hero — persists across prestige AND across class switches. There is no relevel anywhere.
  heroNodeId: text('hero_node_id').notNull().default('class_beginner'),
  heroLevel: integer('hero_level').notNull().default(1),
  /** Decimal as text: XP accumulates forever now that level never resets. */
  heroXp: text('hero_xp').notNull().default('0'),
  /** Every class node reached in any past run — permanently re-pickable at prestige. */
  seenNodeIds: jsonb('seen_node_ids').$type<string[]>().notNull().default(['class_beginner']),

  /** Prestige currency. Decimal as text — see the note above. */
  voidShards: text('void_shards').notNull().default('0'),

  /**
   * Unit ID → row. Keyed by `'hero'` for the Hero and by Champion ID for everyone else, so a
   * placement survives a Champion being benched and re-fielded. Absent keys fall back to the
   * class node's / archetype's default row (`classes-and-combat.md` §6).
   */
  formation: jsonb('formation').$type<Record<string, 'front' | 'back'>>().notNull().default({}),

  /**
   * The fielded Champions, in party order, capped by the purchased slot count. IDs only —
   * their star/level live in `hqCollection`, so fielding never duplicates collection state.
   */
  partyChampionIds: jsonb('party_champion_ids').$type<string[]>().notNull().default([]),

  // ── The rest of the live loadout (`loadouts.md` §1) ──────────────────────────────
  //
  // A Loadout is a snapshot of five things: party, formation, Skills, Artifacts and Gear. The
  // first two shipped with Champions; these three arrive with the gachas that fill them. IDs
  // only, same as the party — star/level live in `hqCollection` and are never duplicated here.
  //
  // `hqLoadouts` mirrors this exact column group per saved slot, which is why they are grouped.

  /** Equipped Skills, up to the purchased slot count (`skills-gacha.md` §5–6). Hero-only. */
  equippedSkillIds: jsonb('equipped_skill_ids').$type<string[]>().notNull().default([]),

  /** Equipped Artifacts, up to the purchased slot count. Party-wide in effect, not Hero-only. */
  equippedArtifactIds: jsonb('equipped_artifact_ids').$type<string[]>().notNull().default([]),

  /**
   * Gear slot → item ID, for all six slots from account start (`gear-equipment.md` §1, §3).
   *
   * Persisted rather than derived because equip is **manual**: the strongest owned piece and the
   * equipped one are allowed to differ, and closing that gap is the player's decision. An
   * auto-equip design would have needed no column at all, which is exactly why the doc's revision
   * to manual added one.
   */
  equippedGear: jsonb('equipped_gear').$type<Record<string, string>>().notNull().default({}),

  // ── Gacha currencies (`tech-architecture.md` §3) ─────────────────────────────────
  //
  // Plain integers, not Decimal: Seal and Essence balances are bounded by real spending, not
  // by the exponential curve. All four of each are declared together because §3 specifies
  // them as one group and `hqCollection` already serves all four systems — Phase 3 adds Gear,
  // Skills and Artifacts with no migration. Only the Guild pair is written in Phase 2.
  forgeSeals: integer('forge_seals').notNull().default(0),
  guildSeals: integer('guild_seals').notNull().default(0),
  skillSeals: integer('skill_seals').notNull().default(0),
  excavationSeals: integer('excavation_seals').notNull().default(0),

  gearEssence: integer('gear_essence').notNull().default(0),
  championEssence: integer('champion_essence').notNull().default(0),
  skillEssence: integer('skill_essence').notNull().default(0),
  artifactEssence: integer('artifact_essence').notNull().default(0),

  /** system → 1..10, and pulls banked toward the next level. Each gacha levels independently. */
  gachaLevels: jsonb('gacha_levels').$type<Record<string, number>>().notNull().default({}),
  gachaProgress: jsonb('gacha_progress').$type<Record<string, number>>().notNull().default({}),

  /**
   * The Gold-purchase ladder's daily counters — one per gacha, one shared reset date
   * (`gold-economy.md` §7). Buying Champion pulls today must not move the Skill price, which
   * is why this is a per-system map and not a single integer.
   *
   * `sealLadderDate` is a plain `YYYY-MM-DD` string, not a timestamp: it is compared for
   * equality to decide "is this still the same day", and a timestamp compare-and-swap is the
   * exact pattern the platform guidance forbids.
   */
  sealLadderPurchasedToday: jsonb('seal_ladder_purchased_today').$type<Record<string, number>>().notNull().default({}),
  sealLadderDate: text('seal_ladder_date'),

  /**
   * Free 10-pull entitlements: how many of today's are spent per gacha, and one shared reset
   * date — deliberately the same shape as the Gold ladder two fields up, since it answers the
   * same question. Spending Champion entitlements must not touch the Skill allowance, which is
   * why it is a per-system map rather than an integer.
   *
   * An entitlement is **not** Seals. It cannot be banked, split into singles, or spent on
   * anything but a 10-pull, which is the whole point of it existing alongside the Seal grant.
   */
  freePullsUsedToday: jsonb('free_pulls_used_today').$type<Record<string, number>>().notNull().default({}),
  freePullDate: text('free_pull_date'),

  /**
   * Last free-pull claim per gacha, ISO strings in a map rather than four timestamp columns.
   *
   * Stored as text on purpose. The cooldown is evaluated by *comparison* under a row lock, never
   * by compare-and-swap — Postgres keeps microseconds a JS `Date` cannot, so a CAS on a real
   * timestamp column matches zero rows and fails closed forever (the standing platform warning).
   * Keeping these out of the column type makes that mistake harder to make later.
   */
  freePullClaimedAt: jsonb('free_pull_claimed_at').$type<Record<string, string>>().notNull().default({}),

  /** Free time-gated Seal grant clock. Null means never granted — the first settle pays out. */
  lastSealGrantAt: timestamp('last_seal_grant_at')
}, t => [index('hq_state_userId_idx').on(t.userId)])

/**
 * One row per owned item, across **all four gachas** — `system` discriminates
 * (`tech-architecture.md` §3, locked).
 *
 * `contentId` is an unconstrained string rather than a foreign key: the four systems' content
 * lives in separate `content/*.ts` modules, not a content table, so it is validated at the
 * application layer against whichever module `system` names. The unique constraint is what
 * makes "own one copy, level it with duplicates" expressible at all — a second pull of the
 * same item is an UPDATE to `dupeProgress`, never a second row.
 */
export const hqCollection = pgTable('hq_collection', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  /** 'gear' | 'champion' | 'skill' | 'artifact'. */
  system: text('system').notNull(),
  contentId: text('content_id').notNull(),
  /** 0–5. Everything starts at 0★. */
  star: integer('star').notNull().default(0),
  /** 1–10 within the current star. */
  level: integer('level').notNull().default(1),
  /** Duplicates banked toward the next level. */
  dupeProgress: integer('dupe_progress').notNull().default(0),
  acquiredAt: timestamp('acquired_at').defaultNow().notNull()
}, t => [
  unique('hq_collection_unique').on(t.userId, t.system, t.contentId),
  index('hq_collection_userId_system_idx').on(t.userId, t.system)
])

/**
 * Saved Loadout presets (`loadouts.md` §1, §3) — one row per slot.
 *
 * The same column group as `hqState`'s live loadout, per slot instead of singular, which is the
 * whole design: applying a preset copies five columns across, and saving copies them back.
 *
 * **Slot count needs no schema.** It reads `hqShopUpgrades` at `upgradeId = 'loadoutSlots'`, the
 * one track in the game priced in Gems rather than Void Shards — Loadout slots add zero combat
 * power on their own, so they take the convenience currency.
 *
 * A preset never goes stale: nothing in this game is ever un-owned and slot counts only grow, so
 * an old preset saved under fewer slots stays valid and simply fills fewer of them.
 */
export const hqLoadouts = pgTable('hq_loadouts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  /** 0-based, bounded by the purchased slot count at write time. */
  slotIndex: integer('slot_index').notNull(),
  name: text('name').notNull().default('Loadout'),
  partyChampionIds: jsonb('party_champion_ids').$type<string[]>().notNull().default([]),
  formation: jsonb('formation').$type<Record<string, 'front' | 'back'>>().notNull().default({}),
  equippedSkillIds: jsonb('equipped_skill_ids').$type<string[]>().notNull().default([]),
  equippedArtifactIds: jsonb('equipped_artifact_ids').$type<string[]>().notNull().default([]),
  equippedGear: jsonb('equipped_gear').$type<Record<string, string>>().notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, t => [
  unique('hq_loadouts_unique').on(t.userId, t.slotIndex),
  index('hq_loadouts_userId_idx').on(t.userId)
])

/**
 * Every purchasable track in the game, whatever currency pays for it. Deliberately generic:
 * Phase 2's party-slot tracks and Phase 4's raid-key tracks are new `upgradeId` values, not
 * new tables. `level` is an integer, so the conditional bump is a safe compare-and-swap and
 * doubles as the claim-then-reward mutex for the purchase.
 */
export const hqShopUpgrades = pgTable('hq_shop_upgrades', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  upgradeId: text('upgrade_id').notNull(),
  level: integer('level').notNull().default(0)
}, t => [
  unique('hq_shop_upgrades_unique').on(t.userId, t.upgradeId),
  index('hq_shop_upgrades_userId_idx').on(t.userId)
])

/**
 * One row per resolved boss fight. The client fetches `seed` + `context` and replays the
 * animation by running the identical shared `fight.ts` — so this is the record of what
 * authoritatively happened, and a free audit trail for a shared-economy game.
 */
export const hqFights = pgTable('hq_fights', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  /** 'boss' today; 'arena' joins it in Phase 4. */
  kind: text('kind').notNull(),
  seed: integer('seed').notNull(),
  /** The snapshot the fight was resolved against — hero, position, outcome detail. */
  context: jsonb('context').notNull(),
  outcome: text('outcome').notNull(),
  resolvedAt: timestamp('resolved_at').defaultNow().notNull()
}, t => [index('hq_fights_userId_idx').on(t.userId)])

export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [index('chat_messages_createdAt_idx').on(t.createdAt)])

// One row per @mention in a chat message. `seen` flips once the mentioned
// user has actually had the message on screen (or jumped to it).
export const chatMentions = pgTable('chat_mentions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  messageId: text('message_id').notNull().references(() => chatMessages.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  seen: boolean('seen').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [index('chat_mentions_userId_idx').on(t.userId)])

// ─── AI assistant ───────────────────────────────────────────────────────────

export const aiConversations = pgTable('ai_conversations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New chat'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at')
}, t => [index('ai_conversations_userId_updatedAt_idx').on(t.userId, t.updatedAt)])

export const aiMessages = pgTable('ai_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull().default(''),
  toolCalls: jsonb('tool_calls'),
  toolCallId: text('tool_call_id'),
  toolName: text('tool_name'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [
  index('ai_messages_conversationId_createdAt_idx').on(t.conversationId, t.createdAt),
  index('ai_messages_userId_role_createdAt_idx').on(t.userId, t.role, t.createdAt)
])

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(user, { fields: [chatMessages.userId], references: [user.id] })
}))

export const chatMentionsRelations = relations(chatMentions, ({ one }) => ({
  message: one(chatMessages, { fields: [chatMentions.messageId], references: [chatMessages.id] }),
  user: one(user, { fields: [chatMentions.userId], references: [user.id] })
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(user, { fields: [transactions.userId], references: [user.id] })
}))

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  transactions: many(transactions),
  minerState: one(minerState),
  pirateState: one(pirateState),
  pirateCannons: many(pirateCannons),
  pirateRunHistory: many(pirateRunHistory),
  shapezzState: one(shapezzState),
  pathwardenState: one(pathwardenState),
  firewallState: one(firewallState)
}))

export const minerStateRelations = relations(minerState, ({ one }) => ({
  user: one(user, { fields: [minerState.userId], references: [user.id] })
}))

export const pirateStateRelations = relations(pirateState, ({ one }) => ({
  user: one(user, { fields: [pirateState.userId], references: [user.id] })
}))

export const pirateCannonsRelations = relations(pirateCannons, ({ one }) => ({
  user: one(user, { fields: [pirateCannons.userId], references: [user.id] })
}))

export const pirateRunHistoryRelations = relations(pirateRunHistory, ({ one }) => ({
  user: one(user, { fields: [pirateRunHistory.userId], references: [user.id] })
}))

export const shapezzStateRelations = relations(shapezzState, ({ one }) => ({
  user: one(user, { fields: [shapezzState.userId], references: [user.id] })
}))

export const pathwardenStateRelations = relations(pathwardenState, ({ one }) => ({
  user: one(user, { fields: [pathwardenState.userId], references: [user.id] })
}))

export const firewallStateRelations = relations(firewallState, ({ one }) => ({
  user: one(user, { fields: [firewallState.userId], references: [user.id] })
}))

export const firewallRunsRelations = relations(firewallRuns, ({ one }) => ({
  user: one(user, { fields: [firewallRuns.userId], references: [user.id] })
}))

export const callOfXenoStateRelations = relations(callOfXenoState, ({ one }) => ({
  user: one(user, { fields: [callOfXenoState.userId], references: [user.id] })
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id]
  })
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id]
  })
}))
