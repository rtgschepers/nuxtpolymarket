// Held items, drawn from a hand position along an angle (0 = pointing right, −π/2 = up).
// Shared by the Hero, Champions and trash enemies so a sword reads as the same object on
// every body — the party and the enemy speak one weapon vocabulary (asset-list §1.4).
//
// Every drawer writes the far end of the item into `tip`, which the VFX layer reads to
// spawn a cast from the right pixel.

import { C } from './palette'
import type { Surface} from './surface';
import { line, px, rect, disc, ring, tri, arc } from './surface'

export type Mat = readonly [dark: number, base: number, light: number]

export const M = {
    steel: [C.steel1, C.steel2, C.steel3],
    iron: [C.steel0, C.steel1, C.steel2],
    gold: [C.gold1, C.gold2, C.gold3],
    bronze: [C.gold0, C.gold1, C.gold2],
    wood: [C.brown1, C.brown2, C.brown3],
    darkwood: [C.brown0, C.brown1, C.brown2],
    bone: [C.bone0, C.bone1, C.white],
    obsidian: [C.void, C.stone1, C.stone2],
    ice: [C.blue2, C.cyan, C.frost],
    lava: [C.lava0, C.lava1, C.gold2],
    arcane: [C.purple1, C.purple2, C.pink],
    holy: [C.gold2, C.gold3, C.white],
    nature: [C.green1, C.green2, C.green3],
    sea: [C.teal1, C.teal2, C.teal3],
    blood: [C.red0, C.red1, C.red2],
    voidm: [C.void, C.purple0, C.purple2],
    rust: [C.brown1, C.brown2, C.orange],
    leather: [C.brown0, C.brown1, C.brown2]
} as const satisfies Record<string, Mat>

/** Far end of the last drawn item, in the surface's coordinates. */
export const tip = { x: 0, y: 0 }

const R = Math.round

// Scratch output of at(), so drawers never allocate a tuple.
let AX = 0
let AY = 0
function at(hx: number, hy: number, a: number, d: number): void {
    AX = R(hx + Math.cos(a) * d)
    AY = R(hy + Math.sin(a) * d)
}

/** Straight blade with a highlight edge, crossguard and pommel. */
export function sword(s: Surface, hx: number, hy: number, a: number, len: number, blade: Mat, guard: Mat, grip: number, wide = false): void {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const sx = R(hx + dx * 2)
    const sy = R(hy + dy * 2)
    const tx = R(hx + dx * len)
    const ty = R(hy + dy * len)
    line(s, sx, sy, tx, ty, blade[1], wide ? 3 : 2)
    const nx = R(dy)
    const ny = R(-dx)
    line(s, sx - nx, sy + ny, tx - nx, ty + ny, blade[2])
    if (wide) line(s, sx + nx, sy - ny, tx + nx, ty - ny, blade[0])
    px(s, tx, ty, C.white)
    const gw = wide ? 4 : 3
    line(s, sx - R(-dy * gw), sy - R(dx * gw), sx + R(-dy * gw), sy + R(dx * gw), guard[1])
    px(s, sx, sy, guard[2])
    line(s, hx, hy, R(hx - dx * 2), R(hy - dy * 2), grip)
    px(s, R(hx - dx * 3), R(hy - dy * 3), guard[0])
    tip.x = tx; tip.y = ty
}

export function dagger(s: Surface, hx: number, hy: number, a: number, blade: Mat, grip: number): void {
    at(hx, hy, a, 7)
    const tx = AX
    const ty = AY
    at(hx, hy, a, 1)
    const bx = AX
    const by = AY
    line(s, bx, by, tx, ty, blade[1])
    px(s, R((bx + tx) / 2), R((by + ty) / 2), blade[2])
    px(s, tx, ty, C.white)
    at(hx, hy, a + Math.PI / 2, 1.5); px(s, AX, AY, blade[0])
    at(hx, hy, a - Math.PI / 2, 1.5); px(s, AX, AY, blade[0])
    at(hx, hy, a, -2); px(s, AX, AY, grip)
    tip.x = tx; tip.y = ty
}

