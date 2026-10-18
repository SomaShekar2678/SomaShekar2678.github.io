import { useEffect, useRef, useState } from 'react'
import { useLoadProgress } from '../../lib/loading'
import { prefersReducedMotion } from '../../lib/env'
import { profile } from '../../content/profile'
import styles from './Loader.module.css'

const STEPS = ['Loading typefaces', 'Loading the scene', 'Rendering the first frame', 'Ready']
/** Never hold content hostage: after this, the page is revealed even if the scene is still compiling. */
const MAX_WAIT_MS = 4000

export function Loader() {
  const progress = useLoadProgress()
  const [phase, setPhase] = useState<'loading' | 'leaving' | 'gone'>('loading')
  const counterRef = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)
  const reduced = prefersReducedMotion()

  // Counter eases toward the measured progress (it never runs ahead of it).
  useEffect(() => {
    let raf = 0
    const tick = () => {
      shown.current += (progress - shown.current) * (reduced ? 1 : 0.14)
      if (Math.abs(progress - shown.current) < 0.002) shown.current = progress
      if (counterRef.current) counterRef.current.textContent = String(Math.round(shown.current * 100)).padStart(3, '0')
      if (shown.current !== progress) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [progress, reduced])

  useEffect(() => {
    if (phase !== 'loading') return
    if (progress >= 1) {
      const t = window.setTimeout(() => setPhase('leaving'), reduced ? 0 : 450)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setPhase('leaving'), MAX_WAIT_MS)
    return () => window.clearTimeout(t)
  }, [progress, phase, reduced])

  useEffect(() => {
    if (phase !== 'leaving') return
    document.documentElement.dataset.loading = 'false'
    const t = window.setTimeout(() => setPhase('gone'), reduced ? 0 : 1000)
    return () => window.clearTimeout(t)
  }, [phase, reduced])

  if (phase === 'gone') return null
  const step = STEPS[Math.min(Math.round(progress * 3), 3)]

  return (
    <div className={`${styles.loader} ${phase === 'leaving' ? styles.leaving : ''}`} inert={phase === 'leaving'}>
      <div className={styles.top}>
        <span className="label">{profile.name}</span>
        <button type="button" className={styles.skip} onClick={() => setPhase('leaving')}>
          Skip intro
        </button>
      </div>
      <div className={styles.bottom}>
        <p className={styles.step} role="status">
          {step}
        </p>
        <div className={styles.bar} aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
        <p className={styles.counter} aria-hidden="true">
          <span ref={counterRef}>000</span>
          <small>signals, systems & intelligence</small>
        </p>
      </div>
    </div>
  )
}
