import { describe, expect, it } from 'vitest'
import { caCode, circularCorrelation } from '../../src/lib/gnss'

describe('GPS C/A codes', () => {
  it('PRN 1 starts with the documented first 10 chips (octal 1440)', () => {
    const c = caCode(1)
    const first10 = Array.from(c.slice(0, 10)).join('')
    expect(parseInt(first10, 2).toString(8)).toBe('1440')
  })

  it('autocorrelation is 1023 at zero lag and takes only the Gold-code values elsewhere', () => {
    const c = caCode(7)
    const r = circularCorrelation(c, c)
    expect(r[0]).toBe(1023)
    const off = new Set(Array.from(r.slice(1)))
    for (const v of off) expect([-1, -65, 63]).toContain(v)
  })

  it('cross-correlation between different PRNs stays bounded', () => {
    const r = circularCorrelation(caCode(1), caCode(2))
    expect(Math.max(...Array.from(r, Math.abs))).toBeLessThanOrEqual(65)
  })
})
