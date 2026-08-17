/**
 * Hero Quest domain layer.
 *
 * Everything that touches the database lives here; every formula lives in
 * `shared/utils/hero-quest/`. That split is what lets the client run the identical math to
 * animate between refreshes while the server stays the only thing that can *apply* anything.
 *
 * There is no cron, no interval and no background worker anywhere in this game — progress
 * accrues lazily on read, and the `hqState` row lock is the mutex (`tech-architecture.md`
 * §4a). See the block comment above `hqState` in the schema for the full settle contract.
 */

import { eq, sql } from 'drizzle-orm'
import { db, type DbExecutor } from '#server/database'
import { hqCollection, hqLoadouts, hqShopUpgrades, hqState } from '#server/database/schema'
import { credit, getBalance } from '#server/utils/balance'
import {
    BASE_ARTIFACT_SLOTS,
    BASE_CHAMPION_SLOTS,
    BASE_KILL_COUNT,
    BASE_LOADOUT_SLOTS,
    BASE_SKILL_SLOTS,
    BOSS_TIMER_SECONDS,
    MAX_ARTIFACT_SLOTS,
    MAX_CHAMPION_SLOTS,
    MAX_LOADOUT_SLOTS,
    MAX_SKILL_SLOTS,
    ONLINE_THRESHOLD_MS,
    SEAL_GRANT_AMOUNT,
    SEAL_GRANT_BANK_CAP_DAYS,
    SEAL_GRANT_INTERVAL_HOURS,
    STAGES_PER_WORLD,
    TEN_PULL_SIZE,
    VOID_SHARD_BASE,
    VOID_SHARD_GROWTH,
    WORLD_COUNT
} from '#shared/utils/hero-quest/constants'
import {
    craftCostFor,
    dropRatesFor,
    dupesToLevelUp,
    investmentScalar,
    isMaxed,
    ladderDateKey,
    pullCost,
    pullsToNextLevel,
    sealLadderPrice,
    type GachaSystem
} from '#shared/utils/hero-quest/gacha'
import {
    CHAMPIONS,
    RARITY_STAT_MULTIPLIER,
    championDisplayName,
    getArchetype,
    getChampion,
    isChampionId
} from '#shared/utils/hero-quest/content/champions'
import {
    GEAR,
    GEAR_SLOTS,
    GEAR_SLOT_NAME,
    GEAR_SLOT_STAT,
    equippedBonus,
    isGearId,
    passiveBonus,
    upgradeAvailable,
    type GearSlot
} from '#shared/utils/hero-quest/content/gear'
import {
    SKILLS,
    getSkill,
    isSkillId,
    skillPotency,
    trainingGroundsArt
} from '#shared/utils/hero-quest/content/skills'
import {
    ARTIFACTS,
    ARTIFACT_CATEGORY_NAME,
    artifactLineMagnitude,
    isArtifactId
} from '#shared/utils/hero-quest/content/artifacts'
import { gachaContent } from '#shared/utils/hero-quest/content/registry'
import {
    enemyStatsAt,
    killsBeforeWipe,
    offlineCapHours,
    offlineEfficiency,
    goldPerKill,
    packDps,
    packHp,
    packSize,
    rateAt,
    settle,
    stageArchetype,
    wealthHoursFor,
    xpToNextLevel
} from '#shared/utils/hero-quest/settle'
import { economyBonuses, partyUnitStats } from '#shared/utils/hero-quest/stats'
import { D, ZERO, decPow, fromStore, toStore } from '#shared/utils/hero-quest/numbers'
import { CLASS_NODES, childrenOf, getClass, kitFor } from '#shared/utils/hero-quest/content/classes'
import { SHOP_TRACKS, maxLevelFor, shopTrackCost, type ShopTrackId } from '#shared/utils/hero-quest/content/shop'
import { enemyNameAt, getWorld, runProgress } from '#shared/utils/hero-quest/content/worlds'
import type {
    ChampionArchetype,
    ChampionSnapshot,
    ClassId,
    FormationRow,
    HeroSnapshot,
    OwnedCopy,
    Rarity,
    RunPosition,
    SettleResult
} from '#shared/utils/hero-quest/types'

export type HqStateRow = typeof hqState.$inferSelect

export async function getHqState(userId: string) {
    return db.query.hqState.findFirst({ where: eq(hqState.userId, userId) })
}

/** Founding is explicit (`init.post.ts`); the conflict clause is what makes a double-init a no-op. */
export async function ensureHqState(userId: string, tx: DbExecutor = db) {
    await tx.insert(hqState).values({ userId }).onConflictDoNothing()
}

export async function getShopLevels(userId: string, tx: DbExecutor = db): Promise<Record<string, number>> {
    const rows = await tx.select().from(hqShopUpgrades).where(eq(hqShopUpgrades.userId, userId))
    const levels: Record<string, number> = {}
    for (const row of rows) levels[row.upgradeId] = row.level
    return levels
}

export function positionOf(state: HqStateRow): RunPosition {
    return { prestige: state.prestige, world: state.world, stage: state.stage, killsInStage: state.killCount }
}

export type HqCollectionRow = typeof hqCollection.$inferSelect

/** Every owned row across all four gachas, bucketed by system. */
export type HqCollections = Record<GachaSystem, HqCollectionRow[]>

export function emptyCollections(): HqCollections {
    return { gear: [], champion: [], skill: [], artifact: [] }
}

/**
 * All four collections in **one query**, not four.
 *
 * Every party-stat read now needs all four — Gear and Skills feed the Hero's stats, Artifacts
 * feed the whole party's, Champions feed both the party and the §7 passive — and the table is
 * indexed on `(userId, system)`, so a single `WHERE userId = ?` and a bucketing pass is strictly
 * cheaper than four round trips. Inside `settleHq` it also matters for correctness: four separate
 * reads under one lock could interleave with a concurrent pull differently from each other.
 */
export async function getCollections(userId: string, tx: DbExecutor = db): Promise<HqCollections> {
    const rows = await tx.select().from(hqCollection).where(eq(hqCollection.userId, userId))
    const buckets = emptyCollections()
    for (const row of rows) {
        const bucket = buckets[row.system as GachaSystem]
        if (bucket) bucket.push(row)
    }
    return buckets
}

