# Hero Quest — Art Style & Generation Guide

How Hero Quest's art is made and what it must look like. `asset-list.md` and `asset-checklist.md` say **what** to draw; this doc says **how**. Written 2026-09-24 at the end of restyle rounds 2 and 3 (commit `4614af8a` on `hero-quest-art`), so work can pick up on another machine.

---

## 1. Ground rules

- **All art is procedural code.** Drawers in `app/utils/hero-quest-art/`, registered in `catalog.ts`. No PixelLab, no image generation, no hand-painted PNGs. The PixelLab class portraits in `public/hero-quest/classes/` are inspiration only.
- **One hero.** Every class is the same Beginner rookie, re-outfitted: messy brown hair, young face, a plaster on his cheek. Headgear, outfit, weapon and pose change per class; the face never does. Tier shows in the gear: base classes are novices in hand-me-downs, elites are specialised, masters are unmistakable.
- **Indexed pixels only.** A `Surface` stores palette indices, never colours. There is no alpha: fades are Bayer dither (`dither`, `ditherDisc`, `StampStyle.dissolve`) and dims or tints are palette remaps (`shadeLut`).
- **10 fps stepped animation** (`ANIM_FPS`). Clips are keyframes over the `HP` pose parameters, sampled on the frame grid.
- **Deterministic.** Layout and particle spread come from `hash2`, never `Math.random`, so an exported strip is identical from run to run. `Math.random` is allowed only in the live stage (`demo.ts`) for cosmetics.
- **The exported PNGs are a rendering, not a source.** `public/hero-quest/sprites/` is produced by `bun run art:hero-quest`. It is currently **stale on purpose**: the palette grew, so regenerating rewrites all ~1,000 tracked files. Regenerate once the restyle rounds are approved.

---

## 2. The reference: what "video style" means

The target look comes from a short reference video: `x-downloader.com_tbSWXD.mp4`, 39 s, 1920×1080 at 60 fps. It is not in the repo, so copy it over separately if you need it. It shows five chibi heroes (ninja, frost wizard, fire witch, priest, knight), each casting a named ultimate at a scarecrow on a night lakeshore. What we take from it:

- **Characters:** chunky, big-headed chibis about 24 px tall, drawn at roughly 7.5× scale. A 1 px near-black outline, 2–3 flat shades per material, one strong accent colour each.
- **Every skill runs the same choreography:**
  1. A gold banner with the skill's name appears at the top.
  2. The scene dims toward the skill's colour.
  3. A glowing rune ring lights up under the caster.
  4. One big effect travels or falls: a meteor from a sky portal, a dragon, a light pillar.
  5. Each impact is a solid blob of energy with a white core, inside a thin white shock ring, with sparks thrown out.
  6. The target flashes to a white silhouette.
  7. Small damage numbers stack in a column, with a big total above them.
  8. Something lingers afterwards: the target keeps burning, embers drift.
- **Scenery:** layered and atmospheric, with big dark pines framing both edges of the screen, a thin grass ledge, and water below it mirroring everything, fighters included.

---

## 3. Workflow: review rounds

The restyle goes in **small rounds**. Convert a sub-selection, let the user review it, then continue. **Commit before each round** so the round can be rolled back.

1. Build the round.
2. Add it to `ART_ROUNDS` in `catalog.ts` (number, label, the ID prefixes it touched). The gallery shows each asset under the round that last changed it.
3. Review at `/hero-quest/art` (dev builds only). It opens on the newest round's chip; older rounds keep their own chips. The **Live stage** at the top plays a real fight: pick a world and a class. It opens on World 1 with the Sorcerer.
4. Review headlessly as you build, since Claude can't see a signed-in browser:
   - `bun run art:hero-quest sheet <out.png> <group> [id-prefix…] --scale 3` renders a contact sheet, one row per asset. Read the PNG.
   - For the live stage, drive `BattleDemo` from a small bun script: `setup(world, classId)`, `update(1/60)` in a loop, then `render()` into `encodeIndexedPng` from `scripts/lib/png.ts`. Overriding `Math.random` to return under 0.3 forces the hero to cast.
5. Before committing: `bun run typecheck`, `bun run test`, and eslint on the touched files.

### Done so far

**The round count restarted on 2026-09-25**, once the chibi style was adopted and every Hero class was on it. `ART_ROUNDS` is empty, so the gallery opens on the first group. **The next round is Round 1.** The table below is the history before the restart. Those round numbers are no longer in the gallery.

