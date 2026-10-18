import { useMemo, type ReactNode } from 'react'
import { rng } from '../../lib/beamforming'
import { caCode, circularCorrelation } from '../../lib/gnss'
import type { CoverKind } from '../../types/content'
import { BeamPolar } from '../visualizations/BeamPolar'
import styles from './ProjectCover.module.css'

/**
 * Generative cover art. Each cover is drawn from the mathematics of its project, not from project data:
 * no cover depicts real measurements. Alt text says so.
 */
export function ProjectCover({ kind, large = false }: { kind: CoverKind; large?: boolean }) {
  return (
    <div className={`${styles.cover} ${large ? styles.large : ''}`} data-kind={kind}>
      <div className={styles.grid} aria-hidden="true" />
      {kind === 'beam' ? (
        <BeamPolar className={styles.svgSquare} labels title="Illustrative cover: MVDR beam pattern with a null toward an interferer" />
      ) : kind === 'correlation' ? (
        <Correlation />
      ) : kind === 'matching' ? (
        <Matching />
      ) : kind === 'survival' ? (
        <Survival />
      ) : kind === 'trajectory' ? (
        <Trajectory />
      ) : kind === 'rag' ? (
        <Rag />
      ) : kind === 'factorization' ? (
        <Factorization />
      ) : (
        <Seasonal />
      )}
    </div>
  )
}

function Svg({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg className={styles.svg} viewBox="0 0 400 250" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  )
}

function Correlation() {
  const path = useMemo(() => {
    const c = caCode(1)
    const r = circularCorrelation(c, c)
    // Show lags −40…+40 chips around the peak.
    const pts: string[] = []
    for (let k = -40; k <= 40; k++) {
      const v = r[(k + 1023) % 1023]! / 1023
      const x = 200 + k * 4.4
      const y = 200 - v * 150
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return pts.join(' ')
  }, [])
  return (
    <Svg label="Illustrative cover: autocorrelation of the GPS C/A code for PRN 1, a single sharp peak at zero lag">
      <line x1="20" y1="200" x2="380" y2="200" className={styles.axis} />
      <polyline points={path} className={styles.signal} />
      <text x="208" y="44" className={styles.mono}>
        R(0) = 1023
      </text>
      <text x="22" y="226" className={styles.monoMuted}>
        PRN 1 · C/A code autocorrelation · lag ±40 chips
      </text>
    </Svg>
  )
}

function Matching() {
  const data = useMemo(() => {
    const r = rng(21)
    return Array.from({ length: 26 }, () => {
      const x = 30 + r() * 140
      const y = 40 + r() * 170
      const inlier = r() > 0.25
      return { x, y, x2: inlier ? 230 + (x - 30) * 0.92 + 6 : 230 + r() * 140, y2: inlier ? y * 0.95 + 10 : 40 + r() * 170, inlier }
    })
  }, [])
  return (
    <Svg label="Illustrative cover: feature correspondences between two images, inliers kept and outliers rejected">
      <rect x="20" y="30" width="160" height="190" rx="6" className={styles.frame} />
      <rect x="220" y="30" width="160" height="190" rx="6" className={styles.frame} />
      {data.map((d, i) => (
        <g key={i}>
          <line x1={d.x} y1={d.y} x2={d.x2} y2={d.y2} className={d.inlier ? styles.inlier : styles.outlier} />
          <circle cx={d.x} cy={d.y} r="2.4" className={styles.dot} />
          <circle cx={d.x2} cy={d.y2} r="2.4" className={styles.dot} />
        </g>
      ))}
    </Svg>
  )
}

function Survival() {
  const curves = useMemo(() => {
    const mk = (eta: number, beta: number) =>
      Array.from({ length: 61 }, (_, i) => {
        const t = i / 60
        const s = Math.exp(-Math.pow(t / eta, beta))
        return [30 + t * 340, 210 - s * 170] as const
      })
    return { mid: mk(0.62, 2.4), lo: mk(0.5, 2.4), hi: mk(0.76, 2.4) }
  }, [])
  const line = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const band = `${line(curves.lo)} ${line([...curves.hi].reverse())}`
  return (
    <Svg label="Illustrative cover: Weibull survival curve with an uncertainty band">
      <line x1="30" y1="210" x2="370" y2="210" className={styles.axis} />
      <line x1="30" y1="40" x2="30" y2="210" className={styles.axis} />
      <polygon points={band} className={styles.band} />
      <polyline points={line(curves.mid)} className={styles.signal} />
      <text x="40" y="34" className={styles.monoMuted}>
        S(t) = exp(−(t/η)^β) · 80% interval
      </text>
    </Svg>
  )
}

function Trajectory() {
  const { truth, est } = useMemo(() => {
    const r = rng(5)
    const truth: [number, number][] = []
    const est: [number, number][] = []
    let ex = 0
    let ey = 0
    for (let i = 0; i <= 80; i++) {
      const t = i / 80
      const x = 40 + t * 320
      const y = 130 + Math.sin(t * Math.PI * 2.2) * 55 * (1 - t * 0.3)
      truth.push([x, y])
      ex = ex * 0.9 + (r() - 0.5) * 6
      ey = ey * 0.9 + (r() - 0.5) * 6
      est.push([x + ex, y + ey])
    }
    return { truth, est }
  }, [])
  const line = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <Svg label="Illustrative cover: a true trajectory and a filtered estimate following it">
      <polyline points={line(truth)} className={styles.truth} />
      <polyline points={line(est)} className={styles.signal} />
      {est.filter((_, i) => i % 10 === 0).map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx={6 + i} ry={4 + i * 0.6} className={styles.cov} />
      ))}
      <text x="40" y="232" className={styles.monoMuted}>
        truth — estimate · 1σ covariance
      </text>
    </Svg>
  )
}

