import PartChip from './PartChip'
import PartImage from './PartImage'
import { BUY_VERDICTS } from '../lib/buyRec'
import { distinctBlades, formatMYR, gradedOn } from '../lib/stock'
import { TIER_COLORS, tierLabel } from '../lib/tiers'
import type { Part, StockProduct } from '../lib/types'

type Props = {
  product: StockProduct
  /** Catalogue parts inside this product, strongest first. */
  contents: Part[]
  onOpen: (part: Part) => void
}

/**
 * One shop listing, with whatever the ranking knows about what is in the box.
 *
 * The card is a container rather than a link because it holds buttons — each
 * part inside opens its own sheet — so the title carries the link out to KGB
 * instead of the whole row.
 */
export default function StockCard({ product, contents, onOpen }: Props) {
  const best = gradedOn(contents)
  const verdict = best?.buy ? BUY_VERDICTS[best.buy] : undefined
  const tierColor = best ? (TIER_COLORS[best.tier] ?? '#6b7480') : undefined

  /**
   * One chip per blade, not per slot. A random booster that holds Shark Edge in
   * two colours would otherwise print the same name twice and look broken —
   * whereas "×2" is the thing a buyer weighing the gamble actually wants.
   */
  const blades = distinctBlades(contents).map((part) => ({
    part,
    slots: contents.filter((p) => p.cat === part.cat && p.key === part.key).length,
  }))

  return (
    <article className={product.inStock ? 'stock-card' : 'stock-card sold-out'}>
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
            <span className={product.inStock ? 'stock-status in' : 'stock-status out'}>
              {product.inStock ? 'In stock' : 'Sold out'}
            </span>
          </p>
        </div>
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
