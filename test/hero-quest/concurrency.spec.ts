/**
 * Concurrency guarantees for every Hero Quest route that grants or spends value.
 *
 * The platform has been bitten by this exact shape before — 10 parallel rakeback claims
 * paying out 10×. Under READ COMMITTED, a `SELECT` to check followed by an `UPDATE` to apply
 * means N concurrent requests all read the same pre-state, all pass, and all apply. Every
 * case below is a burst that must resolve to exactly one winner.
 *
 * Needs the local Postgres from .env. Skips when DATABASE_URL is unset.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '#server/database'
import { hqCollection, hqShopUpgrades, hqState } from '#server/database/schema'
import { credit, debit, getBalance } from '#server/utils/balance'
import { claimShopLevel, ensureHqState, getShopLevels, settleHq } from '#server/utils/hero-quest'
import { OFFLINE_EFFICIENCY_BASE_COST, TEN_PULL_SIZE } from '#shared/utils/hero-quest/constants'
import {
    applyDupes,
    applyPulls,
    craftCostFor,
    ladderDateKey,
    newEntry,
    pullCost,
    rarityFromRoll,
    sealLadderPrice,
    sealLadderTotal
} from '#shared/utils/hero-quest/gacha'
import { championFromRoll, getChampion } from '#shared/utils/hero-quest/content/champions'
import { randomFloat } from '#shared/utils/random'
import { SKIP, burst, cleanupUser, seedUser } from '../setup/db-helpers'

const USER_ID = 'test-hero-quest-race-user'

async function cleanup() {
    await db.delete(hqCollection).where(eq(hqCollection.userId, USER_ID))
    await db.delete(hqShopUpgrades).where(eq(hqShopUpgrades.userId, USER_ID))
    await db.delete(hqState).where(eq(hqState.userId, USER_ID))
    await cleanupUser(USER_ID)
}

/** Rewind the settle clock so there is a real window to bank. */
async function backdate(seconds: number) {
    await db.update(hqState)
        .set({ lastSettledAt: new Date(Date.now() - seconds * 1000) })
        .where(eq(hqState.userId, USER_ID))
}

