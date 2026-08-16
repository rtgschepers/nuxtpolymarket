# Classes & Combat System

Status: **Locked** — decisions confirmed, ready to reference for implementation planning.

## Structure recap
- **Party size is variable, 3–6 total**: **Slot 1 = Hero** (player-leveled, specializes through the class tree) + **2–5 Champion slots** (Guild gacha, persist across prestige), starting at 2 Champion slots and unlockable up to 5 via prestige-shop purchases (see Champions doc §1, "Party Slot Progression"). The formation grid is a fixed 3 front / 3 back (Section 6), sized for the maximum party.
- All units draw from the same class tree, rooted at **Beginner**, branching into **Warrior / Mage / Archer** (renamed from Magician per your request), each going two specialization tiers deeper.
- A unit's "main ability" set = every skill from every tier it has specialized through (cumulative, not replaced) — this doc treats that as locked-in per your class-system doc's "access to a previous class' skills."

---

## 1. The Class Tree

```
Beginner — Haste
├─ Warrior — Whirlwind
│  ├─ Barbarian — Threatening Roar
│  │  └─ Berserker — Enrage
│  └─ Knight — Shockwave
│     └─ Paladin — Disciple
├─ Mage — Ethereal Bouncebolt
│  ├─ Wizard — Lightning Storm
│  │  └─ Sorcerer — Meteor Shower
│  └─ Shaman — Totem Storm
│     └─ Witch Doctor — Raise Dead
└─ Archer — Piercing Arrow
   ├─ Bowman — Fan of Arrows
   │  └─ Marksman — Arrow Rain
   └─ Hunter — Kill Shot (triple-strike)
      └─ Beast Master — Man's Best Friend
```

**Resolved:** Canoneer is dropped in favor of **Marksman** — keeps the Bowman line consistent with bow usage rather than branching into a different weapon type.

16 total nodes: Beginner, 3 base classes, 6 Elite Classes, 6 Master Classes.

---

## 2. Base Stat Spread per Class

**Revised — STR/DEX/INT merged into a single generic damage stat, `PWR`.** The Hero's stat set is now **6 main/secondary stats: PWR, SPD, LCK, IMP, VIT, DEF**, plus HP (secondary, driven by VIT).

**Why this loses nothing.** In the previous 8-stat table, a class only ever carried a value in *one* of the STR/DEX/INT columns — Warrior was `high/—/—`, Mage `—/—/high`, Archer `—/high/—`. They never coexisted, and `powerStat` already existed purely to switch between them. Merging the three columns is therefore closer to a rename than a rebalance: no information is lost, and the damage formula (Section 7) drops its per-path switch entirely. It also brings the Hero to **full naming parity with Champions**, which already use PWR (`champions-guild-gacha.md` §2).

**Not in this table: Evasion Rate (EVA).** It's a real combat stat (Section 7, "Accuracy & Evasion") but it isn't part of the class spread — every class starts at 0 EVA and only gains it from an external source (currently Traits). Kept out of the per-class weighting deliberately, so adding it didn't require re-balancing all 16 nodes.

| Class | PWR | SPD | LCK | IMP | VIT | DEF |
|---|---|---|---|---|---|---|
| Beginner | mid | mid | mid | mid | mid | mid |
| Warrior | high | low | low | mid | high | high |
| Mage | high | high | mid | mid | low | low |
| Archer | high | mid-high | high | mid | mid | mid |

Weights are directional (baseline = "mid" for Beginner, shifted up/down per class), grounded directly in your flavor text: Warrior's high DEF/VIT and low LCK ("won't crit often"); Mage's no HP multiplier and lowest DEF, plus high SPD to justify "fire very strong skills very frequently"; Archer's high LCK for its stated "boost to crit chance."

