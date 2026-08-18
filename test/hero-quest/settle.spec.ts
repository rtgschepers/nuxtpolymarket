import { describe, expect, it } from 'vitest'
import {
    applyXp,
    cappedOfflineSeconds,
    curveIndex,
    enemyMultiplier,
    enemyPackAt,
    enemyStatsAt,
    fallbackStage,
    goldPerKill,
    killsBeforeWipe,
    killsRequired,
    maxGoldPerHour,
    secondsToDie,
    nextStage,
    offlineCapHours,
    offlineEfficiency,
    offlineFarmStage,
    prestigeGoldFactor,
    rateAt,
    secondsPerKill,
    settle,
    stageArchetype,
    totalXpForLevel,
    xpPerKill,
    xpToNextLevel
} from '#shared/utils/hero-quest/settle'
import {
    BASE_KILL_COUNT,
    BOSS_STAGE,
    ENEMY_CURVE_T,
    ENEMY_STEP_BASE,
    GOLD_PLATEAU_GROWTH,
    GOLD_PRESTIGE_CAP,
    MAX_OFFLINE_CAP_LEVEL,
    MAX_OFFLINE_EFFICIENCY,
    MAX_OFFLINE_EFFICIENCY_LEVEL,
    MIN_SECONDS_PER_KILL,
    OFFLINE_CAP_MAX_HOURS,
    PRESTIGE_INDEX_STEPS,
    STAGES_PER_WORLD,
    SUPER_BOSS_STAGE,
    WORLD_COUNT,
    XP_STEP_BASE,
    XP_TO_LEVEL_BASE,
    XP_TO_LEVEL_GROWTH
} from '#shared/utils/hero-quest/constants'
import { D, ZERO } from '#shared/utils/hero-quest/numbers'
import { partyDps } from '#shared/utils/hero-quest/combat'
import { partyUnitStats } from '#shared/utils/hero-quest/stats'
import type { HeroSnapshot, RunPosition, SettleInput } from '#shared/utils/hero-quest/types'

const hero: HeroSnapshot = {
    classId: 'class_beginner',
    heroLevel: 1,
    heroXp: ZERO,
    goldBonusPct: 0,
    offlineEfficiencyLevel: 0,
    offlineCapLevel: 0
}

function at(world: number, stage: number, killsInStage = 0, prestige = 0): RunPosition {
    return { prestige, world, stage, killsInStage }
}

/**
 * First position along the play order where the hero cannot land a single kill inside the
 * longest window the game ever settles (the 72h offline cap).
 *
 * Since `MIN_DAMAGE` replaced the hard zero, no position produces literally zero damage any
 * more — the wall is a *rate* wall rather than an absolute one. "Cannot progress" therefore
 * has to be expressed against a time budget, and the offline cap is the natural one: a stage
 * that yields nothing across a maximal offline window yields nothing in practice.
 */
const LONGEST_SETTLE_SECONDS = 72 * 3600

/**
 * Scanned across prestiges, not just the first loop. The session-2 enemy cut (`BASE_ENEMY_HP`
 * 30 → 10, `BASE_ENEMY_DEF` 5 → 2) pushed the stall out of the prestige-0 run entirely — a
 * static level-1 Beginner now grinds through all ten worlds and walls at P1 W2S10. Naming a
 * prestige here would be the same mistake as naming a stage: the claim under test is that the
 * wall exists and that levels answer it, not where it sits.
 */
const STALL_SEARCH_PRESTIGES = 4

function firstStallingPosition(snapshot: HeroSnapshot): RunPosition | null {
    for (let prestige = 0; prestige < STALL_SEARCH_PRESTIGES; prestige++) {
        for (let world = 1; world <= WORLD_COUNT; world++) {
            for (let stage = 1; stage <= STAGES_PER_WORLD; stage++) {
                // Wave stages only. A gate settles to zero kills because it is a gate — the
                // fight is a separate seeded resolution — so a gate would satisfy every
                // assertion below without the DEF wall being involved at all, and the spec
                // would quietly stop testing what it claims to. The crit retune made that a
                // live hazard rather than a theoretical one: the lower DPS moved the first
                // stall onto P0 W10S10, the last gate of the opening loop.
                if (stage === BOSS_STAGE || stage === SUPER_BOSS_STAGE) continue
                const position = at(world, stage, 0, prestige)
                const spk = secondsPerKill(partyUnitStats(snapshot), enemyPackAt(position))
                if (!(spk <= LONGEST_SETTLE_SECONDS)) return position
            }
        }
    }
    return null
}

