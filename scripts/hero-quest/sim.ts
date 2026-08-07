/**
 * Combat analysis for Hero Quest.
 *
 * Every number here comes out of the shared pure functions — the same `combat.ts` and
 * `settle.ts` the game itself runs. No formula is restated locally, so a result that looks
 * wrong here is wrong in the game too.
 *
 * Crit-averaged, matching how offline settle resolves (`idle-mechanics.md` §4). There is no
 * per-hit rolling and therefore no variance or win-rate: a verdict here means "wins on
 * expected values", not "wins 60% of the time". Rolled fights are `fight.ts`, Phase 1.
 *
 * Importable directly if you'd rather write your own scratch analysis:
 *
 *     import { analyzeStage, analyzeWorld, minLevelForGate } from './scripts/hero-quest/sim'
 */

import { BOSS_TIMER_SECONDS, STAGES_PER_WORLD, WORLD_COUNT } from '../../shared/utils/hero-quest/constants'
import {
    applyXp,
    enemyStatsAt,
    goldPerKill,
    incomingDps,
    killsRequired,
    secondsPerKill,
    secondsToDie,
    stageArchetype,
    totalXpForLevel,
    xpPerKill
} from '../../shared/utils/hero-quest/settle'
import { partyDps } from '../../shared/utils/hero-quest/combat'
import { partyUnitStats } from '../../shared/utils/hero-quest/stats'
import { CLASS_NODES } from '../../shared/utils/hero-quest/content/classes'
import { ZERO } from '../../shared/utils/hero-quest/numbers'
import type { Decimal } from '../../shared/utils/hero-quest/numbers'
import type { ClassId, HeroSnapshot, StageArchetype } from '../../shared/utils/hero-quest/types'

export type Verdict = 'clear' | 'timer_fail' | 'wipe' | 'stalled'

export interface StageReport {
    world: number
    stage: number
    archetype: StageArchetype
    isGate: boolean
    level: number

    enemyHp: Decimal
    enemyPwr: Decimal
    enemyDef: Decimal

    partyDps: Decimal
    secondsPerKill: number
    killsRequired: number
    clearSeconds: number

    /** Only set on boss stages. `timerMargin` is a fraction: +0.2 means 20% of slack left. */
    timerSeconds: number | null
    timerMargin: number | null

    incomingDps: Decimal
    heroEhp: Decimal
    secondsToDie: number
    /** Seconds the party must survive uninterrupted — the whole stage attempt, boss or wave. */
    survivalWindow: number
    /** secondsToDie / survivalWindow. Below 1 is a wipe; 2 means twice the HP needed. */
    survivalRatio: number

    verdict: Verdict
    goldPerKill: number
}

export function makeHero(classId: ClassId, heroLevel: number, overrides: Partial<HeroSnapshot> = {}): HeroSnapshot {
    return {
        classId,
        heroLevel,
        heroXp: ZERO,
        goldBonusPct: 0,
        offlineEfficiencyLevel: 0,
        offlineCapLevel: 0,
        ...overrides
    }
}

/**
 * A party of `size` total units: the Hero plus `size - 1` Champion stand-ins, each an
 * un-invested clone riding the Hero's level.
 *
 * Deliberately the *weakest* Champion the model allows — rarity 1.0 and investment 1 means
 * no rarity bonus and no dupes — so a measured party gain is a floor, not a best case. Real
 * party size runs 3 (Hero + 2) to 6 (`champions-guild-gacha.md` §1).
 */
export function makeParty(classId: ClassId, heroLevel: number, size: number, overrides: Partial<HeroSnapshot> = {}): HeroSnapshot {
    const champions = Array.from({ length: Math.max(0, Math.floor(size) - 1) }, (_unused, index) => ({
        championId: `champ_stand_in_${index + 1}`,
        rarityMultiplier: 1,
        investment: 1,
        strikesPerAttack: 1
    }))
    return makeHero(classId, heroLevel, { champions, ...overrides })
}

