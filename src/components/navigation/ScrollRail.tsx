import { useRef } from 'react'
import { sections } from '../../content/site'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import styles from './ScrollRail.module.css'

/** Decorative scroll-position rail (desktop). Navigation itself lives in the header and menu. */
export function ScrollRail({ enabled }: { enabled: boolean }) {
  const fill = useRef<HTMLSpanElement>(null)
  useScrollProgress((p) => {
    if (fill.current) fill.current.style.transform = `scaleY(${p})`
  })
  if (!enabled) return null
  return (
    <div className={styles.rail} aria-hidden="true">
      <span className={styles.track}>
        <span ref={fill} className={styles.fill} />
      </span>
      <span className={styles.count}>{String(sections.length - 1).padStart(2, '0')}</span>
    </div>
  )
}
