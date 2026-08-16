/**
 * The prestige shop — permanent upgrades bought with Void Shards.
 *
 * **Two tracks in Phase 1, and only two.** `core-progression-and-prestige.md` §4 lists six
 * kinds of spend, but only these two have a locked formula shape *and* a locked level count
 * (`idle-mechanics.md` §4). The other four do not, in different ways:
 *
 * - Champion / Skill / Artifact slot tracks belong to the systems they unlock — Phase 2 and 3.
 * - Raid Key grant-rate tracks belong to Raids — Phase 4.
 * - Global stat multipliers, kill-count reduction and boss-timer extension have **no formula,
 *   no level count and no magnitude in any document**, and `open-items.md` #11.4 records that
 *   even their scope (Hero-only or party-wide) was never decided. Inventing them here would
 *   bake a guess into the one system whose whole job is to be the tuning surface.
 *
 * Adding any of them later is content, not code: `hqShopUpgrades` is keyed on an opaque
 * `upgradeId`, so a new track is a new entry in `SHOP_TRACKS` and nothing else.
 */

import {
    BASE_CHAMPION_SLOTS,
    CHAMPION_SLOT_BASE_COST,
    CHAMPION_SLOT_COST_GROWTH,
    MAX_CHAMPION_SLOTS,
    MAX_OFFLINE_CAP_LEVEL,
    MAX_OFFLINE_EFFICIENCY_LEVEL,
    OFFLINE_CAP_BASE_COST,
    OFFLINE_CAP_COST_GROWTH,
    OFFLINE_EFFICIENCY_BASE_COST,
    OFFLINE_EFFICIENCY_COST_GROWTH
} from '../constants'

export type ShopTrackId = 'offlineEfficiency' | 'offlineCap' | 'championSlots'

export interface ShopTrack {
    id: ShopTrackId
    name: string
    description: string
    maxLevel: number
    baseCost: number
    costGrowth: number
    /**
     * True when the cost curve is steep enough that fractional shards would be silly. Both
     * doc formulas round the long track and leave the short one exact; keeping the flag
     * rather than always rounding preserves the doc's `cost(level) = BASE × 2^(level-1)`
     * exactly for the 5-level track.
     */
    roundCost: boolean
}

export const SHOP_TRACKS: readonly ShopTrack[] = [
    {
        id: 'offlineEfficiency',
        name: 'Offline Efficiency',
        description: 'How much of the live rate unattended time earns, 50% → 100%.',
        maxLevel: MAX_OFFLINE_EFFICIENCY_LEVEL,
        baseCost: OFFLINE_EFFICIENCY_BASE_COST,
        costGrowth: OFFLINE_EFFICIENCY_COST_GROWTH,
        roundCost: false
    },
    {
        id: 'offlineCap',
        name: 'Offline Cap',
        description: 'How long unattended time keeps counting, 8h → 72h.',
        maxLevel: MAX_OFFLINE_CAP_LEVEL,
        baseCost: OFFLINE_CAP_BASE_COST,
        costGrowth: OFFLINE_CAP_COST_GROWTH,
        roundCost: true
    },
    {
        id: 'championSlots',
        name: 'Champion Slots',
        description: 'Champions you can field alongside the Hero, 2 → 5.',
        maxLevel: MAX_CHAMPION_SLOTS - BASE_CHAMPION_SLOTS,
        baseCost: CHAMPION_SLOT_BASE_COST,
        costGrowth: CHAMPION_SLOT_COST_GROWTH,
        roundCost: true
    }
]

export const SHOP_TRACK_BY_ID: Readonly<Record<ShopTrackId, ShopTrack>> = Object.fromEntries(
    SHOP_TRACKS.map(track => [track.id, track])
) as Record<ShopTrackId, ShopTrack>

export function isShopTrackId(id: string): id is ShopTrackId {
    return Object.prototype.hasOwnProperty.call(SHOP_TRACK_BY_ID, id)
}

export function getShopTrack(id: ShopTrackId): ShopTrack {
    const track = SHOP_TRACK_BY_ID[id]
    if (!track) throw new Error(`Unknown shop track: ${id}`)
    return track
}

/**
 * Void Shard price of the **next** level, given how many are already owned.
 *
 *     cost(level) = BASE × GROWTH^(level-1)
 *
 * `null` at the cap — the caller renders "maxed" rather than an unbuyable price, and the
 * buy route treats a null as a rejection.
 */
export function shopTrackCost(id: ShopTrackId, ownedLevel: number): number | null {
    const track = getShopTrack(id)
    const next = Math.max(0, Math.floor(ownedLevel)) + 1
    if (next > track.maxLevel) return null
    const raw = track.baseCost * Math.pow(track.costGrowth, next - 1)
    return track.roundCost ? Math.round(raw) : raw
}

export function maxLevelFor(id: ShopTrackId): number {
    return getShopTrack(id).maxLevel
}
