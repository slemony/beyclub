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
  /**
   * Everything else in the box, for a blade sold inside a customize set.
   *
   * A set holds several blades and a pile of loose ratchets and bits, which
   * the sheet can only record one-per-blade — so the rest is described once in
   * setContents.json and attached to every blade sharing the product. Kept
   * apart from `stockRatchet`/`stockBit` because those are what this blade
   * comes assembled with, and these are merely in the same box.
   */
  setRatchets?: string[]
  setBits?: string[]
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
  /**
   * Measured numbers for this part — weight, teeth, Burst rating, height.
   * Attached from partSpecs.json at load time (bits and ratchets only).
   */
  spec?: PartSpec
  /**
   * One creator's published verdict on this part, shown with a link back to the
   * point in their video. Attached from creatorPicks.json at load time (bits and
   * ratchets, each from its own video), and never an input to the grade.
   */
  creatorPick?: CreatorPick
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

/**
 * What a part measures, as opposed to how good it is.
 *
 * A grade tells you whether to use a part; these tell you what it is — why a
 * 14 g ratchet-integrated bit and a 2 g plastic one are not really the same
 * kind of object. Authored in partSpecs.json and joined on in loadCatalogue().
 * Deliberately kept out of `Rating`: a measurement is a fact, and facts do not
 * vote on a tier.
 */
export type PartSpec = {
  /** Grams. */
  weightG: number
  /** Bit: GEAR teeth. Ratchet: RING blades — the protrusions its code names. */
  teeth?: number
  /** The official Burst rating: 20, 30 or 80. Bits only, and not the fused ones. */
  burst?: number
  /**
   * Height in dmm — 10 dmm to the millimetre, the unit the source keeps. A
   * bit's is how far it stands proud; a ratchet's is its base height.
   */
  heightDmm?: number
  /** The far end of a height that changes: adjustable (Trans Kick) or in play (Turbo). */
  heightAltDmm?: number
  /**
   * A bit moulded onto its own ratchet (Operate, Turbo). It has no Burst
   * rating of its own, and its height is on the ratchet's base scale rather
   * than the exposed-height one — so the two are never compared directly.
   */
  fused?: boolean
  /** Simple-type ratchet: Burst resistance is fixed at "loose" whatever bit is fitted. */
  simple?: boolean
  /**
   * How deep an assist blade sits, in dmm — the one dimension the source
   * measures for them. Kept apart from `heightDmm` because it is a different
   * thing measured on a different axis, and folding the two together would
   * invite a sort that compares them.
   */
  thicknessDmm?: number
  /**
   * The blade this one was derived from — a collab or Hasbro release is
   * usually an existing design re-worked, and so are a fair number of BX
   * blades. Held as the base blade's name because it is a note to read, not a
   * join: the two are close but not the same, differing by up to 2.7 g, so
   * each keeps its own figure and neither borrows the other's.
   */
  basedOn?: string
  /**
   * A CX bey's two named pieces.
   *
   * Nothing in the catalogue is "a CX blade" on its own: a bey is a lock chip
   * on a main or metal blade, and its name is those two words. `weightG` above
   * is the blade alone, and the chip is carried here to be shown beside it
   * rather than folded in — the two come apart in the hand, so they come apart
   * on the page. The over blade and the assist blade are parts in their own
   * right with their own weights, and are no part of either figure.
   */
  cx?: {
    /** "Pegasus" — the lock chip the bey is named for. */
    chip: string
    chipG: number
    /** "Blast" — the blade `weightG` measures. */
    blade: string
    kind: 'main' | 'metal'
  }
}

/**
 * A creator's published verdict on one part — their own tier name, a sentence,
 * and where in the video they said it. Authored in creatorPicks.json and
 * joined onto its part in loadCatalogue().
 *
 * Held apart from `PartNotes` on purpose: that block is BeyClub's own writing
 * and carries an "our own view" badge, while this is someone else's opinion
 * and carries their name and a link. It never reaches a rating.
 */
export type CreatorPick = {
  /** The creator's own tier name, e.g. "Top Level" — not our grade scale. */
  tier: string
  /** One sentence, at most 140 characters. */
  note: string
  /** Seconds into the video, for a ?t= deep link. */
  at?: number
  /** Who said it and where. */
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
  /**
   * True when this row was added to a live view because it's watched, not
   * because the grab actually saw it on the shelf this pull — so `inStock`
   * here is a guess carried over from the frozen catalogue, not a live read.
   *
   * It decides visibility as well as wording: a row carrying this is drawn
   * only under the ★ Watching chip, never on the shelf the pull just read.
   */
  notOnThisPull?: boolean
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

/**
 * Where one batch of copies came from. A part owned twice over because two
 * different boxes shipped it is one entry with two sources — that's the whole
 * point of the split: "2× 3-60" alone loses the fact that pulling a third
 * would mean buying a set you already own most of.
 */
export type CollectionSource = {
  id: string
  /** The set it came in, e.g. "CX-13" or "BX-35 booster". Absent for a loose part. */
  from?: string
  qty: number
  /** 3D-printed or third-party rather than an official part — counted apart. */
  unofficial: boolean
  notes?: string
  addedAt: string
}

/**
 * One part in a collection, however many you own of it. `code` resolves
 * against the catalogue via partIndex; `name` carries a part the catalogue
 * has never heard of (an unofficial mold, a prototype), in which case there's
 * nothing to resolve and the name is all there is.
 */
export type CollectionEntry = {
  /** Locally generated, stable across devices once synced. */
  id: string
  cat: PartCategory
  code?: string
  name?: string
  sources: CollectionSource[]
  addedAt: string
  /** Last-write-wins key when merging local and synced copies. */
  updatedAt: string
}

/**
 * A bey the user has put together, stored as bare part codes so it re-reads
 * against a refreshed catalogue rather than freezing today's tiers into it.
 * Every slot is optional — a half-finished build is still worth keeping.
 */
export type SavedBuild = {
  id: string
  name?: string
  blade?: string
  ratchet?: string
  bit?: string
  assist?: string
  overblade?: string
  notes?: string
  /** How this build has actually done, kept by its owner. */
  record?: BuildRecord
  createdAt: string
  updatedAt: string
}

/**
 * The user's own results for a build — deliberately the same three counts the
 * tier list reports for a part (top-4 placements and firsts, over so many
 * events), so a personal record reads on the same terms as the published one.
 */
export type BuildRecord = {
  events: number
  placements: number
  firsts: number
  notes?: string
}

/** Three beys taken to a tournament together. */
export type Deck = {
  id: string
  name: string
  /** Build ids, up to three. */
  buildIds: string[]
  notes?: string
  /**
   * Silences the repeated-part warning. A deck normally can't reuse one
   * physical part across two beys, but plenty of people own doubles — so the
   * check warns and this turns the warning off rather than the rule blocking.
   */
  allowDuplicates?: boolean
  createdAt: string
  updatedAt: string
}

/**
 * A starred product on the Stock page, carried with the account like a build
 * or a deck.
 *
 * A bare slug would have been enough for one browser, but a record that syncs
 * needs an id to tombstone and a time to merge on — see `mergeById` in
 * userSync.ts. The title rides along so the sign-in offer can name what it is
 * offering without loading the whole shop.
 */
export type WatchedProduct = {
  /** `watch:<slug>` — namespaced so it can never collide with a build or deck id. */
  id: string
  slug: string
  title?: string
  addedAt: string
  updatedAt: string
}
