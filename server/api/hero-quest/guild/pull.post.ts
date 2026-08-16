import { and, eq, sql } from 'drizzle-orm'
import { db } from '#server/database'
import { hqCollection, hqState } from '#server/database/schema'
import { requireUserId } from '#server/utils/auth'
import { settleHq } from '#server/utils/hero-quest'
import {
    applyDupes,
    applyPulls,
    newEntry,
    pullCost,
    rarityFromRoll,
    type CollectionEntry
} from '#shared/utils/hero-quest/gacha'
import {
    championDisplayName,
    championFromRoll
} from '#shared/utils/hero-quest/content/champions'
import { TEN_PULL_SIZE } from '#shared/utils/hero-quest/constants'
import { randomFloat } from '#shared/utils/random'
import type { Rarity } from '#shared/utils/hero-quest/types'

interface PullRecord {
    championId: string
    name: string
    rarity: Rarity
    /** True the first time this Champion is ever obtained. */
    isNew: boolean
    /** Star/level after this pull landed, so the client can show the copy's new state. */
    star: number
    level: number
    /** Essence produced, non-zero only when the copy was already 5★ Lv10. */
    essence: number
}

/**
 * Pull from the Guild (Champions).
 *
 * ## Why the whole thing sits inside one transaction under the `hqState` row lock
 *
 * A pull reads a Seal balance, reads the gacha level, rolls an outcome, and writes three
 * different things (Seals, gacha level/progress, collection rows). Every one of those is a
 * read-then-write, which is the exact shape the platform guidance calls "always a bug" — ten
 * parallel pulls would otherwise all read the same Seal balance, all pass the check, and all
 * pay out.
 *
 * The **conditional Seal debit is the guard** (claim-then-reward): the balance is decremented
 * with a `WHERE guild_seals >= cost`, and if no row comes back the request throws before a
 * single die is rolled. Everything downstream — the roll, the dupe merge, the level bump —
 * only runs for the request that actually won the Seals.
 *
 * ## Randomness
 *
 * `randomFloat` from the platform CSPRNG, never `Math.random()`: this decides a real payout.
 * Rarity comes from the drop table, then the specific Champion is a uniform pick within that
 * rarity — the two-step the drop table implies (it weights rarities, not individual items).
 */
export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event)
    const body = await readBody<{ count?: number }>(event)
    const requested = body?.count === TEN_PULL_SIZE ? TEN_PULL_SIZE : 1
    const cost = pullCost(requested)

    // Bank progress first so the pull can't be used to dodge a settle, and so the Seals a
    // milestone just granted are visible to this request.
    await settleHq(userId)

    return db.transaction(async (tx) => {
        // Claim-then-reward. The debit is the mutex; nothing is rolled until it succeeds.
        const [claimed] = await tx.update(hqState)
            .set({ guildSeals: sql`${hqState.guildSeals} - ${cost.seals}` })
            .where(and(
                eq(hqState.userId, userId),
                sql`${hqState.guildSeals} >= ${cost.seals}`
            ))
            .returning()

        if (!claimed) {
            throw createError({ statusCode: 400, statusMessage: 'Not enough Guild Seals' })
        }

        const levels = claimed.gachaLevels as Record<string, number>
        const progress = claimed.gachaProgress as Record<string, number>
        const gachaLevel = levels.champion ?? 1

        // Every copy the player already owns, keyed for in-loop merging — a 10-pull can hit
        // the same Champion twice and the second copy must see the first one's result.
        const existing = await tx.select().from(hqCollection)
            .where(and(eq(hqCollection.userId, userId), eq(hqCollection.system, 'champion')))
        const entries = new Map<string, CollectionEntry>(
            existing.map(row => [row.contentId, { star: row.star, level: row.level, dupeProgress: row.dupeProgress }])
        )

        const pulls: PullRecord[] = []
        let essenceGained = 0

        for (let index = 0; index < cost.pulls; index++) {
            // Rarity from the level's drop table, then a uniform pick inside it. Rarities the
            // partial Phase 2 roster does not populate fold *down* to their nearest shipped
            // neighbour, so a pull can never pay out better than the roll earned.
            const rarity = rarityFromRoll(gachaLevel, randomFloat())
            const definition = championFromRoll(rarity, randomFloat())

            const before = entries.get(definition.id)
            const isNew = before === undefined
            let entry = before ?? newEntry()
            let essence = 0

            if (!isNew) {
                const outcome = applyDupes(entry, 1, definition.rarity)
                entry = outcome.entry
                essence = outcome.essenceGained
                essenceGained += essence
            }

            entries.set(definition.id, entry)
            pulls.push({
                championId: definition.id,
                name: championDisplayName(definition),
                rarity: definition.rarity,
                isNew,
                star: entry.star,
                level: entry.level,
                essence
            })
        }

        // One upsert per distinct Champion *touched*, not one per pull — a 10-pull that hits
        // the same Champion three times writes its final merged state once, and copies this
        // pull never saw are not rewritten at all.
        for (const contentId of new Set(pulls.map(pull => pull.championId))) {
            const entry = entries.get(contentId)!
            await tx.insert(hqCollection)
                .values({ userId, system: 'champion', contentId, ...entry })
                .onConflictDoUpdate({
                    target: [hqCollection.userId, hqCollection.system, hqCollection.contentId],
                    set: { star: entry.star, level: entry.level, dupeProgress: entry.dupeProgress }
                })
        }

        // Leveling counts pulls granted, not Seals spent — which is the whole point of the
        // 10-pull discount (`gacha-shared-system.md` §4).
        const advanced = applyPulls(gachaLevel, progress.champion ?? 0, cost.pulls)

        const [updated] = await tx.update(hqState)
            .set({
                gachaLevels: { ...levels, champion: advanced.level },
                gachaProgress: { ...progress, champion: advanced.progress },
                championEssence: sql`${hqState.championEssence} + ${essenceGained}`
            })
            .where(eq(hqState.userId, userId))
            .returning()

        return {
            pulls,
            sealsSpent: cost.seals,
            guildSeals: updated?.guildSeals ?? claimed.guildSeals,
            championEssence: updated?.championEssence ?? 0,
            gachaLevel: advanced.level,
            gachaProgress: advanced.progress,
            essenceGained
        }
    })
})
