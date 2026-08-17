<script setup lang="ts">
const route = useRoute()

// All four gacha tabs, in `gear-equipment.md` §6's order — the Forge sits first overall, ahead of
// the Guild, revised from an earlier second-place placement. Raid, trait, arena and encyclopedia
// belong to Phase 4.
const tabs = [
  { label: 'Battle', to: '/hero-quest', icon: 'i-lucide-swords' },
  { label: 'Forge', to: '/hero-quest/forge', icon: 'i-lucide-hammer' },
  { label: 'Guild', to: '/hero-quest/guild', icon: 'i-lucide-users' },
  { label: 'Training', to: '/hero-quest/training', icon: 'i-lucide-dumbbell' },
  { label: 'Dig-site', to: '/hero-quest/dig-site', icon: 'i-lucide-pickaxe' },
  { label: 'Loadouts', to: '/hero-quest/loadouts', icon: 'i-lucide-layout-grid' },
  { label: 'Prestige', to: '/hero-quest/prestige', icon: 'i-lucide-sparkles' },
  // The playtest harness. Dev builds only — the routes behind it 404 in production regardless,
  // so this is the convenience half of a guard whose real half lives on the server.
  ...(import.meta.dev
    ? [{ label: 'Dev', to: '/hero-quest/dev', icon: 'i-lucide-flask-conical' }]
    : [])
]

const activeTab = computed(() => route.path)
</script>

<template>
  <div class="flex flex-col min-h-full">
    <div class="border-b border-default px-3 pt-1.75 pb-2 shrink-0">
      <div class="flex items-center gap-0.5">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-t-lg transition-colors"
          :class="activeTab === tab.to
            ? 'text-highlighted -mb-px'
            : 'text-muted hover:text-default'"
        >
          <UIcon
            :name="tab.icon"
            class="size-4"
          />
          <span class="hidden sm:inline">{{ tab.label }}</span>
        </NuxtLink>
      </div>
    </div>

    <div class="pb-12">
      <NuxtPage />
    </div>
  </div>
</template>
