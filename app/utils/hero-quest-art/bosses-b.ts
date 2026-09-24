// World bosses and super bosses, Worlds 6–10 — the walk past the Void's door and out through
// the edge of the world. See bosses-a.ts for the shared conventions.

import { C } from './palette'
import type { CreatureDef } from './creature'
import { fr } from './creature'
import type { Mat } from './weapons'
import {
    B, Entry, bossStates, drive, finish, bz, ball, chain, tentacle, glowEye, wing, speckle,
    limbT, reach, P, rect, px, line, disc, ellipse, tri, quad, dither, ring, arc, poly, q, wv, bayer, hash2
} from './boss-kit'

const R = Math.round

const VIOLET: Mat = [C.purple0, C.purple1, C.purple2]
const VOIDM: Mat = [C.ink, C.void, C.purple0]
const BONE: Mat = [C.bone0, C.bone1, C.white]
const RUST_ARMOR: Mat = [C.stone0, C.stone1, C.brown2]
const STONE: Mat = [C.stone1, C.stone2, C.stone3]
const STORM: Mat = [C.night2, C.night3, C.haze]
const FEATHER: Mat = [C.stone1, C.stone2, C.steel2]
const FADED: Mat = [C.stone2, C.stone3, C.bone0]

/** Void interior: black speckled with stars that twinkle on the frame grid. */
function voidFill(s: Parameters<CreatureDef['draw']>[0], x: number, y: number, w: number, h: number, t: number, seed: number): void {
    for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
            const X = x + xx
            const Y = y + yy
            if (s.get(X, Y) === 0) continue
            const r = hash2(X * 31 + seed, Y)
            const tw = (fr(t, 4, 3) + ((X + Y) & 3)) % 3
            s.set(X, Y, r < 0.02 ? (tw ? C.white : C.haze) : r < 0.05 ? C.purple1 : bayer(X, Y, 3) ? C.void : C.ink)
        }
    }
}

// ═══════════════════════════════════════════════════════════════ 6 · Duskspire

/** Magister Halvane — a floating mage-lord with his grimoires orbiting him. */
export const MAGISTER_HALVANE: CreatureDef = {
    name: 'Magister Halvane', size: 96, shadow: 12, hover: 1, accent: C.pink,
    states: bossStates(1.2, 1.8, 1.8),
    draw(s, st, t) {
        drive(this, st, t, 4, 1.8)
        const x = s.ax - 2 + B.lunge - B.kb
        const y = s.ay
        const hover = -8 + wv(t, 1.8, 2) + R(B.die * 10)
        const hip = y - 22 + hover
        const top = hip - 22
        // grimoires behind him (the far half of the orbit)
        const orbit = (front: boolean) => {
            for (let i = 0; i < 3; i++) {
                const a = q(t) * 2.2 + i * (Math.PI * 2 / 3)
                const z = Math.sin(a)
                if ((z > 0) !== front) continue
                const bx = x + R(Math.cos(a) * 20)
                const by = top + 10 + R(z * 4)
                rect(s, bx - 3, by - 2, 6, 5, i === 0 ? C.red1 : i === 1 ? C.teal1 : C.purple1)
                rect(s, bx - 3, by + 2, 6, 1, C.bone1)
                px(s, bx, by, C.gold2)
            }
        }
        orbit(false)
        // robe to a tattered hem, hovering
        quad(s, x - 10, top + 6, x + 8, top + 6, x + 12, hip + 18, x - 16, hip + 18, VIOLET[1])
        quad(s, x - 10, top + 6, x - 4, top + 6, x - 8, hip + 18, x - 16, hip + 18, VIOLET[0])
        line(s, x + 3, top + 6, x + 8, hip + 18, C.purple2)
        for (let i = 0; i < 6; i++) tri(s, x - 16 + i * 5, hip + 18, x - 12 + i * 5, hip + 18, x - 14 + i * 5, hip + 22 + (i & 1), VIOLET[i & 1 ? 0 : 1])
        rect(s, x - 11, hip - 2, 20, 2, C.gold1)
        rect(s, x - 9, top + 6, 16, 3, C.night2) // twilight mantle
        dither(s, x - 9, top + 6, 16, 3, C.night3, 6)
        // back hand with a spell
        limbT(s, x - 8, top + 10, x - 14, top + 22, 4, 3, VIOLET)
        disc(s, x - 15, top + 24, 2, B.glow > 0.3 ? C.pink : C.purple2)
        // head: long white beard, the tall hat of his order
        const hx = x + 2
        const hy = top + 4
        rect(s, hx - 4, hy - 9, 8, 9, C.skin1)
        rect(s, hx, hy - 8, 3, 6, C.skin2)
        const eye = B.hurt ? C.ink : (B.glow > 0.5 ? C.pink : C.ink)
        px(s, hx + 2, hy - 6, eye); rect(s, hx + 1, hy - 7, 3, 1, C.white)
        tri(s, hx - 3, hy - 3, hx + 5, hy - 3, hx + 1, hy + 14, C.bone1) // beard
        line(s, hx + 1, hy - 2, hx + 1, hy + 12, C.white)
        if (B.roar || B.strike) rect(s, hx + 1, hy - 2, 3, 2, C.ink)
        rect(s, hx - 7, hy - 10, 15, 2, C.purple1) // brim
        quad(s, hx - 5, hy - 10, hx + 5, hy - 10, hx + 1, hy - 26, hx - 1, hy - 26, C.purple1)
        line(s, hx + 1, hy - 25, hx + 4, hy - 11, C.purple2)
        rect(s, hx - 5, hy - 12, 10, 2, C.gold1)
        px(s, hx, hy - 18, C.gold3); px(s, hx - 1, hy - 21, C.pink)
        // staff arm
        const sx = x + 6
        const sy = top + 10
        const a = bz(-1.4, -1.7, -0.3)
        const gx = sx + R(bz(4, 2, 10))
        const gy = sy + R(bz(8, 2, 4))
        limbT(s, sx, sy, gx, gy, 4, 3, VIOLET)
        reach(gx, gy, a, 20)
        line(s, gx - Math.cos(a) * 12, gy - Math.sin(a) * 12, P.x, P.y, C.brown2, 2)
        tri(s, P.x - 3, P.y, P.x + 3, P.y, P.x, P.y - 8, C.pink)
        px(s, P.x, P.y - 5, C.white)
        orbit(true)
        finish(s, Entry.Fade)
    },
    fx(dst, st, t, x, y, dir) {
        const k = fr(t, 10, 10)
        for (let i = 0; i < 3; i++) dst.set(x + dir * (-12 + ((i * 11 + k * 3) % 26)), y - 60 + ((k * 5 + i * 13) % 50), C.pink)
        if ((st === 'attack' && B.strike) || B.roar) {
            for (let i = 0; i < 14; i++) {
                const a = (i / 14) * Math.PI * 2
                dst.set(x + dir * 22 + R(Math.cos(a) * 6), y - 68 + R(Math.sin(a) * 6), i & 1 ? C.white : C.pink)
            }
        }
    }
}

