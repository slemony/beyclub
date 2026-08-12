#!/usr/bin/env node
/**
 * Publishes what Kelab Gasing Beyblade currently has on the shelf.
 *
 * KGB is a server-rendered Laravel shop whose `/shop` listing already carries
 * everything we need — title, category, price, image and an Add to Cart /
 * Out of Stock button — so the whole catalogue costs five requests rather than
 * one per product. Its robots.txt allows `*` everywhere but `/admin`.
 *
 * Since 6 Aug 2026 none of that is reachable anonymously: `/shop` answers with
 * a "Sign in to queue" page instead, because KGB now reserves places in line
 * for signed-in members. This script deliberately does not try to get around
 * that — it records the closed door (see `ShopClosed`) and keeps publishing the
 * last shelf it genuinely saw, so the app can say so plainly. If the shop
 * reopens, or grants BeyClub a feed, the scrape resumes on its own.
 *
 * The product slug is the useful part: it spells out the product code and the
 * build it ships as ("bx-34-cobalt-dragoon-2-60c"). The code is what lets the
 * app put a tier against a listing, so it is parsed here and stored, rather
 * than being re-derived from a display name in the browser.
 *
 * Nothing here decides whether a bey is worth buying. That judgement stays with
 * the blended ranking, which this file only supplies a price and a code for.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/data/stock.json')

const SHOP = 'https://kelabgasingbeyblade.my'
const page = (n) => `${SHOP}/shop?page=${n}`

/** Pagination is walked until a page comes back empty; this stops a runaway. */
const MAX_PAGES = 15

/** How far the catalogue may shrink before we assume the scrape is broken. */
const COVERAGE_FLOOR = 0.75

/**
 * KGB's own labels, folded into the five groups the Stock page filters on. The
 * raw label is kept on each product too — "Random Booster" tells a buyer more
 * than "bey" does, it just makes a poor filter.
 */
const GROUPS = {
  bey: [
    'Starter',
    'Booster',
    'Random Booster',
    'Battle Set',
    'Deck Set',
    'Dash Set',
    'Custom Set',
    'Entry Package',
  ],
  stadium: ['Stadium'],
  launcher: ['Launcher', 'Grip', 'Launcher Grip'],
  case: ['Deck Case', 'Gear Case'],
}

const GROUP_BY_LABEL = new Map(
  Object.entries(GROUPS).flatMap(([group, labels]) => labels.map((l) => [l, group])),
)

const die = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

/**
 * KGB's members-only interstitial, served with a 200 in place of whatever page
 * was asked for. Since 6 Aug 2026 every anonymous request to /shop and
 * /products/* gets this: places in line are reserved for signed-in members, so
 * the catalogue is no longer public. Hosted runners see a bare 403 instead.
 *
 * Matched on the sign-in copy rather than the title alone, so that a reworded
 * heading reads as "still gated" and not as a catalogue that has gone empty.
 */
const GATE = /Sign in to (?:queue|shop)|places in line are reserved for signed-in members/i

/**
 * A shop we cannot read is not the same as a scraper that is broken, and the
 * difference has to survive as far as the page. These carry the distinction out
 * of `get()` so the caller can record it, instead of dying and leaving the
 * published file frozen with no explanation.
 */
class ShopClosed extends Error {
  constructor(health, detail) {
    super(detail)
    this.health = health
  }
}

async function get(url) {
  let res
  try {
    res = await fetch(url, { headers: { 'user-agent': 'beyclub-stock-refresh' } })
  } catch (err) {
    throw new ShopClosed('unreachable', `${url} — ${err.message}`)
  }
  if (!res.ok) throw new ShopClosed('unreachable', `${url} returned ${res.status} ${res.statusText}`)

  const html = await res.text()
  if (GATE.test(html)) {
    throw new ShopClosed('gated', `${url} answered with the members-only sign-in queue`)
  }
  return html
}

/**
 * One listing card. Anchored on `product-container` so the nav and footer links
 * that also point at /products/ are not mistaken for stock, and closed on the
 * first `</a>` — cards contain no nested anchors.
 */
const CARD =
  /<a href="(https:\/\/kelabgasingbeyblade\.my\/products\/[^"]+)"[^>]*>\s*<div class="product-container[\s\S]*?<\/a>/g

const one = (block, re) => block.match(re)?.[1]?.trim()

function parseCard(url, block) {
  const slug = url.slice(url.lastIndexOf('/') + 1)
  const title = one(block, /product-title[^"]*">([^<]*)</)
  const kgbCategory = one(block, /product-desc[^"]*">\s*\[([^\]]*)\]/)

  // A discounted product prints the old price before the payable one, so the
  // last figure on the card is the one a buyer actually hands over.
  const prices = [...block.matchAll(/MYR\s*([\d,.]+)/g)].map((m) => Number(m[1].replace(/,/g, '')))
  const priceMYR = prices.length ? prices[prices.length - 1] : undefined

  // A product sold in several sizes shows "Select Variant" in place of a cart
  // button, so its card says nothing about availability. Left undefined here
  // and settled against the product page below.
  const sold = block.includes('Out of Stock')
  const buyable = block.includes('Add to Cart')

  // A code is the hook the tier list hangs on. Merchandise has none, which is
  // fine — "bbx-activity-book-01" must not be read as a BX product.
  const code = slug.match(/^((?:bx|ux|cx)g?-\d+)/)?.[1]?.toUpperCase()

  return {
    slug,
    url,
    ...(code ? { code } : {}),
    title,
    kgbCategory,
    group: kgbCategory ? (GROUP_BY_LABEL.get(kgbCategory) ?? 'merch') : undefined,
    priceMYR,
    inStock: sold ? false : buyable ? true : undefined,
    img: one(block, /<img src="(https:\/\/kelabgasingbeyblade\.my\/storage\/product\/[^"]+)"/),
  }
}

