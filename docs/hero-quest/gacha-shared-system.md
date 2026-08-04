# Shared Gacha System (Gear / Champions / Skills / Artifacts)

Status: **Locked** — decisions confirmed, ready to reference for implementation planning. Applies identically to all **4 gachas**, in tab order: **Forge/Gear**, **Guild/Champions**, **Training Grounds/Skills**, **Dig-site/Artifacts**. Each gacha-specific doc should reference this rather than repeat it.

| Gacha | In-game name | Pull currency | Crafting currency | Roster |
|---|---|---|---|---|
| Gear | The Forge | Forge Seals | Gear Essence | 36 (1 per slot per rarity) |
| Champions | Guild | Guild Seals | Champion Essence | 48 (2 per archetype per rarity) |
| Skills | Training Grounds | Skill Seals | Skill Essence | 36 (6 per rarity) |
| Artifacts | Dig-site | Excavation Seals | Artifact Essence | 48 (2 per category per rarity) |

---

## 1. Rarity Tiers

6 tiers, same names and colors across all 4 gachas:

| Rarity | Color |
|---|---|
| Common | Gray |
| Uncommon | Green |
| Rare | Blue |
| Epic | Purple |
| Legendary | Orange |
| Mythic | Red |

---

## 2. Gacha Leveling

Each of the 4 gachas levels up **independently**, 1 through 10, starting at level 1 (Common only, 100%). Every pull performed — single or as part of a 10-pull — counts toward that gacha's current level threshold; hitting it advances to the next level and unlocks/improves higher-rarity odds (Section 3).

```
pullsToLevelUp(1) = 10                                     // unchanged
pullsToLevelUp(L) = roundDown(10 × 2.6^(L-1) × 1.5)         // L = 2..9, rounded to a clean denomination
```

| From level | Raw (×1.5) | Pulls needed |
|---|---|---|
| 1 → 2 | 10 (fixed) | 10 |
| 2 → 3 | 39 | 30 |
| 3 → 4 | 101.4 | 100 |
| 4 → 5 | 264 | 200 |
| 5 → 6 | 685.5 | 600 |
| 6 → 7 | 1,782 | 1,700 |
| 7 → 8 | 4,633.5 | 4,600 |
| 8 → 9 | 12,048 | 12,000 |
| 9 → 10 | 31,324.5 | 31,000 |

**Rounding rule used:** nearest 10 below 100, nearest 100 from 100 up to 10,000, nearest 1,000 above that — flagging this threshold choice since "round down to the nearest 100 or 1000" didn't specify exactly where the switch happens; easy to shift if you had a different cutoff in mind.

Cumulative total to max a single gacha at level 10: **~50,240 pulls** — up from ~33,929, so noticeably higher across the board while keeping the cheap level-1 entry point.

---

## 3. Drop Rate Table (per gacha level)

| Level | Common | Uncommon | Rare | Epic | Legendary | Mythic |
|---|---|---|---|---|---|---|
| 1 | 100.0% | – | – | – | – | – |
| 2 | 75.0% | 25.0% | – | – | – | – |
| 3 | 47.0% | 43.0% | 10.0% | – | – | – |
| 4 | 19.0% | 56.0% | 23.0% | 2.0% | – | – |
| 5 | 18.8% | 32.0% | 37.0% | 12.0% | 0.2% | – |
| 6 | 19.0% | 22.0% | 24.0% | 34.0% | 0.8% | 0.2% |
| 7 | 10.0% | 10.0% | 14.0% | 60.0% | 5.2% | 0.8% |
| 8 | 10.0% | 10.0% | 12.1% | 54.5% | 12.0% | 1.4% |
| 9 | 10.0% | 10.0% | 10.0% | 49.0% | 18.8% | 2.2% |
| 10 | 10.0% | 10.0% | 10.0% | 42.0% | 25.0% | 3.0% |

**Design intent (as given):** Common/Uncommon trade off dominance early, Rare and Epic climb through the mid-levels with Epic spiking hard around level 7 (60%), then Common/Uncommon/Rare settle into a 10% floor each from level 7 on while Legendary and Mythic keep eating share out of Epic all the way to level 10.

---

## 4. Currency & Pull Cost

Each gacha has its own dedicated pull currency — **Forge Seals**, **Guild Seals**, **Skill Seals**, **Excavation Seals** (see the table in the status header).

