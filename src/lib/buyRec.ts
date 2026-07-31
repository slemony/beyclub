import type { BuyAdvice } from './types'

/**
 * Buy verdicts mirror the reference tier site's algorithm so a part graded
 * "worth buying" here matches what a player sees there. The source sheet leaves
 * its buy column empty and computes this at load time.
 */
const TIER_SCORES: Record<string, number> = {
  X: 100,
  'S+': 90,
  S: 80,
  'A+': 70,
  A: 60,
  'B+': 50,
  B: 40,
  'C+': 30,
  C: 20,
  'D+': 15,
  D: 10,
  'E+': 5,
  E: 0,
}

/** A blade is judged on the whole package: its own tier counts double. */
export function calculateBuyRec(
  bladeTier: string,
  ratchetTier?: string,
  bitTier?: string,
  assistTier?: string,
): BuyAdvice {
  const weighted: [string | undefined, number][] = [
    [bladeTier, 2],
    [ratchetTier, 1],
    [bitTier, 1],
    [assistTier, 1],
  ]

  let totalScore = 0
  let totalWeight = 0

  for (const [tier, weight] of weighted) {
    const score = tier ? TIER_SCORES[tier] : undefined
    if (score === undefined) continue
    totalScore += score * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return ''

  const avg = totalScore / totalWeight
  if (avg >= 60) return 'yes'
  if (avg >= 40) return 'maybe'
  return 'no'
}

/** A ratchet or bit stands on its own tier alone. */
export function getBuyRec(tier: string): BuyAdvice {
  if (['X', 'S+', 'S', 'A+', 'A'].includes(tier)) return 'yes'
  if (['B+', 'B'].includes(tier)) return 'maybe'
  if (TIER_SCORES[tier] === undefined) return ''
  return 'no'
}

export const BUY_VERDICTS: Record<
  Exclude<BuyAdvice, ''>,
  { label: string; reason: string; tone: 'good' | 'warn' | 'bad' }
> = {
  yes: {
    label: 'Worth buying',
    reason: 'Performs well competitively — a solid investment.',
    tone: 'good',
  },
  maybe: {
    label: 'Situational',
    reason: 'Has its uses, but buy it only if the budget allows.',
    tone: 'warn',
  },
  no: {
    label: 'Skip for competitive',
    reason: 'Falls behind in the current meta — worth skipping.',
    tone: 'bad',
  },
}

/**
 * The verdict grades the whole product, so a top blade packaged with weak parts
 * lands on "situational" — surprising unless we say why. This spells out the
 * arithmetic in words so the rating never looks arbitrary.
 */
export function explainVerdict(part: {
  cat: string
  tier: string
  buy: BuyAdvice
  stockRatchet?: string
  ratchetTier?: string
  stockBit?: string
  bitTier?: string
}): string {
  const base = part.buy ? BUY_VERDICTS[part.buy as Exclude<BuyAdvice, ''>].reason : ''
  if (part.cat !== 'blade') return base

  const weak: string[] = []
  const strong: string[] = []

  const bladeScore = TIER_SCORES[part.tier]
  for (const [name, code, tier] of [
    ['ratchet', part.stockRatchet, part.ratchetTier],
    ['bit', part.stockBit, part.bitTier],
  ] as const) {
    if (!code || !tier) continue
    const score = TIER_SCORES[tier]
    if (score === undefined || bladeScore === undefined) continue
    if (score < bladeScore) weak.push(`its ${name} ${code} is only ${tier}`)
    else strong.push(`its ${name} ${code} is ${tier}`)
  }

  if (weak.length) {
    return `The blade itself grades ${part.tier}, but ${weak.join(' and ')} — you are buying it for the blade, and will want better parts to go with it.`
  }
  if (strong.length) {
    return `Graded ${part.tier}, and ${strong.join(' and ')} — good value straight out of the box.`
  }
  return base
}
