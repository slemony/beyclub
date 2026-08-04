#!/usr/bin/env node
/**
 * Uploads the dataset snapshots to the shared Firebase Cloud Storage bucket.
 *
 * The write half of the git → Firebase migration. The scrapers write JSON into
 * public/data/ exactly as before; this pushes the files whose contents changed
 * to gs://<bucket>/data/, where both the test and production sites read them
 * live. Nothing is committed to the repository.
 *
 * A file identical to the one already in the bucket is skipped, so the object's
 * generation and CDN cache stay put on a scrape that found no movement — the
 * same "don't churn when nothing changed" discipline the scrapers apply to
 * their local writes.
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS must point at a service-account key with
 * Storage Object Admin on the bucket. In CI, google-github-actions/auth sets
 * this up; locally, `gcloud auth application-default login` does. Bucket name
 * overridable with DATA_BUCKET.
 *
 * Pass file names to push a subset; with no arguments it considers all five —
 * handy for a one-time seed or after a curated edit to tiers-jp / part-notes.
 *   node scripts/data-push.mjs             # seed / push everything changed
 *   node scripts/data-push.mjs stock.json  # just stock
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Storage } from '@google-cloud/storage'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'public/data')

const BUCKET = process.env.DATA_BUCKET || 'beyclub.firebasestorage.app'

// Stock moves twice a day; five minutes keeps the sites fresh without giving up
// CDN caching. The curated files barely move but share the window for
// simplicity — a hand edit is live within five minutes of a push.
const CACHE_CONTROL = 'public, max-age=300'

const ALL = ['catalogue.json', 'stock.json', 'tournament.json', 'tiers-jp.json', 'part-notes.json']
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL

const bucket = new Storage().bucket(BUCKET)

let uploaded = 0
for (const name of targets) {
  const path = join(DIR, name)
  if (!existsSync(path)) {
    console.log(`- ${name} absent locally, skipped`)
    continue
  }

  const local = readFileSync(path)
  const file = bucket.file(`data/${name}`)

  const [exists] = await file.exists()
  if (exists) {
    const [remote] = await file.download()
    if (remote.equals(local)) {
      console.log(`= ${name} unchanged`)
      continue
    }
  }

  await file.save(local, {
    resumable: false,
    metadata: { contentType: 'application/json; charset=utf-8', cacheControl: CACHE_CONTROL },
  })
  uploaded++
  console.log(`↑ ${name} (${local.length} bytes)`)
}

console.log(`\n${uploaded} file(s) uploaded to gs://${BUCKET}/data/`)
