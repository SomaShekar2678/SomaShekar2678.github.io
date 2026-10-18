import * as THREE from 'three'
import {
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
 * Hero scene — an illustrative, mathematically computed composition:
 *  - a 4×4 λ/2 planar array on the ground plane;
 *  - its MVDR power pattern over the sky, recomputed whenever the interferer moves;
 *  - satellites on a sky dome (the steered one in signal blue, with a line of sight);
 *  - an interferer on the horizon (amber), whose azimuth follows the pointer;
 *  - a ground "wave field" showing a plane wave from the satellite interfering with a spherical
 *    wave from the interferer.
 * Plain Three.js (no React reconciler in the render loop).
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
  labels?: { sat?: HTMLElement | null; jam?: HTMLElement | null }
  onFirstFrame?: () => void
  onStats?: (s: HeroStats) => void
  onContextLost?: () => void
}

const SIGNAL = new THREE.Color('#5b7cff')
const SIGNAL_BRIGHT = new THREE.Color('#b9c6ff')
const AMBER = new THREE.Color('#ffb23f')
const BG = new THREE.Color('#07080a')

const SKY_R = 5.2
const PATTERN_R = 3.1
const DYN_RANGE_DB = 40
const SAT = { az: 35, el: 58 }
const OTHER_SATS = [
  { az: 120, el: 40 },
  { az: 165, el: 72 },
  { az: 250, el: 33 },
  { az: 300, el: 64 },
  { az: 330, el: 22 },
  { az: 75, el: 18 },
  { az: 205, el: 50 },
]
const JAM_EL = 9

/** Maths frame (z up) → three.js frame (y up). */
function toWorld(x: number, y: number, z: number, out = new THREE.Vector3()) {
  return out.set(x, z, -y)
}

