/**
 * Narrowband array signal processing — the model behind the hero scene and the beamforming lab.
 *
 * Assumptions (also stated on the page):
 *  - far-field plane waves, narrowband (single carrier frequency)
 *  - identical isotropic elements, no mutual coupling, perfect calibration
 *  - element positions expressed in wavelengths, array in the x–y plane, z up
 *  - azimuth measured from +x toward +y, elevation above the horizon
 *
 * Complex vectors/matrices are stored as separate real/imaginary Float64Arrays to keep
 * per-frame evaluation allocation-free.
 */

export interface CVec {
  re: Float64Array
  im: Float64Array
}

/** Row-major n×n complex matrix. */
export interface CMat {
  n: number
  re: Float64Array
  im: Float64Array
}

export interface Geometry {
  n: number
  x: Float64Array
  y: Float64Array
  z: Float64Array
}

export interface Source {
  az: number
  el: number
  /** Power relative to the per-element noise power, in dB. */
  powerDb: number
}

const DEG = Math.PI / 180

export const GPS_L1_HZ = 1575.42e6
export const SPEED_OF_LIGHT = 299_792_458
export const L1_WAVELENGTH_M = SPEED_OF_LIGHT / GPS_L1_HZ

export function cvec(n: number): CVec {
  return { re: new Float64Array(n), im: new Float64Array(n) }
}

export function cmat(n: number): CMat {
  return { n, re: new Float64Array(n * n), im: new Float64Array(n * n) }
}

export const dbToLin = (db: number) => Math.pow(10, db / 10)
export const linToDb = (lin: number) => 10 * Math.log10(Math.max(lin, 1e-30))

/** Uniform rectangular array of nx × ny elements, spacing d (in wavelengths), centred at the origin. */
export function ura(nx: number, ny: number, d: number): Geometry {
  const n = nx * ny
  const g: Geometry = { n, x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n) }
  let k = 0
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      g.x[k] = (i - (nx - 1) / 2) * d
      g.y[k] = (j - (ny - 1) / 2) * d
      g.z[k] = 0
      k++
    }
  }
  return g
}

export function unitVector(azDeg: number, elDeg: number): [number, number, number] {
  const az = azDeg * DEG
  const el = elDeg * DEG
  return [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]
}

/** Steering vector a_m = exp(j·2π·(p_m · u)). */
export function steering(g: Geometry, azDeg: number, elDeg: number, out: CVec = cvec(g.n)): CVec {
  const [ux, uy, uz] = unitVector(azDeg, elDeg)
  for (let m = 0; m < g.n; m++) {
    const phase = 2 * Math.PI * (g.x[m]! * ux + g.y[m]! * uy + g.z[m]! * uz)
    out.re[m] = Math.cos(phase)
    out.im[m] = Math.sin(phase)
  }
  return out
}

/** Exact covariance R = σ²I + Σ P_k a_k a_kᴴ (infinite snapshots). */
export function exactCovariance(g: Geometry, sources: Source[], noise = 1): CMat {
  const n = g.n
  const R = cmat(n)
  for (let i = 0; i < n; i++) R.re[i * n + i] = noise
  const a = cvec(n)
  for (const s of sources) {
    const p = dbToLin(s.powerDb) * noise
    steering(g, s.az, s.el, a)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // a_i * conj(a_j)
        R.re[i * n + j] = R.re[i * n + j]! + (p * (a.re[i]! * a.re[j]! + a.im[i]! * a.im[j]!))
        R.im[i * n + j] = R.im[i * n + j]! + (p * (a.im[i]! * a.re[j]! - a.re[i]! * a.im[j]!))
      }
    }
  }
  return R
}

/** Deterministic PRNG (mulberry32) so lab results are reproducible for a given seed. */
export function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function gaussianPair(rand: () => number): [number, number] {
  const u = Math.max(rand(), 1e-12)
  const v = rand()
  const r = Math.sqrt(-2 * Math.log(u))
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)]
}

