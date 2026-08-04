import bladeNamesEn from '../data/bladeNamesEn.json'
import bladeNamesZhEn from '../data/bladeNamesZhEn.json'
import manualParts from '../data/manualParts.json'
import partOverrides from '../data/partOverrides.json'
import { calculateBuyRec } from './buyRec'
import { dataUrl } from './dataSource'
import { blendRating, tournamentScore } from './rating'
import { baseName, normalize } from './text'
import type {
  Dataset,
  Part,
  PartCategory,
  PartNotes,
  PartType,
  RatingSources,
  TournamentFile,
  TournamentRecord,
} from './types'

const EN_NAMES = bladeNamesEn as Record<string, string>
const ZH_EN_NAMES = bladeNamesZhEn as Record<string, string>

/** Per-row corrections for sheet quirks — see the note in the file itself. */
type Override = { id?: string; nameEn?: string; blade?: string }
const OVERRIDES = partOverrides as Record<string, Override | string>
const overrideFor = (id: string): Override =>
  typeof OVERRIDES[id] === 'object' ? (OVERRIDES[id] as Override) : {}

// v3: one blended list rather than three switchable ones.
const CACHE_KEY = 'beyclub:tiers:v3'

/**
 * The per-source caches this replaced, plus the switcher's last selection.
 *
 * The tournament entry embedded a whole combo table, so leaving these behind
 * costs a returning user close to a megabyte of unreachable data — and the
 * write below swallows a quota error by design, which would silently disable
 * the offline fallback for exactly the people who have used the app before.
 */
const RETIRED_KEYS = [
  'beyclub:tiers:v1:community',
  'beyclub:tiers:v1:tournament',
  'beyclub:tiers:v1:japan',
  'beyclub:source',
]

/**
 * The sheet lists colour variants and repackages under their own product codes
 * (BX-35-04 is a Wizard Rod booster), so an id lookup alone misses most English
 * names. Falling back to the blade's base Chinese name covers those.
 */
function englishName(id: string, zhName: string): string | undefined {
  return EN_NAMES[id] ?? ZH_EN_NAMES[baseName(zhName)]
}

/** Our own snapshot of the Taiwan sheet, refreshed daily by scripts/fetch-catalogue.mjs. */
type CatalogueFile = { fetchedAt: string; blades: string[][]; parts: string[][] }

async function loadCatalogueFile(): Promise<CatalogueFile> {
  const res = await fetch(dataUrl('catalogue.json'))
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as CatalogueFile
}

const cell = (row: string[], i: number) => (row[i] ?? '').trim()

function toCategory(raw: string): PartCategory | null {
  const v = raw.toLowerCase()
  if (v === 'blade' || v === 'ratchet' || v === 'bit' || v === 'assist') return v
  return null
}

/** A part as the Taiwan sheet describes it, before any ranking is applied. */
type Raw = Omit<Part, 'tier' | 'buy'> & {
  communityTier: string
  key: string
}

/**
 * A hand-added entry from manualParts.json — the fields that file is allowed to
 * set. Spelled out because the list is usually empty, which would otherwise
 * leave the loop below inferring `never`, and because it is the only
 * description of the shape whoever adds the next announced set will follow.
 */
type ManualPart = Partial<Raw> & {
  id: string
  name: string
  cat: PartCategory
  type: PartType
  communityTier: string
}

const MANUAL_PARTS = manualParts.parts as ManualPart[]

/**
 * The Taiwan catalogue: which parts exist, what they look like and what they
 * ship with. Its tier column becomes one input to the blend rather than the
 * final word.
 */
