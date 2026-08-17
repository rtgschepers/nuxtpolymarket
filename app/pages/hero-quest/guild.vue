<script setup lang="ts">
/**
 * The Guild — Champion recruitment, the collection, and the party/formation editor.
 *
 * The page holds no game math. Drop rates, costs, dupe thresholds and slot counts all arrive
 * pre-derived from `state.get.ts`, because the server is the only thing allowed to decide any
 * of them. The one thing computed here is the *pending* party edit, which is local until
 * saved.
 */

const { initialized, guild, pull, craft, buySeals, setLoadout } = useHeroQuest()
const { user } = useAuth()

const goldBalance = computed(() => parseFloat(user.value?.balance ?? '0'))

const busy = ref(false)
const lastPulls = ref<{ name: string; rarity: string; isNew: boolean; star: number; level: number; essence: number }[]>([])

/** Local, unsaved party edit. Null until the player touches something. */
const draftParty = ref<string[] | null>(null)
const draftFormation = ref<Record<string, 'front' | 'back'> | null>(null)

const party = computed(() => draftParty.value ?? guild.value?.partyChampionIds ?? [])
const formation = computed<Record<string, 'front' | 'back'>>(() => {
    if (draftFormation.value) return draftFormation.value
    const saved: Record<string, 'front' | 'back'> = { hero: guild.value?.heroRow ?? 'front' }
    for (const entry of guild.value?.roster ?? []) saved[entry.id] = entry.row
    return saved
})

const dirty = computed(() => draftParty.value !== null || draftFormation.value !== null)
const owned = computed(() => (guild.value?.roster ?? []).filter(entry => entry.owned))

/** Front and back are capacities of 3 each, Hero included — the same rule the server enforces. */
const rowCounts = computed(() => {
    const rows = ['hero', ...party.value].map(id => formation.value[id] ?? 'back')
    return {
        front: rows.filter(row => row === 'front').length,
        back: rows.filter(row => row === 'back').length
    }
})

function toggleField(id: string) {
    const current = [...party.value]
    const index = current.indexOf(id)
    if (index >= 0) current.splice(index, 1)
    else if (current.length < (guild.value?.slots ?? 0)) current.push(id)
    else return
    draftParty.value = current
}

function toggleRow(id: string) {
    draftFormation.value = {
        ...formation.value,
        [id]: formation.value[id] === 'front' ? 'back' : 'front'
    }
}

function resetDraft() {
    draftParty.value = null
    draftFormation.value = null
}

async function withBusy(action: () => Promise<unknown>) {
    busy.value = true
    try {
        await action()
    } finally {
        busy.value = false
    }
}

async function pullChampions(count: 1 | 10) {
    await withBusy(async () => {
        const result = await pull('champion', count)
        lastPulls.value = result?.pulls ?? []
    })
}

async function commitParty() {
    await withBusy(async () => {
        await setLoadout(
            { championIds: party.value, formation: formation.value },
            'Party updated'
        )
        resetDraft()
    })
}

async function craftChampion(championId: string) {
    await withBusy(() => craft('champion', championId))
}

