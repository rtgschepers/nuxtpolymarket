<script setup lang="ts">
import type { HqOwnership } from '~/utils/hero-quest-collection'

/**
 * Rarity / ownership / axis filters, plus the owned count, above a collection grid.
 *
 * One toolbar for all four grids (session-1 playtest, finding 5). The only thing that differs
 * per system is the third filter — archetype, slot, type, category — so it arrives as a label
 * and a list of options rather than being four components.
 */
defineProps<{
    /** What the system's own second axis is called: "Archetype", "Slot", "Type", "Category". */
    axisLabel: string
    axisOptions: readonly { value: string; label: string }[]
    owned: number
    total: number
    /** How many entries survive the current filters, so an empty result is explainable. */
    showing: number
}>()

const rarity = defineModel<string>('rarity', { required: true })
const ownership = defineModel<HqOwnership>('ownership', { required: true })
const axis = defineModel<string>('axis', { required: true })

const anyFilter = computed(() =>
    rarity.value !== 'all' || ownership.value !== 'all' || axis.value !== 'all')

function clear() {
    rarity.value = 'all'
    ownership.value = 'all'
    axis.value = 'all'
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <h2 class="text-sm font-medium text-highlighted">
        Collection — {{ owned }}/{{ total }}
        <span
          v-if="showing !== total"
          class="text-xs text-muted font-normal"
        >· {{ showing }} shown</span>
      </h2>
      <UButton
        v-if="anyFilter"
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-filter-x"
        @click="clear"
      >
        Clear filters
      </UButton>
    </div>

    <div class="flex flex-wrap gap-x-6 gap-y-2">
      <!--
        Rarity first because the grid is sorted by it — the filter and the order agree, so
        picking one is the same as jumping to its block.
      -->
      <div class="flex items-center gap-1 flex-wrap">
        <span class="text-[0.625rem] uppercase tracking-wide text-muted mr-1">Rarity</span>
        <UButton
          size="xs"
          :variant="rarity === 'all' ? 'solid' : 'ghost'"
          :color="rarity === 'all' ? 'primary' : 'neutral'"
          @click="rarity = 'all'"
        >
          All
        </UButton>
        <UButton
          v-for="(value, index) in HQ_RARITY_ORDER"
          :key="value"
          size="xs"
          :variant="rarity === value ? 'solid' : 'ghost'"
          :color="rarity === value ? 'primary' : 'neutral'"
          :class="rarity === value ? '' : hqRarityClass(value)"
          @click="rarity = value"
        >
          {{ HQ_RARITY_LABEL[index] }}
        </UButton>
      </div>

      <div class="flex items-center gap-1 flex-wrap">
        <span class="text-[0.625rem] uppercase tracking-wide text-muted mr-1">{{ axisLabel }}</span>
        <UButton
          size="xs"
          :variant="axis === 'all' ? 'solid' : 'ghost'"
          :color="axis === 'all' ? 'primary' : 'neutral'"
          @click="axis = 'all'"
        >
          All
        </UButton>
        <UButton
          v-for="option in axisOptions"
          :key="option.value"
          size="xs"
          :variant="axis === option.value ? 'solid' : 'ghost'"
          :color="axis === option.value ? 'primary' : 'neutral'"
          @click="axis = option.value"
        >
          {{ option.label }}
        </UButton>
      </div>

      <div class="flex items-center gap-1 flex-wrap">
        <span class="text-[0.625rem] uppercase tracking-wide text-muted mr-1">Show</span>
        <UButton
          v-for="option in HQ_OWNERSHIP_OPTIONS"
          :key="option.value"
          size="xs"
          :variant="ownership === option.value ? 'solid' : 'ghost'"
          :color="ownership === option.value ? 'primary' : 'neutral'"
          @click="ownership = option.value"
        >
          {{ option.label }}
        </UButton>
      </div>
    </div>
  </div>
</template>
