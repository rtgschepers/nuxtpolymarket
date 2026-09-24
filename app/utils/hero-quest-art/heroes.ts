// The Hero, all sixteen class nodes (asset-list §1.1: fully unique per node, 5 states each).
//
// One face throughout — see hero-parts.ts. What changes per node is the Look (outfit, weapon,
// headgear) and every keyframe of Idle, Basic Attack, Skill cast, Hit and Death. Tier shows in
// the gear: base classes are novices in hand-me-downs over the Beginner's tunic, elites are
// specialised, masters are unmistakable at a glance.
//
// Scene effects are keyed by the `fxk` pose parameter (see FXK below) so a smear or a release
// streak lands on exactly the frame the keyframes say.

import { Ease, Phase, step, type Clip } from './anim'
import { C } from './palette'
import type { Surface} from './surface';
import { line, px, rect } from './surface'
import { HP, J, fxX, fxY, hclip, hitClip, deathClip, rest, type Look, type HKey } from './rig'
import { HERO_SKIN, heroFace, heroHair, tunic, cape, pauldron, robeSkirt, smear, streak, sparks } from './hero-parts'
import { CHIBI_HEROES } from './heroes-chibi'
import { M, tip, sword, axe, hammer, staff, bow, shield, tome, fist, orb, Gem, ShieldStyle, type Mat } from './weapons'

export interface HeroClips { idle: Clip, attack: Clip, cast: Clip, hit: Clip, death: Clip }
export interface HeroArt { look: Look, clips: HeroClips }

export const HERO_STATES = ['idle', 'attack', 'cast', 'hit', 'death'] as const
export type HeroState = typeof HERO_STATES[number]

const CH = Phase.Charge
const CA = Phase.Cast
const RE = Phase.Recover

/** Scene effects a hero keyframe can call for. */
const enum FXK {
    None, Smear, Release, Spin, Roar, BackSmear, Rage, Slam, Holy, Burst, Gather, Crackle, Embers,
    Gust, Rise, Aim, BigRelease, Fan, Volley, Whistle
}

const TUNIC: Mat = [C.bone0, C.bone1, C.white]
const is = (p: Float32Array, k: FXK) => Math.round(p[HP.fxk]!) === k

function baseLook(over: Partial<Look> & Pick<Look, 'torso' | 'head' | 'accent'>): Look {
    return {
        skin: HERO_SKIN,
        pants: C.brown2, pantsDk: C.brown1, boot: C.brown0, bootHi: C.brown2,
        arm: C.bone1, armLow: C.skin1, armBack: C.bone0, armBackLow: C.skin0, hand: C.skin1,
        ...over
    }
}

// ── Shared scene effects ────────────────────────────────────────────────────────────

/** Melee smear around the front shoulder, from the keyed start angle to the weapon angle. */
function meleeFx(r0: number, r1: number, accent: number) {
    return (dst: Surface, p: Float32Array) => {
        if (is(p, FXK.Smear)) smear(dst, J.fsx, J.fsy, r0, r1, p[HP.fxa]!, p[HP.wa]!, accent)
        if (is(p, FXK.BackSmear)) smear(dst, J.bsx, J.bsy, r0 - 2, r1 - 2, p[HP.fxa]!, p[HP.ba]!, accent)
    }
}

function releaseFx(dst: Surface, p: Float32Array, c: number, big = false): void {
    const a = p[HP.wa]!
    const hx = J.hx + Math.cos(a) * (big ? 14 : 12)
    const hy = J.hy + Math.sin(a) * (big ? 14 : 12)
    streak(dst, hx, hy, a, big ? 16 : 9, c)
    if (big) {
        streak(dst, hx, hy - 1, a, 10, C.white)
        sparks(dst, J.hx + Math.cos(a) * 4, J.hy + Math.sin(a) * 4, 4, 5, 3, c, C.white)
    }
}

function gatherFx(dst: Surface, x: number, y: number, t: number, c0: number, c1: number): void {
    const k = step(t, 10, 4)
    sparks(dst, x, y, 7 - k * 1.5, 6, k + 11, c0, c1)
}

/** Bow painter with pull read from `aux`. */
function bowPainter(wood: Mat, size: number, arrowTip: number = C.steel3) {
    return (s: Surface, x: number, y: number, p: Float32Array) => {
        const pull = p[HP.aux]!
        bow(s, x, y, p[HP.wa]!, pull, pull > 0.05, wood, size, arrowTip)
    }
}

/** Bow clip set: raise → nock → draw → release, `shots` times, with the aim angle `aim`. */
function bowAttack(restPose: Float32Array, shots: number, aim = 0, dur = 0.9): Clip {
    const keys: HKey[] = [[0, {}], [0.1, { wa: aim, hx: 8, hy: aim * 6, bhx: 11, bhy: aim * 6, lean: -1, aux: 0.1 }, Ease.Out, CH]]
    let t = 0.1
    const gap = shots === 1 ? 0.2 : 0.1
    for (let i = 0; i < shots; i++) {
        t += gap
        keys.push([round1(t), { aux: 1, bhx: 4, fxk: 0 }, Ease.InOut, CH])
        t += 0.1
        keys.push([round1(t), { aux: 0, bhx: -2, bhy: aim * 6 - 1, fxk: FXK.Release, lean: -1 - (i & 1) }, Ease.Hold, CA])
        if (i < shots - 1) { t += 0.1; keys.push([round1(t), { fxk: 0, bhx: 10, aux: 0.1 }, Ease.Out, CH]) }
    }
    keys.push([round1(t + 0.1), { fxk: 0 }, Ease.Hold, RE])
    keys.push([Math.max(dur, round1(t + 0.4)), {}])
    // settle back to the rest pose
    const last = keys[keys.length - 1]!
    keys[keys.length - 1] = [last[0], {
        wa: restPose[HP.wa]!, hx: restPose[HP.hx]!, hy: restPose[HP.hy]!, bhx: restPose[HP.bhx]!, bhy: restPose[HP.bhy]!, lean: 0, aux: 0
    }]
    return hclip('attack', keys[keys.length - 1]![0], false, keys, restPose)
}

function round1(t: number): number { return Math.round(t * 10) / 10 }

// ═══════════════════════════════════════════════════════════════ Beginner
// Tunic, rope belt, satchel, wrapped fists. Two strikes per attack — a jab and a cross.

const BEGINNER_REST = rest({ hx: 4, hy: 1, bhx: 5, bhy: 2, ffx: 3, bfx: -3 })

