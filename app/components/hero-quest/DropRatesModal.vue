<script setup lang="ts">
import { MAX_GACHA_LEVEL, PULLS_TO_LEVEL_UP } from '#shared/utils/hero-quest/constants'
import { dropRatesFor } from '#shared/utils/hero-quest/gacha'

/**
 * The full drop table for one gacha — every rarity at every level, not just the current row.
 *
 * Session-1 playtest, finding 4: the pull buttons showed only today's odds, so there was no way
 * to see what levelling a gacha actually buys. This is the whole ladder, with the player's
 * current rung marked.
 *
 * **Derived on the client, and that is not a server-authority violation.** The drop table is
 * public content — `dropRatesFor` is the same pure function the server rolls against, so a
 * tampered client can only lie to itself about odds it cannot influence. What stays server-side
 * is the *roll*, which is the part that decides a payout.
 *
 * The table is identical for all four gachas by construction (`gacha-shared-system.md` §3), so
 * only the title differs — but it is shown per gacha because the *current level* differs, and
 * that is the row the player is actually reading.
 */
const props = defineProps<{
    label: string
    gachaLevel: number
}>()

const open = defineModel<boolean>('open', { required: true })

const levels = Array.from({ length: MAX_GACHA_LEVEL }, (_, index) => index + 1)

const rows = computed(() => levels.map(level => ({
    level,
    rates: dropRatesFor(level),
    /** Pulls needed to leave this level — `null` at the cap, which has nothing after it. */
    pulls: level >= MAX_GACHA_LEVEL ? null : (PULLS_TO_LEVEL_UP[level] ?? null),
    current: level === props.gachaLevel
})))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`${props.label} — drop rates`"
    description="Every rarity at every gacha level. Levels come from pulls made, not Seals spent."
  >
    <template #body>
      <!-- Six rarity columns do not fit a phone; the table scrolls rather than the page. -->
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="text-muted">
              <th class="text-left font-medium py-1.5 pr-3 whitespace-nowrap">
                Level
              </th>
              <th
                v-for="(rarityLabel, index) in HQ_RARITY_LABEL"
                :key="rarityLabel"
                class="text-right font-medium py-1.5 px-2 whitespace-nowrap"
                :class="hqRarityClass(HQ_RARITY_ORDER[index] ?? 'common')"
              >
                {{ rarityLabel }}
              </th>
              <th class="text-right font-medium py-1.5 pl-3 whitespace-nowrap">
                Pulls
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.level"
              class="border-t border-default"
              :class="row.current ? 'bg-primary/10' : ''"
            >
              <td class="py-1.5 pr-3 whitespace-nowrap">
                <span :class="row.current ? 'text-primary font-medium' : 'text-muted'">
                  {{ row.level }}
                  <span
                    v-if="row.current"
                    class="text-[0.625rem]"
                  >· you</span>
                </span>
              </td>
              <td
                v-for="(rate, index) in row.rates"
                :key="index"
                class="text-right py-1.5 px-2 tabular-nums"
                :class="rate > 0 ? 'text-default' : 'text-muted/40'"
              >
                {{ rate > 0 ? `${rate}%` : '—' }}
              </td>
              <td class="text-right py-1.5 pl-3 tabular-nums text-muted">
                {{ row.pulls ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-xs text-muted mt-3">
        The <span class="text-default">Pulls</span> column is how many pulls it takes to leave
        that level. A 10-pull costs nine Seals but still counts as ten.
      </p>
    </template>
  </UModal>
</template>