/** Archmage Ithren, the Door-Opener — floating before the door he opened, the Void behind it. */
export const ARCHMAGE_ITHREN: CreatureDef = {
    name: 'Archmage Ithren, the Door-Opener', size: 128, shadow: 18, hover: 1, accent: C.purple2,
    states: bossStates(1.5, 2.0, 2.6),
    draw(s, st, t) {
        drive(this, st, t, 4, 2.0)
        const x = s.ax - 4 + B.lunge - B.kb
        const y = s.ay
        // the door: a stone arch whose opening widens as he arrives
        const open = st === 'entry' ? B.ent : 1 - B.die * 0.8
        const dw = R(12 + open * 14)
        const dx = x - 20
        const dTop = y - 108
        rect(s, dx - dw - 6, dTop + 16, 6, 92, STONE[1])
        rect(s, dx + dw, dTop + 16, 6, 92, STONE[1])
        ellipse(s, dx, dTop + 18, dw + 6, 18, STONE[1])
        ellipse(s, dx, dTop + 18, dw, 15, C.ink)
        rect(s, dx - dw, dTop + 18, dw * 2 + 1, 90, C.ink)
        voidFill(s, dx - dw, dTop + 3, dw * 2 + 1, 105, t, 7)
        for (let i = 0; i < 6; i++) { px(s, dx - dw - 3, dTop + 24 + i * 14, STONE[2]); px(s, dx + dw + 2, dTop + 30 + i * 14, STONE[0]) }
        speckle(s, dx - dw - 6, dTop, dw * 2 + 12, 108, STONE, 3)
        // cracks of violet running out of the door
        line(s, dx + dw + 6, dTop + 40, dx + dw + 14, dTop + 46, C.purple2)
        line(s, dx - dw - 6, dTop + 70, dx - dw - 12, dTop + 74, C.purple2)
        // Ithren
        const hover = -10 + wv(t, 2.0, 2) + R(B.die * 12)
        const hip = y - 30 + hover
        const top = hip - 30
        quad(s, x - 13, top + 8, x + 11, top + 8, x + 16, hip + 26, x - 18, hip + 26, VIOLET[1])
        quad(s, x - 13, top + 8, x - 5, top + 8, x - 9, hip + 26, x - 18, hip + 26, VIOLET[0])
        rect(s, x - 2, top + 10, 4, 40, C.gold1) // gold panel
        for (let i = 0; i < 5; i++) px(s, x, top + 14 + i * 8, C.purple2)
        for (let i = 0; i < 7; i++) tri(s, x - 18 + i * 5, hip + 26, x - 14 + i * 5, hip + 26, x - 16 + i * 5, hip + 31 + (i & 1), VIOLET[i & 1]!)
        // void cracks in the robe itself
        line(s, x - 8, hip, x - 4, hip + 18, C.ink); px(s, x - 6, hip + 8, C.white)
        // high collar
        tri(s, x - 14, top + 10, x - 4, top + 8, x - 12, top - 12, C.void)
        tri(s, x + 12, top + 10, x + 4, top + 8, x + 12, top - 10, C.void)
        // both hands raised, holding the door open
        const ha = bz(-2.2, -2.5, -0.2)
        limbT(s, x - 10, top + 12, x - 22, top - 4, 5, 4, VIOLET)
        disc(s, x - 23, top - 6, 2, C.skin1)
        reach(x + 10, top + 12, ha, 18)
        limbT(s, x + 10, top + 12, P.x, P.y, 5, 4, VIOLET)
        disc(s, P.x, P.y, 2, C.skin1)
        disc(s, P.x + 1, P.y - 1, B.glow > 0.3 ? 4 : 2, B.glow > 0.3 ? C.pink : C.purple2)
        // gaunt face, burning eyes, a circlet
        const hx = x + 1
        const hy = top + 6
        rect(s, hx - 4, hy - 10, 9, 10, C.skin1)
        rect(s, hx - 4, hy - 10, 2, 10, C.skin0)
        rect(s, hx + 1, hy - 9, 3, 7, C.skin2)
        const eye = B.hurt ? C.ink : C.pink
        rect(s, hx + 1, hy - 6, 3, 1, C.purple0); px(s, hx + 3, hy - 6, eye); px(s, hx + 3, hy - 7, C.white)
        line(s, hx - 1, hy - 2, hx + 4, hy - 2, C.skin0)
        if (B.roar || B.strike) rect(s, hx + 1, hy - 3, 3, 2, C.ink)
        rect(s, hx - 5, hy - 12, 11, 2, C.gold1); px(s, hx + 1, hy - 13, C.purple2); px(s, hx + 1, hy - 14, C.pink)
        rect(s, hx - 5, hy - 10, 3, 8, C.bone1) // long white hair
        finish(s, Entry.Fade)
    },
    fx(dst, st, t, x, y, dir) {
        const k = fr(t, 10, 12)
        for (let i = 0; i < 4; i++) dst.set(x - dir * (20 + ((i * 7 + k) % 30) - 15), y - 100 + ((i * 29 + k * 7) % 90), i & 1 ? C.pink : C.purple2)
        if ((st === 'attack' && (B.strike || B.rec > 0.5)) || B.roar) {
            for (let i = 0; i < 40; i++) dst.set(x + dir * (20 + i), y - 76 + R(Math.sin(i * 0.5 + k) * 2), i % 3 ? C.pink : C.white)
            for (let i = 0; i < 40; i++) dst.set(x + dir * (20 + i), y - 77 + R(Math.sin(i * 0.5 + k) * 2), C.purple2)
        }
    }
}

