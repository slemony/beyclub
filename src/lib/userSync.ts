import { useSyncExternalStore } from 'react'
import { readBuilds, writeBuilds, type BuildsFile } from './builds'
import { readCollection, writeCollection } from './collection'
import { firebaseEnabled, loadFirebase } from './firebase'
import type { CollectionEntry, Deck, SavedBuild } from './types'
import type { User } from 'firebase/auth'

/**
 * Everything a signed-in user carries between devices — collection, builds
 * and decks together — in one Firestore document per user (`users/{uid}`).
 * One doc rather than a collection of them: these are small text records with
 * no images, so a whole account is one read and one write instead of a
 * listener per row.
 *
 * Local-first throughout. collection.ts and builds.ts own the `localStorage`
 * writes and this module never makes the UI wait on a network: a change is
 * saved and on screen immediately, then pushed. It only merges the two copies
 * on sign-in and keeps them in step after.
 *
 * The sync runs for the whole session, started once from App rather than by
 * whichever page happens to be open. Pages come and go — the Tiers tab has
 * nothing to do with builds — and a sync that stopped when you navigated
 * would drop pending writes and re-read the whole document on every tab
 * change.
 */
export type UserData = {
  entries: CollectionEntry[]
  builds: SavedBuild[]
  decks: Deck[]
  /**
   * When each deleted record was deleted, by id.
   *
   * Merging is a union by id, which cannot otherwise tell "deleted here" from
   * "not created here yet" — so without this, deleting a build on one device
   * and syncing would hand it straight back from the other copy. A tombstone
   * older than the record's own `updatedAt` is ignored, so re-adding
   * something you once deleted works as expected.
   */
  tombstones: Record<string, string>
}

const DEBOUNCE_MS = 800

/** Tombstones are pruned past this, so the document can't grow without bound. */
const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000

const TOMBSTONE_KEY = 'beyclub:tombstones:v1'

let unsubscribe: (() => void) | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let currentUid: string | null = null

function readTombstones(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function writeTombstones(tombstones: Record<string, string>): void {
  try {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(tombstones))
  } catch {
    // Nothing to persist to. A lost tombstone can only resurrect a deleted
    // record on the next merge, never destroy a live one.
  }
}

const readLocal = (): UserData => {
  const { builds, decks } = readBuilds()
  return { entries: readCollection(), builds, decks, tombstones: readTombstones() }
}

const writeLocal = (data: UserData): void => {
  writeCollection(data.entries)
  writeBuilds({ builds: data.builds, decks: data.decks })
  writeTombstones(data.tombstones)
}

/* ── The shared snapshot every page renders from ───────────────── */

let snapshot: UserData = readLocal()
const listeners = new Set<() => void>()

function publish(data: UserData): void {
  snapshot = data
  listeners.forEach((l) => l())
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

/**
 * The current collection, builds and decks. Shared rather than per-page so a
 * change made on one tab — or arriving from another device — is on screen
 * everywhere without a reload.
 */
export function useUserData(): UserData {
  return useSyncExternalStore(subscribe, () => snapshot)
}

/**
 * Records a local change: saves it, puts it on screen, and queues the push to
 * the cloud. The single path every mutation goes through, so nothing can be
 * saved locally but forgotten remotely.
 */
export function applyLocal(patch: Partial<UserData>): void {
  const next = { ...snapshot, ...patch }
  writeLocal(next)
  publish(next)
  scheduleSync(next)
}

/**
 * Records a deletion. Same as `applyLocal`, plus the tombstone that stops the
 * merge handing the record back from the other copy — always use this rather
 * than passing an already-shortened list to `applyLocal`.
 */
export function applyDelete(patch: Partial<UserData>, deletedIds: string[]): void {
  const at = new Date().toISOString()
  const tombstones = { ...snapshot.tombstones }
  for (const id of deletedIds) tombstones[id] = at
  applyLocal({ ...patch, tombstones })
}

/** Ids the current snapshot considers deleted — exported for tests and debugging. */
export const deletedIds = (): string[] => Object.keys(snapshot.tombstones)

/* ── What a sign-in brought down ───────────────────────────────── */

/**
 * Records that came from the account and weren't on this device. Worth
 * showing: signing in on a new phone can drop a hundred parts into what
 * looked like an empty collection, and silently changing what someone is
 * looking at is alarming rather than helpful.
 */
export type Arrival = { entries: CollectionEntry[]; builds: SavedBuild[]; decks: Deck[] }

let arrival: Arrival | null = null
const arrivalListeners = new Set<() => void>()

function setArrival(next: Arrival | null): void {
  arrival = next
  arrivalListeners.forEach((l) => l())
}

export function useArrival(): Arrival | null {
  return useSyncExternalStore(
    (cb) => {
      arrivalListeners.add(cb)
      return () => arrivalListeners.delete(cb)
    },
    () => arrival,
  )
}

export const clearArrival = (): void => setArrival(null)

/** Records present after the merge that this device didn't already have. */
function newlyArrived(before: UserData, after: UserData): Arrival {
  const added = <T extends { id: string }>(a: T[], b: T[]) => {
    const had = new Set(a.map((i) => i.id))
    return b.filter((i) => !had.has(i.id))
  }
  return {
    entries: added(before.entries, after.entries),
    builds: added(before.builds, after.builds),
    decks: added(before.decks, after.decks),
  }
}

const isEmptyArrival = (a: Arrival) => !a.entries.length && !a.builds.length && !a.decks.length

/* ── Firestore ─────────────────────────────────────────────────── */

/** Union by id, newer `updatedAt` per record wins — enough for one person on a handful of devices. */
function mergeById<T extends { id: string; updatedAt: string }>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>()
  for (const item of a) byId.set(item.id, item)
  for (const item of b) {
    const existing = byId.get(item.id)
    if (!existing || item.updatedAt > existing.updatedAt) byId.set(item.id, item)
  }
  return [...byId.values()]
}

