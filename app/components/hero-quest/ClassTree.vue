<script setup lang="ts">
/**
 * The 16-node class tree.
 *
 * Picking is free in every sense that matters: the Hero carries its full level across a
 * switch, so the only thing that changes is which stat spread those levels multiply into and
 * which kit comes with it. Every node reached in any past run stays pickable forever.
 */
const props = defineProps<{
    nodes: {
        id: string
        name: string
        parentId: string | null
        tier: string
        skill: { id: string; name: string; cooldownSeconds: number; abilityMultiplier: number }
        seen: boolean
        pickable: boolean
        current: boolean
    }[]
    busy?: boolean
}>()

const emit = defineEmits<{ pick: [classId: string] }>()

const tierOrder = ['beginner', 'base', 'elite', 'master'] as const
const tierLabel: Record<string, string> = {
    beginner: 'Beginner',
    base: 'Base classes',
    elite: 'Elite classes',
    master: 'Master classes'
}

const byTier = computed(() => tierOrder.map(tier => ({
    tier,
    label: tierLabel[tier]!,
    nodes: props.nodes.filter(node => node.tier === tier)
})))

/** The branch a node belongs to, so the three paths read as three paths. */
function rootOf(node: typeof props.nodes[number]): string {
    let current = node
    while (current.parentId && current.parentId !== 'class_beginner') {
        const parent = props.nodes.find(entry => entry.id === current.parentId)
        if (!parent) break
        current = parent
    }
    return current.id
}

const branchColor: Record<string, string> = {
    class_warrior: 'text-error',
    class_mage: 'text-info',
    class_archer: 'text-success',
    class_beginner: 'text-muted'
}
</script>

<template>
  <div class="space-y-5">
    <div
      v-for="group in byTier"
      :key="group.tier"
    >
      <p class="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        {{ group.label }}
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <button
          v-for="node in group.nodes"
          :key="node.id"
          type="button"
          :disabled="!node.pickable || node.current || busy"
          class="text-left rounded-lg border p-3 transition-colors disabled:cursor-not-allowed"
          :class="node.current
            ? 'border-primary bg-primary/10'
            : node.pickable
              ? 'border-default bg-elevated/40 hover:border-primary hover:bg-elevated'
              : 'border-default bg-elevated/20 opacity-50'"
          @click="emit('pick', node.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <span
              class="font-medium"
              :class="node.current ? 'text-primary' : 'text-highlighted'"
            >{{ node.name }}</span>
            <UBadge
              v-if="node.current"
              color="primary"
              variant="subtle"
              size="sm"
            >
              Current
            </UBadge>
            <UIcon
              v-else-if="!node.pickable"
              name="i-lucide-lock"
              class="size-3.5 text-muted"
            />
          </div>
          <p
            class="text-xs mt-1"
            :class="branchColor[rootOf(node)] ?? 'text-muted'"
          >
            {{ node.skill.name }}
          </p>
        </button>
      </div>
    </div>
  </div>
</template>
