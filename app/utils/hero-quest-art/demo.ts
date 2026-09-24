// A live battle vignette built from the finished assets — the proof that they play together.
//
// Party on the left (the Hero in any class plus five Champions), a wave of six of the chosen
// world's trash on the right with an elite among them, and every fourth wave that world's boss
// making its entrance. Both sides stand on the 3 front / 3 back formation grid, which the
// side-on camera shows as three ranks of two. Each unit runs the state machine the art is
// authored for:
//
//     IDLE → CHARGE → CAST → RECOVER → IDLE
//
// with the hit landing at the Cast boundary (the clip's `impact`). Hits spawn pooled
// particles and damage numbers; Hero and Champion casts play their ability VFX.
//
// Between waves the party marches: it holds its marks and plays its gait while the scenery
// parallax-scrolls past and the next wave closes in from the right edge.
//
// Every body is baked to frames at setup, so the 60 Hz update and the render allocate nothing:
// the loop only moves numbers and blits surfaces. The scene behind them is the one exception —
// it is drawn live each frame (~1 ms) because a baked strip is fixed at scroll 0 and could not
// parallax.

import { ANIM_FPS, Phase, phaseAt, type Clip } from './anim'
import { C, CLEAR } from './palette'
import { Surface, bayer } from './surface'
import { textOut } from './font'
import { Particles } from './particles'
import { artById, bake, type Baked } from './catalog'
import { HERO_ART } from './heroes'
import { CHASSIS } from './champions'
import { ENEMY_RIGS, ELITE_MARK, drawEliteMark, type EnemyWeapon } from './enemies'
import { NUMBER_STYLES, type NumberStyle } from './feedback'
import { VL } from './vfx-kit'
import { SW, SH, FLOOR_Y, SCROLL_PERIOD, WORLD_SCENES, reflectWater, type WorldScene } from './scenery'
import { CINEMATIC_BY_ID, type CinematicVfx } from './vfx-cinematic'
import { drawSkillBanner, tintLut, applyTint } from './presentation'
import { CLASS_BY_ID } from '../../../shared/utils/hero-quest/content/classes'
import { CHAMPION_BY_ID, CHAMPIONS } from '../../../shared/utils/hero-quest/content/champions'
import { WORLDS } from '../../../shared/utils/hero-quest/content/worlds'

export const DEMO_W = SW
export const DEMO_H = SH

/** VL (the VFX stage) is placed inside the scene so effects line up with bodies. */
const OX = 64
/**
 * The near rank stands a little below the scenery's floor line. That is what buys the ranks
 * their extra spacing without shoving the rear one up into the hedgerow, and the field runs
 * deep enough to take it.
 */
const BATTLE_FLOOR = FLOOR_Y + 4
const OY = BATTLE_FLOOR - VL.floor

/** A formation mark in VL space: `x` horizontal, `y` chest height, `g` the ground it stands on. */
type Mark = { readonly x: number, readonly y: number, readonly g: number }

/** Party size, and so the index in `units` where the enemy wave starts. */
const PARTY = 6

/** Which ally marks the Champions take: the Hero holds the near front mark, they take the rest. */
const CHAMP_MARKS = [0, 1, 3, 4, 5] as const

/**
 * How long the party runs between battles. The speed is derived so one march covers exactly one
 * SCROLL_PERIOD, which is what puts the scenery's framing pines back at the edges of the screen
 * by the time the next fight starts.
 */
const MARCH_DUR = 2.4
const MARCH_SPEED = SCROLL_PERIOD / MARCH_DUR

/** The scene ground lines the formation stands on, furthest rank first — the draw order. */
const RANK_Y = [...new Set(VL.foes.map(f => f.g))].sort((a, b) => a - b).map(g => OY + g)

const enum U { Idle, Attack, Cast, Hit, Death, Entry, Gone, Move }

interface Unit {
    side: 0 | 1
    x: number
    /** The ground this body stands on: the floor for the front rank, higher for the rear. */
    y: number
    /** Horizontal offset from the mark — how far a wave still has to close before the fight. */
    ox: number
    elite: boolean
    boss: boolean
    frames: Baked[] // indexed by U
    clips: (Clip | null)[] // phase source for Attack / Cast
    impact: number[] // seconds into Attack / Cast when the effect fires
    vfx: Baked | null // cast VFX
    state: U
    t: number
    wait: number
    fired: boolean
    hp: number
    phase: Phase
    /** Numbers stacked on this unit by the skill playing now. */
    stack: number
}

