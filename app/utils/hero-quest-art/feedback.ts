// Combat feedback (asset-list §2.3) and the gacha reveal (§4).
//
// Damage numbers: four styles (normal, crit, heal, miss), each an animated pop plus a glyph
// atlas the battle can typeset from. The party frame, cooldown sweep and enrage timer are
// pixel UI pieces; the add-wave burrow and the phase shift are raid VFX. The gacha reveal is
// ONE flash drawn on a neutral ramp and recoloured per rarity by a palette map — the locked
// "one shared flash, recolored per rarity tier", not six cinematics.

import { C, type ColorName } from './palette'
import { Surface, rect, px, line, disc, ring, tri, ditherDisc, rampLut, hash2 } from './surface'
import { drawText, textWidth, type FontName } from './font'
import { qt, pr, burst, shock, star, R } from './vfx-kit'
import { classNodeIcon, STATUS_ICONS  } from './icons-misc'

// ── Damage numbers ─────────────────────────────────────────────────────────────────

export interface NumberStyle {
    id: 'normal' | 'crit' | 'heal' | 'miss'
    label: string
    sample: string
    font: FontName
    color: number
    shadow: number
    bevel?: number
}

export const NUMBER_STYLES: readonly NumberStyle[] = [
    // round 2: the video's chunky numbers — hits in outlined gold, crits in outlined red
    { id: 'normal', label: 'Normal hit', sample: '1.24K', font: 'small', color: C.gold2, shadow: C.ink, bevel: C.gold3 },
    { id: 'crit', label: 'Crit hit', sample: '8.61K!', font: 'big', color: C.red2, shadow: C.ink, bevel: C.red3 },
    { id: 'heal', label: 'Heal', sample: '+356', font: 'small', color: C.green4, shadow: C.green0 },
    { id: 'miss', label: 'Miss / evasion', sample: 'MISS', font: 'small', color: C.steel2, shadow: C.stone0 }
]

/** The pop: rises, overshoots on scale for crits, then blinks out. (x, y) is the spawn point. */
export function drawNumberPop(s: Surface, style: NumberStyle, text: string, x: number, y: number, t: number): void {
    const u = qt(t) / 0.9
    if (u >= 1) return
    const rise = R((1 - (1 - u) * (1 - u)) * 14)
    if (u > 0.75 && (Math.floor(qt(t) * 10) & 1)) return
    const scale = style.id === 'crit' && u < 0.15 ? 2 : 1
    const wobble = style.id === 'miss' ? R(Math.sin(u * 12) * 1) : 0
    drawText(s, text, x + wobble, y - rise - (scale - 1) * 4, style.color, { font: style.font, scale, align: 1, shadow: 2, shadowColor: style.shadow, bevel: style.bevel })
}

/** Glyph atlas for a style: every character the battle prints, in one row. */
export const NUMBER_ATLAS_CHARS = '0123456789.KMBT+-!MISS'
export function drawNumberAtlas(s: Surface, style: NumberStyle): void {
    let x = 2
    for (const ch of '0123456789.KMBT+-!') {
        x += drawText(s, ch, x, 3, style.color, { font: style.font, align: 0, shadow: 2, shadowColor: style.shadow, bevel: style.bevel }) + 3
    }
    drawText(s, 'MISS', x, 3, style.color, { font: style.font, shadow: 2, shadowColor: style.shadow })
}
export function numberAtlasWidth(style: NumberStyle): number {
    let w = 4
    for (const ch of '0123456789.KMBT+-!') w += textWidth(ch, style.font) + 3
    return w + textWidth('MISS', style.font) + 4
}

// ── Party frame + HP bar ───────────────────────────────────────────────────────────

const PORTRAIT = new Surface(24, 24, 0, 0)

/** A 72×22 party frame: portrait, name bar, HP bar with a damage-chunk flash, status pips. */
export function drawPartyFrame(s: Surface, t: number, hpFrom = 0.9, hpTo = 0.35): void {
    rect(s, 0, 0, 72, 22, C.ink)
    rect(s, 1, 1, 70, 20, C.night1)
    rect(s, 1, 1, 70, 1, C.night3)
    // portrait
    const p = PORTRAIT
    p.clear()
    classNodeIcon(p, 'class_knight', 'warrior', 2)
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) { const c = p.get(x + 2, y + 2); if (c) s.set(x + 1, y + 1, c) }
    // HP: drains from → to over the clip, a white chunk trailing where damage landed
    const u = pr(t, 0.2, 0.5)
    const hp = hpFrom + (hpTo - hpFrom) * u
    const lag = hpFrom + (hpTo - hpFrom) * pr(t, 0.5, 0.9)
    const W = 46
    rect(s, 23, 5, W + 2, 6, C.ink)
    rect(s, 24, 6, W, 4, C.red0)
    const col = hp > 0.5 ? [C.green1, C.green3] : hp > 0.2 ? [C.gold1, C.gold2] : [C.red1, C.red2]
    rect(s, 24, 6, R(W * lag), 4, u > 0 && u < 1 ? C.white : C.red3)
    rect(s, 24, 6, R(W * hp), 4, col[0]!)
    rect(s, 24, 6, R(W * hp), 1, col[1]!)
    for (let i = 1; i < 5; i++) px(s, 24 + R(W * i / 5), 9, C.ink) // segment ticks
    // status pips
    const shown = ['shield', 'buff', 'burn']
    shown.forEach((id, i) => {
        const st = STATUS_ICONS.find(x => x.id === id)!
        const m = st.hostile ? [C.red0, C.red2] : [C.teal0, C.teal2]
        rect(s, 24 + i * 7, 13, 6, 6, m[0]!); rect(s, 25 + i * 7, 14, 4, 4, m[1]!)
        px(s, 26 + i * 7, 15, C.white)
    })
    drawText(s, 'LV 42', 70, 14, C.bone1, { align: 2, shadow: 1 })
}

