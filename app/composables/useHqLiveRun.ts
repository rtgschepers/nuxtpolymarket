import { D } from '#shared/utils/hero-quest/numbers'
import { enemyPackAt, enemyStatsAt, packHp, packSize } from '#shared/utils/hero-quest/settle'
import { enemyNameAt, getWorld, runProgress } from '#shared/utils/hero-quest/content/worlds'

/**
 * Taken off `useHeroQuest` rather than restated, so the payload shape has exactly one
 * definition and adding a field to `serializeRun` cannot leave a second copy behind.
 */
type HqState = ReturnType<typeof useHeroQuest>
type HqRun = NonNullable<HqState['run']['value']>
type HqHero = NonNullable<HqState['hero']['value']>

/**
 * The battle screen's live view of the run, between server payloads.
 *
 * The server settles lazily and the client polls it once a minute, so without this the whole
 * screen is a minute-old photograph that jumps: the stage counter fills and then sits at 30/30,
 * the world and stage never change until the poll lands, and the XP bar is frozen the entire
 * time. `projectRun` walks all of it forward from the payload at the server's own rate, and this
 * composable is the ticker that keeps calling it.
 *
 * ## Scoped to the battle screen on purpose
 *
 * It owns a 100ms interval, which is what a moving bar costs and what nothing else needs — the
 * gacha and collection pages read the same `useHeroQuest()` state and have no use for a ten-hertz
 * redraw. So `run` and `hero` stay server truth for every other consumer, and only the page that
 * draws the fight opts into the projection.
 *
 * ## What is projected and what is held
 *
 * Projected: position, kills, Gold, XP, level, and every position-only enemy figure — pack size,
 * per-enemy HP, pack HP — recomputed exactly from the projected position by the same pure
 * functions the server serializes from.
 *
 * Held at the payload's values: `secondsPerKill`, `killsBeforeWipe`, `partyDps` and everything
 * else that depends on the party's stats, because those need a `HeroSnapshot` the client does not
 * have. `settle()` holds the same two across a multi-stage advance for the same reason, so this
 * is the server's own approximation rather than a second one — see `hero-quest-battle.ts`.
 */
export function useHqLiveRun(
    run: Ref<HqRun | null> | ComputedRef<HqRun | null>,
    hero: Ref<HqHero | null> | ComputedRef<HqHero | null>
) {
    /**
     * Seconds since the payload that supplied the anchor.
     *
     * **It has to be reset when a payload lands.** An earlier version predicted from a clock that
     * only ever counted up from mount, so the prediction grew without bound and the bars simply
     * pinned to their ceilings — a stage bar reading 30/30 forever while the real count was
     * elsewhere. Watching `killCount` alone is not enough now that the projection advances
     * stages: a payload that lands exactly as the counter rolls over reports the same 0 it did a
     * tick ago, so the world and stage are watched with it — and `killFraction` too, which is
     * the only field that moves at all on a window too short to bank a whole kill.
     */
    const sincePayload = ref(0)
    let ticker: ReturnType<typeof setInterval> | null = null

    watch(
        () => {
            const value = run.value
            return value ? `${value.world}:${value.stage}:${value.killCount}:${value.killFraction}` : ''
        },
        () => { sincePayload.value = 0 }
    )

    const forecast = computed(() => {
        const anchor = run.value
        const self = hero.value
        if (!anchor || !self) return null
        return projectRun({
            prestige: anchor.prestige,
            world: anchor.world,
            stage: anchor.stage,
            killCount: anchor.killCount,
            killFraction: anchor.killFraction,
            secondsPerKill: anchor.secondsPerKill,
            killsBeforeWipe: anchor.killsBeforeWipe,
            goldBonusPct: anchor.goldBonusPct,
            xpBonusPct: anchor.xpBonusPct,
            heroLevel: self.level,
            heroXp: self.xp,
            tenureDays: anchor.tenureDays
        }, sincePayload.value)
    })

    /**
     * The payload's `run`, with everything the projection knows better overwritten.
     *
     * Same shape as the server's, so the components take one prop and neither of them learns that
     * a projection exists. `killsFloat` is the one addition: the counter wants the integer and the
     * bars want the fraction, and handing both over beats each component flooring its own.
     */
    const liveRun = computed(() => {
        const anchor = run.value
        const ahead = forecast.value
        if (!anchor) return null
        // No forecast means no hero yet, which is a frame or two on first load. Same shape
        // either way, so the components never see two contracts.
        if (!ahead) return { ...anchor, killsFloat: anchor.killCount + anchor.killFraction }

        const position = {
            prestige: ahead.prestige,
            world: ahead.world,
            stage: ahead.stage,
            killsInStage: 0
        }
        const pack = enemyPackAt(position)
        const enemy = enemyNameAt(ahead.world, ahead.stage)

        return {
            ...anchor,
            world: ahead.world,
            stage: ahead.stage,
            worldName: getWorld(ahead.world).name,
            enemyName: enemy.name,
            archetype: enemy.archetype,
            progress: runProgress(ahead.world, ahead.stage),
            killCount: Math.floor(ahead.killsInStage),
            killsFloat: ahead.killsInStage,
            killsRequired: ahead.killsRequired,
            atBossGate: ahead.atBossGate,
            walled: ahead.walled,
            // Position-only, so exact rather than held over from the payload's stage.
            packSize: packSize(pack),
            packHp: packHp(pack).toString(),
            enemyHp: enemyStatsAt(position).hp.toString()
        }
    })

    /** The payload's `hero`, with level and XP walked forward the same way. */
    const liveHero = computed(() => {
        const self = hero.value
        const ahead = forecast.value
        if (!self) return null
        if (!ahead) return self
        return {
            ...self,
            level: ahead.heroLevel,
            xp: ahead.heroXp.toString(),
            xpToNextLevel: ahead.xpToNextLevel.toString(),
            xpProgress: ahead.xpProgress
        }
    })

    /**
     * Gold banked since the payload, as a Decimal-safe string.
     *
     * The header shows the shared balance and only refreshes with the poll, so this is what the
     * battle screen can honestly say has been earned in front of the player right now.
     */
    const goldSincePayload = computed(() => D(forecast.value?.goldEarned ?? 0))

    onMounted(() => {
        ticker = setInterval(() => { sincePayload.value += 0.1 }, 100)
    })
    onUnmounted(() => {
        if (ticker) clearInterval(ticker)
    })

    return { liveRun, liveHero, forecast, goldSincePayload }
}
