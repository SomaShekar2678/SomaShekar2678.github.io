/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('.', import.meta.url))

/**
 * SITE_URL is only set once the final public domain is known
 * (e.g. SITE_URL=https://example.github.io/portfolio npm run build).
 * Canonical URL, sitemap and absolute Open Graph image URLs are emitted only then,
 * so we never publish a guessed domain.
 */
const SITE_URL = process.env.SITE_URL?.replace(/\/$/, '')

function siteMeta(): Plugin {
  return {
    name: 'site-meta',
    transformIndexHtml(html) {
      if (!SITE_URL) return html
      return html
        .replace(
          '<!--canonical-->',
          `<link rel="canonical" href="${SITE_URL}/" />\n    <meta property="og:url" content="${SITE_URL}/" />`,
        )
        .replaceAll('content="./og.png"', `content="${SITE_URL}/og.png"`)
    },
    closeBundle() {
      const out = resolve(ROOT, 'dist')
      // Static hosts (GitHub Pages, Netlify, etc.) serve 404.html for unknown paths.
      // It is self-contained (no relative assets) so it renders correctly at any depth.
      copyFileSync(resolve(ROOT, 'scripts/404.html'), resolve(out, '404.html'))
      const robots = SITE_URL
        ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
        : 'User-agent: *\nAllow: /\n'
      writeFileSync(resolve(out, 'robots.txt'), robots)
      if (SITE_URL) {
        const today = new Date().toISOString().slice(0, 10)
        writeFileSync(
          resolve(out, 'sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod></url>\n</urlset>\n`,
        )
      }
    },
  }
}

export default defineConfig({
  // Relative base + hash routing: the build works on any static host or sub-path.
  base: './',
  plugins: [react(), siteMeta()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion'
        },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
