import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import PartSheet from '../components/PartSheet'
import Sheet from '../components/Sheet'
import StockCard from '../components/StockCard'
import { SyncButton, SyncNotice } from '../components/SyncControls'
import { loadDataset, loadPartNotes } from '../lib/loadData'
import { buildPartIndex } from '../lib/partIndex'
import {
  buildStockIndex,
  canRefreshStockNow,
  codeFromSlug,
  gradedOn,
  groupForCategory,
  loadStock,
  markStockRefreshed,
  msToNextHour,
  nextRefreshLabel,
  stockScrapeConfigured,
  triggerStockScrape,
} from '../lib/stock'
import { tierRank } from '../lib/tiers'
import { applyDelete, applyLocal, useUserData } from '../lib/userSync'
import { lastLiveCheck, markLiveChecked, toggleWatch, watchedFirst, watchedSlugs } from '../lib/watchlist'
import type { Dataset, Part, PartNotes, StockFile, StockGroup, StockProduct } from '../lib/types'

type Filter = StockGroup | 'all' | 'watching'

const FILTERS: Filter[] = ['all', 'watching', 'bey', 'stadium', 'launcher', 'case', 'merch']

const GROUP_LABELS: Record<Filter, string> = {
  all: 'All',
  watching: '★ Watching',
  bey: 'Beys',
  stadium: 'Stadiums',
  launcher: 'Launchers',
  case: 'Cases',
  merch: 'Merch',
}

/** Beys lead the mixed list — nobody opens this page for a pillow. */
const GROUP_ORDER: Record<StockGroup, number> = {
  bey: 0,
  stadium: 1,
  launcher: 2,
  case: 3,
  merch: 4,
}

type SortKey = 'default' | 'tier' | 'buy' | 'price'

const SORTS: SortKey[] = ['default', 'tier', 'buy', 'price']

const SORT_LABELS: Record<SortKey, string> = {
  default: 'Featured',
  tier: 'Tier',
  buy: 'Worth buying',
  price: 'Price',
}

/** Same order the part sheet's own verdict reads in — best case first. */
const BUY_RANK: Record<string, number> = { yes: 0, maybe: 1, no: 2, '': 3 }

/** One product as the grab-stock overlay reports it: slug, title, price, category. */
type LiveItem = { s: string; t?: string; p?: number; c?: string }

const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-MY', {
        timeZone: 'Asia/Kuala_Lumpur',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

/** Just the day. A banner about a shelf we last saw last week owes no minute. */
const day = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-MY', {
        timeZone: 'Asia/Kuala_Lumpur',
        day: 'numeric',
        month: 'short',
      })
    : null

