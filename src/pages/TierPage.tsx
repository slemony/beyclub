import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Attribution, { RankingToggle, StaleNotice } from '../components/Attribution'
import PageHeader from '../components/PageHeader'
import PartCard from '../components/PartCard'
import PartSheet from '../components/PartSheet'
import Sheet from '../components/Sheet'
import TierTable from '../components/TierTable'
import { loadDataset, loadPartNotes } from '../lib/loadData'
import { buildPartIndex } from '../lib/partIndex'
import { searchParts } from '../lib/search'
import { buildStockIndex, loadStock } from '../lib/stock'
import {
  CATEGORY_LABELS,
  compareBySpec,
  comparePartsInTier,
  MEASURED_CATEGORIES,
  mergeVariants,
  sortsFor,
  specSortLabel,
  specValueLabel,
  tierRank,
  type SortDir,
  type SpecSort,
} from '../lib/tiers'
import type { Dataset, Part, PartCategory, PartNotes, StockProduct } from '../lib/types'

type Filter = PartCategory | 'all'

const FILTERS: Filter[] = ['all', 'blade', 'ratchet', 'bit', 'assist', 'overblade']

export default function TierPage() {
  const [data, setData] = useState<Dataset | null>(null)
  const [notes, setNotes] = useState<Record<string, PartNotes>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<Filter>('all')
  const [sort, setSort] = useState<SpecSort>('tier')
  const [dir, setDir] = useState<SortDir>('desc')
  // Folded by default: the sheet lists every box a mould was sold in, and
  // twelve tiles of Dran Sword is a worse answer to "what should I use" than
  // one tile that says twelve.
  const [merged, setMerged] = useState(true)
  const [query, setQuery] = useState('')
  const [stack, setStack] = useState<Part[]>([])
  const [showSources, setShowSources] = useState(false)
  const [listings, setListings] = useState<StockProduct[]>([])

  // Tapping the tab you are already on should hand back a clean list rather
  // than the search you left behind. Keyed on the location rather than the
  // pathname, which does not change when the tab reopens itself.
  const { key: visit } = useLocation()
  useEffect(() => setQuery(''), [visit])

  useEffect(() => {
    let cancelled = false

    loadDataset()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Editorial notes are static — fetch once.
  useEffect(() => {
    loadPartNotes().then(setNotes).catch(() => setNotes({}))
  }, [])

  // Prices are a bonus on this page, so a shop that cannot be reached costs the
  // "Where to buy" block and nothing else.
  useEffect(() => {
    loadStock()
      .then((s) => setListings(s.products))
      .catch(() => setListings([]))
  }, [])

  /**
   * A handful of bits have no placement record, so the feed never spells their
   * code out — but our own notes do. Filling the name in here means every part
   * is searchable and readable by name, not just the ones that win.
   */
  const parts = useMemo(() => {
    if (!data) return []
    if (!Object.keys(notes).length) return data.parts
    return data.parts.map((p) => {
      if (p.nameEn) return p
      const label = notes[`${p.cat}:${p.id}`]?.profile?.label
      return label ? { ...p, nameEn: label } : p
    })
  }, [data, notes])

  const index = useMemo(() => buildPartIndex(parts), [parts])
  const stockIndex = useMemo(() => buildStockIndex(listings, parts), [listings, parts])

  const visible = useMemo(() => {
    const inCategory = category === 'all' ? parts : parts.filter((p) => p.cat === category)
    return searchParts(inCategory, query)
  }, [parts, category, query])

  /**
   * Folded after the search, not before: someone typing a box code is looking
   * for that box, and folding first would hide the row they asked for behind
   * whichever release of the mould graded best.
   */
  const folded = useMemo(() => (merged ? mergeVariants(visible) : null), [merged, visible])
  const shown = folded?.parts ?? visible

  /**
   * Weight and gears exist only for bits and ratchets, so the chips only
   * appear for those two. Offering them on a blade list would be offering a
   * sort that does nothing.
   */
  const measured = category !== 'all' && MEASURED_CATEGORIES.includes(category)
  const bySpec = measured && sort !== 'tier'

  // Leaving the Bit filter with Weight still selected would hand back a list
  // that cannot honour it.
  // Leaving a category takes its sorts with it — Burst is a bit's alone, and a
  // ratchet list ordered by it would rank every row as unmeasured.
  useEffect(() => {
    if (!measured || !sortsFor(category as PartCategory).includes(sort)) setSort('tier')
  }, [measured, category, sort])

  /**
   * A measurement cuts across the tier bands — the heaviest bit in the game is
   * not in the top one — so sorting by it drops the bands for a single ranked
   * list. Each card still carries its grade.
   */
  const ranked = useMemo(
    () => (bySpec ? [...shown].sort(compareBySpec(sort as Exclude<SpecSort, 'tier'>, dir)) : shown),
    [shown, bySpec, sort, dir],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, Part[]>()
    for (const p of shown) {
      const list = map.get(p.tier)
      if (list) list.push(p)
      else map.set(p.tier, [p])
    }
    for (const list of map.values()) list.sort(comparePartsInTier)
    return [...map.entries()].sort((a, b) => tierRank(a[0]) - tierRank(b[0]))
  }, [shown])

  const openPart = useCallback((part: Part) => {
    setStack((prev) => {
      // Re-opening the part already on top would stack a duplicate.
      if (prev[prev.length - 1]?.id === part.id && prev[prev.length - 1]?.cat === part.cat) {
        return prev
      }
      return [...prev, part]
    })
  }, [])

  const searching = query.trim().length > 0

  return (
    <>
      <PageHeader
        title="Tier List"
        sub="Tournament results, Taiwan and Japan — blended"
        action={<RankingToggle open={showSources} onToggle={() => setShowSources((v) => !v)} />}
      />

      {data?.stale && <StaleNotice fetchedAt={data.fetchedAt} />}

      {showSources && (
        <Sheet label="How this is ranked" onClose={() => setShowSources(false)}>
          <Attribution
            tournament={data?.tournament}
            fetchedAt={data?.fetchedAt}
            stale={data?.stale}
          />
        </Sheet>
      )}

      <div className="filter-row">
        <input
          className="glass search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — try “aero, cx13”"
          aria-label="Search parts"
        />
        <button
          className={merged ? 'merge-toggle on' : 'merge-toggle'}
          onClick={() => setMerged((v) => !v)}
          aria-pressed={merged}
          title={
            merged
              ? 'Showing one tile per blade — tap to list every box'
              : 'Showing every box — tap to fold releases of the same blade together'
          }
        >
          {merged ? 'Folded' : 'All boxes'}
        </button>
      </div>

      <div className="chip-row" role="tablist" aria-label="Category">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={category === f}
            className={category === f ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setCategory(f)}
          >
            {CATEGORY_LABELS[f]}
          </button>
        ))}
      </div>

      {measured && (
        <div className="chip-row" role="tablist" aria-label="Sort by">
          {sortsFor(category as PartCategory).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={sort === key}
              className={sort === key ? 'filter-chip active' : 'filter-chip'}
              // Tapping the sort already in force reverses it. Lightest-first
              // and heaviest-first are both real questions, and a second row of
              // chips to answer them would cost more than it explained. Picking
              // a different measurement starts at "most first" again — carrying
              // a reversal across would answer a question nobody asked.
              onClick={() =>
                sort === key && key !== 'tier'
                  ? setDir((d) => (d === 'desc' ? 'asc' : 'desc'))
                  : (setSort(key), setDir('desc'))
              }
              title={sort === key && key !== 'tier' ? 'Tap again to reverse' : undefined}
            >
              {specSortLabel(key, category as PartCategory, sort === key ? dir : undefined)}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="glass notice">Loading tier data…</div>}

      {error && !data && (
        <div className="glass notice notice-error">
          Couldn't load the tier data — {error}. Check your connection and try again.
        </div>
      )}

      {!loading && data && shown.length === 0 && (
        <div className="glass notice">Nothing matches “{query}”.</div>
      )}

      {/* Search results get the detailed card; so does a measurement sort, which
          has no bands to draw. Browsing by grade gets the tier table. */}
      {searching || bySpec ? (
        <div className="part-grid">
          {ranked.map((p) => (
            <PartCard
              key={`${p.cat}-${p.id}`}
              part={p}
              onOpen={openPart}
              measure={bySpec ? specValueLabel(p, sort) : undefined}
              variants={folded?.counts.get(`${p.cat}-${p.id}`)}
            />
          ))}
        </div>
      ) : (
        <TierTable groups={grouped} onOpen={openPart} counts={folded?.counts} />
      )}

      <PartSheet
        stack={stack}
        index={index}
        notes={notes}
        listings={stockIndex.listingsFor}
        onOpen={openPart}
        onBack={() => setStack((prev) => prev.slice(0, -1))}
        onClose={() => setStack([])}
      />
    </>
  )
}
