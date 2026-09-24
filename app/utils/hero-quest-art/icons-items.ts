// Item icons (asset-list §3.2): 48 Artifacts — one per item, the Dig-site sells distinct
// relics — 36 Gear pieces, 18 currencies. Gear is icon-only (never shown on the Hero).

import { C } from './palette'
import type { Surface } from './surface'
import { M, sword, axe, shield, ShieldStyle, type Mat } from './weapons'
import { type Glyph, rect, px, line, disc, ring, tri, ellipse, ditherDisc, poly, arc } from './icon-kit'
import { ABILITY_ICON_PARTS as P } from './icons-abilities'

const R = Math.round

function gem(g: Surface, x: number, y: number, r: number, m: Mat): void {
    poly(g, [0, -r, r, 0, 0, r, -r, 0], x, y, m[1])
    poly(g, [0, -r, -r, 0, 0, 0], x, y, m[2])
    poly(g, [0, r, r, 0, 0, 0], x, y, m[0])
    px(g, x - 1, y - 1, C.white)
}

function scroll(g: Surface, x: number, y: number, paper: number, ink: number): void {
    rect(g, x - 6, y - 5, 12, 10, paper)
    rect(g, x - 7, y - 6, 2, 12, C.brown2); rect(g, x + 5, y - 6, 2, 12, C.brown2)
    for (let i = 0; i < 3; i++) line(g, x - 4, y - 3 + i * 3, x + 3, y - 3 + i * 3, ink)
}

function drum(g: Surface, x: number, y: number, body: number, skin: number): void {
    ellipse(g, x, y + 4, 7, 3, body)
    rect(g, x - 7, y - 3, 15, 7, body)
    ellipse(g, x, y - 3, 7, 3, skin)
    for (let i = 0; i < 4; i++) line(g, x - 6 + i * 4, y - 1, x - 4 + i * 4, y + 5, C.bone1)
}

// ── Artifacts ──────────────────────────────────────────────────────────────────────

