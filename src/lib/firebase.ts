import type { FirebaseApp } from 'firebase/app'
import type * as AuthModule from 'firebase/auth'
import type * as FirestoreModule from 'firebase/firestore'

/**
 * Cross-device sync for the collection tracker, on top of an app that
 * otherwise has no backend. Unset in dev and until the user supplies their
 * own Firebase project's config — see .env.local.example. Every consumer
 * must check `firebaseEnabled` before calling `loadFirebase()`.
 *
 * The SDK itself is loaded lazily (see below), not imported at the top of
 * this file, so an app with Firebase never configured — the common case,
 * since it needs the user's own project — pays nothing for it: no import
 * here is a runtime import, only `import type`, which tsc/Vite erase
 * entirely. Without this the mobile-first bundle would carry the whole
 * firebase/auth + firebase/firestore graph on every page load, used or not.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)

type Loaded = {
  app: FirebaseApp
  auth: AuthModule.Auth
  db: FirestoreModule.Firestore
  authMod: typeof AuthModule
  firestoreMod: typeof FirestoreModule
}

let cached: Promise<Loaded> | null = null

/** Fetches and initialises the SDK once, memoised for every caller after. */
export function loadFirebase(): Promise<Loaded> {
  if (!firebaseEnabled) return Promise.reject(new Error('Firebase is not configured'))
  if (!cached) {
    cached = Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]).then(
      ([appMod, authMod, firestoreMod]) => {
        const app = appMod.initializeApp(config)
        return { app, auth: authMod.getAuth(app), db: firestoreMod.getFirestore(app), authMod, firestoreMod }
      },
    )
  }
  return cached
}
