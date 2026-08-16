import { describe, expect, it } from 'vitest'
import { CLASS_BY_ID, CLASS_IDS, CLASS_NODES, ROOT_CLASS_ID, childrenOf, classPath, isDescendantOf, kitFor } from '#shared/utils/hero-quest/content/classes'
import { baseSpreadFor } from '#shared/utils/hero-quest/stats'
import { MIN_STAT_VALUE } from '#shared/utils/hero-quest/constants'
import {
    ARCHETYPES,
    CHAMPIONS,
    CHAMPION_ABILITY_POOL,
    CHAMPION_BY_ID,
    RARITIES,
    RARITY_ABILITY_COUNT,
    RARITY_STAT_MULTIPLIER,
    championDisplayName,
    championFromRoll,
    championRarityHasContent,
    getArchetype,
    getChampion
} from '#shared/utils/hero-quest/content/champions'
import type { Rarity } from '#shared/utils/hero-quest/types'

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

    it('gives every node a skill that fires and does something', () => {
        for (const node of CLASS_NODES) {
            expect(node.skill.name.length, node.id).toBeGreaterThan(0)
            expect(node.skill.cooldownSeconds, node.id).toBeGreaterThan(0)

            // Damage is no longer the only way to matter: Haste, Enrage, Totem Storm, Raise
            // Dead, Disciple and Man's Best Friend are pure utility and deal none by design.
            // What every skill must have is *some* payload — a skill with neither damage nor
            // an effect is a cooldown that does nothing, which is the real bug this catches.
            const effect = node.skill.effect
            const doesSomething = node.skill.abilityMultiplier > 0
                || Boolean(effect?.status || effect?.selfStatus || effect?.heal || effect?.shield)
            expect(doesSomething, node.id).toBe(true)
        }
    })

    it('points every ability at a target pattern', () => {
        for (const node of CLASS_NODES) {
            expect(node.skill.effect?.target ?? 'enemy_single', node.id).toBeTruthy()
        }
    })

    it('keeps utility abilities damage-free and damage abilities armed', () => {
        // The two halves of the roster, asserted explicitly so a later edit that quietly gives
        // Haste a damage multiplier — or strips Whirlwind's — shows up here.
        const utility = ['skill_haste', 'skill_enrage', 'skill_totem_storm', 'skill_raise_dead',
            'skill_disciple', 'skill_mans_best_friend', 'skill_threatening_roar']
        for (const node of CLASS_NODES) {
            const isUtility = utility.includes(node.skill.id)
            expect(node.skill.abilityMultiplier === 0, node.skill.id).toBe(isUtility)
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
                expect(value.gte(MIN_STAT_VALUE), `${node.id}.${key}`).toBe(true)
            }
        }
    })

    it('accumulates specialization deltas down the path', () => {
        // Berserker carries Warrior's spread plus Barbarian's and its own PWR shifts.
        const warrior = baseSpreadFor(CLASS_BY_ID.class_warrior)
        const barbarian = baseSpreadFor(CLASS_BY_ID.class_barbarian)
        const berserker = baseSpreadFor(CLASS_BY_ID.class_berserker)
        expect(barbarian.pwr.gt(warrior.pwr)).toBe(true)
        expect(berserker.pwr.gt(barbarian.pwr)).toBe(true)
        expect(barbarian.def.lt(warrior.def)).toBe(true)
        expect(berserker.def.eq(barbarian.def)).toBe(true)
    })

    it('makes the Sorcerer the most fragile node in the tree', () => {
        const sorcerer = baseSpreadFor(CLASS_BY_ID.class_sorcerer)
        for (const node of CLASS_NODES) {
            if (node.id === 'class_sorcerer') continue
            const block = baseSpreadFor(node)
            const bulk = (spread: typeof block) => spread.def.add(spread.vit)
            expect(bulk(sorcerer).lte(bulk(block)), node.id).toBe(true)
        }
    })

    it('gives the Archer path the crit lead its flavor text claims', () => {
        const archer = baseSpreadFor(CLASS_BY_ID.class_archer)
        expect(archer.lck.gt(baseSpreadFor(CLASS_BY_ID.class_warrior).lck)).toBe(true)
        expect(archer.lck.gt(baseSpreadFor(CLASS_BY_ID.class_mage).lck)).toBe(true)
    })
})

/**
 * Champion roster invariants (`champions-guild-gacha.md`).
 *
 * Structural rules only — the kind that break silently when someone adds a Champion and
 * forgets a field. Every one of these is a rule the doc states, not a preference.
 */
