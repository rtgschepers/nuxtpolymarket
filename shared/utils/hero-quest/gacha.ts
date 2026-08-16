/**
 * Shared gacha mechanics for all four systems (`gacha-shared-system.md`).
 *
 * **Written once, parameterised by `system`.** Gear, Champions, Skills and Artifacts are
 * deliberately parallel — one rarity ladder, one leveling curve, one drop table, one dupe
 * formula, one Essence ladder — so this module takes a `GachaSystem` argument rather than
 * being copied per gacha. That is the same reasoning that made `hqCollection` one table
 * instead of four (`tech-architecture.md` §3). Phase 2 builds only the Champion caller;
 * Phase 3 adds the other three with no change here.
 *
 * Pure: no DB, no auth, no `#server` imports. The server calls in to decide what a pull
 * *would* produce and what a spend *would* cost; only the server applies anything.
 */

import {
    CRAFT_COST_PER_RARITY,
    DROP_RATE_TABLE,
    DUPE_LEVEL_CAP,
    DUPE_LEVEL_FACTOR,
    ESSENCE_VALUE_PER_RARITY,
    LEVELS_PER_STAR,
    MAX_GACHA_LEVEL,
    MAX_STAR,
    PULLS_TO_LEVEL_UP,
    SEAL_LADDER_BASE_GOLD,
    SEAL_LADDER_GROWTH,
    SINGLE_PULL_COST,
    TEN_PULL_COST,
    TEN_PULL_SIZE
} from './constants'
import type { Rarity } from './types'

/**
 * The shared 6-tier rarity ladder, in ascending order (`gacha-shared-system.md` §1).
 *
 * Lives here rather than in `content/champions.ts` because it belongs to all four gachas, not
 * to Champions — and because the reverse would make the dependency circular: this module
 * needs the ladder to index the drop table, while the content module needs this module to
 * fold unshipped rarities. Content depends on mechanics, never the other way round.
 */
export const RARITIES: readonly Rarity[] = [
    'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'
]

/** The `system` enum over `hqCollection.contentId`. */
export type GachaSystem = 'gear' | 'champion' | 'skill' | 'artifact'

export const GACHA_SYSTEMS: readonly GachaSystem[] = ['gear', 'champion', 'skill', 'artifact']

export function isGachaSystem(value: string): value is GachaSystem {
    return (GACHA_SYSTEMS as readonly string[]).includes(value)
}

export function rarityIndex(rarity: Rarity): number {
    const index = RARITIES.indexOf(rarity)
    if (index < 0) throw new Error(`Unknown rarity: ${rarity}`)
    return index
}

// ── Gacha leveling ─────────────────────────────────────  §2

export function clampGachaLevel(level: number): number {
    return Math.min(MAX_GACHA_LEVEL, Math.max(1, Math.floor(level)))
}

/** Pulls still owed to reach the next level, or `null` at the cap. */
export function pullsToNextLevel(level: number): number | null {
    const current = clampGachaLevel(level)
    if (current >= MAX_GACHA_LEVEL) return null
    return PULLS_TO_LEVEL_UP[current] ?? null
}

/**
 * Absorb `pulls` into a gacha's level and progress.
 *
 * Leveling tracks **pulls granted, not currency spent** (§4) — which is why a 10-pull costs 9
 * Seals but advances the counter by 10. Loops rather than solving in closed form because the
 * thresholds are a table, not a curve, and there are only ever 9 of them.
 */
export function applyPulls(level: number, progress: number, pulls: number): { level: number; progress: number } {
    let currentLevel = clampGachaLevel(level)
    let currentProgress = Math.max(0, Math.floor(progress)) + Math.max(0, Math.floor(pulls))

    for (;;) {
        const needed = pullsToNextLevel(currentLevel)
        if (needed === null || currentProgress < needed) break
        currentProgress -= needed
        currentLevel++
    }

    // At the cap there is nothing left to spend progress on, so it stops accumulating.
    if (currentLevel >= MAX_GACHA_LEVEL) return { level: MAX_GACHA_LEVEL, progress: 0 }
    return { level: currentLevel, progress: currentProgress }
}

// ── Drop table ─────────────────────────────────────────  §3

/** The rarity weights for a gacha level, as percentages that sum to 100. */
export function dropRatesFor(level: number): readonly number[] {
    const row = DROP_RATE_TABLE[clampGachaLevel(level)]
    if (!row) throw new Error(`No drop table row for gacha level ${level}`)
    return row
}

/**
 * Pick a rarity from a gacha level's drop table, given a uniform roll in `[0, 1)`.
 *
 * Takes the roll rather than generating it: this is pure shared code, and the entropy has to
 * come from the server's CSPRNG (`randomFloat`). Never `Math.random()` — this decides an
 * outcome that pays out real collection value.
 */
