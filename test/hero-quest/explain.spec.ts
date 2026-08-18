/**
 * The stat breakdown, checked against the stats the game actually fights with.
 *
 * A breakdown is only worth anything if it is describing the real pipeline. The specs that
 * matter most here are the agreement ones: every stat's last stage must equal what
 * `partyUnitStats` computed, for the Hero and for every fielded Champion. If those hold, the
 * attribution in between is a decomposition rather than a second implementation that can drift.
 *
 * The rest cover the two things a reader of the report could otherwise be misled by: that
 * per-source lines stack **additively** (so they must never be multiplied together), and that
 * exactly one stage in the chain is unbounded.
 */

import { describe, expect, it } from 'vitest'
import { explainStats, levelsToCover, stagesOfCurve } from '#shared/utils/hero-quest/explain'
import { partyUnitStats } from '#shared/utils/hero-quest/stats'
import { maxHpFor } from '#shared/utils/hero-quest/combat'
import {
    DPS_STAT_EXPONENT,
    ENEMY_STEP_BASE,
    STAT_PACE_RATIO,
    STAT_PER_LEVEL_GROWTH
} from '#shared/utils/hero-quest/constants'
import { CHAMPIONS, RARITY_STAT_MULTIPLIER, getChampion } from '#shared/utils/hero-quest/content/champions'
import { ZERO } from '#shared/utils/hero-quest/numbers'
import type { ChampionSnapshot, HeroSnapshot } from '#shared/utils/hero-quest/types'

function hero(over: Partial<HeroSnapshot> = {}): HeroSnapshot {
    return {
        classId: 'class_beginner',
        heroLevel: 1,
        heroXp: ZERO,
        goldBonusPct: 0,
        offlineEfficiencyLevel: 0,
        offlineCapLevel: 0,
        ...over
    }
}

function fielded(championId: string): ChampionSnapshot {
    const definition = getChampion(championId)
    return {
        championId: definition.id,
        archetype: definition.archetype,
        rarityMultiplier: RARITY_STAT_MULTIPLIER[definition.rarity],
        investment: 1,
        strikesPerAttack: definition.strikesPerAttack,
        row: 'back',
        abilities: definition.abilities
    }
}

describe('agreement with the stats the game fights with', () => {
    const cases: [string, HeroSnapshot][] = [
        ['level-1 solo Beginner', hero()],
        ['level-40 Berserker', hero({ classId: 'class_berserker', heroLevel: 40 })],
        ['level-200 Sorcerer', hero({ classId: 'class_sorcerer', heroLevel: 200 })],
        ['a hero with a collection passive', hero({
            heroLevel: 30,
            ownedChampions: CHAMPIONS.slice(0, 12).map(c => ({ archetype: c.archetype, investment: 20 }))
        })],
        ['a hero with two fielded Champions', hero({
            heroLevel: 60,
            champions: [fielded(CHAMPIONS[0]!.id), fielded(CHAMPIONS[1]!.id)]
        })]
    ]

    for (const [label, snapshot] of cases) {
        it(`reproduces every final stat for ${label}`, () => {
            const explained = explainStats(snapshot)
            const units = partyUnitStats(snapshot)
            expect(explained.units).toHaveLength(units.length)

            explained.units.forEach((unit, index) => {
                const actual = units[index]!
                const find = (key: string) => unit.stats.find(stat => stat.key === key)!

                expect(find('pwr').final.toString(), `${label} #${index} pwr`).toBe(actual.pwr.toString())
                expect(find('def').final.toString(), `${label} #${index} def`).toBe(actual.def.toString())
                expect(find('spd').final.toString(), `${label} #${index} spd`).toBe(actual.spd.toString())
                // VIT is not on `UnitStats` directly — it is the input to max HP, which is.
                expect(maxHpFor(find('vit').final).toString()).toBe(actual.maxHp.toString())
            })
        })
    }

    it('walks the stages so each one lands on the next one\'s starting point', () => {
        const unit = explainStats(hero({ classId: 'class_knight', heroLevel: 75 })).units[0]!
        for (const stat of unit.stats) {
            let running = stat.stages[0]!.running
            expect(running.toString()).toBe(stat.stages[0]!.factor.toString())
            for (const stage of stat.stages.slice(1)) {
                expect(running.mul(stage.factor).toString(), `${stat.key}/${stage.id}`)
                    .toBe(stage.running.toString())
                running = stage.running
            }
            expect(running.toString()).toBe(stat.final.toString())
        }
    })
})

describe('exactly one source has no ceiling', () => {
    it('marks the level curve, and nothing else', () => {
        const unit = explainStats(hero({ heroLevel: 50 })).units[0]!
        for (const stat of unit.stats) {
            const unbounded = stat.stages.filter(stage => stage.unbounded)
            expect(unbounded.map(stage => stage.id)).toEqual(['level'])
        }
    })
})

