import { describe, expect, it } from 'vitest'
import { runFight } from '#shared/utils/hero-quest/fight'
import {
    BOSS_MINION_COUNT,
    BOSS_STAGE,
    BOSS_TIMER_SECONDS,
    FROSTBIND_FREEZE_STACKS,
    MIN_DAMAGE,
    SUPER_BOSS_STAGE
} from '#shared/utils/hero-quest/constants'
import { enemyStatsAt } from '#shared/utils/hero-quest/settle'
import { D, ZERO } from '#shared/utils/hero-quest/numbers'
import { kitFor } from '#shared/utils/hero-quest/content/classes'
import {
    CHAMPIONS,
    RARITY_STAT_MULTIPLIER,
    getChampion,
    type ChampionDefinition
} from '#shared/utils/hero-quest/content/champions'
import type { ChampionSnapshot, ClassId, HeroSnapshot, RunPosition } from '#shared/utils/hero-quest/types'

function hero(heroLevel: number, classId: ClassId = 'class_beginner'): HeroSnapshot {
    return { classId, heroLevel, heroXp: ZERO, goldBonusPct: 0, offlineEfficiencyLevel: 0, offlineCapLevel: 0 }
}

function at(world: number, stage: number, prestige = 0): RunPosition {
    return { prestige, world, stage, killsInStage: 0 }
}

/**
 * A fielded Champion, built from real roster content so the ability shapes under test are
 * the ones the game actually ships rather than fixtures that can drift from them.
 *
 * Back row by default: the Warrior line the Hero fixtures use defaults to the front, so the
 * Hero soaks the boss and the Champion survives long enough to be measured.
 */
function snapshotOf(definition: ChampionDefinition, overrides: Partial<ChampionSnapshot> = {}): ChampionSnapshot {
    return {
        championId: definition.id,
        archetype: definition.archetype,
        rarityMultiplier: RARITY_STAT_MULTIPLIER[definition.rarity],
        investment: 1,
        strikesPerAttack: definition.strikesPerAttack,
        row: 'back',
        abilities: definition.abilities,
        ...overrides
    }
}

function withParty(base: HeroSnapshot, champions: ChampionSnapshot[]): HeroSnapshot {
    return { ...base, champions }
}