describe.skipIf(SKIP)('hero-quest concurrency', () => {
    beforeEach(async () => {
        await cleanup()
        await seedUser(USER_ID, { balance: '0' })
    })
    afterEach(cleanup)
    afterAll(async () => { await db.$client.end() })

    describe('settleHq', () => {
        it('pays one elapsed window once, however many settles race for it', async () => {
            await ensureHqState(USER_ID)
            await backdate(3600)

            await burst(10, () => settleHq(USER_ID))

            // The row lock is the mutex: the first settle advances lastSettledAt, and every
            // other one then reads a window of roughly zero.
            const single = parseFloat(await getBalance(USER_ID))
            await cleanup()
            await seedUser(USER_ID, { balance: '0' })
            await ensureHqState(USER_ID)
            await backdate(3600)
            await settleHq(USER_ID)

            expect(single).toBeCloseTo(parseFloat(await getBalance(USER_ID)), 0)
        })

        it('never rewinds the settle clock', async () => {
            await ensureHqState(USER_ID)
            await backdate(3600)
            const before = Date.now()

            await burst(10, () => settleHq(USER_ID))

            const [state] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
            expect(state!.lastSettledAt.getTime()).toBeGreaterThanOrEqual(before - 1000)
        })

        it('creates exactly one state row under a concurrent first-touch burst', async () => {
            await burst(10, () => settleHq(USER_ID))

            const rows = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
            expect(rows).toHaveLength(1)
        })
    })

    describe('shop purchases', () => {
        it('lets exactly one of N concurrent claims take a level', async () => {
            await ensureHqState(USER_ID)

            const result = await burst(10, async () => {
                const claimed = await claimShopLevel(db, USER_ID, 'offlineEfficiency', 0)
                if (!claimed) throw new Error('lost the claim')
                return claimed
            })

            expect(result.ok).toBe(1)
            expect(result.rejected).toBe(9)
            expect((await getShopLevels(USER_ID)).offlineEfficiency).toBe(1)
        })

        it('never lets a track skip past the level actually paid for', async () => {
            await ensureHqState(USER_ID)

            // Everyone reads level 0 and tries to buy level 1 — the classic read-then-write
            // burst. Exactly one may land, and it must land on 1, not 10.
            await burst(10, () => claimShopLevel(db, USER_ID, 'offlineCap', 0))

            expect((await getShopLevels(USER_ID)).offlineCap).toBe(1)
        })

        it('writes one row per track, not one per purchase', async () => {
            await ensureHqState(USER_ID)

            for (let level = 0; level < 3; level++) {
                await claimShopLevel(db, USER_ID, 'offlineEfficiency', level)
            }

            const rows = await db.select().from(hqShopUpgrades).where(eq(hqShopUpgrades.userId, USER_ID))
            expect(rows).toHaveLength(1)
            expect(rows[0]!.level).toBe(3)
        })

        it('rejects a claim staked on a level the track has already left', async () => {
            await ensureHqState(USER_ID)
            await claimShopLevel(db, USER_ID, 'offlineEfficiency', 0)

            // A request that read level 0 before someone else bought it must not apply.
            expect(await claimShopLevel(db, USER_ID, 'offlineEfficiency', 0)).toBeNull()
        })
    })

    describe('void shards', () => {
        it('cannot be spent twice by a concurrent pair of purchases', async () => {
            await ensureHqState(USER_ID)
            // Exactly one level's worth — the second buy must find an empty purse.
            await db.update(hqState)
                .set({ voidShards: String(OFFLINE_EFFICIENCY_BASE_COST) })
                .where(eq(hqState.userId, USER_ID))

            await burst(8, () => $shopBuy())

            const [state] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
            expect(Number(state!.voidShards)).toBeGreaterThanOrEqual(0)
            expect((await getShopLevels(USER_ID)).offlineEfficiency).toBeLessThanOrEqual(1)
        })
    })

    /**
     * Gacha pulls — the highest-value burst target in the phase.
     *
     * A pull reads a Seal balance, rolls an outcome, and writes Seals, gacha level and
     * collection rows. Without the conditional debit as the guard, N parallel pulls all read
     * the same balance and all pay out — the rakeback bug with a different currency.
     */
    describe('guild pulls', () => {
        it('lets exactly one of N concurrent pulls spend the only Seal', async () => {
            await ensureHqState(USER_ID)
            await db.update(hqState).set({ guildSeals: 1 }).where(eq(hqState.userId, USER_ID))

            const { ok } = await burst(10, () => $pull(1))
            expect(ok).toBe(1)

            const [state] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
            expect(state!.guildSeals).toBe(0)
        })

        it('never drives the Seal balance negative under a burst', async () => {
            await ensureHqState(USER_ID)
            await db.update(hqState).set({ guildSeals: 5 }).where(eq(hqState.userId, USER_ID))

            await burst(20, () => $pull(1))

            const [state] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
            expect(state!.guildSeals).toBeGreaterThanOrEqual(0)
        })

        it('keeps exactly one collection row per Champion, however many dupes land', async () => {
            await ensureHqState(USER_ID)
            await db.update(hqState).set({ guildSeals: 30 }).where(eq(hqState.userId, USER_ID))

            await burst(30, () => $pull(1))

            const rows = await db.select().from(hqCollection).where(eq(hqCollection.userId, USER_ID))
            const ids = rows.map(row => row.contentId)
            // The unique constraint is what makes "one copy, levelled by dupes" expressible.
            expect(new Set(ids).size).toBe(ids.length)
            expect(rows.every(row => row.system === 'champion')).toBe(true)
        })

        it('counts pulls granted rather than Seals spent when levelling the gacha', async () => {
            await ensureHqState(USER_ID)
            await db.update(hqState).set({ guildSeals: 9 }).where(eq(hqState.userId, USER_ID))

            await $pull(TEN_PULL_SIZE)

            const [state] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
            expect(state!.guildSeals).toBe(0)
            // 9 Seals bought 10 pulls, which is exactly the level-1 threshold.
            expect((state!.gachaLevels as Record<string, number>).champion).toBe(2)
        })
    })

    describe('crafting', () => {
        const RARE = 'champ_dorne'
        const cost = craftCostFor('rare')

        it('lets exactly one of N concurrent crafts spend a single craft’s worth', async () => {
            await ensureHqState(USER_ID)
            await db.update(hqState).set({ championEssence: cost }).where(eq(hqState.userId, USER_ID))

            const { ok } = await burst(10, () => $craft(RARE))
            expect(ok).toBe(1)

            const [state] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
            expect(state!.championEssence).toBe(0)
        })

        it('never drives Essence negative, and grants no more copies than were paid for', async () => {
            await ensureHqState(USER_ID)
            // Exactly three crafts' worth.
            await db.update(hqState).set({ championEssence: cost * 3 }).where(eq(hqState.userId, USER_ID))

            const { ok } = await burst(15, () => $craft(RARE))
            expect(ok).toBe(3)

            const [state] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
            expect(state!.championEssence).toBe(0)

            // Three grants merge into one row: one new copy plus two duplicates.
            const rows = await db.select().from(hqCollection).where(eq(hqCollection.userId, USER_ID))
            expect(rows).toHaveLength(1)
            expect(rows[0]!.contentId).toBe(RARE)
        })
    })

    describe('seal gold ladder', () => {
        it('never sells two Seals at the same rung under a concurrent pair', async () => {
            await ensureHqState(USER_ID)
            // Enough Gold for the first two rungs several times over.
            await db.update(hqState).set({ guildSeals: 0 }).where(eq(hqState.userId, USER_ID))
            await credit(USER_ID, '100000000', 'test')

            await burst(2, () => $buySeals(1))

            const [state] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
            expect(state!.guildSeals).toBe(2)
            // The counter must have advanced twice, which is what makes the second buy dearer.
            expect((state!.sealLadderPurchasedToday as Record<string, number>).champion).toBe(2)

            // Both rungs charged, not the base rung twice.
            const expected = sealLadderTotal('champion', 0, 2)
            const spent = 100_000_000 - Number(await getBalance(USER_ID))
            expect(spent).toBeCloseTo(expected, 2)
        })

        it('stops selling once Gold runs out rather than going negative', async () => {
            await ensureHqState(USER_ID)
            // Enough for exactly one rung.
            await credit(USER_ID, String(sealLadderPrice('champion', 0)), 'test')

            await burst(6, () => $buySeals(1))

            expect(Number(await getBalance(USER_ID))).toBeGreaterThanOrEqual(0)
            const [state] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
            expect(state!.guildSeals).toBe(1)
        })
    })
})

