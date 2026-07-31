type Props = {
  stage: number
  title: string
  summary: string
  bullets: string[]
}

/** Placeholder shown for sections whose stage hasn't been built yet. */
export default function ComingSoon({ stage, title, summary, bullets }: Props) {
  return (
    <div className="glass glass-lit stub fade-up">
      <span className="stub-badge">STAGE {stage}</span>
      <h2>{title}</h2>
      <p>{summary}</p>
      <ul>
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  )
}
