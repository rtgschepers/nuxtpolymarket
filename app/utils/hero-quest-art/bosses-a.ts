// World bosses and super bosses, Worlds 1–5 (asset-list §1.4). Each is bespoke art drawn as
// an inhabitant of its world, with Idle, Attack, Hit, Death and an Entry — the boss arriving.
// Bosses are 96px buffers, super bosses 128px and the most elaborate thing in their world.

import { C } from './palette'
import type { CreatureDef } from './creature'
import { fr } from './creature'
import type { Mat } from './weapons'
import {
    B, Entry, bossStates, drive, finish, bz, ball, foliage, chain, tentacle, glowEye, spikes, mouth, speckle,
    limbT, reach, P, rect, px, line, disc, ellipse, tri, quad, dither, ditherEllipse, arc, poly, q, wv
} from './boss-kit'

const R = Math.round

const HIDE: Mat = [C.brown0, C.brown1, C.brown2]
const BARK: Mat = [C.brown0, C.brown1, C.brown2]
const LEAF: Mat = [C.green0, C.green1, C.green2]
const LEAF_LIT: Mat = [C.green1, C.green2, C.green3]
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

/** Old Gnarlhide — an ancient boar grown into the hedge, bramble on its back, tusks like roots. */
export const OLD_GNARLHIDE: CreatureDef = {
    name: 'Old Gnarlhide', size: 96, shadow: 24, accent: C.red2,
    states: bossStates(1.1, 1.4, 1.8),
    draw(s, st, t) {
        drive(this, st, t, 12, 1.4)
        const x = s.ax - 6 + B.lunge - B.kb
        const y = s.ay
        const charge = B.wind > 0 ? B.wind : B.strike ? 1 : B.rec
        const head = R(charge * 3 + B.die * 6)
        const by = y - 17 + B.breath + R(B.die * 4)
        const step = st === 'entry' ? fr(t, 8, 4) : B.strike ? 1 : 0
        // legs (far pair, then near)
        const legH = R(10 - B.die * 6)
        for (const [lx, far] of [[-14, true], [10, true], [-10, false], [14, false]] as const) {
            const off = (step & 1) && !far ? 2 : 0
            rect(s, x + lx + off, by + 6, 5, legH, far ? C.brown0 : C.brown1)
            rect(s, x + lx + off, y - 2, 5, 2, C.ink)
        }
        // body
        ball(s, x, by, 23, 12, HIDE)
        dither(s, x - 20, by + 4, 34, 6, C.brown0, 6)
        // hide texture: coarse bristle strokes
        for (let i = 0; i < 9; i++) line(s, x - 18 + i * 4, by - 6 + (i & 1), x - 20 + i * 4, by - 2, C.brown0)
        // the bramble growing out of its back
        for (let i = 0; i < 7; i++) {
            const bx = x - 18 + i * 5
            const bh = 5 + ((i * 3) % 4)
            line(s, bx, by - 9 - (i & 1), bx - 2, by - 9 - bh, C.green1, 2)
            px(s, bx - 3, by - 10 - bh, C.green2)
            px(s, bx + 1, by - 8 - bh, C.red2)
        }
        spikes(s, x - 20, by - 10, x + 12, by - 12, 8, 3, C.brown2, C.bone1)
        ditherEllipse(s, x - 6, by - 9, 12, 2, C.green2, 7)
        // tail
        line(s, x - 23, by - 3, x - 27, by - 6 + wv(t, 0.6, 1), C.brown1)
        // head
        const hx = x + 22
        const hy = by + 1 + head
        ball(s, hx, hy, 10, 8, HIDE)
        tri(s, hx - 7, hy - 5, hx - 2, hy - 7, hx - 6, hy - 13, C.brown1) // ear
        px(s, hx - 6, hy - 12, C.brown2)
        rect(s, hx + 6, hy - 1, 7, 6, C.brown2) // snout
        rect(s, hx + 12, hy, 2, 4, C.bone0)
        px(s, hx + 12, hy + 1, C.ink); px(s, hx + 12, hy + 3, C.ink)
        // tusks curving up like roots
        const tusk = C.bone1
        line(s, hx + 7, hy + 5, hx + 11, hy + 3, tusk, 2)
        line(s, hx + 11, hy + 3, hx + 13, hy - 3, tusk, 2)
        px(s, hx + 13, hy - 4, C.white)
        line(s, hx + 3, hy + 6, hx + 5, hy + 2, C.bone0, 2)
        // eye: small, furious
        const eye = B.hurt ? C.ink : (B.glow > 0.5 ? C.gold3 : C.red2)
        rect(s, hx + 1, hy - 4, 3, 1, C.brown0)
        px(s, hx + 3, hy - 3, eye)
        if (B.roar || B.strike) mouth(s, hx + 6, hy + 5, 6, 2, C.red1, C.bone1)
        finish(s, Entry.Walk)
    },
    fx(dst, st, t, x, y, dir) {
        if (B.roar || (st === 'attack' && B.wind > 0.6)) {
            const k = fr(t, 10, 4)
            for (let i = 0; i < 4; i++) dst.set(x + dir * (34 + k * 2 + i), y - 15 - i - (k & 1), i & 1 ? C.bone1 : C.white)
        }
        if (st === 'attack' && B.strike) for (let i = 0; i < 6; i++) dst.set(x + dir * (12 + i * 3), y - (i & 1), C.stone3)
    }
}

