// Raid bosses (asset-list §1.5) — five unique designs, one per raid — and the Arena training
// dummy (§1.6).
//
// Fight types drive what each one needs beyond the bosses' five states:
//   solo_boss        Guild, Training Grounds — the standard five
//   reinforced_boss  Dig-site — plus its own add-wave enemies
//   phased_boss      Forge — a visually distinct body per HP phase, and the shifts between
//   rampaging_boss   Trait — unkillable: no Death ever plays, no HP bar exists, so its
//                    escalation level is drawn on the body (horns, cracks, aura) instead

import { C } from './palette'
import type { CreatureDef } from './creature'
import { fr, hitPhase, deathPhase, span, sm } from './creature'
import type { Mat } from './weapons'
import {
    B, Entry, bossStates, drive, finish, bz, ball, glowEye, spikes, mouth, speckle,
    limbT, reach, P, rect, px, line, disc, ellipse, tri, quad, dither, ditherEllipse, ring, arc, poly, q, wv, hash2
} from './boss-kit'

const R = Math.round

const GILT: Mat = [C.gold0, C.gold1, C.gold2]
const WOOD: Mat = [C.brown1, C.brown2, C.brown3]
const SAND: Mat = [C.brown2, C.brown3, C.bone1]
const IRON: Mat = [C.stone1, C.stone2, C.steel2]
const REDHOT: Mat = [C.red1, C.lava1, C.orange]
const WHITEHOT: Mat = [C.orange, C.gold3, C.white]

// ═══════════════════════════════════════════════════════════════ Guild Raid — solo_boss