/**
 * Slot counts, one shape for the three tracks that share it.
 *
 * Champions, Skills and Artifacts all run 2 → 5 over 3 prestige-shop levels — the Skills and
 * Artifacts docs both say "mirroring the Champion party-slot progression exactly". **Gear is the
 * deliberate exception** and has no track at all: all six Forge slots are available from account
 * start (`gear-equipment.md` §1).
 */
function slotsFor(
    shopLevels: Record<string, number>,
    upgradeId: string,
    base: number,
    max: number
): number {
    return Math.min(max, base + (shopLevels[upgradeId] ?? 0))
}

/** How many Champion slots the player has bought up to (`champions-guild-gacha.md` §1). */
export function championSlots(shopLevels: Record<string, number>): number {
    return slotsFor(shopLevels, 'championSlots', BASE_CHAMPION_SLOTS, MAX_CHAMPION_SLOTS)
}

/** Hero-only Skill slots (`skills-gacha.md` §6). */
export function skillSlots(shopLevels: Record<string, number>): number {
    return slotsFor(shopLevels, 'skillSlots', BASE_SKILL_SLOTS, MAX_SKILL_SLOTS)
}

/** Party-wide Artifact slots (`artifacts-dig-site-gacha.md` §7). */
export function artifactSlots(shopLevels: Record<string, number>): number {
    return slotsFor(shopLevels, 'artifactSlots', BASE_ARTIFACT_SLOTS, MAX_ARTIFACT_SLOTS)
}

/** Saved Loadout slots — the one track priced in Gems (`loadouts.md` §3). */
export function loadoutSlots(shopLevels: Record<string, number>): number {
    return slotsFor(shopLevels, 'loadoutSlots', BASE_LOADOUT_SLOTS, MAX_LOADOUT_SLOTS)
}

/**
 * Resolve a saved ID list into the owned copies the math layer wants.
 *
 * Filters to what is actually owned and actually known content, then truncates to the purchased
 * slot count — so a roster edit that drops an ID, or a slot count read a moment stale, degrades
 * to a smaller loadout rather than throwing on every settle. **The saved list is never trusted to
 * be within bounds just because the route that wrote it checked**, which is the same posture
 * `championSnapshotsFor` has always taken.
 */
export function equippedCopies(
    ids: readonly string[],
    rows: readonly HqCollectionRow[],
    slots: number,
    isKnownId: (id: string) => boolean
): OwnedCopy[] {
    const owned = new Map(rows.map(row => [row.contentId, row]))
    return ids
        .filter(id => owned.has(id) && isKnownId(id))
        .slice(0, Math.max(0, slots))
        .map((id) => {
            const row = owned.get(id)!
            return { contentId: id, star: row.star, level: row.level }
        })
}

/** Every owned copy of a system, as the math layer wants it. Gear reads all of them. */
export function ownedCopies(rows: readonly HqCollectionRow[], isKnownId: (id: string) => boolean): OwnedCopy[] {
    return rows
        .filter(row => isKnownId(row.contentId))
        .map(row => ({ contentId: row.contentId, star: row.star, level: row.level }))
}

/**
 * Resolve the fielded party from the saved ID list.
 *
 * Filters to Champions actually owned and actually known content, then truncates to the
 * purchased slot count — so revoking a slot, or a roster edit that drops an ID, degrades to a
 * smaller party instead of throwing on every settle. The saved list is not trusted to be
 * within bounds just because the route that wrote it checked.
 */
export function championSnapshotsFor(
    state: HqStateRow,
    collection: readonly HqCollectionRow[],
    slots: number
): ChampionSnapshot[] {
    const owned = new Map(collection.map(row => [row.contentId, row]))
    const formation = state.formation as Record<string, 'front' | 'back'>

    return (state.partyChampionIds as string[])
        .filter(id => owned.has(id) && isChampionId(id))
        .slice(0, Math.max(0, slots))
        .map((id) => {
            const row = owned.get(id)!
            const definition = getChampion(id)
            return {
                championId: id,
                archetype: definition.archetype,
                rarityMultiplier: RARITY_STAT_MULTIPLIER[definition.rarity],
                investment: investmentScalar(row.star, row.level),
                strikesPerAttack: definition.strikesPerAttack,
                row: formation[id] ?? getArchetype(definition.archetype).defaultRow,
                // Straight from content — the roster is the only authority on what a
                // Champion can do, and the count is fixed by its rarity.
                abilities: definition.abilities
            }
        })
}

/** Every owned copy, fielded or not — the §7 passive reads all of them. */
export function ownedChampionsFor(collection: readonly HqCollectionRow[]) {
    return collection
        .filter(row => isChampionId(row.contentId))
        .map(row => ({
            archetype: getChampion(row.contentId).archetype,
            investment: investmentScalar(row.star, row.level)
        }))
}

/**
 * The complete player snapshot the whole math layer runs on.
 *
 * All four gachas feed it, each through the channel its own doc specifies:
 *
 * | System | What is read | Why |
 * |---|---|---|
 * | Champions | fielded party + **whole collection** | The party fights; the collection pays the §7 passive |
 * | Gear | **whole collection** + the equipped map | An unequipped piece still pays a smaller passive (§3) |
 * | Skills | equipped only | The slots are the whole mechanic (§5) |
 * | Artifacts | equipped only | Same, and party-wide in effect rather than Hero-only (§1) |
 *
 * `bankedGold` is optional and only the Gambler's Strike family reads it. Callers that do not
 * have it hand back a wealth-neutral Hero, which is exactly what every pre-Phase-3 caller got.
 */
