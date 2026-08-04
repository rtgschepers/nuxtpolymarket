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
    killsRequired,
    secondsPerKill,
    stageArchetype,
    xpPerKill
} from '../../shared/utils/hero-quest/settle'
import { expectedIncomingDps, partyDps } from '../../shared/utils/hero-quest/combat'
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
    /** Seconds the party must survive uninterrupted: a whole boss fight, or one wave kill. */
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

    const incoming = units.reduce((total, unit) => total.add(expectedIncomingDps(enemy, unit)), ZERO)
    const heroEhp = units.reduce((total, unit) => total.add(unit.maxHp), ZERO)
    const secondsToDie = incoming.lte(0) ? Number.POSITIVE_INFINITY : heroEhp.div(incoming).toNumber()

    const timerSeconds = isGate ? BOSS_TIMER_SECONDS : null
    const timerMargin = timerSeconds === null || !Number.isFinite(clearSeconds)
        ? null
        : (timerSeconds - clearSeconds) / timerSeconds

    /**
     * How long the party must stay alive without a break.
     *
     * A boss is one continuous fight, so the window is the whole clear. A wave stage is 30
     * separate enemies, so it's one kill — the party is not under fire for all 30 in a row.
     *
     * Caveat worth knowing while reading any survivability number here: **no design doc
     * covers whether HP carries between kills, or regenerates.** If HP does persist across
     * a whole wave stage with no regen, wave survivability is far harsher than this shows.
     * Phase 1 has to answer that; until it does, this is the optimistic reading.
     */
    const survivalWindow = isGate ? clearSeconds : spk
    const survivalRatio = Number.isFinite(secondsToDie) && Number.isFinite(survivalWindow) && survivalWindow > 0
        ? secondsToDie / survivalWindow
        : Number.POSITIVE_INFINITY

    let verdict: Verdict = 'clear'
    if (!Number.isFinite(spk)) verdict = 'stalled'
    else if (secondsToDie < survivalWindow) verdict = 'wipe'
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
        secondsToDie,
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
    maxLevel = 5000
): number | null {
    const clears = (level: number) => analyzeStage(makeHero(classId, level), prestige, world, stage).verdict === 'clear'

    if (clears(1)) return 1
    if (!clears(maxLevel)) return null

    let low = 1
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
export function gateTable(classId: ClassId, prestige: number, worlds = WORLD_COUNT): GateRow[] {
    const rows: GateRow[] = []
    for (let world = 1; world <= worlds; world++) {
        const bossLevel = minLevelForGate(classId, prestige, world, 5)
        const superBossLevel = minLevelForGate(classId, prestige, world, STAGES_PER_WORLD)
        rows.push({
            world,
            bossLevel,
            superBossLevel,
            gap: bossLevel !== null && superBossLevel !== null ? superBossLevel - bossLevel : null
        })
    }
    return rows
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
export function compareClasses(prestige: number, world: number, stage: number, level: number): ClassRow[] {
    return CLASS_NODES.map((node) => {
        const report = analyzeStage(makeHero(node.id, level), prestige, world, stage)
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
