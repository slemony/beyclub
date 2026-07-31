export default function TopBar() {
  return (
    <header className="topbar">
      <svg className="topbar-mark" viewBox="0 0 128 128" aria-hidden="true">
        <defs>
          <linearGradient id="beymark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4da3ff" />
            <stop offset="1" stopColor="#8be8ff" />
          </linearGradient>
        </defs>
        <path d="M30 30 L58 30 L98 98 L70 98 Z" fill="url(#beymark)" />
        <path d="M98 30 L70 30 L30 98 L58 98 Z" fill="#eaf1fb" opacity="0.34" />
        <circle cx="64" cy="64" r="9" fill="#0a0c11" stroke="#eaf1fb" strokeWidth="3" />
      </svg>
      <span className="topbar-name">BEYCLUB</span>
      <span className="topbar-tag">Malaysia</span>
    </header>
  )
}
