import { useEffect, useRef } from 'react'
import { about, credentials, profile } from '../content/profile'
import { sectionMeta } from '../content/site'
import { plainText } from '../lib/text'
import { gsap, ScrollTrigger } from '../lib/motion'
import { useReducedMotion } from '../lib/env'
import styles from './About.module.css'

/** Splits a sentence with *serif* markers into words that know whether they are accented. */
function words(text: string) {
  let serif = false
  return text
    .split(' ')
    .filter(Boolean)
    .map((raw) => {
      if (raw.startsWith('*')) serif = true
      const w = { text: raw.replace(/\*/g, ''), serif }
      if (raw.endsWith('*')) serif = false
      return w
    })
}

export function About() {
  const meta = sectionMeta('about')
  const statementRef = useRef<HTMLParagraphElement>(null)
  const methodRef = useRef<HTMLOListElement>(null)
  const reduced = useReducedMotion()

  // Read-along: words darken as the statement passes through the reading line.
  // The method line draws itself across the four steps as they scroll through.
  useEffect(() => {
    const el = statementRef.current
    const method = methodRef.current
    if (!el || !method || reduced) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll<HTMLElement>('[data-w]'),
        { opacity: 0.16 },
        { opacity: 1, stagger: 0.04, ease: 'none', scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 50%', scrub: true } },
      )
      const path = method.parentElement?.querySelector<SVGPathElement>('[data-draw]')
      if (path) {
        const len = path.getTotalLength()
        gsap.fromTo(
          path,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: method, start: 'top 85%', end: 'bottom 60%', scrub: true } },
        )
      }
    })
    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [reduced])

  const degree = credentials.find((c) => c.kind === 'degree')!
  const facts = [
    { k: 'Now', v: `${profile.role}`, d: 'TAVAS Industries' },
    { k: 'Before', v: 'Software engineer', d: 'Accenture' },
    { k: 'Trained in', v: 'Electronics & Communication', d: `NIT Delhi, ${degree.date.replace(' – ', '–')}` },
    { k: 'Experience', v: '~2.5 years', d: 'professional' },
  ]

  return (
    <section id="about" className={`section sheet theme-paper ${styles.about}`} data-nav="light" aria-labelledby="about-title">
      <div className="container">
        <h2 id="about-title" tabIndex={-1} className={`label ${styles.index}`}>
          <span>{meta.index}</span>
          <span>{meta.label}</span>
          <span className={styles.indexNote}>The engineer behind the systems</span>
        </h2>

        <p ref={statementRef} className={styles.statement}>
          <span className="sr-only">{plainText(about.statement)}</span>
          <span aria-hidden="true">
            {words(about.statement).map((w, i) => (
              <span key={i} data-w className={w.serif ? 'serif' : undefined}>
                {w.text}{' '}
              </span>
            ))}
          </span>
        </p>

        <div className={styles.grid}>
          <dl className={styles.facts}>
            {facts.map((f) => (
              <div key={f.k} className={styles.fact}>
                <dt className="label">{f.k}</dt>
                <dd>
                  <strong>{f.v}</strong>
                  <span>{f.d}</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className={`prose ${styles.bio}`}>
            {about.paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <p className={styles.longTerm}>
              {about.longTerm} <a href="#india">Why that matters to me →</a>
            </p>
          </div>
        </div>

        <div className={styles.method}>
          <div className={styles.methodHead}>
            <h3 className={`display ${styles.methodTitle}`}>
              From model <span className="serif">to field.</span>
            </h3>
            <p className="annot">How I work — every project on this site went through these four steps, or says where it stopped.</p>
          </div>
          <div className={styles.flow}>
            <svg className={styles.line} viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
              <path d="M 12 60 L 988 60" className={styles.lineBase} />
              <path data-draw d="M 12 60 L 988 60" className={styles.lineDraw} />
              {/* The feedback edge: validation sends you back to the model. */}
              <path d="M 988 60 C 988 4, 12 4, 12 60" className={styles.loop} />
            </svg>
            <ol ref={methodRef} className={styles.steps} role="list">
              {about.principles.map((p, i) => (
                <li key={p.title} className={styles.step}>
                  <span className={styles.node} aria-hidden="true" />
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
      </div>
    </section>
  )
}
