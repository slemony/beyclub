import { cappedCeiling } from '../lib/rating'
import { SOURCES, SOURCE_ORDER } from '../lib/sources'
import type { TournamentSource } from '../lib/types'

type ToggleProps = { open: boolean; onToggle: () => void }

/** Sits on the page title's line — see PageHeader. */
export function RankingToggle({ open, onToggle }: ToggleProps) {
  return (
    <button
      className={open ? 'info-toggle open' : 'info-toggle'}
      onClick={onToggle}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <span aria-hidden="true">ⓘ</span> How this is ranked
    </button>
  )
}

type Props = {
  tournament?: TournamentSource
  fetchedAt?: string
  stale?: boolean
}

const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-MY', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

/** A stale copy is an error state, not provenance — it is never behind a click. */
export function StaleNotice({ fetchedAt }: { fetchedAt?: string }) {
  const at = when(fetchedAt)
  if (!at) return null
  return <p className="notice notice-stale">Showing a saved copy from {at} — couldn't reach the sources.</p>
}

/**
 * Provenance on demand — the contents of the "How this is ranked" sheet.
 *
 * It used to sit open above every visit, which meant the page led with
 * paperwork, and then inline behind a toggle, which shoved the ranking down the
 * page to read it. In a sheet the ranking stays put and every source
 * accountable for it is still one tap away.
 */
export default function Attribution({ tournament, fetchedAt, stale }: Props) {
  const at = when(fetchedAt)

  return (
    <div className="attribution">
      <h2 className="sheet-name">How this is ranked</h2>

      <p className="attr-blurb">
        One grade per part, blended from three sources. Weights shift to whichever sources rate a
        given part, and nothing reaches the top tiers without a tournament record — an unproven part
        is capped at {cappedCeiling()} rather than scored as though it had lost. A part no source has
        rated at all is left unrated, not ranked last.
      </p>

      {SOURCE_ORDER.map((id) => {
        const meta = SOURCES[id]
        return (
          <section className="attr-source" key={id}>
            <h4>
              <span aria-hidden="true">{meta.flag}</span> {meta.label}
              <span className={`attr-basis ${meta.basis}`}>
                {meta.basis === 'results' ? 'Match results' : 'Opinion'}
              </span>
            </h4>
            <p className="attr-blurb">{meta.blurb}</p>
            <div className="attr-credits">
              {meta.credits.map((c) =>
                c.url ? (
                  <a key={c.label} href={c.url} target="_blank" rel="noopener noreferrer">
                    {c.label} ↗
                  </a>
                ) : (
                  <span key={c.label}>{c.label}</span>
                ),
              )}
            </div>
          </section>
        )
      })}

      {tournament && (
        <p className="attr-time">
          {tournament.coverage.events.toLocaleString()} events ·{' '}
          {tournament.coverage.combos.toLocaleString()} winning combos
          {tournament.windows.recent90?.from &&
            ` · recent window ${tournament.windows.recent90.from} to ${tournament.windows.recent90.to}`}
        </p>
      )}
      {at && <p className="attr-time">{stale ? `Saved copy from ${at}` : `Updated ${at}`}</p>}
    </div>
  )
}
