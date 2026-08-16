import { useEffect, type ReactNode } from 'react'

type Props = {
  label: string
  onClose: () => void
  children: ReactNode
}

/**
 * A centred dialog, as against Sheet's slide-up panel.
 *
 * Sheets are for browsing — they hand you a surface to read and poke at.
 * This is for the other kind of moment: a question that has to be answered
 * before anything else happens. It sits above an open sheet rather than
 * inside it, so confirming a delete doesn't reflow the panel underneath.
 */
export default function Modal({ label, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="glass modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  )
}
