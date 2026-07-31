import ComingSoon from '../components/ComingSoon'
import PageHeader from '../components/PageHeader'

export default function EventsPage() {
  return (
    <>
      <PageHeader title="Competitions" sub="Tournaments across Malaysia" />
      <ComingSoon
        stage={4}
        title="Calendar of Malaysian competitions"
        summary="Every upcoming tournament in one calendar, with the details you need to show up and the option to sort by what's closest to you."
        bullets={[
          'Month calendar with event markers, tap a day for details',
          'List view of everything upcoming, sorted by date',
          'Sort by distance from your current location',
          'Venue, entry fee, format, organizer and registration link',
          'Directions in Google Maps for every venue',
        ]}
      />
    </>
  )
}