async function loadCatalogue(): Promise<Raw[]> {
  const { blades, parts } = await loadCatalogueFile()

  const out: Raw[] = []
  const seen = new Set<string>()

  // Parts catalogue: ratchets, bits and assist blades. Columns: name, category,
  // image, tier.
  for (const row of parts.slice(1)) {
    const id = cell(row, 0)
    const cat = toCategory(cell(row, 1))
    const tier = cell(row, 3)
    if (!id || !cat || !tier) continue

    const key = `${id}|${cat}`
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      id,
      // Assist blades are keyed "輔助X" in the sheet; the code is the useful part.
      name: cat === 'assist' ? id.replace(/^輔助/, '') : id,
      cat,
      type: cat as PartType,
      communityTier: tier,
      key: id,
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

    const key = `${id}|${cat}`
    if (seen.has(key)) continue
    seen.add(key)

    const name = cell(row, 1) || id
    const fix = overrideFor(id)

    out.push({
      id: fix.id ?? id,
      name,
      nameEn: fix.nameEn ?? englishName(id, name),
      cat,
      type: (cell(row, 3) || cat) as PartType,
      communityTier: tier,
      // Colour variants and metal coatings share one blade's record.
      key: fix.blade ?? baseName(name),
      stockRatchet: cell(row, 6) || undefined,
      stockBit: cell(row, 8) || undefined,
      stockAssist: cell(row, 10) || undefined,
      product: cell(row, 11) || undefined,
      img: cell(row, 12) || undefined,
      combo: [cell(row, 13), cell(row, 14)].filter(Boolean).join('\n') || undefined,
      communityCombo: cell(row, 15) || undefined,
    })
  }

  // Officially announced parts the Taiwan sheet hasn't caught up with yet.
  //
  // Matched exactly, and only exactly: the sheet lists `NR` and `Nr` as two
  // different bits on different grades, so folding case or zero-padding
  // together to catch near-misses would merge genuinely separate parts. An
  // entry written before the real data exists will often not match at all —
  // UX-21 was added as UX-21-1 against the sheet's UX-21-01 and every blade
  // showed twice — so these have to be deleted by hand, as the file says.
  for (const part of MANUAL_PARTS) {
    const key = `${part.id}|${part.cat}`
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      ...part,
      key: part.key ?? part.id,
      // A relative path is a locally committed asset; a full URL (as sheet
      // rows already carry) is left as-is.
      img: part.img ? (part.img.startsWith('http') ? part.img : `${import.meta.env.BASE_URL}${part.img}`) : undefined,
    })
  }

  // A blade with no image of its own borrows one from another entry sharing
  // its key — a recolor or metal-coat variant is still the same physical mold.
  const imgByKey = new Map<string, string>()
  for (const p of out) if (p.cat === 'blade' && p.img) imgByKey.set(p.key, p.img)
  for (const p of out) if (p.cat === 'blade' && !p.img) p.img = imgByKey.get(p.key)

  return out
}

/** Placement counts, already keyed onto our catalogue by the refresh script. */
async function loadTournament(): Promise<TournamentFile> {
  const res = await fetch(dataUrl('tournament.json'))
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as TournamentFile
}

type JapanFile = {
  parts: { productCode: string | null; tier: string; nameEn?: string; credit?: Part['credit'] }[]
}

/**
 * Hand-curated Japanese rankings. The file holds only grades and credits, so
 * each entry is joined to the catalogue by product code — we never hotlink the
 * original author's images.
 */
async function loadJapan(): Promise<JapanFile> {
  const res = await fetch(dataUrl('tiers-jp.json'))
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as JapanFile
}

/** BeyClub's editorial notes, keyed "category:id". */
export async function loadPartNotes(): Promise<Record<string, PartNotes>> {
  const res = await fetch(dataUrl('part-notes.json'))
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const json = (await res.json()) as { notes: Record<string, PartNotes> }
  return json.notes ?? {}
}

/**
 * Merges the catalogue, the placement record and the Japanese list into one
 * ranking.
 *
 * Ratings are keyed by blade rather than by product code: 魔導神杖, 魔導神杖(綠)
 * and 魔導神杖 金屬塗層:燦金 are one blade sold four ways, and if each variant
 * looked for its own tournament record three of them would come back empty and
 * read as untested.
 */
