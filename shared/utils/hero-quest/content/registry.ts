/**
 * One lookup table over the four gachas' content modules.
 *
 * ## Why this exists
 *
 * `gacha.ts` is already written once and parameterised by `system` — one rarity ladder, one
 * levelling curve, one drop table, one dupe formula (`docs/games/hero-quest/CLAUDE.md` §3). What it
 * could not be parameterised over was **content**: rolling a pull still needed to know that
 * `'champion'` means `championFromRoll` and `'gear'` means `gearFromRoll`. Phase 2 hard-coded
 * that in the Guild routes, which was fine while there was one gacha and would have meant four
 * near-identical copies of every route the moment there were four.
 *
 * This closes the gap. With it, `gacha/pull.post.ts`, `gacha/craft.post.ts` and
 * `gacha/buy-seals.post.ts` are each one file taking `system` in the body, exactly as
 * `tech-architecture.md` §5 specifies them.
 *
 * ## What it deliberately does not hold
 *
 * Anything system-*specific*. A Champion has an archetype and a kit; a Gear piece has a slot and
 * a stat; an Artifact has a category and effect lines. None of that belongs to a common
 * interface, and flattening it into one would either lose information or grow a union that every
 * caller has to narrow anyway. The serializers reach into the content modules directly for that.
 * What lives here is only what a *pull* needs: identity, rarity, and how to resolve a roll.
 *
 * Pure, like everything in `shared/`. Nothing here knows a database column exists — the server's
 * `GACHA_COLUMNS` maps `system` onto the Seal and Essence columns separately, because those are
 * Drizzle references and would drag `#server` into a browser bundle.
 */

import type { GachaSystem } from '../gacha'
import type { Rarity } from '../types'
import { CHAMPIONS, championDisplayName, championFromRoll, championRarityHasContent, isChampionId } from './champions'
import { GEAR, gearFromRoll, gearRarityHasContent, getGear, isGearId } from './gear'
import { SKILLS, getSkill, isSkillId, skillFromRoll, skillRarityHasContent } from './skills'
import { ARTIFACTS, artifactFromRoll, artifactRarityHasContent, getArtifact, isArtifactId } from './artifacts'

/** The least a pull needs to know about the thing it just produced. */
export interface GachaEntry {
    id: string
    name: string
    rarity: Rarity
}

export interface GachaContent {
    system: GachaSystem
    /** The in-game name of the venue — "The Forge", not "Gear". */
    label: string
    /** Everything in the roster, for a collection grid that shows locked entries too. */
    entries: readonly GachaEntry[]
    isId: (id: string) => boolean
    get: (id: string) => GachaEntry
    /** Resolve a rolled rarity to an item. `roll` is the caller's entropy — `shared/` stays pure. */
    fromRoll: (rarity: Rarity, roll: number) => GachaEntry
    /**
     * Whether this roster populates a rarity.
     *
     * All four return true for all six today, which is what made the rarity-folding scaffolding
     * deletable. Kept as a predicate rather than removed because `content.spec.ts` asserts it —
     * "no fold is needed" should be a tested claim, not a comment that rots.
     */
    hasContent: (rarity: Rarity) => boolean
}

export const GACHA_CONTENT: Readonly<Record<GachaSystem, GachaContent>> = {
    gear: {
        system: 'gear',
        label: 'The Forge',
        entries: GEAR.map(entry => ({ id: entry.id, name: entry.name, rarity: entry.rarity })),
        isId: isGearId,
        get: (id) => {
            const entry = getGear(id)
            return { id: entry.id, name: entry.name, rarity: entry.rarity }
        },
        fromRoll: (rarity, roll) => {
            const entry = gearFromRoll(rarity, roll)
            return { id: entry.id, name: entry.name, rarity: entry.rarity }
        },
        hasContent: gearRarityHasContent
    },
    champion: {
        system: 'champion',
        label: 'The Guild',
        entries: CHAMPIONS.map(entry => ({
            id: entry.id, name: championDisplayName(entry), rarity: entry.rarity
        })),
        isId: isChampionId,
        get: (id) => {
            const entry = CHAMPIONS.find(candidate => candidate.id === id)
            if (!entry) throw new Error(`Unknown champion id: ${id}`)
            return { id: entry.id, name: championDisplayName(entry), rarity: entry.rarity }
        },
        fromRoll: (rarity, roll) => {
            const entry = championFromRoll(rarity, roll)
            return { id: entry.id, name: championDisplayName(entry), rarity: entry.rarity }
        },
        hasContent: championRarityHasContent
    },
    skill: {
        system: 'skill',
        label: 'The Training Grounds',
        entries: SKILLS.map(entry => ({ id: entry.id, name: entry.name, rarity: entry.rarity })),
        isId: isSkillId,
        get: (id) => {
            const entry = getSkill(id)
            return { id: entry.id, name: entry.name, rarity: entry.rarity }
        },
        fromRoll: (rarity, roll) => {
            const entry = skillFromRoll(rarity, roll)
            return { id: entry.id, name: entry.name, rarity: entry.rarity }
        },
        hasContent: skillRarityHasContent
    },
    artifact: {
        system: 'artifact',
        label: 'The Dig-site',
        entries: ARTIFACTS.map(entry => ({ id: entry.id, name: entry.name, rarity: entry.rarity })),
        isId: isArtifactId,
        get: (id) => {
            const entry = getArtifact(id)
            return { id: entry.id, name: entry.name, rarity: entry.rarity }
        },
        fromRoll: (rarity, roll) => {
            const entry = artifactFromRoll(rarity, roll)
            return { id: entry.id, name: entry.name, rarity: entry.rarity }
        },
        hasContent: artifactRarityHasContent
    }
}

export function gachaContent(system: GachaSystem): GachaContent {
    return GACHA_CONTENT[system]
}