// ═══════════════════════════════════════════════════════════════ 7 · The Bonefields

/** Grave Marshal Korr — the forgotten war's general, still carrying its banner. */
export const GRAVE_MARSHAL_KORR: CreatureDef = {
    name: 'Grave Marshal Korr', size: 96, shadow: 16, accent: C.green4,
    states: bossStates(1.2, 1.6, 2.0),
    draw(s, st, t) {
        drive(this, st, t, 8, 1.6)
        const x = s.ax - 4 + B.lunge - B.kb
        const y = s.ay
        const crouch = R(B.strike ? 4 : B.rec * 3 + B.die * 14)
        const hip = y - 24 + crouch + B.bob
        const top = hip - 22
        // banner on his back: a pole and a torn red flag
        line(s, x - 8, top - 26, x - 6, hip + 4, C.brown1, 2)
        const flap = fr(t, 5, 3)
        poly(s, [0, 0, -16, 2 + flap, -14, 8, -18, 14 - flap, 0, 12], x - 8, top - 24, C.red1)
        line(s, x - 8, top - 24, x - 22, top - 22 + flap, C.red2)
        px(s, x - 12, top - 18, C.bone1); px(s, x - 13, top - 19, C.bone1) // sigil
        // cape
        quad(s, x - 8, top + 2, x, top + 2, x - 6, y - 4, x - 20, y - 2 + flap, C.red1)
        line(s, x - 8, top + 2, x - 20, y - 2 + flap, C.red0)
        // legs: bone in black greaves
        limbT(s, x - 3, hip, x - 6, y - 3, 6, 5, RUST_ARMOR)
        limbT(s, x + 5, hip, x + 7, y - 3, 6, 5, [C.stone1, C.stone2, C.gold1])
        // armour over a ribcage
        rect(s, x - 10, top + 2, 20, 20, C.stone1)
        rect(s, x - 10, top + 2, 20, 2, C.gold1)
        for (let i = 0; i < 3; i++) { rect(s, x - 7, top + 8 + i * 4, 14, 1, C.bone1); px(s, x - 8, top + 8 + i * 4, C.bone0) }
        rect(s, x - 1, top + 6, 2, 16, C.bone1)
        disc(s, x + 1, top + 12, 2, C.green3) // soul-fire in the ribs
        px(s, x + 1, top + 12, C.green4)
        ball(s, x + 8, top + 3, 5, 3, [C.stone0, C.stone1, C.gold1]) // pauldron
        rect(s, x - 10, hip - 3, 20, 3, C.brown0)
        // back arm
        limbT(s, x - 8, top + 4, x - 12, top + 18, 4, 3, BONE)
        // skull in a crested helm
        const hx = x + 3
        const hy = top + 2 + R(B.die * 4)
        rect(s, hx - 5, hy - 11, 10, 11, C.bone1)
        rect(s, hx - 4, hy - 1, 8, 2, C.bone0)
        for (let i = 0; i < 4; i++) px(s, hx - 3 + i * 2, hy - 1, C.ink)
        rect(s, hx + 1, hy - 7, 3, 3, C.ink)
        glowEye(s, hx + 2, hy - 6, B.hurt ? C.white : C.green4, C.green2)
        px(s, hx + 4, hy - 3, C.ink)
        rect(s, hx - 6, hy - 14, 12, 5, C.stone1)
        rect(s, hx - 6, hy - 14, 12, 1, C.gold1)
        rect(s, hx - 6, hy - 10, 2, 7, C.stone0)
        for (let i = 0; i < 7; i++) line(s, hx - 5 + i * 2, hy - 15, hx - 7 + i * 2, hy - 20 - (i === 3 ? 2 : 0), i & 1 ? C.red2 : C.red1, 2) // crest
        // greatsword
        const sx = x + 8
        const sy = top + 6
        const a = bz(-1.2, -2.6, 0.6)
        reach(sx, sy, a, 12)
        const gx = P.x
        const gy = P.y
        limbT(s, sx, sy, gx, gy, 4, 3, BONE)
        reach(gx, gy, a, 30)
        line(s, gx, gy, P.x, P.y, C.steel1, 3)
        line(s, gx + Math.sin(a), gy - Math.cos(a), P.x + Math.sin(a), P.y - Math.cos(a), C.steel2)
        px(s, P.x, P.y, C.white)
        line(s, gx - Math.sin(a) * 4, gy + Math.cos(a) * 4, gx + Math.sin(a) * 4, gy - Math.cos(a) * 4, C.gold1, 2)
        finish(s, Entry.Rise, 12)
    },
    fx(dst, st, t, x, y, dir) {
        if (st === 'attack' && B.strike) for (let i = 0; i < 8; i++) dst.set(x + dir * (22 + i * 2), y - (i % 3), i & 1 ? C.bone1 : C.stone3)
        if (st === 'entry' && B.ent < 1) for (let i = 0; i < 10; i++) dst.set(x + dir * (-14 + i * 3), y - 1 - (i & 1), i & 1 ? C.brown2 : C.bone0)
        const k = fr(t, 10, 8)
        dst.set(x + dir * 4, y - 60 - k * 2, C.green3)
    }
}

