<script setup lang="ts">
/**
 * A small `ⓘ` that explains the thing next to it, and points at the wiki for the rest.
 *
 * Session-1 playtest, finding 6. The complaint was that nothing on screen says what a stat *is*,
 * and the fix is two-sided: a wiki for the player who wants to read, and these for the player
 * who just wants to know what "Impact" means without leaving the battle screen.
 *
 * **Tap to open, not hover.** Two reasons, and the second is the one that matters: a `title`
 * attribute never appears on touch at all, and `UPopover`'s `mode="hover"` is a Radix HoverCard,
 * which is deliberately desktop-only and also does nothing on a tap. This game is played on a
 * phone as much as anywhere, so the only mode that works everywhere is the default click.
 */
defineProps<{
    /** Heading inside the popover. Usually the label the icon sits beside. */
    title: string
    /** One or two sentences. Any longer belongs in the wiki. */
    body: string
    /** The rule with its live numbers, when there is one worth showing. */
    formula?: string
    /** Wiki route this concept is explained on, for the "read more" link. */
    to?: string
}>()
</script>

<template>
  <UPopover>
    <UButton
      size="xs"
      variant="ghost"
      color="neutral"
      icon="i-lucide-info"
      :aria-label="`What is ${title}?`"
      class="p-0.5 -my-0.5 align-middle"
    />

    <template #content>
      <div class="p-3 max-w-xs space-y-2">
        <p class="text-sm font-medium text-highlighted">
          {{ title }}
        </p>
        <p class="text-xs text-muted">
          {{ body }}
        </p>
        <p
          v-if="formula"
          class="text-[0.6875rem] font-mono text-default bg-elevated rounded px-2 py-1.5 leading-relaxed"
        >
          {{ formula }}
        </p>
        <NuxtLink
          v-if="to"
          :to="to"
          class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Read more
          <UIcon
            name="i-lucide-arrow-right"
            class="size-3"
          />
        </NuxtLink>
      </div>
    </template>
  </UPopover>
</template>
