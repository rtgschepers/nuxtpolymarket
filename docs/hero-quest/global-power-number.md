# Global Power Number (GPN)

Status: **Locked** — decisions confirmed, ready to reference for implementation planning. Resolves `tech-architecture.md` §8's "exact formula = tuning pass" placeholder, and is idea backlog item 1.

## Structure recap

- **Locked scope: GPN is a pure function of the Hero + currently fielded Champions' actual current stats.** Nothing else contributes directly — not a weighted sum of collection counts, gacha levels, or shop-purchase counts. If it doesn't actually make the party stronger right now, it doesn't move GPN.
- Because it's a live read of real stats rather than a stored/accumulated total, **GPN is the one progression-adjacent number in this project that's allowed to decrease** — e.g. benching a strong Champion or unequipping an Artifact drops it immediately.
- Everything that already makes the party stronger flows into GPN automatically and requires no special-casing here — that's the point of deriving it from real stats instead of a separate weighted formula.

---

## 1. Why Stats-Only, No Separate Collection Term

Earlier drafts of this doc considered a two-part formula: a dominant "combat power" term plus a smaller additive term for collection breadth (owned-but-unequipped Champions/Skills/Artifacts), matching the original backlog note that Champions count even when benched.

That's unnecessary. **Champions already count while benched without any extra term**, because a benched Champion still grants the Hero a passive stat buff (`champions-guild-gacha.md` §7) — so its contribution is already sitting inside the Hero's real stats by the time GPN reads them. Deriving GPN purely from current stats gets that "counts even benched" behavior for free, with no separate collection-scalar math to maintain.

**The flip side, stated plainly (revised — Gear moved sides):** **Champions and Gear** both have a passive-collection mechanic (`champions-guild-gacha.md` §7, `gear-equipment.md` §3), so owning and leveling them moves GPN whether or not the copy is fielded/equipped. **Skills and Artifacts do not** (`skills-gacha.md` / `artifacts-dig-site-gacha.md`) — only equipped copies affect anything, so pulling one that stays unequipped doesn't move GPN at all.

That two-and-two split is an asymmetry inherited from those docs' own mechanics, not something introduced here — and it resolves itself automatically, with zero changes to this doc, if a Skill/Artifact passive-collection bonus ever gets designed later.

**One consequence worth naming for Gear specifically:** because unequipped Gear contributes passively but a *stronger* unequipped piece contributes only that smaller passive, a player who ignores the upgrade indicator (`gear-equipment.md` §3) sees a GPN below what they've actually earned. That's intended — GPN reads actual current stats, not best-possible ones — and the indicator exists precisely so the gap is visible rather than hidden.

---

## 2. Formula

```
partyEffectiveDPS = Σ memberDPS, across the Hero and all currently fielded Champions
```
Exactly `idle-mechanics.md` §4's existing definition, reused verbatim — already crit-averaged, already reflects each member's full active-skill kit at whatever cooldowns their current SPD allows.

```
memberEHP = HP_member × (1 + DEF_member / EHP_DEF_CONSTANT) / (1 - EVA_member)
partyEffectiveEHP = Σ memberEHP, across the same fielded set
```
**Evasion term added (new).** Since EVA (`classes-and-combat.md` §7) makes a share of incoming attacks miss outright, it multiplies effective survivability by exactly `1 / (1 − EVA)` — a 50% evasion party takes half as many landed hits, so it's genuinely twice as durable. Folding it in here keeps GPN honest as a "how much punishment can this party take" number; leaving it out would let a heavy Vital Reflex board (`traits.md` §5) roughly double real durability while GPN reported no change, which would quietly break Arena matchmaking fairness.

Base EVA is 0 for every unit, so this term is `/ 1` — a no-op — for any party without evasion sources, and the formula reduces to its previous form. The `MAX_EVASION` cap of **0.60** (`classes-and-combat.md` §7) bounds the term at **×2.5** — so evasion can at most multiply a party's effective durability by 2.5, never run away.
**New formula, GPN-specific.** Deliberately *not* the Combat doc's mitigation math (`mitigation = min(1, DEF/(PWR × K))`, `classes-and-combat.md` §7) — that formula is defined relative to a specific attacker's PWR and has no meaning without one. GPN needs an absolute "how much punishment can this party currently take" number, untied to any particular enemy, so DEF converts straight into an effective-HP multiplier via its own new constant, `EHP_DEF_CONSTANT` — tuned independently of combat's `K`, same tune-via-playtest convention as everything else.

```
globalPowerNumber = sqrt(partyEffectiveDPS × partyEffectiveEHP)
```
Geometric mean, not a straight sum or product:
- A straight **product** would compound two already-exponential values together and blow the display far past what either stat alone looks like.
- A straight **sum** would let one side (e.g. huge DPS) fully mask a weak other side (e.g. paper-thin EHP).
- The **geometric mean** keeps the result in the same order of magnitude as either input alone, and a party lopsided toward pure offense or pure survivability gets pulled down by whichever side is weak — rewarding balanced parties over min-maxed extremes, which fits a number meant to represent overall strength.

