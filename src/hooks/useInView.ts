import { useEffect, useState, type RefObject } from 'react'

/** Visibility of an element. With `once`, stays true after the first intersection (for lazy mounting). */
export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  { rootMargin = '0px', once = false, threshold = 0 }: { rootMargin?: string; once?: boolean; threshold?: number } = {},
): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = !!entry?.isIntersecting
        setInView(v)
        if (v && once) io.disconnect()
      },
      { rootMargin, threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin, once, threshold])
  return inView
}
