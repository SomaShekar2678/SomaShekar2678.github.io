import { describe, expect, it } from 'vitest'
import { computeLab, DEFAULT_PARAMS, mathToNav, navToMath, PRESETS, type LabParams } from '../../src/lib/labModel'

const withParams = (p: Partial<LabParams>): LabParams => ({ ...DEFAULT_PARAMS, ...p })

describe('lab model', () => {
  it('converts between navigation and mathematical azimuth', () => {
    expect(navToMath(0)).toBe(90) // north
    expect(navToMath(90)).toBe(0) // east
    expect(mathToNav(navToMath(237))).toBeCloseTo(237, 9)
  })

  it('MVDR suppresses the default jammer far more than the conventional beam', () => {
    const mvdr = computeLab(withParams({ method: 'mvdr' }))
    const conv = computeLab(withParams({ method: 'conventional' }))
    expect(mvdr.jammerDb[0]!).toBeLessThan(conv.jammerDb[0]! - 15)
    expect(mvdr.sinrOutDb).toBeGreaterThan(conv.sinrOutDb + 20)
  })

  it('MUSIC estimates the default jammer within a few degrees', () => {
    const r = computeLab(DEFAULT_PARAMS)
    expect(r.estimates).toHaveLength(1)
    expect(r.estimates[0]!.errorDeg!).toBeLessThan(5)
  })

  it('LCMV built on MUSIC estimates nulls both jammers', () => {
    const r = computeLab(withParams({ ...PRESETS.find((p) => p.id === 'two')!.params, method: 'lcmv' }))
    for (const db of r.jammerDb) expect(db).toBeLessThan(-25)
  })

  it('every preset computes finite results', () => {
    for (const preset of PRESETS) {
      for (const method of ['conventional', 'mvdr', 'lcmv'] as const) {
        const r = computeLab(withParams({ ...preset.params, method }))
        expect(Number.isFinite(r.sinrOutDb)).toBe(true)
        expect(Number.isFinite(r.satDb)).toBe(true)
      }
    }
  })

  it('a jammer close to the satellite limits the achievable SINR', () => {
    const far = computeLab(withParams({ method: 'mvdr' }))
    const close = computeLab(withParams({ ...PRESETS.find((p) => p.id === 'close')!.params, method: 'mvdr' }))
    expect(close.sinrOutDb).toBeLessThan(far.sinrOutDb)
  })
})
