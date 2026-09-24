// A live battle vignette built from the finished assets — the proof that they play together.
//
// Party on the left (the Hero in any class plus two Champions), a pack of the chosen world's
// trash on the right with an elite in the middle, and every fourth wave that world's boss
// making its entrance. Each unit runs the state machine the art is authored for:
//
//     IDLE → CHARGE → CAST → RECOVER → IDLE
//
// with the hit landing at the Cast boundary (the clip's `impact`). Hits spawn pooled
// particles and damage numbers; Hero and Champion casts play their ability VFX.
//
// Everything is baked to frames at setup, so the 60 Hz update and the render allocate
// nothing: the loop only moves numbers and blits surfaces.

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
import { SW, SH, FLOOR_Y } from './scenery'
import { CLASS_BY_ID } from '../../../shared/utils/hero-quest/content/classes'
import { CHAMPION_BY_ID, CHAMPIONS } from '../../../shared/utils/hero-quest/content/champions'
import { WORLDS } from '../../../shared/utils/hero-quest/content/worlds'

export const DEMO_W = SW
export const DEMO_H = SH

/** VL (the VFX stage) is placed inside the scene so effects line up with bodies. */
const OX = 64
const OY = FLOOR_Y - VL.floor

const enum U { Idle, Attack, Cast, Hit, Death, Entry, Gone }

interface Unit {
    side: 0 | 1
    x: number
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
}

interface Fx { live: boolean, baked: Baked | null, t: number }
interface Num { live: boolean, x: number, y: number, t: number, style: NumberStyle, text: string }

