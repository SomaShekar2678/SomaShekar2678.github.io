# Scene 02 — The Invisible War

## Current sequence — array preview removed, 2026-11-23

The owner removed the standalone enlarged array preview from Scene02. The current sequence is transmitter → fields → spectrum → receiver, followed directly by the existing flight into Scene03. The preview geometry, its two field sources and its labels are deleted. The small receiving array in the ground/transmitter composition remains; Scene03's beamforming visualization is unchanged.

The flight begins at visual coordinate 0.485, where the deleted preview previously began. Scene02 now uses 2.2 scroll units (1.5 dwell + 0.7 flight); the desktop journey is 772svh. This removes the deleted chapter's interval, preserves the previous exit distance and keeps the remaining chapters at essentially the same pace. No camera route, page copy or mobile panel changes.

Files: `src/components/three/journey/interference.ts`, its builder comment in `JourneyScene.ts`, `src/lib/journeyPath.ts`, the matching unit/browser tests, and `scripts/review-scene02.ts` (four phases). No new assets or owner input. Run `npm run dev`; build with `npm run build`; deployment remains GitHub Pages on pushes to main. Earlier pacing records below are historical.

Validation for preview removal: build, type checking, lint and 47 unit tests passed. The grouped journey browser run passed both static-panel checks but timed out on the desktop loader and skip checks while only 231 MB memory was available and swap was full. Both desktop checks then passed individual retries without production changes: four-phase progression/reversal/neighbours (21.4s) and rendered-frame/skip navigation (26.8s). Two desktop-only mobile cases remain intentionally skipped. Chrome/SwiftShader renders at 1440×900 confirm the receiver, outgoing flight and unchanged Scene03; no console errors. Evidence: `review/scene02-no-preview/`. Mobile panels passed at Pixel7 emulation; no real-device or other-browser claim.

## Previous pacing — 2026-11-23, shortened after review

The four-unit revision below felt too long. Scene02 now uses **2.5 scroll units and 72% dwell**: 37.5% less total scroll, 43.75% shorter internal phases, and a 12.5% shorter outgoing flight than that revision. This keeps approximately 3.1× the original phase distance and 1.67× the original exit distance. Total desktop journey height is now **800svh**. Smoothstep transitions, camera easing, other scenes and fallback panels are unchanged. No additional assets or content are required.

Changed files: `src/lib/journeyPath.ts`, corresponding timing assertions in `tests/unit/journeyPath.test.ts`, and this report. Run with `npm run dev`; deployment uses the existing push-to-main GitHub Pages workflow.

Validation for the shorter revision: `npm run check` passed type checking, lint, 47 unit tests and production build. Targeted journey browser tests passed 4 checks with 2 intentional mobile skips. Chrome/SwiftShader visual review at the reported 1030×904 viewport exercised wheel scrolling from fields through spectrum, receiver and array into Scene03, with no console errors; 390×844 touch retained panels with zero horizontal overflow. Other browsers and real phones were not retested. Duration remains controlled by scroll speed.

## Previous pacing revision — 2026-11-23

At the owner's request, Scene02 now occupies four scroll units instead of one. Its dwell takes 80% of that interval (previously 58%), extending each internal visual phase by approximately 5.52× in scroll distance and the outgoing flight by 1.90×. The full desktop journey is 940svh instead of 660svh. Every other scene retains its previous scroll distance. No forced autoplay delay or scroll lock is introduced; the skip link remains available.

`journeyPath.ts` remaps weighted scroll progress to the existing scene-local coordinates. The phase table below therefore remains valid as a **visual coordinate**, not as a fraction of Scene02's new scroll interval. The renderer, smoothstep entrances, camera route, labels and other scene builders are unchanged. `journeyProgress()` supplies the inverse mapping to tests and poster/review tools so all snapshots still select the intended scene. Touch/reduced-motion panels are unchanged.

