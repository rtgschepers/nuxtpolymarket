<script setup lang="ts">
/**
 * The Training Grounds — Skill pulls, the equipped slots, and the collection.
 *
 * Hero-only (`skills-gacha.md` §1): Champions carry their own kits, fixed at recruitment, and
 * this system never touches them. Slots start at 2 and reach 5 through the prestige shop (§6).
 *
 * Two presentation rules from the doc:
 *
 * - **Actives and Passives are visually distinct** but freely mixable — either slot can hold
 *   either type, in any combination (§5). An equipped Active adds no button to the screen: every
 *   skill auto-fires the moment its cooldown ends, so equipping one is a build choice, not an
 *   input burden (§3).
 * - **Training Grounds skills read as a separate system** from the Hero's innate class-tree
 *   skills (§7). The class tree uses square icon slots; these use round ones.
 */

const { initialized, training, pull, craft, buySeals, setLoadout } = useHeroQuest()

const busy = ref(false)
const lastPulls = ref<{ name: string; rarity: string; isNew: boolean; star: number; level: number; essence: number }[]>([])

/** Local, unsaved slot edit. Null until the player touches something. */
const draft = ref<string[] | null>(null)
const equipped = computed(() => draft.value ?? training.value?.equippedSkillIds ?? [])
const dirty = computed(() => draft.value !== null)

const owned = computed(() => (training.value?.roster ?? []).filter(entry => entry.owned))

const ART_LABEL: Record<string, string> = {
    barracks: 'Barracks',
    archery_range: 'Archery Range',
    wizard_tower: 'Wizard Tower'
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

async function pullSkills(count: 1 | 10) {
    await withBusy(async () => {
        const result = await pull('skill', count)
        lastPulls.value = result?.pulls ?? []
    })
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

async function buy() {
    await withBusy(() => buySeals('skill', 1))
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
      <HeroQuestGachaHeader
        :gacha="training"
        seal-name="Skill Seals"
        essence-name="Skill Essence"
        :busy="busy"
        @pull="pullSkills"
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
            Equipped — {{ equipped.length }}/{{ training.slotCount }}
          </h2>
          <p class="text-xs text-muted">
            {{ ART_LABEL[training.art] }} · every Active fires on its own
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
                :class="training.roster.find(e => e.id === id)?.type === 'active'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-elevated text-muted'"
              >
                <UIcon
                  :name="training.roster.find(e => e.id === id)?.type === 'active'
                    ? 'i-lucide-zap' : 'i-lucide-shield'"
                  class="size-3"
                />
              </span>
              <span
                class="text-sm truncate"
                :class="hqRarityClass(training.roster.find(e => e.id === id)?.rarity ?? 'common')"
              >
                {{ training.roster.find(e => e.id === id)?.name }}
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
      <div>
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="text-sm font-medium text-highlighted">
            Collection — {{ owned.length }}/{{ training.roster.length }}
          </h2>
          <p class="text-xs text-muted">
            18 Actives, 18 Passives — a slot takes either
          </p>
        </div>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="entry in training.roster"
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
                <p class="text-xs text-muted capitalize">
                  {{ entry.type }} · {{ entry.rarity }}
                </p>
              </div>
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
            </div>

            <!--
              Passive lines carry their resolved magnitude, so levelling is visible as a number
              rather than only as a star count. An Active's payload is a whole effect, so it shows
              the prose and leans on the potency badge below instead.
            -->
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

            <p
              v-if="entry.owned"
              class="text-xs text-muted"
            >
              {{ entry.star }}★ Lv{{ entry.level }}
              <!-- What levelling this copy has actually bought. 1.0 at 0★/Lv1, so it is hidden. -->
              <span
                v-if="entry.potency > 1"
                class="text-primary"
              >· ×{{ entry.potency.toFixed(2) }} potency</span>
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
              :disabled="busy || training.essence < entry.craftCost"
              @click="craftSkill(entry.id)"
            >
              Craft · {{ formatNumber(entry.craftCost, false) }} essence
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
