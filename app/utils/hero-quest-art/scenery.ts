// World backgrounds (asset-list §4): ten scenes, each drawn from the same theme line as that
// world's enemies, since "art is the only signal that the run has moved on."
//
// A scene is layered like Pixel Crusade's: dithered sky bands, a celestial, far and mid
// ridges on value noise, props, the floor the party stands on, and an ambient loop. `scroll`
// shifts each layer by its own parallax factor, so the battle can pan without re-authoring.
// Everything is laid out by hash of a tile index, so it tiles forever and never pops.

import { C, shadeLut } from './palette'
import type { Surface} from './surface';
import { rect, px, line, disc, ellipse, tri, quad, dither, ditherDisc, ditherEllipse, hash2, bayer, poly } from './surface'
import { qt } from './vfx-kit'
import { ANIM_FPS } from './anim'

export const SW = 320
export const SH = 180
/** Frames in a world background's loop; every motion in a scene must repeat within it. */
export const BG_FRAMES = 16
/** The loop in seconds. A scene's motion is written as phase = t / BG_LOOP so it closes. */
export const BG_LOOP = BG_FRAMES / ANIM_FPS
/** The floor line characters stand on. */
export const FLOOR_Y = 150

const R = Math.round

function mod(a: number, n: number): number { const r = a % n; return r < 0 ? r + n : r }

function vnoise(x: number, period: number, seed: number): number {
    const f = x / period
    const i = Math.floor(f)
    const u = f - i
    const s = u * u * (3 - 2 * u)
    const a = hash2(i, seed)
    return a + (hash2(i + 1, seed) - a) * s
}

// ── Layers ─────────────────────────────────────────────────────────────────────────

/** Horizontal sky bands with a 4-row dithered seam between each. */
export function sky(s: Surface, cols: readonly number[], stops: readonly number[]): void {
    for (let i = 0; i < cols.length; i++) {
        const y0 = stops[i]!
        const y1 = i + 1 < stops.length ? stops[i + 1]! : SH
        rect(s, 0, y0, SW, y1 - y0, cols[i]!)
        if (i > 0) for (let k = 0; k < 4; k++) dither(s, 0, y0 - 4 + k, SW, 1, cols[i]!, 2 + k * 3)
    }
}

/** A ridge line on value noise, filled down to `bottom`, lit on up-slopes. */
export function ridge(s: Surface, ox: number, base: number, amp: number, period: number, seed: number, body: number, lit: number | null, bottom = SH, jag = 0): void {
    let prev = 0
    for (let x = 0; x < SW; x++) {
        const wx = x + ox
        let n = vnoise(wx, period, seed) * 0.7 + vnoise(wx, period * 0.3, seed + 7) * 0.3
        if (jag) n += (hash2(Math.floor(wx / 3), seed + 9) - 0.5) * jag
        const y = R(base - amp * n)
        rect(s, x, y, 1, bottom - y, body)
        if (lit !== null && y < prev) rect(s, x, y, 1, 2, lit)
        prev = y
    }
}

/** Triangular peaks (mountains, volcanoes); `snow` caps the tips. */
export function peaks(s: Surface, ox: number, base: number, period: number, seed: number, body: number, shade: number, snow: number | null, crater = -1): void {
    for (let k = Math.floor(ox / period) - 1; k <= Math.floor((ox + SW) / period) + 1; k++) {
        const cx = (k + 0.2 + hash2(k, seed) * 0.6) * period - ox
        const h = period * (0.45 + hash2(k, seed + 1) * 0.5)
        const w = period * (0.55 + hash2(k, seed + 2) * 0.4)
        tri(s, cx - w, base, cx + w, base, cx, base - h, body)
        tri(s, cx, base - h, cx + w, base, cx + w * 0.3, base, shade)
        if (snow !== null) tri(s, cx - w * 0.2, base - h * 0.8, cx + w * 0.2, base - h * 0.8, cx, base - h, snow)
        if (crater >= 0) {
            rect(s, R(cx - w * 0.12), R(base - h), R(w * 0.24) + 1, 2, crater)
            dither(s, R(cx - w * 0.2), R(base - h - 8), R(w * 0.4), 8, crater, 3)
        }
    }
}

function pine(s: Surface, x: number, y: number, h: number, c: number, snow: number | null): void {
    for (let i = 0; i < h; i++) {
        const w = Math.floor((i / h) * (h * 0.4)) + (i % 4 === 3 ? 1 : 0)
        rect(s, x - w, y - h + i, w * 2 + 1, 1, c)
        if (snow !== null && i % 4 === 0) rect(s, x - w, y - h + i, w + 1, 1, snow)
    }
    rect(s, x - 1, y, 2, 3, C.brown0)
}

function deadTree(s: Surface, x: number, y: number, h: number, c: number): void {
    line(s, x, y, x, y - h, c, 2)
    for (let i = 0; i < 4; i++) {
        const by = y - h * (0.4 + i * 0.15)
        const d = i & 1 ? 1 : -1
        line(s, x, by, x + d * (4 + i * 2), by - 4 - i, c)
    }
}

