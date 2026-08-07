# Cross-Game Gold-Per-Hour Balance Analysis

Built to price a new game fairly against the existing economy. Covers every idle and active
progression game on the platform, plus Bank as a passive reference floor. Casino-style instant
games (Blackjack, the generic `GAMES_REGISTRY` slot/table games) are **excluded** — they're
flat-RTP bet games with a built-in house edge and no progression curve, so they aren't comparable
to a new progression-based game.

Games covered, classified by engagement model:

| Game | Model | What "playing" means |
|---|---|---|
| Hack Ops | Idle | Dispatch agents on a timed op, collect later — no real-time engagement during the op |
| Colony | Idle | Bugs forage automatically over wall-clock time; player periodically collects/sells |
| Miner | Idle | Rig/factory accrue at a fixed rate, capped by vault/factory size; player periodically collects |
| Xeno | Idle accrual, active cashout | Plants grow on real-time timers; harvesting/selling/breeding are manual actions |
| Shapezz | Active | Real-time survival arena run, played live, cashed out or died |
| Pirates | Active | Real-time ship-combat voyage, played live, timed out or sunk |
| Bank | Passive (reference only) | Not a game — parking existing cash for daily interest |

**Methodology note:** every number below is a *sustainable, reasonably-played* rate at a given
milestone (continuous idle collection with no overflow loss for idle games; a realistic
clear/damage profile for active games), sourced directly from the game's own formulas — not a
theoretical best-case unless explicitly labeled "optimized" or "max." Exact source files/lines are
cited in each section for verification.

---

## Headline finding: the games are not on a shared economy scale

Comparing the same progression label ("Beginner," "End") across games shows differences of **several
orders of magnitude**, in both directions:

| Stage | Hack Ops | Colony | Miner (+lootbox) | Xeno | Shapezz | Pirates (safe clear) |
|---|---|---|---|---|---|---|
| Beginner | ~425–675/hr | ~16,400/hr | ~12/hr | ~690/hr | ~2,500/hr | ~180,000–778,000/hr |
| End | ~90,900/hr (base) | ~235,600,000/hr | ~381,300/hr | ~1,182,000,000/hr | ~710,000/hr | ~10,300,000/hr |

At the **same** "Beginner" label, Pirates pays out roughly **65,000× more per hour than Miner**. At
"End," Xeno pays roughly **13,000× more than Hack Ops** and **1,660× more than Shapezz**. This is not
a bug — each game's upgrade/unlock *costs* are scaled to match its own income (Miner's cheapest
rig upgrade is $250; Xeno's cheapest grid slot is 2,500 gold; Pirates' cheapest cannon upgrade is
$42,000), so a game's raw gold/hour number only makes sense **relative to its own cost ladder**, never
compared directly against another game's raw number.

**Practical implication for pricing a new game:** don't anchor to any single game's absolute
gold/hour. Instead, decide which existing game your new game most resembles in feel (idle vs.
active, session length, risk profile), match *that* game's raw scale as a starting point, and then
sanity-check using the normalized "hours to next upgrade" pacing metric in the final section — that
metric is comparable across games regardless of absolute currency scale.

---

## Hack Ops (idle)

Source: `shared/utils/hack-config.ts` (`OP_TEMPLATES`, `effectiveCashRange`), see also
`docs/hack-ops-gem-farming.md` for the full mechanics writeup. Rates below are **base rates**: one
op template run continuously back-to-back with a bare minimum-viable squad, no loot%/level%
bonus applied (`mult = 1`), at the op's listed base duration (no speed investment). This is a
conservative floor, not an optimized rate.

| Stage | Ops in this band | Base gold/hour range |
|---|---|---|
| Beginner | Port Scan, Wi-Fi Crack | 425 – 675 |
| Early | Phishing Run, Corporate Breach | 717 – 850 |
| Early-mid | Bank Skim, Ransomware Drop, Dark Web, Crypto Heist | 980 – 2,764 |
| Mid | Telecom Tap, Supply Chain, Military Intel | 3,111 – 6,364 |
| Mid-late | Government Heist, AI Model Theft | 9,333 – 11,107 |
| Late | Central Bank Tap, Black Site Raid | 20,000 – 27,778 |
| Late-end | NSA Breach, Ghost Protocol | 35,000 – 48,929 |
| End | Quantum Heist, Project Zero | 59,722 – 90,909 |

