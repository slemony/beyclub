import { useCallback, useEffect, useMemo, useState } from 'react'
import Attribution from '../components/Attribution'
import PageHeader from '../components/PageHeader'
import PartCard from '../components/PartCard'
import PartSheet from '../components/PartSheet'
import SourceBar from '../components/SourceBar'
import TierTable from '../components/TierTable'
import { loadDataset, loadPartNotes } from '../lib/loadData'
import { buildPartIndex } from '../lib/partIndex'
import { SOURCES } from '../lib/sources'
import { CATEGORY_LABELS, normalize, tierRank } from '../lib/tiers'
import type { Dataset, Part, PartCategory, PartNotes, SourceId } from '../lib/types'

type Filter = PartCategory | 'all'

const FILTERS: Filter[] = ['all', 'blade', 'ratchet', 'bit']
const SOURCE_KEY = 'beyclub:source'

export default function TierPage() {
  const [source, setSource] = useState<SourceId>(
    () => (localStorage.getItem(SOURCE_KEY) as SourceId) || 'community',
  )
  const [data, setData] = useState<Dataset | null>(null)
  const [notes, setNotes] = useState<Record<string, PartNotes>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [stack, setStack] = useState<Part[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    loadDataset(source)
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
  }, [source])

  // Editorial notes are static and shared across sources — fetch once.
  useEffect(() => {
    loadPartNotes().then(setNotes).catch(() => setNotes({}))
  }, [])

  useEffect(() => {
    localStorage.setItem(SOURCE_KEY, source)
  }, [source])

  const index = useMemo(
    () => (data ? buildPartIndex(data.parts, data.combos) : null),
    [data],
  )

  const visible = useMemo(() => {
    if (!data) return []
    const q = normalize(query)
    return data.parts.filter((p) => {
      if (category !== 'all' && p.cat !== category) return false
      if (!q) return true
      return (
        normalize(p.id).includes(q) ||
        normalize(p.name).includes(q) ||
        (p.nameEn ? normalize(p.nameEn).includes(q) : false)
      )
    })
  }, [data, category, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Part[]>()
    for (const p of visible) {
      const list = map.get(p.tier)
      if (list) list.push(p)
      else map.set(p.tier, [p])
    }
    return [...map.entries()].sort((a, b) => tierRank(a[0]) - tierRank(b[0]))
  }, [visible])

  const openPart = useCallback((part: Part) => {
    setStack((prev) => {
      // Re-opening the part already on top would stack a duplicate.
      if (prev[prev.length - 1]?.id === part.id && prev[prev.length - 1]?.cat === part.cat) {
        return prev
      }
      return [...prev, part]
    })
  }, [])

  const meta = SOURCES[source]
  const searching = query.trim().length > 0

  return (
    <>
      <PageHeader title="Tier List" sub="Who ranks what, and on what evidence" />

      <SourceBar active={source} onChange={setSource} />
      <Attribution meta={meta} fetchedAt={data?.fetchedAt} stale={data?.stale} />

      <div className="filter-row">
        <input
          className="glass search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search part ID or name…"
          aria-label="Search parts"
        />
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

      {loading && <div className="glass notice">Loading {meta.label.toLowerCase()} data…</div>}

      {error && !data && (
        <div className="glass notice notice-error">
          Couldn't load this dataset — {error}. Check your connection and try again.
        </div>
      )}

      {!loading && data && visible.length === 0 && (
        <div className="glass notice">Nothing matches “{query}”.</div>
      )}

      {/* Search results get the detailed card; browsing gets the tier table. */}
      {searching ? (
        <div className="part-grid">
          {visible.map((p) => (
            <PartCard key={`${p.cat}-${p.id}`} part={p} onOpen={openPart} />
          ))}
        </div>
      ) : (
        <TierTable groups={grouped} onOpen={openPart} />
      )}

      <PartSheet
        stack={stack}
        combos={data?.combos ?? []}
        index={index}
        notes={notes}
        onOpen={openPart}
        onBack={() => setStack((prev) => prev.slice(0, -1))}
        onClose={() => setStack([])}
      />
    </>
  )
}
