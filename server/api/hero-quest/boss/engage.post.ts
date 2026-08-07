import { eq } from 'drizzle-orm'
import { db } from '#server/database'
import { hqFights, hqState } from '#server/database/schema'
import { requireUserId } from '#server/utils/auth'
import {
    getShopLevels,
    heroSnapshotOf,
    isBossStage,
    positionOf,
    settleHq
} from '#server/utils/hero-quest'
import { runFight } from '#shared/utils/hero-quest/fight'
import { fallbackStage, nextStage } from '#shared/utils/hero-quest/settle'
import { SUPER_BOSS_STAGE, WORLD_COUNT } from '#shared/utils/hero-quest/constants'
import { randomInt } from '#shared/utils/random'

/**
 * Resolve a boss or super-boss fight, server-side and authoritatively.
 *
 * Bosses are the one thing in this game that requires the player to be present — offline
 * never engages one, win or lose, which is also why Void Shards can never be earned purely
 * from idle time (`idle-mechanics.md` §5).
 *
 * The lock is held across verify → resolve → apply, so a burst of concurrent engages cannot
 * each advance the run: the first one moves the stage off the gate, and every other request
 * then reads a position that is no longer parked at a boss and is rejected. Reading the
 * position *before* taking the lock would be the classic read-then-write bug.
 */
export default defineEventHandler(async (event) => {
    const userId = await requireUserId(event)

    // Settle first, outside the fight transaction, so the fight uses current state — the
    // player may have accrued levels since their last read.
    await settleHq(userId)

    return db.transaction(async (tx) => {
        const [state] = await tx.select().from(hqState).where(eq(hqState.userId, userId)).for('update')
        if (!state) throw createError({ statusCode: 400, statusMessage: 'No Hero Quest run to play' })

        const position = positionOf(state)
        if (!isBossStage(position.stage)) {
            throw createError({ statusCode: 400, statusMessage: 'The run is not at a boss gate' })
        }

        const shopLevels = await getShopLevels(userId, tx)
        const hero = heroSnapshotOf(state, shopLevels)

        // CSPRNG for the seed; everything downstream is deterministic from it, which is what
        // lets the client replay the exact fight without being trusted with the outcome.
        const seed = randomInt(1, 0x7FFFFFFF)
        const fight = runFight({ hero, position, seed })

        // Win advances; anything else falls back one stage to farm. No auto-retry — the
        // player chooses when to re-engage (`core-progression-and-prestige.md` §2).
        const won = fight.outcome === 'win'
        const landing = won ? nextStage(position) : fallbackStage(position)

        // `nextStage` is a fixed point at World 10 / Stage 10 — there is nowhere further to
        // go — so beating the final super boss leaves the run standing exactly where it was.
        // The flag is what separates that from having merely walked up to it.
        const clearedTheRun = won
            && position.world === WORLD_COUNT
            && position.stage === SUPER_BOSS_STAGE

        const [updated] = await tx.update(hqState)
            .set({
                world: landing.world,
                stage: landing.stage,
                killCount: 0,
                atBossGate: isBossStage(landing.stage),
                runCleared: state.runCleared || clearedTheRun
            })
            .where(eq(hqState.userId, userId))
            .returning()

        await tx.insert(hqFights).values({
            userId,
            kind: 'boss',
            seed,
            outcome: fight.outcome,
            context: {
                position,
                heroLevel: hero.heroLevel,
                classId: hero.classId,
                enemyMaxHp: fight.enemyMaxHp,
                secondsElapsed: fight.secondsElapsed,
                landing: { world: landing.world, stage: landing.stage }
            }
        })

        return {
            outcome: fight.outcome,
            seed,
            secondsElapsed: fight.secondsElapsed,
            damageDealtPct: fight.damageDealtPct,
            enemyMaxHp: fight.enemyMaxHp,
            enemyHpRemaining: fight.enemyHpRemaining,
            events: fight.events,
            landing: { world: updated?.world ?? landing.world, stage: updated?.stage ?? landing.stage },
            /** True when this win cleared World 10 / Stage 10 and prestige is now available. */
            runComplete: updated?.runCleared ?? clearedTheRun
        }
    })
})
