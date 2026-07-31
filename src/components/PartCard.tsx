import PartImage from './PartImage'
import { UNRATED } from '../lib/rating'
import { BUY_LABELS, TIER_COLORS, TYPE_COLORS, TYPE_LABELS, tierLabel } from '../lib/tiers'
import type { Part } from '../lib/types'

type Props = { part: Part; onOpen: (part: Part) => void }

export default function PartCard({ part, onOpen }: Props) {
  const tierColor = TIER_COLORS[part.tier] ?? '#6b7480'
  const primary = part.nameEn ?? part.name
  // The alt line keeps a blade's original Chinese name in view next to its
  // translation. A ratchet, bit or assist has no such pair — its "name" is
  // just its id spelled out (輔助H / Heavy), so showing it here would repeat
  // the id line as a third variant.
  const secondary = part.cat === 'blade' && part.nameEn ? part.name : undefined

  return (
    <button className="glass glass-lit part-card" onClick={() => onOpen(part)}>
      <span className="part-tier" style={{ color: tierColor, borderColor: `${tierColor}55` }}>
        {tierLabel(part.tier)}
      </span>

      <PartImage src={part.img} alt={primary} />

      <span className="part-body">
        <span className="part-id">{part.id}</span>
        <span className="part-name">{primary}</span>
        {secondary && <span className="part-alt">{secondary}</span>}

        <span className="part-meta">
          {part.type && TYPE_LABELS[part.type] && (
            <span className="chip" style={{ color: TYPE_COLORS[part.type] }}>
              {TYPE_LABELS[part.type]}
            </span>
          )}
          {part.buy && <span className="chip chip-dim">{BUY_LABELS[part.buy]}</span>}
          {part.rating?.tournament && (
            <span className="chip chip-dim">
              {part.rating.tournament.allTime.toLocaleString()} placements
            </span>
          )}
          {part.rating?.capped &&
            (part.tier === UNRATED ? (
              <span className="chip chip-unproven">Nobody has rated this</span>
            ) : (
              <span className="chip chip-unproven">No tournament record</span>
            ))}
        </span>
      </span>
    </button>
  )
}