Files changed for pacing: `src/lib/journeyPath.ts`, `src/sections/Journey.tsx`, `src/render/journey.ts`, `scripts/review-scene02.ts`, and the journey unit/browser tests. No new assets or owner input required. See the latest test report and `review/scene02-pacing/` for validation. The original scope below describes the earlier visual upgrade; this explicit pacing revision supersedes its timing-preservation constraint.

Scope: replace the interference world only. Existing visible caption “Buried by interference,” DOM copy, navigation, global design, six camera stations, 0.58 dwell fraction, 660svh section and original portal flights are preserved. The satellite, array-adaptation, FPGA, perception and position-fix builders are unchanged. This is a procedural engineering illustration, not a claim of photorealistic captured footage.

## Implemented sequence

Local progress is within the existing second scene's slice; it is not elapsed seconds. Scroll can stop or reverse every phase.

| Phase | Local progress | Composition |
| --- | --- | --- |
| A — transmitter | 0–0.12 | Original metal dish and feed, braced mast, louvred equipment shelter, heat sink, skid supports, receiving array, rocky terrain and a distant representative navigation satellite. |
| B — fields | 0.12–0.24 | Blue desired and amber unwanted curved wavefront shells converge on the same receiving array. The dish points along the interference path. |
| C — spectrum | 0.24–0.38 | Extruded synthetic time-frequency surface. CW, swept and broadband examples show different spectral signatures. Frequency and relative PSD axes are labelled. |
| D — receiver | 0.38–0.51 | Receiver cutaway and paired PRN1 correlation plots on one fixed ordinate. Broadband J/S steps from off to 15, 30 and 45 dB. |
| E — array | 0.51–0.58 | Enlarged 4×4 receiving array with two labelled incoming directions and wavefronts. There is no suppression or adaptive-pattern claim in Scene 02. |

Short overlapping entrances translate the scene groups rather than changing the camera. The existing flight to Scene 03 starts at 0.58. Phase labels are QA metadata; they do not add a new visitor control or change the page text.

## Signal model and accuracy