/** A tiling prop band: `draw(x, k)` places prop k at screen x every `spacing` px. */
function band(ox: number, spacing: number, seed: number, draw: (x: number, k: number, r: number) => void): void {
    for (let k = Math.floor(ox / spacing) - 1; k <= Math.floor((ox + SW) / spacing) + 1; k++) {
        const r = hash2(k, seed)
        draw(R(k * spacing + r * spacing * 0.6 - ox), k, r)
    }
}

/** Ambient particles on the frame grid (motes, snow, embers) — `speed` px/s, `dir` ±1 vertical. */
function drift(s: Surface, t: number, n: number, seed: number, cols: readonly number[], vy: number, vx: number, y0 = 0, y1 = SH): void {
    const q = qt(t)
    for (let i = 0; i < n; i++) {
        const x = mod(hash2(seed, i) * SW + vx * q + Math.sin(q * 2 + i) * 2, SW)
        const y = y0 + mod(hash2(seed + 1, i) * (y1 - y0) + vy * q, y1 - y0)
        s.set(R(x), R(y), cols[i % cols.length]!)
    }
}

// ── The ten worlds ─────────────────────────────────────────────────────────────────

export interface WorldScene {
    id: string
    draw(s: Surface, scroll: number, t: number): void
    /**
     * First row of standing water, when the scene has any. The live stage re-runs
     * `reflectWater` after the units are drawn so bodies and effects mirror in it too.
     */
    water?: number
    /** Column the sun's glitter road runs down on the water, if any. */
    glitter?: number
    /**
     * On the scenery tier: everything in the fight band (FIGHT_BAND rows above the floor) is
     * painted in SCENERY colours only, so the characters in front always read.
     */
    tiered?: boolean
}

/** Rows above FLOOR_Y that sit behind a standing fighter — the band the scenery tier governs. */
export const FIGHT_BAND = 28

// ── Water ──────────────────────────────────────────────────────────────────────────

const REFLECT_LUT = shadeLut(0.85, 'sky0', 0.2)
/** Rows of scene mirrored per row of water: >1 foreshortens, so a shallow pond still shows the sky. */
const REFLECT_SQUASH = 2.2

/**
 * Mirror everything above the water line into rows [top, SH): each row copied from its
 * foreshortened mirror image about `top − 2` (REFLECT_SQUASH rows up per row down), sheared sideways by a wave that grows with depth, and
 * darkened through a shade map. Then a sparse glitter of lit dashes on the surface.
 */
export function reflectWater(s: Surface, top: number, t: number, glitterX = -1): void {
    // everything below moves on the background loop, so a baked 16-frame strip closes
    const ph = (qt(t) / BG_LOOP) % 1
    const f = Math.floor(ph * BG_FRAMES + 1e-6)
    const axis = top - 2
    const w = s.w
    const d = s.data
    for (let y = top; y < s.h; y++) {
        const depth = y - top
        const src = axis - R(depth * REFLECT_SQUASH) - 1
        if (src < 0) break
        const off = R(Math.sin(y * 0.9 + ph * Math.PI * 2) * (0.6 + depth * 0.09))
        const row = y * w
        const srow = src * w
        for (let x = 0; x < w; x++) {
            let sx = x + off
            if (sx < 0) sx = 0
            else if (sx >= w) sx = w - 1
            d[row + x] = REFLECT_LUT[d[srow + sx]!]!
        }
        // ripple lines: every third row a broken lighter streak, sliding a pixel every two frames
        if (depth % 3 === 1) {
            for (let x = mod((f >> 1) + depth * 5, 8); x < w; x += 8) {
                const c = d[row + x]!
                if (hash2(x >> 3, y) < 0.6) d[row + x] = c === C.void || c === C.ink ? C.night0 : c
            }
        }
    }
    if (glitterX >= 0) {
        // the sun's road across the water, re-scattered every other frame
        const k = f >> 1
        for (let y = top + 1; y < s.h; y += 2) {
            const spread = 3 + (y - top) * 0.6
            for (let i = 0; i < 3; i++) {
                const x = R(glitterX + (hash2(y, i + k * 3) - 0.5) * spread * 2)
                const len = 1 + R(hash2(i, y) * 3)
                rect(s, x, y, len, 1, i === 0 ? C.white : C.gold3)
            }
        }
    }
}

/** A wide flat cloud: stacked lozenges in `body`, underside lit `lit` toward the sun. */
function streakCloud(s: Surface, x: number, y: number, len: number, body: number, lit: number, dark: number): void {
    for (let i = 0; i < 3; i++) {
        const l = len * (1 - i * 0.3)
        const ox = x + (i === 1 ? len * 0.1 : i === 2 ? len * 0.28 : 0)
        rect(s, ox + 2, y - i * 3 - 1, l - 4, 1, i === 2 ? dark : body)
        rect(s, ox, y - i * 3, l, 3, body)
    }
    rect(s, x + 1, y + 2, len - 3, 1, lit)
    rect(s, x + 3, y + 3, len * 0.55, 1, lit)
    dither(s, x + 6, y + 4, len * 0.4, 1, lit, 6)
}

