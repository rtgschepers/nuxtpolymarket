// World bosses and super bosses, Worlds 1–5 (asset-list §1.4). Each is bespoke art drawn as
// an inhabitant of its world, with Idle, Attack, Hit, Death and an Entry — the boss arriving.
// Bosses are 96px buffers, super bosses 128px and the most elaborate thing in their world.

import { C } from './palette'
import type { CreatureDef } from './creature'
import { fr } from './creature'
import type { Mat } from './weapons'
import type { Surface } from './surface'
import {
    B, Entry, bossStates, drive, finish, bz, ball, chain, tentacle, spikes, mouth, speckle,
    limbT, reach, P, rect, px, line, disc, ellipse, tri, quad, dither, ditherEllipse, arc, poly, q, wv
} from './boss-kit'

const R = Math.round

const HIDE: Mat = [C.brown0, C.brown1, C.brown2]
const BARK: Mat = [C.brown0, C.brown1, C.brown2]
const ROT: Mat = [C.olive0, C.olive1, C.olive2]
const LEECH: Mat = [C.red0, C.brown1, C.olive1]
const SCALE_RED: Mat = [C.red1, C.orange, C.gold2]
const OBSIDIAN: Mat = [C.void, C.stone0, C.stone1]
const ICE: Mat = [C.blue1, C.cyan, C.frost]
const GLACIER: Mat = [C.blue0, C.blue1, C.blue2]
const FUR: Mat = [C.bone0, C.bone1, C.white]
const SEA_SKIN: Mat = [C.teal1, C.teal2, C.teal3]
const DEEP: Mat = [C.teal0, C.teal1, C.teal2]
const KRAKEN: Mat = [C.purple0, C.purple1, C.night3]

// ═══════════════════════════════════════════════════════════════ 1 · Thornwick Vale

// Stage 5: the goblins' warboss riding Old Gnarlhide into the gate, the leader of the goblins
// the run has been fighting, on the beast. Stage 10: Gorsecrown, the Wicker King, a hollow
// effigy woven from hedge-wood with a carved goat skull for a head, gorse-fire in his ribs and
// gorse at the roots of his horns: the thing the hedgerows have become.

const GOBLIN: Mat = [C.green1, C.green2, C.green3]
const LEATHER: Mat = [C.brown0, C.brown1, C.brown2]
const IRON: Mat = [C.steel0, C.steel1, C.steel2]
const WICKER: Mat = [C.brown1, C.brown2, C.brown3]
const SKULL: Mat = [C.brown2, C.brown3, C.bone0]
const HORN: Mat = [C.brown1, C.brown2, C.bone0]
const HORN_FAR: Mat = [C.brown0, C.brown1, C.brown2]

/**
 * The cleaver: a haft from the hand along `a`, then a broad blade on the side the chop leads
 * with, its edge bright and a rust bloom near the spine.
 */
function cleaver(s: Surface, hx: number, hy: number, a: number): void {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const nx = -dy
    const ny = dx
    line(s, R(hx - dx * 2), R(hy - dy * 2), R(hx + dx * 4), R(hy + dy * 4), C.brown0, 2)
    for (let k = 4; k <= 15; k++) {
        const w = k < 6 ? 4 : 6
        const bx = hx + dx * k
        const by = hy + dy * k
        line(s, R(bx), R(by), R(bx + nx * w), R(by + ny * w), k & 1 ? IRON[1] : IRON[0])
        px(s, R(bx + nx * w), R(by + ny * w), C.steel3)
        if (k % 4 === 1) px(s, R(bx + nx), R(by + ny), C.orange)
    }
    px(s, R(hx + dx * 15 + nx * 6), R(hy + dy * 15 + ny * 6), C.white)
}

/**
 * Old Gnarlhide, saddled and harnessed, the goblins' chieftain on his back in a
 * scrap-iron helm under a bramble crown, a bone mantle, a heavy cleaver, and a tattered war
 * banner on a pole behind him. The boar charges; the rider chops as it lands.
 */