describe('champion roster', () => {
    it('carries two Champions per archetype per rarity — forty-eight in all', () => {
        // The complete roster (§1). Phase 2 shipped twelve of these — Common/Rare/Mythic, one
        // per archetype — and the rest landed with the roster fill.
        for (const rarity of RARITIES) {
            for (const archetype of ARCHETYPES) {
                const matching = CHAMPIONS.filter(c => c.rarity === rarity && c.archetype === archetype)
                expect(matching, `${rarity}/${archetype}`).toHaveLength(2)
            }
        }
        expect(CHAMPIONS).toHaveLength(48)
    })

    it('populates every rarity, which is what makes the rarity fold unnecessary', () => {
        // `foldToAvailableRarity` existed because a partial roster left better than half of all
        // high-level rolls naming a rarity with nothing in it. The Champion gacha stopped
        // calling it when this became true, so this is the assertion holding that up.
        for (const rarity of RARITIES) {
            expect(championRarityHasContent(rarity), rarity).toBe(true)
        }
        for (const rarity of RARITIES) {
            expect(championFromRoll(rarity, 0).rarity, rarity).toBe(rarity)
        }
    })

    it('keeps the twelve Phase 2 Champions at their original id and rarity', () => {
        // Collection rows reference `contentId`, so changing either would orphan a save.
        const shipped: readonly (readonly [string, string])[] = [
            ['champ_rask', 'common'], ['champ_dorne', 'rare'], ['champ_kaira', 'mythic'],
            ['champ_borin', 'common'], ['champ_ulrid', 'rare'], ['champ_thoraxx', 'mythic'],
            ['champ_meret', 'common'], ['champ_calen', 'rare'], ['champ_seraphel', 'mythic'],
            ['champ_ilyx', 'common'], ['champ_varn', 'rare'], ['champ_zeraphine', 'mythic']
        ]
        for (const [id, rarity] of shipped) {
            expect(CHAMPION_BY_ID[id], id).toBeDefined()
            expect(CHAMPION_BY_ID[id]!.rarity, id).toBe(rarity)
        }
    })

    it('never gives two Champions of the same archetype and rarity the same kit', () => {
        // Variety *within* a rarity — the half of the goal the reuse cap alone does not cover.
        for (const rarity of RARITIES) {
            for (const archetype of ARCHETYPES) {
                const pair = CHAMPIONS.filter(c => c.rarity === rarity && c.archetype === archetype)
                const kits = pair.map(c => c.abilities.map(a => a.name).sort().join('|'))
                expect(new Set(kits).size, `${rarity}/${archetype}`).toBe(pair.length)
            }
        }
    })

    it('reuses every low-rarity ability at high rarity, so nothing feels missable', () => {
        // The other half: a Common's one ability must also appear on something Epic or above,
        // or pulling up the ladder would read as losing access to it.
        const high: Rarity[] = ['epic', 'legendary', 'mythic']
        for (const archetype of ARCHETYPES) {
            const inHighTiers = new Set(
                CHAMPIONS
                    .filter(c => c.archetype === archetype && high.includes(c.rarity))
                    .flatMap(c => c.abilities.map(a => a.name))
            )
            const inLowTiers = CHAMPIONS
                .filter(c => c.archetype === archetype && !high.includes(c.rarity))
                .flatMap(c => c.abilities.map(a => a.name))

            for (const name of inLowTiers) {
                expect(inHighTiers.has(name), `${archetype}/${name}`).toBe(true)
            }
        }
    })

    it('gives every Champion the ability count its rarity dictates', () => {
        for (const entry of CHAMPIONS) {
            expect(entry.abilities, entry.id).toHaveLength(RARITY_ABILITY_COUNT[entry.rarity])
        }
    })

    it('draws every ability from its own archetype’s pool', () => {
        for (const entry of CHAMPIONS) {
            const pool = CHAMPION_ABILITY_POOL[entry.archetype]
            for (const skill of entry.abilities) {
                expect(pool, `${entry.id}/${skill.name}`).toContain(skill.name)
            }
        }
    })

    it('never reuses an ability more than three times within an archetype', () => {
        // The rule that sized the starting pool at 7 per archetype (§6).
        for (const archetype of ARCHETYPES) {
            const counts = new Map<string, number>()
            for (const entry of CHAMPIONS.filter(c => c.archetype === archetype)) {
                for (const skill of entry.abilities) {
                    counts.set(skill.name, (counts.get(skill.name) ?? 0) + 1)
                }
            }
            for (const [name, count] of counts) {
                expect(count, `${archetype}/${name}`).toBeLessThanOrEqual(3)
            }
        }
    })

    it('never repeats an ability within a single Champion’s own kit', () => {
        for (const entry of CHAMPIONS) {
            const names = entry.abilities.map(skill => skill.name)
            expect(new Set(names).size, entry.id).toBe(names.length)
        }
    })

    it('keeps every id and given name unique', () => {
        expect(new Set(CHAMPIONS.map(c => c.id)).size).toBe(CHAMPIONS.length)
        expect(new Set(CHAMPIONS.map(c => c.givenName)).size).toBe(CHAMPIONS.length)
    })

    it('titles every Champion from its own archetype’s title pool', () => {
        for (const entry of CHAMPIONS) {
            expect(getArchetype(entry.archetype).titles, entry.id).toContain(entry.title)
        }
    })

    it('assembles display names on the §5 template', () => {
        const kaira = getChampion('champ_kaira')
        expect(championDisplayName(kaira)).toBe('Kaira, the Ascendant Reaver')
    })

    it('covers each of the Hero’s six stats exactly once across the four passives', () => {
        const covered = ARCHETYPES.flatMap(id => getArchetype(id).passiveStats)
        expect(covered.slice().sort()).toEqual(['def', 'imp', 'lck', 'pwr', 'spd', 'vit'])
    })

    it('rises monotonically in stat multiplier with rarity', () => {
        const multipliers = RARITIES.map(rarity => RARITY_STAT_MULTIPLIER[rarity])
        for (let index = 1; index < multipliers.length; index++) {
            expect(multipliers[index]!).toBeGreaterThan(multipliers[index - 1]!)
        }
    })
})
