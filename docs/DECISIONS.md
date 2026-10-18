# Architectural & design decisions

## Reference analysis (lusion.co, inspected live in headless Chrome on 2026-10-18)

Observed: an Astro site with full-viewport WebGL canvases and virtual scrolling (document height equals the viewport). Typography is Aeonik plus IBM Plex Mono. The loader is black with a rolling numeric counter. The hero is framed as a rounded inset "window" with `+` registration marks and a "scroll to explore" rail. Navigation uses pill buttons. Headlines are large grotesk with staggered word reveals. A single saturated blue accent is used, plus a blue ribbon that sweeps across sections. The work grid is two columns of rounded media cards with tiny mono uppercase tags.

Translated, not copied: the inset instrument window, registration marks, measured loader counter, pill navigation, word reveals and a two-column work grid. No code, assets, text or exact compositions were reused. The site keeps **native scrolling** rather than virtual scrolling, for accessibility.

## Stack

| Decision | Reason |
|---|---|
| React 19 + TypeScript (strict, `noUncheckedIndexedAccess`) + Vite | Empty repo; the brief's baseline. |
| **Plain Three.js, not React Three Fiber** | Two imperative scenes with hand-managed render loops and disposal. Avoids a reconciler in the frame loop and one dependency. |
| GSAP + ScrollTrigger as the only animation engine; Lenis only for wheel smoothing | One timeline system. Lenis is disabled for reduced motion and touch (native scrolling there). |
| CSS Modules + design tokens (`src/styles/tokens.css`) | No CSS framework needed. Tokens give one source for colour, type, spacing, motion. |
| Self-hosted fonts via Fontsource (OFL) | Bricolage Grotesque (display), Inter (text), JetBrains Mono (labels). |
| **Hash routing** (`#/work/<slug>`) | Works on any static host and sub-path (GitHub Pages, artifact hosting) with no rewrites. A self-contained `404.html` covers unknown paths. |
| WebGL, not WebGPU | WebGPU would add no capability here; WebGL has universal support. |

## Signal's journey (scroll-driven 3D interlude)

Added after the owner pointed to Lusion's multi-world scroll sequence. It is the same idea told in this site's terms: one GNSS signal's path through the owner's work.

- One Three.js scene with six worlds spaced along −z. A single camera dwells at each world, then flies to the next through a ring portal.
- Scroll progress → stage mapping is a pure function (`src/lib/journeyPath.ts`), unit-tested, and shared by the scene and the captions.
- Driven by native `position: sticky` and a rAF scroll listener rather than GSAP pinning. This avoids the ScrollTrigger refresh/restore pitfalls found earlier.
- World 3 morphs the array pattern from conventional to MVDR as you scroll; both patterns are computed with `beamforming.ts`. World 1's waterfall shows a blue signal below the noise floor, a CW spike and a sweeping chirp.
- The scene loads one viewport ahead, renders only while visible, and is disposed on unmount. Phones, reduced motion and no WebGL get static panels.
- Bug found by screenshots: the visibility observer fired before the lazily loaded scene existed, so the render loop never started. Visibility is now synced as soon as the scene is constructed.

## Colour carries meaning

Blue = desired signal / primary action. Amber = interference. Lime = documented evidence. Colour is always paired with a text label (SAT/JAM markers, status text, maturity words), never used alone. Two extra tokens exist for contrast: `--c-signal-fill` (#3f5ce6, 5.4:1 behind white text) and `--c-signal-ink` (#2f47c4, 6.3:1 on warm white). Both were added after the axe audit flagged #5b7cff.

## Mathematical models (all labelled illustrative on the page)

- `src/lib/beamforming.ts`: narrowband far-field model, URA in the x–y plane, steering vectors, exact and sample covariance (seeded), complex Gaussian elimination, conventional/MVDR/LCMV weights, output SINR, and MUSIC via the real symmetric embedding with Jacobi rotations.
- The lab chains **MUSIC estimates into LCMV constraints**, so estimation error propagates the way it would in a real DoA → nulling pipeline.
- Null depths below −60 dB are displayed as "< −60 dB". The ideal model reaches about −130 dB, which real hardware cannot.
- The default lab jammer (azimuth 150°, elevation 10°) was chosen by scanning for a direction on a real conventional sidelobe (≈ −12 dB), so adaptation visibly matters. The first choice happened to fall in a natural −51 dB null.
- `src/lib/gnss.ts`: GPS C/A Gold-code generator, verified against the published PRN 1 first chips (octal 1440) and the Gold autocorrelation values {1023, −1, −65, 63}.
- India globe: NavIC slot longitudes from public documentation; IGSO ground tracks computed from 29° inclination. No national boundaries are drawn (avoids map-accuracy and legal issues).

## Content integrity

- Facts are taken only from what is consistent across all 32 tailored résumés, the handwritten notes, the two certificates, and public GitHub repositories.
- Tailored-CV claims that appear in only one variant are not used as headline facts.
- GPSdome2 specifications in the notes (> 92 dB J/S, etc.) belong to a **commercial product** studied in the research notes. They are not presented as the owner's results.
- The commercial receiver model named in the notes is generalised to "commercial multi-band receiver" (employer design detail).
- The phone number is never rendered on the site. It only appears inside the résumé PDF.
- `inputs/` is git-ignored: it holds private notes that contain third-party phone numbers.

## Bugs found by testing and fixed

1. **OOM crash**: parallel Playwright workers with software WebGL exhausted RAM and killed VS Code. Fixed with `workers: 1`.
2. **Mobile in-page navigation never scrolled**: `ScrollTrigger.refresh()` ran in the same frame as a native smooth scroll and restored the old position. Refresh now runs first, and only on page changes.
3. **Loader waited 4 s on case-study URLs**: the hero scene's load steps never completed off the home page.
4. **Accessibility**: contrast on blue fills, a focusable control inside the `aria-hidden` loader (now `inert`), and visually disabled but operable jammer sliders (now actually `disabled`).
5. **Hero composition**: a camera view offset moves the scene beside the headline on desktop and below the readout on mobile.
