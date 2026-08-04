#!/usr/bin/env node
/**
 * Stages the dataset snapshots into data-dist/data/ for a Firebase Hosting
 * deploy of the data site.
 *
 * The write half of the git → Firebase migration. The scrapers write JSON into
 * public/data/ exactly as before; this copies them into the folder
 * firebase.json serves as the data site, which is then deployed with
 * `firebase deploy --only hosting:beyclub-90e95`. Nothing is committed to git.
 *
 * All five files are staged, not just the changed one, because a Hosting deploy
 * publishes the whole directory — staging a subset would drop the datasets this
 * run didn't touch. Callers therefore `data:pull` the full set first, overwrite
 * the one they scraped, then stage.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'public/data')
const OUT = join(ROOT, 'data-dist/data')

const ALL = ['catalogue.json', 'stock.json', 'tournament.json', 'tiers-jp.json', 'part-notes.json']

mkdirSync(OUT, { recursive: true })

let staged = 0
for (const name of ALL) {
  const from = join(SRC, name)
  if (!existsSync(from)) {
    console.log(`- ${name} absent locally, skipped`)
    continue
  }
  writeFileSync(join(OUT, name), readFileSync(from))
  staged++
  console.log(`→ ${name}`)
}

console.log(`\n${staged} file(s) staged into data-dist/data/`)