/** Gorsecrown, King of Hedges — a walking hedgerow crowned in yellow gorse. */
export const GORSECROWN: CreatureDef = {
    name: 'Gorsecrown, King of Hedges', size: 128, shadow: 30, accent: C.gold2,
    states: bossStates(1.4, 1.8, 2.2),
    draw(s, st, t) {
        drive(this, st, t, 6, 1.8)
        const x = s.ax - 4 + B.lunge - B.kb
        const y = s.ay
        const sway = wv(t, 1.8, 1)
        const topY = y - 58 + B.breath + R(B.die * 10)
        // back arm (bramble), drawn behind
        chain(s, x - 16, topY + 4, x - 30, topY + 20, x - 26, y - 20, 5, 3, [C.green0, C.green1, C.green2], 12)
        // trunk legs and roots
        for (const lx of [-10, 8]) {
            limbT(s, x + lx, topY + 24, x + lx + (lx > 0 ? 2 : -2), y - 2, 9, 7, BARK)
            for (let r = -1; r <= 1; r++) line(s, x + lx, y - 3, x + lx + r * 5, y, C.brown0, 2)
        }
        // body of hedge
        foliage(s, x, topY, 26, 26, LEAF, 11)
        foliage(s, x + 6, topY - 12, 16, 12, LEAF_LIT, 12)
        // gorse bloom across the body
        for (let i = 0; i < 26; i++) {
            const a = i * 2.4
            const r = 6 + (i * 7) % 20
            const fx = x + R(Math.cos(a) * r)
            const fy = topY + R(Math.sin(a) * r * 0.9)
            if (s.get(fx, fy)) { px(s, fx, fy, i & 1 ? C.gold2 : C.gold3); if (i % 3 === 0) px(s, fx + 1, fy, C.gold1) }
        }
        // bramble vines winding around
        arc(s, x, topY, 20, 0.4, 2.4, C.brown1)
        arc(s, x + 2, topY - 4, 14, 3.4, 5.2, C.brown1)
        // head: a darker hollow in the leaves with two amber eyes
        const hx = x + 12
        const hy = topY - 30 + sway
        foliage(s, hx, hy, 13, 11, LEAF, 13)
        ellipse(s, hx + 4, hy + 1, 7, 4, C.green0)
        const eye = B.hurt ? C.brown1 : (B.glow > 0.5 ? C.white : C.gold3)
        glowEye(s, hx + 2, hy, eye, C.gold1, true)
        glowEye(s, hx + 8, hy, eye, C.gold1, true)
        if (B.roar || B.strike) mouth(s, hx + 1, hy + 4, 8, 3, C.ink, C.bone0)
        else line(s, hx + 2, hy + 4, hx + 8, hy + 4, C.ink)
        // the crown: a ring of gorse and thorn points
        for (let i = -3; i <= 3; i++) {
            const cx = hx + i * 3
            const cy = hy - 11 - (i & 1 ? 2 : 0)
            line(s, cx, hy - 8, cx, cy, C.brown1)
            disc(s, cx, cy - 1, 1.2, i & 1 ? C.gold2 : C.gold3)
        }
        // front arm: raise and slam
        const sx = x + 20
        const sy = topY - 4
        const a = bz(0.9, -1.8, 1.25)
        reach(sx, sy, a, 30)
        chain(s, sx, sy, sx + 14, sy + (P.y - sy) * 0.3, P.x, P.y, 6, 4, [C.green0, C.green1, C.green2], 14)
        spikes(s, sx + 2, sy - 2, P.x, P.y - 3, 6, 3, C.brown1, C.bone1)
        ball(s, P.x, P.y, 5, 4, LEAF_LIT) // the fist of leaves
        px(s, P.x + 2, P.y - 1, C.gold3)
        finish(s, Entry.Rise, 10)
    },
    fx(dst, st, t, x, y, dir) {
        if (st === 'attack' && B.strike) for (let i = 0; i < 10; i++) dst.set(x + dir * (30 + i * 2), y - (i % 3), i & 1 ? C.green3 : C.brown2)
        if (st === 'death' || st === 'hit') {
            const k = fr(t, 10, 16)
            for (let i = 0; i < 6; i++) dst.set(x + dir * (-14 + i * 6 + (k % 3)), y - 70 + i * 7 + k * 2, i & 1 ? C.gold3 : C.green2)
        }
        if (st === 'entry' && B.ent < 1) for (let i = 0; i < 8; i++) dst.set(x + dir * (-20 + i * 6), y - 1 - (i & 1), C.brown2)
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

