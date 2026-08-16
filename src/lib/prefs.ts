/**
 * Small UI choices that should survive a reload — the state of a filter you
 * set once and expect to still be set next time. Kept apart from the data
 * modules on purpose: nothing here is worth syncing to an account, since a
 * filter is about the screen you're on, not what you own.
 */
const PREFIX = 'beyclub:pref:'

export function readPref(name: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(PREFIX + name)
    return raw === null ? fallback : raw === '1'
  } catch {
    return fallback
  }
}

export function writePref(name: string, value: boolean): void {
  try {
    localStorage.setItem(PREFIX + name, value ? '1' : '0')
  } catch {
    // Private browsing or a full quota — the toggle still works this session.
  }
}

/** Show only parts the user owns, in the build editor's part picker. */
export const OWNED_ONLY = 'buildOwnedOnly'

/** The "sign in to sync" heads-up, once waved away. */
export const SYNC_NOTICE_DISMISSED = 'syncNoticeDismissed'