/** Latest deletion time per id, with long-dead entries dropped. */
function mergeTombstones(a: Record<string, string>, b: Record<string, string>): Record<string, string> {
  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_MS).toISOString()
  const out: Record<string, string> = {}
  for (const [id, at] of [...Object.entries(a), ...Object.entries(b)]) {
    if (at < cutoff) continue
    if (!out[id] || at > out[id]) out[id] = at
  }
  return out
}

/** Drops records deleted after they were last edited. A later edit wins — that's a re-add. */
function withoutDeleted<T extends { id: string; updatedAt: string }>(
  items: T[],
  tombstones: Record<string, string>,
): T[] {
  return items.filter((item) => {
    const deletedAt = tombstones[item.id]
    return !deletedAt || item.updatedAt > deletedAt
  })
}

function merge(a: UserData, b: UserData): UserData {
  const tombstones = mergeTombstones(a.tombstones, b.tombstones)
  return {
    entries: withoutDeleted(mergeById(a.entries, b.entries), tombstones),
    builds: withoutDeleted(mergeById(a.builds, b.builds), tombstones),
    decks: withoutDeleted(mergeById(a.decks, b.decks), tombstones),
    tombstones,
  }
}

const fromDoc = (data: Record<string, unknown> | undefined): UserData => ({
  entries: (data?.entries as CollectionEntry[] | undefined) ?? [],
  builds: (data?.builds as SavedBuild[] | undefined) ?? [],
  decks: (data?.decks as Deck[] | undefined) ?? [],
  tombstones: (data?.tombstones as Record<string, string> | undefined) ?? {},
})

async function push(uid: string, data: UserData): Promise<void> {
  const { db, firestoreMod } = await loadFirebase()
  const ref = firestoreMod.doc(db, 'users', uid)
  await firestoreMod.setDoc(ref, { ...data, updatedAt: new Date().toISOString() })
}

/**
 * Merges the local copy with whatever's already in Firestore — a first
 * sign-in migrates local up, a returning one merges both sides — then
 * streams later changes from other devices into the shared snapshot.
 */
export async function startSync(user: User): Promise<void> {
  if (!firebaseEnabled) return
  await stopSync()
  currentUid = user.uid

  const { db, firestoreMod } = await loadFirebase()
  if (currentUid !== user.uid) return // signed out again before the SDK finished loading

  const { doc, getDoc, onSnapshot } = firestoreMod
  const ref = doc(db, 'users', user.uid)

  const snap = await getDoc(ref)
  if (currentUid !== user.uid) return

  const before = readLocal()
  const merged = merge(before, snap.exists() ? fromDoc(snap.data()) : fromDoc(undefined))
  writeLocal(merged)
  publish(merged)

  // Anything this device was carrying goes up in the same write — a
  // collection built before signing in is not lost by signing in.
  await push(user.uid, merged)
  if (currentUid !== user.uid) return

  // …and anything the account was carrying gets announced, once, rather than
  // just appearing.
  const landed = newlyArrived(before, merged)
  if (!isEmptyArrival(landed)) setArrival(landed)

  unsubscribe = onSnapshot(ref, (s) => {
    if (currentUid !== user.uid || !s.exists()) return
    const next = merge(readLocal(), fromDoc(s.data()))
    writeLocal(next)
    publish(next)
  })
}

/**
 * Detaches the listener, flushing any queued write first — a change made a
 * moment before signing out or closing the tab is still a change, and
 * dropping it would leave the cloud copy quietly behind the local one.
 */
export async function stopSync(): Promise<void> {
  const uid = currentUid
  const pending = debounceTimer !== null

  currentUid = null
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  if (pending && uid) {
    try {
      await push(uid, readLocal())
    } catch {
      // Offline or signed out mid-flight. The local copy is intact and the
      // next sign-in merges it up, so there is nothing to recover here.
    }
  }
}

/** Queues a push, debounced so rapid edits don't spam Firestore. */
export function scheduleSync(data: UserData): void {
  if (!firebaseEnabled || !currentUid) return
  const uid = currentUid
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    if (currentUid !== uid) return
    void push(uid, data).catch(() => {
      // Local storage already has it; the next write or sign-in carries it up.
    })
  }, DEBOUNCE_MS)
}

export type { BuildsFile }