**Worth naming the one thing the merge changes rather than hides:** all three base classes now read `high` PWR, where previously each was `high` in a *different* column. That's accurate — each was its path's primary damage stat — but it means **PWR alone no longer differentiates the three paths.** Differentiation now lives entirely in the other five stats (Warrior's DEF/VIT vs. Mage's SPD vs. Archer's LCK), in the class kits themselves, and in the multi-strike modifiers (Section 7). If the three paths need to differ in raw damage output too, that's now an explicit tuning decision on PWR's per-class magnitude, not something the table structure decides for you.

**Specialization deltas** (qualitative direction only — exact numbers are a tuning pass once base values exist):

| Node | Shifts further toward... |
|---|---|
| Barbarian | +PWR, -DEF/VIT (doubling down on Warrior's damage focus) |
| Berserker | +PWR (extreme); Enrage trades max HP + incoming damage as a *skill-level* cost, not a base-stat cost |
| Knight | +DEF/VIT, -PWR (near-opposite of Barbarian) |
| Paladin | modest +PWR only ("raw damage output not enhanced very much"), utility-weighted via its Disciple summon |
| Wizard | +PWR, +SPD ("standard attack rate accelerated") |
| Sorcerer | +PWR (extreme), further -VIT/DEF (most fragile class in the tree) |
| Shaman | +VIT/DEF relative to Wizard ("tougher... slightly more defensive") |
| Witch Doctor | inherits Shaman's spread, utility-weighted via Raise Dead |
| Bowman | +SPD (multi-attack focus) |
| Marksman | +SPD further |
| Hunter | +PWR/LCK (single-target crit focus, triple-strike, reinforced by Kill Shot) |
| Beast Master | inherits Hunter's spread, utility-weighted via its wolf summon, quad-strike |

---

## 3. Main Ability Trigger — **revised, no resource system**

No mana or other casting resource exists anywhere in the game. Every skill, on every path, triggers the same way:

- **Flat cooldown, independent per skill.** Each owned skill (Whirlwind, Ethereal Bouncebolt, Piercing Arrow, and any skill inherited from a lower tier) has its own cooldown timer and fires automatically the instant it's ready — no shared pool, no competing for a resource.
- Because every skill's cooldown length will differ (set later during balancing), a unit with multiple owned skills naturally gets **staggered activations** rather than all skills firing in lockstep. This also resolves the earlier open question about firing priority when multiple skills are "ready" at once — they aren't competing for anything, so there's nothing to prioritize; they simply fire independently whenever each one comes off cooldown.
- This applies uniformly across Warrior, Mage, and Archer paths — there's no longer a mechanical distinction in *how* the three paths trigger abilities, only in cooldown length/values, which is a balancing question rather than a system-design one.

**SPD's role:** per your stats doc, SPD governs "how often skills and abilities trigger" — with the resource system gone, this now means SPD **reduces cooldown duration** across the board, for every skill on every path. Still the mechanical justification for Wizard's "+SPD, attack rate accelerated" note in Section 2, and for Mage's high base SPD explaining why it can "fire very strong skills very frequently." **Beginner's Haste** (Section 1) is the clearest example of this rule in action: since every unit in the game inherits it, and it works by temporarily doubling SPD, it shortens cooldowns on *every* owned skill — including itself — for every class in the tree, not just Beginner.

### Everything auto-casts — no manual mode

**Locked (revised — the earlier Hero-only Manual toggle is deleted, not demoted):** every skill in the game, on every unit, always fires the instant its own cooldown completes. There is no toggle, no tap-to-fire, no ready-and-waiting state anywhere.

The reason is architectural, per `tech-architecture.md` §9.2: combat is resolved **server-side** and the client is strictly an animation player. A manual cast would have to be a client input feeding into an authoritative fight resolution, which the server-authority model doesn't permit — so there are no taps to be inputs to anything.

Consequences worth stating plainly, since they simplify the whole stack:
- No `manualMode` state on the Hero or anywhere else.
- No per-skill ready-glow UI, and no "which of my ready skills should I fire" decision layer.
- No as-if-Auto special-casing in offline settle or in seeded fight resolution — offline and live resolve identically because there was never a divergence to reconcile.
- The Hero's active-play levers are now positioning, loadout, and progression choices — not in-combat inputs. **The game is Auto.**

---

## 4. What Leveling vs. Specializing Changes

These are two different levers now, worth separating clearly:

- **Leveling** (gaining levels within your current node): flat stat growth on that node's stat spread (Section 2), and scaling for every *currently owned* skill's damage/effect.
- **Specializing** (moving one tier deeper — see Section 5 for when this can happen): layers the new node's stat deltas on top of everything already inherited, and **adds** its new named skill to the kit permanently — it does not replace anything, matching "a specialized class will have access to a previous class' skills."

**Resolved: Hero level is uncapped AND fully persistent.** Two separate rules, both locked:

1. **No level cap, ever.** The Hero keeps leveling indefinitely — deliberately uncapped as a safety margin in case the stat/enemy-curve balancing needs correcting later, rather than a hard wall the player can get stuck behind.
2. **Level never resets** (revised — this section previously said level resets to 1 at prestige). It survives prestige, and it survives a class switch: see Section 5.

### Why uncapped leveling still catches the enemy curve — **argument rewritten for continuous levels**

The enemy curve is *bounded within a prestige tier*, not exponential-forever: `enemyMultiplier = b^n` where `n = prestige × 100 + (world-1) × 10 + (stage-1)` has world capped at 10 and stage capped at 10 (per `core-progression-and-prestige.md`'s locked "10 worlds (fixed)" structure), so for any given prestige count there's a fixed, finite ceiling — its value at World 10 / Stage 10.

The old version of this argument leaned on the reset: *"each new prestige resets the Hero to level 1 against a new, higher ceiling, so this logic re-applies fresh every run."* **That reasoning is gone, and what replaces it is stronger, not weaker:**

- Each prestige raises the fixed ceiling by exactly **×T** (`b^100`, ≈2,200 at the current `b = 1.08`), a constant factor per tier. *(Under the old curve this was ×5, because that curve reset at prestige. The continuous curve has no reset, so the per-tier factor is the whole 100-stage span — same ramp, honestly counted.)*
- The Hero's level is now **cumulative across all runs** — it only ever goes up. So rather than restarting a race from zero against a ceiling that keeps rising, the Hero enters every new tier already carrying every level ever earned.
- The guardrail this puts on the eventual per-level stat curve is therefore **stricter and more precise than before**: total Hero power must keep growing by at least ×T per prestige worth of accumulated levels, sustained indefinitely. A flat-additive-per-level curve, notably, **does not satisfy this on its own** — additive growth against a geometric ceiling falls behind eventually, no matter the constant. Either the per-level stat gain needs to itself grow with level (so accumulated power compounds), or the gap has to be carried by the other power sources that *are* multiplicative and persistent: the four gacha collections, prestige-shop multipliers, and Traits.

**This is a real constraint the balance pass has to satisfy, not a formality** — and it's the single most important consequence of making level persistent. Flagging it explicitly rather than letting "uncapped leveling will sort itself out" carry over from the old reset-based reasoning, where it was true and now isn't.

**Now measured, not just argued.** `bun run sim:hero-quest --report=campaign` walks the run until
farming stops working, and at `STAT_PER_LEVEL_GROWTH = 1.0` (flat-additive) it confirms the
prediction: a solo Hero stalls in World 3 and never completes a single prestige, at any XP rate.
Raising that constant to 1.08 clears four prestiges with almost no grinding. The closed form for
holding time-per-stage constant is `XP_STEP_EXPONENT = ln(XP_TO_LEVEL_GROWTH) / ln(STAT_PER_LEVEL_GROWTH)`,
which is undefined at 1.0 — flat stat growth cannot keep pace at *any* XP rate. Whether that gap
is closed by compounding levels or by the multiplicative power sources is still the open call;
what is settled is that it cannot be left to levels alone as they are currently shaped.

---

## 5. Class-Switch Rules on Prestige — **revised from v1**

v1 allowed a mid-run class switch with a level reset. Your class-system doc doesn't support that — correcting it:

- **Switching only happens at prestige**, not mid-run. Between prestiges, the Hero is locked to whatever node it's on (leveling within that node is still free, per Section 4).
- **Locked: switching class does NOT reset Hero level.** The Hero carries its full level across the switch — picking Warrior after a run as a Mage keeps every level intact; only the node changes, and with it the stat spread (Section 2) those levels multiply into, plus the inherited kit. There is **no relevel cost anywhere in the game**: not for prestiging, not for switching, not for switching back.
  - **Why this matters more than it sounds:** with a level reset, "switch class" and "stay put" were mechanically identical — both sent you to level 1 — so trying a new path carried a hidden tax of re-earning everything. Without it, the class picker becomes a pure build choice: the only question is which spread and kit you want your existing level poured into. Experimenting across all 16 nodes is free, which is what makes the "already seen" permanent-unlock rule below actually worth having.
- At each prestige, the player picks either:
  - **(a)** any class "already seen" — i.e. any node previously reached in a past run, including Beginner, or
  - **(b)** a specialization **one tier deeper** than the Hero's current node (e.g. Warrior → Barbarian or Knight; Barbarian → Berserker).
- "Already seen" implies unlocks are permanent — once you've reached a node in any past run, it stays pickable at future prestiges even if you move away from it.
- Because kits are cumulative (Section 4), re-picking a previously-seen deep node should restore its **full inherited kit** (e.g. re-selecting Berserker gives Whirlwind + Threatening Roar + Enrage together), not just Berserker's own skill.
- **Champions: not on this tree at all.** Champions never touch the 16-node class tree — they're built entirely from Archetype + Rarity + a unique ability kit (`champions-guild-gacha.md` §1–2, §6). This section governs the Hero only. *(Revised: an earlier draft had Champions fixed to a class-tree node at recruitment; that was superseded when Champions were fully decoupled into the archetype system, and there is consequently no "recruitable nodes per rarity" question to defer.)*

**Resolved:** Hero's own specialization history only — Champion recruitment doesn't count toward it. Once a specialization has been offered to the Hero (and reached) a single time, it stays permanently offered at every future prestige from then on.

---

## 6. Formation & Positioning (variable party size)

**Revised — both rows are now fixed-capacity at 3 slots each** (was: front fixed at 2, back scaling as party size − 2). The grid is a flat **3 front / 3 back = 6 positions**, matching the maximum party of Hero + 5 Champions.

- **Rows are capacities, not quotas.** With a party smaller than 6, some positions simply sit empty — and there's no requirement to fill the front row first. A 3-person starting party (Hero + 2 Champions) can legally be 3/0, 0/3, 2/1, or any other split.
- This resolves the overflow problem the old formula created: under front-2/back-(size−2), a starting party had exactly **1** back slot while three of the four Champion archetypes default to Back (`champions-guild-gacha.md` §8), so the default configuration was unassignable. With 3 back slots available at every party size, every default now fits.
- **An empty front row is legal.** Per the enemy-targeting rule below, back row becomes targetable once the front row is empty *or* fully dead — an all-backline party is a valid (if fragile) choice, not a blocked one.

Front row tanks single-target attacks for the back row, back row always vulnerable to AoE. Default row suggestion covers the full tree:

- **Front-row default:** Beginner, Warrior, Barbarian, Berserker, Knight, Paladin
- **Back-row default:** Mage, Wizard, Sorcerer, Shaman, Witch Doctor, Archer, Bowman, Marksman, Hunter, Beast Master

All slots remain manually reassignable regardless of class.

---

## 7. Combat Math

### Damage formula
Keyed to **PWR**, the single generic damage stat (Section 2 — no per-path switch anymore). Mitigation is a **clamped ratio** of DEF to the *attacker's* PWR, rather than v1's unbounded diminishing curve — this lets sufficiently mismatched fights land on exactly 0 damage instead of only approaching it:
```
mitigation = min(1, DEF / (PWR × K))
damage = PWR × (1 - mitigation) × abilityMultiplier
       = max(0, PWR - DEF / K) × abilityMultiplier
```
This is now **literally identical to the Champion damage formula** (`champions-guild-gacha.md` §2) rather than merely the same shape — one formula, one stat, for every unit in the game.
`K` is now a ratio threshold rather than v1's flat additive constant: once a defender's DEF reaches `K` times the attacker's own PWR, mitigation is fully 100% and damage floors at exactly **0** — e.g. an enemy far weaker than the Hero can genuinely land zero damage, not just an asymptotic sliver. Below that threshold it still scales smoothly with the DEF-to-PWR *ratio* (not a raw difference), so the earlier reasoning about staying relative/percentage-based against the exponential enemy curve still holds — there's just a hard floor added on top now. Tune `K` via playtesting, same as before.

#### The party pools its PWR — **revision**

The formula above is the **pairwise** contract: one attacker, one defender. A *fielded party* does not resolve it per member. Mitigation is computed **once**, from the party's summed PWR, and every member then swings its own PWR through that shared figure:

```
partyMitigation = min(1, DEF / (Σ PWR_member × K))
partyDamage     = Σ [ PWR_member × (1 - partyMitigation) × ... ]
                = max(0, Σ PWR_member - DEF / K) × ...
```

The party fights as one body with `PWR = Σ`. Incoming damage is deliberately **not** pooled — enemies still resolve against each defender's own DEF, so party size is an offensive lever only.

**Why this had to change.** Because `damage = max(0, PWR − DEF/K)` is a *subtraction*, evaluating it per attacker means N members multiply whatever survives below the zero-damage threshold while the threshold itself never moves. Measured on the un-pooled model at World 9: a solo Hero and a four-member party had **identical** depth ceilings, and the party was worth about a third of a stage. Champions could never open a wall the Hero alone could not — no amount of roster breadth or investment, only raw PWR. Pooling makes party size worth a constant `ln(N)/ln(ENEMY_STEP_BASE)` stages at *every* depth: +14.3 at the starting party of 3, +23.3 at the full 6.

The hard floor this section calls the point of the clamped form survives intact — it just belongs to the party rather than to each member.

### Accuracy & Evasion — **new**

**Evasion Rate (EVA) is a new stat**, introduced by the Trait system (`traits.md` §5, the Vital Reflex set) and available to any future source that wants it. It resolves as a simple pre-damage hit check:

```
hitChance = 1 - EVA_defender          // EVA expressed as a rate, 0.0–1.0
onHit:  roll uniform [0,1) < hitChance  → the attack lands, resolve damage/crit normally
        otherwise                       → the attack misses entirely, 0 damage, no crit roll
```

- **Deliberately simple for now**, per your call — a flat `100% − evasion_rate` accuracy check with no opposing accuracy stat on the attacker's side. If an ACC stat is ever wanted, this becomes `hitChance = clamp(ACC_attacker − EVA_defender)` without disturbing anything else.
- **Base EVA is 0 for every unit** — Hero, every Champion, and every enemy. It is *not* part of the 6-stat class spread (Section 2) and no class node grants it innately. It only exists where something explicitly grants it, which today means Traits.
- **`MAX_EVASION = 0.60` — locked.** Total EVA from all sources is hard-clamped at 60%. Set deliberately below the 70–80% range first suggested, to leave headroom for **additional EVA sources later** (an Artifact Defense effect, a Gear line, a Champion kit) without those sources landing dead on arrival against a cap the Vital Reflex set alone could already reach. At 60%, a 5-piece Vital Reflex board (+50%) still leaves 10 points of usable ceiling for anything added later, and the party is never untouchable.
- **The check runs per incoming attack instance**, before mitigation and before the crit roll — a missed attack rolls nothing else. For multi-strike kits (below) and multi-hit abilities, **each hit rolls its own evasion check independently**, same as crit.
- **Offline/settle treatment:** the offline calc averages crit rather than rolling it (`idle-mechanics.md` §4), and EVA follows the same convention — it applies as a flat `× (1 − EVA)` multiplier on expected incoming damage rather than a per-hit roll. Seeded live fights (`tech-architecture.md` §4c) roll it for real, exactly like crit.
- **Party-wide by default when trait-sourced** — see `traits.md` §5, where Trait effects apply to the whole fielded party.

### Status effects — **new, and decided rather than transcribed**

Both ability rosters lean heavily on status effects — stacking DoTs, refreshed debuffs, shields, cleanses, debuff immunity, "extend all active debuffs on the target" — but **no doc ever defined the system they assume**. Unraveling Curse settles it: an effect that operates on *every debuff currently on a target* can only be written against a queryable, mutable, per-unit registry of live effects. These are that registry's rules. They were chosen during implementation, not lifted from a design pass, so they are open to revision — but they are now what the code does.

**The kinds.** `dot`, `hot`, `shield`, `buff`, `debuff`, `taunt`, `silence`, `stun`, `reflect`, `redirect`, `immunity`. Enough to express every effect the two rosters describe; anything more exotic is a combination rather than a twelfth kind.

**Stacking and refresh.** Reapplying the same effect id **adds a stack and refreshes the duration**, capped at `STATUS_MAX_STACKS`. Both halves are load-bearing: "re-application stacks" needs the stack, and an effect whose duration never refreshed would expire however hard it was maintained. Refresh goes to the **longer** of the two durations, never blindly to the newer — otherwise a short cheap application would cut a long expensive one short, making a strong effect worse for standing beside a weak one. Different ids never merge.

**Periodic cadence.** DoT and HoT pay out on a fixed `STATUS_TICK_SECONDS` grid, deliberately **not** on the combat tick. Paying per combat tick would tie every effect's strength to `FIGHT_TICK_SECONDS`, so halving the sim's resolution would halve every burn. A fixed grid keeps "damage per second" a property of the effect rather than of the simulator. Fractional ticks are paid, not rounded away.

**Stat modifiers combine multiplicatively**, as a product, which makes them **order-independent** — there is no "buffs before debuffs" rule to decide, because multiplication does not care. Any additive scheme would need both a stated order and a floor rule to stop stacked debuffs driving a stat negative, and both would be arbitrary. The product is floored at zero: a stat may reach nothing, never less.

**Shields absorb after mitigation, never before.** A shield therefore buys a predictable amount of *post-mitigation* damage instead of a value that swings with the attacker's PWR and the defender's DEF. It also preserves `MIN_DAMAGE`: that floor is a property of the mitigation formula, and a shield in front of it would let a fully-shielded unit take literally nothing, quietly restoring the immortality the floor exists to prevent. Shields are pools — reapplying tops up rather than replacing — and are consumed oldest-first.

**Silence stops abilities; stun stops abilities and autoattacks.** Cooldowns keep running underneath both, so control *delays* a kit rather than erasing it. A stun eats the swing whose timer came due during it — the attack is lost, not banked, which is what makes hard control worth more than a slow.

**Cleanse and immunity act on hostile kinds only** — `dot`, `debuff`, `silence`, `stun`. A cleanse can never strip the bearer's own buffs or eat a shield it was meant to protect, and immunity blocks incoming hostile effects while letting friendly ones land.

**Debuff resistance reduces duration, not chance.** Nothing sources it yet (it arrives with Skills), but the choice is made: a duration cut is predictable and composes with stacking, where a chance roll would add a second source of variance on top of crit for no design gain.

### Threat — **new**

`champions-guild-gacha.md` §8.2 calls Tank "the primary aggro anchor for the party" and §7 above gives the Warrior path "a threat modifier pulling a share of enemy attacks onto itself", but neither assigns a number or a mechanism. The mechanism:

**Row decides eligibility; threat decides who among the eligible is chosen.** Front row first, back row only once the front is empty or dead — unchanged. Threat sorts *within* that row and never across it, which is exactly `champions-guild-gacha.md` §8.4's requirement that a back-lined Tank's pull stays inert while the front row stands. Putting a Tank in the back row still costs it its entire purpose, with no special case needed to enforce that.

Ties keep their original order, so a party with no aggro anchor targets exactly as it did before threat existed. `TANK_THREAT_MULTIPLIER` is carried by the Tank archetype and by every node on the Warrior path; `TAUNT_THREAT_MULTIPLIER` is what an active `taunt` status adds on top.

### Crit
LCK and IMP are separate stats per your doc. Crit chance is no longer hard-capped below 100% — instead it converts from LCK linearly (no log curve) until it hits 100%, and any LCK beyond that point doesn't get wasted: it converts into bonus crit damage at a reduced rate:
```
rawCritChance = LCK × critChancePerPoint
critChance = min(1.0, rawCritChance)                    // can reach 100%
overflowCritChance = max(0, rawCritChance - 1.0)         // excess past 100%
critDamage = damage × (1 + IMP × critDamagePerPoint + overflowCritChance × overflowConversionRate)
```
`critChancePerPoint`, `critDamagePerPoint`, and `overflowConversionRate` are tuning constants — set so Archer's higher base LCK (Section 2) meaningfully outpaces Warrior/Mage crit rates at equal level, matching "boost to crit chance" in the flavor text. `overflowConversionRate` should sit well below `critDamagePerPoint`: overflow LCK is meant as a "nothing wasted past 100%" safety valve, not a genuinely competitive alternative to investing directly in IMP.

### HP
```
HP = baseHP + VIT × HPperVIT
```

### Multi-strike kit modifiers
Archer-path tiers bake extra hits per autoattack directly into their kit rather than a stat: Archer/Bowman/Marksman stay single-strike-plus-skills, Hunter upgrades to triple-strike, Beast Master to quad-strike — each hit independently rolls crit per the formula above.

### Targeting
| Unit | Autoattack target | Notes |
|---|---|---|
| Warrior path | Lowest-HP% enemy | Carries a threat modifier pulling a share of enemy attacks onto itself while active. |
| Mage path | Lowest-HP% enemy (autoattack) | Skills break this pattern — Ethereal Bouncebolt chains between enemies, Lightning Storm/Meteor Shower hit multiple targets, Totem Storm/Raise Dead affect the party or battlefield rather than a single enemy. |
| Archer path | Highest-PWR enemy (biggest threat) | Deliberately different logic from the Mage path so the two ranged classes don't feel redundant. |
| Enemies → party | Front row first | Back row only targeted once the front row is empty or fully dead (Section 6 — an empty front row is a legal configuration), or by enemy attacks explicitly tagged AoE/backline-piercing. |

---

## Open levers
None remaining — all resolved above. (One deferred item, not an open fork: prestige-shop interactions, which belong to the prestige-shop topic. The previously-listed "exact recruitable nodes/rates per rarity" deferral is **retired** — Champions are fully decoupled from this tree, so there are no recruitable nodes.)

**Revision log for this pass:**
- **Hero level never resets** — not at prestige, not on class switch (Sections 4, 5). The Section 4 boundedness argument is rewritten around continuous levels, and now carries a real constraint: flat-additive per-level growth alone no longer keeps pace with a ×5-per-prestige ceiling.
- **STR/DEX/INT merged into a single `PWR` stat** (Sections 2, 5, 7) — the Hero now runs on 6 stats, the damage formula loses its per-path switch, and Hero/Champion stat naming is finally identical. Flagged in §2: PWR alone no longer differentiates the three paths, so that differentiation is now an explicit tuning choice rather than a structural one.
- `MAX_EVASION` locked at **60%**, chosen to preserve headroom for future EVA sources rather than letting one trait set consume the whole cap.
- Manual cast toggle **deleted entirely** (Section 3) — server-authoritative combat leaves no room for client-side cast inputs.
- Champions confirmed **off the class tree** (Section 5); the stale recruitment-node bullet removed.
- Formation grid changed to a flat **3 front / 3 back**, rows as capacities rather than quotas (Section 6) — fixes the unassignable-default-party problem at small party sizes.
- **Evasion Rate (EVA)** added as a new combat stat with a simple `1 − EVA` accuracy check (Section 7), sourced from Traits, base 0 for everyone, capped below 1.0.
