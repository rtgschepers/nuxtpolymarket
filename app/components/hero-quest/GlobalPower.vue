<script setup lang="ts">
import { D, formatHq } from '#shared/utils/hero-quest/numbers'
import type { Decimal } from '#shared/utils/hero-quest/numbers'

/**
 * The Global Power Number, as the battle screen's headline (`global-power-number.md`).
 *
 * Presentation only — the value is the server's, computed from the same snapshot as every stat
 * on this page. What this adds is how a *change* reads:
 *
 * - **It counts to the new value** rather than snapping. The tween runs in log space, because the
 *   number rides an exponential curve: a linear tween from 3.4B to 9.1B spends its whole duration
 *   on the last digits, while a log tween moves at the pace the number actually grew.
 * - **A chip names the change** — `+12%` for an ordinary step, `×3.2` once it has more than
 *   doubled — and fades after a moment. It goes down too, in the error colour: GPN is a live
 *   reading and benching a Champion lowers it, which the player should see rather than discover.
 *
 * The first value after mount is shown as-is, with no chip — arriving on the page is not a gain.
 * `prefers-reduced-motion` skips the tween and keeps the chip.
 */
const props = defineProps<{
    /** Decimal strings, as the payload carries them. */
    gpn: string
    dps: string
    ehp: string
}>()

const TWEEN_MS = 900
const CHIP_MS = 2600

const shown = ref<Decimal>(D(props.gpn))
const change = ref<{ label: string; up: boolean } | null>(null)

let frame = 0
let chipTimer: ReturnType<typeof setTimeout> | null = null

function log10Of(value: Decimal): number {
    return value.lte(0) ? 0 : value.log10().toNumber()
}

function changeLabel(from: Decimal, to: Decimal): { label: string; up: boolean } | null {
    if (from.lte(0) || to.eq(from)) return null
    const ratio = to.div(from)
    const up = ratio.gt(1)
    if (up && ratio.gte(2)) return { label: `×${formatHq(ratio, 1)}`, up }
    const pct = ratio.sub(1).mul(100).toNumber()
    // Below a tenth of a percent the chip would read "+0.0%", which is noise rather than news.
    if (Math.abs(pct) < 0.1) return null
    return { label: `${up ? '+' : '−'}${Math.abs(pct).toFixed(pct > -10 && pct < 10 ? 1 : 0)}%`, up }
}

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

watch(() => props.gpn, (next, previous) => {
    const to = D(next)
    const from = D(previous)

    const label = changeLabel(from, to)
    if (label) {
        change.value = label
        if (chipTimer) clearTimeout(chipTimer)
        chipTimer = setTimeout(() => { change.value = null }, CHIP_MS)
    }

    cancelAnimationFrame(frame)
    if (prefersReducedMotion() || from.lte(0) || to.lte(0)) {
        shown.value = to
        return
    }

    // Tween from whatever is on screen now, so a payload landing mid-tween continues smoothly.
    const startLog = log10Of(shown.value)
    const endLog = log10Of(to)
    const startedAt = performance.now()
    const step = (now: number) => {
        const t = Math.min(1, (now - startedAt) / TWEEN_MS)
        const eased = 1 - Math.pow(1 - t, 3)
        shown.value = t >= 1 ? to : D(10).pow(startLog + (endLog - startLog) * eased)
        if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
})

onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    if (chipTimer) clearTimeout(chipTimer)
})
</script>

<template>
  <div class="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
    <div class="flex items-center justify-between gap-3">
      <div class="text-xs font-medium uppercase tracking-wide text-primary flex items-center gap-0.5">
        <UIcon
          name="i-lucide-zap"
          class="size-3.5"
        />
        {{ HQ_POWER_DOC.name }}
        <HeroQuestInfoTip
          :title="HQ_POWER_DOC.name"
          :body="HQ_POWER_DOC.short"
          :formula="HQ_POWER_DOC.formula"
          to="/hero-quest/wiki/combat"
        />
      </div>

      <Transition
        enter-active-class="transition duration-200"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="transition duration-500"
        leave-to-class="opacity-0"
      >
        <UBadge
          v-if="change"
          :key="change.label"
          :color="change.up ? 'success' : 'error'"
          variant="subtle"
          size="sm"
          :icon="change.up ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
          class="tabular-nums"
        >
          {{ change.label }}
        </UBadge>
      </Transition>
    </div>

    <div
      class="mt-1 text-3xl font-semibold text-highlighted tabular-nums transition-transform duration-300"
      :class="change?.up ? 'scale-[1.03] origin-left' : ''"
      aria-live="polite"
    >
      {{ formatHq(shown) }}
    </div>

    <div class="mt-1 flex flex-wrap gap-x-4 text-xs text-muted tabular-nums">
      <span>Party DPS {{ formatHq(props.dps) }}</span>
      <span>Effective HP {{ formatHq(props.ehp) }}</span>
    </div>
  </div>
</template>