/** A tall pine with a stepped, jagged silhouette — the video's framing trees. */
function bigPine(s: Surface, x: number, base: number, h: number, c: number, rim: number): void {
    const tiers = Math.floor(h / 9)
    for (let k = 0; k < tiers; k++) {
        const ty = base - h + k * 8
        const w = 3 + k * 2.2
        tri(s, x - w, ty + 11, x + w, ty + 11, x, ty, c)
        rect(s, R(x - w), ty + 10, R(w * 2) + 1, 2, c)
        // the sun side of each tier catches light
        line(s, x + 1, ty + 2, R(x + w * 0.8), ty + 10, rim)
    }
    rect(s, x - 1, base - 6, 3, 8, C.rust0)
}

// clump scratch for bush(), so drawing a scene never allocates
const CX = new Float32Array(4)
const CY = new Float32Array(4)
const CR = new Float32Array(4)

/**
 * A leafy bush, backlit: the low sun is behind the hedgerows, so the faces toward us sit in
 * cool shade (dark green → teal) and only the crowns catch a thin gold rim. Keeping them
 * darker and cooler than anything standing in front is what lets the fighters read — the
 * Bramble Goblins are the same greens a sunlit bush would be. Overlapping round clumps,
 * ragged single-leaf bumps on the rim, a few berries. `w` is the footprint; it stands on `base`.
 */
function bush(s: Surface, x: number, base: number, w: number, h: number, seed: number): void {
    const n = 3 + (w > 22 ? 1 : 0)
    for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1)
        const mid = 1 - Math.abs(u - 0.5) * 2
        CR[i] = h * (0.42 + 0.28 * mid) + hash2(seed, i) * 1.5
        CX[i] = x - w / 2 + CR[i]! * 0.8 + u * (w - CR[i]! * 1.6)
        CY[i] = base - CR[i]! + 1
    }
    // dark body, a pixel fatter, then the ragged leaf edge
    for (let i = 0; i < n; i++) disc(s, CX[i]!, CY[i]!, CR[i]! + 1, C.moss0)
    for (let i = 0; i < n; i++) {
        for (let k = 0; k < 10; k++) {
            const a = -Math.PI * (0.05 + 0.9 * hash2(seed + i, k))
            const r = CR[i]! + 1.5
            px(s, CX[i]! + Math.cos(a) * r, CY[i]! + Math.sin(a) * r, C.moss0)
        }
    }
    rect(s, R(x - w / 2), base - 2, w, 3, C.moss0)
    // shade body in cool teal, a slightly lighter crown toward the sun
    for (let i = 0; i < n; i++) disc(s, CX[i]!, CY[i]!, CR[i]! - 0.5, C.lagoon0)
    for (let i = 0; i < n; i++) disc(s, CX[i]! + 1, CY[i]! - 2.5, CR[i]! - 4, C.lagoon1)
    for (let i = 0; i < n; i++) {
        // the backlight: a thin gold rim along each clump's upper-right edge
        const r = CR[i]! + 0.5
        for (let k = 0; k < 9; k++) {
            const a = -Math.PI * (0.08 + 0.42 * (k / 8))
            px(s, CX[i]! + Math.cos(a) * r, CY[i]! + Math.sin(a) * r, k < 3 ? C.sand3 : k < 6 ? C.sand2 : C.moss3)
        }
        // leaf texture in the shade: a few dark flecks
        for (let k = 0; k < 4; k++) px(s, CX[i]! - r * 0.6 + hash2(seed + 3, i * 5 + k) * r, CY[i]! + hash2(seed + 4, i * 5 + k) * r * 0.6, C.moss0)
    }
    // a couple of bramble berries
    for (let k = 0; k < 2; k++) {
        const i = (seed + k) % n
        const bx = R(CX[i]! - CR[i]! * 0.3 + k * 3)
        const by = R(CY[i]! + CR[i]! * 0.2)
        px(s, bx, by, C.rust2); px(s, bx + 1, by, C.rust1); px(s, bx, by - 1, C.rust3)
    }
}

/** Fireflies wheeling on small closed loops — one lap per background loop, so it repeats. */
function fireflies(s: Surface, ph: number, n: number, seed: number, y0: number, y1: number): void {
    for (let i = 0; i < n; i++) {
        const a = (ph + hash2(seed, i)) * Math.PI * 2 * (i & 1 ? 1 : -1)
        const x = R(hash2(seed + 1, i) * SW + Math.cos(a) * 4)
        const y = R(y0 + hash2(seed + 2, i) * (y1 - y0) + Math.sin(a) * 2)
        const lit = (Math.floor(ph * BG_FRAMES) + i * 5) % 8 < 5
        if (lit) s.set(x, y, i % 3 ? C.sand3 : C.moss3)
    }
}

// ── The ten worlds ─────────────────────────────────────────────────────────────────

const SUN = { x: 236, y: 90 }
const TW_WATER = FLOOR_Y + 5

/**
 * Thornwick Vale in the late afternoon, after the reference video: a blue sky warming to
 * gold at the horizon, clouds lit underneath, the sun low over the hills, windmills and a
 * pine treeline, leafy hedgerows, a grass bank with the first violet crack, and a millpond
 * in front that mirrors all of it (and, on the live stage, the party too).
 *
 * Every motion is a whole number of cycles per BG_LOOP, so the baked loop never jumps.
 */
