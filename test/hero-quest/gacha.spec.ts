/**
 * Shared gacha mechanics (`gacha-shared-system.md` §2–6).
 *
 * Several of these assert against **figures the doc states outright** — 1,066 dupes to max a
 * copy, ~50,240 cumulative pulls to reach gacha level 10, drop rows summing to 100%. Those
 * are the checks that catch a transcription slip in a table nobody re-derives by hand.
 */

import { describe, expect, it } from 'vitest'
import {
    applyDupes,
    applyPulls,
    craftCostFor,
    dropRatesFor,
    dupesToLevelUp,
    effectiveDropRates,
    essenceValueFor,
    foldToAvailableRarity,
    investmentScalar,
    isMaxed,
    ladderDateKey,
    newEntry,
    pullCost,
    pullsToNextLevel,
    rarityFromRoll,
    sealLadderPrice,
    sealLadderTotal,
    totalDupesToMax
} from '#shared/utils/hero-quest/gacha'
import {
    DROP_RATE_TABLE,
    LEVELS_PER_STAR,
    MAX_GACHA_LEVEL,
    MAX_STAR,
    PULLS_TO_LEVEL_UP,
    SEAL_LADDER_BASE_GOLD,
    TEN_PULL_SIZE
} from '#shared/utils/hero-quest/constants'
import { RARITIES, championFromRoll, getChampion } from '#shared/utils/hero-quest/content/champions'
import type { Rarity } from '#shared/utils/hero-quest/types'

describe('gacha leveling', () => {
    it('needs the pull counts the doc locks, and ~50,240 in total', () => {
        expect(PULLS_TO_LEVEL_UP.slice(1)).toEqual([10, 30, 100, 200, 600, 1_700, 4_600, 12_000, 31_000])
        expect(PULLS_TO_LEVEL_UP.reduce((sum, value) => sum + value, 0)).toBe(50_240)
    })

    it('advances a level once its threshold is met, carrying the remainder', () => {
        expect(applyPulls(1, 0, 10)).toEqual({ level: 2, progress: 0 })
        expect(applyPulls(1, 0, 12)).toEqual({ level: 2, progress: 2 })
        // 10 to reach 2, then 30 to reach 3 — one call must be able to cross both.
        expect(applyPulls(1, 0, 40)).toEqual({ level: 3, progress: 0 })
    })

    it('stops accumulating at the cap rather than banking pulls forever', () => {
        expect(pullsToNextLevel(MAX_GACHA_LEVEL)).toBeNull()
        expect(applyPulls(MAX_GACHA_LEVEL, 0, 5_000)).toEqual({ level: MAX_GACHA_LEVEL, progress: 0 })
    })
})

describe('drop table', () => {
    it('has every row summing to exactly 100%', () => {
        for (const [level, row] of DROP_RATE_TABLE.entries()) {
            if (row.length === 0) continue
            const sum = row.reduce((total, rate) => total + rate, 0)
            expect(sum, `level ${level}`).toBeCloseTo(100, 9)
        }
    })

    it('offers Common only at level 1, and Mythic only from level 6', () => {
        expect(dropRatesFor(1)[0]).toBe(100)
        expect(dropRatesFor(5)[5]).toBe(0)
        expect(dropRatesFor(6)[5]).toBeGreaterThan(0)
    })

    it('maps a roll onto the cumulative band it falls in', () => {
        expect(rarityFromRoll(1, 0)).toBe('common')
        expect(rarityFromRoll(1, 0.999)).toBe('common')
        // Level 2 is 75% Common / 25% Uncommon.
        expect(rarityFromRoll(2, 0.74)).toBe('common')
        expect(rarityFromRoll(2, 0.76)).toBe('uncommon')
        expect(rarityFromRoll(MAX_GACHA_LEVEL, 0.999)).toBe('mythic')
    })

    it('never returns a rarity the level cannot roll, at either end of the range', () => {
        for (let level = 1; level <= MAX_GACHA_LEVEL; level++) {
            const rates = dropRatesFor(level)
            for (const roll of [0, 0.5, 0.999999, 1]) {
                const rarity = rarityFromRoll(level, roll)
                expect(rates[RARITIES.indexOf(rarity)], `level ${level} roll ${roll}`).toBeGreaterThan(0)
            }
        }
    })
})

