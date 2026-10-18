import { useEffect, useRef, type ReactNode } from 'react'
import { getProject, projects, STATUS_META } from '../content/projects'
import { HOME_TITLE } from './Home'
import { NotFound } from './NotFound'
import { StatusChip, MaturityTag } from '../components/layout/Badges'
import { ExtLink } from '../components/layout/ExtLink'
import { ProjectCover } from '../components/projects/ProjectCover'
import { CoverImage } from '../components/projects/CoverImage'
import { ArchitectureDiagram } from '../components/projects/ArchitectureDiagram'
import { useActiveSection } from '../hooks/useActiveSection'
import { projectHref } from '../lib/router'
import { scrollToTarget } from '../lib/motion'
import type { EvidenceSource, Project } from '../types/content'
import styles from './CaseStudy.module.css'

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  resume: 'Résumé',
  notes: 'Research notes',
  repository: 'Public repository',
  certificate: 'Certificate',
  owner: 'Owner statement',
}

const CHAPTERS = [
  { id: 'cs-problem', title: 'Problem' },
  { id: 'cs-why', title: 'Why it matters' },
  { id: 'cs-objectives', title: 'Objectives & constraints' },
  { id: 'cs-architecture', title: 'System architecture' },
  { id: 'cs-methods', title: 'Algorithms & methods' },
  { id: 'cs-stack', title: 'Software & hardware' },
  { id: 'cs-contribution', title: 'My contribution' },
  { id: 'cs-implementation', title: 'Implementation' },
  { id: 'cs-validation', title: 'Experiments & validation' },
  { id: 'cs-results', title: 'Results, limits & next' },
  { id: 'cs-evidence', title: 'Artefacts & evidence' },
] as const

const chapterIds = CHAPTERS.map((c) => c.id)

function Chapter({ index, id, title, children }: { index: number; id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.chapter} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className={styles.chapterTitle}>
        <span className={styles.chapterIndex}>{String(index).padStart(2, '0')}</span>
        {title}
      </h2>
      <div className={styles.chapterBody}>{children}</div>
    </section>
  )
}

const List = ({ items }: { items: string[] }) => (
  <ul className={styles.list} role="list">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
)

export default function CaseStudy({ slug }: { slug: string }) {
  const project = getProject(slug)
  if (!project) return <NotFound />
  return <CaseStudyView key={project.slug} project={project} />
}

