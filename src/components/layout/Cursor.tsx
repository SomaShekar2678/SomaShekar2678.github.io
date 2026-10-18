import { useEffect, useRef } from 'react'
import { finePointer } from '../../lib/env'
import styles from './Cursor.module.css'

const INTERACTIVE = 'a, button, [role="tab"], input, select, label, summary, [data-cursor]'

/**
 * An unobtrusive ring that tracks the pointer 1:1 (no artificial lag) and grows over interactive
 * elements, optionally showing a short label from data-cursor. The native cursor is kept.
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !finePointer()) return
    let raf = 0
    let x = -100
    let y = -100
    const paint = () => {
      raf = 0
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(paint)
      const target = (e.target as Element | null)?.closest?.(INTERACTIVE) as HTMLElement | null
      const label = target?.dataset.cursor ?? ''
      el.dataset.state = target ? (label ? 'label' : 'hover') : 'idle'
      if (labelRef.current && labelRef.current.textContent !== label) labelRef.current.textContent = label
      el.dataset.visible = 'true'
    }
    const onLeave = () => (el.dataset.visible = 'false')
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div ref={ref} className={styles.cursor} data-state="idle" data-visible="false" aria-hidden="true">
      <span className={styles.ring} />
      <span ref={labelRef} className={styles.label} />
    </div>
  )
}
