<script setup lang="ts">
import { formatHq, formatSeconds } from '#shared/utils/hero-quest/numbers'

const {
    initialized, run, hero, settled, pending,
    initRun, engageBoss
} = useHeroQuest()

const fight = ref<Awaited<ReturnType<typeof engageBoss>>>(null)
const engaging = ref(false)

async function onEngage() {
    engaging.value = true
    try {
        fight.value = await engageBoss()
    } finally {
        engaging.value = false
    }
}

/**
 * Only worth showing when the player was actually away — an online settle covers ~60s and
 * banking three kills is not news.
 */
const awayReport = computed(() => {
    const report = settled.value
    if (!report || report.online || report.kills <= 0) return null
    return report
})
</script>

<template>
  <div class="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
    <div
      v-if="pending && !run"
      class="text-center py-16 text-muted"
    >
      Loading…
    </div>

    <!-- Founding is explicit, so the run never starts behind the player's back. -->
    <div
      v-else-if="!initialized"
      class="text-center py-16 space-y-4"
    >
      <UIcon
        name="i-lucide-swords"
        class="size-12 text-primary"
      />
      <h1 class="text-2xl font-semibold text-highlighted">
        Hero Quest
      </h1>
      <p class="text-muted max-w-md mx-auto">
        Ten worlds, ten stages each. Your hero fights on its own — even while you're away.
        Bosses are the one thing that waits for you.
      </p>
      <UButton
        size="lg"
        icon="i-lucide-play"
        @click="initRun()"
      >
        Begin the quest
      </UButton>
    </div>

    <template v-else-if="run && hero">
      <UAlert
        v-if="awayReport"
        color="primary"
        variant="subtle"
        icon="i-lucide-moon"
        title="While you were away"
        :description="`${formatNumber(awayReport.kills)} kills over ${formatSeconds(awayReport.effectiveSeconds)} of counted time — ${formatNumber(awayReport.goldEarned)} gold`
          + (awayReport.levelsGained > 0 ? `, ${awayReport.levelsGained} level${awayReport.levelsGained === 1 ? '' : 's'}` : '')
          + (awayReport.blockedAtBoss ? '. Your run is parked at a boss.' : '.')"
      />

      <HeroQuestRunPosition :run="run" />

      <HeroQuestBattleView
        :run="run"
        :hero="hero"
      />

      <div
        v-if="run.atBossGate"
        class="flex justify-center"
      >
        <UButton
          size="lg"
          color="error"
          icon="i-lucide-swords"
          :loading="engaging"
          @click="onEngage"
        >
          Fight the {{ run.enemyName }}
        </UButton>
      </div>

      <div class="rounded-lg border border-default bg-elevated/40 p-4">
        <div class="flex items-center justify-between mb-3">
          <span class="font-medium text-highlighted">{{ hero.className }}</span>
          <span class="text-sm text-muted">Level {{ hero.level }}</span>
        </div>

        <div class="mb-4">
          <div class="flex items-center justify-between text-xs text-muted mb-1">
            <span>Experience</span>
            <span>{{ formatHq(hero.xp) }} / {{ formatHq(hero.xpToNextLevel) }}</span>
          </div>
          <UProgress
            :model-value="hero.xpProgress * 100"
            size="sm"
          />
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <div class="text-xs text-muted">
              Power
            </div>
            <div class="font-medium text-highlighted">
              {{ formatHq(hero.stats.pwr) }}
            </div>
          </div>
          <div>
            <div class="text-xs text-muted">
              Defence
            </div>
            <div class="font-medium text-highlighted">
              {{ formatHq(hero.stats.def) }}
            </div>
          </div>
          <div>
            <div class="text-xs text-muted">
              Health
            </div>
            <div class="font-medium text-highlighted">
              {{ formatHq(hero.stats.maxHp) }}
            </div>
          </div>
          <div>
            <div class="text-xs text-muted">
              Crit
            </div>
            <div class="font-medium text-highlighted">
              {{ Math.round(hero.stats.critChance * 100) }}%
            </div>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-default">
          <p class="text-xs text-muted mb-1.5">
            Skills — every one fires the moment its cooldown ends
          </p>
          <div class="flex flex-wrap gap-1.5">
            <UBadge
              v-for="skill in hero.skills"
              :key="skill.id"
              color="neutral"
              variant="subtle"
            >
              {{ skill.name }}
            </UBadge>
          </div>
        </div>
      </div>
    </template>

    <HeroQuestBossFightModal
      :fight="fight"
      :enemy-name="run?.enemyName ?? 'Boss'"
      :boss-timer-seconds="run?.bossTimerSeconds ?? 30"
      @close="fight = null"
    />
  </div>
</template>