export const OLD_GNARLHIDE: CreatureDef = {
    name: 'Old Gnarlhide', size: 96, shadow: 24, accent: C.red2,
    states: bossStates(1.1, 1.4, 1.8),
    draw(s, st, t) {
        drive(this, st, t, 12, 1.4)
        const x = s.ax - 8 + B.lunge - B.kb
        const y = s.ay
        const charge = B.wind > 0 ? B.wind : B.strike ? 1 : B.rec
        const by = y - 16 + B.breath + R(B.die * 4)
        const step = st === 'entry' ? fr(t, 8, 4) : B.strike ? 1 : 0
        const flap = fr(t, 4, 2)

        // the rider's seat, and the banner pole strapped behind it
        const rx = x - 4
        const ry = by - 11 + R(B.die * 6)
        const lean = R(charge * 2)
        line(s, rx - 8, ry + 2, rx - 11, ry - 36, C.brown1, 2)
        px(s, rx - 11, ry - 37, C.bone1); px(s, rx - 12, ry - 38, C.bone1); px(s, rx - 10, ry - 38, C.bone1) // skull finial
        px(s, rx - 11, ry - 38, C.ink)
        for (let i = 0; i < 12; i++) {
            const len = 10 - (i >> 2) + ((i + flap) % 3 === 0 ? -2 : 0)
            const c = i < 2 ? C.red3 : i > 9 ? C.red1 : C.red2
            line(s, rx - 12, ry - 35 + i, rx - 12 - len - (flap && i > 6 ? 1 : 0), ry - 35 + i + (i > 6 ? flap : 0), c)
        }
        rect(s, rx - 17, ry - 31, 3, 2, C.bone1) // a daubed claw mark on the rag

        // boar legs, far pair then near
        const legH = R(10 - B.die * 6)
        for (const [lx, far] of [[-13, true], [9, true], [-9, false], [13, false]] as const) {
            const off = (step & 1) && !far ? 2 : 0
            rect(s, x + lx + off, by + 5, 5, legH, far ? C.brown0 : C.brown1)
            rect(s, x + lx + off, y - 2, 5, 2, C.ink)
        }
        // boar body and bristles
        ball(s, x, by, 21, 11, HIDE)
        dither(s, x - 18, by + 3, 32, 6, C.brown0, 6)
        for (let i = 0; i < 8; i++) line(s, x - 17 + i * 4, by - 6 + (i & 1), x - 19 + i * 4, by - 2, C.brown0)
        spikes(s, x - 19, by - 9, x - 9, by - 11, 3, 3, C.brown2, C.bone1)
        line(s, x - 21, by - 3, x - 25, by - 6 + wv(t, 0.6, 1), C.brown1) // tail
        // harness: a girth strap studded with iron, a red saddle blanket with a ragged fringe
        rect(s, x - 1, by - 10, 3, 20, LEATHER[0])
        for (let i = 0; i < 4; i++) px(s, x, by - 7 + i * 5, C.steel3)
        rect(s, x - 11, by - 13, 16, 4, C.red1)
        rect(s, x - 11, by - 13, 16, 1, C.red2)
        for (let i = 0; i < 8; i++) px(s, x - 11 + i * 2, by - 9, C.red0)
        line(s, x + 2, by - 4, x + 17, by + 1, LEATHER[0], 2) // breast strap to the head

        // boar head: tusks like roots, an iron ring through the snout
        const hx = x + 20
        const hy = by + 1 + R(charge * 3 + B.die * 6)
        ball(s, hx, hy, 10, 8, HIDE)
        tri(s, hx - 7, hy - 5, hx - 2, hy - 7, hx - 6, hy - 13, C.brown1)
        px(s, hx - 6, hy - 12, C.brown2)
        rect(s, hx + 6, hy - 1, 7, 6, C.brown2)
        rect(s, hx + 12, hy, 2, 4, C.bone0)
        px(s, hx + 12, hy + 1, C.ink); px(s, hx + 12, hy + 3, C.ink)
        disc(s, hx + 13, hy + 5, 1.5, C.steel2); px(s, hx + 13, hy + 5, C.brown2)
        line(s, hx + 7, hy + 5, hx + 11, hy + 3, C.bone1, 2)
        line(s, hx + 11, hy + 3, hx + 13, hy - 3, C.bone1, 2)
        px(s, hx + 13, hy - 4, C.white)
        const boarEye = B.hurt ? C.ink : (B.glow > 0.5 ? C.gold3 : C.red2)
        rect(s, hx + 1, hy - 4, 3, 1, C.brown0)
        px(s, hx + 3, hy - 3, boarEye)
        if (B.roar || B.strike) mouth(s, hx + 6, hy + 5, 6, 2, C.red1, C.bone1)

        // rider: back arm on the reins, leg down the boar's flank
        line(s, rx + 2, ry - 10, hx - 2, hy - 2, C.brown0) // rein
        limbT(s, rx - 1, ry - 11, rx + 4, ry - 6, 3, 2.5, [C.green0, C.green1, C.green2])
        limbT(s, rx + 1, ry - 1, rx + 5, ry + 6, 4, 3, LEATHER)
        rect(s, rx + 3, ry + 6, 4, 2, C.brown0) // boot in the stirrup
        // torso: a leather jerkin under a bone mantle, a red war-paint slash
        const tx = rx + lean
        ball(s, tx, ry - 7, 6, 7, LEATHER)
        ellipse(s, tx, ry - 12, 7, 3, C.bone0)
        ellipse(s, tx - 1, ry - 13, 6, 2, C.bone1)
        for (let i = -5; i <= 5; i += 2) px(s, tx + i, ry - 10, C.bone0)
        line(s, tx - 2, ry - 7, tx + 3, ry - 3, C.red2)
        // head: a goblin's, bigger than the trash, long ear swept back
        const gx = tx + 2
        const gy = ry - 21
        tri(s, gx - 5, gy, gx - 4, gy + 3, gx - 14, gy - 4, C.green1) // ear
        line(s, gx - 6, gy + 1, gx - 12, gy - 3, C.green2)
        ball(s, gx, gy, 7, 6, GOBLIN)
        rect(s, gx + 6, gy, 3, 3, C.green2); px(s, gx + 8, gy + 3, C.green1) // hooked nose
        const eye = B.hurt ? C.ink : (B.glow > 0.5 ? C.gold3 : C.red2)
        rect(s, gx + 2, gy - 2, 3, 2, C.ink)
        px(s, gx + 3, gy - 2, eye); px(s, gx + 4, gy - 2, eye)
        line(s, gx - 1, gy, gx + 4, gy, C.red1) // war paint under the eye
        if (B.roar || B.strike) mouth(s, gx + 1, gy + 3, 6, 2, C.red0, C.white)
        else { rect(s, gx + 1, gy + 3, 5, 1, C.ink); px(s, gx + 5, gy + 4, C.white); px(s, gx + 2, gy + 4, C.white) }
        // scrap-iron helm sitting on top, dented and riveted, crowned in bramble
        ellipse(s, gx - 1, gy - 6, 7, 3, IRON[1])
        rect(s, gx - 8, gy - 5, 15, 1, IRON[0])
        px(s, gx - 3, gy - 8, C.steel3); px(s, gx + 2, gy - 7, C.steel3); px(s, gx - 6, gy - 5, C.steel2)
        for (let i = -3; i <= 3; i++) {
            const cx = gx - 1 + i * 2
            const ch = 3 + (i & 1) * 2
            line(s, cx, gy - 9, cx - 1, gy - 9 - ch, C.brown1)
            px(s, cx - 1, gy - 10 - ch, i & 1 ? C.red2 : C.green2)
        }
        // front arm and the cleaver: raised back on the wind-up, chopped down on the strike
        const sx = tx + 4
        const sy = ry - 11
        const a = bz(-1.1, -2.6, 0.6)
        reach(sx, sy, a, 8)
        limbT(s, sx, sy, P.x, P.y, 3.5, 3, GOBLIN)
        cleaver(s, P.x, P.y, a)
        disc(s, P.x, P.y, 1.5, C.green3)
        finish(s, Entry.Walk)
    },
    fx(dst, st, t, x, y, dir) {
        if (B.roar || (st === 'attack' && B.wind > 0.6)) {
            const k = fr(t, 10, 4)
            for (let i = 0; i < 4; i++) dst.set(x + dir * (32 + k * 2 + i), y - 15 - i - (k & 1), i & 1 ? C.bone1 : C.white)
        }
        if (st === 'attack' && B.strike) for (let i = 0; i < 6; i++) dst.set(x + dir * (12 + i * 3), y - (i & 1), C.stone3)
    }
}

/** Cross-weave every base-shade pixel in a box: the wicker's over-and-under strands. */
function weave(s: Surface, x0: number, y0: number, w: number, h: number): void {
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
            if (s.get(x, y) !== WICKER[1]) continue
            if (((x + y) & 3) === 0) s.set(x, y, WICKER[0])
            else if (((x - y) & 3) === 0) s.set(x, y, WICKER[2])
        }
    }
}

/**
 * Gorsecrown, King of Hedges, the Wicker King: a hollow giant woven from hedge-wood on human lines, long in the leg, a
 * broad woven trunk from a yoke of shoulders straight down to the hips, and jointed arms. His
 * head is a goat skull carved from pale wood, ram's horns curling round it with gorse at their
 * roots, fire in the eye socket and in the hollow of his ribs. Tan wicker and gold fire, so he
 * stands out of the green field rather than melting into it.
 */