const NUM_TEXT: Readonly<Record<string, readonly string[]>> = {
    normal: ['128', '96', '1.24K', '211', '87', '640'],
    crit: ['2.4K!', '8.61K!', '1.9K!'],
    heal: ['+356', '+120', '+88'],
    miss: ['MISS']
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
    private bg: Baked | null = null
    private units: Unit[] = []
    private fx: Fx[] = Array.from({ length: 8 }, () => ({ live: false, baked: null, t: 0 }))
    private nums: Num[] = Array.from({ length: 24 }, () => ({ live: false, x: 0, y: 0, t: 0, style: NUMBER_STYLES[0]!, text: '' }))
    private time = 0
    private wave = 0
    private waveTimer = 0
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
        this.bg = bake(artById(`bg/world/${w.id}`)!)
        const hero = HERO_ART[classId]!
        const heroFrames = ['idle', 'attack', 'cast', 'hit', 'death'].map(st => bake(artById(`hero/${classId}/${st}`)!))
        const skill = CLASS_BY_ID[classId as keyof typeof CLASS_BY_ID]!.skill.id
        const heroUnit = this.unit(0, OX + VL.allies[2].x, heroFrames, [hero.clips.attack, hero.clips.cast], bake(artById(`vfx/${skill}`)!))
        // two Champions: a support in the back, a damage dealer in the middle, varied by world
        const pick = (arch: string, k: number) => CHAMPIONS.filter(c => c.archetype === arch)[(world * 3 + k) % 12]!.id
        const champs = [pick('support', 1), pick('damage', 2)].map((id, i) => {
            const def = CHAMPION_BY_ID[id]!
            const frames = ['idle', 'attack', 'cast', 'hit', 'death'].map(st => bake(artById(`champion/${id}/${st}`)!))
            const ability = def.abilities[0]!.id
            return this.unit(0, OX + VL.allies[i]!.x, frames, [CHASSIS[def.archetype].attack, CHASSIS[def.archetype].cast], bake(artById(`vfx/${ability}`)!))
        })
        // the world's trash on three rigs, the middle one elite
        const rigs: EnemyWeapon[] = ['sword', 'axe', 'staff', 'bow']
        this.trash = rigs.map(r => ['idle', 'attack', 'hit', 'death'].map(st => bake(artById(`enemy/${w.id}/${r}/${st}`)!)))
        this.bossBaked = ['idle', 'attack', 'hit', 'death', 'entry'].map(st => bake(artById(`boss/${w.id}/${st}`)!))
        // frame tables per rig, built once so a wave only swaps references
        this.rigFrames = this.trash.map(rig => [rig[0]!, rig[1]!, rig[1]!, rig[2]!, rig[3]!, rig[0]!, rig[0]!])
        const b = this.bossBaked
        const bossFrames = [b[0]!, b[1]!, b[1]!, b[2]!, b[3]!, b[4]!, b[0]!]
        // a fixed pool: three trash bodies and one boss, reset in place each wave
        const foes = [0, 1, 2].map(i => this.unit(1, OX + VL.foes[i]!.x, this.rigFrames[i]!, [ENEMY_RIGS.sword.attack], null))
        const boss = this.unit(1, OX + VL.foes[1].x + 6, bossFrames, [], null)
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

    private unit(side: 0 | 1, x: number, frames: Baked[], clips: (Clip | null)[], vfx: Baked | null): Unit {
        const [idle, attack, cast, hit, death, entry] = frames
        return {
            side, x, elite: false, boss: false,
            frames: [idle!, attack!, cast ?? attack!, hit!, death!, entry ?? idle!, idle!],
            clips: [null, clips[0] ?? null, clips[1] ?? null],
            impact: [0, clips[0]?.impact ?? 0.45 * attack!.frames.length / ANIM_FPS, clips[1]?.impact ?? 0.45 * (cast ?? attack!).frames.length / ANIM_FPS],
            vfx, state: U.Idle, t: 0, wait: 0.5 + Math.random() * 1.2, fired: false, hp: 4, phase: Phase.Idle
        }
    }

    private spawnWave(): void {
        const bossWave = this.wave % 4 === 3
        for (let i = 3; i < this.units.length; i++) {
            const u = this.units[i]!
            const active = u.boss ? bossWave : !bossWave
            u.state = active ? U.Entry : U.Gone
            u.t = 0
            u.fired = false
            u.wait = 0.5 + Math.random() * 1.2
            if (!u.boss && active) {
                const slot = i - 3
                u.frames = this.rigFrames[(slot + this.wave) % 4]!
                u.elite = slot === 1
                u.hp = u.elite ? 6 : 3
            }
            if (u.boss) u.hp = 10
        }
        this.wave++
        this.label = this.labels[(this.wave - 1) % this.labels.length]!
    }

    private target(side: 0 | 1): Unit | null {
        for (let i = 0; i < this.units.length; i++) {
            const u = this.units[i]!
            if (u.side !== side && u.state !== U.Death && u.state !== U.Gone && u.state !== U.Entry) return u
        }
        return null
    }

    private number(x: number, y: number, kind: 'normal' | 'crit' | 'heal' | 'miss'): void {
        const n = this.nums[this.numCursor]!
        this.numCursor = (this.numCursor + 1) % this.nums.length
        const list = NUM_TEXT[kind]!
        n.live = true; n.x = x; n.y = y; n.t = 0
        n.style = kind === 'normal' ? NUMBER_STYLES[0]! : kind === 'crit' ? NUMBER_STYLES[1]! : kind === 'heal' ? NUMBER_STYLES[2]! : NUMBER_STYLES[3]!
        n.text = list[Math.floor(Math.random() * list.length)]!
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
        const y = FLOOR_Y - (tgt.boss ? 30 : 14)
        if (roll < 0.08) { this.number(tgt.x, y - 8, 'miss'); return }
        const crit = cast || roll > 0.82
        this.number(tgt.x, y - 8, crit ? 'crit' : 'normal')
        this.particles.burst(tgt.x - (tgt.side ? 4 : -4), y, crit ? 14 : 8, crit ? 70 : 45, 0.5, tgt.side ? 'spark' : 'blood', 120, FLOOR_Y)
        tgt.hp -= crit ? 2 : 1
        if (tgt.side === 0) tgt.hp = Math.max(1, tgt.hp) // the party doesn't die in the showcase
        tgt.state = tgt.hp <= 0 ? U.Death : U.Hit
        tgt.t = 0
        if (tgt.state === U.Death) this.particles.burst(tgt.x, FLOOR_Y - 10, 18, 40, 0.8, 'dust', 60, FLOOR_Y)
        if (u.side === 0 && Math.random() < 0.25) { const ally = this.units[0]!; this.number(ally.x - 16, FLOOR_Y - 30, 'heal') }
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
                    if (u.t >= u.wait && this.target(u.side)) {
                        const cast = u.side === 0 ? Math.random() < 0.3 : false
                        u.state = cast ? U.Cast : U.Attack
                        u.t = 0
                        u.fired = false
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
                case U.Gone:
                    break
            }
        }
        // next wave once the pack is down
        let foes = 0
        for (let i = 0; i < this.units.length; i++) if (this.units[i]!.side === 1 && this.units[i]!.state !== U.Gone) foes++
        if (foes === 0) {
            this.waveTimer += dt
            if (this.waveTimer > 1.0) { this.waveTimer = 0; this.spawnWave() }
        }
        for (let i = 0; i < this.fx.length; i++) {
            const f = this.fx[i]!
            if (!f.live) continue
            f.t += dt
            if (f.t >= f.baked!.frames.length / f.baked!.fps) f.live = false
        }
        for (let i = 0; i < this.nums.length; i++) { const n = this.nums[i]!; if (!n.live) continue; n.t += dt; if (n.t > 0.9) n.live = false }
        this.particles.update(dt)
        // ambient: embers, dust — cosmetic
        if (Math.random() < 0.05) this.particles.spawn(Math.random() * DEMO_W, FLOOR_Y - 1, (Math.random() - 0.5) * 6, -8 - Math.random() * 10, 2.5, 'dust')
    }

    render(): Surface {
        const s = this.frame
        if (!this.bg) return s
        s.data.set(frameAt(this.bg, this.time).data)
        // back row first: party right-to-left overlaps correctly, enemies left-to-right
        for (let i = this.units.length - 1; i >= 0; i--) {
            const u = this.units[i]!
            if (u.state === U.Gone) continue
            const b = u.frames[u.state]!
            const fade = u.state === U.Entry && !u.boss ? Math.max(0, 16 - Math.floor(u.t * 30)) : 0
            blitAt(s, b, u.t, u.x, FLOOR_Y, fade, u.elite && u.state !== U.Death && fade === 0 ? ELITE_MARK : CLEAR)
            if (u.elite && u.state !== U.Death) drawEliteMark(s, u.x, FLOOR_Y - 36, this.time)
        }
        for (let i = 0; i < this.fx.length; i++) { const f = this.fx[i]!; if (f.live) blitAt(s, f.baked!, f.t, OX, OY) }
        this.particles.draw(s)
        for (let i = 0; i < this.nums.length; i++) { const n = this.nums[i]!; if (n.live) drawNumber(s, n) }
        textOut(s, this.label, 6, 5, C.bone1, 'small', 1, 0, 1, C.ink, -1)
        return s
    }
}

function drawNumber(s: Surface, n: Num): void {
    const u = n.t / 0.9
    const rise = Math.round((1 - (1 - u) * (1 - u)) * 14)
    if (u > 0.75 && (Math.floor(n.t * 10) & 1)) return
    textOut(s, n.text, n.x, n.y - rise, n.style.color, n.style.font, 1, 1, 2, n.style.shadow, n.style.bevel ?? -1)
}
