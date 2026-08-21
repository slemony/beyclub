#!/usr/bin/env node --experimental-strip-types
/**
 * Pulls tournament placement counts from BBXHub and keys them onto our catalogue.
 *
 * Why BBXHub rather than the tier sheet we already read: the sheet's stats tab
 * is a re-derivation. Its raw rows carry `kj_*` "original" columns and a
 * `blade_match_method` — only two thirds matched on an exact product code, the
 * rest on Chinese names and manual mappings — and its dates are unusable, with
 * thousands of rows sharing one timestamp and some landing in the future.
 * BBXHub publishes the same lineage openly (WBO Organized Events + German
 * Blader League), covers 2.4x as many records, and dates its windows properly.
 *
 * Matching happens here, once, rather than in the browser on every load, so the
 * app never has to guess which blade a placement belongs to.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseCSV } from '../src/lib/csv.ts'
import { baseName, editDistance, slug } from '../src/lib/text.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/data/tournament.json')

/** Part usage across every category, and the window date ranges. */
const BBXHUB = 'https://bbxhub.net/'
/** Blades only, but far richer: 1st-place counts and each blade's usual setup. */
const BBXHUB_TIERS = 'https://bbxhub.net/tier-list'
const UPSTREAM =
  'https://worldbeyblade.org/Thread-Winning-Combinations-at-WBO-Organized-Events-Beyblade-X-BBX'

