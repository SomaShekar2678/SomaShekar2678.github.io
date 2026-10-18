import { useEffect, useState } from 'react'

/** Query-string overrides make fallbacks testable: ?webgl=0, ?motion=0. */
function flag(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  if (flag('motion') === '0') return true
  return window.matchMedia(REDUCED_QUERY).matches
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_QUERY)
    const onChange = () => setReduced(prefersReducedMotion())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

let webglCache: boolean | null = null

/** True when a WebGL context can actually be created. Result is cached; the probe context is released. */
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache
  if (typeof document === 'undefined' || flag('webgl') === '0') return (webglCache = false)
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    webglCache = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglCache = false
  }
  return webglCache
}

export type DeviceTier = 'low' | 'mid' | 'high'

/** Coarse capability estimate used to scale particle counts, grid resolution and pixel ratio. */
export function deviceTier(): DeviceTier {
  if (typeof window === 'undefined') return 'low'
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  if (cores <= 4 || memory <= 4) return 'low'
  if (coarse || small) return 'mid'
  return 'high'
}

export function finePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}