**Optimization headroom:** a squad with maxed loot%/level bonuses (`effectiveCashRange` multiplier,
up to roughly ×1.3–1.5), full speed investment (duration floored at 7% of base per
`MAX_TOTAL_SPEED = 0.93`), and running multiple squads in parallel across the 6-slot roster can
push realized gold/hour several-fold above the base numbers above — see the speed/floor mechanics
already derived in `docs/hack-ops-gem-farming.md`. There is **no gem-based cash-timer rush** in Hack
Ops — gems there are spent on gear rerolling/leveling and agent artifacts, not on skipping op
duration.

---

## Colony (idle)

Source: `shared/utils/colony.ts`, `server/utils/colony.ts` (`settleColony`), verified with the
repo's own `scripts/colony-income.ts`. Fully idle, unlimited offline accrual (no elapsed-time clamp),
gated only by nutrition tank size and terrarium capacity. Production banks as unclaimed loot until
manually collected and sold at a fixed price (no market fluctuation).

| Stage | Habitat level | Capacity | Best species | Net gold/hour |
|---|---|---|---|---|
| Beginner | 1 | 6 | Grub | ~16,400 |
| Early-mid | 2 | 10 | Beetle | ~288,000 |
| Mid | 4 | 20 | Scorpion | ~27,400,000 |
| Late | 5 | 26 | Ember Roach | ~134,000,000 |
| End (reachable) | 5 | 36 | Ember Roach | ~235,600,000 |

Only 5 real progression gates exist in the code (Early, Mid-late, and Late-end are not distinctly
gated — they fall smoothly between the rows above). **Colony is explicitly late-game content**: its
own config comment states it's meant to be started with ~100–200K coins already banked from other
games, which explains why even its "Beginner" rate (16.4K/hr) dwarfs Hack Ops' or Xeno's beginner
rates outright.

**Bug found during this research:** Habitat Level 6 (Hive Empress, Tier 6 species) is **mathematically
unreachable** under legitimate play — its `yield_boost` track requirement (level 14) exceeds that
track's own max level (12). Practical endgame currently caps at Habitat 5, not 6. Worth fixing
separately from this pricing exercise, but flagged here since it affects where Colony's "true"
end-game ceiling sits (a hypothetical fixed Habitat 6 would reach ~679,000,000/hr).

**Gem mechanic:** gem-bought nutrition (`feedCost` via gems) grants a colony-wide +1 yield level and
+20% speed while active. Value is **inverted** from a typical rush purchase — worth +142.9% gold/hr
to a brand-new colony but only +3.0% to a maxed one, because maxed colonies already sit at the
speed cap (`MAX_TOTAL_SPEED_PCT = 85`) so the buff's speed component does nothing there.

---

## Miner (idle)

Source: `shared/utils/miner-config.ts`. Purely idle, hard-capped accrual (`rate × elapsed`, capped
at vault/factory size) — requires periodic collection at least every ~2 days (cash) to avoid
overflow loss.

| Level | Rig-only gold/hour | + free daily lootbox | Days'-cost of next-level upgrade (payback) |
|---|---|---|---|
| L1 (Beginner) | 6.25 | 12.43 | ~1.7 days |
| L10 (Early) | 16.00 | 31.79 | — |
| L25 (Early-mid) | 76.50 | 152.10 | — |
| L40 (Mid) | 365.96 | 727.55 | — |
| L55 (Mid-late) | 1,751.9 | 3,482.4 | — |
| L70 (Late) | 8,383.75 | 16,667.7 | — |
| L85 (Late-end) | 40,103.75 | 79,726.6 | — |
| L100 (End) | 191,802.79 | 381,341.47 | ~4.5 days |

Both rig income and vault cap grow at the same 1.11×/level rate, so the safe collection window
holds at a clean **2.00 days** at every level as long as rig and vault levels are kept in lockstep.
Upgrade cost grows faster (1.125×/level) than income (1.11×/level), so the payback period on the
*next* upgrade stretches from ~1.7 days at L1 to ~4.5 days at L75 — a textbook diminishing-returns
idle curve.

**Free lootbox is the single biggest lever here:** it's a zero-cost daily action worth ~98.8% of a
full day's rig income (verified level-invariant, `EV ≈ 0.4941 × vault cap` at every level), so a
player who claims it daily nearly **doubles** effective gold/hour at every stage — don't compare
against the "rig only" column alone when benchmarking a new game.

