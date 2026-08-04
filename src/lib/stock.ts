import { TIER_SCORES } from './buyRec'
import { dataUrl } from './dataSource'
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
 * What KGB has on the shelf, falling back to the last good copy so the page
 * always renders something. Stock is a nicety on the tier page and the whole
 * point of the stock page, so failure is never allowed to blank either.
 */
export async function loadStock(): Promise<StockFile> {
  try {
    const res = await fetch(dataUrl('stock.json'))
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
