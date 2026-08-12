import { TIER_SCORES } from './buyRec'
import { tierRank } from './tiers'
import { normalize } from './text'
import manualStock from '../data/manualStock.json'
import type { Part, StockFile, StockGroup, StockProduct } from './types'

const CACHE_KEY = 'beyclub:stock:v1'

/**
 * KGB's category labels, folded into the groups the filter row offers.
 *
 * This is the third copy of the same table — `GROUPS` in
 * `scripts/fetch-stock.mjs` and `KIT` in `public/grab-stock.js` are the others.
 * They cannot be shared: one runs in Node, one runs on KGB's own origin, and
 * this one is bundled. Change one, change all three.
 */
const GROUP_BY_CATEGORY: Record<string, StockGroup> = {
  Starter: 'bey',
  Booster: 'bey',
  'Random Booster': 'bey',
  'Battle Set': 'bey',
  'Deck Set': 'bey',
  'Dash Set': 'bey',
  'Custom Set': 'bey',
  'Entry Package': 'bey',
  Stadium: 'stadium',
  Launcher: 'launcher',
  Grip: 'launcher',
  'Launcher Grip': 'launcher',
  'Deck Case': 'case',
  'Gear Case': 'case',
}

export const groupForCategory = (label: string): StockGroup =>
  GROUP_BY_CATEGORY[label?.trim()] ?? 'merch'

/**
 * The product code a listing hangs its tier on, read off the slug the same way
 * `parseCard()` in the scraper reads it: a letter prefix and a number, e.g.
 * `ux-21-hells-nether-deck-set` → `UX-21`. Merchandise has no such code and
 * gets none.
 */
export function codeFromSlug(slug: string): string | undefined {
  const m = /^([a-z]+)-(\d+)/i.exec(slug)
  return m ? `${m[1].toUpperCase()}-${m[2]}` : undefined
}

/**
 * Products KGB sells that the frozen feed never saw. Hand-maintained, because
 * the scraper cannot run while the shop is members-only and `public/data/` is
 * generated. Carries no availability: this file is not entitled to claim any.
 */
type ManualListing = Omit<StockProduct, 'url' | 'inStock'>

export function manualListings(): StockProduct[] {
  return (manualStock as { products: ManualListing[] }).products.map((p) => ({
    ...p,
    url: `https://kelabgasingbeyblade.my/products/${p.slug}`,
    inStock: false,
  }))
}

/** Curated listings, minus anything the published file already covers. */
export function withManualListings(products: StockProduct[]): StockProduct[] {
  const known = new Set(products.map((p) => p.slug))
  return [...products, ...manualListings().filter((p) => !known.has(p.slug))]
}

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

/** The endpoint that dispatches the scrape workflow — empty when not deployed. */
const REFRESH_ENDPOINT = import.meta.env.VITE_STOCK_REFRESH_URL

/**
 * Whether "Check now" can start a real scrape. False falls the button back to
 * simply re-pulling the last published file, which is all a page can do alone.
 */
export function stockScrapeConfigured(): boolean {
  return Boolean(REFRESH_ENDPOINT)
}

/**
 * Ask the dispatcher to start a fresh scrape. It holds the GitHub token a public
 * page can't (see worker/refresh-stock.js) and fires the same `stock.yml`
 * workflow the schedule does. Resolves once the run is queued — the new data
 * lands a few minutes later, when the run scrapes, commits and redeploys, which
 * is why the caller then polls loadStock() for the change.
 */
export async function triggerStockScrape(): Promise<void> {
  if (!REFRESH_ENDPOINT) throw new Error('No stock refresh endpoint configured')
  const res = await fetch(REFRESH_ENDPOINT, { method: 'POST' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
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
      // Cache what KGB actually gave us. The curated rows are compiled in, so
      // caching them too would just pin an old copy of the source file.
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch {
      // Quota exceeded or private mode — cache is a nicety, not a requirement.
    }
    return { ...data, products: withManualListings(data.products), stale: false }
  } catch (err) {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      const cached = raw ? (JSON.parse(raw) as StockFile) : null
      if (cached) return { ...cached, products: withManualListings(cached.products), stale: true }
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
