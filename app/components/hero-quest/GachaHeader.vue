<script setup lang="ts">
/**
 * The recruitment block every gacha tab shares — currencies, level, pull buttons, the Gold
 * ladder, and the drop odds.
 *
 * One component rather than four copies, for the same reason `gacha/pull.post.ts` is one route:
 * `gacha-shared-system.md` makes the four deliberately parallel, so anything that differs between
 * them is only the label. What each page adds on top is its own collection grid, which is where
 * the systems genuinely diverge — slots and an upgrade badge for the Forge, an Active/Passive
 * split for the Training Grounds, effect lines for the Dig-site.
 *
 * Holds no game math. Drop rates, costs and the ladder's current rung all arrive pre-derived from
 * `state.get.ts`, because the server is the only thing allowed to decide any of them.
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
    }
    /** Player-facing name of this gacha's pull currency. */
    sealName: string
    /** Player-facing name of its crafting currency. */
    essenceName: string
    busy?: boolean
}>()

const emit = defineEmits<{
    pull: [count: 1 | 10]
    buySeals: []
}>()

const { user } = useAuth()
const goldBalance = computed(() => parseFloat(user.value?.balance ?? '0'))
</script>

<template>
  <div class="rounded-lg border border-default bg-elevated/40 p-4 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex gap-6">
        <div>
          <p class="text-xs text-muted">
            {{ props.sealName }}
          </p>
          <p class="text-xl font-semibold text-primary">
            {{ formatNumber(props.gacha.seals, false) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">
            {{ props.essenceName }}
          </p>
          <p class="text-xl font-semibold text-highlighted">
            {{ formatNumber(props.gacha.essence, false) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-muted">
            Level
          </p>
          <p class="text-xl font-semibold text-highlighted">
            {{ props.gacha.gachaLevel }}
            <span
              v-if="props.gacha.pullsToNextLevel"
              class="text-xs text-muted font-normal"
            >
              · {{ props.gacha.gachaProgress }}/{{ props.gacha.pullsToNextLevel }}
            </span>
          </p>
        </div>
      </div>

      <div class="flex gap-2">
        <UButton
          :disabled="props.busy || props.gacha.seals < props.gacha.singleCost"
          icon="i-lucide-dices"
          @click="emit('pull', 1)"
        >
          Pull · {{ props.gacha.singleCost }}
        </UButton>
        <UButton
          :disabled="props.busy || props.gacha.seals < props.gacha.tenPullCost"
          color="primary"
          icon="i-lucide-layers"
          @click="emit('pull', 10)"
        >
          10-pull · {{ props.gacha.tenPullCost }}
        </UButton>
      </div>
    </div>

    <!--
      The Gold sink. Each Seal bought today costs more than the last, and the counter resets
      daily — every gacha has its own counter, so buying here never moves another tab's price.
    -->
    <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-default">
      <p class="text-xs text-muted">
        Buy a Seal with Gold — {{ formatNumber(props.gacha.nextSealPrice) }}
        <span v-if="props.gacha.sealsBoughtToday > 0">
          · {{ props.gacha.sealsBoughtToday }} bought today, price resets at midnight UTC
        </span>
      </p>
      <UButton
        size="xs"
        variant="soft"
        icon="i-lucide-coins"
        :disabled="props.busy || goldBalance < props.gacha.nextSealPrice"
        @click="emit('buySeals')"
      >
        Buy 1 Seal
      </UButton>
    </div>

    <!-- A 10-pull costs 9 Seals but still advances the level by 10. -->
    <p class="text-xs text-muted">
      Drop rates at level {{ props.gacha.gachaLevel }}:
      <span
        v-for="(rate, index) in props.gacha.dropRates"
        :key="index"
      >
        <template v-if="rate > 0">
          <span :class="hqRarityClass(HQ_RARITY_ORDER[index] ?? 'common')">
            {{ HQ_RARITY_LABEL[index] }} {{ rate }}%
          </span>
          <span>&nbsp;</span>
        </template>
      </span>
    </p>
  </div>
</template>
