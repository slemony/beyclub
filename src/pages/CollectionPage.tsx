import { useCallback, useEffect, useMemo, useState } from 'react'
import CollectionAddSheet from '../components/CollectionAddSheet'
import CollectionCard from '../components/CollectionCard'
import CollectionDetailSheet from '../components/CollectionDetailSheet'
import PageHeader from '../components/PageHeader'
import { SyncButton, SyncNotice } from '../components/SyncControls'
import PartSheet from '../components/PartSheet'
import { addParts, entryKey, removeEntry, removeSource, setSourceQty, totalQty } from '../lib/collection'
import { applyDelete, applyLocal, useUserData } from '../lib/userSync'
import { loadDataset, loadPartNotes } from '../lib/loadData'
import { buildPartIndex } from '../lib/partIndex'
import {
  CATEGORY_LABELS,
  compareBySpec,
  MEASURED_CATEGORIES,
  sortsFor,
  specSortLabel,
  specValueLabel,
  type SortDir,
  type SpecSort,
} from '../lib/tiers'
import type { CollectionEntry, Dataset, Part, PartCategory, PartNotes } from '../lib/types'

type Filter = PartCategory | 'all'

const CATS: PartCategory[] = ['blade', 'ratchet', 'bit', 'assist', 'overblade']
const FILTERS: Filter[] = ['all', ...CATS]

