type Props = { title: string; sub: string }

export default function PageHeader({ title, sub }: Props) {
  return (
    <div className="fade-up">
      <h1 className="page-title">{title}</h1>
      <p className="page-sub">{sub}</p>
    </div>
  )
}