export const GORSECROWN: CreatureDef = {
    name: 'Gorsecrown, King of Hedges', size: 128, shadow: 24, accent: C.gold2,
    states: bossStates(1.4, 1.8, 2.2),
    draw(s, st, t) {
        drive(this, st, t, 6, 1.8)
        const x = s.ax - 6 + B.lunge - B.kb
        const y = s.ay
        const sink = R(B.die * 12)
        // as tall as Gorsecrown: the horns top out about 100px above the feet
        const hipY = y - 46 + sink
        const chestY = y - 64 + B.breath + sink
        const shY = y - 78 + B.breath + sink
        const flick = fr(t, 10, 4)
        const burn = 0.5 + B.glow * 0.5
        const sway = wv(t, 1.8, 1)

        // back arm, relaxed: upper arm, a knot of an elbow, forearm, an open woven hand
        const bex = x - 21
        const bey = shY + 15
        limbT(s, x - 16, shY + 1, bex, bey, 5, 4, WICKER)
        limbT(s, bex, bey, x - 18, shY + 29, 4, 3.5, WICKER)
        ball(s, bex, bey, 3, 3, WICKER)
        ball(s, x - 18, shY + 31, 3, 3, WICKER)
        weave(s, x - 26, shY - 4, 14, 40)
        // legs: thigh, a knot of a knee, shin, splayed a little
        for (const side of [-1, 1]) {
            const kx = x + side * 7
            const ky = y - 23 + R(sink * 0.5)
            const ax = x + side * 6
            limbT(s, x + side * 6, hipY, kx, ky, 9, 7, WICKER)
            limbT(s, kx, ky, ax, y - 3, 7, 6, WICKER)
            rect(s, ax - 4, y - 3, 9, 3, WICKER[0])
            ball(s, kx, ky, 4, 4, WICKER)
        }
        // the trunk: a broad woven block from the yoke of the shoulders straight to the hips
        rect(s, x - 17, shY - 2, 34, 4, WICKER[1])
        tri(s, x - 16, shY, x + 16, shY, x, chestY, WICKER[1])
        rect(s, x - 12, chestY, 24, hipY - chestY, WICKER[1])
        ball(s, x, hipY, 12, 5, WICKER)
        weave(s, x - 22, shY - 4, 44, y - shY + 4)
        rect(s, x - 17, shY - 2, 34, 1, WICKER[2])
        // the ribcage: hollow, gorse-fire burning inside, woven bands across it
        ellipse(s, x, chestY, 13, 13, WICKER[0])
        ellipse(s, x, chestY + 1, 10, 10, C.brown0)
        ditherEllipse(s, x, chestY + 3, 8, 8, C.lava1, burn > 0.7 ? 16 : 11)
        ditherEllipse(s, x + 1, chestY + 4, 6, 6, C.orange, 12 + flick)
        ditherEllipse(s, x + 1, chestY + 4, 3 + (flick & 1), 4, C.gold2, 14)
        disc(s, x + 1, chestY + 4, 1.5, B.glow > 0.5 ? C.white : C.gold3)
        for (let i = -2; i <= 2; i++) {
            const ry = chestY + i * 5
            const half = R(12 * Math.sqrt(Math.max(0, 1 - (i * 5 / 13) ** 2)))
            rect(s, x - half, ry, half * 2, 2, WICKER[1])
            rect(s, x - half, ry, half * 2, 1, WICKER[2])
        }
        rect(s, x - 12, chestY - 10, 3, 22, WICKER[1]) // the spine along his back
        ball(s, x - 16, shY, 5, 4, WICKER)
        ball(s, x + 16, shY, 5, 4, WICKER)
        weave(s, x - 22, shY - 5, 44, 30)
        for (let i = 0; i < 4; i++) px(s, x - 7 + i * 5, chestY - 8 + ((i + flick) % 3) * 7, i & 1 ? C.gold3 : C.orange)
        // neck
        rect(s, x - 1, shY - 8, 4, 7, WICKER[1])
        weave(s, x - 2, shY - 9, 6, 8)

        // head: a goat skull carved from pale wood
        const hx = x + 1
        const hy = shY - 12 + sway
        ramHorn(s, hx - 3, hy - 1, 7, 2, HORN_FAR) // far horn, peeking out behind
        ball(s, hx, hy, 6, 6, SKULL)
        limbT(s, hx + 3, hy + 1, hx + 11, hy + 5, 6, 4, SKULL) // a short, blunt snout
        line(s, hx - 3, hy - 3, hx + 1, hy - 5, C.brown2) // grain
        line(s, hx + 5, hy + 2, hx + 9, hy + 4, C.brown2)
        px(s, hx + 11, hy + 4, C.brown0); px(s, hx + 10, hy + 3, C.ink) // nostril
        rect(s, hx + 2, hy - 2, 4, 3, C.brown0) // the eye socket
        const eye = B.hurt ? C.lava1 : (B.glow > 0.5 ? C.white : C.gold3)
        px(s, hx + 3, hy - 1, eye); px(s, hx + 4, hy - 1, eye); px(s, hx + 4, hy, C.orange)
        // the jaw, dropping open on a roar or a swing, fire behind the teeth
        const gape = B.roar || B.strike ? 3 : 0
        if (gape) rect(s, hx + 3, hy + 6, 6, gape, flick & 1 ? C.orange : C.lava1)
        limbT(s, hx + 1, hy + 6 + gape, hx + 9, hy + 7 + gape, 4, 2, SKULL)
        for (let i = 0; i < 4; i++) px(s, hx + 3 + i * 2, hy + 6 + (gape ? 1 : 0), C.bone1)
        // near horn: a ram's, curling back and round beside the skull
        ramHorn(s, hx - 5, hy + 1, 8, 2.4, HORN)
        // gorse wound round the roots of the horns: the crown he is named for
        for (const [dx, dy, c] of [[-1, -7, C.gold3], [-5, -9, C.gold2], [2, -6, C.gold2]] as const) {
            px(s, hx + dx + 1, hy + dy + 1, C.green0)
            disc(s, hx + dx, hy + dy, 1.3, c)
        }

        // front arm, jointed: raised back at shoulder and elbow, then chopped down, fist burning
        const sx = x + 16
        const sy = shY
        const a1 = bz(1.35, -2.3, 0.85)
        const a2 = bz(0.9, -1.5, 1.3)
        reach(sx, sy, a1, 15)
        const ex = P.x
        const ey = P.y
        reach(ex, ey, a2, 14)
        limbT(s, sx, sy, ex, ey, 5, 4, WICKER)
        limbT(s, ex, ey, P.x, P.y, 4, 3.5, WICKER)
        weave(s, Math.min(sx, ex, P.x) - 6, Math.min(sy, ey, P.y) - 6, Math.max(sx, ex, P.x) - Math.min(sx, ex, P.x) + 12, Math.max(sy, ey, P.y) - Math.min(sy, ey, P.y) + 12)
        ball(s, ex, ey, 3, 3, WICKER)
        ball(s, P.x, P.y, 4, 4, WICKER)
        const fire = B.glow > 0.3 || flick === 0
        px(s, P.x + 1, P.y - 4, fire ? C.gold3 : C.orange)
        px(s, P.x - 1, P.y - 5 - (flick & 1), C.orange)
        px(s, P.x + 3, P.y - 3, C.lava1)
        finish(s, Entry.Rise, 12)
    },
    fx(dst, st, t, x, y, dir) {
        // embers drifting up out of the ribcage
        const k = fr(t, 10, 12)
        for (let i = 0; i < 4; i++) {
            const u = ((k + i * 3) % 12) / 12
            dst.set(x + dir * (-6 + ((i * 5) % 14)), y - 66 - R(u * 40), u < 0.5 ? C.gold3 : C.orange)
        }
        if (st === 'attack' && B.strike) {
            for (let i = 0; i < 12; i++) dst.set(x + dir * (30 + i * 2), y - (i % 3) - 1, i & 1 ? C.orange : C.gold3)
        }
        if (st === 'death') {
            const f = fr(t, 10, 16)
            for (let i = 0; i < 8; i++) dst.set(x + dir * (-18 + i * 5 + (f % 3)), y - 80 + i * 6 + f * 2, i & 1 ? C.gold3 : C.lava1)
        }
    }
}

/**
 * A ram's horn curling round (cx, cy): it rises from the crown, sweeps back and down and comes
 * forward underneath, the spiral tightening and thinning as it goes, ridged along its length.
 */
function ramHorn(s: Surface, cx: number, cy: number, r: number, w: number, m: Mat): void {
    const n = 22
    for (let i = 0; i <= n; i++) {
        const u = i / n
        const a = -1.2 - u * Math.PI * 1.6
        const rr = r * (1 - u * 0.4)
        const hx = cx + Math.cos(a) * rr
        const hy = cy + Math.sin(a) * rr
        const ww = w * (1 - u * 0.55)
        disc(s, hx, hy, ww, m[0])
        disc(s, hx - 0.5, hy - 0.5, Math.max(0.6, ww - 1), m[1])
        if (i % 3 === 0 && ww > 1.5) px(s, R(hx + Math.cos(a) * (ww - 1)), R(hy + Math.sin(a) * (ww - 1)), m[2])
    }
}

// ═══════════════════════════════════════════════════════════════ 2 · Mirewood

