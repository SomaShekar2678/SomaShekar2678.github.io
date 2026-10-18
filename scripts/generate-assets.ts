/**
 * Generates the social preview card (public/og.png) and PNG app icons from public/icons/favicon.svg.
 * The card uses the hero render, so run `npm run covers` first (it writes public/media/hero-array.webp).
 *
 *   npm run assets
 *
 * Uses one headless Chrome instance (channel: 'chrome'; set PW_CHANNEL='' for Playwright's Chromium).
 */
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// Inlined as data URLs: pages created with setContent() cannot load file:// resources.
const font = (pkg: string, file: string) =>
  `data:font/woff2;base64,${readFileSync(resolve(ROOT, 'node_modules/@fontsource-variable', pkg, 'files', file)).toString('base64')}`
const fontAt = (path: string) => `data:font/woff2;base64,${readFileSync(resolve(ROOT, 'node_modules', path)).toString('base64')}`

function ogHtml() {
  // The hero sculpture, pre-rendered by `npm run covers` (public/media/hero-array.webp).
  const hero = `data:image/webp;base64,${readFileSync(resolve(ROOT, 'public/media/hero-array.webp')).toString('base64')}`
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Bricolage'; src: url('${font('bricolage-grotesque', 'bricolage-grotesque-latin-wdth-normal.woff2')}') format('woff2'); font-weight: 200 800; font-stretch: 75% 100%; }
    @font-face { font-family: 'JBM'; src: url('${font('jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2')}') format('woff2'); font-weight: 100 800; }
    @font-face { font-family: 'Serif'; src: url('${fontAt('@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2')}') format('woff2'); font-style: italic; }
    html,body { margin:0; width:1200px; height:630px; background:#f1ede4; color:#15161a; overflow:hidden; }
    .card { position:relative; width:1200px; height:630px; box-sizing:border-box; padding:60px 64px; }
    .hero { position:absolute; right:-150px; top:-40px; width:900px; height:620px; object-fit:cover; object-position: 75% 45%; }
    .label { position:relative; font: 500 15px/1.5 'JBM'; letter-spacing:.16em; text-transform:uppercase; color:#4b4a47; }
    .lede { position:relative; margin: 26px 0 0; max-width: 520px; font: 600 46px/1 'Bricolage'; letter-spacing:-.03em; }
    .lede em { font: italic 400 50px/1 'Serif'; color:#2f45d6; letter-spacing:-.01em; }
    h1 { position:absolute; left:58px; bottom:62px; margin:0; font: 640 132px/0.8 'Bricolage'; font-stretch: 76%; letter-spacing:-.045em; }
    h1 span { color:#2f45d6; }
    .foot { position:absolute; left:64px; right:64px; bottom:26px; display:flex; justify-content:space-between; font: 500 13px/1 'JBM'; letter-spacing:.12em; text-transform:uppercase; color:#66645e; }
  </style></head><body><div class="card">
    <img class="hero" src="${hero}" alt="">
    <div class="label">AI/ML Engineer<br>Computer Vision · Signal Processing · Autonomous Systems</div>
    <p class="lede">Intelligent systems, <em>from the signal</em> to the field.</p>
    <h1>Somashekar<br>Reddy Nakka<span>.</span></h1>
    <div class="foot"><span>GNSS · arrays · perception · prognostics</span><span>Illustrative MVDR pattern, 4×4 array</span></div>
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
