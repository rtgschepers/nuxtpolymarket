/**
 * Shared shapes for Hero Quest.
 *
 * Structural only — no behaviour lives here. This file is an addition to the directory
 * listing in `tech-architecture.md` §2: every downstream module needs the same types, and
 * housing them in `stats.ts` would force `content/classes.ts` to import upward from its
 * own consumer.
 */

import type { Decimal } from './numbers'

export type HqStatKey = 'pwr' | 'spd' | 'lck' | 'imp' | 'vit' | 'def'

/** The four weighting tiers used by the class spread table (`classes-and-combat.md` §2). */
export type StatTier = 'low' | 'mid' | 'mid_high' | 'high'

/**
 * The 6 main stats, identical for Hero and Champions. HP and EVA are secondary — HP is
 * derived from VIT, EVA is granted only by external sources (Traits, Phase 4).
 */
export interface HqStatBlock {
    pwr: number
    spd: number
    lck: number
    imp: number
    vit: number
    def: number
}

export type ClassId =
    | 'class_beginner'
    | 'class_warrior'
    | 'class_barbarian'
    | 'class_berserker'
    | 'class_knight'
    | 'class_paladin'
    | 'class_mage'
    | 'class_wizard'
    | 'class_sorcerer'
    | 'class_shaman'
    | 'class_witch_doctor'
    | 'class_archer'
    | 'class_bowman'
    | 'class_marksman'
    | 'class_hunter'
    | 'class_beast_master'

export type ClassTier = 'beginner' | 'base' | 'elite' | 'master'

/** Autoattack target selection (`classes-and-combat.md` §7). */
export type AutoTarget = 'lowest_hp_pct' | 'highest_pwr'

export interface ClassNode {
    id: ClassId
    name: string
    parentId: ClassId | null
    tier: ClassTier
    /** Stable string ID — DB rows and loadouts reference IDs only, never indices. */
    skillId: string
    skillName: string
    spread: Record<HqStatKey, StatTier>
    /** Specialization shift, applied cumulatively down the class path. */
    delta: Partial<HqStatBlock>
    /** Baked into the kit, not a stat: Hunter 3, Beast Master 4, everyone else 1. */
    strikesPerAttack: number
    autoTarget: AutoTarget
}

/** A combat-ready unit: stat block resolved into the values the damage formulas consume. */
export interface UnitStats {
    pwr: Decimal
    def: Decimal
    maxHp: Decimal
    attacksPerSecond: number
    strikesPerAttack: number
    critChance: number
    critMultiplier: number
    eva: number
}

export interface EnemyStats {
    hp: Decimal
    pwr: Decimal
    def: Decimal
}

export type StageArchetype = 'wave' | 'boss' | 'elite' | 'super_boss'

export interface RunPosition {
    prestige: number
    world: number
    stage: number
    killsInStage: number
}

/**
 * A fielded Champion, as far as the math layer is concerned.
 *
 * Champions have **no XP level of their own** — they level only by consuming duplicates, on
 * the `(star × 10 + level)` scalar shared by all four gachas (`gacha-shared-system.md` §6),
 * which is bounded at 60. Their unbounded axis is the Hero's level, which is what keeps them
 * from becoming dead weight against a curve that never stops (`champions-guild-gacha.md` §2
 * says only "the other stats scale with level the same way the Hero's do", and never
 * reconciles the two quantities — this is that reconciliation).
 *
 * Phase 1 defines the shape and nothing more: no roster, no archetype spreads, no base stat
 * magnitudes. Those are Phase 2 and the docs do not specify them yet.
 */
export interface ChampionSnapshot {
    /** Stable string ID, never an index. */
    championId: string
    /** Flat rarity multiplier, Common 1.0 → Mythic 2.5 (`champions-guild-gacha.md` §2). */
    rarityMultiplier: number
    /** The gacha investment scalar, `star × 10 + level`: 1 at 0★/Lv1, 60 at 5★/Lv10. */
    investment: number
    /** Baked into the kit, exactly as for the Hero's class node. */
    strikesPerAttack: number
}

export interface HeroSnapshot {
    classId: ClassId
    heroLevel: number
    /** Progress toward the next level. Decimal — it rides the same curve as enemy scaling. */
    heroXp: Decimal
    /** Additive Gold% from Skills/Artifacts/shop. Phase 0: always 0. */
    goldBonusPct: number
    offlineEfficiencyLevel: number
    offlineCapLevel: number
    /** Fielded party, 2–5 once slots exist. Absent or empty through Phase 1. */
    champions?: readonly ChampionSnapshot[]
}

export interface SettleInput {
    hero: HeroSnapshot
    position: RunPosition
    elapsedSeconds: number
    online: boolean
    /** Battle Speed — Phase 4. Callers pass `undefined` until then. */
    speedBoost?: { multiplier: number; overlapSeconds: number }
}

export interface SettleResult {
    position: RunPosition
    kills: number
    goldEarned: number
    xpEarned: Decimal
    /**
     * Hero level *after* the window. The whole window is fought at the departure level —
     * `idle-mechanics.md` §4 forbids re-simulating leveling mid-projection — so levels
     * gained land in one step at the end.
     */
    heroLevel: number
    /** Progress toward the next level once `heroLevel` has absorbed everything it can. */
    heroXp: Decimal
    secondsPerKill: number
    /** True when accrual stopped at a boss gate — offline never resolves a boss. */
    blockedAtBoss: boolean
    effectiveSeconds: number
}
