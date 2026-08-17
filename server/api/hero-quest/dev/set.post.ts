import { requireUserId } from '#server/utils/auth'
import { assertDevHarness, devSet, type DevSet } from '#server/utils/hero-quest-dev'

/**
 * Teleport the run — prestige, world, stage, hero level, class node, `runCleared`.
 * **Dev only** — see `server/utils/hero-quest-dev.ts`.
 *
 * `atBossGate` is always derived from the landing stage rather than accepted from the body, so a
 * jump can never leave `boss/engage` able to resolve a fight against a trash stage.
 */
export default defineEventHandler(async (event) => {
    assertDevHarness()
    const userId = await requireUserId(event)
    const body = await readBody<DevSet>(event)
    return devSet(userId, body ?? {})
})