/** Ossuar, the Thousand-Bone Host — the dead of the whole war, fused into one walking mound. */
export const OSSUAR: CreatureDef = {
    name: 'Ossuar, the Thousand-Bone Host', size: 128, shadow: 36, accent: C.green4,
    states: bossStates(1.5, 2.0, 2.6),
    draw(s, st, t) {
        drive(this, st, t, 6, 2.0)
        const x = s.ax - 2 + B.lunge - B.kb
        const y = s.ay
        const top = y - 84 + B.breath + R(B.die * 24)
        // far arms
        limbT(s, x - 18, top + 30, x - 34, top + 56, 7, 5, BONE)
        limbT(s, x - 34, top + 56, x - 30, y - 6, 5, 4, BONE)
        // the mound: layered skulls and bones
        ball(s, x, top + 50, 34, 30, [C.bone0, C.bone0, C.bone1], false)
        dither(s, x - 34, top + 56, 68, 26, C.stone2, 5)
        for (let i = 0; i < 26; i++) {
            const bx = x - 28 + R(hash2(5, i) * 56)
            const by = top + 26 + R(hash2(6, i) * 50)
            if (s.get(bx, by) === 0) continue
            if (i % 3 === 0) { line(s, bx - 4, by, bx + 4, by + (i & 1 ? 2 : -2), C.bone1, 2); px(s, bx - 5, by, C.white); px(s, bx + 5, by + (i & 1 ? 2 : -2), C.white) } else {
                rect(s, bx - 2, by - 2, 5, 4, C.bone1); px(s, bx - 1, by - 1, C.ink); px(s, bx + 1, by - 1, C.ink); px(s, bx, by + 1, C.bone0)
            }
        }
        // ribcage chest with green soul-fire
        const cx = x + 4
        const cy = top + 34
        ellipse(s, cx, cy, 12, 10, C.ink)
        for (let i = 0; i < 4; i++) arc(s, cx, cy - 2 + i * 4, 11, -0.3, Math.PI + 0.3, C.bone1)
        rect(s, cx - 1, cy - 9, 3, 18, C.bone1)
        const pulse = fr(t, 5, 2)
        disc(s, cx + 2, cy + 1, 4 + pulse, C.green2)
        disc(s, cx + 2, cy + 1, 2 + pulse, C.green4)
        // the great skull on top, with horns
        const hx = x + 8
        const hy = top + 10 + R(bz(0, -4, 6))
        ellipse(s, hx, hy, 11, 10, C.bone1)
        ellipse(s, hx - 3, hy - 3, 6, 5, C.white)
        rect(s, hx - 6, hy + 7, 14, 5, C.bone0)
        const open = B.strike || B.roar ? 3 : 0
        rect(s, hx - 4, hy + 8 + open, 12, 3, C.bone1)
        if (open) rect(s, hx - 4, hy + 8, 12, open, C.ink)
        for (let i = 0; i < 6; i++) px(s, hx - 4 + i * 2, hy + 8 + open, C.ink)
        ellipse(s, hx + 1, hy, 3, 3, C.ink)
        ellipse(s, hx + 8, hy, 2, 3, C.ink)
        glowEye(s, hx + 1, hy, B.hurt ? C.white : C.green4, C.green2, true)
        glowEye(s, hx + 8, hy, B.hurt ? C.white : C.green4, C.green2)
        tri(s, hx + 5, hy + 4, hx + 7, hy + 4, hx + 6, hy + 6, C.ink)
        for (const d of [-1, 1]) { line(s, hx + d * 9, hy - 6, hx + d * 16, hy - 14, C.bone0, 3); line(s, hx + d * 16, hy - 14, hx + d * 14, hy - 22, C.bone1, 2) }
        // near arms: a big one that slams
        const sx = x + 22
        const sy = top + 30
        const a = bz(1.0, -1.3, 1.3)
        reach(sx, sy, a, 36)
        limbT(s, sx, sy, P.x, P.y, 9, 6, BONE)
        for (let i = 0; i < 4; i++) line(s, P.x, P.y, P.x + 4 + i * 2, P.y + 4 + (i & 1) * 2, C.bone1, 2) // claw-fingers
        limbT(s, x + 10, top + 58, x + 22, y - 4, 6, 5, BONE)
        finish(s, Entry.Rise, 14)
    },
    fx(dst, st, t, x, y, dir) {
        if (st === 'attack' && B.strike) for (let i = 0; i < 12; i++) dst.set(x + dir * (40 + i * 2), y - (i % 4), i & 1 ? C.bone1 : C.stone3)
        const k = fr(t, 10, 10)
        for (let i = 0; i < 3; i++) dst.set(x + dir * (-10 + i * 12), y - 56 - ((k * 3 + i * 7) % 24), C.green3)
    }
}

// ═══════════════════════════════════════════════════════════════ 8 · The Shattered Sky