/** Full picture for one stage: can the party kill it, how fast, and does it survive doing so. */
export function analyzeStage(hero: HeroSnapshot, prestige: number, world: number, stage: number): StageReport {
    const position = { prestige, world, stage, killsInStage: 0 }
    const enemy = enemyStatsAt(position)
    const units = partyUnitStats(hero)

    const dps = partyDps(units, enemy.def)
    const spk = secondsPerKill(dps, enemy)
    const archetype = stageArchetype(stage)
    const isGate = archetype === 'boss' || archetype === 'super_boss'
    const kills = killsRequired(position)
    const clearSeconds = isGate ? spk : spk * kills

    // Same two functions `settle()` uses, deliberately — a survivability verdict here that
    // the live game disagreed with would make every table in this tool a lie.
    const incoming = incomingDps(units, enemy)
    const heroEhp = units.reduce((total, unit) => total.add(unit.maxHp), ZERO)
    const timeToDie = secondsToDie(units, enemy)

    const timerSeconds = isGate ? BOSS_TIMER_SECONDS : null
    const timerMargin = timerSeconds === null || !Number.isFinite(clearSeconds)
        ? null
        : (timerSeconds - clearSeconds) / timerSeconds

    /**
     * How long the party must stay alive without a break.
     *
     * **Phase 1 answered the question this used to park.** HP is one pool that carries
     * across a whole stage attempt and refills only on a clear or a wipe — so a wave stage
     * is the same continuous fight a boss is, just against 30 bodies instead of one. The
     * window is the full clear either way, and the earlier one-kill reading (which assumed
     * the party got a breather between enemies) is gone.
     *
     * A wave wipe restarts that stage rather than falling the run back one, so this is a
     * wall the run sits at and levels out of, not a loss of ground (`settle.killsBeforeWipe`).
     */
    const survivalWindow = clearSeconds
    const survivalRatio = Number.isFinite(timeToDie) && Number.isFinite(survivalWindow) && survivalWindow > 0
        ? timeToDie / survivalWindow
        : Number.POSITIVE_INFINITY

    let verdict: Verdict = 'clear'
    if (!Number.isFinite(spk)) verdict = 'stalled'
    else if (timeToDie < survivalWindow) verdict = 'wipe'
    else if (isGate && clearSeconds > BOSS_TIMER_SECONDS) verdict = 'timer_fail'

    return {
        world,
        stage,
        archetype,
        isGate,
        level: hero.heroLevel,
        enemyHp: enemy.hp,
        enemyPwr: enemy.pwr,
        enemyDef: enemy.def,
        partyDps: dps,
        secondsPerKill: spk,
        killsRequired: kills,
        clearSeconds,
        timerSeconds,
        timerMargin,
        incomingDps: incoming,
        heroEhp,
        secondsToDie: timeToDie,
        survivalWindow,
        survivalRatio,
        verdict,
        goldPerKill: goldPerKill(prestige, world, stage)
    }
}

export interface WorldReport {
    world: number
    prestige: number
    rows: StageReport[]
    startLevel: number
    endLevel: number
    totalSeconds: number
    totalGold: number
    firstBlocker: StageReport | null
}

/**
 * Walks all ten stages, feeding each stage's XP back in before the next.
 *
 * Deliberately levels mid-walk, unlike `settle` — this projects a real playthrough, so a
 * frozen hero would report clear times for a run nobody plays. Pass `levelUp: false` to
 * hold power fixed and see one snapshot's reach instead.
 */
