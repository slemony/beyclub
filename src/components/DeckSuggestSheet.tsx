import { useMemo, useState } from 'react'
import { PartStrip } from './BuildCard'
import Sheet from './Sheet'
import { buildParts } from '../lib/builds'
import { partCode, type PartIndex } from '../lib/partIndex'
import { normalize } from '../lib/text'
import { suggestDeck, type DeckPins, type DeckSuggestion } from '../lib/deckSuggest'
import { CATEGORY_SINGULAR } from '../lib/tiers'
import type { CollectionEntry, Part, PartCategory, SavedBuild } from '../lib/types'

type Props = {
  parts: Part[]
  entries: CollectionEntry[]
  index: PartIndex
  startingBuilds?: SavedBuild[]
  startingName?: string
  onSave: (suggestion: DeckSuggestion, name: string, allowDuplicates: boolean) => void
  onClose: () => void
}

const CATS: [keyof DeckPins[number], PartCategory][] = [
  ['blade', 'blade'],
  ['ratchet', 'ratchet'],
  ['bit', 'bit'],
  ['assist', 'assist'],
  ['overblade', 'overblade'],
]

const codeOf = (part: Part) => partCode(part.cat, part.id)
const ownKey = (part: Part) => `${part.cat}|${normalize(codeOf(part))}`

