import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { LAB_GRID, sampleSky } from '../../lib/labModel'
import styles from './SkyPlot.module.css'

export interface SkyMarker {
  id: string
  kind: 'sat' | 'jam' | 'est'
  label: string
  navAz: number
  el: number
}

interface Props {
  map: Float32Array
  rangeDb?: number
  markers: SkyMarker[]
  ariaLabel: string
  onDrag?: (id: string, navAz: number, el: number) => void
}

const RES = 280

/** dB (0 … −range) → colour. Dark → deep blue → signal blue → near white. */
function colormap(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, [7, 8, 10]],
    [0.35, [18, 28, 78]],
    [0.62, [52, 82, 220]],
    [0.85, [148, 168, 255]],
    [1, [246, 247, 255]],
  ]
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i]!
    const [p0, c0] = stops[i - 1]!
    if (t <= p1) {
      const k = (t - p0) / (p1 - p0)
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k]
    }
  }
  return stops[stops.length - 1]![1]
}

export function SkyPlot({ map, rangeDb = 40, markers, ariaLabel, onDrag }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const heat = useRef<HTMLCanvasElement | null>(null)
  const dragging = useRef<string | null>(null)
  const [size, setSize] = useState(480)
  const [hover, setHover] = useState<{ az: number; el: number; db: number } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize(Math.max(240, Math.floor(e!.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Rasterise the sky map once per data change.
  useEffect(() => {
    const c = heat.current ?? document.createElement('canvas')
    heat.current = c
    c.width = c.height = RES
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(RES, RES)
    const half = RES / 2
    for (let y = 0; y < RES; y++) {
      for (let x = 0; x < RES; x++) {
        const dx = (x + 0.5 - half) / half
        const dy = (y + 0.5 - half) / half
        const r = Math.hypot(dx, dy)
        const o = (y * RES + x) * 4
        if (r > 1) {
          img.data[o + 3] = 0
          continue
        }
        const el = 90 * (1 - r)
        const az = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
        const db = sampleSky(map, az, el, LAB_GRID)
        const t = Math.min(1, Math.max(0, (db + rangeDb) / rangeDb))
        const [cr, cg, cb] = colormap(t)
        img.data[o] = cr
        img.data[o + 1] = cg
        img.data[o + 2] = cb
        img.data[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [map, rangeDb])

  const geometry = useCallback(() => {
    const pad = Math.max(26, size * 0.07)
    return { cx: size / 2, cy: size / 2, R: size / 2 - pad }
  }, [size])

  const toXY = useCallback(
    (navAz: number, el: number) => {
      const { cx, cy, R } = geometry()
      const r = R * (1 - el / 90)
      const a = (navAz * Math.PI) / 180
      return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) }
    },
    [geometry],
  )

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !heat.current) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    const { cx, cy, R } = geometry()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(heat.current, cx - R, cy - R, 2 * R, 2 * R)

    // Graticule.
    ctx.strokeStyle = 'rgba(238,235,228,0.18)'
    ctx.lineWidth = 1
    ctx.font = '500 10px "JetBrains Mono Variable", monospace'
    ctx.fillStyle = 'rgba(238,235,228,0.55)'
    for (const el of [0, 30, 60]) {
      ctx.beginPath()
      ctx.arc(cx, cy, R * (1 - el / 90), 0, Math.PI * 2)
      ctx.stroke()
      if (el > 0) ctx.fillText(`${el}°`, cx + 4, cy - R * (1 - el / 90) + 12)
    }
    for (let a = 0; a < 360; a += 30) {
      const p = toXY(a, 0)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const [a, l] of [
      [0, 'N'],
      [90, 'E'],
      [180, 'S'],
      [270, 'W'],
    ] as const) {
      const r = R + 13
      const ang = (a * Math.PI) / 180
      ctx.fillText(l, cx + r * Math.sin(ang), cy - r * Math.cos(ang))
    }

    // Markers.
    for (const m of markers) {
      const { x, y } = toXY(m.navAz, m.el)
      ctx.lineWidth = 2
      if (m.kind === 'sat') {
        ctx.fillStyle = '#94a8ff'
        ctx.strokeStyle = '#07080a'
        ctx.beginPath()
        ctx.arc(x, y, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      } else if (m.kind === 'jam') {
        ctx.fillStyle = '#ffb23f'
        ctx.strokeStyle = '#07080a'
        ctx.beginPath()
        ctx.moveTo(x, y - 8)
        ctx.lineTo(x + 7.5, y + 6)
        ctx.lineTo(x - 7.5, y + 6)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.strokeStyle = '#c8f25a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x - 6, y - 6)
        ctx.lineTo(x + 6, y + 6)
        ctx.moveTo(x + 6, y - 6)
        ctx.lineTo(x - 6, y + 6)
        ctx.stroke()
      }
      ctx.font = '600 10px "JetBrains Mono Variable", monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = m.kind === 'sat' ? '#c9d3ff' : m.kind === 'jam' ? '#ffcf86' : '#c8f25a'
      ctx.fillText(m.label, x + 11, y + (m.kind === 'est' ? 12 : -2))
    }
  }, [size, markers, geometry, toXY, map])

  const fromEvent = (e: ReactPointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const { cx, cy, R } = geometry()
    const r = Math.hypot(x - cx, y - cy) / R
    const el = Math.max(0, Math.min(90, 90 * (1 - r)))
    const az = ((Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI + 360) % 360
    return { x, y, az, el, inside: r <= 1 }
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!onDrag) return
    const p = fromEvent(e)
    let best: { id: string; d: number } | null = null
    for (const m of markers) {
      if (m.kind === 'est') continue
      const q = toXY(m.navAz, m.el)
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d < 22 && (!best || d < best.d)) best = { id: m.id, d }
    }
    if (best) {
      dragging.current = best.id
      ;(e.target as Element).setPointerCapture(e.pointerId)
      e.preventDefault()
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const p = fromEvent(e)
    if (dragging.current && onDrag) {
      onDrag(dragging.current, Math.round(p.az), Math.round(p.el))
      return
    }
    setHover(p.inside ? { az: p.az, el: p.el, db: sampleSky(map, p.az, p.el, LAB_GRID) } : null)
  }

  const onPointerUp = () => {
    dragging.current = null
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{ width: size, height: size }}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        data-cursor={onDrag ? 'Drag' : undefined}
      />
      <p className={styles.probe} aria-hidden="true">
        {hover ? `Az ${hover.az.toFixed(0)}° · El ${hover.el.toFixed(0)}° · ${hover.db.toFixed(1)} dB` : onDrag ? 'Drag the satellite or jammers' : ' '}
      </p>
      <div className={styles.scale} aria-hidden="true">
        <span>−{rangeDb} dB</span>
        <i />
        <span>0 dB</span>
      </div>
    </div>
  )
}