// ── Cooldown radial ────────────────────────────────────────────────────────────────

/** A 24×24 overlay: dark wedge sweeping clockwise off the icon; flashes when ready. */
export function drawCooldown(s: Surface, u: number): void {
    const ready = u >= 1
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
        const dx = x - 11.5
        const dy = y - 11.5
        let a = Math.atan2(dx, -dy) / (Math.PI * 2)
        if (a < 0) a += 1
        if (!ready && a >= u && ((x + y) & 1) === 0) s.set(x, y, C.ink)
    }
    if (!ready) {
        const a = u * Math.PI * 2
        line(s, 12, 12, 12 + Math.sin(a) * 13, 12 - Math.cos(a) * 13, C.white)
    } else {
        rect(s, 0, 0, 24, 1, C.white); rect(s, 0, 23, 24, 1, C.white); rect(s, 0, 0, 1, 24, C.white); rect(s, 23, 0, 1, 24, C.white)
        star(s, 20, 3, 2, C.gold3)
    }
}

// ── Boss enrage timer ──────────────────────────────────────────────────────────────

/** An 88×14 timer bar: hourglass, draining bar, skull. `u` 0 → 1 is time spent; 1 = enraged. */
export function drawEnrageTimer(s: Surface, u: number, t: number): void {
    const low = u > 0.75
    const enraged = u >= 1
    const pulse = Math.floor(qt(t) * 6) & 1
    rect(s, 0, 0, 88, 14, C.ink)
    rect(s, 1, 1, 86, 12, enraged ? C.red0 : C.night1)
    // hourglass
    rect(s, 3, 2, 7, 1, C.gold1); rect(s, 3, 11, 7, 1, C.gold1)
    tri(s, 4, 3, 8, 3, 6, 7, C.frost); tri(s, 4, 10, 8, 10, 6, 7, C.frost)
    tri(s, 5, 4 + R(u * 2), 7, 4 + R(u * 2), 6, 7, C.gold2); rect(s, 5, 10 - R(u * 2), 3, R(u * 2) + 1, C.gold2)
    // bar
    rect(s, 13, 4, 60, 6, C.ink)
    const left = R(58 * (1 - Math.min(1, u)))
    const col = enraged ? C.red2 : low ? (pulse ? C.red2 : C.orange) : C.gold2
    rect(s, 14, 5, left, 4, col)
    rect(s, 14, 5, left, 1, enraged ? C.red3 : C.gold3)
    // skull at the end, lighting up as it closes in
    const sk = low ? C.red3 : C.bone0
    disc(s, 80, 6, 4, sk); rect(s, 78, 9, 5, 2, sk)
    px(s, 78, 6, C.ink); px(s, 81, 6, C.ink); px(s, 79, 10, C.ink)
    if (enraged) for (let i = 0; i < 5; i++) px(s, 76 + i * 2, 1 - ((i + pulse) & 1), C.orange)
}

// ── Raid VFX: add-wave burrow, phase shift ─────────────────────────────────────────

/** 64×48: the ground cracks and bursts as a Dig-site add wave surfaces. */
export function drawAddWaveSpawn(s: Surface, t: number): void {
    const x = 32
    const y = 42
    const u = pr(t, 0, 0.4)
    for (let i = 0; i < 6; i++) {
        const a = Math.PI + i * (Math.PI / 5)
        line(s, x, y, x + Math.cos(a) * 14 * u, y + Math.sin(a) * 3 * u + 1, C.brown0)
    }
    if (qt(t) > 0.35) {
        ditherDisc(s, x, y - 2, 8 * pr(t, 0.35, 0.6), C.brown1, 10)
        burst(s, x, y - 2, t, 0.4, 24, 70, 'dust', 3, 0.7, 140, -Math.PI / 2, 1.8, 2)
        burst(s, x, y - 2, t, 0.45, 10, 50, 'gold', 4, 0.5, 100, -Math.PI / 2, 1.2)
        shock(s, x, y, t, 0.4, 0.5, 4, 26, 'ash', true, 2)
    }
}

