import { lazy, Suspense, useRef } from 'react'
import { sectionMeta } from '../content/site'
import { SectionHead } from '../components/layout/SectionHead'
import { useInView } from '../hooks/useInView'
import styles from './LabSection.module.css'

const BeamLab = lazy(() => import('../components/visualizations/BeamLab').then((m) => ({ default: m.BeamLab })))

export function LabSection() {
  const meta = sectionMeta('lab')
  const mountRef = useRef<HTMLDivElement>(null)
  // Load the lab's code only as the visitor approaches it.
  const near = useInView(mountRef, { rootMargin: '600px 0px', once: true })

  return (
    <section id="lab" className={`section sheet theme-sand ${styles.lab}`} data-nav="light" aria-labelledby="lab-title">
      <div className="container">
        <SectionHead
          index={meta.index}
          label={meta.label}
          id="lab-title"
          title="Steer the array. / *Null the jammer.*"
          aside="A working instrument, not an animation: every pattern below is computed in your browser from steering vectors and a sample covariance matrix. Move the satellite and the jammers, change the array, compare the beamformers."
        />
        <div className={styles.specs} aria-hidden="true">
          <span>URA 2×2 – 4×4</span>
          <span>GPS L1 · λ = 19.0 cm</span>
          <span>Conventional · MVDR · LCMV</span>
          <span>MUSIC direction finding</span>
        </div>
        <div ref={mountRef} className={`theme-night ${styles.instrument}`}>
          {near ? (
            <Suspense fallback={<p className="label">Loading the lab…</p>}>
              <BeamLab />
            </Suspense>
          ) : (
            <p className="label">The interactive lab loads as you approach it.</p>
          )}
        </div>
      </div>
    </section>
  )
}
