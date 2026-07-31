import { TYPE_COLORS } from '../lib/tiers'
import type { PartNotes } from '../lib/types'

type Profile = NonNullable<PartNotes['profile']>

/** Burst resistance has no type chip to borrow a colour from. */
const BURST = '#8be8ff'

const BARS: [keyof Profile['stats'], string, string][] = [
  ['attack', 'Attack', TYPE_COLORS.attack],
  ['stamina', 'Stamina', TYPE_COLORS.stamina],
  ['defense', 'Defence', TYPE_COLORS.defense],
  ['burst', 'Burst res.', BURST],
]

/**
 * A bit's measured behaviour.
 *
 * A grade says a bit is good; these four numbers say what it is *for* — why
 * Flat and Ball sit at opposite ends of the same list rather than simply one
 * above the other.
 */
export default function BitProfile({ profile }: { profile: Profile }) {
  return (
    <div className="bit-profile">
      <div className="bit-profile-meta">
        <span className="chip">{profile.label}</span>
        {profile.labelZh && <span className="chip chip-dim">{profile.labelZh}</span>}
        {profile.line && <span className="chip chip-dim">{profile.line} line</span>}
        {profile.weightG !== undefined && (
          <span className="chip chip-dim">≈{profile.weightG}g</span>
        )}
        {profile.debut && <span className="chip chip-dim">{profile.debut}</span>}
      </div>

      <div className="bit-stats">
        {/* A few cards never rated defence — omit the bar rather than draw a
            zero, which would read as "no defence at all". */}
        {BARS.filter(([key]) => profile.stats[key] !== undefined).map(([key, label, color]) => (
          <div className="bit-stat-row" key={key}>
            <span className="bit-stat-label">{label}</span>
            <span className="bit-stat-track">
              <span
                className="bit-stat-fill"
                style={{ width: `${profile.stats[key]}%`, background: color }}
              />
            </span>
            <span className="bit-stat-value">{profile.stats[key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