/** A Hero skill being presented: banner up, scene tinted, hits landing on its own clock. */
interface Cine { def: CinematicVfx, banner: string, lut: Uint8Array, t: number, next: number, first: Unit | null }

interface Fx { live: boolean, baked: Baked | null, t: number }
interface Num { live: boolean, x: number, y: number, t: number, style: NumberStyle, text: string, hold: boolean }

/** How long a stacked (held) number stays up, against 0.9 s for a rising one. */
const HOLD_LIFE = 1.8

const NUM_TEXT: Readonly<Record<string, readonly string[]>> = {
    normal: ['128', '96', '1.24K', '211', '87', '640'],
    crit: ['2.4K!', '8.61K!', '1.9K!'],
    heal: ['+356', '+120', '+88'],
    miss: ['MISS'],
    total: ['48.2K', '31.7K', '52.9K', '44.1K']
}

function frameAt(b: Baked, t: number): Surface {
    const n = b.frames.length
    let f = Math.floor(t * b.fps + 1e-6)
    f = b.loop ? f % n : Math.min(n - 1, f)
    return b.frames[f]!
}

function blitAt(dst: Surface, b: Baked, t: number, x: number, y: number, fade = 0, halo: number = CLEAR): void {
    const src = frameAt(b, t)
    const ox = Math.round(x) - b.ax
    const oy = Math.round(y) - b.ay
    const w = src.w
    if (halo !== CLEAR) {
        // the elite mark's gold ring: every empty pixel touching the sprite
        for (let sy = 0; sy < src.h; sy++) {
            for (let sx = 0; sx < w; sx++) {
                if (src.data[sy * w + sx] !== CLEAR) continue
                if (src.get(sx - 1, sy) === CLEAR && src.get(sx + 1, sy) === CLEAR && src.get(sx, sy - 1) === CLEAR && src.get(sx, sy + 1) === CLEAR) continue
                dst.set(ox + sx, oy + sy, halo)
            }
        }
    }
    for (let sy = 0; sy < src.h; sy++) {
        const yy = oy + sy
        if (yy < 0 || yy >= dst.h) continue
        for (let sx = 0; sx < w; sx++) {
            const c = src.data[sy * w + sx]!
            if (c === CLEAR) continue
            if (fade > 0 && bayer(sx, sy, fade)) continue
            const xx = ox + sx
            if (xx >= 0 && xx < dst.w) dst.data[yy * dst.w + xx] = c
        }
    }
}

export class BattleDemo {
    readonly frame = new Surface(DEMO_W, DEMO_H, 0, 0)
    private particles = new Particles(900)
    private scene: WorldScene | null = null
    private units: Unit[] = []
    private fx: Fx[] = Array.from({ length: 8 }, () => ({ live: false, baked: null, t: 0 }))
    private nums: Num[] = Array.from({ length: 24 }, () => ({ live: false, x: 0, y: 0, t: 0, style: NUMBER_STYLES[0]!, text: '', hold: false }))
    private heroCine: CinematicVfx | null = null
    private cine: Cine | null = null
    private water = -1
    private glitter = -1
    private time = 0
    private wave = 0
    private waveTimer = 0
    /** Seconds left in the march to the next battle; 0 when a fight is on. */
    private march = 0
    /** How far the world has travelled, in px — what every scenery layer parallaxes against. */
    private scroll = 0
    private numCursor = 0
    private world = 1
    private classId = 'class_beginner'
    private bossBaked: Baked[] = []
    private trash: Baked[][] = []
    private rigFrames: Baked[][] = []
    paused = false
    /** HUD label, rebuilt only when the wave changes — never inside the loop. */
    private label = ''
    private labels: string[] = []

