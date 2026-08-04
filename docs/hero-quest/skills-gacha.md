# Training Grounds (Skill Gacha)

Status: **Locked** — core structure confirmed across this conversation. The 36-skill roster below is a complete first-pass draft, explicitly meant for your fine-tuning pass on names/exact numbers rather than a final authored list.

## Structure recap
- **Hero-only.** Champions already have their own separate, fixed-at-recruitment ability kits (`champions-guild-gacha.md` §1, §6) — this system never touches Champions.
- In-game name: **Training Grounds**. It has 3 art states — Barracks, Archery Range, Wizard Tower — that reflect the Hero's current class path (Section 1). Same pool, same currency, same gacha level underneath regardless of which art is showing.
- Skills pulled here can be either **Active** (flat cooldown, fires automatically the instant it comes off cooldown — plugs directly into the Hero's existing cooldown system, `classes-and-combat.md` §3) or **Passive** (a permanent stat/behavior modifier, no cooldown, always on). Both types live in the same pool, split 50/50.
- **Generic/universal**: every skill, active or passive, must function correctly regardless of the Hero's current class/path. None lock to Warrior/Mage/Archer.
- Equipped via a small number of dedicated Hero-only skill slots — starts at **2**, expandable up to **5** via the prestige shop (Section 6). A slot can hold either type — mixing (e.g. 1 active + 1 passive) is entirely the player's choice.
- **UI:** always visually distinct from class-tree skills, not blended into the same row — class skills sit in square icon slots, Training Grounds skills in smaller circular ones (Section 7).

---

## 1. Training Grounds Art — Tied to Current Class

**Resolved:** the Barracks / Archery Range / Wizard Tower art isn't player-chosen — it's automatically determined by the Hero's current class path:

| Hero's current path | Art shown |
|---|---|
| Warrior line (Warrior, Barbarian, Berserker, Knight, Paladin) | Barracks |
| Archer line (Archer, Bowman, Marksman, Hunter, Beast Master) | Archery Range |
| Mage line (Mage, Wizard, Sorcerer, Shaman, Witch Doctor) | Wizard Tower |
| Beginner (unspecialized) | Barracks *(default)* |

Still purely cosmetic underneath — same single pool, same currency, same shared gacha level (1–10, `gacha-shared-system.md` §2), same drop-rate table (§3). Re-specializing at prestige (`classes-and-combat.md` §5) simply swaps which art displays; nothing about the pool, currency, or progress changes.

---

## 2. Rarity, Leveling & Duplicates

Fully inherited from `gacha-shared-system.md` — no deviation:
- 6-tier rarity (Common → Mythic), same colors (§1)
- Same gacha-leveling curve 1→10, same pulls-to-level-up table (§2)
- Same drop-rate-per-level table (§3) — **identical to the Champion gacha's odds**, since this table isn't gacha-specific; it's the one shared table used across all three systems. Nothing extra needed to match Champion pull rates — it's automatic.
- Currency: **Skill Seals**. 1 pull = 1 Seal, 10-pull = 9 Seals (still counts as 10 toward leveling). Extra Seals are bought with Gold on a **per-gacha daily escalating ladder** starting at 1,000,000 Gold for the day's first purchase (`gacha-shared-system.md` §4; full mechanics and `SEAL_LADDER_GROWTH[skill] = 1.0011` in `gold-economy.md` §7) — no longer a flat 1M/unit
- No pity (§5)
- Duplicates: same `dupesToLevelUp(x,y)` formula, 0★–5★ × Lv1–10, 1,066 dupes to max, post-max dupes convert into **Skill Essence** — spendable via Crafting for a full RNG bypass on a specific chosen skill, same 5×-per-rarity value/cost table (§6). Matches the Champions doc's Guild Seals / Champion Essence split exactly: Skill Seals is the pull currency, Skill Essence is the separate crafting currency.

---

## 3. Effect Design

Two skill types sit side by side in the same pool, decided once per skill at content-authoring time (a skill doesn't switch types):

- **Active:** a flat-cooldown skill that fires automatically the moment its cooldown completes — no new mechanic; it plugs directly into the existing per-skill-cooldown / SPD system already locked in `classes-and-combat.md` §3. There is no manual-cast mode anywhere in the game (Combat doc §3, revised), so an equipped Active is genuinely fire-and-forget. Default targeting follows whatever the Hero's autoattack is currently focused on (Combat doc §7) unless the skill's own design specifies self-targeting, an AoE, or some other override.
- **Passive:** a permanent stat or behavior modifier — always on, no cooldown, no button.

**Core rule — must work for every class, active or passive alike.** Since these skills are equippable regardless of the Hero's current path, no skill may hard-reference a path-specific stat. *(This rule is now nearly self-enforcing: with STR/DEX/INT merged into PWR, there is no path-specific stat left to accidentally reference.)* Every effect falls into one of two safe buckets:

*(Revised — this used to be two buckets and is now effectively one.* The second bucket, "Dynamic/relative effect," existed **specifically** so a skill could reference "your current primary damage stat" abstractly without naming STR, DEX, or INT. Now that those are merged into **PWR** — a normal, always-present stat on every class (`classes-and-combat.md` §2) — a skill can just say "+X% PWR" like it says "+X% SPD." The special bucket has nothing left to do, so it folds in. One fewer design category to reason about.)*

| Bucket | How it stays universal | Examples |
|---|---|---|
| **Path-agnostic stat** | Targets a stat every class has at every rarity — **PWR**, SPD, LCK, IMP, VIT, DEF, HP. Per `classes-and-combat.md` §2 all 6 stats exist on every class, just weighted differently | "+X% PWR," "+X% SPD," "+X% DEF," "+X flat HP," "Deal X% of your PWR to current target" |
| **External resource** | References something every class shares regardless of path — Gold, XP — rather than a combat stat at all | "+X% Gold/XP gain," Gold-burst effects |

**Design philosophy — fun and/or useful (per your steer):** this pool doesn't need to read as a spreadsheet of sober stat percentages. A skill only needs to (a) work for every class and (b) be worth owning. Straightforward stat/cooldown buffs cover "useful"; gimmick effects tied to the game's own economy (Gold-scaled damage, Gold/XP-rate boosts) cover "fun," and give the pool a flavor distinct from both the Hero's class-tree kit and the Champions' combat-role kits. Both are represented in the roster below.

**Economy effects are explicitly in scope** (revised from the earlier draft, which had excluded them): Gold gain%, XP gain%, and offline-efficiency% all appear below. This does put a few Training Grounds passives on the same lever as some prestige-shop upgrades (`core-progression-and-prestige.md` §4) — worth knowing going in, since the two systems now stack rather than staying cleanly separated, but that's the right trade for the "fun and/or useful" brief.

**Design principle (added later): keep Gold-granting bonuses small.** Gold is the platform's persistent, global currency — it isn't run-scoped and carries across every prestige, unlike most of what a Hero build otherwise touches. Any effect that grants it directly, whether a flat burst (Coin Toss, Prospector's Instinct) or an ongoing %-rate increase (Apprentice's Ledger, Merchant's Eye, Warlord's Ledger, Tycoon's Vault, Emperor's Treasury), should stay conservative relative to normal earn rates — and per `gold-economy.md` §6 (Locked), flat bursts should be denominated as a duration of current income rather than a fixed amount, so they stay correctly sized at every point on the curve. A run-scoped resource can absorb a generous bonus without lasting consequence; Gold compounds forever, so it can't. The Gambler's Strike family below (¹) was originally flagged under this same instinct but has since been redesigned once Gold's actual growth curve was defined — see the footnote. Same principle added to `artifacts-dig-site-gacha.md`'s Fortune category, since several of those effects grant Gold too.

**Rarity scaling:** mirrors the Champions doc's "ability count scales with rarity" pattern (§2), applied here as *effect-line count*, active or passive alike:

| Rarity | Effect lines |
|---|---|
| Common / Uncommon / Rare | 1 |
| Epic / Legendary | 2 |
| Mythic | 3 |

A Legendary or Mythic Active bundles a secondary effect onto its base action (e.g. "hits for X, and applies a stacking debuff"), the same way a higher-rarity Passive bundles multiple stat lines.

**On the original "feels full" concern — now largely moot.** Since every skill auto-fires and nothing is manually cast (`classes-and-combat.md` §3, revised), equipped Actives add no buttons to the screen at all; they're extra things happening in the fight, not extra things to manage. Slot count (2 at start, up to 5, Section 6) bounds visual busyness rather than input load. Players who'd still rather see fewer effects firing can equip passives in some or all slots — nothing forces actives into every slot.

**Roster size:** **36 total** — **6 skills per rarity × 6 rarities**, split **3 Active / 3 Passive per rarity** (18/18 overall, an exact 50/50 split). Full list in Section 4.

---

## 4. The Skill Roster — Complete Draft List

A full first pass at all 36 skills, ready for your fine-tuning. Every numeric magnitude ("small/medium/large," exact %, exact cooldown) is a placeholder, same tune-via-playtest convention as every other numeric value in this project — the point of this pass is names, types, and effect shapes, not final balance.

### Common (1 effect line)

| Skill | Type | Effect |
|---|---|---|
| Quick Strike | Active | Hit your current target for a small % of your PWR. Short cooldown. |
| Steadying Breath | Active | Self-only: restore a small % of max HP. Medium cooldown. |
| Coin Toss | Active | Deals no damage — instantly grants a small burst of bonus Gold. |
| Marching Drill | Passive | +SPD% (small). |
| Iron Discipline | Passive | +DEF% (small). |
| Apprentice's Ledger | Passive | +Gold gain% (small). |

### Uncommon (1 effect line)

| Skill | Type | Effect |
|---|---|---|
| Focused Blow | Active | Hit your current target for a larger % of your PWR. Short cooldown. |
| Adrenaline Surge | Active | Self-only: restore a moderate % of max HP. Medium cooldown. |
| Prospector's Instinct | Active | Deals no damage — grants a moderate burst of bonus Gold on cast. |
| Sharpened Reflexes | Passive | +LCK% (small–medium). |
| Endurance Training | Passive | +VIT% / flat HP (small–medium). |
| Scholar's Notes | Passive | +XP gain% (small). |

### Rare (1 effect line)

| Skill | Type | Effect |
|---|---|---|
| Piercing Focus | Active | Hit your current target for a solid % of your PWR, ignoring a small portion of target DEF. |
| Vigor Renewal | Active | Self-only: restore a large % of max HP. Medium-long cooldown. |
| Gambler's Strike¹ | Active | Hit your current target for your PWR, boosted or dampened by how many hours of income you're currently sitting on in banked Gold. |
| Battle Focus | Passive | +IMP% (small–medium). |
| Fortified Resolve | Passive | +DEF% (medium). |
| Merchant's Eye | Passive | +Gold gain% (medium). |

### Epic (2 effect lines)

| Skill | Type | Effect |
|---|---|---|
| Twin Strike | Active | Hit your current target for a % of your PWR, AND apply a minor stacking damage-over-time debuff. |
| Battlefield Surge | Active | Self-only: restore a % of max HP, AND grant yourself a brief +SPD buff. |
| Treasure Hunter's Gambit¹ | Active | Hit your current target for your PWR, wealth-modulated as Gambler's Strike, AND grant yourself a small burst of bonus Gold on the same cast. |
| Veteran's Instincts | Passive | +SPD% AND +LCK% (both medium). |
| Warlord's Ledger | Passive | +Gold gain% AND +XP gain% (both medium). |
| Adaptive Plating | Passive | +DEF% (medium), AND each hit taken has a chance to grant yourself a small temporary shield. |

### Legendary (2 effect lines)

| Skill | Type | Effect |
|---|---|---|
| Executioner's Edge | Active | Hit your current target for bonus damage that scales up the lower that target's HP% is, AND refund a portion of this skill's own cooldown if the hit kills. |
| Phoenix Draught | Active | Self-only: restore a large % of max HP, AND cleanse all debuffs currently on you. |
| Fortune's Gambit¹ | Active | A larger wealth-modulated hit to your current target, AND have a chance to trigger the hit a second time at reduced potency. |
| Grandmaster's Focus | Passive | +IMP% AND +LCK% (both medium–large). |
| Tycoon's Vault | Passive | +Gold gain% AND +offline-efficiency% (both medium–large). |
| Unbreakable Will | Passive | +DEF%/VIT (medium–large), AND resistance to (reduced chance/duration of) one debuff type. |

### Mythic (3 effect lines)

| Skill | Type | Effect |
|---|---|---|
| Ragnarok Strike | Active | Hit your current target hard for a % of your PWR, AND apply a strong stacking debuff, AND have a chance to instantly reset this skill's own cooldown. |
| Aegis of Renewal | Active | Self-only: restore a large % of max HP, AND cleanse all debuffs, AND grant yourself a brief +DEF/mitigation buff. |
| King's Ransom¹ | Active | A massive wealth-modulated hit to your current target, AND grant yourself a large burst of bonus Gold on cast, AND have a chance to also grant a burst of bonus XP. |
| Ascendant's Grace | Passive | +SPD% AND +LCK% AND +IMP% (all large). |
| Emperor's Treasury | Passive | +Gold gain% AND +XP gain% AND +offline-efficiency% (all large). |
| Immortal Vanguard | Passive | +DEF%/VIT (large), AND a chance to reflect a portion of incoming damage, AND resistance to debuffs. |

¹ **Resolved — the Gambler's Strike family, redesigned.** The original flag assumed Gold grows without bound across prestiges, which is no longer true: `gold-economy.md` (Locked) deliberately decouples Gold from the exponential enemy curve and plateaus it (with a slow post-cap crawl), while enemy stats keep growing `5^prestige` forever. That inverts the original risk — a literal "% of current Gold" wouldn't trivialize combat, it would **decay toward irrelevance** at high prestige as Gold falls further and further behind enemy scaling. The fix is a redesign, not a dampening function: these four skills scale off the Hero's **PWR** like every other damage skill (so they keep pace with enemies at every prestige), **modulated by a bounded wealth factor** reflecting how many hours of current income the player has banked — `damage = PWR × abilityMultiplier × wealthFactor(bankedGold / currentGoldPerHour)`, with `wealthFactor` clamped to a modest range (e.g. ×0.5–×2.0). This keeps the gambler fantasy (hoard Gold, hit harder; spend it down, hit softer) intact, works at every prestige tier, and can't be exploited in either direction since both the base stat and the modulation are bounded. See `gold-economy.md` §8 for the full reasoning.

---

## 5. Equip Rules

- **Fully mixable** — both across class paths (any Hero class can equip any skill) and across type (either slot can hold an Active or a Passive, in any combination).
- **No duplicate slotting.** Each equipped slot must hold a *different* skill — you can't slot the same skill twice to double-stack it. Leveling the one copy you own (via the shared dupe system) is how you make a single skill stronger, not slotting it twice.
- Equipped Actives auto-fire on cooldown exactly like class-tree skills (`classes-and-combat.md` §3) — no toggle, no tap, no separate casting behavior for Training Grounds skills.
- Swapping equipped skills is free and unlimited outside of combat — a loadout-level choice, same convention as every other equip-swap in the project (`artifacts-dig-site-gacha.md` §7, `gear-equipment.md` §3, `loadouts.md` §2).

---

## 6. Slot Unlocks (Prestige Shop)

- **Starting: 2 slots.**
- **Maximum: 5 slots**, via **3 prestige-shop purchase levels** — 2→3, 3→4, 4→5 — mirroring the Champion party-slot progression exactly (`champions-guild-gacha.md` §1, "Party Slot Progression"). Each level is a one-time permanent unlock that persists across prestige, same as any other prestige-shop purchase (`core-progression-and-prestige.md` §3).
- **Cross-doc note:** the progression doc's §4 shop list has been updated to match — Champion, Skill, and Artifact slots now all follow the same 2-start/5-cap/3-purchase-level pattern (see `core-progression-and-prestige.md` §4).

---

## 7. UI Presentation — Visually Distinct from Class Skills

**Resolved:** Training Grounds skills must read as a separate system from the Hero's innate class-tree skills at a glance, not blend into the same row:

- **Class-tree skills** (innate, cumulative, from the 16-node tree) display in **square icon slots**.
- **Training Grounds skills** (gacha-acquired, equipped in the 2–5 slots above) display in **smaller circular icon slots**.

Purely a presentation convention — mechanically both feed into the same cooldown/SPD auto-cast system (`classes-and-combat.md` §3) — but the shape-and-size difference keeps players oriented on which abilities are "always there because of my class" versus "equipped loadout, swappable."

---

## Implementation Note

Everything in this doc reflects decisions made explicitly across this conversation: Training Grounds naming, class-tied art with Barracks as Beginner default, Active-or-Passive/no-lock-to-path skills, the "fun and/or useful" design philosophy with economy effects in scope, Hero-only scope, the 2→5 slot progression mirroring Champion party slots, the square-vs-circle UI split, the Skill Seals/Skill Essence currency split, and full reuse of the shared gacha mechanics. **Revised in a later pass:** all references to Actives riding a Hero Auto/Manual switch are removed — Manual mode is deleted game-wide (`classes-and-combat.md` §3), so equipped Actives simply auto-fire on cooldown.

The 36-skill roster (Section 4) is a complete draft, not a final authored list — names, exact magnitudes, and cooldown lengths are yours to fine-tune. The Gambler's Strike family's scaling mechanic (flagged with ¹ above) is now resolved via `gold-economy.md`'s wealth-factor redesign; no open design risk remains there, just the usual numeric tuning pass.
