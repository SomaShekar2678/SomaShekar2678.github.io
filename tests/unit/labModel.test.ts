import { describe, expect, it } from 'vitest'
import { compareCut, computeLab, DEFAULT_PARAMS, mathToNav, navToMath, PRESETS, type LabParams } from '../../src/lib/labModel'

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

describe('compareCut', () => {
  it('normalises every method to 0 dB toward the satellite and shows adaptive nulls at the jammer', () => {
    const r = computeLab(DEFAULT_PARAMS)
    const cut = compareCut(DEFAULT_PARAMS, r.estimates)
    expect(cut.el).toBe(DEFAULT_PARAMS.jammers[0]!.el)
    expect(cut.az.length).toBe(360)
    const conv = cut.atJammers.conventional[0]!
    const mvdr = cut.atJammers.mvdr[0]!
    const lcmv = cut.atJammers.lcmv[0]!
    // The default jammer sits on a conventional sidelobe; both adaptive methods null it far deeper.
    expect(conv).toBeGreaterThan(-25)
    expect(mvdr).toBeLessThan(conv - 25)
    expect(lcmv).toBeLessThan(conv - 25)
    // A cut at the satellite's own elevation passes through 0 dB at the satellite azimuth for all methods.
    const atSat = compareCut({ ...DEFAULT_PARAMS, jammers: DEFAULT_PARAMS.jammers.map((j) => ({ ...j, el: DEFAULT_PARAMS.satEl })) }, r.estimates)
    for (const m of ['conventional', 'mvdr', 'lcmv'] as const) expect(Math.abs(atSat.db[m][DEFAULT_PARAMS.satAz]!)).toBeLessThan(0.05)
  })
})