export function rarityFromRoll(level: number, roll: number): Rarity {
    const rates = dropRatesFor(level)
    const target = Math.min(1, Math.max(0, roll)) * 100
    let cumulative = 0
    for (let index = 0; index < rates.length; index++) {
        cumulative += rates[index] ?? 0
        if (target < cumulative) return RARITIES[index]!
    }
    // Float slop at the very top of the range: fall back to the last rarity with real weight
    // rather than off the end of the array.
    for (let index = rates.length - 1; index >= 0; index--) {
        if ((rates[index] ?? 0) > 0) return RARITIES[index]!
    }
    return RARITIES[0]!
}

/**
 * Fold a rolled rarity down to the nearest rarity that actually has content.
 *
 * ## Why this exists
 *
 * The §3 drop table weights all six rarities and assumes all six are populated — true of a
 * finished 48-entry roster, false of every partial roster the phased build ships. Phase 2's
 * Champions cover Common / Rare / Mythic only, so better than half of all rolls at gacha
 * level 7+ name a rarity with nothing in it.
 *
 * **Rounding down is deliberately the conservative repair.** The obvious alternative — pick
 * uniformly from whatever exists — inverts the curve: with 4 of 12 Champions Mythic, every
 * such roll became 33% Mythic, pushing the effective Mythic rate at level 10 from a designed
 * 3.0% to 28.7%, and handing out Mythics at level 2 where the table says they are impossible.
 * Folding downward can never pay out better than the roll earned, so the ladder stays
 * monotonic and a partial roster is strictly stingier than the finished one, never richer.
 *
 * Walks up only if nothing exists below, which cannot happen while Common is populated but
 * keeps the function total rather than throwing on an empty roster.
 *
 * **Delete this the day a roster is complete.** It is scaffolding for partial content, and
 * `hasContent` returning true for all six makes it the identity function.
 */
export function foldToAvailableRarity(rarity: Rarity, hasContent: (rarity: Rarity) => boolean): Rarity {
    const rolled = rarityIndex(rarity)
    for (let index = rolled; index >= 0; index--) {
        const candidate = RARITIES[index]!
        if (hasContent(candidate)) return candidate
    }
    for (let index = rolled + 1; index < RARITIES.length; index++) {
        const candidate = RARITIES[index]!
        if (hasContent(candidate)) return candidate
    }
    throw new Error('No rarity in this gacha has any content')
}

/**
 * The drop table as the player will actually experience it, after unshipped rarities fold
 * down into their nearest shipped neighbour.
 *
 * Served to the client instead of the raw table so the odds on screen are the odds being
 * rolled. Showing a designed 60% Epic while every Epic silently resolves to a Rare would be
 * a lie the UI has no way to detect.
 */
export function effectiveDropRates(level: number, hasContent: (rarity: Rarity) => boolean): number[] {
    const raw = dropRatesFor(level)
    const folded = new Array<number>(RARITIES.length).fill(0)
    for (const [index, rate] of raw.entries()) {
        if (rate <= 0) continue
        const target = rarityIndex(foldToAvailableRarity(RARITIES[index]!, hasContent))
        folded[target] = (folded[target] ?? 0) + rate
    }
    return folded
}

// ── Pull cost ──────────────────────────────────────────  §4

export interface PullCost {
    /** Seals actually spent. */
    seals: number
    /** Pulls granted, which is what gacha leveling counts. */
    pulls: number
}

export function pullCost(count: number): PullCost {
    if (count === TEN_PULL_SIZE) return { seals: TEN_PULL_COST, pulls: TEN_PULL_SIZE }
    const pulls = Math.max(1, Math.floor(count))
    return { seals: pulls * SINGLE_PULL_COST, pulls }
}

/**
 * Gold price of the next extra Seal bought today for one gacha (`gold-economy.md` §7).
 *
 * `boughtToday` is that gacha's own counter — the four ladders are independent, so buying
 * Champion pulls today never moves the price of Skill pulls.
 */
export function sealLadderPrice(system: GachaSystem, boughtToday: number): number {
    const growth = SEAL_LADDER_GROWTH[system] ?? 1
    return Math.round(SEAL_LADDER_BASE_GOLD * Math.pow(growth, Math.max(0, Math.floor(boughtToday))))
}

