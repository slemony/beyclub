import type { WatchedProduct } from './types'

/**
 * The products you actually care about, kept in this browser and carried with
 * your account.
 *
 * This file alone is the whole feature — starring works with no account and no
 * network. `userSync.ts` layers Firestore sync on top when you're signed in,
 * but always reads and writes through the functions here, the same arrangement
 * `collection.ts` has.
 *
 * Note what syncing does not buy. The grab-stock overlay runs on KGB's own
 * origin, which cannot read this — same-origin policy, and no way around it
 * that is worth having. So the watchlist does its work on the BeyClub side:
 * star things here, and they are pinned to the top of every list.
 *
 * With one deliberate exception. A live view handed over from the shop is a
 * reading of the shelf at one moment, so it pins only the stars that reading
 * actually found; the rest stay one tap away under ★ Watching rather than
 * standing in front of what is on the shelf. See `inGroup` in StockPage.
 *
 * It also cannot notify you. Alerts need something watching the shop while you
 * are not, and the shop is closed to anonymous readers — see the note in
 * scripts/fetch-stock.mjs.
 */
const KEY = 'beyclub:watchlist:v2'

/** The bare-slug shape, read once so a watchlist started before accounts survives. */
const LEGACY_KEY = 'beyclub:watchlist:v1'

/** When the live view last rendered, so the Stock page can say "checked at…". */
const LIVE_KEY = 'beyclub:stock:lastLive'

/** A star's record id. Namespaced so it can never collide with a build or deck. */
export const watchId = (slug: string): string => `watch:${slug}`

/**
 * Folds the old `string[]` into records.
 *
 * There is no telling when any of them were starred, so they all take the time
 * of the migration. That only matters against a tombstone, and a tombstone
 * older than this device's first sync would have to belong to a star this
 * device never had.
 */
function migrate(slugs: string[]): WatchedProduct[] {
  const at = new Date().toISOString()
  return slugs
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .map((slug) => ({ id: watchId(slug), slug, addedAt: at, updatedAt: at }))
}

export function readWatchlist(): WatchedProduct[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as WatchedProduct[]).filter((w) => w?.slug) : []
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (!legacy) return []
    const parsed: unknown = JSON.parse(legacy)
    if (!Array.isArray(parsed)) return []
    const migrated = migrate(parsed as string[])
    writeWatchlist(migrated)
    return migrated
  } catch {
    // Private browsing, a full quota, or someone's hand-edited JSON. An empty
    // watchlist is a fine answer to any of them.
    return []
  }
}

export function writeWatchlist(items: WatchedProduct[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Nothing to persist to — the stars still work for this session.
  }
}

/** The slugs, for the lookups every row on the Stock page does while rendering. */
export const watchedSlugs = (items: WatchedProduct[]): Set<string> =>
  new Set(items.map((w) => w.slug))

/**
 * Adds or removes one product.
 *
 * Pure, and deliberately so: the caller hands the result to `applyLocal` or
 * `applyDelete`, which own the saving and the push. Removing returns the id to
 * tombstone — without one, the merge cannot tell "un-starred here" from "not
 * starred here yet" and the other device hands it straight back.
 */
export function toggleWatch(
  slug: string,
  title: string | undefined,
  items: WatchedProduct[],
): { next: WatchedProduct[]; removedId?: string } {
  const existing = items.find((w) => w.slug === slug)
  if (existing) return { next: items.filter((w) => w.slug !== slug), removedId: existing.id }

  const at = new Date().toISOString()
  return { next: [...items, { id: watchId(slug), slug, title, addedAt: at, updatedAt: at }] }
}

/** Sorts watched products first, leaving the caller's order intact within each. */
export function watchedFirst(watched: Set<string>) {
  return (a: { slug: string }, b: { slug: string }) =>
    Number(watched.has(b.slug)) - Number(watched.has(a.slug))
}

/**
 * Which browser last ran a live grab — a fact about this device, not about the
 * account, so it stays out of the sync.
 */
export function markLiveChecked(): void {
  try {
    localStorage.setItem(LIVE_KEY, new Date().toISOString())
  } catch {
    // Only cosmetic — the live view itself does not depend on this.
  }
}

/** When a live view was last taken from the shop, if ever. */
export function lastLiveCheck(): string | null {
  try {
    return localStorage.getItem(LIVE_KEY)
  } catch {
    return null
  }
}
