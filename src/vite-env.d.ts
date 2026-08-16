/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Endpoint that dispatches the stock scrape workflow (the worker/ Worker).
   * Unset in dev and until deployed — "Check now" then just re-pulls the file.
   */
  readonly VITE_STOCK_REFRESH_URL?: string
  /**
   * Firebase web config for the collection tracker's Google sign-in and sync.
   * Unset in dev and until the user supplies their own project's config — see
   * src/lib/firebase.ts. All four must be set together for `firebaseEnabled`.
   */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}
