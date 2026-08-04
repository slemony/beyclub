#!/usr/bin/env node
/**
 * Downloads the dataset snapshots from the shared bucket into public/data/.
 *
 * The read half of the git → Firebase migration. No auth: the bucket is
 * world-readable. Used two ways —
 *
 *   1. In a scraper workflow, to place the current snapshot where the scraper
 *      expects it, so its "did anything actually move?" check still works and
 *      `updatedAt` keeps meaning "when the data last changed" rather than "when
 *      the job last ran".
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

const BUCKET = process.env.DATA_BUCKET || 'beyclub.firebasestorage.app'
const BASE = process.env.DATA_BASE_URL || `https://storage.googleapis.com/${BUCKET}/`

const ALL = ['catalogue.json', 'stock.json', 'tournament.json', 'tiers-jp.json', 'part-notes.json']
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL

mkdirSync(DIR, { recursive: true })

let ok = 0
for (const name of targets) {
  const url = `${BASE}data/${name}`
  const res = await fetch(url, { headers: { 'user-agent': 'beyclub-data-pull' } })
  if (!res.ok) {
    // A 404 on first run is expected — the scraper that follows will create the
    // file — so this is a warning, not a failure.
    console.warn(`- ${name}: ${res.status} ${res.statusText}`)
    continue
  }
  writeFileSync(join(DIR, name), Buffer.from(await res.arrayBuffer()))
  ok++
  console.log(`↓ ${name}`)
}

console.log(`\n${ok}/${targets.length} file(s) pulled from ${BASE}data/`)
