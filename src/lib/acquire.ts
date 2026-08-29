import randomBoosters from '../data/randomBoosters.json'
import setContents from '../data/setContents.json'
import { partCode, type PartIndex } from './partIndex'
import type { StockIndex } from './stock'
import { normalize, productCode } from './text'
import { tierRank } from './tiers'
import type { Part, RandomBooster, StockProduct } from './types'

/**
 * How to actually get hold of a part.
 *
 * The tier list says whether a bit is worth using; this says where one comes
 * from. Nothing in the catalogue answers that directly — a ratchet has no
 * product code of its own and KGB has never sold one loose — so a route is
 * always a *box*, assembled from three things the app already knows: which
 * blades ship the part (partIndex), which boxes hold it loose
 * (setContents.json), and what KGB lists under that box's code (stock.json).
 */
export type AcquireRoute = {
  /** Retail product code — "BX-35", the thing you actually buy. */
  code: string
  /** English name of the box. Never the sheet's Chinese product string. */
  label: string
  kind: RouteKind
  /** 0–1. Exactly 1 for anything but a blind pull. */
  chance: number
  /**
   * The chance is our arithmetic, not a published rate — see randomBoosters.json.
   * Renders as a hedge rather than a percentage, and must never be dropped:
   * the denominator behind an estimate is a floor, not a count.
   */
  estimated?: boolean
  /** How many of the box's beys carry the part, over how many we know of. */
  odds?: { hits: number; of: number }
  /** The blade that carries it, so a row can say which bey to look for. */
  via?: Part
  listing?: StockProduct
  /** What a pull costs on average — price over chance. Random routes only. */
  expectedMYR?: number
  /** Where a curated claim was read, for a reader who wants to check it. */
  source?: string
}

/**
 * `assembled` — a bey in this box comes built with the part.
 * `inBox` — the box holds it loose, on no bey in particular.
 * `random` — a blind pull, and `chance` is what it is worth.
 */
export type RouteKind = 'assembled' | 'inBox' | 'random'

type SetEntry = { label?: string; source?: string; ratchets?: string[]; bits?: string[] }

const SETS = setContents.sets as Record<string, SetEntry>
const BOOSTERS = randomBoosters.sets as Record<string, RandomBooster>

/** The sheet's own words for a blind box, in both spellings it uses. */
const RANDOM_PRODUCT = /隨機|抽包/
/** KGB's words for one. A "Select" is a blind assortment of one bey's colourways. */
const RANDOM_TITLE = /random booster|select/i

/** The retail code a sheet product string opens with — "BX-14 隨機強化組Vol.01" → "BX-14". */
const codeInProduct = (product: string): string | undefined =>
  /^\s*([A-Za-z]+-\d+)/.exec(product)?.[1]

