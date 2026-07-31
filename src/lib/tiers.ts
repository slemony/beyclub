import type { PartCategory } from './types'

export const BLADE_TIERS = ['X', 'S+', 'S', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E']
export const PART_TIERS = ['X', 'S', 'A', 'B', 'C', 'D', 'E']

/** Same scale as the source site so rankings read identically across both. */
export const TIER_COLORS: Record<string, string> = {
  X: '#ff4466',
  'S+': '#ff7a2b',
  S: '#ffb830',
  'A+': '#c8e840',
  A: '#7adf60',
  'B+': '#40d4c0',
  B: '#38b0f0',
  'C+': '#8870ff',
  C: '#b060e0',
  'D+': '#cc5566',
  D: '#886688',
  'E+': '#556677',
  E: '#445566',
}

export const TYPE_LABELS: Record<string, string> = {
  attack: 'Attack',
  stamina: 'Stamina',
  defense: 'Defense',
  balance: 'Balance',
  special: 'Special',
  ratchet: 'Ratchet',
  bit: 'Bit',
}

export const TYPE_COLORS: Record<string, string> = {
  attack: '#ff5f78',
  stamina: '#7adf60',
  defense: '#ffb830',
  balance: '#b76bff',
  special: '#8be8ff',
  ratchet: '#8ba3c0',
  bit: '#8ba3c0',
}

export const CATEGORY_LABELS: Record<PartCategory | 'all', string> = {
  all: 'All',
  blade: 'Blades',
  ratchet: 'Ratchets',
  bit: 'Bits',
  assist: 'Assist',
}

export const BUY_LABELS: Record<string, string> = {
  yes: 'Worth buying',
  maybe: 'Situational',
  no: 'Skip for competitive',
}

/** Order tiers highest-first, with anything unrecognised last. */
export function tierRank(tier: string): number {
  const i = BLADE_TIERS.indexOf(tier)
  return i === -1 ? 999 : i
}

/** The sheet uses "-" for parts nobody has graded yet. */
export function tierLabel(tier: string): string {
  return tier === '-' ? 'Unrated' : tier
}

/** Case/space/hyphen-insensitive so "UX-03", "ux03" and "UX 03" all match. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s-]/g, '')
}