**Gem mechanics:** Overclock (max level, 700 gems total) gives +20% to rig income and lootbox cash.
Catalyst (701 gems total) gives +80% gem-factory rate. Neither is a "buy time" rush — they're
permanent rate multipliers, similar in spirit to a game's own upgrade tree, just gem-priced instead
of cash-priced.

---

## Xeno (idle accrual, active cashout)

Source: `shared/utils/xeno/{plants,tiers,upgrades,costs,artifacts}.ts`, cross-checked against the
repo's own `scripts/xeno-income.ts`. Growth timers run continuously in real time regardless of
online status; harvesting, replanting, and selling are manual actions with a fixed (non-fluctuating)
sell price per plant. Short-cycle early plants (3–6 min) need near-constant check-ins to hit their
theoretical rate; late plants (10h–3 days) barely lose anything to infrequent play.

| Stage | Plant tier / setup | Grid slots | Sustained gold/hour |
|---|---|---|---|
| Beginner | Sprout + Tendril, no upgrades | 6 (free) | ~690 |
| Early | T1 fully bred, Speed Rune crafted | 10 | ~3,230 |
| Mid | T5 (Voidweave), Harvest Prism III | 20 | ~115,500 |
| Late | T7 (Starcore / Singularity), Harvest Prism IV | 30 | ~1,810,000 – 4,570,000 |
| End | T9 (Omega Core), all upgrades maxed, gem-crafted Harvest Prism V | 36 (all) | ~1,182,000,000 |

Figures above are continuous, zero-downtime, perfect-play rates (same methodology as the repo's
own income script) — a ceiling, not an average realized rate, especially at the low tiers where
cycle time is shorter than a realistic check-in interval. Only 5 clean milestones map onto the game's
9 plant tiers; intermediate stages fall smoothly between rows and aren't separately gated.

**Gem mechanic:** gem-crafting the best grid artifact (Harvest Prism to level 5) costs just 5 gems
one-time and is responsible for roughly a **3.3×** jump in the T9 end-game rate (from the
"all-upgrades-maxed" row to the "max build" row above) — an outsized return for a small, one-time
gem spend, worth noting if your new game's gem sinks are meant to feel proportionate.

---

## Shapezz (active)

Source: `shared/utils/gamelogic/shapezz.ts`, `server/utils/shapezz.ts`. Real-time survival run;
payout is only credited on a **voluntary cashout** after surviving ≥45s — dying pays zero, but the
2-hour arena cooldown applies either way (win or lose). This makes cashout discipline the single
biggest lever on realized gold/hour, more than raw upgrade investment.

| Stage | Build | Difficulty | Est. gold/run | Cycle (incl. 2h cooldown) | Est. gold/hour |
|---|---|---|---|---|---|
| Beginner | All upgrades 0, common weapon | Spark/Surge | 3,000 – 8,000 | ~2.03h | ~2,500 |
| Early | ~3 in each upgrade, rare weapon | Surge/Overdrive | 30,000 – 80,000 | ~2.05h | ~27,000 |
| Mid | ~10 in each upgrade, epic weapon | Overdrive/Mayhem | 400,000 – 900,000 | ~2.08h | ~310,000 |
| End | All upgrades maxed (level 20/4), mythic weapon | Annihilation | 1,000,000 – 2,500,000+ | ~2.12h | ~710,000 |

Only 4 clean milestones — the underlying formulas are continuous, and the server-side anti-cheat
payout ceiling (`shapezzMaxPayoutForRun`, scales with survival checkpoints² × difficulty) is a cap
on any single run, not a guaranteed payout; the dev's own code comment states honest play only
"brushes against it on excellent runs," so treat the "est. gold/run" figures as central estimates,
not hard numbers.

**Gem mechanic:** the 2-hour cooldown can be fully rushed for 12 gems flat
(`SHAPEZZ_COOLDOWN_RUSH_MS_PER_GEM`), which — if spent every cycle — turns the effective hourly
rate into roughly `payout / run duration` instead, a **60–90× jump**, at a real, recurring
gem cost that should be priced against Gem Exchange rates before treating it as "free" income
acceleration.

