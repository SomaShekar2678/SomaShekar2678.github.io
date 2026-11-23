# Scene02 pacing validation — 2026-11-23

- `npm run check`: passed strict TypeScript, lint, **47 unit tests** and production build.
- New timing tests verify 4× Scene02 allocation, 80% dwell, unchanged scroll distances for every other scene, inverse mapping, and boundary continuity.
- Visual review executed with one Chrome/SwiftShader browser: 1440×900, 1280×800, touch 390×844, 820×1180 and 844×390. A–E and both neighbouring transitions captured; no recorded console/network errors or touch-layout overflow. Evidence: [review/scene02-pacing/](review/scene02-pacing/).
- Targeted production-browser journey/overflow suite: **12 passed, 4 intentional mobile skips**, one worker, 1.2 minutes. Includes phase traversal/reversal, neighbour scenes, skip navigation, reduced motion, WebGL/asset failure and context loss. Older full-site results below remain historical.
- Scope: weighted progress mapping, desktop section height, inverse mapping in poster/review tools, matching tests and documentation. No artwork, scene geometry, data model, other chapter pace or fallback behaviour changes.
- Limitations: elapsed duration still depends on visitor scroll speed; fast scrollbar jumps can still skip ahead. Real phones, Firefox and Safari were not tested. No additional owner content or assets required.
- Run locally with `npm run dev`; verify with `npm run check`. Existing pushes to main deploy through GitHub Pages. [SCENE02.md](SCENE02.md) records timing and changed files.

---

# Scene 02 validation — 2026-11-17

Current implementation details, scientific assumptions, assets and reproduction commands: [SCENE02.md](SCENE02.md).

| Executed check | Result |
| --- | --- |
| `npm run check` | Passed: strict TypeScript, lint, 45 unit tests in 6 files, production build. |
| Final test/QA-script TypeScript and lint | Passed after correcting the new browser test. |
| Full production-browser run, one worker | 53 passed, 6 intentional mobile skips, 1 initial failure in the new exact-phase test. |
| Corrected exact-phase test, desktop | 1 passed, including all five phases, Scene01/03 neighbours and reverse scrolling. All 54 applicable browser checks have passed across these runs. |
| Screenshot review | A–E plus original flights captured; rendered portfolio at 1440×900 and 1280×800; touch fallback at 390×844, 820×1180 and 844×390. |
| Scope comparison | Scene01, 03–06 builders, portals, camera stations, resize, journey timing, section JSX/CSS and content unchanged. |
| Renderer complexity (final captures) | A/B: 48 calls, 160,792 triangles; C: 15 / 50,446; D: 36 / 2,856; E: 23 / 79,642. Largest inspected transition: 57 / 181,656. Within stated complexity budgets. |
| Production bundle | Complete lazy journey chunk 47.31 kB raw / 17.49 kB gzip, within the 25 kB gzip budget. |
| `git diff --check` | Passed. |

**Initial failure and resolution:** the new test treated a wheel delta as an absolute scroll displacement. Lenis applies a 0.95 wheel multiplier and accumulates against an animated target, so a second delta could overshoot the intended phase. A first attempted fix waited for the unscaled target and timed out 58 px short. The final test uses the supported native scrollbar path for exact positions, then waits for actual scroll position and the rendered phase. The corrected test passed in 22.4 seconds. No production motion code was changed. Earlier interactive screenshot runs also exercised actual wheel movement.

The other 53 checks cover the existing page/links/resume, keyboard navigation, lab controls, all case studies, axe audits, reduced motion, missing-texture fallback, explicit WebGL fallback and context loss. No app console/network failures were observed in the completed visual review. The development-only studio initially requested a nonexistent favicon; it now references the existing icon and the review records no errors.

Screenshots and renderer counters: [review/scene02/](review/scene02/). Generated geometry falls to zero on disposal; one internal texture slot remains in renderer statistics before context release. Hardware-GPU frame rate, Safari/Firefox, real phones and a manual screen-reader walkthrough were not verified. No numerical visual-quality score or operational RF-performance claim is made. Mobile and reduced-motion visitors retain illustrated panels.

The workflow deployment and live Scene02 check are verified after publication; their outcome is reported in the completion message. No additional personal content is needed for this scene; measured RF captures remain optional future input.

---

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

#### Against the live deployment (https://somashekar2678.github.io/), after commit 2c70b85 (includes the journey render-loop fix)

