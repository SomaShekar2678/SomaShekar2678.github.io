import { lazy, Suspense, useRef } from 'react'
import { sectionMeta } from '../content/site'
import { SectionHead } from '../components/layout/SectionHead'
import { useInView } from '../hooks/useInView'

const BeamLab = lazy(() => import('../components/visualizations/BeamLab').then((m) => ({ default: m.BeamLab })))

export function LabSection() {
  const meta = sectionMeta('lab')
  const mountRef = useRef<HTMLDivElement>(null)
  // Load the lab's code only as the visitor approaches it.
  const near = useInView(mountRef, { rootMargin: '600px 0px', once: true })

  return (
    <section id="lab" className="section" aria-labelledby="lab-title">
      <div className="container">
        <SectionHead
          index={meta.index}
          label={meta.label}
          id="lab-title"
          title="Beamforming lab."
          aside="Steer an antenna array, place jammers and watch adaptive weights carve nulls into the sky — computed live from steering vectors and covariance matrices."
        />
        <div ref={mountRef} style={{ minHeight: 640 }}>
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
