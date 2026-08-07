/**
 * Seeded boss resolution (`tech-architecture.md` §4c).
 *
 * A boss cannot be lazily settled — offline never engages one — and cannot be resolved by
 * the client, because Gold and Void Shards are real balances. So the server runs this, and
 * hands the client the seed. The client then runs the *identical* function and animates the
 * exact authoritative fight, blow for blow. Divergence is impossible because it is the same
 * pure code on both sides; the client renders, it never decides.
 *
 * ## Rolled here, averaged in `settle`
 *
 * Wave farming is a *rate*, so `settle.ts` averages crit. A boss is a *fight*, so this rolls
 * it — real variance, still fully deterministic and replayable. That is a deliberate
 * asymmetry (`tech-architecture.md` §4c recommends it; `open-items.md` #3 records that it is
 * a recommendation rather than a lock).
 *
 * ## The randomness rule, and why a PRNG here is not a violation
 *
 * The platform forbids `Math.random()` for anything deciding an outcome, and forbids rolling
 * your own generator from `crypto.getRandomValues`. Neither applies: the entropy that
 * decides this fight is the **seed**, which the server draws with `randomInt` from
 * `#shared/utils/random` before calling in. Everything past that point must be reproducible
 * from the seed alone or the replay would not match, which is exactly what a CSPRNG cannot
 * give you. Same shape as `shared/utils/gamelogic/pathwarden-simulator.ts`.
 *
 * ## Skills
 *
 * Every skill auto-fires the instant its cooldown completes — there is no manual mode
 * anywhere in this game (`classes-and-combat.md` §3). Kits are cumulative, so a Berserker
 * brings four skills and a Beginner one. All 16 currently resolve as single-target damage on
 * a shared placeholder cooldown and multiplier; the distinctive behaviours §7 sketches
 * (chaining, multi-target, summons) have no numeric model in any doc and are not built.
 *
 * **Consequence worth knowing:** `settle.ts` has no skill term at all, so a boss's DPS check
 * is fought with strictly more damage than the wave rate on screen implies. That gap is
 * intentional but untuned, and it moves whenever `SKILL_BASE_ABILITY_MULTIPLIER` moves.
 */

import {
    BOSS_TIMER_SECONDS,
    FIGHT_TICK_SECONDS
} from './constants'
import { attackIntervalFor, cooldownFor, mitigation, partyMitigation } from './combat'
import { enemyStatsAt } from './settle'
import { partyUnitStats } from './stats'
import { kitFor } from './content/classes'
import { ONE, ZERO } from './numbers'
import type { Decimal } from './numbers'
import type { HeroSnapshot, RunPosition, UnitStats } from './types'

export type FightOutcome = 'win' | 'timeout' | 'wipe'

export type FightEventKind = 'attack' | 'skill' | 'enemy_attack' | 'unit_down' | 'enemy_down'

/**
 * One thing that happened, at one moment. The replay log is nothing but these — the client
 * walks them in order against its own clock and never recomputes a number.
 *
 * Decimals are serialized as strings (`tech-architecture.md` §5): this crosses the wire, and
 * damage at depth is well past what JSON numbers hold.
 */
export interface FightEvent {
    /** Sim-seconds from the start of the fight. */
    at: number
    kind: FightEventKind
    /** Index into the party for unit-sourced events; absent for enemy-sourced ones. */
    unitIndex?: number
    /** Skill that fired, for `kind: 'skill'`. */
    skillId?: string
    /** Decimal as a string. */
    damage?: string
    crit?: boolean
    /** Remaining HP after the event, as a string. */
    remainingHp?: string
}

export interface FightInput {
    hero: HeroSnapshot
    position: RunPosition
    seed: number
}

export interface FightResult {
    outcome: FightOutcome
    /** When it ended. Equal to `BOSS_TIMER_SECONDS` on a timeout. */
    secondsElapsed: number
    events: FightEvent[]
    /** Enemy HP left when the fight ended — 0 on a win. String-encoded Decimal. */
    enemyHpRemaining: string
    enemyMaxHp: string
    /** Fraction of the boss's HP removed, for a "so close" readout on a loss. */
    damageDealtPct: number
    seed: number
}

/**
 * mulberry32 — small, fast, and reproducible across every JS engine, which is the only
 * property that matters here. Not a CSPRNG and not used as one; see the header.
 */
function seededRandom(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state += 0x6D2B79F5
        let value = state
        value = Math.imul(value ^ value >>> 15, value | 1)
        value ^= value + Math.imul(value ^ value >>> 7, value | 61)
        return ((value ^ value >>> 14) >>> 0) / 4294967296
    }
}

interface Combatant {
    stats: UnitStats
    hp: Decimal
    /** Sim-seconds until the next autoattack. */
    attackTimer: number
    skills: { id: string; interval: number; timer: number; multiplier: number }[]
}

/**
 * Resolve a boss or super-boss fight.
 *
 * Bounded work by construction: `BOSS_TIMER_SECONDS / FIGHT_TICK_SECONDS` iterations, fixed,
 * whatever the party's strength or the run's depth. Battle Speed never enters here — the
 * server always computes the full sim-second outcome, and a boost only changes how fast the
 * client plays the log back (`tech-architecture.md` §4b).
 */
