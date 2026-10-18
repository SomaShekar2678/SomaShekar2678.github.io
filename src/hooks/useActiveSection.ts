import { useEffect, useState } from 'react'

/** Scroll-spy: the id of the section currently crossing the middle of the viewport. */
export function useActiveSection(ids: readonly string[], enabled = true): string {
  const [active, setActive] = useState(ids[0] ?? '')
  useEffect(() => {
    if (!enabled) return
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-45% 0px -54% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [ids, enabled])
  return active
}
