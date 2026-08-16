import { useState } from 'react'
import PartImage from './PartImage'
import Sheet from './Sheet'
import { totalQty, unofficialQty } from '../lib/collection'
import { CATEGORY_SINGULAR, TIER_COLORS, tierLabel } from '../lib/tiers'
import type { CollectionEntry, Part } from '../lib/types'

type Props = {
  entry: CollectionEntry
  part?: Part
  onOpenPart: (part: Part) => void
  onChangeSourceQty: (entryId: string, sourceId: string, qty: number) => void
  onRemoveSource: (entryId: string, sourceId: string) => void
  onRemoveEntry: (entryId: string) => void
  onClose: () => void
}

/**
 * Where a part came from, and how many of each. Slides up as its own sheet
 * rather than expanding the tile in place: the sources need the full width,
 * and a sheet closes the way every other one in the app does.
 */
export default function CollectionDetailSheet({
  entry,
  part,
  onOpenPart,
  onChangeSourceQty,
  onRemoveSource,
  onRemoveEntry,
  onClose,
}: Props) {
  const [confirmAll, setConfirmAll] = useState(false)
  const title = part?.nameEn ?? part?.name ?? entry.name ?? entry.code ?? '—'
  const total = totalQty(entry)
  const unofficial = unofficialQty(entry)
  const multi = entry.sources.length > 1
  const tierColor = part ? (TIER_COLORS[part.tier] ?? '#6b7480') : undefined

  return (
    <Sheet label={title} onClose={onClose}>
      <div className="sheet-head">
        <PartImage src={part?.img} alt={title} size={56} />
        <div>
          {entry.code && <p className="sheet-id">{entry.code}</p>}
          <h2 className="sheet-name">{title}</h2>
          <p className="sheet-alt">
            {CATEGORY_SINGULAR[entry.cat]} · {total} owned
            {unofficial > 0 && `, ${unofficial} unofficial`}
          </p>
        </div>
        {part && (
          <span className="part-tier sheet-tier" style={{ color: tierColor, borderColor: `${tierColor}55` }}>
            {tierLabel(part.tier)}
          </span>
        )}
      </div>

      {part && (
        <button className="collection-back detail-open-part" onClick={() => onOpenPart(part)}>
          View part details ›
        </button>
      )}

      {entry.code && !part && (
        <p className="collection-empty-hint">This code is no longer in the catalogue.</p>
      )}

      <section className="sheet-block">
        <h3>Where these came from</h3>
        <div className="collection-sources">
          {entry.sources.map((source) => (
            <div key={source.id} className="collection-source">
              <span className="collection-source-head">
                <span className="collection-source-from">{source.from || 'Loose / unknown'}</span>
                {source.unofficial && <span className="chip chip-unproven">unofficial</span>}
              </span>
              {source.notes && <span className="collection-notes">{source.notes}</span>}
              <span className="collection-controls">
                <span className="collection-stepper">
                  <button
                    type="button"
                    onClick={() => onChangeSourceQty(entry.id, source.id, Math.max(1, source.qty - 1))}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span>{source.qty}</span>
                  <button
                    type="button"
                    onClick={() => onChangeSourceQty(entry.id, source.id, source.qty + 1)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </span>
                <button type="button" className="collection-remove" onClick={() => onRemoveSource(entry.id, source.id)}>
                  Remove {multi ? 'these' : ''}
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* With one source there is nothing to choose between, so the row's
            own Remove is the whole story. With several, removing the part
            means naming which box's copies go — hence the confirm. */}
        {multi &&
          (confirmAll ? (
            <div className="remove-all-confirm">
              <span>Remove all {total} — every source above?</span>
              <span className="remove-all-actions">
                <button type="button" className="collection-remove" onClick={() => onRemoveEntry(entry.id)}>
                  Yes, remove all
                </button>
                <button type="button" className="collection-back" onClick={() => setConfirmAll(false)}>
                  Keep
                </button>
              </span>
            </div>
          ) : (
            <button type="button" className="collection-back remove-all" onClick={() => setConfirmAll(true)}>
              Remove all {total}
            </button>
          ))}
      </section>
    </Sheet>
  )
}
