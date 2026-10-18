import { credentials, notebooks } from '../content/profile'
import { sectionMeta } from '../content/site'
import { SectionHead } from '../components/layout/SectionHead'
import { ExtLink } from '../components/layout/ExtLink'
import styles from './Education.module.css'

const KIND_LABEL = { degree: 'Degree', programme: 'Programme', course: 'Course certificate', assessment: 'Skill assessment' } as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m! - 1]} ${y}`
}

export function Education() {
  const meta = sectionMeta('education')
  const maxPages = Math.max(...notebooks.map((n) => n.pages))
  const totalPages = notebooks.reduce((s, n) => s + n.pages, 0)

  return (
    <section id="education" className="section" aria-labelledby="education-title">
      <div className="container">
        <SectionHead index={meta.index} label={meta.label} id="education-title" title="Education & learning." />

        <ul className={styles.creds} role="list">
          {credentials.map((c, i) => (
            <li key={c.title} className={`${styles.cred} ${c.image ? styles.withImage : ''}`} data-reveal style={{ ['--reveal-delay' as string]: `${i * 80}ms` }}>
              {c.image ? (
                <div className={styles.thumb}>
                  <img src={c.image} alt={`Certificate: ${c.title}, ${c.issuer}`} loading="lazy" decoding="async" width="900" height="690" />
                </div>
              ) : null}
              <div className={styles.credBody}>
                <p className="label">{KIND_LABEL[c.kind]}</p>
                <h3 className={styles.credTitle}>{c.title}</h3>
                <p className={styles.issuer}>{c.issuer}</p>
                {c.date ? <p className={styles.date}>{c.date}</p> : null}
                {c.detail ? <p className={styles.detail}>{c.detail}</p> : null}
                {c.verifyUrl ? (
                  <ExtLink className={styles.verify} href={c.verifyUrl}>
                    Verify credential ↗
                  </ExtLink>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <div className={styles.notebooks}>
          <div className={styles.nbHead}>
            <h3 className={styles.nbTitle}>Field notebooks</h3>
            <p className={styles.nbIntro}>
              I learn by writing things down by hand. {notebooks.length} digitised notebooks, {totalPages} pages — from regression and decision trees to GNSS
              anti-jamming architecture. The notebooks themselves are private; this is the index.
            </p>
          </div>
          <table className={styles.table}>
            <caption className="sr-only">Study notebooks by date, with area and page count</caption>
            <thead>
              <tr>
                <th scope="col">Digitised</th>
                <th scope="col">Topic</th>
                <th scope="col">Area</th>
                <th scope="col" className={styles.pagesCol}>
                  Pages
                </th>
              </tr>
            </thead>
            <tbody>
              {notebooks.map((n) => (
                <tr key={n.topic}>
                  <td className={styles.when}>
                    <time dateTime={n.date}>{monthLabel(n.date)}</time>
                  </td>
                  <th scope="row" className={styles.topic}>
                    {n.topic}
                  </th>
                  <td className={styles.area}>{n.area}</td>
                  <td className={styles.pages}>
                    <span className={styles.bar} aria-hidden="true">
                      <i style={{ width: `${(n.pages / maxPages) * 100}%` }} />
                    </span>
                    <span className={styles.count}>{n.pages}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