export function heroSnapshotOf(
    state: HqStateRow,
    shopLevels: Record<string, number>,
    collections: HqCollections = emptyCollections(),
    bankedGold?: number
): HeroSnapshot {
    const formation = state.formation as Record<string, 'front' | 'back'>
    const base: HeroSnapshot = {
        classId: state.heroNodeId as ClassId,
        heroRow: formation.hero,
        heroLevel: state.heroLevel,
        heroXp: fromStore(state.heroXp),
        /**
         * Gold% from Skills and Artifacts arrives through their modifier lines, which
         * `stats.economyBonuses` sums. This channel stays for anything with no content entry to
         * hang a modifier on — there is no such source yet, so it is 0.
         */
        goldBonusPct: 0,
        offlineEfficiencyLevel: shopLevels.offlineEfficiency ?? 0,
        offlineCapLevel: shopLevels.offlineCap ?? 0,
        champions: championSnapshotsFor(state, collections.champion, championSlots(shopLevels)),
        ownedChampions: ownedChampionsFor(collections.champion),

        // Gear reads the whole collection: the equipped piece pays `equippedBonus` and every
        // other owned piece in that slot pays the smaller `passiveBonus`.
        ownedGear: ownedCopies(collections.gear, isGearId),
        equippedGear: state.equippedGear as Record<string, string>,

        equippedSkills: equippedCopies(
            state.equippedSkillIds as string[], collections.skill, skillSlots(shopLevels), isSkillId
        ),
        equippedArtifacts: equippedCopies(
            state.equippedArtifactIds as string[],
            collections.artifact,
            artifactSlots(shopLevels),
            isArtifactId
        )
    }

    /**
     * Resolved only when something actually reads it.
     *
     * `wealthHoursFor` runs a whole extra `rateAt` to denominate banked Gold in hours of income,
     * and every settle and every state read would pay for it — for a Hero carrying none of the
     * four Gambler's Strike skills, where the answer is discarded. The guard is a scan of the
     * equipped list, which is at most five entries.
     */
    if (bankedGold === undefined || !hasWealthScaledSkill(base)) return base
    // One fixed-point iteration, against a wealth-neutral rate — see `wealthHoursFor`.
    return { ...base, wealthHours: wealthHoursFor(base, positionOf(state), bankedGold) }
}

/** Does this Hero field anything whose damage reads banked Gold? */
function hasWealthScaledSkill(hero: HeroSnapshot): boolean {
    return (hero.equippedSkills ?? []).some(copy =>
        isSkillId(copy.contentId) && getSkill(copy.contentId).effect?.wealthScaled === true)
}

export function isBossStage(stage: number): boolean {
    const archetype = stageArchetype(stage)
    return archetype === 'boss' || archetype === 'super_boss'
}

/**
 * Grant the same number of every Seal type, in one statement.
 *
 * Milestones are not gacha-specific, so they pay all four currencies together
 * (`economy-and-currencies.md` §5). Written as an SQL increment rather than read-then-write
 * so it composes safely with whatever else the caller's transaction is doing.
 */
export function sealGrantSet(amount: number) {
    const by = Math.max(0, Math.floor(amount))
    return {
        forgeSeals: sql`${hqState.forgeSeals} + ${by}`,
        guildSeals: sql`${hqState.guildSeals} + ${by}`,
        skillSeals: sql`${hqState.skillSeals} + ${by}`,
        excavationSeals: sql`${hqState.excavationSeals} + ${by}`
    }
}

/**
 * How many free time-gated grants are owed, and the clock value to write back.
 *
 * Banks up to `SEAL_GRANT_BANK_CAP_DAYS` intervals so a few missed days aren't punishing,
 * but never accrues indefinitely. A null clock means the account has never been granted —
 * it pays one interval immediately, so a brand-new player can pull without waiting a day.
 *
 * The returned clock advances by whole intervals actually paid, not to `now`, so a partial
 * interval is never silently discarded.
 */
export function dueSealGrants(lastGrantAt: Date | null, now: number): { grants: number; clock: Date } {
    const intervalMs = SEAL_GRANT_INTERVAL_HOURS * 3600 * 1000
    if (!lastGrantAt) return { grants: SEAL_GRANT_AMOUNT, clock: new Date(now) }

    const elapsed = now - lastGrantAt.getTime()
    if (elapsed < intervalMs) return { grants: 0, clock: lastGrantAt }

    const whole = Math.floor(elapsed / intervalMs)
    const capped = Math.min(whole, SEAL_GRANT_BANK_CAP_DAYS)
    return {
        grants: capped * SEAL_GRANT_AMOUNT,
        clock: new Date(lastGrantAt.getTime() + whole * intervalMs)
    }
}

/** Payout for completing a prestige, `VOID_SHARD_BASE × VOID_SHARD_GROWTH^prestigeCompleted`. */
export function voidShardsFor(prestigeCompleted: number) {
    return D(VOID_SHARD_BASE).mul(decPow(VOID_SHARD_GROWTH, Math.max(0, prestigeCompleted)))
}

export interface SettleOutcome {
    state: HqStateRow
    result: SettleResult | null
    /** True when the window was short enough to count as the player being present. */
    online: boolean
    /** Hero level before the window, so callers can report levels gained. */
    previousLevel: number
    elapsedSeconds: number
}

/**
 * Accrue everything that has happened since `lastSettledAt`, and write it down.
 *
 * Steps, in the order `tech-architecture.md` §4a fixes them:
 *
 * 1. Take the row lock. Two concurrent settles would otherwise read the same
 *    `lastSettledAt` and both pay the same window out; the loser blocks here and then reads
 *    a timestamp that has already moved.
 * 2. Early-return on a non-positive gap.
 * 3. Classify the chunk as online or offline — that is what decides whether the offline cap
 *    and efficiency apply at all.
 * 4. Run the pure `settle()`. It stops at boss gates and never resolves one.
 * 5. Credit Gold through `balance.ts` **with the tx**, then write the new position back.
 *
 * Battle Speed is Phase 4; `settle()` already takes the boost window, so wiring it later is
 * a call-site change here and nothing else.
 */
