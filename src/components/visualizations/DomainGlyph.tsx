import { useMemo, type ReactNode } from 'react'
import { rng } from '../../lib/beamforming'
import type { ExpertiseDomain } from '../../types/content'
import styles from './DomainGlyph.module.css'

/** Small animated diagrams, one per expertise domain. Each depicts the domain's core idea. */
export function DomainGlyph({ kind }: { kind: ExpertiseDomain['glyph'] }) {
  switch (kind) {
    case 'neural':
      return <Neural />
    case 'spectrum':
      return <Spectrum />
    case 'constellation':
      return <Constellation />
    case 'pipeline':
      return <Pipeline />
    case 'pointcloud':
      return <PointCloud />
    case 'graph':
      return <Graph />
  }
}

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg className={styles.glyph} viewBox="0 0 240 160" role="img" aria-label={label}>
      {children}
    </svg>
  )
}

function Neural() {
  const layers = [3, 5, 5, 2]
  const nodes = layers.flatMap((n, li) => Array.from({ length: n }, (_, k) => ({ x: 30 + li * 60, y: 80 + (k - (n - 1) / 2) * 26, li })))
  const edges = nodes.flatMap((a) => nodes.filter((b) => b.li === a.li + 1).map((b) => ({ a, b })))
  return (
    <Frame label="Diagram: a small feed-forward neural network">
      {edges.map((e, i) => (
        <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} className={styles.edge} style={{ animationDelay: `${(i % 9) * 0.25}s` }} />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r="4.5" className={n.li === layers.length - 1 ? styles.nodeHot : styles.node} />
      ))}
    </Frame>
  )
}

function Spectrum() {
  // A noise floor with a narrowband (CW) spike and a swept chirp band — what interference looks like on an FFT.
  const pts = useMemo(() => {
    const r = rng(3)
    return Array.from({ length: 96 }, (_, i) => {
      const f = i / 95
      let v = 0.12 + r() * 0.06
      v += 0.72 * Math.exp(-(((f - 0.68) / 0.012) ** 2))
      v += 0.25 * Math.exp(-(((f - 0.3) / 0.09) ** 2))
      return `${(10 + f * 220).toFixed(1)},${(140 - v * 110).toFixed(1)}`
    })
  }, [])
  return (
    <Frame label="Diagram: a power spectrum with a noise floor, a wideband bump and a narrowband CW spike">
      <line x1="10" y1="140" x2="230" y2="140" className={styles.axis} />
      <polyline points={pts.join(' ')} className={styles.trace} />
      <line x1="10" y1="113" x2="230" y2="113" className={styles.threshold} />
      <text x="160" y="40" className={styles.tagJam}>
        CW
      </text>
      <text x="196" y="108" className={styles.tagMuted}>
        threshold
      </text>
    </Frame>
  )
}

function Constellation() {
  const sats = [
    [60, 40],
    [120, 22],
    [182, 48],
    [90, 80],
    [160, 86],
  ]
  return (
    <Frame label="Diagram: satellites above an antenna array, one interferer on the horizon">
      <ellipse cx="120" cy="138" rx="100" ry="14" className={styles.axis} />
      {sats.map(([x, y], i) => (
        <g key={i}>
          <line x1={x} y1={y} x2="120" y2="134" className={styles.los} style={{ animationDelay: `${i * 0.4}s` }} />
          <circle cx={x} cy={y} r="4" className={styles.nodeHot} />
        </g>
      ))}
      <path d="M22 128 l7 -12 l7 12z" className={styles.jam} />
      {[1, 2, 3].map((k) => (
        <circle key={k} cx="29" cy="124" r={k * 12} className={styles.ripple} style={{ animationDelay: `${k * 0.6}s` }} />
      ))}
      <rect x="108" y="130" width="24" height="7" rx="1.5" className={styles.node} />
    </Frame>
  )
}

function Pipeline() {
  const blocks = ['ADC', 'R̂', 'R⁻¹a', 'w', 'y']
  return (
    <Frame label="Diagram: a streaming hardware pipeline — ADC, covariance, solve, weights, output">
      {blocks.map((b, i) => (
        <g key={b}>
          <rect x={12 + i * 45} y="62" width="36" height="36" rx="4" className={styles.block} />
          <text x={30 + i * 45} y="84" className={styles.blockText}>
            {b}
          </text>
          {i < blocks.length - 1 ? <line x1={48 + i * 45} y1="80" x2={57 + i * 45} y2="80" className={styles.axis} /> : null}
        </g>
      ))}
      {[0, 1, 2, 3].map((k) => (
        <circle key={k} cx="12" cy="80" r="2.5" className={styles.packet} style={{ animationDelay: `${k * 0.55}s` }} />
      ))}
      <text x="12" y="126" className={styles.tagMuted}>
        streaming · fixed point · per-sample
      </text>
    </Frame>
  )
}

function PointCloud() {
  const pts = useMemo(() => {
    const r = rng(11)
    return Array.from({ length: 140 }, () => {
      const t = r() * Math.PI * 2
      const ring = r() < 0.6
      const rad = ring ? 52 + r() * 6 : r() * 70
      return [120 + Math.cos(t) * rad * 1.4, 84 + Math.sin(t) * rad * 0.5 + (ring ? 0 : (r() - 0.5) * 20)]
    })
  }, [])
  return (
    <Frame label="Diagram: a LiDAR-like point cloud with an estimated trajectory">
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x!.toFixed(1)} cy={y!.toFixed(1)} r="1.3" className={styles.point} />
      ))}
      <path d="M40 130 C 80 120, 100 90, 130 86 S 190 60, 210 40" className={styles.path} />
      <circle r="4" className={styles.nodeHot}>
        <animateMotion dur="6s" repeatCount="indefinite" path="M40 130 C 80 120, 100 90, 130 86 S 190 60, 210 40" />
      </circle>
    </Frame>
  )
}

function Graph() {
  const commits = [
    [20, 80],
    [55, 80],
    [90, 80],
    [125, 50],
    [160, 50],
    [125, 110],
    [195, 80],
    [225, 80],
  ]
  return (
    <Frame label="Diagram: a version-control graph with branches merging back to main">
      <path d="M20 80 H225 M90 80 C105 80, 110 50, 125 50 H160 C175 50, 180 80, 195 80 M90 80 C105 80, 110 110, 125 110 C150 110, 175 80, 195 80" className={styles.path} />
      {commits.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" className={i === commits.length - 1 ? styles.nodeHot : styles.node} />
      ))}
      <text x="20" y="136" className={styles.tagMuted}>
        test · review · ship
      </text>
    </Frame>
  )
}
