/**
 * The 16-node class tree (`classes-and-combat.md` §1) with its stat spreads and
 * specialization deltas (§2).
 *
 * Spreads are the doc's own tier words; the numbers they resolve to live in
 * `STAT_TIER_VALUES`. Deltas are the doc's directional table, with its "modest" /
 * "extreme" qualifiers mapped onto the three DELTA_* magnitude constants. Both accumulate
 * down the path, so Berserker carries Warrior's and Barbarian's shifts.
 *
 * Skill IDs are declared but carry no effect data — ability multipliers and cooldowns are
 * `classes-and-combat.md` §3's model and are out of Phase 0 scope.
 */

import { DELTA_EXTREME, DELTA_MODEST, DELTA_NORMAL } from '../constants'
import type { ClassId, ClassNode } from '../types'

export const ROOT_CLASS_ID: ClassId = 'class_beginner'

export const CLASS_NODES: readonly ClassNode[] = [
    {
        id: 'class_beginner',
        name: 'Beginner',
        parentId: null,
        tier: 'beginner',
        skillId: 'skill_haste',
        skillName: 'Haste',
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
        skillId: 'skill_whirlwind',
        skillName: 'Whirlwind',
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
        skillId: 'skill_threatening_roar',
        skillName: 'Threatening Roar',
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
        skillId: 'skill_enrage',
        skillName: 'Enrage',
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
        skillId: 'skill_shockwave',
        skillName: 'Shockwave',
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
        skillId: 'skill_disciple',
        skillName: 'Disciple',
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
        skillId: 'skill_ethereal_bouncebolt',
        skillName: 'Ethereal Bouncebolt',
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
        skillId: 'skill_lightning_storm',
        skillName: 'Lightning Storm',
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
        skillId: 'skill_meteor_shower',
        skillName: 'Meteor Shower',
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
        skillId: 'skill_totem_storm',
        skillName: 'Totem Storm',
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
        skillId: 'skill_raise_dead',
        skillName: 'Raise Dead',
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
        skillId: 'skill_piercing_arrow',
        skillName: 'Piercing Arrow',
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
        skillId: 'skill_fan_of_arrows',
        skillName: 'Fan of Arrows',
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
        skillId: 'skill_arrow_rain',
        skillName: 'Arrow Rain',
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
        skillId: 'skill_kill_shot',
        skillName: 'Kill Shot',
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
        skillId: 'skill_mans_best_friend',
        skillName: "Man's Best Friend",
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
