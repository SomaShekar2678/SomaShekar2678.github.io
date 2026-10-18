import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { exactCovariance, linToDb, mvdrWeights, patternSky, steering, unitVector, type Geometry } from '../lib/beamforming'
import { caCode, circularCorrelation } from '../lib/gnss'

/**
 * Offline cover renders for the featured case studies (run with `npm run covers`, never shipped as code).
 * Each composition is built from its project's mathematics — none depicts measured data:
 *   j-dome                       7-element CRPA-style array, MVDR pattern with two nulls (computed)
 *   gnss-receiver-research       the real GPS C/A code for PRN 1 and its circular autocorrelation
 *   engine-prognostics           a family of Weibull survival curves and one 80% band (illustrative parameters)
 *   visual-localization          procedural terrain, a camera frustum and rays to matched features
 *   perception-state-estimation  a LiDAR-like corridor, an estimated trajectory and growing covariance ellipsoids
 */

export interface CoverDef {
  /** Two-stop background, painted behind the render. */
  bg: [string, string]
  /** Film grain strength (0–1). */
  grain: number
  camera: { pos: [number, number, number]; target: [number, number, number]; fov: number }
  exposure?: number
  shadowOpacity?: number
  build: (scene: THREE.Scene, ctx: { shadows: boolean }) => void
}

const toWorld = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y)
const dir = (az: number, el: number, r: number) => {
  const [x, y, z] = unitVector(az, el)
  return toWorld(x * r, y * r, z * r)
}

function patternMesh(g: Geometry, sat: { az: number; el: number }, jams: { az: number; el: number }[], radius: number, material: THREE.Material, nAz = 160, nEl = 44) {
  const R = exactCovariance(g, [{ ...sat, powerDb: -20 }, ...jams.map((j) => ({ ...j, powerDb: 40 }))])
  const w = mvdrWeights(R, steering(g, sat.az, sat.el))
  const sky = new Float32Array(nAz * nEl)
  const max = patternSky(w, g, { nAz, nEl }, sky)
  const cols = nAz + 1
  const pos = new Float32Array(cols * nEl * 3)
  const gain = new Float32Array(cols * nEl)
  for (let j = 0; j < nEl; j++) {
    const el = (j * 90) / (nEl - 1)
    for (let c = 0; c < cols; c++) {
      const i = c % nAz
      const db = linToDb(sky[j * nAz + i]! / max)
      const t = Math.min(1, Math.max(0, (db + 30) / 30))
      const r = radius * (0.05 + 0.95 * Math.pow(t, 1.3))
      dir((i * 360) / nAz, el, r).toArray(pos, (j * cols + c) * 3)
      gain[j * cols + c] = t
    }
  }
  const idx: number[] = []
  for (let j = 0; j < nEl - 1; j++) for (let i = 0; i < nAz; i++) {
    const a = j * cols + i
    idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('gain', new THREE.BufferAttribute(gain, 1))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

/** Deterministic value noise + fbm for the terrain. */
function noise2(seed: number) {
  const hash = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const vn = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = smooth(x - xi)
    const yf = smooth(y - yi)
    const a = hash(xi, yi)
    const b = hash(xi + 1, yi)
    const c = hash(xi, yi + 1)
    const d = hash(xi + 1, yi + 1)
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
  }
  return (x: number, y: number) => {
    let v = 0
    let amp = 0.5
    let f = 1
    for (let o = 0; o < 5; o++) {
      v += amp * vn(x * f, y * f)
      amp *= 0.5
      f *= 2.03
    }
    return v
  }
}

const ceramic = (color: string, rough = 0.42) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 })
const copper = () => new THREE.MeshStandardMaterial({ color: '#c47a45', roughness: 0.26, metalness: 1 })

