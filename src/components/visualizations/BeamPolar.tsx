import { useMemo } from 'react'
import {
  conventionalWeights,
  exactCovariance,
  linToDb,
  mvdrWeights,
  powerResponse,
  steering,
  ura,
  type CVec,
} from '../../lib/beamforming'

interface Props {
  satAz?: number
  jamAz?: number
  el?: number
  nx?: number
  ny?: number
  method?: 'mvdr' | 'conventional'
  /** Show the conventional (unadapted) pattern underneath for comparison. */
  compare?: boolean
  labels?: boolean
  className?: string
  title?: string
}

const RANGE = 40
const STEPS = 360

function cut(w: CVec, nx: number, ny: number, el: number) {
  const g = ura(nx, ny, 0.5)
  const vals = new Float64Array(STEPS)
  let max = 0
  for (let i = 0; i < STEPS; i++) {
    vals[i] = powerResponse(w, g, i, el)
    if (vals[i]! > max) max = vals[i]!
  }
  return Array.from(vals, (v) => Math.max(-RANGE, linToDb(v / max)))
}

function pathFor(db: number[], R: number) {
  return (
    db
      .map((d, i) => {
        const r = (R * (d + RANGE)) / RANGE
        const a = (i * Math.PI) / 180
        // Azimuth measured counter-clockwise from +x (east), drawn with north up.
        const x = r * Math.cos(a)
        const y = -r * Math.sin(a)
        return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ') + 'Z'
  )
}

/**
 * Azimuth cut of a planar array's power pattern, computed from steering vectors.
 * Used as the no-WebGL hero fallback and as the J-DOME cover.
 */
export function BeamPolar({
  satAz = 35,
  jamAz = 215,
  el = 20,
  nx = 4,
  ny = 4,
  method = 'mvdr',
  compare = true,
  labels = true,
  className,
  title = 'Azimuth cut of an adaptive array pattern',
}: Props) {
  const R = 100
  const { adapted, conventional, nullDb } = useMemo(() => {
    const g = ura(nx, ny, 0.5)
    const a = steering(g, satAz, el)
    const conv = conventionalWeights(a)
    const w =
      method === 'mvdr'
        ? mvdrWeights(
            exactCovariance(g, [
              { az: satAz, el, powerDb: -20 },
              { az: jamAz, el, powerDb: 40 },
            ]),
            a,
          )
        : conv
    const adaptedCut = cut(w, nx, ny, el)
    return {
      adapted: adaptedCut,
      conventional: cut(conv, nx, ny, el),
      nullDb: adaptedCut[Math.round(((jamAz % 360) + 360) % 360) % 360]!,
    }
  }, [satAz, jamAz, el, nx, ny, method])

  const mark = (az: number, r: number) => {
    const a = (az * Math.PI) / 180
    return { x: r * Math.cos(a), y: -r * Math.sin(a) }
  }
  const sat = mark(satAz, R + 8)
  const jam = mark(jamAz, R + 8)

  return (
    <svg className={className} viewBox="-128 -128 256 256" role="img" aria-label={`${title}. Main lobe toward the satellite at ${satAz}° azimuth; ${nullDb.toFixed(0)} dB relative response toward the interferer at ${jamAz}°.`}>
      <g fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="0.5">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <circle key={f} r={R * f} />
        ))}
        {Array.from({ length: 12 }, (_, k) => {
          const p = mark(k * 30, R)
          return <line key={k} x1="0" y1="0" x2={p.x} y2={p.y} />
        })}
      </g>
      {compare && method === 'mvdr' ? (
        <path d={pathFor(conventional, R)} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="2 2" />
      ) : null}
      <path d={pathFor(adapted, R)} fill="var(--c-signal-dim)" stroke="var(--c-signal-bright)" strokeWidth="1.3" strokeLinejoin="round" />
      <line x1="0" y1="0" x2={jam.x * 0.92} y2={jam.y * 0.92} stroke="var(--c-interf)" strokeWidth="0.8" strokeDasharray="3 2" />
      <circle cx={sat.x} cy={sat.y} r="4" fill="var(--c-signal-bright)" />
      <path d={`M${jam.x} ${jam.y - 5} L${jam.x + 4.5} ${jam.y + 3} L${jam.x - 4.5} ${jam.y + 3}Z`} fill="var(--c-interf)" />
      {labels ? (
        <g fontFamily="var(--font-mono)" fontSize="7" letterSpacing="0.6" fill="currentColor">
          <text x={sat.x + (sat.x >= 0 ? 7 : -7)} y={sat.y + 2.5} textAnchor={sat.x >= 0 ? 'start' : 'end'} fill="var(--c-signal-bright)">
            SAT
          </text>
          <text x={jam.x + (jam.x >= 0 ? 7 : -7)} y={jam.y + 2.5} textAnchor={jam.x >= 0 ? 'start' : 'end'} fill="var(--c-interf)">
            JAM {nullDb.toFixed(0)} dB
          </text>
          <text x="0" y={-R - 4} textAnchor="middle" fillOpacity="0.45" fontSize="6">
            0 dB
          </text>
        </g>
      ) : null}
    </svg>
  )
}