/** The Gilded Warlord — a champion the guild could not beat, in gold and crimson plate. */
export const GILDED_WARLORD: CreatureDef = {
    name: 'The Gilded Warlord', size: 160, shadow: 28, accent: C.gold3,
    states: bossStates(1.4, 1.8, 2.2),
    draw(s, st, t) {
        drive(this, st, t, 10, 1.8)
        const x = s.ax - 6 + B.lunge - B.kb
        const y = s.ay
        const crouch = R(B.strike ? 6 : B.rec * 5 + B.die * 20)
        const hip = y - 44 + crouch + B.bob
        const top = hip - 40
        // war-banner on his back
        line(s, x - 16, top - 44, x - 14, hip, C.brown1, 3)
        const flap = fr(t, 4, 3)
        poly(s, [0, 0, -26, 3 + flap, -22, 14, -28, 26 - flap, 0, 24], x - 16, top - 42, C.red1)
        line(s, x - 16, top - 42, x - 40, top - 38 + flap, C.red2)
        disc(s, x - 27, top - 30, 4, C.gold1); px(s, x - 28, top - 31, C.gold3)
        // cape
        quad(s, x - 18, top + 4, x - 4, top + 4, x - 12, y - 6, x - 36, y - 2 + flap, C.red1)
        quad(s, x - 18, top + 4, x - 12, top + 4, x - 24, y - 4, x - 36, y - 2 + flap, C.red0)
        // legs
        limbT(s, x - 6, hip, x - 12, y - 4, 12, 10, GILT)
        limbT(s, x + 8, hip, x + 12, y - 4, 12, 10, [C.gold1, C.gold2, C.gold3])
        rect(s, x - 19, y - 6, 14, 6, C.gold0); rect(s, x + 5, y - 6, 14, 6, C.gold1)
        // torso: plate with a crimson tabard
        rect(s, x - 18, top + 4, 36, 40, C.gold1)
        rect(s, x - 18, top + 4, 4, 40, C.gold0)
        rect(s, x + 8, top + 8, 3, 18, C.gold3)
        rect(s, x - 6, top + 14, 12, 34, C.red1)
        rect(s, x - 3, top + 14, 6, 34, C.red2)
        disc(s, x, top + 26, 4, C.gold2); px(s, x, top + 26, C.white) // guild crest
        rect(s, x - 18, hip - 5, 36, 4, C.brown0)
        ball(s, x + 14, top + 6, 11, 7, GILT) // great pauldron
        spikes(s, x + 6, top, x + 22, top + 2, 4, 5, C.gold2, C.white)
        // tower shield on the back arm
        rect(s, x - 34, top + 6, 16, 40, C.gold1)
        rect(s, x - 32, top + 8, 12, 36, C.red1)
        rect(s, x - 27, top + 12, 2, 28, C.gold2); rect(s, x - 31, top + 22, 10, 2, C.gold2)
        rect(s, x - 34, top + 6, 16, 2, C.gold3)
        // helm with a crown ridge and a slit
        const hx = x + 4
        const hy = top + 4 + R(B.die * 6)
        rect(s, hx - 9, hy - 20, 18, 20, C.gold1)
        rect(s, hx - 9, hy - 20, 4, 20, C.gold0)
        rect(s, hx - 2, hy - 12, 11, 2, C.ink)
        const eye = B.hurt ? C.white : (B.glow > 0.5 ? C.white : C.red2)
        px(s, hx + 6, hy - 12, eye); px(s, hx + 7, hy - 12, eye)
        rect(s, hx + 2, hy - 20, 2, 18, C.gold3)
        for (let i = 0; i < 5; i++) tri(s, hx - 8 + i * 4, hy - 20, hx - 6 + i * 4, hy - 20, hx - 7 + i * 4, hy - 26 - (i === 2 ? 3 : 0), C.gold2)
        // halberd
        const sx = x + 16
        const sy = top + 10
        const a = bz(-1.3, -2.5, 0.5)
        reach(sx, sy, a, 18)
        const gx = P.x
        const gy = P.y
        limbT(s, sx, sy, gx, gy, 8, 7, GILT)
        reach(gx, gy, a, 44)
        line(s, gx - Math.cos(a) * 14, gy - Math.sin(a) * 14, P.x, P.y, C.brown1, 3)
        const nx = -Math.sin(a)
        const ny = Math.cos(a)
        tri(s, P.x, P.y, P.x - Math.cos(a) * 12 - nx * 12, P.y - Math.sin(a) * 12 - ny * 12, P.x - Math.cos(a) * 2 - nx * 13, P.y - Math.sin(a) * 2 - ny * 13, C.steel2)
        line(s, P.x - Math.cos(a) * 11 - nx * 12, P.y - Math.sin(a) * 11 - ny * 12, P.x - Math.cos(a) * 2 - nx * 13, P.y - Math.sin(a) * 2 - ny * 13, C.white)
        tri(s, P.x, P.y, P.x - Math.cos(a) * 4 + nx * 4, P.y - Math.sin(a) * 4 + ny * 4, P.x + Math.cos(a) * 8, P.y + Math.sin(a) * 8, C.steel3)
        rect(s, gx - 3, gy - 3, 6, 6, C.gold0)
        finish(s, Entry.Walk, 16)
    },
    fx(dst, st, t, x, y, dir) {
        if (st === 'attack' && B.strike) for (let i = 0; i < 14; i++) dst.set(x + dir * (40 + i * 2), y - (i % 4), i & 1 ? C.gold3 : C.stone3)
        if (B.roar) for (let i = 0; i < 8; i++) dst.set(x + dir * (-30 + i * 9), y - 140 + (i & 1) * 4, C.gold3)
    }
}

// ═══════════════════════════════════════════════════════════════ Training Grounds Raid — solo_boss

