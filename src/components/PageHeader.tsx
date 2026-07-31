import type { ReactNode } from 'react'

type Props = { title: string; sub: string; action?: ReactNode }

export default function PageHeader({ title, sub, action }: Props) {
  return (
    <div className="fade-up page-header">
      {/* The action sits on the title's line rather than below the subtitle, so
          the page opens on its content instead of on a row of controls. */}
      <div className="page-title-row">
        <h1 className="page-title">{title}</h1>
        {action}
      </div>
      <p className="page-sub">{sub}</p>
    </div>
  )
}
