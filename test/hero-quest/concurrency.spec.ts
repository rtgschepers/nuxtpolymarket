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
import { eq } from 'drizzle-orm'
import { db } from '#server/database'
import { hqShopUpgrades, hqState } from '#server/database/schema'
import { getBalance } from '#server/utils/balance'
import { claimShopLevel, ensureHqState, getShopLevels, settleHq } from '#server/utils/hero-quest'
import { OFFLINE_EFFICIENCY_BASE_COST } from '#shared/utils/hero-quest/constants'
import { SKIP, burst, cleanupUser, seedUser } from '../setup/db-helpers'

const USER_ID = 'test-hero-quest-race-user'

async function cleanup() {
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
})

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
