import { and, eq, inArray } from 'drizzle-orm'
import { db } from '#server/database'
import { hqCollection, hqState } from '#server/database/schema'
import { requireUserId } from '#server/utils/auth'
import { championSlots, getShopLevels } from '#server/utils/hero-quest'
import { isChampionId, getArchetype, getChampion } from '#shared/utils/hero-quest/content/champions'
import { getClass } from '#shared/utils/hero-quest/content/classes'
import { FORMATION_ROW_CAPACITY } from '#shared/utils/hero-quest/constants'
import type { ClassId, FormationRow } from '#shared/utils/hero-quest/types'

/**
 * Set the fielded party and the formation in one call.
 *
 * They are one route because they are one invariant: a formation is only valid against a
 * specific party, so accepting them separately would allow a window in which the saved
 * formation references a Champion no longer fielded. Row capacity is checked across the whole
 * resulting party — Hero included — which cannot be done without both halves.
 *
 * No currency moves here, so this is a plain lock-and-validate rather than claim-then-reward.
 * The lock still matters: `championSlots` is read from the shop and the party is written
 * against it, and a concurrent slot purchase would otherwise let a party save race past the
 * slot count it was validated against.
 */
export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event)
    const body = await readBody<{
        championIds?: unknown
        formation?: unknown
    }>(event)

    const championIds = Array.isArray(body?.championIds) ? body.championIds : null
    if (!championIds || championIds.some(id => typeof id !== 'string')) {
        throw createError({ statusCode: 400, statusMessage: 'championIds must be an array of ids' })
    }
    if (new Set(championIds).size !== championIds.length) {
        throw createError({ statusCode: 400, statusMessage: 'A Champion cannot be fielded twice' })
    }
    for (const id of championIds as string[]) {
        if (!isChampionId(id)) {
            throw createError({ statusCode: 400, statusMessage: `Unknown Champion: ${id}` })
        }
    }

    const requestedFormation = (body?.formation ?? {}) as Record<string, unknown>
    const formation: Record<string, FormationRow> = {}
    for (const [key, value] of Object.entries(requestedFormation)) {
        if (value !== 'front' && value !== 'back') {
            throw createError({ statusCode: 400, statusMessage: `Invalid row for ${key}` })
        }
        // Only the Hero and fielded Champions have a position; anything else is stale state
        // from a previous party and is dropped rather than persisted forever.
        if (key === 'hero' || (championIds as string[]).includes(key)) {
            formation[key] = value
        }
    }

    return db.transaction(async (tx) => {
        const [state] = await tx.select().from(hqState).where(eq(hqState.userId, userId)).for('update')
        if (!state) throw createError({ statusCode: 400, statusMessage: 'No Hero Quest run' })

        const shopLevels = await getShopLevels(userId, tx)
        const slots = championSlots(shopLevels)
        if (championIds.length > slots) {
            throw createError({
                statusCode: 400,
                statusMessage: `Only ${slots} Champion slots unlocked`
            })
        }

        // Ownership is verified against the collection, never taken from the request — the
        // client could otherwise field a Mythic it never pulled.
        if (championIds.length > 0) {
            const owned = await tx.select({ contentId: hqCollection.contentId })
                .from(hqCollection)
                .where(and(
                    eq(hqCollection.userId, userId),
                    eq(hqCollection.system, 'champion'),
                    inArray(hqCollection.contentId, championIds as string[])
                ))
            if (owned.length !== championIds.length) {
                throw createError({ statusCode: 400, statusMessage: 'You do not own every Champion in that party' })
            }
        }

        // Rows are capacities, not quotas (`classes-and-combat.md` §6): an empty front row is
        // legal, but neither row may exceed 3 across the whole party, Hero included.
        const rowOf = (id: string, fallback: FormationRow) => formation[id] ?? fallback
        const rows: FormationRow[] = [
            rowOf('hero', getClass(state.heroNodeId as ClassId).defaultRow),
            ...(championIds as string[]).map(id =>
                rowOf(id, getArchetype(getChampion(id).archetype).defaultRow))
        ]
        for (const row of ['front', 'back'] as const) {
            if (rows.filter(entry => entry === row).length > FORMATION_ROW_CAPACITY) {
                throw createError({
                    statusCode: 400,
                    statusMessage: `The ${row} row holds at most ${FORMATION_ROW_CAPACITY}`
                })
            }
        }

        const [updated] = await tx.update(hqState)
            .set({ partyChampionIds: championIds as string[], formation })
            .where(eq(hqState.userId, userId))
            .returning()

        return {
            partyChampionIds: updated?.partyChampionIds ?? championIds,
            formation: updated?.formation ?? formation,
            slots
        }
    })
})
