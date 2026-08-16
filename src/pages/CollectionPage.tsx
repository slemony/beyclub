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
import { CATEGORY_LABELS } from '../lib/tiers'
import type { CollectionEntry, Dataset, Part, PartCategory, PartNotes } from '../lib/types'

type Filter = PartCategory | 'all'

const CATS: PartCategory[] = ['blade', 'ratchet', 'bit', 'assist', 'overblade']
const FILTERS: Filter[] = ['all', ...CATS]

export default function CollectionPage() {
  const [data, setData] = useState<Dataset | null>(null)
  const [notes, setNotes] = useState<Record<string, PartNotes>>({})
  const { entries } = useUserData()
  const [filter, setFilter] = useState<Filter>('all')
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

  /** Sections in catalogue order, so a collection reads blade-first like every other list here. */
  const groups = useMemo(() => {
    const shown = filter === 'all' ? entries : entries.filter((e) => e.cat === filter)
    return CATS.map((cat) => ({ cat, items: shown.filter((e) => e.cat === cat) })).filter((g) => g.items.length > 0)
  }, [entries, filter])

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

  const onChangeSourceQty = useCallback(
    (entryId: string, sourceId: string, qty: number) =>
      applyLocal({ entries: setSourceQty(entryId, sourceId, qty, entries) }),
    [entries],
  )

  const onRemoveSource = useCallback(
    (entryId: string, sourceId: string) => {
      const next = removeSource(entryId, sourceId, entries)
      // Dropping the last source removes the whole entry, which needs a
      // tombstone; trimming one of several is just an update.
      const gone = entries.some((e) => e.id === entryId) && !next.some((e) => e.id === entryId)
      if (gone) applyDelete({ entries: next }, [entryId])
      else applyLocal({ entries: next })
    },
    [entries],
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
              <CollectionCard key={entry.id} entry={entry} part={partFor(entry)} onOpenDetails={setDetail} />
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
                applyDelete({ entries: removeEntry(id, entries) }, [id])
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
