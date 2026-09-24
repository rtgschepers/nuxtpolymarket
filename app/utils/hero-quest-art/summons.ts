// Summons (asset-list §1.3): Disciple, Raised Dead, Wolf — Move and Attack only, no Hit or
// Death. The Disciple and the Raised Dead ride the humanoid rig; the Wolf is a creature.

import { Ease, Phase, step, type Clip } from './anim'
import { C } from './palette'
import type { Surface} from './surface';
import { line, px, rect, ellipse, tri } from './surface'
import { HP, J, fxX, fxY, hclip, rest, type Look } from './rig'
import { robeSkirt, smear } from './hero-parts'
import { M, mace, sword } from './weapons'
import { A, attackPhase, fr, q, type CreatureDef } from './creature'

export const SUMMON_STATES = ['move', 'attack'] as const
export interface SummonClips { move: Clip, attack: Clip }

const CH = Phase.Charge
const CA = Phase.Cast
const RE = Phase.Recover

/** A walk cycle for any humanoid: 8 frames, feet alternating, a bob on the passing pose. */
function walkClip(r: Float32Array, shamble = false): Clip {
    const sw = shamble ? 1 : 0
    return hclip('move', 0.8, true, [
        [0, { ffx: 4, bfx: -4, ffy: 0, bfy: 0, crouch: 0 }],
        [0.1, { ffx: 2, bfx: -2, bfy: 1, crouch: 1, lean: sw }, Ease.Linear],
        [0.2, { ffx: 0, bfx: 0, bfy: 2, crouch: 0 }, Ease.Linear],
        [0.3, { ffx: -2, bfx: 2, bfy: 1, crouch: 0, lean: 0 }, Ease.Linear],
        [0.4, { ffx: -4, bfx: 4, ffy: 0, bfy: 0, crouch: 0 }, Ease.Linear],
        [0.5, { ffx: -2, bfx: 2, ffy: 1, crouch: 1, lean: -sw }, Ease.Linear],
        [0.6, { ffx: 0, bfx: 0, ffy: 2, crouch: 0 }, Ease.Linear],
        [0.7, { ffx: 2, bfx: -2, ffy: 1, crouch: 0, lean: 0 }, Ease.Linear],
        [0.8, { ffx: 4, bfx: -4, ffy: 0, bfy: 0 }, Ease.Linear]
    ], r)
}

// ── Disciple — the Paladin's summon: a small hooded acolyte carrying a sun-mace and lantern ──

const DISCIPLE_REST = rest({ hx: 3, hy: 6, wa: -1.2, bhx: 2, bhy: 5, ffx: 3, bfx: -3 })

export const DISCIPLE_LOOK: Look = {
    skin: [C.skin0, C.skin1, C.skin2],
    pants: C.bone1, pantsDk: C.bone0, boot: C.brown1, bootHi: C.brown2,
    arm: C.bone1, armLow: C.bone1, armBack: C.bone0, armBackLow: C.bone0, hand: C.skin1,
    legLen: 7, torsoLen: 8, accent: C.gold3,
    torso: (s, x, y) => {
        rect(s, x - 4, y, 8, 8, C.bone1)
        rect(s, x - 4, y, 1, 8, C.bone0)
        rect(s, x + 1, y, 1, 8, C.white)
        rect(s, x - 1, y + 1, 1, 6, C.gold2) // stole
        rect(s, x - 2, y + 3, 3, 1, C.gold2)
    },
    lower: (s, x, hipY, p, t) => robeSkirt(s, x, hipY, J.oy - 1, [C.bone0, C.bone1, C.white], C.gold1, (Math.floor(t * 4) & 1) - 0.5, C.brown1, p[HP.ffx]! > 0 ? 1 : 0),
    head: (s, x, y, p) => {
        rect(s, x - 1, y - 6, 4, 6, C.skin1)
        px(s, x + 2, y - 4, p[HP.flash]! > 0.5 ? C.ink : C.ink)
        px(s, x + 2, y - 1, C.skin0)
        rect(s, x - 3, y - 8, 6, 3, C.bone1) // hood
        rect(s, x - 3, y - 6, 2, 6, C.bone1)
        rect(s, x - 2, y - 9, 4, 1, C.bone1)
        px(s, x - 3, y - 6, C.bone0); px(s, x + 2, y - 7, C.white)
        // halo
        for (let i = -2; i <= 2; i++) px(s, x + i, y - 11, C.gold3)
    },
    weapon: (s, x, y, p) => mace(s, x, y, p[HP.wa]!, 8, M.gold, M.wood),
    offhand: (s, x, y, _p, t) => {
        line(s, x, y, x, y + 3, C.gold1)
        rect(s, x - 1, y + 3, 3, 3, C.gold1)
        px(s, x, y + 4, (Math.floor(t * 6) & 1) ? C.white : C.gold3)
    },
    fx: (dst, p, t) => {
        if (Math.round(p[HP.fxk]!) === 1) smear(dst, J.fsx, J.fsy, 8, 13, p[HP.fxa]!, p[HP.wa]!, C.gold3)
        const k = step(t, 10, 6)
        dst.set(fxX(J.bhx + (k % 3) - 1), fxY(J.bhy + 2 - k), C.gold3) // lantern motes
    }
}