/** Mother Leech — rearing out of black water, a ringed maw at the top, her brood around her. */
export const MOTHER_LEECH: CreatureDef = {
    name: 'Mother Leech', size: 96, shadow: 0, accent: C.red2,
    states: bossStates(1.1, 1.6, 2.0),
    draw(s, st, t) {
        drive(this, st, t, 12, 1.6)
        const x = s.ax - 8 - B.kb
        const y = s.ay
        const sway = wv(t, 1.6, 3)
        const tx = x + 8 + sway + B.lunge + R(B.die * 10)
        const ty = y - 54 + R(bz(0, -6, 8)) + R(B.die * 34)
        chain(s, x - 4, y + 2, x - 22, y - 26, tx, ty, 11, 8, LEECH, 18, C.orange)
        // segment rings
        for (let i = 1; i < 9; i++) {
            const u = i / 9
            const cx = (1 - u) * (1 - u) * (x - 4) + 2 * (1 - u) * u * (x - 22) + u * u * tx
            const cy = (1 - u) * (1 - u) * (y + 2) + 2 * (1 - u) * u * (y - 26) + u * u * ty
            arc(s, cx, cy, 10 - u * 3, -0.6, 1.2, C.red0)
        }
        // the maw
        const open = B.strike || B.roar ? 7 : B.wind > 0.5 ? 5 : 4
        disc(s, tx + 3, ty, 8, LEECH[1])
        disc(s, tx + 4, ty, open, C.red1)
        disc(s, tx + 4, ty, open - 2, C.ink)
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2
            px(s, tx + 4 + R(Math.cos(a) * (open - 1)), ty + R(Math.sin(a) * (open - 1)), C.bone1)
        }
        if (open > 5) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; px(s, tx + 4 + R(Math.cos(a) * (open - 3)), ty + R(Math.sin(a) * (open - 3)), C.white) }
        // a crown of small eyes around the maw
        const eye = B.hurt ? C.ink : C.gold2
        px(s, tx - 2, ty - 6, eye); px(s, tx + 2, ty - 8, eye); px(s, tx + 7, ty - 7, eye)
        finish(s, Entry.Rise, 0)
    },
    fx(dst, st, t, x, y, dir) {
        // black water and the brood, un-outlined so she rises out of it
        const rx = 30
        ditherEllipse(dst, x - dir * 6, y - 1, rx, 3, C.void, 16)
        ditherEllipse(dst, x - dir * 6, y - 2, rx - 4, 2, C.night0, 16)
        const k = fr(t, 10, 8)
        for (let i = 0; i < 5; i++) dst.set(x - dir * (6 - rx + 6 + ((i * 11 + k * 3) % (rx * 2 - 8))), y - 3, C.teal1)
        for (let i = 0; i < 3; i++) {
            const bx = x + dir * (-26 + i * 18) + (((k + i * 3) & 3) - 1)
            for (let j = 0; j < 4; j++) dst.set(bx + dir * j, y - 3 - ((j + k + i) & 1), j === 3 ? C.orange : C.red0)
        }
        if (B.roar || B.strike) for (let i = 0; i < 4; i++) dst.set(x + dir * (18 + i * 3), y - 56 + ((i * 5 + k) % 7), C.teal3)
    }
}

/** Rotheart, the Sunken Elder — a drowned tree-giant with a heart gone to rot and glowing. */
export const ROTHEART: CreatureDef = {
    name: 'Rotheart, the Sunken Elder', size: 128, shadow: 0, accent: C.green4,
    states: bossStates(1.4, 2.0, 2.4),
    draw(s, st, t) {
        drive(this, st, t, 6, 2.0)
        const x = s.ax - 4 + B.lunge - B.kb
        const y = s.ay
        const topY = y - 88 + B.breath + R(B.die * 12)
        const lean = R(B.die * 8)
        // far branch-arm
        limbT(s, x - 12, topY + 20, x - 30, topY + 44, 8, 4, BARK)
        for (let i = 0; i < 4; i++) line(s, x - 18 - i * 3, topY + 28 + i * 4, x - 18 - i * 3, topY + 36 + i * 5, C.olive2)
        // root legs splaying into the water
        for (const [rx, dx] of [[-10, -14], [-4, -4], [4, 6], [10, 16]] as const) limbT(s, x + rx, topY + 64, x + dx, y, 6, 3, BARK)
        // trunk
        quad(s, x - 15 + lean, topY, x + 13 + lean, topY, x + 16, topY + 68, x - 17, topY + 68, BARK[1])
        quad(s, x - 15 + lean, topY, x - 9 + lean, topY, x - 11, topY + 68, x - 17, topY + 68, BARK[0])
        for (let i = 0; i < 6; i++) line(s, x - 8 + i * 4 + lean, topY + 4, x - 9 + i * 4, topY + 66, i & 1 ? C.brown0 : C.brown2)
        speckle(s, x - 15, topY, 30, 68, ROT, 5)
        ditherEllipse(s, x, topY + 56, 15, 10, C.olive1, 6) // waterline rot
        // the heart: a hollow in the chest, glowing sick green, pulsing
        const hy = topY + 30
        ellipse(s, x + 3 + lean, hy, 7, 9, C.ink)
        const pulse = (fr(t, 5, 2) || B.glow > 0.5) ? 1 : 0
        disc(s, x + 3 + lean, hy, 3 + pulse, C.green3)
        disc(s, x + 3 + lean, hy, 1 + pulse, C.green4)
        px(s, x + 2 + lean, hy - 1, C.white)
        for (let i = 0; i < 4; i++) line(s, x + 3 + lean, hy, x - 3 + i * 4 + lean, hy + 9, C.olive2) // rot veins
        // face: hollow eyes and a split mouth in the bark
        const eye = B.hurt ? C.olive1 : C.green4
        ellipse(s, x - 2 + lean, topY + 10, 3, 2, C.ink); px(s, x - 1 + lean, topY + 10, eye)
        ellipse(s, x + 8 + lean, topY + 10, 3, 2, C.ink); px(s, x + 9 + lean, topY + 10, eye)
        if (B.roar || B.strike) mouth(s, x + lean, topY + 16, 10, 4, C.olive0, C.bone0)
        else line(s, x + lean, topY + 17, x + 10 + lean, topY + 16, C.ink)
        // dead crown of branches with sparse leaves
        for (let i = -2; i <= 2; i++) {
            const bx = x + i * 6 + lean
            line(s, bx, topY + 2, bx + i * 3, topY - 14 - (i & 1) * 4, C.brown1, 2)
            px(s, bx + i * 3 - 1, topY - 15 - (i & 1) * 4, C.olive2)
            px(s, bx + i * 3 + 1, topY - 13 - (i & 1) * 4, C.olive1)
        }
        // front branch-arm with moss: raise and slam
        const sx = x + 14 + lean
        const sy = topY + 16
        const a = bz(0.8, -1.6, 1.2)
        reach(sx, sy, a, 34)
        limbT(s, sx, sy, P.x, P.y, 9, 4, BARK)
        line(s, P.x, P.y, P.x + 5, P.y + 4, C.brown1, 2)
        line(s, P.x, P.y, P.x + 6, P.y - 2, C.brown1)
        for (let i = 1; i < 5; i++) {
            const mx = sx + (P.x - sx) * i / 5
            const my = sy + (P.y - sy) * i / 5
            line(s, mx, my + 2, mx, my + 6 + (i & 1) * 3, C.olive2)
        }
        finish(s, Entry.Rise, 10)
    },
    fx(dst, st, t, x, y, dir) {
        ditherEllipse(dst, x, y - 1, 36, 3, C.void, 16)
        ditherEllipse(dst, x, y - 2, 30, 2, C.teal0, 12)
        const k = fr(t, 10, 10)
        for (let i = 0; i < 4; i++) dst.set(x + dir * (-26 + ((i * 17 + k * 5) % 52)), y - 3, C.teal2)
        // spores drifting up from the heart
        for (let i = 0; i < 3; i++) dst.set(x + dir * (3 + ((i * 7 + k) % 9) - 4), y - 58 - ((k * 3 + i * 9) % 30), C.green3)
    }
}

