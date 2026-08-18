<script setup lang="ts">
/**
 * One entry in a collection grid — owned or not.
 *
 * The four grids were four near-copies of this card (session-1 playtest, finding 5), differing
 * only in the subtitle, the equip button, and which detail lines they printed. Those three are
 * slots; everything else — the name, the rarity colour, the star/level, the dupe bar and the
 * craft button — is identical by construction, which is the same argument that makes
 * `gacha/pull.post.ts` one route.
 *
 * **Unowned entries stay in place as locked `???` cards** rather than being hidden or moved to
 * the end. That is what makes the grid a checklist: the gap where a Mythic will go is visible
 * from the first pull, and the "Missing" filter is how you look at only the gaps.
 */
const props = defineProps<{
    entry: {
        id: string
        name: string
        rarity: string
        owned: boolean
        star: number
        level: number
        dupeProgress: number
        dupesToLevelUp: number | null
        maxed: boolean
        craftCost: number
    }
    /** The system's own second axis, spelled for a human: "Vanguard", "Weapon", "Active". */
    subtitle: string
    /** This gacha's Essence balance, so the craft button can gate itself. */
    essence: number
    busy?: boolean
}>()

const emit = defineEmits<{ craft: [] }>()

const affordable = computed(() => props.essence >= props.entry.craftCost)
</script>

<template>
  <div
    class="rounded-lg border p-3 space-y-2 flex flex-col"
    :class="props.entry.owned
      ? 'border-default bg-elevated/40'
      : 'border-default/50 bg-background opacity-60'"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p
          class="text-sm font-medium truncate"
          :class="hqRarityClass(props.entry.rarity)"
        >
          {{ props.entry.owned ? props.entry.name : '???' }}
        </p>
        <p class="text-xs text-muted capitalize">
          {{ props.subtitle }} · {{ props.entry.rarity }}
        </p>
      </div>
      <!-- Equip / field / slot — whatever this system calls putting a copy to work. -->
      <slot name="action" />
    </div>

    <!-- Effect lines, stat bonuses, ability names: whatever this system has to say. -->
    <slot name="detail" />

    <template v-if="props.entry.owned">
      <p class="text-xs text-muted">
        {{ props.entry.star }}★ Lv{{ props.entry.level }}
        <slot name="meta" />
      </p>
      <!-- Finding 7: the count lives in the bar, not in a sentence beside it. -->
      <HeroQuestDupeBar
        :progress="props.entry.dupeProgress"
        :needed="props.entry.dupesToLevelUp"
        :maxed="props.entry.maxed"
      />
    </template>

    <!--
      Crafting is the RNG bypass: Essence comes only from duplicates of already-maxed copies, so
      this is the far end of the collection loop rather than a parallel one. It shows on locked
      entries too — buying your way to a first copy is exactly what it is for.
    -->
    <UButton
      v-if="!props.entry.maxed"
      size="xs"
      variant="ghost"
      color="neutral"
      block
      class="mt-auto"
      icon="i-lucide-hammer"
      :disabled="props.busy || !affordable"
      @click="emit('craft')"
    >
      Craft · {{ formatNumber(props.entry.craftCost, false) }} essence
    </UButton>
  </div>
</template>
