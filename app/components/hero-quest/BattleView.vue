<script setup lang="ts">
import { D, formatHq } from '#shared/utils/hero-quest/numbers'

/**
 * The live battle. Presentation only — it renders, it never decides.
 *
 * Between server refreshes it interpolates the kill counter forward at the server's own
 * `secondsPerKill`, so the bars move continuously instead of jumping once a minute. The
 * server's next payload is always the truth; this only fills the gap.
 *
 * **Everything on screen derives from one quantity, `killsFloat`.** The enemy bar, the enemy HP
 * figure, the count of bodies still standing, the Hero's HP and the stage counter are all
 * functions of it, so they cannot disagree with each other. They previously could, and did: the
 * enemy bar swept on a free-running wall clock while the HP figure beside it was a static
 * per-enemy number that never moved, which is what made the encounter read as inconsistent.
 *
 * Deliberately DOM rather than Pixi for Phase 1. The HP-bar contract here is the same one a Pixi
 * scene would consume, so swapping the renderer later touches no sim and no server code.
 */
const props = defineProps<{
    run: {
        enemyName: string
        killCount: number
        killsRequired: number
        atBossGate: boolean
        walled: boolean
        killsBeforeWipe: number | null
        secondsPerKill: number | null
        packSize: number
        /**
         * The **pack** total, not one body's HP — what the player is actually fighting.
         *
         * `state.get.ts` also serves per-enemy `enemyHp`, `secondsPerPack` and `partyDps`; this
         * component read none of them, so they are left out of the contract rather than declared
         * and ignored. Showing the per-body figure next to a bar that tracked the whole pack is
         * what made the encounter read as inconsistent in the first place.
         */
        packHp: string
    }
    hero: {
        className: string
        level: number
        stats: { maxHp: string; pwr: string }
    }
}>()

/**
 * Seconds since the last server payload.
 *
 * **It has to be reset when a payload lands.** An earlier version predicted from a clock that
 * only ever counted up from mount and reset `predicted` alone — which the ticker overwrote
 * 100ms later. The reset was a no-op, so the prediction grew without bound and the bar simply
 * pinned to the ceiling: a stage bar reading 30/30 forever while the real count was elsewhere.
 *
 * It was invisible for a second reason too. The prediction is *supposed* to be corrected by the
 * next payload, so a bug here only shows once payloads stop arriving — which is exactly what the
 * dev-server hang was doing.
 */
const sincePayload = ref(0)
let ticker: ReturnType<typeof setInterval> | null = null

watch(() => props.run.killCount, () => {
    sincePayload.value = 0
})

/**
 * Every readout, derived together from one server-anchored quantity.
 *
 * The derivation lives in `hero-quest-battle.ts` rather than here so its edge cases — pack
 * rollover, an undying party, a walled ceiling below the stage requirement — can be pinned by a
 * spec instead of only ever being exercised by looking at the screen.
 */
const view = computed(() => battleReadout({
    killCount: props.run.killCount,
    killsRequired: props.run.killsRequired,
    killsBeforeWipe: props.run.killsBeforeWipe,
    secondsPerKill: props.run.secondsPerKill,
    packSize: props.run.packSize,
    walled: props.run.walled,
    atBossGate: props.run.atBossGate,
    sincePayload: sincePayload.value
}))

/**
 * HP left across the whole pack, and on the Hero — both as Decimals.
 *
 * Enemy HP passes `Number.MAX_SAFE_INTEGER` early in the game, so neither can be float
 * arithmetic even though the percentages driving them are plain numbers.
 */
const enemyHpRemaining = computed(() => D(props.run.packHp).mul(view.value.enemyHpPct / 100))
const heroHpRemaining = computed(() => D(props.hero.stats.maxHp).mul(view.value.heroHpPct / 100))

const heroHpColor = computed(() => {
    if (view.value.heroHpPct <= 20) return 'error'
    if (view.value.heroHpPct <= 50) return 'warning'
    return 'success'
})

onMounted(() => {
    ticker = setInterval(() => { sincePayload.value += 0.1 }, 100)
})

onUnmounted(() => {
    if (ticker) clearInterval(ticker)
})
</script>

<template>
  <div class="rounded-lg border border-default bg-elevated/40 p-5 space-y-5">
    <div
      v-if="run.atBossGate"
      class="text-center py-6 space-y-2"
    >
      <UIcon
        name="i-lucide-skull"
        class="size-10 text-error"
      />
      <p class="text-lg font-semibold text-highlighted">
        {{ run.enemyName }} blocks the way
      </p>
      <p class="text-sm text-muted">
        Bosses never resolve on their own. Engage when you're ready.
      </p>
    </div>

    <template v-else>
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-highlighted">
            {{ run.enemyName }}
            <!-- Counts down as bodies drop, so the pack reads as a group being worn away. -->
            <span
              v-if="run.packSize > 1"
              class="text-muted"
            >×{{ view.enemiesStanding }}</span>
          </span>
          <!-- The whole pack, remaining over total — the number the bar beside it is showing. -->
          <span class="text-muted tabular-nums">
            {{ formatHq(enemyHpRemaining) }} / {{ formatHq(run.packHp) }} HP
          </span>
        </div>
        <UProgress
          :model-value="view.enemyHpPct"
          size="sm"
          color="error"
        />
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-highlighted">
            {{ hero.className }} <span class="text-muted">Lv {{ hero.level }}</span>
          </span>
          <span class="text-muted tabular-nums">
            {{ formatHq(heroHpRemaining) }} / {{ formatHq(hero.stats.maxHp) }} HP
          </span>
        </div>
        <UProgress
          :model-value="view.heroHpPct"
          size="sm"
          :color="heroHpColor"
        />
      </div>

      <div class="pt-1">
        <div class="flex items-center justify-between text-xs text-muted mb-1">
          <span>Stage progress</span>
          <span>{{ view.displayKills }} / {{ run.killsRequired }}</span>
        </div>
        <UProgress
          :model-value="view.killProgress"
          size="md"
          :color="run.walled ? 'error' : 'primary'"
        />
      </div>

      <!--
        Only shown when it matters. `killsBeforeWipe` below `killsRequired` is the definition of
        a walled stage, and the Hero bar above will visibly empty first — this names what the
        player is about to watch happen.
      -->
      <p
        v-if="run.walled && run.killsBeforeWipe !== null"
        class="text-xs text-error"
      >
        This stage drops you after {{ run.killsBeforeWipe }} of
        {{ run.killsRequired }} kills — it restarts rather than clearing. Level up to break through.
      </p>
    </template>
  </div>
</template>