export async function settleHq(userId: string): Promise<SettleOutcome> {
    /**
     * Banked Gold, read **before** the transaction opens and deliberately so.
     *
     * Two reasons. Deadlock: `credit` later locks this user's balance row from inside the
     * transaction, and a read issued from a second pool connection while that lock is held is
     * exactly the shape the platform guidance warns about. Correctness: the wealth factor
     * describes the Gold the window was *fought with*, so the balance as of the window's start is
     * the right reading, not the balance after it pays out.
     *
     * Only the Gambler's Strike family reads this, and its factor is clamped, so a slightly stale
     * value cannot move anything by more than the clamp already allows.
     */
    const bankedGold = parseFloat(await getBalance(userId)) || 0

    return db.transaction(async (tx) => {
        await ensureHqState(userId, tx)
        const [state] = await tx.select().from(hqState).where(eq(hqState.userId, userId)).for('update')
        if (!state) throw createError({ statusCode: 500, statusMessage: 'Could not initialize Hero Quest state' })

        const now = Date.now()
        const elapsedMs = now - state.lastSettledAt.getTime()
        if (elapsedMs <= 0) return { state, result: null, online: true, previousLevel: state.heroLevel, elapsedSeconds: 0 }

        // Presence is demonstrated by the request pattern, never asserted by the client. A
        // closed app is indistinguishable from a dead network — which degrades to offline
        // rules rather than inflating them, the correct direction to fail in.
        const online = elapsedMs <= ONLINE_THRESHOLD_MS
        const elapsedSeconds = elapsedMs / 1000

        const shopLevels = await getShopLevels(userId, tx)
        // Read inside the lock: the party's power depends on collection rows a concurrent
        // pull may be writing, and a stale read would settle the window at the wrong rate.
        // All four systems now, in one query — every one of them moves the rate.
        const collections = await getCollections(userId, tx)
        const hero = heroSnapshotOf(state, shopLevels, collections, bankedGold)
        const result = settle({ hero, position: positionOf(state), elapsedSeconds, online })

        // The free time-gated Seal grant rides the settle rather than a route of its own:
        // settle is the one thing every read and every mutation already goes through, and a
        // separate claim endpoint would be a second read-then-write to guard for no gain.
        const due = dueSealGrants(state.lastSealGrantAt, now)

        const [updated] = await tx.update(hqState)
            .set({
                lastSettledAt: new Date(now),
                world: result.position.world,
                stage: result.position.stage,
                killCount: result.position.killsInStage,
                atBossGate: isBossStage(result.position.stage),
                heroLevel: result.heroLevel,
                heroXp: toStore(result.heroXp),
                ...(due.grants > 0 ? { ...sealGrantSet(due.grants), lastSealGrantAt: due.clock } : {})
            })
            .where(eq(hqState.userId, userId))
            .returning()

        // Gold is a shared platform balance — it only ever moves through balance.ts, and the
        // tx has to be threaded or the write goes out on a second pool connection and
        // deadlocks against the lock this transaction is already holding.
        if (result.goldEarned > 0) {
            await credit(userId, result.goldEarned.toFixed(4), 'hero-quest', tx)
        }

        return { state: updated ?? state, result, online, previousLevel: state.heroLevel, elapsedSeconds }
    })
}

/**
 * Reset the run and start the next prestige.
 *
 * **Writes four columns and increments `prestige`.** `heroLevel`, `heroXp`, `heroNodeId`,
 * `seenNodeIds`, `voidShards` and every shop row are untouched — hero level persists across
 * prestige *and* across class switches, and there is no relevel anywhere in the game
 * (`core-progression-and-prestige.md` §3). Everything else survives by simply not being
 * written, which is why this is a domain function and not a schema concern.
 */
export function prestigeResetValues(state: HqStateRow) {
    return {
        prestige: state.prestige + 1,
        world: 1,
        stage: 1,
        killCount: 0,
        atBossGate: false
    }
}

/** Class picks legal at a prestige: anything already seen, plus one tier deeper than the current node. */
export function pickableClasses(state: HqStateRow): ClassId[] {
    const seen = new Set(state.seenNodeIds as string[])
    const deeper = childrenOf(state.heroNodeId as ClassId).map(node => node.id)
    return CLASS_NODES.map(node => node.id).filter(id => seen.has(id) || deeper.includes(id))
}

// ── Serializers ────────────────────────────────────────────────────────────────────────
//
// `state.get.ts` has two consumers — the composable and the AI agent's executor overview —
// so it returns derived display values rather than raw rows. Decimals go out as strings and
// are formatted client-side by `numbers.ts`.

export function serializeRun(state: HqStateRow, hero: HeroSnapshot) {
    const position = positionOf(state)
    /**
     * Through `rateAt`, not by assembling the pipeline here.
     *
     * The displayed rate and the settled rate have to be the same number, and this used to build
     * its own units and pack — which meant the screen showed an unbuffed party against an
     * unshredded pack while `settle` earned at the buffed rate. `rateAt` is the one helper
     * `settle()`, the campaign sim and the specs already share, for exactly this reason.
     */
    const { abilities, units, pack, secondsPerKill: spk } = rateAt(hero, position)
    // Per-enemy stats, unmodified — the client shows what one body *is*, and `packSize` says how
    // many of them are standing.
    const enemy = enemyStatsAt(position)
    const dps = packDps(units, pack)
    const wipeAt = killsBeforeWipe(units, pack, spk, abilities.healingPerSecond, abilities.damageTakenFactor)
    const economy = economyBonuses(hero)
    const goldMultiplier = (1 + economy.goldPct) * abilities.goldFactor
    const { name: enemyName, archetype } = enemyNameAt(position.world, position.stage)
    const atBoss = isBossStage(position.stage)
    const killsNeeded = atBoss ? 0 : BASE_KILL_COUNT

    return {
        prestige: position.prestige,
        world: position.world,
        stage: position.stage,
        worldName: getWorld(position.world).name,
        enemyName,
        archetype,
        killCount: position.killsInStage,
        killsRequired: killsNeeded,
        atBossGate: atBoss,
        /** The World 10 super boss is down — prestige is available. */
        runCleared: state.runCleared,
        bossTimerSeconds: BOSS_TIMER_SECONDS,
        progress: runProgress(position.world, position.stage),
        worldCount: WORLD_COUNT,
        stagesPerWorld: STAGES_PER_WORLD,

        /** Per *enemy*, not per pack — `packSize` says how many of these are standing. */
        enemyHp: enemy.hp.toString(),
        enemyPwr: enemy.pwr.toString(),
        enemyDef: enemy.def.toString(),
        packSize: packSize(pack),
        packHp: packHp(pack).toString(),
        partyDps: dps.toString(),
        /** Amortized per enemy, so it stays comparable to `goldPerKill`. */
        secondsPerKill: Number.isFinite(spk) ? spk : null,
        /** Seconds to clear a whole encounter — what the battle animation should cycle on. */
        secondsPerPack: Number.isFinite(spk) ? spk * packSize(pack) : null,
        /** Both already carry every Gold% and burst source, so the client never stacks them itself. */
        goldPerKill: goldPerKill(position.prestige, position.world, position.stage) * goldMultiplier,
        goldPerHour: Number.isFinite(spk) && spk > 0
            ? (3600 / spk) * goldPerKill(position.prestige, position.world, position.stage) * goldMultiplier
            : 0,
        /** What the collection is currently adding, so the Fortune lines are visible as numbers. */
        goldBonusPct: goldMultiplier - 1,
        xpBonusPct: (1 + economy.xpPct) * abilities.xpFactor - 1,
        offlineEfficiency: offlineEfficiency(hero.offlineEfficiencyLevel, economy.offlineEfficiencyPct),

        /**
         * How many kills one stage attempt survives. Below `killsRequired` the stage restarts
         * instead of clearing — the run holds position and keeps earning, so levelling is
         * what breaks the wall.
         */
        killsBeforeWipe: Number.isFinite(wipeAt) ? wipeAt : null,
        walled: !atBoss && wipeAt < killsNeeded
    }
}

