<script setup lang="ts">
import { D, formatHq } from '#shared/utils/hero-quest/numbers'

/**
 * The live battle. Presentation only — it renders, it never decides, and it no longer predicts.
 *
 * **Everything on screen derives from one quantity, `killsFloat`** — kills into the current stage
 * attempt, fractional. The enemy bar, the enemy HP figure, the count of bodies still standing, the
 * Hero's HP and the stage counter are all functions of it, so they cannot disagree with each
 * other. They previously could, and did: the enemy bar swept on a free-running wall clock while
 * the HP figure beside it was a static per-enemy number that never moved.
 *
 * `killsFloat` and every other field now arrive already walked forward by `useHqLiveRun`, which is
 * also what advances the stage, the world and the Hero's level underneath this component. Keeping
 * the walk in one place matters: a second predictor here would drift against that one within
 * seconds, and the stage rollover in particular has to happen exactly once.
 *
 * Deliberately DOM rather than Pixi for Phase 1. The HP-bar contract here is the same one a Pixi
 * scene would consume, so swapping the renderer later touches no sim and no server code.
 */
const props = defineProps<{
    run: {
        enemyName: string
        killCount: number
        /** Fractional kills into the attempt — what every bar below is drawn from. */
        killsFloat: number
        killsRequired: number
        atBossGate: boolean
        /** World 10 Stage 10 is already down: the gate stays, but nothing engages it again. */
        runCleared: boolean
        walled: boolean
        killsBeforeWipe: number | null
        packSize: number
        /**
         * The **pack** total, not one body's HP — what the player is actually fighting.
         *
         * `state.get.ts` also serves per-enemy `enemyHp`, `secondsPerPack` and `partyDps`; this
         * component read none of them, so they are left out of the contract rather than declared
         * and ignored. Showing the per-body figure next to a bar that tracked the whole pack is
         * what made the encounter read as inconsistent in the first place.
         */
        packHp: string
    }
    hero: {
        className: string
        level: number
        stats: { maxHp: string; pwr: string }
    }
}>()

/**
 * Every readout, derived together from one already-projected quantity.
 *
 * The derivation lives in `hero-quest-battle.ts` rather than here so its edge cases — pack
 * rollover, an undying party, a walled stage that restarts instead of clearing — can be pinned by
 * a spec instead of only ever being exercised by looking at the screen.
 */
const view = computed(() => battleReadout({
    killsInStage: props.run.killsFloat,
    killsRequired: props.run.killsRequired,
    killsBeforeWipe: props.run.killsBeforeWipe,
    packSize: props.run.packSize,
    atBossGate: props.run.atBossGate
}))

/**
 * HP left across the whole pack, and on the Hero — both as Decimals.
 *
 * Enemy HP passes `Number.MAX_SAFE_INTEGER` early in the game, so neither can be float
 * arithmetic even though the percentages driving them are plain numbers.
 */
const enemyHpRemaining = computed(() => D(props.run.packHp).mul(view.value.enemyHpPct / 100))
const heroHpRemaining = computed(() => D(props.hero.stats.maxHp).mul(view.value.heroHpPct / 100))

const heroHpColor = computed(() => {
    if (view.value.heroHpPct <= 20) return 'error'
    if (view.value.heroHpPct <= 50) return 'warning'
    return 'success'
})
</script>

<template>
  <div class="rounded-lg border border-default bg-elevated/40 p-5 space-y-5">
    <div
      v-if="run.atBossGate"
      class="text-center py-6 space-y-2"
    >
      <UIcon
        name="i-lucide-skull"
        class="size-10 text-error"
      />
      <p class="text-lg font-semibold text-highlighted">
        {{ run.runCleared ? `${run.enemyName} is beaten` : `${run.enemyName} blocks the way` }}
      </p>
      <!--
        The copy has to match what actually happens, and what happens now depends on whether the
        run is finished. A boss engages itself while this tab is visible; a *cleared* run does
        not, or beating World 10 would re-fight the final boss on a loop.
      -->
      <p class="text-sm text-muted">
        {{ run.runCleared
          ? 'The run is complete — prestige to start the next one.'
          : 'The fight starts on its own while this tab is open, or engage it now.' }}
      </p>
    </div>

    <template v-else>
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-highlighted">
            {{ run.enemyName }}
            <!-- Counts down as bodies drop, so the pack reads as a group being worn away. -->
            <span
              v-if="run.packSize > 1"
              class="text-muted"
            >×{{ view.enemiesStanding }}</span>
          </span>
          <!-- The whole pack, remaining over total — the number the bar beside it is showing. -->
          <span class="text-muted tabular-nums">
            {{ formatHq(enemyHpRemaining) }} / {{ formatHq(run.packHp) }} HP
          </span>
        </div>
        <UProgress
          :model-value="view.enemyHpPct"
          size="sm"
          color="error"
        />
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-highlighted">
            {{ hero.className }} <span class="text-muted">Lv {{ hero.level }}</span>
          </span>
          <span class="text-muted tabular-nums">
            {{ formatHq(heroHpRemaining) }} / {{ formatHq(hero.stats.maxHp) }} HP
          </span>
        </div>
        <UProgress
          :model-value="view.heroHpPct"
          size="sm"
          :color="heroHpColor"
        />
      </div>

      <div class="pt-1">
        <div class="flex items-center justify-between text-xs text-muted mb-1">
          <span>Stage progress</span>
          <span>{{ view.displayKills }} / {{ run.killsRequired }}</span>
        </div>
        <UProgress
          :model-value="view.killProgress"
          size="md"
          :color="run.walled ? 'error' : 'primary'"
        />
      </div>

      <!--
        Only shown when it matters. `killsBeforeWipe` below `killsRequired` is the definition of
        a walled stage, and the Hero bar above will visibly empty and refill as each attempt
        restarts — this names what the player is about to watch happen.
      -->
      <p
        v-if="run.walled && run.killsBeforeWipe !== null"
        class="text-xs text-error"
      >
        This stage drops you after {{ run.killsBeforeWipe }} of
        {{ run.killsRequired }} kills — it restarts rather than clearing. Level up to break through.
      </p>
    </template>
  </div>
</template>