/** Axe: haft plus a bearded head. `double` gives a second bit (great axes). */
export function axe(s: Surface, hx: number, hy: number, a: number, haft: number, head: Mat, wood: Mat, double = false): void {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const nx = -dy
    const ny = dx
    line(s, R(hx - dx * 3), R(hy - dy * 3), R(hx + dx * haft), R(hy + dy * haft), wood[1], 2)
    line(s, R(hx - dx * 3), R(hy - dy * 3), R(hx + dx * haft), R(hy + dy * haft), wood[2])
    const cx = hx + dx * (haft - 2)
    const cy = hy + dy * (haft - 2)
    // blade on the "up" side of the haft (−normal), with a curved edge
    for (let k = -3; k <= 3; k++) {
        const w = 5 - Math.abs(k) * 0.6
        const bx0 = cx + dx * k
        const by0 = cy + dy * k
        line(s, R(bx0 - nx * 1), R(by0 - ny * 1), R(bx0 - nx * w), R(by0 - ny * w), head[1])
        px(s, R(bx0 - nx * w), R(by0 - ny * w), head[2])
        if (double) {
            line(s, R(bx0 + nx * 1), R(by0 + ny * 1), R(bx0 + nx * w), R(by0 + ny * w), head[1])
            px(s, R(bx0 + nx * w), R(by0 + ny * w), head[2])
        }
    }
    line(s, R(cx - dx * 3 - nx * 2), R(cy - dy * 3 - ny * 2), R(cx + dx * 3 - nx * 2), R(cy + dy * 3 - ny * 2), head[0])
    px(s, R(cx + dx * 4), R(cy + dy * 4), head[2])
    tip.x = R(cx - nx * 5); tip.y = R(cy - ny * 5)
}

export function hammer(s: Surface, hx: number, hy: number, a: number, haft: number, head: Mat, wood: Mat): void {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const nx = -dy
    const ny = dx
    line(s, R(hx - dx * 4), R(hy - dy * 4), R(hx + dx * haft), R(hy + dy * haft), wood[1], 2)
    for (let k = 0; k < 5; k++) {
        const cx = hx + dx * (haft - 1 + k)
        const cy = hy + dy * (haft - 1 + k)
        const c = k === 0 || k === 4 ? head[0] : (k === 1 ? head[2] : head[1])
        line(s, R(cx - nx * 4), R(cy - ny * 4), R(cx + nx * 4), R(cy + ny * 4), c)
    }
    px(s, R(hx + dx * haft - nx * 4), R(hy + dy * haft - ny * 4), C.white)
    px(s, R(hx - dx * 5), R(hy - dy * 5), head[1])
    tip.x = R(hx + dx * (haft + 2)); tip.y = R(hy + dy * (haft + 2))
}

export function mace(s: Surface, hx: number, hy: number, a: number, haft: number, head: Mat, wood: Mat): void {
    at(hx, hy, a, haft)
    const ex = AX
    const ey = AY
    line(s, R(hx - Math.cos(a) * 2), R(hy - Math.sin(a) * 2), ex, ey, wood[1], 2)
    disc(s, ex, ey, 2.4, head[1])
    px(s, ex - 1, ey - 1, head[2])
    at(ex, ey, a, 3); px(s, AX, AY, head[0])
    at(ex, ey, a + 1.6, 3); px(s, AX, AY, head[0])
    at(ex, ey, a - 1.6, 3); px(s, AX, AY, head[0])
    tip.x = ex; tip.y = ey
}

export function spear(s: Surface, hx: number, hy: number, a: number, len: number, head: Mat, wood: Mat): void {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    line(s, R(hx - dx * 8), R(hy - dy * 8), R(hx + dx * len), R(hy + dy * len), wood[1])
    line(s, R(hx - dx * 8), R(hy - dy * 8), R(hx + dx * (len - 4)), R(hy + dy * (len - 4)), wood[1], 2)
    const bx = hx + dx * len
    const by = hy + dy * len
    const nx = -dy
    const ny = dx
    tri(s, bx + nx * 2, by + ny * 2, bx - nx * 2, by - ny * 2, bx + dx * 6, by + dy * 6, head[1])
    line(s, R(bx), R(by), R(bx + dx * 5), R(by + dy * 5), head[2])
    px(s, R(bx - dx), R(by - dy), C.red2)
    tip.x = R(bx + dx * 6); tip.y = R(by + dy * 6)
}

