/**
 * Content model. Every professional claim on the site is expressed through these types,
 * and every claim carries the source it was taken from (see `EvidenceSource`).
 */

/** How far a project has actually progressed. Only use a status the evidence supports. */
export type ProjectStatus =
  | 'research'
  | 'exploratory'
  | 'simulation'
  | 'prototype'
  | 'hardware-integration'
  | 'internal-delivery'
  | 'validated'
  | 'production'

/** How deeply an individual method/tool has been exercised. */
export type Maturity = 'studied' | 'simulated' | 'implemented' | 'deployed'

/** Where a claim comes from. */
export type EvidenceSource = 'resume' | 'notes' | 'repository' | 'certificate' | 'owner'

export interface ExternalLink {
  label: string
  href: string
  /** Short note shown next to the link, e.g. "public repository". */
  note?: string
}

export interface Metric {
  value: string
  label: string
  source: EvidenceSource
}

export interface ArchitectureStage {
  id: string
  label: string
  detail: string
  /** Optional lane/group for the diagram (e.g. "RF", "Digital", "Host"). */
  group?: string
  /** Implementation state of this specific stage, when it differs from the project status. */
  state?: Maturity | 'planned'
}

export interface Architecture {
  caption: string
  stages: ArchitectureStage[]
  /** Optional feedback edges, from stage id to stage id. */
  feedback?: { from: string; to: string; label: string }[]
  note?: string
}

export interface Method {
  name: string
  detail: string
  maturity: Maturity
  /** Optional LaTeX-free plain-text equation, rendered in monospace. */
  equation?: string
}

export interface CaseStudy {
  problem: string[]
  whyItMatters: string[]
  objectives: string[]
  constraints: string[]
  architecture: Architecture
  methods: Method[]
  stack: { group: string; items: string[] }[]
  contribution: string[]
  implementation: string[]
  validation: string[]
  results: string[]
  limitations: string[]
  nextSteps: string[]
  artifacts: { label: string; href?: string; note: string }[]
}

export type CoverKind =
  | 'beam'
  | 'matching'
  | 'survival'
  | 'trajectory'
  | 'correlation'
  | 'rag'
  | 'factorization'
  | 'seasonal'

export interface Project {
  slug: string
  index: string
  title: string
  /** One-line positioning. */
  kicker: string
  summary: string
  domains: string[]
  context: string
  period: string
  status: ProjectStatus
  statusNote: string
  featured: boolean
  cover: CoverKind
  /**
   * Rendered cover image (public/covers/<name>-{800,1600}.webp), produced by `npm run covers`
   * from the project's own mathematics. Featured projects only.
   */
  image?: { name: string; alt: string }
  /** The project's colour identity, used behind its cover and on its case-study page. */
  tone?: 'cobalt' | 'paper' | 'copper' | 'sage' | 'night'
  metrics: Metric[]
  caseStudy: CaseStudy
  evidence: { source: EvidenceSource; note: string }[]
  /** Facts the owner still needs to supply. Rendered visibly in the case study. */
  missing: string[]
  links: ExternalLink[]
}

export interface ExpertiseItem {
  name: string
  maturity: Maturity
  context: string
}

export interface ExpertiseDomain {
  id: string
  index: string
  title: string
  short: string
  summary: string
  glyph: 'neural' | 'spectrum' | 'constellation' | 'pipeline' | 'pointcloud' | 'graph'
  items: ExpertiseItem[]
}

export interface Role {
  title: string
  period: string
  start: string
  end: string | null
  note?: string
}

export interface Experience {
  company: string
  location: string
  roles: Role[]
  summary: string
  streams: { title: string; points: string[] }[]
  source: EvidenceSource
}

export interface Credential {
  title: string
  issuer: string
  date: string
  kind: 'degree' | 'programme' | 'course' | 'assessment'
  detail?: string
  verifyUrl?: string
  image?: string
  source: EvidenceSource
}

export interface NotebookEntry {
  topic: string
  date: string
  pages: number
  area: string
}
