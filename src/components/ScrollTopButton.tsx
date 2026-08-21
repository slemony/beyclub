import { useEffect, useState } from 'react'

/**
 * How far down the page has to be before the button is worth offering. Roughly
 * a screen and a half: any less and it appears while the reader can still see
 * where they started, which reads as clutter rather than help.
 */
const SHOW_AFTER_PX = 900

/**
 * Back to the top of the list.
 *
 * Every page here is a long scroll — a tier table runs to hundreds of rows and
 * the filters that reorder it live at the top, so the way back matters as much
 * as the way down. Sits above the tab bar rather than beside it: the bar is
 * centred and its width follows the number of tabs, so anything level with it
 * would collide on one screen size and look stranded on another.
 *
 * Below the detail sheet in the stack on purpose — the sheet scrolls its own
 * contents, and a page-level control floating over it would move the wrong
 * thing.
 */
/**
 * Up, gliding if the browser and the reader both want it to.
 *
 * The fallback is not paranoia: `behavior: 'smooth'` is accepted and then
 * ignored by more than one engine, and a button that silently does nothing is
 * worse than one that jumps. So if the page has not begun to move a beat
 * later, take it there outright.
 */
function toTop(): void {
  const from = window.scrollY
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Someone who asked for less motion is asking for it here too — a smooth
  // glide past a thousand rows is the worst offender on the page.
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  if (reduced) return
  window.setTimeout(() => {
    if (window.scrollY > 0 && window.scrollY === from) window.scrollTo(0, 0)
  }, 250)
}

export default function ScrollTopButton() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > SHOW_AFTER_PX)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!show) return null

  return (
    <button
      className="scroll-top"
      aria-label="Back to top"
      onClick={toTop}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19V6M12 6l-6 6M12 6l6 6" />
      </svg>
    </button>
  )
}
