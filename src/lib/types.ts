export type PartCategory = 'blade' | 'ratchet' | 'bit' | 'assist'

export type PartType =
  | 'attack'
  | 'stamina'
  | 'defense'
  | 'balance'
  | 'special'
  | 'ratchet'
  | 'bit'

export type BuyAdvice = 'yes' | 'maybe' | 'no' | ''

/** One rankable part, normalized across all three source datasets. */
export type Part = {
  id: string
  name: string
  nameEn?: string
  cat: PartCategory
  type: PartType
  tier: string
  buy: BuyAdvice
  img?: string
  /** Stock ratchet / bit the part ships with (blades only). */
  stockRatchet?: string
  stockBit?: string
  /** Tier grades of the parts it ships with. */
  ratchetTier?: string
  bitTier?: string
  /** Free-text combo suggestion from the source. */
  combo?: string
  /** Alternate build submitted by the community (sheet column 15). */
  communityCombo?: string
  /** Product this part comes in. */
  product?: string
  /** Tournament record, when the entry came from placement data. */
  stats?: PartStats
  /** Per-entry credit — required for hand-curated entries. */
  credit?: Credit
}

export type PartStats = {
  wins: number
  firsts: number
  championRate: number | null
  lastSeen?: string
}

export type Credit = {
  author: string
  sourceName: string
  sourceUrl: string
}

/** A top combo backed by real tournament placements. */
export type ComboStat = {
  key: string
  bladeId: string
  bladeName: string
  ratchet: string
  bit: string
  wins: number
  firsts: number
  seconds: number
  thirds: number
  championRate: number | null
  lastDate: string
  rank: number
}

/** BeyClub's own editorial take on a part — never a source's opinion. */
export type PartNotes = {
  pros: string[]
  cons: string[]
  technique?: string
}

export type SourceId = 'community' | 'tournament' | 'japan'

export type SourceMeta = {
  id: SourceId
  label: string
  flag: string
  /** Shown under the tab: what this dataset actually is. */
  blurb: string
  /** Who produced the ratings — the accountability line. */
  credits: { label: string; url?: string }[]
  basis: 'opinion' | 'results'
}

export type Dataset = {
  parts: Part[]
  combos: ComboStat[]
  /** When the data was fetched (ISO). */
  fetchedAt: string
  /** True when served from cache after a failed refresh. */
  stale: boolean
}
