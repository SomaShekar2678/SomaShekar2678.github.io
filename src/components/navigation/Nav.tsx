import { useEffect, useState } from 'react'
import { sections } from '../../content/site'
import { profile } from '../../content/profile'
import { useActiveSection } from '../../hooks/useActiveSection'
import type { Route } from '../../lib/router'
import { Menu } from './Menu'
import styles from './Nav.module.css'

const ids = sections.map((s) => s.id)

export function Nav({ route }: { route: Route }) {
  const isHome = route.name === 'home'
  const active = useActiveSection(ids, isHome)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [tone, setTone] = useState<'light' | 'dark'>('light')

  // The nav sits over chapters of different colours: read the tone of whatever is under it.
  // Chapters declare it with data-nav="dark"; everything else is light paper.
  useEffect(() => {
    let raf = 0
    const measure = () => {
      raf = 0
      setScrolled(window.scrollY > 24)
      const y = 36
      let next: 'light' | 'dark' = 'light'
      for (const el of document.querySelectorAll<HTMLElement>('[data-nav]')) {
        const r = el.getBoundingClientRect()
        if (r.top <= y && r.bottom > y) next = el.dataset.nav === 'dark' ? 'dark' : 'light'
      }
      setTone(next)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [route.name])

  const current = sections.find((s) => s.id === active)
  const where = isHome ? (current && current.id !== 'top' ? `${current.index} / ${current.label}` : 'Index') : route.name === 'project' ? 'Case study' : 'Not found'

  return (
    <header className={`${styles.nav} ${scrolled ? styles.scrolled : ''} ${tone === 'dark' ? 'theme-night' : 'theme-paper'}`} data-tone={tone}>
      <a className={styles.mark} href="#top" aria-label={`${profile.name} — back to top`}>
        <span className={styles.markName}>{profile.shortName}</span>
        <span className={styles.markRole}>{profile.role}</span>
      </a>
      <p className={styles.where} aria-live="off">
        <span className={styles.whereDot} aria-hidden="true" />
        <span key={where} className={styles.whereText}>
          {where}
        </span>
      </p>
      <nav className={styles.actions} aria-label="Primary">
        <a className={`btn btn--ghost btn--small ${styles.hideSm}`} href="#work">
          Work
        </a>
        <a className={`btn btn--ghost btn--small ${styles.hideSm}`} href="#lab">
          Lab
        </a>
        <a className={`btn btn--small ${styles.hideSm}`} href="#contact">
          <span className="dot" aria-hidden="true" /> Let’s talk
        </a>
        <button type="button" className={`btn btn--small btn--ghost ${styles.menuBtn}`} aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          Menu
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
      </nav>
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} active={isHome ? active : null} />
    </header>
  )
}
