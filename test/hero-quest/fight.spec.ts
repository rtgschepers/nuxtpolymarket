import { describe, expect, it } from 'vitest'
import { runFight } from '#shared/utils/hero-quest/fight'
import { BOSS_STAGE, BOSS_TIMER_SECONDS, SUPER_BOSS_STAGE } from '#shared/utils/hero-quest/constants'
import { enemyStatsAt } from '#shared/utils/hero-quest/settle'
import { D, ZERO } from '#shared/utils/hero-quest/numbers'
import { kitFor } from '#shared/utils/hero-quest/content/classes'
import type { ClassId, HeroSnapshot, RunPosition } from '#shared/utils/hero-quest/types'

function hero(heroLevel: number, classId: ClassId = 'class_beginner'): HeroSnapshot {
    return { classId, heroLevel, heroXp: ZERO, goldBonusPct: 0, offlineEfficiencyLevel: 0, offlineCapLevel: 0 }
}

function at(world: number, stage: number, prestige = 0): RunPosition {
    return { prestige, world, stage, killsInStage: 0 }
}

describe('hero-quest seeded fights', () => {
    describe('determinism — the whole point of the replay model', () => {
        it('produces an identical outcome and log for the same seed', () => {
            const input = { hero: hero(40), position: at(1, BOSS_STAGE), seed: 123456 }
            const first = runFight(input)
            const second = runFight(input)

            expect(second.outcome).toBe(first.outcome)
            expect(second.secondsElapsed).toBe(first.secondsElapsed)
            expect(second.enemyHpRemaining).toBe(first.enemyHpRemaining)
            expect(second.events).toEqual(first.events)
        })

        it('diverges on a different seed, so crit is genuinely rolled', () => {
            const base = { hero: hero(40), position: at(1, BOSS_STAGE) }
            const logs = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => runFight({ ...base, seed })
                .events.filter(event => event.kind === 'attack').map(event => event.crit).join(''))

            // Averaged crit would make every seed identical; rolled crit must not.
            expect(new Set(logs).size).toBeGreaterThan(1)
        })

        it('echoes the seed back so the client can replay without being told twice', () => {
            expect(runFight({ hero: hero(40), position: at(1, BOSS_STAGE), seed: 99 }).seed).toBe(99)
        })
    })

    describe('outcomes', () => {
        it('wins when the party out-damages the boss inside the timer', () => {
            const result = runFight({ hero: hero(200), position: at(1, BOSS_STAGE), seed: 7 })
            expect(result.outcome).toBe('win')
            expect(result.enemyHpRemaining).toBe('0')
            expect(result.damageDealtPct).toBe(1)
            expect(result.secondsElapsed).toBeLessThanOrEqual(BOSS_TIMER_SECONDS)
            expect(result.events.at(-1)!.kind).toBe('enemy_down')
        })

        it('times out at exactly the boss timer, never past it', () => {
            // Enough DPS to scratch the super boss, nowhere near enough to fell it in 30s.
            const result = runFight({ hero: hero(30), position: at(3, SUPER_BOSS_STAGE), seed: 7 })
            expect(result.outcome).toBe('timeout')
            expect(result.secondsElapsed).toBe(BOSS_TIMER_SECONDS)
            expect(D(result.enemyHpRemaining).gt(0)).toBe(true)
        })

        it('reports how close a loss came, for the retry decision', () => {
            const result = runFight({ hero: hero(30), position: at(3, SUPER_BOSS_STAGE), seed: 7 })
            expect(result.damageDealtPct).toBeGreaterThanOrEqual(0)
            expect(result.damageDealtPct).toBeLessThan(1)
        })

        it('wipes when the boss kills the party first', () => {
            const result = runFight({ hero: hero(1), position: at(6, SUPER_BOSS_STAGE), seed: 7 })
            expect(result.outcome).toBe('wipe')
            expect(result.secondsElapsed).toBeLessThan(BOSS_TIMER_SECONDS)
            expect(result.events.some(event => event.kind === 'unit_down')).toBe(true)
        })

        it('never reports negative enemy HP after an overkill', () => {
            const result = runFight({ hero: hero(500), position: at(1, BOSS_STAGE), seed: 7 })
            expect(D(result.enemyHpRemaining).gte(0)).toBe(true)
            for (const event of result.events) {
                if (event.remainingHp) expect(D(event.remainingHp).gte(0)).toBe(true)
            }
        })
    })

    describe('the zero-damage floor', () => {
        it('deals literally nothing once enemy DEF reaches the party PWR × K threshold', () => {
            // Same hard floor `mitigation` guarantees — not an asymptotic sliver.
            const position = at(8, SUPER_BOSS_STAGE)
            const result = runFight({ hero: hero(1), position, seed: 7 })
            for (const event of result.events) {
                if (event.kind === 'attack' || event.kind === 'skill') expect(event.damage).toBe('0')
            }
            expect(result.damageDealtPct).toBe(0)
        })

        it('still ends rather than looping forever when nobody can hurt anybody', () => {
            const result = runFight({ hero: hero(1), position: at(8, SUPER_BOSS_STAGE), seed: 7 })
            expect(['timeout', 'wipe']).toContain(result.outcome)
        })
    })

    describe('the kit', () => {
        it('fires every skill the class path owns, not just the deepest node\'s', () => {
            const result = runFight({ hero: hero(60, 'class_berserker'), position: at(5, BOSS_STAGE), seed: 7 })
            const fired = new Set(result.events.filter(event => event.kind === 'skill').map(event => event.skillId))
            for (const skill of kitFor('class_berserker')) {
                expect(fired.has(skill.id), skill.id).toBe(true)
            }
        })

        it('gives a Beginner exactly one skill and a Master four', () => {
            expect(kitFor('class_beginner')).toHaveLength(1)
            expect(kitFor('class_berserker')).toHaveLength(4)
        })

        it('hits harder than autoattacks alone, since skills carry a multiplier', () => {
            const result = runFight({ hero: hero(60, 'class_berserker'), position: at(5, BOSS_STAGE), seed: 7 })
            const uncrit = (kind: string) => result.events
                .filter(event => event.kind === kind && event.crit === false)
                .map(event => D(event.damage!))

            const attack = uncrit('attack')[0]
            const skill = uncrit('skill')[0]
            expect(attack, 'expected at least one non-crit autoattack').toBeDefined()
            expect(skill, 'expected at least one non-crit skill hit').toBeDefined()
            expect(skill!.gt(attack!)).toBe(true)
        })
    })

    describe('multi-strike', () => {
        it('folds Hunter\'s triple strike into one attack instant', () => {
            const result = runFight({ hero: hero(60, 'class_hunter'), position: at(5, BOSS_STAGE), seed: 7 })
            const firstInstant = result.events.find(event => event.kind === 'attack')!.at
            const strikes = result.events.filter(event => event.kind === 'attack' && event.at === firstInstant)
            expect(strikes).toHaveLength(3)
        })

        it('gives Beast Master four strikes to Hunter\'s three', () => {
            const strikesFor = (classId: ClassId) => {
                const result = runFight({ hero: hero(60, classId), position: at(5, BOSS_STAGE), seed: 7 })
                const firstInstant = result.events.find(event => event.kind === 'attack')!.at
                return result.events.filter(event => event.kind === 'attack' && event.at === firstInstant).length
            }
            expect(strikesFor('class_beast_master')).toBe(4)
            expect(strikesFor('class_hunter')).toBe(3)
        })
    })

    describe('the enemy side', () => {
        it('resolves the super boss as the heavier of the two gates', () => {
            const boss = enemyStatsAt(at(1, BOSS_STAGE))
            const superBoss = enemyStatsAt(at(1, SUPER_BOSS_STAGE))
            expect(superBoss.hp.gt(boss.hp)).toBe(true)
        })

        it('attacks the party over the course of the fight', () => {
            const result = runFight({ hero: hero(30), position: at(3, SUPER_BOSS_STAGE), seed: 7 })
            expect(result.events.some(event => event.kind === 'enemy_attack')).toBe(true)
        })

        it('orders every event by time', () => {
            const result = runFight({ hero: hero(30), position: at(3, SUPER_BOSS_STAGE), seed: 7 })
            for (let index = 1; index < result.events.length; index++) {
                expect(result.events[index]!.at).toBeGreaterThanOrEqual(result.events[index - 1]!.at)
            }
        })
    })
})
