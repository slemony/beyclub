import type { SourceMeta } from '../lib/types'

type Props = {
  meta: SourceMeta
  fetchedAt?: string
  stale?: boolean
}

/**
 * Always-visible provenance. A reader should never see a ranking without being
 * able to tell whose judgement it is and whether it came from results or opinion.
 */
export default function Attribution({ meta, fetchedAt, stale }: Props) {
  const when = fetchedAt
    ? new Date(fetchedAt).toLocaleString('en-MY', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="glass attribution">
      <p className="attr-blurb">{meta.blurb}</p>

      <div className="attr-credits">
        <span className={`attr-basis ${meta.basis}`}>
          {meta.basis === 'results' ? 'Based on match results' : 'Subjective ratings'}
        </span>
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

      {when && (
        <p className="attr-time">
          {stale ? `Showing saved copy from ${when} — couldn't reach the source` : `Updated ${when}`}
        </p>
      )}
    </div>
  )
}