    /** Rebuild for a world (1–10) and a Hero class. Bakes every frame the stage will show. */
    setup(world: number, classId: string): void {
        this.world = world
        this.classId = classId
        const w = WORLDS[world - 1]!
        this.scene = WORLD_SCENES[world - 1]!
        const hero = HERO_ART[classId]!
        const heroFrames = ['idle', 'attack', 'cast', 'hit', 'death', 'idle', 'move'].map(st => bake(artById(`hero/${classId}/${st}`)!))
        const skill = CLASS_BY_ID[classId as keyof typeof CLASS_BY_ID]!.skill.id
        const heroUnit = this.unit(0, VL.allies[2], heroFrames, [hero.clips.attack, hero.clips.cast], bake(artById(`vfx/${skill}`)!))
        this.heroCine = CINEMATIC_BY_ID[skill] ?? null
        this.cine = null
        const scene = WORLD_SCENES[world - 1]!
        this.water = scene.water ?? -1
        this.glitter = scene.glitter ?? -1
        // five Champions around the Hero, varied by world: the melee pair share his front rank,
        // the ranged three fall in behind — the archetypes' own default rows (§6).
        const pick = (arch: string, k: number) => CHAMPIONS.filter(c => c.archetype === arch)[(world * 3 + k) % 12]!.id
        const roster = [pick('tank', 1), pick('damage', 2), pick('support', 3), pick('control', 4), pick('damage', 5)]
        const champs = roster.map((id, i) => {
            const def = CHAMPION_BY_ID[id]!
            const frames = ['idle', 'attack', 'cast', 'hit', 'death', 'idle', 'move'].map(st => bake(artById(`champion/${id}/${st}`)!))
            const ability = def.abilities[0]!.id
            return this.unit(0, VL.allies[CHAMP_MARKS[i]!]!, frames, [CHASSIS[def.archetype].attack, CHASSIS[def.archetype].cast], bake(artById(`vfx/${ability}`)!))
        })
        // the world's trash on three rigs, the middle one elite
        const rigs: EnemyWeapon[] = ['sword', 'axe', 'staff', 'bow']
        this.trash = rigs.map(r => ['idle', 'attack', 'hit', 'death'].map(st => bake(artById(`enemy/${w.id}/${r}/${st}`)!)))
        this.bossBaked = ['idle', 'attack', 'hit', 'death', 'entry'].map(st => bake(artById(`boss/${w.id}/${st}`)!))
        // frame tables per rig, built once so a wave only swaps references
        this.rigFrames = this.trash.map(rig => [rig[0]!, rig[1]!, rig[1]!, rig[2]!, rig[3]!, rig[0]!, rig[0]!])
        const b = this.bossBaked
        const bossFrames = [b[0]!, b[1]!, b[1]!, b[2]!, b[3]!, b[4]!, b[0]!]
        // a fixed pool: a wave of six trash bodies and one boss, reset in place each wave
        const foes = [0, 1, 2, 3, 4, 5].map(i => this.unit(1, VL.foes[i]!, this.rigFrames[i % 4]!, [ENEMY_RIGS.sword.attack], null))
        const boss = this.unit(1, VL.foes[1], bossFrames, [], null, 6)
        boss.boss = true
        this.units = [heroUnit, ...champs, ...foes, boss]
        for (const u of [...foes, boss]) u.state = U.Gone
        const name = w.name.toUpperCase()
        this.labels = Array.from({ length: 99 }, (_, i) => `${name}  WAVE ${i + 1}`)
        this.wave = 0
        this.spawnWave()
        this.particles.clear()
        for (const f of this.fx) f.live = false
        for (const n of this.nums) n.live = false
    }

    private unit(side: 0 | 1, mark: Mark, frames: Baked[], clips: (Clip | null)[], vfx: Baked | null, dx = 0): Unit {
        const [idle, attack, cast, hit, death, entry, move] = frames
        return {
            side, x: OX + mark.x + dx, y: OY + mark.g, ox: 0, elite: false, boss: false,
            frames: [idle!, attack!, cast ?? attack!, hit!, death!, entry ?? idle!, idle!, move ?? idle!],
            clips: [null, clips[0] ?? null, clips[1] ?? null],
            impact: [0, clips[0]?.impact ?? 0.45 * attack!.frames.length / ANIM_FPS, clips[1]?.impact ?? 0.45 * (cast ?? attack!).frames.length / ANIM_FPS],
            vfx, state: U.Idle, t: 0, wait: 0.5 + Math.random() * 1.2, fired: false, hp: 4, phase: Phase.Idle, stack: 0
        }
    }

