<script setup lang="ts">
defineProps<{
    tracks: {
        id: string
        name: string
        description: string
        level: number
        maxLevel: number
        nextCost: number | null
        effect: { current: string; next: string | null }
    }[]
    voidShards: string
    busy?: boolean
}>()

const emit = defineEmits<{ buy: [upgradeId: string] }>()

function affordable(cost: number | null, shards: string) {
    if (cost === null) return false
    return Number(shards) >= cost
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="track in tracks"
      :key="track.id"
      class="rounded-lg border border-default bg-elevated/40 p-4"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-highlighted">{{ track.name }}</span>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ track.level }} / {{ track.maxLevel }}
            </UBadge>
          </div>
          <p class="text-sm text-muted mt-0.5">
            {{ track.description }}
          </p>
          <p class="text-sm mt-1.5">
            <span class="text-highlighted font-medium">{{ track.effect.current }}</span>
            <template v-if="track.effect.next">
              <UIcon
                name="i-lucide-arrow-right"
                class="size-3 mx-1 text-muted align-middle"
              />
              <span class="text-primary font-medium">{{ track.effect.next }}</span>
            </template>
          </p>
        </div>

        <div class="shrink-0 text-right">
          <UButton
            :disabled="!affordable(track.nextCost, voidShards) || busy"
            :icon="track.nextCost === null ? 'i-lucide-check' : 'i-lucide-gem'"
            size="sm"
            @click="emit('buy', track.id)"
          >
            {{ track.nextCost === null ? 'Maxed' : formatNumber(track.nextCost) }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