/**
 * The craft route body, inlined. Guard under test: the conditional Essence debit.
 */
async function $craft(championId: string) {
    const definition = getChampion(championId)
    const cost = craftCostFor(definition.rarity)
    return db.transaction(async (tx) => {
        const [claimed] = await tx.update(hqState)
            .set({ championEssence: sql`${hqState.championEssence} - ${cost}` })
            .where(and(eq(hqState.userId, USER_ID), sql`${hqState.championEssence} >= ${cost}`))
            .returning()
        if (!claimed) throw new Error('insufficient essence')

        const [existing] = await tx.select().from(hqCollection)
            .where(and(
                eq(hqCollection.userId, USER_ID),
                eq(hqCollection.system, 'champion'),
                eq(hqCollection.contentId, championId)
            ))
        const before = existing
            ? { star: existing.star, level: existing.level, dupeProgress: existing.dupeProgress }
            : null
        const entry = before ? applyDupes(before, 1, definition.rarity).entry : newEntry()

        await tx.insert(hqCollection)
            .values({ userId: USER_ID, system: 'champion', contentId: championId, ...entry })
            .onConflictDoUpdate({
                target: [hqCollection.userId, hqCollection.system, hqCollection.contentId],
                set: { star: entry.star, level: entry.level, dupeProgress: entry.dupeProgress }
            })
        return entry
    })
}

/**
 * The buy-seals route body, inlined. Guard under test: **lock-then-read**. The price depends
 * on the counter's old value inside a jsonb map, so there is nothing to compare-and-swap —
 * the row lock is what stops two buyers both pricing at the base rung.
 */