/** The Drillmaster — every practice dummy in the yard, stitched into one giant, armed from the racks. */
export const DRILLMASTER: CreatureDef = {
    name: 'The Drillmaster', size: 160, shadow: 26, accent: C.red2,
    states: bossStates(1.2, 1.4, 2.0),
    draw(s, st, t) {
        drive(this, st, t, 10, 1.4)
        const x = s.ax - 4 + B.lunge - B.kb
        const y = s.ay
        const wob = wv(t, 1.4, 2)
        const top = y - 110 + B.breath + R(B.die * 30)
        // the post it stands on
        rect(s, x - 5, top + 70, 10, y - top - 70, C.brown1)
        rect(s, x - 5, top + 70, 3, y - top - 70, C.brown0)
        rect(s, x - 24, y - 6, 48, 6, C.brown2)
        rect(s, x - 24, y - 6, 48, 1, C.brown3)
        // weapon rack on its back
        for (let i = 0; i < 4; i++) { line(s, x - 30 + i * 6, top - 6 + i * 2, x - 22 + i * 6, top + 40, C.steel2, 2); px(s, x - 30 + i * 6, top - 7 + i * 2, C.white) }
        // straw-stuffed body, stitched sacking
        ball(s, x + wob, top + 42, 26, 30, [C.brown1, C.brown2, C.brown3])
        dither(s, x - 22 + wob, top + 20, 44, 44, C.olive2, 4)
        for (let i = 0; i < 6; i++) line(s, x - 18 + wob + i * 7, top + 20 + (i & 1) * 4, x - 16 + wob + i * 7, top + 64, C.brown0)
        for (let i = 0; i < 5; i++) { px(s, x + 22 + wob, top + 30 + i * 6, C.gold2); px(s, x + 24 + wob, top + 32 + i * 6, C.gold2) } // straw poking out
        // target painted on the chest
        const tx = x + 6 + wob
        const ty = top + 40
        disc(s, tx, ty, 10, C.bone1)
        disc(s, tx, ty, 7, C.red1)
        disc(s, tx, ty, 4, C.bone1)
        disc(s, tx, ty, 2, C.red2)
        line(s, tx - 4, ty - 6, tx + 3, ty + 2, C.brown0) // an arrow stuck in it
        px(s, tx - 5, ty - 7, C.white); px(s, tx - 6, ty - 7, C.white)
        // bucket helmet
        const hx = x + 4 + wob
        const hy = top + 10 + R(B.die * 6)
        quad(s, hx - 12, hy - 18, hx + 12, hy - 18, hx + 10, hy + 4, hx - 10, hy + 4, C.steel1)
        rect(s, hx - 12, hy - 18, 24, 3, C.steel2)
        rect(s, hx - 10, hy + 1, 20, 3, C.steel0)
        for (let i = 0; i < 3; i++) rect(s, hx - 11 + i * 9, hy - 14, 2, 18, C.steel0)
        rect(s, hx - 2, hy - 8, 12, 2, C.ink)
        const eye = B.hurt ? C.white : (B.glow > 0.3 ? C.red3 : C.red2)
        px(s, hx + 3, hy - 8, eye); px(s, hx + 8, hy - 8, eye)
        line(s, hx - 12, hy - 18, hx - 14, hy - 26, C.steel1, 2) // bent handle
        line(s, hx - 14, hy - 26, hx + 6, hy - 28, C.steel1, 2)
        // two practice-sword arms on wooden poles
        const sx = x + 22 + wob
        const sy = top + 28
        const a = bz(-0.6, -2.3, 0.7)
        reach(sx, sy, a, 22)
        limbT(s, sx, sy, P.x, P.y, 6, 5, WOOD)
        const gx = P.x
        const gy = P.y
        reach(gx, gy, a - 0.3, 30)
        line(s, gx, gy, P.x, P.y, C.brown3, 4)
        line(s, gx + 1, gy - 1, P.x + 1, P.y - 1, C.bone1)
        line(s, gx - Math.sin(a) * 5, gy + Math.cos(a) * 5, gx + Math.sin(a) * 5, gy - Math.cos(a) * 5, C.brown1, 2)
        limbT(s, x - 22 + wob, top + 30, x - 36 + wob, top + 58 + R(bz(0, 6, -6)), 6, 5, WOOD)
        rect(s, x - 40 + wob, top + 58, 8, 16, C.brown2) // a wooden buckler
        disc(s, x - 36 + wob, top + 66, 2, C.red1)
        finish(s, Entry.Drop, 20)
    },
    fx(dst, st, t, x, y, dir) {
        if (st === 'attack' && B.strike) for (let i = 0; i < 6; i++) dst.set(x + dir * (60 + i * 2), y - 70 + i * 4, i & 1 ? C.gold2 : C.olive2) // straw flying
        if (st === 'hit' || st === 'death') { const k = fr(t, 10, 8); for (let i = 0; i < 5; i++) dst.set(x + dir * (-10 + i * 7), y - 90 + k * 6 + (i & 1) * 5, C.gold2) }
    }
}

// ═══════════════════════════════════════════════════════════════ Dig-site Raid — reinforced_boss

