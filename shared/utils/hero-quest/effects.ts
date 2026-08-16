/**
 * Ability effects: what an ability actually *does*, and to whom.
 *
 * Until now every ability in the game — 16 class skills and 28 Champion abilities — resolved
 * as single-target damage on one shared placeholder cooldown and multiplier. The firing
 * framework existed (`open-items.md` #12); the effects did not. This module is the vocabulary
 * they are written in.
 *
 * ## Targeting is per-ability, and that is doc-mandated
 *
 * `champions-guild-gacha.md` §8.3 is explicit: the autoattack targeting table "only governs
 * the plain autoattack — any ability whose design calls for something else (AoE, party-wide,
 * chain, ally-targeted) overrides it whenever that ability fires", and that this "will apply
 * often, not as a rare exception". So an ability carries its own target pattern rather than
 * inheriting the caster's.
 *
 * ## A note on the vocabulary
 *
 * The Archer path's abilities are specified in terms of the enemy formation — "hits all
 * enemies in a row", "all enemies in the front column", "all enemies in each spot". Those
 * words describe the shape from the *player's* side of the board, where a "row" runs away from
 * you (so piercing) and a "column" runs across. The code deliberately uses unambiguous names
 * instead — `enemy_pierce`, `enemy_front_line`, `enemy_all` — because `EnemyPack` already has
 * a `row: 'front' | 'back'` axis and reusing the word for the perpendicular one would be a
 * standing trap.
 *
 * Pure, like everything in `shared/`: this module decides *which* targets and *how much*, and
 * hands back indices. Applying anything is the caller's job.
 */

import type { HqStatKey } from './types'
import type { StatusKind } from './status'

/**
 * Who an ability lands on.
 *
 * `enemy_*` patterns resolve against the encounter's grid (`settle.enemyPosition`); `self` and
 * `ally_*` against the fielded party.
 */
export type EffectTarget =
    /** The focus target alone — what every ability did before this module. */
    | 'enemy_single'
    /** The focus target and everything sharing its column, front to back. Pierce. */
    | 'enemy_pierce'
    /** Every living enemy in the front row. */
    | 'enemy_front_line'
    /** Everything standing. */
    | 'enemy_all'
    | 'self'
    /** The most wounded living ally by HP fraction — Support's own autoattack rule (§8.2). */
    | 'ally_lowest_hp'
    /** The living ally with the most PWR — where a damage or speed buff is worth the most. */
    | 'ally_strongest'
    | 'ally_all'

export function isAllyTarget(target: EffectTarget): boolean {
    return target === 'self'
        || target === 'ally_lowest_hp'
        || target === 'ally_strongest'
        || target === 'ally_all'
}

/**
 * A status an ability applies.
 *
 * `magnitude` means different things per kind, exactly as `StatusInstance.magnitude` does: a
 * fraction for `buff` / `debuff` / `reflect` / `redirect`, and a multiple of the caster's PWR
 * for `dot` / `hot` / `shield`. The `scalesWithPwr` flag is what tells the caller which, so
 * content can stay declarative and the PWR lookup stays in one place.
 */
export interface StatusSpec {
    kind: StatusKind
    stat?: HqStatKey
    duration: number
    magnitude?: number
    /** True when `magnitude` is a multiple of PWR rather than a flat fraction. */
    scalesWithPwr?: boolean
    stacks?: number
}

