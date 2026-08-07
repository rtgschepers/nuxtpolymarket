<script setup lang="ts">
import { formatHq } from '#shared/utils/hero-quest/numbers'
import type { FightEvent, FightOutcome } from '#shared/utils/hero-quest/fight'

/**
 * Replays a fight the server already resolved.
 *
 * Every number on screen comes out of the server's event log — this walks it against a
 * wall clock and renders. It cannot change the outcome, and it never recomputes a damage
 * figure, which is the whole point of the seeded-replay model: the client is an animation
 * player driven by authoritative data.
 */
const props = defineProps<{
    fight: {
        outcome: FightOutcome
        secondsElapsed: number
        damageDealtPct: number
        enemyMaxHp: string
        enemyHpRemaining: string
        events: FightEvent[]
        runComplete: boolean
    } | null
    enemyName: string
    bossTimerSeconds: number
}>()

const emit = defineEmits<{ close: [] }>()

const open = computed({
    get: () => props.fight !== null,
    set: (value: boolean) => {
        if (!value) emit('close')
    }
})

const clock = ref(0)
let ticker: ReturnType<typeof setInterval> | null = null

/** Events that have "happened" at the current playback time. */
const played = computed(() => (props.fight?.events ?? []).filter(event => event.at <= clock.value))
const finished = computed(() => !props.fight || clock.value >= props.fight.secondsElapsed)

const enemyHpPct = computed(() => {
    if (!props.fight) return 100
    const last = [...played.value].reverse().find(event => event.remainingHp !== undefined && event.kind !== 'enemy_attack')
    if (!last?.remainingHp) return 100
    const max = Number(props.fight.enemyMaxHp)
    if (!Number.isFinite(max) || max <= 0) return 0
    return Math.max(0, Math.min(100, (Number(last.remainingHp) / max) * 100))
})

/** The last few hits, newest first — a readable feed rather than a scroll of 400 rows. */
const recentHits = computed(() =>
    [...played.value]
        .filter(event => event.kind === 'attack' || event.kind === 'skill' || event.kind === 'enemy_attack')
        .slice(-8)
        .reverse()
)

const outcomeCopy = computed(() => {
    switch (props.fight?.outcome) {
        case 'win':
            return { title: 'Victory', color: 'success' as const, icon: 'i-lucide-trophy' }
        case 'wipe':
            return { title: 'Your hero fell', color: 'error' as const, icon: 'i-lucide-skull' }
        default:
            return { title: 'Out of time', color: 'warning' as const, icon: 'i-lucide-timer-off' }
    }
})

watch(() => props.fight, (fight) => {
    if (ticker) clearInterval(ticker)
    clock.value = 0
    if (!fight) return
    // Real time, 1:1 with sim time. Battle Speed (Phase 4) is exactly the dial that changes
    // this rate and nothing else — the outcome is already fixed.
    ticker = setInterval(() => {
        clock.value = Math.min(fight.secondsElapsed, clock.value + 0.1)
        if (clock.value >= fight.secondsElapsed && ticker) clearInterval(ticker)
    }, 100)
}, { immediate: true })

onUnmounted(() => {
    if (ticker) clearInterval(ticker)
})

function skip() {
    if (ticker) clearInterval(ticker)
    if (props.fight) clock.value = props.fight.secondsElapsed
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="enemyName"
    :dismissible="false"
  >
    <template #body>
      <div
        v-if="fight"
        class="space-y-4"
      >
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-sm">
            <span class="font-medium text-highlighted">{{ enemyName }}</span>
            <span class="text-muted">{{ formatHq(fight.enemyMaxHp) }} HP</span>
          </div>
          <UProgress
            :model-value="enemyHpPct"
            color="error"
          />
        </div>

        <div class="flex items-center justify-between text-sm text-muted">
          <span>{{ clock.toFixed(1) }}s / {{ bossTimerSeconds }}s</span>
          <span>{{ Math.round((1 - enemyHpPct / 100) * 100) }}% down</span>
        </div>

        <div class="min-h-40 rounded-lg border border-default bg-elevated/40 p-3 space-y-1 font-mono text-xs">
          <p
            v-if="!recentHits.length"
            class="text-muted"
          >
            Closing in…
          </p>
          <p
            v-for="(event, index) in recentHits"
            :key="index"
            :class="event.kind === 'enemy_attack' ? 'text-error' : event.crit ? 'text-warning font-semibold' : 'text-muted'"
          >
            <span class="opacity-60">{{ event.at.toFixed(1) }}s</span>
            {{ event.kind === 'enemy_attack' ? '←' : '→' }}
            {{ formatHq(event.damage ?? '0') }}
            <span v-if="event.crit">CRIT</span>
            <span
              v-if="event.kind === 'skill'"
              class="opacity-60"
            >{{ event.skillId }}</span>
          </p>
        </div>

        <UAlert
          v-if="finished"
          :color="outcomeCopy.color"
          variant="subtle"
          :icon="outcomeCopy.icon"
          :title="outcomeCopy.title"
          :description="fight.outcome === 'win'
            ? (fight.runComplete ? 'World 10 cleared — you can prestige now.' : 'The way forward is open.')
            : `You took the boss to ${Math.round(fight.damageDealtPct * 100)}%. Fall back a stage, level up, and try again.`"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          v-if="!finished"
          variant="ghost"
          color="neutral"
          @click="skip"
        >
          Skip
        </UButton>
        <UButton
          :disabled="!finished"
          @click="emit('close')"
        >
          Continue
        </UButton>
      </div>
    </template>
  </UModal>
</template>
