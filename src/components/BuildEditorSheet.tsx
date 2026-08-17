import { useMemo, useState } from 'react'
import ConfirmDelete from './ConfirmDelete'
import PartImage from './PartImage'
import Sheet from './Sheet'
import { BUILD_SLOTS, slotEnabled, type BuildSlot } from '../lib/builds'
import { partCode, type PartIndex } from '../lib/partIndex'
import { OWNED_ONLY, readPref, writePref } from '../lib/prefs'
import { applySuggestion, suggestBuild } from '../lib/recommend'
import { searchParts } from '../lib/search'
import { CATEGORY_SINGULAR, TIER_COLORS, tierLabel } from '../lib/tiers'
import { normalize } from '../lib/text'
import type { BuildRecord, Part, PartCategory, SavedBuild } from '../lib/types'

type Props = {
  build: SavedBuild
  parts: Part[]
  index: PartIndex
  /** Catalogue keys the user owns, for the "only what I own" filter. */
  owned: Set<string>
  onSave: (build: SavedBuild) => void
  /** Absent for a build that has never been saved — there is nothing to delete. */
  onDelete?: () => void
  onClose: () => void
}

const ownKey = (part: Part) => `${part.cat}|${normalize(partCode(part.cat, part.id))}`

/** "an assist blade", "a ratchet" — the category list spans both. */
const choosePrompt = (cat: PartCategory) => {
  const noun = CATEGORY_SINGULAR[cat].toLowerCase()
  return `Choose a${/^[aeiou]/.test(noun) ? 'n' : ''} ${noun}`
}

const EMPTY_RECORD: BuildRecord = { events: 0, placements: 0, firsts: 0 }

