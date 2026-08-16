import Modal from './Modal'
import { clearArrival, useArrival } from '../lib/userSync'
import { totalQty } from '../lib/collection'
import { CATEGORY_SINGULAR } from '../lib/tiers'

/** At most this many names per section — the point is recognition, not an inventory. */
const SHOWN = 8

/**
 * What signing in just pulled down from the account. Shown once, only when
 * something actually arrived: on a device that was already up to date, or a
 * first-ever sign-in with an empty account, there is nothing to report and
 * this never appears.
 */
export default function SyncArrivalDialog() {
  const arrival = useArrival()
  if (!arrival) return null

  const { entries, builds, decks } = arrival
  const parts = entries.reduce((n, e) => n + totalQty(e), 0)

  const section = (title: string, names: string[]) => {
    if (!names.length) return null
    const shown = names.slice(0, SHOWN)
    const rest = names.length - shown.length
    return (
      <div className="arrival-section">
        <h4>{title}</h4>
        <p className="arrival-names">
          {shown.join(', ')}
          {rest > 0 && ` and ${rest} more`}
        </p>
      </div>
    )
  }

  return (
    <Modal label="Restored from your account" onClose={clearArrival}>
      <h3 className="modal-title">Welcome back</h3>
      <p className="modal-body">
        Your account had things this device didn't. They've been added to what was already here — nothing was
        replaced.
      </p>

      {section(
        entries.length === 1 ? '1 part' : `${entries.length} parts${parts > entries.length ? ` (${parts} total)` : ''}`,
        entries.map((e) => `${e.code ?? e.name ?? '—'} (${CATEGORY_SINGULAR[e.cat]})`),
      )}
      {section(builds.length === 1 ? '1 build' : `${builds.length} builds`, builds.map((b) => b.name || 'Unnamed build'))}
      {section(decks.length === 1 ? '1 deck' : `${decks.length} decks`, decks.map((d) => d.name))}

      <div className="modal-actions">
        <button className="modal-btn primary" onClick={clearArrival}>
          Got it
        </button>
      </div>
    </Modal>
  )
}