export const DISCIPLE_CLIPS: SummonClips = {
    move: walkClip(DISCIPLE_REST),
    attack: hclip('attack', 0.8, false, [
        [0, {}],
        [0.1, { wa: -2.3, hx: -1, hy: -3, lean: -1 }, Ease.Out, CH],
        [0.3, { wa: -2.5, hx: -2, hy: -4 }, Ease.InOut, CH],
        [0.4, { wa: 0.3, hx: 7, hy: 3, lean: 2, ffx: 5, fxk: 1, fxa: -2.5 }, Ease.Out, CA],
        [0.5, { fxk: 0 }, Ease.Hold, RE],
        [0.8, { wa: -1.2, hx: 3, hy: 6, lean: 0, ffx: 3 }]
    ], DISCIPLE_REST)
}

// ── Raised Dead — the Witch Doctor's summon: a skeleton with grave-green eyes ──

const DEAD_REST = rest({ hx: 3, hy: 7, wa: -0.6, bhx: 2, bhy: 6, ffx: 3, bfx: -3, tilt: 1 })

export const RAISED_DEAD_LOOK: Look = {
    skin: [C.bone0, C.bone1, C.white],
    pants: C.bone1, pantsDk: C.bone0, boot: C.bone0, bootHi: C.bone1,
    arm: C.bone1, armLow: C.bone1, armBack: C.bone0, armBackLow: C.bone0, hand: C.bone1,
    accent: C.green4,
    torso: (s, x, y) => {
        rect(s, x - 1, y, 2, 9, C.bone1) // spine
        for (let i = 0; i < 3; i++) { rect(s, x - 4, y + 1 + i * 2, 8, 1, C.bone1); px(s, x - 4, y + 1 + i * 2, C.bone0) }
        rect(s, x - 3, y + 7, 6, 2, C.bone0) // pelvis
        px(s, x - 2, y + 4, C.green2) // grave-moss
        rect(s, x - 4, y + 6, 3, 3, C.olive1) // rag
    },
    head: (s, x, y, p) => {
        rect(s, x - 2, y - 7, 5, 6, C.bone1)
        rect(s, x - 1, y - 1, 4, 1, C.bone0)
        px(s, x, y - 1, C.ink); px(s, x + 2, y - 1, C.ink)
        rect(s, x + 1, y - 5, 2, 2, C.ink)
        px(s, x + 2, y - 5, p[HP.flash]! > 0.5 ? C.white : C.green4)
        px(s, x + 3, y - 3, C.ink)
        px(s, x - 2, y - 7, C.white)
    },
    weapon: (s, x, y, p) => sword(s, x, y, p[HP.wa]!, 10, M.rust, M.iron, C.brown0),
    fx: (dst, p, t) => {
        if (Math.round(p[HP.fxk]!) === 1) smear(dst, J.fsx, J.fsy, 8, 12, p[HP.fxa]!, p[HP.wa]!, C.green3)
        if (step(t, 10, 4) === 0) dst.set(fxX(J.headX + 3), fxY(J.headY - 7), C.green3)
    }
}

export const RAISED_DEAD_CLIPS: SummonClips = {
    move: walkClip(DEAD_REST, true),
    attack: hclip('attack', 0.8, false, [
        [0, {}],
        [0.1, { wa: -2.0, hx: 0, hy: -2, lean: -1, tilt: 0 }, Ease.Out, CH],
        [0.3, { wa: -2.3, hx: -1, hy: -3, headX: -1 }, Ease.InOut, CH],
        [0.4, { wa: 0.5, hx: 7, hy: 4, lean: 2, tilt: 2, ffx: 5, fxk: 1, fxa: -2.3, headX: 1 }, Ease.Out, CA],
        [0.5, { fxk: 0 }, Ease.Hold, RE],
        [0.8, { wa: -0.6, hx: 3, hy: 7, lean: 0, tilt: 1, ffx: 3, headX: 0 }]
    ], DEAD_REST)
}