- **Single pull:** 1 currency → counts as 1 toward gacha leveling.
- **10-pull:** 9 currency (10% discount) → still counts as **10** toward gacha leveling. Leveling tracks pulls granted, not currency spent.
- **Extra currency purchase — Gold price follows a daily escalating ladder, independent per gacha.** The first extra unit of a gacha's own pull currency purchased with Gold *that day* costs 1,000,000 Gold; each subsequent one *of that same gacha* purchased that day costs more than the last (growth rate calibrated per gacha — see `gold-economy.md` §7). The counter resets daily, and **Forge Seals, Guild Seals, Skill Seals, and Excavation Seals each track their own independent daily counter** — buying extra Champion pulls today doesn't affect the price of Skill or Artifact pulls today. Calibrated so a player dedicating their full Gold income to one gacha can fully complete that gacha's roster (every item maxed) in roughly 6 months — full mechanics, the derivation, and the concrete growth-rate numbers are in `gold-economy.md` §7 (Locked). Milestone/achievement grants and the separate daily free-currency grant (`economy-and-currencies.md` §5) are untouched by this ladder — it only prices additional Gold-bought currency on top of what's earned for free.

---

## 5. No Pity — Duplicates Are Never Wasted

None of the 4 gachas use a pity counter. Every duplicate has a use (Section 6), so there's no need for a safety-net mechanic that force-grants a rarity after N pulls.

---

## 6. Duplicates: Leveling, Star-Ups & Crafting

**Leveling an owned item (champion / skill / artifact) with duplicates:**

```
dupesToLevelUp(x, y) = round(min((x × 10 + y) × 1.618, 20))     // 1.618 ≈ golden ratio (1+√5)/2
```
where `x` is the item's current star rating (**0–5, every item starts at 0★**) and `y` is its current level within that star (1–10, resets to 1 each star-up).

**Star-up:** every 10 levels, the item stars up (★) and level resets to 1. **5 stars at level 10 = maxed** (cap unchanged — starting at 0★ just adds one more full star's worth of leveling before that cap).

| Star (x) | Level (y) | Dupes needed |
|---|---|---|
| 0 | 1 | 2 |
| 0 | 2 | 3 |
| 0 | 3 | 5 |
| 0 | 4 | 6 |
| 0 | 5 | 8 |
| 0 | 6 | 10 |
| 0 | 7 | 11 |
| 0 | 8 | 13 |
| 0 | 9 | 15 |
| 0 | 10 | 16 |
| 1 | 1 | 18 |
| 1 | 2 | 19 |
| 1 | 3–10 | 20 (capped) |
| 2 | 1–10 | 20 (capped) |
| 3 | 1–10 | 20 (capped) |
| 4 | 1–10 | 20 (capped) |
| 5 | 1–9 | 20 (capped) |

The cap still binds fast once 1★ is reached — only 1★ level 1 and level 2 fall under 20; everything else for the rest of the item's life is a flat 20. Total to fully max one item from scratch (0★ → 5★ Lv10): **1,066 dupes**.

**Crafting** is the official name for spending banked upgrade currency to directly obtain a specific chosen item at a chosen rarity — a full RNG bypass. Once an item is maxed (5★/Lv10), further duplicates of it auto-convert into a gacha-specific crafting currency instead of being wasted.

**Naming convention:** every crafting currency is named **`<Gacha Name> Essence`** — **Gear Essence** (Forge), **Champion Essence** (Guild), **Skill Essence** (Training Grounds), **Artifact Essence** (Dig-site). Keeps all four crafting currencies instantly recognizable as the same mechanic across gachas, distinct from each gacha's own pull currency (the Seals), which doesn't follow this pattern.

Both conversion value and crafting cost scale **×5 per rarity tier**, per your Common/Uncommon numbers extrapolated straight through:

| Rarity | Value per dupe | Cost to craft |
|---|---|---|
| Common | 1 | 5 |
| Uncommon | 5 | 25 |
| Rare | 25 | 125 |
| Epic | 125 | 625 |
| Legendary | 625 | 3,125 |
| Mythic | 3,125 | 15,625 |

Clean pattern: crafting cost for a rarity is always exactly 5× that same rarity's own dupe value, and each tier's dupe value is 5× the tier below it. At 1 currency per common dupe, that's 15,625 common duplicates to hand-craft a single Mythic from common fodder alone.

All numeric tables above are starting points, same tuning-via-playtest spirit as the enemy curve and prestige-currency formulas in the progression doc.
