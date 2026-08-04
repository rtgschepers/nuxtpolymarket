# Hero Quest — Asset List

Derived from all 18 locked design docs. All ten fidelity decisions are now locked — this version reflects them and recomputes the real production volume where the answers changed it.

**Legend:** 🎞️ = spritesheet-animated · 🖼️ = static image/icon

**World & enemy content is still undesigned** (`index.md` §6) — those entries below remain structural counts, not final specs.

---

## 1. Playable & Combat Units

### 1.1 The Hero 🎞️ — **Locked: fully unique per node**

16 fully unique class-node appearances, no shared rig or recolor between them:

| Tier | Nodes |
|---|---|
| Beginner | Beginner |
| Base (3) | Warrior, Mage, Archer |
| Elite (6) | Barbarian, Knight, Wizard, Shaman, Bowman, Hunter |
| Master (6) | Berserker, Paladin, Sorcerer, Witch Doctor, Marksman, Beast Master |

Per-appearance states: **Idle, Basic Attack, Skill cast, Hit, Death** — 5 animation sets × 16 nodes = **80 animated spritesheets**, all bespoke. This is the single most expensive line item on the list, by design — the Hero is the one character a player looks at for the entire game.

Two of the 16 skill-cast animations are summon triggers rather than direct-effect casts (Paladin → Disciple, Witch Doctor → Raised Dead) — the summoned unit itself is scoped separately in 1.3.

### 1.2 Champions 🎞️ — **Locked: shared chassis per archetype, distinct skins within it**

**The production structure this creates is worth stating precisely, since it's a real cost saver:**

- **4 chassis (rigs)** — one per archetype (Damage/Tank/Support/Control). Each chassis is animated **once**: Idle, Basic Attack, Ability-cast pose, Hit, Death = 5 states × 4 chassis = **20 animation sets total**, reused by every Champion of that archetype.
- **48 distinct skins** — every Champion gets its own look applied to its archetype's shared rig, satisfying "2 Champions sharing an archetype+rarity must look different." Skins don't need their own animation work — they ride the chassis's existing 5 states.
- **The ability's actual effect is separate art entirely** — the generic "Ability-cast pose" above just triggers the ability's own VFX (locked as custom-per-ability in Section 2 below), so a Champion doesn't need bespoke animation work just because its ability differs from another Champion's.

**One residual question worth a quick answer, not a full re-ask:** are the 48 skins recolors of a shared silhouette (cheap, fast, but rarity may read as "same guy, different color" across the board), or does each rarity step get a fuller redesign — more ornate armor/effects at Epic+ — layered onto the shared chassis (more expensive, but sells the rarity jump harder)? Either way the *chassis* count (4) and *animation* count (20 sets) don't change — this only affects how much art work the 48 skins themselves take.

### 1.3 Companion / Summon Units 🎞️ — **Locked: simple movement + attack only**

| Summon | Source |
|---|---|
| Disciple | Paladin's skill |
| Raised Dead | Witch Doctor's skill |
| Wolf | Beast Master's kit |

**2 animation states each** (Move, Attack) — **no dedicated Hit or Death animation**. 3 summons × 2 states = **6 animated spritesheets**, the cheapest character-art line on the list.

### 1.4 Enemies — still **blocked on World & Enemy Design**

Unchanged — structure known, content isn't:

| Enemy category | Count needed | Per world |
|---|---|---|
| Regular wave enemies | Several small variants | ×10 worlds |
| Elite wave enemy | 1+ distinct, tougher | ×10 worlds |
| Boss | 1 unique | ×10 worlds |
| Super boss | 1 unique, more elaborate | ×10 worlds |

### 1.5 Raid Bosses 🎞️ — **Locked: all 5 unique designs, no reuse**

| Raid | Fight Type | Notes |
|---|---|---|
| Guild Raid | `solo_boss` | |
| Training Grounds Raid | `solo_boss` | Same fight type as Guild Raid, still a fully separate design |
| Dig-site Raid | `reinforced_boss` | Boss + its own add-wave enemy designs |
| Forge Raid | `phased_boss` | Needs a visually distinct state per HP-threshold phase |
| Trait Raid | `rampaging_boss` | Unkillable by design — no death animation ever plays; needs its own visual language since no HP bar exists (`raid-system.md` §7) |