All Decimal-typed throughout (`DPS`, `HP`, `DEF` are already Decimal per `tech-architecture.md` §2), so GPN inherits that automatically — no new numeric-type concern.

---

## 3. Live Snapshot Behavior

Recomputed on every settle (`tech-architecture.md` §4a, unchanged) from the party's current baseline stat block — **not** a per-frame read during an active fight. Taking damage mid-fight doesn't move GPN; only an actual loadout/stat change does (leveling, specializing, fielding a different Champion, equipping/unequipping a Skill or Artifact, a new prestige-shop stat purchase).

**Confirmed: this number can go down.** Swapping a strong Champion for a weaker one, or unequipping an Artifact, drops GPN immediately on the next settle. This is the intended, honest behavior — the number reflects current strength, not a historical peak — and it's what makes GPN usable for Arena matchmaking fairness later (see §5).

---

## 4. What Flows In vs. What Doesn't

**Flows in automatically — no special-casing needed anywhere:**
- Hero leveling and specializing (stat growth, `classes-and-combat.md` §2/§4)
- **Equipped Gear** (`gear-equipment.md` §2) — `equippedBonus` modifies real Hero stats directly
- **Owned-but-unequipped Gear** (`gear-equipment.md` §3) — every non-equipped owned piece contributes a smaller `passiveBonus` to the same stats, exactly mirroring the Champion passive. *(This means Gear is the second system after Champions where collection counts without being fielded — see the revised note in §1.)*
- **Traits** (`traits.md`) — all rolled stats and Set bonuses apply party-wide to the Hero and every fielded Champion, so they land in both the DPS and EHP sums. Evasion from Vital Reflex enters via the EHP formula's `1/(1−EVA)` term (§2)
- **Any** owned Champion leveling/star-ing up, fielded or benched — via the passive collection bonus buffing the Hero directly (`champions-guild-gacha.md` §7)
- Fielding a stronger Champion into an open party slot — their own DPS/EHP joins the party sum directly
- Equipped Skills, Active or Passive (`skills-gacha.md` §3) — modify Hero stats/damage directly
- Equipped Artifacts (`artifacts-dig-site-gacha.md` §2) — party-wide passive modifiers apply to every fielded member's stats directly
- Party slot unlocks — indirectly, once an unlocked slot is actually filled with a fielded Champion

**Does not flow in, under current mechanics:**
- Unequipped/benched Skills — no passive-collection bonus exists in `skills-gacha.md` today
- Unequipped Artifacts — same, `artifacts-dig-site-gacha.md`
- *(Unequipped **Gear** used to belong on this list and no longer does — it has a passive-collection bonus, see above)*
- Gacha level (1–10 per system) — reflects drop-rate progress, not a stat
- A weaker benched Champion sitting behind a stronger fielded one — its own stat block was never in the sum to begin with (only its passive contribution, already counted via the Hero, applies)

---

## 5. Known Uses

- **Platform leaderboard aggregate** (`tech-architecture.md` §1) — unchanged.
- **Profile display** — raw big number, same notation as combat stats (e.g. `3.2e18`), per your call. No compression/normalization pass.
- **Arena matchmaking** (`arena.md`, Locked — resolves `tech-architecture.md` §4d, backlog item 5) — **RESOLVED.** The nuance this section originally flagged (attacker's live GPN not reflecting a defender's actual `defenseLoadout` strength) is answered by a dedicated **Defense GPN**: the exact same formula above, computed off `defenseLoadout` instead of live state, recomputed only when that loadout is saved (not every settle, since it's static between edits) and denormalized to `hqState.defenseGpn` (`tech-architecture.md` §3). Matchmaking compares the attacker's live GPN against the pool of defenders' Defense GPN — the two numbers are finally comparable apples-to-apples. See `arena.md` §2.

---

## Cross-Doc Edit Applied

`tech-architecture.md` §8 updated in this session (see delivered file) — replaced the stale "folding party stats, collection breadth/levels, gacha levels, and shop purchases (exact formula = tuning pass)" description with a pointer to this doc's locked formula.

---

## Implementation Note

Everything above is locked: GPN as a pure live function of the Hero + fielded Champions' actual DPS/EHP (no separate collection term), the new GPN-specific EHP formula (distinct from combat's attacker-relative mitigation), the geometric-mean combination, live-snapshot behavior (can decrease), and raw big-number display. `EHP_DEF_CONSTANT` joins the rest of the project's tunable constants in `constants.ts`, calibrated during the balance-script pass same as everything else. **Revised in a later pass:** the EHP formula now carries a `1/(1−EVA)` evasion term (`classes-and-combat.md` §7), and the "what flows in" lists are updated for Gear (both equipped and passively owned) and Traits (party-wide), neither of which existed when this doc was first written. **The Arena defense-loadout nuance (§5) is now resolved** — see `arena.md` (Locked), which introduces a Defense GPN computed off `defenseLoadout` specifically so Arena matchmaking compares like with like.
