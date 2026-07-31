import { BUY_VERDICTS } from './buyRec'
import { parseCombo } from './combo'
import type { ComboStat, Part } from './types'
import type { PartIndex } from './partIndex'

/**
 * "What the data says" — statements assembled only from numbers already in the
 * app. Nothing here is authored opinion; if a fact isn't in the data, no line
 * is produced for it.
 */
export function deriveInsights(part: Part, index: PartIndex, allCombos: ComboStat[]): string[] {
  const out: string[] = []
  const combos = index.combosUsing(part)

  if (part.stats?.wins) {
    const totalWins = allCombos.reduce((sum, c) => sum + c.wins, 0)
    const share = totalWins ? (part.stats.wins / totalWins) * 100 : 0
    out.push(
      `Placed top-3 in ${part.stats.wins.toLocaleString()} recorded finishes` +
        (share >= 0.1 ? ` — about ${share.toFixed(1)}% of all placements in the dataset.` : '.'),
    )
  }

  const best = [...combos].sort((a, b) => b.wins - a.wins)[0]
  if (best) {
    const build = `${best.ratchet}${best.bit}`
    const rate =
      best.championRate !== null ? ` with a ${(best.championRate * 100).toFixed(0)}% win rate` : ''
    out.push(
      part.cat === 'blade'
        ? `Its most successful build is ${build}, seen in ${best.wins.toLocaleString()} placements${rate}.`
        : `Its best showing is on ${best.bladeName} running ${build}, in ${best.wins.toLocaleString()} placements${rate}.`,
    )
  }

  if (part.cat === 'blade') {
    const grades: string[] = []
    if (part.stockRatchet && part.ratchetTier) {
      grades.push(`its stock ratchet ${part.stockRatchet} is graded ${part.ratchetTier}`)
    }
    if (part.stockBit && part.bitTier) {
      grades.push(`its stock bit ${part.stockBit} is graded ${part.bitTier}`)
    }
    if (grades.length) {
      out.push(`Out of the box, ${grades.join(' and ')}.`)
    }

    const recommended = parseCombo(part.combo)
    const optionCount = recommended.builds.reduce(
      (sum, b) => sum + b.ratchets.length + b.bits.length,
      0,
    )
    if (optionCount > 0) {
      out.push(`The community lists ${optionCount} recommended part options for it.`)
    }
  } else {
    const blades = index.bladesUsing(part)
    if (blades.length) {
      out.push(
        `${blades.length} blade${blades.length === 1 ? '' : 's'} in the database ship with or recommend this part.`,
      )
    }
  }

  const verdict = part.buy ? BUY_VERDICTS[part.buy] : undefined
  if (verdict) {
    out.push(
      part.cat === 'blade'
        ? `Grading the blade together with the parts it comes with puts it at "${verdict.label.toLowerCase()}".`
        : `On its tier alone it grades as "${verdict.label.toLowerCase()}".`,
    )
  }

  return out
}