const beginner: HeroArt = {
    look: baseLook({
        accent: C.gold3,
        hand: C.bone1,
        back: (s, x, y) => {
            rect(s, x - 6, y + 6, 4, 4, C.brown2)
            rect(s, x - 6, y + 6, 4, 1, C.brown3)
            px(s, x - 4, y + 7, C.gold1)
        },
        torso: (s, x, y) => {
            tunic(s, x, y, 10, TUNIC, C.brown2, C.brown3)
            px(s, x + 1, y, C.skin1); px(s, x + 2, y, C.skin1); px(s, x + 1, y + 1, C.skin0)
            line(s, x + 3, y, x - 3, y + 6, C.brown1)
        },
        head: (s, x, y, p) => { heroFace(s, x, y, p); heroHair(s, x, y, 0) },
        weapon: (s, x, y) => fist(s, x, y, C.bone1, C.white),
        offhand: (s, x, y) => fist(s, x, y, C.bone0, C.bone1),
        fx: (dst, p, t) => {
            if (is(p, FXK.Burst)) {
                // Haste: speed lines trailing behind and a spark at each foot
                for (let i = 0; i < 4; i++) {
                    const yy = J.topY + 2 + i * 4
                    const len = 5 + ((i + step(t, 10, 3)) % 3) * 2
                    for (let k = 0; k < len; k++) if (!((k + i) & 1) || k < 2) dst.set(fxX(J.bx - 7 - k), fxY(yy), k < 2 ? C.white : C.gold2)
                }
                sparks(dst, J.ffx, J.ffy, 3, 3, step(t, 10, 5), C.gold3, C.white)
            }
            if (is(p, FXK.Smear)) sparks(dst, J.hx + 2, J.hy, 2, 3, 1, C.white, C.gold3)
            if (is(p, FXK.BackSmear)) sparks(dst, J.bhx + 2, J.bhy, 2, 3, 2, C.white, C.gold3)
        }
    }),
    clips: {
        idle: hclip('idle', 1.2, true, [
            [0, {}],
            [0.3, { crouch: 1, hy: 2, bhy: 3 }],
            [0.6, { crouch: 0, hy: 1, bhy: 2 }],
            [0.9, { crouch: 1, hy: 2, bhy: 3 }],
            [1.2, {}]
        ], BEGINNER_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { lean: -1, hx: 1, hy: 2, crouch: 1 }, Ease.Out, CH],
            [0.2, { lean: 2, hx: 10, hy: 0, ffx: 5, bfx: -4, fxk: FXK.Smear }, Ease.Out, CA],
            [0.3, { lean: 1, hx: 4, hy: 1, fxk: 0 }, Ease.InOut, CH],
            [0.4, { lean: 3, bhx: 14, bhy: 0, hx: 2, hy: 2, ffx: 6, tilt: 1, fxk: FXK.BackSmear }, Ease.Out, CA],
            [0.5, { lean: 3, bhx: 13, tilt: 1, fxk: 0 }, Ease.Hold, RE],
            [0.9, { lean: 0, bhx: 5, bhy: 2, hx: 4, hy: 1, ffx: 3, bfx: -3, tilt: 0 }]
        ], BEGINNER_REST),
        cast: hclip('cast', 1.2, false, [
            [0, {}],
            [0.2, { crouch: 2, hx: 1, hy: 6, bhx: 2, bhy: 6, glow: 0.4, headY: 1 }, Ease.Out, CH],
            [0.4, { crouch: 3, glow: 0.5 }, Ease.InOut, CH],
            [0.5, { crouch: -1, jump: -5, hx: 3, hy: -8, bhx: 1, bhy: -7, glow: 1, headY: -1, mouth: 1, ffy: 2, bfy: 3, fxk: FXK.Burst }, Ease.Out, CA],
            [0.7, { jump: -6 }, Ease.Out, CA],
            [0.9, { jump: 0, crouch: 2, glow: 0.4, mouth: 0, ffy: 0, bfy: 0, hy: 2, bhy: 3, fxk: FXK.Burst }, Ease.In, RE],
            [1.0, { fxk: 0 }, Ease.Hold],
            [1.2, { crouch: 0, glow: 0, hx: 4, hy: 1, bhx: 5, bhy: 2, headY: 0 }]
        ], BEGINNER_REST),
        hit: hitClip(BEGINNER_REST),
        death: deathClip(BEGINNER_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Warrior (base)
// A novice: iron kettle cap, leather jerkin over the tunic, arming sword and a wooden shield.

const WARRIOR_REST = rest({ hx: 3, hy: 6, wa: -1.1, bhx: 3, bhy: 4, ffx: 3, bfx: -3 })

const warrior: HeroArt = {
    look: baseLook({
        accent: C.gold2,
        pants: C.stone2, pantsDk: C.stone1, boot: C.brown1, bootHi: C.brown3,
        armLow: C.brown2, armBackLow: C.brown1,
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.brown2)
            rect(s, x - 4, y, 1, 9, C.brown1)
            rect(s, x + 2, y + 1, 1, 5, C.brown3)
            rect(s, x - 1, y + 1, 3, 6, C.red1)
            rect(s, x, y + 1, 1, 6, C.red2)
            rect(s, x - 4, y + 6, 8, 1, C.brown0)
            px(s, x + 1, y + 6, C.gold2)
            rect(s, x - 4, y + 8, 8, 1, C.bone1)
            px(s, x + 1, y, C.bone1); px(s, x + 2, y, C.bone1)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p)
            heroHair(s, x, y, 1)
            rect(s, x - 3, y - 10, 6, 3, C.steel1)
            rect(s, x - 2, y - 11, 4, 1, C.steel1)
            rect(s, x - 4, y - 8, 9, 1, C.steel2)
            px(s, x - 1, y - 10, C.steel3); px(s, x, y - 10, C.steel2)
            px(s, x + 4, y - 8, C.steel1)
        },
        weapon: (s, x, y, p) => sword(s, x, y, p[HP.wa]!, 12, M.steel, M.bronze, C.brown1),
        offhand: (s, x, y) => shield(s, x - 1, y, ShieldStyle.Round, M.iron, M.wood, C.red2),
        fx: (dst, p, t) => {
            meleeFx(9, 15, C.gold2)(dst, p)
            if (is(p, FXK.Spin)) {
                const k = step(t, 10, 2)
                smear(dst, J.bx, J.topY + 5, 11, 15, k * Math.PI, k * Math.PI + Math.PI * 1.6, C.gold2)
                sparks(dst, J.bx, J.oy - 1, 9, 4, step(t, 10, 6), C.stone3, C.bone0)
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.2, true, [
            [0, {}], [0.6, { crouch: 1, hy: 7, bhy: 5, wa: -1.0 }], [1.2, {}]
        ], WARRIOR_REST),
        attack: hclip('attack', 0.8, false, [
            [0, {}],
            [0.1, { wa: -2.1, hx: 0, hy: -2, lean: -1, crouch: 1 }, Ease.Out, CH],
            [0.3, { wa: -2.7, hx: -2, hy: -4, lean: -2, crouch: 1 }, Ease.InOut, CH],
            [0.4, { wa: 0.35, hx: 6, hy: 3, lean: 2, ffx: 5, fxk: FXK.Smear, fxa: -2.7 }, Ease.Out, CA],
            [0.5, { wa: 0.75, hx: 5, hy: 6, crouch: 2, fxk: 0 }, Ease.Out, RE],
            [0.8, { wa: -1.1, hx: 3, hy: 6, lean: 0, crouch: 0, ffx: 3 }]
        ], WARRIOR_REST),
        // Whirlwind: brace, then spin twice with the blade held flat
        cast: hclip('cast', 1.2, false, [
            [0, {}],
            [0.2, { crouch: 2, wa: 0.1, hx: 7, hy: 2, bhx: -1, bhy: 4, lean: -1, ffx: 5, bfx: -5 }, Ease.Out, CH],
            [0.3, { flip: 1, fxk: FXK.Spin, lean: 0 }, Ease.Hold, CA],
            [0.4, { flip: 0 }, Ease.Hold],
            [0.5, { flip: 1 }, Ease.Hold],
            [0.6, { flip: 0 }, Ease.Hold],
            [0.7, { flip: 1 }, Ease.Hold],
            [0.8, { flip: 0, fxk: 0 }, Ease.Hold, RE],
            [1.2, { crouch: 0, wa: -1.1, hx: 3, hy: 6, bhx: 3, bhy: 4, ffx: 3, bfx: -3 }]
        ], WARRIOR_REST),
        hit: hitClip(WARRIOR_REST),
        death: deathClip(WARRIOR_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Barbarian (elite)
// Fur mantle, bare arms, horned helm, a two-handed great axe carried on the shoulder.

const BARBARIAN_REST = rest({ hx: 3, hy: 4, wa: 1.15, bhx: 6, bhy: 5, ffx: 4, bfx: -4 })

const barbarian: HeroArt = {
    look: baseLook({
        accent: C.orange,
        pants: C.brown1, pantsDk: C.brown0, boot: C.bone0, bootHi: C.bone1,
        arm: C.skin1, armLow: C.skin1, armBack: C.skin0, armBackLow: C.skin0, hand: C.brown2,
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.skin1)
            rect(s, x - 4, y, 1, 9, C.skin0)
            rect(s, x + 1, y + 2, 2, 3, C.skin2)
            px(s, x, y + 4, C.skin0); px(s, x + 1, y + 5, C.skin0)
            px(s, x + 1, y + 3, C.red2); px(s, x + 2, y + 4, C.red2) // war paint
            rect(s, x - 5, y - 1, 10, 3, C.brown3) // fur mantle
            px(s, x - 4, y + 2, C.brown3); px(s, x - 2, y + 2, C.brown3); px(s, x + 3, y + 2, C.brown3)
            px(s, x - 3, y - 1, C.bone1); px(s, x + 1, y - 1, C.bone1); px(s, x - 5, y, C.brown2)
            rect(s, x - 4, y + 6, 8, 2, C.brown1)
            px(s, x + 1, y + 6, C.gold2); px(s, x + 1, y + 7, C.gold1)
            rect(s, x - 4, y + 8, 8, 2, C.brown2) // kilt
            px(s, x - 2, y + 9, C.brown1); px(s, x + 1, y + 9, C.brown1)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p)
            heroHair(s, x, y, 1)
            rect(s, x - 3, y - 10, 6, 3, C.steel1)
            rect(s, x - 2, y - 11, 4, 1, C.steel2)
            rect(s, x - 3, y - 8, 6, 1, C.steel0)
            px(s, x - 1, y - 10, C.steel3)
            // horns
            px(s, x - 4, y - 9, C.bone1); px(s, x - 5, y - 10, C.bone1); px(s, x - 5, y - 11, C.bone1); px(s, x - 4, y - 12, C.white)
            px(s, x + 3, y - 9, C.bone1); px(s, x + 4, y - 10, C.bone1); px(s, x + 4, y - 11, C.bone1); px(s, x + 3, y - 12, C.white)
        },
        weapon: (s, x, y, p) => axe(s, x, y, p[HP.wa]!, 13, M.steel, M.wood, true),
        fx: (dst, p, t) => {
            meleeFx(11, 18, C.orange)(dst, p)
            if (is(p, FXK.Roar)) {
                const k = step(t, 10, 3)
                for (let i = 0; i < 3; i++) {
                    const r = 4 + ((i * 3 + k) % 9)
                    arcFx(dst, J.headX + 3, J.headY - 3, r, -0.8, 0.8, i === 0 ? C.white : C.bone1)
                }
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.4, true, [
            [0, {}], [0.7, { crouch: 1, hy: 4, bhy: 7 }], [1.4, {}]
        ], BARBARIAN_REST),
        attack: hclip('attack', 1.0, false, [
            [0, {}],
            [0.1, { wa: -1.6, hx: 0, hy: -6, bhx: 4, bhy: -3, lean: -1, crouch: 0 }, Ease.Out, CH],
            [0.3, { wa: -1.9, hx: -1, hy: -8, bhx: 3, bhy: -5, lean: -2, tilt: -1, jump: -1 }, Ease.InOut, CH],
            [0.4, { wa: 0.5, hx: 7, hy: 5, bhx: 10, bhy: 6, lean: 3, crouch: 3, tilt: 2, jump: 0, ffx: 6, fxk: FXK.Smear, fxa: -1.9, mouth: 1 }, Ease.Out, CA],
            [0.5, { wa: 0.9, hy: 7, fxk: 0 }, Ease.Out, RE],
            [0.7, { mouth: 0 }],
            [1.0, { wa: 1.15, hx: 3, hy: 4, bhx: 6, bhy: 5, lean: 0, crouch: 0, tilt: 0, ffx: 4 }]
        ], BARBARIAN_REST),
        // Threatening Roar: gather, then throw the arms wide and bellow
        cast: hclip('cast', 1.2, false, [
            [0, {}],
            [0.2, { crouch: 2, tilt: 1, hx: -1, hy: 5, bhx: 4, bhy: 7, headY: 1 }, Ease.Out, CH],
            [0.4, { glow: 0.5 }, Ease.InOut, CH],
            [0.5, { crouch: -1, tilt: -2, headX: -1, headY: -1, mouth: 1, hx: 6, hy: 0, wa: -0.7, bhx: -5, bhy: 1, glow: 1, fxk: FXK.Roar }, Ease.Out, CA],
            [0.8, {}, Ease.Linear],
            [0.9, { fxk: 0, glow: 0.3 }, Ease.Hold, RE],
            [1.2, { crouch: 0, tilt: 0, headX: 0, headY: 0, mouth: 0, hx: 3, hy: 4, wa: 1.15, bhx: 6, bhy: 5, glow: 0 }]
        ], BARBARIAN_REST),
        hit: hitClip(BARBARIAN_REST, 0.7),
        death: deathClip(BARBARIAN_REST)
    }
}

function arcFx(dst: Surface, cx: number, cy: number, r: number, a0: number, a1: number, c: number): void {
    const n = Math.max(6, Math.round((a1 - a0) * r))
    for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * i / n
        dst.set(fxX(Math.round(cx + Math.cos(a) * r)), fxY(Math.round(cy + Math.sin(a) * r)), c)
    }
}

// ═══════════════════════════════════════════════════════════════ Berserker (master)
// Wild hair under a red bandana, bandaged scars, two axes. Enrage turns the eyes red.

const BERSERKER_REST = rest({ hx: 4, hy: 7, wa: 0.8, bhx: 3, bhy: 7, ba: 0.9, ffx: 4, bfx: -4, tilt: 1, crouch: 1 })

const berserker: HeroArt = {
    look: baseLook({
        accent: C.red2,
        pants: C.brown1, pantsDk: C.brown0, boot: C.brown0, bootHi: C.steel1,
        arm: C.skin1, armLow: C.bone1, armBack: C.skin0, armBackLow: C.bone0, hand: C.brown1,
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.skin1)
            rect(s, x - 4, y, 1, 9, C.skin0)
            rect(s, x + 1, y + 1, 2, 3, C.skin2)
            line(s, x + 3, y, x - 3, y + 6, C.bone1) // bandage wrap
            line(s, x + 3, y + 2, x - 1, y + 6, C.bone0)
            px(s, x - 2, y + 2, C.red1); px(s, x - 1, y + 3, C.red1) // scar
            rect(s, x - 4, y + 6, 8, 2, C.red1)
            px(s, x - 4, y + 7, C.red2); px(s, x - 5, y + 8, C.red1); px(s, x - 6, y + 9, C.red1) // sash tail
            rect(s, x - 4, y + 8, 8, 1, C.brown0)
            // spiked shoulder
            rect(s, x + 2, y - 1, 3, 2, C.steel1); px(s, x + 3, y - 2, C.steel3); px(s, x + 5, y - 1, C.steel2)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p, p[HP.glow]! > 0.5 ? C.red3 : C.ink)
            heroHair(s, x, y, 0)
            px(s, x - 2, y - 12, C.brown2); px(s, x + 2, y - 11, C.brown2); px(s, x - 5, y - 9, C.brown1) // wilder
            rect(s, x - 3, y - 8, 7, 1, C.red2)
            px(s, x - 4, y - 7, C.red2); px(s, x - 5, y - 7, C.red1); px(s, x - 6, y - 6, C.red1)
            px(s, x + 1, y - 2, C.red2) // war paint under the plaster
        },
        weapon: (s, x, y, p) => axe(s, x, y, p[HP.wa]!, 9, M.iron, M.darkwood),
        offhand: (s, x, y, p) => axe(s, x, y, p[HP.ba]!, 9, M.iron, M.darkwood),
        fx: (dst, p, t) => {
            meleeFx(9, 15, C.red2)(dst, p)
            if (is(p, FXK.Rage)) {
                const k = step(t, 10, 8)
                for (let i = 0; i < 7; i++) {
                    const hx = J.bx - 6 + ((i * 5 + k * 3) % 13)
                    const hy = J.oy - 4 - ((i * 7 + k * 4) % 22)
                    dst.set(fxX(hx), fxY(hy), i % 3 === 0 ? C.red3 : i % 3 === 1 ? C.red2 : C.orange)
                }
            }
        }
    }),
    clips: {
        idle: hclip('idle', 0.8, true, [
            [0, {}], [0.4, { crouch: 2, hy: 8, bhy: 8, headY: 1 }], [0.8, {}]
        ], BERSERKER_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { wa: -2.0, hx: 0, hy: -3, lean: -1, tilt: 0 }, Ease.Out, CH],
            [0.2, { wa: 0.6, hx: 7, hy: 4, lean: 2, tilt: 2, fxk: FXK.Smear, fxa: -2.0 }, Ease.Out, CA],
            [0.3, { fxk: 0, ba: -2.0, bhx: 2, bhy: -3 }, Ease.InOut, CH],
            [0.4, { ba: 0.6, bhx: 13, bhy: 4, lean: 3, fxk: FXK.BackSmear, fxa: -2.0, wa: 1.0, hx: 4, hy: 7, ffx: 6 }, Ease.Out, CA],
            [0.5, { fxk: 0 }, Ease.Hold, RE],
            [0.9, { wa: 0.8, hx: 4, hy: 7, ba: 0.9, bhx: 3, bhy: 7, lean: 0, tilt: 1, ffx: 4 }]
        ], BERSERKER_REST),
        // Enrage: hunch, then rear up screaming with a red haze
        cast: hclip('cast', 1.3, false, [
            [0, {}],
            [0.2, { crouch: 3, tilt: 2, hx: 1, hy: 8, bhx: 2, bhy: 8, headY: 1, glow: 0.4 }, Ease.Out, CH],
            [0.5, { crouch: 0, tilt: -2, headY: -1, mouth: 1, hx: 6, hy: -6, wa: -1.2, bhx: 3, bhy: -7, ba: -1.9, glow: 1, fxk: FXK.Rage }, Ease.Back, CA],
            [0.9, { crouch: 1 }, Ease.Linear],
            [1.0, { fxk: 0, mouth: 0 }, Ease.Hold, RE],
            [1.3, { crouch: 1, tilt: 1, headY: 0, hx: 4, hy: 7, wa: 0.8, bhx: 3, bhy: 7, ba: 0.9, glow: 0 }]
        ], BERSERKER_REST),
        hit: hitClip(BERSERKER_REST, 0.8),
        death: deathClip(BERSERKER_REST, { ba: 0.4 })
    }
}

