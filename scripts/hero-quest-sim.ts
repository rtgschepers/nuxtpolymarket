/**
 * Hero Quest combat sim — the tuning workhorse.
 *
 *   bun run sim:hero-quest                                  # World 1 walk, level 1
 *   bun run sim:hero-quest --report=stage --world=1 --stage=10 --level=14
 *   bun run sim:hero-quest --report=gates                   # min level for every boss gate
 *   bun run sim:hero-quest --report=classes --level=20
 *   bun run sim:hero-quest --set=K=3 --set=BASE_HP=200      # override constants for one run
 *   bun run sim:hero-quest --sweep=K=1..4:0.5               # sweep a dial, tabulate results
 *
 * Flags: --class --level --world --stage --prestige --no-levelup --json
 *
 * Crit-averaged, no per-hit rolling — a verdict is "wins on expected values", not a win
 * rate. Overrides are applied by rewriting `constants.ts` at load time and never touch the
 * file on disk.
 */

import { describeOverrides, parseOverrides, registerTuning } from './hero-quest/tuning'
// Type-only, so these are erased at compile time and never pull constants.ts in early.
import type { ClassId } from '../shared/utils/hero-quest/types'
import type { StageReport, Verdict } from './hero-quest/sim'

const argv = process.argv.slice(2)

function arg(name: string, fallback: string): string {
    const hit = argv.find(entry => entry.startsWith(`--${name}=`))
    return hit ? hit.slice(name.length + 3) : fallback
}
const flag = (name: string) => argv.includes(`--${name}`)

// Must happen before anything pulls in constants.ts, hence the dynamic imports below.
const overrides = parseOverrides(argv)
registerTuning(overrides)

const { analyzeStage, analyzeWorld, compareClasses, gateTable, makeHero } = await import('./hero-quest/sim')
const { formatHq, formatSeconds } = await import('../shared/utils/hero-quest/numbers')
const { BOSS_TIMER_SECONDS } = await import('../shared/utils/hero-quest/constants')
const { getClass } = await import('../shared/utils/hero-quest/content/classes')

const report = arg('report', 'world')
const classId = arg('class', 'class_beginner') as ClassId
const level = Number(arg('level', '1'))
const world = Number(arg('world', '1'))
const stage = Number(arg('stage', '10'))
const prestige = Number(arg('prestige', '0'))
const sweep = arg('sweep', '')
const asJson = flag('json')
const levelUp = !flag('no-levelup')

getClass(classId) // fail fast on a bad --class

const VERDICT_LABEL: Record<Verdict, string> = {
    clear: 'CLEAR',
    timer_fail: 'TIMER FAIL',
    wipe: 'WIPE',
    stalled: 'STALLED (0 dmg)'
}

