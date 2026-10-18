import { useEffect, useRef } from 'react'

/** Calls `onProgress` with page scroll progress 0..1 (rAF-throttled, no React state). */
export function useScrollProgress(onProgress: (p: number) => void) {
  const cb = useRef(onProgress)
  useEffect(() => {
    cb.current = onProgress
  })
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      cb.current(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])
}
