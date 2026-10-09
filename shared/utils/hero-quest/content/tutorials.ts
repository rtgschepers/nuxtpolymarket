/**
 * The guide's lines (`tutorials.ts`). **Mossimer** is a snail who keeps the Chronicle: every run
 * any hero has made toward the Void is written into the turns of its shell. When a run is beaten
 * the Void folds the world back to Thornwick Vale and forgets it ever happened, but a snail carries
 * everything it owns, so the Chronicle comes through every prestige intact. That is why it can
 * guide you: it has watched this road walked more times than anyone. Unhurried, warm, a little
 * wry about its pace (the user's call on a snail, 2026-10-09; the name and lore, 2026-10-09).
 *
 * Each tutorial is a few short pages, read one at a time. Nothing numeric is written into a line, so
 * a retuned constant can't leave the guide saying the old number.
 *
 * Display only: saves reference the tutorial IDs, never the text.
 */

import type { TutorialId } from '../tutorials'

/** Display only, so a rename touches no save. */
export const GUIDE_NAME = 'Mossimer'

export const TUTORIAL_PAGES: Readonly<Record<TutorialId, readonly string[]>> = {
    'intro': [
        'Ah, a new hero. I\'m Mossimer, keeper of the Chronicle. Don\'t mind the pace.',
        'Every hero who ever marched on the Void is written in my shell. You\'re next.',
        'Your party fights on its own, even while you\'re away. Come back and collect.',
        'Bosses are different. They only fight while you\'re watching. Glory wants a witness.',
        'Off you go, then. I\'ll catch up. Eventually.'
    ],

    'gacha:unlock': ['Bosses are a different breed. Time to find some help: the Gacha is open.'],
    'gacha:visit': [
        'Four shrines, four gachas: Gear, Champions, Skills and Artifacts.',
        'Feed one Seals and it gives something back. Some days, something wonderful.',
        'A few free 10-pulls come round each day. Short on Seals? A pull buys them with Gold.'
    ],

    'collections:unlock': ['Everything you pull is kept in your Collections. I do like a tidy hoard.'],
    'collections:visit': [
        'Equip Gear, Skills and Artifacts here, and choose which Champions march with you.',
        'A duplicate levels up the copy you own. In my experience, nothing is ever wasted.',
        'Even what you leave on the shelf lends you a little strength.'
    ],

    'milestones:unlock': ['A whole World cleared! That earns a line in the Chronicle. Milestones are open.'],
    'milestones:visit': [
        'Every deed worth writing down is counted here: Worlds, prestiges, raids, collections.',
        'The tracks never end and nothing expires. Claim whenever you like. I never rush.'
    ],

    'calendar:unlock': ['The Calendar is open. Visit once a day and I\'ll have something for you.'],
    'calendar:visit': [
        'One gift a day, and the cycle builds to a grand one at the end.',
        'Missed a day? It happens to the best of us. A few make-ups a cycle let you claim late.'
    ],

    'loadouts:unlock': ['Two Worlds behind you. Time to plan ahead: Loadouts are open.'],
    'loadouts:visit': [
        'A Loadout saves your party, formation, Skills, Artifacts and Gear.',
        'Keep one for waves and one for bosses. Saving is free, and swapping is one tap.'
    ],

    'speed:unlock': ['Battle Speed is open. I\'ve never tried it myself, but I hear it\'s thrilling.'],
    'speed:visit': [
        'Spend Gems on a stretch of faster battles.',
        'It keeps running while you\'re away. Take it from a snail: speed is precious.'
    ],

    'raids:unlock': ['Four Worlds cleared, and something big has noticed you. Raids are open.'],
    'raids:visit': [
        'Five great beasts wait in the raids, each with a trick of its own.',
        'Each attempt costs a Key, and Keys come back every day.',
        'Beat a level to open the next, and quick-clear your best whenever you like.',
        'Raids pay Seals, and the Trait raid pays Trait Gems.'
    ],

    'prestige:unlock': ['You beat the Void. I\'ve seen this moment before. Prestige is open.'],
    'prestige:visit': [
        'The secret of the Chronicle: the Void is never gone. It folds the world back up.',
        'Prestige walks you back to Thornwick Vale, on a harder road. The Void pays in Shards.',
        'Your Hero keeps every level. Spend the Shards in the shop here.',
        'Each prestige grants a class token, too.',
        'The Void forgets every run. I don\'t. A snail carries everything it owns.'
    ],

    'classes:unlock': ['Your first class token! Classes are open. The Chronicle loves a new costume.'],
    'classes:visit': [
        'A token takes your class one step deeper down the tree.',
        'Switching back to a class you\'ve had is always free.',
        'Prestige once as every master, and something waits at the end. Even I\'ve only heard of it.'
    ]
}
