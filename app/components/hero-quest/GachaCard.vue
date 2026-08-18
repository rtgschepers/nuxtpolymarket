<script setup lang="ts">
/**
 * One gacha, as a card in the 2×2 hub.
 *
 * Replaces `GachaHeader.vue`, which was a full-width block on a page of its own per gacha
 * (session-1 playtest, finding 4: "the gacha pages are very cluttered"). Four of these tile
 * instead, so every pull button in the game is on one screen and the collection grids that used
 * to sit underneath moved to `/hero-quest/collections`.
 *
 * Still one component rather than four, for the same reason `gacha/pull.post.ts` is one route:
 * `gacha-shared-system.md` makes the four deliberately parallel, so everything except the labels
 * and the icon is identical by construction.
 *
 * Holds no game math. Drop rates, costs and the ladder's current rung all arrive pre-derived
 * from `state.get.ts`, because the server is the only thing allowed to decide any of them.
 */
const props = defineProps<{
    gacha: {
        system: string
        label: string
        seals: number
        essence: number
        gachaLevel: number
        gachaProgress: number
        pullsToNextLevel: number | null
        dropRates: readonly number[]
        singleCost: number
        tenPullCost: number
        sealsBoughtToday: number
        nextSealPrice: number
        freePull: {
            used: number
            remaining: number
            available: boolean
            unlocksAt: number | null
        }
    }
    icon: string
    /** Player-facing name of this gacha's pull currency. */
    sealName: string
    /** Player-facing name of its crafting currency. */
    essenceName: string
    /** Where this gacha's collection lives, now that it is no longer on this page. */
    collectionTo: string
    owned: number
    total: number
    busy?: boolean
}>()

const emit = defineEmits<{
    pull: [count: 1 | 10]
    freePull: []
    buySeals: []
}>()

const { user } = useAuth()
const goldBalance = computed(() => parseFloat(user.value?.balance ?? '0'))

const showRates = ref(false)

const countdown = useHqCountdown(() =>
    props.gacha.freePull.available ? null : props.gacha.freePull.unlocksAt)

const levelProgressPct = computed(() => {
    const needed = props.gacha.pullsToNextLevel
    if (!needed) return 100
    return Math.min(100, Math.round((props.gacha.gachaProgress / needed) * 100))
})
</script>

<template>
  <div class="rounded-lg border border-default bg-elevated/40 p-4 flex flex-col gap-3">
    <!-- Title row: identity, level, and the odds the pull buttons below are about to use. -->
    <div class="flex items-start justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <UIcon
          :name="props.icon"
          class="size-4 text-primary shrink-0"
        />
        <h2 class="text-sm font-medium text-highlighted truncate">
          {{ props.gacha.label }}
        </h2>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <span class="text-xs text-muted">
          Lv {{ props.gacha.gachaLevel }}
          <template v-if="props.gacha.pullsToNextLevel">
            · {{ props.gacha.gachaProgress }}/{{ props.gacha.pullsToNextLevel }}
          </template>
          <template v-else>· max</template>
        </span>
        <!-- Finding 4's info icon: the whole ladder, not just this level's row. -->
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-info"
          :aria-label="`${props.gacha.label} drop rates`"
          @click="showRates = true"
        />
      </div>
    </div>

    <UProgress
      :model-value="levelProgressPct"
      size="xs"
      color="neutral"
    />

    <div class="flex gap-5">
      <div>
        <p class="text-[0.625rem] uppercase tracking-wide text-muted">
          {{ props.sealName }}
        </p>
        <p class="text-lg font-semibold text-primary leading-tight">
          {{ formatNumber(props.gacha.seals, false) }}
        </p>
      </div>
      <div>
        <p class="text-[0.625rem] uppercase tracking-wide text-muted">
          {{ props.essenceName }}
        </p>
        <p class="text-lg font-semibold text-highlighted leading-tight">
          {{ formatNumber(props.gacha.essence, false) }}
        </p>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <!--
        The free 10-pull sits first and stays visible while on cooldown rather than vanishing —
        a button that disappears reads as a bug, and the countdown is the point of the mechanic.
      -->
      <UButton
        v-if="props.gacha.freePull.available || countdown"
        size="sm"
        :disabled="props.busy || !props.gacha.freePull.available"
        :color="props.gacha.freePull.available ? 'success' : 'neutral'"
        :variant="props.gacha.freePull.available ? 'solid' : 'soft'"
        icon="i-lucide-gift"
        @click="emit('freePull')"
      >
        <template v-if="props.gacha.freePull.available">
          Free 10
          <span
            v-if="props.gacha.freePull.remaining > 1"
            class="text-xs opacity-75"
          >· {{ props.gacha.freePull.remaining }}</span>
        </template>
        <template v-else>
          {{ countdown }}
        </template>
      </UButton>
      <UButton
        size="sm"
        variant="soft"
        :disabled="props.busy || props.gacha.seals < props.gacha.singleCost"
        icon="i-lucide-dices"
        @click="emit('pull', 1)"
      >
        Pull · {{ props.gacha.singleCost }}
      </UButton>
      <UButton
        size="sm"
        color="primary"
        :disabled="props.busy || props.gacha.seals < props.gacha.tenPullCost"
        icon="i-lucide-layers"
        @click="emit('pull', 10)"
      >
        10-pull · {{ props.gacha.tenPullCost }}
      </UButton>
    </div>

    <!--
      The Gold sink. Each Seal bought today costs more than the last, and the counter resets
      daily — every gacha has its own counter, so buying here never moves another tab's price.
    -->
    <div class="flex items-center justify-between gap-3 pt-2 mt-auto border-t border-default">
      <p class="text-xs text-muted min-w-0">
        Seal for {{ formatNumber(props.gacha.nextSealPrice) }} Gold
        <span
          v-if="props.gacha.sealsBoughtToday > 0"
          class="block text-[0.625rem]"
        >{{ props.gacha.sealsBoughtToday }} bought today · resets at midnight UTC</span>
      </p>
      <UButton
        size="xs"
        variant="soft"
        icon="i-lucide-coins"
        :disabled="props.busy || goldBalance < props.gacha.nextSealPrice"
        @click="emit('buySeals')"
      >
        Buy
      </UButton>
    </div>

    <NuxtLink
      :to="props.collectionTo"
      class="flex items-center justify-between gap-2 text-xs text-muted hover:text-primary transition-colors"
    >
      <span>Collection — {{ props.owned }}/{{ props.total }}</span>
      <UIcon
        name="i-lucide-arrow-right"
        class="size-3.5"
      />
    </NuxtLink>

    <HeroQuestDropRatesModal
      v-model:open="showRates"
      :label="props.gacha.label"
      :gacha-level="props.gacha.gachaLevel"
    />
  </div>
</template>