const thornwick: WorldScene = {
    id: 'world_thornwick_vale',
    water: TW_WATER,
    glitter: SUN.x,
    tiered: true,
    draw(s, sc, t) {
        const ph = (qt(t) / BG_LOOP) % 1
        const f = Math.floor(ph * BG_FRAMES + 1e-6)
        sky(s, [C.sky0, C.sky1, C.sky2, C.dusk3, C.gold2, C.gold3], [0, 24, 50, 76, 92, 104])
        // the sun: a wide soft glow, the disc, a white core
        ditherDisc(s, SUN.x - sc * 0.02, SUN.y, 22, C.gold3, 2)
        ditherDisc(s, SUN.x - sc * 0.02, SUN.y, 17, C.gold3, 6)
        disc(s, SUN.x - sc * 0.02, SUN.y, 13, C.gold3)
        disc(s, SUN.x - sc * 0.02, SUN.y, 10, C.white)
        // streak clouds, still (drift can't close in a 1.6 s loop), lit from below
        for (let i = 0; i < 6; i++) {
            const len = 30 + R(hash2(i, 21) * 50)
            const x = mod(hash2(i, 22) * (SW + 80) - sc * 0.05, SW + 80) - 60
            const y = 18 + i * 12 + R(hash2(i, 23) * 5)
            const body = y < 50 ? C.white : y < 76 ? C.bone1 : C.dusk3
            const lit = y < 50 ? C.sky2 : C.gold3
            streakCloud(s, R(x), y, len, body, lit, y < 50 ? C.sky2 : C.dusk3)
        }
        // far ridge in blue haze, nearer hills in soft green
        ridge(s, sc * 0.1, 112, 22, 96, 1, C.sky1, C.sky2)
        ridge(s, sc * 0.2, 124, 14, 70, 2, C.moss1, C.moss2)
        // treeline, then windmills a quarter-turn per loop
        band(sc * 0.3, 7, 8, (x, _k, r) => pine(s, x, 132, 8 + R(r * 10), C.moss0, null))
        band(sc * 0.3, 150, 3, (x) => {
            poly(s, [-5, 30, 5, 30, 3, 0, -3, 0], x, 102, C.sand2)
            poly(s, [1, 30, 5, 30, 3, 0, 1, 0], x, 102, C.sand3) // sunlit side
            tri(s, x - 5, 103, x + 5, 103, x, 96, C.rust2)
            line(s, x, 96, x + 5, 103, C.rust3)
            rect(s, x - 1, 116, 2, 3, C.rust0) // door
            px(s, x + 1, 108, C.rock1)
            const a = ph * Math.PI / 2
            for (let i = 0; i < 4; i++) {
                const ca = Math.cos(a + i * Math.PI / 2)
                const sa = Math.sin(a + i * Math.PI / 2)
                line(s, x, 101, x + ca * 17, 101 + sa * 17, C.rust1)
                quad(s, x + ca * 5, 101 + sa * 5, x + ca * 17, 101 + sa * 17,
                    x + ca * 17 - sa * 4, 101 + sa * 17 + ca * 4, x + ca * 5 - sa * 4, 101 + sa * 5 + ca * 4, C.sand3)
                line(s, x + ca * 5 - sa * 2, 101 + sa * 5 + ca * 2, x + ca * 17 - sa * 2, 101 + sa * 17 + ca * 2, C.sand2)
            }
            disc(s, x, 101, 1, C.rust0)
        })
        rect(s, 0, 132, SW, FLOOR_Y - 132, C.moss0)
        dither(s, 0, 132, SW, 3, C.moss1, 6)
        // hedgerows gone feral: leafy clumps, bramble berries
        band(sc * 0.6, 34, 5, (x, k, r) => bush(s, x, FLOOR_Y - 2, 22 + R(r * 10), 9 + (k & 3), 17 + (k & 7)))
        // framing pines at both edges, deep green with sunlit edges
        bigPine(s, 14, FLOOR_Y, 86, C.moss0, C.moss2)
        bigPine(s, 34, FLOOR_Y, 58, C.moss0, C.moss2)
        bigPine(s, 300, FLOOR_Y, 92, C.moss0, C.moss2)
        bigPine(s, 280, FLOOR_Y, 62, C.moss0, C.moss2)
        // the grass bank the party stands on, tufted, with the crack glowing violet
        rect(s, 0, FLOOR_Y - 2, SW, TW_WATER - FLOOR_Y + 2, C.rust0)
        rect(s, 0, FLOOR_Y - 2, SW, 2, C.moss2)
        for (let x = 0; x < SW; x += 2) if (hash2(x, 31) < 0.5) px(s, x, FLOOR_Y - 3, hash2(x, 32) < 0.3 ? C.sand3 : C.moss3)
        rect(s, 0, FLOOR_Y, SW, 1, C.rust1)
        band(sc, 140, 6, (x) => {
            line(s, x, FLOOR_Y - 2, x + 3, FLOOR_Y + 3, C.heather2)
            px(s, x + 1, FLOOR_Y, (f >> 2) & 1 ? C.heather3 : C.dusk2)
        })
        // the millpond
        reflectWater(s, TW_WATER, t, SUN.x)
        fireflies(s, ph, 14, 7, 116, FLOOR_Y - 6)
    }
}

