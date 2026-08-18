<script setup lang="ts">
import { ARTIFACT_CATEGORIES, ARTIFACT_CATEGORY_NAME } from '#shared/utils/hero-quest/content/artifacts'

/**
 * The Artifact collection — the equipped set and every Artifact in the roster.
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
 *
 * Pulling moved to `/hero-quest/gacha` (session-1 playtest, finding 4). The category filter this
 * page already had is now one of the three the shared toolbar provides.
 */

const { initialized, digSite, craft, setLoadout } = useHeroQuest()

const busy = ref(false)

const draft = ref<string[] | null>(null)
const equipped = computed(() => draft.value ?? digSite.value?.equippedArtifactIds ?? [])
const dirty = computed(() => draft.value !== null)

const view = useHqCollectionView(
    () => digSite.value?.roster ?? [],
    entry => entry.category,
    ARTIFACT_CATEGORIES
)

const categoryOptions = ARTIFACT_CATEGORIES.map(category => ({
    value: category,
    label: ARTIFACT_CATEGORY_NAME[category]
}))

function artifactById(id: string) {
    return digSite.value?.roster.find(entry => entry.id === id) ?? null
}

function toggle(id: string) {
    const current = [...equipped.value]
    const index = current.indexOf(id)
    if (index >= 0) current.splice(index, 1)
    else if (current.length < (digSite.value?.slotCount ?? 0)) current.push(id)
    else return
    draft.value = current
}

async function withBusy(action: () => Promise<unknown>) {
    busy.value = true
    try {
        await action()
    } finally {
        busy.value = false
    }
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
              :class="hqRarityClass(artifactById(id)?.rarity ?? 'common')"
            >
              {{ artifactById(id)?.name }}
              <span class="text-xs text-muted">· {{ artifactById(id)?.categoryName }}</span>
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
      <div class="space-y-3">
        <HeroQuestCollectionToolbar
          v-model:rarity="view.rarity.value"
          v-model:ownership="view.ownership.value"
          v-model:axis="view.axis.value"
          axis-label="Category"
          :axis-options="categoryOptions"
          :owned="view.ownedCount.value"
          :total="view.total.value"
          :showing="view.visible.value.length"
        />

        <p class="text-xs text-muted">
          Nothing caps how many equipped Artifacts share a category
        </p>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <HeroQuestCollectionCard
            v-for="entry in view.visible.value"
            :key="entry.id"
            :entry="entry"
            :subtitle="entry.categoryName"
            :essence="digSite.essence"
            :busy="busy"
            @craft="craftArtifact(entry.id)"
          >
            <template #action>
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
            </template>

            <template #detail>
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
            </template>
          </HeroQuestCollectionCard>
        </div>
      </div>
    </template>
  </div>
</template>
