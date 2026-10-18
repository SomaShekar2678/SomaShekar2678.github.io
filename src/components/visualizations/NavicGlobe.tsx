import { useEffect, useMemo, useRef } from 'react'
import { useInView } from '../../hooks/useInView'
import { useReducedMotion } from '../../lib/env'
import styles from './NavicGlobe.module.css'

/**
 * Orthographic globe with NavIC's publicly documented constellation geometry:
 *  - geostationary slots at 32.5°E, 83°E, 129.5°E;
 *  - geosynchronous (inclined 29°) ground tracks crossing the equator at 55°E and 111.75°E;
 *  - the extended service area box (30°S–50°N, 30°E–130°E).
 * Orbit radii are not to scale and satellite phasing is illustrative. No national boundaries are drawn.
 */
const R = 150
const LON0 = 82
const LAT0 = 12
const D = Math.PI / 180
const GEO = [32.5, 83, 129.5]
const IGSO = [55, 111.75]
const INC = 29
const ORBIT_SCALE = 1.42

function project(latDeg: number, lonDeg: number, r = 1) {
  const phi = latDeg * D
  const dl = (lonDeg - LON0) * D
  const p0 = LAT0 * D
  const x = r * Math.cos(phi) * Math.sin(dl)
  const y = r * (Math.cos(p0) * Math.sin(phi) - Math.sin(p0) * Math.cos(phi) * Math.cos(dl))
  const z = r * (Math.sin(p0) * Math.sin(phi) + Math.cos(p0) * Math.cos(phi) * Math.cos(dl))
  const hidden = z < 0 && x * x + y * y < 1
  return { x: x * R, y: -y * R, z, hidden }
}

function igsoPoint(lon0: number, u: number) {
  // Circular geosynchronous orbit: ground track lat = asin(sin i sin u), lon = lon0 + atan2(cos i sin u, cos u) − u.
  const i = INC * D
  const lat = Math.asin(Math.sin(i) * Math.sin(u)) / D
  const lon = lon0 + (Math.atan2(Math.cos(i) * Math.sin(u), Math.cos(u)) - u) / D
  return { lat, lon }
}

function pathFrom(points: { x: number; y: number; hidden: boolean }[]) {
  let d = ''
  let pen = false
  for (const p of points) {
    if (p.hidden) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    pen = true
  }
  return d
}

export function NavicGlobe() {
  const wrap = useRef<HTMLDivElement>(null)
  const dots = useRef<(SVGCircleElement | null)[]>([])
  const inView = useInView(wrap)
  const reduced = useReducedMotion()

  const geometry = useMemo(() => {
    const graticule: string[] = []
    for (let lon = -180; lon < 180; lon += 15) {
      graticule.push(pathFrom(Array.from({ length: 61 }, (_, k) => project(-90 + k * 3, lon))))
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      graticule.push(pathFrom(Array.from({ length: 121 }, (_, k) => project(lat, -180 + k * 3))))
    }
    const equator = pathFrom(Array.from({ length: 121 }, (_, k) => project(0, -180 + k * 3)))
    const box = [
      ...Array.from({ length: 21 }, (_, k) => project(-30, 30 + k * 5)),
      ...Array.from({ length: 17 }, (_, k) => project(-30 + k * 5, 130)),
      ...Array.from({ length: 21 }, (_, k) => project(50, 130 - k * 5)),
      ...Array.from({ length: 17 }, (_, k) => project(50 - k * 5, 30)),
    ]
    const serviceArea = pathFrom(box) + 'Z'
    const tracks = IGSO.map((lon0) =>
      pathFrom(
        Array.from({ length: 181 }, (_, k) => {
          const p = igsoPoint(lon0, (k / 180) * Math.PI * 2)
          return project(p.lat, p.lon)
        }),
      ),
    )
    const geoRing = pathFrom(Array.from({ length: 181 }, (_, k) => project(0, -180 + k * 2, ORBIT_SCALE)))
    const geoSats = GEO.map((lon) => ({ lon, p: project(0, lon, ORBIT_SCALE), sub: project(0, lon) }))
    return { graticule, equator, serviceArea, tracks, geoRing, geoSats }
  }, [])

  // Animate IGSO satellites along their tracks (two per track, half a period apart).
  useEffect(() => {
    const place = (t: number) => {
      IGSO.forEach((lon0, k) => {
        for (let s = 0; s < 2; s++) {
          const u = t + s * Math.PI + k * 0.9
          const g = igsoPoint(lon0, u)
          const p = project(g.lat, g.lon)
          const el = dots.current[k * 2 + s]
          if (!el) continue
          el.setAttribute('cx', p.x.toFixed(1))
          el.setAttribute('cy', p.y.toFixed(1))
          el.style.opacity = p.hidden ? '0' : '1'
        }
      })
    }
    if (reduced || !inView) {
      place(0.6)
      return
    }
    let raf = 0
    const start = performance.now()
    const loop = (now: number) => {
      place(0.6 + ((now - start) / 1000) * 0.35)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduced])

  return (
    <div ref={wrap} className={styles.wrap}>
      <svg
        viewBox="-230 -230 460 460"
        className={styles.svg}
        role="img"
        aria-label="Globe centred on the Indian Ocean region showing NavIC geometry: three geostationary satellites above 32.5°E, 83°E and 129.5°E, figure-eight ground tracks of inclined geosynchronous satellites centred on 55°E and 111.75°E, and the extended service area from 30°S to 50°N and 30°E to 130°E."
      >
        <defs>
          <radialGradient id="globe-fill" cx="35%" cy="30%" r="80%">
            {/* Shading only (white highlight → dark limb), so the globe sits on whatever chapter colour it is placed on. */}
            <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="60%" stopColor="#000" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.32" />
          </radialGradient>
        </defs>
        <path d={geometry.geoRing} className={styles.geoRingBack} />
        <circle r={R} fill="url(#globe-fill)" className={styles.globe} />
        {geometry.graticule.map((d, i) => (
          <path key={i} d={d} className={styles.grat} />
        ))}
        <path d={geometry.serviceArea} className={styles.area} />
        <path d={geometry.equator} className={styles.equator} />
        {geometry.tracks.map((d, i) => (
          <path key={i} d={d} className={styles.track} />
        ))}
        <path d={geometry.geoRing} className={styles.geoRing} />
        {geometry.geoSats.map((s) =>
          s.p.hidden ? null : (
            <g key={s.lon}>
              {!s.sub.hidden ? <line x1={s.sub.x} y1={s.sub.y} x2={s.p.x} y2={s.p.y} className={styles.stalk} /> : null}
              <circle cx={s.p.x} cy={s.p.y} r="5" className={styles.geoSat} />
              <text x={s.p.x} y={s.p.y - 10} className={styles.satLabel} textAnchor="middle">
                {s.lon}°E
              </text>
            </g>
          ),
        )}
        {[0, 1, 2, 3].map((k) => (
          <circle
            key={k}
            ref={(el) => {
              dots.current[k] = el
            }}
            r="4"
            className={styles.igsoSat}
          />
        ))}
        <text x={-R + 6} y={R + 34} className={styles.legend}>
          <tspan className={styles.legGeo}>●</tspan> GEO · <tspan className={styles.legIgso}>●</tspan> GSO 29° · <tspan className={styles.legArea}>▭</tspan>{' '}
          extended service area
        </text>
      </svg>
    </div>
  )
}
