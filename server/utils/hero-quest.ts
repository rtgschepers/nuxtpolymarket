/**
 * Hero Quest domain layer.
 *
 * Everything that touches the database lives here; every formula lives in
 * `shared/utils/hero-quest/`. That split is what lets the client run the identical math to
 * animate between refreshes while the server stays the only thing that can *apply* anything.
 *
 * There is no cron, no interval and no background worker anywhere in this game — progress
 * accrues lazily on read, and the `hqState` row lock is the mutex (`tech-architecture.md`
 * §4a). See the block comment above `hqState` in the schema for the full settle contract.
 */

import { and, eq, sql } from 'drizzle-orm'
import { db, type DbExecutor } from '#server/database'
import { hqCollection, hqShopUpgrades, hqState } from '#server/database/schema'
import { credit } from '#server/utils/balance'
import {
    BASE_CHAMPION_SLOTS,
    BASE_KILL_COUNT,
    BOSS_TIMER_SECONDS,
    MAX_CHAMPION_SLOTS,
    ONLINE_THRESHOLD_MS,
    SEAL_GRANT_AMOUNT,
    SEAL_GRANT_BANK_CAP_DAYS,
    SEAL_GRANT_INTERVAL_HOURS,
    STAGES_PER_WORLD,
    TEN_PULL_SIZE,
    VOID_SHARD_BASE,
    VOID_SHARD_GROWTH,
    WORLD_COUNT
} from '#shared/utils/hero-quest/constants'
import {
    craftCostFor,
    dropRatesFor,
    dupesToLevelUp,
    investmentScalar,
    isMaxed,
    ladderDateKey,
    pullCost,
    pullsToNextLevel,
    sealLadderPrice,
    type GachaSystem
} from '#shared/utils/hero-quest/gacha'
import {
    CHAMPIONS,
    RARITY_STAT_MULTIPLIER,
    championDisplayName,
    championRarityHasContent,
    getArchetype,
    getChampion,
    isChampionId
} from '#shared/utils/hero-quest/content/champions'
import {
    enemyPackAt,
    enemyStatsAt,
    killsBeforeWipe,
    offlineCapHours,
    offlineEfficiency,
    goldPerKill,
    packDps,
    packHp,
    packSize,
    secondsPerKill,
    settle,
    stageArchetype,
    xpToNextLevel
} from '#shared/utils/hero-quest/settle'
import { partyUnitStats } from '#shared/utils/hero-quest/stats'
import { D, ZERO, decPow, fromStore, toStore } from '#shared/utils/hero-quest/numbers'
import { CLASS_NODES, childrenOf, getClass, kitFor } from '#shared/utils/hero-quest/content/classes'
import { SHOP_TRACKS, maxLevelFor, shopTrackCost, type ShopTrackId } from '#shared/utils/hero-quest/content/shop'
import { enemyNameAt, getWorld, runProgress } from '#shared/utils/hero-quest/content/worlds'
import type {
    ChampionArchetype,
    ChampionSnapshot,
    ClassId,
    FormationRow,
    HeroSnapshot,
    Rarity,
    RunPosition,
    SettleResult
} from '#shared/utils/hero-quest/types'

export type HqStateRow = typeof hqState.$inferSelect

export async function getHqState(userId: string) {
    return db.query.hqState.findFirst({ where: eq(hqState.userId, userId) })
}

/** Founding is explicit (`init.post.ts`); the conflict clause is what makes a double-init a no-op. */
export async function ensureHqState(userId: string, tx: DbExecutor = db) {
    await tx.insert(hqState).values({ userId }).onConflictDoNothing()
}

export async function getShopLevels(userId: string, tx: DbExecutor = db): Promise<Record<string, number>> {
    const rows = await tx.select().from(hqShopUpgrades).where(eq(hqShopUpgrades.userId, userId))
    const levels: Record<string, number> = {}
    for (const row of rows) levels[row.upgradeId] = row.level
    return levels
}

export function positionOf(state: HqStateRow): RunPosition {
    return { prestige: state.prestige, world: state.world, stage: state.stage, killsInStage: state.killCount }
}

export type HqCollectionRow = typeof hqCollection.$inferSelect

export async function getCollection(
    userId: string,
    system: GachaSystem,
    tx: DbExecutor = db
): Promise<HqCollectionRow[]> {
    return tx.select().from(hqCollection)
        .where(and(eq(hqCollection.userId, userId), eq(hqCollection.system, system)))
}