export function serializeHero(state: HqStateRow, hero: HeroSnapshot) {
    const node = getClass(hero.classId)
    const units = partyUnitStats(hero)
    const self = units[0]!
    const xp = fromStore(state.heroXp)
    const needed = xpToNextLevel(hero.heroLevel)

    return {
        classId: node.id,
        className: node.name,
        tier: node.tier,
        level: hero.heroLevel,
        xp: xp.toString(),
        xpToNextLevel: needed.toString(),
        xpProgress: needed.lte(0) ? 0 : Math.min(1, xp.div(needed).toNumber()),
        skills: kitFor(hero.classId),
        stats: {
            pwr: self.pwr.toString(),
            def: self.def.toString(),
            maxHp: self.maxHp.toString(),
            // Decimals cross the wire as strings (`tech-architecture.md` §5). SPD and the
            // crit multiplier joined them when the stat block became Decimal — sending the
            // objects raw would serialize break_eternity's internals, not a number.
            spd: self.spd.toString(),
            attacksPerSecond: self.attacksPerSecond,
            strikesPerAttack: self.strikesPerAttack,
            /** A probability, genuinely a number — not a Decimal that needs stringifying. */
            critChance: self.critChance,
            critMultiplier: self.critMultiplier.toString()
        }
    }
}

export function serializeShop(shopLevels: Record<string, number>) {
    return SHOP_TRACKS.map(track => {
        const level = shopLevels[track.id] ?? 0
        return {
            id: track.id,
            name: track.name,
            description: track.description,
            level,
            maxLevel: track.maxLevel,
            /** Not every track is bought with Void Shards — Loadout slots take Gems. */
            currency: track.currency,
            /** `null` means maxed — the client renders that rather than an unbuyable price. */
            nextCost: shopTrackCost(track.id as ShopTrackId, level),
            effect: shopTrackEffect(track.id as ShopTrackId, level)
        }
    })
}

/** Human-readable current and next value for a track, so the client holds no formula. */
function shopTrackEffect(id: ShopTrackId, level: number): { current: string; next: string | null } {
    const formatters: Record<ShopTrackId, (value: number) => string> = {
        offlineEfficiency: value => `${Math.round(offlineEfficiency(value) * 100)}%`,
        offlineCap: value => `${offlineCapHours(value)}h`,
        championSlots: value => `${championSlots({ championSlots: value })} Champions`,
        skillSlots: value => `${skillSlots({ skillSlots: value })} Skills`,
        artifactSlots: value => `${artifactSlots({ artifactSlots: value })} Artifacts`,
        loadoutSlots: value => `${loadoutSlots({ loadoutSlots: value })} Loadouts`
    }
    const format = formatters[id]
    const capped = level >= maxLevelFor(id)
    return { current: format(level), next: capped ? null : format(level + 1) }
}

/**
 * The Guild tab: every Champion in the roster, with the player's copy state folded in.
 *
 * Returns the **whole roster**, owned or not, so the client can render a collection grid with
 * locked entries rather than having to know the roster itself. Un-owned entries carry
 * `owned: false` and no progress.
 */
/**
 * How many Seals of one gacha were bought with Gold today, treating a stale date as zero.
 *
 * Shared by the serializers and the buy route so the price the client is shown and the price it
 * is charged can never come from two different readings of the same rollover. Four independent
 * counters behind one shared reset date (`gold-economy.md` §7) — buying Champion pulls today
 * must not move the Skill price.
 */
export function sealsBoughtToday(state: HqStateRow, system: GachaSystem = 'champion'): number {
    if (state.sealLadderDate !== ladderDateKey()) return 0
    return (state.sealLadderPurchasedToday as Record<string, number>)[system] ?? 0
}

/**
 * The block every gacha tab shares: currencies, level, drop odds, prices, ladder rung.
 *
 * One function for all four because `gacha-shared-system.md` makes them deliberately parallel and
 * the Phase 3 brief is explicit that these are written once and take `system` as an argument. What
 * differs per tab is the *roster*, which each serializer below adds on top.
 */
export interface GachaCommonPayload {
    system: GachaSystem
    label: string
    seals: number
    essence: number
    gachaLevel: number
    gachaProgress: number
    pullsToNextLevel: number | null
    dropRates: readonly number[]
    singleCost: number
    tenPullCost: number
    sealsBoughtToday: number
    nextSealPrice: number
}