/**
 * Partial-roster folding.
 *
 * These pin the repair for the Phase 2 roster gap: Uncommon, Epic and Legendary have no
 * Champions, and more than half of all rolls at gacha level 7+ name one of them. Folding
 * *down* is what keeps a partial roster stingier than the finished one rather than richer —
 * the uniform-pick alternative pushed effective Mythic at level 10 from 3.0% to 28.7%.
 */
describe('folding unshipped rarities', () => {
    const shipped = (rarity: Rarity) => rarity === 'common' || rarity === 'rare' || rarity === 'mythic'

    it('folds each unshipped rarity down to its nearest shipped neighbour', () => {
        expect(foldToAvailableRarity('uncommon', shipped)).toBe('common')
        expect(foldToAvailableRarity('epic', shipped)).toBe('rare')
        expect(foldToAvailableRarity('legendary', shipped)).toBe('rare')
    })

    it('leaves shipped rarities untouched', () => {
        for (const rarity of ['common', 'rare', 'mythic'] as const) {
            expect(foldToAvailableRarity(rarity, shipped)).toBe(rarity)
        }
    })

    it('is the identity once every rarity has content', () => {
        for (const rarity of RARITIES) {
            expect(foldToAvailableRarity(rarity, () => true)).toBe(rarity)
        }
    })

    it('walks up only when nothing exists below', () => {
        const onlyMythic = (rarity: Rarity) => rarity === 'mythic'
        expect(foldToAvailableRarity('common', onlyMythic)).toBe('mythic')
    })

    it('throws rather than guessing when a gacha has no content at all', () => {
        expect(() => foldToAvailableRarity('common', () => false)).toThrow()
    })

    it('never pays out above the rolled rarity — the whole point of folding down', () => {
        for (const rarity of RARITIES) {
            const folded = foldToAvailableRarity(rarity, shipped)
            expect(RARITIES.indexOf(folded), rarity).toBeLessThanOrEqual(RARITIES.indexOf(rarity))
        }
    })

    it('keeps the effective table summing to 100% and Mythic on its designed rate', () => {
        for (let level = 1; level <= MAX_GACHA_LEVEL; level++) {
            const effective = effectiveDropRates(level, shipped)
            expect(effective.reduce((a, b) => a + b, 0), `level ${level}`).toBeCloseTo(100, 9)
            // Nothing folds *into* Mythic, so it keeps exactly the rate the doc designed.
            expect(effective[5], `level ${level}`).toBeCloseTo(dropRatesFor(level)[5]!, 9)
            // And the unshipped bands are genuinely empty.
            for (const index of [1, 3, 4]) {
                expect(effective[index], `level ${level} band ${index}`).toBe(0)
            }
        }
    })

    it('pays out the rarity that was rolled, now that every rarity is populated', () => {
        // This used to assert an Epic roll folded *down* to a Rare, because Phase 2 shipped no
        // Epics. The roster is complete, so the fold is gone from the Champion path and a roll
        // means what it says.
        for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
            expect(championFromRoll('epic', roll).rarity).toBe('epic')
        }
    })

    it('spreads the roll across the whole pool for the resolved rarity', () => {
        const picked = new Set([0, 0.3, 0.6, 0.9].map(roll => championFromRoll('mythic', roll).id))
        expect(picked.size).toBeGreaterThan(1)
        expect([...picked].every(id => getChampion(id).rarity === 'mythic')).toBe(true)
    })
})

