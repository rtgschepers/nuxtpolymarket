/**
 * What the battle screen draws (session-1 playtest: the Hero HP bar never moved, the enemy HP
 * figure disagreed with the bar beside it, and the pack count never came down).
 *
 * The fix was to derive every readout from one quantity — kills into the attempt, fractional —
 * so the bars cannot disagree. These specs pin that they genuinely share it, and cover the
 * cases that are awkward to reach by looking at a screen: a pack rolling over, a party the
 * server calls undying, and a walled stage whose ceiling is below the stage requirement.
 */

import { describe, expect, it } from 'vitest'
import { battleReadout, type BattleReadoutInput } from '../../app/utils/hero-quest-battle'

const base: BattleReadoutInput = {
    killCount: 0,
    killsRequired: 30,
    killsBeforeWipe: 60,
    secondsPerKill: 2,
    packSize: 6,
    walled: false,
    atBossGate: false,
    sincePayload: 0
}
const read = (over: Partial<BattleReadoutInput> = {}) => battleReadout({ ...base, ...over })

describe('interpolation between payloads', () => {
    it('advances the kill count at the server\'s own seconds-per-kill', () => {
        expect(read({ sincePayload: 0 }).displayKills).toBe(0)
        expect(read({ sincePayload: 2 }).displayKills).toBe(1)
        expect(read({ sincePayload: 9 }).displayKills).toBe(4)
    })

    it('starts from the served count rather than from zero', () => {
        expect(read({ killCount: 10, sincePayload: 4 }).displayKills).toBe(12)
    })

    it('stands still when the server reports no rate', () => {
        // `secondsPerKill` is null when the party cannot kill anything. Dividing by it would
        // send the bar to Infinity; the honest reading is that nothing is happening.
        expect(read({ secondsPerKill: null, sincePayload: 999 }).displayKills).toBe(0)
        expect(read({ secondsPerKill: 0, sincePayload: 999 }).displayKills).toBe(0)
    })

    it('never runs past the stage requirement', () => {
        const far = read({ sincePayload: 10_000 })
        expect(far.displayKills).toBe(30)
        expect(far.killProgress).toBe(100)
    })
})

describe('the pack in front of you', () => {
    it('counts bodies down as they drop, and never reaches zero mid-encounter', () => {
        // Six standing at the start; one fewer per kill; the last is still up until the pack
        // rolls over, because an encounter with nothing in it is not a state the player sees.
        expect(read({ killCount: 0 }).enemiesStanding).toBe(6)
        expect(read({ killCount: 1 }).enemiesStanding).toBe(5)
        expect(read({ killCount: 5 }).enemiesStanding).toBe(1)
        expect(read({ killCount: 6 }).enemiesStanding).toBe(6)
    })

    it('empties the pack bar in step with the bodies', () => {
        expect(read({ killCount: 0 }).enemyHpPct).toBe(100)
        expect(read({ killCount: 3 }).enemyHpPct).toBeCloseTo(50, 10)
        expect(read({ killCount: 6 }).enemyHpPct).toBe(100)
    })

    it('keeps the bar and the body count telling the same story', () => {
        // The regression that started this: the bar swept on a wall clock while the number
        // beside it never moved. Both now come off `packProgress`, so more of the pack dead
        // always means less of the bar left.
        let previousHp = 101
        for (let kills = 0; kills < 6; kills++) {
            const view = read({ killCount: kills })
            expect(view.enemyHpPct, `kill ${kills}`).toBeLessThan(previousHp)
            expect(view.enemiesStanding, `kill ${kills}`).toBe(6 - kills)
            previousHp = view.enemyHpPct
        }
    })

    it('handles a pack of one without dividing by it', () => {
        const view = read({ packSize: 1, killCount: 0, sincePayload: 1 })
        expect(view.enemiesStanding).toBe(1)
        expect(view.enemyHpPct).toBeCloseTo(50, 10)
    })
})

describe('the Hero bar', () => {
    it('drains across the attempt, per the settle model\'s own semantics', () => {
        // `settle.ts`: "HP carries across the whole stage attempt and refills only when the
        // stage clears or restarts." So the fraction spent is kills over killsBeforeWipe.
        expect(read({ killCount: 0 }).heroHpPct).toBe(100)
        expect(read({ killCount: 30 }).heroHpPct).toBeCloseTo(50, 10)
    })

    it('stays full for a party the server calls undying', () => {
        // `killsBeforeWipe` is null when nothing can bring the party down — not a reason to
        // divide by nothing.
        expect(read({ killsBeforeWipe: null, killCount: 25 }).heroHpPct).toBe(100)
        expect(read({ killsBeforeWipe: 0, killCount: 25 }).heroHpPct).toBe(100)
    })

    it('empties before the stage bar fills on a walled stage — the whole point', () => {
        // A wall is `killsBeforeWipe < killsRequired`. The Hero bar reaching empty while the
        // stage counter is short of its target is exactly what the player needs to see.
        const walled = read({ walled: true, killsBeforeWipe: 12, sincePayload: 10_000 })
        expect(walled.heroHpPct).toBe(0)
        expect(walled.displayKills).toBe(12)
        expect(walled.killProgress).toBeLessThan(100)
    })

    it('never reports a negative bar', () => {
        expect(read({ killsBeforeWipe: 5, killCount: 30 }).heroHpPct).toBe(0)
    })
})

describe('at a boss gate', () => {
    it('parks every bar — a boss is a fight, not a counter', () => {
        const view = read({ atBossGate: true, killCount: 3, killsRequired: 0, sincePayload: 500 })
        expect(view.displayKills).toBe(3)
        expect(view.enemyHpPct).toBe(100)
        expect(view.heroHpPct).toBe(100)
        expect(view.enemiesStanding).toBe(6)
    })
})