/** The Buried Colossus — a relic-carved giant half out of the excavation, still wearing scaffold. */
export const BURIED_COLOSSUS: CreatureDef = {
    name: 'The Buried Colossus', size: 160, shadow: 0, accent: C.cyan,
    states: bossStates(1.6, 2.0, 2.6),
    draw(s, st, t) {
        drive(this, st, t, 6, 2.0)
        const x = s.ax - 2 + B.lunge - B.kb
        const y = s.ay
        const top = y - 110 + B.breath + R(B.die * 24)
        // back arm reaching out of the pit
        limbT(s, x - 30, top + 40, x - 52, top + 70, 14, 11, SAND)
        ball(s, x - 54, top + 76, 10, 8, SAND)
        // body: carved blocks
        rect(s, x - 34, top + 30, 68, 80, SAND[1])
        rect(s, x - 34, top + 30, 6, 80, SAND[0])
        rect(s, x + 24, top + 34, 4, 70, SAND[2])
        for (let i = 0; i < 5; i++) line(s, x - 34, top + 44 + i * 14, x + 34, top + 44 + i * 14, SAND[0])
        for (let i = 0; i < 12; i++) line(s, x - 30 + (i % 4) * 18 + (((i >> 2) & 1) * 9), top + 30 + (i >> 2) * 14, x - 30 + (i % 4) * 18 + (((i >> 2) & 1) * 9), top + 44 + (i >> 2) * 14, SAND[0])
        speckle(s, x - 34, top + 30, 68, 80, SAND, 17)
        // relic runes glowing through
        const lit = B.glow > 0.3 || fr(t, 3, 2) ? C.cyan : C.teal2
        for (const [rx, ry] of [[-14, 52], [8, 64], [-6, 80], [16, 44]] as const) { rect(s, x + rx, top + ry, 5, 1, lit); rect(s, x + rx + 2, top + ry - 2, 1, 5, lit) }
        // scaffold still lashed on
        line(s, x - 42, top + 40, x - 40, top + 104, C.brown2, 2)
        line(s, x + 40, top + 36, x + 42, top + 104, C.brown2, 2)
        line(s, x - 42, top + 60, x + 40, top + 56, C.brown2, 2)
        line(s, x - 42, top + 84, x + 42, top + 80, C.brown1, 2)
        // head: a carved face mask
        const hx = x + 6
        const hy = top + 20 + R(bz(0, -4, 4))
        rect(s, hx - 18, hy - 22, 34, 30, SAND[1])
        rect(s, hx - 18, hy - 22, 34, 3, SAND[2])
        rect(s, hx - 18, hy - 22, 4, 30, SAND[0])
        rect(s, hx - 8, hy - 12, 8, 4, C.ink); rect(s, hx + 6, hy - 12, 8, 4, C.ink)
        const eye = B.hurt ? C.white : lit
        rect(s, hx - 6, hy - 11, 4, 2, eye); rect(s, hx + 8, hy - 11, 4, 2, eye)
        rect(s, hx + 2, hy - 6, 3, 6, SAND[2])
        if (B.roar || B.strike) mouth(s, hx - 4, hy + 2, 14, 4, C.ink, SAND[2]); else rect(s, hx - 4, hy + 2, 14, 1, C.ink)
        line(s, hx - 14, hy - 20, hx - 4, hy + 6, SAND[0]) // an old crack
        // near arm: a slab fist that slams
        const sx = x + 30
        const sy = top + 40
        const a = bz(0.9, -1.4, 1.3)
        reach(sx, sy, a, 40)
        limbT(s, sx, sy, P.x, P.y, 16, 12, SAND)
        rect(s, P.x - 10, P.y - 6, 20, 16, SAND[1])
        rect(s, P.x - 10, P.y - 6, 20, 2, SAND[2])
        rect(s, P.x - 2, P.y - 2, 4, 1, lit)
        finish(s, Entry.Rise, 0)
    },
    fx(dst, st, t, x, y, dir) {
        // the excavation pit: sand rim with dirt
        ditherEllipse(dst, x, y - 1, 64, 5, C.brown0, 16)
        ditherEllipse(dst, x, y - 3, 58, 3, C.brown1, 10)
        const k = fr(t, 10, 10)
        for (let i = 0; i < 6; i++) dst.set(x + dir * (-56 + ((i * 23 + k * 7) % 112)), y - 5 - (i & 1), C.brown3)
        if (st === 'attack' && B.strike) for (let i = 0; i < 14; i++) dst.set(x + dir * (56 + i * 2), y - 2 - (i % 5), i & 1 ? C.bone1 : C.brown3)
    }
}

