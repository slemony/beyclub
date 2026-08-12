import PartChip from './PartChip'
import PartImage from './PartImage'
import { BUY_VERDICTS } from '../lib/buyRec'
import { formatMYR, gradedOn } from '../lib/stock'
import { TIER_COLORS, tierLabel } from '../lib/tiers'
import type { Part, StockProduct } from '../lib/types'

type Props = {
  product: StockProduct
  /** Catalogue parts inside this product, strongest first. */
  contents: Part[]
  onOpen: (part: Part) => void
  watched: boolean
  onToggleWatch: (slug: string) => void
  /**
   * False while KGB's shop is closed to us: the published flags are a snapshot
   * from the last day we could read it, and repeating them as "In stock" — or
   * as "Sold out" — states something nobody here has checked.
   */
  showAvailability: boolean
}

/**
 * One shop listing, with whatever the ranking knows about what is in the box.
 *
 * The card is a container rather than a link because it holds buttons — each
 * part inside opens its own sheet — so the title carries the link out to KGB
 * instead of the whole row.
 */
export default function StockCard({
  product,
  contents,
  onOpen,
  watched,
  onToggleWatch,
  showAvailability,
}: Props) {
  const best = gradedOn(contents)
  const verdict = best?.buy ? BUY_VERDICTS[best.buy] : undefined
  const tierColor = best ? (TIER_COLORS[best.tier] ?? '#6b7480') : undefined

  /**
   * One chip per blade, not per slot. A random booster that holds Shark Edge in
   * two colours would otherwise print the same name twice and look broken —
   * whereas "×2" is the thing a buyer weighing the gamble actually wants.
   */
  const blades: { part: Part; slots: number }[] = []
  for (const part of contents) {
    const seen = blades.find((b) => b.part.cat === part.cat && b.part.key === part.key)
    if (seen) seen.slots++
    else blades.push({ part, slots: 1 })
  }

  // Dimming a card is itself a claim that it is sold out, so it goes with the
  // chip: no dimming when availability is unknown.
  const cls = [
    'stock-card',
    showAvailability && !product.inStock ? 'sold-out' : '',
    watched ? 'watched' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={cls}>
      <div className="stock-head">
        <PartImage src={product.img} alt={product.title} size={54} />

        <div className="part-body">
          <p className="part-id">
            {product.code ? `${product.code} · ` : ''}
            {product.kgbCategory}
          </p>
          <a
            className="part-name stock-link"
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {product.title}
          </a>
          <p className="stock-line">
            <span className="stock-price">{formatMYR(product.priceMYR)}</span>
            {showAvailability && (
              <span className={product.inStock ? 'stock-status in' : 'stock-status out'}>
                {product.inStock ? 'In stock' : 'Sold out'}
              </span>
            )}
          </p>
        </div>

        {/*
          Sits outside part-body so it stays pinned to the corner whatever the
          title wraps to. Labelled rather than relying on the star alone, since
          "watched" is not something an icon states unambiguously.
        */}
        <button
          className={watched ? 'watch-star on' : 'watch-star'}
          onClick={() => onToggleWatch(product.slug)}
          aria-pressed={watched}
          title={watched ? 'Stop watching' : 'Watch this'}
        >
          <span aria-hidden="true">{watched ? '★' : '☆'}</span>
          <span className="sr-only">
            {watched ? `Stop watching ${product.title}` : `Watch ${product.title}`}
          </span>
        </button>
      </div>

      {(best || verdict) && (
        <div className="part-meta">
          {best && (
            <span
              className="chip"
              style={{ color: tierColor, borderColor: `${tierColor}55` }}
            >
              {/* Naming the part that earned the grade keeps a booster's verdict
                  from reading as a claim about all five blades in it. */}
              {contents.length > 1 ? 'Best of the box' : 'Tier'} {tierLabel(best.tier)}
            </span>
          )}
          {verdict && <span className={`chip stock-flag ${verdict.tone}`}>{verdict.label}</span>}
        </div>
      )}

      {contents.length > 0 && (
        <div className="stock-contents">
          {/* Counted in blades, not in parts: the ratchet and bit in the box are
              on each blade's own sheet, and claiming to list "what's inside"
              while naming only the blades would overstate this row. */}
          <span className="build-label">
            {contents.length > 1 ? `${contents.length} blades` : 'Blade'}
          </span>
          <div className="build-chips">
            {blades.map(({ part, slots }) => {
              const name = part.nameEn ?? part.name
              return (
                <PartChip
                  key={`${part.cat}-${part.id}`}
                  code={part.id}
                  part={part}
                  label={slots > 1 ? `${name} ×${slots}` : name}
                  onOpen={onOpen}
                />
              )
            })}
          </div>
        </div>
      )}
    </article>
  )
}
