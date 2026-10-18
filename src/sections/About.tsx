import { useEffect, useRef, type CSSProperties } from 'react'
import { about, credentials, profile } from '../content/profile'
import { sectionMeta } from '../content/site'
import { SectionHead } from '../components/layout/SectionHead'
import { gsap, ScrollTrigger } from '../lib/motion'
import { useReducedMotion } from '../lib/env'
import styles from './About.module.css'

export function About() {
  const meta = sectionMeta('about')
  const statementRef = useRef<HTMLParagraphElement>(null)
  const reduced = useReducedMotion()

  // Scroll-linked "read-along": words brighten as the statement passes through the viewport.
  useEffect(() => {
    const el = statementRef.current
    if (!el || reduced) return
    const words = el.querySelectorAll<HTMLElement>('[data-w]')
    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { opacity: 0.18 },
        {
          opacity: 1,
          stagger: 0.04,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
        },
      )
    }, el)
    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [reduced])

  const degree = credentials.find((c) => c.kind === 'degree')!
  const facts = [
    { k: 'Now', v: `${profile.role}, TAVAS Industries` },
    { k: 'Before', v: 'Accenture — software engineering' },
    { k: 'Education', v: `B.Tech ECE, NIT Delhi (${degree.date.replace(' – ', '–')})` },
    { k: 'Experience', v: profile.experience },
    { k: 'Based in', v: profile.location },
  ]

  return (
    <section id="about" className="section" aria-labelledby="about-title">
      <div className="container">
        <SectionHead index={meta.index} label={meta.label} id="about-title" title="The engineer behind the systems." />

        <p ref={statementRef} className={styles.statement}>
          <span className="sr-only">{about.statement}</span>
          <span aria-hidden="true">
            {about.statement.split(' ').map((w, i) => (
              <span key={i} data-w>
                {w}{' '}
              </span>
            ))}
          </span>
        </p>

        <div className={styles.grid}>
          <div className={`prose ${styles.bio}`}>
            {about.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} data-reveal>
                {p}
              </p>
            ))}
            <p data-reveal className={styles.longTerm}>
              {about.longTerm} <a href="#india">Why that matters to me →</a>
            </p>
          </div>
          <dl className={styles.facts} data-reveal>
            {facts.map((f) => (
              <div key={f.k}>
                <dt className="label">{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.method}>
          <h3 className={`label ${styles.methodTitle}`}>How I work — from model to field</h3>
          <ol className={styles.steps} role="list">
            {about.principles.map((p, i) => (
              <li key={p.title} className={styles.step} data-reveal style={{ '--reveal-delay': `${i * 90}ms` } as CSSProperties}>
                <span className={styles.stepIndex} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h4 className={styles.stepTitle}>{p.title}</h4>
                <p>{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
