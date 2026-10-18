import { profile } from '../../content/profile'
import { ExtLink } from './ExtLink'
import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <p className={styles.copy}>
          © {new Date().getFullYear()} {profile.name}
        </p>
        <p className={styles.note}>
          Visualizations on this site are illustrative models computed in your browser — not measurements from real hardware.
        </p>
        <ul className={styles.links} role="list">
          <li>
            <a href={`mailto:${profile.email}`}>Email</a>
          </li>
          <li>
            <ExtLink href={profile.links.linkedin}>LinkedIn</ExtLink>
          </li>
          <li>
            <ExtLink href={profile.links.github}>GitHub</ExtLink>
          </li>
          <li>
            <a href={profile.resume.href} download>
              Résumé
            </a>
          </li>
          <li>
            <a href="#top">Back to top ↑</a>
          </li>
        </ul>
      </div>
    </footer>
  )
}
