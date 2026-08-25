/**
 * The part-kill a settle could not bank survives to the next one — end to end, through the
 * column.
 *
 * `settle()`'s own spec pins the arithmetic; this pins the wiring, which is where the bug
 * actually lived. Kills bank as integers, so a window shorter than one `secondsPerKill` used to
 * floor to zero while `lastSettledAt` advanced to `now` regardless — and *every state read is a
 * settle*. The client polls once a minute, every mutation refreshes, and a page reload is another
 * one, so a player reloading faster than they killed made no progress at all, ever, while the
 * same player closing the tab for an hour made plenty.
 *
 * Written against the real `settleHq` rather than the pure function on purpose: the failure was
 * that nothing persisted the remainder, and only a round trip through the row can show that it
 * now does.
 *
 * Needs the local Postgres from .env. Skips when DATABASE_URL is unset.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '#server/database'
import { hqState } from '#server/database/schema'
import { ensureHqState, prestigeResetValues, settleHq } from '#server/utils/hero-quest'
import { SKIP, cleanupUser, seedUser } from '../setup/db-helpers'

describe.skipIf(SKIP)('the carried part-kill, through the database', () => {
    const USER_ID = 'test-hero-quest-settle-carry-user'

    async function cleanup() {
        await db.delete(hqState).where(eq(hqState.userId, USER_ID))
        await cleanupUser(USER_ID)
    }

    beforeEach(async () => {
        await cleanup()
        await seedUser(USER_ID, { balance: '0' })
        await ensureHqState(USER_ID)
    })
    afterEach(cleanup)
    afterAll(async () => { await db.$client.end() })

    /** Move the settle clock back, which is the only way to hand a settle a window to work with. */
    async function rewind(seconds: number) {
        await db.update(hqState)
            .set({ lastSettledAt: new Date(Date.now() - seconds * 1000) })
            .where(eq(hqState.userId, USER_ID))
    }

    /**
     * The party's current rate, asked of the settle itself rather than named here.
     *
     * A hard-coded window would silently stop testing short windows the moment a tuning pass
     * moved `secondsPerKill`, and the constants in this game carry `// UNTUNED` by the dozen.
     */
    async function secondsPerKill(): Promise<number> {
        await rewind(1)
        const { result } = await settleHq(USER_ID)
        expect(result?.secondsPerKill).toBeGreaterThan(0)
        await db.update(hqState)
            .set({ killCount: 0, killFraction: 0, world: 1, stage: 1 })
            .where(eq(hqState.userId, USER_ID))
        return result!.secondsPerKill
    }

    it('banks progress from a window too short to finish a kill', async () => {
        const spk = await secondsPerKill()

        await rewind(spk / 4)
        const { state } = await settleHq(USER_ID)

        expect(state.killCount).toBe(0)
        // The window bought a quarter of a body. Before the fix it bought nothing, and the
        // clock moved anyway.
        expect(state.killFraction).toBeGreaterThan(0.2)
        expect(state.killFraction).toBeLessThan(1)
    })

    it('completes the kill those windows add up to', async () => {
        const spk = await secondsPerKill()

        // Four quarter-windows, settled separately, are one kill. Under the old floor they were
        // four times nothing.
        for (let i = 0; i < 4; i++) {
            await rewind(spk / 4)
            await settleHq(USER_ID)
        }

        const [after] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
        expect(after!.killCount).toBeGreaterThanOrEqual(1)
    })

    it('does not spend the carry twice when a settle has no window to work with', async () => {
        const spk = await secondsPerKill()

        await rewind(spk / 2)
        const banked = (await settleHq(USER_ID)).state.killFraction
        expect(banked).toBeGreaterThan(0)

        // A read straight after another read settles a window of roughly nothing. It must leave
        // the carry alone rather than either dropping it or rounding it up into a free kill.
        const { state } = await settleHq(USER_ID)
        expect(state.killCount).toBe(0)
        expect(state.killFraction).toBeGreaterThanOrEqual(banked)
        expect(state.killFraction).toBeLessThan(1)
    })

    it('clears the carry with the rest of the run position at a prestige', async () => {
        const spk = await secondsPerKill()
        await rewind(spk / 2)
        expect((await settleHq(USER_ID)).state.killFraction).toBeGreaterThan(0)

        await db.update(hqState)
            .set(prestigeResetValues((await settleHq(USER_ID)).state))
            .where(eq(hqState.userId, USER_ID))

        const [after] = await db.select().from(hqState).where(eq(hqState.userId, USER_ID))
        expect(after!.killFraction).toBe(0)
        expect(after!.killCount).toBe(0)
    })
})