/** Stormcrown Roc — a thunderbird wearing a crown of its own lightning. */
export const STORMCROWN_ROC: CreatureDef = {
    name: 'Stormcrown Roc', size: 96, shadow: 18, hover: 1, accent: C.gold3,
    states: bossStates(1.1, 1.0, 1.8),
    draw(s, st, t) {
        drive(this, st, t, 14, 1.0)
        const x = s.ax - 4 + B.lunge - B.kb
        const dive = R(bz(0, -8, 14))
        const y = s.ay - 34 + wv(t, 1.0, 3) + dive + R(B.die * 30)
        const flap = st === 'death' ? -0.5 : Math.sin(q(t) * Math.PI * 2 / (st === 'attack' ? 0.5 : 1.0)) * (B.strike ? 0.3 : 1)
        // far wing
        wing(s, x - 4, y - 6, 34, flap, [C.stone0, C.stone1, C.stone2], true)
        // tail
        for (let i = 0; i < 4; i++) line(s, x - 12, y + 2, x - 24 - i, y + 8 + i * 3, i & 1 ? C.stone1 : C.steel2, 2)
        // body
        ball(s, x, y, 14, 10, FEATHER)
        dither(s, x - 12, y + 3, 24, 6, C.bone0, 6) // pale breast
        // talons, reaching forward on the strike
        const ta = B.strike ? 0.2 : 1.3
        for (const [lx, c] of [[-2, C.gold1], [5, C.gold2]] as const) {
            reach(x + lx, y + 8, ta, 12)
            line(s, x + lx, y + 8, P.x, P.y, c, 2)
            for (let i = -1; i <= 1; i++) line(s, P.x, P.y, P.x + 3 + i, P.y + 2 + i * 2, C.ink)
        }
        // head, beak and the lightning crown
        const hx = x + 14
        const hy = y - 8
        ball(s, hx, hy, 7, 6, FEATHER)
        tri(s, hx + 5, hy - 2, hx + 5, hy + 3, hx + 14, hy + 3, C.gold2)
        tri(s, hx + 5, hy + 1, hx + 12, hy + 3, hx + 11, hy + 5, C.gold1)
        if (B.roar || B.strike) tri(s, hx + 6, hy + 2, hx + 12, hy + 4, hx + 6, hy + 5, C.ink)
        const eye = B.hurt ? C.ink : C.gold3
        px(s, hx + 3, hy - 2, eye); px(s, hx + 2, hy - 3, C.ink)
        const k = fr(t, 10, 2)
        for (let i = 0; i < 4; i++) {
            const bx = hx - 5 + i * 3
            line(s, bx, hy - 6, bx + (k ? 1 : -1), hy - 10 - (i & 1) * 2, C.gold3)
            line(s, bx + (k ? 1 : -1), hy - 10 - (i & 1) * 2, bx, hy - 13 - (i & 1) * 3, C.white)
        }
        // near wing
        wing(s, x + 2, y - 4, 30, flap, FEATHER, true)
        finish(s, Entry.Drop, 0)
    },
    fx(dst, st, t, x, y, dir) {
        const k = fr(t, 10, 6)
        if (k === 0 || B.roar) {
            // a crackle jumping from the crown
            let lx = x + dir * 8
            for (let yy = y - 64; yy > y - 90; yy--) { if ((yy & 3) === 0) lx += dir * (((yy * 7) & 2) - 1); dst.set(lx, yy, (yy & 1) ? C.gold3 : C.white) }
        }
        if (st === 'attack' && B.strike) for (let i = 0; i < 10; i++) dst.set(x + dir * (30 + i * 2), y - 36 + (i & 1), C.white)
    }
}

/** Zephyrax, Breaker of Heavens — a storm-dragon coiling through the broken islands. */
export const ZEPHYRAX: CreatureDef = {
    name: 'Zephyrax, Breaker of Heavens', size: 128, shadow: 20, hover: 1, accent: C.cyan,
    states: bossStates(1.4, 2.0, 2.2),
    draw(s, st, t) {
        drive(this, st, t, 12, 2.0)
        const x = s.ax - 6 - B.kb
        const y = s.ay
        const ph = q(t) * Math.PI
        const hx = x + 18 + R(bz(0, -10, 14)) + wv(t, 2.0, 2)
        const hy = y - 80 + R(bz(0, -8, 8)) + R(B.die * 50) + wv(t, 2.0, 2, 0.3)
        // floating island fragments
        for (const [ix, iy, w] of [[-44, -30, 10], [30, -98, 7], [-30, -104, 6]] as const) {
            const bob = wv(t, 2.0, 1, ix * 0.01)
            tri(s, x + ix - w, y + iy + bob, x + ix + w, y + iy + bob, x + ix, y + iy + w + 4 + bob, C.stone1)
            rect(s, x + ix - w, y + iy - 2 + bob, w * 2, 2, C.green2)
            px(s, x + ix - w + 2, y + iy - 3 + bob, C.green3)
        }
        // the long body looping behind and up
        chain(s, x - 40, y - 20, x - 10 + Math.sin(ph) * 6, y + 6, x + 10, y - 30, 5, 9, STORM, 16, C.frost)
        chain(s, x + 10, y - 30, x + 34, y - 60, hx - 6, hy + 6, 9, 7, STORM, 16, C.frost)
        // tail end with a wind-fin
        tri(s, x - 40, y - 20, x - 50, y - 28, x - 48, y - 12, C.haze)
        // small wings
        wing(s, x + 22, y - 46, 22, Math.sin(ph * 2), [C.night1, C.night2, C.cyan], false)
        // head
        const open = B.strike || B.roar ? 5 : 1
        poly(s, [-8, -5, 8, -7, 20, -2, 20, 1, -6, 2], hx, hy, STORM[1])
        poly(s, [-6, 2 + open, 18, 2 + open, 16, 5 + open, -4, 6], hx, hy, STORM[0])
        if (open > 1) quad(s, hx - 4, hy + 2, hx + 18, hy + 1, hx + 16, hy + 2 + open, hx - 4, hy + 2 + open, C.blue0)
        line(s, hx - 6, hy - 4, hx + 18, hy - 2, C.haze)
        const eye = B.hurt ? C.ink : C.white
        rect(s, hx + 5, hy - 5, 4, 2, C.cyan); px(s, hx + 7, hy - 5, eye)
        // lightning horns
        const k = fr(t, 10, 2)
        for (const d of [0, 5]) {
            line(s, hx - 4 + d, hy - 6, hx - 10 + d, hy - 12, C.cyan, 2)
            line(s, hx - 10 + d, hy - 12, hx - 7 + d + k, hy - 18, C.frost, 2)
            line(s, hx - 7 + d + k, hy - 18, hx - 14 + d, hy - 23, C.white)
        }
        finish(s, Entry.Drop, 0)
    },
    fx(dst, st, t, x, y, dir) {
        const k = fr(t, 10, 8)
        for (let i = 0; i < 6; i++) { const yy = y - 110 + ((i * 19 + k * 9) % 100); dst.set(x + dir * (-50 + ((i * 23) % 90)), yy, C.haze); dst.set(x + dir * (-49 + ((i * 23) % 90)), yy + 1, C.night3) }
        if ((st === 'attack' && (B.strike || B.rec > 0.5)) || B.roar) {
            let ly = y - 78
            for (let i = 0; i < 50; i++) { if ((i & 3) === 0) ly += ((i * 13 + k) & 2) - 1; dst.set(x + dir * (40 + i), ly, i & 1 ? C.cyan : C.white); dst.set(x + dir * (40 + i), ly + 1, C.frost) }
        }
    }
}

