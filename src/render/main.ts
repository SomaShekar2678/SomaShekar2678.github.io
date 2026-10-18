import { covers, renderCover } from './covers'
import { HeroScene } from '../components/three/HeroScene'

/**
 * Dev-only entry for scripts/covers.html. Exposes render functions that return WebP data URLs,
 * so a headless browser can write optimised images into public/.
 */
function scaled(src: HTMLCanvasElement, width: number) {
  if (src.width === width) return src
  const c = document.createElement('canvas')
  c.width = width
  c.height = Math.round((src.height * width) / src.width)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}

declare global {
  interface Window {
    renderCovers: (width: number, height: number, sizes: number[]) => Record<string, string>
    renderHero: (width: number, height: number) => string
  }
}

window.renderCovers = (width, height, sizes) => {
  const out: Record<string, string> = {}
  for (const [slug, def] of Object.entries(covers)) {
    const canvas = renderCover(def, width, height)
    for (const w of sizes) out[`${slug}-${w}`] = scaled(canvas, w).toDataURL('image/webp', 0.84)
  }
  return out
}

window.renderHero = (width, height) => {
  const canvas = document.createElement('canvas')
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  document.body.appendChild(canvas)
  const scene = new HeroScene({ canvas, tier: 'high', reduced: true })
  // Read the frame in the same task it was drawn, before the buffer is presented.
  const c = document.createElement('canvas')
  c.width = canvas.width
  c.height = canvas.height
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f1ede4'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(canvas, 0, 0)
  scene.dispose()
  canvas.remove()
  return scaled(c, width).toDataURL('image/webp', 0.84)
}

document.body.dataset.ready = 'true'
