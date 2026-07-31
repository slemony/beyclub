import PartImage from './PartImage'
import { UNRATED } from '../lib/rating'
import type { Part } from '../lib/types'

type Props = { part: Part; onOpen: (part: Part) => void }

/** Buy verdict reads as a plain colour dot — a glyph at this size is noise. */
const BUY_DOT: Record<string, { className: string; label: string }> = {
  yes: { className: 'buy-dot good', label: 'Worth buying' },
  maybe: { className: 'buy-dot warn', label: 'Situational' },
  no: { className: 'buy-dot bad', label: 'Skip for competitive' },
}

export default function PartTile({ part, onOpen }: Props) {
  const label = part.nameEn ?? part.name
  const buy = BUY_DOT[part.buy]

  const unrated = part.tier === UNRATED
  const unproven = part.rating?.capped
  const title = unrated
    ? `${label} — nobody has rated this`
    : unproven
      ? `${label} — no tournament record yet`
      : label

  return (
    <button className="part-tile" onClick={() => onOpen(part)} title={title}>
      <span className="tile-img-wrap">
        <PartImage src={part.img} alt={label} size={54} />
        {buy && <span className={buy.className} role="img" aria-label={buy.label} />}
      </span>
      <span className="tile-label">{part.cat === 'blade' ? part.id : part.name}</span>
    </button>
  )
}