function dirWorld(az: number, el: number, r: number, out = new THREE.Vector3()) {
  const [x, y, z] = unitVector(az, el)
  return toWorld(x * r, y * r, z * r, out)
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export class HeroScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
  private lastTime = performance.now()
  private elapsed = 0
  private opts: HeroSceneOptions
  private raf = 0
  private visible = true
  private disposed = false
  private firstFrame = false

  private geom: Geometry = ura(4, 4, 0.5)
  private grid: SkyGrid
  private pattern: Float32Array
  private patternPositions!: THREE.BufferAttribute
  private patternGain!: THREE.BufferAttribute

  private jamAz = 215
  private jamAzTarget = 215
  private lastPatternAz = Number.NaN
  private pointer = new THREE.Vector2()
  private pointerSmoothed = new THREE.Vector2()
  private scroll = 0
  private scrollSmoothed = 0

  private jammer!: THREE.Group
  private jamLine!: THREE.Line
  private fieldMat!: THREE.ShaderMaterial
  private rippleMat!: THREE.ShaderMaterial
  private patternMats: THREE.ShaderMaterial[] = []
  private tmp = new THREE.Vector3()

  constructor(opts: HeroSceneOptions) {
    this.opts = opts
    const { canvas, tier } = opts
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: tier !== 'low',
      alpha: false,
      powerPreference: 'high-performance',
    })
    const maxDpr = tier === 'high' ? 1.75 : tier === 'mid' ? 1.5 : 1
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr))
    this.renderer.setClearColor(BG, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.fog = new THREE.FogExp2(BG.getHex(), 0.045)

    this.grid = tier === 'low' ? { nAz: 64, nEl: 20 } : { nAz: 112, nEl: 30 }
    this.pattern = new Float32Array(this.grid.nAz * this.grid.nEl)

    canvas.addEventListener('webglcontextlost', this.handleContextLost, false)

    this.build(tier)
    this.updatePattern(true)
    this.resize()
    this.renderFrame(0)
    if (!opts.reduced) this.loop()
  }

  // ───────────────────────────────────────────────────────── construction
  private build(tier: DeviceTier) {
    const glow = glowTexture()

    // Ground polar grid (azimuth spokes + range rings): an instrument-like reference plane.
    {
      const pts: number[] = []
      for (let r = 1; r <= 5; r++) {
        const seg = 128
        for (let i = 0; i < seg; i++) {
          const a0 = (i / seg) * Math.PI * 2
          const a1 = ((i + 1) / seg) * Math.PI * 2
          pts.push(Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r)
        }
      }
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2
        pts.push(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9, Math.cos(a) * 5.6, 0, Math.sin(a) * 5.6)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      const m = new THREE.LineBasicMaterial({ color: 0xeeebe4, transparent: true, opacity: 0.055, depthWrite: false })
      this.scene.add(new THREE.LineSegments(g, m))
    }

    // Sky dome: elevation rings at 0/30/60° and meridians every 30°.
    {
      const pts: number[] = []
      for (const el of [0, 30, 60]) {
        for (let i = 0; i < 128; i++) {
          const a = dirWorld((i / 128) * 360, el, SKY_R)
          const b = dirWorld(((i + 1) / 128) * 360, el, SKY_R)
          pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
      }
      for (let az = 0; az < 360; az += 30) {
        for (let el = 0; el < 90; el += 3) {
          const a = dirWorld(az, el, SKY_R)
          const b = dirWorld(az, el + 3, SKY_R)
          pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      const m = new THREE.LineBasicMaterial({ color: 0x94a8ff, transparent: true, opacity: 0.06, depthWrite: false })
      this.scene.add(new THREE.LineSegments(g, m))
    }

    // Antenna array: 16 elements at their true relative positions (scaled), on a thin ground plate.
    {
      const scale = 0.62
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(2 * scale * 1.5 + 0.35, 0.03, 2 * scale * 1.5 + 0.35),
        new THREE.MeshBasicMaterial({ color: 0x151922 }),
      )
      plate.position.y = 0.015
      this.scene.add(plate)
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(plate.geometry),
        new THREE.LineBasicMaterial({ color: 0xeeebe4, transparent: true, opacity: 0.25 }),
      )
      edges.position.copy(plate.position)
      this.scene.add(edges)
      const elementGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.14, 16)
      const elementMat = new THREE.MeshBasicMaterial({ color: 0xeeebe4 })
      const inst = new THREE.InstancedMesh(elementGeo, elementMat, this.geom.n)
      const m4 = new THREE.Matrix4()
      for (let k = 0; k < this.geom.n; k++) {
        const p = toWorld(this.geom.x[k]! * scale * 2, this.geom.y[k]! * scale * 2, 0.1, this.tmp)
        m4.makeTranslation(p.x, p.y, p.z)
        inst.setMatrixAt(k, m4)
      }
      this.scene.add(inst)
    }

    // MVDR pattern surface over the sky.
    {
      const { nAz, nEl } = this.grid
      const cols = nAz + 1 // duplicate seam column so azimuth wraps cleanly
      const count = cols * nEl
      const positions = new Float32Array(count * 3)
      const gains = new Float32Array(count)
      const idx: number[] = []
      const lines: number[] = []
      for (let j = 0; j < nEl - 1; j++) {
        for (let i = 0; i < nAz; i++) {
          const a = j * cols + i
          const b = a + 1
          const c = a + cols
          const d = c + 1
          idx.push(a, c, b, b, c, d)
        }
      }
      for (let j = 0; j < nEl; j += 2) for (let i = 0; i < nAz; i++) lines.push(j * cols + i, j * cols + i + 1)
      const step = Math.max(1, Math.round(nAz / 36))
      for (let i = 0; i < nAz; i += step) for (let j = 0; j < nEl - 1; j++) lines.push(j * cols + i, (j + 1) * cols + i)

      this.patternPositions = new THREE.BufferAttribute(positions, 3)
      this.patternPositions.setUsage(THREE.DynamicDrawUsage)
      this.patternGain = new THREE.BufferAttribute(gains, 1)
      this.patternGain.setUsage(THREE.DynamicDrawUsage)

      const make = (alpha: number) =>
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          uniforms: { uAlpha: { value: alpha }, uLow: { value: new THREE.Color('#132056') }, uHigh: { value: SIGNAL }, uPeak: { value: SIGNAL_BRIGHT } },
          vertexShader: /* glsl */ `
            attribute float aGain;
            varying float vGain;
            void main() {
              vGain = aGain;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
          fragmentShader: /* glsl */ `
            uniform float uAlpha; uniform vec3 uLow; uniform vec3 uHigh; uniform vec3 uPeak;
            varying float vGain;
            void main() {
              vec3 c = mix(uLow, uHigh, smoothstep(0.0, 0.75, vGain));
              c = mix(c, uPeak, smoothstep(0.82, 1.0, vGain));
              gl_FragColor = vec4(c, uAlpha * (0.25 + 0.75 * vGain));
            }`,
        })

      const surfGeo = new THREE.BufferGeometry()
      surfGeo.setAttribute('position', this.patternPositions)
      surfGeo.setAttribute('aGain', this.patternGain)
      surfGeo.setIndex(idx)
      const surfMat = make(tier === 'low' ? 0.16 : 0.12)
      this.scene.add(new THREE.Mesh(surfGeo, surfMat))

      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute('position', this.patternPositions)
      lineGeo.setAttribute('aGain', this.patternGain)
      lineGeo.setIndex(lines)
      const lineMat = make(0.55)
      this.scene.add(new THREE.LineSegments(lineGeo, lineMat))
      this.patternMats.push(surfMat, lineMat)
    }

    // Satellites.
    {
      const others = new Float32Array(OTHER_SATS.length * 3)
      OTHER_SATS.forEach((s, k) => dirWorld(s.az, s.el, SKY_R).toArray(others, k * 3))
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(others, 3))
      this.scene.add(
        new THREE.Points(
          g,
          new THREE.PointsMaterial({ size: 0.22, map: glow, transparent: true, depthWrite: false, color: 0xeeebe4, opacity: 0.55, blending: THREE.AdditiveBlending }),
        ),
      )
      const satPos = dirWorld(SAT.az, SAT.el, SKY_R)
      const sg = new THREE.BufferGeometry().setFromPoints([satPos])
      this.scene.add(
        new THREE.Points(
          sg,
          new THREE.PointsMaterial({ size: 0.55, map: glow, transparent: true, depthWrite: false, color: SIGNAL_BRIGHT, blending: THREE.AdditiveBlending }),
        ),
      )
      const los = new THREE.BufferGeometry().setFromPoints([satPos, new THREE.Vector3(0, 0.12, 0)])
      los.setAttribute('color', new THREE.Float32BufferAttribute([...SIGNAL_BRIGHT.toArray(), ...SIGNAL.clone().multiplyScalar(0.25).toArray()], 3))
      this.scene.add(new THREE.Line(los, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 })))
    }

    // Interferer on the horizon.
    {
      this.jammer = new THREE.Group()
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: AMBER }))
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: AMBER, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }))
      halo.scale.setScalar(0.9)
      this.jammer.add(body, halo)
      this.scene.add(this.jammer)
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0.12, 0)])
      this.jamLine = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: AMBER, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.55 }))
      this.scene.add(this.jamLine)
    }

    // Interferer ripples on the ground.
    {
      this.rippleMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uJam: { value: new THREE.Vector2() }, uColor: { value: AMBER } },
        vertexShader: /* glsl */ `
          varying vec2 vXZ;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vXZ = w.xz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec2 uJam; uniform vec3 uColor;
          varying vec2 vXZ;
          void main() {
            float d = distance(vXZ, uJam);
            float ring = smoothstep(0.92, 1.0, fract(d / 0.62 - uTime * 0.55));
            float fade = exp(-d * 0.42) * smoothstep(5.8, 3.5, length(vXZ));
            gl_FragColor = vec4(uColor, ring * fade * 0.55);
          }`,
      })
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), this.rippleMat)
      plane.rotation.x = -Math.PI / 2
      plane.position.y = 0.004
      this.scene.add(plane)
    }

    // Wave field: plane wave (satellite) + spherical wave (interferer), sampled on a point grid.
    {
      const n = tier === 'low' ? 80 : tier === 'mid' ? 120 : 160
      const extent = 11
      const pos = new Float32Array(n * n * 3)
      let k = 0
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          pos[k++] = (i / (n - 1) - 0.5) * extent
          pos[k++] = -0.02
          pos[k++] = (j / (n - 1) - 0.5) * extent
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const satDir = dirWorld(SAT.az, SAT.el, 1)
      this.fieldMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSatDir: { value: new THREE.Vector2(satDir.x, satDir.z) },
          uJam: { value: new THREE.Vector2() },
          uPx: { value: this.renderer.getPixelRatio() },
          uSignal: { value: SIGNAL_BRIGHT },
          uAmber: { value: AMBER },
        },
        vertexShader: /* glsl */ `
          uniform float uTime; uniform vec2 uSatDir; uniform vec2 uJam; uniform float uPx;
          varying float vS; varying float vJ; varying float vFade;
          const float K = 6.2831853 / 0.62;
          void main() {
            vec3 p = position;
            float s = 0.55 * cos(K * dot(p.xz, uSatDir) - uTime * 2.2);
            float dj = distance(p.xz, uJam);
            float j = 1.1 / (1.0 + 0.45 * dj) * cos(K * dj - uTime * 2.2);
            p.y += 0.035 * (s + j);
            vS = max(s, 0.0);
            vJ = max(j, 0.0);
            vFade = smoothstep(5.6, 1.2, length(p.xz));
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = uPx * (1.4 + 1.6 * max(s + j, 0.0)) * (8.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSignal; uniform vec3 uAmber;
          varying float vS; varying float vJ; varying float vFade;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            if (dot(c, c) > 0.25) discard;
            float total = vS + vJ + 1e-4;
            vec3 col = mix(uSignal, uAmber, vJ / total);
            gl_FragColor = vec4(col, vFade * (0.06 + 0.32 * min(total, 1.2)));
          }`,
      })
      this.scene.add(new THREE.Points(g, this.fieldMat))
    }
  }

  // ───────────────────────────────────────────────────────── maths → geometry
  private updatePattern(force = false) {
    if (!force && Math.abs(this.jamAz - this.lastPatternAz) < 0.4) return
    this.lastPatternAz = this.jamAz
    const g = this.geom
    const R = exactCovariance(g, [
      { az: SAT.az, el: SAT.el, powerDb: -20 },
      { az: this.jamAz, el: JAM_EL, powerDb: 40 },
    ])
    const w = mvdrWeights(R, steering(g, SAT.az, SAT.el))
    const max = patternSky(w, g, this.grid, this.pattern)
    const { nAz, nEl } = this.grid
    const cols = nAz + 1
    const pos = this.patternPositions.array as Float32Array
    const gain = this.patternGain.array as Float32Array
    for (let j = 0; j < nEl; j++) {
      const el = (j * 90) / (nEl - 1)
      for (let c = 0; c < cols; c++) {
        const i = c % nAz
        const db = linToDb(this.pattern[j * nAz + i]! / max)
        const t = Math.min(1, Math.max(0, (db + DYN_RANGE_DB) / DYN_RANGE_DB))
        const r = PATTERN_R * (0.06 + 0.94 * t * t)
        const v = dirWorld((i * 360) / nAz, el, r, this.tmp)
        const k = j * cols + c
        pos[k * 3] = v.x
        pos[k * 3 + 1] = v.y + 0.12
        pos[k * 3 + 2] = v.z
        gain[k] = t
      }
    }
    this.patternPositions.needsUpdate = true
    this.patternGain.needsUpdate = true

    if (this.opts.onStats) {
      const sat = linToDb(powerResponse(w, g, SAT.az, SAT.el) / max)
      const jam = linToDb(powerResponse(w, g, this.jamAz, JAM_EL) / max)
      this.opts.onStats({ satGainDb: sat, jamDb: jam, jamAz: ((this.jamAz % 360) + 360) % 360 })
    }
  }

  // ───────────────────────────────────────────────────────── public API
  setPointer(nx: number, ny: number) {
    this.pointer.set(nx, ny)
    this.jamAzTarget = 215 - nx * 75
    if (this.opts.reduced) {
      this.jamAz = this.jamAzTarget
      this.pointerSmoothed.copy(this.pointer)
      this.requestRender()
    }
  }

  setScroll(p: number) {
    this.scroll = p
    if (this.opts.reduced) {
      this.scrollSmoothed = p
      this.requestRender()
    }
  }

  /** Pauses/resumes the loop. Safe to call repeatedly (e.g. on tab visibility changes). */
  setVisible(v: boolean) {
    this.visible = v
    if (v && !this.opts.reduced && !this.raf) {
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
    // Keep the whole composition in frame on narrow (portrait) viewports.
    this.camera.fov = w / h < 0.8 ? 52 : w / h < 1.2 ? 42 : 34
    // On wide layouts, shift the composition right so it sits beside the headline rather than behind it.
    // On portrait screens, lower it so the sky labels clear the readout panel.
    if (w / h > 1.25) this.camera.setViewOffset(w, h, -w * 0.15, -h * 0.045, w, h)
    else if (w / h < 0.9) this.camera.setViewOffset(w, h, 0, -h * 0.1, w, h)
    else this.camera.clearViewOffset()
    this.camera.updateProjectionMatrix()
    if (this.opts.reduced) this.requestRender()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost)
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else if (mat) {
        const withMap = mat as THREE.Material & { map?: THREE.Texture | null }
        withMap.map?.dispose()
        mat.dispose()
      }
    })
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

  private pendingRender = 0
  private requestRender() {
    if (this.pendingRender || this.disposed) return
    this.pendingRender = requestAnimationFrame(() => {
      this.pendingRender = 0
      this.renderFrame(0)
    })
  }

  private loop = () => {
    if (this.disposed) return
    if (!this.visible || document.hidden) {
      this.raf = 0
      return
    }
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    this.elapsed += dt
    this.renderFrame(dt)
  }

  private renderFrame(dt: number) {
    const reduced = this.opts.reduced
    const t = reduced ? 1.2 : this.elapsed
    if (!reduced) {
      const k = 1 - Math.exp(-dt * 4)
      this.pointerSmoothed.lerp(this.pointer, k)
      this.scrollSmoothed += (this.scroll - this.scrollSmoothed) * (1 - Math.exp(-dt * 6))
      const drift = Math.sin(t * 0.13) * 8
      this.jamAz += (this.jamAzTarget + drift - this.jamAz) * (1 - Math.exp(-dt * 2.5))
    }
    this.updatePattern()

    // Interferer, its line toward the array, and the shader uniforms.
    const jp = dirWorld(this.jamAz, JAM_EL, 4.7, this.tmp)
    this.jammer.position.copy(jp)
    this.jammer.rotation.y = t * 0.8
    const lp = this.jamLine.geometry.attributes.position as THREE.BufferAttribute
    lp.setXYZ(0, jp.x, jp.y, jp.z)
    lp.needsUpdate = true
    this.jamLine.computeLineDistances()
    this.rippleMat.uniforms.uTime!.value = t
    ;(this.rippleMat.uniforms.uJam!.value as THREE.Vector2).set(jp.x, jp.z)
    this.fieldMat.uniforms.uTime!.value = t
    ;(this.fieldMat.uniforms.uJam!.value as THREE.Vector2).set(jp.x, jp.z)

    // Camera: low and close at the top of the page, rising toward a plan view as the hero scrolls away.
    const s = this.scrollSmoothed
    const elev = THREE.MathUtils.degToRad(13 + s * 34 + this.pointerSmoothed.y * 3)
    const azim = THREE.MathUtils.degToRad(-58 + this.pointerSmoothed.x * 7 + (reduced ? 0 : Math.sin(t * 0.05) * 4))
    const radius = 12.2 - s * 1.6
    this.camera.position.set(
      radius * Math.cos(elev) * Math.cos(azim),
      radius * Math.sin(elev) + 0.6,
      radius * Math.cos(elev) * Math.sin(azim),
    )
    this.camera.lookAt(0, 1.25 - s * 0.6, 0)

    this.renderer.render(this.scene, this.camera)
    this.placeLabels(jp)

    if (!this.firstFrame) {
      this.firstFrame = true
      this.opts.onFirstFrame?.()
    }
  }

  private placeLabels(jamWorld: THREE.Vector3) {
    const labels = this.opts.labels
    if (!labels) return
    const canvas = this.renderer.domElement
    const place = (el: HTMLElement | null | undefined, world: THREE.Vector3) => {
      if (!el) return
      const v = this.tmp.copy(world).project(this.camera)
      const x = (v.x * 0.5 + 0.5) * canvas.clientWidth
      const y = (-v.y * 0.5 + 0.5) * canvas.clientHeight
      const hidden = v.z > 1 || x < 0 || y < 0 || x > canvas.clientWidth || y > canvas.clientHeight
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      el.style.opacity = hidden ? '0' : '1'
    }
    const jamCopy = jamWorld.clone()
    place(labels.sat, dirWorld(SAT.az, SAT.el, SKY_R))
    place(labels.jam, jamCopy)
  }
}
