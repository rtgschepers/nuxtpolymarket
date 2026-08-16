import { and, eq, sql } from 'drizzle-orm'
import { db } from '#server/database'
import { hqCollection, hqState } from '#server/database/schema'
import { requireUserId } from '#server/utils/auth'
import { applyDupes, craftCostFor, newEntry } from '#shared/utils/hero-quest/gacha'
import { championDisplayName, getChampion, isChampionId } from '#shared/utils/hero-quest/content/champions'

/**
 * Craft a specific Champion with Champion Essence — the full RNG bypass
 * (`gacha-shared-system.md` §6).
 *
 * Essence has exactly one source: duplicates that land on an already-maxed copy. That is what
 * makes this the sink at the far end of the collection loop rather than a parallel currency —
 * you can only buy your way to a specific Champion using the overflow from Champions you have
 * already finished.
 *
 * **Rarity is not a parameter.** The shared doc frames crafting as picking an item *and* a
 * rarity, but a Champion's rarity is fixed to its identity (`champions-guild-gacha.md` §4),
 * so the price is looked up from the target rather than requested. Accepting a rarity here
 * would let a client ask for a Mythic at Common prices.
 *
 * ## Concurrency
 *
 * Claim-then-reward, with the **conditional Essence debit as the guard**. Two concurrent
 * crafts against one craft's worth of Essence would otherwise both read the balance, both
 * pass, and both grant. Only the request whose `WHERE champion_essence >= cost` matches gets
 * to write a collection row.
 */
export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event)
    const body = await readBody<{ championId?: string }>(event)
    const championId = body?.championId

    if (typeof championId !== 'string' || !isChampionId(championId)) {
        throw createError({ statusCode: 400, statusMessage: 'Unknown Champion' })
    }

    const definition = getChampion(championId)
    const cost = craftCostFor(definition.rarity)

    return db.transaction(async (tx) => {
        // The debit is the mutex. Nothing below runs for a request that lost the race.
        const [claimed] = await tx.update(hqState)
            .set({ championEssence: sql`${hqState.championEssence} - ${cost}` })
            .where(and(
                eq(hqState.userId, userId),
                sql`${hqState.championEssence} >= ${cost}`
            ))
            .returning()

        if (!claimed) {
            throw createError({
                statusCode: 400,
                statusMessage: `Crafting ${definition.givenName} needs ${cost} Champion Essence`
            })
        }

        const [existing] = await tx.select().from(hqCollection)
            .where(and(
                eq(hqCollection.userId, userId),
                eq(hqCollection.system, 'champion'),
                eq(hqCollection.contentId, championId)
            ))

        // A craft of something already owned behaves exactly like pulling it: one duplicate,
        // merged on the shared curve. Never a no-op, and never wasted.
        const before = existing
            ? { star: existing.star, level: existing.level, dupeProgress: existing.dupeProgress }
            : null
        const outcome = before ? applyDupes(before, 1, definition.rarity) : null
        const entry = outcome ? outcome.entry : newEntry()
        const refunded = outcome?.essenceGained ?? 0

        await tx.insert(hqCollection)
            .values({ userId, system: 'champion', contentId: championId, ...entry })
            .onConflictDoUpdate({
                target: [hqCollection.userId, hqCollection.system, hqCollection.contentId],
                set: { star: entry.star, level: entry.level, dupeProgress: entry.dupeProgress }
            })

        // Crafting onto an already-maxed copy converts straight back to Essence, same as any
        // other duplicate would. A net loss, but not a black hole.
        const [updated] = refunded > 0
            ? await tx.update(hqState)
                .set({ championEssence: sql`${hqState.championEssence} + ${refunded}` })
                .where(eq(hqState.userId, userId))
                .returning()
            : [claimed]

        return {
            championId,
            name: championDisplayName(definition),
            rarity: definition.rarity,
            isNew: before === null,
            star: entry.star,
            level: entry.level,
            spent: cost,
            refunded,
            championEssence: updated?.championEssence ?? claimed.championEssence
        }
    })
})