    private spawnWave(): void {
        const bossWave = this.wave % 4 === 3
        for (let i = PARTY; i < this.units.length; i++) {
            const u = this.units[i]!
            const active = u.boss ? bossWave : !bossWave
            u.state = active ? U.Entry : U.Gone
            u.t = 0
            u.fired = false
            u.wait = 0.5 + Math.random() * 1.2
            if (!u.boss && active) {
                const slot = i - PARTY
                u.frames = this.rigFrames[(slot + this.wave) % 4]!
                u.elite = slot === 1
                u.hp = u.elite ? 6 : 3
            }
            if (u.boss) u.hp = 10
        }
        this.wave++
        this.label = this.labels[(this.wave - 1) % this.labels.length]!
    }

    /**
     * Set off for the next battle. The party holds its marks and plays its gait while the world
     * scrolls past, and the wave spawns off the right edge to close as the ground is covered —
     * so the next pack is walked into rather than appearing out of nowhere.
     */
    private startMarch(): void {
        this.march = MARCH_DUR
        this.spawnWave()
        for (let i = 0; i < this.units.length; i++) {
            const u = this.units[i]!
            if (i < PARTY) {
                if (u.state === U.Gone) continue
                u.state = U.Move
                u.t = Math.random() * 0.4 // break the lockstep: six units on one cycle reads as a chorus line
            } else if (u.state !== U.Gone) {
                u.ox = MARCH_SPEED * MARCH_DUR
            }
        }
    }

    private endMarch(): void {
        this.march = 0
        for (let i = 0; i < this.units.length; i++) {
            const u = this.units[i]!
            u.ox = 0
            if (i < PARTY && u.state === U.Move) { u.state = U.Idle; u.t = 0; u.wait = 0.3 + Math.random() * 0.8 }
        }
    }

    private target(side: 0 | 1): Unit | null {
        for (let i = 0; i < this.units.length; i++) {
            const u = this.units[i]!
            if (u.side !== side && u.state !== U.Death && u.state !== U.Gone && u.state !== U.Entry) return u
        }
        return null
    }

    private number(x: number, y: number, kind: 'normal' | 'crit' | 'heal' | 'miss' | 'total', hold = false): void {
        const n = this.nums[this.numCursor]!
        this.numCursor = (this.numCursor + 1) % this.nums.length
        const list = NUM_TEXT[kind]!
        n.live = true; n.x = x; n.y = y; n.t = 0; n.hold = hold
        n.style = kind === 'normal' ? NUMBER_STYLES[0]! : kind === 'crit' || kind === 'total' ? NUMBER_STYLES[1]! : kind === 'heal' ? NUMBER_STYLES[2]! : NUMBER_STYLES[3]!
        n.text = list[Math.floor(Math.random() * list.length)]!
    }

    /** Start presenting the Hero's skill: the VFX runs from the first frame of the cast. */
    private startCine(def: CinematicVfx, u: Unit): void {
        u.fired = true // hits come from the skill's own clock, not the clip's impact
        this.playFx(u.vfx)
        for (let i = 0; i < this.units.length; i++) this.units[i]!.stack = 0
        this.cine = { def, banner: def.name.toUpperCase(), lut: tintLut(def.cinematic.tint), t: 0, next: 0, first: null }
    }

    /** One of the skill's impacts: damage the next target, stack its number, total at the end. */
    private cineHit(c: Cine, i: number): void {
        let n = 0
        for (let k = 0; k < this.units.length; k++) if (standing(this.units[k]!)) n++
        if (!n) return
        let pick = c.def.cinematic.spread ? i % n : 0
        let tgt = this.units[0]!
        for (let k = 0; k < this.units.length; k++) {
            const u = this.units[k]!
            if (standing(u) && pick-- === 0) { tgt = u; break }
        }
        if (!c.first) c.first = tgt
        const top = tgt.y - (tgt.boss ? 52 : 40)
        this.number(tgt.x, top - tgt.stack * 7, 'normal', true)
        tgt.stack++
        this.particles.burst(tgt.x, tgt.y - 14, 16, 80, 0.6, 'ember', 140, tgt.y)
        tgt.hp -= 2
        tgt.state = tgt.hp <= 0 ? U.Death : U.Hit
        tgt.t = 0
        if (i === c.def.cinematic.hits.length - 1) {
            const f = c.first
            this.number(f.x + 6, f.y - (f.boss ? 52 : 40) - f.stack * 7 - 4, 'total', true)
        }
    }

