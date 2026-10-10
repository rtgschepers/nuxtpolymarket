// The Shop's tabs along the top left: Upgrades and Battle Speed (the user's call, 2026-10-10, to free
// a menu button). The open one is lit and gold; Battle Speed shows dim until it opens.

import { C } from './palette'
import { rect, type Surface } from './surface'
import { drawText, textWidth } from './font'
import { HQ_SHOP_TABS, HQ_SHOP_TAB_LABELS, type HqShopTab } from '../hero-quest-scenes'

const TAB_X = 4
const TAB_Y = 1
const TAB_H = 12
const TAB_PAD = 6
const TAB_GAP = 2

interface Box {
    x: number
    y: number
    w: number
    h: number
}

function tabBoxes(): Record<HqShopTab, Box> {
    let x = TAB_X
    const out = {} as Record<HqShopTab, Box>
    for (const tab of HQ_SHOP_TABS) {
        const w = textWidth(HQ_SHOP_TAB_LABELS[tab].toUpperCase()) + TAB_PAD * 2
        out[tab] = { x, y: TAB_Y, w, h: TAB_H }
        x += w + TAB_GAP
    }
    return out
}

/** The tab under a point, or null. */
export function shopTabAt(x: number, y: number): HqShopTab | null {
    const boxes = tabBoxes()
    return HQ_SHOP_TABS.find((tab) => {
        const b = boxes[tab]
        return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h
    }) ?? null
}

/** The tabs, `open` lit; a tab in `locked` is drawn dim, for a feature not open yet. */
export function drawShopTabs(s: Surface, open: HqShopTab, hover: HqShopTab | null, locked: ReadonlySet<HqShopTab>): void {
    const boxes = tabBoxes()
    for (const tab of HQ_SHOP_TABS) {
        const b = boxes[tab]
        const on = tab === open
        const shut = locked.has(tab)
        const lit = !on && !shut && hover === tab
        rect(s, b.x, b.y, b.w, b.h, C.ink)
        rect(s, b.x + 1, b.y + 1, b.w - 2, b.h - 2, on ? C.night1 : lit ? C.night2 : C.night0)
        rect(s, b.x + 1, b.y + 1, b.w - 2, 1, on ? C.night3 : C.night1)
        const color = on ? C.gold2 : shut ? C.stone1 : lit ? C.bone1 : C.stone3
        drawText(s, HQ_SHOP_TAB_LABELS[tab].toUpperCase(), b.x + TAB_PAD, b.y + 3, color, { shadow: 1 })
    }
}
