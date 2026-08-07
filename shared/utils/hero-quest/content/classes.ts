/**
 * The 16-node class tree (`classes-and-combat.md` §1) with its stat spreads and
 * specialization deltas (§2).
 *
 * Spreads are the doc's own tier words; the numbers they resolve to live in
 * `STAT_TIER_VALUES`. Deltas are the doc's directional table, with its "modest" /
 * "extreme" qualifiers mapped onto the three DELTA_* magnitude constants. Both accumulate
 * down the path, so Berserker carries Warrior's and Barbarian's shifts.
 *
 * Skills carry a cooldown and a damage multiplier, both from the shared placeholder pair —
 * see `SKILL_BASE_COOLDOWN_SECONDS`. Nothing here is per-skill-tuned yet, and the several
 * distinctive behaviours §7 sketches (chaining, multi-target, summons, the Haste SPD
 * double, Enrage's HP trade) have no numeric model in any doc and are not implemented.
 */

import {
    DELTA_EXTREME,
    DELTA_MODEST,
    DELTA_NORMAL,
    SKILL_BASE_ABILITY_MULTIPLIER,
    SKILL_BASE_COOLDOWN_SECONDS
} from '../constants'
import type { ClassId, ClassNode, ClassSkill } from '../types'

export const ROOT_CLASS_ID: ClassId = 'class_beginner'

/** Every skill on the shared placeholder pair. Differentiating them is a later content edit. */
function skill(id: string, name: string): ClassSkill {
    return {
        id,
        name,
        cooldownSeconds: SKILL_BASE_COOLDOWN_SECONDS,
        abilityMultiplier: SKILL_BASE_ABILITY_MULTIPLIER
    }
}

