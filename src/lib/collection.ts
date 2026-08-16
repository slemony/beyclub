import { partCode } from './partIndex'
import { normalize } from './text'
import type { CollectionEntry, CollectionSource, PartCategory } from './types'

/**
 * What you own, kept in this browser under `localStorage`. This file alone is
 * the whole feature — it works with no account and no network. `userSync.ts`
 * layers Firestore sync on top when signed in, but always reads and writes
 * through the functions here.
 *
 * Parts are stored one entry per part, not one per acquisition: pulling 3-60
 * out of two different boxes leaves you with one 3-60 entry carrying two
 * sources. See `CollectionSource` for why the origin is worth keeping.
 */
const KEY = 'beyclub:collection:v2'

/** The pre-sources shape, read once so an early tester's collection survives. */
const LEGACY_KEY = 'beyclub:collection:v1'

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** Two acquisitions of the same part must land on one entry — this is what "same" means. */
export function entryKey(entry: Pick<CollectionEntry, 'cat' | 'code' | 'name'>): string {
  return entry.code ? `${entry.cat}|${normalize(entry.code)}` : `${entry.cat}|name:${normalize(entry.name ?? '')}`
}

/** Keys of every catalogue part owned, for "only what I own" filters. */
export function ownedKeys(entries: CollectionEntry[]): Set<string> {
  return new Set(entries.filter((e) => e.code).map((e) => entryKey(e)))
}

export const totalQty = (entry: CollectionEntry) => entry.sources.reduce((n, s) => n + s.qty, 0)
export const unofficialQty = (entry: CollectionEntry) =>
  entry.sources.reduce((n, s) => n + (s.unofficial ? s.qty : 0), 0)

type LegacyEntry = {
  id?: string
  kind?: string
  cat?: PartCategory
  code?: string
  name?: string
  qty?: number
  notes?: string
  addedAt?: string
  updatedAt?: string
}

/** Folds the old one-entry-per-add shape into the sources shape, merging duplicates as it goes. */
function migrate(legacy: LegacyEntry[]): CollectionEntry[] {
  const byKey = new Map<string, CollectionEntry>()
  for (const old of legacy) {
    if (!old.cat) continue
    const now = old.addedAt ?? new Date().toISOString()
    const stub = { cat: old.cat, code: old.code, name: old.name }
    const key = entryKey(stub)
    const source: CollectionSource = {
      id: newId(),
      qty: old.qty ?? 1,
      unofficial: old.kind === 'manual',
      notes: old.notes,
      addedAt: now,
    }
    const existing = byKey.get(key)
    if (existing) existing.sources.push(source)
    else byKey.set(key, { ...stub, id: old.id ?? newId(), sources: [source], addedAt: now, updatedAt: now })
  }
  return [...byKey.values()]
}

export function readCollection(): CollectionEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as CollectionEntry[]) : []
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (!legacy) return []
    const parsed: unknown = JSON.parse(legacy)
    if (!Array.isArray(parsed)) return []
    const migrated = migrate(parsed as LegacyEntry[])
    writeCollection(migrated)
    localStorage.removeItem(LEGACY_KEY)
    return migrated
  } catch {
    // Private browsing, a full quota, or hand-edited JSON. An empty
    // collection is a fine answer to any of them.
    return []
  }
}

/** Exported so collectionSync.ts can persist a merged copy without re-deriving it. */
export function writeCollection(entries: CollectionEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Nothing to persist to — the entries still work for this session.
  }
}

export type NewPart = {
  cat: PartCategory
  /** Catalogue code, or absent for a part the catalogue has never listed. */
  code?: string
  /** Display name — required when there's no `code` to resolve. */
  name?: string
  qty?: number
  /** The set this came in, carried onto the source it creates. */
  from?: string
  unofficial?: boolean
  notes?: string
}

/**
 * Adds parts, folding each onto the entry for that part if it's already
 * owned. One write for the whole batch, so adding a five-part booster costs
 * one `localStorage` round trip rather than five.
 */
export function addParts(inputs: NewPart[], current: CollectionEntry[]): CollectionEntry[] {
  const now = new Date().toISOString()
  const next = [...current]
  const indexByKey = new Map(next.map((entry, i) => [entryKey(entry), i]))

  for (const input of inputs) {
    const code = input.code ? partCode(input.cat, input.code) : undefined
    const stub = { cat: input.cat, code, name: input.name }
    const source: CollectionSource = {
      id: newId(),
      from: input.from,
      qty: input.qty ?? 1,
      unofficial: Boolean(input.unofficial),
      notes: input.notes,
      addedAt: now,
    }

    const key = entryKey(stub)
    const at = indexByKey.get(key)
    if (at === undefined) {
      indexByKey.set(key, next.length)
      next.push({ ...stub, id: newId(), sources: [source], addedAt: now, updatedAt: now })
    } else {
      const entry = next[at]
      // Two pulls from the same box are one line reading ×2, not two lines
      // reading ×1 — otherwise a part bought loose twice shows up as two
      // identical "Loose / unknown" rows with nothing to tell them apart.
      const same = entry.sources.findIndex((s) => sameOrigin(s, source))
      const sources =
        same === -1
          ? [...entry.sources, source]
          : entry.sources.map((s, i) => (i === same ? { ...s, qty: s.qty + source.qty } : s))
      next[at] = { ...entry, sources, updatedAt: now }
    }
  }

  writeCollection(next)
  return next
}

/**
 * Whether two acquisitions are the same story and should share a row: same
 * box, same officialness, same note. Notes are part of it deliberately —
 * "bought at a meetup" against one of them is a distinction worth keeping,
 * even when the origin matches.
 */
function sameOrigin(a: CollectionSource, b: CollectionSource): boolean {
  return (
    normalize(a.from ?? '') === normalize(b.from ?? '') &&
    Boolean(a.unofficial) === Boolean(b.unofficial) &&
    (a.notes ?? '').trim() === (b.notes ?? '').trim()
  )
}

/** Adjusts one source's count, dropping the source — and the entry with it — at zero. */
export function setSourceQty(
  entryId: string,
  sourceId: string,
  qty: number,
  current: CollectionEntry[],
): CollectionEntry[] {
  const now = new Date().toISOString()
  const next = current
    .map((entry) => {
      if (entry.id !== entryId) return entry
      const sources = entry.sources
        .map((s) => (s.id === sourceId ? { ...s, qty } : s))
        .filter((s) => s.qty > 0)
      return { ...entry, sources, updatedAt: now }
    })
    .filter((entry) => entry.sources.length > 0)
  writeCollection(next)
  return next
}

export function removeSource(entryId: string, sourceId: string, current: CollectionEntry[]): CollectionEntry[] {
  return setSourceQty(entryId, sourceId, 0, current)
}

export function removeEntry(id: string, current: CollectionEntry[]): CollectionEntry[] {
  const next = current.filter((entry) => entry.id !== id)
  writeCollection(next)
  return next
}
