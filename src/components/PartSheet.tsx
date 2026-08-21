import BitProfile from './BitProfile'
import PartChip from './PartChip'
import PartImage from './PartImage'
import PartSpecRow from './PartSpecRow'
import RatingBreakdown from './RatingBreakdown'
import Sheet from './Sheet'
import sourceNotes from '../data/sourceNotes.json'
import { BUY_VERDICTS, explainVerdict } from '../lib/buyRec'
import { parseCombo, type Build } from '../lib/combo'
import { formatMYR } from '../lib/stock'
import { TIER_COLORS, TYPE_COLORS, TYPE_LABELS, tierLabel } from '../lib/tiers'
import type { PartIndex } from '../lib/partIndex'
import type { CustomBuild, Part, PartNotes, StockProduct } from '../lib/types'

const NOTE_TRANSLATIONS = sourceNotes as Record<string, string>

/**
 * The creator's own five bands, which are not our grade scale and are not
 * meant to line up with it — hence their own colours rather than TIER_COLORS.
 */
const PICK_TIER_COLORS: Record<string, string> = {
  'Top Level': '#5ce6a8',
  'Meta Relevant': '#8be8ff',
  'Niche Picks': '#ffc94d',
  'Not Worth Using': '#9aa3ad',
  'What Are You Doing': '#ff7a7a',
}

