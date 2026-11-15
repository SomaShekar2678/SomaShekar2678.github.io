# Scene 01 — orbital detail pass

Scope: opening orbital world only. Scene 02–06 builder code, shared Earth/model helpers, typography, navigation, narrative, station coordinates, scroll mapping and motion remain unchanged. Scene 01 has its own detail module and poster.

The supplied image was visually inspected: silver thermal insulation, dark solar cells, warm edge illumination, cloud detail and a soft blue horizon informed the materials. Large communications dishes and the close-up camera composition were not copied. The separately referenced portfolio2.webm was not available; motion was compared against the existing implementation.

## Changes

- Original GNSS-type spacecraft augmented with 432 raised cells, fine busbars, hinge barrels, rear structural stringers, routed harnesses, radiator louvres, sensor aperture, blanket retention rails and fasteners. A local silver-blanket material clone leaves the small Scene 06 spacecraft unchanged.
- Existing licensed Earth surface/cloud/night maps retained, with an additional sunlit optical-depth limb approximation. This is not a full atmospheric radiative-transfer simulation. Sun direction remains shared with Earth; spacecraft highlights receive a restrained warm tint only in Scene 01.
- 1,800–3,600 deterministic stars in two depth ranges, brightness and colour-temperature variation. Camera-relative translation suppresses almost all parallax. About 1% have a 2% slow intensity variation as an artistic effect, not atmospheric scintillation in space.
- Two small procedurally shaded, Mars-like and banded-gas-planet-like bodies. Fixed directions, no orbital animation. This is an illustrative celestial composition, not actual ephemerides, observed angular sizes or a depiction of planets orbiting Earth.
- Extra geometry batches by material; cells are combined meshes, not hundreds of independent draws. Existing lazy initialization, economy-mode resolution, offscreen suspension, cleanup and phone/reduced-motion posters retained.

## Assets and ownership

No new external assets or dependencies. Models and planet/star shaders are original code. The supplied reference image is not redistributed in the application. Earth maps retain the Solar System Scope CC BY 4.0 attribution in the public credits page. Only `public/media/journey/space.webp` is regenerated with a changed result; the other five posters are unchanged.

## Validation

Results are recorded below after execution. The local environment uses Chrome/SwiftShader, one browser worker. Physical GPU performance, Safari and Firefox remain unverified. The fixed camera keeps the spacecraft smaller than the reference photograph, which limits visibility of fine detail at normal viewing size.

- Strict TypeScript, lint, 40 unit tests and production build passed.
- Scene 01 and Scene 02 inspected at 1440×900 via actual wheel scroll; no console/page errors.
- Byte comparison confirmed Scene 02–06 builder implementations unchanged. The other five poster files also remain unchanged.
- High-tier orbital still: 34 draw calls, 112,208 rendered triangles, 3,600 stars. Previous orbital still: 23 calls, 62,912 triangles, 1,200 stars. This is a deliberate geometry/detail increase, not a measured hardware-FPS guarantee. The existing economy mode remains available.
- Before/after fixed-camera renders: `docs/review/orbit2/before.webp`, `after.webp`; actual desktop page: `desktop.jpg`.
- Targeted production browser suite: 13 passed, 3 desktop-only checks skipped on mobile. Includes page loading, overflow, rendered journey progress, skip navigation, WebGL/texture failure and reduced-motion posters.
