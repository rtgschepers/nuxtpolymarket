import { describe, expect, it } from 'vitest'
import { CLASS_BY_ID, CLASS_IDS, CLASS_NODES, ROOT_CLASS_ID, childrenOf, classPath, isDescendantOf, kitFor } from '#shared/utils/hero-quest/content/classes'
import { baseSpreadFor } from '#shared/utils/hero-quest/stats'
import { MIN_STAT_VALUE } from '#shared/utils/hero-quest/constants'

describe('hero-quest class content', () => {
    it('has exactly 16 nodes', () => {
        expect(CLASS_NODES).toHaveLength(16)
    })

    it('has one root, 3 base, 6 elite and 6 master nodes', () => {
        const byTier = (tier: string) => CLASS_NODES.filter(node => node.tier === tier).length
        expect(byTier('beginner')).toBe(1)
        expect(byTier('base')).toBe(3)
        expect(byTier('elite')).toBe(6)
        expect(byTier('master')).toBe(6)
    })

    it('has exactly one parentless node, and it is the root', () => {
        const roots = CLASS_NODES.filter(node => node.parentId === null)
        expect(roots).toHaveLength(1)
        expect(roots[0]!.id).toBe(ROOT_CLASS_ID)
    })

    it('resolves every parentId', () => {
        for (const node of CLASS_NODES) {
            if (node.parentId !== null) {
                expect(CLASS_BY_ID[node.parentId], `${node.id} → ${node.parentId}`).toBeDefined()
            }
        }
    })

    it('has unique class and skill IDs', () => {
        expect(new Set(CLASS_IDS).size).toBe(CLASS_NODES.length)
        expect(new Set(CLASS_NODES.map(node => node.skill.id)).size).toBe(CLASS_NODES.length)
    })

    it('gives every node a firing skill', () => {
        for (const node of CLASS_NODES) {
            expect(node.skill.name.length, node.id).toBeGreaterThan(0)
            expect(node.skill.cooldownSeconds, node.id).toBeGreaterThan(0)
            expect(node.skill.abilityMultiplier, node.id).toBeGreaterThan(0)
        }
    })

    it('builds a cumulative kit — a specialization never replaces what it inherited', () => {
        // `classes-and-combat.md` §4: re-picking Berserker restores Whirlwind and
        // Threatening Roar alongside Enrage, not Enrage on its own.
        const kit = kitFor('class_berserker')
        expect(kit.map(entry => entry.id)).toEqual([
            'skill_haste',
            'skill_whirlwind',
            'skill_threatening_roar',
            'skill_enrage'
        ])

        for (const node of CLASS_NODES) {
            const own = kitFor(node.id)
            expect(own.length, node.id).toBe(classPath(node.id).length)
            expect(own.at(-1)!.id, node.id).toBe(node.skill.id)
            expect(new Set(own.map(entry => entry.id)).size, node.id).toBe(own.length)
        }
    })

    it('is acyclic — every node walks up to the root', () => {
        for (const node of CLASS_NODES) {
            const path = classPath(node.id)
            expect(path[0]!.id).toBe(ROOT_CLASS_ID)
            expect(path.at(-1)!.id).toBe(node.id)
            expect(new Set(path.map(entry => entry.id)).size).toBe(path.length)
        }
    })

    it('branches three ways at the root and two ways at each base class', () => {
        expect(childrenOf(ROOT_CLASS_ID)).toHaveLength(3)
        for (const base of CLASS_NODES.filter(node => node.tier === 'base')) {
            expect(childrenOf(base.id), base.id).toHaveLength(2)
        }
    })

    it('tracks ancestry without counting a node as its own descendant', () => {
        expect(isDescendantOf('class_berserker', 'class_warrior')).toBe(true)
        expect(isDescendantOf('class_berserker', 'class_mage')).toBe(false)
        expect(isDescendantOf('class_warrior', 'class_warrior')).toBe(false)
    })

    it('gives every node at least one strike per attack', () => {
        for (const node of CLASS_NODES) {
            expect(node.strikesPerAttack, node.id).toBeGreaterThanOrEqual(1)
        }
        expect(CLASS_BY_ID.class_hunter.strikesPerAttack).toBe(3)
        expect(CLASS_BY_ID.class_beast_master.strikesPerAttack).toBe(4)
    })

    it('keeps every derived stat at or above the floor', () => {
        for (const node of CLASS_NODES) {
            const block = baseSpreadFor(node)
            for (const [key, value] of Object.entries(block)) {
                expect(value, `${node.id}.${key}`).toBeGreaterThanOrEqual(MIN_STAT_VALUE)
            }
        }
    })

    it('accumulates specialization deltas down the path', () => {
        // Berserker carries Warrior's spread plus Barbarian's and its own PWR shifts.
        const warrior = baseSpreadFor(CLASS_BY_ID.class_warrior)
        const barbarian = baseSpreadFor(CLASS_BY_ID.class_barbarian)
        const berserker = baseSpreadFor(CLASS_BY_ID.class_berserker)
        expect(barbarian.pwr).toBeGreaterThan(warrior.pwr)
        expect(berserker.pwr).toBeGreaterThan(barbarian.pwr)
        expect(barbarian.def).toBeLessThan(warrior.def)
        expect(berserker.def).toBe(barbarian.def)
    })

    it('makes the Sorcerer the most fragile node in the tree', () => {
        const sorcerer = baseSpreadFor(CLASS_BY_ID.class_sorcerer)
        for (const node of CLASS_NODES) {
            if (node.id === 'class_sorcerer') continue
            const block = baseSpreadFor(node)
            expect(sorcerer.def + sorcerer.vit, node.id).toBeLessThanOrEqual(block.def + block.vit)
        }
    })

    it('gives the Archer path the crit lead its flavor text claims', () => {
        const archer = baseSpreadFor(CLASS_BY_ID.class_archer)
        expect(archer.lck).toBeGreaterThan(baseSpreadFor(CLASS_BY_ID.class_warrior).lck)
        expect(archer.lck).toBeGreaterThan(baseSpreadFor(CLASS_BY_ID.class_mage).lck)
    })
})