export const covers: Record<string, CoverDef> = {
  'j-dome': {
    bg: ['#3a52e6', '#161a52'],
    grain: 0.05,
    camera: { pos: [5.3, 3.6, 6.1], target: [-0.2, 1.05, 0], fov: 30 },
    shadowOpacity: 0.32,
    build(scene, { shadows }) {
      // CRPA-style 7-element array: one centre element and a hexagonal ring at λ/2.
      const n = 7
      const g: Geometry = { n, x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n) }
      for (let k = 1; k < n; k++) {
        const a = ((k - 1) / 6) * Math.PI * 2
        g.x[k] = 0.5 * Math.cos(a)
        g.y[k] = 0.5 * Math.sin(a)
      }
      const S = 1.5 // wavelengths → world
      const puck = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.22, 96), new THREE.MeshPhysicalMaterial({ color: '#141846', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.18 }))
      puck.position.y = 0.11
      puck.castShadow = puck.receiveShadow = shadows
      scene.add(puck)
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.035, 16, 128), copper())
      rim.rotation.x = Math.PI / 2
      rim.position.y = 0.2
      scene.add(rim)
      for (let k = 0; k < n; k++) {
        const p = toWorld(g.x[k]! * S, g.y[k]! * S, 0)
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 48), copper())
        disc.position.set(p.x, 0.25, p.z)
        disc.castShadow = shadows
        scene.add(disc)
      }
      const mat = new THREE.MeshPhysicalMaterial({ color: '#f1ede4', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide })
      const jams = [
        { az: 190, el: 12 },
        { az: 85, el: 18 },
      ]
      const lobe = patternMesh(g, { az: 40, el: 66 }, jams, 2.7, mat)
      lobe.position.y = 0.27
      lobe.castShadow = shadows
      scene.add(lobe)
      for (const j of jams) {
        const p = dir(j.az, j.el, 4.2)
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), copper())
        cone.position.copy(p)
        cone.lookAt(0, 0.4, 0)
        cone.rotateX(Math.PI / 2)
        cone.castShadow = shadows
        scene.add(cone)
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, new THREE.Vector3(0, 0.35, 0)]), new THREE.LineDashedMaterial({ color: '#f0b46e', dashSize: 0.12, gapSize: 0.09 }))
        line.computeLineDistances()
        scene.add(line)
      }
    },
  },

  'gnss-receiver-research': {
    bg: ['#efe9dc', '#d8cfbb'],
    grain: 0.06,
    camera: { pos: [0, 5.6, 7.4], target: [0, 0.35, 0], fov: 32 },
    shadowOpacity: 0.2,
    build(scene, { shadows }) {
      const code = caCode(1)
      const corr = circularCorrelation(code, code)
      const N = code.length
      // Outer ring: the 1023 chips of PRN 1, height by chip value.
      const R = 2.55
      const chipGeo = new THREE.BoxGeometry(1, 1, 1)
      const one = new THREE.InstancedMesh(chipGeo, new THREE.MeshPhysicalMaterial({ color: '#2f45d6', roughness: 0.35, clearcoat: 0.8 }), N)
      const zero = new THREE.InstancedMesh(chipGeo, ceramic('#15161a', 0.5), N)
      const m4 = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const width = ((2 * Math.PI * R) / N) * 0.82
      let a1 = 0
      let a0 = 0
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2
        const h = code[i] ? 0.62 : 0.16
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a)
        m4.compose(new THREE.Vector3(Math.cos(a) * R, h / 2, Math.sin(a) * R), q, new THREE.Vector3(0.22, h, width))
        if (code[i]) one.setMatrixAt(a1++, m4)
        else zero.setMatrixAt(a0++, m4)
      }
      one.count = a1
      zero.count = a0
      one.castShadow = zero.castShadow = shadows
      scene.add(one, zero)
      // Inner floor: the circular autocorrelation, one bar per lag. The single peak (1023) is the copper needle.
      const Ri = 1.55
      const bars = new THREE.InstancedMesh(chipGeo, ceramic('#9a958a', 0.6), N)
      let b = 0
      for (let lag = 1; lag < N; lag++) {
        const a = (lag / N) * Math.PI * 2
        const v = corr[lag]! / N // −65/1023 … 63/1023
        const h = 0.02 + Math.abs(v) * 2.2
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a)
        m4.compose(new THREE.Vector3(Math.cos(a) * Ri, h / 2, Math.sin(a) * Ri), q, new THREE.Vector3(0.12, h, ((2 * Math.PI * Ri) / N) * 0.7))
        bars.setMatrixAt(b++, m4)
      }
      bars.count = b
      scene.add(bars)
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 24), copper())
      needle.position.set(Ri, 1.2, 0)
      needle.castShadow = shadows
      scene.add(needle)
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 16), copper())
      cap.position.set(Ri, 2.42, 0)
      scene.add(cap)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.04, 128), ceramic('#e6dfcf', 0.7))
      base.position.y = -0.02
      base.receiveShadow = shadows
      scene.add(base)
    },
  },

  'engine-prognostics': {
    bg: ['#d58a4f', '#8f3b1e'],
    grain: 0.06,
    camera: { pos: [-6.2, 3.6, 7.2], target: [0.4, 0.8, 0], fov: 30 },
    shadowOpacity: 0.3,
    build(scene, { shadows }) {
      // Survival curves S(t) = exp(−(t/η)^β) for a fleet, each standing as a thin sheet in depth.
      const curves = [
        { beta: 2.2, eta: 0.55 },
        { beta: 3.1, eta: 0.62 },
        { beta: 2.6, eta: 0.7 },
        { beta: 3.8, eta: 0.76 },
        { beta: 2.9, eta: 0.84 },
        { beta: 4.4, eta: 0.9 },
      ]
      const L = 5.2
      const H = 2.2
      const sheet = (beta: number, eta: number, z: number, mat: THREE.Material, thick = 0.05) => {
        const shape = new THREE.Shape()
        shape.moveTo(0, 0)
        const steps = 120
        for (let i = 0; i <= steps; i++) {
          const t = i / steps
          shape.lineTo(t * L, H * Math.exp(-Math.pow(t / eta, beta)))
        }
        shape.lineTo(L, 0)
        shape.lineTo(0, 0)
        const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 1 })
        const m = new THREE.Mesh(geo, mat)
        m.position.set(-L / 2, 0, z)
        m.castShadow = m.receiveShadow = shadows
        return m
      }
      curves.forEach((c, i) => scene.add(sheet(c.beta, c.eta, -1.8 + i * 0.62, ceramic('#f3ece0', 0.5))))
      // One unit highlighted in ink, with its 80% interval as a translucent cobalt band.
      scene.add(sheet(3.2, 0.66, 1.95, ceramic('#15161a', 0.35), 0.06))
      const band = new THREE.Shape()
      const lo = (t: number) => H * Math.exp(-Math.pow(t / 0.58, 3.2))
      const hi = (t: number) => H * Math.exp(-Math.pow(t / 0.75, 3.2))
      band.moveTo(0, hi(0))
      for (let i = 0; i <= 120; i++) band.lineTo((i / 120) * L, hi(i / 120))
      for (let i = 120; i >= 0; i--) band.lineTo((i / 120) * L, lo(i / 120))
      const bandMesh = new THREE.Mesh(new THREE.ShapeGeometry(band), new THREE.MeshPhysicalMaterial({ color: '#2f45d6', transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide }))
      bandMesh.position.set(-L / 2, 0, 2.08)
      scene.add(bandMesh)
      // Time axis rule along the floor.
      const axis = new THREE.Mesh(new RoundedBoxGeometry(L + 0.6, 0.04, 0.04, 2, 0.01), new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.5 }))
      axis.position.set(0.3, 0.02, 2.45)
      scene.add(axis)
    },
  },

  'visual-localization': {
    bg: ['#d7e0d2', '#8fa596'],
    grain: 0.06,
    camera: { pos: [5.8, 5.4, 6.4], target: [0, 0.4, 0], fov: 32 },
    exposure: 0.62,
    shadowOpacity: 0.28,
    build(scene, { shadows }) {
      const n = noise2(7)
      const seg = 240
      const size = 7
      const geo = new THREE.PlaneGeometry(size, size, seg, seg)
      geo.rotateX(-Math.PI / 2)
      const pos = geo.getAttribute('position') as THREE.BufferAttribute
      const colors = new Float32Array(pos.count * 3)
      const low = new THREE.Color('#7f9783')
      const high = new THREE.Color('#e4ddca')
      const line = new THREE.Color('#2c4336')
      const c = new THREE.Color()
      const heightAt = (x: number, z: number) => {
        const d = Math.hypot(x, z) / (size / 2)
        return (n(x * 0.38 + 3, z * 0.38 + 1) - 0.38) * 3.4 * Math.max(0, 1 - Math.pow(Math.min(1, d), 4))
      }
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const z = pos.getZ(i)
        const h = heightAt(x, z)
        pos.setY(i, h)
        // Contour bands every 0.12 units: printed-map look.
        const f = (((h + 2) / 0.14) % 1 + 1) % 1
        c.copy(low).lerp(high, Math.min(1, Math.max(0, (h + 0.4) / 1.4)))
        if (f < 0.09) c.lerp(line, 0.7)
        c.toArray(colors, i * 3)
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geo.computeVertexNormals()
      const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }))
      terrain.castShadow = terrain.receiveShadow = shadows
      scene.add(terrain)
      // Camera body and frustum above the terrain.
      const cam = new THREE.Vector3(-0.6, 2.7, 0.4)
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.24, 0.32, 3, 0.05), ceramic('#15161a', 0.35))
      body.position.copy(cam)
      body.castShadow = shadows
      scene.add(body)
      const corners = [
        [-1.3, -1.0],
        [1.5, -1.0],
        [1.5, 1.6],
        [-1.3, 1.6],
      ].map(([x, z]) => new THREE.Vector3(cam.x + x!, heightAt(cam.x + x!, cam.z + z!) + 0.02, cam.z + z!))
      const fr: THREE.Vector3[] = []
      corners.forEach((p, i) => fr.push(cam, p, p, corners[(i + 1) % 4]!))
      scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fr), new THREE.LineBasicMaterial({ color: '#15161a', transparent: true, opacity: 0.55 })))
      // Matched features: rays and markers.
      const rnd = (() => {
        let s = 11
        return () => ((s = (s * 16807) % 2147483647) / 2147483647)
      })()
      const rays: THREE.Vector3[] = []
      const dotGeo = new THREE.SphereGeometry(0.045, 16, 8)
      const dotMat = new THREE.MeshStandardMaterial({ color: '#2f45d6', roughness: 0.4 })
      for (let i = 0; i < 26; i++) {
        const x = cam.x - 1.1 + rnd() * 2.4
        const z = cam.z - 0.8 + rnd() * 2.2
        const p = new THREE.Vector3(x, heightAt(x, z) + 0.03, z)
        rays.push(cam, p)
        const d = new THREE.Mesh(dotGeo, dotMat)
        d.position.copy(p)
        scene.add(d)
      }
      scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rays), new THREE.LineBasicMaterial({ color: '#2f45d6', transparent: true, opacity: 0.6 })))
      // Flight path: dashed, floating above the ground.
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.2, 2.2, 2.6), new THREE.Vector3(-1.8, 2.5, 1.2), cam.clone(), new THREE.Vector3(1.2, 2.8, -0.9), new THREE.Vector3(2.9, 2.6, -2.6)])
      const pl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(120)), new THREE.LineDashedMaterial({ color: '#15161a', dashSize: 0.1, gapSize: 0.08 }))
      pl.computeLineDistances()
      scene.add(pl)
    },
  },

  'perception-state-estimation': {
    bg: ['#2b2e36', '#0f1014'],
    grain: 0.07,
    camera: { pos: [3.6, 7.4, 6.6], target: [0.1, 0.2, -0.5], fov: 38 },
    exposure: 1.15,
    shadowOpacity: 0.0,
    build(scene) {
      // A LiDAR-like scan of a bending corridor: floor + two walls, sampled with range-dependent density.
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-4, 0, 3),
        new THREE.Vector3(-1.6, 0, 1.6),
        new THREE.Vector3(0.2, 0, 1.2),
        new THREE.Vector3(1.6, 0, -0.4),
        new THREE.Vector3(2.2, 0, -2.6),
        new THREE.Vector3(3.6, 0, -4.2),
      ])
      const pts: number[] = []
      const col: number[] = []
      const c = new THREE.Color()
      let s = 3
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      const W = 1.1
      for (let i = 0; i < 42000; i++) {
        const u = rnd()
        const p = path.getPointAt(u)
        const tng = path.getTangentAt(u)
        const nrm = new THREE.Vector3(-tng.z, 0, tng.x)
        const kind = rnd()
        let q: THREE.Vector3
        if (kind < 0.42) {
          q = p.clone().addScaledVector(nrm, (rnd() * 2 - 1) * W)
          q.y = (rnd() - 0.5) * 0.02
        } else {
          const side = kind < 0.71 ? 1 : -1
          q = p.clone().addScaledVector(nrm, side * (W + (rnd() - 0.5) * 0.04))
          // Walls with door openings: gaps where the scanner sees through.
          if (Math.sin(u * 38 + side * 1.7) > 0.86) continue
          q.y = rnd() * 1.6
        }
        pts.push(q.x, q.y, q.z)
        c.set('#8b919e').lerp(new THREE.Color('#f1ede4'), Math.min(1, q.y / 1.4))
        col.push(c.r, c.g, c.b)
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.028, vertexColors: true, sizeAttenuation: true })))
      // Estimated trajectory (cobalt tube) and 1-σ covariance ellipsoids that grow, then collapse at a fix.
      const traj = new THREE.CatmullRomCurve3(path.getPoints(40).map((p, i) => new THREE.Vector3(p.x, 0.35 + Math.sin(i * 0.4) * 0.02, p.z)))
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(traj, 300, 0.035, 12), new THREE.MeshStandardMaterial({ color: '#6f86ff', emissive: '#2f45d6', emissiveIntensity: 0.8, roughness: 0.3 })))
      const ell = new THREE.MeshPhysicalMaterial({ color: '#c5e48a', transparent: true, opacity: 0.32, roughness: 0.15, clearcoat: 1, depthWrite: false })
      const ring = new THREE.MeshBasicMaterial({ color: '#c5e48a' })
      for (let k = 0; k <= 9; k++) {
        const u = 0.05 + k * 0.1
        const p = traj.getPointAt(u)
        const growth = k < 6 ? 0.06 + k * 0.045 : 0.07
        const e = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), ell)
        e.position.copy(p)
        e.scale.set(growth * 1.6, growth * 0.7, growth)
        e.lookAt(p.clone().add(traj.getTangentAt(u)))
        scene.add(e)
        const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 48), ring)
        r.position.copy(p)
        r.scale.set(growth * 1.6, growth, growth)
        r.rotation.x = Math.PI / 2
        scene.add(r)
      }
    },
  },
}

