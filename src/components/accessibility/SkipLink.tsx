import styles from './SkipLink.module.css'

export function SkipLink() {
  return (
    <a
      className={styles.skip}
      href="#main"
      onClick={(e) => {
        e.preventDefault()
        const main = document.getElementById('main')
        main?.focus()
        main?.scrollIntoView()
      }}
    >
      Skip to content
    </a>
  )
}
