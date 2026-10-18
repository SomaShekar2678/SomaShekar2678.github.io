/**
 * Renders the case-study covers and the hero fallback image to WebP.
 *   npm run covers
 * Starts a Vite dev server, opens scripts/covers.html in headless Chrome (software WebGL is fine),
 * and writes public/covers/<slug>-<width>.webp and public/media/hero-array.webp.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'

/** Functions exposed by src/render/main.ts inside the page. */
type RenderWindow = Window & {
  renderCovers: (width: number, height: number, sizes: number[]) => Record<string, string>
  renderHero: (width: number, height: number) => string
}

const root = resolve(import.meta.dirname, '..')
const server = await createServer({ root, server: { port: 5199, strictPort: true }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto('http://localhost:5199/scripts/covers.html')
  await page.waitForSelector('body[data-ready="true"]', { state: 'attached', timeout: 60_000 })

  const write = (file: string, dataUrl: string) => {
    const buf = Buffer.from(dataUrl.split(',')[1]!, 'base64')
    writeFileSync(file, buf)
    console.log(`${file.replace(root + '/', '')}  ${(buf.length / 1024).toFixed(0)} kB`)
  }

  mkdirSync(resolve(root, 'public/covers'), { recursive: true })
  const covers = await page.evaluate(() => (window as unknown as RenderWindow).renderCovers(1600, 1100, [1600, 800]))
  for (const [name, url] of Object.entries(covers)) write(resolve(root, `public/covers/${name}.webp`), url)

  mkdirSync(resolve(root, 'public/media'), { recursive: true })
  write(resolve(root, 'public/media/hero-array.webp'), await page.evaluate(() => (window as unknown as RenderWindow).renderHero(1600, 1100)))
} finally {
  await browser.close()
  await server.close()
}