    private playFx(b: Baked | null): void {
        if (!b) return
        for (let i = 0; i < this.fx.length; i++) {
            const f = this.fx[i]!
            if (!f.live) { f.live = true; f.baked = b; f.t = 0; return }
        }
    }

    private strike(u: Unit, cast: boolean): void {
        const tgt = this.target(u.side)
        if (cast && u.vfx) this.playFx(u.vfx)
        if (!tgt) return
        const roll = Math.random()
        const y = tgt.y - (tgt.boss ? 30 : 14)
        if (roll < 0.08) { this.number(tgt.x, y - 8, 'miss'); return }
        const crit = cast || roll > 0.82
        this.number(tgt.x, y - 8, crit ? 'crit' : 'normal')
        this.particles.burst(tgt.x - (tgt.side ? 4 : -4), y, crit ? 14 : 8, crit ? 70 : 45, 0.5, tgt.side ? 'spark' : 'blood', 120, tgt.y)
        tgt.hp -= crit ? 2 : 1
        if (tgt.side === 0) tgt.hp = Math.max(1, tgt.hp) // the party doesn't die in the showcase
        tgt.state = tgt.hp <= 0 ? U.Death : U.Hit
        tgt.t = 0
        if (tgt.state === U.Death) this.particles.burst(tgt.x, tgt.y - 10, 18, 40, 0.8, 'dust', 60, tgt.y)
        if (u.side === 0 && Math.random() < 0.25) { const ally = this.units[0]!; this.number(ally.x - 16, ally.y - 30, 'heal') }
    }

    update(dt: number): void {
        if (this.paused) return
        this.time += dt
        for (let i = 0; i < this.units.length; i++) {
            const u = this.units[i]!
            u.t += dt
            const b = u.frames[u.state]!
            const dur = b.frames.length / b.fps
            switch (u.state) {
                case U.Idle:
                    u.phase = Phase.Idle
                    // everyone holds while a Hero skill has the stage
                    if (!this.cine && !this.march && u.t >= u.wait && this.target(u.side)) {
                        const cast = u.side === 0 ? Math.random() < 0.3 : false
                        u.state = cast ? U.Cast : U.Attack
                        u.t = 0
                        u.fired = false
                        if (cast && i === 0 && this.heroCine) this.startCine(this.heroCine, u)
                    }
                    break
                case U.Attack:
                case U.Cast: {
                    const clip = u.clips[u.state]
                    u.phase = clip ? phaseAt(clip, u.t) : (u.t < u.impact[u.state]! ? Phase.Charge : u.t < u.impact[u.state]! + 0.15 ? Phase.Cast : Phase.Recover)
                    if (!u.fired && u.t >= u.impact[u.state]!) { u.fired = true; this.strike(u, u.state === U.Cast) }
                    if (u.t >= dur) { u.state = U.Idle; u.t = 0; u.wait = (u.side ? 1.0 : 0.6) + Math.random() * 1.4 }
                    break
                }
                case U.Hit:
                    if (u.t >= dur) { u.state = U.Idle; u.t = 0; u.wait = 0.3 + Math.random() }
                    break
                case U.Death:
                    if (u.t >= dur) u.state = U.Gone
                    break
                case U.Entry:
                    if (u.t >= (u.boss ? dur : 0.6)) { u.state = U.Idle; u.t = 0 }
                    break
                case U.Move:
                case U.Gone:
                    break
            }
        }
        const c = this.cine
        if (c) {
            c.t += dt
            const hits = c.def.cinematic.hits
            while (c.next < hits.length && c.t >= hits[c.next]!) this.cineHit(c, c.next++)
            if (c.t >= c.def.dur + 0.3) this.cine = null
        }
        // march to the next battle once the pack is down
        if (this.march > 0) {
            this.march -= dt
            this.scroll += MARCH_SPEED * dt
            // The wave stands still in the world; it is the party closing the distance. Its
            // offset is just the ground still to cover, so it slides at exactly the scroll rate.
            const slide = Math.round(MARCH_SPEED * Math.max(0, this.march))
            for (let i = PARTY; i < this.units.length; i++) this.units[i]!.ox = slide
            if (this.march <= 0) this.endMarch()
        } else {
            let foes = 0
            for (let i = 0; i < this.units.length; i++) if (this.units[i]!.side === 1 && this.units[i]!.state !== U.Gone) foes++
            if (foes === 0) {
                this.waveTimer += dt
                if (this.waveTimer > 0.7) { this.waveTimer = 0; this.startMarch() }
            }
        }
        for (let i = 0; i < this.fx.length; i++) {
            const f = this.fx[i]!
            if (!f.live) continue
            f.t += dt
            if (f.t >= f.baked!.frames.length / f.baked!.fps) f.live = false
        }
        for (let i = 0; i < this.nums.length; i++) { const n = this.nums[i]!; if (!n.live) continue; n.t += dt; if (n.t > (n.hold ? HOLD_LIFE : 0.9)) n.live = false }
        this.particles.update(dt)
        // ambient: embers, dust — cosmetic
        if (Math.random() < 0.05) this.particles.spawn(Math.random() * DEMO_W, FLOOR_Y - 1, (Math.random() - 0.5) * 6, -8 - Math.random() * 10, 2.5, 'dust')
    }

