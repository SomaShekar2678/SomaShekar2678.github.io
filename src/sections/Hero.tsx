import { useEffect, useRef, useState } from 'react'
import { profile } from '../content/profile'
import { completeSceneTasks, completeTask } from '../lib/loading'
import { deviceTier, finePointer, hasWebGL, useReducedMotion } from '../lib/env'
import { gsap, ScrollTrigger } from '../lib/motion'
import { L1_WAVELENGTH_M } from '../lib/beamforming'
import type { HeroScene } from '../components/three/HeroScene'
import styles from './Hero.module.css'

export function Hero() {
  const reduced = useReducedMotion()
  const [webgl, setWebgl] = useState(hasWebGL)
  const [aboutOpen, setAboutOpen] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const satLabel = useRef<HTMLSpanElement>(null)
  const jamLabel = useRef<HTMLSpanElement>(null)
  const nullOut = useRef<HTMLElement>(null)
  const azOut = useRef<HTMLElement>(null)
  const sceneRef = useRef<HeroScene | null>(null)
  const pointer = finePointer()

  // Scene lifecycle: dynamic import (code-split), measured load steps, graceful fallback.
  useEffect(() => {
    if (!webgl) {
      completeSceneTasks()
      return
    }
    let cancelled = false
    let scene: HeroScene | null = null
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return

    import('../components/three/HeroScene')
      .then(({ HeroScene }) => {
        completeTask('scene-module')
        if (cancelled) return
        scene = new HeroScene({
          canvas,
          tier: deviceTier(),
          reduced,
          autoSweep: !finePointer(),
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
    io.observe(section)
    const onVis = () => sceneRef.current?.setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = section.getBoundingClientRect()
      sceneRef.current?.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1)
    }
    section.addEventListener('pointermove', onMove)

    return () => {
      cancelled = true
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      section.removeEventListener('pointermove', onMove)
      scene?.dispose()
      sceneRef.current = null
    }
  }, [webgl, reduced])

  // Scroll choreography: the camera rises into the beam while the two name lines part.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom top',
        onUpdate: (self) => sceneRef.current?.setScroll(self.progress),
      })
      if (reduced) return
      const scrub = { trigger: section, start: 'top top', end: 'bottom top', scrub: true }
      gsap.to(`.${styles.line1}`, { xPercent: -14, ease: 'none', scrollTrigger: scrub })
      gsap.to(`.${styles.line2}`, { xPercent: 10, ease: 'none', scrollTrigger: scrub })
      gsap.to(`.${styles.intro}`, { yPercent: -40, opacity: 0, ease: 'none', scrollTrigger: { ...scrub, end: '55% top' } })
    }, section)
    return () => ctx.revert()
  }, [reduced])

  const halfLambdaCm = ((L1_WAVELENGTH_M / 2) * 100).toFixed(1)

  return (
    <section id="top" ref={sectionRef} className={`theme-paper ${styles.hero}`} data-nav="light" aria-labelledby="hero-title">
      {webgl ? (
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      ) : (
        <img
          className={styles.poster}
          src="./media/hero-array.webp"
          width={1600}
          height={1100}
          alt="A 4×4 antenna array with its beam pattern rising above it as a blue sculpture, notched toward an interferer on the horizon."
        />
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

      <div className={styles.intro}>
        <p className={`label ${styles.role}`}>
          {profile.role}
          <br />
          {profile.disciplines.join(' · ')}
        </p>
        <p className={styles.statement}>
          Intelligent systems, <span className="serif">from the signal</span> to the field.
        </p>
        <p className={styles.sub}>{profile.heroStatement}</p>
        <div className={styles.ctas}>
          <a className="btn" href="#work">
            <span className="dot" aria-hidden="true" /> See the work
          </a>
          <a className="btn btn--ghost" href="#lab">
            Try the beam lab
          </a>
        </div>
      </div>

      <figure className={styles.fig}>
        <figcaption>
          <span className="annot">
            fig. 01 — 4×4 planar array, λ/2 = {halfLambdaCm} cm at GPS L1. Beam pattern computed live: MVDR, steered to the satellite.
          </span>
          {webgl ? (
            <span className={styles.readout}>
              <span>
                Toward interferer <strong ref={nullOut}>— dB</strong>
              </span>
              <span>
                Azimuth <strong ref={azOut}>—</strong>
              </span>
            </span>
          ) : null}
          {webgl && pointer ? <span className={`annot ${styles.hint}`}>Move the pointer — the null follows the interferer.</span> : null}
          <button type="button" className={styles.aboutBtn} aria-expanded={aboutOpen} aria-controls="hero-visual-note" onClick={() => setAboutOpen((v) => !v)}>
            {aboutOpen ? 'Hide note' : 'About this visual'}
          </button>
        </figcaption>
        <p id="hero-visual-note" className={styles.note} hidden={!aboutOpen}>
          Illustrative, not an electromagnetic simulation of real hardware. The sculpture is the array’s power pattern over the sky (radius ∝ gain over a 32 dB range), computed in your
          browser for 16 isotropic elements spaced λ/2. It opens as the conventional delay-and-sum beam and re-forms as the MVDR beam once a 40 dB interferer appears near the
          horizon. Ideal-model nulls are far deeper than real hardware achieves, so anything below −60 dB is shown as “&lt; −60 dB”.
        </p>
      </figure>

      <h1 id="hero-title" className={`display ${styles.name}`}>
        <span className={styles.line1}>Somashekar</span>
        <span className={styles.line2}>
          Reddy Nakka<span className={styles.dot}>.</span>
        </span>
      </h1>

      <div className={styles.foot} aria-hidden="true">
        <span>GPS L1 · 1575.42 MHz</span>
        <span className={styles.scrollCue}>Scroll — follow the signal</span>
        <span>{profile.location}</span>
      </div>
    </section>
  )
}
