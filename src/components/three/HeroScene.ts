import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import {
  conventionalWeights,
  exactCovariance,
  linToDb,
  mvdrWeights,
  patternSky,
  powerResponse,
  steering,
  unitVector,
  ura,
  type Geometry,
  type SkyGrid,
} from '../../lib/beamforming'
import type { DeviceTier } from '../../lib/env'

/**
 * Hero — a sculptural, physically lit model of the engineering idea behind the portfolio.
 *
 *  - A 4×4 planar patch array: copper patches at their true λ/2 relative positions on a dark substrate.
 *  - Above it, the array's power pattern as a solid "beam sculpture" (radius ∝ gain over 32 dB).
 *    It opens as the conventional delay-and-sum pattern, then re-forms into the MVDR pattern once the
 *    interferer appears: the null toward the interferer is the point of the piece.
 *  - A satellite (the desired signal) and an interferer on the horizon whose azimuth follows the pointer.
 *  - Ink "drafting" lines (horizon ring, elevation arcs, azimuth ticks) and soft shadows on paper.
 *
 * Rendering is on demand: the loop runs only while the intro, the pointer or the scroll is still settling.
 * Plain Three.js — no React reconciler in the render loop.
 */

export interface HeroStats {
  satGainDb: number
  jamDb: number
  jamAz: number
}

export interface HeroSceneOptions {
  canvas: HTMLCanvasElement
  tier: DeviceTier
  reduced: boolean
  /** Touch devices get a single automatic interferer sweep instead of pointer control. */
  autoSweep?: boolean
  labels?: { sat?: HTMLElement | null; jam?: HTMLElement | null }
  onFirstFrame?: () => void
  onStats?: (s: HeroStats) => void
  onContextLost?: () => void
}

const INK = new THREE.Color('#15161a')
const COBALT = new THREE.Color('#2f45d6')
const COBALT_DEEP = new THREE.Color('#141a5c')
const MINERAL = new THREE.Color('#c9d2ff')
const COPPER = new THREE.Color('#b86a3c')

const SKY_R = 4.6
const PATTERN_R = 2.45
const DYN_RANGE_DB = 32
const SAT = { az: 35, el: 58 }
const JAM_EL = 9
/** Back-left of the default camera, so the interferer and its null face the headline. */
const JAM_AZ0 = 285
/** Plate scale: element spacing λ/2 → world units. */
const PITCH = 0.5