function pct(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '—'
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function banner() {
    const tuning = describeOverrides(overrides)
    console.log(`\n${classId} @ level ${level} — prestige ${prestige}${tuning ? `  [${tuning}]` : ''}`)
}

// ── reports ────────────────────────────────────────────────────────────────────────────

function stageRow(row: StageReport) {
    return {
        stage: row.stage,
        type: row.archetype,
        lvl: row.level,
        'enemy HP': formatHq(row.enemyHp),
        'enemy DEF': formatHq(row.enemyDef),
        'party DPS': formatHq(row.partyDps),
        's/kill': Number.isFinite(row.secondsPerKill) ? row.secondsPerKill.toFixed(2) : '∞',
        kills: row.isGate ? '—' : row.killsRequired,
        clear: formatSeconds(row.clearSeconds),
        'timer margin': pct(row.timerMargin),
        'survival': Number.isFinite(row.survivalRatio) ? `${row.survivalRatio.toFixed(1)}x` : '∞',
        verdict: VERDICT_LABEL[row.verdict]
    }
}

function reportStage() {
    const row = analyzeStage(makeHero(classId, level), prestige, world, stage)
    if (asJson) return console.log(JSON.stringify(row, replacer))

    banner()
    console.log(`World ${world}, stage ${stage} — ${row.archetype}\n`)
    console.log(`  party DPS      ${formatHq(row.partyDps).padStart(12)}`)
    console.log(`  enemy EHP      ${formatHq(row.enemyHp).padStart(12)}   DEF ${formatHq(row.enemyDef)}`)
    const beatsTimer = row.isGate && row.clearSeconds <= BOSS_TIMER_SECONDS
    console.log(`  time to kill   ${formatSeconds(row.clearSeconds).padStart(12)}${row.isGate ? `   vs ${BOSS_TIMER_SECONDS}s timer  ${beatsTimer ? 'PASS' : 'FAIL'}` : ''}`)
    if (row.timerMargin !== null) console.log(`  margin         ${pct(row.timerMargin).padStart(12)}`)
    console.log()
    console.log(`  incoming DPS   ${formatHq(row.incomingDps).padStart(12)}`)
    console.log(`  hero EHP       ${formatHq(row.heroEhp).padStart(12)}`)
    console.log(`  time to die    ${formatSeconds(row.secondsToDie).padStart(12)}`)
    console.log(`  must survive   ${formatSeconds(row.survivalWindow).padStart(12)}   (${row.isGate ? 'whole boss fight' : 'one kill'})`)
    console.log(`  survival       ${(Number.isFinite(row.survivalRatio) ? `${row.survivalRatio.toFixed(1)}x` : '∞').padStart(12)}`)
    console.log()
    console.log(`  verdict        ${VERDICT_LABEL[row.verdict].padStart(12)}`)
    if (!row.isGate) console.log(`  full stage     ${formatSeconds(row.clearSeconds)} for ${row.killsRequired} kills`)
    console.log()
}

function reportWorld() {
    const result = analyzeWorld(makeHero(classId, level), prestige, world, levelUp)
    if (asJson) return console.log(JSON.stringify(result, replacer))

    banner()
    console.log(`World ${world} walk — ${levelUp ? 'hero levels as it goes' : 'FIXED level (--no-levelup)'}\n`)
    console.table(result.rows.map(stageRow))
    console.log(`Total: ${formatSeconds(result.totalSeconds)}   level ${result.startLevel} → ${result.endLevel}   gold ${Math.round(result.totalGold).toLocaleString('en')}`)
    console.log(result.firstBlocker
        ? `First blocker: stage ${result.firstBlocker.stage} — ${VERDICT_LABEL[result.firstBlocker.verdict]}\n`
        : 'No blockers — the world clears end to end.\n')
}

function reportGates() {
    banner()
    console.log('Minimum hero level to clear each boss gate\n')
    const rows = gateTable(classId, prestige)
    console.table(rows.map(row => ({
        world: row.world,
        'stage 5 boss': row.bossLevel ?? 'unreachable',
        'stage 10 super': row.superBossLevel ?? 'unreachable',
        'gap': row.gap ?? '—'
    })))
    const reachable = rows.filter(row => row.superBossLevel !== null)
    if (reachable.length < rows.length) {
        console.log(`⚠ ${rows.length - reachable.length} world(s) unreachable at any level — the enemy curve outruns levelling.\n`)
    } else {
        console.log(`Level to clear the game: ${reachable.at(-1)!.superBossLevel}\n`)
    }
}

function reportClasses() {
    banner()
    console.log(`All 16 classes at level ${level} — world ${world}, stage ${stage}\n`)
    console.table(compareClasses(prestige, world, stage, level).map(row => ({
        class: row.name,
        tier: row.tier,
        DPS: formatHq(row.partyDps),
        EHP: formatHq(row.heroEhp),
        's/kill': Number.isFinite(row.secondsPerKill) ? row.secondsPerKill.toFixed(2) : '∞',
        clear: formatSeconds(row.clearSeconds),
        verdict: VERDICT_LABEL[row.verdict]
    })))
}

// ── sweep ──────────────────────────────────────────────────────────────────────────────

/** `K=1..4:0.5` or `K=1,2,3` */
function parseSweep(spec: string): { name: string; values: number[] } {
    const split = spec.indexOf('=')
    if (split < 0) throw new Error(`--sweep expects NAME=1..4:0.5 or NAME=1,2,3`)
    const name = spec.slice(0, split).trim()
    const body = spec.slice(split + 1).trim()

    const range = body.match(/^(-?[\d.]+)\.\.(-?[\d.]+)(?::([\d.]+))?$/)
    if (range) {
        const [, lo, hi, step] = range
        const from = Number(lo)
        const to = Number(hi)
        const by = Number(step ?? '1')
        if (!(by > 0)) throw new Error('--sweep step must be positive')
        const values: number[] = []
        for (let v = from; v <= to + 1e-9; v += by) values.push(Number(v.toFixed(10)))
        return { name, values }
    }
    return { name, values: body.split(',').map(Number) }
}

/**
 * Each sweep point runs in its own subprocess. Bun caches modules, so re-importing
 * `constants.ts` with a different override in-process would just hand back the first one.
 */
function runSweep() {
    const { name, values } = parseSweep(sweep)
    const passthrough = argv.filter(entry =>
        !entry.startsWith('--sweep=') && !entry.startsWith('--set=') && entry !== '--json')

    banner()
    console.log(`Sweeping ${name} over ${values.length} values — world ${world}, ${levelUp ? 'levelling' : 'fixed level'}\n`)

    const rows = values.map((value) => {
        const proc = Bun.spawnSync([
            'bun', import.meta.path, ...passthrough, `--set=${name}=${value}`, '--report=world', '--json'
        ], { stderr: 'pipe' })

        if (proc.exitCode !== 0) {
            return { [name]: value, error: proc.stderr.toString().trim().split('\n').at(-1) ?? 'failed' }
        }

        const result = JSON.parse(proc.stdout.toString())
        const boss = result.rows.find((row: StageReport) => row.stage === 5)
        const superBoss = result.rows.find((row: StageReport) => row.stage === 10)
        return {
            [name]: value,
            'W clear': formatSeconds(result.totalSeconds),
            'end lvl': result.endLevel,
            'boss clear': formatSeconds(boss.clearSeconds),
            'boss': boss.verdict === 'clear' ? 'PASS' : VERDICT_LABEL[boss.verdict as Verdict],
            'super clear': formatSeconds(superBoss.clearSeconds),
            'super': superBoss.verdict === 'clear' ? 'PASS' : VERDICT_LABEL[superBoss.verdict as Verdict],
            'first blocker': result.firstBlocker ? `stage ${result.firstBlocker.stage}` : 'none'
        }
    })

    console.table(rows)
    console.log(`Baseline is whatever ${name} currently is in constants.ts — nothing on disk was modified.\n`)
}

/** Decimals serialise as objects otherwise, which JSON.parse can't turn back into numbers. */
function replacer(_key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && 'toString' in value && value.constructor?.name === 'Decimal') {
        return Number((value as { toString(): string }).toString())
    }
    return value
}

// ── dispatch ───────────────────────────────────────────────────────────────────────────

try {
    if (sweep) {
        runSweep()
    } else {
        switch (report) {
            case 'stage': reportStage(); break
            case 'world': reportWorld(); break
            case 'gates': reportGates(); break
            case 'classes': reportClasses(); break
            default:
                console.log(`Unknown report "${report}". Available: stage, world, gates, classes`)
                console.log('Sweep:     --sweep=K=1..4:0.5')
                console.log('Override:  --set=K=3 --set=BASE_HP=200 --set=STAT_TIER_VALUES.high=20')
                console.log('Filters:   --class= --level= --world= --stage= --prestige= --no-levelup --json')
                process.exit(1)
        }
    }
} catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
}
