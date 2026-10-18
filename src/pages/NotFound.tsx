import { useEffect, useRef } from 'react'
import styles from './NotFound.module.css'

export function NotFound() {
  const h = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    document.title = 'Signal lost — Somashekar Reddy Nakka'
    h.current?.focus()
  }, [])
  return (
    <section className={styles.wrap} aria-labelledby="nf-title">
      <p className="label">Error 404 · No lock on this route</p>
      <h1 id="nf-title" ref={h} tabIndex={-1} className="display">
        Signal lost.
      </h1>
      <p className="lead">This page does not exist. The rest of the portfolio is one step away.</p>
      <a className="btn" href="#/">
        <span className="dot" aria-hidden="true" /> Back to the portfolio
      </a>
    </section>
  )
}
