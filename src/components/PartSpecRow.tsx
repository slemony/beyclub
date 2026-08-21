import partSpecs from '../data/partSpecs.json'
import { formatHeight } from '../lib/tiers'
import type { Credit, PartSpec } from '../lib/types'

/** One source measured every part here, so the credit is the file's, not the row's. */
const SOURCE = partSpecs.credit as Credit

/**
 * What a part measures, in one line.
 *
 * The sheet already runs long, so this is a chip row rather than a block: the
 * numbers are here to be glanced at and compared against another part, not
 * read. Gear teeth and ring blades share a slot because they are the same
 * measurement of two different things — how much of the part touches, and how
 * often.
 */
export default function PartSpecRow({ spec, cat }: { spec: PartSpec; cat: 'bit' | 'ratchet' }) {
  const span = formatHeight(spec)

  return (
    <div className="spec-row">
      <div className="sheet-chips">
        <span className="chip">{spec.weightG.toFixed(1)} g</span>
        {spec.teeth !== undefined && (
          <span className="chip chip-dim">
            {spec.teeth} {cat === 'ratchet' ? 'protrusions' : 'gears'}
          </span>
        )}
        {spec.burst !== undefined && <span className="chip chip-dim">Burst {spec.burst}</span>}
        {span && <span className="chip chip-dim">{span}</span>}
        {spec.simple && <span className="chip chip-dim">simple type</span>}
      </div>
      <a
        className="custom-build-credit"
        href={SOURCE.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Measurements by {SOURCE.author} — {SOURCE.sourceName} ↗
      </a>
    </div>
  )
}
