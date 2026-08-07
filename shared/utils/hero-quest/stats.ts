/**
 * The stat pipeline: (content, playerState) → final party stats.
 *
 * Resolves a class node's qualitative spread into numbers, accumulates specialization
 * deltas down the class path, applies hero level, and hands `combat.ts` a `UnitStats`.
 */

import {
    CHAMPION_INVESTMENT_PER_POINT,
    MIN_STAT_VALUE,
    STAT_PER_LEVEL_FLAT,
    STAT_PER_LEVEL_GROWTH,
    STAT_TIER_VALUES
} from './constants'
import { classPath, getClass } from './content/classes'
import { attacksPerSecondFor, critChanceFor, critMultiplierFor, maxHpFor } from './combat'
import { D } from './numbers'
import type { ChampionSnapshot, ClassNode, HeroSnapshot, HqStatBlock, HqStatKey, StatTier, UnitStats } from './types'

const STAT_KEYS: readonly HqStatKey[] = ['pwr', 'spd', 'lck', 'imp', 'vit', 'def']

export function tierValue(tier: StatTier): number {
    return STAT_TIER_VALUES[tier]
}

/**
 * Level-1 stat block for a class: its own tier spread, plus every specialization delta
 * along the path from the root. Berserker therefore carries Warrior's and Barbarian's
 * shifts, not just its own.
 */
export function baseSpreadFor(node: ClassNode): HqStatBlock {
    const block = {} as HqStatBlock
    for (const key of STAT_KEYS) {
        block[key] = tierValue(node.spread[key])
    }

    for (const ancestor of classPath(node.id)) {
        for (const key of STAT_KEYS) {
            block[key] += ancestor.delta[key] ?? 0
        }
    }

    for (const key of STAT_KEYS) {
        block[key] = Math.max(MIN_STAT_VALUE, block[key])
    }
    return block
}

/**
 * statAtLevel(base, level) = (base + FLAT × (level-1)) × GROWTH^(level-1)
 *
 * `GROWTH` is derived from `STAT_PACE_RATIO` and sits just above 1.0, which is what the
 * design docs now describe — geometric, expressed as a fraction of the enemy curve
 * (`core-progression-and-prestige.md` §1). `FLAT` is 0 by design.
 *
 * The flat-additive model this comment used to describe (GROWTH = 1.0) is not merely
 * out of date, it is provably unworkable: additive growth against a geometric ceiling
 * falls behind at any constant, and the campaign sim confirms it — a solo Hero stalls in
 * World 3 and never completes a prestige, at any XP rate.
 */
export function statAtLevel(base: number, level: number): number {
    const steps = Math.max(0, level - 1)
    const additive = base + STAT_PER_LEVEL_FLAT * steps
    return Math.max(MIN_STAT_VALUE, additive * Math.pow(STAT_PER_LEVEL_GROWTH, steps))
}

export function heroStatBlock(classId: HeroSnapshot['classId'], heroLevel: number): HqStatBlock {
    const base = baseSpreadFor(getClass(classId))
    const block = {} as HqStatBlock
    for (const key of STAT_KEYS) {
        block[key] = statAtLevel(base[key], heroLevel)
    }
    return block
}

/**
 * Stat block for a fielded Champion.
 *
 * Two axes, deliberately: the **Hero's level** supplies unbounded growth through the same
 * `statAtLevel` curve the Hero rides, and the Champion's own rarity × investment supplies a
 * bounded multiplier it earns through the gacha. Without the first, a Champion's PWR falls
 * behind an exponential curve and — because mitigation clamps at `DEF ≥ PWR × K` — stops
 * contributing *exactly zero* rather than merely less. Without the second, pulling and
 * starring Champions would not matter.
 *
 * The base spread and how `investment` converts to a multiplier are Phase 2 content
 * decisions the docs have not made (`champions-guild-gacha.md` §2 specifies neither base
 * magnitudes nor per-archetype spreads). This function owns the *shape* only: whatever those
 * turn out to be, they multiply a Hero-level-driven baseline rather than replacing it.
 */
export function championStatBlock(base: HqStatBlock, champion: ChampionSnapshot, heroLevel: number): HqStatBlock {
    const scale = champion.rarityMultiplier * championInvestmentMultiplier(champion.investment)
    const block = {} as HqStatBlock
    for (const key of STAT_KEYS) {
        block[key] = Math.max(MIN_STAT_VALUE, statAtLevel(base[key], heroLevel) * scale)
    }
    return block
}

/**
 * `(star × 10 + level)` runs 1 → 60. Mapping it to a multiplier is a Phase 2 tuning call —
 * identity-at-minimum is the placeholder that makes an un-invested Champion exactly a
 * Hero-equivalent body and never a penalty.
 */
export function championInvestmentMultiplier(investment: number): number {
    return 1 + Math.max(0, investment - 1) * CHAMPION_INVESTMENT_PER_POINT
}

/**
 * Resolve a stat block into combat-ready values.
 *
 * Takes the kit rather than the class node — `strikesPerAttack` was the only field it ever
 * read off `ClassNode`, and Champions carry the same property without being on the class
 * tree at all (`classes-and-combat.md` §5: "Champions never touch the 16-node class tree").
 *
 * `eva` defaults to 0: base EVA is 0 for every unit in the game and no class node grants
 * it. The parameter exists so Traits (Phase 4) don't reshape this signature.
 */
export function deriveUnitStats(block: HqStatBlock, kit: { strikesPerAttack: number }, eva = 0): UnitStats {
    return {
        pwr: D(block.pwr),
        def: D(block.def),
        maxHp: maxHpFor(block.vit),
        attacksPerSecond: attacksPerSecondFor(block.spd),
        spd: block.spd,
        strikesPerAttack: kit.strikesPerAttack,
        critChance: critChanceFor(block.lck).critChance,
        critMultiplier: critMultiplierFor(block.lck, block.imp),
        eva
    }
}

/**
 * The fielded party, Hero first. Champions are absent through Phase 1, so this is still a
 * one-element array in practice — but nothing downstream assumes that any more.
 */
export function partyUnitStats(hero: HeroSnapshot): UnitStats[] {
    const node = getClass(hero.classId)
    const units = [deriveUnitStats(heroStatBlock(hero.classId, hero.heroLevel), node)]

    for (const champion of hero.champions ?? []) {
        // Level-1 spread, not the Hero's levelled block — `championStatBlock` applies the
        // level curve itself. Phase 1 has no Champion roster, so the Hero's own spread
        // stands in; Phase 2 swaps in the archetype spread and nothing else moves.
        const base = baseSpreadFor(node)
        units.push(deriveUnitStats(championStatBlock(base, champion, hero.heroLevel), champion))
    }
    return units
}

export function sumStatBlocks(...blocks: HqStatBlock[]): HqStatBlock {
    const total = { pwr: 0, spd: 0, lck: 0, imp: 0, vit: 0, def: 0 }
    for (const block of blocks) {
        for (const key of STAT_KEYS) {
            total[key] += block[key]
        }
    }
    return total
}