/** Add wave 1 — the Dig Scarab: a beetle the size of a dog, shell inlaid with relic bronze. */
export const DIG_SCARAB: CreatureDef = {
    name: 'Dig Scarab', size: 48, shadow: 10, accent: C.gold2,
    states: { idle: { dur: 0.8, loop: true }, attack: { dur: 0.8, loop: false }, death: { dur: 1.0, loop: false } },
    draw(s, st, t) {
        const x = s.ax
        const y = s.ay
        let lunge = 0
        let die = 0
        if (st === 'attack') {
            const u = q(t) / 0.8
            lunge = u < 0.4 ? -1 : u < 0.6 ? 6 : R(6 * (1 - (u - 0.6) / 0.4))
        }
        if (st === 'death') die = deathPhase(t, 1.0)
        const leg = fr(t, 10, 2)
        const bx = x + lunge
        const by = y - 7 + R(die * 3)
        for (let i = 0; i < 3; i++) { line(s, bx - 6 + i * 5, by + 2, bx - 8 + i * 5 + (leg ? 1 : -1) * (i & 1 ? 1 : -1), y - 1, C.stone0); px(s, bx - 8 + i * 5, y - 1, C.ink) }
        ellipse(s, bx, by, 9, 5, C.gold0)
        ellipse(s, bx - 1, by - 1, 8, 4, C.teal1)
        line(s, bx - 1, by - 5, bx - 1, by + 3, C.gold0)
        px(s, bx - 4, by - 2, C.teal3); px(s, bx + 3, by - 3, C.teal3)
        arc(s, bx, by, 7, Math.PI * 1.1, Math.PI * 1.6, C.gold2)
        disc(s, bx + 9, by + 1, 3, C.stone1)
        line(s, bx + 11, by, bx + 14, by - 2, C.gold1); line(s, bx + 11, by + 2, bx + 14, by + 4, C.gold1) // mandibles
        px(s, bx + 10, by, st === 'death' ? C.ink : C.red3)
    }
}

/** Add wave 2 — the Relic Shard: a floating rune-stone that guards the dig. */
export const RELIC_SHARD: CreatureDef = {
    name: 'Relic Shard', size: 48, shadow: 6, hover: 1, accent: C.cyan,
    states: { idle: { dur: 1.2, loop: true }, attack: { dur: 0.8, loop: false }, death: { dur: 1.0, loop: false } },
    draw(s, st, t) {
        const x = s.ax
        let die = 0
        let glow = 0
        if (st === 'attack') { const u = q(t) / 0.8; glow = u < 0.5 ? u * 2 : 1 - (u - 0.5) * 2 }
        if (st === 'death') die = deathPhase(t, 1.0)
        const y = s.ay - 14 + wv(t, 1.2, 2) + R(die * 10)
        poly(s, [0, -10, 6, -2, 3, 8, -4, 7, -6, -3], x, y, C.stone2)
        poly(s, [0, -10, -6, -3, -4, 7, -1, 0], x, y, C.stone1)
        line(s, x, y - 9, x + 5, y - 2, C.stone3)
        const c = glow > 0.4 ? C.white : C.cyan
        line(s, x - 2, y - 4, x + 2, y - 4, c); line(s, x, y - 6, x, y + 3, c); px(s, x - 2, y + 1, c); px(s, x + 2, y + 1, c)
        if (glow > 0.2) ring(s, x, y - 1, 9 + R(glow * 3), C.cyan)
        for (let i = 0; i < 3; i++) { const a = q(t) * 3 + i * 2.1; px(s, x + R(Math.cos(a) * 11), y + R(Math.sin(a) * 4), C.teal3) }
    }
}

// ═══════════════════════════════════════════════════════════════ Forge Raid — phased_boss

