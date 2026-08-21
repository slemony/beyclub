import partSpecs from '../data/partSpecs.json'
import { formatHeight, mm } from '../lib/tiers'
import type { Credit, PartCategory, PartSpec } from '../lib/types'

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
export default function PartSpecRow({ spec, cat }: { spec: PartSpec; cat: PartCategory }) {
  const span = formatHeight(spec)
  const g = (n: number) => `${n.toFixed(1)} g`

  return (
    <div className="spec-row">
      <div className="sheet-chips">
        {/* A CX bey comes apart into a chip and a blade, so it is weighed as
            two figures rather than one number that is neither. */}
        <span className="chip">
          {spec.cx ? `${spec.cx.kind === 'metal' ? 'Metal' : 'Main'} blade ` : ''}
          {g(spec.weightG)}
        </span>
        {spec.cx && <span className="chip chip-dim">Lock chip {g(spec.cx.chipG)}</span>}
        {spec.teeth !== undefined && (
          <span className="chip chip-dim">
            {spec.teeth} {cat === 'ratchet' ? 'protrusions' : 'gears'}
          </span>
        )}
        {spec.burst !== undefined && <span className="chip chip-dim">Burst {spec.burst}</span>}
        {span && <span className="chip chip-dim">{span}</span>}
        {spec.thicknessDmm !== undefined && (
          <span className="chip chip-dim">{mm(spec.thicknessDmm)} mm thick</span>
        )}
        {spec.simple && <span className="chip chip-dim">simple type</span>}
      </div>
      {/* Said plainly, because a reader comparing two beys on weight would
          otherwise have no way to know what the number leaves out. */}
      {spec.cx && <p className="spec-caveat">Over blade and assist not included.</p>}
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
