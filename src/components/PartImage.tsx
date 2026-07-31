import { useState } from 'react'

type Props = { src?: string; alt: string; size?: number }

/**
 * Part thumbnail with a styled fallback. Source images are hosted on a free
 * image host and some entries have none, so a broken-image icon is a realistic
 * failure mode we render around rather than let through.
 */
export default function PartImage({ src, alt, size = 56 }: Props) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }

  if (!src || failed) {
    return (
      <div className="part-img part-img-empty" style={style} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 3 5 7v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V7l-7-4Z" />
        </svg>
      </div>
    )
  }

  return (
    <img
      className="part-img"
      style={style}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