const mirewood: WorldScene = {
    id: 'world_mirewood',
    draw(s, sc, t) {
        sky(s, [C.void, C.night0, C.teal0, C.green0], [0, 30, 70, 110])
        ditherDisc(s, 80, 40, 16, C.teal1, 5)
        band(sc * 0.15, 26, 11, (x, _k, r) => rect(s, x, 30 + R(r * 20), 3 + R(r * 3), 120, C.night1))
        dither(s, 0, 96, SW, 24, C.teal1, 3) // fog
        band(sc * 0.4, 40, 12, (x, _k, r) => {
            const w = 6 + R(r * 4)
            rect(s, x, 0, w, FLOOR_Y, C.void)
            rect(s, x, 0, 1, FLOOR_Y, C.green0)
            for (let i = 0; i < 4; i++) { const mx = x + 1 + i * 2; line(s, mx, 20 + i * 11, mx, 34 + i * 11 + R(r * 10), C.olive1) } // hanging moss
            line(s, x - 6, 30 + R(r * 10), x + w + 8, 40 + R(r * 10), C.void, 2) // branch
            for (let i = 0; i < 5; i++) line(s, x - 4 + i * 3, 34 + R(r * 10), x - 4 + i * 3, 44 + R(r * 10) + (i & 1) * 6, C.olive0)
        })
        dither(s, 0, 128, SW, 16, C.teal0, 5)
        // black water floor with reflections
        rect(s, 0, FLOOR_Y - 1, SW, SH - FLOOR_Y + 1, C.ink)
        rect(s, 0, FLOOR_Y - 1, SW, 1, C.teal1)
        band(sc * 0.4, 40, 12, (x, _k, r) => dither(s, x, FLOOR_Y, 6 + R(r * 4), 14, C.night1, 5))
        for (let i = 0; i < 10; i++) { const rx = mod(i * 37 - sc * 0.9, SW); const k = (Math.floor(qt(t) * 3) + i) & 3; rect(s, R(rx), FLOOR_Y + 4 + (i * 5) % 20, 4 + k, 1, C.teal1) }
        band(sc, 50, 13, (x, _k, r) => { if (r > 0.4) { line(s, x, FLOOR_Y, x - 1, FLOOR_Y - 8, C.olive1); line(s, x + 2, FLOOR_Y, x + 3, FLOOR_Y - 6, C.olive2) } })
        drift(s, t, 14, 14, [C.green4, C.green3], -3, 2, 60, FLOOR_Y - 4)
    }
}

const cinderpass: WorldScene = {
    id: 'world_cinderpass',
    draw(s, sc, t) {
        sky(s, [C.void, C.red0, C.red1, C.lava0], [0, 30, 80, 110])
        peaks(s, sc * 0.1, 118, 110, 21, C.stone0, C.void, null, C.lava1)
        dither(s, 0, 90, SW, 30, C.stone1, 3)
        // pass walls
        ridge(s, sc * 0.3, 118, 40, 60, 22, C.stone1, C.stone2, SH, 0.2)
        ridge(s, sc * 0.5, 132, 18, 40, 23, C.stone0, C.stone1, SH, 0.3)
        // lava falls down the rock
        band(sc * 0.5, 120, 24, (x) => { for (let y = 100; y < 136; y++) { px(s, x, y, (y + Math.floor(qt(t) * 10)) % 4 ? C.lava1 : C.gold2); px(s, x + 1, y, C.lava0) } })
        // kobold banners on skull poles
        band(sc * 0.7, 90, 25, (x) => {
            line(s, x, FLOOR_Y, x, 118, C.brown1, 2)
            disc(s, x, 116, 2.5, C.bone1); px(s, x - 1, 116, C.ink); px(s, x + 1, 116, C.ink)
            poly(s, [0, 0, 10, 2, 8, 6, 10, 10, 0, 9], x + 1, 120 + (Math.floor(qt(t) * 4) & 1), C.red1)
        })
        rect(s, 0, FLOOR_Y - 2, SW, SH - FLOOR_Y + 2, C.stone1)
        rect(s, 0, FLOOR_Y - 2, SW, 2, C.stone2)
        dither(s, 0, FLOOR_Y, SW, SH - FLOOR_Y, C.stone0, 6)
        band(sc, 70, 26, (x, _k, r) => { if (r > 0.3) { line(s, x, FLOOR_Y + 4, x + 12, FLOOR_Y + 10, C.lava0); line(s, x + 12, FLOOR_Y + 10, x + 20, FLOOR_Y + 8, C.lava1) } })
        drift(s, t, 26, 27, [C.orange, C.gold2, C.lava1], -18, 3)
        drift(s, t, 20, 28, [C.stone3, C.bone0], 10, -4)
    }
}

