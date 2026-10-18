/**
 * Reveal controller: one IntersectionObserver for every [data-reveal] and .split element,
 * plus a MutationObserver so lazily rendered sections are picked up automatically.
 * CSS (html.motion) defines the hidden/visible states; without motion nothing is hidden.
 */
export function initReveals(root: HTMLElement): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  )

  const scan = (node: ParentNode) => {
    node.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in), [data-reveal-media]:not(.is-in), .split:not(.is-in)').forEach((el) => io.observe(el))
  }
  scan(root)

  const mo = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          if (n.matches('[data-reveal], [data-reveal-media], .split')) io.observe(n)
          scan(n)
        }
      })
    }
  })
  mo.observe(root, { childList: true, subtree: true })

  return () => {
    io.disconnect()
    mo.disconnect()
  }
}
