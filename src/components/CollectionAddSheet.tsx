import { useEffect, useMemo, useState } from 'react'
import PartImage from './PartImage'
import Sheet from './Sheet'
import { entryKey, type NewPart } from '../lib/collection'
import { partCode, type PartIndex } from '../lib/partIndex'
import { parseTerms, searchKey, searchParts } from '../lib/search'
import { CATEGORY_LABELS, CATEGORY_SINGULAR, TIER_COLORS, tierLabel } from '../lib/tiers'
import type { Part, PartCategory } from '../lib/types'

type Filter = PartCategory | 'all'

const CATS: PartCategory[] = ['blade', 'ratchet', 'bit', 'assist', 'overblade']
const SEARCH_FILTERS: Filter[] = ['all', ...CATS]

/** A blade's own stock fields, paired with the category resolve() needs for each. */
const STOCK_SLOTS: [keyof Pick<Part, 'stockRatchet' | 'stockBit' | 'stockAssist' | 'stockOverblade'>, PartCategory][] = [
  ['stockRatchet', 'ratchet'],
  ['stockBit', 'bit'],
  ['stockAssist', 'assist'],
  ['stockOverblade', 'overblade'],
]

const memberKey = (part: Part) => `${part.cat}-${part.id}`

/**
 * The box a blade came in, as you'd say it out loud: "UX-15", not the
 * "UX-15-01" variant inside it. A random booster sells three different blades
 * under one product code, so recording the variant would leave three
 * different answers to "where did my 3-60 come from" for the same purchase.
 */
function boxLabel(blade: Part): string {
  const fromProduct = blade.product?.trim().split(/\s+/)[0]
  if (fromProduct) return fromProduct
  // No product column on this row — fall back to the blade's own base code.
  return blade.id.match(/^([A-Za-z]+-\d+)/)?.[1] ?? blade.id
}

/**
 * A result only reachable through its `product` field (e.g. the over blade
 * that ships in a booster, matched by that booster's code) reads as an
 * equally-valid hit next to the booster's own blade unless it's labelled —
 * which is how "cx13" ends up adding the wrong single part instead of the
 * whole set. Reuses the same term/field normalisation matchScore() applies
 * internally, so the hint agrees with what actually matched.
 */
function shipsInHint(part: Part, query: string): string | undefined {
  if (!part.product) return undefined
  const terms = parseTerms(query)
  const ownFields = [part.id, part.nameEn, part.name].map((s) => searchKey(s ?? ''))
  if (terms.some((t) => ownFields.some((f) => f.includes(t)))) return undefined
  return terms.some((t) => searchKey(part.product ?? '').includes(t)) ? part.product : undefined
}

type Props = {
  parts: Part[]
  index: PartIndex
  /** How many of each catalogue part is already owned, keyed by collection.ts's entryKey. */
  ownedCounts: Map<string, number>
  onAdd: (inputs: NewPart[]) => void
  onClose: () => void
}

