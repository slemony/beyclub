import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import PartSheet from '../components/PartSheet'
import Sheet from '../components/Sheet'
import StockCard from '../components/StockCard'
import { loadDataset, loadPartNotes } from '../lib/loadData'
import { buildPartIndex } from '../lib/partIndex'
import {
  buildStockIndex,
  canRefreshStockNow,
  gradedOn,
  loadStock,
  markStockRefreshed,
  msToNextHour,
  nextRefreshLabel,
} from '../lib/stock'
import { tierRank } from '../lib/tiers'
import type { Dataset, Part, PartNotes, StockFile, StockGroup, StockProduct } from '../lib/types'

type Filter = StockGroup | 'all'

const FILTERS: Filter[] = ['all', 'bey', 'stadium', 'launcher', 'case', 'merch']

const GROUP_LABELS: Record<Filter, string> = {
  all: 'All',
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

export default function StockPage() {
  const [stock, setStock] = useState<StockFile | null>(null)
  const [data, setData] = useState<Dataset | null>(null)
  const [notes, setNotes] = useState<Record<string, PartNotes>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Filter>('all')
  const [sort, setSort] = useState<SortKey>('default')
  const [showSoldOut, setShowSoldOut] = useState(false)
  const [stack, setStack] = useState<Part[]>([])
  const [showSource, setShowSource] = useState(false)
  const [canRefresh, setCanRefresh] = useState(() => canRefreshStockNow())
  const [refreshing, setRefreshing] = useState(false)

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

  const parts = data?.parts ?? []
  const partIndex = useMemo(() => buildPartIndex(parts), [parts])
  const stockIndex = useMemo(
    () => buildStockIndex(stock?.products ?? [], parts),
    [stock, parts],
  )

  /**
   * The part each product is judged on, computed once per stock/rating change
   * rather than inside the sort comparator — that runs O(n log n) times.
   */
  const bestBySlug = useMemo(() => {
    const map = new Map<string, Part | undefined>()
    for (const p of stock?.products ?? []) map.set(p.slug, gradedOn(stockIndex.contents(p)))
    return map
  }, [stock, stockIndex])

  const featuredOrder = useCallback(
    (a: StockProduct, b: StockProduct) =>
      Number(b.inStock) - Number(a.inStock) ||
      GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
      a.title.localeCompare(b.title),
    [],
  )

  const visible = useMemo(() => {
    const products = (stock?.products ?? []).filter(
      (p) => (group === 'all' || p.group === group) && (showSoldOut || p.inStock),
    )

    if (sort === 'tier') {
      return products.sort(
        (a, b) =>
          tierRank(bestBySlug.get(a.slug)?.tier ?? '-') - tierRank(bestBySlug.get(b.slug)?.tier ?? '-') ||
          featuredOrder(a, b),
      )
    }
    if (sort === 'buy') {
      return products.sort(
        (a, b) =>
          BUY_RANK[bestBySlug.get(a.slug)?.buy ?? ''] - BUY_RANK[bestBySlug.get(b.slug)?.buy ?? ''] ||
          featuredOrder(a, b),
      )
    }
    if (sort === 'price') {
      return products.sort((a, b) => a.priceMYR - b.priceMYR || featuredOrder(a, b))
    }
    return products.sort(featuredOrder)
  }, [stock, group, showSoldOut, sort, bestBySlug, featuredOrder])

  const available = useMemo(
    () => (stock?.products ?? []).filter((p) => group === 'all' || p.group === group).length,
    [stock, group],
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

  const refreshStock = useCallback(async () => {
    if (!canRefresh || refreshing) return
    setRefreshing(true)
    // Spend the slot on the attempt, not the outcome, so a failed fetch can't be
    // retried in a tight loop. Recompute the gate in `finally` so the "Checking…"
    // state stays visible for the duration of the fetch.
    markStockRefreshed()
    try {
      const fresh = await loadStock(true)
      setStock(fresh)
      setError(null)
    } catch {
      // Keep whatever is on screen — the refresh is a nicety, not a reload.
    } finally {
      setRefreshing(false)
      setCanRefresh(canRefreshStockNow())
    }
  }, [canRefresh, refreshing])

  const updated = when(stock?.updatedAt)

  return (
    <>
      <PageHeader
        title="Stock"
        sub="What's available at Malaysian official prices"
        action={
          <button
            className={showSource ? 'info-toggle open' : 'info-toggle'}
            onClick={() => setShowSource((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={showSource}
          >
            <span aria-hidden="true">ⓘ</span> Where this comes from
          </button>
        }
      />

      {stock?.stale && (
        <p className="notice notice-stale">
          Showing a saved copy — couldn't reach the stock feed.
        </p>
      )}

      {showSource && (
        <Sheet label="Where this comes from" onClose={() => setShowSource(false)}>
          <div className="attribution">
            <h2 className="sheet-name">Where this comes from</h2>
            <p className="attr-blurb">
              Prices and availability are read twice a day straight from the Kelab Gasing Beyblade
              shop — nobody types them in here. The tier against each bey is our own blended
              ranking, not the shop's; KGB neither supplies it nor endorses it.
            </p>
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
                {stock &&
                  (canRefresh ? (
                    <>
                      {' · '}
                      <button
                        className="attr-refresh"
                        onClick={refreshStock}
                        disabled={refreshing}
                      >
                        {refreshing ? 'Checking…' : 'Check now'}
                      </button>
                      <span className="attr-refresh-note"> — once an hour</span>
                    </>
                  ) : (
                    <span className="attr-refresh-note"> · Checked — next at {nextRefreshLabel()}</span>
                  ))}
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
          <button
            className={showSoldOut ? 'info-toggle open' : 'info-toggle'}
            onClick={() => setShowSoldOut((v) => !v)}
            aria-pressed={showSoldOut}
          >
            {showSoldOut ? 'Hide sold out' : 'Show sold out'}
          </button>
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
          Nothing in this group is in stock right now — try “Show sold out”.
        </div>
      )}

      <div className="part-grid">
        {visible.map((product) => (
          <StockCard
            key={product.slug}
            product={product}
            contents={stockIndex.contents(product)}
            onOpen={openPart}
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