function Rag() {
  const nodes = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 34 }, () => ({ x: 40 + r() * 320, y: 30 + r() * 190 }))
  }, [])
  const q = { x: 210, y: 122 }
  const near = [...nodes].sort((a, b) => Math.hypot(a.x - q.x, a.y - q.y) - Math.hypot(b.x - q.x, b.y - q.y)).slice(0, 4)
  return (
    <Svg label="Illustrative cover: a query embedding retrieving its nearest document chunks">
      {near.map((n, i) => (
        <line key={i} x1={q.x} y1={q.y} x2={n.x} y2={n.y} className={styles.inlier} />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={near.includes(n) ? 4 : 2.6} className={near.includes(n) ? styles.hot : styles.dot} />
      ))}
      <circle cx={q.x} cy={q.y} r="6" className={styles.query} />
      <text x={q.x + 10} y={q.y - 10} className={styles.mono}>
        query
      </text>
    </Svg>
  )
}

function Factorization() {
  const cells = useMemo(() => {
    const r = rng(14)
    const P = Array.from({ length: 10 }, () => [r() - 0.5, r() - 0.5])
    const Q = Array.from({ length: 16 }, () => [r() - 0.5, r() - 0.5])
    return P.flatMap((p, i) => Q.map((q, j) => ({ i, j, v: p[0]! * q[0]! + p[1]! * q[1]!, known: r() > 0.7 })))
  }, [])
  return (
    <Svg label="Illustrative cover: a sparse rating matrix completed by a low-rank factorisation">
      {cells.map((c) => (
        <rect
          key={`${c.i}-${c.j}`}
          x={70 + c.j * 17}
          y={35 + c.i * 17}
          width="14"
          height="14"
          rx="2"
          className={c.known ? styles.known : styles.cell}
          style={{ opacity: c.known ? 1 : 0.15 + Math.min(0.75, Math.abs(c.v) * 3) }}
        />
      ))}
      <text x="70" y="226" className={styles.monoMuted}>
        R ≈ P Qᵀ · observed vs predicted
      </text>
    </Svg>
  )
}

function Seasonal() {
  const pts = useMemo(() => {
    return Array.from({ length: 143 }, (_, i) => {
      const t = i / 52
      const season = Math.sin(t * Math.PI * 2) * 0.15
      const holiday = Math.exp(-((((t % 1) - 0.9) / 0.025) ** 2)) * 0.5
      const v = 0.35 + season + holiday + t * 0.03
      return `${(25 + i * 2.45).toFixed(1)},${(215 - v * 170).toFixed(1)}`
    }).join(' ')
  }, [])
  return (
    <Svg label="Illustrative cover: a weekly series with yearly seasonality and holiday peaks">
      <line x1="25" y1="215" x2="375" y2="215" className={styles.axis} />
      <polyline points={pts} className={styles.signal} />
      <text x="25" y="34" className={styles.monoMuted}>
        y(t) = g(t) + s(t) + h(t)
      </text>
    </Svg>
  )
}