export function runFight(input: FightInput): FightResult {
    const random = seededRandom(input.seed)
    const enemy = enemyStatsAt(input.position)
    const units = partyUnitStats(input.hero)
    const kit = kitFor(input.hero.classId)

    const party: Combatant[] = units.map((stats, index) => ({
        stats,
        hp: stats.maxHp,
        attackTimer: 0,
        // Only the Hero carries the class tree's kit. Champions bring their own, which is
        // Phase 2 content — they field as autoattackers until then.
        skills: index === 0
            ? kit.map(entry => ({
                id: entry.id,
                interval: cooldownFor(entry.cooldownSeconds, stats.spd),
                timer: cooldownFor(entry.cooldownSeconds, stats.spd),
                multiplier: entry.abilityMultiplier
            }))
            : []
    }))

    const events: FightEvent[] = []
    let enemyHp = enemy.hp
    let enemyAttackTimer = attackIntervalFor(0)
    let elapsed = 0

    // Mitigation is resolved once from the party's *summed* PWR and never per attacker —
    // that pooling is what lets unit count move the zero-damage threshold instead of only
    // scaling whatever survives below it (`classes-and-combat.md` §7).
    const penetration = ONE.sub(partyMitigation(units, enemy.def))

    const totalTicks = Math.ceil(BOSS_TIMER_SECONDS / FIGHT_TICK_SECONDS)

    for (let tick = 0; tick < totalTicks; tick++) {
        elapsed = Math.min(BOSS_TIMER_SECONDS, (tick + 1) * FIGHT_TICK_SECONDS)

        for (const [index, unit] of party.entries()) {
            if (unit.hp.lte(0)) continue

            unit.attackTimer -= FIGHT_TICK_SECONDS
            if (unit.attackTimer <= 0) {
                unit.attackTimer += attackIntervalFor(unit.stats.spd)
                // strikesPerAttack folds Hunter's triple and Beast Master's quad in without
                // a special case; each strike rolls its own crit, per §7.
                for (let strike = 0; strike < unit.stats.strikesPerAttack; strike++) {
                    const { damage, crit } = rollDamage(unit.stats, penetration, 1, random)
                    enemyHp = enemyHp.sub(damage)
                    events.push({
                        at: elapsed,
                        kind: 'attack',
                        unitIndex: index,
                        damage: damage.toString(),
                        crit,
                        remainingHp: decMaxZero(enemyHp).toString()
                    })
                    if (enemyHp.lte(0)) break
                }
            }
            if (enemyHp.lte(0)) break

            for (const skill of unit.skills) {
                skill.timer -= FIGHT_TICK_SECONDS
                if (skill.timer > 0) continue
                skill.timer += skill.interval
                const { damage, crit } = rollDamage(unit.stats, penetration, skill.multiplier, random)
                enemyHp = enemyHp.sub(damage)
                events.push({
                    at: elapsed,
                    kind: 'skill',
                    unitIndex: index,
                    skillId: skill.id,
                    damage: damage.toString(),
                    crit,
                    remainingHp: decMaxZero(enemyHp).toString()
                })
                if (enemyHp.lte(0)) break
            }
            if (enemyHp.lte(0)) break
        }

        if (enemyHp.lte(0)) {
            events.push({ at: elapsed, kind: 'enemy_down', remainingHp: '0' })
            return result('win', elapsed, events, ZERO, enemy.hp, input.seed)
        }

        // The boss strikes the front of the party — with a solo Hero that is the Hero, and
        // formation only starts mattering once Champions exist (Phase 2). Incoming damage is
        // resolved per defender, never pooled: party size is an offensive lever only.
        enemyAttackTimer -= FIGHT_TICK_SECONDS
        if (enemyAttackTimer <= 0) {
            enemyAttackTimer += attackIntervalFor(0)
            const target = party.find(unit => unit.hp.gt(0))
            if (target) {
                const targetIndex = party.indexOf(target)
                const damage = enemy.pwr.mul(ONE.sub(mitigation(enemy.pwr, target.stats.def)))
                target.hp = target.hp.sub(damage)
                events.push({
                    at: elapsed,
                    kind: 'enemy_attack',
                    unitIndex: targetIndex,
                    damage: damage.toString(),
                    remainingHp: decMaxZero(target.hp).toString()
                })
                if (target.hp.lte(0)) {
                    events.push({ at: elapsed, kind: 'unit_down', unitIndex: targetIndex, remainingHp: '0' })
                }
            }
        }

        if (party.every(unit => unit.hp.lte(0))) {
            return result('wipe', elapsed, events, enemyHp, enemy.hp, input.seed)
        }
    }

    return result('timeout', BOSS_TIMER_SECONDS, events, enemyHp, enemy.hp, input.seed)
}

/** Crit rolled per strike, not averaged — the one place in the game that does. */
function rollDamage(
    unit: UnitStats,
    penetration: Decimal,
    abilityMultiplier: number,
    random: () => number
): { damage: Decimal; crit: boolean } {
    if (penetration.lte(0)) return { damage: ZERO, crit: false }
    const crit = random() < unit.critChance
    const base = unit.pwr.mul(penetration).mul(abilityMultiplier)
    return { damage: crit ? base.mul(unit.critMultiplier) : base, crit }
}

function decMaxZero(value: Decimal): Decimal {
    return value.lt(0) ? ZERO : value
}

function result(
    outcome: FightOutcome,
    secondsElapsed: number,
    events: FightEvent[],
    enemyHpRemaining: Decimal,
    enemyMaxHp: Decimal,
    seed: number
): FightResult {
    const remaining = decMaxZero(enemyHpRemaining)
    const dealt = enemyMaxHp.lte(0) ? 1 : ONE.sub(remaining.div(enemyMaxHp)).toNumber()
    return {
        outcome,
        secondsElapsed,
        events,
        enemyHpRemaining: remaining.toString(),
        enemyMaxHp: enemyMaxHp.toString(),
        damageDealtPct: Math.min(1, Math.max(0, dealt)),
        seed
    }
}