// ═══════════════════════════════════════════════════════════════ 9 · The Fraying

/** Sister Vesper, the Forgotten — a veiled nun no one remembers, fraying at the hem. */
export const SISTER_VESPER: CreatureDef = {
    name: 'Sister Vesper, the Forgotten', size: 96, shadow: 10, hover: 1, accent: C.haze,
    states: bossStates(1.2, 2.0, 2.0),
    draw(s, st, t) {
        drive(this, st, t, 6, 2.0)
        const x = s.ax - 2 + B.lunge - B.kb
        const y = s.ay
        const hover = -10 + wv(t, 2.0, 2) + R(B.die * 12)
        const top = y - 56 + hover
        // habit: long, grey, fraying into threads at the hem
        quad(s, x - 9, top + 12, x + 7, top + 12, x + 12, top + 44, x - 15, top + 44, FADED[1])
        quad(s, x - 9, top + 12, x - 3, top + 12, x - 8, top + 44, x - 15, top + 44, FADED[0])
        for (let i = 0; i < 14; i++) {
            const tx = x - 15 + i * 2
            const len = 4 + ((i * 7) % 9) + fr(t, 3, 2)
            line(s, tx, top + 44, tx - 1 + ((i & 1) * 2), top + 44 + len, i % 3 ? C.stone3 : C.bone0)
        }
        rect(s, x - 9, top + 22, 16, 2, C.stone2)
        // prayer beads
        for (let i = 0; i < 7; i++) px(s, x - 5 + i, top + 25 + (i % 3 === 1 ? 1 : 0), C.bone1)
        px(s, x - 2, top + 28, C.bone1); px(s, x - 2, top + 29, C.bone1)
        // veil and wimple
        ellipse(s, x, top + 6, 9, 10, C.bone0)
        rect(s, x - 9, top + 6, 3, 18, C.bone0)
        ellipse(s, x + 2, top + 6, 5, 6, C.stone3) // veiled face
        dither(s, x - 2, top + 1, 9, 10, C.bone1, 6)
        const eye = B.hurt ? C.white : C.frost
        px(s, x + 3, top + 5, eye); px(s, x + 5, top + 5, C.haze)
        if (B.roar || B.strike) { rect(s, x + 3, top + 8, 3, 3, C.ink) }
        // back hand at prayer
        limbT(s, x - 6, top + 14, x - 1, top + 22, 3, 3, FADED)
        // lantern held out
        const sx = x + 6
        const sy = top + 14
        const lx = sx + R(bz(6, 2, 16))
        const ly = sy + R(bz(8, 2, 2))
        limbT(s, sx, sy, lx, ly - 2, 3, 3, FADED)
        line(s, lx, ly - 2, lx, ly + 2, C.stone1)
        rect(s, lx - 3, ly + 2, 7, 7, C.stone1)
        rect(s, lx - 2, ly + 3, 5, 5, fr(t, 5, 2) || B.glow > 0.5 ? C.frost : C.cyan)
        px(s, lx, ly + 5, C.white)
        rect(s, lx - 3, ly + 9, 7, 1, C.stone0)
        finish(s, Entry.Fade)
    },
    fx(dst, st, t, x, y, dir) {
        const k = fr(t, 10, 16)
        for (let i = 0; i < 4; i++) dst.set(x + dir * (-8 + ((i * 7 + k) % 18)), y - 10 - ((k * 3 + i * 11) % 40), i & 1 ? C.haze : C.pink) // threads coming loose
        if ((st === 'attack' && B.strike) || B.roar) for (let r = 4; r < 20; r += 5) for (let a = -0.8; a <= 0.8; a += 0.2) dst.set(x + dir * R(12 + Math.cos(a) * r), y - 48 + R(Math.sin(a) * r), r % 2 ? C.frost : C.haze)
    }
}

