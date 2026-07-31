import ComingSoon from '../components/ComingSoon'
import PageHeader from '../components/PageHeader'

export default function StockPage() {
  return (
    <>
      <PageHeader title="Stock" sub="What's available at Malaysian official prices" />
      <ComingSoon
        stage={2}
        title="Kelab Gasing Beyblade stock tracker"
        summary="A scheduled job checks KGB twice a day and publishes what's in stock, so the list is current without anyone updating it by hand."
        bullets={[
          'Live availability and RM prices, refreshed automatically',
          'Filter by Bey, Stadium, Launcher, Case or Collab set',
          'Each bey flagged against its competitive tier',
          'Tap through to the product page to buy',
        ]}
      />
    </>
  )
}
