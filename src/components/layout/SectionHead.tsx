import type { ReactNode } from 'react'
import { SplitText } from '../motion/SplitText'

interface Props {
  index: string
  label: string
  title: string
  id: string
  aside?: ReactNode
}

export function SectionHead({ index, label, title, id, aside }: Props) {
  return (
    <header className="section-head">
      <p className="section-head__index label">
        <span>{index}</span>
        <span>{label}</span>
      </p>
      <SplitText as="h2" id={id} tabIndex={-1} text={title} className="section-head__title display" />
      {aside ? (
        <div className="section-head__aside lead" data-reveal>
          {aside}
        </div>
      ) : null}
    </header>
  )
}