/** Liminus, the Last Door — not a guardian of a door; the door itself, with an eye. */
export const LIMINUS: CreatureDef = {
    name: 'Liminus, the Last Door', size: 128, shadow: 30, accent: C.pink,
    states: bossStates(1.5, 2.0, 2.4),
    draw(s, st, t) {
        drive(this, st, t, 4, 2.0)
        const x = s.ax + B.lunge - B.kb
        const y = s.ay
        const top = y - 104 + B.breath + R(B.die * 20)
        const lean = R(B.die * 6)
        // the arch: two pillars and a pointed lintel
        const w = 22
        rect(s, x - w - 8 + lean, top + 24, 10, y - top - 24, STONE[1])
        rect(s, x + w - 2 + lean, top + 24, 10, y - top - 24, STONE[1])
        rect(s, x - w - 8 + lean, top + 24, 2, y - top - 24, STONE[2])
        rect(s, x + w + 6 + lean, top + 24, 2, y - top - 24, STONE[0])
        tri(s, x - w - 8 + lean, top + 26, x + w + 8 + lean, top + 26, x + lean, top - 6, STONE[1])
        tri(s, x - w + 2 + lean, top + 26, x + w - 2 + lean, top + 26, x + lean, top + 6, C.ink)
        rect(s, x - w + 2 + lean, top + 24, 2 * w - 3, y - top - 24, C.ink)
        // the inside of the door — colour gone, stars, a thread-pale horizon
        voidFill(s, x - w + 2 + lean, top + 6, 2 * w - 3, y - top - 6, t, 11)
        const glow = B.glow > 0.3 ? 8 : 3
        dither(s, x - w + 2 + lean, y - 20, 2 * w - 3, 20, C.haze, glow)
        // keystone eye: opens on the wind-up
        const ex = x + lean
        const ey = top + 2
        rect(s, ex - 6, ey - 6, 12, 11, STONE[2])
        const lid = B.strike || B.roar ? 4 : B.wind > 0.3 ? 3 : st === 'death' ? 0 : 2
        ellipse(s, ex, ey, 5, lid, C.white)
        if (lid > 0) { disc(s, ex + 1, ey, Math.min(2, lid), B.hurt ? C.ink : C.pink); px(s, ex + 1, ey, C.ink) } else line(s, ex - 4, ey, ex + 4, ey, C.ink)
        speckle(s, x - w - 8, top - 6, 2 * w + 16, y - top, STONE, 9)
        // threads unravelling off the edges
        const f = fr(t, 4, 2)
        for (let i = 0; i < 5; i++) {
            line(s, x + w + 8 + lean, top + 34 + i * 12, x + w + 14 + lean + ((i + f) & 1) * 2, top + 40 + i * 12 + f * 2, i & 1 ? C.haze : C.pink)
            line(s, x - w - 8 + lean, top + 40 + i * 12, x - w - 13 + lean, top + 46 + i * 12 - f, i & 1 ? C.bone0 : C.haze)
        }
        // two floating stone hands
        const hy = y - 44 + wv(t, 2.0, 2)
        const ha = bz(0, -14, 10)
        ball(s, x + w + 18 + lean + R(ha * 0.4), hy + R(ha), 6, 5, STONE)
        ball(s, x - w - 18 + lean, hy + 4, 6, 5, STONE)
        finish(s, Entry.Rise, 12)
    },
    fx(dst, st, t, x, y, dir) {
        const k = fr(t, 10, 8)
        for (let i = 0; i < 3; i++) dst.set(x + dir * (-20 + ((i * 17 + k * 5) % 40)), y - 110 - ((k * 2 + i * 5) % 12), C.haze)
        if ((st === 'attack' && (B.strike || B.rec > 0.5)) || B.roar) {
            for (let i = 0; i < 44; i++) for (let j = -2; j <= 2; j++) if ((i + j) % 3) dst.set(x + dir * (4 + i), y - 102 + j + R(Math.sin(i * 0.4) * 1), j === 0 ? C.white : C.pink)
        }
    }
}

// ═══════════════════════════════════════════════════════════════ 10 · The Void

