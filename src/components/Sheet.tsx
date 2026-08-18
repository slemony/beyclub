import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  /** Names the dialog for screen readers. */
  label: string
  onClose: () => void
  /** Renders a back link above the content when there is somewhere to go back to. */
  back?: { label: string; onBack: () => void }
  children: ReactNode
}

/**
 * The iOS-style sheet every modal on the page shares: backdrop, grip, escape
 * key and a close button.
 *
 * It only mounts while open, so the escape listener and the scroll lock can
 * live in one effect with no open/closed branch to keep in sync.
 */
export default function Sheet({ label, onClose, back, children }: Props) {
  const backdrop = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // iOS doesn't shrink the layout viewport for the keyboard, so a backdrop
  // pinned to it keeps its full-screen height and the sheet's bottom half —
  // the field you just tapped included — ends up behind the keys. Tracking the
  // *visual* viewport instead keeps the panel sitting on top of the keyboard,
  // and keeps it still while the keyboard animates in and out.
  useEffect(() => {
    const vv = window.visualViewport
    const el = backdrop.current
    if (!vv || !el) return
    const sync = () => {
      el.style.height = `${vv.height}px`
      el.style.top = `${vv.offsetTop}px`
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [])

  return (
    <div className="sheet-backdrop" ref={backdrop} onClick={onClose} role="presentation">
      <div
        className="glass sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div className="sheet-grip" />

        {back && (
          <button className="sheet-back" onClick={back.onBack}>
            ‹ {back.label}
          </button>
        )}

        {children}

        <button className="sheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
