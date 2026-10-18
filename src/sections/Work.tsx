import type { CSSProperties } from 'react'
import { featuredProjects, otherProjects, STATUS_META } from '../content/projects'
import { sectionMeta } from '../content/site'
import { SectionHead } from '../components/layout/SectionHead'
import { StatusChip } from '../components/layout/Badges'
import { ExtLink } from '../components/layout/ExtLink'
import { ProjectCover } from '../components/projects/ProjectCover'
import { projectHref } from '../lib/router'
import type { ProjectStatus } from '../types/content'
import styles from './Work.module.css'

export function Work() {
  const meta = sectionMeta('work')
  const usedStatuses = [...new Set([...featuredProjects, ...otherProjects].map((p) => p.status))].sort(
    (a, b) => STATUS_META[a].step - STATUS_META[b].step,
  ) as ProjectStatus[]

  return (
    <section id="work" className="section" aria-labelledby="work-title">
      <div className="container">
        <SectionHead
          index={meta.index}
          label={meta.label}
          id="work-title"
          title="Selected work."
          aside="Case studies ranked by technical depth. Each states what was simulated, built, integrated or only researched — and what cannot be shown."
        />

        <ol className={styles.grid} role="list">
          {featuredProjects.map((p, i) => (
            <li key={p.slug} className={`${styles.card} ${i === 0 ? styles.wide : ''}`} data-reveal style={{ '--reveal-delay': `${(i % 2) * 120}ms` } as CSSProperties}>
              <a className={styles.link} href={projectHref(p.slug)} data-cursor="Read">
                <div className={styles.media}>
                  <ProjectCover kind={p.cover} large={i === 0} />
                  <span className={styles.status}>
                    <StatusChip status={p.status} size="sm" />
                  </span>
                </div>
                <div className={styles.meta}>
                  <p className={`label ${styles.tags}`}>
                    <span>{p.index}</span>
                    {p.domains.map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </p>
                  <h3 className={styles.title}>
                    {p.title}
                    <span className={styles.arrow} aria-hidden="true">
                      ↗
                    </span>
                  </h3>
                  <p className={styles.kicker}>{p.kicker}</p>
                  {p.metrics[0] ? (
                    <p className={styles.metric}>
                      <strong>{p.metrics[0].value}</strong> <span>{p.metrics[0].label}</span>
                    </p>
                  ) : null}
                  <p className={styles.context}>{p.context}</p>
                </div>
              </a>
            </li>
          ))}
        </ol>

        <div className={styles.more}>
          <h3 className={`label ${styles.moreTitle}`}>Independent projects · public repositories</h3>
          <ul className={styles.rows} role="list">
            {otherProjects.map((p) => (
              <li key={p.slug} className={styles.row} data-reveal>
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
