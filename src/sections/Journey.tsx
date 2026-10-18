import { useEffect, useRef, useState } from 'react'
import { journey } from '../content/journey'
import { deviceTier, hasWebGL, useMediaQuery, useReducedMotion } from '../lib/env'
import { JOURNEY_STAGES, journeyAt } from '../lib/journeyPath'
import { useInView } from '../hooks/useInView'
import { DomainGlyph } from '../components/visualizations/DomainGlyph'
import { BeamPolar } from '../components/visualizations/BeamPolar'
import type { JourneyScene } from '../components/three/JourneyScene'
import styles from './Journey.module.css'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Scroll-driven interlude between the hero and About. Desktop with WebGL gets the 3D flight;
 * phones, reduced motion and no-WebGL get the same story as static panels.
 */
export function Journey() {
  const reduced = useReducedMotion()
  const compact = useMediaQuery('(max-width: 760px), (pointer: coarse)')
  const [webgl, setWebgl] = useState(hasWebGL)
  return webgl && !reduced && !compact ? <JourneyImmersive onFail={() => setWebgl(false)} /> : <JourneyPanels />
}

function JourneyImmersive({ onFail }: { onFail: () => void }) {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<JourneyScene | null>(null)
  const [active, setActive] = useState(0)
  const near = useInView(sectionRef, { rootMargin: '100% 0px', once: true })
  const failRef = useRef(onFail)
  useEffect(() => {
    failRef.current = onFail
  })

  // Load the scene (separate chunk) as the section approaches.
  useEffect(() => {
    if (!near) return
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return
    let scene: JourneyScene | null = null
    let cancelled = false
    const fail = () => failRef.current()
    import('../components/three/JourneyScene')
      .then(({ JourneyScene }) => {
        if (cancelled) return
        scene = new JourneyScene({ canvas, tier: deviceTier(), onContextLost: fail })
        sceneRef.current = scene
        update()
      })
      .catch(fail)

    let raf = 0
    let lastActive = -1
    let lastVisible: boolean | null = null
    const update = () => {
      raf = 0
      const r = section.getBoundingClientRect()
      // Visibility is derived from the same measurement on every update. Relying on the observer alone
      // deadlocked in production: at load the section sits exactly one viewport down, which counts as an
      // (edge) intersection before the scene module exists, so no later callback ever started the loop.
      const visible = !document.hidden && r.bottom > 0 && r.top < window.innerHeight
      if (sceneRef.current && visible !== lastVisible) {
        lastVisible = visible
        sceneRef.current.setVisible(visible)
      }
      // Aperture: while the section rises into view, the dark stage is revealed through a widening circle.
      const stage = stageRef.current
      if (stage) {
        const vh = window.innerHeight
        const enter = Math.min(1, Math.max(0, 1 - r.top / vh))
        if (enter >= 1) stage.style.clipPath = ''
        else {
          const e = enter * enter * (3 - 2 * enter)
          const full = Math.hypot(window.innerWidth, vh) / 2 + 2
          stage.style.clipPath = `circle(${(full * (0.08 + 0.92 * e)).toFixed(1)}px at 50% 50%)`
        }
      }
      const span = r.height - window.innerHeight
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0
      sceneRef.current?.setProgress(p)
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`
      const a = journeyAt(p).active
      if (a !== lastActive) {
        lastActive = a
        setActive(a)
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const onVis = () => {
      lastVisible = null
      update()
    }
    document.addEventListener('visibilitychange', onVis)
    const ro = new ResizeObserver(() => sceneRef.current?.resize())
    ro.observe(canvas)
    const onMove = (e: PointerEvent) => sceneRef.current?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
    window.addEventListener('pointermove', onMove, { passive: true })
    update()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVis)
      ro.disconnect()
      scene?.dispose()
      sceneRef.current = null
    }
  }, [near])

  return (
    <section
      ref={sectionRef}
      id="journey"
      className={`theme-night ${styles.journey}`}
      data-nav="dark"
      aria-labelledby="journey-title"
      style={{ height: `${JOURNEY_STAGES * 100 + 60}svh` }}
    >
      <div ref={stageRef} className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <div className={styles.scrim} aria-hidden="true" />

        <header className={styles.head}>
          <h2 id="journey-title" className="label">
            Interlude — {journey.title}
          </h2>
          <a className={`btn btn--ghost btn--small ${styles.skip}`} href="#about">
            Skip the journey ↓
          </a>
        </header>

        {/* Screen readers get the whole story at once; the visual captions below are decorative duplicates. */}
        <ol className="sr-only">
          {journey.stages.map((s) => (
            <li key={s.id}>
              {s.title}. {s.body}
            </li>
          ))}
        </ol>

        <ol className={styles.captions} aria-hidden="true">
          {journey.stages.map((s, i) => (
            <li key={s.id} className={styles.caption} data-active={i === active || undefined} inert={i !== active}>
              <p className={styles.count}>
                <span>{pad(i + 1)}</span> / {pad(JOURNEY_STAGES)}
              </p>
              <h3 className={styles.title}>{s.title}</h3>
              <p className={styles.body}>{s.body}</p>
              {'related' in s && s.related ? (
                <a className={styles.related} href={s.related.href} tabIndex={-1}>
                  {s.related.label} →
                </a>
              ) : null}
            </li>
          ))}
        </ol>

        <div className={styles.progress} aria-hidden="true">
          <ol className={styles.ticks}>
            {journey.stages.map((s, i) => (
              <li key={s.id} data-on={i <= active || undefined}>
                <span>{pad(i + 1)}</span>
              </li>
            ))}
          </ol>
          <span className={styles.track}>
            <span ref={barRef} className={styles.bar} />
          </span>
          <p className={styles.note}>{journey.note}</p>
        </div>
      </div>
    </section>
  )
}

function StageArt({ id }: { id: (typeof journey.stages)[number]['id'] }) {
  switch (id) {
    case 'space':
      return <DomainGlyph kind="constellation" />
    case 'interference':
      return <DomainGlyph kind="spectrum" />
    case 'array':
      return <BeamPolar labels={false} title="Adaptive array pattern with a null toward the jammer" />
    case 'fpga':
      return <DomainGlyph kind="pipeline" />
    case 'perception':
      return <DomainGlyph kind="pointcloud" />
    case 'fix':
      return (
        <svg viewBox="0 0 240 160" role="img" aria-label="Four satellites ranging to a single position on a globe" className={styles.fixArt}>
          <circle cx="120" cy="100" r="52" />
          {[
            [40, 26],
            [200, 22],
            [70, 6],
            [176, 64],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <line x1={x} y1={y} x2="132" y2="78" />
              <circle cx={x} cy={y} r="4" className={styles.fixSat} />
            </g>
          ))}
          <circle cx="132" cy="78" r="5" className={styles.fixDot} />
        </svg>
      )
  }
}

function JourneyPanels() {
  return (
    <section id="journey" className={`section theme-night ${styles.panels}`} data-nav="dark" aria-labelledby="journey-title">
      <div className="container">
        <header className={styles.panelsHead}>
          <p className="label">Interlude</p>
          <h2 id="journey-title" className="display">
            {journey.title}
          </h2>
          <p className="lead">{journey.intro}</p>
        </header>
        <ol className={styles.grid} role="list" tabIndex={0} aria-label="The six stages of the signal's journey">
          {journey.stages.map((s, i) => (
            <li key={s.id} className={styles.panel} data-reveal>
              <div className={styles.art}>
                <StageArt id={s.id} />
              </div>
              <p className={styles.count}>
                <span>{pad(i + 1)}</span> / {pad(JOURNEY_STAGES)}
              </p>
              <h3 className={styles.panelTitle}>{s.title}</h3>
              <p className={styles.panelBody}>{s.body}</p>
              {'related' in s && s.related ? (
                <a className={styles.related} href={s.related.href}>
                  {s.related.label} →
                </a>
              ) : null}
            </li>
          ))}
        </ol>
        <p className={styles.panelNote}>{journey.note}</p>
      </div>
    </section>
  )
}
