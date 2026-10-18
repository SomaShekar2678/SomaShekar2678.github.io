import { credentials, experience, notebooks } from '../../content/profile'
import styles from './CareerRuler.module.css'

const START = 2018
const END = 2027
const NOW = { y: 2026, m: 10 }

const toYear = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return y! + (m! - 1) / 12
}
const pct = (t: number) => `${(((t - START) / (END - START)) * 100).toFixed(2)}%`

/**
 * The career at true scale: education, roles, and the dated learning record (certificates, notebooks).
 * Everything is drawn from content/profile.ts. The degree is known only to the year, so it is drawn
 * with a hatched fill rather than implying months.
 */
export function CareerRuler() {
  const degree = credentials.find((c) => c.kind === 'degree')
  const [dy0, dy1] = (degree?.date ?? '').split('–').map((s) => Number(s.trim()))
  const roles = experience.flatMap((job) => job.roles.map((r) => ({ company: job.company, ...r })))
  const now = NOW.y + (NOW.m - 1) / 12
  const certs = credentials.filter((c) => c.kind === 'course' || c.kind === 'assessment')
  const monthOf = (d: string) => {
    const [mon, y] = d.split(' ')
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(mon!)
    return Number(y) + m / 12
  }

  return (
    <figure className={styles.ruler}>
      <figcaption className="sr-only">
        Timeline from {START} to today: {degree ? `${degree.title} at ${degree.issuer}, ${degree.date}; ` : ''}
        {roles.map((r) => `${r.title} at ${r.company}, ${r.period}`).join('; ')}; {certs.length} certificates and {notebooks.length} study notebooks between 2024 and 2026.
      </figcaption>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.row}>
          <span className={styles.rowLabel}>Study</span>
          {degree && dy0 && dy1 ? (
            <span className={`${styles.bar} ${styles.edu}`} style={{ left: pct(dy0), width: `calc(${pct(dy1 + 1)} - ${pct(dy0)})` }}>
              <em>B.Tech ECE · NIT Delhi</em>
            </span>
          ) : null}
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Work</span>
          {roles.map((r, i) => {
            const a = toYear(r.start)
            const b = r.end ? toYear(r.end) + 1 / 12 : now
            return (
              <span key={r.title} className={`${styles.bar} ${r.end ? '' : styles.current} ${i % 2 ? styles.below : ''}`} style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})` }}>
                <em>
                  {r.company === 'TAVAS Industries' ? 'TAVAS' : r.company} · {r.title}
                </em>
              </span>
            )
          })}
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>Learning</span>
          {notebooks.map((n) => (
            <span key={n.topic} className={styles.tick} style={{ left: pct(toYear(n.date) + 0.04), height: `${Math.min(100, 30 + n.pages)}%` }} />
          ))}
          {certs.map((c) => (
            <span key={c.title} className={styles.cert} style={{ left: pct(monthOf(c.date) + 0.04) }} />
          ))}
        </div>
        <div className={styles.years}>
          {Array.from({ length: END - START + 1 }, (_, i) => START + i).map((y) => (
            <span key={y} style={{ left: pct(y) }}>
              {y < END ? y : ''}
            </span>
          ))}
          <span className={styles.now} style={{ left: pct(now) }}>
            Now
          </span>
        </div>
      </div>
      <p className={`annot ${styles.key}`} aria-hidden="true">
        <span className={styles.keyHatch} /> known to the year · <span className={styles.keyTick} /> study notebook (height ∝ pages) · <span className={styles.keyCert} /> certificate
      </p>
    </figure>
  )
}
