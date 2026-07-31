import { cappedCeiling, ratingTerms } from '../lib/rating'
import { SOURCES } from '../lib/sources'
import { TIER_COLORS, tierLabel } from '../lib/tiers'
import type { Credit, Rating, SourceKey } from '../lib/types'

type Props = { rating: Rating; credit?: Credit }

/** What each source said, in its own units. The score comes from `ratingTerms`. */
function said(rating: Rating, key: SourceKey): string {
  if (key === 'tournament') {
    const t = rating.tournament!
    const firsts = t.firsts ? ` · ${t.firsts.toLocaleString()} firsts` : ''
    return `${t.allTime.toLocaleString()} placements${firsts} · ${t.recent90.toLocaleString()} in 3 months`
  }
  return `Graded ${key === 'community' ? rating.community : rating.japan}`
}

function link(key: SourceKey, credit?: Credit): { label: string; url: string } | undefined {
  if (key === 'japan' && credit) {
    return { label: `${credit.author} — ${credit.sourceName}`, url: credit.sourceUrl }
  }
  const first = SOURCES[key].credits.find((c) => c.url)
  return first?.url ? { label: first.label, url: first.url } : undefined
}

/**
 * The arithmetic behind a grade, with every line traceable to its origin.
 *
 * A blended number is only trustworthy if you can take it apart, so the rows
 * come from the same `ratingTerms` the blend itself consumed — the panel cannot
 * drift from the calculation it is describing.
 */
export default function RatingBreakdown({ rating, credit }: Props) {
  const terms = ratingTerms(rating)
  const tierColor = TIER_COLORS[rating.tier] ?? '#6b7480'

  return (
    <section className="sheet-block">
      <h3>How this tier was calculated</h3>

      {terms.length === 0 ? (
        <p className="calc-note">
          Nothing rates this part yet — not the Taiwan list, not the Japanese one, and it has never
          placed at a tracked tournament. It is left unrated rather than ranked last, because no
          evidence is not the same as bad evidence.
        </p>
      ) : (
        <>
          <div className="calc">
            {terms.map((term) => {
              const to = link(term.key, credit)
              return (
                <div className="calc-row" key={term.key}>
                  <div className="calc-head">
                    <span className="calc-source">{SOURCES[term.key].label}</span>
                    <span className="calc-weight">×{Math.round(term.weight * 100)}%</span>
                  </div>
                  <p className="calc-said">{said(rating, term.key)}</p>
                  <div className="calc-foot">
                    <span className="calc-score">scores {Math.round(term.score)}</span>
                    {to && (
                      <a href={to.url} target="_blank" rel="noopener noreferrer">
                        {to.label} ↗
                      </a>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="calc-total">
              <span>Blended {Math.round(rating.score)}</span>
              <span className="calc-arrow" aria-hidden="true">
                →
              </span>
              <strong style={{ color: tierColor }}>Tier {tierLabel(rating.tier)}</strong>
            </div>
          </div>

          {rating.capped && (
            <p className="calc-note">
              No tournament record yet, so this grade rests on opinion alone and is held at{' '}
              {cappedCeiling()} — the top tiers are reserved for parts with results behind them. It
              may well be stronger than this; nobody has shown it winning yet.
            </p>
          )}

          {terms.length === 1 && !rating.capped && (
            <p className="calc-note">
              Only one source rates this part, so its grade is that source's alone.
            </p>
          )}
        </>
      )}
    </section>
  )
}
