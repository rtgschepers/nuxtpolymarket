<script setup lang="ts">
/**
 * Collections — one place for everything you own, with a submenu per system.
 *
 * Session-1 playtest, finding 5. Owning used to live on the same page as pulling, four times
 * over, which made every gacha tab a long scroll of two unrelated jobs. The split is by action:
 * `/hero-quest/gacha` is where you pull, this is where you look at and use what you pulled.
 *
 * **Equipping moved here with the grids**, which is the part that makes the split hold up — a
 * party, a gear slot, a skill loadout and an artifact set are all decisions about things you
 * own, so they belong next to the collection rather than under a pull button.
 */
const route = useRoute()

const tabs = [
    { label: 'Gear', to: '/hero-quest/collections/gear', icon: 'i-lucide-hammer' },
    { label: 'Champions', to: '/hero-quest/collections/champions', icon: 'i-lucide-users' },
    { label: 'Skills', to: '/hero-quest/collections/skills', icon: 'i-lucide-dumbbell' },
    { label: 'Artifacts', to: '/hero-quest/collections/artifacts', icon: 'i-lucide-pickaxe' }
]
</script>

<template>
  <div>
    <div class="px-4 sm:px-6 pt-4">
      <div class="max-w-5xl mx-auto flex flex-wrap gap-1">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors"
          :class="route.path === tab.to
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-default text-muted hover:text-default'"
        >
          <UIcon
            :name="tab.icon"
            class="size-3.5"
          />
          {{ tab.label }}
        </NuxtLink>
      </div>
    </div>

    <NuxtPage />
  </div>
</template>