const SHEET_DB = '1TBHOpcsv25bBfWERq14CBIy4P1G7j-qpPhmclx_nTWI'
const sheet = (gid) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_DB}/gviz/tq?tqx=out:csv&gid=${gid}`

/**
 * Windows we actually score on: the long baseline and the current meta.
 *
 * An array rather than an object because JS hoists integer-like keys — a plain
 * `{ all: …, 90: … }` iterates 90 first, which would silently reverse the
 * "highest-placing entry wins the label" rule in `add()` below.
 */
const WINDOWS = [
  ['all', 'allTime'],
  ['90', 'recent90'],
]

/** How far the event count may fall before we assume the scrape is broken. */
const COVERAGE_FLOOR = 0.75

const die = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'beyclub-tournament-refresh' } })
  if (!res.ok) die(`${url} returned ${res.status} ${res.statusText}`)
  return res.text()
}

/**
 * BBXHub is a Next.js app that server-renders its data into the flight payload,
 * so a page fetch gets the whole dataset — no per-blade crawling, no API needed.
 */
function payloadOf(html, what) {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"(.*?)"\]\)/gs)].map((m) => m[1])
  if (!chunks.length) die(`no Next.js flight payload in ${what} — BBXHub markup changed`)

  // The payload is a JS string literal, so unescape it before reading the JSON.
  return JSON.parse(`"${chunks.join('')}"`)
}

/** Reads the balanced JSON array that follows `key` in a flight payload. */
function arrayAfter(payload, key, what) {
  const at = payload.indexOf(key)
  if (at === -1) die(`${what} has no ${key} — BBXHub shape changed`)

  const start = payload.indexOf('[', at)
  let depth = 0
  for (let i = start; i < payload.length; i++) {
    if (payload[i] === '[') depth++
    else if (payload[i] === ']' && --depth === 0) {
      try {
        return JSON.parse(payload.slice(start, i + 1))
      } catch (err) {
        die(`could not parse ${key} in ${what} — ${err.message}`)
      }
    }
  }
  die(`${key} in ${what} is unterminated`)
}

/**
 * Per-blade detail from the tier-list page: placements, 1st places and the
 * ratchet and bit each blade is most often built with. The homepage only counts
 * part usage, so this is where a blade's own record comes from.
 */
function bladeRecords(html) {
  const regions = arrayAfter(payloadOf(html, 'tier-list'), '"regions":[', 'tier-list')
  const world = regions.find((r) => r.key === 'world')
  if (!world) die('tier-list has no "world" region')

  const out = new Map()
  for (const [wKey, field] of WINDOWS) {
    const win = world.windows.find((w) => String(w.key) === wKey)
    if (!win) die(`tier-list no longer publishes the "${wKey}" window`)

    for (const tier of win.data?.tiers ?? []) {
      for (const b of tier.blades ?? []) {
        const rec = out.get(b.name) ?? { name: b.name, allTime: 0, recent90: 0 }
        rec[field] = b.results ?? 0
        if (wKey === 'all') {
          rec.firsts = b.wins ?? 0
          if (b.topRatchet) rec.topRatchet = b.topRatchet
          if (b.topBit) rec.topBit = b.topBit
        }
        out.set(b.name, rec)
      }
    }
  }
  return [...out.values()]
}

/** The Taiwan sheet is still the catalogue: it decides which parts exist. */
async function loadCatalogue() {
  const [blades, parts] = await Promise.all([
    get(sheet('101080139')).then(parseCSV),
    get(sheet('1809991430')).then(parseCSV),
  ])

  const enById = JSON.parse(readFileSync(join(ROOT, 'src/data/bladeNamesEn.json'), 'utf8'))
  const enByZh = JSON.parse(readFileSync(join(ROOT, 'src/data/bladeNamesZhEn.json'), 'utf8'))
  const aliases = JSON.parse(readFileSync(join(ROOT, 'src/data/bladeAliasesEn.json'), 'utf8'))

  // slug(English name) -> canonical blade key, for matching BBXHub's names.
  const bladeByEn = new Map()

  for (const row of blades.slice(1)) {
    const id = (row[0] ?? '').trim()
    const zh = (row[1] ?? '').trim()
    if (!id || (row[2] ?? '').trim() !== 'blade') continue

    const key = baseName(zh)
    const en = enById[id] ?? enByZh[key]
    if (en && !bladeByEn.has(slug(en))) bladeByEn.set(slug(en), key)
  }

  // Names the feed still uses for a blade we have since renamed. Added after
  // the real names so a live name always wins the slug it owns.
  for (const [en, key] of Object.entries(aliases.aliases)) {
    if (!bladeByEn.has(slug(en))) bladeByEn.set(slug(en), key)
  }

  const ids = { ratchet: new Map(), bit: new Map(), assist: new Map() }
  for (const row of parts.slice(1)) {
    const id = (row[0] ?? '').trim()
    const cat = (row[1] ?? '').trim()
    if (!id || !(cat in ids)) continue
    // Assist blades are keyed "輔助H" in the sheet; BBXHub says "Heavy".
    const lookup = cat === 'assist' ? id.replace(/^輔助/, '') : id
    if (!ids[cat].has(lookup.toLowerCase())) ids[cat].set(lookup.toLowerCase(), id)
  }

  return { bladeByEn, ids }
}

/**
 * Resolves one BBXHub blade name to a catalogue key.
 *
 * CX beys are reported as "UnicornDelta PeakHeavy" — lock chip, main blade and
 * assist blade in one string — so the first token is the part we rank. The typo
 * pass exists because these names are typed by hand at events: "SliverWolf" and
 * "ColbaltDragoon" are the same blades as everyone else's.
 */
function resolveBlade(entry, bladeByEn) {
  const candidates = [entry.name, entry.name.split(/\s+/)[0], ...(entry.aliases ?? [])]

  for (const c of candidates) {
    const hit = bladeByEn.get(slug(c))
    if (hit) return { key: hit, how: 'name' }
  }

  for (const c of candidates) {
    const s = slug(c)
    // Short names are too easy to land within two edits of the wrong blade.
    if (s.length < 5) continue
    let best = null
    let bestD = 3
    for (const [known, key] of bladeByEn) {
      const d = editDistance(s, known, 2)
      if (d < bestD) {
        bestD = d
        best = key
      }
    }
    if (best) return { key: best, how: 'typo' }
  }

  return null
}

function main(windows, blades, catalogue) {
  const byWindow = new Map(windows.map((w) => [String(w.key), w]))
  for (const [key] of WINDOWS) {
    if (!byWindow.has(key)) die(`BBXHub no longer publishes the "${key}" window`)
  }

  const all = byWindow.get('all')
  if (!all.categories?.blade || !all.stats) {
    die('the "all" window is missing its categories or stats — BBXHub shape changed')
  }

  // Aliases are published on the homepage listing while the records come from
  // the tier-list page — carry them across so both spellings still resolve.
  const aliases = new Map(all.categories.blade.map((e) => [e.name, e.aliases ?? []]))

  // The tier-list page names a blade's usual bit in full ("Hexa"), but every
  // catalogue and build string uses the code ("H"). Only the homepage carries
  // both, so translate here rather than leaving the app to guess.
  const bitCodes = new Map(
    (all.categories.bit ?? []).filter((e) => e.short).map((e) => [e.name, e.short]),
  )

  const parts = new Map()
  const unmatched = new Map()
  const stats = {}

  const add = (cat, key, name, field, count, extra) => {
    const id = cat + ' ' + key
    const part = parts.get(id) ?? { cat, key, name, allTime: 0, recent90: 0 }
    // Several BBXHub rows fold onto one part (typos, CX compounds), so sum.
    part[field] += count
    // Blades arrive highest-placing first, so the first label to land wins.
    for (const [k, v] of Object.entries(extra ?? {})) {
      if (v !== undefined && part[k] === undefined) part[k] = v
    }
    parts.set(id, part)
  }

  for (const rec of blades) {
    const hit = resolveBlade({ name: rec.name, aliases: aliases.get(rec.name) }, catalogue.bladeByEn)
    if (!hit) {
      unmatched.set(rec.name, rec.allTime)
      continue
    }
    stats[hit.how] = (stats[hit.how] ?? 0) + 1
    add('blade', hit.key, rec.name, 'allTime', rec.allTime, {
      firsts: rec.firsts,
      topRatchet: rec.topRatchet,
      topBit: rec.topBit ? (bitCodes.get(rec.topBit) ?? rec.topBit) : undefined,
    })
    add('blade', hit.key, rec.name, 'recent90', rec.recent90)
  }

  for (const [wKey, field] of WINDOWS) {
    const cats = byWindow.get(wKey).categories ?? {}

    for (const entry of cats.ratchet ?? []) {
      const id = catalogue.ids.ratchet.get(entry.name.toLowerCase()) ?? entry.name
      add('ratchet', id, entry.name, field, entry.count)
    }

    for (const entry of cats.bit ?? []) {
      const code = entry.short || entry.name
      const id = catalogue.ids.bit.get(code.toLowerCase()) ?? code
      add('bit', id, entry.name, field, entry.count)
    }

    for (const entry of cats.assistBlade ?? []) {
      // "Heavy" -> H -> 輔助H. All thirteen initials are distinct, so the
      // first letter is enough to identify the blade.
      const initial = entry.name.trim()[0] ?? ''
      const id = catalogue.ids.assist.get(initial.toLowerCase())
      if (id) add('assist', id, entry.name, field, entry.count)
      else if (wKey === 'all') unmatched.set('assist:' + entry.name, entry.count)
    }
  }

  const totalAll = blades.reduce((n, b) => n + b.allTime, 0)
  const matchedAll = [...parts.values()]
    .filter((p) => p.cat === 'blade')
    .reduce((n, p) => n + p.allTime, 0)

  return {
    data: {
      fetchedAt: new Date().toISOString(),
      source: {
        name: 'BBXHub',
        url: BBXHUB,
        upstream: 'WBO Winning Combinations at Organized Events, plus German Blader League',
        upstreamUrl: UPSTREAM,
        coverage: { events: all.stats.events, combos: all.stats.combos },
        windows: Object.fromEntries(
          WINDOWS.map(([k, field]) => [
            field,
            { from: byWindow.get(k).from, to: byWindow.get(k).to, ...byWindow.get(k).stats },
          ]),
        ),
      },
      parts: [...parts.values()].sort((a, b) => b.allTime - a.allTime),
      unmatched: [...unmatched.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    },
    report: {
      coverage: totalAll ? (100 * matchedAll) / totalAll : 0,
      stats,
      matchedAll,
      totalAll,
    },
  }
}

const [home, tiers, catalogue] = await Promise.all([
  get(BBXHUB),
  get(BBXHUB_TIERS),
  loadCatalogue(),
])

const { data, report } = main(
  arrayAfter(payloadOf(home, 'homepage'), '"windows":[', 'homepage'),
  bladeRecords(tiers),
  catalogue,
)

// A dataset that quietly shrinks is worse than a failed run: every part would
// drop to "no tournament record" and the whole list would cap at A+.
if (existsSync(OUT)) {
  const prev = JSON.parse(readFileSync(OUT, 'utf8'))
  const was = prev.source?.coverage?.events ?? 0
  if (data.source.coverage.events < was * COVERAGE_FLOOR) {
    die(`coverage collapsed: ${was} events -> ${data.source.coverage.events}. Keeping previous data.`)
  }
}

const counts = data.parts.reduce((acc, p) => ({ ...acc, [p.cat]: (acc[p.cat] ?? 0) + 1 }), {})
if (!counts.blade || !counts.ratchet || !counts.bit) {
  die(`a whole category came back empty: ${JSON.stringify(counts)}`)
}

writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`)

console.log(`✓ ${data.source.coverage.events} events · ${data.source.coverage.combos} combos`)
console.log(`  parts: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
console.log(
  `  blade placements matched: ${report.matchedAll}/${report.totalAll}` +
    ` (${report.coverage.toFixed(1)}%) — ${report.stats.name ?? 0} by name,` +
    ` ${report.stats.typo ?? 0} by typo recovery`,
)
if (data.unmatched.length) {
  console.log(`  unmatched (${data.unmatched.length}):`)
  for (const u of data.unmatched.slice(0, 12)) console.log(`    ${u.name} — ${u.count}`)
}
