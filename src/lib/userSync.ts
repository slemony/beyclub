import { useSyncExternalStore } from 'react'
import { readBuilds, writeBuilds, type BuildsFile } from './builds'
import { entryKey, readCollection, writeCollection } from './collection'
import { firebaseEnabled, loadFirebase } from './firebase'
import type { CollectionEntry, CollectionSource, Deck, SavedBuild } from './types'
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

/**
 * Ids of records this device was offered at sign-in and chose not to take.
 * Local-only and never uploaded: the account keeps them for the devices that
 * do want them, and this one simply stops being handed them.
 */
const DECLINED_KEY = 'beyclub:declined:v1'

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

function readDeclined(): Set<string> {
  try {
    const raw = localStorage.getItem(DECLINED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function writeDeclined(ids: Set<string>): void {
  try {
    localStorage.setItem(DECLINED_KEY, JSON.stringify([...ids]))
  } catch {
    // Nothing to persist to. The worst case is being offered the same
    // records again on the next sign-in.
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

/* ── What a sign-in offers to bring down ───────────────────────── */

/**
 * Records the account has that this device doesn't — offered rather than
 * applied. Signing in on a shared or borrowed phone can otherwise drop a
 * hundred parts into someone else's collection, and even on your own second
 * device the answer isn't always "all of it": a deck built for one
 * tournament is not something you want on every phone you own.
 *
 * Nothing here is a threat to the account. Whichever way the boxes are
 * ticked, this device's own records have already gone up, and everything
 * left unticked stays in the account for the devices that do want it.
 */
export type Offer = { entries: CollectionEntry[]; builds: SavedBuild[]; decks: Deck[] }

type Pending = { offer: Offer; decide: (chosen: Set<string>) => void }

let pending: Pending | null = null
const pendingListeners = new Set<() => void>()

function setPending(next: Pending | null): void {
  pending = next
  pendingListeners.forEach((l) => l())
}

/** The sign-in offer waiting on an answer, or null when there's nothing to decide. */
export function useOffer(): Offer | null {
  return useSyncExternalStore(
    (cb) => {
      pendingListeners.add(cb)
      return () => pendingListeners.delete(cb)
    },
    () => pending?.offer ?? null,
  )
}

/** Answers the offer: the ids given are pulled down, the rest are left in the account. */
export function resolveOffer(chosenIds: string[]): void {
  const waiting = pending
  if (!waiting) return
  setPending(null)
  waiting.decide(new Set(chosenIds))
}

export const offerIds = (offer: Offer): string[] => [...offer.entries, ...offer.builds, ...offer.decks].map((r) => r.id)

const isEmptyOffer = (o: Offer) => !o.entries.length && !o.builds.length && !o.decks.length

/**
 * What the account is carrying that this device is not — the entries by part
 * rather than by row id, since the same part added on two devices is one
 * part, not an arrival.
 */
function offerFrom(local: UserData, cloud: UserData, tombstones: Record<string, string>): Offer {
  const declined = readDeclined()
  const localKeys = new Set(local.entries.map(entryKey))
  const localIds = new Set([...local.builds, ...local.decks].map((r) => r.id))
  const wanted = <T extends { id: string; updatedAt: string }>(record: T) => {
    if (declined.has(record.id)) return false
    const deletedAt = tombstones[record.id]
    return !deletedAt || record.updatedAt > deletedAt
  }
  return {
    entries: cloud.entries.filter((e) => !localKeys.has(entryKey(e)) && wanted(e)),
    builds: cloud.builds.filter((b) => !localIds.has(b.id) && wanted(b)),
    decks: cloud.decks.filter((d) => !localIds.has(d.id) && wanted(d)),
  }
}

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

/**
 * Which row id two copies of the same part settle on.
 *
 * They have to settle on one, and every device has to reach the same answer
 * independently: a delete records a tombstone against an id, so two devices
 * holding one part under two ids means deleting it on either leaves it alive
 * on the other. Oldest wins, with the id itself as the tie-break, so the
 * answer doesn't depend on which side of the merge a copy arrived from.
 */
function settledId(a: CollectionEntry, b: CollectionEntry): string {
  if (a.addedAt !== b.addedAt) return a.addedAt < b.addedAt ? a.id : b.id
  return a.id < b.id ? a.id : b.id
}

/**
 * Two copies of one part, folded into one row.
 *
 * The acquisitions are unioned rather than replaced: buying a 3-60 on the
 * phone and another on the laptop leaves you owning two, and taking the
 * newer row wholesale would quietly throw one away. A source edited on both
 * devices is last-write-wins like everything else, by its row's `updatedAt`.
 */
function foldEntry(a: CollectionEntry, b: CollectionEntry): CollectionEntry {
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a]
  const sources = new Map<string, CollectionSource>()
  for (const source of older.sources) sources.set(source.id, source)
  for (const source of newer.sources) sources.set(source.id, source)
  return {
    ...newer,
    id: settledId(a, b),
    addedAt: a.addedAt < b.addedAt ? a.addedAt : b.addedAt,
    sources: [...sources.values()],
  }
}

/**
 * Union by *part*, not by row id.
 *
 * collection.ts has always keyed a part on its category and code — adding a
 * part you already own folds onto the row you have. Merging by row id broke
 * that across devices: two people-hours of adding the same booster on a phone
 * and a laptop produced two identical cards for one part, each with its own
 * count, and no way to tell them apart or put them back together.
 */
function mergeEntries(a: CollectionEntry[], b: CollectionEntry[]): CollectionEntry[] {
  const byPart = new Map<string, CollectionEntry>()
  for (const entry of [...a, ...b]) {
    const key = entryKey(entry)
    const existing = byPart.get(key)
    byPart.set(key, existing ? foldEntry(existing, entry) : entry)
  }
  return [...byPart.values()]
}

/**
 * Drops acquisitions deleted elsewhere, and any row left with none.
 *
 * Needed only because the sources above are unioned: without it, removing
 * "came from CX-13" on one device would have the other device's copy hand it
 * straight back on the next sync. Same rule as records — a source added after
 * it was deleted is a re-add and stays.
 */
function withoutDeletedSources(entries: CollectionEntry[], tombstones: Record<string, string>): CollectionEntry[] {
  return entries
    .map((entry) => {
      const sources = entry.sources.filter((s) => {
        const deletedAt = tombstones[s.id]
        return !deletedAt || s.addedAt > deletedAt
      })
      return sources.length === entry.sources.length ? entry : { ...entry, sources }
    })
    .filter((entry) => entry.sources.length > 0)
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
    entries: withoutDeletedSources(withoutDeleted(mergeEntries(a.entries, b.entries), tombstones), tombstones),
    builds: withoutDeleted(mergeById(a.builds, b.builds), tombstones),
    decks: withoutDeleted(mergeById(a.decks, b.decks), tombstones),
    tombstones,
  }
}

const EMPTY_HELD: UserData = { entries: [], builds: [], decks: [], tombstones: {} }

/**
 * Records the account has that this device is not carrying — declined at
 * sign-in, or still waiting on an answer. Kept out of `localStorage` and
 * written back on every push, so this device stays a safe place to edit from
 * without being a complete copy of the account.
 */
let held: UserData = EMPTY_HELD

/** The document to write: everything on this device, plus whatever it's holding for the account. */
const forCloud = (data: UserData): UserData =>
  held.entries.length || held.builds.length || held.decks.length ? merge(data, held) : data

/**
 * Splits an account's copy into what this device carries and what it merely
 * holds for the account — the records declined at sign-in.
 *
 * The held half never reaches `localStorage`, but every push carries it back
 * up. Without that, one edit on this device would write a document missing
 * everything it declined, and declining something here would silently delete
 * it from every other device the account has.
 */
function split(local: UserData, cloud: UserData): { carried: UserData; held: UserData } {
  const declined = readDeclined()
  if (!declined.size) return { carried: cloud, held: EMPTY_HELD }

  // Declining a part and later adding it here yourself makes it yours: the
  // account's copy of it is carried like any other, not held back.
  const localKeys = new Set(local.entries.map(entryKey))
  const localIds = new Set([...local.builds, ...local.decks].map((r) => r.id))
  const heldEntries = cloud.entries.filter((e) => declined.has(e.id) && !localKeys.has(entryKey(e)))
  const heldBuilds = cloud.builds.filter((b) => declined.has(b.id) && !localIds.has(b.id))
  const heldDecks = cloud.decks.filter((d) => declined.has(d.id) && !localIds.has(d.id))
  const heldIds = new Set([...heldEntries, ...heldBuilds, ...heldDecks].map((r) => r.id))

  return {
    carried: {
      entries: cloud.entries.filter((e) => !heldIds.has(e.id)),
      builds: cloud.builds.filter((b) => !heldIds.has(b.id)),
      decks: cloud.decks.filter((d) => !heldIds.has(d.id)),
      tombstones: cloud.tombstones,
    },
    held: { entries: heldEntries, builds: heldBuilds, decks: heldDecks, tombstones: {} },
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
  await firestoreMod.setDoc(ref, { ...forCloud(data), updatedAt: new Date().toISOString() })
}

/**
 * Reconciles this device with the account, then streams later changes from
 * other devices into the shared snapshot.
 *
 * The two directions are deliberately not symmetric. **Up is unconditional**:
 * whatever this device is carrying is merged into the account immediately, so
 * a collection built before signing in — or on a phone that has never seen
 * the account — is never lost by signing in. **Down is a choice**: anything
 * the account has that this device doesn't is offered first (see `Offer`),
 * because that's the direction that changes what's on the screen in front of
 * someone.
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

  const local = readLocal()
  const cloud = snap.exists() ? fromDoc(snap.data()) : fromDoc(undefined)

  // Up first, and in full: the account ends up with everything either side
  // had, whatever gets ticked below. Nothing the user does at the prompt can
  // cost them data on another device.
  held = EMPTY_HELD
  await push(user.uid, merge(local, cloud))
  if (currentUid !== user.uid) return

  /** Applies the answer — the ticked records come down, the rest are remembered. */
  const settle = (chosen: Set<string>, offered: Offer) => {
    if (currentUid !== user.uid) return
    const declined = readDeclined()
    for (const id of offerIds(offered)) if (!chosen.has(id)) declined.add(id)
    writeDeclined(declined)

    const { carried, held: keptBack } = split(local, cloud)
    held = keptBack
    const next = merge(local, carried)
    writeLocal(next)
    publish(next)

    unsubscribe = onSnapshot(ref, (s) => {
      if (currentUid !== user.uid || !s.exists()) return
      const here = readLocal()
      const parts = split(here, fromDoc(s.data()))
      held = parts.held
      const merged = merge(here, parts.carried)
      writeLocal(merged)
      publish(merged)
    })
  }

  const offer = offerFrom(local, cloud, mergeTombstones(local.tombstones, cloud.tombstones))
  if (isEmptyOffer(offer)) {
    settle(new Set(), offer)
    return
  }

  // Held while the question is on screen, so a push that happens before it is
  // answered still writes a complete document rather than one missing
  // everything this device hasn't taken yet.
  held = { ...offer, tombstones: {} }
  setPending({ offer, decide: (chosen) => settle(chosen, offer) })
}

/**
 * Detaches the listener, flushing any queued write first — a change made a
 * moment before signing out or closing the tab is still a change, and
 * dropping it would leave the cloud copy quietly behind the local one.
 */
export async function stopSync(): Promise<void> {
  const uid = currentUid
  const queued = debounceTimer !== null

  currentUid = null
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  // An offer belongs to the session that made it; signing out withdraws it
  // rather than leaving a dialog on screen with nothing behind it.
  setPending(null)

  if (queued && uid) {
    try {
      await push(uid, readLocal())
    } catch {
      // Offline or signed out mid-flight. The local copy is intact and the
      // next sign-in merges it up, so there is nothing to recover here.
    }
  }
  held = EMPTY_HELD
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