export function acquireRoutes(
  part: Part,
  parts: Part[],
  index: PartIndex,
  stock: StockIndex,
  knowsAvailability: boolean,
): AcquireRoute[] {
  const blades = parts.filter((p) => p.cat === 'blade')

  const bladesByCode = new Map<string, Part[]>()
  for (const blade of blades) {
    const code = productCode(blade.id)
    const list = bladesByCode.get(code)
    if (list) list.push(blade)
    else bladesByCode.set(code, [blade])
  }

  /**
   * Whether a given bey gets you this part.
   *
   * For a ratchet or bit that is partIndex's own answer, reused rather than
   * re-derived so a route can never disagree with the "Comes in these blades"
   * list right above it. For a blade it is the blade itself — by `key`, so a
   * box holding two colourways of one mould counts as two ways to pull it.
   */
  const shipping = new Set(index.bladesShipping(part).map((b) => b.id))
  const carries = (blade: Part) =>
    part.cat === 'blade' ? blade.key === part.key : shipping.has(blade.id)

  /**
   * A box is blind when we have counted it, when the sheet calls it one, or
   * when KGB does.
   *
   * The sheet check insists the product string names *this* code, which is not
   * pedantry: BX-15 Leon Claw is a plain booster whose row carries BX-14's
   * random-booster string, and taking that at face value would sell a
   * guaranteed bey as a lottery.
   */
  const isRandom = (code: string, listings: StockProduct[]) => {
    if (BOOSTERS[code]) return true
    const own = (bladesByCode.get(code) ?? []).some(
      (b) => b.product && RANDOM_PRODUCT.test(b.product) && codeInProduct(b.product) === code,
    )
    return own || listings.some((l) => RANDOM_TITLE.test(l.title))
  }

  /** The best-graded bey in this box that carries the part — the one to look for. */
  const carrier = (code: string) =>
    (bladesByCode.get(code) ?? [])
      .filter(carries)
      .sort((a, b) => tierRank(a.tier) - tierRank(b.tier))[0]

  const label = (code: string, listings: StockProduct[]) =>
    BOOSTERS[code]?.label ?? SETS[code]?.label ?? listings[0]?.title ?? code

  const wanted = normalize(partCode(part.cat, part.id))

  // Every box worth considering: the ones whose beys ship the part, and the
  // ones that carry it loose. A blade is its own case — it is looked for by
  // `key`, so every box the mould was ever sold in shows up, not just the SKU
  // the sheet happens to list first.
  const codes = new Map<string, RouteKind>()
  const consider = (code: string, kind: RouteKind) => {
    if (kind === 'assembled' || !codes.has(code)) codes.set(code, kind)
  }

  if (part.cat === 'blade') {
    for (const blade of blades) {
      if (blade.key === part.key) consider(productCode(blade.id), 'assembled')
    }
  } else {
    for (const blade of index.bladesShipping(part)) consider(productCode(blade.id), 'assembled')
  }

  for (const [code, set] of Object.entries(SETS)) {
    const loose = [...(set.ratchets ?? []), ...(set.bits ?? [])]
    if (loose.some((c) => normalize(c) === wanted)) consider(code, 'inBox')
  }

  const routes: AcquireRoute[] = []

  for (const [code, kind] of codes) {
    const listings = stock.listingsForCode(code)
    const listing = listings[0]
    const base = { code, label: label(code, listings), listing, via: carrier(code) }

    if (!isRandom(code, listings)) {
      routes.push({ ...base, kind, chance: 1, source: SETS[code]?.source })
      continue
    }

    const curated = BOOSTERS[code]
    let chance: number
    let estimated: boolean
    let odds: AcquireRoute['odds']

    if (curated) {
      const total = curated.pulls.reduce((sum, pull) => sum + pull.share, 0)
      const hits = curated.pulls.filter(
        (pull) => shipping.has(pull.blade) || pull.blade === part.id ||
          (pull.extra ?? []).some((c) => normalize(c) === wanted),
      )
      chance = total > 0 ? hits.reduce((sum, pull) => sum + pull.share, 0) / total : 0
      estimated = Boolean(curated.assumedEven)
      odds = { hits: hits.length, of: curated.pulls.length }
    } else {
      // No entry yet, so the sheet's own row count is the denominator — a
      // floor, since it under-lists some boxes. Flagged, and worded as a
      // guess wherever it is shown.
      const inBox = bladesByCode.get(code) ?? []
      const hits = inBox.filter(carries)
      chance = inBox.length ? hits.length / inBox.length : 0
      estimated = true
      odds = { hits: hits.length, of: inBox.length }
    }

    // A pull that cannot produce the part is not a route to it.
    if (chance <= 0) continue

    routes.push({
      ...base,
      kind: 'random',
      chance,
      estimated,
      odds,
      source: curated?.source,
      // What the part really costs when the box decides, not the shelf price.
      // A statement about money rather than about stock, so it survives a shop
      // we cannot read.
      expectedMYR: listing ? listing.priceMYR / chance : undefined,
    })
  }

  return routes.sort(compareRoutes(knowsAvailability))
}

/**
 * Easiest and most reliable, in that order — and availability comes first.
 *
 * Bit K is why. K ships guaranteed on BXG-54 Samurai Saber and BXC-13 Dran
 * Supreme S, neither of which KGB has ever listed, and turns up as a ~1-in-2
 * pull from CX-05, which KGB does sell. Sorting on certainty alone answers
 * "how do I get K" with a World Cup blade nobody here can buy. A box you
 * cannot obtain is not a route, however guaranteed its contents.
 *
 * Within a band certainty rules again, so a guaranteed box on the shelf always
 * beats a pull on the shelf. The in-stock band exists only when the shop is
 * actually readable — see `knowsAvailability` on the Stock page. When it is
 * not, everything KGB lists shares one band and the order degrades to price
 * and odds rather than inventing a shelf.
 */
const compareRoutes = (knowsAvailability: boolean) => (a: AcquireRoute, b: AcquireRoute) => {
  const band = (r: AcquireRoute) => {
    if (!r.listing) return 2
    return knowsAvailability && r.listing.inStock ? 0 : 1
  }
  const price = (r: AcquireRoute) => r.listing?.priceMYR ?? Infinity

  return (
    band(a) - band(b) ||
    b.chance - a.chance ||
    price(a) - price(b) ||
    a.code.localeCompare(b.code)
  )
}
