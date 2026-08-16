import { useCallback, useEffect, useMemo, useState } from 'react'
import BuildCard, { PartStrip } from '../components/BuildCard'
import BuildEditorSheet from '../components/BuildEditorSheet'
import ConfirmDelete from '../components/ConfirmDelete'
import PageHeader from '../components/PageHeader'
import Sheet from '../components/Sheet'
import { SyncButton, SyncNotice } from '../components/SyncControls'
import {
  buildParts,
  buildTitle,
  deleteBuild,
  deleteDeck,
  duplicateParts,
  isEmptyBuild,
  newBuild,
  newDeck,
  readBuilds,
  saveBuild,
  saveDeck,
  type BuildsFile,
} from '../lib/builds'
import { ownedKeys } from '../lib/collection'
import { loadDataset } from '../lib/loadData'
import { buildPartIndex, type PartIndex } from '../lib/partIndex'
import { CATEGORY_SINGULAR } from '../lib/tiers'
import { applyDelete, applyLocal, useUserData } from '../lib/userSync'
import type { Dataset, Deck, SavedBuild } from '../lib/types'

type Tab = 'builds' | 'decks'

const DECK_SIZE = 3

export default function BuildsPage() {
  const [data, setData] = useState<Dataset | null>(null)
  const { entries, builds, decks } = useUserData()
  const [tab, setTab] = useState<Tab>('builds')
  const [editing, setEditing] = useState<SavedBuild | null>(null)
  const [deckOpen, setDeckOpen] = useState<Deck | null>(null)

  /** Which catalogue parts are owned, for the build editor's "only parts I own" filter. */
  const owned = useMemo(() => ownedKeys(entries), [entries])

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

  const parts = data?.parts ?? []
  const index = useMemo(() => buildPartIndex(parts), [parts])

  const commit = useCallback((next: BuildsFile) => applyLocal({ builds: next.builds, decks: next.decks }), [])

  /** Deletes need a tombstone, or the next merge hands the record straight back. */
  const commitDelete = useCallback(
    (next: BuildsFile, id: string) => applyDelete({ builds: next.builds, decks: next.decks }, [id]),
    [],
  )

  const onSaveBuild = useCallback(
    (build: SavedBuild) => {
      commit(saveBuild(build, readBuilds()))
      setEditing(null)
    },
    [commit],
  )

  const buildById = useMemo(() => new Map(builds.map((b) => [b.id, b])), [builds])

  return (
    <>
      <PageHeader
        title="Builds"
        sub="Put beys together, then take three to a tournament"
        action={
          <div className="page-actions">
            <SyncButton />
            <button
              className="info-toggle"
              onClick={() => {
                if (tab === 'builds') {
                  setEditing(newBuild())
                } else {
                  const deck = newDeck('New deck')
                  commit(saveDeck(deck, readBuilds()))
                  setDeckOpen(deck)
                }
              }}
            >
              + New
            </button>
          </div>
        }
      />

      <SyncNotice />

      <div className="chip-row" role="tablist" aria-label="View">
        {(['builds', 'decks'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setTab(t)}
          >
            {t === 'builds'
              ? `Builds${builds.length ? ` (${builds.length})` : ''}`
              : `Decks${decks.length ? ` (${decks.length})` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'builds' && (
        <>
          {builds.length === 0 && (
            <div className="glass notice">No builds yet — tap "+ New" to put one together.</div>
          )}
          <div className="build-grid">
            {builds.map((build) => (
              <BuildCard key={build.id} build={build} index={index} onClick={() => setEditing(build)} />
            ))}
          </div>
        </>
      )}

      {tab === 'decks' && (
        <>
          {decks.length === 0 && <div className="glass notice">No decks yet — tap "+ New" to start one.</div>}
          <div className="build-grid">
            {decks.map((deck) => {
              const decksBuilds = deck.buildIds
                .map((id) => buildById.get(id))
                .filter((b): b is SavedBuild => Boolean(b))
              const dupes = deck.allowDuplicates ? [] : duplicateParts(decksBuilds)
              return (
                <button key={deck.id} className="glass glass-lit build-card" onClick={() => setDeckOpen(deck)}>
                  <span className="build-card-title">{deck.name}</span>
                  <span className="collection-empty-hint">
                    {decksBuilds.length} of {DECK_SIZE} beys
                  </span>

                  {/* The three beys at a glance — a deck is recognised by what's in it. */}
                  <span className="deck-beys">
                    {decksBuilds.map((b) => (
                      <span key={b.id} className="deck-bey">
                        <span className="deck-bey-name">{buildTitle(b, index)}</span>
                        <PartStrip parts={buildParts(b, index)} size={24} />
                      </span>
                    ))}
                    {decksBuilds.length === 0 && <span className="collection-empty-hint">No beys added yet</span>}
                  </span>

                  {dupes.length > 0 && (
                    <span className="collection-tile-flag">
                      {dupes.length} repeated part{dupes.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {deck.notes && <span className="collection-notes">{deck.notes}</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      {editing && (
        <BuildEditorSheet
          build={editing}
          parts={parts}
          index={index}
          owned={owned}
          onSave={onSaveBuild}
          onDelete={
            builds.some((b) => b.id === editing.id)
              ? () => {
                  commitDelete(deleteBuild(editing.id, readBuilds()), editing.id)
                  setEditing(null)
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}

      {deckOpen && (
        <DeckSheet
          deck={deckOpen}
          builds={builds}
          index={index}
          onChange={(deck) => {
            commit(saveDeck(deck, readBuilds()))
            setDeckOpen(deck)
          }}
          onDelete={() => {
            commitDelete(deleteDeck(deckOpen.id, readBuilds()), deckOpen.id)
            setDeckOpen(null)
          }}
          onClose={() => setDeckOpen(null)}
        />
      )}
    </>
  )
}

function DeckSheet({
  deck,
  builds,
  index,
  onChange,
  onDelete,
  onClose,
}: {
  deck: Deck
  builds: SavedBuild[]
  index: PartIndex
  onChange: (deck: Deck) => void
  onDelete: () => void
  onClose: () => void
}) {
  const chosen = deck.buildIds.map((id) => builds.find((b) => b.id === id)).filter((b): b is SavedBuild => Boolean(b))
  const dupes = duplicateParts(chosen)
  const full = deck.buildIds.length >= DECK_SIZE

  const toggle = (id: string) => {
    const has = deck.buildIds.includes(id)
    if (!has && full) return
    onChange({ ...deck, buildIds: has ? deck.buildIds.filter((b) => b !== id) : [...deck.buildIds, id] })
  }

  const candidates = builds.filter((b) => !isEmptyBuild(b))

  return (
    <Sheet label="Deck" onClose={onClose}>
      <h2 className="sheet-name sheet-name-lead">Deck</h2>

      <div className="collection-field">
        <label htmlFor="deck-name">Name</label>
        <input
          id="deck-name"
          type="text"
          value={deck.name}
          onChange={(e) => onChange({ ...deck, name: e.target.value })}
        />
      </div>

      {/* A warning, never a block: a repeated part is only wrong if you own
          one of it, and only the owner knows that. The deck saves either way. */}
      {!deck.allowDuplicates && dupes.length > 0 && (
        <div className="notice notice-stale deck-warning">
          <strong>Same part in more than one bey.</strong>{' '}
          {dupes.map((d) => `${d.code} (${CATEGORY_SINGULAR[d.cat]}) ×${d.count}`).join(', ')}. You can only run a part
          in one bey at a time unless you own doubles — the deck is saved either way.
        </div>
      )}

      <label className="collection-check-line">
        <input
          type="checkbox"
          checked={Boolean(deck.allowDuplicates)}
          onChange={(e) => onChange({ ...deck, allowDuplicates: e.target.checked })}
        />
        <span>Allow duplicate parts</span>
      </label>

      <section className="sheet-block">
        <h3>
          Beys — {deck.buildIds.length} of {DECK_SIZE}
        </h3>
        {candidates.length === 0 && <p className="collection-empty-hint">No builds to add yet.</p>}
        {/* Same card as the Builds grid, so a bey looks the same wherever
            you're picking it — tap to add or drop it from the deck. */}
        <div className="build-grid">
          {candidates.map((build) => {
            const on = deck.buildIds.includes(build.id)
            return (
              <BuildCard
                key={build.id}
                build={build}
                index={index}
                selected={on}
                disabled={!on && full}
                onClick={() => toggle(build.id)}
              />
            )
          })}
        </div>
      </section>

      <div className="collection-field">
        <label htmlFor="deck-notes">Notes (optional)</label>
        <textarea
          id="deck-notes"
          value={deck.notes ?? ''}
          onChange={(e) => onChange({ ...deck, notes: e.target.value })}
          placeholder="Matchups, launch order, what to swap…"
        />
      </div>

      <button className="collection-submit" onClick={onClose}>
        Save deck
      </button>
      <ConfirmDelete
        label="Delete deck"
        question={`Delete "${deck.name}"? The beys in it stay in your builds.`}
        onConfirm={onDelete}
      />
    </Sheet>
  )
}
