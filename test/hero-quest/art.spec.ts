import { describe, expect, it } from 'vitest'
import { allArt } from '../../app/utils/hero-quest-art/catalog'
import { PALETTE } from '../../app/utils/hero-quest-art/palette'
import { Surface } from '../../app/utils/hero-quest-art/surface'
import { HERO_ART, HERO_STATES } from '../../app/utils/hero-quest-art/heroes'
import { hasChampionSkin } from '../../app/utils/hero-quest-art/champions'
import { VFX_BY_ID } from '../../app/utils/hero-quest-art/vfx'
import { CLASS_NODES } from '#shared/utils/hero-quest/content/classes'
import { CHAMPIONS, CHAMPION_ABILITY_POOL, abilityId } from '#shared/utils/hero-quest/content/champions'
import { SKILLS } from '#shared/utils/hero-quest/content/skills'
import { ARTIFACTS } from '#shared/utils/hero-quest/content/artifacts'
import { GEAR } from '#shared/utils/hero-quest/content/gear'
import { WORLDS } from '#shared/utils/hero-quest/content/worlds'

// The art is procedural and keyed by content ID, so "is there art for X" is a property of the
// code. These pin it: a new class, Champion, skill or world without art fails here, and the
// counts are the ones asset-list.md locks.

const ids = new Set(allArt().map(a => a.id))
const count = (prefix: string) => allArt().filter(a => a.id.startsWith(prefix)).length

describe('Hero Quest art coverage', () => {
    it('gives every class node all five Hero states — 80 spritesheets', () => {
        for (const node of CLASS_NODES) {
            expect(HERO_ART[node.id], node.id).toBeDefined()
            for (const st of HERO_STATES) expect(ids.has(`hero/${node.id}/${st}`), `${node.id} ${st}`).toBe(true)
        }
        expect(count('hero/')).toBe(80)
    })

    it('has 4 Champion chassis × 5 states and a skin for all 48 Champions', () => {
        expect(count('champion/chassis_')).toBe(20)
        for (const c of CHAMPIONS) expect(hasChampionSkin(c.id), c.id).toBe(true)
        expect(CHAMPIONS).toHaveLength(48)
    })

    it('has 3 summons × Move/Attack', () => {
        expect(count('summon/')).toBe(6)
    })

    it('dresses all 4 weapon rigs in every world, with the elite mark, a boss and a super boss', () => {
        for (const w of WORLDS) {
            for (const rig of ['sword', 'axe', 'bow', 'staff']) {
                for (const st of ['idle', 'attack', 'hit', 'death']) expect(ids.has(`enemy/${w.id}/${rig}/${st}`), `${w.id} ${rig} ${st}`).toBe(true)
            }
            expect(ids.has(`enemy/${w.id}/elite/idle`)).toBe(true)
            for (const st of ['idle', 'attack', 'hit', 'death', 'entry']) {
                expect(ids.has(`boss/${w.id}/${st}`), `boss ${w.id} ${st}`).toBe(true)
                expect(ids.has(`superboss/${w.id}/${st}`), `super ${w.id} ${st}`).toBe(true)
            }
            expect(ids.has(`bg/world/${w.id}`), `background ${w.id}`).toBe(true)
        }
        expect(count('boss/') + count('superboss/')).toBe(100)
    })

    it('has a custom VFX for all 62 abilities — 16 Hero, 28 Champion, 18 Training Grounds actives', () => {
        for (const node of CLASS_NODES) expect(VFX_BY_ID[node.skill.id], node.skill.id).toBeDefined()
        for (const names of Object.values(CHAMPION_ABILITY_POOL)) for (const n of names) expect(VFX_BY_ID[abilityId(n)], n).toBeDefined()
        for (const s of SKILLS.filter(s => s.type === 'active')) expect(VFX_BY_ID[s.id], s.id).toBeDefined()
        expect(Object.keys(VFX_BY_ID)).toHaveLength(62)
    })

    it('has all 217 static icons from asset-list §3', () => {
        for (const node of CLASS_NODES) {
            expect(ids.has(`icon/skill/${node.skill.id}`), node.skill.id).toBe(true)
            expect(ids.has(`icon/class/${node.id}`), node.id).toBe(true)
        }
        for (const s of SKILLS) expect(ids.has(`icon/skill/${s.id}`), s.id).toBe(true)
        for (const names of Object.values(CHAMPION_ABILITY_POOL)) for (const n of names) expect(ids.has(`icon/ability/${abilityId(n)}`), n).toBe(true)
        for (const a of ARTIFACTS) expect(ids.has(`icon/artifact/${a.id}`), a.id).toBe(true)
        for (const g of GEAR) expect(ids.has(`icon/gear/${g.id}`), g.id).toBe(true)
        const icons = count('icon/skill/') + count('icon/ability/') + count('icon/artifact/') + count('icon/gear/') + count('icon/currency/')
            + count('frame/rarity/') + count('frame/trait/') + count('badge/archetype/') + count('icon/class/')
        expect(icons).toBe(217)
    })

    it('renders every asset to something, on the palette only', () => {
        for (const a of allArt()) {
            const s = new Surface(a.w, a.h, 0, 0)
            let drew = false
            for (const f of new Set([0, a.frames >> 1, a.frames - 1])) {
                s.clear()
                a.render(s, f)
                if (!s.isEmpty()) drew = true
                for (let i = 0; i < s.data.length; i++) if (s.data[i]! >= PALETTE.length) throw new Error(`${a.id} frame ${f} has an off-palette index`)
            }
            // a death's last frame is legitimately empty; some frame of every asset is not
            expect(drew, a.id).toBe(true)
        }
    })

    it('uses unique, path-shaped ids', () => {
        const all = allArt().map(a => a.id)
        expect(new Set(all).size).toBe(all.length)
        for (const id of all) expect(id).toMatch(/^[a-z0-9_]+(\/[a-z0-9_]+)+$/)
    })
})