// ═══════════════════════════════════════════════════════════════ Knight (elite)
// Steel plate over a blue tabard, open-faced bascinet, longsword and kite shield.

const KNIGHT_REST = rest({ hx: 3, hy: 5, wa: -1.3, bhx: 5, bhy: 3, ffx: 3, bfx: -3 })

const knight: HeroArt = {
    look: baseLook({
        accent: C.cyan,
        pants: C.steel1, pantsDk: C.steel0, boot: C.steel0, bootHi: C.steel2,
        arm: C.steel2, armLow: C.steel1, armBack: C.steel1, armBackLow: C.steel0, hand: C.steel1,
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.steel2)
            rect(s, x - 4, y, 1, 9, C.steel1)
            rect(s, x + 1, y + 1, 1, 4, C.steel3)
            rect(s, x - 2, y + 3, 4, 6, C.blue1)
            rect(s, x - 1, y + 3, 2, 6, C.blue2)
            px(s, x, y + 5, C.gold2)
            rect(s, x - 4, y + 6, 8, 1, C.gold1)
            pauldron(s, x, y, M.steel)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p)
            heroHair(s, x, y, 2)
            rect(s, x - 3, y - 10, 7, 4, C.steel2)
            rect(s, x - 2, y - 11, 5, 1, C.steel2)
            rect(s, x - 3, y - 7, 2, 6, C.steel1)
            px(s, x + 3, y - 6, C.steel2); px(s, x + 3, y - 5, C.steel1) // nasal
            px(s, x - 1, y - 10, C.steel3); px(s, x, y - 11, C.steel3)
            rect(s, x - 2, y - 12, 3, 1, C.blue2) // crest
            px(s, x - 3, y - 12, C.blue1)
        },
        weapon: (s, x, y, p) => sword(s, x, y, p[HP.wa]!, 14, M.steel, M.gold, C.brown0),
        offhand: (s, x, y) => shield(s, x + 1, y, ShieldStyle.Kite, M.steel, [C.blue0, C.blue1, C.blue2], C.gold2),
        fx: (dst, p, t) => {
            meleeFx(10, 16, C.cyan)(dst, p)
            if (is(p, FXK.Slam)) slamFx(dst, tip.x, J.oy, t, C.stone3, C.bone1)
        }
    }),
    clips: {
        idle: hclip('idle', 1.4, true, [[0, {}], [0.7, { crouch: 1, hy: 6, bhy: 4 }], [1.4, {}]], KNIGHT_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { wa: -2.4, hx: -1, hy: -3, lean: -1 }, Ease.Out, CH],
            [0.3, { wa: -2.6, hx: -2, hy: -4, crouch: 1 }, Ease.InOut, CH],
            [0.4, { wa: 0.2, hx: 8, hy: 3, lean: 2, ffx: 5, fxk: FXK.Smear, fxa: -2.6 }, Ease.Out, CA],
            [0.5, { wa: 0.5, fxk: 0 }, Ease.Out, RE],
            [0.9, { wa: -1.3, hx: 3, hy: 5, lean: 0, crouch: 0, ffx: 3 }]
        ], KNIGHT_REST),
        // Shockwave: leap, and drive the blade into the ground
        cast: hclip('cast', 1.2, false, [
            [0, {}],
            [0.2, { jump: -3, hx: 2, hy: -7, wa: -1.6, bhx: 4, bhy: -2, glow: 0.4 }, Ease.Out, CH],
            [0.4, { jump: -4, glow: 0.6 }, Ease.InOut, CH],
            [0.5, { jump: 0, crouch: 3, hx: 7, hy: 9, wa: 1.35, bhx: 7, bhy: 6, glow: 1, fxk: FXK.Slam, kneel: 1 }, Ease.In, CA],
            [0.8, {}, Ease.Linear],
            [0.9, { fxk: 0, glow: 0.3 }, Ease.Hold, RE],
            [1.2, { crouch: 0, kneel: 0, hx: 3, hy: 5, wa: -1.3, bhx: 5, bhy: 3, glow: 0 }]
        ], KNIGHT_REST),
        hit: hitClip(KNIGHT_REST, 0.6),
        death: deathClip(KNIGHT_REST)
    }
}

