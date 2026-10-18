import { MATURITY_META } from '../../content/expertise'
import { STATUS_META } from '../../content/projects'
import type { Maturity, ProjectStatus } from '../../types/content'
import styles from './Badges.module.css'

export function StatusChip({ status, size = 'md' }: { status: ProjectStatus; size?: 'sm' | 'md' }) {
  const meta = STATUS_META[status]
  return (
    <span className={`${styles.status} ${size === 'sm' ? styles.sm : ''}`} data-step={meta.step} title={meta.description}>
      <span className={styles.meter} aria-hidden="true">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <i key={s} className={s <= meta.step ? styles.on : undefined} />
        ))}
      </span>
      <span>
        <span className="sr-only">Status: </span>
        {meta.label}
      </span>
    </span>
  )
}

export function MaturityTag({ maturity }: { maturity: Maturity }) {
  const meta = MATURITY_META[maturity]
  return (
    <span className={styles.maturity} data-maturity={maturity} title={meta.description}>
      <span className={styles.pips} aria-hidden="true">
        {[1, 2, 3, 4].map((r) => (
          <i key={r} className={r <= meta.rank ? styles.on : undefined} />
        ))}
      </span>
      {meta.label}
    </span>
  )
}
