import { useRef } from 'react'
import type { Project } from '../../types/content'
import { useInView } from '../../hooks/useInView'
import { ProjectCover } from './ProjectCover'

/**
 * A project's cover: the rendered still (two WebP widths, explicit size so nothing shifts),
 * or the generative SVG cover for projects without one.
 *
 * Loading is progressive, driven by an observer about 1.5 viewports ahead. Never clip-path the image
 * itself while it waits: Chrome's observers (and native lazy loading) treat a fully clipped element as
 * invisible, so it would never load — the reveal uses a panel over the image instead (Work.module.css).
 */
export function CoverImage({ project, sizes, eager = false, className }: { project: Project; sizes: string; eager?: boolean; className?: string }) {
  const ref = useRef<HTMLImageElement>(null)
  const near = useInView(ref, { rootMargin: '150% 0px', once: true })
  if (!project.image) return <ProjectCover kind={project.cover} />
  const base = `./covers/${project.image.name}`
  const load = eager || near
  return (
    <img
      ref={ref}
      className={className}
      src={load ? `${base}-1600.webp` : undefined}
      srcSet={load ? `${base}-800.webp 800w, ${base}-1600.webp 1600w` : undefined}
      sizes={sizes}
      width={1600}
      height={1100}
      alt={project.image.alt}
      decoding="async"
      // The reveal waits for the pixels, so the panel never lifts off an empty frame.
      onLoad={(e) => {
        const el = e.currentTarget
        el.dataset.loaded = 'true'
        if (el.parentElement) el.parentElement.dataset.loaded = 'true'
      }}
    />
  )
}