/** The Anvil Heart — a forge-golem that heats as it breaks: cold iron → red-hot → white-hot. */
function anvilHeart(phase: 1 | 2 | 3): CreatureDef['draw'] {
    const metal = phase === 1 ? IRON : phase === 2 ? REDHOT : WHITEHOT
    const seam = phase === 1 ? C.orange : phase === 2 ? C.gold2 : C.white
    const shell = phase === 1 ? IRON : phase === 2 ? [C.stone0, C.stone1, C.red1] as Mat : [C.stone1, C.red1, C.orange] as Mat
    return function (this: CreatureDef, s, st, t) {
        drive(this, st, t, 8, 1.6)
        const x = s.ax - 2 + B.lunge - B.kb
        const y = s.ay
        const top = y - 112 + B.breath + R(B.die * 30)
        // legs: squat anvil-feet
        for (const lx of [-18, 14]) {
            limbT(s, x + lx, top + 76, x + lx + (lx > 0 ? 2 : -2), y - 10, 14, 12, shell)
            rect(s, x + lx - 12, y - 10, 24, 10, shell[1]); rect(s, x + lx - 12, y - 10, 24, 2, shell[2])
        }
        // back arm: the bellows
        limbT(s, x - 26, top + 30, x - 44, top + 62, 12, 10, shell)
        rect(s, x - 54, top + 60, 20, 14, C.brown2); rect(s, x - 54, top + 60, 20, 2, C.brown3)
        // body: an anvil on a furnace
        quad(s, x - 30, top + 30, x + 30, top + 30, x + 24, top + 80, x - 24, top + 80, shell[1])
        rect(s, x - 30, top + 30, 5, 50, shell[0])
        // the furnace mouth in its chest — the tell of the phase
        const fx = x + 2
        const fy = top + 54
        rect(s, fx - 12, fy - 10, 24, 20, C.ink)
        rect(s, fx - 10, fy - 8, 20, 16, metal[0])
        const flick = fr(t, 8, 3)
        for (let i = 0; i < 5; i++) tri(s, fx - 9 + i * 4, fy + 8, fx - 7 + i * 4, fy + 8, fx - 8 + i * 4 + (flick - 1), fy - 2 - ((i + flick) % 3) * 2 - phase * 2, metal[1])
        rect(s, fx - 10, fy + 5, 20, 3, metal[2])
        for (let i = 0; i < 4; i++) rect(s, fx - 12, fy - 9 + i * 5, 24, 1, shell[0]) // grate
        // seams glow more with each phase
        for (let i = 0; i < 3 * phase; i++) {
            const sx0 = x - 26 + R(hash2(phase, i) * 50)
            const sy0 = top + 34 + R(hash2(phase + 9, i) * 40)
            line(s, sx0, sy0, sx0 + 4 - (i & 1) * 8, sy0 + 5, seam)
        }
        // the anvil head
        const hy = top + 16 + R(bz(0, -4, 4))
        poly(s, [-30, 0, 34, 0, 44, -6, 40, 6, 22, 10, -22, 10], x, hy, shell[1])
        rect(s, x - 30, hy, 64, 2, shell[2])
        rect(s, x - 6, hy + 2, 18, 5, C.ink)
        const eye = B.hurt ? C.white : seam
        rect(s, x - 3, hy + 3, 4, 2, eye); rect(s, x + 6, hy + 3, 4, 2, eye)
        if (phase >= 2) { px(s, x + 30, hy - 8 - flick, metal[1]); px(s, x + 12, hy - 6 - flick, metal[2]) } // heat rising
        if (phase === 3) { for (let i = 0; i < 4; i++) px(s, x - 20 + i * 12, hy + 12 + fr(t, 6, 3) * 2, C.gold3) } // dripping
        // the hammer arm
        const sx = x + 28
        const sy = top + 36
        const a = bz(0.9, -1.6, 1.3)
        reach(sx, sy, a, 34)
        limbT(s, sx, sy, P.x, P.y, 13, 11, shell)
        const gx = P.x
        const gy = P.y
        rect(s, gx - 12, gy - 4, 24, 16, metal[0])
        rect(s, gx - 12, gy - 4, 24, 3, metal[2])
        rect(s, gx - 10, gy, 20, 8, metal[1])
        finish(s, Entry.Rise, 12)
    }
}

function forgeDef(phase: 1 | 2 | 3): CreatureDef {
    const def: CreatureDef = {
        name: `The Anvil Heart — phase ${phase}`, size: 160, shadow: 30, accent: phase === 1 ? C.orange : phase === 2 ? C.lava1 : C.gold3,
        states: bossStates(1.4, 1.6, 2.2),
        draw: () => {},
        fx(dst, st, t, x, y, dir) {
            const k = fr(t, 10, 10)
            for (let i = 0; i < phase * 2; i++) dst.set(x + dir * (-20 + ((i * 13 + k * 5) % 44)), y - 100 - ((k * 3 + i * 7) % 30), phase === 3 ? C.gold3 : C.orange)
            if (st === 'attack' && B.strike) for (let i = 0; i < 14; i++) dst.set(x + dir * (50 + i * 2), y - (i % 4), i & 1 ? (phase === 1 ? C.stone3 : C.gold2) : C.orange)
        }
    }
    def.draw = anvilHeart(phase).bind(def)
    return def
}

