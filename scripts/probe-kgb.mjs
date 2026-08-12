#!/usr/bin/env node
/**
 * THROWAWAY. Delete this file and .github/workflows/probe-kgb.yml once the
 * scrape is unblocked.
 *
 * Since 6 Aug every scheduled run of stock.yml has died on the first request
 * with 403 Forbidden. The same request from a Malaysian residential IP returns
 * 200 — including with the scraper's own `beyclub-stock-refresh` user-agent —
 * so the user-agent is not what's being refused and the failure cannot be
 * reproduced anywhere except on a runner. This script is the instrument: it
 * asks for the same page several ways from inside Actions and prints enough of
 * each answer to tell the possibilities apart.
 *
 * Read the results as:
 *
 *   only "control" fails      → a header/user-agent filter; realistic headers fix it
 *   a challenge marker appears → Cloudflare interstitial; needs a real browser
 *   every attempt fails alike  → the IP range is blocked; headers are irrelevant
 *
 * It also dumps a product page's add-to-cart form, which decides whether a
 * "buy" link can ever be more than a deep link to the product page.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SHOP = 'https://kelabgasingbeyblade.my'
const TARGET = `${SHOP}/shop?page=1`

/** What the scraper sends today, and what has been getting a 403. */
const CONTROL = { 'user-agent': 'beyclub-stock-refresh' }

/**
 * A current desktop Chrome on macOS, in the order Chrome actually sends them.
 * Accept-Language names Malaysia because the shop is Malaysian and a mismatched
 * locale is itself a signal.
 */
const REALISTIC = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-MY,en-GB;q=0.9,en;q=0.8',
  'accept-encoding': 'gzip, deflate, br',
  'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
}

/** The headers that say who refused us, and how close to the rate cap we are. */
const TELLING = [
  'server',
  'cf-ray',
  'cf-mitigated',
  'cf-cache-status',
  'content-type',
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
]

/** Body markers that mean "a browser could pass this, but fetch never will". */
const CHALLENGE = [
  'Just a moment',
  'cf_chl_opt',
  '__cf_chl',
  'challenge-platform',
  'Enable JavaScript and cookies',
  'Attention Required',
]

const line = (label) => console.log(`\n${'─'.repeat(72)}\n${label}\n${'─'.repeat(72)}`)

function report(body, res) {
  for (const h of TELLING) {
    const v = res.headers.get(h)
    if (v) console.log(`  ${h}: ${v}`)
  }
  const hits = CHALLENGE.filter((m) => body.includes(m))
  if (hits.length) console.log(`  ⚠ CHALLENGE MARKERS: ${hits.join(', ')}`)
  // Enough bytes to see a Cloudflare block page's title, not so many that the
  // real listing floods the log.
  console.log(`  body[0..600]: ${JSON.stringify(body.slice(0, 600))}`)
}

async function attempt(label, url, headers) {
  line(label)
  console.log(`  GET ${url}`)
  try {
    const res = await fetch(url, { headers, redirect: 'follow' })
    const body = await res.text()
    console.log(`  → ${res.status} ${res.statusText}  (${body.length} bytes)`)
    report(body, res)
    return { label, status: res.status, body }
  } catch (err) {
    console.log(`  → threw: ${err.message}`)
    return { label, status: 0, body: '' }
  }
}

/**
 * The same page through a real browser: genuine TLS fingerprint, real header
 * ordering, and JavaScript to clear an interstitial. The furthest a hosted
 * runner can go towards looking like a person.
 */