/** How many Champion slots the player has bought up to (`champions-guild-gacha.md` §1). */
export function championSlots(shopLevels: Record<string, number>): number {
    return Math.min(MAX_CHAMPION_SLOTS, BASE_CHAMPION_SLOTS + (shopLevels.championSlots ?? 0))
}

/**
 * Resolve the fielded party from the saved ID list.
 *
 * Filters to Champions actually owned and actually known content, then truncates to the
 * purchased slot count — so revoking a slot, or a roster edit that drops an ID, degrades to a
 * smaller party instead of throwing on every settle. The saved list is not trusted to be
 * within bounds just because the route that wrote it checked.
 */
export function championSnapshotsFor(
    state: HqStateRow,
    collection: readonly HqCollectionRow[],
    slots: number
): ChampionSnapshot[] {
    const owned = new Map(collection.map(row => [row.contentId, row]))
    const formation = state.formation as Record<string, 'front' | 'back'>

    return (state.partyChampionIds as string[])
        .filter(id => owned.has(id) && isChampionId(id))
        .slice(0, Math.max(0, slots))
        .map((id) => {
            const row = owned.get(id)!
            const definition = getChampion(id)
            return {
                championId: id,
                archetype: definition.archetype,
                rarityMultiplier: RARITY_STAT_MULTIPLIER[definition.rarity],
                investment: investmentScalar(row.star, row.level),
                strikesPerAttack: definition.strikesPerAttack,
                row: formation[id] ?? getArchetype(definition.archetype).defaultRow,
                // Straight from content — the roster is the only authority on what a
                // Champion can do, and the count is fixed by its rarity.
                abilities: definition.abilities
            }
        })
}

/** Every owned copy, fielded or not — the §7 passive reads all of them. */
export function ownedChampionsFor(collection: readonly HqCollectionRow[]) {
    return collection
        .filter(row => isChampionId(row.contentId))
        .map(row => ({
            archetype: getChampion(row.contentId).archetype,
            investment: investmentScalar(row.star, row.level)
        }))
}

export function heroSnapshotOf(
    state: HqStateRow,
    shopLevels: Record<string, number>,
    collection: readonly HqCollectionRow[] = []
): HeroSnapshot {
    const formation = state.formation as Record<string, 'front' | 'back'>
    return {
        classId: state.heroNodeId as ClassId,
        heroRow: formation.hero,
        heroLevel: state.heroLevel,
        heroXp: fromStore(state.heroXp),
        // No Gold% source exists until Skills and Artifacts land; the field stays so settle's
        // signature doesn't move when they do.
        goldBonusPct: 0,
        offlineEfficiencyLevel: shopLevels.offlineEfficiency ?? 0,
        offlineCapLevel: shopLevels.offlineCap ?? 0,
        champions: championSnapshotsFor(state, collection, championSlots(shopLevels)),
        ownedChampions: ownedChampionsFor(collection)
    }
}

export function isBossStage(stage: number): boolean {
    const archetype = stageArchetype(stage)
    return archetype === 'boss' || archetype === 'super_boss'
}

/**
 * Grant the same number of every Seal type, in one statement.
 *
 * Milestones are not gacha-specific, so they pay all four currencies together
 * (`economy-and-currencies.md` §5). Written as an SQL increment rather than read-then-write
 * so it composes safely with whatever else the caller's transaction is doing.
 */
export function sealGrantSet(amount: number) {
    const by = Math.max(0, Math.floor(amount))
    return {
        forgeSeals: sql`${hqState.forgeSeals} + ${by}`,
        guildSeals: sql`${hqState.guildSeals} + ${by}`,
        skillSeals: sql`${hqState.skillSeals} + ${by}`,
        excavationSeals: sql`${hqState.excavationSeals} + ${by}`
    }
}

/**
 * How many free time-gated grants are owed, and the clock value to write back.
 *
 * Banks up to `SEAL_GRANT_BANK_CAP_DAYS` intervals so a few missed days aren't punishing,
 * but never accrues indefinitely. A null clock means the account has never been granted —
 * it pays one interval immediately, so a brand-new player can pull without waiting a day.
 *
 * The returned clock advances by whole intervals actually paid, not to `now`, so a partial
 * interval is never silently discarded.
 */