export function analyzeWorld(hero: HeroSnapshot, prestige: number, world: number, levelUp = true): WorldReport {
    let level = hero.heroLevel
    let xp = hero.heroXp
    let totalSeconds = 0
    let totalGold = 0
    const rows: StageReport[] = []

    for (let stage = 1; stage <= STAGES_PER_WORLD; stage++) {
        const row = analyzeStage(makeHero(hero.classId, level, { ...hero, heroLevel: level, heroXp: xp }), prestige, world, stage)
        rows.push(row)

        if (Number.isFinite(row.clearSeconds)) totalSeconds += row.clearSeconds
        totalGold += row.goldPerKill * (row.isGate ? 1 : row.killsRequired)

        if (levelUp && Number.isFinite(row.secondsPerKill) && row.killsRequired > 0) {
            const gained = xpPerKill(prestige, world, stage).mul(row.killsRequired)
            const levelled = applyXp(level, xp, gained)
            level = levelled.level
            xp = levelled.xp
        }
    }

    return {
        world,
        prestige,
        rows,
        startLevel: hero.heroLevel,
        endLevel: level,
        totalSeconds,
        totalGold,
        firstBlocker: rows.find(row => row.verdict !== 'clear') ?? null
    }
}

/**
 * Lowest hero level that clears a stage — the number that actually answers "is this gate
 * tuned right". Binary search is valid because damage rises monotonically with level.
 */
export function minLevelForGate(
    classId: ClassId,
    prestige: number,
    world: number,
    stage: number,
    maxLevel = 5000,
    party = 1
): number | null {
    return minLevelToClear(makeParty(classId, 1, party), prestige, world, stage, 1, maxLevel)
}

/**
 * Same binary search, but from an existing hero snapshot and an arbitrary floor — the
 * campaign walker already knows the level it is standing on, so it never searches below it.
 */
export function minLevelToClear(
    hero: HeroSnapshot,
    prestige: number,
    world: number,
    stage: number,
    fromLevel = 1,
    maxLevel = 5000
): number | null {
    const at = (level: number) => ({ ...hero, heroLevel: level, heroXp: ZERO })
    const clears = (level: number) => analyzeStage(at(level), prestige, world, stage).verdict === 'clear'

    const low0 = Math.max(1, Math.floor(fromLevel))
    if (low0 >= maxLevel) return clears(maxLevel) ? maxLevel : null
    if (clears(low0)) return low0
    if (!clears(maxLevel)) return null

    let low = low0
    let high = maxLevel
    while (low + 1 < high) {
        const mid = Math.floor((low + high) / 2)
        if (clears(mid)) high = mid
        else low = mid
    }
    return high
}

export interface GateRow {
    world: number
    bossLevel: number | null
    superBossLevel: number | null
    /** Levels between the two gates — a big jump means the world back-loads its difficulty. */
    gap: number | null
}

/** Min level for every boss gate in the game. The fastest read on whether the curve holds. */
export function gateTable(classId: ClassId, prestige: number, worlds = WORLD_COUNT, party = 1): GateRow[] {
    const rows: GateRow[] = []
    for (let world = 1; world <= worlds; world++) {
        const bossLevel = minLevelForGate(classId, prestige, world, 5, 5000, party)
        const superBossLevel = minLevelForGate(classId, prestige, world, STAGES_PER_WORLD, 5000, party)
        rows.push({
            world,
            bossLevel,
            superBossLevel,
            gap: bossLevel !== null && superBossLevel !== null ? superBossLevel - bossLevel : null
        })
    }
    return rows
}

// ── Campaign walk ──────────────────────────────────────────────────────────────────────

export type WallReason =
    /** No level inside the search ceiling clears the stage — the curve has outrun the hero. */
    | 'unclearable'
    /** Nowhere left to farm: every earlier stage is a wipe or deals zero damage. */
    | 'unfarmable'
    /** Clearable in principle, but the grind to get there exceeds the time budget. */
    | 'grind_budget'
    /** Ran out of prestiges before running out of road. Not a wall — the walk just stopped. */
    | 'prestige_limit'