/**
 * Sample covariance R̂ = (1/N) Σ x xᴴ from simulated snapshots.
 * Each source is a unit-power complex Gaussian waveform (a reasonable model for a noise jammer and,
 * at these powers, for a spread-spectrum GNSS signal); noise is circular complex Gaussian.
 */
export function sampleCovariance(g: Geometry, sources: Source[], snapshots: number, seed = 1, noise = 1): CMat {
  const n = g.n
  const rand = rng(seed)
  const steer = sources.map((s) => steering(g, s.az, s.el))
  const amp = sources.map((s) => Math.sqrt(dbToLin(s.powerDb) * noise))
  const x = cvec(n)
  const R = cmat(n)
  const nAmp = Math.sqrt(noise / 2)
  for (let t = 0; t < snapshots; t++) {
    for (let m = 0; m < n; m++) {
      const [a, b] = gaussianPair(rand)
      x.re[m] = a * nAmp
      x.im[m] = b * nAmp
    }
    for (let k = 0; k < sources.length; k++) {
      const [sr0, si0] = gaussianPair(rand)
      const sr = (sr0 * amp[k]!) / Math.SQRT2
      const si = (si0 * amp[k]!) / Math.SQRT2
      const a = steer[k]!
      for (let m = 0; m < n; m++) {
        x.re[m] = x.re[m]! + (sr * a.re[m]! - si * a.im[m]!)
        x.im[m] = x.im[m]! + (sr * a.im[m]! + si * a.re[m]!)
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        R.re[i * n + j] = R.re[i * n + j]! + (x.re[i]! * x.re[j]! + x.im[i]! * x.im[j]!)
        R.im[i * n + j] = R.im[i * n + j]! + (x.im[i]! * x.re[j]! - x.re[i]! * x.im[j]!)
      }
    }
  }
  for (let k = 0; k < n * n; k++) {
    R.re[k] = R.re[k]! / (snapshots)
    R.im[k] = R.im[k]! / (snapshots)
  }
  return R
}

/** Adds diagonal loading δ·tr(R)/n — standard regularisation for sample covariances. */
export function diagonalLoad(R: CMat, fraction: number): CMat {
  const n = R.n
  const out: CMat = { n, re: R.re.slice(), im: R.im.slice() }
  let tr = 0
  for (let i = 0; i < n; i++) tr += R.re[i * n + i]!
  const d = (fraction * tr) / n
  for (let i = 0; i < n; i++) out.re[i * n + i] = out.re[i * n + i]! + d
  return out
}

