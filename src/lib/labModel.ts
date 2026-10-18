import {
  angularSeparation,
  conventionalWeights,
  diagonalLoad,
  dot,
  inputSinr,
  lcmvWeights,
  linToDb,
  musicSky,
  mvdrWeights,
  outputSinr,
  patternSky,
  powerResponse,
  sampleCovariance,
  skyPeaks,
  steering,
  ura,
  type CVec,
  type SkyGrid,
  type Source,
} from './beamforming'

/**
 * The beamforming lab's model. UI azimuths use the navigation convention
 * (clockwise from north); the array maths uses mathematical azimuth (counter-clockwise from east).
 */
export const navToMath = (navAz: number) => (((90 - navAz) % 360) + 360) % 360
export const mathToNav = (mathAz: number) => (((90 - mathAz) % 360) + 360) % 360

export type Method = 'conventional' | 'mvdr' | 'lcmv'

export interface LabParams {
  size: 2 | 3 | 4
  spacing: number
  satAz: number
  satEl: number
  jammers: { az: number; el: number; jnr: number; on: boolean }[]
  method: Method
  snapshots: number
  seed: number
}

export const SAT_SNR_DB = -20
export const LAB_GRID: SkyGrid = { nAz: 144, nEl: 37 }

export interface LabResult {
  elements: number
  gainDb: Float32Array
  musicDb: Float32Array
  satDb: number
  jammerDb: number[]
  sinrInDb: number
  sinrOutDb: number
  estimates: { navAz: number; el: number; errorDeg: number | null }[]
  weights: CVec
}

export const DEFAULT_PARAMS: LabParams = {
  size: 4,
  spacing: 0.5,
  satAz: 40,
  satEl: 55,
  // Chosen so the jammer sits on a real sidelobe of the conventional beam (≈ −12 dB),
  // which is what makes adaptation visibly matter.
  jammers: [
    { az: 150, el: 10, jnr: 40, on: true },
    { az: 290, el: 20, jnr: 35, on: false },
  ],
  method: 'mvdr',
  snapshots: 256,
  seed: 1,
}

export const PRESETS: { id: string; label: string; description: string; params: Partial<LabParams> }[] = [
  {
    id: 'single',
    label: 'One jammer',
    description: 'A 40 dB jammer near the horizon. MVDR nulls it while keeping the satellite.',
    params: { ...DEFAULT_PARAMS },
  },
  {
    id: 'two',
    label: 'Two jammers',
    description: 'Two interferers from different directions use two of the array’s degrees of freedom.',
    params: {
      jammers: [
        { az: 150, el: 10, jnr: 40, on: true },
        { az: 290, el: 20, jnr: 35, on: true },
      ],
      method: 'mvdr',
    },
  },
  {
    id: 'close',
    label: 'Jammer near satellite',
    description: 'Only ~8° apart. Spatial filtering cannot separate them cleanly — the limitation is physical.',
    params: {
      satAz: 40,
      satEl: 30,
      jammers: [
        { az: 48, el: 26, jnr: 40, on: true },
        { az: 290, el: 20, jnr: 35, on: false },
      ],
      method: 'mvdr',
    },
  },
  {
    id: 'small',
    label: '4-element array',
    description: 'A 2×2 array has 3 degrees of freedom: wide beams, but it can still null two jammers.',
    params: {
      size: 2,
      jammers: [
        { az: 150, el: 10, jnr: 40, on: true },
        { az: 290, el: 20, jnr: 35, on: true },
      ],
    },
  },
  {
    id: 'grating',
    label: 'Spacing 1 λ',
    description: 'Element spacing above λ/2 creates grating lobes — copies of the main beam elsewhere in the sky.',
    params: { spacing: 1, method: 'conventional' },
  },
]

