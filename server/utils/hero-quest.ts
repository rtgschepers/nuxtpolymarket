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

import { eq } from 'drizzle-orm'
import { db, type DbExecutor } from '#server/database'
import { hqShopUpgrades, hqState } from '#server/database/schema'
import { credit } from '#server/utils/balance'
import {
    BASE_KILL_COUNT,
    BOSS_TIMER_SECONDS,
    ONLINE_THRESHOLD_MS,
    STAGES_PER_WORLD,
    VOID_SHARD_BASE,
    VOID_SHARD_GROWTH,
    WORLD_COUNT
} from '#shared/utils/hero-quest/constants'
import {
    enemyStatsAt,
    killsBeforeWipe,
    offlineCapHours,
    offlineEfficiency,
    goldPerKill,
    secondsPerKill,
    settle,
    stageArchetype,
    xpToNextLevel
} from '#shared/utils/hero-quest/settle'
import { partyDps } from '#shared/utils/hero-quest/combat'
import { partyUnitStats } from '#shared/utils/hero-quest/stats'
import { D, ZERO, decPow, fromStore, toStore } from '#shared/utils/hero-quest/numbers'
import { CLASS_NODES, childrenOf, getClass, kitFor } from '#shared/utils/hero-quest/content/classes'
import { SHOP_TRACKS, maxLevelFor, shopTrackCost, type ShopTrackId } from '#shared/utils/hero-quest/content/shop'
import { enemyNameAt, getWorld, runProgress } from '#shared/utils/hero-quest/content/worlds'
import type { ClassId, HeroSnapshot, RunPosition, SettleResult } from '#shared/utils/hero-quest/types'

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

export function heroSnapshotOf(state: HqStateRow, shopLevels: Record<string, number>): HeroSnapshot {
    return {
        classId: state.heroNodeId as ClassId,
        heroLevel: state.heroLevel,
        heroXp: fromStore(state.heroXp),
        // No Gold% source exists until the gachas land; the field stays so settle's signature
        // doesn't move when they do.
        goldBonusPct: 0,
        offlineEfficiencyLevel: shopLevels.offlineEfficiency ?? 0,
        offlineCapLevel: shopLevels.offlineCap ?? 0
    }
}

export function isBossStage(stage: number): boolean {
    const archetype = stageArchetype(stage)
    return archetype === 'boss' || archetype === 'super_boss'
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
        const hero = heroSnapshotOf(state, shopLevels)
        const result = settle({ hero, position: positionOf(state), elapsedSeconds, online })

        const [updated] = await tx.update(hqState)
            .set({
                lastSettledAt: new Date(now),
                world: result.position.world,
                stage: result.position.stage,
                killCount: result.position.killsInStage,
                atBossGate: isBossStage(result.position.stage),
                heroLevel: result.heroLevel,
                heroXp: toStore(result.heroXp)
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
    const enemy = enemyStatsAt(position)
    const dps = partyDps(units, enemy.def)
    const spk = secondsPerKill(dps, enemy)
    const wipeAt = killsBeforeWipe(units, enemy, spk)
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

        enemyHp: enemy.hp.toString(),
        enemyPwr: enemy.pwr.toString(),
        enemyDef: enemy.def.toString(),
        partyDps: dps.toString(),
        secondsPerKill: Number.isFinite(spk) ? spk : null,
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
            spd: self.spd,
            attacksPerSecond: self.attacksPerSecond,
            strikesPerAttack: self.strikesPerAttack,
            critChance: self.critChance,
            critMultiplier: self.critMultiplier
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
    const format = id === 'offlineEfficiency'
        ? (value: number) => `${Math.round(offlineEfficiency(value) * 100)}%`
        : (value: number) => `${offlineCapHours(value)}h`
    const capped = level >= maxLevelFor(id)
    return { current: format(level), next: capped ? null : format(level + 1) }
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
