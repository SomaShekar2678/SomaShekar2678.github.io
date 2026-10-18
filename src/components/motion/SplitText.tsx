import { createElement, type CSSProperties, type ElementType } from 'react'

interface Props {
  text: string
  as?: ElementType
  className?: string
  /** Extra delay before the stagger starts, in ms. */
  delay?: number
  id?: string
  tabIndex?: number
}

/**
 * Word-by-word masked reveal. Screen readers get the plain sentence; the split spans are aria-hidden.
 * Animation is pure CSS (see global.css), triggered when the reveal controller adds `.is-in`.
 */
export function SplitText({ text, as = 'span', className, delay = 0, id, tabIndex }: Props) {
  const words = text.split(/\s+/).filter(Boolean)
  return createElement(
    as,
    {
      id,
      tabIndex,
      className: ['split', className].filter(Boolean).join(' '),
      'data-split-ready': '',
      style: { '--reveal-delay': `${delay}ms` } as CSSProperties,
    },
    <span className="sr-only">{text}</span>,
    <span aria-hidden="true">
      {words.map((w, i) => (
        <span key={i} className="split-line" style={{ display: 'inline-block' }}>
          <span className="split-word" style={{ '--i': i } as CSSProperties}>
            {w}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>,
  )
}