/** 96×96: the Forge boss crossing an HP threshold — a heat flash and a ring of sparks. */
export function drawPhaseShift(s: Surface, t: number): void {
    const x = 48
    const y = 60
    const u = pr(t, 0, 0.3)
    if (qt(t) < 0.4) ditherDisc(s, x, y - 10, 10 + u * 30, C.gold3, R(12 - u * 8))
    shock(s, x, y - 10, t, 0.1, 0.6, 6, 44, 'fire', false, 3)
    shock(s, x, y, t, 0.15, 0.6, 4, 44, 'ember', true, 2)
    burst(s, x, y - 10, t, 0.1, 30, 110, 'spark', 5, 0.8, 80, 0, Math.PI * 2, 2)
    if (qt(t) > 0.3) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const r = 20 + pr(t, 0.3, 1) * 20; line(s, x + Math.cos(a) * (r - 6), y - 10 + Math.sin(a) * (r - 6), x + Math.cos(a) * r, y - 10 + Math.sin(a) * r, i & 1 ? C.orange : C.gold3) }
}

// ── Gacha reveal ───────────────────────────────────────────────────────────────────

/** The neutral ramp the base flash is drawn in (light → dark). */
const BASE = [C.white, C.steel3, C.steel2, C.steel1, C.steel0] as const
const REVEAL_RAMP: Readonly<Record<string, readonly number[]>> = {
    common: BASE,
    uncommon: [C.white, C.green4, C.green3, C.green2, C.green1],
    rare: [C.white, C.cyan, C.blue2, C.blue1, C.blue0],
    epic: [C.white, C.pink, C.purple2, C.purple1, C.purple0],
    legendary: [C.white, C.gold3, C.gold2, C.gold1, C.gold0],
    mythic: [C.white, C.red3, C.red2, C.red1, C.red0]
}

/** Palette maps from the base flash onto each rarity. */
export const REVEAL_LUT: Readonly<Record<string, Uint8Array>> = Object.fromEntries(
    Object.entries(REVEAL_RAMP).map(([r, ramp]) => [r, rampLut([[Uint8Array.from(BASE), Uint8Array.from(ramp)]])])
)

export const REVEAL_SIZE = 72

/**
 * The shared reveal flash, 72×72, 1.4 s: a charge-up glint, the burst, rays turning, a ring,
 * sparkles settling. Draws only BASE colours so a LUT can recolour it losslessly.
 */
export function drawRevealBase(s: Surface, t: number): void {
    const x = 36
    const y = 36
    const q = qt(t)
    if (q < 0.3) {
        // charge: a point of light gathering motes
        const r = 3 + R(pr(t, 0, 0.3) * 3)
        disc(s, x, y, r, BASE[2]); disc(s, x, y, r - 1, BASE[1]); px(s, x, y, BASE[0])
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + q * 4; const d = 26 - pr(t, 0, 0.3) * 20; px(s, R(x + Math.cos(a) * d), R(y + Math.sin(a) * d), BASE[1]) }
        return
    }
    const u = pr(t, 0.3, 1.4)
    // rays
    const n = 12
    for (let i = 0; i < n; i++) {
        const a = i * (Math.PI * 2 / n) + q * 0.8
        const len = 18 + (i & 1 ? 8 : 14) * (1 - u * 0.5)
        const w = i & 1 ? 1 : 2
        for (let k = 6; k < len; k++) {
            const c = k < 12 ? BASE[1] : k < 20 ? BASE[2] : BASE[3]
            for (let j = -w + 1; j < w; j++) px(s, R(x + Math.cos(a) * k - Math.sin(a) * j), R(y + Math.sin(a) * k + Math.cos(a) * j), c)
        }
    }
    // burst core
    const core = R(10 * (1 - pr(t, 0.3, 0.7)) + 5)
    disc(s, x, y, core + 2, BASE[2]); disc(s, x, y, core, BASE[1]); disc(s, x, y, core - 2, BASE[0])
    // ring
    const rr = 8 + eoLocal(pr(t, 0.3, 0.8)) * 26
    if (q < 0.9) { ring(s, x, y, rr, BASE[1]); ring(s, x, y, rr - 1, BASE[2]) }
    // sparkles drifting down
    for (let i = 0; i < 10; i++) {
        const sx = R(x + (hash2(9, i) - 0.5) * 60)
        const sy = R(y - 28 + (hash2(10, i) * 30) + u * 20)
        if (((i + Math.floor(q * 10)) % 3) === 0) continue
        px(s, sx, sy, BASE[0]); px(s, sx - 1, sy, BASE[2]); px(s, sx + 1, sy, BASE[2]); px(s, sx, sy - 1, BASE[2]); px(s, sx, sy + 1, BASE[2])
    }
}

function eoLocal(u: number): number { return 1 - (1 - u) * (1 - u) }

export type { ColorName }
