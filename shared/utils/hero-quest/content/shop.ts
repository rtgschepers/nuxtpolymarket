/**
 * The prestige shop — permanent upgrades, mostly bought with Void Shards.
 *
 * Six tracks now: the two offline tracks and the four slot tracks the gachas and Loadouts each
 * unlock. What is still **not** here, and why:
 *
 * - Raid Key grant-rate tracks belong to Raids — Phase 4.
 * - Gear has **no** slot track at all. All six Forge slots are available from account start
 *   (`gear-equipment.md` §1) — the deliberate exception among the four gachas, because slots map
 *   onto Hero stats that exist from day one rather than a party size that grows.
 * - Global stat multipliers, kill-count reduction and boss-timer extension have **no formula,
 *   no level count and no magnitude in any document**. The stat multiplier was in fact *cut*
 *   from the shop outright (`open-items.md` #11.4) rather than specified. Inventing the other
 *   two here would bake a guess into the one system whose whole job is to be the tuning surface.
 *
 * Adding any of them later is content, not code: `hqShopUpgrades` is keyed on an opaque
 * `upgradeId`, so a new track is a new entry in `SHOP_TRACKS` and nothing else.
 *
 * ## Two currencies
 *
 * Every track was Void Shards until Loadouts. `loadouts.md` §3 prices Loadout slots in **Gems**,
 * deliberately: every other slot track gates real party power, while a Loadout slot gates only
 * taps — a player with 2 slots can manually re-equip everything a 10-slot player can. That is
 * why `ShopTrack` carries a `currency` and the buy route branches on it, rather than the shop
 * assuming one balance.
 */

import {
    ARTIFACT_SLOT_BASE_COST,
    ARTIFACT_SLOT_COST_GROWTH,
    BASE_ARTIFACT_SLOTS,
    BASE_CHAMPION_SLOTS,
    BASE_LOADOUT_SLOTS,
    BASE_SKILL_SLOTS,
    CHAMPION_SLOT_BASE_COST,
    CHAMPION_SLOT_COST_GROWTH,
    LOADOUT_SLOT_BASE_COST_GEMS,
    LOADOUT_SLOT_COST_GROWTH,
    MAX_ARTIFACT_SLOTS,
    MAX_CHAMPION_SLOTS,
    MAX_LOADOUT_SLOTS,
    MAX_OFFLINE_CAP_LEVEL,
    MAX_OFFLINE_EFFICIENCY_LEVEL,
    MAX_SKILL_SLOTS,
    OFFLINE_CAP_BASE_COST,
    OFFLINE_CAP_COST_GROWTH,
    OFFLINE_EFFICIENCY_BASE_COST,
    OFFLINE_EFFICIENCY_COST_GROWTH,
    SKILL_SLOT_BASE_COST,
    SKILL_SLOT_COST_GROWTH
} from '../constants'

export type ShopTrackId =
    | 'offlineEfficiency'
    | 'offlineCap'
    | 'championSlots'
    | 'skillSlots'
    | 'artifactSlots'
    | 'loadoutSlots'

/** What pays for a track. Void Shards unless the track buys pure convenience. */
export type ShopCurrency = 'voidShards' | 'gems'

export interface ShopTrack {
    id: ShopTrackId
    name: string
    description: string
    maxLevel: number
    baseCost: number
    costGrowth: number
    currency: ShopCurrency
    /**
     * True when the cost curve is steep enough that fractional shards would be silly. Both
     * doc formulas round the long track and leave the short one exact; keeping the flag
     * rather than always rounding preserves the doc's `cost(level) = BASE × 2^(level-1)`
     * exactly for the 5-level track.
     *
     * Always true for a Gems track — `debitGems` takes an integer and rejects anything else.
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
        currency: 'voidShards',
        roundCost: false
    },
    {
        id: 'offlineCap',
        name: 'Offline Cap',
        description: 'How long unattended time keeps counting, 8h → 72h.',
        maxLevel: MAX_OFFLINE_CAP_LEVEL,
        baseCost: OFFLINE_CAP_BASE_COST,
        costGrowth: OFFLINE_CAP_COST_GROWTH,
        currency: 'voidShards',
        roundCost: true
    },
    {
        id: 'championSlots',
        name: 'Champion Slots',
        description: 'Champions you can field alongside the Hero, 2 → 5.',
        maxLevel: MAX_CHAMPION_SLOTS - BASE_CHAMPION_SLOTS,
        baseCost: CHAMPION_SLOT_BASE_COST,
        costGrowth: CHAMPION_SLOT_COST_GROWTH,
        currency: 'voidShards',
        roundCost: true
    },
    // The three 2→5 tracks are deliberately identical in shape (`skills-gacha.md` §6 and
    // `artifacts-dig-site-gacha.md` §7 both say "mirroring the Champion party-slot progression
    // exactly"), so they are three entries rather than one parameterised track only because
    // `upgradeId` has to differ per system.
    {
        id: 'skillSlots',
        name: 'Skill Slots',
        description: 'Training Grounds skills the Hero can equip, 2 → 5.',
        maxLevel: MAX_SKILL_SLOTS - BASE_SKILL_SLOTS,
        baseCost: SKILL_SLOT_BASE_COST,
        costGrowth: SKILL_SLOT_COST_GROWTH,
        currency: 'voidShards',
        roundCost: true
    },
    {
        id: 'artifactSlots',
        name: 'Artifact Slots',
        description: 'Artifacts the party can carry, 2 → 5.',
        maxLevel: MAX_ARTIFACT_SLOTS - BASE_ARTIFACT_SLOTS,
        baseCost: ARTIFACT_SLOT_BASE_COST,
        costGrowth: ARTIFACT_SLOT_COST_GROWTH,
        currency: 'voidShards',
        roundCost: true
    },
    {
        id: 'loadoutSlots',
        name: 'Loadout Slots',
        description: 'Saved loadouts you can keep, 2 → 10.',
        maxLevel: MAX_LOADOUT_SLOTS - BASE_LOADOUT_SLOTS,
        baseCost: LOADOUT_SLOT_BASE_COST_GEMS,
        costGrowth: LOADOUT_SLOT_COST_GROWTH,
        currency: 'gems',
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