/** One forced farming detour: the run got stuck, went back, and levelled until it wasn't. */
export interface GrindEvent {
    prestige: number
    world: number
    stage: number
    /** Why the stage refused the first attempt. */
    blockedBy: Verdict
    farmWorld: number
    farmStage: number
    fromLevel: number
    toLevel: number
    kills: number
    seconds: number
    gold: number
}

export interface CampaignWall {
    reason: WallReason
    prestige: number
    world: number
    stage: number
    archetype: StageArchetype
    verdict: Verdict
    /** Level the stage demands, when one exists inside the search ceiling. */
    requiredLevel: number | null
    level: number
    detail: string
}

export interface CampaignWorldRow {
    prestige: number
    world: number
    startLevel: number
    endLevel: number
    /** Time spent on stages that were cleared on sight. */
    fightSeconds: number
    /** Time spent farming earlier stages to get unstuck. */
    grindSeconds: number
    gold: number
    grinds: number
    /** False on the world the wall landed in. */
    completed: boolean
}

export interface CampaignOptions {
    /** Prestiges to walk before giving up on finding a wall. */
    maxPrestige?: number
    /** Grind allowed per blocked stage before it counts as a wall. */
    grindBudgetSeconds?: number
    /** Ceiling for the level search. A stage needing more than this reads as unclearable. */
    maxLevel?: number
}

export interface CampaignReport {
    rows: CampaignWorldRow[]
    grinds: GrindEvent[]
    wall: CampaignWall
    startPrestige: number
    startLevel: number
    endLevel: number
    fightSeconds: number
    grindSeconds: number
    totalSeconds: number
    totalGold: number
    /** Full ten-world loops finished, i.e. prestiges earned. */
    prestigesCompleted: number
}

export const DEFAULT_CAMPAIGN_MAX_PRESTIGE = 10
export const DEFAULT_GRIND_BUDGET_SECONDS = 24 * 3600
export const DEFAULT_CAMPAIGN_MAX_LEVEL = 5000

/** A boss is a single kill; a wave stage is `BASE_KILL_COUNT` of them. */
function killsFor(row: StageReport): number {
    return row.isGate ? 1 : row.killsRequired
}

/**
 * Deepest stage behind the run that the hero can actually farm.
 *
 * Mirrors `fallbackStage` — a lost fight sends the run back one stage — but keeps walking
 * when that stage is also unclearable, crossing world boundaries if it has to. Gates are
 * skipped: a boss is one kill on a one-way door, not a farm.
 *
 * Note this is the *deepest* clearable stage, not the XP-optimal one. Under the current
 * curve XP/second actually falls with depth (XP rides 1.05^stage, enemy HP 1.15^stage), so
 * a player min-maxing would farm shallower and grind faster than this reports.
 */
function farmStageFor(hero: HeroSnapshot, prestige: number, world: number, stage: number): StageReport | null {
    let w = world
    let s = stage - 1
    while (w >= 1) {
        while (s >= 1) {
            const archetype = stageArchetype(s)
            if (archetype !== 'boss' && archetype !== 'super_boss') {
                const row = analyzeStage(hero, prestige, w, s)
                if (row.verdict === 'clear' && Number.isFinite(row.secondsPerKill)) return row
            }
            s--
        }
        w--
        s = STAGES_PER_WORLD
    }
    return null
}

/**
 * Walk stages → worlds → prestiges until the run cannot continue.
 *
 * Unlike `analyzeWorld`, a failed stage does not end the walk. The run falls back and farms
 * until it out-levels the blocker, exactly as the soft-fail rule describes, and only stops
 * when farming stops working — which is the wall this is built to find. Three shapes it
 * takes, and they want different fixes:
 *
 * - `unclearable` — no level clears the stage. The enemy curve has outrun stat growth
 *   outright, usually via DEF reaching `PWR × K` (see the `STALLED` verdict).
 * - `grind_budget` — clearable, but the hours needed exceed `grindBudgetSeconds`. A pacing
 *   problem, not a math one; XP or stat growth is the dial.
 * - `unfarmable` — nowhere left to earn XP at all. Rare, and means the wall is behind you.
 *
 * Prestige carries Hero level and XP forward and resets only the run position, matching
 * `settleHq`'s prestige path.
 */
