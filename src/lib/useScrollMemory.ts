import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * How long to keep waiting for a page's content before giving up on the
 * restore. Both tabs refetch on every visit, so there is always a moment where
 * the page is too short to hold the position we are aiming for.
 */
const RESTORE_TIMEOUT_MS = 2000

/**
 * Returns each tab to where the reader left it.
 *
 * Switching tabs unmounts the page and refetches its data, so the scroll
 * position cannot simply be reapplied on mount — for a frame or two the
 * document is barely taller than the viewport and the browser clamps any
 * `scrollTo` to near zero. So the target is held until the page has actually
 * grown tall enough to hold it.
 *
 * Reopening the tab you are already on is not a return visit: it hands back a
 * clean list from the top, matching the way TierPage clears its search on the
 * same signal.
 */
export function useScrollMemory() {
  const { pathname, key } = useLocation()
  const positions = useRef(new Map<string, number>())
  const lastPath = useRef(pathname)

  // Own scroll position across history navigation, so the browser's own
  // restoration doesn't race the one below.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  // Recorded as the reader scrolls rather than on the way out: by the time a
  // navigation commits, the outgoing page is gone and the browser has already
  // clamped the position to whatever the new, shorter document allows.
  useEffect(() => {
    const save = () => positions.current.set(pathname, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [pathname])

  useLayoutEffect(() => {
    const reopened = lastPath.current === pathname
    lastPath.current = pathname

    // Read before the listener above can overwrite it: reflow on the incoming
    // page fires scroll events that are already attributed to this pathname.
    const target = reopened ? 0 : (positions.current.get(pathname) ?? 0)
    if (reopened) positions.current.delete(pathname)

    if (target <= 0) {
      window.scrollTo(0, 0)
      return
    }

    let settled = false
    let observer: ResizeObserver | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = () => {
      if (settled) return
      settled = true
      observer?.disconnect()
      if (timer !== undefined) clearTimeout(timer)
      window.removeEventListener('wheel', finish)
      window.removeEventListener('touchstart', finish)
    }

    const attempt = () => {
      if (settled) return
      if (document.documentElement.scrollHeight - window.innerHeight >= target) {
        window.scrollTo(0, target)
        finish()
      }
    }

    observer = new ResizeObserver(attempt)
    observer.observe(document.body)
    timer = setTimeout(finish, RESTORE_TIMEOUT_MS)

    // A reader who starts scrolling has picked their own position; jumping
    // them somewhere else a second later would read as the page glitching.
    window.addEventListener('wheel', finish, { passive: true })
    window.addEventListener('touchstart', finish, { passive: true })

    attempt()
    return finish
  }, [key, pathname])
}
