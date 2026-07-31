#!/usr/bin/env node
/**
 * Folds the bit encyclopedia into public/data/part-notes.json.
 *
 * The HTML holds the measurements — stats, weight, line, debut product — and
 * `bit-notes-en.json` holds the English prose, because a regex cannot translate.
 * Keeping the two apart means re-running this after an edit to the encyclopedia
 * refreshes the numbers without disturbing the writing.
 *
 * Run: node scripts/import-bit-notes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'scripts/sources/beyblade-x-bits.html')
const EN = join(ROOT, 'scripts/sources/bit-notes-en.json')
const OUT = join(ROOT, 'public/data/part-notes.json')

const die = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

const text = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

const one = (block, re) => {
  const m = block.match(re)
  return m ? text(m[1]) : undefined
}

/** The stat labels are Chinese in the source; these are the four axes. */
const STAT_KEYS = { 攻击: 'attack', 体力: 'stamina', 防御: 'defense', 防爆: 'burst' }

function parseCards(html) {
  const blocks = html.split(/(?=<div class="bit-card")/).slice(1)
  if (blocks.length < 40) die(`only found ${blocks.length} bit cards — the markup changed`)

  return blocks.map((block) => {
    const code = one(block, /class="bit-icon"[^>]*>([\s\S]*?)<\/div>/)
    const label = one(block, /class="bit-abbr"[^>]*>([\s\S]*?)<\/div>/)
    const zh = one(block, /class="bit-name">([\s\S]*?)<\/div>/)
    if (!code || !label) die('a card is missing its code or name')

    const stats = {}
    for (const [, cn, value] of block.matchAll(
      /stat-label-sm">([^<]+)<[\s\S]*?stat-val">(\d+)</g,
    )) {
      const key = STAT_KEYS[cn.trim()]
      if (key) stats[key] = Number(value)
    }
    // Three cards (R, HT, GF) omit the defence bar. Leaving the key out is
    // honest; filling in a guess would put an invented number on screen.
    // Compared against undefined, not falsiness: a bit legitimately rated 0 for
    // attack is data, not a parse failure.
    if (stats.attack === undefined || stats.stamina === undefined) {
      die(`${code} is missing its core stats`)
    }

    const weight = block.match(/tag-weight">≈([\d.]+)g</)
    const debut = block.match(/font-size:10px;padding:2px 7px;">([^<]*)</)
    const line = block.match(/data-line="(\w+)"/)

    return {
      code,
      profile: {
        label: label.replace(/\b(\w)(\w*)/g, (_, a, b) => a + b.toLowerCase()),
        // "F · 平底" — keep only the Chinese half, the code is already the key.
        labelZh: zh?.split('·').pop()?.trim() || undefined,
        line: line ? line[1].toUpperCase() : undefined,
        weightG: weight ? Number(weight[1]) : undefined,
        debut: debut ? debut[1].trim() : undefined,
        stats,
      },
    }
  })
}

const cards = parseCards(readFileSync(SRC, 'utf8'))
const english = JSON.parse(readFileSync(EN, 'utf8'))
const file = JSON.parse(readFileSync(OUT, 'utf8'))

const missing = cards.filter((c) => !english[c.code]).map((c) => c.code)
if (missing.length) die(`no English written for: ${missing.join(', ')}`)

let added = 0
let updated = 0
for (const { code, profile } of cards) {
  const key = `bit:${code}`
  const { summary, pros, cons } = english[code]
  if (file.notes[key]) updated++
  else added++

  file.notes[key] = { ...file.notes[key], summary, pros, cons, profile }
}

file.updatedAt = new Date().toISOString().slice(0, 10)
writeFileSync(OUT, `${JSON.stringify(file, null, 2)}\n`)

const bits = Object.keys(file.notes).filter((k) => k.startsWith('bit:')).length
console.log(`✓ ${cards.length} bit profiles — ${added} new, ${updated} replaced`)
console.log(`  part-notes.json now holds ${bits} bits and ${Object.keys(file.notes).length} notes total`)
