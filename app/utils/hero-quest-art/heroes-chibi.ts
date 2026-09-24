// Round 2 heroes: the Beginner, Warrior, Sorcerer and Hunter rebuilt on the chibi body, one
// per class line plus the root. They replace the classic entries in HERO_ART by ID, so the
// gallery, the exporter and the live stage pick them up with no other change.
//
// Same rookie in every one (see chibi.ts ROOKIE_HEAD): the headgear changes, the face never.

import { Ease, Phase, step, type Clip } from './anim'
import { C } from './palette'
import { disc, hash2, line, px, rect, type Surface } from './surface'
import { HP, J, fxX, fxY, hclip, hitClip, deathClip, rest, type Look, type HKey } from './rig'
import { HERO_SKIN } from './hero-parts'
import { drawChibi, chibiHead, crescent, face, head, ROOKIE_HEAD } from './chibi'
import { M, tip, sword, staff, bow, Gem } from './weapons'
import type { HeroArt } from './heroes'

const CH = Phase.Charge
const CA = Phase.Cast
const RE = Phase.Recover

/** Scene effects a keyframe can call for, through the `fxk` pose parameter. */
const enum FXK { None, Jab, Cross, Burst, Slash, SlashFade, Rage, Spin, Bolt, Embers, Release, Aim, BigRelease }

const is = (p: Float32Array, k: FXK) => Math.round(p[HP.fxk]!) === k

function chibiLook(over: Partial<Look> & Pick<Look, 'torso' | 'head' | 'accent'>): Look {
    return {
        body: drawChibi,
        skin: HERO_SKIN,
        pants: C.brown2, pantsDk: C.brown1, boot: C.brown0, bootHi: C.brown2,
        arm: C.bone1, armLow: C.skin1, armBack: C.bone0, armBackLow: C.skin0, hand: C.skin1,
        ...over
    }
}

/** Four white-hot pixels in a burst, stepping outward — the punch-contact spark. */
function pop(dst: Surface, x: number, y: number, k: number, c: number): void {
    const r = 2 + k
    dst.set(fxX(x + r), fxY(y), C.white)
    dst.set(fxX(x), fxY(y - r), c)
    dst.set(fxX(x), fxY(y + r), c)
    dst.set(fxX(x + r - 1), fxY(y - r + 1), c)
    dst.set(fxX(x + r - 1), fxY(y + r - 1), c)
    if (k === 0) dst.set(fxX(x + 1), fxY(y), C.white)
}

// ═══════════════════════════════════════════════════════════════ Beginner
// Cream tunic, rope belt, a satchel on his hip, fists up. Two strikes per attack.

const BEGINNER_REST = rest({ hx: 5, hy: 1, bhx: 8, bhy: 0, ffx: 3, bfx: -3 })

