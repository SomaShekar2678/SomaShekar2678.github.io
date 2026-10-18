import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { finePointer } from './env'

gsap.registerPlugin(ScrollTrigger)

/**
 * One motion engine: GSAP drives every timeline; Lenis (desktop, motion allowed) only smooths
 * wheel input and feeds ScrollTrigger. Native scrolling, keyboard scrolling and the scrollbar are preserved.
 */
let lenis: Lenis | null = null
let reducedMotion = true

export function initMotion(reduced: boolean): () => void {
  reducedMotion = reduced
  const root = document.documentElement
  root.classList.toggle('motion', !reduced)
  if (reduced || !finePointer()) {
    return () => root.classList.remove('motion')
  }
  lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 0.95, smoothWheel: true })
  const onScroll = () => ScrollTrigger.update()
  lenis.on('scroll', onScroll)
  const tick = (time: number) => lenis?.raf(time * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
  return () => {
    gsap.ticker.remove(tick)
    lenis?.destroy()
    lenis = null
    root.classList.remove('motion')
  }
}

export function scrollToTarget(target: string | HTMLElement | number, { immediate = false } = {}) {
  const el = typeof target === 'string' ? document.getElementById(target) : target
  if (el === null) return
  if (lenis && !immediate) {
    lenis.scrollTo(el as HTMLElement | number, { offset: 0, duration: 1.3 })
    return
  }
  if (typeof el === 'number') window.scrollTo({ top: el, behavior: immediate || reducedMotion ? 'auto' : 'smooth' })
  else el.scrollIntoView({ behavior: immediate || reducedMotion ? 'auto' : 'smooth', block: 'start' })
}

export function lockScroll(locked: boolean) {
  if (lenis) {
    if (locked) lenis.stop()
    else lenis.start()
  }
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

export function isReducedMotion() {
  return reducedMotion
}

export { gsap, ScrollTrigger }