export const ARTIFACT_ICONS: Readonly<Record<string, Glyph>> = {
    // Offense
    artifact_offense_0: (g, x, y) => { line(g, x - 6, y + 7, x + 3, y - 2, C.brown2, 3); disc(g, x + 4, y - 4, 4, C.brown1); px(g, x + 3, y - 7, C.steel3); px(g, x + 7, y - 4, C.steel3); px(g, x + 5, y - 1, C.steel3) }, // Goblin Cudgel
    artifact_offense_1: (g, x, y) => { poly(g, [-6, 3, -2, -6, 6, -3, 5, 5], x, y, C.stone2); line(g, x - 2, y - 5, x + 5, y - 3, C.stone3); P.sparkle(g, x + 6, y - 6, 2, C.gold3) }, // Tracker's Flint
    artifact_offense_2: (g, x, y) => { tri(g, x - 4, y - 7, x + 4, y - 7, x + 1, y + 8, C.bone1); line(g, x - 3, y - 6, x + 1, y + 6, C.white); rect(g, x - 4, y - 8, 9, 2, C.stone1); px(g, x, y - 7, C.lava1) }, // Slagjaw's Tooth
    artifact_offense_3: (g, x, y) => { drum(g, x, y, C.brown1, C.frost); px(g, x - 3, y - 4, C.white); line(g, x + 6, y - 9, x + 2, y - 4, C.bone1) }, // Frostbound War Drum
    artifact_offense_4: (g, x, y) => { tri(g, x - 6, y + 6, x + 6, y + 6, x, y - 8, C.gold2); tri(g, x - 3, y + 4, x + 3, y + 4, x, y - 4, C.gold3); line(g, x, y + 6, x, y + 9, C.brown2); px(g, x, y - 6, C.white) }, // Dawnbreak Arrowhead
    artifact_offense_5: (g, x, y) => { line(g, x - 5, y - 9, x - 5, y + 9, C.brown2, 2); poly(g, [0, 0, 11, 1, 8, 5, 11, 9, 0, 9], x - 4, y - 8, C.red1); P.skull(g, x + 1, y - 3, C.bone1) }, // Last Legion Standard
    artifact_offense_6: (g, x, y) => { axe(g, x - 5, y + 7, -0.9, 13, M.ice, M.darkwood, true); P.sparkle(g, x + 6, y - 6, 2, C.frost) }, // Hrimgar's Icebreaker
    artifact_offense_7: (g, x, y) => { ellipse(g, x, y, 8, 5, C.lava0); ellipse(g, x, y, 6, 4, C.orange); disc(g, x, y, 3, C.gold2); rect(g, x, y - 3, 1, 7, C.ink); px(g, x - 2, y - 2, C.white) }, // Eye of Pyrrhax
    artifact_offense_8: (g, x, y) => { for (let i = 0; i < 3; i++) arc(g, x - 2 + i * 3, y + 4, 8 - i, Math.PI * 1.2, Math.PI * 1.75, i === 1 ? C.bone1 : C.gold1); P.bolt(g, x + 3, y - 2, C.gold3, C.white) }, // Stormcrown Talon
    artifact_offense_9: (g, x, y) => { line(g, x - 6, y - 9, x - 6, y + 9, C.bone1, 2); poly(g, [0, 0, 12, 2, 10, 6, 12, 10, 0, 9], x - 5, y - 8, C.stone2); for (let i = 0; i < 3; i++) px(g, x - 1 + i * 3, y - 4, C.bone1) }, // Banner of the Bonefields
    artifact_offense_10: (g, x, y) => { ring(g, x, y, 8, C.purple2); ring(g, x, y, 7, C.lava1); P.flame(g, x, y + 2, 8, C.lava1, C.orange, C.gold3); px(g, x, y - 8, C.pink) }, // Ithren's Burning Sigil
    artifact_offense_11: (g, x, y) => { ring(g, x - 4, y - 4, 4, C.purple2); ring(g, x - 4, y - 4, 3, C.void); line(g, x - 1, y - 1, x + 7, y + 7, C.purple2, 2); rect(g, x + 3, y + 5, 3, 2, C.purple2); rect(g, x + 5, y + 3, 2, 3, C.purple2); px(g, x - 4, y - 4, C.white) }, // Key to the Last Door
    // Defense
    artifact_defense_0: (g, x, y) => { shield(g, x, y, ShieldStyle.Buckler, M.iron, M.nature, C.red2); disc(g, x, y, 7, C.stone1); disc(g, x, y, 6, C.green2); disc(g, x, y, 2, C.steel2); for (let i = 0; i < 6; i++) px(g, R(x + Math.cos(i) * 5), R(y + Math.sin(i) * 5), C.brown1) }, // Hedgeknight Buckler
    artifact_defense_1: (g, x, y) => { line(g, x, y - 9, x, y - 4, C.bone0); P.heart(g, x, y + 1, 3, C.olive1, C.olive2); for (let i = 0; i < 3; i++) line(g, x - 4 + i * 4, y + 5, x - 5 + i * 4, y + 9, C.brown1) }, // Mireroot Charm
    artifact_defense_2: (g, x, y) => { poly(g, [-5, 6, -7, -2, 0, -8, 7, -2, 4, 6], x, y, C.red1); poly(g, [-3, 4, -4, -1, 0, -5, 0, 4], x, y, C.orange); px(g, x - 2, y - 3, C.gold3) }, // Cinderscale Shard
    artifact_defense_3: (g, x, y) => { ellipse(g, x, y + 2, 7, 6, C.stone2); ellipse(g, x - 1, y + 1, 5, 4, C.stone3); P.flame(g, x, y - 1, 5, C.orange, C.gold2, C.white); rect(g, x - 5, y + 6, 11, 1, C.stone1) }, // Rimeholt Hearthstone
    artifact_defense_4: (g, x, y) => { arc(g, x, y - 5, 6, 0, Math.PI, C.gold1); disc(g, x, y + 3, 5, C.teal2); disc(g, x - 1, y + 2, 3, C.teal3); px(g, x - 2, y + 1, C.white); ring(g, x, y + 3, 5, C.gold1) }, // Tideglass Pendant
    artifact_defense_5: (g, x, y) => { P.potion(g, x, y, [C.red0, C.red1, C.red2]); px(g, x + 2, y + 3, C.olive2) }, // Mother Leech's Vial
    artifact_defense_6: (g, x, y) => { ellipse(g, x, y + 1, 8, 6, C.stone1); ellipse(g, x - 1, y, 6, 4, C.stone2); rect(g, x - 8, y + 1, 17, 1, C.gold1); P.skull(g, x, y - 1, C.bone1) }, // Grave Marshal's Pauldron
    artifact_defense_7: (g, x, y) => { disc(g, x, y, 8, C.brown1); disc(g, x, y, 6, C.brown2); for (let i = 0; i < 4; i++) arc(g, x, y, 2 + i * 1.5, 0, Math.PI * 2, C.brown1); disc(g, x, y, 2, C.green3); px(g, x, y, C.green4) }, // Rotheart Barkshield
    artifact_defense_8: (g, x, y) => { P.heart(g, x, y - 1, 4, C.cyan, C.frost); poly(g, [-2, -4, 0, -6, 2, -4], x - 3, y, C.white); line(g, x - 3, y - 2, x + 2, y + 4, C.blue1) }, // Glacier Titan's Heart
    artifact_defense_9: (g, x, y) => { ellipse(g, x, y + 3, 8, 4, C.teal1); arc(g, x, y + 2, 7, Math.PI, Math.PI * 2, C.teal2); disc(g, x, y + 1, 3, C.white); px(g, x - 1, y, C.frost); P.sparkle(g, x + 5, y - 5, 2, C.white) }, // Maerith's Pearl
    artifact_defense_10: (g, x, y) => { for (let i = 0; i < 5; i++) line(g, x - 7 + i * 3, y - 6 + (i === 2 ? -2 : 0), x - 8 + i * 4, y + 7, C.bone1, 2); P.skull(g, x, y - 4, C.white) }, // Ossuar's Bone Mantle
    artifact_defense_11: (g, x, y) => { rect(g, x - 7, y - 6, 14, 12, C.bone0); for (let i = 0; i < 5; i++) line(g, x - 6, y - 4 + i * 2, x + 6, y - 4 + i * 2, C.stone2); for (let i = 0; i < 3; i++) { disc(g, x - 3 + i * 3, y - 2 + i * 2, 1, C.ink); line(g, x - 2 + i * 3, y - 2 + i * 2, x - 2 + i * 3, y - 6 + i * 2, C.ink) } line(g, x + 3, y + 6, x + 6, y + 9, C.haze) }, // Vesper's Forgotten Hymn
    // Tempo
    artifact_tempo_0: (g, x, y) => { rect(g, x - 6, y + 2, 13, 3, C.brown2); line(g, x - 4, y + 2, x + 1, y - 5, C.brown1); line(g, x + 4, y + 2, x + 1, y - 5, C.brown1); for (let i = 0; i < 3; i++) px(g, x - 5 + i * 5, y + 1, C.green2) }, // Bramblefoot Sandals
    artifact_tempo_1: (g, x, y) => { P.hourglass(g, x, y, C.olive2); px(g, x - 6, y - 8, C.green2) }, // Marsh Hourglass
    artifact_tempo_2: (g, x, y) => { ellipse(g, x, y, 8, 3, C.stone1); ellipse(g, x, y, 7, 2, C.stone2); for (let i = 0; i < 4; i++) disc(g, x - 6 + i * 4, y + 1, 1.2, i & 1 ? C.orange : C.lava1) }, // Ashwalker Anklet
    artifact_tempo_3: (g, x, y) => { for (let i = 0; i < 10; i++) disc(g, x - 7 + i * 1.5, y - 4 + i * 0.9, 1 + i * 0.25, i < 8 ? C.bone1 : C.frost); ring(g, x + 7, y + 5, 3, C.bone0); px(g, x - 7, y - 4, C.white) }, // Frostbite Horn
    artifact_tempo_4: (g, x, y) => { tri(g, x - 6, y + 5, x + 6, y + 5, x, y - 7, C.gold1); disc(g, x, y - 4, 4, C.gold1); rect(g, x - 7, y + 5, 15, 2, C.gold2); disc(g, x, y + 8, 1.5, C.bone1); px(g, x - 2, y - 4, C.gold3); line(g, x, y - 8, x, y - 10, C.brown1) }, // Sailor's Distress Bell
    artifact_tempo_5: (g, x, y) => { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; disc(g, x + Math.cos(a) * 7, y + Math.sin(a) * 6, 1.2, i === 0 ? C.gold2 : C.purple1) } rect(g, x - 1, y + 6, 3, 4, C.purple2) }, // Acolyte's Prayer Beads
    artifact_tempo_6: (g, x, y) => { ring(g, x - 1, y - 1, 6, C.gold1); disc(g, x - 1, y - 1, 5, C.purple0); ditherDisc(g, x - 1, y - 1, 5, C.pink, 4); px(g, x - 3, y - 3, C.white); line(g, x + 3, y + 3, x + 8, y + 8, C.gold1, 2) }, // Halvane's Spellglass
    artifact_tempo_7: (g, x, y) => { drum(g, x, y, C.red1, C.bone1); line(g, x - 3, y - 9, x - 1, y - 4, C.bone1, 2); line(g, x + 5, y - 9, x + 2, y - 4, C.bone1, 2) }, // Korr's Marching Drum
    artifact_tempo_8: (g, x, y) => { tri(g, x - 6, y + 6, x + 6, y + 6, x, y - 8, C.cyan); tri(g, x - 6, y + 6, x, y + 6, x, y - 8, C.frost); for (let i = 0; i < 3; i++) line(g, x + 3, y, x + 9, y - 3 + i * 3, [C.red2, C.gold3, C.teal3][i]!) }, // Skyshard Prism
    artifact_tempo_9: (g, x, y) => { line(g, x - 7, y + 7, x + 6, y - 6, C.bone1, 2); for (let i = 0; i < 5; i++) line(g, x - 5 + i * 3, y + 5 - i * 3, x - 5 + i * 3 + 4, y + 5 - i * 3 + 3, C.haze) }, // Zephyrax Wingbone
    artifact_tempo_10: (g, x, y) => { rect(g, x - 4, y - 7, 9, 2, C.brown2); rect(g, x - 4, y + 5, 9, 2, C.brown2); rect(g, x - 3, y - 5, 7, 10, C.pink); for (let i = 0; i < 4; i++) line(g, x - 3, y - 4 + i * 3, x + 3, y - 3 + i * 3, C.haze); line(g, x + 4, y, x + 9, y + 6, C.pink) }, // Fraying Thread
    artifact_tempo_11: (g, x, y) => { disc(g, x, y, 8, C.void); ring(g, x, y, 8, C.purple2); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; px(g, R(x + Math.cos(a) * 6), R(y + Math.sin(a) * 6), C.haze) } line(g, x, y, x, y - 5, C.white); line(g, x, y, x + 3, y + 2, C.pink) }, // Herald's Stopped Clock
    // Fortune
    artifact_fortune_0: (g, x, y) => { disc(g, x, y, 7, C.brown2); disc(g, x - 0.5, y - 0.5, 6, C.orange); ring(g, x, y, 4, C.brown2); px(g, x - 2, y - 3, C.gold3) }, // Thornwick Copper
    artifact_fortune_1: (g, x, y) => { P.book(g, x, y, C.green1, C.bone1); px(g, x - 3, y - 1, C.green3); px(g, x + 3, y + 1, C.green3) }, // Hedge-Witch Almanac
    artifact_fortune_2: (g, x, y) => { rect(g, x - 4, y - 5, 9, 11, C.stone1); rect(g, x - 3, y - 4, 7, 9, C.teal1); disc(g, x, y, 2, C.teal3); px(g, x, y, C.white); line(g, x - 3, y - 9, x + 3, y - 9, C.stone2); line(g, x - 3, y - 9, x - 4, y - 5, C.stone2); line(g, x + 3, y - 9, x + 4, y - 5, C.stone2) }, // Mirewood Night Lantern
    artifact_fortune_3: (g, x, y) => { line(g, x - 6, y + 7, x + 3, y - 3, C.brown2, 2); arc(g, x + 3, y - 3, 7, Math.PI * 1.05, Math.PI * 1.95, C.stone3); arc(g, x + 3, y - 2, 6, Math.PI * 1.1, Math.PI * 1.9, C.steel2); P.sparkle(g, x + 7, y + 4, 2, C.gold3) }, // Kobold Prospecting Pick
    artifact_fortune_4: (g, x, y) => { poly(g, [-5, 8, -6, -3, 0, -8, 6, -3, 5, 8], x, y, C.stone2); for (const [a, b, c2, d2] of [[-2, -4, 2, 0], [-2, 0, 2, -4], [0, 1, 0, 6]]) line(g, x + a!, y + b!, x + c2!, y + d2!, C.cyan) }, // Rimeholt Saga Stone
    artifact_fortune_5: (g, x, y) => { P.book(g, x, y, C.teal1, C.bone1); arc(g, x - 3, y + 1, 2, Math.PI, Math.PI * 2, C.teal2); arc(g, x + 3, y + 1, 2, Math.PI, Math.PI * 2, C.teal2) }, // Amarath Tide Ledger
    artifact_fortune_6: (g, x, y) => { disc(g, x, y, 7, C.gold1); disc(g, x - 0.5, y - 0.5, 6, C.gold2); P.skull(g, x, y, C.gold1); ditherDisc(g, x + 2, y + 2, 4, C.teal2, 4) }, // Sunken Doubloon
    artifact_fortune_7: (g, x, y) => { scroll(g, x, y, C.night2, C.night3); for (const [a, b] of [[-3, -2], [1, -3], [3, 1], [-1, 2]]) px(g, x + a!, y + b!, C.gold3); line(g, x - 3, y - 2, x + 1, y - 3, C.haze) }, // Duskspire Star Chart
    artifact_fortune_8: (g, x, y) => { line(g, x - 5, y - 8, x + 2, y + 2, C.brown2, 2); poly(g, [0, 0, 6, 0, 6, 5, 3, 8, 0, 5], x, y, C.steel2); line(g, x + 1, y + 1, x + 1, y + 5, C.steel3); P.skull(g, x - 5, y + 4, C.bone0) }, // Grave Robber's Spade
    artifact_fortune_9: (g, x, y) => { P.book(g, x, y, C.purple1, C.bone1); rect(g, x + 1, y - 3, 6, 8, C.bone1); line(g, x + 2, y + 5, x + 7, y + 8, C.bone1); P.sparkle(g, x + 7, y - 7, 2, C.gold3) }, // Tome of Unfinished Lessons
    artifact_fortune_10: (g, x, y) => { poly(g, [-8, 5, 8, 5, 5, 0, -5, 0], x, y + 1, C.stone2); for (const [a, b] of [[-4, 0], [0, -2], [4, 0], [-2, -4], [2, -5]]) disc(g, x + a!, y + b!, 2, C.gold2); P.sparkle(g, x, y - 8, 2, C.frost) }, // Hoard of the Shattered Sky
    artifact_fortune_11: (g, x, y) => { disc(g, x, y, 7, C.void); ring(g, x, y, 7, C.purple2); ring(g, x, y, 5, C.purple1); for (let i = 0; i < 4; i++) px(g, x - 2 + (i * 3) % 5, y - 2 + i, C.white); line(g, x - 3, y + 4, x + 4, y - 3, C.pink) } // Last Coin of the Void
}

