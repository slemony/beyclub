#!/usr/bin/env node --experimental-strip-types
/**
 * Snapshots the Taiwan community sheet — the app's catalogue of which parts
 * exist — into a committed copy the client reads instead of hitting Google
 * Sheets on every load.
 *
 * A straight snapshot of the parsed rows, not a reshaping: `loadCatalogue()`
 * in src/lib/loadData.ts keeps doing its own column parsing, just against this
 * file instead of a live fetch, so a sheet-layout change still surfaces there
 * rather than being silently reinterpreted here.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseCSV } from '../src/lib/csv.ts'
import { ENDPOINTS } from '../src/lib/sources.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/data/catalogue.json')

/** How far the sheet may shrink before we assume the fetch is broken. */
const COVERAGE_FLOOR = 0.75

const die = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'beyclub-catalogue-refresh' } })
  if (!res.ok) die(`${url} returned ${res.status} ${res.statusText}`)
  return res.text()
}

const [blades, parts] = await Promise.all([
  get(ENDPOINTS.blades).then(parseCSV),
  get(ENDPOINTS.parts).then(parseCSV),
])

if (blades.length < 2) die('blades sheet came back with no rows — fetch likely broken')
if (parts.length < 2) die('parts sheet came back with no rows — fetch likely broken')

if (existsSync(OUT)) {
  const prev = JSON.parse(readFileSync(OUT, 'utf8'))
  const wasBlades = prev.blades?.length ?? 0
  const wasParts = prev.parts?.length ?? 0
  if (blades.length < wasBlades * COVERAGE_FLOOR || parts.length < wasParts * COVERAGE_FLOOR) {
    die(
      `catalogue collapsed: blades ${wasBlades} -> ${blades.length}, ` +
        `parts ${wasParts} -> ${parts.length}. Keeping previous data.`,
    )
  }
}

const data = { fetchedAt: new Date().toISOString(), blades, parts }

if (existsSync(OUT)) {
  const prev = JSON.parse(readFileSync(OUT, 'utf8'))
  if (JSON.stringify(prev.blades) === JSON.stringify(blades) && JSON.stringify(prev.parts) === JSON.stringify(parts)) {
    console.log(`✓ unchanged — ${blades.length - 1} blade rows, ${parts.length - 1} part rows`)
    process.exit(0)
  }
}

writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`)

console.log(`✓ ${blades.length - 1} blade rows, ${parts.length - 1} part rows`)
