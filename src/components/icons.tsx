/** Inline stroke icons — keeps the bundle free of an icon dependency. */

type Props = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function TierIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}

export function StockIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M3 7h18l-1.4 12.1a2 2 0 0 1-2 1.9H6.4a2 2 0 0 1-2-1.9L3 7Z" />
      <path d="M8.5 7V5.5a3.5 3.5 0 0 1 7 0V7" />
    </svg>
  )
}

export function EventsIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

export function NewsIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5h13a2 2 0 0 1 2 2v11a2 2 0 0 0 2 2H5a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" />
      <path d="M8 9h7M8 13h7M8 17h4" />
    </svg>
  )
}

export function MoreIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </svg>
  )
}

export function PlacesIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  )
}

export function CommunityIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.6 20a6.6 6.6 0 0 1 12.8 0" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.9M17.6 14.4A6.6 6.6 0 0 1 21.4 20" />
    </svg>
  )
}

export function CollectionIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="2.5" y="7.5" width="19" height="12" rx="2.5" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M2.5 13h19M10 11.5v3M14 11.5v3" />
    </svg>
  )
}

export function BuildsIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M14.4 6.2a4 4 0 0 1 5.5-1.1l-3 3 2 2 3-3a4 4 0 0 1-5.1 5.4" />
      <path d="m13.9 12.2-8 8a2.1 2.1 0 0 1-3-3l8-8" />
      <path d="m10.6 5.6 2.6-2.6 4.2 4.2-2.6 2.6" />
    </svg>
  )
}

export function ChevronIcon({ className }: Props) {
  return (
    <svg {...base} className={className} width="18" height="18">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