/** Maths frame (z up) → three.js frame (y up). */
function toWorld(x: number, y: number, z: number, out = new THREE.Vector3()) {
  return out.set(x, z, -y)
}
function dirWorld(az: number, el: number, r: number, out = new THREE.Vector3()) {
  const [x, y, z] = unitVector(az, el)
  return toWorld(x * r, y * r, z * r, out)
}
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)
const easeInOut = (t: number) => {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

export class HeroScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  private opts: HeroSceneOptions
  private raf = 0
  private visible = true
  private disposed = false
  private firstFrame = false
  private lastTime = performance.now()
  /** Seconds since the intro started. */
  private t = 0
  private pmrem: THREE.PMREMGenerator
  private envTex: THREE.Texture

  private geom: Geometry = ura(4, 4, 0.5)
  private grid: SkyGrid
  private sky: Float32Array
  private rConv: Float32Array
  private rMvdr: Float32Array
  private dirs: Float32Array
  private patternGeo!: THREE.BufferGeometry
  private patternLines!: THREE.LineSegments
  private patternMesh!: THREE.Mesh
  private patches: THREE.Object3D[] = []
  private patchBase: number[] = []
  private board!: THREE.Group
  private satellite!: THREE.Group
  private satLine!: THREE.Line
  private jammer!: THREE.Group
  private jamLine!: THREE.Line
  private jamRing!: THREE.Mesh

  private jamAz = JAM_AZ0
  private jamAzTarget = JAM_AZ0
  private lastPatternAz = Number.NaN
  private pointer = new THREE.Vector2()
  private pointerSmoothed = new THREE.Vector2()
  private scroll = 0
  private scrollSmoothed = 0
  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()

  /** Intro timeline (seconds). */
  private static readonly T_BOARD = 1.1
  private static readonly T_BEAM = 2.3
  private static readonly T_ADAPT = 3.7
  private static readonly T_END = 4.4

  constructor(opts: HeroSceneOptions) {
    this.opts = opts
    const { canvas, tier } = opts
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', alpha: true, powerPreference: 'high-performance' })
    const maxDpr = tier === 'high' ? 2 : tier === 'mid' ? 1.5 : 1
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    if (tier !== 'low') {
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFShadowMap
    }

    // Image-based lighting from a procedural studio (no HDR download).
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environment = this.envTex

    this.grid = tier === 'low' ? { nAz: 72, nEl: 22 } : { nAz: 120, nEl: 34 }
    const cells = this.grid.nAz * this.grid.nEl
    this.sky = new Float32Array(cells)
    this.rConv = new Float32Array(cells)
    this.rMvdr = new Float32Array(cells)
    this.dirs = new Float32Array((this.grid.nAz + 1) * this.grid.nEl * 3)

    canvas.addEventListener('webglcontextlost', this.handleContextLost, false)

    this.build(tier)
    this.computeConventional()
    this.computeMvdr(true)
    if (opts.reduced) this.t = HeroScene.T_END
    this.resize()
    this.renderFrame(0)
    this.kick()
  }

  // ───────────────────────────────────────────────────────── construction
  private build(tier: DeviceTier) {
    const shadows = tier !== 'low'

    // Lights: the environment gives reflections; a warm key casts the shadow onto the paper.
    const key = new THREE.DirectionalLight(0xfff1e0, 2.2)
    key.position.set(-5, 10, 6)
    if (shadows) {
      key.castShadow = true
      key.shadow.mapSize.set(tier === 'high' ? 2048 : 1024, tier === 'high' ? 2048 : 1024)
      key.shadow.camera.left = -6
      key.shadow.camera.right = 6
      key.shadow.camera.top = 6
      key.shadow.camera.bottom = -6
      key.shadow.camera.near = 1
      key.shadow.camera.far = 30
      key.shadow.radius = 6
      key.shadow.bias = -0.0004
    }
    this.scene.add(key)
    this.scene.add(new THREE.HemisphereLight(0xfff8ec, 0xd9cfbd, 0.6))

    // Paper ground that only shows shadows.
    {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x3a2a12, opacity: 0.16 }))
      ground.rotation.x = -Math.PI / 2
      ground.receiveShadow = true
      this.scene.add(ground)
    }

    // Drafting: horizon ring with azimuth ticks, elevation arcs at 30° and 60°, two meridians.
    {
      const pts: number[] = []
      const ring = (el: number, r: number, seg = 160) => {
        for (let i = 0; i < seg; i++) {
          const a = dirWorld((i / seg) * 360, el, r)
          const b = dirWorld(((i + 1) / seg) * 360, el, r)
          pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
      }
      ring(0, SKY_R)
      ring(0, SKY_R * 0.62)
      for (let az = 0; az < 360; az += 5) {
        const len = az % 30 === 0 ? 0.32 : 0.13
        const a = dirWorld(az, 0, SKY_R)
        const b = dirWorld(az, 0, SKY_R + len)
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      this.scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.22 })))

      const arcs: number[] = []
      for (const el of [30, 60]) {
        for (let i = 0; i < 160; i++) {
          const a = dirWorld((i / 160) * 360, el, SKY_R)
          const b = dirWorld(((i + 1) / 160) * 360, el, SKY_R)
          arcs.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
      }
      for (const az of [SAT.az, SAT.az + 180]) {
        for (let el = 0; el < 90; el += 2) {
          const a = dirWorld(az, el, SKY_R)
          const b = dirWorld(az, el + 2, SKY_R)
          arcs.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
      }
      const ag = new THREE.BufferGeometry()
      ag.setAttribute('position', new THREE.Float32BufferAttribute(arcs, 3))
      const dashed = new THREE.LineSegments(ag, new THREE.LineDashedMaterial({ color: INK, dashSize: 0.05, gapSize: 0.07, transparent: true, opacity: 0.2 }))
      dashed.computeLineDistances()
      this.scene.add(dashed)
    }

    // The array board.
    {
      this.board = new THREE.Group()
      const span = PITCH * 3
      const side = span + PITCH * 1.25
      const substrate = new THREE.Mesh(
        new RoundedBoxGeometry(side, 0.12, side, 4, 0.05),
        new THREE.MeshPhysicalMaterial({ color: 0x1b2063, roughness: 0.38, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.2 }),
      )
      substrate.position.y = 0.06
      substrate.castShadow = shadows
      substrate.receiveShadow = shadows
      this.board.add(substrate)

      // Copper ground-plane edge and a thin ivory frame: gives the plate a manufactured edge.
      const rim = new THREE.Mesh(
        new RoundedBoxGeometry(side + 0.08, 0.04, side + 0.08, 4, 0.03),
        new THREE.MeshStandardMaterial({ color: COPPER, roughness: 0.32, metalness: 1 }),
      )
      rim.position.y = 0.012
      rim.castShadow = shadows
      this.board.add(rim)

      const patchGeo = new RoundedBoxGeometry(PITCH * 0.56, 0.035, PITCH * 0.56, 2, 0.012)
      const patchMat = new THREE.MeshStandardMaterial({ color: 0xd08a52, roughness: 0.24, metalness: 1 })
      const pinGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12)
      const pinMat = new THREE.MeshStandardMaterial({ color: 0xe8d9b8, roughness: 0.3, metalness: 0.9 })
      for (let k = 0; k < this.geom.n; k++) {
        const p = toWorld(this.geom.x[k]! * PITCH * 2, this.geom.y[k]! * PITCH * 2, 0, this.tmp)
        const patch = new THREE.Group()
        const m = new THREE.Mesh(patchGeo, patchMat)
        m.castShadow = shadows
        const pin = new THREE.Mesh(pinGeo, pinMat)
        pin.position.set(PITCH * 0.12, 0.03, 0)
        patch.add(m, pin)
        patch.position.set(p.x, 0.14, p.z)
        this.patchBase.push(Math.hypot(p.x, p.z))
        this.patches.push(patch)
        this.board.add(patch)
      }
      this.scene.add(this.board)
    }

    // Beam sculpture: shared positions, solid shaded surface + ink contour lines.
    {
      const { nAz, nEl } = this.grid
      const cols = nAz + 1
      const count = cols * nEl
      const pos = new Float32Array(count * 3)
      const col = new Float32Array(count * 3)
      const idx: number[] = []
      for (let j = 0; j < nEl - 1; j++) {
        for (let i = 0; i < nAz; i++) {
          const a = j * cols + i
          idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1)
        }
      }
      for (let j = 0; j < nEl; j++) {
        const el = (j * 90) / (nEl - 1)
        for (let c = 0; c < cols; c++) {
          dirWorld(((c % nAz) * 360) / nAz, el, 1, this.tmp).toArray(this.dirs, (j * cols + c) * 3)
        }
      }
      this.patternGeo = new THREE.BufferGeometry()
      this.patternGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
      this.patternGeo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage))
      this.patternGeo.setIndex(idx)
      this.patternMesh = new THREE.Mesh(
        this.patternGeo,
        new THREE.MeshPhysicalMaterial({
          vertexColors: true,
          roughness: 0.3,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.94,
        }),
      )
      this.patternMesh.position.y = 0.16
      this.patternMesh.castShadow = shadows
      this.scene.add(this.patternMesh)

      // Contour lines every few elevation rows and a few meridians: the "drawing" over the sculpture.
      const lines: number[] = []
      for (let j = 3; j < nEl; j += 4) for (let i = 0; i < nAz; i++) lines.push(j * cols + i, j * cols + i + 1)
      const step = Math.round(nAz / 24)
      for (let i = 0; i < nAz; i += step) for (let j = 0; j < nEl - 1; j++) lines.push(j * cols + i, (j + 1) * cols + i)
      const lg = new THREE.BufferGeometry()
      lg.setAttribute('position', this.patternGeo.getAttribute('position'))
      lg.setIndex(lines)
      this.patternLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 }))
      this.patternLines.position.y = 0.16
      this.scene.add(this.patternLines)
    }

    // Satellite: body in gold foil, two solar wings, a thin cobalt line of sight to the array.
    {
      this.satellite = new THREE.Group()
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.22, 0.3, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 1 }))
      const wingMat = new THREE.MeshPhysicalMaterial({ color: 0x1a2a7c, roughness: 0.25, metalness: 0.5, clearcoat: 1 })
      const wingGeo = new THREE.BoxGeometry(0.62, 0.012, 0.22)
      const w1 = new THREE.Mesh(wingGeo, wingMat)
      const w2 = new THREE.Mesh(wingGeo, wingMat)
      w1.position.x = 0.46
      w2.position.x = -0.46
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.92, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.3 }))
      strut.rotation.z = Math.PI / 2
      this.satellite.add(body, w1, w2, strut)
      dirWorld(SAT.az, SAT.el, SKY_R, this.satellite.position)
      this.satellite.lookAt(0, 0, 0)
      this.scene.add(this.satellite)

      const los = new THREE.BufferGeometry().setFromPoints([this.satellite.position.clone(), new THREE.Vector3(0, 0.2, 0)])
      this.satLine = new THREE.Line(los, new THREE.LineBasicMaterial({ color: COBALT, transparent: true, opacity: 0.85 }))
      this.scene.add(this.satLine)
    }

    // Interferer: a copper emitter on the horizon, a dashed line toward the array, a ring on the paper.
    {
      this.jammer = new THREE.Group()
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: COPPER, roughness: 0.25, metalness: 1 }))
      body.castShadow = shadows
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 }))
      mast.position.y = -0.45
      this.jammer.add(body, mast)
      this.scene.add(this.jammer)
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0.2, 0)])
      this.jamLine = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: COPPER, dashSize: 0.1, gapSize: 0.08, transparent: true, opacity: 0.9 }))
      this.scene.add(this.jamLine)
      this.jamRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.36, 64), new THREE.MeshBasicMaterial({ color: COPPER, transparent: true, opacity: 0.6 }))
      this.jamRing.rotation.x = -Math.PI / 2
      this.scene.add(this.jamRing)
    }
  }

  // ───────────────────────────────────────────────────────── maths → geometry
  private radiusFromSky(max: number, out: Float32Array) {
    for (let k = 0; k < out.length; k++) {
      const db = linToDb(this.sky[k]! / max)
      const t = Math.min(1, Math.max(0, (db + DYN_RANGE_DB) / DYN_RANGE_DB))
      out[k] = 0.05 + 0.95 * Math.pow(t, 1.35)
    }
  }

  private computeConventional() {
    const w = conventionalWeights(steering(this.geom, SAT.az, SAT.el))
    const max = patternSky(w, this.geom, this.grid, this.sky)
    this.radiusFromSky(max, this.rConv)
  }

  private computeMvdr(force = false) {
    if (!force && Math.abs(this.jamAz - this.lastPatternAz) < 0.35) return
    this.lastPatternAz = this.jamAz
    const g = this.geom
    const R = exactCovariance(g, [
      { az: SAT.az, el: SAT.el, powerDb: -20 },
      { az: this.jamAz, el: JAM_EL, powerDb: 40 },
    ])
    const w = mvdrWeights(R, steering(g, SAT.az, SAT.el))
    const max = patternSky(w, g, this.grid, this.sky)
    this.radiusFromSky(max, this.rMvdr)
    if (this.opts.onStats) {
      const sat = linToDb(powerResponse(w, g, SAT.az, SAT.el) / max)
      const jam = linToDb(powerResponse(w, g, this.jamAz, JAM_EL) / max)
      this.opts.onStats({ satGainDb: sat, jamDb: jam, jamAz: ((this.jamAz % 360) + 360) % 360 })
    }
  }

  /** Writes the sculpture: grow ∈ [0,1] scales it in, adapt ∈ [0,1] morphs conventional → MVDR. */
  private writePattern(grow: number, adapt: number) {
    const { nAz, nEl } = this.grid
    const cols = nAz + 1
    const pos = this.patternGeo.getAttribute('position') as THREE.BufferAttribute
    const colr = this.patternGeo.getAttribute('color') as THREE.BufferAttribute
    const p = pos.array as Float32Array
    const c = colr.array as Float32Array
    const tmpC = new THREE.Color()
    for (let j = 0; j < nEl; j++) {
      // The sculpture grows from the array upward: lower elevations appear first.
      const rowGrow = ease(grow * 1.4 - (j / nEl) * 0.4)
      for (let col = 0; col < cols; col++) {
        const k = j * nAz + (col % nAz)
        const r0 = this.rConv[k]!
        const r = (r0 + (this.rMvdr[k]! - r0) * adapt) * rowGrow
        const v = (j * cols + col) * 3
        const rr = r * PATTERN_R
        p[v] = this.dirs[v]! * rr
        p[v + 1] = this.dirs[v + 1]! * rr
        p[v + 2] = this.dirs[v + 2]! * rr
        const g = Math.min(1, r)
        tmpC.copy(COBALT_DEEP).lerp(COBALT, Math.min(1, g * 1.5))
        if (g > 0.78) tmpC.lerp(MINERAL, (g - 0.78) / 0.22)
        c[v] = tmpC.r
        c[v + 1] = tmpC.g
        c[v + 2] = tmpC.b
      }
    }
    pos.needsUpdate = true
    colr.needsUpdate = true
    this.patternGeo.computeVertexNormals()
    this.patternGeo.computeBoundingSphere()
  }

  // ───────────────────────────────────────────────────────── public API
  setPointer(nx: number, ny: number) {
    this.pointer.set(nx, ny)
    this.jamAzTarget = JAM_AZ0 + nx * 55
    if (this.opts.reduced) {
      this.jamAz = this.jamAzTarget
      this.pointerSmoothed.copy(this.pointer)
    }
    this.kick()
  }

  setScroll(p: number) {
    this.scroll = p
    if (this.opts.reduced) this.scrollSmoothed = p
    this.kick()
  }

  /** Pauses/resumes. Safe to call repeatedly (e.g. on tab visibility changes). */
  setVisible(v: boolean) {
    this.visible = v
    if (v) this.kick()
  }

  resize() {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    const a = w / h
    this.camera.fov = a < 0.6 ? 55 : a < 0.8 ? 50 : a < 1.2 ? 36 : 28
    // Wide layouts: the sculpture sits right of centre, beside the statement and above the name.
    if (a > 1.25) this.camera.setViewOffset(w, h, -w * 0.2, h * 0.02, w, h)
    // Portrait: phones lift the sculpture clear of the statement; tablets have room to centre it.
    else if (a < 0.6) this.camera.setViewOffset(w, h, 0, h * 0.09, w, h)
    else if (a < 0.9) this.camera.setViewOffset(w, h, 0, h * 0.03, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
    this.kick()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost)
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    })
    this.envTex.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  // ───────────────────────────────────────────────────────── frame loop
  private handleContextLost = (e: Event) => {
    e.preventDefault()
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.opts.onContextLost?.()
  }

  /** Starts the loop if it is not running. It stops itself once everything has settled. */
  private kick() {
    if (this.raf || this.disposed || !this.visible) return
    this.lastTime = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  private settled() {
    return (
      this.t >= HeroScene.T_END &&
      Math.abs(this.jamAz - this.jamAzTarget) < 0.05 &&
      this.pointerSmoothed.distanceToSquared(this.pointer) < 1e-6 &&
      Math.abs(this.scroll - this.scrollSmoothed) < 1e-4
    )
  }

  private loop = () => {
    this.raf = 0
    if (this.disposed || !this.visible || document.hidden) return
    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    this.renderFrame(dt)
    if (!this.settled()) this.raf = requestAnimationFrame(this.loop)
  }

  private renderFrame(dt: number) {
    const reduced = this.opts.reduced
    if (!reduced) {
      this.t = Math.min(HeroScene.T_END, this.t + dt)
      const k = 1 - Math.exp(-dt * 5)
      this.pointerSmoothed.lerp(this.pointer, k)
      this.scrollSmoothed += (this.scroll - this.scrollSmoothed) * (1 - Math.exp(-dt * 7))
      // Touch: one slow sweep of the interferer during the adapt phase, then rest.
      if (this.opts.autoSweep && this.t > HeroScene.T_ADAPT - 0.6) {
        const s = Math.min(1, (this.t - (HeroScene.T_ADAPT - 0.6)) / (HeroScene.T_END - HeroScene.T_ADAPT + 0.6))
        this.jamAzTarget = JAM_AZ0 + 30 * Math.sin(s * Math.PI)
      }
      this.jamAz += (this.jamAzTarget - this.jamAz) * (1 - Math.exp(-dt * 4))
      if (Math.abs(this.jamAz - this.jamAzTarget) < 0.05) this.jamAz = this.jamAzTarget
    }
    const t = this.t
    this.computeMvdr()

    // Intro: board → beam grows (conventional) → interferer arrives and the pattern adapts.
    const board = ease(t / HeroScene.T_BOARD)
    this.board.scale.setScalar(0.9 + 0.1 * board)
    this.board.position.y = -0.3 * (1 - board)
    this.patches.forEach((p, i) => {
      const d = this.patchBase[i]! / (PITCH * 2.2)
      const local = ease((t - 0.25 - d * 0.35) / 0.7)
      p.position.y = 0.14 + (1 - local) * 0.35
      p.scale.setScalar(Math.max(0.001, local))
    })
    const grow = ease((t - 0.8) / (HeroScene.T_BEAM - 0.8))
    const adapt = easeInOut((t - HeroScene.T_BEAM - 0.2) / (HeroScene.T_ADAPT - HeroScene.T_BEAM))
    this.writePattern(grow, adapt)
    this.patternMesh.visible = this.patternLines.visible = grow > 0.001

    const satIn = ease((t - 0.9) / 1.0)
    this.satellite.scale.setScalar(Math.max(0.001, satIn))
    ;(this.satLine.material as THREE.LineBasicMaterial).opacity = 0.85 * satIn

    const jamIn = ease((t - HeroScene.T_BEAM) / 0.7)
    const jp = dirWorld(this.jamAz, JAM_EL, SKY_R * 0.92, this.tmp)
    this.jammer.position.copy(jp)
    this.jammer.scale.setScalar(Math.max(0.001, jamIn))
    this.jammer.rotation.y = this.jamAz * 0.05
    this.jamRing.position.set(jp.x, 0.005, jp.z)
    this.jamRing.scale.setScalar(Math.max(0.001, jamIn))
    const lp = this.jamLine.geometry.attributes.position as THREE.BufferAttribute
    lp.setXYZ(0, jp.x, jp.y, jp.z)
    lp.needsUpdate = true
    this.jamLine.computeLineDistances()
    this.jamLine.visible = jamIn > 0.05

    // Camera: three-quarter view; as the hero scrolls away it rises and pushes toward the beam.
    const s = this.scrollSmoothed
    const elev = THREE.MathUtils.degToRad(17 + s * 40 + this.pointerSmoothed.y * 2.5)
    const azim = THREE.MathUtils.degToRad(-62 + this.pointerSmoothed.x * 6)
    const radius = 15.5 - s * 5.5
    this.camera.position.set(radius * Math.cos(elev) * Math.cos(azim), radius * Math.sin(elev) + 0.4, radius * Math.cos(elev) * Math.sin(azim))
    this.camera.lookAt(0, 1.35 - s * 0.9, 0)

    this.renderer.render(this.scene, this.camera)
    this.placeLabels(jamIn, satIn)

    if (!this.firstFrame) {
      this.firstFrame = true
      this.opts.onFirstFrame?.()
    }
  }

  private placeLabels(jamIn: number, satIn: number) {
    const labels = this.opts.labels
    if (!labels) return
    const canvas = this.renderer.domElement
    const place = (el: HTMLElement | null | undefined, world: THREE.Vector3, alpha: number) => {
      if (!el) return
      const v = this.tmp2.copy(world).project(this.camera)
      const x = (v.x * 0.5 + 0.5) * canvas.clientWidth
      const y = (-v.y * 0.5 + 0.5) * canvas.clientHeight
      const off = v.z > 1 || x < 0 || y < 0 || x > canvas.clientWidth || y > canvas.clientHeight
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      el.style.opacity = off ? '0' : String(alpha)
    }
    place(labels.sat, this.satellite.position, satIn)
    place(labels.jam, this.jammer.position, jamIn)
  }
}
