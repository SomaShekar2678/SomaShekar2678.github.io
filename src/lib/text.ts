/**
 * Headline markup used by SplitText and the About statement:
 *   `*words*` — set in the italic serif accent;  ` / ` — a deliberate line break.
 * plainText() strips the markers for screen readers and document titles.
 */
export function plainText(text: string) {
  return text.replace(/\*/g, '').replace(/\s+\/\s+/g, ' ')
}
