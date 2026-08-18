/**
 * What the battle screen shows, derived from one number.
 *
 * The enemy bar, the enemy HP figure, the count of bodies still standing, the Hero's HP bar and
 * the stage counter are all functions of `killsFloat` — kills into the current stage attempt,
 * fractional. That is the point: they previously moved independently and disagreed, which is
 * what made the encounter read as inconsistent. Derived together, they cannot.
 *
 * Pure, and separate from the component, because the edge cases are worth pinning: a pack
 * rolling over, a party the server calls undying, a walled stage whose ceiling is lower than the
 * stage requirement, and a `secondsPerKill` of zero or null.
 *
 * Holds no game math — every input is server-derived. This only decides how to *draw* them.
 */

export interface BattleReadoutInput {
    /** Server truth: kills banked into this stage attempt. */
    killCount: number
    killsRequired: number
    /** Kills one attempt survives, or `null` when the server calls the party undying. */
    killsBeforeWipe: number | null
    secondsPerKill: number | null
    packSize: number
    walled: boolean
    atBossGate: boolean
    /** Seconds elapsed since the payload that supplied `killCount`. */
    sincePayload: number
}

export interface BattleReadout {
    /** Kills into the attempt, fractional and already clamped. Everything else derives from it. */
    killsFloat: number
    /** The integer the stage counter shows. */
    displayKills: number
    /** Stage bar, 0–100. */
    killProgress: number
    /** How far through the current pack, in [0, 1). */
    packProgress: number
    /** Bodies still up. Never 0 mid-encounter — the last dies as the pack rolls over. */
    enemiesStanding: number
    /** Enemy bar, 0–100, over the whole pack. */
    enemyHpPct: number
    /** Hero bar, 0–100. */
    heroHpPct: number
}

export function battleReadout(input: BattleReadoutInput): BattleReadout {
    const size = Math.max(0, Math.floor(input.packSize))

    if (input.atBossGate) {
        // A boss is a fight, not a counter. Nothing here is being worn down over time, and a
        // mixed boss pack has no single body size to divide by, so the bars sit full.
        return {
            killsFloat: input.killCount,
            displayKills: input.killCount,
            killProgress: input.killsRequired <= 0 ? 100 : 0,
            packProgress: 0,
            enemiesStanding: size,
            enemyHpPct: 100,
            heroHpPct: 100
        }
    }

    const spk = input.secondsPerKill
    const predicted = spk !== null && spk > 0 ? Math.max(0, input.sincePayload) / spk : 0

    /**
     * A walled stage restarts rather than banking, so the ceiling is what one attempt survives
     * — not what the stage asks for. Without this the bars sail past a line the run cannot cross.
     */
    const ceiling = input.walled && input.killsBeforeWipe !== null
        ? input.killsBeforeWipe
        : input.killsRequired
    const killsFloat = Math.max(0, Math.min(ceiling, input.killCount + predicted))

    const displayKills = Math.floor(killsFloat)
    const killProgress = input.killsRequired <= 0
        ? 100
        : Math.min(100, (displayKills / input.killsRequired) * 100)

    // A pack of identical bodies dies one at a time, so progress through it is the fractional
    // part of the kill count over the pack size.
    const packProgress = size <= 1 ? killsFloat % 1 : (killsFloat % size) / size
    const enemiesStanding = size <= 0 ? 0 : Math.max(1, size - Math.floor(killsFloat % size))

    const wipeAt = input.killsBeforeWipe
    const heroHpPct = wipeAt === null || wipeAt <= 0
        ? 100
        : Math.max(0, Math.min(100, (1 - killsFloat / wipeAt) * 100))

    return {
        killsFloat,
        displayKills,
        killProgress,
        packProgress,
        enemiesStanding,
        enemyHpPct: Math.max(0, Math.min(100, (1 - packProgress) * 100)),
        heroHpPct
    }
}
