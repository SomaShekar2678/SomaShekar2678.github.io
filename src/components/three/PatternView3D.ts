import * as THREE from 'three'
import { unitVector, type SkyGrid } from '../../lib/beamforming'
import { navToMath } from '../../lib/labModel'

/**
 * 3D view of the lab's array pattern: radius ∝ normalised gain in dB over a 40 dB range.
 * Renders on demand only (after data changes or while dragging) — there is no idle loop.
 */
export interface PatternMarker {
  kind: 'sat' | 'jam'
  navAz: number
  el: number
}

const RANGE_DB = 40

function world(navAz: number, el: number, r: number, out = new THREE.Vector3()) {
  const [x, y, z] = unitVector(navToMath(navAz), el)
  return out.set(x * r, z * r, -y * r)
}

export class PatternView3D {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
  private grid: SkyGrid
  private positions: THREE.BufferAttribute
  private gains: THREE.BufferAttribute
  private markers = new THREE.Group()
  private theta = -0.9
  private phi = 0.55
  private raf = 0
  private dragging: { x: number; y: number } | null = null
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement, grid: SkyGrid) {
    this.canvas = canvas
    this.grid = grid
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x000000, 0)

    const cols = grid.nAz + 1
    const count = cols * grid.nEl
    this.positions = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    this.gains = new THREE.BufferAttribute(new Float32Array(count), 1)
    const tri: number[] = []
    const lines: number[] = []
    for (let j = 0; j < grid.nEl - 1; j++) {
      for (let i = 0; i < grid.nAz; i++) {
        const a = j * cols + i
        tri.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1)
      }
    }
    for (let j = 0; j < grid.nEl; j += 3) for (let i = 0; i < grid.nAz; i++) lines.push(j * cols + i, j * cols + i + 1)
    for (let i = 0; i < grid.nAz; i += 6) for (let j = 0; j < grid.nEl - 1; j++) lines.push(j * cols + i, (j + 1) * cols + i)

    const mat = (alpha: number) =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uAlpha: { value: alpha } },
        vertexShader: `attribute float aGain; varying float vG; void main(){ vG = aGain; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uAlpha; varying float vG;
          void main(){
            vec3 lo = vec3(0.07,0.11,0.31); vec3 mid = vec3(0.36,0.49,1.0); vec3 hi = vec3(0.96,0.97,1.0);
            vec3 c = mix(lo, mid, smoothstep(0.0,0.7,vG)); c = mix(c, hi, smoothstep(0.8,1.0,vG));
            gl_FragColor = vec4(c, uAlpha * (0.35 + 0.65*vG)); }`,
      })
    const surf = new THREE.BufferGeometry()
    surf.setAttribute('position', this.positions)
    surf.setAttribute('aGain', this.gains)
    surf.setIndex(tri)
    this.scene.add(new THREE.Mesh(surf, mat(0.35)))
    const wire = new THREE.BufferGeometry()
    wire.setAttribute('position', this.positions)
    wire.setAttribute('aGain', this.gains)
    wire.setIndex(lines)
    this.scene.add(new THREE.LineSegments(wire, mat(0.8)))

    // Ground reference rings.
    const ring: number[] = []
    for (const r of [0.5, 1]) {
      for (let k = 0; k < 96; k++) {
        const a0 = (k / 96) * Math.PI * 2
        const a1 = ((k + 1) / 96) * Math.PI * 2
        ring.push(Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r)
      }
    }
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3))
    this.scene.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xeeebe4, transparent: true, opacity: 0.15 })))
    this.scene.add(this.markers)

    canvas.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('keydown', this.onKey)
    this.resize()
  }

  update(gainDb: Float32Array, markers: PatternMarker[]) {
    const { nAz, nEl } = this.grid
    const cols = nAz + 1
    const pos = this.positions.array as Float32Array
    const g = this.gains.array as Float32Array
    const v = new THREE.Vector3()
    for (let j = 0; j < nEl; j++) {
      const el = (j * 90) / (nEl - 1)
      for (let c = 0; c < cols; c++) {
        const i = c % nAz
        const t = Math.min(1, Math.max(0, (gainDb[j * nAz + i]! + RANGE_DB) / RANGE_DB))
        const mathAz = (i * 360) / nAz
        const [x, y, z] = unitVector(mathAz, el)
        const r = 0.03 + 0.97 * t
        v.set(x * r, z * r, -y * r)
        const k = j * cols + c
        pos[k * 3] = v.x
        pos[k * 3 + 1] = v.y
        pos[k * 3 + 2] = v.z
        g[k] = t
      }
    }
    this.positions.needsUpdate = true
    this.gains.needsUpdate = true

    this.markers.children.forEach((m) => {
      const o = m as THREE.Mesh
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    })
    this.markers.clear()
    for (const m of markers) {
      const color = m.kind === 'sat' ? 0x94a8ff : 0xffb23f
      const tip = world(m.navAz, m.el, 1.12)
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), tip])
      this.markers.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })))
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), new THREE.MeshBasicMaterial({ color }))
      dot.position.copy(tip)
      this.markers.add(dot)
    }
    this.requestRender()
  }

  resize() {
    const w = this.canvas.clientWidth || 1
    const h = this.canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.requestRender()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('keydown', this.onKey)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | undefined
      mat?.dispose()
    })
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  private requestRender() {
    if (this.raf) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      const r = 3.1
      this.camera.position.set(r * Math.cos(this.phi) * Math.cos(this.theta), r * Math.sin(this.phi) + 0.2, r * Math.cos(this.phi) * Math.sin(this.theta))
      this.camera.lookAt(0, 0.3, 0)
      this.renderer.render(this.scene, this.camera)
    })
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = { x: e.clientX, y: e.clientY }
  }
  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return
    this.theta += (e.clientX - this.dragging.x) * 0.008
    this.phi = Math.min(1.45, Math.max(0.05, this.phi + (e.clientY - this.dragging.y) * 0.006))
    this.dragging = { x: e.clientX, y: e.clientY }
    this.requestRender()
  }
  private onUp = () => {
    this.dragging = null
  }
  private onKey = (e: KeyboardEvent) => {
    const step = 0.12
    if (e.key === 'ArrowLeft') this.theta -= step
    else if (e.key === 'ArrowRight') this.theta += step
    else if (e.key === 'ArrowUp') this.phi = Math.min(1.45, this.phi + step)
    else if (e.key === 'ArrowDown') this.phi = Math.max(0.05, this.phi - step)
    else return
    e.preventDefault()
    this.requestRender()
  }
}
