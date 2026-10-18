import { useSyncExternalStore } from 'react'

/**
 * Minimal hash router. Hash routes work on every static host and sub-path without rewrites.
 *   #/                 → home
 *   #about             → home, scrolled to a section
 *   #/work/<slug>      → project case study
 *   anything else "#/…" → not found
 */
export type Route =
  | { name: 'home'; section: string | null }
  | { name: 'project'; slug: string }
  | { name: 'notfound'; path: string }

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '')
  if (h === '' || h === '/') return { name: 'home', section: null }
  if (!h.startsWith('/')) return { name: 'home', section: decodeURIComponent(h) }
  const m = /^\/work\/([a-z0-9-]+)\/?$/.exec(h)
  if (m) return { name: 'project', slug: m[1]! }
  return { name: 'notfound', path: h }
}

const listeners = new Set<() => void>()
let current = typeof window === 'undefined' ? '' : window.location.hash

function emit() {
  current = window.location.hash
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', emit)
  window.addEventListener('popstate', emit)
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => '',
  )
}

export function useRoute(): Route {
  return parseHash(useHash())
}

/** Navigate without a jump: pushes history, notifies subscribers. */
export function navigate(hash: string, { replace = false } = {}) {
  const target = hash.startsWith('#') ? hash : `#${hash}`
  if (target === window.location.hash) {
    emit()
    return
  }
  if (replace) history.replaceState(null, '', target)
  else history.pushState(null, '', target)
  emit()
}

export const projectHref = (slug: string) => `#/work/${slug}`
