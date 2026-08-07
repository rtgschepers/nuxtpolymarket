<script setup lang="ts">
import { formatHq } from '#shared/utils/hero-quest/numbers'

const {
    initialized, run, hero, shop, classTree,
    voidShards, nextPrestigeReward, canPrestige,
    prestige, pickClass, buyUpgrade
} = useHeroQuest()

const busy = ref(false)

async function withBusy(action: () => Promise<unknown>) {
    busy.value = true
    try {
        await action()
    } finally {
        busy.value = false
    }
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
    <div
      v-if="!initialized"
      class="text-center py-16 text-muted"
    >
      Start a run first.
    </div>

    <template v-else>
      <div class="rounded-lg border border-default bg-elevated/40 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs text-muted">
            Void Shards
          </p>
          <p class="text-xl font-semibold text-primary">
            {{ formatHq(voidShards) }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-xs text-muted">
            Next full clear pays
          </p>
          <p class="text-lg font-medium text-highlighted">
            {{ formatHq(nextPrestigeReward) }}
          </p>
        </div>
      </div>

      <!--
        Void Shards land on a full World 10 / Stage 10 clear and nowhere else, and both boss
        gates in every world can only be resolved live. Prestige is therefore the one thing
        in this game idle time can never earn on its own.
      -->
      <div class="rounded-lg border p-4 space-y-3" :class="canPrestige ? 'border-primary bg-primary/5' : 'border-default bg-elevated/40'">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-medium text-highlighted">
              Prestige
            </p>
            <p class="text-sm text-muted mt-0.5">
              {{ canPrestige
                ? 'The Void is beaten. Reset to World 1 and take your levels with you.'
                : 'Clear the World 10 super boss to prestige. Your hero keeps every level and everything it owns.' }}
            </p>
          </div>
          <UButton
            :disabled="!canPrestige || busy"
            color="primary"
            icon="i-lucide-sparkles"
            @click="withBusy(prestige)"
          >
            Prestige
          </UButton>
        </div>
        <p
          v-if="run"
          class="text-xs text-muted"
        >
          Currently at {{ run.worldName }}, Stage {{ run.stage }} · Prestige {{ run.prestige }}
        </p>
      </div>

      <div>
        <h2 class="text-sm font-medium text-highlighted mb-3">
          Prestige shop
        </h2>
        <HeroQuestPrestigeShop
          :tracks="shop"
          :void-shards="voidShards"
          :busy="busy"
          @buy="id => withBusy(() => buyUpgrade(id))"
        />
      </div>

      <div>
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="text-sm font-medium text-highlighted">
            Class
          </h2>
          <p
            v-if="hero"
            class="text-xs text-muted"
          >
            Level {{ hero.level }} carries across — switching costs nothing
          </p>
        </div>
        <HeroQuestClassTree
          :nodes="classTree"
          :busy="busy"
          @pick="id => withBusy(() => pickClass(id))"
        />
      </div>
    </template>
  </div>
</template>