function slamFx(dst: Surface, x: number, floor: number, t: number, c0: number, c1: number): void {
    const k = step(t, 10, 4)
    for (let i = 0; i < 5; i++) {
        const d = 3 + k * 3 + i * 2
        dst.set(fxX(x + d), fxY(floor - (i & 1) - (k > 1 ? 1 : 0)), i & 1 ? c0 : c1)
        dst.set(fxX(x - d), fxY(floor - ((i + 1) & 1)), i & 1 ? c1 : c0)
    }
    for (let i = 0; i < 3; i++) dst.set(fxX(x + (i - 1) * 2), fxY(floor - 2 - k - i), C.white)
}

// ═══════════════════════════════════════════════════════════════ Paladin (master)
// Gleaming white-and-gold plate, winged circlet, blue cape, holy warhammer and sun shield.

const PALADIN_REST = rest({ hx: 4, hy: 5, wa: -1.4, bhx: 2, bhy: 5, ffx: 3, bfx: -3 })

const paladin: HeroArt = {
    look: baseLook({
        accent: C.gold3,
        pants: C.steel2, pantsDk: C.steel1, boot: C.steel1, bootHi: C.steel3,
        arm: C.steel3, armLow: C.steel2, armBack: C.steel2, armBackLow: C.steel1, hand: C.gold1,
        back: (s, x, y, p, t) => cape(s, x - 1, y, 16, Math.floor(t * 4) & 1, C.blue1, C.blue0),
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.steel3)
            rect(s, x - 4, y, 1, 9, C.steel2)
            rect(s, x - 1, y + 1, 3, 6, C.white)
            rect(s, x, y + 1, 1, 6, C.gold2)
            rect(s, x - 1, y + 3, 3, 1, C.gold2)
            rect(s, x - 4, y + 7, 8, 1, C.gold1)
            px(s, x, y + 7, C.gold3)
            pauldron(s, x, y, M.gold, true)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p)
            heroHair(s, x, y, 0)
            rect(s, x - 3, y - 8, 7, 1, C.gold2)
            px(s, x + 1, y - 8, C.cyan)
            // small white wings at the temple
            px(s, x - 4, y - 9, C.white); px(s, x - 5, y - 10, C.white); px(s, x - 5, y - 9, C.steel3); px(s, x - 6, y - 11, C.white)
            px(s, x - 4, y - 8, C.steel3)
        },
        weapon: (s, x, y, p) => hammer(s, x, y, p[HP.wa]!, 11, M.gold, M.wood),
        offhand: (s, x, y) => shield(s, x - 1, y, ShieldStyle.Round, M.gold, M.steel, C.gold2),
        fx: (dst, p, t) => {
            meleeFx(11, 18, C.gold3)(dst, p)
            if (is(p, FXK.Holy)) {
                const k = step(t, 10, 2)
                for (let i = -2; i <= 2; i++) {
                    const len = 10 + ((i + k) & 1) * 4 - Math.abs(i) * 2
                    for (let j = 2; j < len; j++) if ((j + k) % 3) dst.set(fxX(tip.x + i * 2), fxY(tip.y - j), i === 0 ? C.white : C.gold3)
                }
                sparks(dst, tip.x, tip.y, 5, 6, k + 21, C.gold2, C.white)
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.4, true, [[0, {}], [0.7, { crouch: 1, hy: 6, bhy: 6 }], [1.4, {}]], PALADIN_REST),
        attack: hclip('attack', 1.0, false, [
            [0, {}],
            [0.1, { wa: -2.3, hx: -1, hy: -3, lean: -1, crouch: 1 }, Ease.Out, CH],
            [0.3, { wa: -2.9, hx: -3, hy: -5, lean: -2, crouch: 2, glow: 0.5 }, Ease.InOut, CH],
            [0.4, { wa: 0.2, hx: 7, hy: 4, lean: 2, crouch: 1, fxk: FXK.Smear, fxa: -2.9, glow: 0.7 }, Ease.Out, CA],
            [0.5, { wa: 0.6, hx: 6, hy: 7, crouch: 2, fxk: 0 }, Ease.Out, RE],
            [1.0, { wa: -1.4, hx: 4, hy: 5, lean: 0, crouch: 0, glow: 0 }]
        ], PALADIN_REST),
        // Disciple: kneel in prayer, then raise the hammer to call the Disciple down
        cast: hclip('cast', 1.4, false, [
            [0, {}],
            [0.2, { kneel: 1, crouch: 3, hx: 3, hy: 3, wa: -1.57, bhx: 6, bhy: 3, headY: 1 }, Ease.Out, CH],
            [0.5, { glow: 0.5 }, Ease.InOut, CH],
            [0.6, { kneel: 0, crouch: -1, jump: -1, hx: 1, hy: -9, wa: -1.57, bhx: 2, bhy: -8, headY: -1, glow: 1, fxk: FXK.Holy }, Ease.Out, CA],
            [1.0, {}, Ease.Linear],
            [1.1, { fxk: 0 }, Ease.Hold, RE],
            [1.4, { crouch: 0, jump: 0, hx: 4, hy: 5, wa: -1.4, bhx: 2, bhy: 5, headY: 0, glow: 0 }]
        ], PALADIN_REST),
        hit: hitClip(PALADIN_REST, 0.6),
        death: deathClip(PALADIN_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Mage (base)
// An apprentice swimming in an oversized blue robe over the tunic; no hat, a violet
// crystal staff (the class portrait's look).

const ROBE_BLUE: Mat = [C.blue0, C.blue1, C.blue2]
const MAGE_REST = rest({ hx: 4, hy: 6, wa: -1.35, bhx: 1, bhy: 6, ffx: 2, bfx: -2 })

function robeLower(cloth: Mat, trim: number, boot: number) {
    return (s: Surface, x: number, hipY: number, p: Float32Array, t: number) => {
        const sway = p[HP.lean]! > 1 ? -2 : p[HP.lean]! < -1 ? 2 : (Math.floor(t * 2) & 1) - 0.5
        robeSkirt(s, x, hipY, J.oy + Math.round(p[HP.jump]!) - 1, cloth, trim, sway, boot, p[HP.lean]! > 1 ? 1 : 0)
    }
}

const mage: HeroArt = {
    look: baseLook({
        accent: C.pink,
        arm: C.blue1, armLow: C.blue2, armBack: C.blue0, armBackLow: C.blue1, hand: C.bone1,
        torso: (s, x, y) => {
            rect(s, x - 5, y, 10, 9, C.blue1)
            rect(s, x - 5, y, 1, 9, C.blue0)
            rect(s, x + 2, y + 1, 1, 6, C.blue2)
            px(s, x + 1, y, C.bone1); px(s, x + 2, y, C.bone1); px(s, x + 1, y + 1, C.white) // tunic collar
            line(s, x + 3, y, x - 3, y + 7, C.brown1) // satchel strap
            rect(s, x - 5, y + 7, 10, 1, C.blue0)
        },
        lower: robeLower(ROBE_BLUE, C.blue0, C.brown1),
        head: (s, x, y, p) => { heroFace(s, x, y, p); heroHair(s, x, y, 0) },
        weapon: (s, x, y, p, t) => staff(s, x, y, p[HP.wa]!, 12, M.darkwood, M.arcane, Gem.Crystal, p[HP.glow]!, t),
        fx: (dst, p, t) => {
            if (is(p, FXK.Burst)) sparks(dst, tip.x + 2, tip.y, 5, 7, step(t, 10, 5), C.pink, C.white)
            if (is(p, FXK.Gather)) gatherFx(dst, tip.x, tip.y, t, C.purple2, C.cyan)
        }
    }),
    clips: {
        idle: hclip('idle', 1.4, true, [[0, {}], [0.7, { crouch: 1, hy: 7, bhy: 7, wa: -1.3 }], [1.4, {}]], MAGE_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { hx: 5, hy: 1, wa: -1.57, lean: -1, glow: 0.3 }, Ease.Out, CH],
            [0.3, { hx: 4, hy: -1, wa: -1.62, glow: 0.7, fxk: FXK.Gather }, Ease.InOut, CH],
            [0.4, { hx: 9, hy: 2, wa: -0.5, lean: 2, glow: 1, fxk: FXK.Burst }, Ease.Out, CA],
            [0.5, { fxk: 0, glow: 0.5 }, Ease.Out, RE],
            [0.9, { hx: 4, hy: 6, wa: -1.35, lean: 0, glow: 0 }]
        ], MAGE_REST),
        // Ethereal Bouncebolt: hold the staff up to gather, then throw it forward two-handed
        cast: hclip('cast', 1.3, false, [
            [0, {}],
            [0.3, { hx: 2, hy: -2, wa: -1.57, bhx: 6, bhy: 0, glow: 0.6, crouch: 1, fxk: FXK.Gather }, Ease.Out, CH],
            [0.5, { glow: 0.9 }, Ease.InOut, CH],
            [0.6, { hx: 10, hy: 1, wa: -0.3, bhx: 10, bhy: 3, lean: 2, crouch: 0, glow: 1, fxk: FXK.Burst }, Ease.Out, CA],
            [0.8, { fxk: 0 }, Ease.Hold, RE],
            [1.3, { hx: 4, hy: 6, wa: -1.35, bhx: 1, bhy: 6, lean: 0, glow: 0 }]
        ], MAGE_REST),
        hit: hitClip(MAGE_REST),
        death: deathClip(MAGE_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Wizard (elite)
// A proper wizard now: starred robe, wide-brimmed pointed hat, orb staff and a spellbook.

const WIZARD_REST = rest({ hx: 4, hy: 6, wa: -1.4, bhx: 4, bhy: 3, ffx: 2, bfx: -2 })

const wizard: HeroArt = {
    look: baseLook({
        accent: C.cyan,
        arm: C.blue1, armLow: C.night3, armBack: C.blue0, armBackLow: C.blue1, hand: C.skin1,
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.blue1)
            rect(s, x - 4, y, 1, 9, C.blue0)
            rect(s, x + 1, y, 2, 9, C.blue2)
            rect(s, x + 3, y, 1, 9, C.gold1)
            px(s, x - 2, y + 3, C.gold3); px(s, x, y + 6, C.gold3) // stars
            rect(s, x - 4, y + 7, 8, 1, C.gold1)
        },
        lower: robeLower(ROBE_BLUE, C.gold1, C.night0),
        head: (s, x, y, p) => {
            heroFace(s, x, y, p)
            heroHair(s, x, y, 1)
            rect(s, x - 5, y - 8, 11, 1, C.blue1)
            rect(s, x - 4, y - 9, 9, 1, C.blue2)
            rect(s, x - 3, y - 12, 6, 3, C.blue1)
            rect(s, x - 1, y - 12, 2, 3, C.blue2)
            rect(s, x - 2, y - 15, 4, 3, C.blue1)
            rect(s, x - 2, y - 17, 3, 2, C.blue1)
            px(s, x - 3, y - 18, C.blue1); px(s, x - 4, y - 18, C.blue0); px(s, x - 5, y - 17, C.blue0)
            rect(s, x - 3, y - 10, 6, 1, C.gold1)
            px(s, x, y - 14, C.gold3)
        },
        weapon: (s, x, y, p, t) => staff(s, x, y, p[HP.wa]!, 13, M.wood, M.ice, Gem.Orb, p[HP.glow]!, t),
        offhand: (s, x, y, p) => tome(s, x + 1, y, [C.purple0, C.purple1, C.purple2], p[HP.glow]!),
        fx: (dst, p, t) => {
            if (is(p, FXK.Burst)) sparks(dst, tip.x + 2, tip.y, 5, 7, step(t, 10, 5), C.cyan, C.white)
            if (is(p, FXK.Gather)) gatherFx(dst, tip.x, tip.y, t, C.blue2, C.cyan)
            if (is(p, FXK.Crackle)) {
                // a forked bolt from the orb straight up
                let x = tip.x
                const k = step(t, 10, 3)
                for (let yy = tip.y - 2; yy > tip.y - 22; yy--) {
                    if (((yy + k * 5) % 4) === 0) x += ((yy * 7 + k) & 2) - 1
                    dst.set(fxX(x), fxY(yy), (yy & 3) ? C.cyan : C.white)
                }
                sparks(dst, tip.x, tip.y, 4, 5, k + 30, C.frost, C.white)
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.4, true, [[0, {}], [0.7, { crouch: 1, hy: 7, bhy: 4 }], [1.4, {}]], WIZARD_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { hx: 5, hy: 1, wa: -1.6, lean: -1, glow: 0.3 }, Ease.Out, CH],
            [0.3, { glow: 0.7, fxk: FXK.Gather }, Ease.InOut, CH],
            [0.4, { hx: 10, hy: 1, wa: -0.3, lean: 2, glow: 1, fxk: FXK.Burst }, Ease.Out, CA],
            [0.5, { fxk: 0, glow: 0.5 }, Ease.Out, RE],
            [0.9, { hx: 4, hy: 6, wa: -1.4, lean: 0, glow: 0 }]
        ], WIZARD_REST),
        // Lightning Storm: rise on the air, staff overhead, book blazing
        cast: hclip('cast', 1.4, false, [
            [0, {}],
            [0.3, { jump: -2, hx: 1, hy: -8, wa: -1.57, bhx: 6, bhy: 1, glow: 0.6, fxk: FXK.Gather }, Ease.Out, CH],
            [0.5, { jump: -3, glow: 0.8 }, Ease.InOut, CH],
            [0.6, { jump: -4, glow: 1, fxk: FXK.Crackle, headY: -1 }, Ease.Out, CA],
            [1.0, { jump: -3 }, Ease.Linear],
            [1.1, { fxk: 0 }, Ease.Hold, RE],
            [1.4, { jump: 0, hx: 4, hy: 6, wa: -1.4, bhx: 4, bhy: 3, glow: 0, headY: 0 }]
        ], WIZARD_REST),
        hit: hitClip(WIZARD_REST),
        death: deathClip(WIZARD_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Sorcerer (master)
// He no longer touches the ground: crimson robe, high black collar, a flame staff and a
// fire orb orbiting his off hand.

const ROBE_RED: Mat = [C.red0, C.red1, C.red2]
const SORCERER_REST = rest({ hx: 4, hy: 6, wa: -1.35, bhx: 3, bhy: 3, ffx: 2, bfx: -2, jump: -2 })

const sorcerer: HeroArt = {
    look: baseLook({
        accent: C.orange,
        arm: C.red1, armLow: C.void, armBack: C.red0, armBackLow: C.void, hand: C.skin1,
        back: (s, x, y) => {
            // high collar behind the head
            rect(s, x - 5, y - 5, 2, 6, C.void)
            rect(s, x - 4, y - 7, 2, 2, C.void)
            px(s, x - 5, y - 6, C.purple0)
        },
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.red1)
            rect(s, x - 4, y, 1, 9, C.red0)
            rect(s, x - 1, y, 3, 9, C.void)
            px(s, x, y + 1, C.gold2); px(s, x, y + 4, C.gold2)
            rect(s, x + 2, y + 1, 1, 6, C.red2)
            rect(s, x - 4, y + 7, 8, 1, C.gold1)
        },
        lower: (s, x, hipY, p, t) => {
            const sway = (Math.floor(t * 3) & 1) - 1
            robeSkirt(s, x, hipY, hipY + 9, ROBE_RED, C.gold1, sway - 1, C.void, 0)
            // tattered hem instead of boots
            px(s, x - 5 + sway, hipY + 10, C.red0); px(s, x - 1 + sway, hipY + 10, C.red1); px(s, x + 3 + sway, hipY + 10, C.red0)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p, p[HP.glow]! > 0.5 ? C.orange : C.ink)
            heroHair(s, x, y, 0)
            rect(s, x - 3, y - 8, 7, 1, C.gold0)
            px(s, x + 2, y - 8, C.red2); px(s, x + 2, y - 9, C.lava1)
        },
        weapon: (s, x, y, p, t) => staff(s, x, y, p[HP.wa]!, 13, M.obsidian, M.lava, Gem.Flame, p[HP.glow]!, t),
        offhand: (s, x, y, p, t) => orb(s, x + 1, y - 4 + ((Math.floor(t * 4) & 1)), M.lava, p[HP.glow]!, t),
        fx: (dst, p, t) => {
            const k = step(t, 10, 8)
            // runes circling him whenever he's lit
            if (p[HP.glow]! > 0.3 || is(p, FXK.Embers)) {
                for (let i = 0; i < 3; i++) {
                    const a = (k / 8 + i / 3) * Math.PI * 2
                    const rx = J.bx + Math.round(Math.cos(a) * 9)
                    const ry = J.topY + 5 + Math.round(Math.sin(a) * 3)
                    dst.set(fxX(rx), fxY(ry), C.gold3); dst.set(fxX(rx + 1), fxY(ry), C.orange)
                }
            }
            if (is(p, FXK.Burst)) sparks(dst, tip.x + 2, tip.y, 6, 8, step(t, 10, 5), C.orange, C.gold3)
            if (is(p, FXK.Embers)) {
                for (let i = 0; i < 8; i++) {
                    const hx = J.bx - 10 + ((i * 7 + k * 2) % 21)
                    const hy = J.topY - 4 - ((i * 5 + k * 3) % 14)
                    dst.set(fxX(hx), fxY(hy), i & 1 ? C.lava1 : C.gold2)
                }
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.6, true, [[0, {}], [0.8, { jump: -3, hy: 7, bhy: 4 }], [1.6, {}]], SORCERER_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { hx: 5, hy: 1, wa: -1.6, lean: -1, glow: 0.4, bhx: 7, bhy: 1 }, Ease.Out, CH],
            [0.3, { glow: 0.7 }, Ease.InOut, CH],
            [0.4, { hx: 10, hy: 2, wa: -0.25, lean: 2, glow: 1, fxk: FXK.Burst }, Ease.Out, CA],
            [0.5, { fxk: 0, glow: 0.5 }, Ease.Out, RE],
            [0.9, { hx: 4, hy: 6, wa: -1.35, bhx: 3, bhy: 3, lean: 0, glow: 0 }]
        ], SORCERER_REST),
        // Meteor Shower: rise, both arms to the sky, embers pouring upward
        cast: hclip('cast', 1.5, false, [
            [0, {}],
            [0.3, { jump: -4, hx: 2, hy: -6, wa: -1.57, bhx: 1, bhy: -7, glow: 0.6, headY: -1 }, Ease.Out, CH],
            [0.5, { jump: -6, glow: 0.9, fxk: FXK.Embers }, Ease.InOut, CH],
            [0.7, { jump: -6, glow: 1, hx: 4, hy: -9, bhx: 2, bhy: -9, mouth: 1 }, Ease.Out, CA],
            [1.1, { jump: -5 }, Ease.Linear],
            [1.2, { fxk: 0, mouth: 0 }, Ease.Hold, RE],
            [1.5, { jump: -2, hx: 4, hy: 6, wa: -1.35, bhx: 3, bhy: 3, glow: 0, headY: 0 }]
        ], SORCERER_REST),
        hit: hitClip(SORCERER_REST),
        death: deathClip(SORCERER_REST, { jump: 0 })
    }
}

// ═══════════════════════════════════════════════════════════════ Shaman (elite)
// Leather and fur, a feathered headband, bone beads, and a carved spirit-totem staff.

const SHAMAN_REST = rest({ hx: 4, hy: 7, wa: -1.45, bhx: 2, bhy: 6, ffx: 3, bfx: -3 })

const shaman: HeroArt = {
    look: baseLook({
        accent: C.teal3,
        pants: C.brown1, pantsDk: C.brown0, boot: C.bone0, bootHi: C.bone1,
        arm: C.brown2, armLow: C.skin1, armBack: C.brown1, armBackLow: C.skin0,
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.brown2)
            rect(s, x - 4, y, 1, 9, C.brown1)
            rect(s, x + 2, y + 1, 1, 6, C.brown3)
            rect(s, x - 5, y - 1, 10, 2, C.bone0) // fur mantle
            px(s, x - 4, y + 1, C.bone0); px(s, x + 3, y + 1, C.bone0); px(s, x, y - 1, C.bone1)
            for (let i = 0; i < 4; i++) px(s, x - 2 + i, y + 3 + (i & 1), i === 2 ? C.teal2 : C.bone1) // beads
            rect(s, x - 4, y + 6, 8, 1, C.teal1)
            px(s, x + 1, y + 6, C.teal3)
            rect(s, x - 4, y + 8, 8, 1, C.brown1)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p)
            heroHair(s, x, y, 1)
            rect(s, x - 3, y - 9, 6, 2, C.brown2)
            rect(s, x - 3, y - 8, 7, 1, C.red1)
            px(s, x + 1, y - 8, C.teal3)
            // feathers standing at the back
            line(s, x - 3, y - 9, x - 4, y - 14, C.white); px(s, x - 4, y - 14, C.teal2)
            line(s, x - 2, y - 9, x - 2, y - 13, C.red2)
            line(s, x - 4, y - 8, x - 6, y - 12, C.teal2); px(s, x - 6, y - 12, C.ink)
            px(s, x + 2, y - 6, C.teal2) // face paint over the brow
        },
        weapon: (s, x, y, p, t) => staff(s, x, y, p[HP.wa]!, 16, M.wood, M.sea, Gem.Totem, p[HP.glow]!, t),
        fx: (dst, p, t) => {
            if (is(p, FXK.Burst)) sparks(dst, tip.x + 2, tip.y - 2, 5, 7, step(t, 10, 5), C.teal3, C.white)
            if (is(p, FXK.Gust)) {
                const k = step(t, 10, 6)
                for (let i = 0; i < 3; i++) {
                    const r = 7 + i * 4
                    const a0 = k * 0.9 + i * 2
                    arcFx(dst, J.bx, J.topY + 4, r, a0, a0 + 1.6, i === 1 ? C.white : C.teal3)
                }
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.4, true, [[0, {}], [0.7, { crouch: 1, hy: 8, bhy: 7, wa: -1.4 }], [1.4, {}]], SHAMAN_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { hx: 5, hy: 0, wa: -1.5, lean: -1 }, Ease.Out, CH],
            [0.2, { hx: 6, hy: -2, wa: -1.35, glow: 0.5 }, Ease.InOut, CH],
            [0.3, { hx: 5, hy: 0, wa: -1.65, glow: 0.7 }, Ease.InOut, CH],
            [0.4, { hx: 9, hy: 2, wa: -0.4, lean: 2, glow: 1, fxk: FXK.Burst }, Ease.Out, CA],
            [0.5, { fxk: 0, glow: 0.4 }, Ease.Out, RE],
            [0.9, { hx: 4, hy: 7, wa: -1.45, lean: 0, glow: 0 }]
        ], SHAMAN_REST),
        // Totem Storm: plant the totem, arms up, the wind wheels around him
        cast: hclip('cast', 1.4, false, [
            [0, {}],
            [0.2, { hx: 3, hy: -4, wa: -1.57, jump: -2, glow: 0.3 }, Ease.Out, CH],
            [0.4, { hx: 6, hy: 9, wa: 1.45, jump: 0, crouch: 2, glow: 0.6 }, Ease.In, CH],
            [0.5, { hx: 6, hy: 9, bhx: 1, bhy: -8, crouch: 0, headY: -1, mouth: 1, glow: 1, fxk: FXK.Gust }, Ease.Out, CA],
            [1.0, {}, Ease.Linear],
            [1.1, { fxk: 0, mouth: 0 }, Ease.Hold, RE],
            [1.4, { hx: 4, hy: 7, wa: -1.45, bhx: 2, bhy: 6, headY: 0, glow: 0 }]
        ], SHAMAN_REST),
        hit: hitClip(SHAMAN_REST),
        death: deathClip(SHAMAN_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Witch Doctor (master)
// Bone-painted chest, straw skirt, a carved mask pushed up on his head so his face still
// shows, a voodoo doll and a skull staff burning green.

const POISON: Mat = [C.green1, C.green3, C.green4]
const WITCH_REST = rest({ hx: 4, hy: 6, wa: -1.3, bhx: 2, bhy: 6, ffx: 3, bfx: -3, tilt: 1, crouch: 1 })

const witchDoctor: HeroArt = {
    look: baseLook({
        accent: C.green4,
        pants: C.skin1, pantsDk: C.skin0, boot: C.brown1, bootHi: C.brown2,
        arm: C.skin1, armLow: C.skin1, armBack: C.skin0, armBackLow: C.skin0, hand: C.skin1,
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.skin1)
            rect(s, x - 4, y, 1, 9, C.skin0)
            // bone paint: ribs
            for (let i = 0; i < 3; i++) rect(s, x - 2, y + 2 + i * 2, 4, 1, C.bone1)
            rect(s, x, y + 1, 1, 6, C.bone1)
            for (let i = 0; i < 5; i++) px(s, x - 3 + i * 2 - (i >> 2), y + (i & 1), i === 2 ? C.white : C.bone0) // tooth necklace
            // straw skirt over the hips
            for (let i = 0; i < 9; i++) {
                const len = 4 + ((i * 3) % 3)
                line(s, x - 4 + i, y + 7, x - 4 + i - (i < 4 ? 1 : 0), y + 7 + len, i & 1 ? C.olive2 : C.olive1)
            }
            rect(s, x - 4, y + 7, 8, 1, C.red1)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p, p[HP.glow]! > 0.5 ? C.green4 : C.ink)
            heroHair(s, x, y, 1)
            // mask pushed up onto the crown
            rect(s, x - 2, y - 13, 6, 5, C.bone1)
            rect(s, x - 2, y - 13, 1, 5, C.bone0)
            px(s, x, y - 11, C.ink); px(s, x + 2, y - 11, C.ink)
            rect(s, x - 1, y - 9, 4, 1, C.red1)
            px(s, x + 1, y - 13, C.green3); px(s, x + 1, y - 12, C.green3)
            line(s, x - 3, y - 13, x - 5, y - 16, C.bone1) // horns on the mask
            line(s, x + 3, y - 13, x + 5, y - 16, C.bone1)
            px(s, x - 1, y - 2, C.white) // bone earring
        },
        weapon: (s, x, y, p, t) => staff(s, x, y, p[HP.wa]!, 12, M.darkwood, POISON, Gem.Skull, p[HP.glow]!, t),
        offhand: (s, x, y) => {
            // voodoo doll
            rect(s, x - 1, y - 2, 3, 4, C.olive2)
            px(s, x, y - 3, C.olive2); px(s, x - 1, y - 2, C.olive1)
            px(s, x, y - 1, C.red2); px(s, x + 1, y, C.steel3)
        },
        fx: (dst, p, t) => {
            if (is(p, FXK.Burst)) sparks(dst, tip.x + 2, tip.y, 5, 7, step(t, 10, 5), C.green4, C.green3)
            if (is(p, FXK.Rise)) {
                const k = step(t, 10, 6)
                for (let i = 0; i < 6; i++) {
                    const hx = J.bx + 8 + i * 3
                    const hy = J.oy - 1 - ((i * 3 + k * 2) % 9)
                    dst.set(fxX(hx), fxY(hy), i & 1 ? C.green4 : C.green3)
                    dst.set(fxX(hx), fxY(hy + 1), C.green2)
                }
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.2, true, [
            [0, {}], [0.3, { lean: 1, hy: 7 }], [0.6, { crouch: 2, lean: 0 }], [0.9, { lean: -1, hy: 5 }], [1.2, {}]
        ], WITCH_REST),
        attack: hclip('attack', 0.9, false, [
            [0, {}],
            [0.1, { hx: 5, hy: 2, wa: -1.6, lean: -1, glow: 0.4 }, Ease.Out, CH],
            [0.3, { glow: 0.8 }, Ease.InOut, CH],
            [0.4, { hx: 10, hy: 3, wa: -0.3, lean: 2, glow: 1, fxk: FXK.Burst, bhx: -3 }, Ease.Out, CA],
            [0.5, { fxk: 0, glow: 0.4 }, Ease.Out, RE],
            [0.9, { hx: 4, hy: 6, wa: -1.3, bhx: 2, lean: 0, glow: 0 }]
        ], WITCH_REST),
        // Raise Dead: stoop, palms down, then drag the dead up out of the ground
        cast: hclip('cast', 1.4, false, [
            [0, {}],
            [0.3, { crouch: 3, tilt: 2, hx: 7, hy: 10, wa: 1.2, bhx: 8, bhy: 10, headY: 1, glow: 0.5 }, Ease.Out, CH],
            [0.5, { glow: 0.8, fxk: FXK.Rise }, Ease.InOut, CH],
            [0.7, { crouch: 0, tilt: -1, hx: 6, hy: -5, wa: -1.2, bhx: 6, bhy: -4, headY: -1, glow: 1, mouth: 1 }, Ease.Out, CA],
            [1.0, {}, Ease.Linear],
            [1.1, { fxk: 0, mouth: 0 }, Ease.Hold, RE],
            [1.4, { crouch: 1, tilt: 1, hx: 4, hy: 6, wa: -1.3, bhx: 2, bhy: 6, headY: 0, glow: 0 }]
        ], WITCH_REST),
        hit: hitClip(WITCH_REST),
        death: deathClip(WITCH_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Archer (base)
// The tunic under a green hooded cloak, hood down, a wooden short bow and a quiver.

const ARCHER_REST = rest({ hx: 4, hy: 6, wa: 0.3, bhx: 0, bhy: 6, ffx: 3, bfx: -3 })

function quiver(s: Surface, x: number, y: number, body: number, fletch: number): void {
    line(s, x - 5, y + 1, x - 3, y + 9, body, 2)
    px(s, x - 6, y, fletch); px(s, x - 5, y - 1, fletch); px(s, x - 4, y, C.bone1)
}

const archer: HeroArt = {
    look: baseLook({
        accent: C.green4,
        armLow: C.brown2, armBackLow: C.brown1,
        back: (s, x, y, p, t) => {
            cape(s, x - 1, y, 13, Math.floor(t * 3) & 1, C.green1, C.green0)
            quiver(s, x, y, C.brown1, C.red2)
        },
        torso: (s, x, y) => {
            tunic(s, x, y, 10, TUNIC, C.brown1, C.gold1)
            rect(s, x - 4, y + 1, 3, 6, C.brown2) // leather vest front
            px(s, x - 2, y + 2, C.brown3)
            rect(s, x - 4, y - 1, 6, 2, C.green2) // hood lying at the neck
            px(s, x - 5, y, C.green1)
            line(s, x + 3, y, x - 3, y + 6, C.brown1)
        },
        head: (s, x, y, p) => { heroFace(s, x, y, p); heroHair(s, x, y, 0) },
        weapon: bowPainter(M.wood, 8),
        fx: (dst, p, t) => {
            if (is(p, FXK.Release)) releaseFx(dst, p, C.bone1)
            if (is(p, FXK.Aim)) gatherFx(dst, J.hx + 6, J.hy, t, C.green4, C.white)
            if (is(p, FXK.BigRelease)) releaseFx(dst, p, C.green4, true)
        }
    }),
    clips: {
        idle: hclip('idle', 1.2, true, [[0, {}], [0.6, { crouch: 1, hy: 8, bhy: 7 }], [1.2, {}]], ARCHER_REST),
        attack: bowAttack(ARCHER_REST, 1),
        // Piercing Arrow: kneel for a long draw, the head glowing, then a punching release
        cast: hclip('cast', 1.3, false, [
            [0, {}],
            [0.2, { wa: 0, hx: 8, hy: 1, bhx: 11, bhy: 1, crouch: 2, ffx: 5, aux: 0.1 }, Ease.Out, CH],
            [0.6, { aux: 1, bhx: 3, glow: 0.8, fxk: FXK.Aim }, Ease.InOut, CH],
            [0.7, { aux: 0, bhx: -3, bhy: 0, lean: -2, glow: 1, fxk: FXK.BigRelease }, Ease.Hold, CA],
            [0.8, { fxk: 0 }, Ease.Hold, RE],
            [1.3, { wa: 0.3, hx: 4, hy: 6, bhx: 0, bhy: 6, crouch: 0, ffx: 3, lean: 0, glow: 0 }]
        ], ARCHER_REST),
        hit: hitClip(ARCHER_REST),
        death: deathClip(ARCHER_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Bowman (elite)
// A feathered cap, green jerkin with a shoulder capelet, and a longbow nearly his height.

const BOWMAN_REST = rest({ hx: 4, hy: 6, wa: 0.3, bhx: 0, bhy: 6, ffx: 3, bfx: -3 })

const bowman: HeroArt = {
    look: baseLook({
        accent: C.green4,
        pants: C.brown1, pantsDk: C.brown0, boot: C.brown0, bootHi: C.brown3,
        arm: C.green2, armLow: C.brown2, armBack: C.green1, armBackLow: C.brown1,
        back: (s, x, y) => quiver(s, x, y, C.brown2, C.white),
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.green2)
            rect(s, x - 4, y, 1, 9, C.green1)
            rect(s, x + 2, y + 1, 1, 5, C.green3)
            rect(s, x - 5, y - 1, 9, 3, C.green1) // capelet
            px(s, x - 5, y + 2, C.green1); px(s, x - 2, y + 2, C.green1); px(s, x + 1, y + 2, C.green1)
            rect(s, x - 4, y + 6, 8, 1, C.brown1)
            px(s, x + 1, y + 6, C.gold2)
            px(s, x + 1, y - 1, C.bone1)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p)
            heroHair(s, x, y, 1)
            rect(s, x - 3, y - 10, 6, 2, C.green2)
            rect(s, x - 2, y - 11, 3, 1, C.green2)
            px(s, x + 3, y - 9, C.green2); px(s, x + 4, y - 9, C.green1) // peak
            px(s, x - 4, y - 10, C.green1)
            rect(s, x - 3, y - 9, 6, 1, C.green1)
            line(s, x - 2, y - 11, x - 7, y - 14, C.red2); px(s, x - 7, y - 14, C.red3)
        },
        weapon: bowPainter(M.wood, 11),
        fx: (dst, p, t) => {
            if (is(p, FXK.Release)) releaseFx(dst, p, C.bone1)
            if (is(p, FXK.Aim)) gatherFx(dst, J.hx + 6, J.hy, t, C.green3, C.white)
            if (is(p, FXK.Fan)) {
                const a = p[HP.wa]!
                for (let i = -1; i <= 1; i++) {
                    const b = a + i * 0.35
                    streak(dst, J.hx + Math.cos(b) * 14, J.hy + Math.sin(b) * 14, b, 9, C.bone1)
                }
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.3, true, [[0, {}], [0.65, { crouch: 1, hy: 7, bhy: 7 }], [1.3, {}]], BOWMAN_REST),
        attack: bowAttack(BOWMAN_REST, 1),
        // Fan of Arrows: aim high, draw three at once, loose them in a spread
        cast: hclip('cast', 1.3, false, [
            [0, {}],
            [0.2, { wa: -0.35, hx: 7, hy: -2, bhx: 10, bhy: -2, aux: 0.1, lean: -1 }, Ease.Out, CH],
            [0.5, { aux: 1, bhx: 3, glow: 0.6, fxk: FXK.Aim }, Ease.InOut, CH],
            [0.6, { aux: 0, bhx: -3, bhy: -3, glow: 1, fxk: FXK.Fan, lean: -2 }, Ease.Hold, CA],
            [0.7, { fxk: 0 }, Ease.Hold, RE],
            [1.3, { wa: 0.3, hx: 4, hy: 6, bhx: 0, bhy: 6, lean: 0, glow: 0 }]
        ], BOWMAN_REST),
        hit: hitClip(BOWMAN_REST),
        death: deathClip(BOWMAN_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Marksman (master)
// A long teal duster, a wide-brimmed feathered hat, a red scarf, and a gilded war bow.

const GILDED: Mat = [C.gold0, C.brown1, C.gold2]
const MARKSMAN_REST = rest({ hx: 4, hy: 6, wa: 0.3, bhx: 0, bhy: 6, ffx: 3, bfx: -3 })

const marksman: HeroArt = {
    look: baseLook({
        accent: C.gold3,
        pants: C.stone1, pantsDk: C.stone0, boot: C.brown0, bootHi: C.brown2,
        arm: C.teal1, armLow: C.teal2, armBack: C.teal0, armBackLow: C.teal1,
        back: (s, x, y) => quiver(s, x, y, C.brown0, C.gold2),
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.teal1)
            rect(s, x - 4, y, 1, 9, C.teal0)
            rect(s, x + 1, y + 1, 2, 7, C.teal2)
            rect(s, x - 1, y, 2, 3, C.red2) // scarf
            px(s, x - 3, y + 1, C.red1); px(s, x - 4, y + 2, C.red1)
            rect(s, x - 4, y + 6, 8, 1, C.brown0)
            px(s, x + 1, y + 6, C.gold2)
            // duster tails to the knee
            rect(s, x - 5, y + 9, 4, 4, C.teal1); px(s, x - 5, y + 12, C.teal0)
            rect(s, x + 2, y + 9, 2, 3, C.teal0)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p)
            heroHair(s, x, y, 1)
            rect(s, x - 6, y - 8, 12, 1, C.brown1) // brim
            rect(s, x - 3, y - 11, 6, 3, C.brown1)
            rect(s, x - 2, y - 12, 4, 1, C.brown1)
            rect(s, x - 3, y - 9, 6, 1, C.gold1)
            px(s, x - 1, y - 11, C.brown2)
            line(s, x - 3, y - 10, x - 8, y - 13, C.white); px(s, x - 8, y - 13, C.steel3)
        },
        weapon: bowPainter(GILDED, 11, C.gold3),
        fx: (dst, p, t) => {
            if (is(p, FXK.Release)) releaseFx(dst, p, C.gold3)
            if (is(p, FXK.Aim)) gatherFx(dst, J.hx + 6, J.hy - 4, t, C.gold3, C.white)
            if (is(p, FXK.Volley)) {
                const a = p[HP.wa]!
                for (let i = 0; i < 3; i++) streak(dst, J.hx + Math.cos(a) * (14 + i * 3) - i, J.hy + Math.sin(a) * (14 + i * 3) + i * 2, a, 10, C.gold3)
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.4, true, [[0, {}], [0.7, { crouch: 1, hy: 7, bhy: 7 }], [1.4, {}]], MARKSMAN_REST),
        // Kneeling precision shot
        attack: hclip('attack', 1.0, false, [
            [0, {}],
            [0.1, { kneel: 1, crouch: 3, wa: 0, hx: 8, hy: 0, bhx: 11, bhy: 0, aux: 0.1, ffx: 5 }, Ease.Out, CH],
            [0.3, { aux: 1, bhx: 4 }, Ease.InOut, CH],
            [0.4, { aux: 0, bhx: -2, bhy: -1, fxk: FXK.Release, lean: -1 }, Ease.Hold, CA],
            [0.5, { fxk: 0 }, Ease.Hold, RE],
            [0.7, {}, Ease.Linear],
            [1.0, { kneel: 0, crouch: 0, wa: 0.3, hx: 4, hy: 6, bhx: 0, bhy: 6, ffx: 3, lean: 0 }]
        ], MARKSMAN_REST),
        // Arrow Rain: aim steeply skyward and empty the quiver
        cast: hclip('cast', 1.4, false, [
            [0, {}],
            [0.2, { wa: -1.1, hx: 4, hy: -6, bhx: 8, bhy: -5, aux: 0.1, lean: -2, tilt: -1 }, Ease.Out, CH],
            [0.5, { aux: 1, bhx: 1, bhy: -1, glow: 0.7, fxk: FXK.Aim }, Ease.InOut, CH],
            [0.6, { aux: 0, bhx: -2, bhy: 1, fxk: FXK.Volley, glow: 1 }, Ease.Hold, CA],
            [0.7, { aux: 0.8, bhx: 2, fxk: 0 }, Ease.Out, CA],
            [0.8, { aux: 0, bhx: -2, fxk: FXK.Volley }, Ease.Hold, CA],
            [0.9, { fxk: 0 }, Ease.Hold, RE],
            [1.4, { wa: 0.3, hx: 4, hy: 6, bhx: 0, bhy: 6, lean: 0, tilt: 0, glow: 0 }]
        ], MARKSMAN_REST),
        hit: hitClip(MARKSMAN_REST),
        death: deathClip(MARKSMAN_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Hunter (elite)
// A fox-eared fur hood up over his hair, fur-trimmed leathers, twin quivers, a recurve bow.
// Basic Attack looses three (strikesPerAttack 3).

const HUNTER_REST = rest({ hx: 4, hy: 6, wa: 0.3, bhx: 0, bhy: 6, ffx: 3, bfx: -3 })

const hunter: HeroArt = {
    look: baseLook({
        accent: C.orange,
        pants: C.brown1, pantsDk: C.brown0, boot: C.brown0, bootHi: C.bone0,
        arm: C.brown2, armLow: C.brown3, armBack: C.brown1, armBackLow: C.brown2,
        back: (s, x, y) => { quiver(s, x, y, C.brown1, C.red2); quiver(s, x - 2, y + 1, C.brown0, C.bone1) },
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.brown2)
            rect(s, x - 4, y, 1, 9, C.brown1)
            rect(s, x + 1, y + 1, 2, 5, C.brown3)
            rect(s, x - 5, y - 1, 10, 2, C.orange) // fur collar
            px(s, x - 4, y + 1, C.bone1); px(s, x + 2, y + 1, C.bone1)
            rect(s, x - 4, y + 6, 8, 1, C.brown0)
            px(s, x - 1, y + 6, C.bone1)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p)
            heroHair(s, x, y, 2)
            rect(s, x - 3, y - 10, 7, 3, C.orange)
            rect(s, x - 4, y - 8, 3, 6, C.orange)
            rect(s, x - 2, y - 11, 4, 1, C.orange)
            px(s, x - 5, y - 5, C.lava0); px(s, x - 4, y - 3, C.lava0)
            rect(s, x - 1, y - 10, 3, 1, C.gold2)
            // fox ears
            px(s, x - 2, y - 12, C.orange); px(s, x - 2, y - 13, C.bone1)
            px(s, x + 2, y - 12, C.orange); px(s, x + 2, y - 13, C.bone1)
            px(s, x + 3, y - 8, C.bone1)
        },
        weapon: bowPainter(M.darkwood, 8),
        fx: (dst, p, t) => {
            if (is(p, FXK.Release)) releaseFx(dst, p, C.orange)
            if (is(p, FXK.Aim)) {
                // the target sigil Kill Shot paints
                const x = J.hx + 16
                const y = J.hy
                const k = step(t, 10, 2)
                for (let i = -3; i <= 3; i++) {
                    if (Math.abs(i) < 2) continue
                    dst.set(fxX(x + i), fxY(y), k ? C.red3 : C.red2)
                    dst.set(fxX(x), fxY(y + i), k ? C.red3 : C.red2)
                }
            }
            if (is(p, FXK.BigRelease)) releaseFx(dst, p, C.red2, true)
        }
    }),
    clips: {
        idle: hclip('idle', 1.2, true, [[0, {}], [0.6, { crouch: 1, hy: 8, bhy: 7 }], [1.2, {}]], HUNTER_REST),
        attack: bowAttack(HUNTER_REST, 3, 0, 1.1),
        // Kill Shot: crouch low, paint the target, loose one killing arrow
        cast: hclip('cast', 1.3, false, [
            [0, {}],
            [0.2, { wa: 0, hx: 8, hy: 1, bhx: 11, bhy: 1, crouch: 3, kneel: 1, ffx: 5, aux: 0.1 }, Ease.Out, CH],
            [0.6, { aux: 1, bhx: 3, glow: 0.8, fxk: FXK.Aim }, Ease.InOut, CH],
            [0.7, { aux: 0, bhx: -3, lean: -2, glow: 1, fxk: FXK.BigRelease }, Ease.Hold, CA],
            [0.8, { fxk: 0 }, Ease.Hold, RE],
            [1.3, { wa: 0.3, hx: 4, hy: 6, bhx: 0, bhy: 6, crouch: 0, kneel: 0, ffx: 3, lean: 0, glow: 0 }]
        ], HUNTER_REST),
        hit: hitClip(HUNTER_REST),
        death: deathClip(HUNTER_REST)
    }
}

// ═══════════════════════════════════════════════════════════════ Beast Master (master)
// A wolf's pelt worn as a cloak with its head for a hood, bone charms and a horn. The Wolf
// itself is a summon (summons.ts). Basic Attack looses four (strikesPerAttack 4).

const BEAST_REST = rest({ hx: 4, hy: 6, wa: 0.3, bhx: 0, bhy: 6, ffx: 3, bfx: -3 })

const beastMaster: HeroArt = {
    look: baseLook({
        accent: C.steel3,
        pants: C.brown1, pantsDk: C.brown0, boot: C.stone1, bootHi: C.stone3,
        arm: C.brown2, armLow: C.skin1, armBack: C.brown1, armBackLow: C.skin0,
        back: (s, x, y, p, t) => {
            cape(s, x - 1, y, 14, Math.floor(t * 3) & 1, C.stone2, C.stone1)
            px(s, x - 6, y + 13, C.stone3); px(s, x - 8, y + 14, C.stone2) // tail tuft
        },
        torso: (s, x, y) => {
            rect(s, x - 4, y, 8, 9, C.brown2)
            rect(s, x - 4, y, 1, 9, C.brown1)
            rect(s, x + 2, y + 1, 1, 5, C.brown3)
            rect(s, x - 5, y - 1, 9, 2, C.stone3) // pelt over the shoulders
            px(s, x - 3, y + 1, C.stone2); px(s, x + 2, y + 1, C.stone2)
            px(s, x - 1, y + 3, C.bone1); px(s, x, y + 4, C.white); px(s, x + 1, y + 3, C.bone1) // claw charm
            rect(s, x - 4, y + 6, 8, 1, C.brown0)
            // horn at the belt
            rect(s, x - 3, y + 7, 3, 1, C.bone1); px(s, x - 4, y + 6, C.bone0)
        },
        head: (s, x, y, p) => {
            heroFace(s, x, y, p)
            heroHair(s, x, y, 2)
            // wolf head hood: skull cap, ears, snout over the brow
            rect(s, x - 4, y - 10, 7, 4, C.stone2)
            rect(s, x - 3, y - 11, 5, 1, C.stone3)
            rect(s, x - 4, y - 7, 2, 6, C.stone2)
            px(s, x - 3, y - 12, C.stone3); px(s, x - 3, y - 13, C.stone1) // ear
            px(s, x, y - 12, C.stone3); px(s, x, y - 13, C.stone1) // ear
            rect(s, x + 2, y - 8, 3, 2, C.stone3) // snout
            px(s, x + 4, y - 8, C.ink)
            px(s, x + 2, y - 7, C.white); px(s, x + 4, y - 7, C.white) // teeth
            px(s, x + 1, y - 9, C.gold2) // glass eye
        },
        weapon: bowPainter(M.wood, 9, C.bone1),
        fx: (dst, p, t) => {
            if (is(p, FXK.Release)) releaseFx(dst, p, C.steel3)
            if (is(p, FXK.Whistle)) {
                const k = step(t, 10, 3)
                for (let i = 0; i < 3; i++) {
                    const r = 3 + ((i * 3 + k * 2) % 8)
                    arcFx(dst, J.headX + 3, J.headY - 2, r, -0.6, 0.6, i === 0 ? C.white : C.steel3)
                }
            }
        }
    }),
    clips: {
        idle: hclip('idle', 1.3, true, [[0, {}], [0.65, { crouch: 1, hy: 8, bhy: 7 }], [1.3, {}]], BEAST_REST),
        attack: bowAttack(BEAST_REST, 4, 0, 1.2),
        // Man's Best Friend: fingers to his lips, a whistle, then point the wolf in
        cast: hclip('cast', 1.3, false, [
            [0, {}],
            [0.2, { bhx: 6, bhy: -4, headY: 0, crouch: 1 }, Ease.Out, CH],
            [0.3, { fxk: FXK.Whistle, mouth: 0 }, Ease.Hold, CH],
            [0.6, { fxk: 0 }, Ease.Hold, CH],
            [0.7, { bhx: 13, bhy: 0, lean: 2, tilt: 1, ffx: 5, mouth: 1, glow: 1 }, Ease.Out, CA],
            [1.0, { mouth: 0 }, Ease.Linear, RE],
            [1.3, { bhx: 0, bhy: 6, lean: 0, tilt: 0, ffx: 3, crouch: 0, glow: 0 }]
        ], BEAST_REST),
        hit: hitClip(BEAST_REST),
        death: deathClip(BEAST_REST)
    }
}

/** Every class node, keyed by its stable content ID. */
export const HERO_ART: Readonly<Record<string, HeroArt>> = {
    class_beginner: beginner,
    class_warrior: warrior,
    class_barbarian: barbarian,
    class_berserker: berserker,
    class_knight: knight,
    class_paladin: paladin,
    class_mage: mage,
    class_wizard: wizard,
    class_sorcerer: sorcerer,
    class_shaman: shaman,
    class_witch_doctor: witchDoctor,
    class_archer: archer,
    class_bowman: bowman,
    class_marksman: marksman,
    class_hunter: hunter,
    class_beast_master: beastMaster,
    // round 2: the chibi rebuilds replace their classic entries by ID
    ...CHIBI_HEROES
}

