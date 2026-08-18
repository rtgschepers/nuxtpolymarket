<script setup lang="ts">
/**
 * The Skill collection — the equipped slots and every skill in the roster.
 *
 * Hero-only (`skills-gacha.md` §1): Champions carry their own kits, fixed at recruitment, and
 * this system never touches them. Slots start at 2 and reach 5 through the prestige shop (§6).
 *
 * Two presentation rules from the doc survive the move off the Training Grounds tab:
 *
 * - **Actives and Passives are visually distinct** but freely mixable — either slot can hold
 *   either type, in any combination (§5). An equipped Active adds no button to the screen: every
 *   skill auto-fires the moment its cooldown ends, so equipping one is a build choice, not an
 *   input burden (§3).
 * - **Training Grounds skills read as a separate system** from the Hero's innate class-tree
 *   skills (§7). The class tree uses square icon slots; these use round ones.
 *
 * Pulling moved to `/hero-quest/gacha` (session-1 playtest, finding 4). The Barracks / Archery
 * Range / Wizard Tower art (§1) went with it — it dressed the recruitment block, not the roster.
 */

const { initialized, training, craft, setLoadout } = useHeroQuest()

const busy = ref(false)

/** Local, unsaved slot edit. Null until the player touches something. */
const draft = ref<string[] | null>(null)
const equipped = computed(() => draft.value ?? training.value?.equippedSkillIds ?? [])
const dirty = computed(() => draft.value !== null)

/** Actives first: they are the half a player builds around, and the half §5 wants legible. */
const view = useHqCollectionView(
    () => training.value?.roster ?? [],
    entry => entry.type,
    ['active', 'passive']
)

const typeOptions = [
    { value: 'active', label: 'Active' },
    { value: 'passive', label: 'Passive' }
]

function skillById(id: string) {
    return training.value?.roster.find(entry => entry.id === id) ?? null
}

function toggle(id: string) {
    const current = [...equipped.value]
    const index = current.indexOf(id)
    // No duplicate slotting (§5) — levelling the one copy you own is how a skill gets stronger.
    if (index >= 0) current.splice(index, 1)
    else if (current.length < (training.value?.slotCount ?? 0)) current.push(id)
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
        await setLoadout({ skillIds: equipped.value }, 'Skills equipped')
        draft.value = null
    })
}

async function craftSkill(contentId: string) {
    await withBusy(() => craft('skill', contentId))
}

/** `+7%` reads better than `0.071` for a magnitude expressed as a fraction. */
function asPercent(fraction: number) {
    return `+${(fraction * 100).toFixed(fraction < 0.1 ? 1 : 0)}%`
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
    <div
      v-if="!initialized || !training"
      class="text-center py-16 text-muted"
    >
      Start a run first.
    </div>

    <template v-else>
      <!-- Equipped -->
      <div>
        <div class="flex items-baseline justify-between mb-3 gap-4">
          <h2 class="text-sm font-medium text-highlighted">
            Equipped — {{ equipped.length }}/{{ training.slotCount }}
          </h2>
          <p class="text-xs text-muted">
            Every Active fires on its own
          </p>
        </div>

        <div class="rounded-lg border border-default bg-elevated/40 p-4 space-y-3">
          <div
            v-for="id in equipped"
            :key="id"
            class="flex items-center justify-between gap-4"
          >
            <div class="flex items-center gap-2 min-w-0">
              <!-- Round, so these never read as class-tree skills (§7's square-vs-circle rule). -->
              <span
                class="size-6 rounded-full grid place-items-center shrink-0"
                :class="skillById(id)?.type === 'active'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-elevated text-muted'"
              >
                <UIcon
                  :name="skillById(id)?.type === 'active' ? 'i-lucide-zap' : 'i-lucide-shield'"
                  class="size-3"
                />
              </span>
              <span
                class="text-sm truncate"
                :class="hqRarityClass(skillById(id)?.rarity ?? 'common')"
              >
                {{ skillById(id)?.name }}
              </span>
            </div>
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
            No skills equipped — the Hero fights with its class kit alone.
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
          axis-label="Type"
          :axis-options="typeOptions"
          :owned="view.ownedCount.value"
          :total="view.total.value"
          :showing="view.visible.value.length"
        />

        <p class="text-xs text-muted">
          18 Actives, 18 Passives — a slot takes either
        </p>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <HeroQuestCollectionCard
            v-for="entry in view.visible.value"
            :key="entry.id"
            :entry="entry"
            :subtitle="entry.type"
            :essence="training.essence"
            :busy="busy"
            @craft="craftSkill(entry.id)"
          >
            <template #action>
              <UButton
                v-if="entry.owned"
                size="xs"
                :variant="equipped.includes(entry.id) ? 'solid' : 'soft'"
                :color="equipped.includes(entry.id) ? 'primary' : 'neutral'"
                :disabled="busy || (!equipped.includes(entry.id) && equipped.length >= training.slotCount)"
                @click="toggle(entry.id)"
              >
                {{ equipped.includes(entry.id) ? 'Equipped' : 'Equip' }}
              </UButton>
            </template>

            <!--
              Passive lines carry their resolved magnitude, so levelling is visible as a number
              rather than only as a star count. An Active's payload is a whole effect, so it shows
              the prose and leans on the potency badge below instead.
            -->
            <template #detail>
              <ul
                v-if="entry.owned"
                class="text-xs text-muted space-y-0.5"
              >
                <li
                  v-for="(line, index) in entry.lines"
                  :key="index"
                >
                  {{ line }}
                  <span
                    v-if="entry.lineMagnitudes[index] !== null"
                    class="text-default"
                  >{{ asPercent(entry.lineMagnitudes[index]!) }}</span>
                </li>
              </ul>
            </template>

            <template #meta>
              <!-- What levelling this copy has bought. 1.0 at 0★/Lv1, so it is hidden there. -->
              <span
                v-if="entry.potency > 1"
                class="text-primary"
              >· ×{{ entry.potency.toFixed(2) }} potency</span>
            </template>
          </HeroQuestCollectionCard>
        </div>
      </div>
    </template>
  </div>
</template>
