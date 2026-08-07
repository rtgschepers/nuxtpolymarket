# Colony — Best Bug Setup per Habitat Level

Analysis of which bugs to place in the terrarium at each Habitat Level, assuming
every upgrade track sits at the **minimum level required to have just reached**
that Habitat Level (per `HABITAT_TRACK_REQUIREMENTS` in `shared/utils/colony.ts`).

## Methodology

- Income is **net of feeding cost**: `coinsPerHour − feedPerHour × FEED_COST_PER_POINT(5)`.
- Average rolls are used throughout: speed 12.5% (midpoint of the 0-25% base
  roll), yield 1.5 (midpoint of the 1-2 base range), eat = midpoint of the
  species' `[eatMin, eatMax]`. Species Research (a separate, per-species coin
  sink) is left at level 0 — it's orthogonal to Habitat progression.
- The allocation isn't just "pick the single best species" — social bugs get
  *cheaper* per additional same-species neighbor (capped at +45% speed, reached
  by a group of ~4), while solitary bugs get *worse* the more of their own kind
  you add (down to a 0.4× floor at high crowding). So each setup below comes
  from solving the actual allocation problem (a small knapsack/DP over species
  × count), not just eyeballing tier value.
- **Habitat 6 is currently unreachable** through legitimate play — the 5→6
  step demands Foraging Yield level 14, but that track's own cap is 12 (see
  `docs/game-economy-gold-per-hour.md`). The Habitat 6 row below clamps to the
  track's actual max (12) as a best-case hypothetical.

## Section 1 — Pure income-maximizing setup

No constraint other than the terrarium's slot count. This is the setup to run
once you've already stockpiled what you need and just want maximum coins/hr.

| Habitat | Capacity | Track levels (cap/yield/spd/nutS/nutE) | Optimal setup | Net income | Spawn cost |
|---|---|---|---|---|---|
| 1 | 6 | 0/0/0/0/0 | 5× Larva + 1× Grub | ~13,200 coins/hr | ~780K |
| 2 | 10 | 2/2/1/3/1 | 10× Beetle (monoculture) | ~288,000 coins/hr | ~6.5M |
| 3 | 14 | 4/4/3/5/3 | 14× Ant (monoculture) | ~5.46M coins/hr | ~44.8M |
| 4 | 20 | 7/7/4/8/4 | 16× Ant + 2× Scorpion + 2× Spider | ~13.5M coins/hr | ~83.2M |
| 5 | 26 | 10/10/6/11/6 | 26× Ember Roach (monoculture) | ~121.2M coins/hr | ~650M |
| 6* | 34 | 14/12/8/15/8 | 34× Hive Empress (monoculture) | ~476.8M coins/hr | ~2.72B |

### Why these setups win

- **H1 (5 Larva + 1 Grub):** Grub (solitary) is excellent *alone* (+45% speed
  bonus, high sell value) but craters if crowded with itself. One Grub soaks
  that bonus; the other 5 slots go to Larva, whose social group bonus caps out
  at just 4 peers, so 5 of them all sit at the max +45% together.
- **H2/H3 (pure Beetle / pure Ant):** at these capacities the top social bug's
  per-slot rate, once its bonus is capped (needs only ~4 in a group), already
  beats every solitary alternative even at *solo* rates — no benefit to holding
  back slots for anything else.
- **H4 (16 Ant + 2 Scorpion + 2 Spider):** the interesting case. Scorpion/Spider
  are solitary and normally you'd want just 1 each — but even a *2nd* Scorpion
  (dropping from +45% to +30% bonus) still nets far more per slot than an Ant,
  so it's worth paying the crowding penalty for a 2nd copy before switching to
  Ant filler. A 3rd Scorpion is where crowding finally drags it below Ant's
  rate, so the optimizer stops there.
- **H5/H6 (pure Ember Roach / Hive Empress):** by these tiers the top social
  species so thoroughly outclasses everything else — even fully crowded — that
  mixing in anything lower-tier is a strict loss.

## Section 2 — Keep at least 1 of every unlocked species (materials still flowing)

Upgrade track costs pull items from **every earlier tier**, not just the
current one (`EARLIER_TIER_COST_DECAY` in `shared/utils/colony.ts` — each track
level still wants some Tier 1/2/3... items even at Tier 6). If you go pure
monoculture per Section 1, you stop producing every item below your top
species and stall those upgrade-item requirements. This section forces at
least 1 of every species unlocked at that Habitat Level, then optimizes the
remaining slots the same way as Section 1.

| Habitat | Capacity | Species unlocked | Setup (forced 1 each + optimized remainder) | Net income |
|---|---|---|---|---|
| 1 | 6 | 2 | 5× Larva, 1× Grub | ~13,200 coins/hr |
| 2 | 10 | 4 | 7× Beetle, 1× Larva, 1× Grub, 1× Ladybug | ~236,500 coins/hr |
| 3 | 14 | 7 | 8× Ant, 1× Larva, 1× Grub, 1× Beetle, 1× Ladybug, 1× Cricket, 1× Gem Snail | ~3.33M coins/hr |
| 4 | 20 | 9 | 10× Ant, 2× Spider, 2× Scorpion, 1× Larva, 1× Grub, 1× Beetle, 1× Ladybug, 1× Cricket, 1× Gem Snail | ~10.34M coins/hr |
| 5 | 26 | 10 | 17× Ember Roach, 1× each of Larva/Grub/Beetle/Ladybug/Cricket/Ant/Gem Snail/Spider/Scorpion | ~83.50M coins/hr |
| 6* | 34 | 11 | 24× Hive Empress, 1× each of Larva/Grub/Beetle/Ladybug/Cricket/Ant/Gem Snail/Spider/Scorpion/Ember Roach | ~346.9M coins/hr |

Notes on this section:
- **H1 is identical to Section 1** — the income-max setup already happened to
  use one of each unlocked species, so there's no tradeoff yet.
- From H2 onward there's a real cost to material-flow diversity: e.g. H5 drops
  from ~121.2M/hr (pure Ember Roach) to ~83.5M/hr (~31% less) once 9 slots are
  reserved for 1-each of every lower species. That gap only widens with
  Habitat Level, since the top species' per-slot value pulls further and
  further ahead of everything below it.
- **Gem Snail** (unlocked at H3) produces **gems, not coins/items** — its
  forced slot doesn't help gather upgrade materials at all (it has no
  `itemId`). It's still worth keeping exactly one once unlocked (never a 2nd —
  it's solitary and crowds badly) because Habitat level-ups are gated on gems
  (20 → 1000 gems across the 5 steps) as much as coins. With only the *minimum*
  tracks required for Habitat 4 (yield_boost 7, speed_boost 4), a Gem Snail
  already reaches `effectiveGemsPerDay`'s hard cap of 3 gems/24h — further
  Foraging Yield/Speed investment beyond that point does nothing more for it.
- Practical reading: keep 1 of each species just long enough to bank the item
  quantities the next track level needs, then reclaim those slots for the
  Section 1 monoculture once your stockpile is comfortable — don't run the
  diversified setup indefinitely once material needs are met.
