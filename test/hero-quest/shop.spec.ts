import { describe, expect, it } from 'vitest'
import {
    SHOP_TRACKS,
    getShopTrack,
    isShopTrackId,
    maxLevelFor,
    shopTrackCost
} from '#shared/utils/hero-quest/content/shop'
import {
    BASE_CHAMPION_SLOTS,
    MAX_CHAMPION_SLOTS,
    MAX_OFFLINE_CAP_LEVEL,
    MAX_OFFLINE_EFFICIENCY,
    MAX_OFFLINE_EFFICIENCY_LEVEL,
    OFFLINE_CAP_BASE_COST,
    OFFLINE_CAP_MAX_HOURS,
    OFFLINE_EFFICIENCY_BASE_COST
} from '#shared/utils/hero-quest/constants'
import { offlineCapHours, offlineEfficiency } from '#shared/utils/hero-quest/settle'

describe('hero-quest prestige shop', () => {
    it('exposes only the tracks with locked formulas — the two offline pair, plus Champion slots', () => {
        // Champion slots joined in Phase 2 because the system it unlocks now exists. The
        // remaining §4 sinks (Skill/Artifact slots, Raid Keys, global stat multipliers) still
        // have no formula, level count or magnitude in any doc — see `content/shop.ts`.
        expect(SHOP_TRACKS.map(track => track.id).sort())
            .toEqual(['championSlots', 'offlineCap', 'offlineEfficiency'])
    })

    it('matches each track\'s level count to the constant that caps its effect', () => {
        expect(maxLevelFor('offlineEfficiency')).toBe(MAX_OFFLINE_EFFICIENCY_LEVEL)
        expect(maxLevelFor('offlineCap')).toBe(MAX_OFFLINE_CAP_LEVEL)
        // 2 slots to start, 5 at the cap — so exactly 3 purchases (§1).
        expect(maxLevelFor('championSlots')).toBe(MAX_CHAMPION_SLOTS - BASE_CHAMPION_SLOTS)
    })

    it('reaches each track\'s designed ceiling at exactly its last level, not before', () => {
        expect(offlineEfficiency(MAX_OFFLINE_EFFICIENCY_LEVEL)).toBeCloseTo(MAX_OFFLINE_EFFICIENCY, 10)
        expect(offlineEfficiency(MAX_OFFLINE_EFFICIENCY_LEVEL - 1)).toBeLessThan(MAX_OFFLINE_EFFICIENCY)
        expect(offlineCapHours(MAX_OFFLINE_CAP_LEVEL)).toBe(OFFLINE_CAP_MAX_HOURS)
        expect(offlineCapHours(MAX_OFFLINE_CAP_LEVEL - 1)).toBeLessThan(OFFLINE_CAP_MAX_HOURS)
    })

    it('recognises its own track IDs and nothing else', () => {
        expect(isShopTrackId('offlineCap')).toBe(true)
        expect(isShopTrackId('championSlots')).toBe(true)
        expect(isShopTrackId('skillSlots')).toBe(false)
        expect(isShopTrackId('__proto__')).toBe(false)
    })

    it('throws on an unknown track rather than returning a default', () => {
        // @ts-expect-error deliberately out of the union — this is the runtime guard
        expect(() => getShopTrack('nope')).toThrow()
    })

    describe('cost curve', () => {
        it('prices the first level at the track\'s base cost', () => {
            expect(shopTrackCost('offlineEfficiency', 0)).toBe(OFFLINE_EFFICIENCY_BASE_COST)
            expect(shopTrackCost('offlineCap', 0)).toBe(OFFLINE_CAP_BASE_COST)
        })

        it('doubles per level on the short track, exactly', () => {
            // `cost(level) = BASE × 2^(level-1)` — the doc's 5-level shape, unrounded.
            for (let level = 0; level < MAX_OFFLINE_EFFICIENCY_LEVEL; level++) {
                expect(shopTrackCost('offlineEfficiency', level))
                    .toBeCloseTo(OFFLINE_EFFICIENCY_BASE_COST * Math.pow(2, level), 10)
            }
        })

        it('climbs monotonically on the long track and stays whole', () => {
            let previous = 0
            for (let level = 0; level < MAX_OFFLINE_CAP_LEVEL; level++) {
                const cost = shopTrackCost('offlineCap', level)!
                expect(cost).toBeGreaterThan(previous)
                expect(Number.isInteger(cost), `level ${level + 1}`).toBe(true)
                previous = cost
            }
        })

        it('gates the last few levels hard, which is the point of the long curve', () => {
            const first = shopTrackCost('offlineCap', 0)!
            const last = shopTrackCost('offlineCap', MAX_OFFLINE_CAP_LEVEL - 1)!
            expect(last / first).toBeGreaterThan(1e6)
        })

        it('returns null at the cap so a maxed track can never be bought again', () => {
            expect(shopTrackCost('offlineEfficiency', MAX_OFFLINE_EFFICIENCY_LEVEL)).toBeNull()
            expect(shopTrackCost('offlineCap', MAX_OFFLINE_CAP_LEVEL)).toBeNull()
            expect(shopTrackCost('offlineCap', MAX_OFFLINE_CAP_LEVEL + 50)).toBeNull()
        })

        it('treats a nonsense owned level as zero rather than pricing off it', () => {
            expect(shopTrackCost('offlineEfficiency', -5)).toBe(OFFLINE_EFFICIENCY_BASE_COST)
        })
    })
})
