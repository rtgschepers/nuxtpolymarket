<script setup lang="ts">
import { formatHq } from '#shared/utils/hero-quest/numbers'

/**
 * Where every stat on every fielded unit comes from.
 *
 * Renders `explainStats` — the same structure `bun run sim:hero-quest --report=stats` prints — so
 * the panel and the sim can never describe the pipeline differently. Presentation only; it holds
 * no formula and derives nothing.
 *
 * ## Two things it is careful about
 *
 * **Per-source lines are shown as `+x%`, never as multipliers.** Gear, Skills and Artifacts stack
 * additively (`modifiers.ts`), so a reader who multiplied three ×1.2 chips together would get
 * ×1.73 where the game gives ×1.60. The stage carries the one real factor; its parts carry the
 * additive percentages that produced it.
 *
 * **The unbounded stage is marked.** Exactly one source per unit compounds — the level curve —
 * and everything else is a fixed multiplier on a moving number. That is the single most useful
 * thing this panel can say to someone looking at a scaling problem, so it is a badge rather than
 * something to be inferred from the numbers.
 *
 * Fetched on open rather than with the state payload: it is several kilobytes of attribution and
 * the state payload is re-read every minute by every client.
 */
const open = defineModel<boolean>('open', { required: true })

// No `await`: with `immediate: false` there is nothing to wait for, and awaiting here would
// make the component's setup async and put it behind the page's Suspense boundary for no gain.
const { data, status, refresh } = useFetch('/api/hero-quest/stats', {
    key: 'hero-quest-stats',
    immediate: false,
    default: () => null
})

// Re-read on every open — levels and equipment move between visits, and a stale breakdown is
// worse than a spinner because it looks authoritative.
watch(open, (isOpen) => { if (isOpen) refresh() })

/** Which unit's table is showing. Index into `units`, Hero first. */
const selected = ref(0)
watch(data, () => { selected.value = 0 })

const unit = computed(() => data.value?.units?.[selected.value] ?? null)

function factorLabel(factor: string) {
    const value = Number(factor)
    return Number.isFinite(value) ? `×${value.toFixed(4)}` : `×${factor}`
}

function partLabel(amount: number, isBase: boolean) {
    if (isBase) return amount > 0 ? `+${amount}` : String(amount)
    return `${amount >= 0 ? '+' : ''}${(amount * 100).toFixed(1)}%`
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Stat breakdown"
    description="Every source, and what it is worth against the enemy curve"
  >
    <template #body>
      <div
        v-if="status === 'pending'"
        class="py-12 text-center text-muted"
      >
        Working it out…
      </div>

      <div
        v-else-if="!data || !unit"
        class="py-12 text-center text-muted"
      >
        Nothing to break down yet.
      </div>

      <div
        v-else
        class="space-y-5"
      >
        <!-- Only rendered for a real party; a solo Hero has nothing to switch between. -->
        <div
          v-if="data.units.length > 1"
          class="flex flex-wrap gap-1.5"
        >
          <UButton
            v-for="(entry, index) in data.units"
            :key="entry.label"
            size="xs"
            :color="index === selected ? 'primary' : 'neutral'"
            :variant="index === selected ? 'solid' : 'subtle'"
            @click="selected = index"
          >
            {{ entry.role ? `${entry.label} · ${entry.role}` : entry.label }}
          </UButton>
        </div>

        <div
          v-for="stat in unit.stats"
          :key="stat.key"
          class="rounded-lg border border-default bg-elevated/40 p-3"
        >
          <div class="flex items-baseline justify-between mb-2">
            <span class="font-medium text-highlighted">
              {{ stat.label }}
              <span class="text-xs text-muted">{{ stat.tier }}</span>
            </span>
            <span class="tabular-nums font-medium text-highlighted">{{ formatHq(stat.final) }}</span>
          </div>

          <div class="space-y-1.5 text-sm">
            <div
              v-for="stage in stat.stages"
              :key="stage.id"
              class="space-y-0.5"
            >
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-muted flex items-center gap-1.5">
                  {{ stage.label }}
                  <!--
                    The scaling answer, stated rather than implied: this is the only source that
                    compounds. Everything else shifts the wall once and then stops helping.
                  -->
                  <UBadge
                    v-if="stage.unbounded"
                    color="primary"
                    variant="subtle"
                    size="xs"
                  >
                    compounds
                  </UBadge>
                  <UBadge
                    v-if="stage.floored"
                    color="warning"
                    variant="subtle"
                    size="xs"
                  >
                    floored
                  </UBadge>
                </span>
                <span class="tabular-nums text-highlighted shrink-0">
                  {{ stage.id === 'base' ? formatHq(stage.factor) : factorLabel(stage.factor) }}
                </span>
              </div>

              <!--
                Additive parts, shown as percentages precisely so nobody multiplies them. The
                factor above is the number the game used; these are what summed to it.
              -->
              <div
                v-for="part in stage.parts.filter(p => p.amount !== 0)"
                :key="part.label"
                class="flex items-baseline justify-between gap-2 pl-4 text-xs text-dimmed"
              >
                <span>{{ part.label }}</span>
                <span class="tabular-nums shrink-0">{{ partLabel(part.amount, stage.id === 'base') }}</span>
              </div>
            </div>
          </div>

          <p class="mt-2 text-xs text-dimmed">
            Worth {{ stat.stagesOfCurve.toFixed(1) }} stages of enemy curve on its own.
          </p>
        </div>

        <div class="rounded-lg border border-default bg-elevated/40 p-3 space-y-1.5">
          <p class="font-medium text-highlighted text-sm">
            Derived from those stats
          </p>
          <div
            v-for="derived in unit.derived"
            :key="derived.key"
            class="text-sm"
          >
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-muted">{{ derived.label }}</span>
              <span class="tabular-nums text-highlighted shrink-0">{{ derived.value }}</span>
            </div>
            <p class="text-xs text-dimmed font-mono break-words">
              {{ derived.formula }}
            </p>
            <p
              v-if="derived.note"
              class="text-xs text-warning"
            >
              {{ derived.note }}
            </p>
          </div>
        </div>

        <!--
          The common denominator. Without it "×1.36 from your collection" is unanswerable; with
          it, every source in the panel is comparable to a hero level and to a prestige loop.
        -->
        <div class="rounded-lg border border-default bg-elevated/40 p-3 space-y-1 text-sm">
          <p class="font-medium text-highlighted">
            Pacing
          </p>
          <div class="flex justify-between">
            <span class="text-muted">Stat growth per level</span>
            <span class="tabular-nums">×{{ data.pacing.statGrowthPerLevel.toFixed(6) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Enemy growth per stage</span>
            <span class="tabular-nums">×{{ data.pacing.enemyStepBase }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">One level buys</span>
            <span class="tabular-nums">{{ data.pacing.stagesPerLevel.toFixed(2) }} stages</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">One stage costs</span>
            <span class="tabular-nums">{{ data.pacing.levelsPerStage.toFixed(2) }} levels</span>
          </div>
          <p class="text-xs text-dimmed pt-1">
            Only the level curve compounds. Every other source is a fixed multiplier — it moves
            the wall by a constant number of stages and then never helps again.
          </p>
        </div>
      </div>
    </template>
  </USlideover>
</template>
