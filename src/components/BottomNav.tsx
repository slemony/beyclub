import { NavLink } from 'react-router-dom'
import { StockIcon, TierIcon } from './icons'

const TABS = [
  { to: '/tiers', label: 'Tiers', Icon: TierIcon },
  { to: '/stock', label: 'Stock', Icon: StockIcon },
]

export default function BottomNav() {
  return (
    <nav className="nav" aria-label="Main">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
        >
          <span className="nav-icon-wrap">
            <Icon />
          </span>
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
