import { useEffect } from 'react'
import PartChip from './PartChip'
import PartImage from './PartImage'
import sourceNotes from '../data/sourceNotes.json'
import { BUY_VERDICTS, explainVerdict } from '../lib/buyRec'
import { parseCombo, type Build } from '../lib/combo'
import { deriveInsights } from '../lib/insights'
import { TIER_COLORS, TYPE_COLORS, TYPE_LABELS, tierLabel } from '../lib/tiers'
import type { PartIndex } from '../lib/partIndex'
import type { ComboStat, Part, PartNotes } from '../lib/types'

const NOTE_TRANSLATIONS = sourceNotes as Record<string, string>

type Props = {
  stack: Part[]
  combos: ComboStat[]
  index: PartIndex | null
  notes: Record<string, PartNotes>
  onOpen: (part: Part) => void
  onBack: () => void
  onClose: () => void
}

function BuildRow({
  build,
  index,
  onOpen,
}: {
  build: Build
  index: PartIndex | null
  onOpen: (part: Part) => void
}) {
  const groups: [string, string[], 'ratchet' | 'bit' | 'assist'][] = [
    ['Ratchet', build.ratchets, 'ratchet'],
    ['Bit', build.bits, 'bit'],
    ['Assist', build.assists, 'assist'],
  ]

  return (
    <div className="build">
      {build.championship && <span className="build-flag">Championship build</span>}
      {groups.map(([label, codes, cat]) =>
        codes.length ? (
          <div className="build-line" key={label}>
            <span className="build-label">{label}</span>
            <div className="build-chips">
              {codes.map((code) => (
                <PartChip
                  key={code}
                  code={code}
                  part={index?.resolve(code, cat)}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  )
}

/** iOS-style detail sheet with a navigation stack between related parts. */
export default function PartSheet({
  stack,
  combos,
  index,
  notes,
  onOpen,
  onBack,
  onClose,
}: Props) {
  const part = stack[stack.length - 1] ?? null

  useEffect(() => {
    if (!part) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [part, onClose])

  if (!part) return null

  const tierColor = TIER_COLORS[part.tier] ?? '#6b7480'
  const verdict = part.buy ? BUY_VERDICTS[part.buy] : undefined
  const recommended = parseCombo(part.combo)
  const community = parseCombo(part.communityCombo)
  const relatedCombos = index ? index.combosUsing(part).slice(0, 6) : []
  const usedBy = index ? index.bladesUsing(part).slice(0, 12) : []
  const insights = index ? deriveInsights(part, index, combos) : []
  const editorial = notes[`${part.cat}:${part.id}`] ?? notes[`${part.cat}:${part.id.split('-').slice(0, 2).join('-')}`]
  const sourceComments = [...recommended.notes, ...community.notes]
  const previous = stack.length > 1 ? stack[stack.length - 2] : null

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="glass sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={part.nameEn ?? part.name}
      >
        <div className="sheet-grip" />

        {previous && (
          <button className="sheet-back" onClick={onBack}>
            ‹ {previous.nameEn ?? previous.name}
          </button>
        )}

        <div className="sheet-head">
          <PartImage src={part.img} alt={part.nameEn ?? part.name} size={72} />
          <div>
            <p className="sheet-id">{part.id}</p>
            <h2 className="sheet-name">{part.nameEn ?? part.name}</h2>
            {part.nameEn && part.nameEn !== part.name && <p className="sheet-alt">{part.name}</p>}
          </div>
        </div>

        {verdict && (
          <div className={`verdict verdict-${verdict.tone}`}>
            <strong>{verdict.label}</strong>
            <span>{explainVerdict(part)}</span>
          </div>
        )}

        <div className="sheet-chips">
          {/* Tier lives here rather than as a corner badge — up in the header it
              read as a close button. */}
          <span className="chip" style={{ color: tierColor, borderColor: `${tierColor}55` }}>
            Tier {tierLabel(part.tier)}
          </span>
          {part.type && TYPE_LABELS[part.type] && (
            <span className="chip" style={{ color: TYPE_COLORS[part.type] }}>
              {TYPE_LABELS[part.type]}
            </span>
          )}
          {part.product && <span className="chip chip-dim">{part.product}</span>}
        </div>

        {(part.stockRatchet || part.stockBit) && (
          <section className="sheet-block">
            <h3>Comes with</h3>
            <div className="build-chips">
              {part.stockRatchet && (
                <PartChip
                  code={part.stockRatchet}
                  part={index?.resolve(part.stockRatchet, 'ratchet')}
                  onOpen={onOpen}
                />
              )}
              {part.stockBit && (
                <PartChip
                  code={part.stockBit}
                  part={index?.resolve(part.stockBit, 'bit')}
                  onOpen={onOpen}
                />
              )}
            </div>
          </section>
        )}

        {recommended.builds.length > 0 && (
          <section className="sheet-block">
            <h3>Recommended build</h3>
            {recommended.builds.map((build, i) => (
              <BuildRow key={i} build={build} index={index} onOpen={onOpen} />
            ))}
          </section>
        )}

        {community.builds.length > 0 && (
          <section className="sheet-block">
            <h3>Community build</h3>
            {community.builds.map((build, i) => (
              <BuildRow key={i} build={build} index={index} onOpen={onOpen} />
            ))}
          </section>
        )}

        {usedBy.length > 0 && (
          <section className="sheet-block">
            <h3>Blades that run this part</h3>
            <div className="build-chips">
              {usedBy.map((blade) => (
                <button key={blade.id} className="part-chip" onClick={() => onOpen(blade)}>
                  <PartImage src={blade.img} alt={blade.name} size={26} />
                  <span className="chip-code">{blade.nameEn ?? blade.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {part.stats && (
          <section className="sheet-block">
            <h3>Tournament record</h3>
            <div className="stat-row">
              <div>
                <strong>{part.stats.wins.toLocaleString()}</strong>
                <span>top-3 finishes</span>
              </div>
              <div>
                <strong>{part.stats.firsts.toLocaleString()}</strong>
                <span>wins</span>
              </div>
              {/* The source's date column mixes day/month orders, so some rows
                  parse into the future. Showing a wrong date is worse than
                  showing none — only render dates that are actually in the past. */}
              {part.stats.lastSeen && Date.parse(part.stats.lastSeen) <= Date.now() && (
                <div>
                  <strong>{part.stats.lastSeen}</strong>
                  <span>last placed</span>
                </div>
              )}
            </div>
          </section>
        )}

        {relatedCombos.length > 0 && (
          <section className="sheet-block">
            <h3>Combos that placed</h3>
            <ul className="combo-list">
              {relatedCombos.map((c) => (
                <li key={c.key}>
                  <span className="combo-name">
                    {part.cat === 'blade' ? `${c.ratchet}${c.bit}` : c.bladeName}
                  </span>
                  <span className="combo-stat">
                    {c.wins} finishes
                    {c.championRate !== null && ` · ${(c.championRate * 100).toFixed(0)}% champ`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sourceComments.length > 0 && (
          <section className="sheet-block">
            <h3>Notes from the source</h3>
            {sourceComments.map((note) => (
              <p className="sheet-text" key={note}>
                {NOTE_TRANSLATIONS[note] ?? note}
              </p>
            ))}
          </section>
        )}

        {insights.length > 0 && (
          <section className="sheet-block">
            <h3>What the data says</h3>
            <ul className="fact-list">
              {insights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        )}

        {editorial && (
          <section className="sheet-block">
            <h3>
              BeyClub notes <span className="editorial-badge">our own view</span>
            </h3>
            {editorial.pros?.length > 0 && (
              <ul className="pro-list">
                {editorial.pros.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {editorial.cons?.length > 0 && (
              <ul className="con-list">
                {editorial.cons.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            {editorial.technique && (
              <>
                <h4 className="sub-head">How to play it</h4>
                <p className="sheet-text">{editorial.technique}</p>
              </>
            )}
          </section>
        )}

        {part.credit && (
          <section className="sheet-block">
            <h3>Where this rating comes from</h3>
            <p className="sheet-text">
              Ranked <strong>{tierLabel(part.tier)}</strong> by {part.credit.author}.
            </p>
            <a
              className="sheet-link"
              href={part.credit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the original article ↗
            </a>
          </section>
        )}

        <button className="sheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
