/**
 * Generates the social preview card (public/og.png) and PNG app icons from public/icons/favicon.svg.
 * The card's beam pattern is computed with the same maths as the site (src/lib/beamforming.ts).
 *
 *   node scripts/generate-assets.ts
 *
 * Uses one headless Chrome instance (channel: 'chrome'; set PW_CHANNEL='' for Playwright's Chromium).
 */
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exactCovariance, linToDb, mvdrWeights, powerResponse, steering, ura } from '../src/lib/beamforming.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// Inlined as data URLs: pages created with setContent() cannot load file:// resources.
const font = (pkg: string, file: string) =>
  `data:font/woff2;base64,${readFileSync(resolve(ROOT, 'node_modules/@fontsource-variable', pkg, 'files', file)).toString('base64')}`

function beamPath(R: number) {
  const g = ura(4, 4, 0.5)
  const sat = { az: 35, el: 20 }
  const jam = { az: 215, el: 20 }
  const w = mvdrWeights(
    exactCovariance(g, [
      { ...sat, powerDb: -20 },
      { ...jam, powerDb: 40 },
    ]),
    steering(g, sat.az, sat.el),
  )
  const vals = Array.from({ length: 360 }, (_, i) => powerResponse(w, g, i, 20))
  const max = Math.max(...vals)
  const d = vals
    .map((v, i) => {
      const r = (R * (Math.max(-40, linToDb(v / max)) + 40)) / 40
      const a = (i * Math.PI) / 180
      return `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(1)} ${(-r * Math.sin(a)).toFixed(1)}`
    })
    .join(' ')
  const at = (az: number, r: number) => ({ x: r * Math.cos((az * Math.PI) / 180), y: -r * Math.sin((az * Math.PI) / 180) })
  return { d: d + 'Z', sat: at(sat.az, R + 14), jam: at(jam.az, R + 14) }
}

function ogHtml() {
  const R = 210
  const { d, sat, jam } = beamPath(R)
  const rings = [0.25, 0.5, 0.75, 1].map((f) => `<circle r="${R * f}"/>`).join('')
  const spokes = Array.from({ length: 12 }, (_, k) => {
    const a = (k * 30 * Math.PI) / 180
    return `<line x1="0" y1="0" x2="${(R * Math.cos(a)).toFixed(1)}" y2="${(-R * Math.sin(a)).toFixed(1)}"/>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Bricolage'; src: url('${font('bricolage-grotesque', 'bricolage-grotesque-latin-wght-normal.woff2')}') format('woff2'); font-weight: 200 800; }
    @font-face { font-family: 'JBM'; src: url('${font('jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2')}') format('woff2'); font-weight: 100 800; }
    @font-face { font-family: 'Inter'; src: url('${font('inter', 'inter-latin-wght-normal.woff2')}') format('woff2'); font-weight: 100 900; }
    html,body { margin:0; width:1200px; height:630px; background:#07080a; color:#eeebe4; overflow:hidden; }
    .card { position:relative; width:1200px; height:630px; box-sizing:border-box; padding:64px 72px;
      background: radial-gradient(60% 80% at 78% 40%, rgba(91,124,255,.18), transparent 70%), #07080a; }
    .label { font: 500 15px/1 'JBM'; letter-spacing:.16em; text-transform:uppercase; color:#a7adb8; }
    h1 { margin: 26px 0 0; font: 600 92px/0.9 'Bricolage'; letter-spacing:-.045em; }
    h1 span { color:#5b7cff; }
    p { margin: 30px 0 0; max-width: 560px; font: 400 25px/1.4 'Inter'; color:#c9ccd3; }
    .foot { position:absolute; left:72px; bottom:56px; display:flex; gap:28px; font: 500 14px/1 'JBM'; letter-spacing:.12em; text-transform:uppercase; color:#808897; }
    svg { position:absolute; right:40px; top:50%; transform: translateY(-50%); }
  </style></head><body><div class="card">
    <div class="label">AI/ML Engineer — Signal Processing · Autonomous Systems</div>
    <h1>Somashekar<br>Reddy Nakka<span>.</span></h1>
    <p>Intelligence for systems that have to work in the physical world — GNSS anti-jamming, array processing, perception and prognostics.</p>
    <div class="foot"><span>The Engineering Frontier</span><span>MVDR · 4×4 array · illustrative</span></div>
    <svg width="520" height="520" viewBox="-260 -260 520 520">
      <g fill="none" stroke="#eeebe4" stroke-opacity=".13" stroke-width="1">${rings}${spokes}</g>
      <path d="${d}" fill="rgba(91,124,255,.18)" stroke="#94a8ff" stroke-width="2.4" stroke-linejoin="round"/>
      <line x1="0" y1="0" x2="${(jam.x * 0.93).toFixed(1)}" y2="${(jam.y * 0.93).toFixed(1)}" stroke="#ffb23f" stroke-width="1.6" stroke-dasharray="6 5"/>
      <circle cx="${sat.x.toFixed(1)}" cy="${sat.y.toFixed(1)}" r="8" fill="#94a8ff"/>
      <path d="M${jam.x.toFixed(1)} ${(jam.y - 9).toFixed(1)} l8 14 h-16z" fill="#ffb23f"/>
      <text x="${(sat.x + 14).toFixed(1)}" y="${(sat.y + 5).toFixed(1)}" font-family="JBM" font-size="15" letter-spacing="1.5" fill="#94a8ff">SAT</text>
      <text x="${(jam.x - 14).toFixed(1)}" y="${(jam.y + 5).toFixed(1)}" text-anchor="end" font-family="JBM" font-size="15" letter-spacing="1.5" fill="#ffb23f">JAM</text>
    </svg>
  </div></body></html>`
}

const channel = process.env.PW_CHANNEL ?? 'chrome'
const browser = await chromium.launch(channel ? { channel } : {})
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.setContent(ogHtml(), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: resolve(ROOT, 'public/og.png') })

  const svg = readFileSync(resolve(ROOT, 'public/icons/favicon.svg'), 'utf8')
  for (const [size, name] of [
    [32, 'favicon-32.png'],
    [180, 'apple-touch-icon.png'],
    [192, 'icon-192.png'],
    [512, 'icon-512.png'],
  ] as const) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<html><body style="margin:0;background:#07080a">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
    await page.screenshot({ path: resolve(ROOT, 'public/icons', name), omitBackground: false })
  }
  console.log('Generated public/og.png and public/icons/*.png')
} finally {
  await browser.close()
}