**Note on "Head Start":** a pre-run gem-purchase feature (2 gems to pick one free run-upgrade
before the timer starts) exists on the `shapezz/add-start-upgrade-buy` branch but **is not merged
into `main`** as of this analysis — the numbers above reflect the live game only.

---

## Pirates (active)

Source: `shared/utils/gamelogic/pirates.ts`, `server/utils/pirates.ts`. Real-time ship-combat voyage,
6-minute run length. Coin payout is a back-loaded formula (heavily punishes "start big, die
immediately" abuse) clamped server-side to an anti-cheat ceiling, plus a completion bonus for
surviving the full 6 minutes. **The dominant lever on realized gold/hour is the hull-repair
cooldown, not the coin formula** — repair time scales with how much damage you took (0 to 2 hours),
and a new voyage can't start until it's cleared (or gem-rushed at 1 gem per 10 minutes of remaining
repair).

| Stage | Power | Difficulty | Payout (clean 6-min clear) | Damage scenario | Cycle | Gold/hour |
|---|---|---|---|---|---|---|
| Beginner | 40 | 0 | 233,472 | 10% dmg (cautious) | 18 min | ~778,000 |
| Beginner | 40 | 0 | 233,472 | 60% dmg (risky) | 78 min | ~180,000 |
| Early | ~74 | 100 | 933,888 | 30% dmg | 42 min | ~1,334,000 |
| Mid | ~200 | 400 | 3,035,136 | 30% dmg | 42 min | ~4,336,000 |
| End | ~1,097 | 1000 | 7,237,632 | 30% dmg | 42 min | ~10,339,000 |
| End | ~1,097 | 1000 | 7,237,632 | 70% dmg (more realistic at max difficulty) | 90 min | ~4,825,000 |

**Design tension worth flagging:** difficulty 1000 scales enemy stats against a *fixed* baseline
constant, not the player's actual power — it's deliberately "aspirational," dangerous even for a
maxed ship. An end-game player who instead farms a difficulty they can reliably no-damage clear
(rather than pushing the hardest tier) may sustain a **higher** gold/hour than one grinding max
difficulty with frequent high-damage repairs, because repair downtime dominates the hourly math
more than the marginal payout from higher difficulty. If your new game has a similar risk/reward
knob, this is a useful cautionary precedent — "harder = better gold/hour" isn't automatically true
once a repair/cooldown tax is in the loop.

---

## Bank (passive reference floor, not a game)

Source: `shared/utils/gamelogic/bank.ts`. Daily compounding interest, 2% at zero balance rising on an
exponential curve to 4% at the 1B cap (`BANK_CAP`). No play required at all — useful as a "what does
doing nothing get you" floor to compare any new game's idle rate against.

| Balance parked | Daily rate | Gold/hour (passive) |
|---|---|---|
| $1,000 | 2.00% | ~0.83 |
| $1,000,000 | 2.01% | ~837 |
| $10,000,000 | 2.08% | ~8,666 |
| $100,000,000 | 2.67% | ~111,317 |
| $500,000,000 | 3.76% | ~783,667 |
| $1,000,000,000 (cap) | 4.00% | ~1,666,667 |

A new game's early-game rate should comfortably beat parking the same capital in the bank, or
there's no reason to play it over just saving; its end-game rate should clear the $1B bank cap's
~1.67M/hr by a healthy margin to still feel worth active engagement over passive parking.

---

## Overall average per global stage

A straight average across **all six games** at each stage, for a single reference number per stage.
**Bank is excluded** (it's a passive reference floor, not a game). To keep every row a genuine
all-six-games comparison, this section collapses down to the five stages every game can be made to
support — **Early-mid, Mid-late, and Late-end are dropped here only** (they remain in each game's
own table above); Beginner/Early/Mid/Late/End cover the full curve well enough on their own.

Where a game gave a range or two damage scenarios for a stage, the midpoint is used. Where a game
doesn't define an exact milestone at one of these five labels, the closest matching figure is used
instead, so every row stays a fair six-way comparison:

- **Colony's "Early"** reuses its Early-mid milestone (Habitat 2, Beetle) — Colony has no distinct
  plain-"Early" gate, and Early-mid is the closest one it actually defines.
- **Shapezz's and Pirates' "Late"** are geometric-interpolated (log-space midpoint) between each
  game's own Mid and End figures, since neither defines a distinct Late-tier milestone between
  those two.
- Hack Ops, Miner, and Xeno already define all five labels directly — no estimation needed for
  those three.

Because the underlying values span 4-5 orders of magnitude (per the headline finding), a plain
arithmetic mean is dominated by whichever huge-scale game reports a number at that stage. The
**geometric mean** is included alongside it as the more representative "typical" figure — it's the
standard central-tendency measure for data that varies multiplicatively rather than additively (the
same reason you'd geometric-mean a set of growth rates rather than arithmetic-mean them).

| Stage | Arithmetic mean gold/hour | Geometric mean gold/hour |
|---|---|---|
| Beginner | ~83,190 | ~2,130 |
| Early | ~275,510 | ~9,700 |
| Mid | ~5,361,160 | ~156,500 |
| Late | ~23,905,590 | ~878,000 |
| End | ~237,724,780 | ~5,919,000 |

All six games are represented in every row now, so — unlike the earlier draft of this table — both
columns climb smoothly and monotonically from Beginner to End with no sampling artifacts to
correct for. The geometric mean is the more trustworthy "typical stage anchor" of the two; the
arithmetic mean is included for completeness but remember it's pulled hard toward whichever of
Colony/Xeno/Pirates has the largest number in that row. The **per-game tables above** remain the
source of truth for any individual game's own progression curve — this table is only a first-pass
"does my new game's number feel roughly in the right neighborhood for this stage" anchor.

---

## Normalized pacing: hours to afford your next upgrade

Because raw gold/hour scales are arbitrary per game (see headline finding), the metric that
actually transfers across games is **how long, at your current income, it takes to afford your next
meaningful upgrade** — this is a feel/pacing question, not a currency-scale question.

| Game | Early-game payback | Late/end-game payback |
|---|---|---|
| Miner | ~1.7 days (next rig level, L1) | ~4.5 days (next rig level, L75) |
| Colony | Builder critical path (habitat 1→5) documented at 60–90 days total (`test/colony/balance.spec.ts`) | — |
| Xeno | ~13.6 hours (next grid-slot batch, early tier) | ~1.4–3.5 hours (next grid-slot batch, late tier) |
| Hack Ops | Power-gated, not cost-gated — progression is "can I survive this op," not "can I afford this" | — |
| Shapezz | Upgrade costs are continuous (no discrete gate); full max-out from Shapezz income alone is ~7,500 hours (~300+ days) of continuous 2h cycles — an aspirational/whale target, not a normal grind path | — |
| Pirates | Full stat+cannon+slot max-out ≈ 316,000,000 coins — at the "Mid" stage's ~4.3M/hr, that's ~73 hours of farming | — |

Use this table, not the raw gold/hour tables, as the primary cross-game sanity check: if your new
game's "next upgrade" feels affordable in a few hours early on and stretches to multiple days by
end-game, it's pacing similarly to the platform's existing idle games regardless of what raw
currency numbers it uses.

## Recommendations for pricing a new game

1. **Pick a reference game by feel, not by number.** If the new game is idle with periodic
   collection, anchor its raw scale near Miner or Colony depending on session length; if it's a
   real-time active run with a cooldown/repair mechanic, anchor near Shapezz or Pirates.
2. **Design the payback curve, not the absolute numbers.** Target something like "next upgrade
   affordable in hours early on, days by late-game" (matching Miner/Xeno/Pirates above) rather than
   trying to match any specific gold/hour figure — the platform's own games don't agree with each
   other on absolute scale, only on this pacing shape.
3. **Decide up front whether gems buy convenience or power.** Miner/Shapezz/Pirates/Colony all use
   gems as either a flat-rate multiplier (Miner Overclock/Catalyst) or a time-skip (Shapezz/Pirates
   cooldown rush), never as the primary income source. Xeno's artifact gem-craft is the one outlier
   with an outsized (3.3×) return for a tiny (5 gem) spend — worth avoiding that specific pattern
   unless deliberate.
4. **If the new game has a risk/cooldown mechanic, model the downtime explicitly**, the way Pirates'
   repair timer and Shapezz's arena cooldown do — as shown above, that downtime (not the headline
   payout number) usually ends up being the dominant term in realized gold/hour.
5. **Compare against the Bank floor at every stage.** Early-game rate should clearly beat parking
   equivalent capital at 2%/day; end-game rate should clear the ~$1.67M/hr cap-balance yield by a
   comfortable margin, or the game stops being worth active engagement over passive saving.