describe('pull cost', () => {
    it('discounts the 10-pull but still credits ten pulls of progress', () => {
        expect(pullCost(1)).toEqual({ seals: 1, pulls: 1 })
        expect(pullCost(TEN_PULL_SIZE)).toEqual({ seals: 9, pulls: 10 })
    })

    it('escalates the Gold ladder per purchase and resets from the base', () => {
        expect(sealLadderPrice('champion', 0)).toBe(SEAL_LADDER_BASE_GOLD)
        expect(sealLadderPrice('champion', 1)).toBeGreaterThan(SEAL_LADDER_BASE_GOLD)
        // Independent per gacha: Gear climbs faster than Champion.
        expect(sealLadderPrice('gear', 100)).toBeGreaterThan(sealLadderPrice('champion', 100))
    })

    it('prices a bulk buy rung by rung, so buying together is never a discount', () => {
        const oneAtATime = sealLadderPrice('champion', 4)
            + sealLadderPrice('champion', 5)
            + sealLadderPrice('champion', 6)
        expect(sealLadderTotal('champion', 4, 3)).toBe(oneAtATime)
    })

    it('treats a zero-count bulk buy as free rather than charging a rung', () => {
        expect(sealLadderTotal('champion', 0, 0)).toBe(0)
    })

    it('keys the ladder reset on a UTC date string, never a timestamp', () => {
        expect(ladderDateKey(Date.UTC(2026, 7, 11, 23, 59))).toBe('2026-08-11')
        expect(ladderDateKey(Date.UTC(2026, 7, 12, 0, 1))).toBe('2026-08-12')
        // A plain string compare — the exact thing a microsecond-precision timestamp CAS
        // cannot do reliably against a JS Date.
        expect(ladderDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
})

describe('duplicates', () => {
    it('follows the doc dupe table, including the flat cap from 1★ Lv3 on', () => {
        expect(dupesToLevelUp(0, 1)).toBe(2)
        expect(dupesToLevelUp(0, 5)).toBe(8)
        expect(dupesToLevelUp(0, 10)).toBe(16)
        expect(dupesToLevelUp(1, 1)).toBe(18)
        expect(dupesToLevelUp(1, 2)).toBe(19)
        expect(dupesToLevelUp(1, 3)).toBe(20)
        expect(dupesToLevelUp(MAX_STAR, 9)).toBe(20)
    })

    it('takes exactly 1,066 dupes to go from scratch to 5★ Lv10', () => {
        expect(totalDupesToMax()).toBe(1_066)
    })

    it('banks partial progress rather than rounding it away', () => {
        const outcome = applyDupes(newEntry(), 1, 'common')
        expect(outcome.entry).toEqual({ star: 0, level: 1, dupeProgress: 1 })
        expect(outcome.levelsGained).toBe(0)
    })

    it('stars up every ten levels and resets the level', () => {
        let entry = newEntry()
        // Enough dupes to clear all ten levels of 0★.
        let spent = 0
        for (let level = 1; level <= LEVELS_PER_STAR; level++) spent += dupesToLevelUp(0, level)
        entry = applyDupes(entry, spent, 'common').entry

        expect(entry.star).toBe(1)
        expect(entry.level).toBe(1)
        expect(entry.dupeProgress).toBe(0)
    })

    it('converts to Essence once maxed instead of wasting the dupe', () => {
        const maxed = { star: MAX_STAR, level: LEVELS_PER_STAR, dupeProgress: 0 }
        expect(isMaxed(maxed)).toBe(true)

        const outcome = applyDupes(maxed, 3, 'rare')
        expect(outcome.entry).toEqual(maxed)
        expect(outcome.essenceGained).toBe(3 * essenceValueFor('rare'))
    })

    it('splits a batch that maxes a copy partway through', () => {
        // One level short of maxed, with the level's dupes all but banked.
        const nearly = { star: MAX_STAR, level: LEVELS_PER_STAR - 1, dupeProgress: dupesToLevelUp(MAX_STAR, LEVELS_PER_STAR - 1) - 1 }
        const outcome = applyDupes(nearly, 3, 'mythic')

        expect(isMaxed(outcome.entry)).toBe(true)
        expect(outcome.levelsGained).toBe(1)
        // One dupe finished the level; only the remaining two convert.
        expect(outcome.essenceGained).toBe(2 * essenceValueFor('mythic'))
    })
})

describe('essence and crafting', () => {
    it('scales both ladders ×5 per rarity tier', () => {
        expect(RARITIES.map(essenceValueFor)).toEqual([1, 5, 25, 125, 625, 3_125])
        expect(RARITIES.map(craftCostFor)).toEqual([5, 25, 125, 625, 3_125, 15_625])
    })

    it('prices a craft at exactly 5× that rarity’s own dupe value', () => {
        for (const rarity of RARITIES) {
            expect(craftCostFor(rarity), rarity).toBe(essenceValueFor(rarity) * 5)
        }
    })
})

describe('investment scalar', () => {
    it('runs 1 at 0★ Lv1 through 60 at 5★ Lv10', () => {
        expect(investmentScalar(0, 1)).toBe(1)
        expect(investmentScalar(MAX_STAR, LEVELS_PER_STAR)).toBe(60)
    })
})