export const CLASS_NODES: readonly ClassNode[] = [
    {
        id: 'class_beginner',
        name: 'Beginner',
        parentId: null,
        tier: 'beginner',
        skill: skill('skill_haste', 'Haste'),
        spread: { pwr: 'mid', spd: 'mid', lck: 'mid', imp: 'mid', vit: 'mid', def: 'mid' },
        delta: {},
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },

    // ── Warrior path ───────────────────────────────────────────────────────────────────
    {
        id: 'class_warrior',
        name: 'Warrior',
        parentId: 'class_beginner',
        tier: 'base',
        skill: skill('skill_whirlwind', 'Whirlwind'),
        spread: { pwr: 'high', spd: 'low', lck: 'low', imp: 'mid', vit: 'high', def: 'high' },
        delta: {},
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },
    {
        id: 'class_barbarian',
        name: 'Barbarian',
        parentId: 'class_warrior',
        tier: 'elite',
        skill: skill('skill_threatening_roar', 'Threatening Roar'),
        spread: { pwr: 'high', spd: 'low', lck: 'low', imp: 'mid', vit: 'high', def: 'high' },
        // doubling down on Warrior's damage focus
        delta: { pwr: DELTA_NORMAL, def: -DELTA_NORMAL, vit: -DELTA_NORMAL },
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },
    {
        id: 'class_berserker',
        name: 'Berserker',
        parentId: 'class_barbarian',
        tier: 'master',
        skill: skill('skill_enrage', 'Enrage'),
        spread: { pwr: 'high', spd: 'low', lck: 'low', imp: 'mid', vit: 'high', def: 'high' },
        // Enrage trades max HP and incoming damage as a skill-level cost, not a base-stat one
        delta: { pwr: DELTA_EXTREME },
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },
    {
        id: 'class_knight',
        name: 'Knight',
        parentId: 'class_warrior',
        tier: 'elite',
        skill: skill('skill_shockwave', 'Shockwave'),
        spread: { pwr: 'high', spd: 'low', lck: 'low', imp: 'mid', vit: 'high', def: 'high' },
        // near-opposite of Barbarian
        delta: { def: DELTA_NORMAL, vit: DELTA_NORMAL, pwr: -DELTA_NORMAL },
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },
    {
        id: 'class_paladin',
        name: 'Paladin',
        parentId: 'class_knight',
        tier: 'master',
        skill: skill('skill_disciple', 'Disciple'),
        spread: { pwr: 'high', spd: 'low', lck: 'low', imp: 'mid', vit: 'high', def: 'high' },
        // "raw damage output not enhanced very much" — utility-weighted via its summon
        delta: { pwr: DELTA_MODEST },
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },

    // ── Mage path ──────────────────────────────────────────────────────────────────────
    {
        id: 'class_mage',
        name: 'Mage',
        parentId: 'class_beginner',
        tier: 'base',
        skill: skill('skill_ethereal_bouncebolt', 'Ethereal Bouncebolt'),
        spread: { pwr: 'high', spd: 'high', lck: 'mid', imp: 'mid', vit: 'low', def: 'low' },
        delta: {},
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },
    {
        id: 'class_wizard',
        name: 'Wizard',
        parentId: 'class_mage',
        tier: 'elite',
        skill: skill('skill_lightning_storm', 'Lightning Storm'),
        spread: { pwr: 'high', spd: 'high', lck: 'mid', imp: 'mid', vit: 'low', def: 'low' },
        // "standard attack rate accelerated"
        delta: { pwr: DELTA_NORMAL, spd: DELTA_NORMAL },
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },
    {
        id: 'class_sorcerer',
        name: 'Sorcerer',
        parentId: 'class_wizard',
        tier: 'master',
        skill: skill('skill_meteor_shower', 'Meteor Shower'),
        spread: { pwr: 'high', spd: 'high', lck: 'mid', imp: 'mid', vit: 'low', def: 'low' },
        // most fragile class in the tree, by design — clamps to MIN_STAT_VALUE on VIT/DEF
        delta: { pwr: DELTA_EXTREME, vit: -DELTA_NORMAL, def: -DELTA_NORMAL },
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },
    {
        id: 'class_shaman',
        name: 'Shaman',
        parentId: 'class_mage',
        tier: 'elite',
        skill: skill('skill_totem_storm', 'Totem Storm'),
        spread: { pwr: 'high', spd: 'high', lck: 'mid', imp: 'mid', vit: 'low', def: 'low' },
        // "tougher... slightly more defensive" than Wizard
        delta: { vit: DELTA_NORMAL, def: DELTA_NORMAL },
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },
    {
        id: 'class_witch_doctor',
        name: 'Witch Doctor',
        parentId: 'class_shaman',
        tier: 'master',
        skill: skill('skill_raise_dead', 'Raise Dead'),
        spread: { pwr: 'high', spd: 'high', lck: 'mid', imp: 'mid', vit: 'low', def: 'low' },
        // inherits Shaman's spread, utility-weighted via Raise Dead
        delta: {},
        strikesPerAttack: 1,
        autoTarget: 'lowest_hp_pct'
    },

    // ── Archer path ────────────────────────────────────────────────────────────────────
    {
        id: 'class_archer',
        name: 'Archer',
        parentId: 'class_beginner',
        tier: 'base',
        skill: skill('skill_piercing_arrow', 'Piercing Arrow'),
        spread: { pwr: 'high', spd: 'mid_high', lck: 'high', imp: 'mid', vit: 'mid', def: 'mid' },
        delta: {},
        strikesPerAttack: 1,
        autoTarget: 'highest_pwr'
    },
    {
        id: 'class_bowman',
        name: 'Bowman',
        parentId: 'class_archer',
        tier: 'elite',
        skill: skill('skill_fan_of_arrows', 'Fan of Arrows'),
        spread: { pwr: 'high', spd: 'mid_high', lck: 'high', imp: 'mid', vit: 'mid', def: 'mid' },
        // multi-attack focus
        delta: { spd: DELTA_NORMAL },
        strikesPerAttack: 1,
        autoTarget: 'highest_pwr'
    },
    {
        id: 'class_marksman',
        name: 'Marksman',
        parentId: 'class_bowman',
        tier: 'master',
        skill: skill('skill_arrow_rain', 'Arrow Rain'),
        spread: { pwr: 'high', spd: 'mid_high', lck: 'high', imp: 'mid', vit: 'mid', def: 'mid' },
        delta: { spd: DELTA_NORMAL },
        strikesPerAttack: 1,
        autoTarget: 'highest_pwr'
    },
    {
        id: 'class_hunter',
        name: 'Hunter',
        parentId: 'class_archer',
        tier: 'elite',
        skill: skill('skill_kill_shot', 'Kill Shot'),
        spread: { pwr: 'high', spd: 'mid_high', lck: 'high', imp: 'mid', vit: 'mid', def: 'mid' },
        // single-target crit focus, reinforced by Kill Shot
        delta: { pwr: DELTA_NORMAL, lck: DELTA_NORMAL },
        strikesPerAttack: 3,
        autoTarget: 'highest_pwr'
    },
    {
        id: 'class_beast_master',
        name: 'Beast Master',
        parentId: 'class_hunter',
        tier: 'master',
        skill: skill('skill_mans_best_friend', "Man's Best Friend"),
        spread: { pwr: 'high', spd: 'mid_high', lck: 'high', imp: 'mid', vit: 'mid', def: 'mid' },
        // inherits Hunter's spread, utility-weighted via its wolf summon
        delta: {},
        strikesPerAttack: 4,
        autoTarget: 'highest_pwr'
    }
]

export const CLASS_BY_ID: Readonly<Record<ClassId, ClassNode>> = Object.fromEntries(
    CLASS_NODES.map(node => [node.id, node])
) as Record<ClassId, ClassNode>

export const CLASS_IDS: readonly ClassId[] = CLASS_NODES.map(node => node.id)

export function getClass(id: ClassId): ClassNode {
    const node = CLASS_BY_ID[id]
    if (!node) throw new Error(`Unknown class id: ${id}`)
    return node
}

/** Root → node, inclusive. The order specialization deltas accumulate in. */
export function classPath(id: ClassId): ClassNode[] {
    const path: ClassNode[] = []
    let current: ClassNode | undefined = getClass(id)
    while (current) {
        path.unshift(current)
        current = current.parentId ? getClass(current.parentId) : undefined
    }
    return path
}

export function childrenOf(id: ClassId | null): ClassNode[] {
    return CLASS_NODES.filter(node => node.parentId === id)
}

export function isDescendantOf(id: ClassId, ancestor: ClassId): boolean {
    return classPath(id).some(node => node.id === ancestor) && id !== ancestor
}

/**
 * Every skill a node owns — its own plus every ancestor's, root first.
 *
 * Kits are cumulative and never replaced (`classes-and-combat.md` §4), which is also why
 * re-picking a deep node at a later prestige restores the whole chain rather than just that
 * node's skill: a Berserker owns Haste, Whirlwind, Threatening Roar and Enrage together.
 */
export function kitFor(id: ClassId): ClassSkill[] {
    return classPath(id).map(node => node.skill)
}
