export type PartCategory = 'blade' | 'ratchet' | 'bit' | 'assist' | 'overblade'

export type PartType =
  | 'attack'
  | 'stamina'
  | 'defense'
  | 'balance'
  | 'special'
  | 'ratchet'
  | 'bit'

export type BuyAdvice = 'yes' | 'maybe' | 'no' | ''

/** One rankable part, with its grade blended from every source that rates it. */
export type Part = {
  id: string
  name: string
  nameEn?: string
  cat: PartCategory
  type: PartType
  /** The blended grade. `rating` shows how it was reached. */
  tier: string
  buy: BuyAdvice
  img?: string
  /**
   * The blade this part belongs to — its base Chinese name for blades, its id
   * otherwise. Colour variants and metal coatings share one key so they share
   * one tournament record.
   */
  key: string
  /** Stock parts it ships with (blades only). */
  stockRatchet?: string
  stockBit?: string
  stockAssist?: string
  /** CX Expand Blade over blade in the box (blades only). */
  stockOverblade?: string
  /** Blended grades of those stock parts, on the same scale as `tier`. */
  ratchetTier?: string
  bitTier?: string
  overbladeTier?: string
  /** Free-text combo suggestion from the source. */
  combo?: string
  /** Alternate build submitted by the community (sheet column 15). */
  communityCombo?: string
  /**
   * Hand-curated modding builds for this blade, richer than the sheet's combo
   * string — each carries a mod-strength grade, a difficulty and playing notes.
   * Attached from customBuilds.json at load time (blades only).
   */
  customBuilds?: CustomBuild[]
  /** Product this part comes in. */
  product?: string
  /** How the blended tier was arrived at, and from what. */
  rating?: Rating
  /** Per-entry credit — required for hand-curated entries. */
  credit?: Credit
}

/** What each source said about a part. Absent keys mean "this source is silent". */
export type RatingSources = {
  /** Taiwan community grade, on our thirteen-step scale. */
  community?: string
  /** Japanese list grade, on its own five-step scale. */
  japan?: string
  tournament?: TournamentRecord
}

export type TournamentRecord = {
  /** Top-4 placements across the whole record, and across the last 90 days. */
  allTime: number
  recent90: number
  /** First places (blades only). */
  firsts?: number
  /** The ratchet and bit this blade is most often built with. */
  topRatchet?: string
  topBit?: string
  /** 0–100, log share of the category leader across both windows. */
  score: number
}

export type SourceKey = 'tournament' | 'community' | 'japan'

/** One source's contribution, after weights are renormalised over what exists. */
export type RatingTerm = {
  key: SourceKey
  /** 0–100 on the shared scale. */
  score: number
  /** 0–1, summing to 1 across the terms. */
  weight: number
}

export type Rating = RatingSources & {
  /** The blended 0–100 score behind `tier`. Meaningless when `tier` is "-". */
  score: number
  /** A grade on the shared scale, or "-" when no source has rated this part. */
  tier: string
  /** No tournament record, so the tier is held below the proven-only grades. */
  capped: boolean
}

export type Credit = {
  author: string
  sourceName: string
  sourceUrl: string
}

/**
 * A hand-curated modding build for a blade — the kind of tuned setup a creator
 * publishes with its own strength grade, difficulty and playing notes, which
 * the sheet's one-line combo string has no room for. Authored in
 * customBuilds.json and joined onto its blade in loadCatalogue().
 */
export type CustomBuild = {
  /** Which blade this build is for — matched on the blade's id or its base-name key. */
  blade: string
  /** Short label for the build, e.g. "Precision Orbit". */
  title?: string
  /** The ratchet, bit and optional assist that make up the setup. */
  ratchet: string
  bit: string
  assist?: string
  /**
   * Mod-strength grade on the community's T-scale (T2 is milder than T0). Free
   * text so ranges like "T2~T2.5" read as written; `modStrengthMax` names the
   * ceiling of the scale for context.
   */
  modStrength?: string
  modStrengthMax?: string
  /** Handling difficulty, out of `difficultyMax` (defaults to 5). */
  difficulty?: number
  difficultyMax?: number
  /** Playing notes — how to launch and pilot the setup. */
  notes?: string[]
  /** Who published the build and where. */
  credit: Credit
}