export default function StockPage() {
  const [params] = useSearchParams()
  const [stock, setStock] = useState<StockFile | null>(null)
  const [data, setData] = useState<Dataset | null>(null)
  const [notes, setNotes] = useState<Record<string, PartNotes>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Filter>('all')
  // Ranked, not alphabetical. "Featured" is the shop's own order — in stock
  // first, then category, then title — which buries an X-tier bey behind
  // whatever happens to start with B. The reason to open this page is to see
  // what on the shelf is worth buying, so lead with that; Featured is still
  // one tap away for anyone who wants to browse the shop's order.
  const [sort, setSort] = useState<SortKey>('tier')
  const [showSoldOut, setShowSoldOut] = useState(false)
  const [stack, setStack] = useState<Part[]>([])
  const [showSource, setShowSource] = useState(false)
  // Held by the shared store rather than this page, so a star made on another
  // device arrives on screen instead of waiting for a reload.
  const { watchlist } = useUserData()
  const watched = useMemo(() => watchedSlugs(watchlist), [watchlist])
  const [canRefresh, setCanRefresh] = useState(() => canRefreshStockNow())
  const [refreshing, setRefreshing] = useState(false)
  // The outcome of the last manual check, shown next to the timestamp so the
  // click always has a visible result — even when nothing on the shelf moved.
  const [refreshNote, setRefreshNote] = useState<'scanning' | 'updated' | 'nochange' | 'error' | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    loadStock()
      .then((s) => {
        if (!cancelled) setStock(s)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load stock')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // The ranking is what turns a listing into advice, but the shelf is still
    // readable without it — a failure here must not empty the page.
    loadDataset()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {})

    loadPartNotes().then(setNotes).catch(() => setNotes({}))

    return () => {
      cancelled = true
    }
  }, [])

  /**
   * A live view handed over by the grab-stock bookmarklet: what it just saw on
   * the shelf while you were signed in, passed in the URL fragment so it never
   * reaches a server. Published availability has been frozen since the shop
   * went members-only, so when this is present it wins.
   *
   * Two shapes, because a bookmarklet installed before the payload changed is
   * still out in the world and must keep working:
   *   - current: JSON `[{ s, t, p, c }]` — slug, title, price, category
   *   - legacy:  a comma-separated list of slugs
   */
  const live = useMemo((): LiveItem[] | null => {
    const raw = params.get('live')
    if (!raw) return null

    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const items = parsed
          .filter((r): r is LiveItem => typeof r?.s === 'string' && r.s.length > 0)
          .map((r) => ({ s: r.s, t: r.t, p: r.p, c: r.c }))
        return items.length ? items : null
      }
    } catch {
      // Not JSON — the older slugs-only form.
    }

    const slugs = raw.split(',').map((s) => s.trim()).filter(Boolean)
    return slugs.length ? slugs.map((s) => ({ s })) : null
  }, [params])

  const view = useMemo(() => {
    if (!stock) return { products: [] as StockProduct[] }
    if (!live) return { products: stock.products }

    const bySlug = new Map(stock.products.map((p) => [p.slug, p]))

    const products = live.map((item): StockProduct => {
      const known = bySlug.get(item.s)
      // The catalogue has been frozen since the shop closed, so anything KGB
      // has listed since arrives unknown. Building it into a real product —
      // rather than a bare link — is what lets it be sorted, watched, and
      // graded, since the code parsed off its slug still reaches the tier data.
      if (!known) {
        return {
          slug: item.s,
          url: `https://kelabgasingbeyblade.my/products/${item.s}`,
          title: item.t || item.s,
          code: codeFromSlug(item.s),
          kgbCategory: item.c || 'Unlisted',
          group: item.c ? groupForCategory(item.c) : 'bey',
          priceMYR: item.p ?? 0,
          inStock: true,
        }
      }
      // Prices move; prefer the one just read off the shelf over the frozen one.
      return { ...known, inStock: true, priceMYR: item.p ?? known.priceMYR }
    })

    // A live pull only ever shows what the grab happened to scrape, which is
    // rarely everything — so a starred product left out of it would otherwise
    // vanish from this view entirely, breaking the promise (see watchlist.ts)
    // that watched things are pinned on every list, including this one. Carry
    // over anything still watched that this pull didn't see, without claiming
    // it's in stock — that's not something this pull confirmed either way.
    const seen = new Set(products.map((p) => p.slug))
    for (const slug of watched) {
      if (seen.has(slug)) continue
      const known = bySlug.get(slug)
      if (!known) continue
      products.push({ ...known, notOnThisPull: true })
    }

    return { products }
  }, [stock, live, watched])

  const parts = data?.parts ?? []
  const partIndex = useMemo(() => buildPartIndex(parts), [parts])
  const stockIndex = useMemo(
    () => buildStockIndex(view.products, parts),
    [view, parts],
  )

  /**
   * The part each product is judged on, computed once per stock/rating change
   * rather than inside the sort comparator — that runs O(n log n) times.
   */
  const bestBySlug = useMemo(() => {
    const map = new Map<string, Part | undefined>()
    for (const p of view.products) map.set(p.slug, gradedOn(stockIndex.contents(p)))
    return map
  }, [view, stockIndex])

  const featuredOrder = useCallback(
    (a: StockProduct, b: StockProduct) =>
      Number(b.inStock) - Number(a.inStock) ||
      GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
      a.title.localeCompare(b.title),
    [],
  )

  const onToggleWatch = useCallback(
    (slug: string, title: string) => {
      const { next, removedId } = toggleWatch(slug, title, watchlist)
      // Un-starring needs the tombstone, or the account's copy hands it back.
      if (removedId) applyDelete({ watchlist: next }, [removedId])
      else applyLocal({ watchlist: next })
    },
    [watchlist],
  )

  /**
   * Whether anything on this page can honestly speak to what is on the shelf.
   * A live grab can; the published file, frozen since KGB closed the shop,
   * cannot — and "Sold out" would be as much of an invention as "In stock".
   */
  const knowsAvailability = Boolean(live) || stock?.health === 'ok'

  /**
   * A live grab is a moment, not a state — the page has no other way to say
   * "that worked", so record when one rendered and show it on the banner.
   */
  useEffect(() => {
    if (!live) return
    markLiveChecked()
    // A grab arriving into whatever chip was left selected shows a fraction of
    // what it just found, which reads as the grab having failed.
    setGroup('all')
    // The shop can only order by category; this is the one place that knows
    // which of what's on the shelf is actually worth the queue place, so a
    // grab lands ranked rather than alphabetical.
    setSort('tier')
  }, [live])

  const visible = useMemo(() => {
    const products = view.products.filter(
      (p) =>
        (group === 'watching' ? watched.has(p.slug) : group === 'all' || p.group === group) &&
        // While the shop is closed to us the published flags are a week-old
        // snapshot, so filtering on them would hide products on the strength of
        // a guess. Only a live view has standing to sort by availability. A
        // watched item this pull didn't see is a different case again — its
        // `inStock: false` isn't a sold-out claim, just an unconfirmed guess,
        // so hiding it behind "Show sold out" would defeat the point of
        // carrying it into this view at all.
        (!knowsAvailability || showSoldOut || p.inStock || p.notOnThisPull),
    )

    // Whatever the chosen sort, what you are waiting for comes first — the
    // point of starring something is not having to find it again.
    const byWatch = watchedFirst(watched)

    if (sort === 'tier') {
      return products.sort(
        (a, b) =>
          byWatch(a, b) ||
          tierRank(bestBySlug.get(a.slug)?.tier ?? '-') - tierRank(bestBySlug.get(b.slug)?.tier ?? '-') ||
          featuredOrder(a, b),
      )
    }
    if (sort === 'buy') {
      return products.sort(
        (a, b) =>
          byWatch(a, b) ||
          BUY_RANK[bestBySlug.get(a.slug)?.buy ?? ''] - BUY_RANK[bestBySlug.get(b.slug)?.buy ?? ''] ||
          featuredOrder(a, b),
      )
    }
    if (sort === 'price') {
      return products.sort((a, b) => byWatch(a, b) || a.priceMYR - b.priceMYR || featuredOrder(a, b))
    }
    return products.sort((a, b) => byWatch(a, b) || featuredOrder(a, b))
  }, [view, group, showSoldOut, sort, bestBySlug, featuredOrder, watched])

  const available = useMemo(
    () =>
      view.products.filter((p) =>
        group === 'watching' ? watched.has(p.slug) : group === 'all' || p.group === group,
      ).length,
    [view, group, watched],
  )

  const openPart = useCallback((part: Part) => {
    setStack((prev) => {
      if (prev[prev.length - 1]?.id === part.id && prev[prev.length - 1]?.cat === part.cat) {
        return prev
      }
      return [...prev, part]
    })
  }, [])

  // Re-enable the manual refresh exactly as the clock rolls past the next :00.
  // Only armed while it is spent — once live there is nothing to wait for.
  useEffect(() => {
    if (canRefresh) return
    const t = setTimeout(() => setCanRefresh(canRefreshStockNow()), msToNextHour() + 500)
    return () => clearTimeout(t)
  }, [canRefresh])

  // A scrape run scrapes, commits and redeploys before the new file is live, so
  // the outcome arrives minutes after the click — poll for it rather than block.
  const POLL_EVERY_MS = 25_000
  const POLL_TRIES = 12 // ~5 minutes, comfortably past a scrape-build-deploy run

  const settle = useCallback((note: Exclude<typeof refreshNote, 'scanning'>) => {
    setRefreshNote(note)
    setRefreshing(false)
    setCanRefresh(canRefreshStockNow())
  }, [])

  const refreshStock = useCallback(async () => {
    if (!canRefresh || refreshing) return
    setRefreshing(true)

    // No dispatcher wired up (dev, or not yet deployed): the most a page can do
    // on its own is re-pull the last published file.
    if (!stockScrapeConfigured()) {
      markStockRefreshed()
      try {
        const fresh = await loadStock(true)
        setStock(fresh)
        setError(null)
      } catch {
        // Keep whatever is on screen — the refresh is a nicety, not a reload.
      } finally {
        settle('nochange')
      }
      return
    }

    setRefreshNote('scanning')
    try {
      await triggerStockScrape()
    } catch {
      // The scan never started, so don't spend the slot — let them try again.
      settle('error')
      return
    }
    // The scan is really running now; spend the hour so the shop isn't hit again.
    markStockRefreshed()

    // Wait for the run to republish, then adopt the new file the moment the
    // shelf's timestamp moves. Unchanged after the window means nothing moved.
    const before = stock?.updatedAt
    let tries = 0
    const poll = async () => {
      tries += 1
      try {
        const fresh = await loadStock(true)
        if (fresh.updatedAt !== before) {
          setStock(fresh)
          setError(null)
          settle('updated')
          return
        }
      } catch {
        // A transient miss mid-deploy is expected — keep polling.
      }
      if (tries >= POLL_TRIES) {
        settle('nochange')
        return
      }
      pollRef.current = setTimeout(poll, POLL_EVERY_MS)
    }
    pollRef.current = setTimeout(poll, POLL_EVERY_MS)
  }, [canRefresh, refreshing, stock, settle])

  // Drop any in-flight poll if the reader leaves the page.
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])

  const updated = when(stock?.updatedAt)
  const shelfDay = day(stock?.updatedAt)
  const checkedDay = day(stock?.checkedAt)
  // Read at render rather than held in state: it is written by the live view on
  // a different visit, so state here would go stale the moment you came back.
  const liveAt = when(lastLiveCheck() ?? undefined)

  // One line, several states: scanning while a run is in flight, the outcome
  // once it settles, otherwise the button (or when it frees up again).
  const refreshControl = !stock ? null : refreshing ? (
    <span className="attr-refresh-note"> · Scanning the shop… (~2 min)</span>
  ) : canRefresh ? (
    <>
      {' · '}
      <button className="attr-refresh" onClick={refreshStock}>
        Check if reopened
      </button>
      <span className="attr-refresh-note">
        {refreshNote === 'error' ? ' — couldn’t start, try again' : ' — once an hour'}
      </span>
    </>
  ) : (
    <span className="attr-refresh-note">
      {' · '}
      {refreshNote === 'updated'
        ? 'Updated just now'
        : refreshNote === 'nochange'
          ? `No change — next check at ${nextRefreshLabel()}`
          : `Checked — next at ${nextRefreshLabel()}`}
    </span>
  )

  return (
    <>
      <PageHeader
        title="Stock"
        sub="What's available at Malaysian official prices"
        action={
          <div className="page-actions">
            {/* Signing in belongs on this page too — the watchlist lives here,
                and it is the only thing on it worth carrying between devices. */}
            <SyncButton />
            <button
              className={showSource ? 'info-toggle open' : 'info-toggle'}
              onClick={() => setShowSource((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={showSource}
            >
              <span aria-hidden="true">ⓘ</span> Where this comes from
            </button>
          </div>
        }
      />

      <SyncNotice />

      {stock?.stale && (
        <p className="notice notice-stale">
          Showing a saved copy — couldn't reach the stock feed.
        </p>
      )}

      {/*
        Without this the page says "Stock last changed 6 Aug" and a reader
        reasonably concludes KGB has not restocked since — when in truth the
        shop went members-only that day and we have not been able to see the
        shelf at all. Say which of the two it is.
      */}
      {live && (
        <p className="notice notice-live">
          <strong>Your live view from KGB.</strong> {view.products.length} in stock, ranked by the
          same tiers and verdicts as the rest of the app. This came from your own signed-in session
          a moment ago — it is not published, and nobody else sees it.{' '}
          <a href="#/stock">Back to the published list</a>
        </p>
      )}

      {/*
        Shown for either way of losing sight of the shelf — members-only, or
        simply unreachable. The reason differs and is worth saying, but the
        two things a reader can do about it are the same, and gating the grab
        tool on `gated` alone meant it silently vanished the day a scrape
        failed instead of being turned away.
      */}
      {!live && stock?.health && stock.health !== 'ok' && (
        <div className="notice notice-stale">
          {stock.health === 'gated' ? (
            <p className="notice-text">
              <strong>KGB's shop is members-only now.</strong> It asks everyone to sign in and take a
              place in the queue, so BeyClub can't read availability any more. Below is what the shop
              sold as of {shelfDay} — prices and tiers still hold. Nothing here says in stock or sold
              out, because nobody can check; only a live list from inside the shop can.
              {checkedDay && ` Checked again ${checkedDay}.`}
            </p>
          ) : (
            <p className="notice-text">
              <strong>Couldn't reach the KGB shop.</strong> Below is what it sold as of {shelfDay} —
              prices and tiers still hold, but nothing here says in stock or sold out, because the
              shelf couldn't be read.
              {checkedDay && ` Tried again ${checkedDay}.`} If you're a member, you can still pull a
              live list from inside the shop yourself.
            </p>
          )}
          {/*
            The only proof the grab actually ran, and the answer to "did that
            do anything?" — the published shelf below deliberately does not
            change when it does.
          */}
          {liveAt && (
            <p className="notice-sub">
              You last pulled a live list from the shop {liveAt}. It isn't saved here — the shelf
              below stays as KGB last let us read it.
            </p>
          )}
          {/*
            The two things a reader can actually do about it, as buttons rather
            than prose links — the tool is useless if nobody finds it.
          */}
          <div className="notice-actions">
            {/*
              "Set up" rather than "see": this opens instructions, not a stock
              list. The script can only run on KGB's own page, so there is a
              one-time install between the click and the payoff, and a label
              promising the payoff just makes the page feel broken.
            */}
            <a className="notice-btn" href="./grab.html">
              Set up "see all stock"
            </a>
            <a
              className="notice-btn ghost"
              href="https://kelabgasingbeyblade.my/shop"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sign in at KGB ↗
            </a>
          </div>
        </div>
      )}

      {showSource && (
        <Sheet label="Where this comes from" onClose={() => setShowSource(false)}>
          <div className="attribution">
            <h2 className="sheet-name">Where this comes from</h2>
            <p className="attr-blurb">
              Prices and availability are read straight from the Kelab Gasing Beyblade shop — nobody
              types them in here. The tier against each bey is our own blended ranking, not the
              shop's; KGB neither supplies it nor endorses it.
            </p>
            {stock?.health && stock.health !== 'ok' && (
              <>
                <p className="attr-blurb">
                  {stock.health === 'gated'
                    ? `KGB has since made the shop members-only, reserving places in the queue for
                       signed-in accounts, so it can no longer be read from out here. We have left
                       the last catalogue we saw in place and check once a day whether the door has
                       reopened — nothing on this page is a way around their sign-in.`
                    : `The shop could not be reached on the last check, so availability below is the
                       last catalogue we saw rather than a live read. We try again once a day.`}
                </p>
                {/*
                  The one place a reader wondering "why is this stale?" will look, so it is
                  where the answer belongs. Not in the nav: that bar stays at two tabs.
                */}
                <p className="attr-blurb">
                  If you're a member, <a href="./grab.html">Stock at a glance</a> walks you through
                  installing a button — once — that then shows everything in stock on one screen
                  while you're signed in, so your 15 minutes in the queue aren't spent paging
                  through the shop.
                </p>
              </>
            )}
            <p className="attr-blurb">
              A booster or deck set has no ranking of its own, so it is graded on the strongest
              blade in the box, and every blade inside is listed so you can judge the rest. A
              product whose contents nobody has rated gets no verdict at all.
            </p>
            <div className="attr-credits">
              <a href={stock?.source.url ?? 'https://kelabgasingbeyblade.my/'} target="_blank" rel="noopener noreferrer">
                {stock?.source.name ?? 'Kelab Gasing Beyblade'} ↗
              </a>
            </div>
            {updated && (
              <p className="attr-time">
                Stock last changed {updated} (MYT)
                {refreshControl}
              </p>
            )}
          </div>
        </Sheet>
      )}

      <div className="chip-row" role="tablist" aria-label="Product group">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={group === f}
            className={group === f ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setGroup(f)}
          >
            {GROUP_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="sort-row">
        <span className="build-label">Sort</span>
        <div className="chip-row" role="tablist" aria-label="Sort by">
          {SORTS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={sort === s}
              className={sort === s ? 'filter-chip active' : 'filter-chip'}
              onClick={() => setSort(s)}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {stock && (
        <div className="stock-bar">
          <span>
            {visible.length} of {available} shown
          </span>
          {/* Nothing to toggle when every card is silent about availability. */}
          {knowsAvailability && (
            <button
              className={showSoldOut ? 'info-toggle open' : 'info-toggle'}
              onClick={() => setShowSoldOut((v) => !v)}
              aria-pressed={showSoldOut}
            >
              {showSoldOut ? 'Hide sold out' : 'Show sold out'}
            </button>
          )}
        </div>
      )}

      {loading && <div className="glass notice">Loading stock…</div>}

      {error && !stock && (
        <div className="glass notice notice-error">
          Couldn't load the stock list — {error}. Check your connection and try again.
        </div>
      )}

      {stock && visible.length === 0 && (
        <div className="glass notice">
          {group === 'watching'
            ? 'Nothing starred yet — tap ★ on a product to keep an eye on it.'
            : knowsAvailability
              ? 'Nothing in this group is in stock right now — try “Show sold out”.'
              : 'Nothing in this group.'}
        </div>
      )}

      <div className="part-grid">
        {visible.map((product) => (
          <StockCard
            key={product.slug}
            product={product}
            contents={stockIndex.contents(product)}
            onOpen={openPart}
            watched={watched.has(product.slug)}
            onToggleWatch={onToggleWatch}
            showAvailability={knowsAvailability}
          />
        ))}
      </div>

      <PartSheet
        stack={stack}
        index={partIndex}
        notes={notes}
        listings={stockIndex.listingsFor}
        onOpen={openPart}
        onBack={() => setStack((prev) => prev.slice(0, -1))}
        onClose={() => setStack([])}
      />
    </>
  )
}
