import PartImage from './PartImage'
import { buildParts, buildTitle } from '../lib/builds'
import type { PartIndex } from '../lib/partIndex'
import { isUnrated, TIER_COLORS, tierLabel } from '../lib/tiers'
import type { Part, SavedBuild } from '../lib/types'

/** The row of part thumbnails a build is recognised by. */
export function PartStrip({ parts, size = 30 }: { parts: Part[]; size?: number }) {
  if (!parts.length) return <span className="collection-empty-hint">Nothing chosen yet</span>
  return (
    <span className="build-row-parts">
      {parts.map((p) => (
        <span key={`${p.cat}-${p.id}`} className="build-row-part">
          <PartImage src={p.img} alt={p.nameEn ?? p.name} size={size} />
          {/* An ungraded part gets no badge — see CollectionCard. */}
          {!isUnrated(p.tier) && (
            <span
              className="part-tier build-row-tier"
              style={{ color: TIER_COLORS[p.tier], borderColor: `${TIER_COLORS[p.tier]}55` }}
            >
              {tierLabel(p.tier)}
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

type Props = {
  build: SavedBuild
  index: PartIndex
  onClick: () => void
  /** Set only when the card is a choice — drives the tick and selected styling. */
  selected?: boolean
  disabled?: boolean
}

/**
 * One build as a card. Shared by the Builds grid and the deck's bey picker so
 * a bey looks the same wherever you're choosing it.
 */
export default function BuildCard({ build, index, onClick, selected, disabled }: Props) {
  const parts = buildParts(build, index)
  const record = build.record
  const selectable = selected !== undefined

  const classes = ['glass', 'glass-lit', 'build-card']
  if (selected) classes.push('selected')
  if (disabled) classes.push('dim')

  return (
    <button className={classes.join(' ')} onClick={onClick} disabled={disabled} aria-pressed={selected}>
      <span className="build-card-title">
        {selectable && <span className={selected ? 'build-tick on' : 'build-tick'}>{selected ? '✓' : ''}</span>}
        {buildTitle(build, index)}
      </span>
      <PartStrip parts={parts} />
      {record && record.events > 0 && (
        <span className="build-card-record">
          {record.events} events · {record.placements} top 4 · {record.firsts} firsts
        </span>
      )}
    </button>
  )
}
