#!/usr/bin/env node
/**
 * Downloads the dataset snapshots from the live data site into public/data/.
 *
 * The read half of the git → Firebase migration. No auth: the data site is a
 * public, static Firebase Hosting site. Used two ways —
 *
 *   1. In a scraper workflow, to place the current snapshot where the scraper
 *      expects it, so its "did anything actually move?" check still works and
 *      `updatedAt` keeps meaning "when the data last changed" rather than "when
 *      the job last ran". The whole set is pulled so a single-dataset deploy can
 *      re-publish all five without dropping the ones it didn't touch.
 *   2. To populate a fresh checkout for local development, since the JSON no
 *      longer lives in the repo.
 *
 * Pass file names to fetch a subset; with no arguments it fetches all five.
 *   node scripts/data-pull.mjs            # everything
 *   node scripts/data-pull.mjs stock.json # just stock
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'public/data')

// The production data site. Overridable to point at a staging site.
const rawBase = process.env.DATA_BASE_URL || 'https://beyclub-90e95.web.app/'
const BASE = rawBase.endsWith('/') ? rawBase : `${rawBase}/`

const ALL = ['catalogue.json', 'stock.json', 'tournament.json', 'tiers-jp.json', 'part-notes.json']
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL

mkdirSync(DIR, { recursive: true })

let ok = 0
for (const name of targets) {
  const url = `${BASE}data/${name}`
  const res = await fetch(url, { headers: { 'user-agent': 'beyclub-data-pull' } })
  if (!res.ok) {
    // A 404 before the site is seeded is expected — the scraper that follows
    // will create the file — so this is a warning, not a failure.
    console.warn(`- ${name}: ${res.status} ${res.statusText}`)
    continue
  }
  writeFileSync(join(DIR, name), Buffer.from(await res.arrayBuffer()))
  ok++
  console.log(`↓ ${name}`)
}

console.log(`\n${ok}/${targets.length} file(s) pulled from ${BASE}data/`)