/** Solves R x = b by Gaussian elimination with partial pivoting (complex). */
export function solve(R: CMat, b: CVec): CVec {
  const n = R.n
  const Ar = R.re.slice()
  const Ai = R.im.slice()
  const xr = b.re.slice()
  const xi = b.im.slice()
  for (let c = 0; c < n; c++) {
    let p = c
    let best = -1
    for (let r = c; r < n; r++) {
      const mag = Ar[r * n + c]! ** 2 + Ai[r * n + c]! ** 2
      if (mag > best) {
        best = mag
        p = r
      }
    }
    if (best < 1e-300) throw new Error('Singular matrix')
    if (p !== c) {
      for (let k = 0; k < n; k++) {
        ;[Ar[c * n + k], Ar[p * n + k]] = [Ar[p * n + k]!, Ar[c * n + k]!]
        ;[Ai[c * n + k], Ai[p * n + k]] = [Ai[p * n + k]!, Ai[c * n + k]!]
      }
      ;[xr[c], xr[p]] = [xr[p]!, xr[c]!]
      ;[xi[c], xi[p]] = [xi[p]!, xi[c]!]
    }
    const pr = Ar[c * n + c]!
    const pi = Ai[c * n + c]!
    const pm = pr * pr + pi * pi
    for (let r = c + 1; r < n; r++) {
      const er = Ar[r * n + c]!
      const ei = Ai[r * n + c]!
      // f = e / pivot
      const fr = (er * pr + ei * pi) / pm
      const fi = (ei * pr - er * pi) / pm
      if (fr === 0 && fi === 0) continue
      for (let k = c; k < n; k++) {
        const ar = Ar[c * n + k]!
        const ai = Ai[c * n + k]!
        Ar[r * n + k] = Ar[r * n + k]! - (fr * ar - fi * ai)
        Ai[r * n + k] = Ai[r * n + k]! - (fr * ai + fi * ar)
      }
      xr[r] = xr[r]! - (fr * xr[c]! - fi * xi[c]!)
      xi[r] = xi[r]! - (fr * xi[c]! + fi * xr[c]!)
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let sr = xr[r]!
    let si = xi[r]!
    for (let k = r + 1; k < n; k++) {
      const ar = Ar[r * n + k]!
      const ai = Ai[r * n + k]!
      sr -= ar * xr[k]! - ai * xi[k]!
      si -= ar * xi[k]! + ai * xr[k]!
    }
    const pr = Ar[r * n + r]!
    const pi = Ai[r * n + r]!
    const pm = pr * pr + pi * pi
    xr[r] = (sr * pr + si * pi) / pm
    xi[r] = (si * pr - sr * pi) / pm
  }
  return { re: xr, im: xi }
}

/** Inner product uᴴ v. */
export function dot(u: CVec, v: CVec): [number, number] {
  let re = 0
  let im = 0
  for (let m = 0; m < u.re.length; m++) {
    re += u.re[m]! * v.re[m]! + u.im[m]! * v.im[m]!
    im += u.re[m]! * v.im[m]! - u.im[m]! * v.re[m]!
  }
  return [re, im]
}

/** Delay-and-sum weights steered at a, normalised to unit gain toward a. */
export function conventionalWeights(a: CVec): CVec {
  const n = a.re.length
  return { re: a.re.map((v) => v / n), im: a.im.map((v) => v / n) }
}

/** MVDR / Capon: w = R⁻¹a / (aᴴR⁻¹a). */
export function mvdrWeights(R: CMat, a: CVec): CVec {
  const Ria = solve(R, a)
  const [dr, di] = dot(a, Ria)
  const dm = dr * dr + di * di
  return {
    re: Ria.re.map((r, m) => (r * dr + Ria.im[m]! * di) / dm),
    im: Ria.im.map((i, m) => (i * dr - Ria.re[m]! * di) / dm),
  }
}

/**
 * LCMV: w = R⁻¹C (CᴴR⁻¹C)⁻¹ f with real-valued responses f
 * (e.g. f = [1, 0] → unit gain toward the satellite, exact null toward one jammer).
 */
export function lcmvWeights(R: CMat, constraints: CVec[], f: number[]): CVec {
  const L = constraints.length
  const n = R.n
  const RiC = constraints.map((c) => solve(R, c))
  // G = Cᴴ R⁻¹ C  (L×L, Hermitian)
  const G = cmat(L)
  for (let i = 0; i < L; i++) {
    for (let j = 0; j < L; j++) {
      const [re, im] = dot(constraints[i]!, RiC[j]!)
      G.re[i * L + j] = re
      G.im[i * L + j] = im
    }
  }
  const fv: CVec = { re: Float64Array.from(f), im: new Float64Array(L) }
  const g = solve(G, fv)
  const w = cvec(n)
  for (let j = 0; j < L; j++) {
    const v = RiC[j]!
    for (let m = 0; m < n; m++) {
      w.re[m] = w.re[m]! + (v.re[m]! * g.re[j]! - v.im[m]! * g.im[j]!)
      w.im[m] = w.im[m]! + (v.re[m]! * g.im[j]! + v.im[m]! * g.re[j]!)
    }
  }
  return w
}

/** Array power response |wᴴa|² toward a direction. */
export function powerResponse(w: CVec, g: Geometry, az: number, el: number, scratch: CVec = cvec(g.n)): number {
  steering(g, az, el, scratch)
  const [re, im] = dot(w, scratch)
  return re * re + im * im
}

/** Sky grid convention shared by all pattern evaluators. */
export interface SkyGrid {
  nAz: number
  nEl: number
}
export const gridAz = (grid: SkyGrid, i: number) => (i * 360) / grid.nAz
export const gridEl = (grid: SkyGrid, j: number) => (j * 90) / (grid.nEl - 1)

/** Evaluates |wᴴa|² over the upper hemisphere into out[j*nAz + i]. Returns the maximum. */
export function patternSky(w: CVec, g: Geometry, grid: SkyGrid, out: Float32Array): number {
  const scratch = cvec(g.n)
  let max = 0
  for (let j = 0; j < grid.nEl; j++) {
    const el = gridEl(grid, j)
    for (let i = 0; i < grid.nAz; i++) {
      const p = powerResponse(w, g, gridAz(grid, i), el, scratch)
      out[j * grid.nAz + i] = p
      if (p > max) max = p
    }
  }
  return max
}

/**
 * Output SINR for weights w with a desired source and interference-plus-noise sources.
 * SINR = P_s |wᴴa_s|² / (wᴴ R_in w), with R_in built exactly from the true scene.
 */
export function outputSinr(w: CVec, g: Geometry, desired: Source, interferers: Source[], noise = 1): number {
  const Rin = exactCovariance(g, interferers, noise)
  const as = steering(g, desired.az, desired.el)
  const [sr, si] = dot(w, as)
  const signal = dbToLin(desired.powerDb) * noise * (sr * sr + si * si)
  const Rw = matVec(Rin, w)
  const [den] = dot(w, Rw)
  return signal / den
}

/** Single-element input SINR: P_s / (Σ P_j + σ²). */
export function inputSinr(desired: Source, interferers: Source[], noise = 1): number {
  const interf = interferers.reduce((s, j) => s + dbToLin(j.powerDb) * noise, 0)
  return (dbToLin(desired.powerDb) * noise) / (interf + noise)
}

export function matVec(R: CMat, v: CVec): CVec {
  const n = R.n
  const out = cvec(n)
  for (let i = 0; i < n; i++) {
    let re = 0
    let im = 0
    for (let j = 0; j < n; j++) {
      const ar = R.re[i * n + j]!
      const ai = R.im[i * n + j]!
      re += ar * v.re[j]! - ai * v.im[j]!
      im += ar * v.im[j]! + ai * v.re[j]!
    }
    out.re[i] = re
    out.im[i] = im
  }
  return out
}

/**
 * Eigen-decomposition of a Hermitian matrix via its real symmetric embedding
 * [[Re, −Im], [Im, Re]] and cyclic Jacobi rotations. Each complex eigenpair appears twice;
 * we return the 2n real eigenvectors sorted by ascending eigenvalue, which is sufficient for
 * subspace projectors (MUSIC).
 */
export function realEmbeddingEig(R: CMat): { values: Float64Array; vectors: Float64Array[] } {
  const n = R.n
  const N = 2 * n
  const A = new Float64Array(N * N)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const re = R.re[i * n + j]!
      const im = R.im[i * n + j]!
      A[i * N + j] = re
      A[i * N + (j + n)] = -im
      A[(i + n) * N + j] = im
      A[(i + n) * N + (j + n)] = re
    }
  }
  const V = new Float64Array(N * N)
  for (let i = 0; i < N; i++) V[i * N + i] = 1
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0
    for (let p = 0; p < N; p++) for (let q = p + 1; q < N; q++) off += A[p * N + q]! ** 2
    if (off < 1e-22) break
    for (let p = 0; p < N - 1; p++) {
      for (let q = p + 1; q < N; q++) {
        const apq = A[p * N + q]!
        if (Math.abs(apq) < 1e-300) continue
        const app = A[p * N + p]!
        const aqq = A[q * N + q]!
        const theta = (aqq - app) / (2 * apq)
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < N; k++) {
          const akp = A[k * N + p]!
          const akq = A[k * N + q]!
          A[k * N + p] = c * akp - s * akq
          A[k * N + q] = s * akp + c * akq
        }
        for (let k = 0; k < N; k++) {
          const apk = A[p * N + k]!
          const aqk = A[q * N + k]!
          A[p * N + k] = c * apk - s * aqk
          A[q * N + k] = s * apk + c * aqk
        }
        for (let k = 0; k < N; k++) {
          const vkp = V[k * N + p]!
          const vkq = V[k * N + q]!
          V[k * N + p] = c * vkp - s * vkq
          V[k * N + q] = s * vkp + c * vkq
        }
      }
    }
  }
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => A[a * N + a]! - A[b * N + b]!)
  return {
    values: Float64Array.from(order.map((i) => A[i * N + i]!)),
    vectors: order.map((col) => Float64Array.from({ length: N }, (_, k) => V[k * N + col]!)),
  }
}

