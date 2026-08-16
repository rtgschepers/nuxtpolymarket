<script setup lang="ts">
import { formatHq } from '#shared/utils/hero-quest/numbers'

/**
 * The live battle. Presentation only — it renders, it never decides.
 *
 * Between server refreshes it interpolates the kill counter forward at the server's own
 * `secondsPerKill`, so the bar moves continuously instead of jumping once a minute. The
 * server's next payload is always the truth; this only fills the gap.
 *
 * Deliberately DOM rather than Pixi for Phase 1. The floating-damage and HP-bar contract
 * here is the same one a Pixi scene would consume, so swapping the renderer later touches
 * no sim and no server code.
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
        /** Seconds to clear a whole encounter — `secondsPerKill × packSize`. */
        secondsPerPack: number | null
        packSize: number
        enemyHp: string
        partyDps: string
    }
    hero: {
        className: string
        level: number
        stats: { maxHp: string; pwr: string }
    }
}>()

/** Kills predicted since the last server payload. Never allowed to outrun the real counter. */
const predicted = ref(0)
let ticker: ReturnType<typeof setInterval> | null = null

watch(() => props.run.killCount, () => {
    predicted.value = 0
})

const displayKills = computed(() => {
    if (props.run.atBossGate) return props.run.killCount
    // A walled stage restarts rather than banking, so the ceiling is what one attempt
    // survives — otherwise the bar would sail past a threshold the run can never reach.
    const ceiling = props.run.walled && props.run.killsBeforeWipe !== null
        ? props.run.killsBeforeWipe
        : props.run.killsRequired
    return Math.min(ceiling, props.run.killCount + predicted.value)
})

const killProgress = computed(() => {
    if (props.run.killsRequired <= 0) return 100
    return Math.min(100, (displayKills.value / props.run.killsRequired) * 100)
})

/**
 * Enemy HP bar, driven off the fractional part of the current *encounter*. Pure decoration.
 *
 * Cycles on `secondsPerPack`, not `secondsPerKill`: with a pack of N the bar represents the
 * whole group, so sweeping it once per individual kill would empty it N times per encounter.
 */
const enemyHpPct = computed(() => {
    const perPack = props.run.secondsPerPack ?? props.run.secondsPerKill
    if (!perPack || props.run.atBossGate) return 100
    return 100 - ((elapsed.value % perPack) / perPack) * 100
})

const elapsed = ref(0)

onMounted(() => {
    ticker = setInterval(() => {
        elapsed.value += 0.1
        const spk = props.run.secondsPerKill
        if (!spk || props.run.atBossGate) return
        predicted.value = Math.floor(elapsed.value / spk)
    }, 100)
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
            <!-- HP below is per enemy, so the count has to be visible next to it. -->
            <span v-if="run.packSize > 1" class="text-muted">×{{ run.packSize }}</span>
          </span>
          <span class="text-muted">{{ formatHq(run.enemyHp) }} HP</span>
        </div>
        <UProgress
          :model-value="enemyHpPct"
          size="sm"
          color="error"
        />
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-highlighted">
            {{ hero.className }} <span class="text-muted">Lv {{ hero.level }}</span>
          </span>
          <span class="text-muted">{{ formatHq(hero.stats.maxHp) }} HP</span>
        </div>
        <UProgress
          :model-value="100"
          size="sm"
          color="success"
        />
      </div>

      <div class="pt-1">
        <div class="flex items-center justify-between text-xs text-muted mb-1">
          <span>Stage progress</span>
          <span>{{ displayKills }} / {{ run.killsRequired }}</span>
        </div>
        <UProgress
          :model-value="killProgress"
          size="md"
          :color="run.walled ? 'error' : 'primary'"
        />
      </div>
    </template>
  </div>
</template>
