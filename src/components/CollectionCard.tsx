import PartImage from './PartImage'
import { totalQty, unofficialQty } from '../lib/collection'
import { isUnrated, TIER_COLORS, tierLabel } from '../lib/tiers'
import type { CollectionEntry, Part } from '../lib/types'

type Props = {
  entry: CollectionEntry
  /** The live catalogue part this entry references — absent for a custom part,
   * or when a code no longer resolves (renamed/removed upstream since it was added). */
  part?: Part
  onOpenDetails: (entry: CollectionEntry) => void
}

export default function CollectionCard({ entry, part, onOpenDetails }: Props) {
  const title = part?.nameEn ?? part?.name ?? entry.name ?? entry.code ?? '—'
  const missing = Boolean(entry.code) && !part
  const total = totalQty(entry)
  const unofficial = unofficialQty(entry)
  const tierColor = part ? (TIER_COLORS[part.tier] ?? '#6b7480') : undefined

  return (
    <button className="glass glass-lit collection-tile" onClick={() => onOpenDetails(entry)}>
      <span className="collection-tile-top">
        <PartImage src={part?.img} alt={title} size={44} />
        {total > 1 && <span className="collection-count">×{total}</span>}
        {/* Only a real grade gets a badge — "Unrated" is seven characters and
            would lie across the thumbnail it sits on. The detail sheet says so
            in words, where there's room. */}
        {part && !isUnrated(part.tier) && (
          <span className="part-tier collection-tile-tier" style={{ color: tierColor, borderColor: `${tierColor}55` }}>
            {tierLabel(part.tier)}
          </span>
        )}
      </span>

      <span className="collection-tile-name">{title}</span>
      {entry.code && <span className="collection-tile-code">{entry.code}</span>}
      {missing && <span className="collection-tile-code">not in the catalogue</span>}
      {unofficial > 0 && (
        <span className="collection-tile-flag">{unofficial === total ? 'unofficial' : `${unofficial} unofficial`}</span>
      )}
    </button>
  )
}