// ── Gear: six slots × six tiers ────────────────────────────────────────────────────

const TIER_METAL: readonly Mat[] = [M.iron, M.steel, M.steel, [C.purple0, C.steel2, C.steel3], M.gold, [C.red1, C.gold2, C.gold3]]
const TIER_TRIM: readonly Mat[] = [M.leather, M.leather, [C.blue0, C.blue1, C.blue2], [C.purple0, C.purple1, C.purple2], [C.gold0, C.gold1, C.gold3], [C.red0, C.red2, C.red3]]
const TIER_GEM: readonly number[] = [-1, -1, C.blue2, C.pink, C.cyan, C.white]

function gearGem(g: Surface, x: number, y: number, tier: number): void {
    if (TIER_GEM[tier]! >= 0) { disc(g, x, y, 1.5, TIER_GEM[tier]!); px(g, x, y, C.white) }
}

function gearWeapon(tier: number): Glyph {
    return (g, x, y) => {
        const m = TIER_METAL[tier]!
        sword(g, x - 6, y + 7, -0.8, 11 + tier, m, TIER_TRIM[tier]!, tier < 2 ? C.brown1 : TIER_TRIM[tier]![0], tier >= 3)
        if (tier >= 4) for (let i = 0; i < 3; i++) px(g, x + 1 + i * 2, y - 2 - i * 2, C.white)
        gearGem(g, x - 4, y + 5, tier)
    }
}
function gearBoots(tier: number): Glyph {
    return (g, x, y) => {
        const m = tier < 2 ? M.leather : TIER_METAL[tier]!
        rect(g, x - 4, y - 7, 6, 11, m[1]); rect(g, x - 4, y + 3, 11, 4, m[1]); rect(g, x - 4, y + 7, 12, 1, m[0])
        rect(g, x - 3, y - 7, 1, 10, m[2]); rect(g, x - 5, y - 7, 8, 2, TIER_TRIM[tier]![1])
        if (tier >= 3) { tri(g, x + 2, y - 5, x + 2, y - 1, x + 6, y - 6, TIER_TRIM[tier]![2]) } // wing
        gearGem(g, x - 1, y - 6, tier)
    }
}
function gearGauntlets(tier: number): Glyph {
    return (g, x, y) => {
        const m = tier === 0 ? M.leather : TIER_METAL[tier]!
        rect(g, x - 5, y - 1, 10, 8, m[1]); rect(g, x - 5, y - 1, 10, 1, m[2])
        for (let i = 0; i < 4; i++) rect(g, x - 5 + i * 3, y - 6 + (i === 0 ? 3 : 0), 2, 6, m[1])
        rect(g, x - 6, y + 5, 12, 3, TIER_TRIM[tier]![1])
        if (tier >= 2) for (let i = 0; i < 4; i++) px(g, x - 5 + i * 3, y - 1, m[2])
        gearGem(g, x, y + 2, tier)
    }
}
function gearCharm(tier: number): Glyph {
    return (g, x, y) => {
        arc(g, x, y + 1, 6, Math.PI * 1.08, Math.PI * 1.92, tier < 2 ? C.brown2 : C.gold1)
        const m = TIER_METAL[tier]!
        if (tier < 2) { disc(g, x, y + 3, 4, tier === 0 ? C.bone1 : C.steel2); px(g, x, y + 3, C.ink) } else gem(g, x, y + 3, 4 + (tier >> 1), [m[0], TIER_TRIM[tier]![1], TIER_TRIM[tier]![2]])
        if (tier >= 4) ring(g, x, y + 3, 6 + (tier - 4), C.gold2)
    }
}
function gearArmor(tier: number): Glyph {
    return (g, x, y) => {
        const m = tier === 0 ? M.leather : TIER_METAL[tier]!
        poly(g, [-7, -7, -3, -8, 0, -6, 3, -8, 7, -7, 6, 7, -6, 7], x, y, m[1])
        line(g, x - 6, y - 7, x - 5, y + 7, m[2])
        rect(g, x - 1, y - 5, 3, 11, TIER_TRIM[tier]![1])
        rect(g, x - 6, y + 3, 12, 1, m[0])
        if (tier >= 2) { rect(g, x - 9, y - 8, 4, 4, m[2]); rect(g, x + 6, y - 8, 4, 4, m[2]) }
        gearGem(g, x, y - 1, tier)
    }
}
function gearHelmet(tier: number): Glyph {
    return (g, x, y) => {
        const m = TIER_METAL[tier]!
        ellipse(g, x, y, 7, 7, m[1]); rect(g, x - 7, y, 15, 7, m[1])
        rect(g, x - 7, y, 15, 1, m[0]); rect(g, x - 3, y + 2, 9, 2, C.ink)
        px(g, x - 3, y - 4, m[2]); px(g, x - 2, y - 5, m[2])
        if (tier >= 1) rect(g, x, y + 2, 1, 5, m[2])
        if (tier >= 2) for (let i = 0; i < 3; i++) line(g, x - 1 + i, y - 7, x - 4 + i * 3, y - 11, TIER_TRIM[tier]![1])
        if (tier >= 4) { tri(g, x - 8, y - 2, x - 6, y, x - 11, y - 7, C.white); tri(g, x + 8, y - 2, x + 6, y, x + 11, y - 7, C.white) }
        gearGem(g, x, y - 2, tier)
    }
}

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const
const SLOT_DRAW = { weapon: gearWeapon, boots: gearBoots, gauntlets: gearGauntlets, charm: gearCharm, armor: gearArmor, helmet: gearHelmet } as const