export default function BuildEditorSheet({ build, parts, index, owned, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<SavedBuild>(build)
  const [picking, setPicking] = useState<{ slot: BuildSlot; cat: PartCategory } | null>(null)
  const [query, setQuery] = useState('')
  // Sticky: a filter you set once should still be set the next time you open
  // the picker, and the next time you open the app.
  const [ownedOnly, setOwnedOnly] = useState(() => readPref(OWNED_ONLY, false))

  const changeOwnedOnly = (on: boolean) => {
    setOwnedOnly(on)
    writePref(OWNED_ONLY, on)
  }

  const blade = draft.blade ? index.resolve(draft.blade, 'blade') : undefined

  const suggestion = useMemo(
    () => (blade ? suggestBuild(blade, parts, index, ownedOnly ? owned : undefined) : {}),
    [blade, parts, index, ownedOnly, owned],
  )

  const results = useMemo(() => {
    if (!picking) return []
    let pool = parts.filter((p) => p.cat === picking.cat)
    if (ownedOnly) pool = pool.filter((p) => owned.has(ownKey(p)))
    return searchParts(pool, query).slice(0, 40)
  }, [picking, parts, query, ownedOnly, owned])

  const choose = (part: Part) => {
    setDraft((d) => {
      const next: SavedBuild = { ...d, [picking!.slot]: partCode(part.cat, part.id) }
      // Swapping the blade can invalidate slots the old one had — a CX build
      // re-based on a BX blade must not keep its over blade.
      if (picking!.slot === 'blade') {
        for (const [slot] of BUILD_SLOTS) {
          if (slot !== 'blade' && !slotEnabled(slot, part)) next[slot] = undefined
        }
      }
      return next
    })
    setPicking(null)
    setQuery('')
  }

  const clear = (slot: BuildSlot) => setDraft((d) => ({ ...d, [slot]: undefined }))

  const patchRecord = (patch: Partial<BuildRecord>) =>
    setDraft((d) => ({ ...d, record: { ...EMPTY_RECORD, ...d.record, ...patch } }))

  if (picking) {
    return (
      <Sheet label={choosePrompt(picking.cat)} onClose={() => setPicking(null)}>
        <h2 className="sheet-name sheet-name-lead">{choosePrompt(picking.cat)}</h2>

        <div className="collection-field">
          <input
            className="glass search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or code"
            aria-label="Search parts"
          />
        </div>

        <label className="collection-check-line build-owned-toggle">
          <input type="checkbox" checked={ownedOnly} onChange={(e) => changeOwnedOnly(e.target.checked)} />
          <span>Only parts I own</span>
        </label>

        {results.length === 0 && (
          <p className="collection-empty-hint">
            {ownedOnly ? "Nothing here you own — untick the filter to see the rest." : 'Nothing matches.'}
          </p>
        )}

        <div className="pick-grid">
          {results.map((part) => {
            const have = owned.has(ownKey(part))
            return (
              <button
                key={`${part.cat}-${part.id}`}
                className={have ? 'glass glass-lit collection-tile' : 'glass glass-lit collection-tile not-owned'}
                onClick={() => choose(part)}
              >
                <span className="collection-tile-top">
                  <PartImage src={part.img} alt={part.nameEn ?? part.name} size={44} />
                  <span
                    className="part-tier collection-tile-tier"
                    style={{ color: TIER_COLORS[part.tier], borderColor: `${TIER_COLORS[part.tier]}55` }}
                  >
                    {tierLabel(part.tier)}
                  </span>
                </span>
                <span className="collection-tile-name">{part.nameEn ?? part.name}</span>
                <span className="collection-tile-code">{part.id}</span>
                {!have && <span className="collection-tile-flag dim">not owned</span>}
              </button>
            )
          })}
        </div>

        <button className="collection-back" onClick={() => setPicking(null)}>
          ‹ Back to build
        </button>
      </Sheet>
    )
  }

  const hasSuggestion = Object.keys(suggestion).length > 0
  const record = draft.record ?? EMPTY_RECORD

  return (
    <Sheet label="Edit build" onClose={onClose}>
      <h2 className="sheet-name sheet-name-lead">{draft.blade ? 'Edit build' : 'New build'}</h2>

      <div className="collection-field">
        <label htmlFor="build-name">Name (optional)</label>
        <input
          id="build-name"
          type="text"
          value={draft.name ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="e.g. Tournament attack"
        />
      </div>

      <div className="build-slots">
        {BUILD_SLOTS.map(([slot, cat]) => {
          const code = draft[slot]
          const part = code ? index.resolve(code, cat) : undefined
          const hint = suggestion[slot as keyof typeof suggestion]
          const enabled = slotEnabled(slot, blade)

          return (
            <div key={slot} className={enabled ? 'build-slot' : 'build-slot disabled'}>
              <span className="build-slot-label">{CATEGORY_SINGULAR[cat]}</span>
              <button className="build-slot-body" disabled={!enabled} onClick={() => setPicking({ slot, cat })}>
                {part ? (
                  <>
                    <PartImage src={part.img} alt={part.nameEn ?? part.name} size={34} />
                    <span className="part-body">
                      <span className="part-name">{part.nameEn ?? part.name}</span>
                      <span className="part-id">{part.id}</span>
                    </span>
                    {!owned.has(ownKey(part)) && <span className="chip chip-dim">not owned</span>}
                    <span
                      className="part-tier"
                      style={{ color: TIER_COLORS[part.tier], borderColor: `${TIER_COLORS[part.tier]}55` }}
                    >
                      {tierLabel(part.tier)}
                    </span>
                  </>
                ) : (
                  <span className="build-slot-empty">
                    {!enabled
                      ? blade
                        ? `${blade.nameEn ?? blade.name} has no ${CATEGORY_SINGULAR[cat].toLowerCase()}`
                        : 'Choose a blade first'
                      : code
                        ? `${code} — not in the catalogue`
                        : choosePrompt(cat)}
                    {enabled && hint && ` · suggests ${hint.part.nameEn ?? hint.part.name}`}
                  </span>
                )}
              </button>
              {code && enabled && (
                <button className="collection-remove" onClick={() => clear(slot)}>
                  Clear
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Only offered once a blade is chosen — every suggestion is derived
          from that blade's own tournament record. */}
      {hasSuggestion && (
        <div className="build-suggest">
          <p className="collection-empty-hint">
            Suggested from {blade?.nameEn ?? blade?.name}'s tournament record — fills empty slots only.
          </p>
          <ul className="build-suggest-list">
            {Object.entries(suggestion).map(([slot, pick]) => (
              <li key={slot}>
                <strong>{pick.part.nameEn ?? pick.part.name}</strong> — {pick.why}
              </li>
            ))}
          </ul>
          <button
            className="collection-back build-suggest-btn"
            onClick={() => setDraft((d) => applySuggestion(d, suggestion))}
          >
            Fill empty slots
          </button>
        </div>
      )}

      <section className="sheet-block">
        <h3>Your record with this build</h3>
        <div className="record-row">
          {(
            [
              ['events', 'Events'],
              ['placements', 'Top 4'],
              ['firsts', 'Firsts'],
            ] as [keyof BuildRecord, string][]
          ).map(([field, label]) => (
            <div key={field} className="record-cell">
              <span className="record-label">{label}</span>
              <span className="collection-stepper">
                <button
                  type="button"
                  onClick={() => patchRecord({ [field]: Math.max(0, (record[field] as number) - 1) })}
                  aria-label={`Decrease ${label}`}
                >
                  −
                </button>
                <span>{record[field] as number}</span>
                <button
                  type="button"
                  onClick={() => patchRecord({ [field]: (record[field] as number) + 1 })}
                  aria-label={`Increase ${label}`}
                >
                  +
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="collection-field build-notes-field">
        <label htmlFor="build-notes">Notes (optional)</label>
        <textarea
          id="build-notes"
          value={draft.notes ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="How it launches, what it beats…"
        />
      </div>

      <button className="collection-submit" onClick={() => onSave(draft)}>
        Save build
      </button>
      {onDelete && (
        <ConfirmDelete
          label="Delete build"
          question={`Delete "${draft.name || 'this build'}"? Any deck using it loses that bey.`}
          onConfirm={onDelete}
        />
      )}
    </Sheet>
  )
}
