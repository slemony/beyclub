import bladeNamesEn from '../data/bladeNamesEn.json'
import bladeNamesZhEn from '../data/bladeNamesZhEn.json'
import { calculateBuyRec, getBuyRec } from './buyRec'
import { parseCSV } from './csv'
import { ENDPOINTS } from './sources'
import type {
  BuyAdvice,
  ComboStat,
  Dataset,
  Part,
  PartCategory,
  PartNotes,
  PartType,
  SourceId,
} from './types'

const EN_NAMES = bladeNamesEn as Record<string, string>
const ZH_EN_NAMES = bladeNamesZhEn as Record<string, string>
const CACHE_VERSION = 'v1'

/**
 * The sheet lists colour variants and repackages under their own product codes
 * (BX-35-04 is a Wizard Rod booster), so an id lookup alone misses most English
 * names. Falling back to the Chinese name — with variant suffixes like (綠)
 * stripped — covers those.
 */
function englishName(id: string, zhName: string): string | undefined {
  const direct = EN_NAMES[id]
  if (direct) return direct
  const base = zhName.replace(/[（(].*?[)）]/g, '').replace(/\s.*$/, '').trim()
  return ZH_EN_NAMES[base]
}
const cacheKey = (source: SourceId) => `beyclub:tiers:${CACHE_VERSION}:${source}`