export function dueSealGrants(lastGrantAt: Date | null, now: number): { grants: number; clock: Date } {
    const intervalMs = SEAL_GRANT_INTERVAL_HOURS * 3600 * 1000
    if (!lastGrantAt) return { grants: SEAL_GRANT_AMOUNT, clock: new Date(now) }

    const elapsed = now - lastGrantAt.getTime()
    if (elapsed < intervalMs) return { grants: 0, clock: lastGrantAt }

    const whole = Math.floor(elapsed / intervalMs)
    const capped = Math.min(whole, SEAL_GRANT_BANK_CAP_DAYS)
    return {
        grants: capped * SEAL_GRANT_AMOUNT,
        clock: new Date(lastGrantAt.getTime() + whole * intervalMs)
    }
}

/** Payout for completing a prestige, `VOID_SHARD_BASE × VOID_SHARD_GROWTH^prestigeCompleted`. */
export function voidShardsFor(prestigeCompleted: number) {
    return D(VOID_SHARD_BASE).mul(decPow(VOID_SHARD_GROWTH, Math.max(0, prestigeCompleted)))
}

export interface SettleOutcome {
    state: HqStateRow
    result: SettleResult | null
    /** True when the window was short enough to count as the player being present. */
    online: boolean
    /** Hero level before the window, so callers can report levels gained. */
    previousLevel: number
    elapsedSeconds: number
}

/**
 * Accrue everything that has happened since `lastSettledAt`, and write it down.
 *
 * Steps, in the order `tech-architecture.md` §4a fixes them:
 *
 * 1. Take the row lock. Two concurrent settles would otherwise read the same
 *    `lastSettledAt` and both pay the same window out; the loser blocks here and then reads
 *    a timestamp that has already moved.
 * 2. Early-return on a non-positive gap.
 * 3. Classify the chunk as online or offline — that is what decides whether the offline cap
 *    and efficiency apply at all.
 * 4. Run the pure `settle()`. It stops at boss gates and never resolves one.
 * 5. Credit Gold through `balance.ts` **with the tx**, then write the new position back.
 *
 * Battle Speed is Phase 4; `settle()` already takes the boost window, so wiring it later is
 * a call-site change here and nothing else.
 */
export async function settleHq(userId: string): Promise<SettleOutcome> {
    return db.transaction(async (tx) => {
        await ensureHqState(userId, tx)
        const [state] = await tx.select().from(hqState).where(eq(hqState.userId, userId)).for('update')
        if (!state) throw createError({ statusCode: 500, statusMessage: 'Could not initialize Hero Quest state' })

        const now = Date.now()
        const elapsedMs = now - state.lastSettledAt.getTime()
        if (elapsedMs <= 0) return { state, result: null, online: true, previousLevel: state.heroLevel, elapsedSeconds: 0 }

        // Presence is demonstrated by the request pattern, never asserted by the client. A
        // closed app is indistinguishable from a dead network — which degrades to offline
        // rules rather than inflating them, the correct direction to fail in.
        const online = elapsedMs <= ONLINE_THRESHOLD_MS
        const elapsedSeconds = elapsedMs / 1000

        const shopLevels = await getShopLevels(userId, tx)
        // Read inside the lock: the party's power depends on collection rows a concurrent
        // pull may be writing, and a stale read would settle the window at the wrong rate.
        const collection = await getCollection(userId, 'champion', tx)
        const hero = heroSnapshotOf(state, shopLevels, collection)
        const result = settle({ hero, position: positionOf(state), elapsedSeconds, online })

        // The free time-gated Seal grant rides the settle rather than a route of its own:
        // settle is the one thing every read and every mutation already goes through, and a
        // separate claim endpoint would be a second read-then-write to guard for no gain.
        const due = dueSealGrants(state.lastSealGrantAt, now)

        const [updated] = await tx.update(hqState)
            .set({
                lastSettledAt: new Date(now),
                world: result.position.world,
                stage: result.position.stage,
                killCount: result.position.killsInStage,
                atBossGate: isBossStage(result.position.stage),
                heroLevel: result.heroLevel,
                heroXp: toStore(result.heroXp),
                ...(due.grants > 0 ? { ...sealGrantSet(due.grants), lastSealGrantAt: due.clock } : {})
            })
            .where(eq(hqState.userId, userId))
            .returning()

        // Gold is a shared platform balance — it only ever moves through balance.ts, and the
        // tx has to be threaded or the write goes out on a second pool connection and
        // deadlocks against the lock this transaction is already holding.
        if (result.goldEarned > 0) {
            await credit(userId, result.goldEarned.toFixed(4), 'hero-quest', tx)
        }

        return { state: updated ?? state, result, online, previousLevel: state.heroLevel, elapsedSeconds }
    })
}