/**
 * MUSIC pseudo-spectrum over the sky grid for `numSources` sources:
 * P(θ) = 1 / (a(θ)ᴴ Eₙ Eₙᴴ a(θ)).
 */
export function musicSky(R: CMat, g: Geometry, numSources: number, grid: SkyGrid, out: Float32Array): number {
  const n = R.n
  const { vectors } = realEmbeddingEig(R)
  // Noise subspace: the 2(n − K) real eigenvectors with the smallest eigenvalues.
  const noiseVecs = vectors.slice(0, 2 * Math.max(n - numSources, 1))
  const a = cvec(n)
  let max = 0
  for (let j = 0; j < grid.nEl; j++) {
    const el = gridEl(grid, j)
    for (let i = 0; i < grid.nAz; i++) {
      steering(g, gridAz(grid, i), el, a)
      let proj = 0
      for (const e of noiseVecs) {
        // ãᵀe with ã = [Re a; Im a]
        let s = 0
        for (let m = 0; m < n; m++) s += a.re[m]! * e[m]! + a.im[m]! * e[m + n]!
        proj += s * s
      }
      // Each complex noise eigenvector contributes twice in the embedding.
      const p = 1 / Math.max(proj / 2, 1e-12)
      out[j * grid.nAz + i] = p
      if (p > max) max = p
    }
  }
  return max
}

