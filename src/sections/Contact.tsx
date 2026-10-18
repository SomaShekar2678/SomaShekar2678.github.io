import { useState } from 'react'
import { profile } from '../content/profile'
import { sectionMeta } from '../content/site'
import { SplitText } from '../components/motion/SplitText'
import { ExtLink } from '../components/layout/ExtLink'
import styles from './Contact.module.css'

export function Contact() {
  const meta = sectionMeta('contact')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      window.location.href = `mailto:${profile.email}`
    }
  }

  return (
    <section id="contact" className={`section ${styles.contact}`} aria-labelledby="contact-title">
      <div className="container">
        <p className="section-head__index label">
          <span>{meta.index}</span>
          <span>{meta.label}</span>
        </p>
        <SplitText as="h2" id="contact-title" text="Let’s build systems that hold up in the real world." className={`display ${styles.title}`} />
        <p className={`lead ${styles.lead}`} data-reveal>
          Open to conversations about GNSS and RF signal processing, perception and state estimation, embedded ML and prognostics — roles, research
          collaborations and hard problems.
        </p>

        <div className={styles.mailRow} data-reveal>
          <a className={styles.mail} href={`mailto:${profile.email}`} data-cursor="Write">
            {profile.email}
          </a>
          <button type="button" className="btn btn--ghost btn--small" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy address'}
          </button>
          <span className="sr-only" role="status">
            {copied ? 'Email address copied to clipboard' : ''}
          </span>
        </div>

        <ul className={styles.links} role="list">
          <li data-reveal>
            <ExtLink href={profile.links.linkedin} className={styles.card}>
              <span className="label">Profile</span>
              <span className={styles.cardTitle}>LinkedIn ↗</span>
              <span className={styles.cardMeta}>linkedin.com/in/somashekar39</span>
            </ExtLink>
          </li>
          <li data-reveal>
            <ExtLink href={profile.links.github} className={styles.card}>
              <span className="label">Code</span>
              <span className={styles.cardTitle}>GitHub ↗</span>
              <span className={styles.cardMeta}>github.com/SomaShekar2678</span>
            </ExtLink>
          </li>
          <li data-reveal>
            <a href={profile.resume.href} download className={styles.card}>
              <span className="label">Résumé</span>
              <span className={styles.cardTitle}>Download PDF ↓</span>
              <span className={styles.cardMeta}>Updated {profile.resume.updated}</span>
            </a>
          </li>
          <li data-reveal>
            <a href="#work" className={styles.card}>
              <span className="label">Evidence</span>
              <span className={styles.cardTitle}>Case studies →</span>
              <span className={styles.cardMeta}>Architecture, methods, status</span>
            </a>
          </li>
        </ul>
      </div>
    </section>
  )
}