const rimeholt: WorldScene = {
    id: 'world_rimeholt',
    draw(s, sc, t) {
        sky(s, [C.night1, C.night2, C.night3, C.haze], [0, 30, 70, 100])
        // aurora
        for (let x = 0; x < SW; x++) {
            const y = 26 + R(Math.sin((x + sc * 0.05) * 0.03 + qt(t)) * 8 + Math.sin(x * 0.011) * 10)
            for (let k = 0; k < 14; k++) if (bayer(x, y + k, 8 - (k >> 1))) s.set(x, y + k, k < 4 ? C.teal3 : C.teal2)
        }
        peaks(s, sc * 0.1, 120, 90, 31, C.steel2, C.steel1, C.white)
        ridge(s, sc * 0.3, 130, 16, 60, 32, C.steel3, C.white)
        // the hold: a longhouse with fire-lit door
        band(sc * 0.45, 220, 33, (x) => {
            rect(s, x - 26, 112, 52, 18, C.brown1)
            tri(s, x - 30, 112, x + 30, 112, x, 94, C.brown0)
            tri(s, x - 28, 111, x + 28, 111, x, 96, C.white)
            rect(s, x - 4, 118, 8, 12, C.orange); rect(s, x - 3, 119, 6, 11, (Math.floor(qt(t) * 6) & 1) ? C.gold2 : C.orange)
            line(s, x - 30, 94, x - 24, 88, C.brown1); line(s, x + 30, 94, x + 24, 88, C.brown1)
        })
        band(sc * 0.6, 28, 34, (x, _k, r) => pine(s, x, 142, 18 + R(r * 10), C.green0, C.white))
        rect(s, 0, FLOOR_Y - 2, SW, SH - FLOOR_Y + 2, C.steel3)
        rect(s, 0, FLOOR_Y - 2, SW, 2, C.white)
        dither(s, 0, FLOOR_Y + 6, SW, SH, C.steel2, 4)
        drift(s, t, 60, 35, [C.white, C.frost], 14, -6)
    }
}

const sunkenAmarath: WorldScene = {
    id: 'world_sunken_amarath',
    draw(s, sc, t) {
        sky(s, [C.teal2, C.teal1, C.teal0, C.void], [0, 24, 70, 130])
        // light shafts from the surface
        for (let i = 0; i < 5; i++) {
            const x0 = mod(40 + i * 70 - sc * 0.05, SW)
            for (let y = 0; y < 120; y++) dither(s, R(x0 + y * 0.3), y, 6 + (y >> 4), 1, C.teal3, 3 - (y > 70 ? 1 : 0))
        }
        // drowned capital: domes and columns
        band(sc * 0.2, 90, 41, (x, _k, r) => {
            rect(s, x - 14, 84 + R(r * 10), 28, 60, C.teal0)
            ellipse(s, x, 84 + R(r * 10), 14, 12, C.teal0)
            rect(s, x - 1, 66 + R(r * 10), 2, 8, C.teal0)
        })
        band(sc * 0.45, 46, 42, (x, k, r) => {
            const h = 30 + R(r * 26)
            const broken = k % 3 === 0
            rect(s, x - 4, FLOOR_Y - h, 9, h, C.bone0)
            rect(s, x - 4, FLOOR_Y - h, 2, h, C.bone1)
            rect(s, x - 6, FLOOR_Y - h - 3, 13, 3, C.bone1)
            if (broken) tri(s, x - 6, FLOOR_Y - h - 3, x + 7, FLOOR_Y - h - 3, x + 4, FLOOR_Y - h - 10, C.teal0)
            for (let i = 0; i < 4; i++) px(s, x - 3 + (i & 1) * 5, FLOOR_Y - h + 6 + i * 8, C.teal2) // barnacles
        })
        rect(s, 0, FLOOR_Y - 2, SW, SH - FLOOR_Y + 2, C.bone0)
        rect(s, 0, FLOOR_Y - 2, SW, 2, C.bone1)
        dither(s, 0, FLOOR_Y, SW, SH, C.teal1, 5)
        band(sc * 0.8, 24, 43, (x, _k, r) => {
            const sway = R(Math.sin(qt(t) * 2 + x) * 2)
            for (let i = 0; i < 12 + R(r * 8); i++) px(s, x + R(Math.sin(i * 0.5) * 1.5) + (i > 6 ? sway : 0), FLOOR_Y - 2 - i, i & 1 ? C.green2 : C.olive1)
        })
        drift(s, t, 22, 44, [C.teal3, C.white], -14, 0, 10, FLOOR_Y)
    }
}