/** Sheets are edited constantly; bust any intermediary cache. */
async function fetchCsv(url: string): Promise<string[][]> {
  const res = await fetch(`${url}&_=${Date.now()}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return parseCSV(await res.text())
}

const cell = (row: string[], i: number) => (row[i] ?? '').trim()

function toCategory(raw: string): PartCategory | null {
  const v = raw.toLowerCase()
  if (v === 'blade' || v === 'ratchet' || v === 'bit' || v === 'assist') return v
  return null
}

/**
 * The community sheet stores buy advice in Chinese or as a bare mark; anything
 * we don't recognise becomes "no opinion" rather than a wrong recommendation.
 */
function toBuyAdvice(raw: string): BuyAdvice {
  const v = raw.toLowerCase()
  if (v === 'yes' || v.includes('推薦購買') || v.includes('✅')) return 'yes'
  if (v === 'maybe' || v.includes('視情況') || v.includes('⚠')) return 'maybe'
  if (v === 'no' || v.includes('不推薦') || v.includes('❌')) return 'no'
  return ''
}

/** Blade database — the community tier list. */
async function loadCommunityParts(): Promise<Part[]> {
  const [blades, parts] = await Promise.all([
    fetchCsv(ENDPOINTS.blades),
    fetchCsv(ENDPOINTS.parts),
  ])

  const out: Part[] = []
  const seen = new Set<string>()

  // Parts catalogue first: blades reference these for their stock part grades.
  // Sheet columns: name, category, img, tier
  const partTiers = new Map<string, string>()
  for (const row of parts.slice(1)) {
    const id = cell(row, 0)
    const cat = toCategory(cell(row, 1))
    const tier = cell(row, 3)
    if (!id || !cat || !tier) continue

    partTiers.set(`${id}|${cat}`, tier)

    const key = `${id}|${cat}`
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      id,
      // Assist blades are keyed "輔助X" in the sheet; the code is the useful part.
      name: cat === 'assist' ? id.replace(/^輔助/, '') : id,
      cat,
      type: cat as PartType,
      tier,
      buy: getBuyRec(tier),
      img: cell(row, 2) || undefined,
    })
  }

  // Blades sheet: ID, name, cat, type, tier, buy, ratchet, ratchetTier, bit,
  // bitTier, assist, product, img, combo, note, communityCombo
  for (const row of blades.slice(1)) {
    const id = cell(row, 0)
    const cat = toCategory(cell(row, 2))
    const tier = cell(row, 4)
    if (!id || !cat || !tier) continue

    // Colour variants share a product code (BX-35-04); keep the first listing.
    const key = `${id}|${cat}`
    if (seen.has(key)) continue
    seen.add(key)

    const stockRatchet = cell(row, 6)
    const stockBit = cell(row, 8)
    const assist = cell(row, 10)

    // The catalogue is the better grade source; the blade row is the fallback.
    const ratchetTier = partTiers.get(`${stockRatchet}|ratchet`) || cell(row, 7)
    const bitTier = partTiers.get(`${stockBit}|bit`) || cell(row, 9)
    const assistTier = partTiers.get(`${assist}|assist`)

    // The sheet leaves its buy column blank and expects it to be computed.
    const declaredBuy = toBuyAdvice(cell(row, 5))
    const buy =
      declaredBuy ||
      (cat === 'blade'
        ? calculateBuyRec(tier, ratchetTier, bitTier, assistTier)
        : getBuyRec(tier))

    out.push({
      id,
      name: cell(row, 1) || id,
      nameEn: englishName(id, cell(row, 1)),
      cat,
      type: (cell(row, 3) || cat) as PartType,
      tier,
      buy,
      stockRatchet: stockRatchet || undefined,
      stockBit: stockBit || undefined,
      ratchetTier: ratchetTier || undefined,
      bitTier: bitTier || undefined,
      product: cell(row, 11) || undefined,
      img: cell(row, 12) || undefined,
      combo: [cell(row, 13), cell(row, 14)].filter(Boolean).join('\n') || undefined,
      communityCombo: cell(row, 15) || undefined,
    })
  }

  return out
}

/** Aggregated combo results, newest-weighted by the source's own ranking. */
async function loadComboStats(): Promise<ComboStat[]> {
  const rows = await fetchCsv(ENDPOINTS.comboStats)
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => head.indexOf(name)

  const iRank = col('site_recommendation_rank')
  const iBladeId = col('site_blade_id')
  const iBladeName = col('site_blade_name')
  const iRatchet = col('ratchet')
  const iBit = col('bit')
  const iWins = col('total_wins')
  const iFirst = col('first_count')
  const iSecond = col('second_count')
  const iThird = col('third_count')
  const iRate = col('champion_rate')
  const iLast = col('last_date')
  const iKey = col('site_combo_key')

  const num = (row: string[], i: number) => {
    const v = Number(cell(row, i))
    return Number.isFinite(v) ? v : 0
  }

  return rows
    .slice(1)
    .filter((row) => cell(row, iBladeId))
    .map((row) => ({
      key: cell(row, iKey) || `${cell(row, iBladeId)}|${cell(row, iRatchet)}|${cell(row, iBit)}`,
      bladeId: cell(row, iBladeId),
      bladeName: cell(row, iBladeName),
      ratchet: cell(row, iRatchet),
      bit: cell(row, iBit),
      wins: num(row, iWins),
      firsts: num(row, iFirst),
      seconds: num(row, iSecond),
      thirds: num(row, iThird),
      championRate: cell(row, iRate) ? num(row, iRate) : null,
      lastDate: cell(row, iLast),
      rank: num(row, iRank),
    }))
    .sort((a, b) => a.rank - b.rank)
}

/**
 * Tournament view: parts ranked by how often they actually placed, rather than
 * by anyone's opinion. Tiers are assigned by share of total wins so the scale
 * stays comparable to the community list.
 */
function partsFromCombos(combos: ComboStat[], community: Part[]): Part[] {
  const byBlade = new Map<string, { wins: number; firsts: number; last: string }>()

  for (const c of combos) {
    const agg = byBlade.get(c.bladeId) ?? { wins: 0, firsts: 0, last: '' }
    agg.wins += c.wins
    agg.firsts += c.firsts
    if (c.lastDate > agg.last) agg.last = c.lastDate
    byBlade.set(c.bladeId, agg)
  }

  const lookup = new Map(community.filter((p) => p.cat === 'blade').map((p) => [p.id, p]))
  const top = Math.max(...[...byBlade.values()].map((a) => a.wins), 1)

  return [...byBlade.entries()]
    .map(([id, agg]) => {
      const base = lookup.get(id)
      const share = agg.wins / top
      const tier =
        share >= 0.5 ? 'X' : share >= 0.25 ? 'S' : share >= 0.1 ? 'A' : share >= 0.04 ? 'B' : 'C'

      return {
        id,
        name: base?.name ?? id,
        nameEn: englishName(id, base?.name ?? ''),
        cat: 'blade' as PartCategory,
        type: (base?.type ?? 'balance') as PartType,
        tier,
        // Same package grading as the community view, so a blade doesn't read
        // "worth buying" on one tab and "situational" on another.
        buy: calculateBuyRec(tier, base?.ratchetTier, base?.bitTier),
        img: base?.img,
        stockRatchet: base?.stockRatchet,
        stockBit: base?.stockBit,
        ratchetTier: base?.ratchetTier,
        bitTier: base?.bitTier,
        combo: base?.combo,
        communityCombo: base?.communityCombo,
        stats: {
          wins: agg.wins,
          firsts: agg.firsts,
          championRate: null,
          lastSeen: agg.last,
        },
      }
    })
    .sort((a, b) => (b.stats?.wins ?? 0) - (a.stats?.wins ?? 0))
}

type JapanFile = {
  curatedAt: string
  source: { author: string; sourceName: string; sourceUrl: string }
  parts: (Part & { productCode: string | null })[]
}

/**
 * Hand-curated Japanese list. The file itself holds only rankings and credits;
 * images and part types are inherited from the shared catalogue by product
 * code, so we never hotlink the original author's images.
 */
async function loadJapan(community: Part[]): Promise<Part[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/tiers-jp.json`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const json = (await res.json()) as JapanFile

  const byCode = new Map<string, Part>()
  for (const p of community) {
    if (p.cat !== 'blade') continue
    // Sheet ids may carry a variant suffix (UX-15-01); index the base code too.
    const base = p.id.split('-').slice(0, 2).join('-')
    if (!byCode.has(base)) byCode.set(base, p)
    byCode.set(p.id, p)
  }

  return json.parts.map((p) => {
    const match = p.productCode ? byCode.get(p.productCode) : undefined
    return {
      ...p,
      // Prefer the catalogue's English name: the curated file keys on the base
      // product code (UX-15) while the catalogue lists variants (UX-15-01).
      nameEn: p.nameEn ?? match?.nameEn ?? (p.productCode ? EN_NAMES[p.productCode] : undefined),
      img: match?.img,
      type: match?.type ?? p.type,
      buy: calculateBuyRec(p.tier, match?.ratchetTier, match?.bitTier),
      stockRatchet: match?.stockRatchet,
      stockBit: match?.stockBit,
      ratchetTier: match?.ratchetTier,
      bitTier: match?.bitTier,
      combo: match?.combo,
      communityCombo: match?.communityCombo,
    }
  })
}

/** BeyClub's editorial notes, keyed "category:id". */
export async function loadPartNotes(): Promise<Record<string, PartNotes>> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/part-notes.json`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const json = (await res.json()) as { notes: Record<string, PartNotes> }
  return json.notes ?? {}
}

function readCache(source: SourceId): Dataset | null {
  try {
    const raw = localStorage.getItem(cacheKey(source))
    return raw ? (JSON.parse(raw) as Dataset) : null
  } catch {
    return null
  }
}

function writeCache(source: SourceId, data: Dataset) {
  try {
    localStorage.setItem(cacheKey(source), JSON.stringify(data))
  } catch {
    // Quota exceeded or private mode — cache is a nicety, not a requirement.
  }
}

/**
 * Loads a dataset, falling back to the last good copy when the network fails so
 * the page always has something to render.
 */
export async function loadDataset(source: SourceId): Promise<Dataset> {
  try {
    let parts: Part[] = []
    let combos: ComboStat[] = []

    if (source === 'community') {
      parts = await loadCommunityParts()
    } else if (source === 'tournament') {
      const [community, stats] = await Promise.all([loadCommunityParts(), loadComboStats()])
      combos = stats
      parts = partsFromCombos(stats, community)
    } else {
      const community = await loadCommunityParts()
      parts = await loadJapan(community)
    }

    const data: Dataset = { parts, combos, fetchedAt: new Date().toISOString(), stale: false }
    writeCache(source, data)
    return data
  } catch (err) {
    const cached = readCache(source)
    if (cached) return { ...cached, stale: true }
    throw err
  }
}
