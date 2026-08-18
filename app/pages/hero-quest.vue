<script setup lang="ts">
const route = useRoute()

/**
 * Seven tabs, down from nine.
 *
 * The four gacha tabs (Forge / Guild / Training / Dig-site) collapsed into **Gacha** and
 * **Collections** in the session-1 playtest (findings 4 and 5). The split is by action rather
 * than by system: every pull button is on one screen, everything you own is on the other. The
 * four names survive as the cards on one and the submenu on the other — this is a navigation
 * change, not a content one.
 *
 * Wiki is the session-1 playtest's finding 6 — a new player had no way to learn what a stat
 * meant without reading the source. Raid, trait and arena belong to Phase 4.
 */
const tabs = [
  { label: 'Battle', to: '/hero-quest', icon: 'i-lucide-swords' },
  { label: 'Gacha', to: '/hero-quest/gacha', icon: 'i-lucide-dices' },
  { label: 'Collections', to: '/hero-quest/collections', icon: 'i-lucide-library' },
  { label: 'Loadouts', to: '/hero-quest/loadouts', icon: 'i-lucide-layout-grid' },
  { label: 'Prestige', to: '/hero-quest/prestige', icon: 'i-lucide-sparkles' },
  { label: 'Wiki', to: '/hero-quest/wiki', icon: 'i-lucide-book-open' },
  // The playtest harness. Dev builds only — the routes behind it 404 in production regardless,
  // so this is the convenience half of a guard whose real half lives on the server.
  ...(import.meta.dev
    ? [{ label: 'Dev', to: '/hero-quest/dev', icon: 'i-lucide-flask-conical' }]
    : [])
]

/**
 * Prefix match, not equality — Collections has its own submenu underneath, and the parent tab has
 * to stay lit on `/hero-quest/collections/skills`. Battle is the exception: its path is a prefix
 * of every other tab's, so it only ever matches exactly.
 */
function isActive(to: string) {
  return route.path === to || (to !== '/hero-quest' && route.path.startsWith(`${to}/`))
}
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
          :class="isActive(tab.to)
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
