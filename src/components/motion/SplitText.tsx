import { createElement, Fragment, type CSSProperties, type ElementType } from 'react'
import { plainText } from '../../lib/text'

interface Props {
  /**
   * The sentence. Two lightweight markers control typography:
   *   `*words*` — set in the italic serif accent;
   *   ` / `     — a deliberate line break (for controlled headline rag).
   */
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
/** Parses the markers into lines of words, each knowing its stagger index and whether it is accented. */
function parse(text: string) {
  let i = 0
  let serif = false
  return text.split(/\s+\/\s+/).map((line) =>
    line
      .split(/\s+/)
      .filter(Boolean)
      .map((raw) => {
        if (raw.startsWith('*')) serif = true
        const word = { text: raw.replace(/\*/g, ''), serif, i: i++ }
        if (raw.endsWith('*') && raw.length > 1) serif = false
        return word
      }),
  )
}

export function SplitText({ text, as = 'span', className, delay = 0, id, tabIndex }: Props) {
  const lines = parse(text)
  const rendered = lines.map((words, li) => (
    <Fragment key={li}>
      {words.map((w, wi) => (
        // The space sits outside the inline-block: trailing spaces inside one are collapsed away.
        <Fragment key={wi}>
          <span className="split-line" style={{ display: 'inline-block' }}>
            <span className={w.serif ? 'split-word serif' : 'split-word'} style={{ '--i': w.i } as CSSProperties}>
              {w.text}
            </span>
          </span>
          {wi < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
      {li < lines.length - 1 ? <br /> : null}
    </Fragment>
  ))
  return createElement(
    as,
    {
      id,
      tabIndex,
      className: ['split', className].filter(Boolean).join(' '),
      'data-split-ready': '',
      style: { '--reveal-delay': `${delay}ms` } as CSSProperties,
    },
    <span className="sr-only">{plainText(text)}</span>,
    <span aria-hidden="true">{rendered}</span>,
  )
}