export function scythe(s: Surface, hx: number, hy: number, a: number, len: number, blade: Mat, wood: Mat): void {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    line(s, R(hx - dx * 6), R(hy - dy * 6), R(hx + dx * len), R(hy + dy * len), wood[1], 2)
    const ex = hx + dx * len
    const ey = hy + dy * len
    for (let k = 0; k <= 10; k++) {
        const u = k / 10
        const ang = a - Math.PI / 2 - u * 1.9
        const r = 9 - u * 2
        const bx = ex + Math.cos(ang) * r * 0.9 + dx * (u * 3)
        const by = ey + Math.sin(ang) * r * 0.9 + dy * (u * 3)
        line(s, R(ex + dx * u * 2), R(ey + dy * u * 2), R(bx), R(by), k < 8 ? blade[1] : blade[0])
        if (k > 1) px(s, R(bx), R(by), blade[2])
    }
    tip.x = R(ex); tip.y = R(ey)
}

export const enum Gem { Orb, Crystal, Claw, Skull, Totem, Moon, Flame }

/** A caster's staff with a head ornament. `glow` 0..1 brightens it. */
export function staff(s: Surface, hx: number, hy: number, a: number, len: number, wood: Mat, gem: Mat, style: Gem, glow: number, t: number): void {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const tx = R(hx + dx * len)
    const ty = R(hy + dy * len)
    line(s, R(hx - dx * 10), R(hy - dy * 10), tx, ty, wood[1], 2)
    line(s, R(hx - dx * 10), R(hy - dy * 10), tx, ty, wood[2])
    px(s, R(hx - dx * 10), R(hy - dy * 10), wood[0])
    const gx = R(tx + dx * 2)
    const gy = R(ty + dy * 2)
    const lit = glow > 0.5 || (Math.floor(t * 5) & 3) === 0
    switch (style) {
        case Gem.Orb:
            px(s, tx - 2, ty - 1, M.gold[0]); px(s, tx + 2, ty - 1, M.gold[0])
            disc(s, gx, gy, 2, gem[1])
            px(s, gx - 1, gy - 1, lit ? C.white : gem[2])
            break
        case Gem.Crystal:
            tri(s, gx - 2, gy + 1, gx + 2, gy + 1, gx, gy - 5, gem[1])
            tri(s, gx - 2, gy + 1, gx + 2, gy + 1, gx, gy + 3, gem[0])
            line(s, gx - 1, gy, gx, gy - 4, gem[2])
            px(s, gx, gy - 3, lit ? C.white : gem[2])
            px(s, tx - 2, ty, wood[2]); px(s, tx + 2, ty, wood[2])
            break
        case Gem.Claw:
            px(s, tx - 2, ty - 1, M.gold[1]); px(s, tx + 2, ty - 1, M.gold[1])
            px(s, tx - 2, ty - 2, M.gold[2]); px(s, tx + 2, ty - 2, M.gold[2])
            rect(s, gx - 1, gy - 2, 3, 5, gem[1])
            rect(s, gx - 2, gy - 1, 5, 3, gem[1])
            rect(s, gx - 1, gy - 1, 2, 2, lit ? gem[2] : gem[1])
            px(s, gx - 1, gy - 1, C.white)
            break
        case Gem.Skull:
            rect(s, gx - 2, gy - 3, 5, 4, C.bone1)
            rect(s, gx - 1, gy + 1, 3, 1, C.bone0)
            px(s, gx - 1, gy - 2, lit ? gem[2] : C.ink); px(s, gx + 1, gy - 2, lit ? gem[2] : C.ink)
            px(s, gx - 2, gy - 3, C.white)
            px(s, gx, gy - 5 - (Math.floor(t * 8) & 1), gem[1])
            px(s, gx - 1, gy - 4, gem[1]); px(s, gx + 1, gy - 4, gem[0])
            break
        case Gem.Totem:
            rect(s, gx - 2, gy - 4, 5, 6, wood[1])
            rect(s, gx - 1, gy - 3, 1, 1, lit ? gem[2] : C.ink); rect(s, gx + 1, gy - 3, 1, 1, lit ? gem[2] : C.ink)
            rect(s, gx - 1, gy - 1, 3, 1, C.red1)
            px(s, gx - 3, gy - 2, C.red2); px(s, gx + 3, gy - 2, C.teal2)
            line(s, gx - 3, gy - 2, gx - 5, gy - 6, C.red2)
            line(s, gx + 3, gy - 2, gx + 5, gy - 6, C.teal2)
            px(s, gx - 5, gy - 7, C.white); px(s, gx + 5, gy - 7, C.white)
            break
        case Gem.Moon:
            arc(s, gx, gy - 1, 3, Math.PI * 0.6, Math.PI * 2.1, gem[1])
            arc(s, gx, gy - 1, 2, Math.PI * 0.7, Math.PI * 1.9, gem[2])
            px(s, gx + 1, gy - 1, lit ? C.white : gem[0])
            break
        case Gem.Flame: {
            const f = Math.floor(t * 10) & 3
            rect(s, gx - 1, gy - 1, 3, 2, M.obsidian[1])
            tri(s, gx - 2, gy - 1, gx + 2, gy - 1, gx + (f & 1), gy - 6 - (f >> 1), gem[1])
            tri(s, gx - 1, gy - 1, gx + 1, gy - 1, gx, gy - 4, gem[2])
            px(s, gx, gy - 2, C.white)
            break
        }
    }
    tip.x = gx; tip.y = gy - 1
}