describe('per-source lines stack additively', () => {
    /**
     * The trap the report is shaped around. `sumModifiers` sums fractions and converts once, so
     * two +50% lines are ×2.00 and never ×2.25 — a breakdown that reported each source as its own
     * multiplier would invite the reader to compute the wrong number.
     */
    it('reports the passive stage as one factor over additive parts', () => {
        const unit = explainStats(hero({ heroLevel: 20 })).units[0]!
        for (const stat of unit.stats) {
            const passives = stat.stages.find(stage => stage.id === 'passives')!
            const summed = passives.parts.reduce((total, part) => total + part.amount, 0)
            expect(passives.factor.toNumber()).toBeCloseTo(1 + summed, 10)
        }
    })

    it('reports the collection stage the same way', () => {
        const unit = explainStats(hero({
            heroLevel: 20,
            ownedChampions: CHAMPIONS.slice(0, 8).map(c => ({ archetype: c.archetype, investment: 15 }))
        })).units[0]!
        for (const stat of unit.stats) {
            const collection = stat.stages.find(stage => stage.id === 'collection')!
            const summed = collection.parts.reduce((total, part) => total + part.amount, 0)
            expect(collection.factor.toNumber()).toBeCloseTo(1 + summed, 10)
        }
    })
})

describe('the common denominator — stages of enemy curve', () => {
    it('prices one level at exactly STAT_PACE_RATIO stages, which is its definition', () => {
        // `STAT_PER_LEVEL_GROWTH = ENEMY_STEP_BASE^(STAT_PACE_RATIO / DPS_STAT_EXPONENT)`, so
        // converting it back through the same exponent must return the ratio. This is the spec
        // that keeps the report honest if either constant moves.
        expect(stagesOfCurve(STAT_PER_LEVEL_GROWTH)).toBeCloseTo(STAT_PACE_RATIO, 10)
        expect(explainStats(hero()).pacing.stagesPerLevel).toBeCloseTo(STAT_PACE_RATIO, 10)
    })

    it('reports the reciprocal too, because that is the readable direction', () => {
        const pacing = explainStats(hero()).pacing
        expect(pacing.levelsPerStage).toBeCloseTo(1 / STAT_PACE_RATIO, 10)
        expect(levelsToCover(10)).toBeCloseTo(10 / STAT_PACE_RATIO, 10)
    })

    it('prices a flat multiplier against the same curve', () => {
        // A ×1.36 collection passive, at the asymptotic exponent, in the unit everything else
        // is measured in.
        const stages = stagesOfCurve(1.36)
        expect(stages).toBeCloseTo(Math.log(1.36) * DPS_STAT_EXPONENT / Math.log(ENEMY_STEP_BASE), 10)
        expect(stages).toBeGreaterThan(0)
    })

    it('is zero rather than infinite for a factor that cannot be priced', () => {
        expect(stagesOfCurve(0)).toBe(0)
        expect(stagesOfCurve(Number.NaN)).toBe(0)
    })
})

describe('what the base spread was built from', () => {
    it('itemises the class path rather than reporting one folded integer', () => {
        // Berserker inherits Warrior's and Barbarian's shifts, so its PWR is three numbers, not
        // one — which is the difference between "is 22 right?" and "is +8 on top of +4 right?".
        const pwr = explainStats(hero({ classId: 'class_berserker' })).units[0]!
            .stats.find(stat => stat.key === 'pwr')!
        const base = pwr.stages[0]!
        expect(base.parts.length).toBeGreaterThan(1)
        expect(base.parts.reduce((total, part) => total + part.amount, 0))
            .toBeCloseTo(base.factor.toNumber(), 10)
    })

    it('gives a Champion no class path at all', () => {
        // `champions-guild-gacha.md` §1: Champions never touch the 16-node class tree, so there
        // is no ancestor to inherit a specialization shift from.
        const champion = explainStats(hero({
            heroLevel: 10,
            champions: [fielded(CHAMPIONS[0]!.id)]
        })).units[1]!
        for (const stat of champion.stats) {
            expect(stat.stages[0]!.parts).toHaveLength(1)
        }
        expect(champion.stats[0]!.stages.map(stage => stage.id))
            .toEqual(['base', 'level', 'investment', 'passives'])
    })
})

describe('the derived values', () => {
    it('says when a flat constant is still carrying the HP pool', () => {
        // `BASE_HP` is the one flat term meeting a compounding curve, and at level 1 it is most
        // of the pool. That is a scaling fact, so the breakdown states it rather than leaving it
        // to be inferred from the arithmetic.
        const early = explainStats(hero()).units[0]!.derived.find(d => d.key === 'maxHp')!
        expect(early.note).toMatch(/BASE_HP/)

        const late = explainStats(hero({ heroLevel: 120 })).units[0]!.derived.find(d => d.key === 'maxHp')!
        expect(late.note).toBeUndefined()
    })

    it('says when attack rate has stopped paying for SPD', () => {
        const capped = explainStats(hero({ heroLevel: 400 })).units[0]!
            .derived.find(d => d.key === 'attacksPerSecond')!
        expect(capped.note).toMatch(/MIN_ATTACK_INTERVAL_SECONDS/)
    })

    it('says when crit chance has hit its ceiling', () => {
        const capped = explainStats(hero({ classId: 'class_archer', heroLevel: 400 })).units[0]!
            .derived.find(d => d.key === 'critChance')!
        expect(capped.note).toMatch(/100%/)
    })
})
