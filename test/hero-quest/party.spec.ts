/**
 * Party composition — the Phase 1 seam Champions drop into.
 *
 * No roster exists yet, so these specs are about *shape*: that a Champion's power is driven
 * by the Hero's level rather than its own (Champions have no XP level — only the bounded
 * `star × 10 + level` dupe scalar), and that nothing downstream assumes a party of one.
 */

import { describe, expect, it } from 'vitest'
import { championStatBlock, heroStatBlock, partyUnitStats } from '#shared/utils/hero-quest/stats'
import { partyDps } from '#shared/utils/hero-quest/combat'
import { CHAMPION_INVESTMENT_PER_POINT } from '#shared/utils/hero-quest/constants'
import { ZERO } from '#shared/utils/hero-quest/numbers'
import type { ChampionSnapshot, HeroSnapshot } from '#shared/utils/hero-quest/types'

function champion(overrides: Partial<ChampionSnapshot> = {}): ChampionSnapshot {
    return {
        championId: 'champ_test',
        rarityMultiplier: 1,
        investment: 1,
        strikesPerAttack: 1,
        ...overrides
    }
}

function hero(heroLevel: number, champions: ChampionSnapshot[] = []): HeroSnapshot {
    return {
        classId: 'class_beginner',
        heroLevel,
        heroXp: ZERO,
        goldBonusPct: 0,
        offlineEfficiencyLevel: 0,
        offlineCapLevel: 0,
        champions
    }
}

describe('party composition', () => {
    it('fields the Hero alone when no Champions are present', () => {
        expect(partyUnitStats(hero(10))).toHaveLength(1)
        expect(partyUnitStats({ ...hero(10), champions: undefined })).toHaveLength(1)
    })

    it('puts the Hero first and keeps every fielded Champion', () => {
        const units = partyUnitStats(hero(10, [champion(), champion({ championId: 'champ_two' })]))
        expect(units).toHaveLength(3)

        const solo = partyUnitStats(hero(10))[0]!
        expect(units[0]!.pwr.eq(solo.pwr)).toBe(true)
    })

    it('scales Champions off the Hero level, which is what stops them becoming dead weight', () => {
        const base = heroStatBlock('class_beginner', 1)
        const low = championStatBlock(base, champion(), 1)
        const high = championStatBlock(base, champion(), 50)

        expect(high.pwr).toBeGreaterThan(low.pwr)
        // An un-invested Champion is exactly a Hero-equivalent body, never a penalty.
        expect(low.pwr).toBeCloseTo(base.pwr, 10)
    })

    it('rewards rarity and investment on top of the Hero-driven baseline', () => {
        const base = heroStatBlock('class_beginner', 20)
        const plain = championStatBlock(base, champion(), 20)
        const rare = championStatBlock(base, champion({ rarityMultiplier: 2.5 }), 20)
        const maxed = championStatBlock(base, champion({ investment: 60 }), 20)

        expect(rare.pwr).toBeCloseTo(plain.pwr * 2.5, 6)
        expect(maxed.pwr).toBeCloseTo(plain.pwr * (1 + 59 * CHAMPION_INVESTMENT_PER_POINT), 6)
    })

    it('makes party size worth real depth, not just speed', () => {
        // A DEF that shuts the solo Hero out completely is still beatable by a party —
        // the property the whole pooling change exists to produce.
        const solo = partyUnitStats(hero(30))
        const wall = solo[0]!.pwr.mul(2)

        expect(partyDps(solo, wall).toNumber()).toBe(0)
        expect(partyDps(partyUnitStats(hero(30, [champion(), champion()])), wall).toNumber())
            .toBeGreaterThan(0)
    })
})
