<script setup lang="ts">
/**
 * Duplicate progress toward the next level-up, as a bar with the count inside it.
 *
 * Replaces the `3/5 dupes` text every collection grid used to print (session-1 playtest,
 * finding 7). The count stays *in* the bar rather than beside it because the two are one fact —
 * a bar with the numbers next to it reads as two things to look at, and at this size there is no
 * room for both.
 *
 * Holds no game math: `progress` and `needed` are both server-derived, and a maxed copy is a
 * server-derived flag rather than something inferred from the two numbers matching.
 */
const props = defineProps<{
    progress: number
    /** Dupes required for the next level. `null` once there is no next level. */
    needed: number | null
    maxed: boolean
}>()

const pct = computed(() => {
    if (props.maxed) return 100
    if (!props.needed || props.needed <= 0) return 0
    return Math.min(100, Math.round((props.progress / props.needed) * 100))
})
</script>

<template>
  <div
    class="relative h-4 w-full rounded-full bg-elevated overflow-hidden"
    :title="maxed ? 'Fully levelled' : `${progress} of ${needed} duplicates toward the next level`"
  >
    <div
      class="absolute inset-y-0 left-0 transition-[width] duration-300"
      :class="maxed ? 'bg-warning/50' : 'bg-primary/40'"
      :style="{ width: `${pct}%` }"
    />
    <!--
      Centred over the fill rather than inside it: a label that lives in the filled part
      disappears at 0% and clips at every width in between.
    -->
    <span class="absolute inset-0 grid place-items-center text-[0.625rem] leading-none font-medium text-highlighted tabular-nums">
      <template v-if="maxed">MAX</template>
      <template v-else>{{ progress }} / {{ needed ?? '—' }}</template>
    </span>
  </div>
</template>