### 1.6 Arena Training Dummy 🎞️ — **Locked: static, with a simple hit-reaction only**

No idle loop, no attack animation of its own (it never meaningfully fights back — guaranteed loss for it by design). **Just 1 small animation: hit reaction.** Everything else is a static pose.

---

## 2. Combat VFX & Feedback

### 2.1 Ability VFX — **Locked: custom icon + custom VFX animation per ability, for now**

Applies to the 16 Hero skills + 28 Champion abilities = **44 unique ability effects**, each getting its own icon and its own spritesheet VFX. No shared template library at this stage.

**One scope question this raises that wasn't explicitly covered:** does the same "custom per ability" rule extend to the **18 Training Grounds Active skills** (`skills-gacha.md` §4), which fire and deal damage/apply effects the same way Hero skills do — or do those reuse/share VFX from the Hero skill set they visually resemble? Given they're mechanically identical to Hero skills (same cooldown system, same auto-fire behavior), I'd lean toward extending the same "custom per ability" treatment for consistency — flagging rather than assuming, since it's another 18 potential VFX sets (36 Training Grounds skills total, but only the 18 Actives need combat VFX; the 18 Passives are stat modifiers with no cast moment).

### 2.2 Multi-Strike Attack Animation 🎞️ — **Locked: recolor of the single-strike animation, fired multiple times**

Hunter (triple-strike) and Beast Master (quad-strike) reuse the Archer-path single-strike animation with a recolor, triggered 3× and 4× respectively rather than needing bespoke multi-hit spritesheets.

### 2.3 Other Feedback (unchanged, listed for completeness)

| Asset | Notes |
|---|---|
| Status effect icon set 🖼️ | ~15–20 distinct types: burn/DoT, stun, slow, silence, armor shred, curse, shield, buff, debuff-immunity, evasion |
| Damage number styles 🖼️ | Normal hit, crit hit, heal, miss/evasion text |
| HP bar + party frame 🖼️ | Portrait, HP, active status icons — per party member |
| Cooldown radial-fill overlay 🖼️ | Per equipped skill icon |
| Boss enrage-timer UI 🖼️ | 3 of 4 raid fight types |
| Reinforced Boss add-wave spawn VFX 🎞️ | Dig-site Raid |
| Phased Boss phase-transition VFX 🎞️ | Forge Raid |
| Artifact proc feedback 🖼️/🎞️ | Several Artifact effects are chance-based procs rather than always-on (Lucky Dig, Windfall, Chain Reaction, Double Cast, Slipstream, Quick Study) — worth a small flash/icon popup on trigger even though Artifacts are otherwise passive-only |

---

## 3. Static Icons

### 3.1 Ability/Skill Icons 🖼️

| Set | Count | UI shape |
|---|---|---|
| Class-tree skills | 16 | **Square** (`skills-gacha.md` §7 — locked convention) |
| Training Grounds skills | 36 | **Circular** — deliberately distinct from class skills |
| Champion abilities | 28 | — |

### 3.2 Item Icons 🖼️

| Set | Count | Notes |
|---|---|---|
| Artifacts | 48 | 33 underlying effects; icons could follow effects (33) rather than items (48) if desired, same logic as ability VFX reuse |
| Gear | 36 | **Locked: icon only — equipping is never visible on the Hero sprite.** No interaction with Section 1.1's Hero art at all |
| Currency | 16 | Gold, Gems, Void Shards, 4× Seals, 4× Essence, Trait Gems, 5× Keys, Arena Medals |

### 3.3 Frames & Badges 🖼️

| Asset | Count | Notes |
|---|---|---|
| Rarity tier frame/border | 6 | Common (gray) → Mythic (red), shared across all 4 gachas |
| Trait grade frame | 9 | **Locked: each of the 9 grades (F→SSS) gets its own unique color, independent of the 6-tier rarity palette** — a fully separate 9-color ramp, not a reuse or extension of the gacha rarity colors |
| Archetype badge | 4 | Damage/Tank/Support/Control |
| Class-tree node icon | 16 | For the tree-selection UI — distinct from the node's skill-cast icon |

