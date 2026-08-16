import { signInWithGoogle, signOutUser, useAuthUser } from '../lib/auth'
import { firebaseEnabled } from '../lib/firebase'
import { readPref, SYNC_NOTICE_DISMISSED, writePref } from '../lib/prefs'
import { useState } from 'react'

/**
 * Signing in is never required — the collection and builds are local-first
 * and work with no account at all. It only buys you the same data on another
 * device, so it is offered, never demanded, and nothing is gated behind it.
 */
export function SyncButton() {
  const user = useAuthUser()

  if (!firebaseEnabled) return null

  if (user) {
    return (
      <button className="info-toggle" onClick={() => void signOutUser()} title={user.email ?? undefined}>
        {user.photoURL && <img className="signin-avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
        Sign out
      </button>
    )
  }

  return (
    <button className="info-toggle" onClick={() => void signInWithGoogle()}>
      Sign in to sync
    </button>
  )
}

/**
 * The heads-up that this is all living in one browser. Dismissible, because
 * someone who has decided to stay signed out should not be nagged on every
 * visit, and it never returns once signed in.
 */
export function SyncNotice() {
  const user = useAuthUser()
  const [dismissed, setDismissed] = useState(() => readPref(SYNC_NOTICE_DISMISSED, false))

  // Nothing to configure against, so there is nothing honest to offer. Say so
  // in dev only: a reader of the published site can do nothing about it, but
  // whoever is running the app locally is exactly who needs to know why no
  // sign-in button appears.
  if (!firebaseEnabled) {
    if (!import.meta.env.DEV) return null
    return (
      <p className="notice notice-stale sync-notice">
        <strong>Sync isn't configured.</strong> Sign-in is hidden because this build has no Firebase config — set the
        four <code>VITE_FIREBASE_*</code> values in <code>.env.local</code> and restart the dev server. See{' '}
        <code>docs/firebase-setup.md</code>. Everything below still works, saved in this browser.
      </p>
    )
  }

  if (user || dismissed) return null

  return (
    <p className="notice notice-live sync-notice">
      <strong>Saved in this browser only.</strong> Sign in to keep your parts, builds and decks on every device you use
      — nothing here needs an account, it just won't follow you.
      <button
        className="sync-notice-dismiss"
        onClick={() => {
          setDismissed(true)
          writePref(SYNC_NOTICE_DISMISSED, true)
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </p>
  )
}
