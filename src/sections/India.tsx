import type { CSSProperties } from 'react'
import { india, sectionMeta } from '../content/site'
import { SplitText } from '../components/motion/SplitText'
import { NavicGlobe } from '../components/visualizations/NavicGlobe'
import styles from './India.module.css'

export function India() {
  const meta = sectionMeta('india')
  return (
    <section id="india" className={`section ${styles.india}`} aria-labelledby="india-title">
      <div className={styles.glow} aria-hidden="true" />
      <div className="container">
        <p className="section-head__index label">
          <span>{meta.index}</span>
          <span>Engineering for India</span>
        </p>
        <div className={styles.top}>
          <div className={styles.copy}>
            <SplitText as="h2" id="india-title" text={india.title} className={`display ${styles.title}`} />
            <p className={`lead ${styles.intro}`} data-reveal>
              {india.intro}
            </p>
          </div>
          <figure className={styles.figure} data-reveal>
            <NavicGlobe />
            <figcaption className={styles.caption}>{india.visualCaption}</figcaption>
          </figure>
        </div>

        <ol className={styles.areas} role="list">
          {india.areas.map((a, i) => (
            <li key={a.title} className={styles.area} data-reveal style={{ '--reveal-delay': `${(i % 4) * 70}ms` } as CSSProperties}>
              <span className={styles.areaIndex}>{String(i + 1).padStart(2, '0')}</span>
              <h3 className={styles.areaTitle}>{a.title}</h3>
              <p>{a.body}</p>
              {a.link ? (
                <p className={styles.link}>
                  <span className="sr-only">Related work: </span>
                  <span aria-hidden="true">↳ </span>
                  {a.link}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        <p className={styles.disclaimer}>{india.disclaimer}</p>
      </div>
    </section>
  )
}
