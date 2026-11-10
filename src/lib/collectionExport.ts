import { totalQty } from './collection'
import type { CollectionEntry, Part, PartCategory } from './types'

const CATEGORY_ORDER: PartCategory[] = ['blade', 'ratchet', 'bit', 'assist', 'overblade']
const CATEGORY_HEADING: Record<PartCategory, string> = {
  blade: 'Blade',
  ratchet: 'Ratchet',
  bit: 'Bit',
  assist: 'Assist',
  overblade: 'Overblade',
}

/** Creates an English, category-grouped list of owned parts for copying. */
export function collectionPartsText(
  entries: CollectionEntry[],
  resolve: (code: string, cat: PartCategory) => Part | undefined,
): string {
  const packs = [...new Set(entries.flatMap((entry) => entry.sources
    .map((source) => source.from?.trim())
    .filter((from): from is string => typeof from === 'string' && from.length > 0 && !isLooseOrigin(from))))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

  const packSection = `Packs:\n${packs.join('\n')}`
  const partSections = CATEGORY_ORDER.map((category) => {
    const lines = entries
      .filter((entry) => entry.cat === category)
      .map((entry) => {
        const part = entry.code ? resolve(entry.code, category) : undefined
        const label = part?.nameEn ?? (part?.id || entry.name || '')
        if (!label) return undefined
        const quantity = totalQty(entry)
        return { label, line: quantity > 1 ? `${label} ×${quantity}` : label }
      })
      .filter((item): item is { label: string; line: string } => Boolean(item))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
      .map((item) => item.line)

    return `${CATEGORY_HEADING[category]}:\n${lines.join('\n')}`
  }).join('\n\n')

  return `${packSection}\n\n${partSections}`
}

function isLooseOrigin(origin: string): boolean {
  return /^(loose(?:\s*\/\s*unknown)?|unknown|traded|bought\s+loose)$/i.test(origin.trim())
}