function merge(raw: Raw[], tournament: TournamentFile, japan: JapanFile): Part[] {
  const records = new Map<string, TournamentRecord & { topRatchet?: string; topBit?: string }>()
  const tops: Record<string, { allTime: number; recent90: number }> = {}

  for (const p of tournament.parts) {
    const top = (tops[p.cat] ??= { allTime: 0, recent90: 0 })
    top.allTime = Math.max(top.allTime, p.allTime)
    top.recent90 = Math.max(top.recent90, p.recent90)
  }

  // Ratchets, bits and assist blades are catalogued only by code, so "Flat" and
  // "Free Ball" were unfindable. The placement feed spells them out.
  const spelledOut = new Map<string, string>()

  for (const p of tournament.parts) {
    records.set(`${p.cat}|${p.key}`, {
      allTime: p.allTime,
      recent90: p.recent90,
      firsts: p.firsts,
      topRatchet: p.topRatchet,
      topBit: p.topBit,
      score: tournamentScore(p, tops[p.cat]),
    })
    // A ratchet's "name" is just its code again; only spell out real words.
    if (p.cat !== 'blade' && p.name && p.name !== p.key) spelledOut.set(`${p.cat}|${p.key}`, p.name)
  }

  const blades = raw.filter((p) => p.cat === 'blade')

  const byId = new Map(blades.map((p) => [p.id, p]))
  const byName = new Map<string, Raw>()
  for (const p of blades) {
    const en = p.nameEn && normalize(p.nameEn)
    if (en && !byName.has(en)) byName.set(en, p)
  }

  /**
   * A base product code is not a blade. BX-50 covers five different blades and
   * BX-24 another five, so resolving "Heavens Ring" through BX-50 alone would
   * stamp its grade — and its author's name — onto whichever of the five the
   * sheet happens to list first. Match the name we were given, and only fall
   * back to the code when it identifies exactly one blade.
   */
  const byBaseCode = new Map<string, Raw | null>()
  for (const p of blades) {
    const base = p.id.split('-').slice(0, 2).join('-')
    if (!byBaseCode.has(base)) byBaseCode.set(base, p)
    else if (byBaseCode.get(base)?.key !== p.key) byBaseCode.set(base, null)
  }

  const japanByKey = new Map<string, { tier: string; credit?: Part['credit'] }>()
  for (const entry of japan.parts) {
    const code = entry.productCode
    const match =
      (entry.nameEn ? byName.get(normalize(entry.nameEn)) : undefined) ??
      (code ? (byId.get(code) ?? byBaseCode.get(code) ?? undefined) : undefined)
    if (match && !japanByKey.has(match.key)) japanByKey.set(match.key, entry)
  }

  const rated = raw.map((p) => {
    const sources: RatingSources = {
      community: p.communityTier === '-' ? undefined : p.communityTier,
      japan: japanByKey.get(p.key)?.tier,
      tournament: records.get(`${p.cat}|${p.key}`),
    }
    return { part: p, rating: blendRating(sources), credit: japanByKey.get(p.key)?.credit }
  })

  // Stock part grades have to come from the blend too, or a blade's buy verdict
  // would weigh our tier against BeyTier's — two scales that were never
  // measured the same way.
  // Normalised, because the sheet's stock-part columns are hand-typed and every
  // other code lookup in the app (partIndex.resolve, PartChip) tolerates the
  // same drift in case, spacing and hyphens.
  const tierOf = new Map(
    rated.map(({ part, rating }) => [`${part.cat}|${normalize(part.id)}`, rating.tier]),
  )
  const grade = (cat: PartCategory, code?: string) =>
    code ? tierOf.get(`${cat}|${normalize(code)}`) : undefined

  return rated.map(({ part, rating, credit }) => {
    const ratchetTier = grade('ratchet', part.stockRatchet)
    const bitTier = grade('bit', part.stockBit)
    // The blades sheet names an assist blade by its bare initial while the parts
    // catalogue keys them "輔助A", so this lookup found nothing and the fourth
    // term of the buy verdict never fired.
    const assistTier = grade('assist', part.stockAssist && `輔助${part.stockAssist}`)

    return {
      ...part,
      nameEn: part.nameEn ?? spelledOut.get(`${part.cat}|${part.id}`),
      tier: rating.tier,
      rating,
      credit,
      ratchetTier,
      bitTier,
      // Always computed from the grades this app blends, never read from a
      // source. A blade nobody has graded still drops out of the average rather
      // than out of the verdict — you are buying a box, and a box of good parts
      // is worth buying whether or not the blade in it has been assessed.
      buy:
        part.cat === 'blade'
          ? calculateBuyRec(rating.tier, ratchetTier, bitTier, assistTier)
          : calculateBuyRec(rating.tier),
    }
  })
}

function readCache(): Dataset | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Dataset) : null
  } catch {
    return null
  }
}

/**
 * Loads the merged dataset, falling back to the last good copy when the network
 * fails so the page always has something to render.
 */
export async function loadDataset(): Promise<Dataset> {
  try {
    const [raw, tournament, japan] = await Promise.all([
      loadCatalogue(),
      loadTournament(),
      loadJapan(),
    ])

    const data: Dataset = {
      parts: merge(raw, tournament, japan),
      tournament: tournament.source,
      fetchedAt: new Date().toISOString(),
      stale: false,
    }

    try {
      for (const key of RETIRED_KEYS) localStorage.removeItem(key)
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch {
      // Quota exceeded or private mode — cache is a nicety, not a requirement.
    }
    return data
  } catch (err) {
    const cached = readCache()
    if (cached) return { ...cached, stale: true }
    throw err
  }
}
