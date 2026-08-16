import type { PartIndex } from './partIndex'
import { normalize } from './text'
import type { Deck, Part, PartCategory, SavedBuild } from './types'

/**
 * Saved builds and the decks they go into, kept in this browser. Same
 * local-first contract as collection.ts — this file alone makes the feature
 * work with no account, and userSync.ts layers Firestore on top.
 */
const KEY = 'beyclub:builds:v1'

export type BuildsFile = { builds: SavedBuild[]; decks: Deck[] }

const EMPTY: BuildsFile = { builds: [], decks: [] }

/** The slots a build has, in the order a bey is assembled. */
export const BUILD_SLOTS: [keyof Pick<SavedBuild, 'blade' | 'ratchet' | 'bit' | 'assist' | 'overblade'>, PartCategory][] =
  [
    ['blade', 'blade'],
    ['ratchet', 'ratchet'],
    ['bit', 'bit'],
    ['assist', 'assist'],
    ['overblade', 'overblade'],
  ]

export type BuildSlot = (typeof BUILD_SLOTS)[number][0]

/** The parts of a build, in slot order, skipping empty and unresolvable slots. */
export function buildParts(build: SavedBuild, index: PartIndex): Part[] {
  return BUILD_SLOTS.map(([slot, cat]) => {
    const code = build[slot]
    return code ? index.resolve(code, cat) : undefined
  }).filter((p): p is Part => Boolean(p))
}

/** What a build is called: its own name, else the parts it's made of. */
export function buildTitle(build: SavedBuild, index: PartIndex): string {
  if (build.name) return build.name
  const parts = buildParts(build, index)
  return parts.length ? parts.map((p) => p.nameEn ?? p.name).join(' ') : 'Empty build'
}

/** The blade field that says whether its line uses a given slot at all. */
const SLOT_SOURCE: Record<Exclude<BuildSlot, 'blade'>, keyof Part> = {
  ratchet: 'stockRatchet',
  bit: 'stockBit',
  assist: 'stockAssist',
  overblade: 'stockOverblade',
}

/**
 * Whether a slot can be filled for the chosen blade.
 *
 * Read off the blade's own box rather than hard-coded per product line: most
 * blades have no assist blade, only CX ships an over blade, and a handful of
 * UX blades (UX-19, UX-20, UX-21-01) integrate the ratchet so there is no
 * separate one to choose. Offering those slots anyway would let someone
 * assemble a bey that cannot exist.
 */
export function slotEnabled(slot: BuildSlot, blade: Part | undefined): boolean {
  if (slot === 'blade') return true
  if (!blade) return false
  return Boolean(blade[SLOT_SOURCE[slot]])
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function readBuilds(): BuildsFile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<BuildsFile>
    return { builds: parsed.builds ?? [], decks: parsed.decks ?? [] }
  } catch {
    return EMPTY
  }
}

export function writeBuilds(file: BuildsFile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(file))
  } catch {
    // Nothing to persist to — it still works for this session.
  }
}

export function saveBuild(build: SavedBuild, current: BuildsFile): BuildsFile {
  const now = new Date().toISOString()
  const exists = current.builds.some((b) => b.id === build.id)
  const builds = exists
    ? current.builds.map((b) => (b.id === build.id ? { ...build, updatedAt: now } : b))
    : [...current.builds, { ...build, updatedAt: now }]
  const next = { ...current, builds }
  writeBuilds(next)
  return next
}

export function newBuild(): SavedBuild {
  const now = new Date().toISOString()
  return { id: newId(), createdAt: now, updatedAt: now }
}

/** Deletes a build, and drops it from any deck that ran it. */
export function deleteBuild(id: string, current: BuildsFile): BuildsFile {
  const next: BuildsFile = {
    builds: current.builds.filter((b) => b.id !== id),
    decks: current.decks.map((d) =>
      d.buildIds.includes(id) ? { ...d, buildIds: d.buildIds.filter((b) => b !== id) } : d,
    ),
  }
  writeBuilds(next)
  return next
}

export function saveDeck(deck: Deck, current: BuildsFile): BuildsFile {
  const now = new Date().toISOString()
  const exists = current.decks.some((d) => d.id === deck.id)
  const decks = exists
    ? current.decks.map((d) => (d.id === deck.id ? { ...deck, updatedAt: now } : d))
    : [...current.decks, { ...deck, updatedAt: now }]
  const next = { ...current, decks }
  writeBuilds(next)
  return next
}

export function newDeck(name: string): Deck {
  const now = new Date().toISOString()
  return { id: newId(), name, buildIds: [], createdAt: now, updatedAt: now }
}

export function deleteDeck(id: string, current: BuildsFile): BuildsFile {
  const next = { ...current, decks: current.decks.filter((d) => d.id !== id) }
  writeBuilds(next)
  return next
}

export type DuplicatePart = { cat: PartCategory; code: string; count: number }

/**
 * Parts named by more than one bey in a deck. One physical part can only be
 * in one bey at a time, so a repeat means either a double you own or a
 * mistake — which of the two only the owner knows, hence a warning rather
 * than a rule.
 */
export function duplicateParts(builds: SavedBuild[]): DuplicatePart[] {
  const seen = new Map<string, DuplicatePart>()
  for (const build of builds) {
    for (const [slot, cat] of BUILD_SLOTS) {
      const code = build[slot]
      if (!code) continue
      const key = `${cat}|${normalize(code)}`
      const hit = seen.get(key)
      if (hit) hit.count += 1
      else seen.set(key, { cat, code, count: 1 })
    }
  }
  return [...seen.values()].filter((d) => d.count > 1)
}

/** A build with nothing chosen yet has nothing to show or warn about. */
export const isEmptyBuild = (build: SavedBuild) => BUILD_SLOTS.every(([slot]) => !build[slot])
