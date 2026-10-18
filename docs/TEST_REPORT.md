# Test report — 2026-10-18

Environment: Ubuntu Linux (6.8 kernel), Node 24.22.0 LTS, Google Chrome (system install) driven by Playwright 1.64.1. WebGL ran in software (SwiftShader). Every result below was produced by actually running the command.

## Automated checks

| Check | Command | Result |
|---|---|---|
| TypeScript (strict) | `npm run typecheck` | ✅ 0 errors |
| ESLint | `npm run lint` | ✅ 0 problems |
| Unit tests | `npm test` | ✅ 39 / 39 passed (5 files) |
| Production build | `npm run build` | ✅ built |
| E2E — desktop 1440×900 | `npx playwright test --project=desktop` | ✅ 24 / 24 passed |
| E2E — mobile (Pixel 7 emulation) | `npx playwright test --project=mobile` | ✅ 21 passed, 3 skipped (keyboard-only and desktop-only tests, by design) |

#### Against the live deployment (https://somashekar2678.github.io/)

| Check | Result |
|---|---|
| GitHub Actions deploy run (type-check, lint, unit tests, build, publish) | ✅ success |
| HTTP checks: `/`, OG image, résumé PDF, robots, sitemap, icons, certificate images | ✅ 200 with correct content types; unknown path → 404 page |
| Built bundle served (not raw source); canonical URL present | ✅ |
| `BASE_URL=… npx playwright test --project=desktop` | ✅ 24 / 24 passed (including the journey, after commit 300fe5a) |
| `BASE_URL=… npx playwright test --project=mobile` | ✅ 21 passed, 3 skipped |

## What the unit tests cover

- **Array maths** (`beamforming.test.ts`, 12 tests): unit-modulus steering vectors; the linear solver round-trips; MVDR is distortionless (wᴴa = 1); MVDR null < −35 dB at a 40 dB jammer; LCMV gives an exact zero; MVDR beats the conventional beam's SINR by > 20 dB; the M − 1 degrees-of-freedom limit; MUSIC locates the jammer to within 6°.
- **GPS C/A codes** (3): PRN 1 first chips = octal 1440; autocorrelation takes only {1023, −1, −65, 63}; cross-correlation is bounded.
- **Lab model** (6): azimuth convention; MVDR vs conventional; MUSIC accuracy; LCMV on MUSIC estimates nulls two jammers; every preset × method is finite; a close jammer limits SINR.
- **Journey path** (5): one caption per stage; starts and ends correctly; clamps; dwell-then-travel is continuous; visits every stage in order.
- **Content integrity** (13): unique slugs; valid statuses and maturities; every case-study chapter filled; evidence on every project and a source on every metric; no `validated`/`production` statuses (none is documented); research labelled as research; https-only links; no placeholder markers; key résumé facts; the phone number is never rendered; certificates link to verification pages.

### What the end-to-end tests cover (each viewport)

All sections render with **no console errors, page errors, failed requests or HTTP ≥ 400**; no horizontal overflow; skip link → `main` focus; menu is a modal dialog (opens, Escape closes, link navigates and scrolls); expertise tabs with arrow keys; **all 8 case studies** render 11 chapters with no errors; card → case study → back; not-found routes; all external links `target=_blank rel=noopener`; mailto present; résumé PDF served (200, `application/pdf`); every `#/work/` link resolves; certificate images load; lab controls change the model (method, preset, keyboard slider, reset); reduced motion leaves content visible; `?webgl=0` fallback works with no errors; **axe-core WCAG 2.1 AA audit** of home and a case study (0 serious or critical violations); the signal's journey advances through its stages on scroll (desktop), its skip link works, the full story is exposed to screen readers, and it falls back to panels without WebGL and on phones.

## Visual inspection performed

Screenshots were taken and reviewed at 1440×900 (whole home page, J-DOME case study) and 390×844 touch (whole home page), and the hero was re-checked after each fix. Defects found this way and fixed: hero composition behind the headline; satellite label off-screen; mobile label/readout overlap; architecture diagram overflowing; olive-tinted globe overlay; inconsistent month labels; an odd date field on the PGP card; misleading −130 dB null readouts.

## Performance (measured)

| Asset | gzip |
|---|---|
| App JS (React + app, initial) | 107 KB |
| GSAP + Lenis (preloaded) | 48 KB |
| CSS | 13 KB |
| Three.js (loaded on demand by the hero) | 131 KB |
| Hero scene / Beam lab chunks (lazy) | 4.5 KB / 7.1 KB |

The whole `dist/` is 2.0 MB, including fonts, the 284 KB OG image and the résumé. The loader cleared in 1.3–1.8 s on localhost with software WebGL. It measures fonts, the scene module and the first frame, with a 4 s cap. Rendering pauses when the hero is off-screen or the tab is hidden. DPR is capped per device tier.

**Not measured:** Lighthouse scores, real-device GPU performance, and real network throttling. Lighthouse was not run because of memory limits on the build machine.

## Not verified

- Safari / Firefox engines (only Chrome was available for automation; Firefox is installed but was not run, to save memory).
- Real touch devices (mobile was emulated).
- Screen-reader walkthrough (structure is checked by axe and semantic tests only).
- LinkedIn URL responds with HTTP 999 to automated requests (its bot block). It is the URL on every résumé, but it was not opened in a logged-in browser.