    render(): Surface {
        const s = this.frame
        if (!this.scene) return s
        // Drawn live rather than blitted from a baked strip: a bake is fixed at scroll 0, and the
        // march needs every layer to parallax against `scroll`. Measured at ~1 ms, 6% of a frame.
        this.scene.draw(s, this.scroll, this.time)
        const c = this.cine
        if (c) {
            // the scene dims toward the skill's colour, stepping in and out through the dither
            const out = c.def.dur + 0.3 - c.t
            applyTint(s, c.lut, Math.min(16, Math.floor(Math.min(c.t / 0.2, out / 0.3) * 16)))
        }
        // Painter's order: furthest rank first, each nearer one drawn over it. Within a rank the
        // old right-to-left walk stands, so party and enemies overlap the way they always did.
        for (let r = 0; r < RANK_Y.length; r++) {
            const gy = RANK_Y[r]!
            for (let i = this.units.length - 1; i >= 0; i--) {
                const u = this.units[i]!
                if (u.state === U.Gone || u.y !== gy) continue
                const b = u.frames[u.state]!
                const fade = u.state === U.Entry && !u.boss ? Math.max(0, 16 - Math.floor(u.t * 30)) : 0
                blitAt(s, b, u.t, u.x + u.ox, u.y, fade, u.elite && u.state !== U.Death && fade === 0 ? ELITE_MARK : CLEAR)
                if (u.elite && u.state !== U.Death) drawEliteMark(s, u.x + u.ox, u.y - 36, this.time)
            }
        }
        for (let i = 0; i < this.fx.length; i++) { const f = this.fx[i]!; if (f.live) blitAt(s, f.baked!, f.t, OX, OY) }
        this.particles.draw(s)
        // standing water mirrors the fight, not just the scenery
        if (this.water >= 0) reflectWater(s, this.water, this.time, this.glitter)
        for (let i = 0; i < this.nums.length; i++) { const n = this.nums[i]!; if (n.live) drawNumber(s, n) }
        textOut(s, this.label, 6, 5, C.bone1, 'small', 1, 0, 1, C.ink, -1)
        if (c && c.t < c.def.dur) drawSkillBanner(s, c.banner, DEMO_W / 2, 14, c.t)
        return s
    }
}

/** An enemy that can still be hit. */
function standing(u: Unit): boolean {
    return u.side === 1 && u.state !== U.Death && u.state !== U.Gone && u.state !== U.Entry
}

function drawNumber(s: Surface, n: Num): void {
    const u = n.t / (n.hold ? HOLD_LIFE : 0.9)
    // a held number pops up 3px and stays put in its stack; a loose one floats away
    const rise = n.hold ? Math.min(3, Math.round(n.t * 30)) : Math.round((1 - (1 - u) * (1 - u)) * 14)
    if (u > 0.75 && (Math.floor(n.t * 10) & 1)) return
    textOut(s, n.text, n.x, n.y - rise, n.style.color, n.style.font, 1, 1, 2, n.style.shadow, n.style.bevel ?? -1)
}