export function analyzeCampaign(
    hero: HeroSnapshot,
    startPrestige = 0,
    options: CampaignOptions = {}
): CampaignReport {
    const maxPrestige = options.maxPrestige ?? DEFAULT_CAMPAIGN_MAX_PRESTIGE
    const grindBudget = options.grindBudgetSeconds ?? DEFAULT_GRIND_BUDGET_SECONDS
    const maxLevel = options.maxLevel ?? DEFAULT_CAMPAIGN_MAX_LEVEL

    let level = hero.heroLevel
    let xp = hero.heroXp
    let fightSeconds = 0
    let grindSeconds = 0
    let totalGold = 0
    let prestigesCompleted = 0

    const rows: CampaignWorldRow[] = []
    const grinds: GrindEvent[] = []
    const at = () => ({ ...hero, heroLevel: level, heroXp: xp })

    let wall: CampaignWall | null = null

    for (let prestige = startPrestige; prestige <= startPrestige + maxPrestige && !wall; prestige++) {
        for (let world = 1; world <= WORLD_COUNT && !wall; world++) {
            const startLevel = level
            let worldFight = 0
            let worldGrind = 0
            let worldGold = 0
            let worldGrinds = 0
            let completed = true

            for (let stage = 1; stage <= STAGES_PER_WORLD; stage++) {
                let row = analyzeStage(at(), prestige, world, stage)

                if (row.verdict !== 'clear') {
                    const detour = resolveBlock(at(), prestige, world, stage, row, level, xp, maxLevel, grindBudget)
                    if ('wall' in detour) {
                        wall = detour.wall
                        completed = false
                        break
                    }

                    level = detour.level
                    xp = detour.xp
                    worldGrind += detour.event.seconds
                    worldGold += detour.event.gold
                    worldGrinds++
                    grinds.push(detour.event)

                    row = analyzeStage(at(), prestige, world, stage)
                    if (row.verdict !== 'clear') {
                        // Levelled past the searched threshold and still stuck: only reachable if
                        // clearing is non-monotonic in level, which would be a combat-math bug.
                        wall = {
                            reason: 'unclearable',
                            prestige,
                            world,
                            stage,
                            archetype: row.archetype,
                            verdict: row.verdict,
                            requiredLevel: null,
                            level,
                            detail: `still ${row.verdict} at level ${level} after grinding to the searched clear level — clearing is not monotonic in level`
                        }
                        completed = false
                        break
                    }
                }

                const kills = killsFor(row)
                worldFight += row.clearSeconds
                worldGold += row.goldPerKill * kills
                const levelled = applyXp(level, xp, xpPerKill(prestige, world, stage).mul(kills))
                level = levelled.level
                xp = levelled.xp
            }

            fightSeconds += worldFight
            grindSeconds += worldGrind
            totalGold += worldGold
            rows.push({
                prestige,
                world,
                startLevel,
                endLevel: level,
                fightSeconds: worldFight,
                grindSeconds: worldGrind,
                gold: worldGold,
                grinds: worldGrinds,
                completed
            })

            if (completed && world === WORLD_COUNT) prestigesCompleted++
        }
    }

    return {
        rows,
        grinds,
        wall: wall ?? {
            reason: 'prestige_limit',
            prestige: startPrestige + maxPrestige,
            world: WORLD_COUNT,
            stage: STAGES_PER_WORLD,
            archetype: stageArchetype(STAGES_PER_WORLD),
            verdict: 'clear',
            requiredLevel: null,
            level,
            detail: `no wall inside ${maxPrestige} prestige(s) — raise --max-prestige to keep walking`
        },
        startPrestige,
        startLevel: hero.heroLevel,
        endLevel: level,
        fightSeconds,
        grindSeconds,
        totalSeconds: fightSeconds + grindSeconds,
        totalGold,
        prestigesCompleted
    }
}

