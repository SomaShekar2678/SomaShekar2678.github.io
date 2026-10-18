import { describe, expect, it } from 'vitest'
import {
  angularSeparation,
  conventionalWeights,
  diagonalLoad,
  dot,
  exactCovariance,
  inputSinr,
  L1_WAVELENGTH_M,
  lcmvWeights,
  linToDb,
  matVec,
  musicSky,
  mvdrWeights,
  outputSinr,
  powerResponse,
  sampleCovariance,
  skyPeaks,
  solve,
  steering,
  ura,
  type Source,
} from '../../src/lib/beamforming'

const g = ura(4, 4, 0.5)
const sat: Source = { az: 40, el: 60, powerDb: -20 }
const jam: Source = { az: 200, el: 15, powerDb: 40 }

describe('array model', () => {
  it('GPS L1 wavelength is ~19 cm', () => {
    expect(L1_WAVELENGTH_M).toBeCloseTo(0.1903, 3)
  })

  it('steering vectors have unit-modulus elements', () => {
    const a = steering(g, 123, 33)
    for (let m = 0; m < g.n; m++) expect(a.re[m]! ** 2 + a.im[m]! ** 2).toBeCloseTo(1, 12)
  })

  it('zenith arrival gives identical phase on a planar array', () => {
    const a = steering(g, 0, 90)
    for (let m = 0; m < g.n; m++) expect(a.re[m]).toBeCloseTo(1, 12)
  })

  it('angular separation is symmetric and correct for orthogonal directions', () => {
    expect(angularSeparation(0, 0, 90, 0)).toBeCloseTo(90, 9)
    expect(angularSeparation(10, 20, 10, 20)).toBeCloseTo(0, 6)
  })
})

describe('linear algebra', () => {
  it('solve() inverts a Hermitian covariance', () => {
    const R = exactCovariance(g, [sat, jam])
    const b = steering(g, 77, 41)
    const x = solve(R, b)
    const back = matVec(R, x)
    for (let m = 0; m < g.n; m++) {
      expect(back.re[m]).toBeCloseTo(b.re[m]!, 8)
      expect(back.im[m]).toBeCloseTo(b.im[m]!, 8)
    }
  })
})

describe('beamformers', () => {
  it('conventional weights have unit gain toward the steering direction', () => {
    const a = steering(g, sat.az, sat.el)
    const w = conventionalWeights(a)
    expect(powerResponse(w, g, sat.az, sat.el)).toBeCloseTo(1, 12)
  })

  it('MVDR is distortionless toward the satellite', () => {
    const R = exactCovariance(g, [sat, jam])
    const a = steering(g, sat.az, sat.el)
    const w = mvdrWeights(R, a)
    const [re, im] = dot(w, a)
    expect(re).toBeCloseTo(1, 9)
    expect(im).toBeCloseTo(0, 9)
  })

  it('MVDR places a deep null toward a strong jammer', () => {
    const R = exactCovariance(g, [sat, jam])
    const w = mvdrWeights(R, steering(g, sat.az, sat.el))
    const nullDb = linToDb(powerResponse(w, g, jam.az, jam.el))
    expect(nullDb).toBeLessThan(-35)
  })

  it('LCMV enforces an exact zero toward the constrained jammer', () => {
    const R = exactCovariance(g, [sat, jam])
    const w = lcmvWeights(R, [steering(g, sat.az, sat.el), steering(g, jam.az, jam.el)], [1, 0])
    expect(powerResponse(w, g, sat.az, sat.el)).toBeCloseTo(1, 8)
    expect(powerResponse(w, g, jam.az, jam.el)).toBeLessThan(1e-12)
  })

  it('MVDR improves SINR far beyond the conventional beam against a 40 dB jammer', () => {
    const R = exactCovariance(g, [sat, jam])
    const a = steering(g, sat.az, sat.el)
    const conv = linToDb(outputSinr(conventionalWeights(a), g, sat, [jam]))
    const mvdr = linToDb(outputSinr(mvdrWeights(R, a), g, sat, [jam]))
    const input = linToDb(inputSinr(sat, [jam]))
    expect(mvdr).toBeGreaterThan(conv + 20)
    // Upper bound: the full array gain over noise alone (10·log10(16) ≈ 12 dB above per-element SNR).
    expect(mvdr).toBeLessThanOrEqual(sat.powerDb + 10 * Math.log10(g.n) + 1e-6)
    expect(mvdr).toBeGreaterThan(input)
  })

  it('a 2×2 array cannot null more than 3 independent interferers', () => {
    // Directions are deliberately asymmetric: symmetric placements on a symmetric array give
    // linearly dependent steering vectors, which consume fewer degrees of freedom.
    const small = ura(2, 2, 0.5)
    const jams: Source[] = [
      { az: 17, el: 10, powerDb: 40 },
      { az: 103, el: 25, powerDb: 40 },
      { az: 191, el: 5, powerDb: 40 },
      { az: 284, el: 35, powerDb: 40 },
    ]
    const R = exactCovariance(small, [sat, ...jams])
    const w = mvdrWeights(R, steering(small, sat.az, sat.el))
    const worst = Math.max(...jams.map((j) => linToDb(powerResponse(w, small, j.az, j.el))))
    expect(worst).toBeGreaterThan(-30)
  })
})

describe('MUSIC', () => {
  it('finds the jammer direction from a sample covariance', () => {
    const R = diagonalLoad(sampleCovariance(g, [sat, jam], 512, 7), 1e-6)
    const grid = { nAz: 120, nEl: 31 }
    const map = new Float32Array(grid.nAz * grid.nEl)
    musicSky(R, g, 1, grid, map)
    const [peak] = skyPeaks(map, grid, 1)
    expect(peak).toBeDefined()
    expect(angularSeparation(peak!.az, peak!.el, jam.az, jam.el)).toBeLessThan(6)
  })
})