async function buy() {
    await withBusy(() => buySeals('champion', 1))
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
    <div
      v-if="!initialized || !guild"
      class="text-center py-16 text-muted"
    >
      Start a run first.
    </div>

    <template v-else>
      <!-- Recruitment -->
      <div class="rounded-lg border border-default bg-elevated/40 p-4 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex gap-6">
            <div>
              <p class="text-xs text-muted">
                Guild Seals
              </p>
              <p class="text-xl font-semibold text-primary">
                {{ formatNumber(guild.seals, false) }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted">
                Champion Essence
              </p>
              <p class="text-xl font-semibold text-highlighted">
                {{ formatNumber(guild.essence, false) }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted">
                Guild level
              </p>
              <p class="text-xl font-semibold text-highlighted">
                {{ guild.gachaLevel }}
                <span
                  v-if="guild.pullsToNextLevel"
                  class="text-xs text-muted font-normal"
                >
                  · {{ guild.gachaProgress }}/{{ guild.pullsToNextLevel }}
                </span>
              </p>
            </div>
          </div>

          <div class="flex gap-2">
            <UButton
              :disabled="busy || guild.seals < guild.singleCost"
              icon="i-lucide-dices"
              @click="pullChampions(1)"
            >
              Pull · {{ guild.singleCost }}
            </UButton>
            <UButton
              :disabled="busy || guild.seals < guild.tenPullCost"
              color="primary"
              icon="i-lucide-layers"
              @click="pullChampions(10)"
            >
              10-pull · {{ guild.tenPullCost }}
            </UButton>
          </div>
        </div>

        <!--
          The Gold sink. Each Seal bought today costs more than the last, and the counter
          resets daily — Guild Seals have their own counter, independent of the other three.
        -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-default">
          <p class="text-xs text-muted">
            Buy a Seal with Gold — {{ formatNumber(guild.nextSealPrice) }}
            <span
              v-if="guild.sealsBoughtToday > 0"
              class="text-muted"
            >
              · {{ guild.sealsBoughtToday }} bought today, price resets at midnight UTC
            </span>
          </p>
          <UButton
            size="xs"
            variant="soft"
            icon="i-lucide-coins"
            :disabled="busy || goldBalance < guild.nextSealPrice"
            @click="buy"
          >
            Buy 1 Seal
          </UButton>
        </div>

        <!-- A 10-pull costs 9 Seals but still advances the Guild level by 10. -->
        <p class="text-xs text-muted">
          Drop rates at level {{ guild.gachaLevel }}:
          <span
            v-for="(rate, index) in guild.dropRates"
            :key="index"
          >
            <template v-if="rate > 0">
              <span :class="hqRarityClass(HQ_RARITY_ORDER[index] ?? 'common')">
                {{ HQ_RARITY_LABEL[index] }} {{ rate }}%
              </span>
              <span class="text-muted">&nbsp;</span>
            </template>
          </span>
        </p>
      </div>

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

      <!-- Party -->
      <div>
        <div class="flex items-baseline justify-between mb-3 gap-4">
          <h2 class="text-sm font-medium text-highlighted">
            Party — {{ party.length }}/{{ guild.slots }} Champions
          </h2>
          <p class="text-xs text-muted">
            Front {{ rowCounts.front }}/3 · Back {{ rowCounts.back }}/3
          </p>
        </div>

        <div class="rounded-lg border border-default bg-elevated/40 p-4 space-y-3">
          <!--
            The Hero occupies a formation slot like anyone else. Front row takes every
            single-target hit until it is empty or dead, which is what makes a Tank worth
            fielding at all.
          -->
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm text-highlighted">Hero</span>
            <UButton
              size="xs"
              variant="soft"
              :color="formation.hero === 'front' ? 'primary' : 'neutral'"
              @click="toggleRow('hero')"
            >
              {{ formation.hero === 'front' ? 'Front' : 'Back' }}
            </UButton>
          </div>

          <div
            v-for="id in party"
            :key="id"
            class="flex items-center justify-between gap-4"
          >
            <span class="text-sm">
              {{ guild.roster.find(entry => entry.id === id)?.name }}
            </span>
            <div class="flex gap-2">
              <UButton
                size="xs"
                variant="soft"
                :color="formation[id] === 'front' ? 'primary' : 'neutral'"
                @click="toggleRow(id)"
              >
                {{ formation[id] === 'front' ? 'Front' : 'Back' }}
              </UButton>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-x"
                @click="toggleField(id)"
              />
            </div>
          </div>

          <p
            v-if="!party.length"
            class="text-sm text-muted"
          >
            No Champions fielded — the Hero fights alone.
          </p>

          <div
            v-if="dirty"
            class="flex gap-2 pt-2 border-t border-default"
          >
            <UButton
              size="sm"
              color="primary"
              :disabled="busy"
              @click="commitParty"
            >
              Save party
            </UButton>
            <UButton
              size="sm"
              variant="ghost"
              color="neutral"
              :disabled="busy"
              @click="resetDraft"
            >
              Discard
            </UButton>
          </div>
        </div>
      </div>

      <!-- Collection -->
      <div>
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="text-sm font-medium text-highlighted">
            Collection — {{ owned.length }}/{{ guild.roster.length }}
          </h2>
          <p class="text-xs text-muted">
            Every Champion you own buffs the Hero, fielded or not
          </p>
        </div>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="entry in guild.roster"
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
                  {{ entry.archetypeName }} · {{ entry.rarity }}
                </p>
              </div>
              <UButton
                v-if="entry.owned"
                size="xs"
                :variant="entry.fielded || party.includes(entry.id) ? 'solid' : 'soft'"
                :color="party.includes(entry.id) ? 'primary' : 'neutral'"
                :disabled="busy || (!party.includes(entry.id) && party.length >= guild.slots)"
                @click="toggleField(entry.id)"
              >
                {{ party.includes(entry.id) ? 'Fielded' : 'Field' }}
              </UButton>
            </div>

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
            <p
              v-if="entry.owned"
              class="text-xs text-muted truncate"
            >
              {{ entry.abilities.join(' · ') }}
            </p>

            <!--
              Crafting is the RNG bypass: Essence comes only from duplicates of already-maxed
              Champions, so this is the far end of the collection loop, not a parallel one.
            -->
            <UButton
              v-if="!entry.maxed"
              size="xs"
              variant="ghost"
              color="neutral"
              block
              icon="i-lucide-hammer"
              :disabled="busy || guild.essence < entry.craftCost"
              @click="craftChampion(entry.id)"
            >
              Craft · {{ formatNumber(entry.craftCost, false) }} essence
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
