/**
 * The products you actually care about, kept in this browser.
 *
 * There is no account behind BeyClub and no server to keep this on, which is
 * fine: a watchlist is only ever read by the person who wrote it. It lives in
 * `localStorage` under the origin BeyClub is served from.
 *
 * Note what that rules out. The grab-stock overlay runs on KGB's own origin,
 * which cannot read this — same-origin policy, and no way around it that is
 * worth having. So the watchlist does its work on the BeyClub side: star things
 * here, and they are pinned to the top of every list, including the live view
 * handed over from the shop.
 *
 * It also cannot notify you. Alerts need something watching the shop while you
 * are not, and the shop is closed to anonymous readers — see the note in
 * scripts/fetch-stock.mjs.
 */
const KEY = 'beyclub:watchlist:v1'

/** When the live view last rendered, so the Stock page can say "checked at…". */
const LIVE_KEY = 'beyclub:stock:lastLive'

export function readWatchlist(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((s): s is string => typeof s === 'string')) : new Set()
  } catch {
    // Private browsing, a full quota, or someone's hand-edited JSON. An empty
    // watchlist is a fine answer to any of them.
    return new Set()
  }
}

function write(slugs: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...slugs]))
  } catch {
    // Nothing to persist to — the stars still work for this session.
  }
}

/** Adds or removes one product, returning the new set for React to hold. */
export function toggleWatch(slug: string, current: Set<string>): Set<string> {
  const next = new Set(current)
  if (!next.delete(slug)) next.add(slug)
  write(next)
  return next
}

/** Sorts watched products first, leaving the caller's order intact within each. */
export function watchedFirst(watched: Set<string>) {
  return (a: { slug: string }, b: { slug: string }) =>
    Number(watched.has(b.slug)) - Number(watched.has(a.slug))
}

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