/** Void Herald — the winged thing that announces the end, sounding a bone horn. */
export const VOID_HERALD: CreatureDef = {
    name: 'Void Herald', size: 96, shadow: 12, hover: 1, accent: C.purple2,
    states: bossStates(1.2, 1.6, 2.0),
    draw(s, st, t) {
        drive(this, st, t, 4, 1.6)
        const x = s.ax - 2 + B.lunge - B.kb
        const y = s.ay
        const hover = -12 + wv(t, 1.6, 2) + R(B.die * 14)
        const top = y - 56 + hover
        const flap = Math.sin(q(t) * Math.PI * 2 / 1.6)
        // four wings, starred
        wing(s, x - 2, top + 8, 30, flap * 0.6 + 0.5, VOIDM, false)
        wing(s, x - 2, top + 14, 24, flap * 0.6 - 0.4, VOIDM, false)
        // halo of black fire
        ring(s, x + 2, top - 6, 11, C.purple1)
        ring(s, x + 2, top - 6, 10, C.void)
        // body: a tall slender shape, violet-rimmed
        quad(s, x - 6, top + 6, x + 6, top + 6, x + 4, top + 50, x - 10, top + 50, C.void)
        line(s, x + 6, top + 6, x + 4, top + 50, C.purple2)
        line(s, x - 6, top + 6, x - 10, top + 50, C.purple0)
        for (let i = 0; i < 5; i++) px(s, x - 3 + ((i * 3) % 6), top + 12 + i * 8, (fr(t, 4, 2) + i) & 1 ? C.white : C.haze) // stars inside
        tri(s, x - 10, top + 50, x + 4, top + 50, x - 4, top + 58, C.void)
        // head: smooth, eyeless but for one line of light
        ellipse(s, x + 2, top, 5, 7, C.void)
        line(s, x + 2, top - 1, x + 6, top - 1, B.hurt ? C.white : C.pink)
        line(s, x + 6, top - 5, x + 6, top + 4, C.purple2)
        // back arm down, front arm raising the horn
        limbT(s, x - 4, top + 10, x - 8, top + 26, 3, 2, VOIDM)
        const a = bz(0.6, -0.7, -0.15)
        reach(x + 4, top + 10, a, 10)
        limbT(s, x + 4, top + 10, P.x, P.y, 3, 2, VOIDM)
        const hx = P.x
        const hy = P.y
        reach(hx, hy, a - 0.6, 14)
        line(s, hx, hy, P.x, P.y, C.bone1, 2)
        disc(s, P.x, P.y, 2.5, C.bone0)
        disc(s, P.x, P.y, 1.2, C.ink)
        line(s, hx, hy, P.x, P.y + 1, C.bone0)
        finish(s, Entry.Fade)
    },
    fx(dst, st, t, x, y, dir) {
        const k = fr(t, 10, 10)
        for (let i = 0; i < 3; i++) dst.set(x + dir * (-20 + ((i * 13 + k * 3) % 40)), y - 20 - ((k * 5 + i * 9) % 50), C.purple2)
        if ((st === 'attack' && (B.strike || B.rec > 0.4)) || B.roar) {
            for (let r = 4; r <= 28; r += 6) {
                const rr = r + (k % 3) * 2
                for (let a = -0.7; a <= 0.7; a += 0.12) dst.set(x + dir * R(24 + Math.cos(a) * rr), y - 48 + R(Math.sin(a) * rr), r % 12 ? C.pink : C.white)
            }
        }
    }
}

/** Nihil, the Hunger at the End — a mouth the size of the sky, with eyes all round it. */
export const NIHIL: CreatureDef = {
    name: 'Nihil, the Hunger at the End', size: 128, shadow: 0, accent: C.pink,
    states: bossStates(1.6, 2.4, 2.8),
    draw(s, st, t) {
        drive(this, st, t, 8, 2.4)
        const x = s.ax - 2 + B.lunge - B.kb
        const y = s.ay
        const cy = y - 56 + B.breath + R(B.die * 20)
        const ph = q(t) * 1.8
        // tendrils trailing down into nothing
        for (let i = 0; i < 6; i++) tentacle(s, x - 26 + i * 10, cy + 36, Math.PI / 2 + (i - 2.5) * 0.18, 26, 3, ph + i, [C.ink, C.void, C.purple1])
        // the mass
        ellipse(s, x, cy, 50, 44, C.ink)
        ellipse(s, x - 2, cy - 2, 47, 41, C.void)
        voidFill(s, x - 50, cy - 44, 100, 88, t, 21)
        // a violet rim-light on the upper edge
        arc(s, x, cy, 49, Math.PI * 1.05, Math.PI * 1.95, C.purple2)
        arc(s, x, cy, 48, Math.PI * 1.15, Math.PI * 1.85, C.purple1)
        // the maw: a ring of teeth that opens on the wind-up and snaps on the strike
        const open = B.strike ? 26 : B.wind > 0 ? 14 + R(B.wind * 12) : B.roar ? 24 : 12 + wv(t, 2.4, 2)
        const mx = x + 10
        ellipse(s, mx, cy + 4, open * 0.8, open * 0.55, C.ink)
        ellipse(s, mx, cy + 4, open * 0.6, open * 0.4, C.purple0)
        disc(s, mx, cy + 4, Math.max(1, open * 0.15), C.pink)
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2
            const tx = mx + R(Math.cos(a) * open * 0.8)
            const ty = cy + 4 + R(Math.sin(a) * open * 0.55)
            const ix = mx + R(Math.cos(a) * open * 0.6)
            const iy = cy + 4 + R(Math.sin(a) * open * 0.4)
            tri(s, tx - 1, ty, tx + 1, ty, ix, iy, C.bone1)
            px(s, ix, iy, C.white)
        }
        // eyes all around
        for (let i = 0; i < 9; i++) {
            const a = -Math.PI * 0.95 + i * 0.26 + (i > 4 ? 0.6 : 0)
            const r = 36 + ((i * 7) % 5)
            const ex = x + R(Math.cos(a) * r * 0.9)
            const ey = cy + R(Math.sin(a) * r * 0.8)
            const blink = (fr(t, 3, 11) === i) || B.hurt
            ellipse(s, ex, ey, 3, blink ? 0 : 2, C.white)
            if (!blink) { px(s, ex + 1, ey, C.pink); px(s, ex + 1, ey - 1, C.ink) }
        }
        finish(s, Entry.Grow, 0)
    },
    fx(dst, st, t, x, y, dir) {
        const k = fr(t, 10, 12)
        for (let i = 0; i < 6; i++) {
            // matter being pulled in toward the maw
            const a = i * 1.1 + k * 0.2
            const r = 60 - ((k * 4 + i * 9) % 40)
            dst.set(x + dir * (10 + R(Math.cos(a) * r)), y - 52 + R(Math.sin(a) * r * 0.7), i & 1 ? C.haze : C.purple2)
        }
    }
}

export const BOSSES_B: readonly (readonly [CreatureDef, CreatureDef])[] = [
    [MAGISTER_HALVANE, ARCHMAGE_ITHREN],
    [GRAVE_MARSHAL_KORR, OSSUAR],
    [STORMCROWN_ROC, ZEPHYRAX],
    [SISTER_VESPER, LIMINUS],
    [VOID_HERALD, NIHIL]
]

