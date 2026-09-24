// Icon construction: 24×24 icons are a frame plus a glyph, the glyph drawn into a scratch
// buffer and stamped with the same generated ink outline the sprites get, so icons and
// sprites read as one style. Small icons (status, currency) are 16×16.

import { C, CLEAR } from './palette'
import { Surface, StampStyle, stamp, rect, px, line, disc, ring, tri, ellipse, dither, ditherDisc, poly, arc } from './surface'
import type { Mat } from './weapons'

export const ICON = 24
export const SMALL_ICON = 16

const GLYPH = new Surface(ICON, ICON, 0, 0)
const GLYPH_S = new Surface(SMALL_ICON, SMALL_ICON, 0, 0)
const ST = new StampStyle()

export type Glyph = (g: Surface, cx: number, cy: number) => void

/** Draw `glyph` centred at (cx, cy) of `dst`, outlined in ink. */
export function glyph(dst: Surface, glyphFn: Glyph, cx: number, cy: number, small = false, outline: number = C.ink): void {
    const g = small ? GLYPH_S : GLYPH
    g.clear()
    glyphFn(g, g.w >> 1, g.h >> 1)
    ST.reset()
    ST.outline = outline
    g.ax = g.w >> 1
    g.ay = g.h >> 1
    stamp(dst, g, cx, cy, ST)
}

// ── Frames ─────────────────────────────────────────────────────────────────────────

/** Square skill frame (class-tree skills — `skills-gacha.md` §7 locks square). */
export function squareFrame(s: Surface, m: Mat, bg: number = C.night0): void {
    rect(s, 1, 1, 22, 22, C.ink)
    rect(s, 2, 2, 20, 20, m[0])
    rect(s, 3, 3, 18, 18, bg)
    dither(s, 3, 13, 18, 8, m[0], 4)
    rect(s, 2, 2, 20, 1, m[2])
    rect(s, 2, 2, 1, 20, m[1])
    px(s, 2, 2, C.white)
}

/** Circular skill frame (Training Grounds skills — deliberately distinct from class skills). */
export function circleFrame(s: Surface, m: Mat, bg: number = C.night0): void {
    disc(s, 12, 12, 11, C.ink)
    disc(s, 12, 12, 10, m[0])
    disc(s, 12, 12, 8, bg)
    ditherDisc(s, 12, 14, 7, m[0], 4)
    arc(s, 12, 12, 10, Math.PI * 1.05, Math.PI * 1.6, m[2])
    arc(s, 12, 12, 9, Math.PI * 1.1, Math.PI * 1.5, m[1])
}

/** Diamond crest frame (Champion abilities), coloured by archetype. */
export function crestFrame(s: Surface, m: Mat, bg: number = C.night0): void {
    poly(s, [12, 0, 23, 11, 23, 13, 12, 24, 1, 13, 1, 11], 0, 0, C.ink)
    poly(s, [12, 1, 22, 11, 22, 13, 12, 23, 2, 13, 2, 11], 0, 0, m[0])
    poly(s, [12, 3, 20, 11, 20, 13, 12, 21, 4, 13, 4, 11], 0, 0, bg)
    line(s, 12, 1, 2, 11, m[2])
    line(s, 12, 2, 3, 11, m[1])
}

/** A plain dark tile behind item icons, tinted by rarity. */
export function itemTile(s: Surface, m: Mat): void {
    rect(s, 1, 1, 22, 22, C.ink)
    rect(s, 2, 2, 20, 20, C.night0)
    dither(s, 2, 2, 20, 20, m[0], 5)
    ditherDisc(s, 12, 12, 7, m[1], 3)
    rect(s, 2, 21, 20, 1, m[1])
}

export { C, CLEAR, rect, px, line, disc, ring, tri, ellipse, dither, ditherDisc, poly, arc }
