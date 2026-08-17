<script setup lang="ts">
/**
 * The Forge — Gear pulls, the six equipment slots, and the collection.
 *
 * Two things here have no equivalent on the other three gacha tabs, and both come from
 * `gear-equipment.md` §3's revision to **manual** equip:
 *
 * 1. **All six slots exist from account start.** No prestige-shop unlock track — the deliberate
 *    exception among the four gachas, because slots map onto Hero stats that exist on day one
 *    rather than a party size that grows.
 * 2. **The upgrade indicator.** When an owned-but-unequipped piece would out-perform what is
 *    worn, the slot shows a badge. It only informs; the swap stays a manual tap. §3 names the
 *    consequence explicitly — a player who ignores it has lower stats than they have already
 *    earned — and the badge exists so that gap is never hidden, only left for them to close.
 */

const { initialized, forge, pull, freePull, craft, buySeals, setLoadout } = useHeroQuest()

const busy = ref(false)
const lastPulls = ref<{ name: string; rarity: string; isNew: boolean; star: number; level: number; essence: number }[]>([])

/** Which slot's piece list is open. Only one at a time — the grid is six rows, not six lists. */
const openSlot = ref<string | null>(null)

const owned = computed(() => (forge.value?.roster ?? []).filter(entry => entry.owned))

function piecesFor(slot: string) {
    return (forge.value?.roster ?? [])
        .filter(entry => entry.slot === slot && entry.owned)
        .sort((a, b) => b.equippedBonus - a.equippedBonus)
}

/** The daily entitlement. Always ten — the server owns the size, not the button. */
async function takeFreePull() {
    await withBusy(async () => {
        const result = await freePull('gear')
        lastPulls.value = result?.pulls ?? []
    })
}

async function withBusy(action: () => Promise<unknown>) {
    busy.value = true
    try {
        await action()
    } finally {
        busy.value = false
    }
}

async function pullGear(count: 1 | 10) {
    await withBusy(async () => {
        const result = await pull('gear', count)
        lastPulls.value = result?.pulls ?? []
    })
}

/**
 * Equip one piece. Sends the **whole** slot map rather than a delta, because that is what the
 * column holds and a partial write would have to be merged somewhere — the server rebuilds the
 * map from known slots anyway, so sending it whole keeps one representation.
 */
async function equip(slot: string, contentId: string) {
    await withBusy(async () => {
        const next = { ...(forge.value?.slots ?? []).reduce<Record<string, string>>((map, entry) => {
            if (entry.equippedId) map[entry.slot] = entry.equippedId
            return map
        }, {}) }
        next[slot] = contentId
        await setLoadout({ gear: next }, 'Gear equipped')
        openSlot.value = null
    })
}

async function craftGear(contentId: string) {
    await withBusy(() => craft('gear', contentId))
}

async function buy() {
    await withBusy(() => buySeals('gear', 1))
}

