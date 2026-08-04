/**
 * The stat pipeline: (content, playerState) → final party stats.
 *
 * Resolves a class node's qualitative spread into numbers, accumulates specialization
 * deltas down the class path, applies hero level, and hands `combat.ts` a `UnitStats`.
 */

import { MIN_STAT_VALUE, STAT_PER_LEVEL_FLAT, STAT_PER_LEVEL_GROWTH, STAT_TIER_VALUES } from './constants'
import { classPath, getClass } from './content/classes'
import { attacksPerSecondFor, critChanceFor, critMultiplierFor, maxHpFor } from './combat'
import { D } from './numbers'
import type { ClassNode, HeroSnapshot, HqStatBlock, HqStatKey, StatTier, UnitStats } from './types'

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
 * GROWTH = 1.0 collapses this to pure flat-additive growth, which is the model the design
 * docs currently describe and which `implementation-plan.md` flags as provably unable to
 * keep pace with a ×5-per-prestige ceiling on its own. Raising GROWTH above 1.0 is how
 * that gets tested without touching any other file.
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
 * Resolve a stat block into combat-ready values.
 *
 * `eva` defaults to 0: base EVA is 0 for every unit in the game and no class node grants
 * it. The parameter exists so Traits (Phase 4) don't reshape this signature.
 */
export function deriveUnitStats(block: HqStatBlock, node: ClassNode, eva = 0): UnitStats {
    return {
        pwr: D(block.pwr),
        def: D(block.def),
        maxHp: maxHpFor(block.vit),
        attacksPerSecond: attacksPerSecondFor(block.spd),
        strikesPerAttack: node.strikesPerAttack,
        critChance: critChanceFor(block.lck).critChance,
        critMultiplier: critMultiplierFor(block.lck, block.imp),
        eva
    }
}

/** Phase 0 fields the Hero alone; Champions join this array in Phase 2. */
export function partyUnitStats(hero: HeroSnapshot): UnitStats[] {
    const node = getClass(hero.classId)
    return [deriveUnitStats(heroStatBlock(hero.classId, hero.heroLevel), node)]
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