/**
 * Reset the run and start the next prestige.
 *
 * **Writes four columns and increments `prestige`.** `heroLevel`, `heroXp`, `heroNodeId`,
 * `seenNodeIds`, `voidShards` and every shop row are untouched — hero level persists across
 * prestige *and* across class switches, and there is no relevel anywhere in the game
 * (`core-progression-and-prestige.md` §3). Everything else survives by simply not being
 * written, which is why this is a domain function and not a schema concern.
 */
export function prestigeResetValues(state: HqStateRow) {
    return {
        prestige: state.prestige + 1,
        world: 1,
        stage: 1,
        killCount: 0,
        atBossGate: false
    }
}

/** Class picks legal at a prestige: anything already seen, plus one tier deeper than the current node. */
export function pickableClasses(state: HqStateRow): ClassId[] {
    const seen = new Set(state.seenNodeIds as string[])
    const deeper = childrenOf(state.heroNodeId as ClassId).map(node => node.id)
    return CLASS_NODES.map(node => node.id).filter(id => seen.has(id) || deeper.includes(id))
}

// ── Serializers ────────────────────────────────────────────────────────────────────────
//
// `state.get.ts` has two consumers — the composable and the AI agent's executor overview —
// so it returns derived display values rather than raw rows. Decimals go out as strings and
// are formatted client-side by `numbers.ts`.

export function serializeRun(state: HqStateRow, hero: HeroSnapshot) {
    const position = positionOf(state)
    const units = partyUnitStats(hero)
    // Per-enemy stats and the whole encounter, both — the client shows one enemy's numbers
    // alongside how many of them are standing.
    const enemy = enemyStatsAt(position)
    const pack = enemyPackAt(position)
    const dps = packDps(units, pack)
    const spk = secondsPerKill(units, pack)
    const wipeAt = killsBeforeWipe(units, pack, spk)
    const { name: enemyName, archetype } = enemyNameAt(position.world, position.stage)
    const atBoss = isBossStage(position.stage)
    const killsNeeded = atBoss ? 0 : BASE_KILL_COUNT

    return {
        prestige: position.prestige,
        world: position.world,
        stage: position.stage,
        worldName: getWorld(position.world).name,
        enemyName,
        archetype,
        killCount: position.killsInStage,
        killsRequired: killsNeeded,
        atBossGate: atBoss,
        /** The World 10 super boss is down — prestige is available. */
        runCleared: state.runCleared,
        bossTimerSeconds: BOSS_TIMER_SECONDS,
        progress: runProgress(position.world, position.stage),
        worldCount: WORLD_COUNT,
        stagesPerWorld: STAGES_PER_WORLD,

        /** Per *enemy*, not per pack — `packSize` says how many of these are standing. */
        enemyHp: enemy.hp.toString(),
        enemyPwr: enemy.pwr.toString(),
        enemyDef: enemy.def.toString(),
        packSize: packSize(pack),
        packHp: packHp(pack).toString(),
        partyDps: dps.toString(),
        /** Amortized per enemy, so it stays comparable to `goldPerKill`. */
        secondsPerKill: Number.isFinite(spk) ? spk : null,
        /** Seconds to clear a whole encounter — what the battle animation should cycle on. */
        secondsPerPack: Number.isFinite(spk) ? spk * packSize(pack) : null,
        goldPerKill: goldPerKill(position.prestige, position.world, position.stage),
        goldPerHour: Number.isFinite(spk) && spk > 0
            ? (3600 / spk) * goldPerKill(position.prestige, position.world, position.stage)
            : 0,

        /**
         * How many kills one stage attempt survives. Below `killsRequired` the stage restarts
         * instead of clearing — the run holds position and keeps earning, so levelling is
         * what breaks the wall.
         */
        killsBeforeWipe: Number.isFinite(wipeAt) ? wipeAt : null,
        walled: !atBoss && wipeAt < killsNeeded
    }
}