const beginner: HeroArt = {
    look: chibiLook({
        accent: C.gold3,
        back: (s, x, y) => {
            // satchel riding the back hip
            rect(s, x - 7, y + 4, 4, 4, C.brown2)
            rect(s, x - 7, y + 4, 4, 1, C.brown3)
            px(s, x - 5, y + 5, C.gold2)
        },
        torso: (s, x, y) => {
            rect(s, x - 5, y, 10, 8, C.bone1)
            rect(s, x - 5, y, 2, 8, C.bone0)
            rect(s, x + 2, y + 1, 2, 3, C.white)
            rect(s, x, y, 3, 1, C.skin1)
            px(s, x + 1, y + 1, C.skin0)
            line(s, x + 3, y, x - 3, y + 5, C.brown2) // satchel strap
            rect(s, x - 5, y + 5, 10, 1, C.brown2) // rope belt
            px(s, x + 1, y + 5, C.gold2)
            rect(s, x - 5, y + 7, 10, 1, C.bone0)
        },
        head: (s, x, y, p) => chibiHead(s, ROOKIE_HEAD, x, y, p),
        fx: (dst, p, t) => {
            if (is(p, FXK.Jab)) pop(dst, J.hx + 2, J.hy, step(t, 10, 2), C.gold3)
            if (is(p, FXK.Cross)) pop(dst, J.bhx + 2, J.bhy, step(t, 10, 2), C.gold3)
            if (is(p, FXK.Burst)) {
                // Haste: speed lines streaming off his back
                for (let i = 0; i < 5; i++) {
                    const yy = J.topY - 6 + i * 5
                    const len = 6 + ((i + step(t, 10, 3)) % 3) * 3
                    for (let k = 0; k < len; k++) if (k < 3 || !((k + i) & 1)) dst.set(fxX(J.bx - 8 - k), fxY(yy), k < 3 ? C.white : C.gold2)
                }
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.2, true, [
            [0, {}],
            [0.3, { crouch: 1, hy: 2, bhy: 1 }],
            [0.6, { crouch: 0, hy: 1, bhy: 0 }],
            [0.9, { crouch: 1, hy: 2, bhy: 1 }],
            [1.2, {}]
        ], BEGINNER_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { lean: -1, hx: 2, hy: 2, crouch: 1 }, Ease.Out, CH],
            [0.2, { lean: 2, hx: 9, hy: 1, ffx: 5, bfx: -4, fxk: FXK.Jab }, Ease.Out, CA],
            [0.3, { lean: 1, hx: 4, hy: 2, fxk: 0 }, Ease.InOut, CH],
            [0.4, { lean: 3, bhx: 15, bhy: 1, hx: 1, hy: 4, ffx: 6, tilt: 1, fxk: FXK.Cross }, Ease.Out, CA],
            [0.5, { lean: 3, bhx: 14, tilt: 1, fxk: 0 }, Ease.Hold, RE],
            [0.9, { lean: 0, bhx: 8, bhy: 0, hx: 5, hy: 1, ffx: 3, bfx: -3, tilt: 0 }]
        ], BEGINNER_REST),
        // Haste: crouch and gather, spring up fists high, land running hot
        cast: hclip('cast', 1.4, false, [
            [0, {}],
            [0.2, { crouch: 2, hx: 1, hy: 5, bhx: 2, bhy: 5, glow: 0.4, headY: 1 }, Ease.Out, CH],
            [0.4, { crouch: 3, glow: 0.5 }, Ease.InOut, CH],
            [0.5, { crouch: 0, jump: -6, hx: 3, hy: -7, bhx: 1, bhy: -6, glow: 1, headY: -1, mouth: 1, ffy: 2, bfy: 3, fxk: FXK.Burst }, Ease.Out, CA],
            [0.8, { jump: -7 }, Ease.Out, CA],
            [1.0, { jump: 0, crouch: 2, glow: 0.6, mouth: 0, ffy: 0, bfy: 0, hy: 1, bhy: 0 }, Ease.In, RE],
            [1.1, { fxk: 0 }, Ease.Hold],
            [1.4, { crouch: 0, glow: 0, hx: 5, hy: 1, bhx: 8, bhy: 0, headY: 0 }]
        ], BEGINNER_REST),
        hit: hitClip(BEGINNER_REST),
        death: deathClip(BEGINNER_REST)
    }
}

/**
 * Flames licking up the edges of the body — the cast aura. Tongues stand on both flanks
 * (never over the face), each flickering to its own height and cooling through `ramp`
 * toward the tip; loose embers ride above them.
 */
function aura(dst: Surface, t: number, ramp: readonly number[], spread = 7, tall = 20): void {
    const f = step(t, 10, 64)
    const n = ramp.length
    for (let i = 0; i < 10; i++) {
        const side = i & 1 ? 1 : -1
        const x = J.bx + side * (spread - (i >> 1) % 3)
        const h = Math.round(tall * (0.35 + 0.65 * hash2(i, f)))
        for (let k = 0; k < h; k++) {
            const u = k / h
            const c = ramp[Math.min(n - 1, 1 + Math.floor(u * (n - 1)))]!
            dst.set(fxX(x), fxY(J.oy - 1 - k), c)
            if (u < 0.45) dst.set(fxX(x + side), fxY(J.oy - 1 - k), ramp[Math.min(n - 1, 2 + Math.floor(u * (n - 2)))]!)
        }
        dst.set(fxX(x), fxY(J.oy - 1 - h), ramp[0]!)
    }
    for (let i = 0; i < 8; i++) {
        const u = ((f * 2 + i * 7) % 12) / 12
        const x = J.bx + Math.round((hash2(i, 9) - 0.5) * spread * 3)
        dst.set(fxX(x), fxY(J.oy - tall * 0.6 - Math.round(u * tall)), ramp[Math.min(n - 1, 1 + Math.floor(u * (n - 1)))]!)
    }
}

const FIRE = [C.white, C.gold3, C.gold2, C.orange, C.lava1, C.red1]
const BLOOD_FIRE = [C.white, C.red3, C.red2, C.red2, C.red1, C.red0]

