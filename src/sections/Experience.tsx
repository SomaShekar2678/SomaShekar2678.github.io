import { experience } from '../content/profile'
import { sectionMeta } from '../content/site'
import { SectionHead } from '../components/layout/SectionHead'
import { CareerRuler } from '../components/layout/CareerRuler'
import styles from './Experience.module.css'

export function ExperienceSection() {
  const meta = sectionMeta('experience')
  return (
    <section id="experience" className={`section sheet theme-paper ${styles.experience}`} data-nav="light" aria-labelledby="experience-title">
      <div className="container">
        <SectionHead
          index={meta.index}
          label={meta.label}
          id="experience-title"
          title="Where the work / *happened.*"
          aside="Responsibilities as stated on my résumé. Client names, confidential deliverables and internal metrics are deliberately left out."
        />
        <CareerRuler />
        <ol className={styles.jobs} role="list">
          {experience.map((job) => (
            <li key={job.company} className={styles.job}>
              <header className={styles.head}>
                <h3 className={`display ${styles.company}`}>{job.company}</h3>
                <p className={styles.location}>{job.location}</p>
                <ol className={styles.roles} role="list">
                  {job.roles.map((r) => (
                    <li key={r.title} className={styles.role} data-current={r.end === null || undefined}>
                      <span className={styles.roleTitle}>{r.title}</span>
                      <span className={styles.period}>
                        <time dateTime={r.start}>{r.period.split(' – ')[0]}</time> – {r.end ? <time dateTime={r.end}>{r.period.split(' – ')[1]}</time> : 'Present'}
                      </span>
                    </li>
                  ))}
                </ol>
              </header>
              <div className={styles.body}>
                <p className={styles.summary}>{job.summary}</p>
                <div className={styles.streams}>
                  {job.streams.map((s) => (
                    <div key={s.title} className={styles.stream}>
                      <h4 className="label">{s.title}</h4>
                      <ul role="list">
                        {s.points.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