describe('hero-quest seeded fights', () => {
    describe('determinism — the whole point of the replay model', () => {
        it('produces an identical outcome and log for the same seed', () => {
            const input = { hero: hero(40), position: at(1, BOSS_STAGE), seed: 123456 }
            const first = runFight(input)
            const second = runFight(input)

            expect(second.outcome).toBe(first.outcome)
            expect(second.secondsElapsed).toBe(first.secondsElapsed)
            expect(second.enemyHpRemaining).toBe(first.enemyHpRemaining)
            expect(second.events).toEqual(first.events)
        })

        it('diverges on a different seed, so crit is genuinely rolled', () => {
            const base = { hero: hero(40), position: at(1, BOSS_STAGE) }
            const logs = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => runFight({ ...base, seed })
                .events.filter(event => event.kind === 'attack').map(event => event.crit).join(''))

            // Averaged crit would make every seed identical; rolled crit must not.
            expect(new Set(logs).size).toBeGreaterThan(1)
        })

        it('echoes the seed back so the client can replay without being told twice', () => {
            expect(runFight({ hero: hero(40), position: at(1, BOSS_STAGE), seed: 99 }).seed).toBe(99)
        })
    })

    describe('outcomes', () => {
        it('wins when the party out-damages the boss inside the timer', () => {
            const result = runFight({ hero: hero(200), position: at(1, BOSS_STAGE), seed: 7 })
            expect(result.outcome).toBe('win')
            expect(result.enemyHpRemaining).toBe('0')
            expect(result.damageDealtPct).toBe(1)
            expect(result.secondsElapsed).toBeLessThanOrEqual(BOSS_TIMER_SECONDS)
            expect(result.events.at(-1)!.kind).toBe('enemy_down')
        })

        it('times out at exactly the boss timer, never past it', () => {
            // Enough DPS to scratch the super boss, nowhere near enough to fell it in 30s —
            // and now also enough HP to still be standing at 30s, which is the narrow part.
            // The window is genuinely narrow, and the session-2 enemy cut narrowed it further
            // and moved it down: at W3S10 the band is levels 56–60 exactly, 80 now wins. 58 is
            // its middle. If this ever goes red, re-find the band rather than nudging the level.
            const result = runFight({ hero: hero(58), position: at(3, SUPER_BOSS_STAGE), seed: 7 })
            expect(result.outcome).toBe('timeout')
            expect(result.secondsElapsed).toBe(BOSS_TIMER_SECONDS)
            expect(D(result.enemyHpRemaining).gt(0)).toBe(true)
        })

        it('reports how close a loss came, for the retry decision', () => {
            const result = runFight({ hero: hero(30), position: at(3, SUPER_BOSS_STAGE), seed: 7 })
            expect(result.damageDealtPct).toBeGreaterThanOrEqual(0)
            expect(result.damageDealtPct).toBeLessThan(1)
        })

        it('wipes when the boss kills the party first', () => {
            const result = runFight({ hero: hero(1), position: at(6, SUPER_BOSS_STAGE), seed: 7 })
            expect(result.outcome).toBe('wipe')
            expect(result.secondsElapsed).toBeLessThan(BOSS_TIMER_SECONDS)
            expect(result.events.some(event => event.kind === 'unit_down')).toBe(true)
        })

        it('never reports negative enemy HP after an overkill', () => {
            const result = runFight({ hero: hero(500), position: at(1, BOSS_STAGE), seed: 7 })
            expect(D(result.enemyHpRemaining).gte(0)).toBe(true)
            for (const event of result.events) {
                if (event.remainingHp) expect(D(event.remainingHp).gte(0)).toBe(true)
            }
        })
    })

    describe('the minimum-damage floor', () => {
        // Deep enough that enemy DEF is far past the party's PWR × K clamp.
        const hopeless = (seed: number) => runFight({ hero: hero(1), position: at(8, SUPER_BOSS_STAGE), seed })

        it('still chips for MIN_DAMAGE once enemy DEF passes the PWR × K threshold', () => {
            // Swept across seeds rather than pinned to one: a hopeless fight is short, so any
            // single seed may happen to crit every swing, and a crit multiplies *up* from the
            // floor. Over a dozen seeds at least one plain hit lands on it exactly.
            const hits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                .flatMap(seed => hopeless(seed).events)
                .filter(event => event.kind === 'attack' || event.kind === 'skill')
                .map(event => D(event.damage!))

            expect(hits.length).toBeGreaterThan(0)
            // Never zero — that hard stall is exactly what MIN_DAMAGE replaced.
            for (const damage of hits) expect(damage.gte(MIN_DAMAGE), damage.toString()).toBe(true)

            const smallest = hits.reduce((low, damage) => damage.lt(low) ? damage : low)
            expect(smallest.toNumber()).toBe(MIN_DAMAGE)
        })

        it('still ends rather than looping forever when neither side can meaningfully hurt the other', () => {
            expect(['timeout', 'wipe']).toContain(hopeless(7).outcome)
        })
    })

    describe('the boss escort', () => {
        // A boss now stands with `BOSS_MINION_COUNT` trash minions, and the 30s timer covers
        // the whole encounter — so the escort is time taken off the boss, not free damage.
        const escorted = (level: number, world = 1) =>
            runFight({ hero: hero(level, 'class_berserker'), position: at(world, BOSS_STAGE), seed: 7 })

        it('resolves every body in the encounter, escort first', () => {
            const result = escorted(200)
            const downed = result.events.filter(event => event.kind === 'enemy_down')

            expect(downed).toHaveLength(BOSS_MINION_COUNT + 1)
            // Index order is kill order: minions carry the low indices, the boss the last.
            expect(downed.map(event => event.enemyIndex))
                .toEqual(Array.from({ length: BOSS_MINION_COUNT + 1 }, (_unused, index) => index))
            expect(result.outcome).toBe('win')
        })

        it('attributes every hit to the body it landed on', () => {
            const hits = escorted(200).events.filter(event => event.kind === 'attack' || event.kind === 'skill')
            expect(hits.length).toBeGreaterThan(0)
            for (const hit of hits) {
                expect(hit.enemyIndex, JSON.stringify(hit)).toBeDefined()
                expect(hit.enemyIndex!).toBeLessThanOrEqual(BOSS_MINION_COUNT)
            }
        })

        it('lets the escort swing too, so incoming damage is the whole encounter', () => {
            // A losing fight, so the escort survives long enough to be counted. World 4, not
            // World 1: after the session-2 enemy cut a level-1 Hero *wins* the World 1 boss
            // and fells the whole escort before it takes a swing, which would make this spec
            // pass or fail on the opening's difficulty rather than on who is allowed to attack.
            const incoming = escorted(1, 4).events.filter(event => event.kind === 'enemy_attack')
            expect(incoming.length).toBeGreaterThan(0)
            // More than one distinct attacker — the boss is not the only stream any more.
            expect(new Set(incoming.map(event => event.enemyIndex)).size).toBeGreaterThan(1)
        })

        it('counts the whole encounter in enemyMaxHp, not the boss alone', () => {
            const result = escorted(200)
            expect(D(result.enemyMaxHp).gt(enemyStatsAt(at(1, BOSS_STAGE)).hp)).toBe(true)
        })
    })


    describe('effects, resolved in a real fight', () => {
        // Closes the gap left open at the end of Stage 2: the status engine's wiring into
        // `runFight` is now reachable through the real path, because abilities apply statuses.
        /**
         * Deep enough that the fight runs long rather than ending in the first second.
         * Abilities sit on a shared cooldown, so a fixture the party one-shots proves nothing
         * about effects — no kit ever gets to fire.
         *
         * W4/60 → W3/15 with the session-2 enemy cut. Two things moved at once: at the old
         * fixture the pack no longer survived to the first cast (Meteor Shower never landed a
         * burn), and a level-60 Hero's cooldowns are short enough that the whole kit fires in
         * one 2.4s volley, which is not "a real fight" in any sense this block cares about.
         * W3/15 restores a ~5s fight with all three bodies standing when the first AoE lands.
         *
         * The band that satisfies every spec below is **W3, levels 10–19** — 15 is its middle.
         * Levels 20+ let the Hero fell a minion before Arrow Rain resolves, and below 10 the
         * Frostbind stacks never reach their threshold. Re-find the band rather than nudging.
         */
        const fight = (classId: ClassId, level = 15) =>
            runFight({ hero: hero(level, classId), position: at(3, SUPER_BOSS_STAGE), seed: 7 })

        it('lands an AoE on every living body at once', () => {
            // Marksman's Arrow Rain hits every spot; a boss encounter holds three.
            const result = fight('class_marksman')
            const rain = result.events.filter(event => event.skillId === 'skill_arrow_rain')
            const firstVolley = rain.filter(event => event.at === rain[0]!.at)

            expect(new Set(firstVolley.map(event => event.enemyIndex)).size)
                .toBe(BOSS_MINION_COUNT + 1)
        })

        it('pierces exactly two bodies, not the whole board', () => {
            const result = fight('class_archer')
            const pierce = result.events.filter(event => event.skillId === 'skill_piercing_arrow')
            const firstVolley = pierce.filter(event => event.at === pierce[0]!.at)

            // A boss pack is 2 front + 1 back, so a column is exactly two deep.
            expect(new Set(firstVolley.map(event => event.enemyIndex)).size).toBe(2)
        })

        it('always crits with Kill Shot, and harder than a normal crit', () => {
            const result = fight('class_hunter')
            const killShots = result.events.filter(event => event.skillId === 'skill_kill_shot')
            expect(killShots.length).toBeGreaterThan(0)
            expect(killShots.every(event => event.crit === true)).toBe(true)

            // Against the same body, a Kill Shot must beat this unit's ordinary crit — that is
            // the whole of "double crit damage".
            const ordinaryCrit = result.events.find(event =>
                event.kind === 'attack' && event.crit === true)
            if (ordinaryCrit) {
                expect(D(killShots[0]!.damage!).gt(D(ordinaryCrit.damage!))).toBe(true)
            }
        })

        it('logs a utility ability firing even though it deals no damage', () => {
            // Haste is a pure self-buff. Without an explicit cast event the replay would show
            // a buff appearing with nothing having cast it.
            const result = fight('class_beginner')
            const haste = result.events.filter(event => event.skillId === 'skill_haste')

            expect(haste.length).toBeGreaterThan(0)
            expect(haste.every(event => event.damage === '0')).toBe(true)
            expect(result.events.some(event =>
                event.kind === 'status_applied' && event.statusId === 'skill_haste')).toBe(true)
        })

        it('stuns the encounter with Shockwave, suppressing its swings', () => {
            const result = fight('class_knight')
            expect(result.events.some(event =>
                event.kind === 'status_applied' && event.statusId === 'skill_shockwave'
                && event.onEnemy === true)).toBe(true)
        })

        it('applies Threatening Roar to every enemy and taunts on the caster', () => {
            const result = fight('class_barbarian')
            const roar = result.events.filter(event => event.statusId === 'skill_threatening_roar')

            expect(roar.some(event => event.onEnemy === true)).toBe(true)
            // The taunt lands on the roarer, so it carries a unit index and no enemy flag.
            expect(roar.some(event => event.unitIndex === 0 && event.onEnemy !== true)).toBe(true)
        })

        it('heals the party with an ally-targeted ability', () => {
            // Paladin's Disciple tends the party rather than striking anything.
            const result = fight('class_paladin')
            expect(result.events.some(event => event.kind === 'heal')).toBe(true)
        })

        it('burns a target down over time from Meteor Shower', () => {
            const result = fight('class_sorcerer')
            expect(result.events.some(event =>
                event.kind === 'status_applied' && event.statusId === 'skill_meteor_shower')).toBe(true)
            expect(result.events.some(event => event.kind === 'status_tick')).toBe(true)
        })

        it('escalates a stacking debuff into its threshold effect', () => {
            // Frostbind: the slow builds, and the freeze lands on whichever cast carries the
            // target to `FROSTBIND_FREEZE_STACKS`. A Mythic Control Champion brings it.
            const frostbinder = CHAMPIONS.find(champion =>
                champion.abilities.some(ability => ability.name === 'Frostbind'))!
            const result = runFight({
                hero: withParty(hero(60, 'class_beginner'), [snapshotOf(frostbinder)]),
                position: at(4, SUPER_BOSS_STAGE),
                seed: 7
            })

            const slowId = frostbinder.abilities.find(a => a.name === 'Frostbind')!.id
            const applications = result.events.filter(event => event.statusId === slowId)
            const freezes = result.events.filter(event => event.statusId === `${slowId}_escalation`)

            expect(applications.length).toBeGreaterThanOrEqual(FROSTBIND_FREEZE_STACKS)
            expect(freezes.length).toBeGreaterThan(0)
            // The freeze cannot precede the cast that built the stacks to the threshold.
            expect(freezes[0]!.at).toBeGreaterThanOrEqual(applications[0]!.at)
        })

        it('stays deterministic with effects in play', () => {
            const input = { hero: hero(60, 'class_sorcerer'), position: at(4, SUPER_BOSS_STAGE), seed: 4242 }
            expect(runFight(input).events).toEqual(runFight(input).events)
        })
    })

    describe('the kit', () => {
        it('fires every skill the class path owns, not just the deepest node\'s', () => {
            const result = runFight({ hero: hero(60, 'class_berserker'), position: at(5, BOSS_STAGE), seed: 7 })
            const fired = new Set(result.events.filter(event => event.kind === 'skill').map(event => event.skillId))
            for (const skill of kitFor('class_berserker')) {
                expect(fired.has(skill.id), skill.id).toBe(true)
            }
        })

        it('gives a Beginner exactly one skill and a Master four', () => {
            expect(kitFor('class_beginner')).toHaveLength(1)
            expect(kitFor('class_berserker')).toHaveLength(4)
        })

        it('hits harder than autoattacks alone, since skills carry a multiplier', () => {
            const result = runFight({ hero: hero(60, 'class_berserker'), position: at(5, BOSS_STAGE), seed: 7 })
            const uncrit = (kind: string) => result.events
                .filter(event => event.kind === kind && event.crit === false)
                .map(event => D(event.damage!))

            const attack = uncrit('attack')[0]
            const skill = uncrit('skill')[0]
            expect(attack, 'expected at least one non-crit autoattack').toBeDefined()
            expect(skill, 'expected at least one non-crit skill hit').toBeDefined()
            expect(skill!.gt(attack!)).toBe(true)
        })
    })

    describe('champion kits', () => {
        // The Phase 2 roster's shapes: a Common brings one ability, a Mythic three (§2).
        const rask = getChampion('champ_rask')
        const kaira = getChampion('champ_kaira')

        /**
         * A boss tanky enough that every kit gets to cycle before the fight resolves.
         *
         * Deliberately not a quick win. The skill loop breaks the instant the boss dies, and
         * abilities share `SKILL_BASE_COOLDOWN_SECONDS`, so a kit fires as one volley — kill
         * the boss mid-volley and a three-ability Mythic reads as a two-ability one, which
         * would be a property of the fixture rather than of the kit. At this depth the Hero's
         * four skills and a Mythic's three all come off cooldown at least once.
         *
         * W6/80 → W4/18 with the session-2 enemy cut: at the old depth the party now wipes on
         * the boss's first swing at 2.4s, before the Hero's later skills come round. The band
         * where every Berserker skill and every Kaira and Rask ability fires is **W4, levels
         * 10–25**; 18 is its middle and the fight runs ~7.6s.
         */
        const deepFight = (champions: ChampionSnapshot[]) => runFight({
            hero: withParty(hero(18, 'class_berserker'), champions),
            position: at(4, SUPER_BOSS_STAGE),
            seed: 7
        })

        it('fires a fielded Champion\'s own abilities, not just the Hero\'s', () => {
            const result = deepFight([snapshotOf(kaira)])
            const fired = new Set(result.events.filter(event => event.kind === 'skill').map(event => event.skillId))

            for (const ability of kaira.abilities) {
                expect(fired.has(ability.id), ability.id).toBe(true)
            }
            // The Hero's kit must not have been displaced by the Champion's.
            for (const skill of kitFor('class_berserker')) {
                expect(fired.has(skill.id), skill.id).toBe(true)
            }
        })

        it('attributes each skill event to the unit that cast it', () => {
            const result = deepFight([snapshotOf(kaira)])
            const abilityIds = new Set(kaira.abilities.map(ability => ability.id))
            const casts = result.events.filter(event => event.kind === 'skill' && abilityIds.has(event.skillId!))

            expect(casts.length).toBeGreaterThan(0)
            // Index 1 — `partyUnitStats` builds the Hero first, then the fielded Champions.
            for (const cast of casts) expect(cast.unitIndex).toBe(1)
        })

        it('gives a Mythic more distinct abilities than a Common, the rarity payoff', () => {
            const distinctFor = (champion: ChampionDefinition) => {
                const result = deepFight([snapshotOf(champion)])
                const ids = new Set(champion.abilities.map(ability => ability.id))
                return new Set(result.events
                    .filter(event => event.kind === 'skill' && ids.has(event.skillId!))
                    .map(event => event.skillId)).size
            }

            expect(distinctFor(rask)).toBe(1)
            expect(distinctFor(kaira)).toBe(3)
        })

        it('leaves an abilityless Champion as a pure autoattacker', () => {
            const result = deepFight([snapshotOf(rask, { abilities: [] })])
            // A fielded body with an empty kit still swings, it just never casts.
            expect(result.events.some(event => event.kind === 'attack' && event.unitIndex === 1)).toBe(true)
            expect(result.events.some(event => event.kind === 'skill' && event.unitIndex === 1)).toBe(false)
        })
    })

    describe('multi-strike', () => {
        it('folds Hunter\'s triple strike into one attack instant', () => {
            const result = runFight({ hero: hero(60, 'class_hunter'), position: at(5, BOSS_STAGE), seed: 7 })
            const firstInstant = result.events.find(event => event.kind === 'attack')!.at
            const strikes = result.events.filter(event => event.kind === 'attack' && event.at === firstInstant)
            expect(strikes).toHaveLength(3)
        })

        it('gives Beast Master four strikes to Hunter\'s three', () => {
            const strikesFor = (classId: ClassId) => {
                const result = runFight({ hero: hero(60, classId), position: at(5, BOSS_STAGE), seed: 7 })
                const firstInstant = result.events.find(event => event.kind === 'attack')!.at
                return result.events.filter(event => event.kind === 'attack' && event.at === firstInstant).length
            }
            expect(strikesFor('class_beast_master')).toBe(4)
            expect(strikesFor('class_hunter')).toBe(3)
        })
    })

    describe('the enemy side', () => {
        it('resolves the super boss as the heavier of the two gates', () => {
            const boss = enemyStatsAt(at(1, BOSS_STAGE))
            const superBoss = enemyStatsAt(at(1, SUPER_BOSS_STAGE))
            expect(superBoss.hp.gt(boss.hp)).toBe(true)
        })

        it('attacks the party over the course of the fight', () => {
            const result = runFight({ hero: hero(30), position: at(3, SUPER_BOSS_STAGE), seed: 7 })
            expect(result.events.some(event => event.kind === 'enemy_attack')).toBe(true)
        })

        it('orders every event by time', () => {
            const result = runFight({ hero: hero(30), position: at(3, SUPER_BOSS_STAGE), seed: 7 })
            for (let index = 1; index < result.events.length; index++) {
                expect(result.events[index]!.at).toBeGreaterThanOrEqual(result.events[index - 1]!.at)
            }
        })
    })
})
