import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { ChevronIcon, CommunityIcon, PlacesIcon } from '../components/icons'

const ROWS = [
  {
    to: '/more/places',
    title: 'Where to Buy & Play',
    desc: 'Official-price shops and stadiums near you',
    Icon: PlacesIcon,
  },
  {
    to: '/more/community',
    title: 'Community',
    desc: 'Trade, techniques and practice meetups',
    Icon: CommunityIcon,
  },
]

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" sub="Places, community and app info" />
      <div className="row-list fade-up">
        {ROWS.map(({ to, title, desc, Icon }) => (
          <Link key={to} to={to} className="glass glass-lit row">
            <span className="row-icon">
              <Icon />
            </span>
            <span>
              <p className="row-title">{title}</p>
              <p className="row-desc">{desc}</p>
            </span>
            <ChevronIcon className="row-chev" />
          </Link>
        ))}
      </div>
    </>
  )
}