/**
 * Get unstuck, or explain why the run can't be.
 *
 * XP needed is solved from the level curve rather than simulated kill by kill — the deficit
 * reaches magnitudes where a loop would run for millions of iterations.
 */
function resolveBlock(
    hero: HeroSnapshot,
    prestige: number,
    world: number,
    stage: number,
    blocked: StageReport,
    level: number,
    xp: Decimal,
    maxLevel: number,
    grindBudget: number
): { level: number; xp: Decimal; event: GrindEvent } | { wall: CampaignWall } {
    const base: Omit<CampaignWall, 'reason' | 'requiredLevel' | 'detail'> = {
        prestige,
        world,
        stage,
        archetype: blocked.archetype,
        verdict: blocked.verdict,
        level
    }

    const required = minLevelToClear(hero, prestige, world, stage, level + 1, maxLevel)
    if (required === null) {
        return {
            wall: {
                ...base,
                reason: 'unclearable',
                requiredLevel: null,
                detail: `no level up to ${maxLevel} clears this stage (${blocked.verdict} at level ${level})`
            }
        }
    }

    const farm = farmStageFor(hero, prestige, world, stage)
    if (!farm) {
        return {
            wall: {
                ...base,
                reason: 'unfarmable',
                requiredLevel: required,
                detail: `needs level ${required}, and no earlier stage is farmable at level ${level}`
            }
        }
    }

    const perKill = xpPerKill(prestige, farm.world, farm.stage)
    const deficit = totalXpForLevel(required).sub(totalXpForLevel(level).add(xp))
    const kills = deficit.lte(0) ? 0 : deficit.div(perKill).ceil().toNumber()
    const seconds = kills * farm.secondsPerKill

    if (!Number.isFinite(seconds) || seconds > grindBudget) {
        return {
            wall: {
                ...base,
                reason: 'grind_budget',
                requiredLevel: required,
                detail: `needs level ${required} (from ${level}) — ${formatGrind(seconds)} of farming W${farm.world}S${farm.stage}, over the ${formatGrind(grindBudget)} budget`
            }
        }
    }

    const levelled = applyXp(level, xp, perKill.mul(kills))
    return {
        level: levelled.level,
        xp: levelled.xp,
        event: {
            prestige,
            world,
            stage,
            blockedBy: blocked.verdict,
            farmWorld: farm.world,
            farmStage: farm.stage,
            fromLevel: level,
            toLevel: levelled.level,
            kills,
            seconds,
            gold: kills * farm.goldPerKill
        }
    }
}

/** Local to the wall messages — `formatSeconds` lives in the shared layer, this is prose. */
function formatGrind(seconds: number): string {
    if (!Number.isFinite(seconds)) return 'unbounded'
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
    return `${(seconds / 86400).toFixed(1)}d`
}

export interface ClassRow {
    classId: ClassId
    name: string
    tier: string
    partyDps: Decimal
    heroEhp: Decimal
    secondsPerKill: number
    clearSeconds: number
    verdict: Verdict
}

/** Every class side by side at the same level and stage. Shows whether the paths diverge. */
export function compareClasses(prestige: number, world: number, stage: number, level: number, party = 1): ClassRow[] {
    return CLASS_NODES.map((node) => {
        const report = analyzeStage(makeParty(node.id, level, party), prestige, world, stage)
        return {
            classId: node.id,
            name: node.name,
            tier: node.tier,
            partyDps: report.partyDps,
            heroEhp: report.heroEhp,
            secondsPerKill: report.secondsPerKill,
            clearSeconds: report.clearSeconds,
            verdict: report.verdict
        }
    }).sort((a, b) => (b.partyDps.gt(a.partyDps) ? 1 : -1))
}
