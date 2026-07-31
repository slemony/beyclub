import ComingSoon from '../components/ComingSoon'
import PageHeader from '../components/PageHeader'

export default function NewsPage() {
  return (
    <>
      <PageHeader title="News" sub="Official announcements & community posts" />
      <ComingSoon
        stage={3}
        title="Facebook announcements in one feed"
        summary="Official Beyblade page announcements alongside the Malaysian community pages you choose to follow."
        bullets={[
          'Official Beyblade and Takara Tomy announcements',
          'Pick which local community pages appear in your feed',
          'Refresh to pull the latest posts',
          'Your page selection is remembered on this device',
        ]}
      />
    </>
  )
}
