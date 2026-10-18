import * as THREE from 'three'
import { conventionalWeights, exactCovariance, linToDb, mvdrWeights, patternSky, steering, unitVector, ura, type SkyGrid } from '../../lib/beamforming'
import { JOURNEY_STAGES, journeyAt, smoothstep } from '../../lib/journeyPath'
import type { DeviceTier } from '../../lib/env'

/**
 * "A signal's journey": six worlds placed along −z, one camera flying between them,
 * passing through a ring portal at each transition. Scroll progress drives the camera and
 * per-world animation; time drives ambient motion. Plain Three.js, rendered only while visible.
 *
 *   0 space · 1 interference (spectrum waterfall) · 2 adaptive array (pattern morph)
 *   3 FPGA fabric (streaming samples) · 4 perception (point cloud + trajectory) · 5 position fix
 */

export interface JourneySceneOptions {
  canvas: HTMLCanvasElement
  tier: DeviceTier
  onFirstFrame?: () => void
  onContextLost?: () => void
}

const SPACING = 60
const center = (i: number) => new THREE.Vector3(0, 0, -SPACING * i)

/** Camera station (relative to its world centre) and look target for each world. */
const STATIONS: { pos: [number, number, number]; look: [number, number, number] }[] = [
  { pos: [12, 4, 19], look: [0, 0.5, 0] },
  { pos: [2, 14, 21], look: [0, 0.6, -3] },
  { pos: [9.5, 5.5, 12], look: [0, 1.6, 0] },
  { pos: [-8, 12.5, 15], look: [0.5, 0, 0.5] },
  { pos: [7, 11, 16], look: [0, 0, 0.5] },
  { pos: [0, 2.5, 21], look: [0, 0, 0] },
]

const BG = ['#04050b', '#0b0806', '#05070f', '#04090a', '#07080a', '#050712'].map((c) => new THREE.Color(c))
const SIGNAL = new THREE.Color('#5b7cff')
const SIGNAL_BRIGHT = new THREE.Color('#b9c6ff')
const AMBER = new THREE.Color('#ffb23f')
const LIME = new THREE.Color('#c8f25a')
const WHITE = new THREE.Color('#eeebe4')

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Points evenly spread on a unit sphere (Fibonacci lattice). */
function fibonacciSphere(n: number): Float32Array {
  const out = new Float32Array(n * 3)
  const g = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    out[i * 3] = Math.cos(g * i) * r
    out[i * 3 + 1] = y
    out[i * 3 + 2] = Math.sin(g * i) * r
  }
  return out
}

/** Maths frame (z up) → three.js frame (y up). */
function skyDir(az: number, el: number, r: number, out = new THREE.Vector3()) {
  const [x, y, z] = unitVector(az, el)
  return out.set(x * r, z * r, -y * r)
}

const pointsMaterial = (glow: THREE.Texture, color: THREE.Color, size: number, opacity = 1) =>
  new THREE.PointsMaterial({ map: glow, color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })

export class JourneyScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
  private opts: JourneySceneOptions
  private raf = 0
  private visible = false
  private disposed = false
  private firstFrame = false
  private lastTime = performance.now()
  private elapsed = 0
  private progress = 0
  private progressSmoothed = 0
  private pointer = new THREE.Vector2()
  private pointerSmoothed = new THREE.Vector2()
  private glow = glowTexture()
  private tmpA = new THREE.Vector3()
  private tmpB = new THREE.Vector3()

  // Animated parts.
  private timeUniforms: { value: number }[] = []
  private satellite!: THREE.Group
  private arrayPattern!: { attr: THREE.BufferAttribute; gain: THREE.BufferAttribute; from: Float32Array; to: Float32Array; gFrom: Float32Array; gTo: Float32Array; last: number }
  private trajectory!: { line: THREE.Mesh; curve: THREE.CatmullRomCurve3; vehicle: THREE.Object3D; scan: THREE.Mesh; count: number }
  private fix!: { globe: THREE.Group; lines: THREE.LineSegments; pulse: THREE.Sprite }
  private portals: THREE.Mesh[] = []

  constructor(opts: JourneySceneOptions) {
    this.opts = opts
    const { canvas, tier } = opts
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', alpha: false, powerPreference: 'high-performance' })
    const maxDpr = tier === 'high' ? 1.6 : tier === 'mid' ? 1.35 : 1
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = BG[0]!.clone()
    this.scene.fog = new THREE.FogExp2(BG[0]!.getHex(), 0.03)
    canvas.addEventListener('webglcontextlost', this.onContextLost, false)

    const k = tier === 'low' ? 0.5 : tier === 'mid' ? 0.75 : 1
    this.buildStars(Math.round(2600 * k))
    this.buildSpace(k)
    this.buildInterference(k)
    this.buildArray()
    this.buildFpga(k)
    this.buildPerception(k)
    this.buildFix(k)
    this.buildPortals()

    this.resize()
    this.renderFrame(0)
  }

  // ─────────────────────────────────────────────────────────── worlds
  private timeUniform() {
    const u = { value: 0 }
    this.timeUniforms.push(u)
    return u
  }

  private buildStars(n: number) {
    const r = rng(1)
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (r() - 0.5) * 160
      pos[i * 3 + 1] = (r() - 0.5) * 110
      pos[i * 3 + 2] = 40 - r() * (SPACING * JOURNEY_STAGES + 60)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.scene.add(new THREE.Points(g, pointsMaterial(this.glow, WHITE, 0.35, 0.55)))
  }

  /** World 0 — satellite broadcasting expanding wavefronts toward a dark Earth. */
  private buildSpace(k: number) {
    const c = center(0)
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(8, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: { uRim: { value: SIGNAL } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 uRim; varying vec3 vN; varying vec3 vV;
          void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0); gl_FragColor = vec4(mix(vec3(0.02,0.03,0.06), uRim, f), 1.0); }`,
      }),
    )
    earth.position.set(c.x - 2, c.y - 11, c.z - 3)
    this.scene.add(earth)

    const sat = new THREE.Group()
    const bodyGeo = new THREE.BoxGeometry(0.9, 0.9, 1.3)
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x2a3140 }))
    body.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo), new THREE.LineBasicMaterial({ color: 0xeeebe4, transparent: true, opacity: 0.7 })))
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x14205a })
    const panelL = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 1), panelMat)
    panelL.position.x = -2.1
    const panelR = panelL.clone()
    panelR.position.x = 2.1
    const edges = new THREE.LineBasicMaterial({ color: SIGNAL_BRIGHT, transparent: true, opacity: 0.6 })
    for (const p of [panelL, panelR]) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(p.geometry), edges)
      e.position.copy(p.position)
      // Solar-cell grid.
      const grid = new THREE.LineSegments(
        new THREE.WireframeGeometry(new THREE.PlaneGeometry(3, 1, 8, 3)),
        new THREE.LineBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.45 }),
      )
      grid.rotation.x = -Math.PI / 2
      grid.position.set(p.position.x, 0.03, 0)
      sat.add(e, grid)
    }
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xeeebe4, side: THREE.DoubleSide }))
    dish.position.y = -0.65
    sat.add(body, panelL, panelR, dish)
    sat.position.set(c.x, c.y + 3.5, c.z)
    this.satellite = sat
    this.scene.add(sat)

    // Expanding wavefront shells (point-sampled spheres), brighter on the Earth-facing side.
    const shells = 5
    const per = Math.round(520 * k)
    const unit = fibonacciSphere(per)
    const pos = new Float32Array(shells * per * 3)
    const shell = new Float32Array(shells * per)
    for (let s = 0; s < shells; s++) {
      pos.set(unit, s * per * 3)
      shell.fill(s, s * per, (s + 1) * per)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aShell', new THREE.BufferAttribute(shell, 1))
    const pts = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: this.timeUniform(), uColor: { value: SIGNAL_BRIGHT }, uPx: { value: this.renderer.getPixelRatio() } },
        vertexShader: `uniform float uTime; uniform float uPx; attribute float aShell; varying float vA;
          void main(){
            float r = mod(uTime * 1.4 + aShell * 3.2, 16.0);
            vec3 p = position * r;
            vA = (1.0 - r / 16.0) * smoothstep(0.0, 1.5, r) * (0.25 + 0.75 * smoothstep(0.2, -0.9, position.y));
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = uPx * 4.0 * (10.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `uniform vec3 uColor; varying float vA;
          void main(){ vec2 c = gl_PointCoord - 0.5; if (dot(c,c) > 0.25) discard; gl_FragColor = vec4(uColor, vA); }`,
      }),
    )
    pts.position.copy(sat.position)
    this.scene.add(pts)
  }

  /** World 1 — spectrum waterfall: noise floor, a buried GNSS signal, a CW jammer and a chirp. */
  private buildInterference(k: number) {
    const c = center(1)
    const nx = Math.round(170 * k) + 30
    const nz = Math.round(44 * k) + 12
    const W = 28
    const D = 20
    const pos = new Float32Array(nx * nz * 3)
    const idx: number[] = []
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const o = (j * nx + i) * 3
        pos[o] = (i / (nx - 1) - 0.5) * W
        pos[o + 1] = 0
        pos[o + 2] = (j / (nz - 1) - 0.5) * D
        if (i < nx - 1) idx.push(j * nx + i, j * nx + i + 1)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setIndex(idx)
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: this.timeUniform(), uAmber: { value: AMBER }, uBlue: { value: SIGNAL_BRIGHT }, uGrey: { value: new THREE.Color('#6b7280') } },
      vertexShader: `uniform float uTime; varying float vH; varying float vSig; varying float vFront;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
        void main(){
          vec3 p = position;
          float row = p.z - uTime * 2.2;
          float floorN = 0.35 + 0.45 * noise(vec2(p.x * 2.6, row * 1.3));
          float sig = 0.18 * exp(-pow((p.x + 1.5) / 0.35, 2.0));
          float cw = 4.2 * exp(-pow((p.x - 6.0) / 0.16, 2.0)) * (0.85 + 0.15 * sin(uTime * 3.0));
          float chirpX = -12.0 + mod(row * 0.9 + uTime * 0.6, 22.0);
          float chirp = 1.7 * exp(-pow((p.x - chirpX) / 0.45, 2.0));
          p.y = floorN + sig + cw + chirp;
          vH = cw + chirp;
          vSig = exp(-pow((p.x + 1.5) / 0.5, 2.0));
          vFront = smoothstep(-10.0, 10.0, position.z);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform vec3 uAmber; uniform vec3 uBlue; uniform vec3 uGrey; varying float vH; varying float vSig; varying float vFront;
        void main(){
          vec3 col = mix(uGrey, uAmber, smoothstep(0.4, 1.4, vH));
          col = mix(col, uBlue, smoothstep(0.15, 0.6, vSig) * (1.0 - smoothstep(0.4, 1.0, vH)));
          float a = (0.16 + 0.6 * vFront) * (0.5 + 0.5 * smoothstep(0.3, 1.5, vH)) + 0.55 * vSig * vFront;
          gl_FragColor = vec4(col, a);
        }`,
    })
    const waterfall = new THREE.LineSegments(g, mat)
    waterfall.position.copy(c)
    this.scene.add(waterfall)

    // Detection threshold plane.
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false }),
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.set(c.x, c.y + 1.15, c.z)
    this.scene.add(plane)
  }

  /** World 2 — 4×4 array; pattern morphs from conventional to MVDR as you scroll. */
  private buildArray() {
    const c = center(2)
    const geom = ura(4, 4, 0.5)
    const sat = { az: 35, el: 58 }
    const jam = { az: 200, el: 12 }
    const grid: SkyGrid = { nAz: 72, nEl: 22 }
    const a = steering(geom, sat.az, sat.el)
    const conv = conventionalWeights(a)
    const mvdr = mvdrWeights(
      exactCovariance(geom, [
        { ...sat, powerDb: -20 },
        { ...jam, powerDb: 40 },
      ]),
      a,
    )
    const cols = grid.nAz + 1
    const build = (w: typeof conv) => {
      const raw = new Float32Array(grid.nAz * grid.nEl)
      const max = patternSky(w, geom, grid, raw)
      const pos = new Float32Array(cols * grid.nEl * 3)
      const gain = new Float32Array(cols * grid.nEl)
      const v = new THREE.Vector3()
      for (let j = 0; j < grid.nEl; j++) {
        for (let cc = 0; cc < cols; cc++) {
          const i = cc % grid.nAz
          const t = Math.min(1, Math.max(0, (linToDb(raw[j * grid.nAz + i]! / max) + 40) / 40))
          skyDir((i * 360) / grid.nAz, (j * 90) / (grid.nEl - 1), 3.6 * (0.05 + 0.95 * t * t), v)
          const kk = j * cols + cc
          pos[kk * 3] = v.x
          pos[kk * 3 + 1] = v.y + 0.15
          pos[kk * 3 + 2] = v.z
          gain[kk] = t
        }
      }
      return { pos, gain }
    }
    const from = build(conv)
    const to = build(mvdr)
    const attr = new THREE.BufferAttribute(from.pos.slice(), 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    const gain = new THREE.BufferAttribute(from.gain.slice(), 1)
    gain.setUsage(THREE.DynamicDrawUsage)
    const lines: number[] = []
    for (let j = 0; j < grid.nEl; j += 2) for (let i = 0; i < grid.nAz; i++) lines.push(j * cols + i, j * cols + i + 1)
    for (let i = 0; i < grid.nAz; i += 3) for (let j = 0; j < grid.nEl - 1; j++) lines.push(j * cols + i, (j + 1) * cols + i)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', attr)
    g.setAttribute('aGain', gain)
    g.setIndex(lines)
    const mesh = new THREE.LineSegments(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uLow: { value: new THREE.Color('#1a2a6e') }, uHigh: { value: SIGNAL }, uPeak: { value: SIGNAL_BRIGHT } },
        vertexShader: `attribute float aGain; varying float vG; void main(){ vG = aGain; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uLow; uniform vec3 uHigh; uniform vec3 uPeak; varying float vG;
          void main(){ vec3 c = mix(uLow, uHigh, smoothstep(0.0, 0.75, vG)); c = mix(c, uPeak, smoothstep(0.82, 1.0, vG)); gl_FragColor = vec4(c, 0.3 + 0.6 * vG); }`,
      }),
    )
    mesh.position.copy(c)
    this.scene.add(mesh)
    this.arrayPattern = { attr, gain, from: from.pos, to: to.pos, gFrom: from.gain, gTo: to.gain, last: -1 }

    // Elements, plate, satellite and jammer markers.
    const inst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 14), new THREE.MeshBasicMaterial({ color: 0xeeebe4 }), geom.n)
    const m4 = new THREE.Matrix4()
    for (let n = 0; n < geom.n; n++) {
      m4.makeTranslation(c.x + geom.x[n]! * 1.3, c.y + 0.1, c.z - geom.y[n]! * 1.3)
      inst.setMatrixAt(n, m4)
    }
    this.scene.add(inst)
    const plate = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.5, 0.03, 2.5)), new THREE.LineBasicMaterial({ color: 0xeeebe4, transparent: true, opacity: 0.3 }))
    plate.position.copy(c)
    this.scene.add(plate)

    const satPos = skyDir(sat.az, sat.el, 6.5).add(c)
    const satDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: SIGNAL_BRIGHT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    satDot.scale.setScalar(0.9)
    satDot.position.copy(satPos)
    this.scene.add(satDot)
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([satPos, c.clone().setY(0.15)]), new THREE.LineBasicMaterial({ color: SIGNAL_BRIGHT, transparent: true, opacity: 0.6 })))

    const jamPos = skyDir(jam.az, jam.el, 6.2).add(c)
    const jamBody = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: AMBER }))
    jamBody.position.copy(jamPos)
    const jamGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: AMBER, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }))
    jamGlow.scale.setScalar(1.6)
    jamGlow.position.copy(jamPos)
    this.scene.add(jamBody, jamGlow)
    const dashed = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([jamPos, c.clone().setY(0.15)]),
      new THREE.LineDashedMaterial({ color: AMBER, dashSize: 0.2, gapSize: 0.15, transparent: true, opacity: 0.55 }),
    )
    dashed.computeLineDistances()
    this.scene.add(dashed)
  }

  /** World 3 — FPGA fabric with sample streams flowing through four processing blocks. */
  private buildFpga(k: number) {
    const c = center(3)
    const cols = 18
    const rows = 11
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.1, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff }), cols * rows)
    const m4 = new THREE.Matrix4()
    const col = new THREE.Color()
    const r = rng(5)
    let n = 0
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        m4.makeTranslation(c.x + (i - (cols - 1) / 2) * 1.08, c.y, c.z + (j - (rows - 1) / 2) * 1.08)
        tiles.setMatrixAt(n, m4)
        col.setRGB(0.035 + r() * 0.025, 0.04 + r() * 0.025, 0.06 + r() * 0.035, THREE.SRGBColorSpace)
        tiles.setColorAt(n++, col)
      }
    }
    this.scene.add(tiles)

    const edgeMat = new THREE.LineBasicMaterial({ color: SIGNAL_BRIGHT, transparent: true, opacity: 0.85 })
    const blockGeo = new THREE.BoxGeometry(2.3, 0.7, 3.4)
    for (const x of [-6.5, -2.2, 2.2, 6.5]) {
      const block = new THREE.Mesh(blockGeo, new THREE.MeshBasicMaterial({ color: 0x0d1430, transparent: true, opacity: 0.85 }))
      block.position.set(c.x + x, c.y + 0.4, c.z)
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(blockGeo), edgeMat)
      e.position.copy(block.position)
      this.scene.add(block, e)
    }

    const lanes = 5
    const per = Math.round(70 * k) + 20
    const pos = new Float32Array(lanes * per * 3)
    for (let l = 0; l < lanes; l++) {
      for (let p = 0; p < per; p++) {
        const o = (l * per + p) * 3
        pos[o] = r() * 22
        pos[o + 1] = 0.85
        pos[o + 2] = (l - (lanes - 1) / 2) * 0.62
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const stream = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: this.timeUniform(), uA: { value: SIGNAL_BRIGHT }, uB: { value: LIME }, uPx: { value: this.renderer.getPixelRatio() } },
        vertexShader: `uniform float uTime; uniform float uPx; varying float vX;
          void main(){
            vec3 p = position;
            p.x = mod(p.x + uTime * 3.2, 22.0) - 11.0;
            vX = p.x;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = uPx * 7.0 * (10.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `uniform vec3 uA; uniform vec3 uB; varying float vX;
          void main(){ vec2 c = gl_PointCoord - 0.5; if (dot(c,c) > 0.25) discard;
            float edge = smoothstep(-11.0, -9.0, vX) * (1.0 - smoothstep(9.0, 11.0, vX));
            gl_FragColor = vec4(mix(uA, uB, smoothstep(1.0, 4.0, vX)), edge); }`,
      }),
    )
    stream.position.copy(c)
    this.scene.add(stream)
  }

  /** World 4 — LiDAR-like point cloud of a street, with an estimated trajectory drawn as you scroll. */
  private buildPerception(k: number) {
    const c = center(4)
    const r = rng(9)
    const pts: number[] = []
    const cols: number[] = []
    const push = (x: number, y: number, z: number) => {
      pts.push(c.x + x, c.y + y, c.z + z)
      const b = 0.35 + Math.min(1, y / 5) * 0.55
      cols.push(b * 0.92, b * 0.94, b)
    }
    const ground = Math.round(4200 * k)
    for (let i = 0; i < ground; i++) push((r() - 0.5) * 30, (r() - 0.5) * 0.06, (r() - 0.5) * 22)
    const buildings: [number, number, number, number, number][] = [
      [-9, -6, 4, 3.5, 5],
      [-9.5, 3, 3.5, 4, 3.6],
      [8.5, -5, 4.5, 3, 6.5],
      [9, 4, 3.5, 4.5, 4.2],
      [-2.5, -8.5, 6, 2.5, 3],
      [3, 8.5, 5, 2.5, 3.8],
    ]
    for (const [bx, bz, w, d, h] of buildings) {
      const per = Math.round(420 * k)
      for (let i = 0; i < per; i++) {
        const face = Math.floor(r() * 4)
        const u = r() - 0.5
        const y = r() * h
        if (face === 0) push(bx + u * w, y, bz - d / 2)
        else if (face === 1) push(bx + u * w, y, bz + d / 2)
        else if (face === 2) push(bx - w / 2, y, bz + u * d)
        else push(bx + w / 2, y, bz + u * d)
      }
    }
    for (let t = 0; t < 7; t++) {
      const tx = (r() - 0.5) * 24
      const tz = r() < 0.5 ? -3.8 : 3.8
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2
        const y = 1.5 + r() * 1.6
        const rad = 0.9 * (1 - (y - 1.5) / 1.8)
        push(tx + Math.cos(a) * rad, y, tz + Math.sin(a) * rad)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    this.scene.add(
      new THREE.Points(g, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false })),
    )

    const curve = new THREE.CatmullRomCurve3(
      [
        [-14, 0.1, 1.2],
        [-8, 0.1, 0.4],
        [-3, 0.1, -1.2],
        [2, 0.1, -0.6],
        [6, 0.1, 1.2],
        [13, 0.1, 0.2],
      ].map(([x, y, z]) => new THREE.Vector3(c.x + x!, c.y + y!, c.z + z!)),
    )
    // Tube: drawRange is advanced in whole tubular segments (radial × 6 indices each).
    const count = 240
    const line = new THREE.Mesh(
      new THREE.TubeGeometry(curve, count, 0.07, 6, false),
      new THREE.MeshBasicMaterial({ color: SIGNAL_BRIGHT, transparent: true, opacity: 0.95 }),
    )
    line.geometry.setDrawRange(0, 0)
    this.scene.add(line)
    const vehicle = new THREE.Group()
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 16), new THREE.MeshBasicMaterial({ color: SIGNAL_BRIGHT }))
    cone.rotation.z = -Math.PI / 2
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: SIGNAL, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    halo.scale.setScalar(2)
    vehicle.add(cone, halo)
    this.scene.add(vehicle)
    const scan = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1, 64),
      new THREE.MeshBasicMaterial({ color: SIGNAL_BRIGHT, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    )
    scan.rotation.x = -Math.PI / 2
    this.scene.add(scan)
    this.trajectory = { line, curve, vehicle, scan, count }
  }

  /** World 5 — dot globe; satellites' ranges converge on a single position fix. */
  private buildFix(k: number) {
    const c = center(5)
    const globe = new THREE.Group()
    globe.position.copy(c)
    const unit = fibonacciSphere(Math.round(2800 * k) + 400)
    const pos = new Float32Array(unit.length)
    for (let i = 0; i < unit.length; i++) pos[i] = unit[i]! * 6
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    globe.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8d95a3, size: 0.07, transparent: true, opacity: 0.8 })))
    // Fix location: roughly central India (≈20°N, 78°E) on the globe's surface.
    const lat = (20 * Math.PI) / 180
    const lon = (78 * Math.PI) / 180
    const marker = new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(6.05)
    const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: LIME, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    pulse.position.copy(marker)
    pulse.scale.setScalar(1)
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), new THREE.MeshBasicMaterial({ color: LIME }))
    dot.position.copy(marker)
    globe.add(pulse, dot)
    // Orient the globe so the fix faces the camera.
    globe.rotation.y = -lon
    globe.rotation.x = lat * 0.6
    this.scene.add(globe)

    const satPts: number[] = []
    const markerWorld = marker.clone().applyEuler(globe.rotation).add(c)
    const dirs: [number, number, number][] = [
      [-7, 7, 4],
      [7, 6, 3],
      [-3, 9, -2],
      [5, 2.5, 7],
    ]
    const satGroup = new THREE.Group()
    for (const [x, y, z] of dirs) {
      const s = new THREE.Vector3(c.x + x, c.y + y, c.z + z)
      satPts.push(s.x, s.y, s.z, markerWorld.x, markerWorld.y, markerWorld.z)
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: SIGNAL_BRIGHT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
      spr.scale.setScalar(0.9)
      spr.position.copy(s)
      satGroup.add(spr)
    }
    this.scene.add(satGroup)
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.Float32BufferAttribute(satPts, 3))
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: SIGNAL_BRIGHT, transparent: true, opacity: 0 }))
    this.scene.add(lines)
    this.fix = { globe, lines, pulse }
  }

  /** Ring portals at each transition, centred on the camera's flight line. */
  private buildPortals() {
    const ringGeo = new THREE.TorusGeometry(3.4, 0.035, 8, 160)
    for (let i = 0; i < JOURNEY_STAGES - 1; i++) {
      const a = this.station(i, this.tmpA).clone()
      const b = this.station(i + 1, this.tmpB).clone()
      const zMid = center(i).z - SPACING / 2
      const f = (a.z - zMid) / (a.z - b.z)
      const p = a.clone().lerp(b, f)
      const color = new THREE.Color().lerpColors(SIGNAL_BRIGHT, i % 2 ? AMBER : LIME, 0.35)
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }))
      ring.position.copy(p)
      ring.lookAt(b)
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(3.45, 4.6, 96),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
      )
      halo.position.copy(p)
      halo.lookAt(b)
      this.scene.add(ring, halo)
      this.portals.push(ring)
    }
  }

  private station(i: number, out: THREE.Vector3) {
    const s = STATIONS[i]!
    return out.set(...s.pos).add(center(i))
  }

  private lookTarget(i: number, out: THREE.Vector3) {
    const s = STATIONS[i]!
    return out.set(...s.look).add(center(i))
  }

  // ─────────────────────────────────────────────────────────── API
  setProgress(p: number) {
    this.progress = p
    if (!this.raf && this.visible) this.loop()
  }

  setPointer(nx: number, ny: number) {
    this.pointer.set(nx, ny)
  }

  setVisible(v: boolean) {
    this.visible = v
    if (v && !this.raf && !this.disposed) {
      this.lastTime = performance.now()
      this.loop()
    }
  }

  resize() {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.fov = w / h < 1 ? 58 : 42
    // Wide screens: shift every world right so the captions on the left never cover the subject.
    if (w / h > 1.2) this.camera.setViewOffset(w, h, -w * 0.16, 0, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
    if (!this.raf) this.renderFrame(0)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.glow.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  // ─────────────────────────────────────────────────────────── frame loop
  private onContextLost = (e: Event) => {
    e.preventDefault()
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.opts.onContextLost?.()
  }

  private loop = () => {
    if (this.disposed || !this.visible || document.hidden) {
      this.raf = 0
      return
    }
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    this.renderFrame(dt)
  }

  private renderFrame(dt: number) {
    this.elapsed += dt
    const t = this.elapsed
    for (const u of this.timeUniforms) u.value = t
    this.progressSmoothed += (this.progress - this.progressSmoothed) * (dt ? 1 - Math.exp(-dt * 7) : 1)
    this.pointerSmoothed.lerp(this.pointer, dt ? 1 - Math.exp(-dt * 3) : 1)
    const j = journeyAt(this.progressSmoothed)

    // Camera: dwell at a station (with a slow drift), then fly to the next through the portal.
    const i = j.index
    const next = Math.min(i + 1, JOURNEY_STAGES - 1)
    const pos = this.station(i, this.tmpA).lerp(this.station(next, new THREE.Vector3()), j.travel)
    const look = this.lookTarget(i, this.tmpB).lerp(this.lookTarget(next, new THREE.Vector3()), j.travel)
    const drift = (1 - j.travel) * (j.local - 0.3) * 1.6
    pos.x += drift + this.pointerSmoothed.x * 0.8
    pos.y += -this.pointerSmoothed.y * 0.5
    this.camera.position.copy(pos)
    this.camera.lookAt(look)

    // Background and fog blend between worlds.
    const bg = this.scene.background as THREE.Color
    bg.lerpColors(BG[i]!, BG[next]!, j.travel)
    ;(this.scene.fog as THREE.FogExp2).color.copy(bg)

    // World 0: satellite slowly rolls.
    this.satellite.rotation.y = t * 0.15
    this.satellite.rotation.z = Math.sin(t * 0.4) * 0.05

    // World 2: pattern adapts (conventional → MVDR) while dwelling at the array.
    const adapt = i === 2 ? smoothstep(0.08, 0.5, j.local) : i > 2 ? 1 : 0
    if (Math.abs(adapt - this.arrayPattern.last) > 0.002) {
      const ap = this.arrayPattern
      const pa = ap.attr.array as Float32Array
      const ga = ap.gain.array as Float32Array
      for (let n = 0; n < pa.length; n++) pa[n] = ap.from[n]! + (ap.to[n]! - ap.from[n]!) * adapt
      for (let n = 0; n < ga.length; n++) ga[n] = ap.gFrom[n]! + (ap.gTo[n]! - ap.gFrom[n]!) * adapt
      ap.attr.needsUpdate = true
      ap.gain.needsUpdate = true
      ap.last = adapt
    }

    // World 4: trajectory is drawn as you scroll; the vehicle rides its head.
    const drive = i === 4 ? smoothstep(0.02, 0.62, j.local) : i > 4 ? 1 : 0
    const tr = this.trajectory
    tr.line.geometry.setDrawRange(0, Math.round(drive * tr.count) * 6 * 6)
    const head = tr.curve.getPoint(Math.min(0.999, Math.max(0.001, drive)))
    const ahead = tr.curve.getPoint(Math.min(1, Math.max(0.002, drive) + 0.01))
    tr.vehicle.position.copy(head).setY(head.y + 0.25)
    tr.vehicle.rotation.y = Math.atan2(-(ahead.z - head.z), ahead.x - head.x)
    const sweep = (t * 0.8) % 1
    tr.scan.position.copy(head).setY(0.05)
    tr.scan.scale.setScalar(0.5 + sweep * 6)
    ;(tr.scan.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - sweep)

    // World 5: ranging lines from the satellites appear; the fix pulses.
    // (The globe stays still so the lines stay anchored to the fix.)
    ;(this.fix.lines.material as THREE.LineBasicMaterial).opacity = i === 5 ? 0.55 * smoothstep(0.05, 0.45, j.local) : 0
    const pulse = (t * 0.9) % 1
    this.fix.pulse.scale.setScalar(0.6 + pulse * 2.4)
    ;(this.fix.pulse.material as THREE.SpriteMaterial).opacity = 1 - pulse

    for (const ring of this.portals) ring.rotation.z = t * 0.1

    this.renderer.render(this.scene, this.camera)
    if (!this.firstFrame) {
      this.firstFrame = true
      this.opts.onFirstFrame?.()
    }
  }
}