/**
 * Which `hqState` column holds each system's Seal and Essence balance.
 *
 * **The one thing `shared/` cannot hold.** Everything else about the four gachas is parameterised
 * by `system` in pure code; these two maps are Drizzle column references, so they live here and
 * are what let `gacha/pull`, `gacha/craft` and `gacha/buy-seals` each be one file. The property
 * name and the column object are both needed — the name to build a `set` fragment, the column to
 * build the `WHERE … >= cost` guard that *is* the concurrency mutex.
 */
const SEAL_FIELD: Readonly<Record<GachaSystem, keyof HqStateRow>> = {
    gear: 'forgeSeals',
    champion: 'guildSeals',
    skill: 'skillSeals',
    artifact: 'excavationSeals'
}

const ESSENCE_FIELD: Readonly<Record<GachaSystem, keyof HqStateRow>> = {
    gear: 'gearEssence',
    champion: 'championEssence',
    skill: 'skillEssence',
    artifact: 'artifactEssence'
}

export const SEAL_COLUMN = {
    gear: hqState.forgeSeals,
    champion: hqState.guildSeals,
    skill: hqState.skillSeals,
    artifact: hqState.excavationSeals
} as const

export const ESSENCE_COLUMN = {
    gear: hqState.gearEssence,
    champion: hqState.championEssence,
    skill: hqState.skillEssence,
    artifact: hqState.artifactEssence
} as const

/** Player-facing currency names, so an error message names the Seal the player was short of. */
export const SEAL_NAME: Readonly<Record<GachaSystem, string>> = {
    gear: 'Forge Seals',
    champion: 'Guild Seals',
    skill: 'Skill Seals',
    artifact: 'Excavation Seals'
}

export const ESSENCE_NAME: Readonly<Record<GachaSystem, string>> = {
    gear: 'Gear Essence',
    champion: 'Champion Essence',
    skill: 'Skill Essence',
    artifact: 'Artifact Essence'
}

/** The conditional decrement, as a `set` fragment keyed on the right column. */
export function sealSpend(system: GachaSystem, amount: number) {
    return { [SEAL_FIELD[system]]: sql`${SEAL_COLUMN[system]} - ${amount}` }
}

export function sealGrant(system: GachaSystem, amount: number) {
    return { [SEAL_FIELD[system]]: sql`${SEAL_COLUMN[system]} + ${amount}` }
}

export function essenceGain(system: GachaSystem, amount: number) {
    if (amount <= 0) return {}
    return { [ESSENCE_FIELD[system]]: sql`${ESSENCE_COLUMN[system]} + ${amount}` }
}

export function essenceSpend(system: GachaSystem, amount: number) {
    return { [ESSENCE_FIELD[system]]: sql`${ESSENCE_COLUMN[system]} - ${amount}` }
}

export function sealBalance(state: HqStateRow, system: GachaSystem): number {
    return Number(state[SEAL_FIELD[system]] ?? 0)
}

export function essenceBalance(state: HqStateRow, system: GachaSystem): number {
    return Number(state[ESSENCE_FIELD[system]] ?? 0)
}

export function serializeGachaCommon(state: HqStateRow, system: GachaSystem): GachaCommonPayload {
    const levels = state.gachaLevels as Record<string, number>
    const progress = state.gachaProgress as Record<string, number>
    const gachaLevel = levels[system] ?? 1
    const bought = sealsBoughtToday(state, system)

    return {
        system,
        label: gachaContent(system).label,
        seals: sealBalance(state, system),
        essence: essenceBalance(state, system),
        gachaLevel,
        gachaProgress: progress[system] ?? 0,
        pullsToNextLevel: pullsToNextLevel(gachaLevel),
        /**
         * The designed table, straight — which is now also the *effective* one.
         *
         * This used to be served through `effectiveDropRates`, because a partial roster made
         * unshipped rarities fold down into their nearest shipped neighbour and showing the raw
         * table would have advertised a 60% Epic chance the roster could not honour. All four
         * rosters are complete, so the two are the same table and the fold is gone.
         */
        dropRates: dropRatesFor(gachaLevel),
        singleCost: pullCost(1).seals,
        tenPullCost: pullCost(TEN_PULL_SIZE).seals,
        sealsBoughtToday: bought,
        nextSealPrice: sealLadderPrice(system, bought)
    }
}

/** The copy-state half of a roster entry — identical across all four collection grids. */
interface CopyState {
    owned: boolean
    star: number
    level: number
    dupeProgress: number
    dupesToLevelUp: number | null
    investment: number
    maxed: boolean
    craftCost: number
}

function copyStateOf(row: HqCollectionRow | undefined, rarity: Rarity): CopyState {
    return {
        owned: row !== undefined,
        star: row?.star ?? 0,
        level: row?.level ?? 0,
        dupeProgress: row?.dupeProgress ?? 0,
        dupesToLevelUp: row ? dupesToLevelUp(row.star, row.level) : null,
        investment: row ? investmentScalar(row.star, row.level) : 0,
        maxed: row ? isMaxed(row) : false,
        /** Essence price of crafting this one outright — its rarity is fixed, so is this. */
        craftCost: craftCostFor(rarity)
    }
}

/**
 * One Champion as the Guild tab sees it — roster content with the player's copy folded in.
 *
 * Spelled out rather than inferred, and the reason is mechanical: Nitro wraps every handler's
 * return in `SerializeObject<...>` to derive the client-side type, and the inference gave up
 * once this payload grew past a certain size, silently degrading array elements to `never`
 * and scalars to `undefined` at the call sites in `guild.vue`. An explicit annotation both
 * fixes that and gives a payload with two consumers a contract worth reading.
 */
export interface GuildRosterEntry extends CopyState {
    id: string
    name: string
    givenName: string
    archetype: ChampionArchetype
    archetypeName: string
    rarity: Rarity
    abilities: string[]
    defaultRow: FormationRow
    row: FormationRow
    fielded: boolean
}

export interface GuildPayload extends GachaCommonPayload {
    slots: number
    partyChampionIds: string[]
    heroRow: FormationRow
    roster: GuildRosterEntry[]
}