export const GEAR_ICONS: Readonly<Record<string, Glyph>> = Object.fromEntries(
    (Object.keys(SLOT_DRAW) as (keyof typeof SLOT_DRAW)[]).flatMap(slot => RARITIES.map((r, tier) => [`gear_${slot}_${r}`, SLOT_DRAW[slot](tier)]))
)

// ── Currencies (16×16) ─────────────────────────────────────────────────────────────

function seal(g: Surface, x: number, y: number, m: Mat, mark: (g: Surface, x: number, y: number) => void): void {
    disc(g, x, y, 6, m[0])
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; disc(g, x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5, 1.3, m[0]) }
    disc(g, x - 0.5, y - 0.5, 4.5, m[1])
    mark(g, x, y)
    px(g, x - 3, y - 3, m[2])
}
function essence(g: Surface, x: number, y: number, m: Mat): void {
    tri(g, x - 4, y + 1, x + 4, y + 1, x, y - 7, m[1])
    disc(g, x, y + 2, 4, m[1])
    disc(g, x - 1, y + 1, 2, m[2]); px(g, x - 1, y, C.white)
    px(g, x + 3, y - 5, m[2]); px(g, x - 4, y - 3, m[2])
}
function key(g: Surface, x: number, y: number, m: Mat): void {
    ring(g, x - 3, y - 3, 3, m[1]); ring(g, x - 3, y - 3, 2, m[0])
    line(g, x - 1, y - 1, x + 5, y + 5, m[1], 2)
    rect(g, x + 2, y + 4, 2, 2, m[1]); rect(g, x + 4, y + 2, 2, 2, m[1])
    px(g, x - 4, y - 5, m[2])
}

