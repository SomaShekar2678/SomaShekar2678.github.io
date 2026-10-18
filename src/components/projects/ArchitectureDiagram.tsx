import type { CSSProperties } from 'react'
import { MATURITY_META } from '../../content/expertise'
import type { Architecture } from '../../types/content'
import styles from './ArchitectureDiagram.module.css'

/**
 * Signal-chain diagram rendered as an ordered list, so it reads correctly with a screen reader,
 * reflows from horizontal (desktop) to vertical (mobile) and stays legible at any width.
 */
export function ArchitectureDiagram({ architecture }: { architecture: Architecture }) {
  const groups = [...new Set(architecture.stages.map((s) => s.group ?? ''))]
  return (
    <figure className={styles.figure}>
      <ol className={styles.flow} role="list" aria-label="System architecture, in signal order">
        {architecture.stages.map((s, i) => {
          const g = groups.indexOf(s.group ?? '')
          return (
            <li key={s.id} className={styles.stage} data-state={s.state} style={{ '--g': g, '--i': i } as CSSProperties}>
              <span className={styles.group}>{s.group}</span>
              <span className={styles.box}>
                <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
                <strong className={styles.label}>{s.label}</strong>
                <span className={styles.detail}>{s.detail}</span>
                {s.state ? <span className={styles.state}>{s.state === 'planned' ? 'Planned' : MATURITY_META[s.state].label}</span> : null}
              </span>
            </li>
          )
        })}
      </ol>
      {architecture.feedback?.map((f) => {
        const from = architecture.stages.find((s) => s.id === f.from)
        const to = architecture.stages.find((s) => s.id === f.to)
        return (
          <p key={f.label} className={styles.feedback}>
            <span aria-hidden="true">↺</span> Feedback loop: {from?.label} → {to?.label} — {f.label}
          </p>
        )
      })}
      <figcaption className={styles.caption}>
        {architecture.caption}
        {architecture.note ? ` ${architecture.note}` : ''}
      </figcaption>
    </figure>
  )
}