export function serializeGuild(
    state: HqStateRow,
    collection: readonly HqCollectionRow[],
    shopLevels: Record<string, number>
): GuildPayload {
    const owned = new Map(collection.map(row => [row.contentId, row]))
    const formation = state.formation as Record<string, 'front' | 'back'>

    return {
        ...serializeGachaCommon(state, 'champion'),
        slots: championSlots(shopLevels),
        partyChampionIds: state.partyChampionIds as string[],
        heroRow: formation.hero ?? getClass(state.heroNodeId as ClassId).defaultRow,

        roster: CHAMPIONS.map((definition) => {
            const archetype = getArchetype(definition.archetype)
            return {
                id: definition.id,
                name: championDisplayName(definition),
                givenName: definition.givenName,
                archetype: definition.archetype,
                archetypeName: archetype.name,
                rarity: definition.rarity,
                abilities: definition.abilities.map(entry => entry.name),
                defaultRow: archetype.defaultRow,
                row: formation[definition.id] ?? archetype.defaultRow,
                fielded: (state.partyChampionIds as string[]).includes(definition.id),
                ...copyStateOf(owned.get(definition.id), definition.rarity)
            }
        })
    }
}

/**
 * The Forge tab (`gear-equipment.md`).
 *
 * Two things here have no equivalent in the other three tabs, and both come from §3's revision to
 * **manual** equip: `equippedId` per slot, and `upgradeAvailable` — the indicator that says an
 * owned piece would out-perform what is worn. The indicator only informs; the swap stays a
 * manual tap, which is exactly what makes attentiveness matter rather than just collection.
 */
export interface ForgeSlotPayload {
    slot: GearSlot
    name: string
    stat: string
    equippedId: string | null
    /** An owned-but-unequipped piece in this slot would contribute more. §3's badge. */
    upgradeAvailable: boolean
}

export interface ForgeRosterEntry extends CopyState {
    id: string
    name: string
    slot: GearSlot
    stat: string
    rarity: Rarity
    equipped: boolean
    /** What this copy contributes right now, as a fraction of its stat. */
    bonus: number
    /** What it *would* contribute if equipped — the number the upgrade indicator compares. */
    equippedBonus: number
}

export interface ForgePayload extends GachaCommonPayload {
    slots: ForgeSlotPayload[]
    roster: ForgeRosterEntry[]
}

export function serializeForge(
    state: HqStateRow,
    collection: readonly HqCollectionRow[]
): ForgePayload {
    const owned = new Map(collection.map(row => [row.contentId, row]))
    const equipped = state.equippedGear as Record<string, string>
    const ownedList = ownedCopies(collection, isGearId)
    const equippedIds = new Set(Object.values(equipped))

    return {
        ...serializeGachaCommon(state, 'gear'),

        // No slot track: all six are available from account start, the deliberate exception
        // among the four gachas (§1).
        slots: GEAR_SLOTS.map(slot => ({
            slot,
            name: GEAR_SLOT_NAME[slot],
            stat: GEAR_SLOT_STAT[slot],
            equippedId: equipped[slot] ?? null,
            upgradeAvailable: upgradeAvailable(slot, ownedList, equipped[slot])
        })),

        roster: GEAR.map((definition) => {
            const row = owned.get(definition.id)
            const isEquipped = equippedIds.has(definition.id)
            const full = equippedBonus(
                definition.slot, definition.rarity, row?.star ?? 0, row?.level ?? 1
            )
            return {
                id: definition.id,
                name: definition.name,
                slot: definition.slot,
                stat: definition.stat,
                rarity: definition.rarity,
                equipped: isEquipped,
                bonus: !row
                    ? 0
                    : isEquipped
                        ? full
                        : passiveBonus(definition.rarity, row.star, row.level),
                equippedBonus: full,
                ...copyStateOf(row, definition.rarity)
            }
        })
    }
}

/**
 * The Training Grounds tab (`skills-gacha.md`).
 *
 * `art` is §1's cosmetic tie to the Hero's current path — Barracks / Archery Range / Wizard
 * Tower. Same pool, same currency, same gacha level underneath whichever is showing.
 */
export interface TrainingRosterEntry extends CopyState {
    id: string
    name: string
    rarity: Rarity
    type: 'active' | 'passive'
    /** One entry per effect line, in the doc's own words. */
    lines: readonly string[]
    /**
     * What this copy's `(star × 10 + level)` scalar multiplies its magnitudes by — 1.0 at 0★/Lv1.
     *
     * Sent so the collection grid can show that levelling did something. Without it a player has
     * no way to tell a 3★ copy from a fresh one beyond the star count itself, which is exactly the
     * gap this scaling was added to close.
     */
    potency: number
    /**
     * Per-line resolved magnitude, index-aligned with `lines`. `null` for an Active, whose payload
     * is a whole effect rather than one number the UI could print next to a sentence.
     */
    lineMagnitudes: (number | null)[]
    equipped: boolean
}

export interface TrainingPayload extends GachaCommonPayload {
    slotCount: number
    equippedSkillIds: string[]
    art: string
    roster: TrainingRosterEntry[]
}

export function serializeTrainingGrounds(
    state: HqStateRow,
    collection: readonly HqCollectionRow[],
    shopLevels: Record<string, number>
): TrainingPayload {
    const owned = new Map(collection.map(row => [row.contentId, row]))
    const equipped = new Set(state.equippedSkillIds as string[])

    return {
        ...serializeGachaCommon(state, 'skill'),
        slotCount: skillSlots(shopLevels),
        equippedSkillIds: state.equippedSkillIds as string[],
        art: trainingGroundsArt(state.heroNodeId as ClassId),
        roster: SKILLS.map((definition) => {
            const row = owned.get(definition.id)
            // At the copy's own investment, or at a fresh 0★/Lv1 for one not yet owned — so a
            // locked entry still shows what it would be worth on arrival.
            const potency = skillPotency(row?.star ?? 0, row?.level ?? 1)
            return {
                id: definition.id,
                name: definition.name,
                rarity: definition.rarity,
                type: definition.type,
                lines: definition.lines,
                potency,
                lineMagnitudes: definition.lines.map((_, index) =>
                    definition.modifiers?.[index] === undefined
                        ? null
                        : definition.modifiers[index]!.magnitude * potency),
                equipped: equipped.has(definition.id),
                ...copyStateOf(row, definition.rarity)
            }
        })
    }
}