/** Bow held at (hx, hy) aimed along `a`; `pull` 0..1 draws the string back, `nock` shows an arrow. */
export function bow(s: Surface, hx: number, hy: number, a: number, pull: number, nock: boolean, wood: Mat, size = 8, arrowTip: number = C.steel3): void {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const nx = -dy
    const ny = dx
    const bend = 3 + R(pull * 2)
    let t0x = 0; let t0y = 0; let t1x = 0; let t1y = 0
    for (let i = -size; i <= size; i++) {
        const k = i / size
        const b = R(bend * Math.cos(k * Math.PI * 0.5)) - 1
        const x = R(hx + nx * i + dx * b)
        const y = R(hy + ny * i + dy * b)
        const end = i <= -size + 1 || i >= size - 1
        px(s, x, y, end ? wood[0] : (i < 0 ? wood[2] : wood[1]))
        if (!end) px(s, x, y + 1, wood[0])
        if (i === -size) { t0x = x; t0y = y }
        if (i === size) { t1x = x; t1y = y }
    }
    const pl = 1 + pull * 8
    const sx = R(hx - dx * pl)
    const sy = R(hy - dy * pl)
    line(s, t0x, t0y, sx, sy, C.bone1)
    line(s, sx, sy, t1x, t1y, C.bone1)
    if (nock) {
        const ax = R(sx + dx * 13)
        const ay = R(sy + dy * 13)
        line(s, sx, sy, ax, ay, C.brown3)
        px(s, ax, ay, C.white)
        px(s, R(ax - dx), R(ay - dy), arrowTip)
        px(s, sx, sy - 1, C.red2)
        px(s, sx + 1, sy - 1, C.red2)
    }
    tip.x = R(hx + dx * 4); tip.y = R(hy + dy * 4)
}

export const enum ShieldStyle { Round, Kite, Tower, Buckler }

