<script setup lang="ts">
import { allArt, ART_GROUPS, type ArtGroup } from '~/utils/hero-quest-art/catalog'

/**
 * The art gallery. **Development only**, like the Dev tab.
 *
 * Every asset in `asset-list.md`, rendered live from the procedural source in
 * `app/utils/hero-quest-art/` — the same code the exporter (`bun run art:hero-quest`) turns
 * into PNG strips. Nothing here is an image file.
 */
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })

const assets = allArt()
const group = ref<ArtGroup>('heroes')
const query = ref('')

const counts = computed(() => Object.fromEntries(ART_GROUPS.map(g => [g.id, assets.filter(a => a.group === g.id).length])))

const sections = computed(() => {
  const q = query.value.trim().toLowerCase()
  const out = new Map<string, typeof assets[number][]>()
  for (const a of assets) {
    if (a.group !== group.value) continue
    if (q && !a.label.toLowerCase().includes(q) && !a.id.includes(q) && !a.section.toLowerCase().includes(q)) continue
    const list = out.get(a.section) ?? []
    list.push(a)
    out.set(a.section, list)
  }
  return [...out.entries()]
})
</script>

<template>
  <div class="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
    <UAlert
      icon="i-lucide-palette"
      color="neutral"
      variant="soft"
      title="Art gallery — dev builds only"
      :description="`${assets.length} assets, all procedural pixel art on one palette. Export PNG strips with bun run art:hero-quest.`"
    />

    <ClientOnly>
      <HeroQuestArtStage />
    </ClientOnly>

    <div class="flex flex-wrap items-center gap-1">
      <UButton
        v-for="g in ART_GROUPS"
        :key="g.id"
        size="xs"
        :variant="group === g.id ? 'solid' : 'soft'"
        :color="group === g.id ? 'primary' : 'neutral'"
        @click="group = g.id"
      >
        {{ g.label }}
        <span class="text-[10px] opacity-70 tabular-nums">{{ counts[g.id] }}</span>
      </UButton>
      <UInput
        v-model="query"
        size="xs"
        icon="i-lucide-search"
        placeholder="Filter"
        class="ml-auto w-48"
      />
    </div>

    <ClientOnly>
      <section
        v-for="[name, list] in sections"
        :key="`${group}:${name}`"
        class="space-y-2"
      >
        <h2 class="text-sm font-medium text-highlighted">
          {{ name }}
          <span class="text-muted font-normal">· {{ list.length }}</span>
        </h2>
        <div class="grid gap-2 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
          <HeroQuestArtCard
            v-for="a in list"
            :key="a.id"
            :asset="a"
            :class="a.w >= 150 && a.w >= a.h * 1.5 ? 'sm:col-span-2' : ''"
          />
        </div>
      </section>
    </ClientOnly>
  </div>
</template>