export function computeLab(p: LabParams): LabResult {
  const g = ura(p.size, p.size, p.spacing)
  const sat: Source = { az: navToMath(p.satAz), el: p.satEl, powerDb: SAT_SNR_DB }
  const activeJammers = p.jammers.filter((j) => j.on)
  const jams: Source[] = activeJammers.map((j) => ({ az: navToMath(j.az), el: j.el, powerDb: j.jnr }))

  const R = diagonalLoad(sampleCovariance(g, [sat, ...jams], p.snapshots, p.seed), 1e-4)

  // Direction finding: MUSIC with the number of active jammers as the model order.
  const musicLin = new Float32Array(LAB_GRID.nAz * LAB_GRID.nEl)
  const musicDb = new Float32Array(musicLin.length)
  const estimates: LabResult['estimates'] = []
  if (jams.length > 0) {
    const mMax = musicSky(R, g, jams.length, LAB_GRID, musicLin)
    for (let k = 0; k < musicLin.length; k++) musicDb[k] = linToDb(musicLin[k]! / mMax)
    const peaks = skyPeaks(musicLin, LAB_GRID, jams.length)
    for (const pk of peaks) {
      const errs = jams.map((j) => angularSeparation(pk.az, pk.el, j.az, j.el))
      estimates.push({ navAz: mathToNav(pk.az), el: pk.el, errorDeg: errs.length ? Math.min(...errs) : null })
    }
  } else {
    musicDb.fill(-40)
  }

  const as = steering(g, sat.az, sat.el)
  let w: CVec
  if (p.method === 'conventional' || jams.length === 0) w = conventionalWeights(as)
  else if (p.method === 'mvdr') w = mvdrWeights(R, as)
  else {
    // LCMV: unit gain toward the satellite, zero toward each MUSIC-estimated jammer direction.
    const cons = [as, ...estimates.map((e) => steering(g, navToMath(e.navAz), e.el))]
    try {
      w = lcmvWeights(R, cons, [1, ...estimates.map(() => 0)])
    } catch {
      w = mvdrWeights(R, as)
    }
  }

  const gainLin = new Float32Array(LAB_GRID.nAz * LAB_GRID.nEl)
  const max = patternSky(w, g, LAB_GRID, gainLin)
  const gainDb = new Float32Array(gainLin.length)
  for (let k = 0; k < gainLin.length; k++) gainDb[k] = linToDb(gainLin[k]! / max)

  const [sr, si] = dot(w, as)
  return {
    elements: g.n,
    gainDb,
    musicDb,
    satDb: linToDb((sr * sr + si * si) / max),
    jammerDb: jams.map((j) => linToDb(powerResponse(w, g, j.az, j.el) / max)),
    sinrInDb: linToDb(inputSinr(sat, jams)),
    sinrOutDb: linToDb(outputSinr(w, g, sat, jams)),
    estimates,
    weights: w,
  }
}

/** Bilinear lookup of a sky map at navigation azimuth / elevation. */
export function sampleSky(map: Float32Array, navAz: number, el: number, grid: SkyGrid = LAB_GRID): number {
  const az = navToMath(navAz)
  const fi = (az / 360) * grid.nAz
  const fj = (el / 90) * (grid.nEl - 1)
  const i0 = Math.floor(fi) % grid.nAz
  const i1 = (i0 + 1) % grid.nAz
  const j0 = Math.min(grid.nEl - 1, Math.max(0, Math.floor(fj)))
  const j1 = Math.min(grid.nEl - 1, j0 + 1)
  const tx = fi - Math.floor(fi)
  const ty = fj - j0
  const v00 = map[j0 * grid.nAz + i0]!
  const v10 = map[j0 * grid.nAz + i1]!
  const v01 = map[j1 * grid.nAz + i0]!
  const v11 = map[j1 * grid.nAz + i1]!
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty
}

export interface MethodCut {
  /** Elevation of the cut (the first active jammer's, else the satellite's), degrees. */
  el: number
  /** Navigation azimuths sampled, degrees. */
  az: Float32Array
  /** Response in dB relative to the response toward the satellite (0 dB = distortionless gain). */
  db: Record<Method, Float32Array>
  /** Same normalisation, evaluated exactly at each active jammer. */
  atJammers: Record<Method, number[]>
}

/**
 * Azimuth cut through the sky for all three beamformers on the same covariance, so they can be compared
 * on one axis. LCMV uses the MUSIC estimates from `computeLab`, exactly as the main view does.
 */
export function compareCut(p: LabParams, estimates: LabResult['estimates'], step = 1): MethodCut {
  const g = ura(p.size, p.size, p.spacing)
  const sat: Source = { az: navToMath(p.satAz), el: p.satEl, powerDb: SAT_SNR_DB }
  const active = p.jammers.filter((j) => j.on)
  const jams: Source[] = active.map((j) => ({ az: navToMath(j.az), el: j.el, powerDb: j.jnr }))
  const R = diagonalLoad(sampleCovariance(g, [sat, ...jams], p.snapshots, p.seed), 1e-4)
  const as = steering(g, sat.az, sat.el)
  const weights: Record<Method, CVec> = {
    conventional: conventionalWeights(as),
    mvdr: jams.length ? mvdrWeights(R, as) : conventionalWeights(as),
    lcmv: conventionalWeights(as),
  }
  if (jams.length) {
    try {
      const cons = [as, ...estimates.map((e) => steering(g, navToMath(e.navAz), e.el))]
      weights.lcmv = lcmvWeights(R, cons, [1, ...estimates.map(() => 0)])
    } catch {
      weights.lcmv = weights.mvdr
    }
  }
  const el = active[0]?.el ?? p.satEl
  const n = Math.round(360 / step)
  const az = new Float32Array(n)
  for (let i = 0; i < n; i++) az[i] = i * step
  const db = {} as Record<Method, Float32Array>
  const atJammers = {} as Record<Method, number[]>
  for (const m of ['conventional', 'mvdr', 'lcmv'] as Method[]) {
    const w = weights[m]
    const ref = powerResponse(w, g, sat.az, sat.el)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) out[i] = linToDb(powerResponse(w, g, navToMath(az[i]!), el) / ref)
    db[m] = out
    atJammers[m] = jams.map((j) => linToDb(powerResponse(w, g, j.az, j.el) / ref))
  }
  return { el, az, db, atJammers }
}
