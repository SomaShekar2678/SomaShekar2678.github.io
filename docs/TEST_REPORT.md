# Test report — 2026-10-19 (redesign v2)

Environment: Ubuntu Linux (6.8 kernel), Node 24.22.0 LTS, Google Chrome (system install) driven by Playwright 1.64.1. WebGL ran in software (SwiftShader). Every result below was produced by actually running the command.

## Automated checks

| Check | Command | Result |
|---|---|---|
| TypeScript (strict) | `npm run typecheck` | ✅ 0 errors |
| ESLint | `npm run lint` | ✅ 0 problems |
| Unit tests | `npm test` | ✅ 40 / 40 passed (5 files) |
| Production build | `npm run build` | ✅ built |
| E2E — desktop 1440×900 | `npx playwright test --project=desktop` | ✅ 25 / 25 passed |
| E2E — mobile (Pixel 7 emulation) | `npx playwright test --project=mobile` | ✅ 22 passed, 3 skipped (keyboard-only and desktop-only tests, by design) |

#### Against the live deployment (https://somashekar2678.github.io/) — v1, before the redesign

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
- **Lab model** (7): azimuth convention; MVDR vs conventional; MUSIC accuracy; LCMV on MUSIC estimates nulls two jammers; every preset × method is finite; a close jammer limits SINR; the method comparison cut is normalised to 0 dB at the satellite and shows adaptive nulls > 25 dB below the conventional sidelobe at the jammer.
- **Journey path** (5): one caption per stage; starts and ends correctly; clamps; dwell-then-travel is continuous; visits every stage in order.
- **Content integrity** (13): unique slugs; valid statuses and maturities; every case-study chapter filled; evidence on every project and a source on every metric; no `validated`/`production` statuses (none is documented); research labelled as research; https-only links; no placeholder markers; key résumé facts; the phone number is never rendered; certificates link to verification pages.

### What the end-to-end tests cover (each viewport)

All sections render with **no console errors, page errors, failed requests or HTTP ≥ 400**; no horizontal overflow; skip link → `main` focus; menu is a modal dialog (opens, Escape closes, link navigates and scrolls); expertise signal-chain tabs with arrow keys; **all 8 case studies** render 11 chapters with no errors; card → case study → back; not-found routes; all external links `target=_blank rel=noopener`; mailto present; résumé PDF served (200, `application/pdf`); every `#/work/` link resolves; certificate images load; lab controls change the model (method, preset, keyboard slider, reset) and the "Compare methods" view draws three beamformers; all five rendered covers load with "illustrative render" alt text; reduced motion leaves headlines unmasked and covers unhidden; `?webgl=0` fallback shows the pre-rendered hero still with no errors; **axe-core WCAG 2.1 AA audit** of home and a case study (0 serious or critical violations); the signal's journey advances through its stages on scroll (desktop), its skip link works, the full story is exposed to screen readers, and it falls back to panels without WebGL and on phones.

## Visual inspection performed (v2)

**Before the redesign.** The live v1 site was captured at 1440×900 (25 screens) and 390×844 touch (29 screens), and lusion.co was re-inspected in Chrome (opening, work grid, the lower astronaut sequence, footer). The audit in `docs/DECISIONS.md` comes from these captures.

**During and after the redesign**, screenshots were taken and reviewed:
- the whole home page at 1440×900 (twice) and 390×844 touch;
- the hero at 1440×900, 1280×800, 820×1180 (tablet, touch) and 390×844, plus `?webgl=0`;
- the hero → journey aperture mid-transition;
- the Work chapter at several offsets (desktop and tablet);
- the J-DOME case study;
- each rendered cover and the OG card.

**Defects found by looking and fixed:**
- the name overflowing the first viewport;
- the figure caption over the sculpture;
- the interferer off-screen (re-aimed);
- the satellite colliding with text on phones and tablets (stacked order and per-aspect camera);
- collapsed word spacing in every split headline;
- covers never revealing (clip-path vs IntersectionObserver);
- the expertise flow labels overlapping the blocks;
- the method feedback loop crossing the step text;
- career-ruler labels colliding on phones;
- the wordmark colliding with page text when scrolled;
- the dark-navy globe fill on the copper chapter;
- a washed-out terrain cover.

## Performance (measured)

| Asset | gzip |
|---|---|
| App JS (React + app, initial) | 116 KB |
| GSAP + Lenis | 49 KB |
| CSS | 17 KB |
| Three.js (on demand) | 144 KB |
| Hero scene / Journey / Beam lab chunks (lazy) | 4.6 KB / 6.7 KB / 8.6 KB |
| Project covers (5 WebP, loaded as you approach Work) | 157 KB at 800 px; 904 KB for the 1600 px set (only used for the wide J-DOME spread at 1× and on high-DPR screens) |

`dist/` is 3.3 MB, including fonts, both cover sizes, the OG image and the résumé. The hero renders only while its intro, the pointer or the scroll is changing. The journey renders only while visible. DPR is capped per device tier.

**Not measured:** Lighthouse scores, real-device GPU performance, and real network throttling. Lighthouse was not run because of memory limits on the build machine.

## Not verified

- Safari / Firefox engines (only Chrome was available for automation; Firefox is installed but was not run, to save memory).
- Real touch devices (mobile was emulated).
- Screen-reader walkthrough (structure is checked by axe and semantic tests only).
- LinkedIn URL responds with HTTP 999 to automated requests (its bot block). It is the URL on every résumé, but it was not opened in a logged-in browser.