async function scrape() {
  const bySlug = new Map()
  let pages = 0

  for (let n = 1; n <= MAX_PAGES; n++) {
    const html = await get(page(n))
    const cards = [...html.matchAll(CARD)]
    if (!cards.length) break

    pages = n
    for (const [block, url] of cards) {
      const product = parseCard(url, block)
      // Later pages re-list nothing, but a shifting catalogue can repeat a
      // product across a page boundary. First sighting wins.
      if (!bySlug.has(product.slug)) bySlug.set(product.slug, product)
    }
  }

  return { products: [...bySlug.values()], pages }
}

/**
 * Settles the cards whose button said nothing, from the product page's own
 * OpenGraph availability. A dozen extra requests twice a day is a fair price
 * for not having to guess on the shop's behalf.
 */
async function settleAvailability(products) {
  const open = products.filter((p) => p.inStock === undefined)

  for (const product of open) {
    const declared = one(
      await get(product.url),
      /<meta property="og:availability" content="([^"]*)"/,
    )
    if (declared === 'in stock') product.inStock = true
    else if (declared === 'out of stock') product.inStock = false
  }

  return open.length
}

/** Everything published about the shop except the shelf itself. */
const meta = (health) => ({ checkedAt: new Date().toISOString(), health })

/**
 * Nothing new to publish — but the fact that we looked, and what we found, is
 * itself worth publishing. Without it the page keeps announcing "stock last
 * changed 6 Aug", which a reader takes to mean KGB has not restocked in all
 * that time rather than that we can no longer see the shelf.
 *
 * Exits 0: a shop that has closed its doors is not a failed run, and flagging
 * it red every day would train us to ignore the one that matters.
 */
function recordClosed(err) {
  console.error(`✗ ${err.message}`)
  if (!existsSync(OUT)) die('and no previous stock to fall back on')

  const prev = JSON.parse(readFileSync(OUT, 'utf8'))
  const kept = { ...prev, ...meta(err.health) }
  // Rebuilt in the published key order rather than spread onto the end, so the
  // status does not land after a 157-entry array.
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        updatedAt: kept.updatedAt,
        ...meta(err.health),
        source: kept.source,
        coverage: kept.coverage,
        products: kept.products,
      },
      null,
      2,
    )}\n`,
  )

  const n = prev.products?.length ?? 0
  console.log(`  recorded health "${err.health}" — keeping ${n} products last seen ${prev.updatedAt}`)
  process.exit(0)
}

let products, pages, settled
try {
  ;({ products, pages } = await scrape())
  settled = await settleAvailability(products)
} catch (err) {
  if (err instanceof ShopClosed) recordClosed(err)
  throw err
}

if (!products.length) die('no product cards on /shop — KGB markup changed')

const broken = products.filter(
  (p) => !p.title || !p.kgbCategory || !p.priceMYR || p.inStock === undefined,
)
if (broken.length) {
  die(
    `${broken.length} card(s) parsed incompletely, e.g. ${JSON.stringify(broken[0])}` +
      ' — KGB markup changed. Keeping previous data.',
  )
}

const beys = products.filter((p) => p.group === 'bey')
if (!beys.length) die('not one bey in the catalogue — the category labels changed')

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : undefined

// A catalogue that quietly halves would empty the page without failing the run.
if (prev) {
  const was = prev.products?.length ?? 0
  if (products.length < was * COVERAGE_FLOOR) {
    die(`catalogue collapsed: ${was} products -> ${products.length}. Keeping previous data.`)
  }
}

products.sort((a, b) => a.slug.localeCompare(b.slug))

const inStock = products.filter((p) => p.inStock).length
const unchanged = prev && JSON.stringify(prev.products) === JSON.stringify(products)

const data = {
  /**
   * Held at its old value when the shelf has not moved, so it goes on meaning
   * "when stock last changed" rather than "when we last ran".
   */
  updatedAt: unchanged ? prev.updatedAt : new Date().toISOString(),
  ...meta('ok'),
  source: {
    name: 'Kelab Gasing Beyblade',
    url: `${SHOP}/`,
    currency: 'MYR',
  },
  coverage: { products: products.length, inStock, pages },
  products,
}

/**
 * Written on every run, not only when the shelf moves, because `checkedAt` is
 * the whole point: a file that changes daily is how the page can say when it
 * last saw the shop. That costs one commit and one redeploy a day, which is
 * also what keeps a public repo's scheduled workflows from being switched off
 * for inactivity.
 */
writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`)

const groups = products.reduce((acc, p) => ({ ...acc, [p.group]: (acc[p.group] ?? 0) + 1 }), {})
console.log(`✓ ${unchanged ? 'unchanged — ' : ''}${products.length} products over ${pages} pages · ${inStock} in stock`)
console.log(`  ${Object.entries(groups).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
console.log(`  ${products.filter((p) => p.code).length} carry a product code`)
if (settled) console.log(`  ${settled} settled against the product page's own availability`)
