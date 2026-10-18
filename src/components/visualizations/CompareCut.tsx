import { useMemo } from 'react'
import type { Method, MethodCut } from '../../lib/labModel'
import styles from './CompareCut.module.css'

const W = 640
const H = 300
const PAD = { l: 44, r: 12, t: 16, b: 34 }
const TOP_DB = 10
const FLOOR_DB = -60

const LINES: { m: Method; label: string; cls: string }[] = [
  { m: 'conventional', label: 'Conventional', cls: 'conv' },
  { m: 'mvdr', label: 'MVDR', cls: 'mvdr' },
  { m: 'lcmv', label: 'LCMV', cls: 'lcmv' },
]

const fmt = (db: number) => (db < FLOOR_DB ? `< ${FLOOR_DB} dB` : `${db >= 0 ? '+' : '−'}${Math.abs(db).toFixed(1)} dB`)

/**
 * The three beamformers on one axis: an azimuth cut through the sky at the first jammer's elevation,
 * each normalised to 0 dB toward the satellite. Where the conventional beam has a sidelobe, MVDR and LCMV
 * should show a null.
 */
export function CompareCut({ cut, satAz, satEl, jammers }: { cut: MethodCut; satAz: number; satEl: number; jammers: { az: number; label: string }[] }) {
  const x = (az: number) => PAD.l + (az / 360) * (W - PAD.l - PAD.r)
  const y = (db: number) => PAD.t + ((TOP_DB - Math.max(FLOOR_DB, Math.min(TOP_DB, db))) / (TOP_DB - FLOOR_DB)) * (H - PAD.t - PAD.b)
  const paths = useMemo(
    () =>
      Object.fromEntries(
        LINES.map(({ m }) => {
          const d = cut.db[m]
          let s = ''
          for (let i = 0; i < d.length; i++) s += `${i ? 'L' : 'M'}${x(cut.az[i]!).toFixed(1)},${y(d[i]!).toFixed(1)}`
          return [m, s]
        }),
      ) as Record<Method, string>,
    [cut],
  )
  const label = `Azimuth cut at ${cut.el}° elevation, responses relative to the satellite. ${jammers
    .map((j, k) => `At ${j.label} (${j.az}°): ${LINES.map((l) => `${l.label} ${fmt(cut.atJammers[l.m][k] ?? 0)}`).join(', ')}`)
    .join('. ')}.`

  return (
    <figure className={styles.wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={label}>
        {[10, 0, -20, -40, -60].map((db) => (
          <g key={db}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(db)} y2={y(db)} className={db === 0 ? styles.zero : styles.grid} />
            <text x={PAD.l - 8} y={y(db) + 3} className={styles.tick} textAnchor="end">
              {db > 0 ? `+${db}` : db}
            </text>
          </g>
        ))}
        {[0, 90, 180, 270, 360].map((az) => (
          <text key={az} x={x(az)} y={H - 12} className={styles.tick} textAnchor="middle">
            {az}°
          </text>
        ))}
        <line x1={x(satAz)} x2={x(satAz)} y1={PAD.t} y2={H - PAD.b} className={styles.satMark} />
        <text x={x(satAz) + 5} y={PAD.t + 10} className={styles.satText}>
          SAT az (el {satEl}°)
        </text>
        {jammers.map((j) => (
          <g key={j.label}>
            <line x1={x(j.az)} x2={x(j.az)} y1={PAD.t} y2={H - PAD.b} className={styles.jamMark} />
            <text x={x(j.az) + 5} y={H - PAD.b - 6} className={styles.jamText}>
              {j.label}
            </text>
          </g>
        ))}
        {LINES.map(({ m, cls }) => (
          <path key={m} d={paths[m]} className={`${styles.line} ${styles[cls]}`} />
        ))}
      </svg>
      <figcaption className={styles.legend}>
        {LINES.map(({ m, label, cls }) => (
          <span key={m} className={styles[cls]}>
            <i aria-hidden="true" /> {label}
            {jammers[0] ? <strong>{fmt(cut.atJammers[m][0] ?? 0)}</strong> : null}
          </span>
        ))}
        <span className={styles.note}>Cut at {cut.el}° elevation · 0 dB = response toward the satellite · values at J1</span>
      </figcaption>
    </figure>
  )
}
