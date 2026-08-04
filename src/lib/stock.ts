import { TIER_SCORES } from './buyRec'
import { tierRank } from './tiers'
import { normalize } from './text'
import type { Part, StockFile, StockProduct } from './types'

const CACHE_KEY = 'beyclub:stock:v1'

/** KGB prices in the form a Malaysian shopper reads them. */
export function formatMYR(myr: number): string {
  return `RM ${myr.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * A manual "check now" is allowed at most once per whole clock hour, freeing up
 * again as the reader's own clock rolls past the next :00. The shelf itself only
 * moves when the scheduled scrape commits, so a tighter allowance would just
 * re-pull the same bytes.
 */
const MANUAL_REFRESH_KEY = 'beyclub:stock:lastManualRefresh'

/** The whole clock-hour we're in, in the reader's local time (MYT for our lot). */
function currentHourSlot(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`
}

/** True once the clock has crossed into an hour we have not refreshed in yet. */
export function canRefreshStockNow(): boolean {
  try {
    return localStorage.getItem(MANUAL_REFRESH_KEY) !== currentHourSlot()
  } catch {
    return true
  }
}

/** Spend this hour's manual refresh, so the button waits for the next :00. */
export function markStockRefreshed(): void {
  try {
    localStorage.setItem(MANUAL_REFRESH_KEY, currentHourSlot())
  } catch {
    // No storage means no throttle to persist — the button just stays live.
  }
}

/** The next whole hour — when the manual refresh frees up again. */
function nextHour(d = new Date()): Date {
  const next = new Date(d)
  next.setHours(d.getHours() + 1, 0, 0, 0)
  return next
}

/** Milliseconds until the next :00, when the manual refresh frees up again. */
export function msToNextHour(d = new Date()): number {
  return nextHour(d).getTime() - d.getTime()
}

/**
 * The next :00 as a clock time to show the reader, in the same local zone the
 * throttle counts in (MYT for our lot), e.g. "3:00 pm".
 */
export function nextRefreshLabel(d = new Date()): string {
  return nextHour(d).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' })
}

/**
 * What KGB has on the shelf, falling back to the last good copy so the page
 * always renders something. Stock is a nicety on the tier page and the whole
 * point of the stock page, so failure is never allowed to blank either.
 */
export async function loadStock(bust = false): Promise<StockFile> {
  try {
    // A manual refresh cache-busts, so it pulls the freshly deployed file rather
    // than whatever the CDN or the browser last held. The normal page load skips
    // this and stays fast on the cached copy.
    const url = `${import.meta.env.BASE_URL}data/stock.json${bust ? `?t=${Date.now()}` : ''}`
    const res = await fetch(url, bust ? { cache: 'no-store' } : undefined)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const data = (await res.json()) as StockFile

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch {
      // Quota exceeded or private mode — cache is a nicety, not a requirement.
    }
    return { ...data, stale: false }
  } catch (err) {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) return { ...(JSON.parse(raw) as StockFile), stale: true }
    } catch {
      // Unreadable cache is no better than none.
    }
    throw err
  }
}

/**
 * Joins the shop to the ranking, in both directions.
 *
 * The join is the product code the scraper lifted out of each slug. Most beys
 * match a catalogue entry outright, but a Random Booster or a deck set has no
 * entry of its own — the Taiwan sheet instead lists what is inside it under
 * sub-codes, BX-48 as BX-48-01 … BX-48-05. So a code that matches nothing
 * exactly is tried as a prefix, and a booster resolves to the five blades a
 * buyer might actually pull.
 */
export type StockIndex = {
  /** The catalogue parts inside a product, strongest first. */
  contents: (product: StockProduct) => Part[]
  /** Where this part can be bought, in stock first. */
  listingsFor: (part: Part) => StockProduct[]
}

export function buildStockIndex(products: StockProduct[], parts: Part[]): StockIndex {
  const byCode = new Map<string, Part[]>()
  for (const part of parts) {
    const code = normalize(part.id)
    const list = byCode.get(code)
    if (list) list.push(part)
    else byCode.set(code, [part])
  }

  const codes = [...byCode.keys()]

  const contents = new Map<string, Part[]>()
  // Keyed on the blade rather than the variant, so the sheet listing 魔導神杖 and
  // 魔導神杖(綠) separately does not hide one of the two products selling them.
  const listings = new Map<string, StockProduct[]>()

  for (const product of products) {
    if (!product.code) continue

    const code = normalize(product.code)
    const exact = byCode.get(code)
    const found =
      exact ?? codes.filter((c) => c.startsWith(code)).flatMap((c) => byCode.get(c) ?? [])
    if (!found.length) continue

    contents.set(product.slug, [...found].sort((a, b) => tierRank(a.tier) - tierRank(b.tier)))

    for (const part of found) {
      const key = `${part.cat}|${part.key}`
      const list = listings.get(key)
      // A booster holding two colourways of one blade is still one thing to
      // buy — listing it twice would read as two places to get it.
      if (!list) listings.set(key, [product])
      else if (!list.includes(product)) list.push(product)
    }
  }

  // Something buyable today outranks a cheaper thing that is sold out.
  for (const list of listings.values()) {
    list.sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.priceMYR - b.priceMYR)
  }

  return {
    contents: (product) => contents.get(product.slug) ?? [],
    listingsFor: (part) => listings.get(`${part.cat}|${part.key}`) ?? [],
  }
}

/**
 * The part a product is judged on: its best-graded blade.
 *
 * A booster is worth its best pull, not the average of five, and saying which
 * part earned the verdict keeps it from reading as arbitrary — the same reason
 * `explainVerdict` spells out the arithmetic on a part sheet.
 *
 * Undefined when no source has graded anything in the box. That has to read as
 * "we don't know", never as a bad verdict.
 */
export function gradedOn(contents: Part[]): Part | undefined {
  const rated = contents.filter((p) => TIER_SCORES[p.tier] !== undefined)
  if (!rated.length) return undefined
  return rated.reduce((best, p) => (TIER_SCORES[p.tier] > TIER_SCORES[best.tier] ? p : best))
}
