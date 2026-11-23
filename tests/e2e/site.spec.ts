import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { projects } from '../../src/content/projects'
import { journeyProgress } from '../../src/lib/journeyPath'
import { sections } from '../../src/content/site'

/** Collects console errors, page errors, failed requests and HTTP errors for a page. */
function watch(page: Page) {
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`))
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`)
  })
  return problems
}

async function ready(page: Page, path = '/') {
  await page.goto(path)
  await page.waitForFunction(() => document.documentElement.dataset.loading === 'false', null, { timeout: 10_000 })
}

test('home renders all sections without errors', async ({ page }) => {
  const problems = watch(page)
  await ready(page)
  await expect(page).toHaveTitle(/Somashekar Reddy Nakka/)
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('h1')).toContainText('Somashekar')
  for (const s of sections) await expect(page.locator(`#${s.id}`)).toHaveCount(1)
  // Scroll through so lazy sections (the lab) mount, then re-check for errors.
  await page.locator('#lab').scrollIntoViewIfNeeded()
  await expect(page.getByRole('radiogroup', { name: 'Beamforming method' })).toBeVisible({ timeout: 10_000 })
  await page.locator('#contact').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  expect(problems).toEqual([])
})

test('no horizontal overflow', async ({ page }) => {
  await ready(page)
  for (const id of ['top', 'expertise', 'work', 'lab', 'education', 'india', 'contact']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded()
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('skip link moves focus to main content', async ({ page, browserName: _ }, info) => {
  test.skip(info.project.name === 'mobile', 'keyboard test runs on desktop')
  await ready(page)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused()
})

test('menu opens as a dialog, closes with Escape, and navigates', async ({ page }) => {
  await ready(page)
  await page.getByRole('button', { name: /Menu/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Site menu' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: /Menu/ }).click()
  await dialog.getByRole('link', { name: /Lab/ }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/#lab$/)
  await expect(page.locator('#lab-title')).toBeInViewport({ timeout: 5000 })
})

test('expertise tabs support arrow-key navigation', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'keyboard test runs on desktop')
  await ready(page)
  // The chain reads antenna → software: RF & GNSS first, then signal processing.
  const first = page.getByRole('tab', { name: /RF & GNSS/ })
  await first.scrollIntoViewIfNeeded()
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await first.focus()
  await page.keyboard.press('ArrowRight')
  const second = page.getByRole('tab', { name: /Signal Processing/ })
  await expect(second).toBeFocused()
  await expect(second).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toContainText('MUSIC')
})

for (const p of projects) {
  test(`case study renders: ${p.slug}`, async ({ page }) => {
    const problems = watch(page)
    await ready(page, `/#/work/${p.slug}`)
    await expect(page.locator('h1')).toHaveText(p.title)
    await expect(page.locator('main h2')).toHaveCount(11)
    await expect(page.getByText(p.statusNote)).toBeVisible()
    expect(problems).toEqual([])
  })
}

test('work cards link to case studies and back', async ({ page }) => {
  await ready(page)
  await page.locator('#work').scrollIntoViewIfNeeded()
  await page.getByRole('link', { name: /J-DOME/ }).first().click()
  await expect(page).toHaveURL(/#\/work\/j-dome$/)
  await expect(page.locator('h1')).toHaveText('J-DOME')
  await page.getByRole('link', { name: '← All work' }).click()
  await expect(page.locator('#work-title')).toBeInViewport({ timeout: 5000 })
})

test('unknown routes show the not-found view', async ({ page }) => {
  await ready(page, '/#/work/does-not-exist')
  await expect(page.locator('h1')).toHaveText('Signal lost.')
  await ready(page, '/#/nowhere')
  await expect(page.locator('h1')).toHaveText('Signal lost.')
})

test('links are safe and resolve', async ({ page, request }) => {
  await ready(page)
  const external = page.locator('a[href^="http"]')
  const count = await external.count()
  expect(count).toBeGreaterThan(5)
  for (let i = 0; i < count; i++) {
    await expect(external.nth(i)).toHaveAttribute('target', '_blank')
    await expect(external.nth(i)).toHaveAttribute('rel', /noopener/)
  }
  await expect(page.locator('a[href="mailto:shekar3reddy4@gmail.com"]').first()).toBeAttached()
  const resume = await request.get('/resume/Somashekar_Nakka_Resume.pdf')
  expect(resume.status()).toBe(200)
  expect(resume.headers()['content-type']).toContain('pdf')
  // Every internal case-study link points to an existing project.
  const hrefs = await page.locator('a[href^="#/work/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  const slugs = new Set(projects.map((p) => p.slug))
  for (const h of hrefs) expect(slugs.has(h!.replace('#/work/', ''))).toBe(true)
})

test('images load', async ({ page }) => {
  await ready(page)
  await page.locator('#education').scrollIntoViewIfNeeded()
  const imgs = page.locator('#education img')
  await expect(imgs).toHaveCount(2)
  for (let i = 0; i < 2; i++) {
    await imgs.nth(i).scrollIntoViewIfNeeded()
    await expect.poll(() => imgs.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
  }
})

test('beamforming lab controls update the model', async ({ page }) => {
  await ready(page)
  await page.locator('#lab').scrollIntoViewIfNeeded()
  const readouts = page.locator('#lab dl[aria-live]')
  await expect(readouts).toBeVisible({ timeout: 10_000 })
  const improvement = readouts.locator('div', { hasText: 'SINR improvement' }).locator('dd')
  const mvdr = await improvement.textContent()
  await page.getByRole('radio', { name: 'Conventional' }).check({ force: true })
  await expect(improvement).not.toHaveText(mvdr!)
  // Conventional beam: far smaller improvement than MVDR.
  const conv = parseFloat((await improvement.textContent())!.replace('−', '-'))
  expect(conv).toBeLessThan(parseFloat(mvdr!.replace('−', '-').replace('+', '')))
  // Preset with two jammers adds a second jammer readout.
  await page.getByRole('button', { name: 'Two jammers' }).click()
  await expect(readouts).toContainText('Toward J2')
  // Sliders are keyboard operable.
  const az = page.getByRole('slider', { name: 'Azimuth' }).first()
  await az.focus()
  const before = await az.inputValue()
  await az.press('ArrowRight')
  await expect(az).not.toHaveValue(before)
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(readouts).not.toContainText('Toward J2')
  // The comparison view draws all three beamformers on one cut and reports each at the jammer.
  await page.getByRole('tab', { name: 'Compare methods' }).click()
  const cut = page.locator('#lab figure svg[role="img"]')
  await expect(cut).toBeVisible()
  await expect(cut).toHaveAttribute('aria-label', /Conventional .*MVDR .*LCMV/)
  await expect(cut.locator('path')).toHaveCount(3)
})

test('featured work shows rendered covers', async ({ page }) => {
  await ready(page)
  const imgs = page.locator('#work figure img')
  await expect(imgs).toHaveCount(5)
  for (let i = 0; i < 5; i++) {
    await imgs.nth(i).scrollIntoViewIfNeeded()
    await expect.poll(() => imgs.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
    await expect(imgs.nth(i)).toHaveAttribute('alt', /Illustrative render/)
  }
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('content is visible without animation', async ({ page }) => {
    await ready(page)
    await expect(page.locator('html')).not.toHaveClass(/motion/)
    // Headlines are not masked and covers are not hidden behind their reveal panel.
    await page.locator('#work').scrollIntoViewIfNeeded()
    const word = await page.locator('#work-title .split-word').first().evaluate((el) => getComputedStyle(el).transform)
    expect(word).toBe('none')
    const panel = await page.locator('#work figure').first().evaluate((el) => getComputedStyle(el, '::after').content)
    expect(panel).toBe('none')
  })
})

test('WebGL fallback keeps the page functional', async ({ page }) => {
  const problems = watch(page)
  await ready(page, '/?webgl=0')
  await expect(page.locator('#top canvas')).toHaveCount(0)
  const poster = page.locator('#top img')
  await expect(poster).toBeVisible()
  await expect.poll(() => poster.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
  await page.locator('#lab').scrollIntoViewIfNeeded()
  await expect(page.getByRole('tab', { name: 'Array gain' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('tab', { name: '3D pattern' })).toHaveCount(0)
  expect(problems).toEqual([])
})

test('accessibility audit (axe) — home', async ({ page }) => {
  await ready(page)
  for (const id of ['about', 'expertise', 'work', 'lab', 'experience', 'education', 'india', 'contact']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded()
  }
  await page.waitForTimeout(1200)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)).toEqual([])
})

test('accessibility audit (axe) — case study', async ({ page }) => {
  await ready(page, '/#/work/j-dome')
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)).toEqual([])
})

test.describe('signal journey', () => {
  test('immersive on desktop: scrolling advances the stages; skip link works', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'phones get the static panels')
    const problems = watch(page)
    // Count frames the journey canvas actually draws, so a stalled render loop fails the test
    // (captions alone advanced while the 3D scene was frozen once).
    await page.addInitScript(() => {
      const w = window as unknown as { __journeyFrames: number }
      w.__journeyFrames = 0
      for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
        const clear = C.prototype.clear
        C.prototype.clear = function (this: WebGLRenderingContext, mask: number) {
          if ((this.canvas as HTMLCanvasElement).closest?.('#journey')) w.__journeyFrames++
          return clear.call(this, mask)
        }
      }
    })
    await ready(page)
    const section = page.locator('#journey')
    await expect(section.locator('canvas')).toHaveCount(1)
    const box = await section.evaluate((el) => ({ top: el.getBoundingClientRect().top + window.scrollY, h: el.getBoundingClientRect().height }))
    const span = box.h - 900
    const title = (i: number) => section.locator('ol[aria-hidden] > li').nth(i)
    for (const [f, i] of [[journeyProgress(0,.3), 0], [journeyProgress(2,.3), 2], [journeyProgress(5,.7), 5]] as const) {
      await page.evaluate((y) => window.scrollTo(0, y), box.top + span * f)
      await expect(title(i)).toHaveAttribute('data-active', { timeout: 5000 })
    }
    const frames = () => page.evaluate(() => (window as unknown as { __journeyFrames: number }).__journeyFrames)
    // Captions follow target scroll immediately; allow the preserved eased camera flight and
    // first-use shader compilation to finish before measuring stationary rendering progress.
    await expect(section.locator('canvas')).toHaveAttribute('data-render-stage', '5', { timeout: 10_000 })
    await expect(section.locator('canvas')).toHaveAttribute('data-assets', 'ready')
    const before = await frames()
    await page.waitForTimeout(1000)
    expect(await frames()).toBeGreaterThan(before + 5)
    // The full story is available to screen readers regardless of scroll position.
    await expect(section.locator('ol.sr-only > li')).toHaveCount(6)
    await page.evaluate((y) => window.scrollTo(0, y), box.top + 10)
    await section.getByRole('link', { name: /Skip the journey/ }).click()
    await expect(page.locator('#about-title')).toBeInViewport({ timeout: 5000 })
    expect(problems).toEqual([])
  })

  test('static panels when WebGL is unavailable or on phones', async ({ page }, info) => {
    await ready(page, info.project.name === 'mobile' ? '/' : '/?webgl=0')
    const section = page.locator('#journey')
    await expect(section.locator('canvas')).toHaveCount(0)
    await expect(section.locator('ol[role="list"] > li')).toHaveCount(6)
    await expect(section.getByRole('heading', { level: 3, name: 'The array adapts' })).toBeAttached()
  })
})

test.describe('journey asset resilience', () => {
  test('texture failure preserves the full story as illustrated panels', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'phones do not request Earth textures')
    await page.route('**/textures/journey/earth-day.webp', route => route.abort())
    await ready(page)
    const section = page.locator('#journey')
    await section.scrollIntoViewIfNeeded()
    await expect(section.locator('canvas')).toHaveCount(0, { timeout: 10_000 })
    await expect(section.locator('ol[role="list"] > li')).toHaveCount(6)
    const first = section.locator('img').first()
    await first.scrollIntoViewIfNeeded()
    await expect(first).toHaveJSProperty('naturalWidth', 960)
  })

  test('context loss releases the scene and leaves navigation available', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'phones have no journey WebGL context')
    await ready(page)
    const section = page.locator('#journey')
    const canvas = section.locator('canvas')
    await expect(canvas).toHaveAttribute('data-assets', 'ready', { timeout: 15_000 })
    await canvas.evaluate(el => el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
    await expect(canvas).toHaveCount(0)
    await expect(section.locator('ol[role="list"] > li')).toHaveCount(6)
    await page.getByRole('link', { name: 'Work', exact: true }).first().click()
    await expect(page.locator('#work-title')).toBeInViewport()
  })

  test('reduced motion loads posters without the 3D texture pack', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const textures: string[] = []
    page.on('request', r => { if (r.url().includes('/textures/journey/')) textures.push(r.url()) })
    await ready(page)
    const section = page.locator('#journey')
    await section.scrollIntoViewIfNeeded()
    await expect(section.locator('canvas')).toHaveCount(0)
    await expect(section.locator('img')).toHaveCount(6)
    const first = section.locator('img').first()
    await first.scrollIntoViewIfNeeded()
    await expect(first).toHaveJSProperty('naturalWidth', 960)
    expect(textures).toEqual([])
  })

  test('visual credits and license details are served locally', async ({ page }) => {
    await page.goto('/visual-credits.html')
    await expect(page.getByRole('heading', { name: 'Visual credits.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Solar System Scope' })).toHaveAttribute('href', 'https://www.solarsystemscope.com/textures/')
    await expect(page.getByRole('link', { name: 'Creative Commons Attribution 4.0 International' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/')
    const source = await page.request.get('/textures/journey/ATTRIBUTION.md')
    expect(source.ok()).toBe(true)
    expect(await source.text()).toContain('clouds resized to 1024×512')
  })
})

test('Scene02 progresses through all four phases and preserves its neighbours', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'touch devices retain illustrated panels')
  test.setTimeout(60_000)
  const problems = watch(page)
  await ready(page)
  const section=page.locator('#journey'),canvas=section.locator('canvas')
  async function scroll(progress:number) {
    const y=await section.evaluate((el,p)=>el.getBoundingClientRect().top+scrollY+((el as HTMLElement).offsetHeight-innerHeight)*p,progress)
    // Exact phase checks use the native scrollbar path. Wheel deltas are scaled by Lenis (0.95)
    // and accumulated against its animated target, so raw pixel deltas are not absolute positions.
    await page.evaluate(target=>scrollTo({top:target,behavior:'instant'}),y)
    await expect.poll(async()=>Math.abs(await page.evaluate(()=>scrollY)-y), { timeout: 10_000 }).toBeLessThan(2)
  }
  await scroll(journeyProgress(0,.3))
  await expect(canvas).toHaveAttribute('data-render-stage','0')
  for(const [local,phase] of [[.06,'transmitter'],[.19,'fields'],[.31,'spectrum'],[.47,'receiver'],[.56,'receiver']] as const){
    await scroll(journeyProgress(1,local))
    await expect(canvas).toHaveAttribute('data-render-stage','1')
    await expect(canvas).toHaveAttribute('data-interference-phase',phase)
  }
  await scroll(journeyProgress(2,.3))
  await expect(canvas).toHaveAttribute('data-render-stage','2')
  await scroll(journeyProgress(1,.06))
  await expect(canvas).toHaveAttribute('data-render-stage','1')
  await expect(canvas).toHaveAttribute('data-interference-phase','transmitter')
  expect(problems).toEqual([])
})
