import PartTile from './PartTile'
import { TIER_COLORS, tierLabel } from '../lib/tiers'
import type { Part } from '../lib/types'

type Props = {
  groups: [string, Part[]][]
  onOpen: (part: Part) => void
}

/** Classic tier-list table: the tier on the left, everything in it on the right. */
export default function TierTable({ groups, onOpen }: Props) {
  return (
    <div className="tier-table">
      {groups.map(([tier, parts]) => {
        const color = TIER_COLORS[tier] ?? '#6b7480'
        const label = tierLabel(tier)
        return (
          <div className="tier-row" key={tier}>
            <div
              className="tier-cell"
              style={{ background: `${color}22`, borderColor: `${color}66`, color }}
            >
              <span className={label.length > 2 ? 'tier-cell-label long' : 'tier-cell-label'}>
                {label}
              </span>
              <span className="tier-cell-count">{parts.length}</span>
            </div>
            <div className="tier-items">
              {parts.map((part) => (
                <PartTile key={`${part.cat}-${part.id}`} part={part} onOpen={onOpen} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