/**
 * The day key the ladder's counters reset on, as `YYYY-MM-DD` in UTC.
 *
 * A plain string compared for equality, deliberately — not a timestamp. Postgres keeps
 * microseconds and a JS `Date` only milliseconds, so a compare-and-swap on a timestamp column
 * matches zero rows and fails closed forever (the platform guidance's standing warning). A
 * date key has no such trap, and "did the day roll over" is all this needs to answer.
 *
 * UTC rather than server-local so the reset does not move when the host's zone does.
 */
export function ladderDateKey(now: number | Date = Date.now()): string {
    return new Date(now).toISOString().slice(0, 10)
}

/**
 * Total Gold to buy `count` Seals in one go, given how many were already bought today.
 *
 * Each unit is priced at its own rung — buying 5 at once must cost exactly what buying them
 * one at a time would, or the bulk path becomes a discount nobody designed.
 */
export function sealLadderTotal(system: GachaSystem, boughtToday: number, count: number): number {
    let total = 0
    for (let index = 0; index < Math.max(0, Math.floor(count)); index++) {
        total += sealLadderPrice(system, boughtToday + index)
    }
    return total
}

// ── Duplicates, levels and stars ───────────────────────  §6

export interface CollectionEntry {
    /** 0–5. Everything starts at 0★. */
    star: number
    /** 1–10 within the current star, resets to 1 on star-up. */
    level: number
    /** Duplicates banked toward the next level. */
    dupeProgress: number
}

export function newEntry(): CollectionEntry {
    return { star: 0, level: 1, dupeProgress: 0 }
}

export function isMaxed(entry: CollectionEntry): boolean {
    return entry.star >= MAX_STAR && entry.level >= LEVELS_PER_STAR
}

/**
 * dupesToLevelUp(star, level) = round(min((star × 10 + level) × 1.618, 20))
 *
 * The same `star × 10 + level` scalar that drives investment multipliers and the §7 passive —
 * one "how strong is this specific copy" number across every use, rather than three curves.
 */
export function dupesToLevelUp(star: number, level: number): number {
    return Math.round(Math.min(investmentScalar(star, level) * DUPE_LEVEL_FACTOR, DUPE_LEVEL_CAP))
}

/** `star × 10 + level`: 1 at 0★/Lv1, 60 at 5★/Lv10. */
export function investmentScalar(star: number, level: number): number {
    return star * LEVELS_PER_STAR + level
}

export interface DupeOutcome {
    entry: CollectionEntry
    /** Levels gained across this application. */
    levelsGained: number
    /** Stars gained across this application. */
    starsGained: number
    /** Essence produced by dupes that landed on an already-maxed copy. */
    essenceGained: number
}

/**
 * Apply `count` duplicates to an owned copy.
 *
 * Once maxed (5★ Lv10) further duplicates auto-convert to Essence instead of being wasted —
 * the reason none of the four gachas needs a pity counter (§5). Handles the boundary in one
 * pass, so a 10-pull that maxes a copy partway through converts only the genuine remainder.
 */
export function applyDupes(entry: CollectionEntry, count: number, rarity: Rarity): DupeOutcome {
    let current: CollectionEntry = { ...entry }
    let remaining = Math.max(0, Math.floor(count))
    let levelsGained = 0
    let starsGained = 0
    let essenceGained = 0

    while (remaining > 0) {
        if (isMaxed(current)) {
            essenceGained += remaining * essenceValueFor(rarity)
            remaining = 0
            break
        }

        const needed = dupesToLevelUp(current.star, current.level) - current.dupeProgress
        if (remaining < needed) {
            current = { ...current, dupeProgress: current.dupeProgress + remaining }
            remaining = 0
            break
        }

        remaining -= needed
        if (current.level >= LEVELS_PER_STAR) {
            current = { star: current.star + 1, level: 1, dupeProgress: 0 }
            starsGained++
            levelsGained++
        } else {
            current = { ...current, level: current.level + 1, dupeProgress: 0 }
            levelsGained++
        }
    }

    return { entry: current, levelsGained, starsGained, essenceGained }
}

/** Total duplicates to take a copy from scratch to 5★ Lv10. The doc's figure is 1,066. */
export function totalDupesToMax(): number {
    let total = 0
    for (let star = 0; star <= MAX_STAR; star++) {
        for (let level = 1; level <= LEVELS_PER_STAR; level++) {
            if (star === MAX_STAR && level === LEVELS_PER_STAR) break
            total += dupesToLevelUp(star, level)
        }
    }
    return total
}

// ── Essence and crafting ───────────────────────────────  §6

export function essenceValueFor(rarity: Rarity): number {
    return ESSENCE_VALUE_PER_RARITY[rarityIndex(rarity)] ?? 0
}

export function craftCostFor(rarity: Rarity): number {
    return CRAFT_COST_PER_RARITY[rarityIndex(rarity)] ?? 0
}