// ═══════════════════════════════════════════════════════════════ 3 · Cinderpass

/** Slagjaw — the kobold war-chief, his lower jaw replaced with a plate of glowing slag. */
export const SLAGJAW: CreatureDef = {
    name: 'Slagjaw', size: 96, shadow: 18, accent: C.lava1,
    states: bossStates(1.2, 1.2, 1.8),
    draw(s, st, t) {
        drive(this, st, t, 8, 1.2)
        const x = s.ax - 4 + B.lunge - B.kb
        const y = s.ay
        const crouch = R(B.wind * 3 + (B.strike ? 4 : B.rec * 3) + B.die * 10)
        const hip = y - 22 + crouch + B.bob
        const top = hip - 22
        // tail
        chain(s, x - 8, hip - 2, x - 24, hip + 4, x - 30, y - 6 + wv(t, 1.2, 2), 4, 1.5, SCALE_RED, 10)
        // digitigrade legs
        for (const [lx, c] of [[-5, SCALE_RED[0]], [6, SCALE_RED[1]]] as const) {
            line(s, x + lx, hip, x + lx - 4, hip + 10 - R(crouch / 2), c, 4)
            line(s, x + lx - 4, hip + 10 - R(crouch / 2), x + lx + 1, y - 2, c, 3)
            rect(s, x + lx - 1, y - 2, 6, 2, C.ink)
        }
        // body
        ball(s, x, top + 12, 12, 13, SCALE_RED)
        ellipse(s, x + 3, top + 15, 6, 8, C.gold2) // belly plates
        for (let i = 0; i < 4; i++) rect(s, x - 2, top + 9 + i * 4, 10, 1, C.gold1)
        // war harness and a trophy skull
        line(s, x - 10, top + 2, x + 10, top + 18, C.brown0, 2)
        rect(s, x - 11, hip - 3, 22, 3, C.brown1)
        rect(s, x - 2, hip - 2, 5, 4, C.bone1); px(s, x - 1, hip - 1, C.ink); px(s, x + 1, hip - 1, C.ink)
        dither(s, x - 12, top, 24, 8, C.stone3, 3) // ash
        // back arm
        limbT(s, x - 8, top + 4, x - 10, top + 16, 5, 4, [C.red0, C.red1, C.orange])
        // head: kobold snout, horn crown, the slag jaw
        const hx = x + 6
        const hy = top - 6 + R(B.die * 4)
        ball(s, hx, hy, 8, 7, SCALE_RED)
        rect(s, hx + 4, hy - 3, 10, 5, C.orange) // snout
        rect(s, hx + 4, hy - 3, 10, 1, C.gold2)
        px(s, hx + 13, hy - 2, C.ink)
        const eye = B.hurt ? C.ink : (B.glow > 0.4 ? C.white : C.gold3)
        rect(s, hx + 2, hy - 5, 3, 1, C.red0)
        px(s, hx + 4, hy - 4, eye)
        // slag jaw: dark metal with lava seams, dripping
        const jaw = B.roar || B.strike ? 3 : 1
        rect(s, hx + 3, hy + 2 + jaw, 12, 4, C.stone1)
        rect(s, hx + 3, hy + 2 + jaw, 12, 1, C.stone2)
        line(s, hx + 5, hy + 4 + jaw, hx + 13, hy + 4 + jaw, C.lava1)
        px(s, hx + 8, hy + 3 + jaw, C.gold2)
        if (jaw > 1) rect(s, hx + 5, hy + 2, 9, jaw, C.lava0)
        px(s, hx + 10, hy + 6 + jaw + (fr(t, 6, 3)), C.orange)
        // horn crown
        for (let i = 0; i < 4; i++) { line(s, hx - 5 + i * 3, hy - 6, hx - 7 + i * 3, hy - 11 - (i & 1) * 2, C.bone1, 2); px(s, hx - 7 + i * 3, hy - 12 - (i & 1) * 2, C.white) }
        // the slag hammer
        const sx = x + 8
        const sy = top + 4
        const a = bz(-1.1, -2.7, 0.9)
        reach(sx, sy, a, 12)
        const hx2 = P.x
        const hy2 = P.y
        limbT(s, sx, sy, hx2, hy2, 6, 4, SCALE_RED)
        reach(hx2, hy2, a - 0.2, 20)
        line(s, hx2, hy2, P.x, P.y, C.brown1, 2)
        const nx = -Math.sin(a - 0.2)
        const ny = Math.cos(a - 0.2)
        quad(s, P.x - nx * 7, P.y - ny * 7, P.x + nx * 7, P.y + ny * 7, P.x + nx * 7 + Math.cos(a) * 7, P.y + ny * 7 + Math.sin(a) * 7,
            P.x - nx * 7 + Math.cos(a) * 7, P.y - ny * 7 + Math.sin(a) * 7, C.stone1)
        line(s, P.x - nx * 5 + Math.cos(a) * 3, P.y - ny * 5 + Math.sin(a) * 3, P.x + nx * 5 + Math.cos(a) * 3, P.y + ny * 5 + Math.sin(a) * 3, C.lava1)
        px(s, P.x + Math.cos(a) * 3, P.y + Math.sin(a) * 3, C.gold3)
        rect(s, hx2 - 2, hy2 - 2, 4, 4, C.red1)
        finish(s, Entry.Drop, 8)
    },
    fx(dst, st, t, x, y, dir) {
        if (st === 'attack' && B.strike) {
            for (let i = 0; i < 8; i++) { dst.set(x + dir * (26 + i * 2), y - 1 - (i % 3), i & 1 ? C.lava1 : C.gold2); dst.set(x + dir * (24 + i), y - 4 - i, C.orange) }
        }
        if (st === 'entry' && B.ent > 0.95) for (let i = 0; i < 10; i++) dst.set(x + dir * (-20 + i * 4), y - (i & 1), C.stone3)
        const k = fr(t, 10, 12)
        dst.set(x + dir * (4 + (k % 5)), y - 50 - k * 2, C.orange)
    }
}

