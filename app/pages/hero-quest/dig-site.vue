<script setup lang="ts">
/**
 * The Dig-site — Artifact pulls, the equipped slots, and the collection.
 *
 * Artifacts are **party-wide and passive-only** (`artifacts-dig-site-gacha.md` §1): every
 * equipped Artifact's effect applies to the Hero and every fielded Champion, and none of them has
 * an active, a cooldown or a button. That is the one thing separating them from the other three
 * systems — Champions *are* the party, Skills are the Hero's own loadout, Gear is Hero-only
 * equipment, and Artifacts are the only thing that buffs everyone at once.
 *
 * §4's stacking rules are visible here as an *absence*: nothing caps how many equipped Artifacts
 * share a category, so five Offense Artifacts at once is a legitimate build, and there are no set
 * bonuses to hunt for.
 */

const { initialized, digSite, pull, freePull, craft, buySeals, setLoadout } = useHeroQuest()

const busy = ref(false)
const lastPulls = ref<{ name: string; rarity: string; isNew: boolean; star: number; level: number; essence: number }[]>([])

const draft = ref<string[] | null>(null)
const equipped = computed(() => draft.value ?? digSite.value?.equippedArtifactIds ?? [])
const dirty = computed(() => draft.value !== null)

const owned = computed(() => (digSite.value?.roster ?? []).filter(entry => entry.owned))

/** Filter by category, since a 48-entry grid over four domains is hard to read whole. */
const category = ref<string>('all')
const CATEGORIES = [
    { value: 'all', label: 'All' },
    { value: 'offense', label: 'Offense' },
    { value: 'defense', label: 'Defense' },
    { value: 'tempo', label: 'Tempo' },
    { value: 'fortune', label: 'Fortune' }
]

const visible = computed(() => (digSite.value?.roster ?? [])
    .filter(entry => category.value === 'all' || entry.category === category.value))

function toggle(id: string) {
    const current = [...equipped.value]
    const index = current.indexOf(id)
    if (index >= 0) current.splice(index, 1)
    else if (current.length < (digSite.value?.slotCount ?? 0)) current.push(id)
    else return
    draft.value = current
}

/** The daily entitlement. Always ten — the server owns the size, not the button. */
async function takeFreePull() {
    await withBusy(async () => {
        const result = await freePull('artifact')
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

async function pullArtifacts(count: 1 | 10) {
    await withBusy(async () => {
        const result = await pull('artifact', count)
        lastPulls.value = result?.pulls ?? []
    })
}

async function commit() {
    await withBusy(async () => {
        await setLoadout({ artifactIds: equipped.value }, 'Artifacts equipped')
        draft.value = null
    })
}

async function craftArtifact(contentId: string) {
    await withBusy(() => craft('artifact', contentId))
}

async function buy() {
    await withBusy(() => buySeals('artifact', 1))
}

function asPercent(fraction: number) {
    return `+${(fraction * 100).toFixed(fraction < 0.1 ? 1 : 0)}%`
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
    <div
      v-if="!initialized || !digSite"
      class="text-center py-16 text-muted"
    >
      Start a run first.
    </div>

    <template v-else>
      <HeroQuestGachaHeader
        :gacha="digSite"
        seal-name="Excavation Seals"
        essence-name="Artifact Essence"
        :busy="busy"
        @pull="pullArtifacts"
        @free-pull="takeFreePull"
        @buy-seals="buy"
      />

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

      <!-- Equipped -->
      <div>
        <div class="flex items-baseline justify-between mb-3 gap-4">
          <h2 class="text-sm font-medium text-highlighted">
            Equipped — {{ equipped.length }}/{{ digSite.slotCount }}
          </h2>
          <p class="text-xs text-muted">
            Every effect applies to the whole party
          </p>
        </div>

        <div class="rounded-lg border border-default bg-elevated/40 p-4 space-y-3">
          <div
            v-for="id in equipped"
            :key="id"
            class="flex items-center justify-between gap-4"
          >
            <span
              class="text-sm truncate"
              :class="hqRarityClass(digSite.roster.find(e => e.id === id)?.rarity ?? 'common')"
            >
              {{ digSite.roster.find(e => e.id === id)?.name }}
              <span class="text-xs text-muted">
                · {{ digSite.roster.find(e => e.id === id)?.categoryName }}
              </span>
            </span>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              :disabled="busy"
              @click="toggle(id)"
            />
          </div>

          <p
            v-if="!equipped.length"
            class="text-sm text-muted"
          >
            Nothing equipped — the party fights unaided.
          </p>

          <div
            v-if="dirty"
            class="flex gap-2 pt-2 border-t border-default"
          >
            <UButton
              size="sm"
              color="primary"
              :disabled="busy"
              @click="commit"
            >
              Save
            </UButton>
            <UButton
              size="sm"
              variant="ghost"
              color="neutral"
              :disabled="busy"
              @click="draft = null"
            >
              Discard
            </UButton>
          </div>
        </div>
      </div>

      <!-- Collection -->
      <div>
        <div class="flex flex-wrap items-baseline justify-between gap-3 mb-3">
          <h2 class="text-sm font-medium text-highlighted">
            Collection — {{ owned.length }}/{{ digSite.roster.length }}
          </h2>
          <div class="flex gap-1">
            <UButton
              v-for="option in CATEGORIES"
              :key="option.value"
              size="xs"
              :variant="category === option.value ? 'solid' : 'ghost'"
              :color="category === option.value ? 'primary' : 'neutral'"
              @click="category = option.value"
            >
              {{ option.label }}
            </UButton>
          </div>
        </div>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="entry in visible"
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
                <p class="text-xs text-muted">
                  {{ entry.categoryName }} · {{ entry.rarity }}
                </p>
              </div>
              <UButton
                v-if="entry.owned"
                size="xs"
                :variant="equipped.includes(entry.id) ? 'solid' : 'soft'"
                :color="equipped.includes(entry.id) ? 'primary' : 'neutral'"
                :disabled="busy || (!equipped.includes(entry.id) && equipped.length >= digSite.slotCount)"
                @click="toggle(entry.id)"
              >
                {{ equipped.includes(entry.id) ? 'Equipped' : 'Equip' }}
              </UButton>
            </div>

            <ul
              v-if="entry.owned"
              class="text-xs text-muted space-y-0.5"
            >
              <li
                v-for="effect in entry.effects"
                :key="effect.name"
              >
                <span class="text-default">{{ effect.name }}</span>
                — {{ asPercent(effect.magnitude) }}
              </li>
            </ul>

            <p
              v-if="entry.owned"
              class="text-xs text-muted"
            >
              {{ entry.star }}★ Lv{{ entry.level }}
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
              :disabled="busy || digSite.essence < entry.craftCost"
              @click="craftArtifact(entry.id)"
            >
              Craft · {{ formatNumber(entry.craftCost, false) }} essence
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
