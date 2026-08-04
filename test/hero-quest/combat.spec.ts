import { describe, expect, it } from 'vitest'
import {
    attackIntervalFor,
    attacksPerSecondFor,
    critChanceFor,
    critMultiplierFor,
    expectedHitDamage,
    hitChanceAgainst,
    maxHpFor,
    mitigation,
    rawHitDamage,
    unitDps
} from '#shared/utils/hero-quest/combat'
import {
    BASE_ATTACK_INTERVAL_SECONDS,
    BASE_HP,
    CRIT_CHANCE_PER_POINT,
    CRIT_DAMAGE_PER_POINT,
    HP_PER_VIT,
    K,
    MAX_EVASION,
    OVERFLOW_CONVERSION_RATE
} from '#shared/utils/hero-quest/constants'
import { deriveUnitStats, heroStatBlock } from '#shared/utils/hero-quest/stats'
import { getClass } from '#shared/utils/hero-quest/content/classes'
import { D } from '#shared/utils/hero-quest/numbers'

describe('hero-quest combat math', () => {
    describe('mitigation and damage', () => {
        it('deals full damage against zero DEF', () => {
            expect(mitigation(100, 0).toNumber()).toBe(0)
            expect(rawHitDamage(100, 0).toNumber()).toBe(100)
        })

        it('floors at exactly zero once DEF reaches PWR × K', () => {
            const pwr = 100
            const def = pwr * K
            expect(mitigation(pwr, def).toNumber()).toBe(1)
            expect(rawHitDamage(pwr, def).toNumber()).toBe(0)
        })

        it('stays at exactly zero past the threshold, never negative', () => {
            const pwr = 100
            for (const def of [pwr * K, pwr * K * 2, pwr * K * 1000]) {
                expect(rawHitDamage(pwr, def).toNumber()).toBe(0)
            }
        })

        it('scales smoothly with the DEF-to-PWR ratio below the threshold', () => {
            // DEF at half the threshold → half mitigation.
            expect(mitigation(100, 100 * K / 2).toNumber()).toBeCloseTo(0.5, 10)
            expect(rawHitDamage(100, 100 * K / 2).toNumber()).toBeCloseTo(50, 10)
        })

        it('is relative, not absolute — the same ratio mitigates the same at any scale', () => {
            const small = mitigation(10, 10).toNumber()
            const huge = mitigation(D(10).pow(60), D(10).pow(60)).toNumber()
            expect(huge).toBeCloseTo(small, 10)
        })

        it('applies the ability multiplier', () => {
            expect(rawHitDamage(100, 0, 2.5).toNumber()).toBe(250)
        })
    })

    describe('crit', () => {
        it('converts LCK linearly up to 100%', () => {
            const lck = 20
            expect(critChanceFor(lck).critChance).toBeCloseTo(lck * CRIT_CHANCE_PER_POINT, 10)
            expect(critChanceFor(lck).overflow).toBe(0)
        })

        it('caps chance at 100% and overflows the excess', () => {
            const lck = 2 / CRIT_CHANCE_PER_POINT // twice what's needed for 100%
            expect(critChanceFor(lck).critChance).toBe(1)
            expect(critChanceFor(lck).overflow).toBeCloseTo(1, 10)
        })

        it('converts overflow LCK into crit damage rather than wasting it', () => {
            const atCap = 1 / CRIT_CHANCE_PER_POINT
            const beyond = 2 / CRIT_CHANCE_PER_POINT
            expect(critMultiplierFor(beyond, 10)).toBeGreaterThan(critMultiplierFor(atCap, 10))
        })

        it('keeps overflow well below direct IMP investment', () => {
            expect(OVERFLOW_CONVERSION_RATE).toBeLessThan(CRIT_DAMAGE_PER_POINT)
        })

        it('scales crit damage from IMP', () => {
            expect(critMultiplierFor(0, 10)).toBeCloseTo(1 + 10 * CRIT_DAMAGE_PER_POINT, 10)
        })
    })

    describe('HP', () => {
        it('is base plus VIT scaling', () => {
            expect(maxHpFor(0).toNumber()).toBe(BASE_HP)
            expect(maxHpFor(10).toNumber()).toBe(BASE_HP + 10 * HP_PER_VIT)
        })
    })

    describe('attack rate', () => {
        it('starts at one attack per 3 seconds', () => {
            expect(attackIntervalFor(0)).toBe(BASE_ATTACK_INTERVAL_SECONDS)
            expect(attacksPerSecondFor(0)).toBeCloseTo(1 / 3, 10)
        })

        it('speeds up monotonically with SPD', () => {
            let previous = attackIntervalFor(0)
            for (const spd of [10, 50, 100, 200]) {
                const interval = attackIntervalFor(spd)
                expect(interval).toBeLessThan(previous)
                previous = interval
            }
        })

        it('is hard-capped at 3 attacks per second', () => {
            for (const spd of [400, 4_000, 1e9]) {
                expect(attacksPerSecondFor(spd)).toBeLessThanOrEqual(3)
            }
            expect(attacksPerSecondFor(1e9)).toBeCloseTo(3, 10)
        })

        it('never slows below the base interval for a zero or negative SPD', () => {
            expect(attackIntervalFor(-50)).toBe(BASE_ATTACK_INTERVAL_SECONDS)
        })
    })

    describe('evasion', () => {
        it('lands every hit at zero EVA', () => {
            expect(hitChanceAgainst(0)).toBe(1)
        })

        it('clamps total EVA at MAX_EVASION', () => {
            expect(hitChanceAgainst(MAX_EVASION)).toBeCloseTo(1 - MAX_EVASION, 10)
            expect(hitChanceAgainst(0.99)).toBeCloseTo(1 - MAX_EVASION, 10)
        })

        it('never makes a party untouchable', () => {
            expect(hitChanceAgainst(1)).toBeGreaterThan(0)
        })
    })

    describe('DPS derivation', () => {
        it('folds multi-strike kits into party DPS', () => {
            const hunter = getClass('class_hunter')
            const single = { ...deriveUnitStats(heroStatBlock('class_hunter', 1), hunter), strikesPerAttack: 1 }
            const triple = deriveUnitStats(heroStatBlock('class_hunter', 1), hunter)
            expect(triple.strikesPerAttack).toBe(3)
            expect(unitDps(triple, 0).toNumber()).toBeCloseTo(unitDps(single, 0).toNumber() * 3, 6)
        })

        it('averages crit rather than rolling it', () => {
            const beginner = getClass('class_beginner')
            const unit = deriveUnitStats(heroStatBlock('class_beginner', 1), beginner)
            const expected = unit.pwr.toNumber() * (1 + unit.critChance * (unit.critMultiplier - 1))
            expect(expectedHitDamage(unit, 0).toNumber()).toBeCloseTo(expected, 6)
        })

        it('produces zero DPS when the defender fully mitigates', () => {
            const beginner = getClass('class_beginner')
            const unit = deriveUnitStats(heroStatBlock('class_beginner', 1), beginner)
            expect(unitDps(unit, unit.pwr.mul(K)).toNumber()).toBe(0)
        })
    })
})
