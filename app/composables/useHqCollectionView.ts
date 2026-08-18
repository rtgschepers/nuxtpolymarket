import type { HqOwnership, HqSortableEntry } from '~/utils/hero-quest-collection'

/**
 * The filter/sort state every collection grid shares (session-1 playtest, finding 5).
 *
 * Three independent filters — rarity, ownership, and the system's own axis — over one sorted
 * list. Written once because all four grids want exactly the same three; what differs is only
 * which axis the third one is, which is why the axis arrives as a getter plus an order.
 *
 * Pure presentation. Nothing here decides anything the server cares about; it is a view over a
 * roster the server already resolved.
 */
export function useHqCollectionView<T extends HqSortableEntry>(
    source: () => readonly T[],
    axisOf: (entry: T) => string,
    axisOrder: readonly string[]
) {
    const rarity = ref<string>('all')
    const ownership = ref<HqOwnership>('all')
    const axis = ref<string>('all')

    const sorted = computed(() => hqSortCollection(source(), axisOf, axisOrder))

    const visible = computed(() => sorted.value.filter((entry) => {
        if (rarity.value !== 'all' && entry.rarity !== rarity.value) return false
        if (ownership.value === 'owned' && !entry.owned) return false
        if (ownership.value === 'missing' && entry.owned) return false
        if (axis.value !== 'all' && axisOf(entry) !== axis.value) return false
        return true
    }))

    const total = computed(() => sorted.value.length)
    const ownedCount = computed(() => sorted.value.filter(entry => entry.owned).length)
    /** True when a filter is hiding something, so the UI can offer a way back. */
    const filtered = computed(() => visible.value.length !== total.value)

    function clearFilters() {
        rarity.value = 'all'
        ownership.value = 'all'
        axis.value = 'all'
    }

    return { rarity, ownership, axis, visible, total, ownedCount, filtered, clearFilters }
}