/** Shield seen from the side-front, centred on (x, y). */
export function shield(s: Surface, x: number, y: number, style: ShieldStyle, rimM: Mat, face: Mat, emblem: number): void {
    x = R(x); y = R(y)
    switch (style) {
        case ShieldStyle.Round:
            rect(s, x - 3, y - 5, 6, 11, rimM[1])
            rect(s, x - 2, y - 6, 4, 13, rimM[1])
            rect(s, x - 2, y - 4, 4, 9, face[1])
            rect(s, x - 1, y - 5, 2, 11, face[1])
            rect(s, x - 2, y - 4, 1, 9, face[2])
            rect(s, x, y - 2, 1, 5, emblem)
            rect(s, x - 1, y, 3, 1, emblem)
            px(s, x, y, rimM[2])
            break
        case ShieldStyle.Kite:
            rect(s, x - 3, y - 6, 7, 8, rimM[1])
            tri(s, x - 3, y + 2, x + 3, y + 2, x, y + 8, rimM[1])
            rect(s, x - 2, y - 5, 5, 7, face[1])
            tri(s, x - 2, y + 2, x + 2, y + 2, x, y + 6, face[1])
            rect(s, x - 2, y - 5, 1, 7, face[2])
            rect(s, x, y - 4, 1, 8, emblem)
            rect(s, x - 2, y - 2, 5, 1, emblem)
            px(s, x, y - 2, rimM[2])
            break
        case ShieldStyle.Tower:
            rect(s, x - 3, y - 9, 7, 18, rimM[1])
            rect(s, x - 2, y - 8, 5, 16, face[1])
            rect(s, x - 2, y - 8, 1, 16, face[2])
            rect(s, x + 2, y - 8, 1, 16, face[0])
            rect(s, x - 1, y - 3, 3, 5, emblem)
            px(s, x, y - 4, emblem); px(s, x, y + 2, emblem)
            rect(s, x - 3, y - 9, 7, 1, rimM[2])
            break
        case ShieldStyle.Buckler:
            disc(s, x, y, 3, rimM[1])
            disc(s, x, y, 2, face[1])
            px(s, x, y, emblem)
            px(s, x - 1, y - 2, face[2])
            break
    }
}

export function tome(s: Surface, x: number, y: number, cover: Mat, glow: number): void {
    x = R(x); y = R(y)
    rect(s, x - 3, y - 3, 6, 5, cover[1])
    rect(s, x - 3, y + 2, 6, 1, C.bone1)
    rect(s, x - 3, y - 3, 1, 6, cover[0])
    px(s, x, y - 1, glow > 0.5 ? C.white : M.gold[1])
    px(s, x + 1, y - 1, M.gold[1])
    px(s, x, y, M.gold[1])
}

/** A floating orb (control casters), with a 1px ring when lit. */
export function orb(s: Surface, x: number, y: number, m: Mat, glow: number, t: number): void {
    x = R(x); y = R(y)
    disc(s, x, y, 2, m[1])
    px(s, x - 1, y - 1, m[2])
    px(s, x + 1, y + 1, m[0])
    if (glow > 0.3) {
        const f = Math.floor(t * 10) & 1
        ring(s, x, y, 4 + f, m[glow > 0.7 ? 2 : 1])
    }
    tip.x = x; tip.y = y
}

/** Fist wraps — the Beginner's weapon is his hands. */
export function fist(s: Surface, hx: number, hy: number, wrap: number, knuckle: number): void {
    rect(s, hx - 1, hy - 1, 3, 3, wrap)
    px(s, hx + 1, hy - 1, knuckle)
    px(s, hx - 1, hy + 1, C.bone0)
    tip.x = R(hx + 2); tip.y = R(hy)
}

/** An arrow in flight (projectile), pointing along `a`. */
export function arrow(s: Surface, x: number, y: number, a: number, shaft: number, head: number, fletch: number): void {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    line(s, R(x - dx * 7), R(y - dy * 7), R(x), R(y), shaft)
    px(s, R(x), R(y), head)
    px(s, R(x - dx), R(y - dy), head)
    px(s, R(x - dx * 7 - dy), R(y - dy * 7 + dx), fletch)
    px(s, R(x - dx * 7 + dy), R(y - dy * 7 - dx), fletch)
    px(s, R(x - dx * 6 - dy), R(y - dy * 6 + dx), fletch)
    px(s, R(x - dx * 6 + dy), R(y - dy * 6 - dx), fletch)
}
