import { and, eq } from 'drizzle-orm'
import { db } from '#server/database'
import { hqShopUpgrades, hqState } from '#server/database/schema'
import { requireUserId } from '#server/utils/auth'
import { claimShopLevel, spendVoidShards } from '#server/utils/hero-quest'
import { getShopTrack, isShopTrackId, shopTrackCost } from '#shared/utils/hero-quest/content/shop'

/**
 * Buy one level of a prestige-shop track with Void Shards.
 *
 * Claim-then-reward, twice over, and both guards matter:
 *
 * 1. The level bump is a conditional `UPDATE … WHERE level = <what we read>`. Only the
 *    request that finds the row still at that level wins; the rest match nothing and throw
 *    before any currency moves. Integer compare-and-swap is safe here in a way a timestamp
 *    CAS never is (Postgres keeps microseconds, JS `Date` does not).
 * 2. The shard balance is read *inside* the `hqState` row lock and written in the same
 *    transaction, so two purchases cannot both spend the same shards.
 *
 * Without the first, N parallel clicks all read level 3 and all pay for level 4. Without the
 * second, two different tracks bought at once could each debit against the same balance.
 */
export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event)
    const body = await readBody<{ upgradeId?: string }>(event)
    const upgradeId = body?.upgradeId

    if (typeof upgradeId !== 'string' || !isShopTrackId(upgradeId)) {
        throw createError({ statusCode: 400, statusMessage: 'Unknown upgrade' })
    }
    const track = getShopTrack(upgradeId)

    return db.transaction(async (tx) => {
        const [state] = await tx.select().from(hqState).where(eq(hqState.userId, userId)).for('update')
        if (!state) throw createError({ statusCode: 400, statusMessage: 'No Hero Quest run' })

        const [row] = await tx.select().from(hqShopUpgrades)
            .where(and(eq(hqShopUpgrades.userId, userId), eq(hqShopUpgrades.upgradeId, upgradeId)))
        const level = row?.level ?? 0

        const cost = shopTrackCost(upgradeId, level)
        if (cost === null) {
            throw createError({ statusCode: 400, statusMessage: `${track.name} is already maxed` })
        }

        const remaining = spendVoidShards(state.voidShards, cost)
        if (remaining === null) {
            throw createError({ statusCode: 400, statusMessage: 'Not enough Void Shards' })
        }

        const claimed = await claimShopLevel(tx, userId, upgradeId, level)
        if (!claimed) {
            throw createError({ statusCode: 409, statusMessage: 'That upgrade is already being bought, try again' })
        }

        await tx.update(hqState).set({ voidShards: remaining }).where(eq(hqState.userId, userId))

        return {
            upgradeId,
            level: claimed.level,
            spent: cost,
            voidShards: remaining,
            nextCost: shopTrackCost(upgradeId, claimed.level)
        }
    })
})