// ═══════════════════════════════════════════════════════════════ Warrior (base)
// A novice: iron kettle cap, leather jerkin under a red tabard, a broad arming sword and a
// round wooden shield slung on the back arm.

const WARRIOR_HEAD = head([
    '....IIII....',
    '..IjjJJjI...',
    '.IjjjjJJjI..',
    '.IjjjjjjjI..',
    'iIIIIIIIIIIi',
    'hHHHHHHHHsH.',
    ...face()
], 5, 9)

const WARRIOR_REST = rest({ hx: 3, hy: 4, wa: -1.15, bhx: -1, bhy: 4, ffx: 3, bfx: -3 })

const warrior: HeroArt = {
    look: chibiLook({
        accent: C.red2,
        pants: C.steel1, pantsDk: C.steel0, boot: C.brown1, bootHi: C.brown3,
        arm: C.brown2, armLow: C.steel1, armBack: C.brown1, armBackLow: C.steel0, hand: C.brown1,
        torso: (s, x, y) => {
            rect(s, x - 5, y, 10, 8, C.brown2)
            rect(s, x - 5, y, 2, 8, C.brown1)
            rect(s, x - 1, y, 4, 8, C.red1) // tabard
            rect(s, x + 1, y + 1, 1, 6, C.red2)
            rect(s, x - 5, y + 5, 10, 1, C.brown0)
            px(s, x, y + 5, C.gold2)
            rect(s, x - 5, y + 7, 10, 1, C.steel1) // mail skirt
            px(s, x - 3, y + 7, C.steel2); px(s, x + 3, y + 7, C.steel2)
        },
        head: (s, x, y, p) => chibiHead(s, WARRIOR_HEAD, x, y, p),
        weapon: (s, x, y, p) => sword(s, x, y, p[HP.wa]!, 15, M.steel, M.bronze, C.brown1, true),
        offhand: (s, x, y) => {
            disc(s, x - 1, y, 4, C.steel1)
            disc(s, x - 1, y, 3, C.brown2)
            line(s, x - 3, y - 2, x + 1, y - 2, C.brown3)
            rect(s, x - 2, y - 1, 2, 2, C.red2)
        },
        over: (s, x, y) => {
            // pauldron over the sword shoulder
            rect(s, x + 1, y, 5, 3, C.steel1)
            rect(s, x + 2, y, 3, 1, C.steel3)
        },
        fx: (dst, p, t) => {
            if (is(p, FXK.Slash)) crescent(dst, J.fsx, J.fsy, 16, p[HP.fxa]!, p[HP.wa]!, 6, C.red2, C.white, C.red1)
            if (is(p, FXK.SlashFade)) crescent(dst, J.fsx, J.fsy, 16, p[HP.fxa]!, p[HP.wa]!, 3, C.red1, C.red3, C.red0)
            if (is(p, FXK.Rage)) {
                aura(dst, t, BLOOD_FIRE)
                // the blade drinks the light: a white-hot core down its length
                if (step(t, 10, 2)) dst.set(fxX(tip.x), fxY(tip.y - 1), C.white)
            }
            if (is(p, FXK.Spin)) {
                const k = step(t, 10, 4)
                const a = k * Math.PI / 2
                crescent(dst, J.bx, J.topY + 2, 14, a, a + Math.PI * 1.1, 5, C.red2, C.white, C.red1)
                crescent(dst, J.bx, J.topY + 2, 14, a + Math.PI, a + Math.PI * 2.1, 4, C.red1, C.red3, C.red0)
                aura(dst, t, BLOOD_FIRE, 8, 12)
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.2, true, [
            [0, {}], [0.6, { crouch: 1, hy: 5, bhy: 5, wa: -1.05 }], [1.2, {}]
        ], WARRIOR_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { wa: -2.2, hx: 0, hy: -3, lean: -1, crouch: 1 }, Ease.Out, CH],
            [0.3, { wa: -2.8, hx: -2, hy: -5, lean: -2, crouch: 1 }, Ease.InOut, CH],
            [0.4, { wa: 0.2, hx: 7, hy: 2, lean: 2, ffx: 5, crouch: 0, fxk: FXK.Slash, fxa: -2.7 }, Ease.Out, CA],
            [0.5, { wa: 0.9, hx: 6, hy: 5, crouch: 2 }, Ease.Out, CA],
            [0.6, { fxk: FXK.SlashFade, fxa: -1.2 }, Ease.Hold, RE],
            [0.7, { fxk: 0 }, Ease.Hold, RE],
            [0.9, { wa: -1.15, hx: 3, hy: 4, lean: 0, crouch: 0, ffx: 3 }]
        ], WARRIOR_REST),
        // Whirlwind: raise the blade and let it catch fire, then spin twice through the pack
        cast: hclip('cast', 1.8, false, [
            [0, {}],
            [0.2, { wa: -1.57, hx: 2, hy: -6, bhx: 0, bhy: 2, crouch: 1, glow: 0.7, fxk: FXK.Rage }, Ease.Out, CH],
            [0.7, { crouch: 2, glow: 1 }, Ease.InOut, CH],
            [0.8, { wa: 0.05, hx: 7, hy: 1, bhx: -2, bhy: 3, lean: 1, ffx: 5, bfx: -5, flip: 1, fxk: FXK.Spin }, Ease.Hold, CA],
            [0.9, { flip: 0 }, Ease.Hold],
            [1.0, { flip: 1 }, Ease.Hold],
            [1.1, { flip: 0 }, Ease.Hold],
            [1.2, { flip: 1 }, Ease.Hold],
            [1.3, { flip: 0, fxk: 0, glow: 0.3 }, Ease.Hold, RE],
            [1.8, { crouch: 0, wa: -1.15, hx: 3, hy: 4, bhx: -1, bhy: 4, ffx: 3, bfx: -3, lean: 0, glow: 0 }]
        ], WARRIOR_REST),
        hit: hitClip(WARRIOR_REST),
        death: deathClip(WARRIOR_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Sorcerer (master)
// The reference video's fire caster on the rookie: a crimson robe to the floor, a tall hat
// whose tip folds back, and a staff that burns like a torch.

const SORCERER_HEAD = head([
    '..xy..........',
    '...yyx........',
    '....zyyx......',
    '....zzyyx.....',
    '...zzzyyyx....',
    '...zzzyyyyx...',
    '..gGGYGGGGgg..',
    'xyyyyyyyyyyyyx',
    '.hHHHHHHHHsH..',
    ...face(1, 1)
], 6, 10)

const SORCERER_REST = rest({ hx: 4, hy: 4, wa: -1.5, bhx: 1, bhy: 5, ffx: 2, bfx: -2 })

const sorcerer: HeroArt = {
    look: chibiLook({
        accent: C.orange,
        arm: C.red1, armLow: C.red1, armBack: C.red0, armBackLow: C.red0, hand: C.skin1,
        torso: (s, x, y) => {
            rect(s, x - 5, y, 10, 8, C.red1)
            rect(s, x - 5, y, 2, 8, C.red0)
            rect(s, x + 2, y + 1, 2, 4, C.red2)
            rect(s, x - 1, y, 2, 8, C.gold1) // front trim
            px(s, x, y + 2, C.gold3)
            rect(s, x - 5, y + 5, 10, 1, C.gold1)
            px(s, x + 1, y + 5, C.gold3)
        },
        lower: (s, x, hipY, p, t) => {
            // the robe to the floor, flaring, the hem swinging a pixel on the beat
            const sway = step(t, 3, 2)
            const floor = J.oy
            for (let y = hipY; y < floor; y++) {
                const u = (y - hipY) / Math.max(1, floor - hipY - 1)
                const half = Math.round(5 + u * 2)
                const off = y === floor - 1 ? sway : 0
                rect(s, x - half + off, y, half * 2, 1, C.red1)
                rect(s, x - half + off, y, 2, 1, C.red0)
                px(s, x + half - 2 + off, y, C.red2)
            }
            rect(s, x - 7 + sway, floor - 1, 14, 1, C.gold1)
        },
        head: (s, x, y, p) => chibiHead(s, SORCERER_HEAD, x, y, p, p[HP.glow]! > 0.5 ? C.orange : C.ink),
        weapon: (s, x, y, p, t) => staff(s, x, y, p[HP.wa]!, 14, M.wood, M.lava, Gem.Flame, p[HP.glow]!, t),
        fx: (dst, p, t) => {
            if (is(p, FXK.Bolt)) {
                // a fireball leaving the staff head
                const k = step(t, 10, 2)
                const x = tip.x + 2 + k * 2
                disc(dst, fxX(x), fxY(tip.y), 3, C.orange)
                disc(dst, fxX(x), fxY(tip.y), 2, C.gold2)
                dst.set(fxX(x), fxY(tip.y), C.white)
                for (let i = 1; i < 6; i++) dst.set(fxX(x - 3 - i), fxY(tip.y + ((i + k) & 1)), i < 3 ? C.orange : C.red1)
            }
            if (is(p, FXK.Embers)) {
                aura(dst, t, FIRE, 8, 22)
                const f = step(t, 10, 4)
                disc(dst, fxX(tip.x), fxY(tip.y - 2), 2 + (f & 1), C.gold2)
                dst.set(fxX(tip.x), fxY(tip.y - 2), C.white)
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.6, true, [[0, {}], [0.8, { crouch: 1, hy: 5, bhy: 6 }], [1.6, {}]], SORCERER_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { hx: 2, hy: 2, wa: -1.9, lean: -1, glow: 0.4 }, Ease.Out, CH],
            [0.3, { glow: 0.7 }, Ease.InOut, CH],
            [0.4, { hx: 6, hy: 0, wa: -0.45, lean: 2, glow: 1, fxk: FXK.Bolt }, Ease.Out, CA],
            [0.6, { fxk: 0, glow: 0.5 }, Ease.Out, RE],
            [0.9, { hx: 4, hy: 4, wa: -1.5, lean: 0, glow: 0 }]
        ], SORCERER_REST),
        // Meteor Shower: the staff goes up and stays up while the sky opens
        cast: hclip('cast', 2.0, false, [
            [0, {}],
            [0.2, { hx: 3, hy: -5, wa: -1.57, bhx: 3, bhy: -2, glow: 0.8, headY: -1, fxk: FXK.Embers }, Ease.Out, CH],
            [0.5, { glow: 1, mouth: 1 }, Ease.InOut, CA],
            [1.5, { hy: -6 }, Ease.Linear, CA],
            [1.6, { fxk: 0, mouth: 0 }, Ease.Hold, RE],
            [2.0, { hx: 4, hy: 4, wa: -1.5, bhx: 1, bhy: 5, glow: 0, headY: 0 }]
        ], SORCERER_REST),
        hit: hitClip(SORCERER_REST),
        death: deathClip(SORCERER_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Hunter (elite)
// A fox-eared hood up over his hair, fur-trimmed leathers, a quiver and a recurve bow.
// Basic Attack looses three (strikesPerAttack 3).

const HUNTER_HEAD = head([
    '.bO....bO...',
    '.OOO..OOO...',
    '.qOOOOOOOO..',
    'qOOOOOOOOOO.',
    'qOOOOOOOOOOO',
    'qOOOObHHHsO.',
    'qOOOHsSSSkS.',
    'qqOOdsSSSkSs',
    '.qOOssSbbSS.',
    '.qqOssSSSSS.',
    '..qOsssSSs..',
    '.....ddd....'
], 5, 9)

const HUNTER_REST = rest({ hx: 5, hy: 3, wa: 0.35, bhx: 1, bhy: 5, ffx: 3, bfx: -3 })

function bowPainter(size: number) {
    return (s: Surface, x: number, y: number, p: Float32Array) => {
        const pull = p[HP.aux]!
        bow(s, x, y, p[HP.wa]!, pull, pull > 0.05, M.darkwood, size, C.steel3)
    }
}

/** A thick release streak off the bow — two rows, white-hot at the head. */
function loose(dst: Surface, c: number, big: boolean): void {
    const a = p0.wa
    const len = big ? 22 : 12
    const x = J.hx + Math.cos(a) * (big ? 16 : 13)
    const y = J.hy + Math.sin(a) * (big ? 16 : 13)
    for (let i = 0; i < len; i++) {
        if (i > len * 0.6 && (i & 1)) continue
        const xx = Math.round(x - Math.cos(a) * i)
        const yy = Math.round(y - Math.sin(a) * i)
        dst.set(fxX(xx), fxY(yy), i < 3 ? C.white : c)
        if (big && i < len * 0.7) { dst.set(fxX(xx), fxY(yy - 1), i < 5 ? C.white : c); dst.set(fxX(xx), fxY(yy + 1), c) }
    }
}
const p0 = { wa: 0 }

/** Raise → nock → draw → release, `shots` times. */
function bowAttack(restPose: Float32Array, shots: number): Clip {
    const keys: HKey[] = [[0, {}], [0.1, { wa: 0, hx: 8, hy: 0, bhx: 9, bhy: 0, lean: -1, aux: 0.1 }, Ease.Out, CH]]
    let t = 0.1
    for (let i = 0; i < shots; i++) {
        t += 0.1
        keys.push([r1(t), { aux: 1, bhx: 3, fxk: 0 }, Ease.InOut, CH])
        t += 0.1
        keys.push([r1(t), { aux: 0, bhx: -1, bhy: -1, fxk: FXK.Release, lean: -1 - (i & 1) }, Ease.Hold, CA])
        if (i < shots - 1) { t += 0.1; keys.push([r1(t), { fxk: 0, bhx: 8, bhy: 0, aux: 0.1 }, Ease.Out, CH]) }
    }
    keys.push([r1(t + 0.1), { fxk: 0 }, Ease.Hold, RE])
    keys.push([r1(t + 0.4), {
        wa: restPose[HP.wa]!, hx: restPose[HP.hx]!, hy: restPose[HP.hy]!, bhx: restPose[HP.bhx]!, bhy: restPose[HP.bhy]!, lean: 0, aux: 0
    }])
    return hclip('attack', r1(t + 0.4), false, keys, restPose)
}

function r1(t: number): number { return Math.round(t * 10) / 10 }

const hunter: HeroArt = {
    look: chibiLook({
        accent: C.orange,
        pants: C.brown1, pantsDk: C.brown0, boot: C.brown0, bootHi: C.bone0,
        arm: C.brown2, armLow: C.brown3, armBack: C.brown1, armBackLow: C.brown2, hand: C.skin1,
        back: (s, x, y) => {
            line(s, x - 6, y, x - 3, y + 8, C.brown1, 3) // quiver
            px(s, x - 7, y - 2, C.red2); px(s, x - 6, y - 3, C.red2); px(s, x - 5, y - 2, C.bone1)
        },
        torso: (s, x, y) => {
            rect(s, x - 5, y, 10, 8, C.brown2)
            rect(s, x - 5, y, 2, 8, C.brown1)
            rect(s, x + 2, y + 1, 2, 4, C.brown3)
            rect(s, x - 5, y - 1, 10, 2, C.orange) // fur collar
            px(s, x - 3, y + 1, C.bone1); px(s, x + 3, y, C.bone1)
            line(s, x - 4, y, x + 3, y + 5, C.brown0) // quiver strap
            rect(s, x - 5, y + 5, 10, 1, C.brown0)
            px(s, x + 1, y + 5, C.gold2)
        },
        head: (s, x, y, p) => chibiHead(s, HUNTER_HEAD, x, y, p),
        weapon: bowPainter(11),
        fx: (dst, p, t) => {
            p0.wa = p[HP.wa]!
            if (is(p, FXK.Release)) loose(dst, C.orange, false)
            if (is(p, FXK.BigRelease)) loose(dst, C.red2, true)
            if (is(p, FXK.Aim)) {
                // charge gathering on the arrowhead
                const k = step(t, 10, 3)
                const x = J.hx + 9
                const y = J.hy
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3 + k * 0.5
                    const d = 7 - k * 2
                    dst.set(fxX(Math.round(x + Math.cos(a) * d)), fxY(Math.round(y + Math.sin(a) * d)), i & 1 ? C.red3 : C.white)
                }
                dst.set(fxX(x), fxY(y), C.white)
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.2, true, [[0, {}], [0.6, { crouch: 1, hy: 4, bhy: 6 }], [1.2, {}]], HUNTER_REST),
        attack: bowAttack(HUNTER_REST, 3),
        // Kill Shot: drop to a knee, draw long while the arrowhead charges, loose one
        cast: hclip('cast', 1.8, false, [
            [0, {}],
            [0.2, { wa: -0.05, hx: 8, hy: 0, bhx: 9, bhy: 0, crouch: 3, kneel: 1, ffx: 5, aux: 0.1 }, Ease.Out, CH],
            [0.5, { aux: 1, bhx: 2, glow: 0.8, fxk: FXK.Aim }, Ease.InOut, CH],
            [1.0, { glow: 1 }, Ease.Linear, CH],
            [1.1, { aux: 0, bhx: -2, lean: -2, fxk: FXK.BigRelease }, Ease.Hold, CA],
            [1.2, { fxk: 0 }, Ease.Hold, RE],
            [1.8, { wa: 0.35, hx: 5, hy: 3, bhx: 1, bhy: 5, crouch: 0, kneel: 0, ffx: 3, lean: 0, glow: 0 }]
        ], HUNTER_REST),
        hit: hitClip(HUNTER_REST),
        death: deathClip(HUNTER_REST)
    }
}

export const CHIBI_HEROES: Readonly<Record<string, HeroArt>> = {
    class_beginner: beginner,
    class_warrior: warrior,
    class_sorcerer: sorcerer,
    class_hunter: hunter
}