async function $buySeals(count: number) {
    return db.transaction(async (tx) => {
        const [state] = await tx.select().from(hqState).where(eq(hqState.userId, USER_ID)).for('update')
        if (!state) throw new Error('no state')

        const today = ladderDateKey()
        const counters = state.sealLadderDate === today
            ? state.sealLadderPurchasedToday as Record<string, number>
            : {}
        const boughtToday = counters.champion ?? 0
        const total = sealLadderTotal('champion', boughtToday, count)

        await debit(USER_ID, total.toFixed(4), 'hero-quest:guild-seals', tx)

        await tx.update(hqState)
            .set({
                guildSeals: sql`${hqState.guildSeals} + ${count}`,
                sealLadderPurchasedToday: { ...counters, champion: boughtToday + count },
                sealLadderDate: today
            })
            .where(eq(hqState.userId, USER_ID))
        return total
    })
}

/**
 * The pull route body, inlined — same reason as `$shopBuy` below: the handler needs an H3
 * event, so this reproduces the transaction shape rather than the HTTP layer. The guard under
 * test is the conditional Seal debit.
 */
async function $pull(count: number) {
    const cost = pullCost(count)
    return db.transaction(async (tx) => {
        const [claimed] = await tx.update(hqState)
            .set({ guildSeals: sql`${hqState.guildSeals} - ${cost.seals}` })
            .where(and(eq(hqState.userId, USER_ID), sql`${hqState.guildSeals} >= ${cost.seals}`))
            .returning()
        if (!claimed) throw new Error('insufficient seals')

        const levels = claimed.gachaLevels as Record<string, number>
        const progress = claimed.gachaProgress as Record<string, number>
        const gachaLevel = levels.champion ?? 1

        const existing = await tx.select().from(hqCollection)
            .where(and(eq(hqCollection.userId, USER_ID), eq(hqCollection.system, 'champion')))
        const entries = new Map(existing.map(row => [row.contentId, {
            star: row.star, level: row.level, dupeProgress: row.dupeProgress
        }]))

        const touched = new Set<string>()
        for (let index = 0; index < cost.pulls; index++) {
            const rarity = rarityFromRoll(gachaLevel, randomFloat())
            const definition = championFromRoll(rarity, randomFloat())
            const before = entries.get(definition.id)
            entries.set(definition.id, before ? applyDupes(before, 1, definition.rarity).entry : newEntry())
            touched.add(definition.id)
        }

        for (const contentId of touched) {
            const entry = entries.get(contentId)!
            await tx.insert(hqCollection)
                .values({ userId: USER_ID, system: 'champion', contentId, ...entry })
                .onConflictDoUpdate({
                    target: [hqCollection.userId, hqCollection.system, hqCollection.contentId],
                    set: { star: entry.star, level: entry.level, dupeProgress: entry.dupeProgress }
                })
        }

        const advanced = applyPulls(gachaLevel, progress.champion ?? 0, cost.pulls)
        await tx.update(hqState)
            .set({
                gachaLevels: { ...levels, champion: advanced.level },
                gachaProgress: { ...progress, champion: advanced.progress }
            })
            .where(eq(hqState.userId, USER_ID))
        return advanced
    })
}

/**
 * The shop-buy route body, inlined.
 *
 * The handler itself needs an H3 event, so this exercises the same transaction shape the
 * route uses — lock the state row, read the balance inside the lock, claim the level, then
 * write both.
 */
async function $shopBuy() {
    return db.transaction(async (tx) => {
        const [state] = await tx.select().from(hqState).where(eq(hqState.userId, USER_ID)).for('update')
        if (!state) throw new Error('no state')

        const levels = await getShopLevels(USER_ID, tx)
        const level = levels.offlineEfficiency ?? 0
        const cost = OFFLINE_EFFICIENCY_BASE_COST * Math.pow(2, level)

        const held = Number(state.voidShards)
        if (held < cost) throw new Error('insufficient')

        const claimed = await claimShopLevel(tx, USER_ID, 'offlineEfficiency', level)
        if (!claimed) throw new Error('lost the claim')

        await tx.update(hqState)
            .set({ voidShards: String(held - cost) })
            .where(eq(hqState.userId, USER_ID))
        return claimed
    })
}