export default function CollectionAddSheet({ parts, index, ownedCounts, onAdd, onClose }: Props) {
  /** What you already have of a part — shown before you add more of it. */
  const haveCount = (part: Part) => ownedCounts.get(entryKey({ cat: part.cat, code: partCode(part.cat, part.id) })) ?? 0
  const [searchCat, setSearchCat] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Part | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  /** Set to a category to add a part the catalogue has never listed, under a name you type. */
  const [customCat, setCustomCat] = useState<PartCategory | null>(null)
  const [customName, setCustomName] = useState('')

  const [qty, setQty] = useState(1)
  const [from, setFrom] = useState('')
  const [unofficial, setUnofficial] = useState(false)
  const [notes, setNotes] = useState('')

  const results = useMemo(() => {
    if (!query.trim()) return []
    const inCategory = searchCat === 'all' ? parts : parts.filter((p) => p.cat === searchCat)
    return searchParts(inCategory, query).slice(0, 20)
  }, [parts, searchCat, query])

  /** Everything a booster ships with, resolved the same way PartSheet's "Comes with" does. Blade-only — a standalone part is just itself. */
  const packageMembers = useMemo(() => {
    if (!selected) return []
    if (selected.cat !== 'blade') return [selected]
    const stockParts = STOCK_SLOTS.map(([field, cat]) => {
      const code = selected[field]
      return code ? index.resolve(code, cat) : undefined
    }).filter((p): p is Part => Boolean(p))
    return [selected, ...stockParts]
  }, [selected, index])

  // Default to the whole package whenever a new blade is picked.
  useEffect(() => {
    setChecked(new Set(packageMembers.map(memberKey)))
  }, [packageMembers])

  // The box is the obvious answer to "which set did this come from", so fill
  // it in — still editable for a part bought loose.
  useEffect(() => {
    if (selected?.cat === 'blade') setFrom(boxLabel(selected))
  }, [selected])

  const toggleChecked = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }

  const shared = () => ({
    qty,
    from: from.trim() || undefined,
    unofficial,
    notes: notes.trim() || undefined,
  })

  const submitCatalogue = () => {
    const toAdd = packageMembers.filter((p) => checked.has(memberKey(p)))
    if (!toAdd.length) return
    onAdd(toAdd.map((p) => ({ cat: p.cat, code: partCode(p.cat, p.id), ...shared() })))
    onClose()
  }

  const submitCustom = () => {
    if (!customCat || !customName.trim()) return
    onAdd([{ cat: customCat, name: customName.trim(), ...shared() }])
    onClose()
  }

  const checkedCount = checked.size
  const picking = !selected && !customCat

  return (
    <Sheet label="Add to collection" onClose={onClose}>
      <h2 className="sheet-name sheet-name-lead">Add to collection</h2>

      {picking && (
        <>
          <div className="chip-row" role="tablist" aria-label="Category">
            {SEARCH_FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={searchCat === f}
                className={searchCat === f ? 'filter-chip active' : 'filter-chip'}
                onClick={() => setSearchCat(f)}
              >
                {CATEGORY_LABELS[f]}
              </button>
            ))}
          </div>

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

          {results.length > 0 && (
            <div className="collection-results">
              {results.map((part) => {
                const hint = shipsInHint(part, query)
                const have = haveCount(part)
                return (
                  <button key={memberKey(part)} className="collection-result" onClick={() => setSelected(part)}>
                    <PartImage src={part.img} alt={part.nameEn ?? part.name} size={36} />
                    <span className="part-body">
                      <span className="part-id">{part.id}</span>
                      <span className="part-name">{part.nameEn ?? part.name}</span>
                      {hint && <span className="part-alt">Ships in {hint}</span>}
                    </span>
                    {/* What you already have, before you add more of it. */}
                    {have > 0 && <span className="chip have-chip">have {have}</span>}
                    <span
                      className="part-tier"
                      style={{ color: TIER_COLORS[part.tier], borderColor: `${TIER_COLORS[part.tier]}55` }}
                    >
                      {tierLabel(part.tier)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* The catalogue can't list a 3D-printed mold or an unreleased
              prototype, so the way out is always on screen rather than behind
              its own mode — and it seeds the name from what was just typed. */}
          <div className="collection-custom-out">
            <p className="collection-empty-hint">
              {query.trim() && results.length === 0
                ? `Nothing in the catalogue matches “${query}”.`
                : 'Not in the catalogue — a 3D print, a prototype, something unlisted?'}
            </p>
            <div className="chip-row" role="group" aria-label="Add a custom part">
              {CATS.map((c) => (
                <button
                  key={c}
                  className="filter-chip"
                  onClick={() => {
                    setCustomCat(c)
                    setCustomName(query.trim())
                    setUnofficial(true)
                  }}
                >
                  + {CATEGORY_SINGULAR[c]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {selected && (
        <>
          {selected.cat === 'blade' ? (
            <>
              <p className="collection-empty-hint">
                This comes as a set — everything's checked; uncheck what you don't want.
              </p>
              <div className="collection-results">
                {packageMembers.map((part) => {
                  const key = memberKey(part)
                  const have = haveCount(part)
                  return (
                    <label key={key} className="collection-result collection-result-check">
                      <input type="checkbox" checked={checked.has(key)} onChange={() => toggleChecked(key)} />
                      <PartImage src={part.img} alt={part.nameEn ?? part.name} size={36} />
                      <span className="part-body">
                        <span className="part-id">{part.id}</span>
                        <span className="part-name">{part.nameEn ?? part.name}</span>
                      </span>
                      {have > 0 && <span className="chip have-chip">have {have}</span>}
                      <span
                        className="part-tier"
                        style={{ color: TIER_COLORS[part.tier], borderColor: `${TIER_COLORS[part.tier]}55` }}
                      >
                        {tierLabel(part.tier)}
                      </span>
                    </label>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="collection-selected">
              <PartImage src={selected.img} alt={selected.nameEn ?? selected.name} size={44} />
              <span className="part-body">
                <span className="part-id">{selected.id}</span>
                <span className="part-name">{selected.nameEn ?? selected.name}</span>
              </span>
            </div>
          )}

          <Details
            qty={qty}
            setQty={setQty}
            from={from}
            setFrom={setFrom}
            unofficial={unofficial}
            setUnofficial={setUnofficial}
            notes={notes}
            setNotes={setNotes}
          />

          <div className="collection-actions">
            <button className="collection-back" onClick={() => setSelected(null)}>
              ‹ Back
            </button>
            <button className="collection-submit" disabled={!checkedCount} onClick={submitCatalogue}>
              Add {checkedCount > 1 ? `${checkedCount} parts` : 'to collection'}
            </button>
          </div>
        </>
      )}

      {customCat && (
        <>
          <div className="collection-form">
            <div className="collection-field">
              <label htmlFor="collection-custom-name">Name</label>
              <input
                id="collection-custom-name"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={`e.g. 3D-printed ${CATEGORY_SINGULAR[customCat].toLowerCase()}`}
              />
            </div>

            <div className="chip-row" role="tablist" aria-label="Category">
              {CATS.map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={customCat === c}
                  className={customCat === c ? 'filter-chip active' : 'filter-chip'}
                  onClick={() => setCustomCat(c)}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <Details
            qty={qty}
            setQty={setQty}
            from={from}
            setFrom={setFrom}
            unofficial={unofficial}
            setUnofficial={setUnofficial}
            notes={notes}
            setNotes={setNotes}
          />

          <div className="collection-actions">
            <button className="collection-back" onClick={() => setCustomCat(null)}>
              ‹ Back
            </button>
            <button className="collection-submit" disabled={!customName.trim()} onClick={submitCustom}>
              Add to collection
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}

function Details({
  qty,
  setQty,
  from,
  setFrom,
  unofficial,
  setUnofficial,
  notes,
  setNotes,
}: {
  qty: number
  setQty: (n: number) => void
  from: string
  setFrom: (s: string) => void
  unofficial: boolean
  setUnofficial: (b: boolean) => void
  notes: string
  setNotes: (s: string) => void
}) {
  return (
    <div className="collection-form">
      <div className="collection-field">
        <label>How many</label>
        <span className="collection-stepper">
          <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity">
            −
          </button>
          <span>{qty}</span>
          <button type="button" onClick={() => setQty(qty + 1)} aria-label="Increase quantity">
            +
          </button>
        </span>
      </div>

      <div className="collection-field">
        <label htmlFor="collection-from">Came from (optional)</label>
        <input
          id="collection-from"
          type="text"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="e.g. CX-13, traded, bought loose"
        />
      </div>

      <label className="collection-check-line">
        <input type="checkbox" checked={unofficial} onChange={(e) => setUnofficial(e.target.checked)} />
        <span>Unofficial (3D-printed or third-party)</span>
      </label>

      <div className="collection-field">
        <label htmlFor="collection-notes">Notes (optional)</label>
        <textarea
          id="collection-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Condition, colour, anything worth remembering"
        />
      </div>
    </div>
  )
}
