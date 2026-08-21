import PartImage from './PartImage'
import { UNRATED } from '../lib/rating'
import type { Part } from '../lib/types'

type Props = {
  part: Part
  onOpen: (part: Part) => void
  /**
   * How many catalogue rows this tile stands for while variants are folded.
   * Its presence is what says the list is folded at all — absent, the tile is
   * one box and labels itself with that box's code.
   */
  variants?: number
}

/** Buy verdict reads as a plain colour dot — a glyph at this size is noise. */
const BUY_DOT: Record<string, { className: string; label: string }> = {
  yes: { className: 'buy-dot good', label: 'Worth buying' },
  maybe: { className: 'buy-dot warn', label: 'Situational' },
  no: { className: 'buy-dot bad', label: 'Skip for competitive' },
}

export default function PartTile({ part, onOpen, variants }: Props) {
  const label = part.nameEn ?? part.name
  const buy = BUY_DOT[part.buy]

  const tileLabel =
    part.cat !== 'blade' ? part.name : variants !== undefined ? label : part.id

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
        {variants !== undefined && variants > 1 && (
          <span className="tile-count" aria-label={`${variants} releases`}>
            ×{variants}
          </span>
        )}
      </span>
      {/* Only blades change what they say when folded: a folded tile stands for
          every box the mould was sold in, so one box's code would be picking
          arbitrarily. Everything else is one part with one code either way. */}
      <span className="tile-label">{tileLabel}</span>
    </button>
  )
}
