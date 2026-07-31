import { SOURCES, SOURCE_ORDER } from '../lib/sources'
import type { SourceId } from '../lib/types'

type Props = {
  active: SourceId
  onChange: (id: SourceId) => void
}

export default function SourceBar({ active, onChange }: Props) {
  return (
    <div className="segmented glass" role="tablist" aria-label="Data source">
      {SOURCE_ORDER.map((id) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          className={active === id ? 'segment active' : 'segment'}
          onClick={() => onChange(id)}
        >
          <span aria-hidden="true">{SOURCES[id].flag}</span> {SOURCES[id].label}
        </button>
      ))}
    </div>
  )
}