const SKILL_M: Mat = [C.blue0, C.blue1, C.blue2]
const CHAMP_M: Mat = [C.red0, C.red1, C.red3]
const GEAR_M: Mat = [C.lava0, C.orange, C.gold2]
const ARTI_M: Mat = [C.teal0, C.teal2, C.teal3]

export const CURRENCY_ICONS: Readonly<Record<string, Glyph>> = {
    gold: (g, x, y) => { disc(g, x, y, 6, C.gold1); disc(g, x - 0.5, y - 0.5, 5, C.gold2); rect(g, x - 1, y - 3, 2, 6, C.gold1); px(g, x - 3, y - 3, C.gold3); px(g, x - 2, y - 4, C.white) },
    gems: (g, x, y) => gem(g, x, y, 6, [C.blue1, C.cyan, C.frost]),
    void_shards: (g, x, y) => { poly(g, [0, -7, 4, -1, 1, 7, -4, 2], x, y, C.purple1); poly(g, [0, -7, -4, 2, 0, 1], x, y, C.purple2); px(g, x - 1, y - 3, C.pink); px(g, x + 2, y - 5, C.white) },
    seal_skill: (g, x, y) => seal(g, x, y, SKILL_M, (gg, cx, cy) => { rect(gg, cx - 2, cy - 2, 4, 4, C.bone1); px(gg, cx - 1, cy - 1, C.blue1) }),
    seal_champion: (g, x, y) => seal(g, x, y, CHAMP_M, (gg, cx, cy) => { rect(gg, cx - 2, cy - 2, 4, 4, C.gold2); rect(gg, cx - 1, cy, 3, 1, C.ink) }),
    seal_gear: (g, x, y) => seal(g, x, y, GEAR_M, (gg, cx, cy) => { rect(gg, cx - 3, cy - 1, 6, 2, C.stone1); rect(gg, cx - 1, cy + 1, 2, 2, C.stone1) }),
    seal_artifact: (g, x, y) => seal(g, x, y, ARTI_M, (gg, cx, cy) => { ellipse(gg, cx, cy, 3, 1, C.white); px(gg, cx, cy, C.ink) }),
    essence_skill: (g, x, y) => essence(g, x, y, SKILL_M),
    essence_champion: (g, x, y) => essence(g, x, y, CHAMP_M),
    essence_gear: (g, x, y) => essence(g, x, y, GEAR_M),
    essence_artifact: (g, x, y) => essence(g, x, y, ARTI_M),
    trait_gems: (g, x, y) => { poly(g, [-3, -6, 3, -6, 6, 0, 3, 6, -3, 6, -6, 0], x, y, C.purple1); poly(g, [-2, -4, 2, -4, 4, 0, 2, 4, -2, 4, -4, 0], x, y, C.pink); px(g, x - 1, y - 2, C.white) },
    key_guild: (g, x, y) => key(g, x, y, CHAMP_M),
    key_training_grounds: (g, x, y) => key(g, x, y, SKILL_M),
    key_dig_site: (g, x, y) => key(g, x, y, ARTI_M),
    key_forge: (g, x, y) => key(g, x, y, GEAR_M),
    key_trait: (g, x, y) => key(g, x, y, [C.purple0, C.pink, C.white]),
    arena_medals: (g, x, y) => { tri(g, x - 4, y - 7, x, y - 7, x - 1, y, C.red1); tri(g, x, y - 7, x + 4, y - 7, x + 1, y, C.blue1); disc(g, x, y + 3, 4, C.gold1); disc(g, x - 0.5, y + 2.5, 3, C.gold2); px(g, x - 1, y + 2, C.white) }
}

export const CURRENCY_LABELS: Readonly<Record<string, string>> = {
    gold: 'Gold', gems: 'Gems', void_shards: 'Void Shards',
    seal_skill: 'Skill Seal', seal_champion: 'Champion Seal', seal_gear: 'Gear Seal', seal_artifact: 'Artifact Seal',
    essence_skill: 'Skill Essence', essence_champion: 'Champion Essence', essence_gear: 'Gear Essence', essence_artifact: 'Artifact Essence',
    trait_gems: 'Trait Gems',
    key_guild: 'Guild Raid Key', key_training_grounds: 'Training Grounds Raid Key', key_dig_site: 'Dig-site Raid Key', key_forge: 'Forge Raid Key', key_trait: 'Trait Raid Key',
    arena_medals: 'Arena Medals'
}