export interface AbilityEffect {
    target: EffectTarget
    /** Healing as a multiple of the caster's PWR (`champions-guild-gacha.md` §2). */
    heal?: number
    /** Shield pool as a multiple of the caster's PWR. */
    shield?: number
    /** Skips the crit roll and always crits — Kill Shot. */
    alwaysCrits?: boolean
    /** Extra multiplier on top of the crit multiplier, when this ability crits. */
    critDamageMultiplier?: number
    /** Landed on every target the pattern selects. */
    status?: StatusSpec
    /** Landed on the caster, whatever the pattern selected. */
    selfStatus?: StatusSpec
    /** Damage scales up as the target's HP falls — Execute Strike. Fraction at 0% HP. */
    executeBonus?: number
    /**
     * Split the damage into this many separate hits — Focused Barrage's "several smaller hits
     * on one target instead of one big hit, more crit rolls per cast".
     *
     * Each hit rolls its own crit, which is the entire point: the total is the same but the
     * variance collapses, so a barrage is worth more to a high-crit build than a single swing.
     */
    hits?: number
    /** Restore a fallen ally to this fraction of max HP — Second Wind. */
    revive?: number
    /** Strip hostile statuses from every target — Purify and the cleanse family. */
    cleanse?: boolean
    /** Extend every hostile status already on the target — Unraveling Curse, exactly. */
    extendDebuffs?: number
    /**
     * A second effect that lands only once `status` has built to a stack threshold.
     *
     * Frostbind's "stacking slow; **at max stacks**, fully disables (freezes) the target" is
     * the case this exists for, and it is written generically rather than as a Frostbind branch
     * because "build a debuff, then it does something worse" is an obvious shape for later
     * content to reuse.
     *
     * The threshold is checked **after** the application lands, against the stacks actually on
     * the target — so it fires on whichever cast crosses the line, however many casts that
     * takes, and it keeps firing while the target stays at or above it.
     */
    escalation?: {
        /** Stacks of this ability's own `status` required. */
        atStacks: number
        /** What lands on the target once the threshold is met. */
        status: StatusSpec
    }
}

/** The default: a single-target hit, which is what every ability did before effects existed. */
export const SINGLE_TARGET: AbilityEffect = { target: 'enemy_single' }

/**
 * Which enemies an ability hits, as indices into the pack.
 *
 * `focus` is the ability's anchor — the front-most living enemy, the same body an autoattack
 * would strike. Patterns spread out from there. Dead bodies are never returned, so an AoE
 * landing on a half-cleared pack hits what is left rather than swinging at corpses.
 */
export function resolveEnemyTargets(
    target: EffectTarget,
    focus: number,
    living: readonly number[],
    size: number,
    geometry: {
        columnOf: (index: number, size: number) => number[]
        rowOf: (row: 'front' | 'back', size: number) => number[]
    }
): number[] {
    if (isAllyTarget(target)) return []
    const alive = new Set(living)
    const keep = (indices: number[]) => indices.filter(index => alive.has(index))

    switch (target) {
        case 'enemy_pierce':
            return keep(geometry.columnOf(focus, size))
        case 'enemy_front_line': {
            const front = keep(geometry.rowOf('front', size))
            // An empty front row means the back row *is* the front line — the same fallthrough
            // the enemy's own targeting uses against the party.
            return front.length > 0 ? front : keep(geometry.rowOf('back', size))
        }
        case 'enemy_all':
            return [...living]
        default:
            return alive.has(focus) ? [focus] : []
    }
}

/** Which allies an ability lands on, as indices into the party. */
export function resolveAllyTargets(
    target: EffectTarget,
    caster: number,
    party: readonly { alive: boolean; hpFraction: number; power?: number }[],
    /** Revives target the *fallen*, which is the one case where "ally" means a corpse. */
    wantsFallen = false
): number[] {
    if (wantsFallen) {
        return party.flatMap((unit, index) => unit.alive ? [] : [index])
    }

    const living = party
        .map((unit, index) => ({ ...unit, index }))
        .filter(unit => unit.alive)

    switch (target) {
        case 'self':
            return party[caster]?.alive ? [caster] : []
        case 'ally_lowest_hp': {
            if (living.length === 0) return []
            const neediest = living.reduce((worst, unit) =>
                unit.hpFraction < worst.hpFraction ? unit : worst)
            return [neediest.index]
        }
        case 'ally_strongest': {
            if (living.length === 0) return []
            const strongest = living.reduce((best, unit) =>
                (unit.power ?? 0) > (best.power ?? 0) ? unit : best)
            return [strongest.index]
        }
        case 'ally_all':
            return living.map(unit => unit.index)
        default:
            return []
    }
}

/**
 * The damage multiplier an execute-style ability earns against a wounded target.
 *
 * "Bonus damage that scales up the lower the target's HP% is" (Execute Strike, Executioner's
 * Edge, Kill Shot's family). Linear in missing HP: full bonus at 0% HP, none at full.
 */
export function executeMultiplier(effect: AbilityEffect, hpFraction: number): number {
    if (!effect.executeBonus) return 1
    const missing = Math.min(1, Math.max(0, 1 - hpFraction))
    return 1 + effect.executeBonus * missing
}
