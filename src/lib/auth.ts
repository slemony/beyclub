import { useSyncExternalStore } from 'react'
import { firebaseEnabled, loadFirebase } from './firebase'
import type { User } from 'firebase/auth'

/**
 * Who's signed in, kept as a module-level store rather than a Context — the
 * rest of the app has no Context provider, and this needs the same "one
 * value, several readers" shape as watchlist.ts/stock.ts, just reactive
 * across components. useSyncExternalStore gives that without introducing one.
 */
let current: User | null = null
const listeners = new Set<() => void>()
let listening = false

function ensureListening(): void {
  if (listening || !firebaseEnabled) return
  listening = true
  loadFirebase().then(({ auth, authMod }) => {
    authMod.onAuthStateChanged(auth, (user) => {
      current = user
      listeners.forEach((l) => l())
    })
  })
}

function subscribe(callback: () => void): () => void {
  ensureListening()
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function getSnapshot(): User | null {
  return current
}

export function useAuthUser(): User | null {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export async function signInWithGoogle(): Promise<void> {
  if (!firebaseEnabled) return
  const { auth, authMod } = await loadFirebase()
  await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider())
}

export async function signOutUser(): Promise<void> {
  if (!firebaseEnabled) return
  const { auth, authMod } = await loadFirebase()
  await authMod.signOut(auth)
}
