# Somashekar Reddy Nakka — The Engineering Frontier

**Live:** https://somashekar2678.github.io/

Portfolio of an AI/ML engineer working across GNSS anti-jamming, array signal processing, FPGA acceleration, perception and prognostics. A single-page React app with a real-time Three.js hero, an interactive beamforming lab, and evidence-backed case studies.

Every visual that shows numbers is computed from a stated mathematical model in the browser (steering vectors, MVDR/LCMV weights, MUSIC, GPS C/A Gold codes) and is labelled illustrative.

## Quick start

Requires Node ≥ 22.12 (developed on Node 24 LTS).

```bash
npm ci            # install from the lockfile
npm run dev       # dev server at http://localhost:5173
npm run build     # type-check + production build into dist/
npm run preview   # serve dist/ at http://localhost:4173
```

## Checks

```bash
npm run typecheck   # TypeScript (strict)
npm run lint        # ESLint
npm test            # unit tests: maths, GPS codes, lab model, content integrity
npm run test:e2e    # Playwright against the production build (desktop + mobile, axe audits)
npm run check       # typecheck + lint + unit tests + build
```

End-to-end tests use the installed Google Chrome (`channel: 'chrome'`). To use Playwright's own Chromium instead: `npx playwright install chromium` and run with `PW_CHANNEL=''`.

To test the deployed site instead of the local build: `BASE_URL=https://somashekar2678.github.io npm run test:e2e`.

They run **one browser at a time** (`workers: 1`) on purpose. Each test renders WebGL in software, and parallel runs exhausted RAM on an 8 GB laptop.

## Editing content

All personal and project facts live in `src/content/`. Components never hard-code facts.

| File | Contents |
|---|---|
| `src/content/profile.ts` | Name, links, résumé path, biography, principles, experience, credentials, notebook index |
| `src/content/projects.ts` | Project case studies (11-part structure), statuses and their definitions |
| `src/content/expertise.ts` | Six domains, each method tagged studied / simulated / implemented / deployed |
| `src/content/site.ts` | Section order and labels, India section copy |

`tests/unit/content.test.ts` enforces the evidence rules: valid statuses, evidence on every project, sources on every metric, https-only links, no rendered phone number, no leftover placeholders.

To replace the résumé, overwrite `public/resume/Somashekar_Nakka_Resume.pdf` and update `profile.resume.updated`.

Social card and icons are regenerated with `npm run assets` (writes `public/og.png` and `public/icons/*.png`).

## Project structure

```
src/
  app/            App shell, routing effects
  components/     navigation, layout, motion, three (WebGL scenes), visualizations, projects, accessibility
  content/        single source of truth for all facts
  hooks/          in-view, scroll-spy, scroll progress
  lib/            beamforming.ts (array maths), labModel.ts, gnss.ts (C/A codes), router, motion, env detection
  pages/          Home, CaseStudy (lazy), NotFound
  sections/       Hero, About, Expertise, Work, Lab, Experience, Education, India, Contact
  styles/         tokens.css (design tokens), global.css
tests/unit, tests/e2e
docs/             decisions, content checklist, test report
```

## Deployment

The build is fully static and uses relative asset paths and hash routes (`#/work/<slug>`). It works on any static host and under any sub-path, with no rewrite rules.

**GitHub Pages (current):** the repository is `SomaShekar2678/SomaShekar2678.github.io`, a user site served at the domain root. Every push to `main` runs `.github/workflows/deploy.yml`: type-check, lint, unit tests, build with the real Pages URL as `SITE_URL`, then publish. *Pages → Source* is set to *GitHub Actions*.

**Netlify / Vercel / Cloudflare Pages:** build command `npm run build`, output directory `dist`.

Once the final URL is known, build with it so the canonical URL, sitemap and absolute social-image URLs are emitted:

```bash
SITE_URL=https://your-domain.example npm run build
```

Without `SITE_URL`, no canonical URL or sitemap is generated, so a guessed domain is never published.

## Browser support and fallbacks

- No WebGL, or a lost context: the hero shows a static, computed SVG beam pattern. The lab keeps its 2D sky maps and hides the 3D tab. Test with `?webgl=0`.
- `prefers-reduced-motion`: no smooth scrolling, reveals or scroll-scrubbing, and the 3D scene renders only on interaction. Test with `?motion=0`.
- Without JavaScript, a `<noscript>` summary with contact links is shown.