/** Local maxima of a sky map (azimuth wraps), strongest first, at least `minSepDeg` apart. */
export function skyPeaks(map: Float32Array, grid: SkyGrid, k: number, minSepDeg = 12): { az: number; el: number; value: number }[] {
  const cands: { az: number; el: number; value: number }[] = []
  for (let j = 0; j < grid.nEl; j++) {
    for (let i = 0; i < grid.nAz; i++) {
      const v = map[j * grid.nAz + i]!
      let isMax = true
      for (let dj = -1; dj <= 1 && isMax; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue
          const jj = j + dj
          if (jj < 0 || jj >= grid.nEl) continue
          const ii = (i + di + grid.nAz) % grid.nAz
          if (map[jj * grid.nAz + ii]! > v) {
            isMax = false
            break
          }
        }
      }
      if (isMax) cands.push({ az: gridAz(grid, i), el: gridEl(grid, j), value: v })
    }
  }
  cands.sort((a, b) => b.value - a.value)
  const picked: typeof cands = []
  for (const c of cands) {
    if (picked.every((p) => angularSeparation(p.az, p.el, c.az, c.el) >= minSepDeg)) picked.push(c)
    if (picked.length >= k) break
  }
  return picked
}

export function angularSeparation(az1: number, el1: number, az2: number, el2: number): number {
  const [x1, y1, z1] = unitVector(az1, el1)
  const [x2, y2, z2] = unitVector(az2, el2)
  const c = Math.min(1, Math.max(-1, x1 * x2 + y1 * y2 + z1 * z2))
  return Math.acos(c) / DEG
}
