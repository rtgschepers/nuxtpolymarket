import { and, eq, sql } from 'drizzle-orm'
import { db } from '#server/database'
import { hqCollection, hqState } from '#server/database/schema'
import { requireUserId } from '#server/utils/auth'
import {
    SEAL_COLUMN,
    SEAL_NAME,
    essenceBalance,
    essenceGain,
    sealBalance,
    sealSpend,
    settleHq
} from '#server/utils/hero-quest'
import {
    applyDupes,
    applyPulls,
    isGachaSystem,
    newEntry,
    pullCost,
    rarityFromRoll,
    type CollectionEntry
} from '#shared/utils/hero-quest/gacha'
import { gachaContent } from '#shared/utils/hero-quest/content/registry'
import { autoEquipFirstPieces, isGearId } from '#shared/utils/hero-quest/content/gear'
import { TEN_PULL_SIZE } from '#shared/utils/hero-quest/constants'
import { randomFloat } from '#shared/utils/random'
import type { Rarity } from '#shared/utils/hero-quest/types'

interface PullRecord {
    contentId: string
    name: string
    rarity: Rarity
    /** True the first time this item is ever obtained. */
    isNew: boolean
    /** Star/level after this pull landed, so the client can show the copy's new state. */
    star: number
    level: number
    /** Essence produced, non-zero only when the copy was already 5★ Lv10. */
    essence: number
}

/**
 * Pull from any of the four gachas — `system` in the body (`tech-architecture.md` §5).
 *
 * **One route, not four.** `gacha-shared-system.md` makes the four deliberately parallel — one
 * rarity ladder, one levelling curve, one drop table, one dupe formula — and
 * `docs/hero-quest/CLAUDE.md` §3 requires that machinery be written once and take `system` as an
 * argument. Only two things genuinely differ per system: which content module resolves a roll,
 * and which two columns hold the balances. `content/registry.ts` covers the first and
 * `SEAL_COLUMN` / `ESSENCE_COLUMN` in the domain layer cover the second, so everything below is
 * identical for all four by construction rather than by four files staying in sync.
 *
 * ## Why the whole thing sits inside one transaction
 *
 * A pull reads a Seal balance, reads the gacha level, rolls an outcome, and writes three
 * different things (Seals, gacha level/progress, collection rows). Every one of those is a
 * read-then-write, which is the exact shape the platform guidance calls "always a bug" — ten
 * parallel pulls would otherwise all read the same Seal balance, all pass the check, and all
 * pay out.
 *
 * The **conditional Seal debit is the guard** (claim-then-reward): the balance is decremented
 * with a `WHERE <seals> >= cost`, and if no row comes back the request throws before a single die
 * is rolled. Everything downstream — the roll, the dupe merge, the level bump — only runs for the
 * request that actually won the Seals.
 *
 * ## Randomness
 *
 * `randomFloat` from the platform CSPRNG, never `Math.random()`: this decides a real payout.
 * Rarity comes from the drop table, then the specific item is a uniform pick within that rarity —
 * the two-step the drop table implies (it weights rarities, not individual items).
 */
export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event)
    const body = await readBody<{ system?: string; count?: number }>(event)

    const system = body?.system
    if (typeof system !== 'string' || !isGachaSystem(system)) {
        throw createError({ statusCode: 400, statusMessage: 'Unknown gacha' })
    }
    const content = gachaContent(system)
    const requested = body?.count === TEN_PULL_SIZE ? TEN_PULL_SIZE : 1
    const cost = pullCost(requested)

    // Bank progress first so the pull can't be used to dodge a settle, and so the Seals a
    // milestone just granted are visible to this request.
    await settleHq(userId)

    return db.transaction(async (tx) => {
        // Claim-then-reward. The debit is the mutex; nothing is rolled until it succeeds.
        const [claimed] = await tx.update(hqState)
            .set(sealSpend(system, cost.seals))
            .where(and(
                eq(hqState.userId, userId),
                sql`${SEAL_COLUMN[system]} >= ${cost.seals}`
            ))
            .returning()

        if (!claimed) {
            throw createError({ statusCode: 400, statusMessage: `Not enough ${SEAL_NAME[system]}` })
        }

        const levels = claimed.gachaLevels as Record<string, number>
        const progress = claimed.gachaProgress as Record<string, number>
        const gachaLevel = levels[system] ?? 1

        // Every copy the player already owns of this system, keyed for in-loop merging — a
        // 10-pull can hit the same item twice and the second copy must see the first's result.
        const existing = await tx.select().from(hqCollection)
            .where(and(eq(hqCollection.userId, userId), eq(hqCollection.system, system)))
        const entries = new Map<string, CollectionEntry>(
            existing.map(row => [row.contentId, { star: row.star, level: row.level, dupeProgress: row.dupeProgress }])
        )

        const pulls: PullRecord[] = []
        let essenceGained = 0

        for (let index = 0; index < cost.pulls; index++) {
            // Rarity from the level's drop table, then a uniform pick inside it. Every roster
            // populates every rarity, so a rolled rarity is the rarity paid out — the folding
            // scaffolding partial rosters needed is gone.
            const rarity = rarityFromRoll(gachaLevel, randomFloat())
            const definition = content.fromRoll(rarity, randomFloat())

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
                contentId: definition.id,
                name: definition.name,
                rarity: definition.rarity,
                isNew,
                star: entry.star,
                level: entry.level,
                essence
            })
        }

        // One upsert per distinct item *touched*, not one per pull — a 10-pull that hits the
        // same item three times writes its final merged state once, and copies this pull never
        // saw are not rewritten at all.
        for (const contentId of new Set(pulls.map(pull => pull.contentId))) {
            const entry = entries.get(contentId)!
            await tx.insert(hqCollection)
                .values({ userId, system, contentId, ...entry })
                .onConflictDoUpdate({
                    target: [hqCollection.userId, hqCollection.system, hqCollection.contentId],
                    set: { star: entry.star, level: entry.level, dupeProgress: entry.dupeProgress }
                })
        }

        // Leveling counts pulls granted, not Seals spent — which is the whole point of the
        // 10-pull discount (`gacha-shared-system.md` §4).
        const advanced = applyPulls(gachaLevel, progress[system] ?? 0, cost.pulls)

        /**
         * Gear only: the first piece ever owned for a slot auto-equips (`gear-equipment.md` §3) —
         * "no reason to leave a brand-new slot empty when there's only one option to begin with".
         * It never *replaces* a choice the player has made, however weak; past the first piece,
         * swapping is always a manual tap.
         */
        const autoEquipped = system === 'gear'
            ? autoEquipFirstPieces(
                [...entries].filter(([id]) => isGearId(id))
                    .map(([contentId, entry]) => ({ contentId, star: entry.star, level: entry.level })),
                claimed.equippedGear as Record<string, string>
            )
            : null

        const [updated] = await tx.update(hqState)
            .set({
                gachaLevels: { ...levels, [system]: advanced.level },
                gachaProgress: { ...progress, [system]: advanced.progress },
                ...essenceGain(system, essenceGained),
                ...(autoEquipped ? { equippedGear: autoEquipped } : {})
            })
            .where(eq(hqState.userId, userId))
            .returning()

        const after = updated ?? claimed
        return {
            system,
            pulls,
            sealsSpent: cost.seals,
            seals: sealBalance(after, system),
            essence: essenceBalance(after, system),
            gachaLevel: advanced.level,
            gachaProgress: advanced.progress,
            essenceGained
        }
    })
})
