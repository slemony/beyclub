import { Link } from 'react-router-dom'
import BitProfile from './BitProfile'
import PartChip from './PartChip'
import PartImage from './PartImage'
import PartSpecRow from './PartSpecRow'
import RatingBreakdown from './RatingBreakdown'
import Sheet from './Sheet'
import sourceNotes from '../data/sourceNotes.json'
import type { AcquireRoute } from '../lib/acquire'
import { BUY_VERDICTS, explainVerdict } from '../lib/buyRec'
import { parseCombo, type Build } from '../lib/combo'
import { formatMYR } from '../lib/stock'
import { productCode } from '../lib/text'
import { TIER_COLORS, TYPE_COLORS, TYPE_LABELS, tierLabel } from '../lib/tiers'
import type { PartIndex } from '../lib/partIndex'
import type { CustomBuild, Part, PartNotes } from '../lib/types'

const NOTE_TRANSLATIONS = sourceNotes as Record<string, string>

/**
 * The creator's own five bands, which are not our grade scale and are not
 * meant to line up with it — hence their own colours rather than TIER_COLORS.
 */
// The creator names their own tiers, and names them differently per video — the
// bit list and the ratchet list share only "Top Level" and "Niche Picks". Both
// sets are listed here rather than mapped onto one scale, so a sheet shows the
// label the creator actually used; equivalent rungs are given the same colour.
const PICK_TIER_COLORS: Record<string, string> = {
  'Top Level': '#5ce6a8',
  'Meta Relevant': '#8be8ff',
  'Situational Choices': '#8be8ff',
  'Niche Picks': '#ffc94d',
  'Not Worth Using': '#9aa3ad',
  'Do You Want To Lose?': '#9aa3ad',
  'What Are You Doing': '#ff7a7a',
  'Plastic Waste': '#ff7a7a',
}

type Props = {
  stack: Part[]
  index: PartIndex | null
  notes: Record<string, PartNotes>
  /** Every box this part can be got from, easiest first. Empty when the shop feed is unavailable. */
  routes?: (part: Part) => AcquireRoute[]
  /**
   * Whether anything here can honestly speak to what is on the shelf. False
   * while KGB's shop is members-only, and then a price is the last one we saw
   * and "Sold out" would be an invention — the same rule the Stock page keeps.
   */
  stockKnown?: boolean
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
  const base = productCode(part.id)
  const wanted = [`${part.cat}:${part.id}`, `${part.cat}:${base}`]

  for (const key of wanted) {
    if (notes[key]) return notes[key]
  }

  const lower = wanted.map((k) => k.toLowerCase())
  const hit = Object.keys(notes).find((k) => lower.includes(k.toLowerCase()))
  return hit ? notes[hit] : undefined
}

/**
 * A sheet is a page to read, not a catalogue. Six boxes answer "where do I get
 * one" for every part in the game; ratchet 3-60 alone has twenty-one, and the
 * tail of them is unlisted collab boxes nobody can buy. The count of what is
 * left out is shown, so the cut is visible rather than silent.
 */
const MAX_ROUTES = 6

/** "1 in 6" reads as odds; "0.167" reads as homework. */
const oneIn = (chance: number) => Math.round(1 / chance)

/** What this box gives you, in the words the reader would use. */
function routeSub(route: AcquireRoute, part: Part): string {
  if (route.kind === 'inBox') return 'Loose in the box'

  if (route.kind === 'assembled') {
    if (part.cat === 'blade') return 'Comes in this box'
    const via = route.via ? ` · on ${route.via.nameEn ?? route.via.name}` : ''
    return `Comes built with it${via}`
  }

  const odds = route.odds
  // An estimate says what it counted and admits what it could not: the sheet
  // under-lists some boxes, so this denominator is a floor, and a bare
  // percentage here would be a claim we cannot support.
  if (route.estimated) {
    return odds
      ? `${odds.hits} of the ${odds.of} beys we know it holds — ratios aren't published`
      : "A random pull — ratios aren't published"
  }
  return odds ? `${odds.hits} of ${odds.of} pulls · about 1 in ${oneIn(route.chance)}` : 'A random pull'
}

/** The headline verdict — the same sentence, short enough to lead with. */
function routeHeadline(route: AcquireRoute, part: Part): string {
  if (route.kind === 'inBox') return 'Loose in the box'
  if (route.kind === 'assembled') {
    return part.cat === 'blade' ? 'Comes in this box' : 'Comes built with it'
  }
  return `About 1 in ${oneIn(route.chance)} boxes${route.estimated ? ' (our estimate)' : ''}`
}

/**
 * One box you could get the part from: what it is, what it gives you and what
 * KGB wants for it.
 *
 * A row with a listing is a link to that listing, exactly as the old "Where to
 * buy" rows were. One without is a plain div — there is nothing to open, and a
 * link that goes nowhere is worse than none.
 */
