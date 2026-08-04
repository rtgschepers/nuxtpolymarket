# Gold Economy — Curve, Ceiling & Sinks

Status: **Locked** — decisions confirmed, ready to reference for implementation planning. Resolves `tech-architecture.md` §9.1, closing the last open flag in that doc.

## Structure recap

- **Coins (in-game: Gold) is `user.balance`, Postgres `numeric(19,4)`** — a hard ceiling of **~10¹⁵** (999,999,999,999,999.9999). Per-user, not shared between players; no real money anywhere on the platform. Shared *across the user's games* (Xeno, Colony, Miner, Hack Ops, Shapezz, Pirates, Bank), so this game's income must live on the same scale as theirs.
- **Core resolution: Gold is decoupled from the enemy curve entirely.** `5^prestige` crosses the column ceiling at prestige ~21.5 — plausibly month two for a dedicated player in an infinite-prestige game — so no formula pegged to it survives, dampened or not. Gold instead follows its own **bounded, calendar-calibrated curve** (§3), while all infinite scaling routes through Void Shards, the gacha collections, and combat stats (which are text-column Decimals and don't care).
- **Target anchors (locked):** average ~3-month progress reaches **Colony endgame (~235.6M/hr)**; ~6-month reaches **60% of Xeno's perfect-play ceiling (~0.71B/hr)** — discounted because this game, being idle-native with offline accrual, *realizes* near its ceiling while Xeno players rarely realize theirs. Past the cap, a **+2%/prestige crawl** carries realized income *above* Xeno's full ceiling (~1.18B/hr) only after significant further playtime (§3). Longevity past the plateau is carried by the non-Gold systems by design.

---

## 1. The Constraint, Restated With the Platform Data

Two facts from the cross-game analysis frame everything:

1. **The platform's games don't share an absolute scale** (65,000× spread at the same "Beginner" label) — each game's income is only meaningful against its own cost ladder plus the cross-game pacing metric ("hours to next upgrade"). So this game is free to pick its own scale, as long as its *endgame* lands where you've anchored it.
2. **The ceiling is comfortable at your chosen anchors.** At the Xeno-end rate (1.18B/hr) running 24/7, the balance column takes **~97 years** to fill; at a 2B/hr plateau, ~57 years; even under a hypothetical *perpetual* 10x Battle Speed at plateau, ~5.7 years of literally never spending. The max single offline collect (72h cap, 100% efficiency, plateau rate) is ~1.44×10¹¹ — four orders of magnitude under the ceiling. **Your targets are column-safe with enormous margin.** The ceiling only ruled out `5^prestige` pegging; it does not constrain the curve you actually want.

The 6-month anchor question is resolved: the analysis doc flags Xeno's End figure as a **continuous, zero-downtime, perfect-play ceiling**, not a realized average — and this game, being fully idle-native with offline accrual, will *realize* much closer to its own ceiling than Xeno players realize theirs. **Locked: the 6-month realized target is 60% of Xeno's ceiling (~0.71B/hr)** — parity with what a well-played Xeno account actually takes home, not with its theoretical maximum. Exceeding the full Xeno ceiling remains possible, but only via the post-cap crawl over significant additional playtime (§3).

---

## 2. The Decoupling — What Scales With What

| Quantity | Scales with | Bounded? |
|---|---|---|
| Enemy stats | `5^prestige × 1.6^(world-1) × 1.15^(stage-1)` | No — infinite by design |
| Hero/Champion combat stats, damage, HP | Levels, stars, gear — chases the enemy curve | No — text-column Decimals, fine |
| Void Shards | `100 × 2^prestige` | No — **must move to text/Decimal storage** (already flagged in tech doc; ~prestige 56 breaks bigint) |
| XP | Free to follow enemy value — never touches `user.balance` | **No longer run-scoped** — Hero level persists across prestige (`core-progression-and-prestige.md` §3, revised), so XP is a permanently accumulating quantity. Still unbounded and still fine, since it's text/Decimal like combat stats, but the original "it resets anyway" justification no longer applies |
| **Gold** | **Its own curve: world/stage position + a capped prestige factor (§3). Never `enemyMultiplier`.** | **Yes — by construction** |

This is less of a redesign than it sounds: nothing locked anywhere routes real power progression through Gold at high prestige — that already all flows through Void Shards and the four gacha systems. Gold's defined role (Seal top-ups, future sinks) was always mid-loop convenience. This doc just gives it a formula that admits that.

---

## 3. The Gold Curve

### Per-kill formula

```
goldPerKill(prestige, world, stage) =
    BASE_GOLD
    × 1.25^(world-1) × 1.05^(stage-1)          // within-run growth — deliberately much
                                                // shallower than the enemy 1.6/1.15
    × prestigeGoldFactor[min(prestige, GOLD_PRESTIGE_CAP)]
```

- **Within-run:** later worlds pay meaningfully more per kill (W10 ≈ 7.5× W1) so pushing deeper always feels rewarding, but the run's internal spread stays small next to the prestige factor.
- **`prestigeGoldFactor` is an explicit config table**, not a closed-form function — the growth *rate itself must decay* to hit your anchors (≈×2.8/prestige early → ≈×1.4/prestige approaching month 6 → ×1.0 at cap; a single `G^p` cannot produce that shape), and a table is the most honest, most tunable representation, consistent with the project's tune-via-playtest convention. `GOLD_PRESTIGE_CAP` is where the table goes flat.

### Target table (the designed quantity)

Realized Gold/hour for a typically-well-built player mid-run (includes a modest ~×1.5–2 Gold% stack from Skills/Artifacts/shop, excludes Battle Speed). Prestige counts are placeholders — **calendar anchors are the real targets**; §9 explains how the mapping gets calibrated.

| Milestone | ~Calendar | Target Gold/hr | Platform anchor |
|---|---|---|---|
| p=0 | day 1 | ~2,500 | Platform geometric-mean Beginner (~2,130); clears the Bank floor for a new player's capital by orders of magnitude |
| p≈1–2 | week 1–2 | ~10k–30k | Geometric-mean Early |
| p≈4–5 | month 1 | ~1M–3M | Between geo-mean Late (~878k) and Colony Mid |
| p≈8 | month 2 | ~30M | Colony Mid |
| p≈11 | **month 3** | **~235M** | **Colony End — locked anchor** |
| p≈16 | **month 6** | **~0.71B** | **60% of Xeno End's perfect-play ceiling — locked anchor** (§1) |
| p=GOLD_PRESTIGE_CAP (~17–18) | month ~7 | crawl begins from ~0.85B | — |
| cap + ~17 prestiges | ~month 10–14 (cadence-dependent, §9) | **crosses Xeno's full ceiling (~1.18B)** | The "beat Xeno's perfect play with enough playtime" milestone — reachable, but earned over months of post-plateau prestiging, per your longevity brief |

### Plateau shape — **locked: +2%/prestige crawl**

Past `GOLD_PRESTIGE_CAP`, the factor table continues at **×1.02 per prestige** instead of going flat. The math that makes this satisfy both of your requirements at once:

- **From a ~0.85B crawl-start, crossing Xeno's full 1.18B ceiling takes ~17 additional prestiges** — and post-cap prestiges are the slow ones (enemy ×5 per tier against gacha-driven player growth), so that's plausibly 3–7 further months of play depending on late-game cadence. "Above Xeno's perfect ceiling, but only with significant playtime" — exactly the shape you asked for, and the crawl-start value plus `GOLD_PRESTIGE_CAP` are the two levers the balance script uses to place the crossing where you want it (§9).
- **Column safety is untouched:** 1.02⁵⁰ ≈ 2.7×, 1.02¹⁰⁰ ≈ 7.2× — decades of prestiging still leaves income within one order of magnitude of the plateau, versus a ceiling 6 orders of magnitude away.

---

## 4. The Second Axis — Throughput Floor

Per-kill bounding alone doesn't bound Gold/hour: `secondsPerKill = enemyEHP / partyDPS` approaches zero whenever DPS outruns the enemy curve (which is the entire designed "steamroll after prestige" feel). Fix:

```
secondsPerKill = max(MIN_SECONDS_PER_KILL, enemyEHP / partyDPS)
```

- **`MIN_SECONDS_PER_KILL ≈ 0.5s`** (tunable) — diegetically a spawn-pacing floor, which the Pixi battle scene needs anyway (nothing sane renders 1,000 kills/sec), and which the settle math applies identically so live and offline agree.
- With both axes capped, max Gold/hour is **provably bounded by construction**: `maxGoldPerKill × (3600 / MIN_SECONDS_PER_KILL) × maxGold%Stack × maxBattleSpeed` — a computable constant that `test/hero-quest/settle.spec.ts` should assert stays a healthy margin below any per-collect or balance-safety threshold.

---

## 5. Gold%-Stacking — Bounded Base Makes This Cheap

With the base curve bounded, the uncapped-stack problem from the earlier analysis mostly dissolves: an uncapped % multiplier on a plateaued base shifts the plateau, it can't restore exponential growth. Resolution:

- **No hard cap needed** (unlike Offline Efficiency's 100% ceiling) — instead, the target table above is defined *inclusive* of a typical ~×1.5–2 realized stack, and effect magnitudes across Skills (Apprentice's Ledger family), Artifacts (Fortune), and the prestige-shop Gold% line are tuned so a maximal dedicated stack lands around **×3, ~×5 absolute worst case**. The balance script (§9) verifies the worst-case stack against the §4 bound.
- The existing project principle "keep Gold-granting bonuses small" gets its first quantitative meaning here.

---

## 6. Burst Effects — Denominate in Earn-Time, Not Flat Gold

Every flat-Gold-granting effect (Coin Toss, Prospector's Instinct, Lucky Dig, Windfall, King's Ransom's Gold line) should grant **a duration of current income, not a fixed amount**:

```
burstGold = MINUTES_OF_INCOME × currentTargetGoldPerHour / 60
```

e.g. Coin Toss ≈ 0.5–2 minutes' worth, Windfall ≈ 5–10 minutes' worth (rarity-scaled). This makes every burst automatically correctly-sized at every point on the curve forever — no per-stage tuning, no early-game irrelevance, no late-game exploit — and it inherits the curve's boundedness for free. Recommend adopting as a blanket rule for all current and future Gold-granting effects.

---

## 7. Critical Catch #1 — The 1,000,000-Gold Seal Price Breaks

The locked flat price (1M Gold per extra Seal, `gacha-shared-system.md` §4) collides fatally with the target curve:

- At the **3-month anchor** (235M/hr), one Seal costs **~15 seconds** of farming.
- At the **6-month anchor**, income buys **~28,000 Seals per day** — pulls stop being a resource at all; the entire gacha economy (~50,240 pulls to max a gacha, 1,066 dupes to max an item, the whole Essence/crafting layer) is trivialized wholesale by month 4–5.

This wasn't visible before because Gold's earn rate was undefined; with a real curve it's arithmetic. The fix must also satisfy two constraints you set:

1. **New players should be able to join and play quickly** — no wall in front of the game itself.
2. **Veteran platform players must not pay higher prices for the same content** — pricing must not discriminate by who you are.

Those two constraints jointly kill *both* obvious pricing shapes. **Prestige-scaled pricing** (the earlier §7 proposal) fails a subtler version of #2: a Hero Quest veteran at prestige 16 pays ~700× what a newcomer pays for the identical Seal — progression itself becomes the price hike. **Wealth-scaled pricing** fails #2 directly. And **keeping the flat 1M** fails on its own: it also creates a mirror-image problem for constraint #2's beneficiaries — a Xeno-end platform veteran arriving with billions banked can buy tens of thousands of Seals on day one, blasting the gacha to level ~9 and skipping the game's entire progression arc. That's not a reward for veterancy, it's the game failing to exist for exactly the platform's most engaged users.

### The fix: a daily escalating ladder, split per gacha, calibrated to a 6-month completion target

**Design goal, set explicitly:** a player who dedicates their Gold income entirely to buying one gacha's Seals should be able to fully complete that gacha's roster — every item at 5★/Lv10, not just owned — in roughly 6 months. This is a stronger, more concrete target than the original "convert banked surplus into pulls" framing, and it drives everything below.

**Step 1 — what "fully complete a roster" actually costs in pulls.** Not previously computed anywhere in this project (the ~50,240 figure elsewhere is pulls to level the *gacha's drop table* to 10, a different and much smaller quantity). Simulated pull-by-pull through the real leveling curve (§2/§3 of `gacha-shared-system.md`) through to every item hitting its full 1,066-dupe max (§6 there), assuming uniform item selection within a rarity:

| Gacha | Roster | Pulls to 100% completion |
|---|---|---|
| Champions (Guild) | 48 items, 8/rarity | **~317,000** |
| Artifacts (Dig-site) | 48 items, 8/rarity | **~317,000** (identical structure to Champions) |
| Skills (Training Grounds) | 36 items, 6/rarity | **~244,000** |
| **Gear (The Forge)** | 36 items, 6/rarity | **~244,000** (identical structure to Skills — 6 per rarity, so the Mythic bottleneck splits the same 6 ways) |

Mythic is the bottleneck in every trial, by a wide margin: at level-10 rates, Mythic's 3.0% splits 8 ways (Champions/Artifacts) or 6 ways (Skills), so a *specific* Mythic item lands roughly once every 270–320 pulls — getting all of them to 1,066 copies each dominates the timeline; every other rarity finishes en route unnoticed.

**Step 2 — split the ladder per gacha, not pooled.** Each of the four gachas gets its **own independent daily counter and price ladder** — buying your 5th Champion Seal today is priced off *only* today's Champion purchases, completely independent of how many Skill or Artifact Seals you've also bought today. This reverses the earlier pooled decision: pooling was right for a conservative, minor-supplement ladder, but a ladder sized to actually complete a specific roster has to be sized to that roster, and Champions/Artifacts (317k target) and Skills (244k target) need different growth rates to hit the same 6-month mark.

```
sealGoldCost(gacha, k) = SEAL_BASE_COST × SEAL_LADDER_GROWTH[gacha]^(k-1)
    k = Seals of THIS gacha already Gold-purchased today (independent per gacha)
    SEAL_BASE_COST = 1_000_000 (the locked floor, unchanged)
    SEAL_LADDER_GROWTH[champion]  = 1.0007
    SEAL_LADDER_GROWTH[artifact]  = 1.0007   (same roster size/target as Champions)
    SEAL_LADDER_GROWTH[skill]     = 1.0011   (smaller roster, smaller target, can afford to be a touch steeper)
    SEAL_LADDER_GROWTH[gear]      = 1.0011   (identical roster shape to Skills — 36 items, 6/rarity,
                                              ~244,000 pulls to complete; same rate follows directly)
    resets daily, same cadence as the free daily Seal grants
```

These growth rates are dramatically gentler than the earlier pooled 2.0 — expected, since 2.0 was calibrated to make Gold-buying a token supplement (~172 years to full completion); making it the *primary* path to completing one gacha in 6 months instead necessarily means near-flat pricing at real income scale. Calibration is a first-pass estimate, same as everything numeric in this project — it interpolates the §3 target table's calendar checkpoints and will get refined once `scripts/hero-quest-balance.ts` (§9) can simulate the real prestige→calendar mapping directly.

**What hitting 6 months actually costs the player, worth being upfront about:** it requires spending close to 100% of daily income on that one gacha's Seals for most of the window, not a comfortable side purchase:

| Milestone | Daily income | Sustainable Champion/Artifact Seals per day | % of income spent |
|---|---|---|---|
| Month 1 | ~48M | 40 | ~98% |
| Month 3 (Colony-end) | ~5.7B | 579 | ~99.9% |
| Month 6 (0.71B/hr target) | ~17B | 3,569 | ~99.9% |

A direct consequence: **this 6-month figure is per gacha, not for all four at once.** Each ladder alone demands essentially the full income stream at month 6+, so funding all three simultaneously would need ~3× the income the target curve provides — a player chasing full completion across all three gachas via Gold realistically takes closer to **~18 months** (sequential 6-month pushes, or a 3-way income split that stretches each proportionally). Worth keeping in mind if "6 months" was meant as a completionist milestone rather than a per-gacha one.

### The reopened splurge — accepted

A ladder this gentle inevitably lets a large *banked* balance (as opposed to earned income) buy a meaningfully bigger head start than the earlier steep ladder allowed — this is an unavoidable trade-off of the same lever, not a separate bug: a curve gentle enough for earned income to complete a roster in 6 months is also gentle enough for banked wealth to buy a real chunk of it on day one.

| Banked Gold | One-day splurge (Champions/Artifacts ladder) | % of the 317,000-pull roster |
|---|---|---|
| 1B | 758 Seals | 0.2% |
| 10B | 2,971 Seals | 0.9% |
| 100B | 6,091 Seals | 1.9% |
| 1T | 9,364 Seals | 3.0% |

Spreading a static balance across multiple daily resets doesn't meaningfully extend this — the within-day escalation still consumes nearly all of a large one-time balance on its first day, leaving little for subsequent days. So the ceiling holds at roughly 3% of a roster even for an absurdly large one-time Gold injection (e.g. a cross-game platform veteran's existing balance) — a real, bigger head start than the old ladder's ~16-seal splurge, but nowhere near a skipped game.

**Explicitly accepted, not mitigated.** The alternative — decoupling the price curve from a calendar-elapsed-time lifetime cap instead of a resettable daily one, so no amount of banked wealth can ever exceed what elapsed calendar time allows — was considered and would close this gap entirely while still hitting the 6-month target for earned income. It's noted here as the fallback if the splurge ever proves to feel bad in practice, but the simpler daily-reset ladder above is what's locked.

Three further properties preserved from the original design:

- **Still the Gold sink, and a stronger one.** A player pursuing completion burns effectively their entire income for months — this closes the "Gold only piles up" flag more thoroughly than the original pooled ladder did.
- **Still price-neutral by wealth or progression.** The price at rung `k` is identical for every player regardless of who they are — only *how many rungs deep* today's purchases go varies, and that's driven by today's income, not identity.
- **Platform-native shape, unchanged.** Daily-reset economics already exist elsewhere on polynux (Miner's daily lootbox); implementation is still one counter + date column per gacha, claim-then-reward like everything else — now three counters instead of one.

**Interaction with other Seal-earn sources — unchanged, still clean.** The ladder counter tracks only *Gold-purchased* Seals per gacha; the milestone/achievement grants and daily free-Seal grant already locked in `economy-and-currencies.md` §5 are untouched and don't advance or interact with any of the three counters. This matters given Seals are planned to be earnable elsewhere in-game too — any future earn path stays free of the ladder by the same rule: **the ladder is a Gold-conversion throttle, not a Seal-possession throttle.**

Cross-doc edits to `gacha-shared-system.md` §4 and `economy-and-currencies.md` §2/§5: **applied** (see §11).

## 8. Critical Catch #2 — The Gambler's Strike Family Inverts

The Skills doc's ¹-flagged family (Gambler's Strike → Treasure Hunter's Gambit → Fortune's Gambit → King's Ransom) deals damage scaled off banked Gold, flagged there as a future *trivializes-combat* risk needing √/log dampening. **The bounded curve flips the problem to the opposite failure:** Gold now plateaus (~10¹²–10¹³ realistic standing balances) while enemy stats grow `5^prestige` forever — so any damage scaled off Gold, dampened or not, **decays toward zero relevance** at high prestige instead of exploding. The family goes from landmine to dead content.

Proposed redesign preserving the flavor: scale off the Hero's **PWR** (like every other damage skill) **modulated by relative wealth**, e.g. `damage = PWR × abilityMultiplier × wealthFactor(bankedGold / targetGoldPerHour(p))` — "how many hours of income are you sitting on" — bounded modulation (say ×0.5–×2.0) on a stat that does keep pace with enemies. Keeps the gambler fantasy (hoard Gold, hit harder; spend it down, hit softer), works at every prestige, exploits nothing. Adopted in `skills-gacha.md` §4 footnote ¹ — applied.

---

## 9. Calibration — How the Curve Meets the Calendar

The prestige-count column in §3's table is a guess; the calendar column is the commitment. Closing the gap is `scripts/hero-quest-balance.ts`'s first real job:

1. Model expected run duration per prestige tier from the enemy curve, kill-count structure, boss gates, offline caps, and a modeled "typical" collection-growth trajectory → a **prestige→calendar mapping**. **Note (new): Hero level now persists across prestige** (`core-progression-and-prestige.md` §3, revised), so there is no per-prestige relevel grind to model. Later runs resolve materially faster than the original estimate assumed, which pulls every calendar anchor in §3's table earlier. Re-derive rather than carrying those prestige-count guesses forward.
2. Set `GOLD_PRESTIGE_CAP` and fill the `prestigeGoldFactor` table so the modeled player hits ~235M/hr at day ~90 and the 6-month target at day ~180.
3. Re-run after every tuning change to the enemy curve, kill counts, or offline caps — the Gold curve is calibrated *against* those systems, so it drifts when they move. This is why the factor table lives in `constants.ts` next to everything else.
4. Assert in `test/hero-quest/settle.spec.ts`: worst-case Gold/hour (max stack × max Battle Speed × throughput floor) and max offline collect both clear the column ceiling by ≥3 orders of magnitude.

---

## 10. Dial Status — all locked

1. **6-month anchor: 60% of Xeno's perfect-play ceiling (~0.71B/hr realized).** Full-ceiling parity is instead the post-cap crawl's earned milestone (§3).
2. **Plateau: +2%/prestige crawl**, crossing Xeno's full ceiling ~17 prestiges past the cap (~month 10–14, cadence-dependent).
3. **Seal pricing: the daily ladder (§7), split per gacha.** `SEAL_LADDER_GROWTH[champion] = SEAL_LADDER_GROWTH[artifact] = 1.0007`, `SEAL_LADDER_GROWTH[skill] = SEAL_LADDER_GROWTH[gear] = 1.0011`, calibrated so pure Gold-buying completes one gacha's full roster (317k/317k/244k/244k pulls respectively) in ~6 months. The reopened banked-wealth splurge (~3% of a roster max, from an extreme one-time balance) is explicitly accepted rather than mitigated.

## 11. Cross-Doc Edits — **ALL APPLIED**

| Doc | Section | Edit | Status |
|---|---|---|---|
| `tech-architecture.md` | §9.1 | Mark resolved → reference this doc; Void Shards to text/Decimal storage. | ✅ Applied |
| `gacha-shared-system.md` | §4 | Replace flat 1M with the per-gacha daily ladder (now four counters incl. Forge). | ✅ Applied |
| `economy-and-currencies.md` | §2, §5 | Same Seal-price change; Gold sink note updated. | ✅ Applied |
| `skills-gacha.md` | §4 footnote ¹ | Wealth-factor redesign replacing √/log dampening. | ✅ Applied |
| `artifacts-dig-site-gacha.md` / `skills-gacha.md` | Gold-effect entries | Earn-time denomination for flat-Gold bursts. | ✅ Applied |
| `core-progression-and-prestige.md` | §4 | Cite this doc for Gold; Void Shards named. | ✅ Applied |
| `idle-mechanics.md` | §4 | `MIN_SECONDS_PER_KILL` floor added to `secondsPerKill`. | ✅ Applied |

## Implementation Note

Every decision in this doc is locked: Gold decoupled from `enemyMultiplier` onto a capped, table-driven prestige curve calibrated to calendar anchors (Colony-end at 3 months, 60%-of-Xeno at 6, full Xeno ceiling as an earned post-cap crawl milestone ~10–14 months); the `MIN_SECONDS_PER_KILL` throughput floor making Gold/hour bounded by construction; earn-time denomination for all Gold bursts; four independent per-gacha daily-ladder Seal prices calibrated to a ~6-month full-roster-completion target (`SEAL_LADDER_GROWTH[champion/artifact] = 1.0007`, `SEAL_LADDER_GROWTH[skill/gear] = 1.0011`), with the resulting banked-wealth splurge (~3% of a roster max) explicitly accepted (Critical Catch #1); and the Gambler's-family wealth-factor redesign (Critical Catch #2). Everything numeric beyond the growth constants — the factor table values, `GOLD_PRESTIGE_CAP`, `MIN_SECONDS_PER_KILL`, burst minute-values, and the growth constants themselves — remains a balance-script-calibrated starting point per project convention (§9). Cross-doc edits (§11) have all been applied across the seven affected docs. `SEAL_LADDER_GROWTH[gear] = 1.0011` is now set too (§7), matching Skills' identical 36-item/6-per-rarity roster shape.
