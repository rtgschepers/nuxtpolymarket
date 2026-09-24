// Every pixel Hero Quest's art draws comes from this palette. Surfaces store a palette
// *index* per pixel, never a colour, so an off-palette pixel is unrepresentable.
//
// Built on Pixel Crusade's palette (the style guide) with the ramps Hero Quest's ten worlds
// need on top: teal for drowned places, olive for rot, frost for ice. Index 0 is reserved
// for "transparent", so C.x is always >= 1.

const HEX = {
    ink: '#0d0a14',
    void: '#171326',
    night0: '#1f1a38',
    night1: '#2c2854',
    night2: '#433d7a',
    night3: '#6461a8',
    haze: '#9a93c9',

    white: '#ffffff',
    steel0: '#3a3f52',
    steel1: '#62697f',
    steel2: '#9aa4bb',
    steel3: '#d6deec',

    skin0: '#7d4430',
    skin1: '#c47a55',
    skin2: '#efb58c',

    red0: '#4a1220',
    red1: '#8f2233',
    red2: '#d8404a',
    red3: '#ff7b6b',
    orange: '#f07a2a',
    gold0: '#7a4f14',
    gold1: '#c98c26',
    gold2: '#f5c542',
    gold3: '#fff09a',

    green0: '#132b1d',
    green1: '#23532f',
    green2: '#3f8f3e',
    green3: '#7cc653',
    green4: '#c4f07a',

    brown0: '#28180f',
    brown1: '#4c2e1b',
    brown2: '#7a4d2c',
    brown3: '#ae7c4c',

    blue0: '#142654',
    blue1: '#2350a6',
    blue2: '#3f8ee6',
    cyan: '#7fe8ff',
    frost: '#c8f4ff',

    teal0: '#0f3a3f',
    teal1: '#1d6b6b',
    teal2: '#36a39a',
    teal3: '#7ad6c2',

    olive0: '#2f3317',
    olive1: '#5c5e2a',
    olive2: '#8f8a45',

    purple0: '#2e1446',
    purple1: '#5a2482',
    purple2: '#9848d0',
    pink: '#f08ad8',

    bone0: '#8f8570',
    bone1: '#d9ceb0',

    stone0: '#1f1e29',
    stone1: '#363447',
    stone2: '#55526a',
    stone3: '#7c7892',

    lava0: '#9c1e10',
    lava1: '#ff4d1a'
} as const

export type ColorName = keyof typeof HEX

/** Palette hex by index. PALETTE[0] is the transparent sentinel and is never painted. */
export const PALETTE: readonly string[] = ['#00000000', ...Object.values(HEX)]

/** Packed 0xRRGGBB by index, for the PNG exporter and ImageData writes. */
export const PALETTE_RGB: Uint32Array = Uint32Array.from(PALETTE.map((h, i) => i === 0 ? 0 : parseInt(h.slice(1, 7), 16)))

/** Named colour → palette index. */
export const C = Object.fromEntries(Object.keys(HEX).map((k, i) => [k, i + 1])) as Record<ColorName, number>

/** Transparent. Drawing with it erases. */
export const CLEAR = 0

// ── Ramps ──────────────────────────────────────────────────────────────────────────
// A particle walks a ramp from its first entry to its last over its life, and a recolor
// maps one ramp onto another. Each is dark-to-light or light-to-dark as noted.

function ramp(...names: ColorName[]): Uint8Array {
    return Uint8Array.from(names.map(n => C[n]))
}

/** Particle ramps, bright → dark (a spark cools as it dies). */
export const RAMP = {
    spark: ramp('white', 'gold3', 'gold2', 'orange', 'red1', 'brown1'),
    steel: ramp('white', 'steel3', 'steel2', 'steel1', 'steel0'),
    fire: ramp('white', 'gold3', 'gold2', 'orange', 'lava1', 'red1', 'red0'),
    holy: ramp('white', 'gold3', 'gold2', 'gold1', 'gold0'),
    arcane: ramp('white', 'cyan', 'pink', 'purple2', 'purple1', 'purple0'),
    frost: ramp('white', 'frost', 'cyan', 'blue2', 'blue1', 'blue0'),
    nature: ramp('white', 'green4', 'green3', 'green2', 'green1'),
    poison: ramp('green4', 'green3', 'olive2', 'olive1', 'olive0'),
    water: ramp('white', 'teal3', 'teal2', 'teal1', 'teal0'),
    bone: ramp('white', 'bone1', 'bone0', 'stone2', 'stone1'),
    blood: ramp('red3', 'red2', 'red1', 'red0'),
    dust: ramp('stone3', 'stone2', 'stone1', 'stone0'),
    ash: ramp('bone0', 'stone3', 'stone2', 'stone1'),
    ember: ramp('gold3', 'orange', 'lava1', 'lava0', 'stone1'),
    shadow: ramp('pink', 'purple2', 'purple1', 'purple0', 'void'),
    storm: ramp('white', 'frost', 'cyan', 'haze', 'night3', 'night2'),
    gold: ramp('white', 'gold3', 'gold2', 'gold1', 'gold0'),
    heal: ramp('white', 'green4', 'green3', 'teal2', 'teal1'),
    void: ramp('pink', 'purple2', 'night2', 'purple0', 'void', 'ink')
} as const

export type RampName = keyof typeof RAMP
export const RAMP_NAMES = Object.keys(RAMP) as RampName[]

/**
 * Rarity ladder colours (`gacha-shared-system.md` §1: Common gray → Mythic red). Each is
 * [shade, base, light] so a frame can bevel.
 */
export const RARITY_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
    common: [C.steel0, C.steel1, C.steel2],
    uncommon: [C.green1, C.green2, C.green3],
    rare: [C.blue0, C.blue1, C.blue2],
    epic: [C.purple0, C.purple1, C.purple2],
    legendary: [C.gold0, C.gold1, C.gold2],
    mythic: [C.red0, C.red1, C.red2]
}

/**
 * Trait grades F → SSS. `traits.md` locks these as their own nine-colour ramp, independent
 * of the rarity ladder — so none of these bases is a rarity base above.
 */
export const TRAIT_GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'] as const
export type TraitGrade = typeof TRAIT_GRADES[number]
export const TRAIT_GRADE_COLORS: Readonly<Record<TraitGrade, readonly [number, number, number]>> = {
    F: [C.stone1, C.stone2, C.stone3],
    E: [C.brown1, C.brown2, C.brown3],
    D: [C.olive0, C.olive1, C.olive2],
    C: [C.teal0, C.teal1, C.teal2],
    B: [C.teal1, C.teal2, C.teal3],
    A: [C.night2, C.night3, C.haze],
    S: [C.gold1, C.gold2, C.gold3],
    SS: [C.lava0, C.orange, C.gold3],
    SSS: [C.purple1, C.pink, C.white]
}