function RouteRow({
  route,
  part,
  stockKnown,
}: {
  route: AcquireRoute
  part: Part
  stockKnown: boolean
}) {
  const body = (
    <>
      <span className="buy-row-main">
        <span className="chip-code">{route.label}</span>
        <span className="buy-row-sub">{routeSub(route, part)}</span>
      </span>
      <span className="buy-row-end">
        {route.listing ? (
          <span className="stock-price">{formatMYR(route.listing.priceMYR)}</span>
        ) : (
          <span className="buy-row-sub">Not sold at KGB</span>
        )}
        {/* The status word only exists when the shop can actually be read. */}
        {stockKnown && route.listing && (
          <span className={route.listing.inStock ? 'stock-status in' : 'stock-status out'}>
            {route.listing.inStock ? 'In stock' : 'Sold out'}
          </span>
        )}
        {/* What the part costs when the box picks, not the shelf price — a
            statement about money, so an unreadable shop does not silence it. */}
        {route.expectedMYR !== undefined && (
          <span className="buy-row-sub">≈ {formatMYR(route.expectedMYR)} a pull</span>
        )}
      </span>
    </>
  )

  return (
    <div className="route">
      {route.listing ? (
        <a className="buy-row" href={route.listing.url} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        <div className="buy-row">{body}</div>
      )}
      {/* What a box holds is a curated claim like any other here, so it carries
          the page it was read from. */}
      {route.source && (
        <a className="route-source" href={route.source} target="_blank" rel="noopener noreferrer">
          What's in this box ↗
        </a>
      )}
    </div>
  )
}

/** iOS-style detail sheet with a navigation stack between related parts. */
export default function PartSheet({
  stack,
  index,
  notes,
  routes,
  stockKnown = false,
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
  const shipsAssembled = Boolean(
    part.stockRatchet || part.stockBit || part.stockAssist || part.stockOverblade,
  )
  // The rest of a customize set: everything in the box this blade does not
  // already come assembled with.
  const alsoInBox: { code: string; cat: 'ratchet' | 'bit' }[] = [
    ...(part.setRatchets ?? [])
      .filter((code) => code !== part.stockRatchet)
      .map((code) => ({ code, cat: 'ratchet' as const })),
    ...(part.setBits ?? [])
      .filter((code) => code !== part.stockBit)
      .map((code) => ({ code, cat: 'bit' as const })),
  ]
  const sourceComments = [...recommended.notes, ...community.notes]
  const previous = stack.length > 1 ? stack[stack.length - 2] : null
  const ways = routes?.(part) ?? []
  const shownWays = ways.slice(0, MAX_ROUTES)

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
      {part.spec && <PartSpecRow spec={part.spec} cat={part.cat} />}

      {(shipsAssembled || alsoInBox.length > 0) && (
        <section className="sheet-block">
          <h3>Comes with</h3>
          {shipsAssembled && (
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
          )}

          {/* A customize set is one box holding several blades and a pile of
              loose parts. They are in the box with this blade but it does not
              come built with them, so they are named as what they are rather
              than folded into the line above. */}
          {alsoInBox.length > 0 && (
            <>
              {/* Only "also" when there is something to be also to — a blade
                  the sheet gives no assembled parts is simply the box. */}
              {shipsAssembled && <h4 className="sub-head">Also in the box</h4>}
              <div className="build-chips">
                {alsoInBox.map(({ code, cat }) => (
                  <PartChip
                    key={`${cat}-${code}`}
                    code={code}
                    part={index?.resolve(code, cat)}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </>
          )}
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
          ranking meets a price, so it follows straight after our own notes.
          A ratchet has no listing of its own and never will — what you buy is
          a box — so the question this answers is "which box", not "where". */}
      {ways.length > 0 && (
        <section className="sheet-block">
          <h3>How to get it</h3>

          <div className="route-best">
            <strong>{ways[0].label}</strong>
            <span>
              {routeHeadline(ways[0], part)}
              {ways[0].listing ? ` · ${formatMYR(ways[0].listing.priceMYR)}` : ' · not sold at KGB'}
              {stockKnown && ways[0].listing && (ways[0].listing.inStock ? ' · in stock' : ' · sold out')}
            </span>
          </div>

          {shownWays.map((route) => (
            <RouteRow key={route.code} route={route} part={part} stockKnown={stockKnown} />
          ))}

          {ways.length > shownWays.length && (
            <p className="route-note">
              {ways.length - shownWays.length} more {ways.length - shownWays.length === 1 ? 'box' : 'boxes'} can
              give you this part — mostly collab and older releases KGB doesn't list.
            </p>
          )}

          {/* KGB has been members-only since 6 Aug 2026, so the feed is frozen.
              Said once under the block rather than on each row: "Sold out"
              would be as much of an invention as "In stock", and so would a
              silent omission the reader cannot see. */}
          {!stockKnown && ways.some((r) => r.listing) && (
            <p className="route-note">
              KGB's shop is members-only, so these are the last prices we saw — we can't tell what's
              on the shelf today. <Link to="/stock">Check Stock ›</Link>
            </p>
          )}
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