export function serializeHero(state: HqStateRow, hero: HeroSnapshot) {
    const node = getClass(hero.classId)
    const units = partyUnitStats(hero)
    const self = units[0]!
    const xp = fromStore(state.heroXp)
    const needed = xpToNextLevel(hero.heroLevel)

    return {
        classId: node.id,
        className: node.name,
        tier: node.tier,
        level: hero.heroLevel,
        xp: xp.toString(),
        xpToNextLevel: needed.toString(),
        xpProgress: needed.lte(0) ? 0 : Math.min(1, xp.div(needed).toNumber()),
        skills: kitFor(hero.classId),
        stats: {
            pwr: self.pwr.toString(),
            def: self.def.toString(),
            maxHp: self.maxHp.toString(),
            // Decimals cross the wire as strings (`tech-architecture.md` §5). SPD and the
            // crit multiplier joined them when the stat block became Decimal — sending the
            // objects raw would serialize break_eternity's internals, not a number.
            spd: self.spd.toString(),
            attacksPerSecond: self.attacksPerSecond,
            strikesPerAttack: self.strikesPerAttack,
            /** A probability, genuinely a number — not a Decimal that needs stringifying. */
            critChance: self.critChance,
            critMultiplier: self.critMultiplier.toString()
        }
    }
}

export function serializeShop(shopLevels: Record<string, number>) {
    return SHOP_TRACKS.map(track => {
        const level = shopLevels[track.id] ?? 0
        return {
            id: track.id,
            name: track.name,
            description: track.description,
            level,
            maxLevel: track.maxLevel,
            /** `null` means maxed — the client renders that rather than an unbuyable price. */
            nextCost: shopTrackCost(track.id as ShopTrackId, level),
            effect: shopTrackEffect(track.id as ShopTrackId, level)
        }
    })
}

/** Human-readable current and next value for a track, so the client holds no formula. */
function shopTrackEffect(id: ShopTrackId, level: number): { current: string; next: string | null } {
    const formatters: Record<ShopTrackId, (value: number) => string> = {
        offlineEfficiency: value => `${Math.round(offlineEfficiency(value) * 100)}%`,
        offlineCap: value => `${offlineCapHours(value)}h`,
        championSlots: value => `${championSlots({ championSlots: value })} Champions`
    }
    const format = formatters[id]
    const capped = level >= maxLevelFor(id)
    return { current: format(level), next: capped ? null : format(level + 1) }
}

/**
 * The Guild tab: every Champion in the roster, with the player's copy state folded in.
 *
 * Returns the **whole roster**, owned or not, so the client can render a collection grid with
 * locked entries rather than having to know the roster itself. Un-owned entries carry
 * `owned: false` and no progress.
 */
/**
 * How many Guild Seals were bought with Gold today, treating a stale date as zero.
 *
 * Shared by the serializer and the buy route so the price the client is shown and the price
 * it is charged can never come from two different readings of the same rollover.
 */
export function sealsBoughtToday(state: HqStateRow): number {
    if (state.sealLadderDate !== ladderDateKey()) return 0
    return (state.sealLadderPurchasedToday as Record<string, number>).champion ?? 0
}

/**
 * One Champion as the Guild tab sees it — roster content with the player's copy folded in.
 *
 * Spelled out rather than inferred, and the reason is mechanical: Nitro wraps every handler's
 * return in `SerializeObject<...>` to derive the client-side type, and the inference gave up
 * once this payload grew past a certain size, silently degrading array elements to `never`
 * and scalars to `undefined` at the call sites in `guild.vue`. An explicit annotation both
 * fixes that and gives a payload with two consumers a contract worth reading.
 */
export interface GuildRosterEntry {
    id: string
    name: string
    givenName: string
    archetype: ChampionArchetype
    archetypeName: string
    rarity: Rarity
    abilities: string[]
    defaultRow: FormationRow
    row: FormationRow
    owned: boolean
    star: number
    level: number
    dupeProgress: number
    dupesToLevelUp: number | null
    investment: number
    maxed: boolean
    craftCost: number
    fielded: boolean
}

export interface GuildPayload {
    seals: number
    essence: number
    gachaLevel: number
    gachaProgress: number
    pullsToNextLevel: number | null
    dropRates: readonly number[]
    singleCost: number
    tenPullCost: number
    slots: number
    sealsBoughtToday: number
    nextSealPrice: number
    partyChampionIds: string[]
    heroRow: FormationRow
    roster: GuildRosterEntry[]
}

