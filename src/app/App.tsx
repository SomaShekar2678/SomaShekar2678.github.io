import { lazy, Suspense, useEffect, useRef } from 'react'
import { Loader } from '../components/layout/Loader'
import { Nav } from '../components/navigation/Nav'
import { Footer } from '../components/layout/Footer'
import { Cursor } from '../components/layout/Cursor'
import { ScrollRail } from '../components/navigation/ScrollRail'
import { SkipLink } from '../components/accessibility/SkipLink'
import { Home } from '../pages/Home'
import { NotFound } from '../pages/NotFound'
import { useReducedMotion } from '../lib/env'
import { initMotion, scrollToTarget, ScrollTrigger } from '../lib/motion'
import { initReveals } from '../lib/reveal'
import { completeSceneTasks, completeTask } from '../lib/loading'
import { navigate, useHash, parseHash } from '../lib/router'

const CaseStudy = lazy(() => import('../pages/CaseStudy'))

export function App() {
  const hash = useHash()
  const route = parseHash(hash)
  const reduced = useReducedMotion()

  useEffect(() => initMotion(reduced), [reduced])
  // The 3D scene only exists on the home page; elsewhere its loading steps do not apply.
  useEffect(() => {
    if (route.name !== 'home') completeSceneTasks()
  }, [route.name])
  useEffect(() => initReveals(document.getElementById('root')!), [])

  useEffect(() => {
    let done = false
    const finish = () => {
      if (!done) completeTask('fonts')
      done = true
    }
    document.fonts.ready.then(finish, finish)
    const t = window.setTimeout(finish, 2500)
    return () => window.clearTimeout(t)
  }, [])

  // In-page anchors go through the router so scrolling is smooth (Lenis) and history stays correct.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element).closest?.('a[href^="#"]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank') return
      const href = a.getAttribute('href')!
      if (href === '#') return
      e.preventDefault()
      navigate(href)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Route effects: scroll to section, or to the top of a new page.
  // Arriving from another page jumps straight to the section; within the home page it scrolls smoothly.
  const section = route.name === 'home' ? route.section : null
  const prevRoute = useRef(route.name)
  useEffect(() => {
    const cameFromOtherPage = prevRoute.current !== route.name
    prevRoute.current = route.name
    const id = window.requestAnimationFrame(() => {
      // A new page means new layout, so ScrollTrigger must re-measure. Do it BEFORE scrolling:
      // refresh() restores the scroll position it recorded, which would cancel a native smooth scroll.
      if (cameFromOtherPage) ScrollTrigger.refresh()
      if (section) {
        const el = document.getElementById(section)
        if (el) {
          // Move focus to the section heading for assistive tech, without scrolling.
          el.querySelector<HTMLElement>('h2, h1')?.focus({ preventScroll: true })
          scrollToTarget(el, { immediate: cameFromOtherPage })
        }
      } else if (route.name !== 'home' || hash === '' || hash === '#/') {
        scrollToTarget(0, { immediate: true })
      }
    })
    return () => window.cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  return (
    <>
      <SkipLink />
      <Loader />
      <Nav route={route} />
      <main id="main" tabIndex={-1}>
        {route.name === 'home' ? (
          <Home />
        ) : route.name === 'project' ? (
          <Suspense fallback={<div style={{ minHeight: '100vh' }} aria-busy="true" />}>
            <CaseStudy slug={route.slug} />
          </Suspense>
        ) : (
          <NotFound />
        )}
      </main>
      <Footer />
      <ScrollRail enabled={route.name === 'home'} />
      <Cursor />
    </>
  )
}