const duskspire: WorldScene = {
    id: 'world_duskspire',
    draw(s, sc, t) {
        sky(s, [C.night0, C.night1, C.purple1, C.pink, C.orange], [0, 30, 64, 94, 106])
        // the Void door as a crack in the sky
        const cx = 120 - sc * 0.02
        poly(s, [0, -30, 4, -10, 1, 0, 5, 12, 0, 30, -4, 12, -1, 0, -5, -12], cx, 44, C.ink)
        poly(s, [0, -24, 2, -8, 0, 0, 2, 10, 0, 24, -2, 10, 0, 0, -2, -8], cx, 44, C.purple2)
        line(s, cx, 22, cx, 66, C.pink)
        // towers
        band(sc * 0.2, 40, 51, (x, _k, r) => {
            const h = 50 + R(r * 40)
            rect(s, x - 4, 118 - h, 8, h, C.night1)
            tri(s, x - 6, 118 - h, x + 6, 118 - h, x, 106 - h, C.night1)
        })
        band(sc * 0.45, 64, 52, (x, _k, r) => {
            const h = 60 + R(r * 34)
            rect(s, x - 8, FLOOR_Y - h, 16, h, C.night2)
            rect(s, x - 8, FLOOR_Y - h, 2, h, C.night3)
            tri(s, x - 11, FLOOR_Y - h, x + 11, FLOOR_Y - h, x, FLOOR_Y - h - 20, C.purple0)
            for (let i = 0; i < 5; i++) {
                const lit = (Math.floor(qt(t) * 2) + i + R(r * 7)) % 5 !== 0
                rect(s, x - 3 + (i & 1) * 4, FLOOR_Y - h + 8 + i * 10, 2, 3, lit ? C.gold2 : C.night1)
            }
            disc(s, x + 14, FLOOR_Y - h + R(Math.sin(qt(t) + x) * 3), 2, C.pink) // floating crystal
        })
        rect(s, 0, FLOOR_Y - 2, SW, SH - FLOOR_Y + 2, C.night1)
        rect(s, 0, FLOOR_Y - 2, SW, 2, C.night3)
        for (let x = 0; x < SW; x += 12) rect(s, mod(x - R(sc), SW), FLOOR_Y + 2, 1, SH, C.night0) // flagstones
        dither(s, 0, FLOOR_Y + 12, SW, SH, C.night0, 6)
        drift(s, t, 16, 53, [C.pink, C.purple2, C.white], -6, 1, 20, FLOOR_Y)
    }
}

const bonefields: WorldScene = {
    id: 'world_the_bonefields',
    draw(s, sc, t) {
        sky(s, [C.stone1, C.stone2, C.stone3, C.olive1], [0, 40, 80, 112])
        disc(s, 60, 50, 12, C.bone0); ditherDisc(s, 60, 50, 16, C.bone0, 3)
        // a ruined fortress far off
        band(sc * 0.12, 260, 61, (x) => {
            rect(s, x - 40, 96, 80, 26, C.stone2)
            for (let i = 0; i < 8; i++) rect(s, x - 40 + i * 10, 92, 5, 4, C.stone2)
            rect(s, x - 6, 76, 12, 46, C.stone2); rect(s, x - 6, 72, 3, 4, C.stone2); rect(s, x + 3, 72, 3, 4, C.stone2)
        })
        ridge(s, sc * 0.3, 128, 10, 80, 62, C.olive0, C.olive1)
        // spears, banners, graves
        band(sc * 0.6, 22, 63, (x, k, r) => {
            if (k % 3 === 0) { line(s, x, FLOOR_Y, x + 6 - R(r * 12), 116, C.brown1); px(s, x + 6 - R(r * 12), 115, C.steel2) } else if (k % 3 === 1) {
                rect(s, x - 3, 134, 7, 16, C.stone2); rect(s, x - 5, 138, 11, 3, C.stone2); px(s, x, 136, C.stone3)
            } else {
                line(s, x, FLOOR_Y, x, 120, C.brown0, 2)
                poly(s, [0, 0, 10, 2, 8, 5, 10, 10, 0, 8], x + 1, 121 + (Math.floor(qt(t) * 3) & 1), C.red0)
            }
        })
        rect(s, 0, FLOOR_Y - 2, SW, SH - FLOOR_Y + 2, C.olive0)
        rect(s, 0, FLOOR_Y - 2, SW, 2, C.olive1)
        band(sc, 30, 64, (x, _k, r) => { if (r > 0.5) { disc(s, x, FLOOR_Y + 6, 2, C.bone1); px(s, x - 1, FLOOR_Y + 6, C.ink) } else line(s, x, FLOOR_Y + 8, x + 5, FLOOR_Y + 6, C.bone0) })
        dither(s, 0, 120, SW, 30, C.bone0, 2) // mist
        drift(s, t, 10, 65, [C.green4, C.green3], -4, 3, 100, FLOOR_Y)
    }
}

const shatteredSky: WorldScene = {
    id: 'world_the_shattered_sky',
    draw(s, sc, t) {
        sky(s, [C.night1, C.night2, C.night3, C.haze], [0, 30, 70, 120])
        dither(s, 0, 0, SW, 60, C.night0, 5)
        // lightning in the distance on a slow beat
        if ((Math.floor(qt(t) * 10) % 16) < 2) { let x = 230; for (let y = 0; y < 90; y++) { if ((y & 7) === 0) x += ((y * 7) & 4) - 2; px(s, x, y, C.white); px(s, x + 1, y, C.cyan) } }
        // floating islands at three depths
        const island = (x: number, y: number, w: number, top: number, rock: number, grass: number) => {
            rect(s, x - w, y, w * 2, 3, grass)
            tri(s, x - w, y + 3, x + w, y + 3, x + R(w * 0.2), y + 3 + w, rock)
            px(s, x - w + 3, y - 1, grass)
            if (top > 0) pine(s, x - R(w * 0.3), y, top, C.green1, null)
        }
        band(sc * 0.15, 90, 71, (x, _k, r) => island(x, 50 + R(r * 30) + R(Math.sin(qt(t) + x) * 1), 10, 0, C.night3, C.teal1))
        band(sc * 0.35, 120, 72, (x, _k, r) => island(x, 80 + R(r * 20) + R(Math.sin(qt(t) * 0.8 + x) * 2), 16, 10, C.stone1, C.green2))
        // the ground is an island edge, with the sky below it
        rect(s, 0, FLOOR_Y - 2, SW, 10, C.green2)
        rect(s, 0, FLOOR_Y - 2, SW, 2, C.green3)
        for (let x = 0; x < SW; x++) { const d = 8 + R(vnoise(x + sc, 18, 73) * 20); rect(s, x, FLOOR_Y + 8, 1, d, C.stone1); if (x % 3 === 0) px(s, x, FLOOR_Y + 8 + d, C.stone0) }
        drift(s, t, 20, 74, [C.frost, C.haze], 2, -40, 10, FLOOR_Y)
    }
}

