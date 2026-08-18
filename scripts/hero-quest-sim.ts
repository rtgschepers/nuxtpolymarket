/**
 * Hero Quest combat sim — the tuning workhorse.
 *
 *   bun run sim:hero-quest                                  # World 1 walk, level 1
 *   bun run sim:hero-quest --report=stage --world=1 --stage=10 --level=14
 *   bun run sim:hero-quest --report=gates                   # min level for every boss gate
 *   bun run sim:hero-quest --report=stats --level=40        # where every stat comes from
 *   bun run sim:hero-quest --report=stats --sweep-levels=1,20,50,200
 *   bun run sim:hero-quest --report=classes --level=20
 *   bun run sim:hero-quest --set=K=3 --set=BASE_HP=200      # override constants for one run
 *   bun run sim:hero-quest --sweep=K=1..4:0.5               # sweep a dial, tabulate results
 *
 *   bun run sim:hero-quest --report=gates --party=3         # what a starting party buys
 *
 * Flags: --class --level --world --stage --prestige --party --no-levelup --json
 *
 * Crit-averaged, no per-hit rolling — a verdict is "wins on expected values", not a win
 * rate. Overrides are applied by rewriting `constants.ts` at load time and never touch the
 * file on disk.
 */

import { describeOverrides, parseOverrides, registerTuning } from './hero-quest/tuning'
// Type-only, so these are erased at compile time and never pull constants.ts in early.
import type { ClassId } from '../shared/utils/hero-quest/types'
import type { CampaignReport, StageReport, Verdict, WallReason } from './hero-quest/sim'

const argv = process.argv.slice(2)

function arg(name: string, fallback: string): string {
    const hit = argv.find(entry => entry.startsWith(`--${name}=`))
    return hit ? hit.slice(name.length + 3) : fallback
}
const flag = (name: string) => argv.includes(`--${name}`)

// Must happen before anything pulls in constants.ts, hence the dynamic imports below.
const overrides = parseOverrides(argv)
registerTuning(overrides)

const {
    analyzeCampaign,
    analyzeStage,
    analyzeWorld,
    compareClasses,
    gateTable,
    makeParty,
    DEFAULT_CAMPAIGN_MAX_LEVEL,
    DEFAULT_CAMPAIGN_MAX_PRESTIGE,
    DEFAULT_GRIND_BUDGET_SECONDS
} = await import('./hero-quest/sim')
const { formatHq, formatSeconds } = await import('../shared/utils/hero-quest/numbers')
const { explainStats, levelsToCover, stagesOfCurve } = await import('../shared/utils/hero-quest/explain')
const { BOSS_TIMER_SECONDS, WORLD_COUNT } = await import('../shared/utils/hero-quest/constants')
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
const maxPrestige = Number(arg('max-prestige', String(DEFAULT_CAMPAIGN_MAX_PRESTIGE)))
const grindHours = Number(arg('grind-hours', String(DEFAULT_GRIND_BUDGET_SECONDS / 3600)))
const maxLevel = Number(arg('max-level', String(DEFAULT_CAMPAIGN_MAX_LEVEL)))
/** Total units, Hero included. 1 is the solo Phase 1 Hero; real parties run 3–6. */
const party = Math.max(1, Number(arg('party', '1')))
/** `--sweep-levels=1,20,50` — the scaling view on `--report=stats`. Empty means single-level. */
const sweepLevels = arg('sweep-levels', '')
    .split(',').map(entry => Number(entry.trim())).filter(value => Number.isFinite(value) && value >= 1)

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
    const size = party > 1 ? `  party of ${party}` : ''
    console.log(`\n${classId} @ level ${level} — prestige ${prestige}${size}${tuning ? `  [${tuning}]` : ''}`)
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
    const row = analyzeStage(makeParty(classId, level, party), prestige, world, stage)
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
    const result = analyzeWorld(makeParty(classId, level, party), prestige, world, levelUp)
    if (asJson) return console.log(JSON.stringify(result, replacer))

    banner()
    console.log(`World ${world} walk — ${levelUp ? 'hero levels as it goes' : 'FIXED level (--no-levelup)'}\n`)
    console.table(result.rows.map(stageRow))
    console.log(`Total: ${formatSeconds(result.totalSeconds)}   level ${result.startLevel} → ${result.endLevel}   gold ${Math.round(result.totalGold).toLocaleString('en')}`)
    console.log(result.firstBlocker
        ? `First blocker: stage ${result.firstBlocker.stage} — ${VERDICT_LABEL[result.firstBlocker.verdict]}\n`
        : 'No blockers — the world clears end to end.\n')
}

