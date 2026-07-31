import PartImage from './PartImage'
import { TIER_COLORS, tierLabel } from '../lib/tiers'
import type { Part } from '../lib/types'

type Props = {
  code: string
  part?: Part
  /**
   * Overrides the chip's caption. Build rows want the bare code they were
   * written with; a list of blades wants the English name a reader recognises.
   */
  label?: string
  onOpen: (part: Part) => void
}

/**
 * A part referenced inside a build. Resolves to a tappable chip with its tier
 * grade when we know the part, and stays plain text when we don't — a dead
 * button is worse than an honest label.
 */
export default function PartChip({ code, part, label, onOpen }: Props) {
  if (!part) {
    return <span className="part-chip part-chip-plain">{code}</span>
  }

  const color = TIER_COLORS[part.tier] ?? '#6b7480'

  return (
    <button className="part-chip" onClick={() => onOpen(part)}>
      <PartImage src={part.img} alt={part.name} size={26} />
      <span className="chip-code">{label ?? part.name}</span>
      <span className="chip-tier" style={{ color, borderColor: `${color}55` }}>
        {tierLabel(part.tier)}
      </span>
    </button>
  )
}
