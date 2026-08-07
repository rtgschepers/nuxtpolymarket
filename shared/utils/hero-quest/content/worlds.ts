/**
 * The 10 worlds a prestige run walks through.
 *
 * **Placeholders, and deliberately so.** World and enemy design is the last genuinely
 * greenfield pass in the project (`open-items.md` #6) and has not happened — no themes, no
 * art direction, no enemy rosters, no boss identities. Phase 1 is testing the *curve*, and
 * the curve does not read any of this: every stat comes from `settle.enemyStatsAt`, which
 * knows only the run index. Nothing here affects a single number.
 *
 * What is real and must survive the design pass: **World 10 is The Void.** Void Shards are
 * named after it (`economy-and-currencies.md` §3), so the world pass either keeps the name
 * or renames the prestige currency.
 *
 * The fixed pool never re-themes between prestiges (`core-progression-and-prestige.md` §5) —
 * difficulty is communicated entirely through the stat curve, which is what keeps art scope
 * flat no matter how many prestiges a player stacks up.
 */

import { STAGES_PER_WORLD, WORLD_COUNT } from '../constants'
import { stageArchetype } from '../settle'
import type { StageArchetype } from '../types'

export interface WorldDefinition {
    /** Stable string ID — save data references this, never the array index. */
    id: string
    /** 1-based, and equal to this entry's position in the play order. */
    index: number
    name: string
    /** Trash and elite mobs. Flavour only; stats come from the curve. */
    enemyName: string
    bossName: string
    superBossName: string
}

export const WORLDS: readonly WorldDefinition[] = [
    { id: 'world_01', index: 1, name: 'World 1', enemyName: 'Wanderer', bossName: 'Warden', superBossName: 'Gatekeeper' },
    { id: 'world_02', index: 2, name: 'World 2', enemyName: 'Prowler', bossName: 'Marauder', superBossName: 'Overseer' },
    { id: 'world_03', index: 3, name: 'World 3', enemyName: 'Husk', bossName: 'Ravager', superBossName: 'Harbinger' },
    { id: 'world_04', index: 4, name: 'World 4', enemyName: 'Stalker', bossName: 'Executioner', superBossName: 'Archon' },
    { id: 'world_05', index: 5, name: 'World 5', enemyName: 'Revenant', bossName: 'Tyrant', superBossName: 'Sovereign' },
    { id: 'world_06', index: 6, name: 'World 6', enemyName: 'Wraith', bossName: 'Devourer', superBossName: 'Colossus' },
    { id: 'world_07', index: 7, name: 'World 7', enemyName: 'Shade', bossName: 'Desolator', superBossName: 'Leviathan' },
    { id: 'world_08', index: 8, name: 'World 8', enemyName: 'Phantom', bossName: 'Anathema', superBossName: 'Behemoth' },
    { id: 'world_09', index: 9, name: 'World 9', enemyName: 'Umbra', bossName: 'Oblivion', superBossName: 'Eidolon' },
    { id: 'world_the_void', index: 10, name: 'The Void', enemyName: 'Void Spawn', bossName: 'Void Herald', superBossName: 'The Voidborn' }
]

export const WORLD_BY_INDEX: Readonly<Record<number, WorldDefinition>> = Object.fromEntries(
    WORLDS.map(world => [world.index, world])
)

export function getWorld(index: number): WorldDefinition {
    const world = WORLD_BY_INDEX[index]
    if (!world) throw new Error(`Unknown world index: ${index}`)
    return world
}

/**
 * Display name for whatever is being fought at a position — the archetype picks which of the
 * world's three names applies. Elites share the trash roster's name because they *are* the
 * trash roster, stat-buffed (`core-progression-and-prestige.md` §1); the client marks them
 * as elite rather than renaming them.
 */
export function enemyNameAt(world: number, stage: number): { name: string; archetype: StageArchetype } {
    const archetype = stageArchetype(stage)
    const definition = getWorld(world)
    switch (archetype) {
        case 'boss':
            return { name: definition.bossName, archetype }
        case 'super_boss':
            return { name: definition.superBossName, archetype }
        default:
            return { name: definition.enemyName, archetype }
    }
}

/** Position along the run as a 1-based stage count, for progress bars. `WORLD_COUNT × STAGES_PER_WORLD` at the end. */
export function runProgress(world: number, stage: number): { cleared: number; total: number } {
    return {
        cleared: (world - 1) * STAGES_PER_WORLD + (stage - 1),
        total: WORLD_COUNT * STAGES_PER_WORLD
    }
}
