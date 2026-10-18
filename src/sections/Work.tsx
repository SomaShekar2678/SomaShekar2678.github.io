import { featuredProjects, otherProjects, STATUS_META } from '../content/projects'
import { sectionMeta } from '../content/site'
import { SectionHead } from '../components/layout/SectionHead'
import { StatusChip } from '../components/layout/Badges'
import { ExtLink } from '../components/layout/ExtLink'
import { CoverImage } from '../components/projects/CoverImage'
import { projectHref } from '../lib/router'
import type { ProjectStatus } from '../types/content'
import styles from './Work.module.css'

/** Layout variant per featured slot: one spread, then staggered pairs. */
const SLOTS = ['spread', 'left', 'right', 'left', 'right'] as const

export function Work() {
  const meta = sectionMeta('work')
  const usedStatuses = [...new Set([...featuredProjects, ...otherProjects].map((p) => p.status))].sort(
    (a, b) => STATUS_META[a].step - STATUS_META[b].step,
  ) as ProjectStatus[]

  return (
    <section id="work" className={`section sheet theme-paper ${styles.work}`} data-nav="light" aria-labelledby="work-title">
      <div className="container">
        <SectionHead
          index={meta.index}
          label={meta.label}
          id="work-title"
          title="Selected / *work.*"
          aside="Ranked by technical depth. Every case study says what was simulated, built, integrated or only researched — and what cannot be shown."
        />

        <ol className={styles.list} role="list">
          {featuredProjects.map((p, i) => {
            const slot = SLOTS[i] ?? 'left'
            const metric = p.metrics[0]
            return (
              <li key={p.slug} className={`${styles.item} ${styles[slot]}`} data-tone={p.tone}>
                <a className={styles.link} href={projectHref(p.slug)} data-cursor="Read">
                  <figure className={styles.media} data-reveal-media>
                    <CoverImage project={p} sizes={slot === 'spread' ? '(max-width: 900px) 100vw, 66vw' : '(max-width: 900px) 100vw, 50vw'} className={styles.img} />
                  </figure>
                  <div className={styles.meta}>
                    <p className={`label ${styles.tags}`}>
                      <span className={styles.num}>{p.index}</span>
                      {p.domains.map((d) => (
                        <span key={d}>{d}</span>
                      ))}
                    </p>
                    <h3 className={`display ${styles.title}`}>
                      {p.title}
                      <span className={styles.arrow} aria-hidden="true">
                        ↗
                      </span>
                    </h3>
                    <p className={styles.kicker}>{p.kicker}</p>
                    <div className={styles.facts}>
                      <StatusChip status={p.status} size="sm" />
                      {metric ? (
                        <p className={styles.metric}>
                          <strong>{metric.value}</strong> <span>{metric.label}</span>
                        </p>
                      ) : null}
                    </div>
                    <p className={styles.context}>{p.context}</p>
                  </div>
                </a>
              </li>
            )
          })}
        </ol>

        <div className={styles.more}>
          <h3 className={`label ${styles.moreTitle}`}>Independent projects · public repositories</h3>
          <ul className={styles.rows} role="list">
            {otherProjects.map((p) => (
              <li key={p.slug} className={styles.row}>
                <span className={styles.rowIndex}>{p.index}</span>
                <div className={styles.rowMain}>
                  <a className={styles.rowTitle} href={projectHref(p.slug)}>
                    {p.title}
                  </a>
                  <p className={styles.rowSummary}>{p.kicker}</p>
                </div>
                <StatusChip status={p.status} size="sm" />
                {p.links[0] ? (
                  <ExtLink className={styles.repo} href={p.links[0].href}>
                    Repository ↗
                  </ExtLink>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <details className={styles.legend}>
          <summary>How project status is labelled</summary>
          <dl>
            {usedStatuses.map((s) => (
              <div key={s}>
                <dt>
                  <StatusChip status={s} size="sm" />
                </dt>
                <dd>{STATUS_META[s].description}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </section>
  )
}