export default function CollectionPage() {
  const [data, setData] = useState<Dataset | null>(null)
  const [notes, setNotes] = useState<Record<string, PartNotes>>({})
  const { entries } = useUserData()
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SpecSort>('tier')
  const [dir, setDir] = useState<SortDir>('desc')
  const [showAdd, setShowAdd] = useState(false)
  const [detail, setDetail] = useState<CollectionEntry | null>(null)
  const [stack, setStack] = useState<Part[]>([])
  useEffect(() => {
    let cancelled = false
    loadDataset()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    loadPartNotes().then(setNotes).catch(() => setNotes({}))
  }, [])

  const parts = data?.parts ?? []
  const index = useMemo(() => buildPartIndex(parts), [parts])

  const partFor = useCallback(
    (entry: CollectionEntry) => (entry.code ? index.resolve(entry.code, entry.cat) : undefined),
    [index],
  )

  /**
   * Only bits and ratchets are measured, so the sort is offered only when the
   * list is showing one of them.
   */
  const measured = filter !== 'all' && MEASURED_CATEGORIES.includes(filter)
  const bySpec = measured && sort !== 'tier'

  // Leaving a category takes its sorts with it — Burst is a bit's alone, and a
  // ratchet list ordered by it would rank every row as unmeasured.
  useEffect(() => {
    if (!measured || !sortsFor(filter as PartCategory).includes(sort)) setSort('tier')
  }, [measured, filter, sort])

  /**
   * Sections in catalogue order, so a collection reads blade-first like every
   * other list here. A measurement only ever reorders within a section —
   * comparing a bit's 2.7 g against a blade's is not a comparison.
   */
  const groups = useMemo(() => {
    const shown = filter === 'all' ? entries : entries.filter((e) => e.cat === filter)
    const rank = bySpec ? compareBySpec(sort as Exclude<SpecSort, 'tier'>, dir) : null
    return CATS.map((cat) => {
      const items = shown.filter((e) => e.cat === cat)
      if (!rank) return { cat, items }
      // An entry with no catalogue part behind it has no measurement either;
      // `compareBySpec` already sorts the unmeasured to the back.
      const ordered = [...items].sort((a, b) => {
        const [pa, pb] = [partFor(a), partFor(b)]
        if (!pa && !pb) return 0
        if (!pa) return 1
        if (!pb) return -1
        return rank(pa, pb)
      })
      return { cat, items: ordered }
    }).filter((g) => g.items.length > 0)
  }, [entries, filter, bySpec, sort, dir, partFor])

  const owned = useMemo(() => entries.reduce((n, e) => n + totalQty(e), 0), [entries])

  /** Feeds the add sheet's "have N" badge, so a duplicate buy is visible before it's made. */
  const ownedCounts = useMemo(
    () => new Map(entries.map((e) => [entryKey(e), totalQty(e)])),
    [entries],
  )

  const openPart = useCallback((part: Part) => {
    setStack((prev) => {
      if (prev[prev.length - 1]?.id === part.id && prev[prev.length - 1]?.cat === part.cat) return prev
      return [...prev, part]
    })
  }, [])

  /**
   * Saves a shortened collection, tombstoning whatever it lost.
   *
   * Both the row and the individual acquisitions need one: the sync unions
   * acquisitions across devices, so a "came from CX-13" removed here without a
   * tombstone is handed straight back by the other device's copy.
   */
  const applyRemoval = useCallback(
    (next: CollectionEntry[]) => {
      const survivors = new Set<string>()
      for (const entry of next) {
        survivors.add(entry.id)
        for (const source of entry.sources) survivors.add(source.id)
      }
      const gone: string[] = []
      for (const entry of entries) {
        if (!survivors.has(entry.id)) gone.push(entry.id)
        for (const source of entry.sources) if (!survivors.has(source.id)) gone.push(source.id)
      }
      if (gone.length) applyDelete({ entries: next }, gone)
      else applyLocal({ entries: next })
    },
    [entries],
  )

  const onChangeSourceQty = useCallback(
    (entryId: string, sourceId: string, qty: number) => applyRemoval(setSourceQty(entryId, sourceId, qty, entries)),
    [entries, applyRemoval],
  )

  const onRemoveSource = useCallback(
    (entryId: string, sourceId: string) => applyRemoval(removeSource(entryId, sourceId, entries)),
    [entries, applyRemoval],
  )

  return (
    <>
      <PageHeader
        title="My Collection"
        sub={owned ? `${owned} parts across ${entries.length} entries` : 'The parts you own'}
        action={
          <div className="page-actions">
            <SyncButton />
            <button className="info-toggle" onClick={() => setShowAdd(true)}>
              + Add
            </button>
          </div>
        }
      />

      <SyncNotice />

      {entries.length > 0 && (
        <div className="chip-row" role="tablist" aria-label="Category">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? 'filter-chip active' : 'filter-chip'}
              onClick={() => setFilter(f)}
            >
              {CATEGORY_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      {measured && (
        <div className="chip-row" role="tablist" aria-label="Sort by">
          {sortsFor(filter as PartCategory).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={sort === key}
              className={sort === key ? 'filter-chip active' : 'filter-chip'}
              /* Tapping the sort already in force reverses it — see TierPage. */
              onClick={() =>
                sort === key && key !== 'tier'
                  ? setDir((d) => (d === 'desc' ? 'asc' : 'desc'))
                  : (setSort(key), setDir('desc'))
              }
              title={sort === key && key !== 'tier' ? 'Tap again to reverse' : undefined}
            >
              {specSortLabel(key, filter as PartCategory, sort === key ? dir : undefined)}
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 && (
        <div className="glass notice">Nothing in your collection yet — tap "+ Add" to add a part.</div>
      )}

      {entries.length > 0 && groups.length === 0 && (
        <div className="glass notice">Nothing in this category yet.</div>
      )}

      {groups.map(({ cat, items }) => (
        <section key={cat} className="collection-group">
          <div className="tier-head">
            <h2 className="collection-group-title">{CATEGORY_LABELS[cat]}</h2>
            <span className="tier-count">{items.length}</span>
          </div>
          <div className="collection-grid">
            {items.map((entry) => (
              <CollectionCard
                key={entry.id}
                entry={entry}
                part={partFor(entry)}
                onOpenDetails={setDetail}
                measure={bySpec ? specValueLabel(partFor(entry), sort) : undefined}
              />
            ))}
          </div>
        </section>
      ))}

      {showAdd && (
        <CollectionAddSheet
          parts={parts}
          index={index}
          ownedCounts={ownedCounts}
          onAdd={(inputs) => applyLocal({ entries: addParts(inputs, entries) })}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Re-read from `entries` rather than trusting what was clicked, so the
          sheet reflects edits made inside it. */}
      {detail &&
        (() => {
          const live = entries.find((e) => e.id === detail.id)
          if (!live) return null
          return (
            <CollectionDetailSheet
              entry={live}
              part={partFor(live)}
              onOpenPart={(part) => {
                setDetail(null)
                openPart(part)
              }}
              onChangeSourceQty={onChangeSourceQty}
              onRemoveSource={onRemoveSource}
              onRemoveEntry={(id) => {
                applyRemoval(removeEntry(id, entries))
                setDetail(null)
              }}
              onClose={() => setDetail(null)}
            />
          )
        })()}

      <PartSheet
        stack={stack}
        index={index}
        notes={notes}
        onOpen={openPart}
        onBack={() => setStack((prev) => prev.slice(0, -1))}
        onClose={() => setStack([])}
      />
    </>
  )
}