export function serializeGuild(
    state: HqStateRow,
    collection: readonly HqCollectionRow[],
    shopLevels: Record<string, number>
): GuildPayload {
    const owned = new Map(collection.map(row => [row.contentId, row]))
    const levels = state.gachaLevels as Record<string, number>
    const progress = state.gachaProgress as Record<string, number>
    const gachaLevel = levels.champion ?? 1
    const formation = state.formation as Record<string, 'front' | 'back'>

    return {
        seals: state.guildSeals,
        essence: state.championEssence,
        gachaLevel,
        gachaProgress: progress.champion ?? 0,
        pullsToNextLevel: pullsToNextLevel(gachaLevel),
        /**
         * The designed table, straight — which is now also the *effective* one.
         *
         * This used to be served through `effectiveDropRates`, because a partial roster made
         * unshipped rarities fold down into their nearest shipped neighbour and showing the raw
         * table would have advertised a 60% Epic chance the roster could not honour. The
         * Champion roster is complete, so the two are the same table and the fold is gone.
         */
        dropRates: dropRatesFor(gachaLevel),
        singleCost: pullCost(1).seals,
        tenPullCost: pullCost(TEN_PULL_SIZE).seals,
        slots: championSlots(shopLevels),

        /**
         * The Gold ladder's current rung. Counters reset daily and are keyed per gacha, so a
         * stale `sealLadderDate` reads as zero bought today rather than carrying yesterday's
         * price forward.
         */
        sealsBoughtToday: sealsBoughtToday(state),
        nextSealPrice: sealLadderPrice('champion', sealsBoughtToday(state)),
        partyChampionIds: state.partyChampionIds as string[],
        heroRow: formation.hero ?? getClass(state.heroNodeId as ClassId).defaultRow,

        roster: CHAMPIONS.map((definition) => {
            const row = owned.get(definition.id)
            const archetype = getArchetype(definition.archetype)
            return {
                id: definition.id,
                name: championDisplayName(definition),
                givenName: definition.givenName,
                archetype: definition.archetype,
                archetypeName: archetype.name,
                rarity: definition.rarity,
                abilities: definition.abilities.map(entry => entry.name),
                defaultRow: archetype.defaultRow,
                row: formation[definition.id] ?? archetype.defaultRow,
                owned: row !== undefined,
                star: row?.star ?? 0,
                level: row?.level ?? 0,
                dupeProgress: row?.dupeProgress ?? 0,
                dupesToLevelUp: row ? dupesToLevelUp(row.star, row.level) : null,
                investment: row ? investmentScalar(row.star, row.level) : 0,
                maxed: row ? isMaxed(row) : false,
                /** Essence price of crafting this one outright — its rarity is fixed, so is this. */
                craftCost: craftCostFor(definition.rarity),
                fielded: (state.partyChampionIds as string[]).includes(definition.id)
            }
        })
    }
}

export function serializeClassTree(state: HqStateRow) {
    const seen = new Set(state.seenNodeIds as string[])
    const pickable = new Set(pickableClasses(state))
    return CLASS_NODES.map(node => ({
        id: node.id,
        name: node.name,
        parentId: node.parentId,
        tier: node.tier,
        skill: node.skill,
        seen: seen.has(node.id),
        pickable: pickable.has(node.id),
        current: node.id === state.heroNodeId
    }))
}

/** Bump a shop track by exactly one level, or return null if someone else got there first. */
export async function claimShopLevel(
    tx: DbExecutor,
    userId: string,
    upgradeId: string,
    currentLevel: number
) {
    // Integer compare-and-swap: safe here in a way a timestamp CAS never is. Only the request
    // that finds the row still at `currentLevel` wins, and everyone else rolls back before
    // any currency moves.
    const [claimed] = await tx.insert(hqShopUpgrades)
        .values({ userId, upgradeId, level: currentLevel + 1 })
        .onConflictDoUpdate({
            target: [hqShopUpgrades.userId, hqShopUpgrades.upgradeId],
            set: { level: currentLevel + 1 },
            setWhere: eq(hqShopUpgrades.level, currentLevel)
        })
        .returning({ level: hqShopUpgrades.level })
    return claimed ?? null
}

/** Spend Void Shards, guarded by the read that produced `balance` being inside the same lock. */
export function spendVoidShards(balance: string, cost: number): string | null {
    const held = fromStore(balance)
    const price = D(cost)
    if (held.lt(price)) return null
    const left = held.sub(price)
    return toStore(left.lt(0) ? ZERO : left)
}
