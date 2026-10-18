import { useEffect, useRef, useState } from 'react'
import { profile } from '../content/profile'
import { completeSceneTasks, completeTask } from '../lib/loading'
import { deviceTier, finePointer, hasWebGL, useReducedMotion } from '../lib/env'
import { gsap, ScrollTrigger } from '../lib/motion'
import { L1_WAVELENGTH_M } from '../lib/beamforming'
import { BeamPolar } from '../components/visualizations/BeamPolar'
import type { HeroScene } from '../components/three/HeroScene'
import styles from './Hero.module.css'

export function Hero() {
  const reduced = useReducedMotion()
  const [webgl, setWebgl] = useState(hasWebGL)
  const [aboutOpen, setAboutOpen] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const satLabel = useRef<HTMLSpanElement>(null)
  const jamLabel = useRef<HTMLSpanElement>(null)
  const nullOut = useRef<HTMLElement>(null)
  const azOut = useRef<HTMLElement>(null)
  const sceneRef = useRef<HeroScene | null>(null)

  // Scene lifecycle: dynamic import (code-split), measured load steps, graceful fallback.
  useEffect(() => {
    if (!webgl) {
      completeSceneTasks()
      return
    }
    let cancelled = false
    let scene: HeroScene | null = null
    const canvas = canvasRef.current
    const win = windowRef.current
    if (!canvas || !win) return

    import('../components/three/HeroScene')
      .then(({ HeroScene }) => {
        completeTask('scene-module')
        if (cancelled) return
        scene = new HeroScene({
          canvas,
          tier: deviceTier(),
          reduced,
          labels: { sat: satLabel.current, jam: jamLabel.current },
          onFirstFrame: () => completeTask('first-frame'),
          onStats: (s) => {
            if (nullOut.current) nullOut.current.textContent = s.jamDb < -60 ? '< −60 dB' : `${s.jamDb.toFixed(1)} dB`
            if (azOut.current) azOut.current.textContent = `${s.jamAz.toFixed(0)}°`
          },
          onContextLost: () => setWebgl(false),
        })
        sceneRef.current = scene
      })
      .catch(() => {
        completeSceneTasks()
        if (!cancelled) setWebgl(false)
      })

    const ro = new ResizeObserver(() => sceneRef.current?.resize())
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => sceneRef.current?.setVisible(!!e?.isIntersecting))
    io.observe(win)
    const onVis = () => sceneRef.current?.setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    const onMove = (e: PointerEvent) => {
      const r = win.getBoundingClientRect()
      sceneRef.current?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1)
    }
    win.addEventListener('pointermove', onMove)

    return () => {
      cancelled = true
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      win.removeEventListener('pointermove', onMove)
      scene?.dispose()
      sceneRef.current = null
    }
  }, [webgl, reduced])

  // Scroll choreography: the instrument window opens to full bleed while the copy lifts away.
  useEffect(() => {
    const section = sectionRef.current
    const win = windowRef.current
    if (!section || !win) return
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom top',
        onUpdate: (self) => sceneRef.current?.setScroll(self.progress),
      })
      if (reduced) return
      // --gutter is a clamp(); GSAP needs concrete start values, recomputed on refresh.
      const gutterPx = () => Math.min(56, Math.max(16, window.innerWidth * 0.04))
      gsap.fromTo(
        win,
        { '--inset': () => `${gutterPx()}px`, '--radius': '32px' },
        {
          '--inset': '0px',
          '--radius': '0px',
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top top', end: '60% top', scrub: true, invalidateOnRefresh: true },
        },
      )
      gsap.to(`.${styles.copy}`, {
        yPercent: -18,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: section, start: '15% top', end: '70% top', scrub: true },
      })
    }, section)
    return () => ctx.revert()
  }, [reduced])

  const halfLambdaCm = ((L1_WAVELENGTH_M / 2) * 100).toFixed(1)

  return (
    <section id="top" ref={sectionRef} className={styles.hero} aria-labelledby="hero-title">
      <div ref={windowRef} className={styles.window}>
        {webgl ? (
          <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        ) : (
          <div className={styles.fallback}>
            <BeamPolar className={styles.fallbackPlot} title="Hero visual (static fallback)" />
          </div>
        )}
        {webgl ? (
          <div className={styles.labels} aria-hidden="true">
            <span ref={satLabel} className={`${styles.tag} ${styles.tagSat}`}>
              SAT <em>desired signal</em>
            </span>
            <span ref={jamLabel} className={`${styles.tag} ${styles.tagJam}`}>
              JAM <em>interferer</em>
            </span>
          </div>
        ) : null}
        <div className={styles.scrim} aria-hidden="true" />

        <div className={styles.readout}>
          <p className="label">
            <span className={styles.liveDot} aria-hidden="true" /> 4×4 array · MVDR
          </p>
          {webgl ? (
            <p className={styles.readoutRow}>
              <span>Response toward interferer</span>
              <strong ref={nullOut}>— dB</strong>
            </p>
          ) : null}
          {webgl ? (
            <p className={`${styles.readoutRow} ${styles.rowAz}`}>
              <span>Interferer azimuth</span>
              <strong ref={azOut}>—</strong>
            </p>
          ) : null}
          {webgl && finePointer() ? <p className={styles.hint}>Move the pointer to move the interferer — the null follows.</p> : null}
          <button type="button" className={styles.aboutBtn} aria-expanded={aboutOpen} aria-controls="hero-visual-note" onClick={() => setAboutOpen((v) => !v)}>
            {aboutOpen ? 'Hide' : 'About this visual'}
          </button>
          <p id="hero-visual-note" className={styles.note} hidden={!aboutOpen}>
            Illustrative, not an RF simulation of real hardware. The beam pattern is computed in your browser: MVDR weights for a 16-element, λ/2-spaced
            planar array steered to the blue satellite, with a 40 dB interferer on the horizon. The ideal model produces nulls far deeper than real hardware (calibration, quantisation and bandwidth limit them), so anything below −60 dB is shown as “&lt; −60 dB”. The ground ripples show a plane wave and a spherical
            wave interfering; they are not to scale.
          </p>
        </div>

        <div className={styles.copy}>
          <p className={`label ${styles.role}`}>
            {profile.role} — {profile.disciplines.join(' · ')}
          </p>
          <h1 id="hero-title" className={`display ${styles.name}`}>
            <span className={styles.line}>
              <span>Somashekar</span>
            </span>
            <span className={styles.line}>
              <span>
                Reddy Nakka<span className={styles.dot}>.</span>
              </span>
            </span>
          </h1>
          <div className={styles.side}>
            <p className={styles.statement}>{profile.heroStatement}</p>
            <div className={styles.ctas}>
              <a className="btn" href="#work">
                <span className="dot" aria-hidden="true" /> Explore projects
              </a>
              <a className="btn btn--ghost" href={profile.resume.href} download>
                Résumé · PDF
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className={`reg-row container ${styles.reg}`} aria-hidden="true">
        <span>+</span>
        <span className={styles.regHideSm}>GPS L1 · 1575.42 MHz</span>
        <span>+</span>
        <span className={styles.scrollCue}>Scroll to explore</span>
        <span>+</span>
        <span className={styles.regHideSm}>λ/2 = {halfLambdaCm} cm</span>
        <span>+</span>
      </div>
    </section>
  )
}
