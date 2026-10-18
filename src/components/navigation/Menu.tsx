import { useEffect, useRef, type CSSProperties } from 'react'
import { sections } from '../../content/site'
import { profile } from '../../content/profile'
import { lockScroll } from '../../lib/motion'
import { ExtLink } from '../layout/ExtLink'
import styles from './Menu.module.css'

interface Props {
  open: boolean
  onClose: () => void
  active: string | null
}

/** Full-screen menu built on the native <dialog>: focus trapping, Esc and inert background come for free. */
export function Menu({ open, onClose, active }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      lockScroll(true)
    } else if (!open && d.open) {
      d.close()
    }
  }, [open])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const onClose_ = () => {
      lockScroll(false)
      onClose()
    }
    d.addEventListener('close', onClose_)
    return () => d.removeEventListener('close', onClose_)
  }, [onClose])

  // Release the scroll lock synchronously: the dialog's 'close' event is async, and unlocking
  // mid-way through the native smooth scroll (touch devices) would cancel it.
  const closeMenu = () => {
    lockScroll(false)
    ref.current?.close()
  }

  return (
    <dialog ref={ref} className={`theme-indigo ${styles.menu}`} aria-label="Site menu">
      <div className={styles.inner}>
        <div className={styles.head}>
          <span className="label">Navigate</span>
          <button type="button" className="btn btn--small" onClick={closeMenu} autoFocus>
            Close
          </button>
        </div>
        <nav aria-label="Sections">
          <ol className={styles.list} role="list">
            {sections
              .filter((s) => s.id !== 'top')
              .map((s, i) => (
                <li key={s.id} style={{ '--i': i } as CSSProperties}>
                  <a href={`#${s.id}`} aria-current={active === s.id ? 'location' : undefined} onClick={closeMenu}>
                    <span className={styles.index}>{s.index}</span>
                    <span className={styles.title}>{s.label}</span>
                  </a>
                </li>
              ))}
          </ol>
        </nav>
        <div className={styles.foot}>
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
          <ExtLink href={profile.links.linkedin}>LinkedIn</ExtLink>
          <ExtLink href={profile.links.github}>GitHub</ExtLink>
          <a href={profile.resume.href} download>
            Résumé (PDF)
          </a>
        </div>
      </div>
    </dialog>
  )
}
