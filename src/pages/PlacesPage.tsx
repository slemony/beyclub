import ComingSoon from '../components/ComingSoon'
import PageHeader from '../components/PageHeader'

export default function PlacesPage() {
  return (
    <>
      <PageHeader title="Buy & Play" sub="Shops at official price, stadiums to battle" />
      <ComingSoon
        stage={5}
        title="Where to buy and where to play"
        summary="A directory of shops that sell at official Malaysian retail price, and the hobby shops with stadiums where players actually gather."
        bullets={[
          'Only official-price sellers — scalper markups excluded by policy',
          'Filter for buying, for playing, or both',
          'Hobby shops with stadiums and regular meetups',
          'Sorted by distance from you, with map directions',
          'Every listing shows when it was last verified',
        ]}
      />
    </>
  )
}
