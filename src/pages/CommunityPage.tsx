import ComingSoon from '../components/ComingSoon'
import PageHeader from '../components/PageHeader'

export default function CommunityPage() {
  return (
    <>
      <PageHeader title="Community" sub="Trade, learn and practice together" />
      <ComingSoon
        stage={6}
        title="A board for the Malaysian scene"
        summary="Post what you're selling, share a combo that works, or find people to practice with — reading is open to everyone, posting takes a sign-in."
        bullets={[
          'Buy, sell and trade listings',
          'Techniques and combo discussion',
          'Practice meetups and casual battles',
          'Read without an account, post with a GitHub sign-in',
        ]}
      />
    </>
  )
}