export const ANVIL_HEART = [forgeDef(1), forgeDef(2), forgeDef(3)] as const

// ═══════════════════════════════════════════════════════════════ Trait Raid — rampaging_boss

/**
 * The Rampant — unkillable, and it never shows an HP bar, so its rampage level is the read:
 * each tier adds horns, cracks of light and a wider aura. States: idle at each of five tiers,
 * attack, hit, and the escalation beat between tiers. There is no Death.
 */
export const RAMPAGE_TIERS = 5

function rampantDraw(tier: number, s: Parameters<CreatureDef['draw']>[0], st: string, t: number, def: CreatureDef): void {
    drive(def, st, t, 10, 1.0 - tier * 0.1)
    const up = st === 'escalate' ? sm(span(t, 0.2, 1.0)) : 0
    const lv = tier + up
    const x = s.ax - 4 + B.lunge - B.kb
    const y = s.ay
    const size = 1 + lv * 0.08
    const top = y - R(70 * size) + B.breath
    const hide: Mat = lv < 2 ? [C.stone0, C.stone1, C.stone2] : lv < 4 ? [C.night0, C.night1, C.night2] : [C.void, C.purple0, C.purple1]
    const cracks = lv < 2 ? C.orange : lv < 4 ? C.pink : C.white
    // hind legs
    for (const lx of [-20, 14]) limbT(s, x + lx, top + 40, x + lx - 4, y - 2, 12 * size, 9, hide)
    // hunched body
    ball(s, x, top + 36, R(34 * size), R(24 * size), hide)
    spikes(s, x - 28, top + 18, x + 10, top + 12, 6 + tier * 2, 6 + tier * 2, hide[2], cracks)
    // cracks of light, one more set per tier
    for (let i = 0; i < 2 + tier * 3; i++) {
        const cx = x - 24 + R(hash2(4, i) * 48)
        const cy = top + 22 + R(hash2(8, i) * 26)
        if (s.get(cx, cy)) { line(s, cx, cy, cx + 3, cy + 3, cracks); px(s, cx + 1, cy + 1, C.white) }
    }
    // forelegs
    const a = bz(1.3, -0.2, 1.1)
    reach(x + 22, top + 30, a, 30 * size)
    limbT(s, x + 22, top + 30, P.x, P.y, 12, 9, hide)
    for (let i = -1; i <= 1; i++) line(s, P.x, P.y, P.x + 5, P.y + 2 + i * 3, C.bone1, 2)
    limbT(s, x + 8, top + 44, x + 12, y - 2, 10, 8, hide)
    // head: grows horns with each tier
    const hx = x + R(30 * size)
    const hy = top + 18 + R(bz(0, -6, 8))
    ball(s, hx, hy, 12, 10, hide)
    rect(s, hx + 6, hy - 2, 12, 8, hide[1])
    const open = B.strike || st === 'escalate' ? 5 : 1
    mouth(s, hx + 6, hy + 4, 12, open, C.red1, C.bone1)
    glowEye(s, hx + 6, hy - 4, B.hurt ? C.white : cracks, hide[2], true)
    for (let i = 0; i <= Math.floor(lv); i++) {
        const hl = 8 + i * 4
        line(s, hx - 4 - i * 3, hy - 8, hx - 10 - i * 5, hy - 8 - hl, C.bone1, 3)
        px(s, hx - 10 - i * 5, hy - 9 - hl, C.white)
    }
}

function rampantDef(tier: number): CreatureDef {
    const def: CreatureDef = {
        name: `The Rampant — rampage ${tier + 1}`, size: 160, shadow: 30, accent: C.pink,
        states: {
            idle: { dur: 1.0, loop: true }, attack: { dur: 1.0, loop: false }, hit: { dur: 0.5, loop: false },
            escalate: { dur: 1.2, loop: false }
        },
        draw: (s, st, t) => rampantDraw(tier, s, st, t, def),
        fx(dst, st, t, x, y, dir) {
            // the aura ring IS the level read — no HP bar exists for this boss
            const lv = tier + (st === 'escalate' ? sm(span(t, 0.2, 1.0)) : 0)
            const k = fr(t, 10, 4)
            for (let r = 0; r <= Math.floor(lv); r++) {
                const rx = 40 + r * 8 + (k & 1)
                for (let a = 0; a < Math.PI * 2; a += 0.08) {
                    const px2 = x + R(Math.cos(a) * rx)
                    const py2 = y - 2 + R(Math.sin(a) * rx * 0.12)
                    if (((a * 20) | 0) % (4 - Math.min(3, r)) === 0) dst.set(px2, py2, r >= 3 ? C.white : r >= 2 ? C.pink : C.purple2)
                }
            }
            if (st === 'escalate') for (let i = 0; i < 12; i++) dst.set(x + dir * (-30 + i * 6), y - 90 - ((k * 5 + i * 7) % 30), C.pink)
        }
    }
    return def
}