/** `+150%` reads better than `1.5` for a bonus expressed as a fraction of the stat. */
function asPercent(fraction: number) {
    return `+${(fraction * 100).toFixed(fraction < 0.1 ? 1 : 0)}%`
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
    <div
      v-if="!initialized || !forge"
      class="text-center py-16 text-muted"
    >
      Start a run first.
    </div>

    <template v-else>
      <HeroQuestGachaHeader
        :gacha="forge"
        seal-name="Forge Seals"
        essence-name="Gear Essence"
        :busy="busy"
        @pull="pullGear"
        @free-pull="takeFreePull"
        @buy-seals="buy"
      />

      <!-- Last pull result -->
      <div
        v-if="lastPulls.length"
        class="rounded-lg border border-primary/40 bg-primary/5 p-4"
      >
        <p class="text-xs text-muted mb-2">
          Last pull
        </p>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(record, index) in lastPulls"
            :key="index"
            class="rounded border border-default bg-background px-3 py-2 text-sm"
          >
            <span :class="hqRarityClass(record.rarity)">{{ record.name }}</span>
            <span
              v-if="record.isNew"
              class="ml-2 text-xs text-success"
            >NEW</span>
            <span
              v-else-if="record.essence > 0"
              class="ml-2 text-xs text-muted"
            >+{{ record.essence }} essence</span>
            <span
              v-else
              class="ml-2 text-xs text-muted"
            >{{ record.star }}★ Lv{{ record.level }}</span>
          </div>
        </div>
      </div>

      <!-- Equipment -->
      <div>
        <div class="flex items-baseline justify-between mb-3 gap-4">
          <h2 class="text-sm font-medium text-highlighted">
            Equipment
          </h2>
          <p class="text-xs text-muted">
            All six slots are open from the start — one per stat
          </p>
        </div>

        <div class="rounded-lg border border-default bg-elevated/40 divide-y divide-default">
          <div
            v-for="slot in forge.slots"
            :key="slot.slot"
          >
            <button
              type="button"
              class="w-full flex items-center justify-between gap-4 p-3 text-left hover:bg-elevated/60 transition-colors"
              :disabled="busy"
              @click="openSlot = openSlot === slot.slot ? null : slot.slot"
            >
              <div class="min-w-0">
                <p class="text-sm text-highlighted">
                  {{ slot.name }}
                  <span class="text-xs text-muted uppercase">{{ slot.stat }}</span>
                </p>
                <p
                  class="text-xs truncate"
                  :class="slot.equippedId ? hqRarityClass(forge.roster.find(e => e.id === slot.equippedId)?.rarity ?? 'common') : 'text-muted'"
                >
                  {{ slot.equippedId
                    ? forge.roster.find(e => e.id === slot.equippedId)?.name
                    : 'Nothing equipped' }}
                </p>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <!--
                  The §3 indicator. Informational only — it never swaps anything on the player's
                  behalf, which is the whole point of going manual.
                -->
                <UBadge
                  v-if="slot.upgradeAvailable"
                  color="warning"
                  variant="subtle"
                  size="sm"
                >
                  Upgrade
                </UBadge>
                <UIcon
                  :name="openSlot === slot.slot ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  class="size-4 text-muted"
                />
              </div>
            </button>

            <div
              v-if="openSlot === slot.slot"
              class="px-3 pb-3 space-y-1"
            >
              <p
                v-if="!piecesFor(slot.slot).length"
                class="text-xs text-muted"
              >
                You own nothing for this slot yet.
              </p>
              <button
                v-for="piece in piecesFor(slot.slot)"
                :key="piece.id"
                type="button"
                class="w-full flex items-center justify-between gap-3 rounded border border-default bg-background px-3 py-2 text-left hover:border-primary transition-colors"
                :class="piece.equipped ? 'border-primary' : ''"
                :disabled="busy || piece.equipped"
                @click="equip(slot.slot, piece.id)"
              >
                <span
                  class="text-sm truncate"
                  :class="hqRarityClass(piece.rarity)"
                >{{ piece.name }}</span>
                <span class="text-xs text-muted shrink-0">
                  {{ piece.star }}★ Lv{{ piece.level }} · {{ asPercent(piece.equippedBonus) }}
                  <template v-if="piece.equipped"> · equipped</template>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Collection -->
      <div>
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="text-sm font-medium text-highlighted">
            Collection — {{ owned.length }}/{{ forge.roster.length }}
          </h2>
          <p class="text-xs text-muted">
            Unequipped pieces still grant a smaller passive bonus
          </p>
        </div>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="entry in forge.roster"
            :key="entry.id"
            class="rounded-lg border p-3 space-y-1"
            :class="entry.owned ? 'border-default bg-elevated/40' : 'border-default/50 bg-background opacity-50'"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p
                  class="text-sm font-medium truncate"
                  :class="hqRarityClass(entry.rarity)"
                >
                  {{ entry.owned ? entry.name : '???' }}
                </p>
                <p class="text-xs text-muted uppercase">
                  {{ entry.stat }} · {{ entry.rarity }}
                </p>
              </div>
              <UBadge
                v-if="entry.equipped"
                color="primary"
                variant="subtle"
                size="sm"
              >
                Equipped
              </UBadge>
            </div>

            <p
              v-if="entry.owned"
              class="text-xs text-muted"
            >
              {{ entry.star }}★ Lv{{ entry.level }}
              · {{ asPercent(entry.bonus) }} {{ entry.stat.toUpperCase() }}
              <template v-if="entry.maxed">
                · maxed
              </template>
              <template v-else-if="entry.dupesToLevelUp">
                · {{ entry.dupeProgress }}/{{ entry.dupesToLevelUp }} dupes
              </template>
            </p>

            <UButton
              v-if="!entry.maxed"
              size="xs"
              variant="ghost"
              color="neutral"
              block
              icon="i-lucide-hammer"
              :disabled="busy || forge.essence < entry.craftCost"
              @click="craftGear(entry.id)"
            >
              Craft · {{ formatNumber(entry.craftCost, false) }} essence
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
