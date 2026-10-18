import { describe, expect, it } from 'vitest'
import { projects, STATUS_META } from '../../src/content/projects'
import { expertise, MATURITY_META } from '../../src/content/expertise'
import { credentials, experience, profile } from '../../src/content/profile'
import { sections } from '../../src/content/site'

/**
 * Content integrity: guards the evidence rules from the brief so that later edits
 * cannot silently introduce unsupported statuses, broken links or unsourced metrics.
 */
const allText = (o: unknown): string => JSON.stringify(o)

describe('projects', () => {
  it('have unique slugs and sequential indices', () => {
    const slugs = projects.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    projects.forEach((p, i) => expect(p.index).toBe(String(i + 1).padStart(2, '0')))
  })

  it('use only defined statuses and maturity levels', () => {
    for (const p of projects) {
      expect(STATUS_META[p.status]).toBeDefined()
      for (const m of p.caseStudy.methods) expect(MATURITY_META[m.maturity]).toBeDefined()
    }
  })

  it('fill every case-study chapter', () => {
    for (const p of projects) {
      const cs = p.caseStudy
      for (const key of ['problem', 'whyItMatters', 'objectives', 'constraints', 'methods', 'stack', 'contribution', 'implementation', 'validation', 'results', 'limitations', 'nextSteps', 'artifacts'] as const) {
        expect(cs[key].length, `${p.slug}.${key}`).toBeGreaterThan(0)
      }
      expect(cs.architecture.stages.length, `${p.slug} architecture`).toBeGreaterThan(2)
    }
  })

  it('cite evidence for every project and a source for every metric', () => {
    for (const p of projects) {
      expect(p.evidence.length, p.slug).toBeGreaterThan(0)
      for (const m of p.metrics) expect(['resume', 'notes', 'repository', 'certificate', 'owner']).toContain(m.source)
    }
  })

  it('reserve high-assurance statuses for documented cases', () => {
    // Nothing in the supplied material documents acceptance-criteria validation or production deployment of a project.
    for (const p of projects) expect(['validated', 'production']).not.toContain(p.status)
  })

  it('label research honestly', () => {
    const receiver = projects.find((p) => p.slug === 'gnss-receiver-research')!
    expect(receiver.status).toBe('research')
    expect(receiver.caseStudy.architecture.stages.some((s) => s.state === 'planned')).toBe(true)
  })

  it('link only to https URLs or in-page anchors', () => {
    for (const p of projects) {
      for (const l of p.links) expect(l.href).toMatch(/^https:\/\//)
      for (const a of p.caseStudy.artifacts) if (a.href) expect(a.href).toMatch(/^(https:\/\/|#)/)
    }
  })

  it('contain no leftover placeholder markers', () => {
    expect(allText(projects)).not.toMatch(/TODO|TBD|lorem|xxx/i)
  })
})

describe('profile and history', () => {
  it('matches the facts consistent across the résumés', () => {
    expect(profile.email).toBe('shekar3reddy4@gmail.com')
    expect(profile.links.linkedin).toBe('https://www.linkedin.com/in/somashekar39')
    expect(profile.links.github).toBe('https://github.com/SomaShekar2678')
    expect(experience.map((e) => e.company)).toEqual(['TAVAS Industries', 'Accenture'])
    expect(experience[1]!.roles[0]!.period).toBe('Oct 2022 – Nov 2023')
    expect(credentials.find((c) => c.kind === 'degree')!.date).toBe('2018 – 2022')
  })

  it('never renders the phone number', () => {
    expect(profile.showPhone).toBe(false)
    expect(allText({ profile, experience, credentials, projects, expertise })).not.toMatch(/7032215859|\+91/)
  })

  it('links credentials to their verification pages', () => {
    for (const c of credentials.filter((c) => c.source === 'certificate')) expect(c.verifyUrl).toMatch(/^https:\/\//)
  })
})

describe('expertise and sections', () => {
  it('has six domains with at least one method each', () => {
    expect(expertise).toHaveLength(6)
    for (const d of expertise) expect(d.items.length).toBeGreaterThan(0)
  })

  it('has unique section ids', () => {
    const ids = sections.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