/**
 * The lowest level at which the wall stops being a wall — found, not named, for the same reason
 * the wall itself is. The crit retune moved it by well over a hundred levels in one edit.
 *
 * Searched through `settle` rather than through `secondsPerKill`, because the rate alone is not
 * what decides whether a window yields anything: the offline cap shortens the window, a party
 * that wipes restarts the stage, and `MIN_SECONDS_PER_KILL` floors the result. Asking the thing
 * under test is both simpler and harder to fool than reproducing its three gates here and
 * getting one of them subtly wrong.
 */
function firstLevelClearing(snapshot: HeroSnapshot, position: RunPosition, maxLevel = 1000): number | null {
    for (let heroLevel = 1; heroLevel <= maxLevel; heroLevel++) {
        const attempt = settle(input({
            hero: { ...snapshot, heroLevel },
            position,
            elapsedSeconds: LONGEST_SETTLE_SECONDS
        }))
        if (attempt.kills > 0) return heroLevel
    }
    return null
}

function input(overrides: Partial<SettleInput> = {}): SettleInput {
    return {
        hero,
        position: at(1, 1),
        elapsedSeconds: 3600,
        online: false,
        ...overrides
    }
}

describe('hero-quest settle', () => {
    describe('curve index', () => {
        it('is 0 at the origin and one step per stage', () => {
            expect(curveIndex(0, 1, 1)).toBe(0)
            expect(curveIndex(0, 1, 2)).toBe(1)
            expect(curveIndex(0, 2, 1)).toBe(STAGES_PER_WORLD)
            expect(curveIndex(1, 1, 1)).toBe(PRESTIGE_INDEX_STEPS)
        })

        it('increases by exactly one along the whole play order, seams included', () => {
            let previous = -1
            for (let prestige = 0; prestige < 3; prestige++) {
                for (let world = 1; world <= WORLD_COUNT; world++) {
                    for (let stage = 1; stage <= STAGES_PER_WORLD; stage++) {
                        const index = curveIndex(prestige, world, stage)
                        expect(index).toBe(previous + 1)
                        previous = index
                    }
                }
            }
        })
    })

    describe('enemy curve', () => {
        it('is 1 at the origin', () => {
            expect(enemyMultiplier(0, 1, 1).toNumber()).toBe(1)
        })

        it('grows by the same ratio for every step, wherever the step falls', () => {
            const ratio = (a: [number, number, number], b: [number, number, number]) =>
                enemyMultiplier(...b).div(enemyMultiplier(...a)).toNumber()

            // Mid-world, across a world boundary, and across a prestige boundary.
            expect(ratio([0, 1, 1], [0, 1, 2])).toBeCloseTo(ENEMY_STEP_BASE, 10)
            expect(ratio([0, 1, 10], [0, 2, 1])).toBeCloseTo(ENEMY_STEP_BASE, 10)
            expect(ratio([0, 10, 10], [1, 1, 1])).toBeCloseTo(ENEMY_STEP_BASE, 10)
        })

        it('multiplies by T over one full loop', () => {
            expect(enemyMultiplier(1, 1, 1).toNumber()).toBeCloseTo(ENEMY_CURVE_T, 10)
            // Relative, not absolute: T^3 is large enough that digit-place tolerance is
            // meaningless there.
            expect(enemyMultiplier(3, 1, 1).toNumber() / Math.pow(ENEMY_CURVE_T, 3)).toBeCloseTo(1, 10)
        })

        it('survives magnitudes no native number can hold', () => {
            const deep = enemyMultiplier(1000, 10, 10)
            expect(deep.isFinite()).toBe(true)
            expect(deep.gt(D(10).pow(300))).toBe(true)
        })
    })

    describe('stage archetypes', () => {
        it('classifies all ten stages', () => {
            expect([1, 2, 3, 4].map(stageArchetype)).toEqual(['wave', 'wave', 'wave', 'wave'])
            expect(stageArchetype(5)).toBe('boss')
            expect([6, 7, 8, 9].map(stageArchetype)).toEqual(['elite', 'elite', 'elite', 'elite'])
            expect(stageArchetype(10)).toBe('super_boss')
        })

        it('gives boss stages no kill requirement', () => {
            expect(killsRequired(at(1, 5))).toBe(0)
            expect(killsRequired(at(1, 10))).toBe(0)
            expect(killsRequired(at(1, 1))).toBe(BASE_KILL_COUNT)
        })

        it('makes elites tougher than trash and bosses tougher than elites', () => {
            const trash = enemyStatsAt(at(1, 4)).hp.toNumber()
            const elite = enemyStatsAt(at(1, 6)).hp.toNumber()
            const boss = enemyStatsAt(at(1, 5)).hp.toNumber()
            expect(elite).toBeGreaterThan(trash)
            expect(boss).toBeGreaterThan(elite)
        })
    })

    describe('secondsPerKill', () => {
        it('never dips below the throughput floor, however high DPS climbs', () => {
            const member = enemyStatsAt(at(1, 1))
            // Level stands in for raw DPS now that the signature takes the party rather than
            // a bare number — and it exercises the real stat pipeline while it's at it.
            for (const level of [200, 500, 2000]) {
                const units = partyUnitStats({ ...hero, heroLevel: level })
                expect(secondsPerKill(units, { members: [member] }))
                    .toBeGreaterThanOrEqual(MIN_SECONDS_PER_KILL)
            }
            expect(secondsPerKill(partyUnitStats({ ...hero, heroLevel: 2000 }), { members: [member] }))
                .toBe(MIN_SECONDS_PER_KILL)
        })

        it('returns Infinity for a party that cannot damage the enemy', () => {
            // An empty party is the only way to deal literally nothing since MIN_DAMAGE.
            expect(secondsPerKill([], enemyPackAt(at(1, 1)))).toBe(Number.POSITIVE_INFINITY)
        })
    })

    describe('offline window', () => {
        it('reaches exactly 72 hours at the top cap level', () => {
            expect(offlineCapHours(0)).toBe(8)
            expect(offlineCapHours(MAX_OFFLINE_CAP_LEVEL)).toBe(OFFLINE_CAP_MAX_HOURS)
            expect(offlineCapHours(MAX_OFFLINE_CAP_LEVEL + 50)).toBe(OFFLINE_CAP_MAX_HOURS)
        })

        it('reaches exactly 100% efficiency at the top shop level', () => {
            expect(offlineEfficiency(0)).toBeCloseTo(0.5, 10)
            expect(offlineEfficiency(MAX_OFFLINE_EFFICIENCY_LEVEL)).toBe(MAX_OFFLINE_EFFICIENCY)
        })

        it('stacks extra efficiency sources additively under the shared ceiling', () => {
            expect(offlineEfficiency(0, 0.2)).toBeCloseTo(0.7, 10)
            expect(offlineEfficiency(MAX_OFFLINE_EFFICIENCY_LEVEL, 0.5)).toBe(MAX_OFFLINE_EFFICIENCY)
        })

        it('clamps real elapsed time to the cap', () => {
            expect(cappedOfflineSeconds(3600, 0)).toBe(3600)
            expect(cappedOfflineSeconds(1e9, 0)).toBe(8 * 3600)
        })

        it('caps before boosting and taxes efficiency last', () => {
            // 100h offline at cap level 0 → 8h counted; a 2x boost over the whole window at
            // 50% efficiency nets exactly the unboosted 8h.
            const boosted = settle(input({
                elapsedSeconds: 100 * 3600,
                speedBoost: { multiplier: 2, overlapSeconds: 100 * 3600 }
            }))
            expect(boosted.effectiveSeconds).toBeCloseTo(8 * 3600, 6)

            const plain = settle(input({ elapsedSeconds: 100 * 3600 }))
            expect(plain.effectiveSeconds).toBeCloseTo(4 * 3600, 6)
        })
    })

    describe('stage movement', () => {
        it('advances within a world and rolls over into the next', () => {
            expect(nextStage(at(1, 4, 30))).toMatchObject({ world: 1, stage: 5, killsInStage: 0 })
            expect(nextStage(at(1, 10))).toMatchObject({ world: 2, stage: 1, killsInStage: 0 })
        })

        it('stops at the end of the last world', () => {
            expect(nextStage(at(WORLD_COUNT, STAGES_PER_WORLD))).toMatchObject({ world: WORLD_COUNT, stage: STAGES_PER_WORLD })
        })

        it('soft-fails one stage back', () => {
            expect(fallbackStage(at(1, 5))).toMatchObject({ stage: 4 })
            expect(fallbackStage(at(1, 10))).toMatchObject({ stage: 9 })
        })

        it('redirects boss stages to the preceding wave stage and leaves others alone', () => {
            expect(offlineFarmStage(at(1, 5))).toMatchObject({ stage: 4 })
            expect(offlineFarmStage(at(1, 10))).toMatchObject({ stage: 9 })
            expect(offlineFarmStage(at(1, 3))).toMatchObject({ stage: 3 })
        })
    })

    describe('the opening is playable at all', () => {
        /**
         * A level-1 solo Hero must be able to clear the very first stage.
         *
         * This is the floor the whole game stands on: below it a new account is walled on World
         * 1 Stage 1 with no way forward, which the campaign sim reports as "unfarmable from the
         * first screen". `BASE_HP` is the constant that decides it — the session-1 playtest set
         * it to 2000 specifically because solo needs ≥2000, and party results are identical from
         * 1000 to 8000, so nothing else in the suite is sensitive to it.
         *
         * Pinned deliberately rather than left to incidental coverage. That value silently
         * reverted to its pre-playtest 100 twice during editing; the suite happened to catch it
         * the second time only because an unrelated retune had made other specs sensitive to it.
         * "Happened to" is not a safety net.
         */
        it('lets a level-1 Hero survive long enough to clear World 1 Stage 1', () => {
            const units = partyUnitStats({ ...hero, heroLevel: 1 })
            const position = at(1, 1)
            const pack = enemyPackAt(position)
            const survives = killsBeforeWipe(units, pack, secondsPerKill(units, pack))

            expect(survives).toBeGreaterThanOrEqual(BASE_KILL_COUNT)
        })
    })

    describe('the wave wipe', () => {
        /** Deep enough that a level-1 Beginner still deals damage but cannot outlast a stage. */
        const unsurvivable = at(2, 2)

        function secondsPerKillAt(position: RunPosition, heroLevel = 1) {
            const units = partyUnitStats({ ...hero, heroLevel })
            return secondsPerKill(units, enemyPackAt(position))
        }

        function wipeCount(position: RunPosition, heroLevel = 1) {
            const units = partyUnitStats({ ...hero, heroLevel })
            return killsBeforeWipe(units, enemyPackAt(position), secondsPerKillAt(position, heroLevel))
        }

        it('is effectively unreachable for a party the enemy can barely scratch', () => {
            const units = partyUnitStats({ ...hero, heroLevel: 200 })
            const enemy = enemyPackAt(at(1, 1))

            // No longer literally infinite: since MIN_DAMAGE landed, a fully-mitigated
            // defender still takes chip damage, so every party dies *eventually*.
            //
            // What makes the wipe unreachable is measured against the **stage**, not against
            // a wall-clock figure: an over-levelled party clears the 30 kills hundreds of
            // times over before dropping. A raw seconds threshold would also be a hidden
            // assertion about pack size, since packs scale survival by `1/streams(N)`.
            //
            // The multiplier is a proxy for "unreachable", not a measured quantity, and it
            // came down from 1000 to 100 with the session-1 HP cut — this fixture now survives
            // 377 full clears rather than 1000+. Still unreachable by any playable standard;
            // the level-200 fixture is kept rather than inflated to chase the old number,
            // since the claim under test is about the shape, not the magnitude.
            const survives = secondsToDie(units, enemy)
            expect(Number.isFinite(survives)).toBe(true)
            expect(wipeCount(at(1, 1), 200)).toBeGreaterThan(BASE_KILL_COUNT * 100)
        })

        it('holds the stage instead of advancing when the party cannot outlast it', () => {
            expect(wipeCount(unsurvivable)).toBeLessThan(BASE_KILL_COUNT)

            const result = settle(input({ position: unsurvivable, elapsedSeconds: 72 * 3600 }))
            expect(result.wipedOnWave).toBe(true)
            expect(result.position.world).toBe(unsurvivable.world)
            expect(result.position.stage).toBe(unsurvivable.stage)
        })

        it('never banks more stage progress than one attempt survives', () => {
            const result = settle(input({ position: unsurvivable, elapsedSeconds: 72 * 3600 }))
            expect(result.position.killsInStage).toBeLessThan(wipeCount(unsurvivable))
        })

        it('keeps paying Gold and XP while walled, so levelling breaks the wall', () => {
            const result = settle(input({ position: unsurvivable, elapsedSeconds: 8 * 3600 }))
            expect(result.kills).toBeGreaterThan(0)
            expect(result.goldEarned).toBeGreaterThan(0)
            expect(result.xpEarned.gt(0)).toBe(true)
            expect(result.heroLevel).toBeGreaterThan(hero.heroLevel)
        })

        it('resolves a long window in bounded time rather than walking wipe by wipe', () => {
            const started = Date.now()
            settle(input({ position: unsurvivable, elapsedSeconds: 72 * 3600 }))
            expect(Date.now() - started).toBeLessThan(1000)
        })

        it('earns nothing when the party dies before landing a single kill', () => {
            // The narrow band where the hero still scratches the enemy but one kill outlasts
            // it — past this the hero deals literally 0 and `stalls` instead (below). Moved
            // W2S6 → W2S9 by the session-2 enemy cut: with base HP at 10 the hero now kills
            // fast enough at S6 to bank a kill before dropping, so the band starts later.
            const position = at(2, 9)
            expect(secondsPerKillAt(position)).toBeLessThan(Number.POSITIVE_INFINITY)
            expect(wipeCount(position)).toBe(0)

            const result = settle(input({ position, elapsedSeconds: 24 * 3600 }))
            expect(result.wipedOnWave).toBe(true)
            expect(result.kills).toBe(0)
            expect(result.goldEarned).toBe(0)
            expect(result.position.killsInStage).toBe(0)
        })

        it('clears normally once the party outlasts the kill requirement', () => {
            expect(wipeCount(at(1, 1))).toBeGreaterThanOrEqual(BASE_KILL_COUNT)

            const result = settle(input({ position: at(1, 1), elapsedSeconds: 8 * 3600 }))
            expect(result.wipedOnWave).toBe(false)
            expect(result.position.stage).toBeGreaterThan(1)
        })
    })

    describe('the boss wall', () => {
        it('never advances past Stage 5, however long the window', () => {
            const result = settle(input({ position: at(1, 1), elapsedSeconds: 72 * 3600 }))
            expect(result.position.stage).toBe(5)
            expect(result.blockedAtBoss).toBe(true)
        })

        it('lands the player at the boss, not past it and not short of it', () => {
            // Levelled enough to outlast a Stage 4 attempt: this is a spec about the *gate*,
            // and a hero that wipes on the wave before it never reaches the gate to be gated.
            // The threshold rose with `WAVE_PACK_SIZE` — six attackers per encounter is a
            // real survivability cost, and the wave-wipe rule is tested on its own elsewhere.
            const result = settle(input({
                hero: { ...hero, heroLevel: 10 },
                position: at(1, 4, BASE_KILL_COUNT - 1),
                elapsedSeconds: 8 * 3600
            }))
            expect(result.position.stage).toBe(5)
            expect(result.position.killsInStage).toBe(0)
            expect(result.blockedAtBoss).toBe(true)
        })

        it('applies the redirect retroactively when already parked on a boss', () => {
            const parked = settle(input({ position: at(1, 5), elapsedSeconds: 4 * 3600 }))
            expect(parked.position.stage).toBe(5)
            expect(parked.blockedAtBoss).toBe(true)
            expect(parked.goldEarned).toBeGreaterThan(0)
            // Everything earned was valued at Stage 4, the wave stage before the gate.
            expect(parked.goldEarned).toBeCloseTo(parked.kills * goldPerKill(0, 1, 4), 6)
        })

        it('gates Stage 10 the same way it gates Stage 5', () => {
            // Needs a leveled hero: a level-1 Beginner cannot scratch a Stage 9 elite (below),
            // and below level 80 it cannot outlast a full elite stage attempt either — six
            // elites per encounter is a much heavier incoming stream than one. That threshold
            // was 35 before the session-1 HP cut took `HP_PER_VIT` from 200 to 10.
            const result = settle(input({
                hero: { ...hero, heroLevel: 80 },
                position: at(1, 9, BASE_KILL_COUNT - 1),
                elapsedSeconds: 8 * 3600
            }))
            expect(result.position.stage).toBe(10)
            expect(result.blockedAtBoss).toBe(true)
        })

        it('stalls a hero whose PWR the enemy DEF curve has outrun', () => {
            // Emergent, and deliberate: enemy DEF rides the same exponential as everything
            // else, so a static hero eventually crosses DEF >= PWR x K. Past that point it is
            // pinned to MIN_DAMAGE per swing, which against an exponential HP pool is not a
            // route through — the wall is slow rather than sealed, but it is still a wall.
            // Levelling is not optional. Where it lands moves with ENEMY_CURVE_T, so the test
            // finds it rather than naming a stage: what matters is that it exists and that
            // levels answer it.
            const wall = firstStallingPosition(hero)
            expect(wall).not.toBeNull()

            const stalled = settle(input({ position: wall!, elapsedSeconds: LONGEST_SETTLE_SECONDS }))
            expect(stalled.secondsPerKill).toBeGreaterThan(LONGEST_SETTLE_SECONDS)
            expect(stalled.kills).toBe(0)
            expect(stalled.goldEarned).toBe(0)

            const answering = firstLevelClearing(hero, wall!)
            expect(answering).not.toBeNull()

            const levelled = settle(input({
                hero: { ...hero, heroLevel: answering! },
                position: wall!,
                elapsedSeconds: LONGEST_SETTLE_SECONDS
            }))
            expect(levelled.kills).toBeGreaterThan(0)
        })

        it('earns Gold and XP while walled, so idle time is never wasted', () => {
            const result = settle(input({ position: at(1, 5), elapsedSeconds: 3600 }))
            expect(result.goldEarned).toBeGreaterThan(0)
            expect(result.xpEarned.gt(0)).toBe(true)
        })
    })

    describe('one-rate offline accrual', () => {
        it('holds the departure stage rate across a multi-stage advance', () => {
            const start = at(1, 1)
            const result = settle(input({ position: start, elapsedSeconds: 8 * 3600 }))

            const units = partyUnitStats(hero)
            // Through `rateAt`, the same helper `settle()` uses — it applies the ability
            // projection (buffed party, debuffed pack) before pricing the rate. Rebuilding
            // that here by hand is how this spec would silently start measuring a party the
            // game does not field.
            const departureRate = rateAt(hero, start).secondsPerKill
            const arrivalRate = rateAt(hero, result.position).secondsPerKill

            expect(result.position.stage).toBeGreaterThan(start.stage)
            expect(result.secondsPerKill).toBeCloseTo(departureRate, 10)
            // Enemies got tougher on the way, so the two rates genuinely differ — the test
            // would pass vacuously otherwise.
            expect(arrivalRate).toBeGreaterThan(departureRate)
        })

        it('derives kills from the held rate', () => {
            const result = settle(input({ position: at(1, 1), elapsedSeconds: 3600 }))
            expect(result.kills).toBe(Math.floor(result.effectiveSeconds / result.secondsPerKill))
        })

        it('values Gold at the stage each kill actually landed in', () => {
            // 30 kills clears Stage 1; the rest are worth more, so the average beats Stage 1's rate.
            const result = settle(input({ position: at(1, 1), elapsedSeconds: 8 * 3600 }))
            expect(result.kills).toBeGreaterThan(BASE_KILL_COUNT)
            expect(result.goldEarned / result.kills).toBeGreaterThan(goldPerKill(0, 1, 1))
        })

        it('accrues nothing for a zero or negative window', () => {
            expect(settle(input({ elapsedSeconds: 0 })).kills).toBe(0)
            expect(settle(input({ elapsedSeconds: -100 })).kills).toBe(0)
        })

        it('applies the Gold bonus multiplier', () => {
            const plain = settle(input({ elapsedSeconds: 3600 }))
            const boosted = settle(input({
                elapsedSeconds: 3600,
                hero: { ...hero, goldBonusPct: 1 }
            }))
            expect(boosted.goldEarned).toBeCloseTo(plain.goldEarned * 2, 6)
        })

        it('skips the cap and the efficiency tax while online', () => {
            const offline = settle(input({ elapsedSeconds: 3600, online: false }))
            const online = settle(input({ elapsedSeconds: 3600, online: true }))
            expect(online.effectiveSeconds).toBe(3600)
            expect(online.effectiveSeconds).toBeGreaterThan(offline.effectiveSeconds)
        })
    })

    describe('gold curve', () => {
        it('grows within a run but far more slowly than the enemy curve', () => {
            const goldGrowth = goldPerKill(0, 10, 10) / goldPerKill(0, 1, 1)
            const enemyGrowth = enemyMultiplier(0, 10, 10).toNumber() / enemyMultiplier(0, 1, 1).toNumber()
            expect(goldGrowth).toBeGreaterThan(1)
            expect(goldGrowth).toBeLessThan(enemyGrowth)
        })

        it('crawls at +2% per prestige past the cap instead of going flat', () => {
            const atCap = prestigeGoldFactor(GOLD_PRESTIGE_CAP)
            expect(prestigeGoldFactor(GOLD_PRESTIGE_CAP + 1)).toBeCloseTo(atCap * GOLD_PLATEAU_GROWTH, 6)
            expect(prestigeGoldFactor(GOLD_PRESTIGE_CAP + 10)).toBeCloseTo(atCap * Math.pow(GOLD_PLATEAU_GROWTH, 10), 6)
        })

        it('keeps a century of prestiging inside one order of magnitude of the plateau', () => {
            const ratio = prestigeGoldFactor(GOLD_PRESTIGE_CAP + 100) / prestigeGoldFactor(GOLD_PRESTIGE_CAP)
            expect(ratio).toBeLessThan(10)
        })

        it('bounds Gold per hour by construction', () => {
            const bound = maxGoldPerHour()
            expect(Number.isFinite(bound)).toBe(true)
            expect(bound).toBeGreaterThan(0)
        })

        it('leaves healthy headroom under the shared balance column', () => {
            // Gold lives on user.balance — numeric(19,4), a ~1e15 ceiling. The worst case
            // stacks everything at once: prestige cap, deepest stage, throughput floor, a
            // x4 Gold% stack and x4 Battle Speed, and a player who never spends a coin.
            const BALANCE_COLUMN_CEILING = 1e15
            const worstCase = maxGoldPerHour(4, 4)
            const headroomHours = BALANCE_COLUMN_CEILING / worstCase

            // At least 100 hours of uninterrupted worst-case earning before the column is
            // even a question. Tighten this if the Gold curve is ever re-fitted upward.
            expect(headroomHours).toBeGreaterThan(100)
        })
    })

    describe('xp curve', () => {
        it('grows with world, stage and prestige', () => {
            expect(xpPerKill(0, 2, 1).gt(xpPerKill(0, 1, 1))).toBe(true)
            expect(xpPerKill(0, 1, 2).gt(xpPerKill(0, 1, 1))).toBe(true)
            expect(xpPerKill(1, 1, 1).gt(xpPerKill(0, 1, 1))).toBe(true)
        })

        it('grows by a fixed ratio per index step', () => {
            expect(xpPerKill(0, 1, 2).div(xpPerKill(0, 1, 1)).toNumber()).toBeCloseTo(XP_STEP_BASE, 10)
            expect(xpPerKill(1, 1, 1).div(xpPerKill(0, 10, 10)).toNumber()).toBeCloseTo(XP_STEP_BASE, 10)
        })

        it('never lets XP per second decay with depth', () => {
            // XP/second ∝ xpPerKill ÷ enemy HP. Sharing an index is what holds this flat;
            // the old three-base curve decayed here, so farming got worse the deeper you went.
            const rate = (prestige: number, world: number, stage: number) =>
                xpPerKill(prestige, world, stage).div(enemyMultiplier(prestige, world, stage)).toNumber()

            const origin = rate(0, 1, 1) * (1 - 1e-9)
            expect(rate(0, 1, STAGES_PER_WORLD)).toBeGreaterThanOrEqual(origin)
            expect(rate(0, WORLD_COUNT, STAGES_PER_WORLD)).toBeGreaterThanOrEqual(origin)
            expect(rate(5, WORLD_COUNT, STAGES_PER_WORLD)).toBeGreaterThanOrEqual(origin)
        })

        it('sums xpToNextLevel into totalXpForLevel', () => {
            let running = ZERO
            for (let level = 1; level < 20; level++) {
                expect(totalXpForLevel(level).toNumber()).toBeCloseTo(running.toNumber(), 6)
                running = running.add(xpToNextLevel(level))
            }
        })
    })

    describe('levelling', () => {
        it('leaves a hero alone when XP falls short of the next level', () => {
            const result = applyXp(1, ZERO, xpToNextLevel(1).sub(1))
            expect(result.level).toBe(1)
        })

        it('levels exactly once at the threshold', () => {
            const result = applyXp(1, ZERO, xpToNextLevel(1))
            expect(result.level).toBe(2)
            expect(result.xp.toNumber()).toBeCloseTo(0, 6)
        })

        it('carries the remainder forward instead of dropping it', () => {
            // Expressed as a fraction of level 2's own price rather than as a literal, so it
            // stays a *partial* level under any re-denomination of the XP curve. A hard-coded
            // 25 was a quarter of a level at `XP_TO_LEVEL_BASE` 100 and more than two whole
            // levels once session 1 took it to 10 — so the spec had been asserting "overshoot
            // by a bit" while actually supplying "overshoot by two levels", and only passed
            // because the two happened to coincide at the original base.
            const remainder = xpToNextLevel(2).div(4)
            const result = applyXp(1, ZERO, xpToNextLevel(1).add(remainder))
            expect(result.level).toBe(2)
            expect(result.xp.toNumber()).toBeCloseTo(remainder.toNumber(), 6)
        })

        it('respects XP already banked toward the next level', () => {
            const half = xpToNextLevel(1).div(2)
            expect(applyXp(1, half, half).level).toBe(2)
            expect(applyXp(1, ZERO, half).level).toBe(1)
        })

        it('absorbs many levels in one step', () => {
            const result = applyXp(1, ZERO, D(1e9))
            expect(result.level).toBeGreaterThan(50)
            // Landing point is exact: the remainder never reaches the next threshold.
            expect(result.xp.lt(xpToNextLevel(result.level))).toBe(true)
            expect(result.xp.gte(0)).toBe(true)
        })

        it('stays exact at Decimal magnitudes a loop could not walk', () => {
            const total = D(10).pow(120)
            const result = applyXp(1, ZERO, total)

            // Enough levels that a one-at-a-time walk is out of the question, wherever
            // XP_TO_LEVEL_GROWTH is currently tuned.
            expect(result.level).toBeGreaterThan(1000)
            // And it lands where inverting the geometric series says it should.
            const solved = Math.floor(1 + Math.log(1 + 1e120 * (XP_TO_LEVEL_GROWTH - 1) / XP_TO_LEVEL_BASE)
                / Math.log(XP_TO_LEVEL_GROWTH))
            expect(Math.abs(result.level - solved)).toBeLessThanOrEqual(1)

            expect(totalXpForLevel(result.level).lte(total)).toBe(true)
            expect(result.xp.lt(xpToNextLevel(result.level))).toBe(true)
        })

        it('never de-levels a hero', () => {
            expect(applyXp(40, ZERO, ZERO).level).toBe(40)
            expect(applyXp(40, ZERO, D(-500)).level).toBe(40)
        })

        it('applies levels at the end of a settle, not during it', () => {
            const result = settle(input({ position: at(1, 1), elapsedSeconds: 8 * 3600 }))
            expect(result.heroLevel).toBeGreaterThan(hero.heroLevel)

            // The window was fought at the departure level throughout: the reported rate
            // still matches level-1 stats, not the level the hero ended on.
            const departureDps = partyDps(partyUnitStats(hero), enemyStatsAt(at(1, 1)).def)
            expect(result.secondsPerKill)
                .toBeCloseTo(rateAt(hero, at(1, 1)).secondsPerKill, 10)

            const ended = partyDps(partyUnitStats({ ...hero, heroLevel: result.heroLevel }), enemyStatsAt(at(1, 1)).def)
            expect(ended.gt(departureDps)).toBe(true)
        })

        it('reports the level unchanged when nothing was earned', () => {
            const stalled = settle(input({
                position: firstStallingPosition(hero)!,
                elapsedSeconds: 72 * 3600
            }))
            expect(stalled.kills).toBe(0)
            expect(stalled.heroLevel).toBe(hero.heroLevel)
        })
    })
})