type Props = {
  stack: Part[]
  index: PartIndex | null
  notes: Record<string, PartNotes>
  /** KGB listings that carry this blade. Empty when the shop feed is unavailable. */
  listings?: (part: Part) => StockProduct[]
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

/**
 * A hand-curated modding build: the same part chips as a sheet build, plus the
 * strength, difficulty and playing notes the one-line combo format can't hold.
 */
function CustomBuildCard({
  build,
  index,
  onOpen,
}: {
  build: CustomBuild
  index: PartIndex | null
  onOpen: (part: Part) => void
}) {
  const parts: [string, string | undefined, 'ratchet' | 'bit' | 'assist'][] = [
    ['Ratchet', build.ratchet, 'ratchet'],
    ['Bit', build.bit, 'bit'],
    ['Assist', build.assist, 'assist'],
  ]

  return (
    <div className="custom-build">
      {build.title && <p className="custom-build-title">{build.title}</p>}

      <div className="build">
        {parts.map(([label, code, cat]) =>
          code ? (
            <div className="build-line" key={label}>
              <span className="build-label">{label}</span>
              <div className="build-chips">
                <PartChip code={code} part={index?.resolve(code, cat)} onOpen={onOpen} />
              </div>
            </div>
          ) : null,
        )}
      </div>

      {(build.modStrength || build.difficulty !== undefined) && (
        <div className="custom-build-stats">
          {build.modStrength && (
            <div>
              <strong>{build.modStrength}</strong>
              <span>Mod strength{build.modStrengthMax ? ` · max ${build.modStrengthMax}` : ''}</span>
            </div>
          )}
          {build.difficulty !== undefined && (
            <div>
              <strong>
                {build.difficulty}
                <span className="custom-build-of">/{build.difficultyMax ?? 5}</span>
              </strong>
              <span>Difficulty</span>
            </div>
          )}
        </div>
      )}

      {build.notes && build.notes.length > 0 && (
        <ul className="custom-build-notes">
          {build.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      <a
        className="custom-build-credit"
        href={build.credit.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Build by {build.credit.author} — {build.credit.sourceName}
      </a>
    </div>
  )
}

/**
 * Notes are keyed "category:id", but the catalogue is inconsistent about case
 * for a few bits ("NR" and "Nr" are both listed), and blade notes are written
 * against a base product code rather than each colour variant.
 */
function lookupNotes(notes: Record<string, PartNotes>, part: Part): PartNotes | undefined {
  const base = part.id.split('-').slice(0, 2).join('-')
  const wanted = [`${part.cat}:${part.id}`, `${part.cat}:${base}`]

  for (const key of wanted) {
    if (notes[key]) return notes[key]
  }

  const lower = wanted.map((k) => k.toLowerCase())
  const hit = Object.keys(notes).find((k) => lower.includes(k.toLowerCase()))
  return hit ? notes[hit] : undefined
}

/** iOS-style detail sheet with a navigation stack between related parts. */
export default function PartSheet({
  stack,
  index,
  notes,
  listings,
  onOpen,
  onBack,
  onClose,
}: Props) {
  const part = stack[stack.length - 1] ?? null
  if (!part) return null

  const tierColor = TIER_COLORS[part.tier] ?? '#6b7480'
  const verdict = part.buy ? BUY_VERDICTS[part.buy] : undefined
  const recommended = parseCombo(part.combo)
  const community = parseCombo(part.communityCombo)
  const record = part.rating?.tournament
  const shipsWith = index ? index.bladesShipping(part).slice(0, 12) : []
  const usedInBuild = index ? index.bladesUsingInBuild(part).slice(0, 12) : []
  const editorial = lookupNotes(notes, part)
  const sourceComments = [...recommended.notes, ...community.notes]
  const previous = stack.length > 1 ? stack[stack.length - 2] : null
  const forSale = listings?.(part) ?? []

  return (
    <Sheet
      label={part.nameEn ?? part.name}
      onClose={onClose}
      back={previous ? { label: previous.nameEn ?? previous.name, onBack } : undefined}
    >
      <div className="sheet-head">
        <PartImage src={part.img} alt={part.nameEn ?? part.name} size={72} />
        <div>
          <p className="sheet-id">{part.id}</p>
          <h2 className="sheet-name">{part.nameEn ?? part.name}</h2>
          {/* The alt line exists to keep a blade's original Chinese name in view
              next to its translation. A ratchet, bit or assist has no such
              pair — its "name" is just its id spelled out (輔助H / Heavy), so
              showing it here would repeat the id line as a third variant. */}
          {part.cat === 'blade' && part.nameEn && part.nameEn !== part.name && (
            <p className="sheet-alt">{part.name}</p>
          )}
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

      {/* Measurements sit with the chips rather than in a block of their own:
          they are the same kind of glance as the tier and the type, and a
          ratchet has nothing else on this sheet to read. */}
      {part.spec && (part.cat === 'bit' || part.cat === 'ratchet') && (
        <PartSpecRow spec={part.spec} cat={part.cat} />
      )}

      {(part.stockRatchet || part.stockBit || part.stockAssist || part.stockOverblade) && (
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
            {part.stockAssist && (
              <PartChip
                code={part.stockAssist}
                part={index?.resolve(part.stockAssist, 'assist')}
                onOpen={onOpen}
              />
            )}
            {part.stockOverblade && (
              <PartChip
                code={part.stockOverblade}
                part={index?.resolve(part.stockOverblade, 'overblade')}
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

      {part.customBuilds && part.customBuilds.length > 0 && (
        <section className="sheet-block">
          <h3>
            Custom builds <span className="editorial-badge">community tuned</span>
          </h3>
          {part.customBuilds.map((build, i) => (
            <CustomBuildCard key={i} build={build} index={index} onOpen={onOpen} />
          ))}
        </section>
      )}

      {shipsWith.length > 0 && (
        <section className="sheet-block">
          <h3>Comes in these blades</h3>
          <div className="build-chips">
            {shipsWith.map((blade) => (
              <button key={blade.id} className="part-chip" onClick={() => onOpen(blade)}>
                <PartImage src={blade.img} alt={blade.name} size={26} />
                <span className="chip-code">{blade.nameEn ?? blade.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {usedInBuild.length > 0 && (
        <section className="sheet-block">
          <h3>Suggested in builds</h3>
          <div className="build-chips">
            {usedInBuild.map((blade) => (
              <button key={blade.id} className="part-chip" onClick={() => onOpen(blade)}>
                <PartImage src={blade.img} alt={blade.name} size={26} />
                <span className="chip-code">{blade.nameEn ?? blade.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {record && (
        <section className="sheet-block">
          <h3>Tournament record</h3>
          <div className="stat-row">
            <div>
              <strong>{record.allTime.toLocaleString()}</strong>
              <span>placements</span>
            </div>
            {record.firsts !== undefined && (
              <div>
                <strong>{record.firsts.toLocaleString()}</strong>
                <span>firsts</span>
              </div>
            )}
            <div>
              <strong>{record.recent90.toLocaleString()}</strong>
              <span>last 3 months</span>
            </div>
          </div>
          {record.topRatchet && record.topBit && (
            <>
              <h4 className="sub-head">Most used setup</h4>
              <div className="build-chips">
                <PartChip
                  code={record.topRatchet}
                  part={index?.resolve(record.topRatchet, 'ratchet')}
                  onOpen={onOpen}
                />
                <PartChip
                  code={record.topBit}
                  part={index?.resolve(record.topBit, 'bit')}
                  onOpen={onOpen}
                />
              </div>
            </>
          )}
        </section>
      )}

      {editorial && (
        <section className="sheet-block">
          <h3>
            BeyClub notes <span className="editorial-badge">our own view</span>
          </h3>
          {editorial.profile && (
            <BitProfile profile={editorial.profile} measured={Boolean(part.spec)} />
          )}
          {editorial.summary && <p className="sheet-text">{editorial.summary}</p>}
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

      {/* Someone else's opinion, kept out of the block above so our own view and
          a source's are never read as one voice. One sentence and a link back
          to the moment they said it — the sheet is long enough already. */}
      {part.creatorPick && (
        <section className="sheet-block">
          <h3>Creator pick</h3>
          <p className="sheet-text">
            <span
              className="creator-tier"
              style={{ color: PICK_TIER_COLORS[part.creatorPick.tier] ?? '#9aa3ad' }}
            >
              {part.creatorPick.tier}
            </span>
            {part.creatorPick.note}
          </p>
          <a
            className="custom-build-credit"
            href={
              part.creatorPick.at
                ? `${part.creatorPick.credit.sourceUrl}?t=${part.creatorPick.at}`
                : part.creatorPick.credit.sourceUrl
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {part.creatorPick.credit.author} — {part.creatorPick.credit.sourceName} ↗
          </a>
        </section>
      )}

      {/* A grade a reader cannot act on is trivia. This is the one place the
          ranking meets a price, so it follows straight after our own notes. */}
      {forSale.length > 0 && (
        <section className="sheet-block">
          <h3>Where to buy</h3>
          {forSale.map((product) => (
            <a
              className="buy-row"
              key={product.slug}
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="buy-row-main">
                <span className="chip-code">{product.code ?? product.title}</span>
                <span className="buy-row-sub">{product.kgbCategory} · Kelab Gasing Beyblade</span>
              </span>
              <span className="buy-row-end">
                <span className="stock-price">{formatMYR(product.priceMYR)}</span>
                <span className={product.inStock ? 'stock-status in' : 'stock-status out'}>
                  {product.inStock ? 'In stock' : 'Sold out'}
                </span>
              </span>
            </a>
          ))}
        </section>
      )}

      {/* Provenance closes the sheet: read the part first, then check where
          the grade came from. */}
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

      {part.rating && <RatingBreakdown rating={part.rating} credit={part.credit} />}
    </Sheet>
  )
}