const WALL_LABEL: Record<WallReason, string> = {
    unclearable: 'UNCLEARABLE — no level clears it',
    unfarmable: 'UNFARMABLE — nowhere left to earn XP',
    grind_budget: 'GRIND WALL — clearable, but not in the time budget',
    prestige_limit: 'NO WALL — ran out of prestiges first'
}

function reportCampaign() {
    const result: CampaignReport = analyzeCampaign(makeParty(classId, level, party), prestige, {
        maxPrestige,
        grindBudgetSeconds: grindHours * 3600,
        maxLevel
    })
    if (asJson) return console.log(JSON.stringify(result, replacer))

    banner()
    console.log(`Campaign walk — stages → worlds → prestiges, farming past blockers until one sticks`)
    console.log(`Grind budget ${grindHours}h per blocked stage, level ceiling ${maxLevel}, up to ${maxPrestige} prestige(s)\n`)

    console.table(result.rows.map(row => ({
        'P': row.prestige,
        'world': row.world,
        'lvl': `${row.startLevel} → ${row.endLevel}`,
        'fights': formatSeconds(row.fightSeconds),
        'grind': row.grindSeconds > 0 ? formatSeconds(row.grindSeconds) : '—',
        'blockers': row.grinds || '—',
        'gold': Math.round(row.gold).toLocaleString('en'),
        '': row.completed ? '' : '← WALL'
    })))

    if (result.grinds.length) {
        console.log('\nForced grinds\n')
        console.table(result.grinds.map(event => ({
            'at': `P${event.prestige} W${event.world}S${event.stage}`,
            'blocked by': VERDICT_LABEL[event.blockedBy],
            'farmed': `W${event.farmWorld}S${event.farmStage}`,
            'lvl': `${event.fromLevel} → ${event.toLevel}`,
            'kills': event.kills.toLocaleString('en'),
            'time': formatSeconds(event.seconds)
        })))
    }

    const wall = result.wall
    console.log(`\n${WALL_LABEL[wall.reason]}`)
    console.log(`  at             P${wall.prestige} W${wall.world}S${wall.stage} (${wall.archetype})`)
    console.log(`  hero level     ${wall.level}${wall.requiredLevel !== null ? `   needs ${wall.requiredLevel}` : ''}`)
    console.log(`  why            ${wall.detail}`)
    console.log()
    console.log(`Reached: ${result.prestigesCompleted} prestige(s) completed, level ${result.startLevel} → ${result.endLevel}`)
    console.log(`Time:    ${formatSeconds(result.totalSeconds)} total — ${formatSeconds(result.fightSeconds)} fighting, ${formatSeconds(result.grindSeconds)} grinding`)
    console.log(`Gold:    ${Math.round(result.totalGold).toLocaleString('en')}\n`)
}