---

## 4. Backgrounds & Environments

Unchanged from the previous pass — nothing here was in the fidelity decision set:

| Asset | Count | Notes |
|---|---|---|
| World backgrounds | 10 | Blocked on World & Enemy Design. World 10 pre-committed as **The Void** |
| Stage-select / world map UI | 1 | |
| Tab backgrounds | ~10 | Forge, Guild, Training Grounds (3 states, already locked), Dig-site, Raids, Traits, Prestige, Arena, Encyclopedia, Leaderboard |
| Gacha pull screen / reveal VFX | **Locked: one shared flash, recolored per rarity tier** | 1 base animation × 6 rarity recolors, not a bespoke cinematic per tier — cheap, reused everywhere |

---

## 5. UI Chrome

Unchanged, listed for completeness:

- Formation grid (3 front / 3 back, all slots freely assignable)
- Loadout save-slot cards (2→10 slots)
- Trait slot UI (5 fixed slots, roll/lock states)
- Arena candidate cards, battle log, Rating leaderboard
- Encyclopedia list + detail views (168 collectibles + 16 class nodes)
- Holiday claim banner + gift-box icon (4 holidays)

---

## 6. Branding

- Hero Quest logo
- App icon
- Splash/loading screen

*(Trademark note stands from before — HeroQuest is an existing, actively-republished board game with mobile ports. Worth resolving before branding assets are produced.)*

---

## Remaining Small Follow-Ups

Everything major is locked. Three small residual items, none blocking:

1. **Champion skins (48): recolor-of-silhouette, or fuller per-rarity redesign?** Doesn't change the 4-chassis/20-animation-set structure either way — only affects how much art work the 48 skins themselves take (Section 1.2).
2. **Do Training Grounds Active skills (18) get the same custom-VFX treatment as Hero/Champion abilities, or reuse the Hero skill VFX set they mechanically resemble?** (Section 2.1)
3. **Artifact procs** — small flash/popup on trigger, or silent (numeric log only)? Six Artifact effects are chance-based rather than always-on (Section 2.3).

---

## Real Production Volume Summary

Now that fidelity is locked, here's what the numbers actually are:

| Category | Count |
|---|---|
| Hero animated spritesheets | **80** (16 nodes × 5 states, fully unique) |
| Champion animation sets | **20** (4 chassis × 5 states — reused across all 48 Champions) |
| Champion unique skins | **48** |
| Summon animated spritesheets | **6** (3 summons × 2 states) |
| Ability VFX + icons | **44** custom sets (Hero + Champion abilities) + possibly 18 more (Training Grounds Actives, per follow-up #2) |
| Raid boss designs | **5**, fully unique |
| Skill/item/currency icons | **164** (16+36+28 ability-adjacent, 48 Artifacts, 36 Gear, 16 currency, plus frames/badges) |
| Enemy content | **Blocked** — 10 worlds × (regular/elite/boss/super boss) |

---

## Suggested Sequencing (maps to `implementation-plan.md`)

| Phase | Asset need |
|---|---|
| 0–1 (core loop prototype) | Hero — even 1–2 of the 16 node appearances is enough to validate the loop before committing to all 80 spritesheets; placeholder enemy stand-ins; minimal UI chrome |
| 2 (Champions) | Build one archetype's chassis + a handful of skins first (validates the shared-rig pipeline) before scaling to all 4 chassis / 48 skins |
| 3 (Gear/Skills/Artifacts) | Icon sets — the cheapest phase, now that Gear is confirmed icon-only with zero Hero-art interaction |
| 4 (Raids/Arena/Traits) | 5 unique raid boss designs, Training Dummy's single hit-reaction, Trait grade frames (9-color ramp) |
| 5 (content completion) | Remaining Champion skins, full 48-Artifact/48-Champion content, World & Enemy Design's entire asset list, ability VFX for the full 44 (+ possibly 18) |