// ── Wolf — the Beast Master's companion ────────────────────────────────────────────

// 6-frame gallop: [front-leg x, front lift, hind x, hind lift, body bob]
const GALLOP = [
    [4, 0, -4, 1, 0], [2, 2, -2, 0, -1], [-1, 3, 1, 0, -1], [-3, 1, 3, 0, 0], [-1, 0, 2, 2, 1], [2, 0, -1, 3, 0]
]

function wolfLeg(s: Surface, hx: number, hy: number, fx: number, fy: number, c: number): void {
    line(s, hx, hy, (hx + fx) / 2 + 1, (hy + fy) / 2, c, 2)
    line(s, (hx + fx) / 2 + 1, (hy + fy) / 2, fx, fy, c)
    px(s, fx + 1, fy, c)
}

export const WOLF: CreatureDef = {
    name: 'Wolf',
    size: 48,
    shadow: 9,
    accent: C.steel3,
    states: { move: { dur: 0.6, loop: true }, attack: { dur: 0.8, loop: false } },
    draw(s, st, t) {
        const ax = s.ax
        const ay = s.ay
        let g = GALLOP[0]!
        let lunge = 0
        let jaw = 0
        let crouch = 0
        if (st === 'move') g = GALLOP[fr(t, 10, 6)]!
        else {
            attackPhase(t, 0.8, 6)
            lunge = A.lunge
            crouch = Math.round(A.wind * 2)
            jaw = A.strike ? 3 : A.wind > 0.5 ? 1 : 0
            g = A.strike ? GALLOP[1]! : GALLOP[0]!
        }
        const bx = ax + lunge
        const by = ay - 9 + g[4]! + crouch
        // far legs
        wolfLeg(s, bx + 5, by + 2, ax + g[0]! + 4 + lunge, ay - g[1]!, C.stone1)
        wolfLeg(s, bx - 6, by + 2, ax + g[2]! - 7 + lunge, ay - g[3]!, C.stone1)
        // tail
        const tw = Math.floor(q(t) * 8) & 1
        line(s, bx - 9, by - 1, bx - 14, by - 3 - tw, C.stone2, 2)
        px(s, bx - 15, by - 4 - tw, C.stone3)
        // body
        ellipse(s, bx, by, 9, 4, C.stone2)
        ellipse(s, bx + 1, by - 1, 7, 2, C.stone3)
        rect(s, bx - 6, by + 2, 12, 1, C.bone1) // pale belly
        px(s, bx - 4, by - 3, C.steel3); px(s, bx + 2, by - 3, C.steel3) // ruff
        // near legs
        wolfLeg(s, bx + 7, by + 2, ax + g[2]! + 6 + lunge, ay - g[3]!, C.stone2)
        wolfLeg(s, bx - 4, by + 2, ax + g[0]! - 5 + lunge, ay - g[1]!, C.stone2)
        // head
        const hx = bx + 10
        const hy = by - 4 + crouch
        ellipse(s, hx, hy, 4, 3, C.stone2)
        rect(s, hx + 2, hy - 1, 5, 3, C.stone3) // snout
        px(s, hx + 7, hy - 1, C.ink) // nose
        rect(s, hx + 2, hy + 2, 5, 1 + jaw, jaw ? C.red1 : C.stone2) // jaw
        if (jaw) { px(s, hx + 3, hy + 2, C.white); px(s, hx + 6, hy + 2, C.white); px(s, hx + 4, hy + 2 + jaw, C.white) }
        tri(s, hx - 3, hy - 2, hx - 1, hy - 2, hx - 3, hy - 7, C.stone2) // ears
        tri(s, hx, hy - 2, hx + 2, hy - 2, hx, hy - 6, C.stone3)
        px(s, hx + 2, hy - 1, A.strike ? C.gold3 : C.gold2) // eye
    },
    fx(dst, st, t, x, y, dir) {
        if (st === 'attack') {
            attackPhase(t, 0.8, 6)
            if (A.strike) {
                // bite flash at the jaw
                for (let i = 0; i < 3; i++) {
                    dst.set(x + dir * (22 + i), y - 13 + i * 2, C.white)
                    dst.set(x + dir * (23 + i), y - 12 + i * 2, C.steel3)
                }
            }
        } else if (fr(t, 10, 6) === 0) {
            dst.set(x - dir * 8, y - 1, C.stone3); dst.set(x - dir * 10, y - 2, C.stone2) // kicked dust
        }
    }
}