function reportGates() {
    banner()
    console.log('Minimum hero level to clear each boss gate\n')
    const rows = gateTable(classId, prestige, WORLD_COUNT, party)
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

/**
 * Where every stat on every unit comes from, and what each source is worth.
 *
 * The table is the pipeline in column order — base spread, then one multiplier per stage — so
 * reading left to right *is* reading `stats.ts`. Two things it deliberately does not do:
 *
 * - **It never multiplies the per-source lines together.** Gear, Skills and Artifacts stack
 *   additively (`modifiers.ts`), so they share one column and are itemised underneath it.
 * - **It prices everything in stages of enemy curve**, which is the only unit that makes a ×1.36
 *   collection passive comparable to a hero level or to the 100 stages a prestige loop costs.
 *
 * `--sweep-levels=1,20,50` adds the scaling view: the same attribution at several levels at once,
 * which is where a source that looked significant turns out to be flat.
 */
function reportStats() {
    const snapshot = makeParty(classId, level, party)
    const explained = explainStats(snapshot)
    if (asJson) return console.log(JSON.stringify(explained, replacer))

    banner()
    console.log('Stat attribution — every source, and what it is worth against the enemy curve\n')

    for (const unit of explained.units) {
        console.log(unit.role ? `${unit.label}  (${unit.role})` : `${unit.label}  (Hero)`)
        console.table(unit.stats.map((stat) => {
            const row: Record<string, string | number> = {
                stat: stat.label,
                tier: stat.tier,
                base: stat.stages[0]!.factor.toNumber()
            }
            for (const stage of stat.stages.slice(1)) {
                row[stage.label] = `×${stage.factor.toNumber().toFixed(4)}${stage.unbounded ? ' ∞' : ''}`
            }
            row.final = formatHq(stat.final)
            row.stages = stat.stagesOfCurve.toFixed(1)
            return row
        }))

        // Only printed where there is something to itemise — an empty account would otherwise
        // produce six identical "nothing" lines per unit.
        for (const stat of unit.stats) {
            for (const stage of stat.stages) {
                const live = stage.parts.filter(part => part.amount !== 0)
                if (stage.id === 'base' ? live.length < 2 : live.length === 0) continue
                console.log(`  ${stat.label} · ${stage.label}: `
                    + live.map(part => `${part.label} ${stage.id === 'base' ? '' : '+'}${part.amount}`).join(', '))
            }
        }

        console.log()
        for (const derived of unit.derived) {
            console.log(`  ${derived.label.padEnd(18)} ${derived.value.padStart(14)}   ${derived.formula}`)
            if (derived.note) console.log(`  ${' '.repeat(18)} ${' '.repeat(14)}   ⚠ ${derived.note}`)
        }
        console.log()
    }

    const { pacing } = explained
    console.log('Pacing — the common denominator\n')
    console.log(`  stat growth / level   ×${pacing.statGrowthPerLevel.toFixed(6)}`)
    console.log(`  enemy growth / stage  ×${pacing.enemyStepBase}`)
    console.log(`  DPS rides the stat curve to the power of ${pacing.dpsStatExponent}`)
    console.log(`  → one level buys       ${pacing.stagesPerLevel.toFixed(2)} stages`)
    console.log(`  → one stage costs      ${pacing.levelsPerStage.toFixed(2)} levels`)
    console.log(`  → one 100-stage loop   ${levelsToCover(100).toFixed(0)} levels`)
    console.log()
    console.log('  The `stages` column above prices each stat ALONE (exponent 1). The pacing')
    console.log('  figures price a source lifting EVERY stat, which is what DPS_STAT_EXPONENT')
    console.log('  is for — so a whole-block multiplier is worth about double a single stat.')
    console.log()
    console.log('  Every non-level source is a FIXED multiplier on a moving number: it shifts')
    console.log('  the wall by a constant number of stages and then never helps again. Only')
    console.log('  the level column compounds.\n')

    if (sweepLevels.length > 0) reportStatScaling()
}

/**
 * The same attribution at several levels at once — the actual scaling view.
 *
 * A source whose "stages" column is identical at level 1 and level 200 is flat, however large it
 * looks in absolute terms. That comparison is the point, and it is the one thing a single-level
 * snapshot cannot show.
 */
function reportStatScaling() {
    console.log(`Scaling — the same sources at levels ${sweepLevels.join(', ')}\n`)
    const rows = sweepLevels.map((atLevel) => {
        const unit = explainStats(makeParty(classId, atLevel, party)).units[0]!
        const pwr = unit.stats.find(stat => stat.key === 'pwr')!
        const row: Record<string, string | number> = { level: atLevel }
        for (const stage of pwr.stages) {
            row[stage.label.startsWith('Level') ? 'level curve' : stage.label] =
                stage.id === 'base'
                    ? stage.factor.toNumber()
                    : `×${stage.factor.toNumber().toFixed(3)}`
        }
        row['PWR'] = formatHq(pwr.final)
        row['stages vs curve'] = stagesOfCurve(pwr.final.div(pwr.stages[0]!.factor), 1).toFixed(1)
        return row
    })
    console.table(rows)
    console.log(`Read down the columns: anything constant is a flat source. PWR is shown because`)
    console.log(`every stat shares the same stage structure — use --json for all six.`)
    console.log(`Covering one stage of enemy curve takes ${levelsToCover(1).toFixed(2)} levels.\n`)
}

function reportClasses() {
    banner()
    console.log(`All 16 classes at level ${level} — world ${world}, stage ${stage}\n`)
    console.table(compareClasses(prestige, world, stage, level, party).map(row => ({
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
    // `--set` survives into every point, so `--set=X=1 --sweep=Y=...` sweeps Y *against* X
    // rather than quietly reporting un-overridden numbers. The swept pair is appended last
    // and wins on a collision, since `parseOverrides` takes the final assignment.
    //
    // `--report` is re-supplied per point: `arg()` takes the first match, so leaving the
    // caller's copy in would silently shadow it and hand the parser the wrong shape back.
    const passthrough = argv.filter(entry =>
        !entry.startsWith('--sweep=') && !entry.startsWith('--report=') && entry !== '--json')

    // Only `world` and `campaign` produce a whole-walk summary worth one row per point.
    const swept = report === 'campaign' ? 'campaign' : 'world'

    banner()
    console.log(swept === 'campaign'
        ? `Sweeping ${name} over ${values.length} values — campaign walk, ${grindHours}h grind budget\n`
        : `Sweeping ${name} over ${values.length} values — world ${world}, ${levelUp ? 'levelling' : 'fixed level'}\n`)

    const rows = values.map((value) => {
        const proc = Bun.spawnSync([
            'bun', import.meta.path, ...passthrough, `--set=${name}=${value}`, `--report=${swept}`, '--json'
        ], { stderr: 'pipe' })

        if (proc.exitCode !== 0) {
            return { [name]: value, error: proc.stderr.toString().trim().split('\n').at(-1) ?? 'failed' }
        }

        const result = JSON.parse(proc.stdout.toString())
        if (swept === 'campaign') return campaignSweepRow(name, value, result)

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

function campaignSweepRow(name: string, value: number, result: CampaignReport) {
    const { wall } = result
    return {
        [name]: value,
        'wall at': `P${wall.prestige} W${wall.world}S${wall.stage}`,
        'reason': wall.reason,
        'lvl': `${wall.level}${wall.requiredLevel !== null ? ` / ${wall.requiredLevel}` : ''}`,
        'prestiges': result.prestigesCompleted,
        'fights': formatSeconds(result.fightSeconds),
        'grind': formatSeconds(result.grindSeconds)
    }
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
            case 'campaign': reportCampaign(); break
            case 'gates': reportGates(); break
            case 'classes': reportClasses(); break
            case 'stats': reportStats(); break
            default:
                console.log(`Unknown report "${report}". Available: stage, world, campaign, gates, classes, stats`)
                console.log('Sweep:     --sweep=K=1..4:0.5')
                console.log('Override:  --set=K=3 --set=BASE_HP=200 --set=STAT_TIER_VALUES.high=20')
                console.log('Filters:   --class= --level= --world= --stage= --prestige= --party= --no-levelup --json')
                console.log('Campaign:  --max-prestige=10 --grind-hours=24 --max-level=5000')
                console.log('Stats:     --report=stats --level=40 --party=3 --sweep-levels=1,20,50,200')
                process.exit(1)
        }
    }
} catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
}