const fraying: WorldScene = {
    id: 'world_the_fraying',
    draw(s, sc, t) {
        sky(s, [C.stone2, C.stone3, C.bone0, C.haze], [0, 36, 76, 116])
        // tears in the sky showing the void behind it
        band(sc * 0.05, 110, 81, (x, _k, r) => {
            const y = 20 + R(r * 40)
            poly(s, [0, 0, 12, 3, 24, 1, 16, 8, 6, 9], x, y, C.void)
            for (let i = 0; i < 4; i++) px(s, x + 4 + i * 5, y + 3 + (i & 1), C.white)
            for (let i = 0; i < 3; i++) line(s, x + 6 + i * 6, y + 8, x + 5 + i * 6, y + 20 + i * 4, C.haze) // threads hanging
        })
        // grey trees half-unravelled
        band(sc * 0.4, 50, 82, (x, _k, r) => {
            deadTree(s, x, FLOOR_Y, 34 + R(r * 20), C.stone1)
            for (let i = 0; i < 6; i++) if (hash2(x, i) > 0.5) px(s, x - 4 + R(hash2(x + 1, i) * 8), FLOOR_Y - 36 - R(hash2(x + 2, i) * 16), C.stone2)
        })
        // the ground comes apart into pixels toward the bottom
        rect(s, 0, FLOOR_Y - 2, SW, SH - FLOOR_Y + 2, C.stone2)
        rect(s, 0, FLOOR_Y - 2, SW, 2, C.bone0)
        for (let y = FLOOR_Y + 8; y < SH; y++) for (let x = 0; x < SW; x++) if (!bayer(x + R(sc), y, 16 - R((y - FLOOR_Y - 8) * 0.7))) s.set(x, y, C.void)
        drift(s, t, 24, 83, [C.stone3, C.pink, C.haze], -8, 2, 40, SH)
    }
}

const theVoid: WorldScene = {
    id: 'world_the_void',
    draw(s, sc, t) {
        rect(s, 0, 0, SW, SH, C.ink)
        // nebula
        for (let i = 0; i < 3; i++) ditherEllipse(s, mod(80 + i * 110 - sc * 0.03, SW + 60) - 30, 50 + i * 20, 50, 18, i === 1 ? C.purple0 : C.night0, 6)
        for (let i = 0; i < 70; i++) {
            const x = mod(hash2(91, i) * SW - sc * 0.05 * (1 + (i % 3)), SW)
            const y = hash2(92, i) * 130
            const tw = (Math.floor(qt(t) * 4) + i) % 5
            s.set(R(x), R(y), tw === 0 ? C.white : tw < 3 ? C.haze : C.night3)
        }
        // fragments of every world, drifting
        const frag = (x: number, y: number, top: number, rock: number) => { rect(s, x - 5, y, 11, 2, top); tri(s, x - 5, y + 2, x + 5, y + 2, x, y + 9, rock) }
        const tops = [C.green2, C.olive1, C.lava1, C.white, C.teal2, C.purple1, C.bone0, C.green3, C.stone3]
        band(sc * 0.3, 60, 93, (x, k, r) => frag(x, 40 + R(r * 70) + R(Math.sin(qt(t) + k) * 2), tops[mod(k, tops.length)]!, C.stone1))
        // the great pale crack
        const cx = 250 - sc * 0.01
        poly(s, [0, -50, 6, -20, 2, 0, 7, 22, 0, 50, -6, 22, -2, 0, -7, -20], cx, 70, C.purple1)
        poly(s, [0, -40, 3, -16, 0, 0, 3, 18, 0, 40, -3, 18, 0, 0, -3, -16], cx, 70, C.pink)
        line(s, cx, 34, cx, 106, C.white)
        // a floor of black glass rimmed in violet
        rect(s, 0, FLOOR_Y - 1, SW, SH - FLOOR_Y + 1, C.void)
        rect(s, 0, FLOOR_Y - 1, SW, 1, C.purple2)
        dither(s, 0, FLOOR_Y, SW, 4, C.purple0, 8)
        for (let i = 0; i < 12; i++) { const x = mod(i * 29 - sc, SW); line(s, x, FLOOR_Y + 4 + (i % 4) * 5, x + 10, FLOOR_Y + 4 + (i % 4) * 5, C.night1) }
        drift(s, t, 20, 94, [C.purple2, C.pink], -2, -10, 60, FLOOR_Y)
    }
}

export const WORLD_SCENES: readonly WorldScene[] = [thornwick, mirewood, cinderpass, rimeholt, sunkenAmarath, duskspire, bonefields, shatteredSky, fraying, theVoid]