/**
 * The Dig-site tab (`artifacts-dig-site-gacha.md`).
 *
 * Effect magnitudes are resolved per copy rather than sent as a formula, because they scale with
 * that copy's `(star × 10 + level)` scalar (§6) — the client would otherwise be re-deriving game
 * math it is not allowed to decide.
 */
export interface DigSiteRosterEntry extends CopyState {
    id: string
    name: string
    rarity: Rarity
    category: string
    categoryName: string
    /** One entry per effect line — its name, what it does, and its current magnitude. */
    effects: { name: string; shape: string; magnitude: number }[]
    equipped: boolean
}

export interface DigSitePayload extends GachaCommonPayload {
    slotCount: number
    equippedArtifactIds: string[]
    roster: DigSiteRosterEntry[]
}

export function serializeDigSite(
    state: HqStateRow,
    collection: readonly HqCollectionRow[],
    shopLevels: Record<string, number>
): DigSitePayload {
    const owned = new Map(collection.map(row => [row.contentId, row]))
    const equipped = new Set(state.equippedArtifactIds as string[])

    return {
        ...serializeGachaCommon(state, 'artifact'),
        slotCount: artifactSlots(shopLevels),
        equippedArtifactIds: state.equippedArtifactIds as string[],
        roster: ARTIFACTS.map((definition) => {
            const row = owned.get(definition.id)
            return {
                id: definition.id,
                name: definition.name,
                rarity: definition.rarity,
                category: definition.category,
                categoryName: ARTIFACT_CATEGORY_NAME[definition.category],
                effects: definition.effects.map(line => ({
                    name: line.name,
                    shape: line.shape,
                    // At the copy's own investment, or at a fresh 0★/Lv1 for one not yet owned —
                    // so a locked entry still shows what it would be worth.
                    magnitude: artifactLineMagnitude(
                        line.kind, definition.rarity, row?.star ?? 0, row?.level ?? 1
                    )
                })),
                equipped: equipped.has(definition.id),
                ...copyStateOf(row, definition.rarity)
            }
        })
    }
}

/**
 * The Loadouts tab (`loadouts.md` §1–3).
 *
 * A preset **never goes stale**: nothing in this game is ever un-owned and slot counts only grow,
 * so an old preset saved under fewer slots stays valid and simply fills fewer of them. That is
 * why nothing here validates a preset's contents — applying it does, against the live collection.
 */
export interface LoadoutPayload {
    slotIndex: number
    name: string
    partyChampionIds: string[]
    equippedSkillIds: string[]
    equippedArtifactIds: string[]
    equippedGear: Record<string, string>
    /** How many of the five components carry anything, for a one-glance summary. */
    filled: number
}

export interface LoadoutsPayload {
    slots: number
    maxSlots: number
    nextSlotCostGems: number | null
    saved: LoadoutPayload[]
}

export function serializeLoadouts(
    rows: readonly (typeof hqLoadouts.$inferSelect)[],
    shopLevels: Record<string, number>
): LoadoutsPayload {
    const slots = loadoutSlots(shopLevels)
    return {
        slots,
        maxSlots: MAX_LOADOUT_SLOTS,
        nextSlotCostGems: shopTrackCost('loadoutSlots', shopLevels.loadoutSlots ?? 0),
        saved: rows
            .filter(row => row.slotIndex < slots)
            .sort((a, b) => a.slotIndex - b.slotIndex)
            .map(row => ({
                slotIndex: row.slotIndex,
                name: row.name,
                partyChampionIds: row.partyChampionIds,
                equippedSkillIds: row.equippedSkillIds,
                equippedArtifactIds: row.equippedArtifactIds,
                equippedGear: row.equippedGear,
                filled: [
                    row.partyChampionIds.length > 0,
                    Object.keys(row.formation).length > 0,
                    row.equippedSkillIds.length > 0,
                    row.equippedArtifactIds.length > 0,
                    Object.keys(row.equippedGear).length > 0
                ].filter(Boolean).length
            }))
    }
}

export async function getLoadouts(userId: string, tx: DbExecutor = db) {
    return tx.select().from(hqLoadouts).where(eq(hqLoadouts.userId, userId))
}

export function serializeClassTree(state: HqStateRow) {
    const seen = new Set(state.seenNodeIds as string[])
    const pickable = new Set(pickableClasses(state))
    return CLASS_NODES.map(node => ({
        id: node.id,
        name: node.name,
        parentId: node.parentId,
        tier: node.tier,
        skill: node.skill,
        seen: seen.has(node.id),
        pickable: pickable.has(node.id),
        current: node.id === state.heroNodeId
    }))
}

/** Bump a shop track by exactly one level, or return null if someone else got there first. */
export async function claimShopLevel(
    tx: DbExecutor,
    userId: string,
    upgradeId: string,
    currentLevel: number
) {
    // Integer compare-and-swap: safe here in a way a timestamp CAS never is. Only the request
    // that finds the row still at `currentLevel` wins, and everyone else rolls back before
    // any currency moves.
    const [claimed] = await tx.insert(hqShopUpgrades)
        .values({ userId, upgradeId, level: currentLevel + 1 })
        .onConflictDoUpdate({
            target: [hqShopUpgrades.userId, hqShopUpgrades.upgradeId],
            set: { level: currentLevel + 1 },
            setWhere: eq(hqShopUpgrades.level, currentLevel)
        })
        .returning({ level: hqShopUpgrades.level })
    return claimed ?? null
}

/** Spend Void Shards, guarded by the read that produced `balance` being inside the same lock. */
export function spendVoidShards(balance: string, cost: number): string | null {
    const held = fromStore(balance)
    const price = D(cost)
    if (held.lt(price)) return null
    const left = held.sub(price)
    return toStore(left.lt(0) ? ZERO : left)
}
