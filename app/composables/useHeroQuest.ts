import type { FightEvent, FightOutcome } from '#shared/utils/hero-quest/fight'

/**
 * The single source of Hero Quest state on the client. Pages contain no fetch logic.
 *
 * The polling interval here is not cosmetic — it is what the server's presence detection
 * reads. A gap at or under `ONLINE_THRESHOLD_MS` counts as the player being present and
 * accrues at full rate; a longer one is treated as offline and pays the cap and efficiency
 * tax. Stop refreshing and you are, correctly, offline.
 */
export const useHeroQuest = () => {
    const toast = useToast()
    const { fetchSession } = useAuth()

    const { data: state, refresh, pending } = useFetch('/api/hero-quest/state', {
        key: 'hero-quest-state',
        default: () => null
    })

    const initialized = computed(() => state.value?.initialized ?? false)
    const run = computed(() => state.value?.run ?? null)
    const hero = computed(() => state.value?.hero ?? null)
    const shop = computed(() => state.value?.shop ?? [])
    const classTree = computed(() => state.value?.classTree ?? [])
    const voidShards = computed(() => state.value?.voidShards ?? '0')
    const nextPrestigeReward = computed(() => state.value?.nextPrestigeReward ?? '0')
    const settled = computed(() => state.value?.settled ?? null)
    const serverNow = computed(() => state.value?.serverNow ?? Date.now())
    const refreshIntervalMs = computed(() => state.value?.refreshIntervalMs ?? 60_000)

    const guild = computed(() => state.value?.guild ?? null)
    const atBossGate = computed(() => run.value?.atBossGate ?? false)
    const walled = computed(() => run.value?.walled ?? false)
    const canPrestige = computed(() => state.value?.run?.runCleared ?? false)

    async function call<T>(url: string, body: Record<string, unknown>, successMsg: string): Promise<T | null> {
        try {
            const res = await $fetch(url, { method: 'POST', body })
            if (successMsg) toast.add({ title: successMsg, color: 'success' })
            await refresh()
            return res as T
        } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            toast.add({ title: e?.data?.message ?? 'Something went wrong', color: 'error' })
            throw e
        }
    }

    async function initRun() {
        await $fetch('/api/hero-quest/init', { method: 'POST' })
        await refresh()
    }

    interface BossResult {
        outcome: FightOutcome
        seed: number
        secondsElapsed: number
        damageDealtPct: number
        enemyMaxHp: string
        /** Per body, escort first — a boss stands with minions, so the pack is mixed. */
        enemyMaxHps: string[]
        enemyHpRemaining: string
        events: FightEvent[]
        landing: { world: number; stage: number }
        runComplete: boolean
    }

    /**
     * Engage the boss. The response *is* the fight — the server resolved it authoritatively
     * and handed back the event log, so the modal animates a result that already happened.
     * Toast is suppressed: the replay itself is the feedback.
     */
    async function engageBoss() {
        return call<BossResult>('/api/hero-quest/boss/engage', {}, '')
    }

    async function prestige() {
        const res = await call<{ voidShardsEarned: string; prestige: number }>(
            '/api/hero-quest/prestige/execute', {}, ''
        )
        if (res) {
            toast.add({
                title: `Prestige ${res.prestige} — ${formatNumber(Number(res.voidShardsEarned))} Void Shards`,
                description: 'Your hero keeps every level.',
                color: 'success'
            })
        }
        // Gold moves during the settle that precedes the reset.
        await fetchSession()
        return res
    }

    async function pickClass(classId: string) {
        return call<{ className: string }>('/api/hero-quest/prestige/pick-class', { classId }, '')
            .then((res) => {
                if (res) toast.add({ title: `Now training as ${res.className}`, color: 'success' })
                return res
            })
    }

    async function buyUpgrade(upgradeId: string) {
        return call('/api/hero-quest/prestige/shop-buy', { upgradeId }, 'Upgrade purchased')
    }

    interface PullRecord {
        championId: string
        name: string
        rarity: string
        isNew: boolean
        star: number
        level: number
        essence: number
    }

    /**
     * Pull from the Guild. Toast is suppressed — the result reel is the feedback, and a
     * 10-pull would otherwise stack ten toasts.
     */
    async function pullChampions(count: 1 | 10) {
        return call<{ pulls: PullRecord[]; essenceGained: number; gachaLevel: number }>(
            '/api/hero-quest/guild/pull', { count }, ''
        )
    }

    /** Party and formation save together — a formation is only valid against a given party. */
    async function saveParty(championIds: string[], formation: Record<string, 'front' | 'back'>) {
        return call('/api/hero-quest/guild/party', { championIds, formation }, 'Party updated')
    }

    /** Spend Champion Essence on a specific Champion — the full RNG bypass. */
    async function craftChampion(championId: string) {
        return call<{ name: string; isNew: boolean }>(
            '/api/hero-quest/guild/craft', { championId }, ''
        ).then((res) => {
            if (res) {
                toast.add({
                    title: res.isNew ? `Crafted ${res.name}` : `${res.name} levelled`,
                    color: 'success'
                })
            }
            return res
        })
    }

    /** Buy Guild Seals with Gold on the daily escalating ladder. */
    async function buySeals(count: number) {
        const res = await call<{ sealsBought: number; goldSpent: number }>(
            '/api/hero-quest/guild/buy-seals', { count }, ''
        )
        if (res) {
            toast.add({
                title: `+${res.sealsBought} Guild Seals`,
                description: `${formatNumber(res.goldSpent)} Gold`,
                color: 'success'
            })
        }
        // Gold left the shared balance — the header has to follow it.
        await fetchSession()
        return res
    }

    // Gold accrues into the shared balance on every settle, so the header has to follow it.
    let timer: ReturnType<typeof setInterval> | null = null
    onMounted(() => {
        timer = setInterval(async () => {
            await refresh()
            await fetchSession()
        }, refreshIntervalMs.value)
    })
    onUnmounted(() => {
        if (timer) clearInterval(timer)
    })

    return {
        state,
        pending,
        refresh,
        initialized,
        run,
        hero,
        shop,
        guild,
        classTree,
        voidShards,
        nextPrestigeReward,
        settled,
        serverNow,
        atBossGate,
        walled,
        canPrestige,
        initRun,
        engageBoss,
        prestige,
        pickClass,
        buyUpgrade,
        pullChampions,
        saveParty,
        craftChampion,
        buySeals
    }
}
