import { useMemo, useState } from 'react'
import Modal from './Modal'
import { offerIds, resolveOffer, useOffer, type Offer } from '../lib/userSync'
import { totalQty } from '../lib/collection'
import { CATEGORY_SINGULAR } from '../lib/tiers'

/**
 * What signing in offers to bring down from the account, one tick box per
 * record.
 *
 * Everything is ticked to begin with, so the quick answer — tap the button —
 * is the same thing that used to happen automatically. The boxes are there
 * for the times it isn't: a phone borrowed from a clubmate, a deck built for
 * one tournament, a collection you'd rather keep to the one device.
 *
 * Nothing here can cost the account anything. This device's own records went
 * up before this appeared, and whatever is left unticked stays in the account
 * for the devices that want it — it just stops being offered here.
 */
export default function SyncOfferDialog() {
  const offer = useOffer()
  if (!offer) return null
  return <OfferChoice offer={offer} />
}

/** Split out so the tick state is born with the offer and dies with it. */
function OfferChoice({ offer }: { offer: Offer }) {
  const all = useMemo(() => offerIds(offer), [offer])
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(all))

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const partLabel = (name: string, qty: number) => (qty > 1 ? `${name} ×${qty}` : name)

  const section = <T,>(title: string, records: T[], id: (r: T) => string, label: (r: T) => string) => {
    if (!records.length) return null
    return (
      <div className="arrival-section">
        <h4>{title}</h4>
        <div className="offer-list">
          {records.map((record) => (
            <label key={id(record)} className="offer-row">
              <input type="checkbox" checked={chosen.has(id(record))} onChange={() => toggle(id(record))} />
              <span>{label(record)}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Modal label="Load from your account" onClose={() => resolveOffer([...chosen])}>
      <h3 className="modal-title">Welcome back</h3>
      <p className="modal-body">
        Everything on this device is already saved to your account. These are the things the account has that this
        device doesn't — untick anything you'd rather not have here. It stays in your account either way.
      </p>

      <div className="offer-bulk">
        <button className="offer-bulk-btn" onClick={() => setChosen(new Set(all))}>
          Tick all
        </button>
        <button className="offer-bulk-btn" onClick={() => setChosen(new Set())}>
          Tick none
        </button>
      </div>

      {section(
        offer.entries.length === 1 ? '1 part' : `${offer.entries.length} parts`,
        offer.entries,
        (e) => e.id,
        (e) => partLabel(`${e.code ?? e.name ?? '—'} (${CATEGORY_SINGULAR[e.cat]})`, totalQty(e)),
      )}
      {section(
        offer.builds.length === 1 ? '1 build' : `${offer.builds.length} builds`,
        offer.builds,
        (b) => b.id,
        (b) => b.name || 'Unnamed build',
      )}
      {section(
        offer.decks.length === 1 ? '1 deck' : `${offer.decks.length} decks`,
        offer.decks,
        (d) => d.id,
        (d) => d.name || 'Unnamed deck',
      )}

      <div className="modal-actions">
        <button className="modal-btn primary" onClick={() => resolveOffer([...chosen])}>
          {chosen.size === 0
            ? 'Load nothing'
            : chosen.size === all.length
              ? `Load all ${all.length}`
              : `Load ${chosen.size} of ${all.length}`}
        </button>
      </div>
    </Modal>
  )
}