| Round | Scope |
|---|---|
| 2 · video style | **Heroes** Beginner, Warrior, Sorcerer, Hunter on the chibi body (5 states each) · their **skills** Haste, Whirlwind, Meteor Shower, Kill Shot as cinematics · **skill banners** · **damage numbers** (hit/crit) · **training dummy** as the video's scarecrow · **World 1 Thornwick Vale** background · live-stage presentation (tint, banner, stacked numbers, water reflection) |
| 3 · scenery tier | Palette split into a character tier and a scenery tier · World 1 moved onto it · specs enforcing the split · palette swatch sheets in the gallery |
| 4 · formation & march | Both sides on the 3 front / 3 back grid, shown as three ranks of two · World 1's field deepened to hold them · a sixth `move` state on every Hero and chassis (`walkClip` / `floatClip` in `rig.ts`, generated from each unit's own rest pose) · the party marches between waves while the scenery parallax-scrolls and the next wave closes in |
| 5 · chibi classes | **The chibi style was adopted** (2026-09-25, after outside opinions: it beat the taller full-body restyle tried on the Sorcerer, which is gone). The other 11 classes rebuilt on the chibi body, and the Sorcerer back on the chibi body, then made more imposing than the Wizard (as the master, he must outclass the elite): he hovers over flame, with the biggest hat in the roster, a dark cape and high collar, and a fire orb circling him. The robe hem now rides `jump`, so floating casters leave the ground. The rest: Barbarian, Berserker, Knight, Paladin, Mage, Wizard, Shaman, Witch Doctor, Archer, Bowman, Marksman, Beast Master. The classic Hero definitions are deleted; the classes now live one file per line |

### After the restart

| Round | Scope |
|---|---|
| 1 · live stage feel | Pixel Crusade's presentation ported to the live stage, scaled for a crowd (§5a): local hit holds, gated scene freezes, shake, flash and slow motion, kill rings, bodies shattering into their own pixels, rim light, afterimages, projectiles, and effects and scenery on a smooth 60 Hz clock. World 1's clouds drift and birds and pollen cross it on the stage only. No asset changed, so it has no gallery chip: review it on the Live stage |
| 2 · close-up camera | Pixel Crusade's item 5, camera half: `CAMERAS` in `demo.ts` crops a 16:9 window of the composed 320×180 scene, and the integer-scale fit shows a smaller window with bigger pixels. **Zoom 1** 320×180, the original (6× on a 1080p screen); **Zoom 2** 224×126 (8×); **Zoom 3** 272×153, between them (7×, **chosen and the default**: closer than the original, with room for a large boss); **Tight** 192×108 (10×, about Pixel Crusade's proportions). The HUD is drawn on the window. No art changed. Switch cameras on the Live stage with the select or live with keys 1–4, fullscreen included |

### Open

- **Zoom 3 is the chosen camera** (2026-09-25): closer than the original while a large boss still fits. The other cameras stay on the Live stage for comparison. Pixel Crusade's other half of item 5, darker scenes behind the fighters, hasn't been tried: World 1's bright afternoon was the user's choice.

- **Everything else is still round-1 art:** all Champions, enemies, bosses and summons, the other 58 VFX, and the other 9 worlds. On the stage the old enemies and Champions look undersized next to the chibi heroes.
- **Only four skills are cinematics.** The other 12 classes cast with a sprite-level effect (aura, bolt, shout, slam, light column), not a `CinematicVfx`. Their skill VFX are still round-1 in `vfx.ts`.
- **The classic skill VFX still exist.** The four cinematic skills override their old `vfx.ts` definitions by ID (`CINEMATIC_BY_ID`). Delete those once every skill is a cinematic.
- **Later worlds blend with their enemies.** The measure in §7, taken 2026-09-24, flags Shattered Sky (93% of the fight band near its enemy colours), The Void (96%), Rimeholt (60%), Sunken Amarath (47%) and Duskspire (20%). Each gets fixed when that world moves onto the scenery tier.
- **Exports are stale** (see §1).

---

## 4. Characters: the chibi body