async function viaChromium(url) {
  line('D. headless Chromium (Playwright)')
  console.log(`  GET ${url}`)
  try {
    const { chromium } = await import('playwright-chromium')
    const browser = await chromium.launch()
    const ctx = await browser.newContext({
      locale: 'en-MY',
      timezoneId: 'Asia/Kuala_Lumpur',
      userAgent: REALISTIC['user-agent'],
    })
    const pg = await ctx.newPage()
    const res = await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    const body = await pg.content()
    console.log(`  → ${res.status()} ${res.statusText()}  (${body.length} bytes)`)
    const headers = res.headers()
    for (const h of TELLING) if (headers[h]) console.log(`  ${h}: ${headers[h]}`)
    const hits = CHALLENGE.filter((m) => body.includes(m))
    if (hits.length) console.log(`  ⚠ CHALLENGE MARKERS: ${hits.join(', ')}`)
    console.log(`  product cards on page: ${(body.match(/product-container/g) || []).length}`)
    await browser.close()
    return { label: 'chromium', status: res.status(), body }
  } catch (err) {
    console.log(`  → threw: ${err.message}`)
    return { label: 'chromium', status: 0, body: '' }
  }
}

/**
 * Whether "add to cart" could ever be driven from our own page. A Laravel form
 * carrying a per-session _token cannot be posted cross-origin, which settles it;
 * a plain GET link would leave the door open.
 */
function reportCart(html) {
  line('F. add-to-cart markup on a product page')
  const forms = [...html.matchAll(/<form[\s\S]{0,600}?<\/form>/g)]
    .map((m) => m[0])
    .filter((f) => /cart/i.test(f))
  if (!forms.length) {
    console.log('  no <form> mentioning cart found')
    const links = [...html.matchAll(/<a[^>]+href="[^"]*cart[^"]*"[^>]*>/g)].map((m) => m[0])
    console.log(links.length ? `  GET-shaped cart links: ${links.slice(0, 3).join(' | ')}` : '  no cart links either')
    return
  }
  for (const f of forms.slice(0, 2)) {
    console.log(`  method=${/method="([^"]+)"/i.exec(f)?.[1] ?? '(none, defaults to GET)'}`)
    console.log(`  action=${/action="([^"]+)"/i.exec(f)?.[1] ?? '(none)'}`)
    console.log(`  csrf _token present: ${/name="_token"/.test(f)}`)
    console.log(`  form[0..400]: ${JSON.stringify(f.slice(0, 400))}`)
  }
}

/** A real slug from the last good scrape, so the probe hits a page that exists. */
function sampleProduct() {
  try {
    const stock = JSON.parse(readFileSync(join(ROOT, 'public/data/stock.json'), 'utf8'))
    const p = stock.products.find((x) => x.inStock) ?? stock.products[0]
    return p?.url
  } catch {
    return undefined
  }
}

console.log(`Probing ${SHOP} from ${process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'this machine'}`)
console.log(`Runner egress IP: ${await fetch('https://api.ipify.org').then((r) => r.text()).catch(() => '(unknown)')}`)

const control = await attempt('A. control — the user-agent the scraper sends today', TARGET, CONTROL)
const realistic = await attempt('B. realistic Chrome headers', TARGET, REALISTIC)
await attempt('C. robots.txt (realistic headers)', `${SHOP}/robots.txt`, REALISTIC)
const chromium = await viaChromium(TARGET)

const product = sampleProduct()
if (product) {
  const page = await attempt('E. a product page (realistic headers)', product, REALISTIC)
  if (page.body) reportCart(page.body)
} else {
  console.log('\n(no product URL available from stock.json — skipping the cart probe)')
}

line('VERDICT')
const ok = (r) => (r.status === 200 ? 'PASS' : `FAIL ${r.status || 'threw'}`)
console.log(`  control (bot UA):     ${ok(control)}`)
console.log(`  realistic headers:    ${ok(realistic)}`)
console.log(`  headless Chromium:    ${ok(chromium)}`)
console.log('')
if (control.status === 200) {
  console.log('  → Nothing is blocked from this runner. The 403 is intermittent or has lifted;')
  console.log('    re-run stock.yml before changing anything.')
} else if (realistic.status === 200 || chromium.status === 200) {
  const fix = realistic.status === 200 ? 'realistic headers in get()' : 'headless Chromium'
  console.log(`  → A request shape gets through. Fix: ${fix}.`)
} else {
  console.log('  → Every shape fails identically. This is an IP/ASN block on GitHub-hosted')
  console.log('    runners; no amount of header work will fix it. Escalate instead.')
}
