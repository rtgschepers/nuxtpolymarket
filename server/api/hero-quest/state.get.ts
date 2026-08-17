import { requireUserId } from '#server/utils/auth'
import { getBalance } from '#server/utils/balance'
import {
    getCollections,
    getHqState,
    getLoadouts,
    getShopLevels,
    heroSnapshotOf,
    serializeClassTree,
    serializeDigSite,
    serializeForge,
    serializeGuild,
    serializeHero,
    serializeLoadouts,
    serializeRun,
    serializeShop,
    serializeTrainingGrounds,
    settleHq,
    voidShardsFor
} from '#server/utils/hero-quest'
import { HQ_REFRESH_INTERVAL_MS, STAGES_PER_WORLD, WORLD_COUNT } from '#shared/utils/hero-quest/constants'
import { fromStore } from '#shared/utils/hero-quest/numbers'

/**
 * The one read the client makes.
 *
 * Settles first, always, so every read sees a settled world. Returns derived display values
 * rather than raw rows — it has two consumers (the composable and the AI agent's executor
 * overview) and neither should be re-deriving game math. Decimals go out as strings.
 *
 * All four gacha tabs are served from one call rather than one endpoint each, because they share
 * a settle and three of them read the same `hqCollection` query. Splitting them would mean four
 * settles per page load, and a settle is a write.
 */
export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event)

    // Founding is explicit. Same payload shape either way, so the composable stays simple.
    const existing = await getHqState(userId)
    if (!existing) {
        return {
            initialized: false as const,
            serverNow: Date.now(),
            refreshIntervalMs: HQ_REFRESH_INTERVAL_MS,
            worldCount: WORLD_COUNT,
            stagesPerWorld: STAGES_PER_WORLD,
            run: null,
            hero: null,
            shop: [],
            guild: null,
            forge: null,
            training: null,
            digSite: null,
            loadouts: null,
            classTree: [],
            voidShards: '0',
            nextPrestigeReward: voidShardsFor(0).toString(),
            settled: null
        }
    }

    const { state, result, online, previousLevel } = await settleHq(userId)
    const [shopLevels, collections, loadoutRows, balance] = await Promise.all([
        getShopLevels(userId),
        getCollections(userId),
        getLoadouts(userId),
        getBalance(userId)
    ])
    const hero = heroSnapshotOf(state, shopLevels, collections, parseFloat(balance) || 0)

    return {
        initialized: true as const,
        // Lets the client interpolate accrual without drifting against its own clock.
        serverNow: Date.now(),
        refreshIntervalMs: HQ_REFRESH_INTERVAL_MS,
        worldCount: WORLD_COUNT,
        stagesPerWorld: STAGES_PER_WORLD,

        run: serializeRun(state, hero),
        hero: serializeHero(state, hero),
        shop: serializeShop(shopLevels),
        classTree: serializeClassTree(state),

        guild: serializeGuild(state, collections.champion, shopLevels),
        forge: serializeForge(state, collections.gear),
        training: serializeTrainingGrounds(state, collections.skill, shopLevels),
        digSite: serializeDigSite(state, collections.artifact, shopLevels),
        loadouts: serializeLoadouts(loadoutRows, shopLevels),

        voidShards: fromStore(state.voidShards).toString(),
        nextPrestigeReward: voidShardsFor(state.prestige).toString(),

        /** What the settle just banked — the "while you were away" summary. */
        settled: result
            ? {
                online,
                kills: result.kills,
                goldEarned: result.goldEarned,
                xpEarned: result.xpEarned.toString(),
                levelsGained: result.heroLevel - previousLevel,
                effectiveSeconds: result.effectiveSeconds,
                blockedAtBoss: result.blockedAtBoss,
                wipedOnWave: result.wipedOnWave
            }
            : null
    }
})