function CaseStudyView({ project: p }: { project: Project }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const active = useActiveSection(chapterIds)
  const cs = p.caseStudy
  const i = projects.findIndex((x) => x.slug === p.slug)
  const prev = projects[(i - 1 + projects.length) % projects.length]!
  const next = projects[(i + 1) % projects.length]!

  useEffect(() => {
    document.title = `${p.title} — ${p.kicker} · Somashekar Reddy Nakka`
    titleRef.current?.focus({ preventScroll: true })
    return () => {
      document.title = HOME_TITLE
    }
  }, [p])

  return (
    <article className={`theme-paper ${styles.page}`} data-nav="light" aria-labelledby="cs-title">
      <header className={`container ${styles.header}`}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <a href="#work">← All work</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">
            {p.index} {p.title}
          </span>
        </nav>
        <div className={styles.headGrid}>
          <div>
            <p className="label">{p.context}</p>
            <h1 id="cs-title" ref={titleRef} tabIndex={-1} className={`display ${styles.title}`}>
              {p.title}
            </h1>
            <p className={styles.kicker}>{p.kicker}</p>
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Status</dt>
              <dd>
                <StatusChip status={p.status} />
                <span className={styles.statusNote}>{p.statusNote}</span>
              </dd>
            </div>
            <div>
              <dt>Period</dt>
              <dd>{p.period}</dd>
            </div>
            <div>
              <dt>Domains</dt>
              <dd>{p.domains.join(' · ')}</dd>
            </div>
          </dl>
        </div>
        <p className={styles.summary}>{p.summary}</p>
        {p.metrics.length ? (
          <ul className={styles.metrics} role="list">
            {p.metrics.map((m) => (
              <li key={m.label}>
                <strong>{m.value}</strong>
                <span>{m.label}</span>
                <small>Source: {SOURCE_LABEL[m.source]}</small>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="container">
        {p.image ? (
          <figure className={styles.plate} data-tone={p.tone}>
            <CoverImage project={p} sizes="(max-width: 1680px) 100vw, 1600px" eager className={styles.plateImg} />
            <figcaption className="annot">Illustrative render computed from the project’s mathematics — not measured data or a photograph of the system.</figcaption>
          </figure>
        ) : (
          <div className={`theme-night ${styles.svgPlate}`}>
            <ProjectCover kind={p.cover} large />
          </div>
        )}
      </div>

      <div className={`container ${styles.layout}`}>
        <nav className={styles.toc} aria-label="Case study contents">
          <ol role="list">
            {CHAPTERS.map((c, k) => (
              <li key={c.id}>
                <a href={`#${c.id}`} aria-current={active === c.id ? 'true' : undefined} onClick={(e) => {
                  e.preventDefault()
                  scrollToTarget(c.id)
                }}>
                  <span>{String(k + 1).padStart(2, '0')}</span> {c.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.content}>
          <Chapter index={1} id="cs-problem" title="Problem">
            {cs.problem.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </Chapter>
          <Chapter index={2} id="cs-why" title="Why it matters">
            {cs.whyItMatters.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </Chapter>
          <Chapter index={3} id="cs-objectives" title="Objectives & constraints">
            <div className={styles.twoCol}>
              <div>
                <h3 className="label">Objectives</h3>
                <List items={cs.objectives} />
              </div>
              <div>
                <h3 className="label">Constraints</h3>
                <List items={cs.constraints} />
              </div>
            </div>
          </Chapter>
          <Chapter index={4} id="cs-architecture" title="System architecture">
            <ArchitectureDiagram architecture={cs.architecture} />
          </Chapter>
          <Chapter index={5} id="cs-methods" title="Algorithms & methods">
            <ul className={styles.methods} role="list">
              {cs.methods.map((m) => (
                <li key={m.name}>
                  <div className={styles.methodHead}>
                    <h3>{m.name}</h3>
                    <MaturityTag maturity={m.maturity} />
                  </div>
                  <p>{m.detail}</p>
                  {m.equation ? <code className={styles.eq}>{m.equation}</code> : null}
                </li>
              ))}
            </ul>
          </Chapter>
          <Chapter index={6} id="cs-stack" title="Software & hardware">
            <dl className={styles.stack}>
              {cs.stack.map((s) => (
                <div key={s.group}>
                  <dt className="label">{s.group}</dt>
                  <dd>
                    {s.items.map((it) => (
                      <span key={it} className={styles.pill}>
                        {it}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </Chapter>
          <Chapter index={7} id="cs-contribution" title="My contribution">
            <List items={cs.contribution} />
          </Chapter>
          <Chapter index={8} id="cs-implementation" title="Implementation">
            <List items={cs.implementation} />
          </Chapter>
          <Chapter index={9} id="cs-validation" title="Experiments & validation">
            <List items={cs.validation} />
          </Chapter>
          <Chapter index={10} id="cs-results" title="Results, limitations & next steps">
            <div className={styles.threeCol}>
              <div>
                <h3 className="label accent-verified">Results</h3>
                <List items={cs.results} />
              </div>
              <div>
                <h3 className="label accent-interf">Limitations</h3>
                <List items={cs.limitations} />
              </div>
              <div>
                <h3 className="label accent-signal">Next steps</h3>
                <List items={cs.nextSteps} />
              </div>
            </div>
          </Chapter>
          <Chapter index={11} id="cs-evidence" title="Artefacts & evidence">
            <ul className={styles.artifacts} role="list">
              {cs.artifacts.map((a) => (
                <li key={a.label}>
                  {a.href ? (
                    a.href.startsWith('#') ? (
                      <a href={a.href}>{a.label} →</a>
                    ) : (
                      <ExtLink href={a.href}>{a.label} ↗</ExtLink>
                    )
                  ) : (
                    <strong>{a.label}</strong>
                  )}
                  <span>{a.note}</span>
                </li>
              ))}
            </ul>
            <div className={styles.evidence}>
              <h3 className="label">Where these claims come from</h3>
              <ul role="list">
                {p.evidence.map((e) => (
                  <li key={e.note}>
                    <strong>{SOURCE_LABEL[e.source]}</strong> — {e.note}
                  </li>
                ))}
              </ul>
            </div>
            {p.missing.length ? (
              <div className={styles.missing}>
                <h3 className="label">Not yet documented</h3>
                <ul role="list">
                  {p.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className={styles.statusDef}>
              <strong>{STATUS_META[p.status].label}:</strong> {STATUS_META[p.status].description}
            </p>
          </Chapter>
        </div>
      </div>

      <nav className={`container ${styles.pager}`} aria-label="More case studies">
        <a href={projectHref(prev.slug)} className={styles.pagerLink}>
          <span className="label">← Previous</span>
          <span className={styles.pagerTitle}>{prev.title}</span>
        </a>
        <a href={projectHref(next.slug)} className={`${styles.pagerLink} ${styles.pagerNext}`}>
          <span className="label">Next →</span>
          <span className={styles.pagerTitle}>{next.title}</span>
        </a>
      </nav>
    </article>
  )
}