export default function DeckSuggestSheet({
  parts,
  entries,
  index,
  startingBuilds = [],
  startingName = 'Suggested deck',
  onSave,
  onClose,
}: Props) {
  const [pins, setPins] = useState<DeckPins>(() =>
    Array.from({ length: 3 }, (_, row) => ({ blade: startingBuilds[row]?.blade })),
  )
  const [name, setName] = useState(startingName)
  const [allowDuplicates, setAllowDuplicates] = useState(false)
  const [randomSeed, setRandomSeed] = useState<number | undefined>()
  const [bannedBlades, setBannedBlades] = useState<string[]>([])
  const [bannedParts, setBannedParts] = useState<string[]>([])
  const [excludeAttackBits, setExcludeAttackBits] = useState(false)
  const [banPartCategory, setBanPartCategory] = useState<PartCategory>('bit')
  const [banPartCode, setBanPartCode] = useState('')

  const ownedCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries) {
      if (!entry.code) continue
      const key = `${entry.cat}|${normalize(entry.code)}`
      counts.set(key, (counts.get(key) ?? 0) + entry.sources.reduce((sum, source) => sum + source.qty, 0))
    }
    return counts
  }, [entries])

  const ownedParts = useMemo(
    () => parts.filter((part) => (ownedCounts.get(ownKey(part)) ?? 0) > 0),
    [parts, ownedCounts],
  )
  const ownedBlades = ownedParts.filter((part) => part.cat === 'blade')
  const distinctBladeCount = new Set(ownedBlades.map((part) => normalize(part.id))).size

  const result = useMemo(
    () => suggestDeck(parts, entries, pins, allowDuplicates, randomSeed, { bannedBlades, bannedParts, excludeAttackBits }),
    [parts, entries, pins, allowDuplicates, randomSeed, bannedBlades, bannedParts, excludeAttackBits],
  )

  const updatePin = (row: number, slot: keyof DeckPins[number], value: string) => {
    setPins((current) => current.map((pin, i) => (i === row ? { ...pin, [slot]: value || undefined } : pin)))
    setRandomSeed(undefined)
  }

  const ownedFor = (cat: PartCategory) => ownedParts
    .filter((part) => part.cat === cat)
    .sort((a, b) => (a.nameEn ?? a.name).localeCompare(b.nameEn ?? b.name))

  const banThisBlade = (bladeId: string) => {
    setBannedBlades((current) => current.some((code) => normalize(code) === normalize(bladeId)) ? current : [...current, bladeId])
    setPins((current) => current.map((pin) => normalize(pin.blade ?? '') === normalize(bladeId) ? { ...pin, blade: undefined } : pin))
    setRandomSeed(Math.floor(Math.random() * 0xffffffff))
  }

  const changePart = (row: number, slot: keyof DeckPins[number], cat: PartCategory, value: string) => {
    const normalized = value ? codeOf(ownedFor(cat).find((part) => codeOf(part) === value)!) : ''
    updatePin(row, slot, normalized)
  }

  return (
    <Sheet label="Suggest a competitive deck" onClose={onClose}>
      <h2 className="sheet-name sheet-name-lead">Build a competitive deck</h2>
      <p className="collection-empty-hint deck-suggest-intro">
        Suggestions use only parts you own and rank each complete bey from blended part grades, tournament placements, and recorded combo pairings. Other saved decks may reuse these parts.
      </p>

      {distinctBladeCount < 3 ? (
        <div className="glass notice notice-stale deck-warning">
          Not enough blades to build a deck. You need 3 different owned blades; your collection has {distinctBladeCount}.
        </div>
      ) : (
        <>
          <div className="collection-field">
            <label htmlFor="suggested-deck-name">Suggested deck name</label>
            <input id="suggested-deck-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <section className="sheet-block deck-suggest-pins">
            <h3>Build around these choices (optional)</h3>
            <p className="collection-empty-hint">Select a blade or part to pin it in that row. Leave it on Auto to let the suggester choose.</p>
            {pins.map((pin, row) => (
              <div className="deck-suggest-pin-row" key={row}>
                <strong>Bey {row + 1}</strong>
                {CATS.map(([slot, cat]) => {
                  const options = ownedFor(cat)
                  const current = pin[slot]
                  const value = current
                    ? options.find((part) => normalize(codeOf(part)) === normalize(current))
                    : undefined
                  return (
                    <label className="deck-suggest-pin" key={slot}>
                      <span>{CATEGORY_SINGULAR[cat]}</span>
                      <select
                        aria-label={`Bey ${row + 1} ${CATEGORY_SINGULAR[cat]}`}
                        value={value ? codeOf(value) : ''}
                        onChange={(event) => changePart(row, slot, cat, event.target.value)}
                      >
                        <option value="">Auto</option>
                        {options.map((part) => (
                          <option key={`${part.cat}-${part.id}`} value={codeOf(part)}>
                            {part.nameEn ?? part.name} ({part.id})
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                })}
              </div>
            ))}
          </section>

          <section className="sheet-block deck-suggest-filters">
            <h3>Exclude parts you don’t want</h3>
            <label className="collection-check-line">
              <input type="checkbox" checked={excludeAttackBits} onChange={(event) => setExcludeAttackBits(event.target.checked)} />
              <span>Exclude attack-type bits</span>
            </label>
            <div className="deck-suggest-ban-controls">
              <select aria-label="Part category to ban" value={banPartCategory} onChange={(event) => { const cat = event.target.value as PartCategory; setBanPartCategory(cat); setBanPartCode('') }}>
                {CATS.filter(([, cat]) => cat !== 'blade').map(([, cat]) => <option key={cat} value={cat}>{CATEGORY_SINGULAR[cat]}</option>)}
              </select>
              <select aria-label="Part to ban" value={banPartCode} onChange={(event) => setBanPartCode(event.target.value)}>
                <option value="">Choose a part</option>
                {ownedFor(banPartCategory).map((part) => <option key={part.id} value={ownKey(part)}>{part.nameEn ?? part.name} ({part.id})</option>)}
              </select>
              <button className="filter-chip" disabled={!banPartCode || bannedParts.includes(banPartCode)} onClick={() => { if (banPartCode) setBannedParts((current) => [...current, banPartCode]); setBanPartCode(''); setRandomSeed(Math.floor(Math.random() * 0xffffffff)) }}>Ban part</button>
            </div>
            {!!bannedBlades.length && <div className="deck-suggest-bans"><span>Blades:</span>{bannedBlades.map((code) => <button className="filter-chip" key={code} onClick={() => setBannedBlades((current) => current.filter((item) => item !== code))}>{code} ×</button>)}</div>}
            {!!bannedParts.length && <div className="deck-suggest-bans"><span>Parts:</span>{bannedParts.map((key) => <button className="filter-chip" key={key} onClick={() => setBannedParts((current) => current.filter((item) => item !== key))}>{key.split('|')[1]} ×</button>)}</div>}
          </section>

          <label className="collection-check-line">
            <input
              type="checkbox"
              checked={allowDuplicates}
              onChange={(event) => setAllowDuplicates(event.target.checked)}
            />
            <span>Allow repeated parts within this deck (only up to owned quantity)</span>
          </label>

          <div className="deck-suggest-actions">
            <button className={randomSeed === undefined ? 'filter-chip active' : 'filter-chip'} onClick={() => setRandomSeed(undefined)}>
              Best deck
            </button>
            <button className="filter-chip" onClick={() => setRandomSeed(Math.floor(Math.random() * 0xffffffff))}>
              Regenerate random
            </button>
          </div>

          {!result.ok ? (
            <div className="glass notice notice-stale deck-warning">{result.reason}</div>
          ) : (
            <>
              <section className="sheet-block">
                <h3>{result.suggestion.random ? 'Random competitive suggestion' : 'Best competitive suggestion'} · {Math.round(result.suggestion.score)}/100</h3>
                <div className="deck-suggest-results">
                  {result.suggestion.builds.map((ranked, row) => (
                    <article className="deck-suggest-result" key={`${ranked.build.blade}-${row}`}>
                      <strong>Bey {row + 1}: {index.resolve(ranked.build.blade!, 'blade')?.nameEn ?? index.resolve(ranked.build.blade!, 'blade')?.name}</strong>
                      <button className="filter-chip" onClick={() => banThisBlade(ranked.build.blade!)}>Ban this blade and reroll</button>
                      <PartStrip parts={buildParts(ranked.build, index)} size={34} />
                      <ul className="build-suggest-list">
                        {ranked.explanation.slice(0, 9).map((line, i) => <li key={i}>{line}</li>)}
                      </ul>
                    </article>
                  ))}
                </div>
                <p className="collection-empty-hint">
                  {result.suggestion.explanation.join(' ')}
                </p>
              </section>
              <button
                className="collection-submit"
                disabled={!name.trim()}
                onClick={() => onSave(result.suggestion, name.trim(), allowDuplicates)}
              >
                Save as deck
              </button>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