export const RAMPANT = Array.from({ length: RAMPAGE_TIERS }, (_, i) => rampantDef(i))

// ═══════════════════════════════════════════════════════════════ Arena training dummy

/** The Arena training dummy: a static pose and one small hit reaction, nothing else. */
/**
 * Round 2: the reference video's scarecrow. A burlap sack head with stitched X eyes and a
 * straw tuft, a crossbar with straw bursting from the sleeves, a sack body painted with a
 * red target, all on a post. Narrow enough (19px) to stand three abreast on the enemy marks.
 */
export const TRAINING_DUMMY: CreatureDef = {
    name: 'Training dummy', size: 48, shadow: 7, accent: C.red2,
    states: { static: { dur: 0.1, loop: true }, hit: { dur: 0.6, loop: false } },
    draw(s, st, t) {
        let lean = 0
        if (st === 'hit') {
            hitPhase(t, 0.6)
            const u = q(t) / 0.6
            lean = R(Math.sin(u * Math.PI * 3) * (1 - u) * 3)
        }
        const x = s.ax
        const y = s.ay
        // the post and its foot
        rect(s, x - 1, y - 14, 3, 14, C.brown2)
        rect(s, x - 1, y - 14, 1, 14, C.brown3)
        rect(s, x - 3, y - 2, 7, 2, C.brown1)
        const bx = x + lean
        const top = y - 30
        // crossbar with straw bursting from both sleeves
        rect(s, bx - 9, top + 12, 19, 3, C.brown2)
        rect(s, bx - 9, top + 12, 19, 1, C.brown3)
        for (const sx of [-1, 1]) {
            const ex = bx + sx * 10
            px(s, ex, top + 11, C.gold3); px(s, ex, top + 13, C.gold2); px(s, ex + sx, top + 12, C.gold3)
            px(s, ex + sx, top + 14, C.gold2); px(s, ex, top + 15, C.gold1)
        }
        // the body sack, tied at the waist, a red target painted on
        rect(s, bx - 5, top + 10, 11, 12, C.brown2)
        rect(s, bx - 4, top + 11, 9, 10, C.brown3)
        rect(s, bx + 3, top + 11, 2, 10, C.brown2)
        rect(s, bx - 5, top + 21, 11, 1, C.brown1)
        disc(s, bx, top + 16, 3, C.red1)
        disc(s, bx, top + 16, 2, C.brown3)
        disc(s, bx, top + 16, 1, C.red2)
        // the sack head: stitched X eyes, a stitched grin, a straw tuft on top
        rect(s, bx - 4, top + 1, 9, 9, C.brown3)
        rect(s, bx - 4, top + 1, 9, 1, C.bone1)
        rect(s, bx + 3, top + 2, 2, 8, C.brown2)
        px(s, bx - 3, top + 6, C.bone0); px(s, bx + 1, top + 2, C.bone0) // burlap weave
        rect(s, bx - 4, top + 9, 9, 1, C.brown1) // the neck tie
        for (const ex of [bx - 2, bx + 2]) { px(s, ex - 1, top + 3, C.ink); px(s, ex, top + 4, C.ink); px(s, ex - 1, top + 5, C.ink); px(s, ex + 1, top + 3, C.ink); px(s, ex + 1, top + 5, C.ink) }
        rect(s, bx - 2, top + 7, 5, 1, C.brown0)
        px(s, bx - 1, top + 8, C.brown0); px(s, bx + 1, top + 8, C.brown0)
        px(s, bx - 1, top, C.gold3); px(s, bx, top - 1, C.gold2); px(s, bx + 1, top, C.gold3); px(s, bx + 2, top - 1, C.gold1)
    }
}