| Check | Result |
|---|---|
| GitHub Actions deploy run (type-check, lint, unit tests, build, publish) | ✅ success |
| Live HTML carries the new theme colour; covers served as `image/webp` (200) | ✅ |
| `BASE_URL=… npx playwright test --project=desktop` | ✅ 25 / 25 passed |
| `BASE_URL=… npx playwright test --project=mobile` | ✅ 22 passed, 3 skipped |

## What the unit tests cover

- **Array maths** (`beamforming.test.ts`, 12 tests): unit-modulus steering vectors; the linear solver round-trips; MVDR is distortionless (wᴴa = 1); MVDR null < −35 dB at a 40 dB jammer; LCMV gives an exact zero; MVDR beats the conventional beam's SINR by > 20 dB; the M − 1 degrees-of-freedom limit; MUSIC locates the jammer to within 6°.
- **GPS C/A codes** (3): PRN 1 first chips = octal 1440; autocorrelation takes only {1023, −1, −65, 63}; cross-correlation is bounded.
- **Lab model** (7): azimuth convention; MVDR vs conventional; MUSIC accuracy; LCMV on MUSIC estimates nulls two jammers; every preset × method is finite; a close jammer limits SINR; the method comparison cut is normalised to 0 dB at the satellite and shows adaptive nulls > 25 dB below the conventional sidelobe at the jammer.
- **Journey path** (5): one caption per stage; starts and ends correctly; clamps; dwell-then-travel is continuous; visits every stage in order.
- **Content integrity** (13): unique slugs; valid statuses and maturities; every case-study chapter filled; evidence on every project and a source on every metric; no `validated`/`production` statuses (none is documented); research labelled as research; https-only links; no placeholder markers; key résumé facts; the phone number is never rendered; certificates link to verification pages.

### What the end-to-end tests cover (each viewport)

All sections render with **no console errors, page errors, failed requests or HTTP ≥ 400**; no horizontal overflow; skip link → `main` focus; menu is a modal dialog (opens, Escape closes, link navigates and scrolls); expertise signal-chain tabs with arrow keys; **all 8 case studies** render 11 chapters with no errors; card → case study → back; not-found routes; all external links `target=_blank rel=noopener`; mailto present; résumé PDF served (200, `application/pdf`); every `#/work/` link resolves; certificate images load; lab controls change the model (method, preset, keyboard slider, reset) and the "Compare methods" view draws three beamformers; all five rendered covers load with "illustrative render" alt text; reduced motion leaves headlines unmasked and covers unhidden; `?webgl=0` fallback shows the pre-rendered hero still with no errors; **axe-core WCAG 2.1 AA audit** of home and a case study (0 serious or critical violations); the signal's journey advances through its stages on scroll and its canvas keeps drawing frames (desktop), its skip link works, the full story is exposed to screen readers, and it falls back to panels without WebGL and on phones.

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
- the journey's 3D scene frozen on its first frame in production builds (found in the live overview screenshots; see DECISIONS);
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

## Journey realism upgrade — 15 November 2026

- `npm run check`: strict type checking, lint, all 40 unit tests and production build passed.
- `npm ls --depth=0`: installed dependency tree valid. No dependency changes.
- Matched-scroll screenshots reviewed for all six scenes at 1440×900; five transition positions captured; desktop 1280×800, touch tablet 820×1180, mobile 390×844 and landscape 844×390 inspected. No horizontal overflow or console errors in the review run.
- The camera stations, world spacing, camera interpolation and perception trajectory were compared against the baseline source and are unchanged. `journeyPath.ts`, narrative and section height were not changed.
- Added browser checks for Earth-texture failure, WebGL context loss, reduced-motion posters without Earth texture downloads, and the served licensing page.
- Initial desktop run: 28 passed / 1 failed. The frame-progress sample ran before the eased camera and first-use shader compilation settled. Reduced draw calls through instancing, added responsive economy mode, and made the test wait for the actually rendered final scene. The unchanged frame-count assertion passed in the targeted rerun.
- Renderer counters, asset budgets, modelling limitations and image sources: [JOURNEY_REALISM.md](JOURNEY_REALISM.md).
- Before/after comparisons: [visual review](review/journey-realism/README.md).
- Only Chrome/SwiftShader and emulated mobile/touch viewports tested. Safari, Firefox, real phone GPUs and hardware FPS are unverified. The separately mentioned `portfolio.webm` was not available; baseline comparison used the running pre-change site.
- Final production browser regression: **53 passed, 5 intentionally skipped** (29/29 desktop; 24 mobile passes plus 5 desktop-only skips), one worker, 2.7 minutes. Includes keyboard navigation, axe home/case-study audits, all case studies, lab controls, live journey rendering, fallback and licensing checks.
