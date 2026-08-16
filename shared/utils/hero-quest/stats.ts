/**
 * The stat pipeline: (content, playerState) → final party stats.
 *
 * Resolves a class node's qualitative spread into numbers, accumulates specialization
 * deltas down the class path, applies hero level, and hands `combat.ts` a `UnitStats`.
 */

import {
    BASE_THREAT,
    CHAMPION_INVESTMENT_PER_POINT,
    CHAMPION_PASSIVE_PER_POINT,
    MIN_STAT_VALUE,
    TANK_THREAT_MULTIPLIER,
    STAT_PER_LEVEL_FLAT,
    STAT_PER_LEVEL_GROWTH,
    STAT_TIER_VALUES
} from './constants'
import { classPath, getClass } from './content/classes'
import { getArchetype } from './content/champions'
import { attacksPerSecondFor, critChanceFor, critMultiplierFor, maxHpFor } from './combat'
import { D, ZERO, decMax, decPow } from './numbers'
import type { Decimal, DecimalSource } from './numbers'
import type {
    ChampionArchetype,
    ChampionSnapshot,
    ClassNode,
    FormationRow,
    HeroSnapshot,
    HqStatBlock,
    HqStatKey,
    StatTier,
    UnitStats
} from './types'

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
    // Accumulated as plain numbers — a level-1 spread is a handful of small integers, and
    // this is the boundary where authored content becomes Decimal.
    const raw = {} as Record<HqStatKey, number>
    for (const key of STAT_KEYS) {
        raw[key] = tierValue(node.spread[key])
    }

    for (const ancestor of classPath(node.id)) {
        for (const key of STAT_KEYS) {
            raw[key] += ancestor.delta[key] ?? 0
        }
    }

    const block = {} as HqStatBlock
    for (const key of STAT_KEYS) {
        block[key] = D(Math.max(MIN_STAT_VALUE, raw[key]!))
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
export function statAtLevel(base: DecimalSource, level: number): Decimal {
    const steps = Math.max(0, level - 1)
    const additive = D(base).add(STAT_PER_LEVEL_FLAT * steps)
    return decMax(MIN_STAT_VALUE, additive.mul(decPow(STAT_PER_LEVEL_GROWTH, steps)))
}

/**
 * Level-1 stat block for a Champion archetype.
 *
 * The Champion equivalent of `baseSpreadFor`, minus the delta accumulation — Champions never
 * touch the class tree (`champions-guild-gacha.md` §1), so there is no path to walk and no
 * specialization shift to inherit. Same `StatTier` vocabulary as the Hero's spread, which is
 * what keeps the two blocks directly comparable.
 */
export function archetypeSpread(archetype: ChampionArchetype): HqStatBlock {
    const definition = getArchetype(archetype)
    const block = {} as HqStatBlock
    for (const key of STAT_KEYS) {
        block[key] = D(Math.max(MIN_STAT_VALUE, tierValue(definition.spread[key])))
    }
    return block
}

/**
 * The §7 passive collection bonus, as a per-stat multiplier.
 *
 * Reads the **whole collection**, not the fielded party — a maxed Champion sitting in the
 * barracks still strengthens the Hero, which is what makes pulling broadly worth doing
 * alongside fielding well. Two separate reward loops, by design.
 *
 * Every archetype maps to a fixed stat or pair (Tank → DEF+VIT, Damage → PWR, Support →
 * IMP+LCK, Control → SPD), covering the Hero's six stats exactly once with no special case.
 */
export function collectionPassiveMultipliers(
    owned: readonly { archetype: ChampionArchetype; investment: number }[]
): Record<HqStatKey, number> {
    const multipliers = { pwr: 1, spd: 1, lck: 1, imp: 1, vit: 1, def: 1 }
    for (const copy of owned) {
        const bonus = Math.max(0, copy.investment) * CHAMPION_PASSIVE_PER_POINT
        for (const key of getArchetype(copy.archetype).passiveStats) {
            multipliers[key] += bonus
        }
    }
    return multipliers
}

export function heroStatBlock(
    classId: HeroSnapshot['classId'],
    heroLevel: number,
    passive?: Record<HqStatKey, number>
): HqStatBlock {
    const base = baseSpreadFor(getClass(classId))
    const block = {} as HqStatBlock
    for (const key of STAT_KEYS) {
        block[key] = statAtLevel(base[key], heroLevel).mul(passive?.[key] ?? 1)
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
        block[key] = decMax(MIN_STAT_VALUE, statAtLevel(base[key], heroLevel).mul(scale))
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
export function deriveUnitStats(
    block: HqStatBlock,
    kit: { strikesPerAttack: number; row: FormationRow; threat?: number },
    eva = 0
): UnitStats {
    return {
        pwr: block.pwr,
        def: block.def,
        maxHp: maxHpFor(block.vit),
        attacksPerSecond: attacksPerSecondFor(block.spd),
        spd: block.spd,
        strikesPerAttack: kit.strikesPerAttack,
        row: kit.row,
        threat: kit.threat ?? BASE_THREAT,
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
    // The passive reads the whole collection; only the Hero receives it (§7).
    const passive = collectionPassiveMultipliers(hero.ownedChampions ?? [])
    const units = [deriveUnitStats(heroStatBlock(hero.classId, hero.heroLevel, passive), {
        strikesPerAttack: node.strikesPerAttack,
        // The player's saved placement wins; the class node's suggestion is the fallback.
        row: hero.heroRow ?? node.defaultRow,
        threat: threatFor(hero.classId)
    })]

    for (const champion of hero.champions ?? []) {
        units.push(deriveUnitStats(
            championStatBlock(archetypeSpread(champion.archetype), champion, hero.heroLevel),
            { ...champion, threat: archetypeThreat(champion.archetype) }
        ))
    }
    return units
}

/**
 * The Warrior path's threat modifier (`classes-and-combat.md` §7), applied to every node on
 * it — Warrior, Barbarian, Berserker, Knight, Paladin — since the doc attributes it to the
 * path rather than to any single node's skill.
 */
export function threatFor(classId: HeroSnapshot['classId']): number {
    const onWarriorPath = classPath(classId).some(node => node.id === 'class_warrior')
    return onWarriorPath ? BASE_THREAT * TANK_THREAT_MULTIPLIER : BASE_THREAT
}

/** Tank is the party's aggro anchor (`champions-guild-gacha.md` §8.2); nobody else pulls. */
export function archetypeThreat(archetype: ChampionArchetype): number {
    return archetype === 'tank' ? BASE_THREAT * TANK_THREAT_MULTIPLIER : BASE_THREAT
}

export function sumStatBlocks(...blocks: HqStatBlock[]): HqStatBlock {
    const total = {} as HqStatBlock
    for (const key of STAT_KEYS) total[key] = ZERO
    for (const block of blocks) {
        for (const key of STAT_KEYS) {
            total[key] = total[key].add(block[key])
        }
    }
    return total
}
