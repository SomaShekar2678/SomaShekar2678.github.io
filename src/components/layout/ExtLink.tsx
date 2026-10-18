import type { AnchorHTMLAttributes, ReactNode } from 'react'

/** External link: new tab, no opener, and an accessible hint. */
export function ExtLink({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