/** Renders one cover into a 2D canvas: background gradient, the 3D render, grain. */
export function renderCover(def: CoverDef, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = def.exposure ?? 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  const key = new THREE.DirectionalLight(0xfff1e0, 2.4)
  key.position.set(-5, 10, 6)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 })
  key.shadow.bias = -0.0004
  scene.add(key, new THREE.HemisphereLight(0xfff8ec, 0x9a8f80, 0.55))
  if ((def.shadowOpacity ?? 0) > 0) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ color: 0x1a1208, opacity: def.shadowOpacity }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.001
    ground.receiveShadow = true
    scene.add(ground)
  }
  def.build(scene, { shadows: true })
  const cam = new THREE.PerspectiveCamera(def.camera.fov, width / height, 0.1, 100)
  cam.position.set(...def.camera.pos)
  cam.lookAt(...def.camera.target)
  renderer.render(scene, cam)

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, width * 0.35, height)
  grad.addColorStop(0, def.bg[0])
  grad.addColorStop(1, def.bg[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(canvas, 0, 0)
  // Grain: subtle luminance noise so flat gradients do not band in WebP.
  const img = ctx.getImageData(0, 0, width, height)
  let s = 9
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647
    const n = ((s / 2147483647) * 2 - 1) * 255 * def.grain * 0.35
    img.data[i] = img.data[i]! + n
    img.data[i + 1] = img.data[i + 1]! + n
    img.data[i + 2] = img.data[i + 2]! + n
  }
  ctx.putImageData(img, 0, 0)

  scene.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose()
    const mat = m.material as THREE.Material | undefined
    mat?.dispose?.()
  })
  pmrem.dispose()
  renderer.dispose()
  renderer.forceContextLoss()
  return out
}
