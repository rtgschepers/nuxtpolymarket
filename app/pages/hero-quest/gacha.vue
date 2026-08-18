<script setup lang="ts">
/**
 * The gacha hub — all four systems on one screen, in a 2×2 grid.
 *
 * Session-1 playtest, finding 4: the four gachas each owned a full tab, and each tab stacked a
 * recruitment block, a pull reel, an equip editor and a 36-to-48-entry collection grid. Four
 * pages that were 90% the same thing, and none of them fit on a screen.
 *
 * The split is by *action*, not by system: pulling lives here, owning lives at
 * `/hero-quest/collections`. That is what makes the 2×2 possible — with the grids gone, a gacha
 * is a small card, and four cards fit where one page used to.
 *
 * **This departs from the docs' four-tab layout** (`gear-equipment.md` §6 and friends name the
 * Forge / Guild / Training Grounds / Dig-site as places). The names survive as the card and
 * collection headings; only the navigation collapsed. Recorded in `playtest-notes.md`.
 */

const { initialized, guild, forge, training, digSite, pull, freePull, buySeals } = useHeroQuest()

const busy = ref(false)

interface PullRecord {
    name: string
    rarity: string
    isNew: boolean
    star: number
    level: number
    essence: number
}

/**
 * The reel is shared by all four cards and remembers which one filled it.
 *
 * Four separate reels would push the grid down by a row that is empty three quarters of the
 * time; one reel under the grid stays in the same place whichever card was tapped.
 */
const lastPulls = ref<PullRecord[]>([])
const lastPullLabel = ref('')

/**
 * The four cards, as data. Everything except the icon and the two currency names is served
 * pre-derived, so this table is presentation only — the same shape `content/registry.ts` holds
 * on the server side of the same four systems.
 */
const cards = computed(() => [
    {
        system: 'gear' as const,
        payload: forge.value,
        icon: 'i-lucide-hammer',
        sealName: 'Forge Seals',
        essenceName: 'Gear Essence',
        to: '/hero-quest/collections/gear',
        roster: forge.value?.roster ?? []
    },
    {
        system: 'champion' as const,
        payload: guild.value,
        icon: 'i-lucide-users',
        sealName: 'Guild Seals',
        essenceName: 'Champion Essence',
        to: '/hero-quest/collections/champions',
        roster: guild.value?.roster ?? []
    },
    {
        system: 'skill' as const,
        payload: training.value,
        icon: 'i-lucide-dumbbell',
        sealName: 'Skill Seals',
        essenceName: 'Skill Essence',
        to: '/hero-quest/collections/skills',
        roster: training.value?.roster ?? []
    },
    {
        system: 'artifact' as const,
        payload: digSite.value,
        icon: 'i-lucide-pickaxe',
        sealName: 'Excavation Seals',
        essenceName: 'Artifact Essence',
        to: '/hero-quest/collections/artifacts',
        roster: digSite.value?.roster ?? []
    }
])

async function withBusy(action: () => Promise<unknown>) {
    busy.value = true
    try {
        await action()
    } finally {
        busy.value = false
    }
}

type GachaSystem = 'gear' | 'champion' | 'skill' | 'artifact'

async function doPull(system: GachaSystem, label: string, count: 1 | 10) {
    await withBusy(async () => {
        const result = await pull(system, count)
        lastPulls.value = result?.pulls ?? []
        lastPullLabel.value = label
    })
}

/** The daily entitlement. Always ten — the server owns the size, not the button. */
async function doFreePull(system: GachaSystem, label: string) {
    await withBusy(async () => {
        const result = await freePull(system)
        lastPulls.value = result?.pulls ?? []
        lastPullLabel.value = label
    })
}

async function doBuySeals(system: GachaSystem) {
    await withBusy(() => buySeals(system, 1))
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
    <div
      v-if="!initialized"
      class="text-center py-16 text-muted"
    >
      Start a run first.
    </div>

    <template v-else>
      <div class="grid gap-4 md:grid-cols-2">
        <template
          v-for="card in cards"
          :key="card.system"
        >
          <HeroQuestGachaCard
            v-if="card.payload"
            :gacha="card.payload"
            :icon="card.icon"
            :seal-name="card.sealName"
            :essence-name="card.essenceName"
            :collection-to="card.to"
            :owned="card.roster.filter(entry => entry.owned).length"
            :total="card.roster.length"
            :busy="busy"
            @pull="count => doPull(card.system, card.payload!.label, count)"
            @free-pull="doFreePull(card.system, card.payload!.label)"
            @buy-seals="doBuySeals(card.system)"
          />
        </template>
      </div>

      <!-- Last pull result -->
      <div
        v-if="lastPulls.length"
        class="rounded-lg border border-primary/40 bg-primary/5 p-4"
      >
        <p class="text-xs text-muted mb-2">
          {{ lastPullLabel }} — last pull
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
    </template>
  </div>
</template>