`chibi.ts` holds the body, `hero-kit.ts` the shared kit (`chibiLook`, `aura` and its colour ramps, `bowAttack`/`loose`, `shout`, `slam`, `lightColumn`, `chibiCape`), and `heroes-warrior.ts`, `heroes-mage.ts` and `heroes-archer.ts` the classes, one file per class line. `heroes.ts` merges them into `HERO_ART` and derives the Move state. A Look opts in with `body: drawChibi`. It rides the same `HP` pose parameters and resolves the same joints (`J`) as the classic rig, so clips, `Look.fx` painters and the VFX layer work unchanged.

**Proportions,** in a 64×64 frame with the feet at y = 58, about 24 px tall:
- Legs 5 px (`CHIBI_LEG`): 3 px columns, 4–5 px boots.
- Torso 10 wide × 8 tall, 7 rows to the hip (`CHIBI_TORSO`). Shoulders at ±3.
- Head about 12 × 11, sitting 1 row into the torso.
- Arms 3 px thick with 3×3 fists. Sleeve colour for the first 60%, then the cuff or skin.
- The outline is added at stamp time (`StampStyle.outline = C.ink`). Never draw it into the sprite.

**Heads are pixel maps** (`head(rows, neckCol, eyeCol)`, keys in `HEAD_KEY`):
- Build a class head as its headgear rows followed by `...face(padL, padR)`. The six face rows are the rookie's face: fringe, eye, nose, plaster.
- Heads are **bottom-aligned**: the eye sits 6 rows and the mouth 3 rows from the bottom in every head, so `chibiHead` can animate them by coordinate (squint on hurt, mouth open, glowing eyes on cast).
- Headgear by class: bare mop (Beginner, Mage, Archer), kettle cap (Warrior), horned iron cap (Barbarian), wild hair under a red bandana (Berserker), plumed bascinet with cheek guards (Knight), winged gold helm (Paladin), tall starred blue hat (Wizard), red hat with the tip folded back (Sorcerer, the video's fire witch), feathered headband (Shaman), horned bone mask pushed up (Witch Doctor), peaked cap with a red feather (Bowman), charcoal wide brim with a white plume (Marksman), fox-eared hood (Hunter), wolf-head hood (Beast Master).
- Wider headgear pads the face with `face(l, r)`, which shifts the neck and eye columns by `l`. Cheek guards and pelts replace the face rows' hair columns by hand (Knight, Beast Master).
- **Keep the face clear.** Weapons draw after the head, so a shouldered great axe or an upright hammer covers the face. Rest them upright in front of the face (Barbarian) or head-down (Paladin). Pauldrons sit at the shoulder row, never above it, or they land on the chin.

**Animation beats:**
- **Idle:** a 1 px bob over 1.2–1.6 s.
- **Attack:** wind-up (Charge), strike (Cast, where the game fires the hit), then Recover. About 0.9 s.
- **Cast:** 1.4–2.0 s. A clear raised pose held while the VFX plays: staff up, sword up, drawn bow.
- **Hit and death:** `hitClip` and `deathClip`.
- Melee uses `crescent()`: a filled arc about 6 px thick, tapering at both ends, with a white outer edge. Never a 1 px arc.
- Casts wear a **flame aura** (`aura()`): tongues rising along both flanks, never over the face, cooling through the skill's colour ramp.
- Keep everything inside the 64 px frame. The facing side has 32 px of room, so projectiles belong in the VFX, not the sprite.

---

## 5. Skill VFX: the cinematic recipe

`vfx-cinematic.ts`. Each effect is a `CinematicVfx`: a normal `VfxDef` plus `cinematic: { hits, tint, spread }`. Effects are drawn in the VL layout (160×88, floor at y = 80, caster at x = 46, foes at x = 104, 124, 144), as pure functions of time.

**The beats, in order:**
1. `casterRing()` from the first frame: two slanted ellipse rings with runes turning between them. It grows in over 0.2 s, holds, and shrinks out, with light rising off it.
2. The main effect, **big and filled**: `meteor()` out of a `skyPortal()`, a `cyclone()`, a beam, a light pillar.
3. Every impact is `blast()`:
   - a white flash disc on the first frame;
   - a `blob()` with a boiling noisy edge, the core cooling out through a 6-step ramp (white → hot → bright → mid → deep → rim), hashed holes eating it away as it ages;
   - a thin white `shockRing()` just outside it;
   - sparks thrown up that fall under gravity.
4. The aftermath lingers: `groundFire()` for a burn, embers, motes.

**Timing and targets:**
- Effects run 1.8–2.6 s.
- `hits` lists the seconds at which each impact lands. The live stage uses them to land damage and stack numbers, so they must match the drawing.
- `spread: true` walks the hits along the enemy line (Meteor Shower). `false` keeps them all on the **front** target, which is where the stage lands single-target damage.
- Match the skill's content definition: Whirlwind reaches the front line only, Kill Shot is a single guaranteed crit, Meteor Shower hits every enemy and leaves a burn, Haste buffs only the caster.

**Stage presentation** (`presentation.ts`, driven by `demo.ts`):
- **Banner:** `drawSkillBanner`. Gold gradient letters in the 5×7 font (bright top, deep base) with an ink outline and a brown drop shadow. Gold rules shoot outward over 0.2 s, and the first frame flashes white.
- **Tint:** `tintLut(tint)`, which is `shadeLut(0.55, tint, 0.2)`, stepped in and out through Bayer dither. Use `dusk0` (plum) for red and fire skills and `night0` for gold buffs. Tinting toward `red0` turns the scene muddy brown.
- **Other units hold** while a hero skill has the stage.
- **Numbers:** hit numbers are held (1.8 s, no float) and stack 7 px apart over each target. After the last hit, a big red total goes on top. Styles are in `NUMBER_STYLES`: hits are outlined gold, crits outlined red.
- The gallery previews each cinematic on `cinematicStage()`: the caster idling and a scarecrow on each enemy mark.

### 5a. The live stage's hit feel (Round 1)

Taken from the pixel-crusade branch (`engine.ts`, `pixel.ts`), whose art isn't sharper (it is 256×144 on the same palette) but presents every hit. Tuned in `JUICE` at the top of `demo.ts`.

- **Two clocks.** Bodies play their held 10 fps frames. Everything that flies (projectiles, particles, VFX, shake) and the scenery move at 60 Hz: the stage sets `clock.smooth` (`vfx-kit.ts`) around its own draw calls, which takes `qt()` off the frame grid. Exports and the gallery never set it, so baked strips still close their loops.
- **Scaled for a crowd.** Twelve bodies trading blows would stutter the scene if every hit froze it. An ordinary hit only holds the striker (melee) and the target for 3 ticks (5 on a crit), and the target jumps straight to its white flash frame and shudders 1 px. The scene-wide freeze is kept for a kill (3 ticks, then no ordinary kill may freeze again for `FREEZE_GAP`), every impact of a Hero skill, the last kill of a wave (plus slow motion) and a boss kill (freeze, 4 px shake, flash, slow motion). Screen shake on a crit is the Hero's alone. Measured over 3 minutes: the stage is frozen about 4% of the time and shaking about 12%.
- **Death shatters.** A body plays its authored stagger and fall, then breaks into 2×2 chunks of its own colours (never its ink outline) at the frame where it would start to dissolve, behind a white-and-gold kill ring.
- **Rim light** in the unit's accent (red for enemies) on the edge facing the foe while winding up and striking. It only lights edges at least 2 px thick, so baked aura flames and sparks don't turn into stripes. **Afterimages**: two checker silhouettes behind a caster for the first 0.25 s of its strike.
- **Projectiles.** Ranged units (the Archer and Mage lines, support and control Champions, staff and bow enemies) loose arrows that fly an arc and bolts that trail particles. The hit lands on arrival; a multi-strike volley looses one arrow per strike, 0.3 s apart.
- **Flash** is a Bayer-dithered overlay, capped at 6/16 coverage: half coverage washed a boss kill out.

---

## 6. Backgrounds

`scenery.ts`. A world is a `WorldScene` (`draw`, and optionally `water`, `glitter`, `tiered`). Canvas 320×180, fighters stand at `FLOOR_Y = 150`.

**Layering, back to front** (World 1 is the model):
1. Sky bands with 4-row dither seams.
2. The sun: a soft dither glow, the disc, a white core.
3. Streak clouds, lit from below, each one band lighter than the sky behind it.
4. Far ridge in atmospheric blue.
5. Nearer hills.
6. Treeline.
7. Landmarks: windmills.
8. Hedgerows.
9. **Framing pines at both edges** (x < 40 and x > 280, clear of the fighters).
10. The grass bank.
11. Water.

**Rules:**
- **The loop must close.** A background is `BG_FRAMES = 16` frames (`BG_LOOP = 1.6 s`). Write motion as the phase `t / BG_LOOP`, with a whole number of cycles per loop: the windmills turn a quarter per loop (4 symmetric sails), waves do one sine cycle, fireflies circle closed paths. Anything that can't close in 1.6 s stays still; that's why the clouds don't drift. Check that frame 16 is pixel-identical to frame 0.
- **Water:** `reflectWater(s, top, t, glitterX)`. It mirrors the scene above the waterline, foreshortened (`REFLECT_SQUASH = 2.2` rows of scene per row of water, so a shallow pond still shows sky), sheared by depth, darkened with a `shadeLut`, and adds ripple streaks and a sun glitter road. Set `water` on the scene and the live stage re-runs it after drawing units, so the fighters reflect too. **The user likes the water. Keep it.**
- **Lighting sells separation.** World 1's sun sits low behind the hedgerows, so they are painted **backlit**: cool dark bodies with a thin warm rim on their sunward tops. That is physically right, and it keeps them darker than the fighters.
- **World 1, Thornwick Vale,** was decided with the user: **late afternoon with a partly blue sky.** Night was rejected, then sunset, in favour of earlier in the day. Blue top warming through salmon to gold at the horizon, clouds lit from below, the sun above the hills, a millpond in front.

---

## 7. Palette: two tiers

`palette.ts`, 102 colours. Index 0 is transparent.

- **Character tier:** everything not in `SCENERY_RAMPS`. Saturated and bright: heroes, Champions, enemies, bosses, effects, UI.
- **Scenery tier:** `SCENERY_RAMPS`, dark → light. Duller and darker than its character-tier cousins, with shadows leaning cool and highlights leaning warm. The ramps are `moss`, `lagoon`, `slate`, `heather`, `rust`, `rock`, `sand`, `ice` (4 steps each), `sky` (3) and `dusk` (4).
- **Adding a colour:** it joins a named ramp, in dark → light order. Never add a one-off. Add new entries at the end of `HEX` so existing indices never change.
- **Remaps** (reflections, tints) come from `shadeLut(mul, tint, amount)`. It snaps to the nearest palette entry, so dark, dull scenery colours give better results than saturated ones.

**The fight-band rule.** A world with `tiered: true` paints the band behind the fighters (the `FIGHT_BAND = 28` rows above the floor) in **scenery colours only**, and at most **5%** of that band may sit within an RGB distance of 40 of its enemy's mid/light skin, pants or arm colours.

Why that shape of rule: "background darker than the enemies" is wrong for near-black enemies (Duskspire, The Void), and a brightness rule would not have caught the original problem. The Bramble Goblins stood in front of hedges painted in their exact greens.

**Specs** (`test/hero-quest/art.spec.ts`):
- Every scenery ramp is ordered dark → light.
- **No character sprite ever uses a scenery colour.**
- Every tiered world satisfies the fight-band rule. The failure names the offending colour and pixel.
- Every `ART_ROUNDS` prefix matches a real asset.

**To move a world onto the tier:** repaint everything in its fight band in scenery ramps, choosing hues away from its enemy, then set `tiered: true`. The spec tells you when it passes. The gallery's **Palette** sheets (`ui/palette/scenery`, `ui/palette/characters`) show both tiers side by side.

---

## 8. File map

| File | What |
|---|---|
| `chibi.ts` | Chibi body, head pixel maps, `crescent()` |
| `hero-kit.ts` | Shared Hero kit: Look defaults, cast aura and ramps, bow clip, shout, slam, light column, cape |
| `heroes-warrior.ts` · `heroes-mage.ts` · `heroes-archer.ts` | The 16 classes, one file per class line |
| `heroes.ts` | `HERO_ART` registry, `HERO_STATES`, the derived `HERO_GAIT` |
| `vfx-cinematic.ts` | The four cinematic skills, the impact kit, `cinematicStage()` |
| `presentation.ts` | Skill banner, tint LUT |
| `demo.ts` | Live stage: cinematics, held and stacked numbers, reflection pass |
| `scenery.ts` | Worlds, `reflectWater`, `BG_LOOP`, `FIGHT_BAND`, World 1 |
| `palette.ts` | Palette, `SCENERY_RAMPS`, `shadeLut`, `luma` |
| `catalog.ts` | Asset registry, `ART_ROUNDS`, palette sheets, banners |
| `raids.ts` | `TRAINING_DUMMY` (the scarecrow) |
| `app/pages/hero-quest/art.vue` | Gallery with round chips |
