<script setup lang="ts">
import { ARCHETYPES, ARCHETYPE_BY_ID } from '#shared/utils/hero-quest/content/champions'

/**
 * The Champion collection — the party, the formation, and every Champion in the roster.
 *
 * The page holds no game math. Dupe thresholds, slot counts and craft prices all arrive
 * pre-derived from `state.get.ts`, because the server is the only thing allowed to decide any of
 * them. The one thing computed here is the *pending* party edit, which is local until saved.
 *
 * Recruitment moved to `/hero-quest/gacha` (session-1 playtest, finding 4).
 */

const { initialized, guild, craft, setLoadout } = useHeroQuest()

const busy = ref(false)

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

const view = useHqCollectionView(
    () => guild.value?.roster ?? [],
    entry => entry.archetype,
    ARCHETYPES
)

const archetypeOptions = ARCHETYPES.map(id => ({ value: id, label: ARCHETYPE_BY_ID[id].name }))

/** Front and back are capacities of 3 each, Hero included — the same rule the server enforces. */
const rowCounts = computed(() => {
    const rows = ['hero', ...party.value].map(id => formation.value[id] ?? 'back')
    return {
        front: rows.filter(row => row === 'front').length,
        back: rows.filter(row => row === 'back').length
    }
})

function championById(id: string) {
    return guild.value?.roster.find(entry => entry.id === id) ?? null
}

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
            <span
              class="text-sm truncate"
              :class="hqRarityClass(championById(id)?.rarity ?? 'common')"
            >
              {{ championById(id)?.name }}
              <span class="text-xs text-muted">· {{ championById(id)?.archetypeName }}</span>
            </span>
            <div class="flex gap-2 shrink-0">
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
      <div class="space-y-3">
        <HeroQuestCollectionToolbar
          v-model:rarity="view.rarity.value"
          v-model:ownership="view.ownership.value"
          v-model:axis="view.axis.value"
          axis-label="Archetype"
          :axis-options="archetypeOptions"
          :owned="view.ownedCount.value"
          :total="view.total.value"
          :showing="view.visible.value.length"
        />

        <p class="text-xs text-muted">
          Every Champion you own buffs the Hero, fielded or not
        </p>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <HeroQuestCollectionCard
            v-for="entry in view.visible.value"
            :key="entry.id"
            :entry="entry"
            :subtitle="entry.archetypeName"
            :essence="guild.essence"
            :busy="busy"
            @craft="craftChampion(entry.id)"
          >
            <template #action>
              <UButton
                v-if="entry.owned"
                size="xs"
                :variant="party.includes(entry.id) ? 'solid' : 'soft'"
                :color="party.includes(entry.id) ? 'primary' : 'neutral'"
                :disabled="busy || (!party.includes(entry.id) && party.length >= guild.slots)"
                @click="toggleField(entry.id)"
              >
                {{ party.includes(entry.id) ? 'Fielded' : 'Field' }}
              </UButton>
            </template>

            <template #detail>
              <p
                v-if="entry.owned"
                class="text-xs text-muted truncate"
              >
                {{ entry.abilities.join(' · ') }}
              </p>
            </template>
          </HeroQuestCollectionCard>
        </div>
      </div>
    </template>
  </div>
</template>