/** BeyClub's own editorial take on a part — never a source's opinion. */
export type PartNotes = {
  pros: string[]
  cons: string[]
  technique?: string
  /** What the part does, in a sentence or two. */
  summary?: string
  /** Bit reference data: how it behaves and where it came from. */
  profile?: {
    /** "Flat" — the spelled-out name behind the code. */
    label: string
    labelZh?: string
    line?: 'BX' | 'UX' | 'CX'
    weightG?: number
    /** Product it debuted in. */
    debut?: string
    /** 0–100. Defence is absent on the few cards that never rated it. */
    stats: { attack: number; stamina: number; defense?: number; burst?: number }
  }
}

/** Provenance for one of the three inputs to a rating. */
export type SourceMeta = {
  label: string
  flag: string
  /** What this dataset actually is. */
  blurb: string
  /** Who produced it — the accountability line. */
  credits: { label: string; url?: string }[]
  basis: 'opinion' | 'results'
}

/** The `source` block written by scripts/fetch-tournament.mjs. */
export type TournamentSource = {
  name: string
  url: string
  upstream: string
  upstreamUrl: string
  coverage: { events: number; combos: number }
  windows: Record<string, { from: string | null; to: string | null; events: number; combos: number }>
}

export type TournamentFile = {
  fetchedAt: string
  source: TournamentSource
  parts: ({ cat: PartCategory; key: string; name: string } & Omit<TournamentRecord, 'score'>)[]
  unmatched: { name: string; count: number }[]
}

/** The filter groups on the Stock page, folded from KGB's own category labels. */
export type StockGroup = 'bey' | 'stadium' | 'launcher' | 'case' | 'merch'

/** One listing in the KGB shop, as written by scripts/fetch-stock.mjs. */
export type StockProduct = {
  slug: string
  url: string
  title: string
  /**
   * Product code parsed from the slug, e.g. "BX-48" — the hook the tier list
   * hangs on. Absent on merchandise, which has no code to match.
   */
  code?: string
  /** KGB's own label, e.g. "Random Booster". Finer than `group`. */
  kgbCategory: string
  group: StockGroup
  priceMYR: number
  inStock: boolean
  img?: string
}

/**
 * Whether the last look at the shop actually saw the shelf.
 *
 * `gated` is KGB's own doing: since 6 Aug 2026 `/shop` answers everyone with a
 * "Sign in to queue" page, because places in line are now reserved for
 * signed-in members. There is nothing to fix at this end, so the scrape records
 * it and the page says so rather than presenting six-day-old stock as current.
 */
export type StockHealth = 'ok' | 'gated' | 'unreachable'

export type StockFile = {
  /**
   * When the shelf last moved — not when it was last checked. The refresh job
   * leaves the products alone when nothing changed, so that this only advances
   * on a real change. For when we last *looked*, read `checkedAt`.
   */
  updatedAt: string
  /**
   * When the shop was last looked at, whatever the answer. Absent on files
   * written before the shop closed to anonymous readers.
   */
  checkedAt?: string
  /** What that look found. Absent means the file predates the check. */
  health?: StockHealth
  source: { name: string; url: string; currency: string }
  coverage: { products: number; inStock: number; pages: number }
  products: StockProduct[]
  /** True when served from cache after a failed refresh. */
  stale?: boolean
}

export type Dataset = {
  parts: Part[]
  /** Coverage and provenance of the placement data behind the ranking. */
  tournament: TournamentSource
  /** When the data was fetched (ISO). */
  fetchedAt: string
  /** True when served from cache after a failed refresh. */
  stale: boolean
}