- GPS L1 carrier: **1575.42 MHz**. C/A code rate: **1.023 Mchips/s**. These are distinct quantities. The US Coast Guard [GPS SPS Signal Specification](https://navcen.uscg.gov/sites/default/files/pdf/gps/sigspec/gpssps1.pdf) documents them.
- **Field visualization:** eight enlarged spherical-cap shells per source, animated in source-to-array coordinates. Grid structure, colour and alpha make depth and overlap visible. Shell spacing, propagation speed, aperture and satellite range are illustrative. This is neither a Maxwell solver nor a calibrated radiated-power field. It does not calculate absorption, multipath, polarization, scattering or spatial cancellation.
- **Spectrum:** analytic envelope, not an FFT of captured data. With `f` in MHz offset from L1, desired PSD is `0.06 sinc²(f/1.023)`, thermal PSD is 1, and added interference is nonnegative. Height is `10 log10(total PSD)` relative to that thermal reference, never dBm. Blue colour marks the known spread-spectrum envelope, whose desired power remains below the floor; it is not an assertion that the signal can be detected by looking for a tall carrier line.
- CW uses a Gaussian display kernel at +0.65 MHz; its width represents finite illustrative resolution, not the linewidth of a specific transmitter. The sweep centre moves from −1.5 to +1.5 MHz across a synthetic 1 ms history. Broadband raises the full displayed floor. Scroll changes example type and strength; this is not a recording of a real jammer switching modes. The three PSD examples and the receiver example are explanatory models, not one calibrated end-to-end RF capture.
- **Correlation:** actual discrete complex-baseband correlation with the existing PRN1 C/A generator. One 1023-chip period, eight rectangular samples/chip (8.184 Msamples/s), 1 ms coherent integration, zero residual Doppler and no navigation-bit transition. Unit desired amplitude, seeded circular complex Gaussian thermal noise at N/S=10 dB, and independent circular complex Gaussian broadband interference. Its amplitude scales as `sqrt(J/S)`. Evaluate 65 delay bins over ±4 chips. Normalize both traces by the largest clean magnitude, with the same fixed vertical scale.
- A stronger jammer raises and distorts off-peak correlation. The desired peak is not artificially shrunk, and the jammed curve is not independently normalized. This shows an acquisition slice; **no PLL, DLL, AGC, ADC saturation, acquisition threshold, tracking loop or measured lock loss is implemented**. The chart says so. See ESA Navipedia's [Correlators](https://gssc.esa.int/navipedia/index.php/Correlators) and [Baseband Processing](https://gssc.esa.int/navipedia/index.php/Baseband_Processing) for the underlying receiver concepts.
- The final physical array uses the same 4×4 half-wavelength element coordinates as Scene 03, enlarged for the composition. Its illustration is not a validated antenna radiation model.

## Files and assets

- `src/components/three/journey/interference.ts`: isolated procedural world, material batches, field and spectrum shaders, hardware, labels, phase choreography.
- `src/components/three/JourneyScene.ts`: builder and update hooks only; invalidate shadows during Scene02 geometry transitions.
- `src/lib/interferenceModel.ts`: documented C/A correlation experiment and analytic spectrum reference.
- `tests/unit/interferenceModel.test.ts`: five signal-model tests; `tests/e2e/site.spec.ts`: forward/reverse scene progression and neighbour checks.
- `public/media/journey/interference.webp`: 960×640 fallback, about 39 kB, rendered from the actual scene. Other posters unchanged.
- `src/render/journey.ts`, `scripts/journey.html`, `scripts/render-journey.ts`, `scripts/review-scene02.ts`: development-only rendering/QA helpers; isolated Scene02 poster generation and explicit favicon to prevent the studio's previous favicon 404.
- `docs/review/scene02/`: A–E renders, portfolio screenshots and diagnostics.

All new geometry, rocky microtexture, labels and diagrams are generated locally in source. No new purchased/downloaded models, fonts, textures, video or dependency; no new third-party asset licence. Existing shared model/material helpers remain under the repository's existing terms. The user's storyboard is reference only and is not published. No personal source documents or employer implementation artefacts are added.

## Performance and resilience

Static equipment is batched by material. Terrain rocks and wavefront shells use instancing. Detail segments follow the existing device tier. Correlation projections and strength frames are computed once, with trace buffers updated only when the selected strength changes. The waveform is not recomputed in React. Shadow maps update at phase changes and geometry motion, not throughout a stationary dwell.

Existing whole-journey lazy loading, offscreen/tab visibility suspension, adaptive DPR, reduced-motion and WebGL-error fallbacks remain in place. Mobile/touch and reduced-motion visitors receive the updated scene poster in the existing navigable panels, not the five-phase WebGL sequence. Local geometries/materials are traversed by existing disposal; the generated microtexture is registered with ModelKit for cleanup.

Budget for this upgrade: <25 kB gzip for the complete journey code chunk, <65 renderer calls and <200k triangles for inspected Scene02/transition frames, one browser worker. These are complexity/transfer budgets, not a frame-rate claim. The final review records counters in `review/scene02/diagnostics.json`; software-rendered Chrome downshifts to the existing economy setting. Physical-GPU frame pacing and Safari/Firefox are not verified.

## Run, review and deployment

```sh
npm ci
npm run dev
npm run check
npm run test:e2e -- --workers=1
node scripts/render-journey.ts --scene02
node scripts/review-scene02.ts
```

Node >=22.12 is required. Review uses installed Chrome and a single SwiftShader browser. Screenshots cover 1440×900, 1280×800, 390×844, 820×1180 and 844×390. `npm run build` produces `dist/`; existing GitHub Pages Actions publishes pushes to main. No new host or environment secret is needed.

## Validation and limitations

See the current entry in `TEST_REPORT.md` for executed checks. There are no missing assets blocking this scene. Optional future owner input is a cleared GNSS I/Q recording and receiver configuration if synthetic data should be replaced by measured data. The existing broader content checklist is unchanged. The scene preserves the existing camera rather than adopting the storyboard's different shot timings and close-ups; it is a stylized, scroll-controlled technical sequence, not the supplied storyboard rendered as a film.
