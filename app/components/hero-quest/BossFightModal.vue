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
        /** Each body's starting HP, escort first, boss last. */
        enemyMaxHps: string[]
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

/**
 * HP across the **whole encounter** — a boss stands with an escort, so the bar tracks every
 * body, not whichever one is currently being hit.
 *
 * Each enemy's latest `remainingHp` is kept per `enemyIndex` and summed. Reading only the last
 * event would make the bar jump *up* the moment the party finishes a minion and turns to the
 * boss, since it would switch to reporting a fresh body's HP.
 */
const enemyHpPct = computed(() => {
    if (!props.fight) return 100
    const max = Number(props.fight.enemyMaxHp)
    if (!Number.isFinite(max) || max <= 0) return 0

    // Seeded at full HP so a body nobody has struck yet counts as alive, not as zero.
    const remainingPer = props.fight.enemyMaxHps.map(Number)
    for (const event of played.value) {
        // `enemy_attack` carries the *defender's* HP, so it must never be read as enemy HP.
        if (event.kind === 'enemy_attack' || event.remainingHp === undefined) continue
        const index = event.enemyIndex ?? 0
        if (index < remainingPer.length) remainingPer[index] = Number(event.remainingHp)
    }

    const remaining = remainingPer.reduce((total, hp) => total + hp, 0)
    return Math.max(0, Math.min(100, (remaining / max) * 100))
})

/**
 * Kinds the feed shows. Anything with a number attached to it belongs here — a heal or an
 * absorbed hit is as much a thing that happened as a sword swing.
 *
 * `status_applied` / `status_expired` are deliberately excluded: they carry no damage and
 * would drown the eight-row feed in bookkeeping once Stage 3 starts applying effects.
 */
const FEED_KINDS = new Set(['attack', 'skill', 'enemy_attack', 'heal', 'shield', 'status_tick'])

/** The last few hits, newest first — a readable feed rather than a scroll of 400 rows. */
const recentHits = computed(() =>
    [...played.value]
        .filter(event => FEED_KINDS.has(event.kind))
        .slice(-8)
        .reverse()
)

/** Which side an event's number belongs to, for colour and arrow direction. */
function isAgainstParty(kind: string) {
    return kind === 'enemy_attack'
}

function feedIcon(kind: string) {
    if (kind === 'heal') return '+'
    if (kind === 'shield') return '⛊'
    return isAgainstParty(kind) ? '←' : '→'
}

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
            :class="event.kind === 'heal' ? 'text-success'
              : event.kind === 'shield' ? 'text-info'
                : isAgainstParty(event.kind) ? 'text-error'
                  : event.crit ? 'text-warning font-semibold' : 'text-muted'"
          >
            <span class="opacity-60">{{ event.at.toFixed(1) }}s</span>
            {{ feedIcon(event.kind) }}
            {{ formatHq(event.damage ?? '0') }}
            <span v-if="event.crit">CRIT</span>
            <span
              v-if="event.kind === 'skill' || event.statusId"
              class="opacity-60"
            >{{ event.skillId ?? event.statusId }}</span>
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