/** Pyrrhax, the Molten Wyrm — the thing the kobolds worship, rising from a lake of lava. */
export const PYRRHAX: CreatureDef = {
    name: 'Pyrrhax, the Molten Wyrm', size: 128, shadow: 0, accent: C.lava1,
    states: bossStates(1.4, 1.8, 2.2),
    draw(s, st, t) {
        drive(this, st, t, 10, 1.8)
        const x = s.ax - 10 - B.kb
        const y = s.ay
        const sway = wv(t, 1.8, 3)
        const hx = x + 16 + sway + R(bz(0, -10, 10)) + R(B.die * 14)
        const hy = y - 82 + R(bz(0, -8, 6)) + R(B.die * 60) + B.breath
        // coils behind
        chain(s, x - 30, y, x - 40, y - 26, x - 16, y - 20, 9, 7, OBSIDIAN, 12, C.lava1)
        // neck rising out of the lava
        chain(s, x - 2, y + 2, x - 34, y - 50, hx - 6, hy + 6, 14, 8, OBSIDIAN, 20, C.lava1)
        // magma cracks along the neck
        for (let i = 2; i < 18; i += 2) {
            const u = i / 20
            const cx = (1 - u) * (1 - u) * (x - 2) + 2 * (1 - u) * u * (x - 34) + u * u * (hx - 6)
            const cy = (1 - u) * (1 - u) * (y + 2) + 2 * (1 - u) * u * (y - 50) + u * u * (hy + 6)
            px(s, cx - 3, cy - 2, C.lava1); px(s, cx - 2, cy - 3, C.orange)
            if (i % 4 === 0) { tri(s, cx - 10, cy - 6, cx - 6, cy - 9, cx - 13, cy - 13, C.lava0); px(s, cx - 12, cy - 12, C.orange) } // dorsal fins
        }
        // head: a long wedge
        const open = B.strike || B.roar ? 6 : B.wind > 0.5 ? 3 : 1
        poly(s, [-8, -6, 6, -9, 20, -4, 22, 0, -6, 2], hx, hy, OBSIDIAN[1])
        poly(s, [-6, 2 + open, 20, 2 + open, 18, 6 + open, -4, 7], hx, hy, OBSIDIAN[0])
        if (open > 1) { quad(s, hx - 4, hy + 2, hx + 20, hy + 1, hx + 18, hy + 2 + open, hx - 4, hy + 2 + open, C.lava0); rect(s, hx, hy + 2, 16, 1, C.gold2) }
        line(s, hx - 6, hy - 5, hx + 18, hy - 3, OBSIDIAN[2])
        for (let i = 0; i < 5; i++) { px(s, hx + 2 + i * 4, hy + 1, C.bone1); px(s, hx + 3 + i * 4, hy + 2 + open, C.bone1) } // teeth
        // horns sweeping back
        line(s, hx - 4, hy - 6, hx - 18, hy - 16, C.stone2, 3)
        line(s, hx - 18, hy - 16, hx - 24, hy - 15, C.stone3, 2)
        line(s, hx + 2, hy - 8, hx - 8, hy - 20, C.stone2, 2)
        const eye = B.hurt ? C.ink : C.gold3
        rect(s, hx + 6, hy - 6, 4, 2, C.lava1); px(s, hx + 8, hy - 6, eye)
        px(s, hx + 20, hy - 3, C.lava1) // nostril glow
        finish(s, Entry.Rise, 0)
    },
    fx(dst, st, t, x, y, dir) {
        ditherEllipse(dst, x - dir * 12, y - 1, 44, 3, C.lava0, 16)
        ditherEllipse(dst, x - dir * 12, y - 2, 38, 2, C.lava1, 10)
        const k = fr(t, 10, 8)
        for (let i = 0; i < 6; i++) dst.set(x + dir * (-50 + ((i * 13 + k * 5) % 76)), y - 3 - (i & 1), i & 1 ? C.gold2 : C.orange)
        if ((st === 'attack' && (B.strike || B.rec > 0.6)) || B.roar) {
            // fire breath: a widening cone of flame from the jaw
            const hx = x + dir * (22 + (st === 'attack' ? 10 : 0))
            const hy = y - 80 + (st === 'attack' ? 6 : 0)
            for (let i = 0; i < 40; i++) {
                const d = 2 + i * 1.3
                const spread = d * 0.35
                const off = Math.sin(i * 7.3 + k) * spread
                const c = i < 8 ? C.gold3 : i < 18 ? C.gold2 : i < 28 ? C.orange : C.lava1
                dst.set(hx + dir * R(d), R(hy + d * 0.5 + off), c)
                dst.set(hx + dir * R(d), R(hy + d * 0.5 + off + 1), i < 20 ? C.white : c)
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════ 4 · Rimeholt

/** Jarl Hrimgar — the raider-king of the endless cold, beard of icicles, a great axe of ice. */
export const JARL_HRIMGAR: CreatureDef = {
    name: 'Jarl Hrimgar', size: 96, shadow: 18, accent: C.cyan,
    states: bossStates(1.2, 1.6, 2.0),
    draw(s, st, t) {
        drive(this, st, t, 8, 1.6)
        const x = s.ax - 4 + B.lunge - B.kb
        const y = s.ay
        const crouch = R(B.strike ? 5 : B.rec * 4 + B.die * 12)
        const hip = y - 26 + crouch + B.bob
        const top = hip - 24
        const walk = st === 'entry' ? fr(t, 6, 2) : 0
        // cloak behind
        quad(s, x - 10, top, x - 2, top, x - 8, y - 6, x - 22, y - 4, C.bone0)
        dither(s, x - 22, y - 16, 18, 12, C.white, 5)
        // legs: fur boots
        limbT(s, x - 4, hip, x - 7 - walk * 3, y - 6, 7, 6, [C.stone1, C.stone2, C.stone3])
        limbT(s, x + 5, hip, x + 7 + walk * 3, y - 6, 7, 6, [C.stone2, C.stone3, C.bone0])
        rect(s, x - 11 - walk * 3, y - 8, 8, 8, C.bone1); rect(s, x + 4 + walk * 3, y - 8, 8, 8, C.white)
        // body: mail and a fur mantle
        rect(s, x - 11, top + 4, 22, 22, C.steel1)
        dither(s, x - 11, top + 4, 22, 22, C.steel2, 8)
        rect(s, x - 11, hip - 4, 22, 3, C.brown1)
        rect(s, x - 2, hip - 4, 5, 3, C.gold2)
        ball(s, x, top + 4, 15, 6, FUR)
        dither(s, x - 14, top + 2, 28, 6, C.bone0, 5)
        // back arm
        limbT(s, x - 10, top + 6, x - 12, top + 22, 6, 5, [C.night3, C.haze, C.frost])
        // head: frost-pale, a beard of icicles, horned helm
        const hx = x + 3
        const hy = top - 4 + R(B.die * 6)
        rect(s, hx - 5, hy - 10, 11, 10, C.haze)
        rect(s, hx + 1, hy - 9, 4, 7, C.frost)
        const eye = B.hurt ? C.ink : (B.glow > 0.5 ? C.white : C.cyan)
        rect(s, hx + 2, hy - 7, 3, 1, C.night3); px(s, hx + 4, hy - 6, eye)
        for (let i = 0; i < 6; i++) { const len = 5 + (i * 3) % 6; line(s, hx - 3 + i * 2, hy - 2, hx - 3 + i * 2 + (i & 1), hy - 2 + len, i & 1 ? C.frost : C.white, 2); px(s, hx - 3 + i * 2 + (i & 1), hy - 1 + len, C.cyan) }
        if (B.roar || B.strike) rect(s, hx + 1, hy - 3, 4, 2, C.ink)
        rect(s, hx - 6, hy - 15, 13, 6, C.steel2); rect(s, hx - 5, hy - 16, 11, 1, C.steel3)
        rect(s, hx - 6, hy - 10, 13, 1, C.steel1)
        px(s, hx + 6, hy - 9, C.steel2); px(s, hx + 6, hy - 8, C.steel1) // nasal
        for (const d of [-1, 1]) { line(s, hx + d * 6, hy - 14, hx + d * 10, hy - 20, C.bone1, 2); line(s, hx + d * 10, hy - 20, hx + d * 9, hy - 25, C.white, 2) }
        // the ice axe
        const sx = x + 8
        const sy = top + 6
        const a = bz(-1.2, -2.6, 0.7)
        reach(sx, sy, a, 13)
        const gx = P.x
        const gy = P.y
        limbT(s, sx, sy, gx, gy, 7, 5, [C.night3, C.haze, C.frost])
        reach(gx, gy, a - 0.1, 26)
        line(s, gx - Math.cos(a) * 5, gy - Math.sin(a) * 5, P.x, P.y, C.brown1, 2)
        const nx = -Math.sin(a)
        const ny = Math.cos(a)
        tri(s, P.x, P.y, P.x - Math.cos(a) * 8, P.y - Math.sin(a) * 8, P.x - nx * 10 - Math.cos(a) * 3, P.y - ny * 10 - Math.sin(a) * 3, C.cyan)
        tri(s, P.x, P.y, P.x - nx * 10 - Math.cos(a) * 3, P.y - ny * 10 - Math.sin(a) * 3, P.x - nx * 8 + Math.cos(a) * 4, P.y - ny * 8 + Math.sin(a) * 4, C.frost)
        line(s, P.x - nx * 9 - Math.cos(a) * 3, P.y - ny * 9 - Math.sin(a) * 3, P.x - nx * 7 + Math.cos(a) * 4, P.y - ny * 7 + Math.sin(a) * 4, C.white)
        rect(s, gx - 2, gy - 2, 5, 5, C.brown1)
        finish(s, Entry.Walk, 10)
    },
    fx(dst, st, t, x, y, dir) {
        const k = fr(t, 10, 20)
        for (let i = 0; i < 5; i++) dst.set(x + dir * (-30 + ((i * 17 + k * 3) % 60)), y - 80 + ((k * 4 + i * 23) % 76), C.white)
        if (st === 'attack' && B.strike) for (let i = 0; i < 8; i++) dst.set(x + dir * (22 + i * 2), y - 1 - (i % 3), i & 1 ? C.frost : C.cyan)
        if (B.roar) for (let i = 0; i < 3; i++) dst.set(x + dir * (14 + i * 3), y - 56 - i, C.frost)
    }
}

/** Vinterhel, the Glacier Titan — a mountain of faceted ice with a cold star for a heart. */
export const VINTERHEL: CreatureDef = {
    name: 'Vinterhel, the Glacier Titan', size: 128, shadow: 34, accent: C.cyan,
    states: bossStates(1.5, 2.0, 2.4),
    draw(s, st, t) {
        drive(this, st, t, 6, 2.0)
        const x = s.ax - 2 + B.lunge - B.kb
        const y = s.ay
        const top = y - 96 + B.breath + R(B.die * 20)
        const shard = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, m: Mat) => {
            tri(s, x0, y0, x1, y1, x2, y2, m[1])
            line(s, x0, y0, x1, y1, m[2])
            line(s, x1, y1, x2, y2, m[0])
        }
        // legs: two pillars of glacier
        for (const [lx, m] of [[-14, GLACIER], [10, ICE]] as const) {
            quad(s, x + lx - 7, top + 62, x + lx + 7, top + 62, x + lx + 9, y, x + lx - 9, y, m[1])
            line(s, x + lx - 7, top + 62, x + lx - 9, y, m[2])
            line(s, x + lx + 3, top + 70, x + lx - 2, y - 6, m[0])
        }
        // back fist
        const bfx = x - 30
        const bfy = top + 56 + R(bz(0, -4, 4))
        limbT(s, x - 18, top + 20, bfx, bfy, 12, 9, GLACIER)
        ball(s, bfx, bfy + 4, 8, 8, GLACIER)
        // body: stacked facets
        shard(x - 26, top + 22, x + 24, top + 16, x, top + 70, ICE)
        shard(x - 26, top + 22, x, top + 70, x - 18, top + 60, GLACIER)
        shard(x - 18, top + 8, x + 20, top + 4, x + 24, top + 30, ICE)
        shard(x - 18, top + 8, x + 24, top + 30, x - 26, top + 26, GLACIER)
        dither(s, x - 22, top + 40, 40, 24, C.blue0, 3)
        // cold star heart
        const pulse = fr(t, 4, 2) || B.glow > 0.5 ? 1 : 0
        disc(s, x + 2, top + 34, 5 + pulse, C.cyan)
        disc(s, x + 2, top + 34, 3, C.frost)
        px(s, x + 2, top + 34, C.white)
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; line(s, x + 2, top + 34, x + 2 + Math.cos(a) * (9 + pulse), top + 34 + Math.sin(a) * (9 + pulse), C.frost) }
        // head: a crown of icicle spires with a visor of blue
        const hx = x + 6
        const hy = top + 2
        shard(hx - 12, hy, hx + 14, hy - 2, hx + 2, hy - 20, ICE)
        tri(s, hx - 10, hy - 6, hx - 6, hy - 6, hx - 12, hy - 22, C.frost)
        tri(s, hx + 6, hy - 10, hx + 10, hy - 8, hx + 12, hy - 26, C.frost)
        tri(s, hx - 2, hy - 14, hx + 4, hy - 14, hx + 1, hy - 30, C.white)
        rect(s, hx - 4, hy - 8, 14, 3, C.blue0)
        const eye = B.hurt ? C.blue1 : C.white
        rect(s, hx + 2, hy - 7, 3, 1, eye); rect(s, hx + 7, hy - 7, 2, 1, eye)
        if (B.roar || B.strike) rect(s, hx + 1, hy - 3, 8, 2, C.blue0)
        // front fist: raise and hammer down
        const sx = x + 20
        const sy = top + 14
        const a = bz(1.0, -1.4, 1.35)
        reach(sx, sy, a, 34)
        limbT(s, sx, sy, P.x, P.y, 13, 10, ICE)
        ball(s, P.x + 2, P.y + 3, 10, 9, ICE)
        line(s, P.x - 4, P.y - 2, P.x + 6, P.y - 4, C.white)
        speckle(s, x - 28, top, 56, 70, [C.blue2, C.cyan, C.white], 21)
        finish(s, Entry.Rise, 16)
    },
    fx(dst, st, t, x, y, dir) {
        const k = fr(t, 10, 20)
        for (let i = 0; i < 6; i++) dst.set(x + dir * (-40 + ((i * 17 + k * 3) % 80)), y - 110 + ((k * 5 + i * 23) % 106), i & 1 ? C.white : C.frost)
        if (st === 'attack' && B.strike) {
            for (let i = 0; i < 12; i++) dst.set(x + dir * (40 + i * 2), y - (i % 4), i & 1 ? C.frost : C.white)
            for (let i = 0; i < 5; i++) { dst.set(x + dir * (44 + i * 4), y - 3 - i, C.cyan); dst.set(x + dir * (45 + i * 4), y - 4 - i, C.white) }
        }
    }
}

// ═══════════════════════════════════════════════════════════════ 5 · Sunken Amarath

/** Tidecaller Nerine — a drowned siren-priestess who still calls the tide, trident in hand. */
export const TIDECALLER_NERINE: CreatureDef = {
    name: 'Tidecaller Nerine', size: 96, shadow: 0, accent: C.teal3,
    states: bossStates(1.2, 1.6, 2.0),
    draw(s, st, t) {
        drive(this, st, t, 8, 1.6)
        const x = s.ax - 4 + B.lunge - B.kb
        const y = s.ay
        const float = -6 + wv(t, 1.6, 2) + R(B.die * 12)
        const hip = y - 26 + float
        const top = hip - 20
        // tail coiled beneath, fin at the end
        chain(s, x - 2, hip, x - 18, y - 6 + float, x + 4, y - 8 + float, 7, 3, SEA_SKIN, 14, C.teal3)
        tri(s, x + 4, y - 8 + float, x + 12, y - 16 + float, x + 12, y - 2 + float, C.teal1)
        line(s, x + 5, y - 8 + float, x + 12, y - 14 + float, C.teal3)
        for (let i = 0; i < 5; i++) px(s, x - 12 + i * 3, y - 6 + float - (i & 1), C.teal3) // scales
        // flowing hair behind
        for (let i = 0; i < 6; i++) tentacle(s, x - 2, top - 10, 2.2 + i * 0.12, 18 + i * 2, 2, q(t) * 3 + i, [C.teal0, C.teal1, C.teal3])
        // torso: shell and pearls
        ball(s, x, top + 10, 8, 11, SEA_SKIN)
        rect(s, x - 6, top + 4, 12, 4, C.bone1)
        px(s, x - 3, top + 5, C.pink); px(s, x + 2, top + 5, C.pink)
        for (let i = 0; i < 5; i++) px(s, x - 4 + i * 2, top + 1 + (i & 1), C.white) // pearls
        rect(s, x - 7, hip - 3, 14, 3, C.gold1)
        // back arm with the conch
        limbT(s, x - 6, top + 4, x - 12, top + 12, 3, 3, SEA_SKIN)
        tri(s, x - 16, top + 10, x - 10, top + 8, x - 14, top + 18, C.bone1)
        px(s, x - 13, top + 12, C.pink)
        // head: pale drowned face, coral crown
        const hx = x + 2
        const hy = top - 2
        ball(s, hx, hy - 5, 5, 6, SEA_SKIN)
        rect(s, hx + 1, hy - 8, 3, 4, C.teal3)
        const eye = B.hurt ? C.ink : C.white
        px(s, hx + 3, hy - 6, eye); px(s, hx + 2, hy - 7, C.teal0)
        if (B.roar || B.strike) rect(s, hx + 2, hy - 2, 2, 2, C.ink)
        for (let i = 0; i < 4; i++) { line(s, hx - 3 + i * 2, hy - 10, hx - 4 + i * 2, hy - 15 - (i & 1) * 2, C.red2); px(s, hx - 5 + i * 2, hy - 14, C.red3) }
        // front arm and the trident
        const sx = x + 5
        const sy = top + 4
        const a = bz(-1.3, -2.2, -0.05)
        const hand = bz(0, -3, 10)
        const gx = sx + 4 + hand
        const gy = sy + 6 + R(bz(0, -6, -3))
        limbT(s, sx, sy, gx, gy, 3, 3, SEA_SKIN)
        reach(gx, gy, a, 26)
        line(s, gx - Math.cos(a) * 10, gy - Math.sin(a) * 10, P.x, P.y, C.gold1, 2)
        const nx = -Math.sin(a)
        const ny = Math.cos(a)
        line(s, P.x - nx * 4, P.y - ny * 4, P.x + nx * 4, P.y + ny * 4, C.gold2)
        for (const d of [-4, 0, 4]) { line(s, P.x + nx * d, P.y + ny * d, P.x + nx * d + Math.cos(a) * 6, P.y + ny * d + Math.sin(a) * 6, d === 0 ? C.gold3 : C.gold2); px(s, P.x + nx * d + Math.cos(a) * 6, P.y + ny * d + Math.sin(a) * 6, C.white) }
        px(s, gx, gy, C.teal3)
        finish(s, Entry.Rise, 0)
    },
    fx(dst, st, t, x, y, dir) {
        // a spiral of water under her
        const k = fr(t, 10, 8)
        ditherEllipse(dst, x, y - 1, 20, 2, C.teal0, 16)
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + k * 0.4
            const r = 6 + (i % 8) * 2
            dst.set(x + R(Math.cos(a) * r), y - 3 + R(Math.sin(a) * r * 0.25), i & 1 ? C.teal3 : C.teal2)
        }
        if ((st === 'attack' && B.strike) || B.roar) for (let i = 0; i < 16; i++) dst.set(x + dir * (34 + i * 2), y - 38 - R(Math.sin(i * 0.8 + k) * 2), i & 1 ? C.white : C.teal3)
    }
}

/** Queen Maerith of the Deep — the drowned empire's last queen, a kraken below the waist. */
export const QUEEN_MAERITH: CreatureDef = {
    name: 'Queen Maerith of the Deep', size: 128, shadow: 0, accent: C.teal3,
    states: bossStates(1.5, 2.0, 2.4),
    draw(s, st, t) {
        drive(this, st, t, 6, 2.0)
        const x = s.ax - 6 + B.lunge - B.kb
        const y = s.ay
        const ph = q(t) * 2.5
        const top = y - 74 + B.breath + R(B.die * 24)
        // tentacles on the floor, far ones first
        for (let i = 0; i < 3; i++) tentacle(s, x - 6 + i * 3, top + 52, Math.PI * (0.9 - i * 0.12), 30, 4, ph + i, KRAKEN, C.pink)
        // hair: long, black-green, pearls threaded through
        for (let i = 0; i < 7; i++) tentacle(s, x - 4, top - 18, 2.0 + i * 0.13, 30 + (i % 3) * 5, 2.5, ph * 0.6 + i, [C.ink, C.teal0, C.teal1])
        // body
        ball(s, x, top + 30, 14, 24, DEEP)
        ball(s, x + 1, top + 14, 12, 12, SEA_SKIN)
        rect(s, x - 11, top + 22, 22, 5, C.gold1) // girdle of drowned gold
        for (let i = 0; i < 6; i++) px(s, x - 10 + i * 4, top + 24, i & 1 ? C.white : C.teal3)
        // near tentacles over the body
        for (let i = 0; i < 3; i++) tentacle(s, x + 2 + i * 4, top + 50, Math.PI * (0.18 - i * 0.12), 32, 4.5, ph + 3 + i, KRAKEN, C.pink)
        // back arm and pearl sceptre
        limbT(s, x - 10, top + 8, x - 20, top + 26, 5, 4, SEA_SKIN)
        line(s, x - 20, top + 30, x - 22, top + 4, C.gold1, 2)
        disc(s, x - 22, top + 2, 3, C.white); px(s, x - 23, top + 1, C.teal3)
        // head and the great crown
        const hx = x + 3
        const hy = top
        ball(s, hx, hy - 6, 8, 9, SEA_SKIN)
        rect(s, hx + 2, hy - 10, 5, 6, C.teal3)
        const eye = B.hurt ? C.ink : (B.glow > 0.5 ? C.white : C.teal3)
        rect(s, hx + 3, hy - 8, 3, 1, C.teal0); px(s, hx + 5, hy - 8, eye)
        if (B.roar || B.strike) rect(s, hx + 3, hy - 3, 3, 2, C.ink); else px(s, hx + 4, hy - 3, C.teal0)
        rect(s, hx - 7, hy - 16, 15, 3, C.gold1)
        for (let i = 0; i < 5; i++) { tri(s, hx - 7 + i * 3, hy - 16, hx - 5 + i * 3, hy - 16, hx - 6 + i * 3, hy - 23 - (i === 2 ? 4 : 0), C.gold2); px(s, hx - 6 + i * 3, hy - 22 - (i === 2 ? 4 : 0), C.white) }
        px(s, hx, hy - 15, C.pink)
        // the striking tentacle: rises and slams
        const a = bz(-0.2, -1.9, 0.6)
        tentacle(s, x + 12, top + 36, a, 44, 5, ph * 0.3, KRAKEN, C.pink)
        finish(s, Entry.Rise, 0)
    },
    fx(dst, st, t, x, y, dir) {
        ditherEllipse(dst, x, y - 1, 46, 3, C.teal0, 16)
        const k = fr(t, 10, 10)
        for (let i = 0; i < 5; i++) dst.set(x + dir * (-40 + ((i * 19 + k * 7) % 80)), y - 3, C.teal3)
        for (let i = 0; i < 3; i++) dst.set(x + dir * (-20 + i * 16), y - 90 - ((k * 4 + i * 11) % 30), C.teal3) // rising bubbles
        if (st === 'attack' && B.strike) for (let i = 0; i < 10; i++) dst.set(x + dir * (44 + i * 3), y - 2 - (i % 4), i & 1 ? C.white : C.teal3)
    }
}

export const BOSSES_A: readonly (readonly [CreatureDef, CreatureDef])[] = [
    [OLD_GNARLHIDE, GORSECROWN],
    [MOTHER_LEECH, ROTHEART],
    [SLAGJAW, PYRRHAX],
    [JARL_HRIMGAR, VINTERHEL],
    [TIDECALLER_NERINE, QUEEN_MAERITH]
]

