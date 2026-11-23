import * as THREE from 'three'
import { conventionalWeights, exactCovariance, linToDb, mvdrWeights, patternSky, steering, unitVector, ura, type SkyGrid } from '../../lib/beamforming'
import { JOURNEY_STAGES, journeyAt, smoothstep } from '../../lib/journeyPath'
import type { DeviceTier } from '../../lib/env'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ModelKit, receiveArray, processingBoard, sensorVehicle, satelliteFleet } from './journey/models'
import { EarthAssets, earthModel, SUN } from './journey/earth'
import { orbitalSatellite, orbitalEarth, orbitalBackdrop } from './journey/orbitDetail'
import { streetCloud } from './journey/perception'
import { interferenceWorld } from './journey/interference'

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

/** Maths frame (z up) → three.js frame (y up). */
function skyDir(az: number, el: number, r: number, out = new THREE.Vector3()) {
  const [x, y, z] = unitVector(az, el)
  return out.set(x * r, z * r, -y * r)
}

export class JourneyScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
  private opts: JourneySceneOptions
  private kit = new ModelKit()
  private earthAssets: EarthAssets
  private environment: THREE.WebGLRenderTarget
  private worlds: THREE.Group[] = []
  private starfield!: THREE.Points
  private sun = new THREE.DirectionalLight('#fff5e5', 3.2)
  private fill = new THREE.HemisphereLight('#92aaca', '#111519', .65)
  private adaptiveFrames = 0
  private slowFrames = 0
  private shadowWorld = -1
  private renderedWorld = -1
  private economy = false
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
  private interference!: ReturnType<typeof interferenceWorld>
  private satellite!: THREE.Group
  private orbitalSky!: THREE.Group
  private arrayPattern!: { attr: THREE.BufferAttribute; gain: THREE.BufferAttribute; from: Float32Array; to: Float32Array; gFrom: Float32Array; gTo: Float32Array; last: number; geometry: THREE.BufferGeometry }
  private trajectory!: { line: THREE.Mesh; curve: THREE.CatmullRomCurve3; vehicle: THREE.Object3D; scan: THREE.Mesh; count: number }
  private fix!: { globe: THREE.Group; lines: THREE.LineSegments; pulse: THREE.Sprite }
  private portals: THREE.Mesh[] = []
  private portalHalos: THREE.Mesh[] = []

  constructor(opts: JourneySceneOptions) {
    this.opts = opts
    const { canvas, tier } = opts
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', alpha: false, powerPreference: 'high-performance' })
    const maxDpr = tier === 'high' ? 1.6 : tier === 'mid' ? 1.35 : 1
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    // Shared low-resolution reflection environment: no external HDR or post-processing passes.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.environment = pmrem.fromScene(room, .04, .1, 100, { size: 128 })
    room.dispose(); pmrem.dispose()
    this.scene.environment = this.environment.texture
    this.scene.environmentIntensity = .36
    this.sun.position.copy(SUN).multiplyScalar(60)
    this.renderer.shadowMap.enabled = tier !== 'low'
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.sun.shadow.autoUpdate = false
    this.sun.castShadow = tier !== 'low'
    Object.assign(this.sun.shadow.camera, { left:-18, right:18, top:18, bottom:-18, near:1, far:100 })
    this.sun.shadow.mapSize.set(1024,1024)
    this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.025
    this.scene.add(this.sun, this.sun.target, this.fill)
    this.earthAssets = new EarthAssets(this.renderer.capabilities.getMaxAnisotropy())
    this.earthAssets.ready.then(() => {
      if (!this.disposed) {
        canvas.dataset.assets = 'ready'
        if (!this.raf) this.renderFrame(0)
      }
    }).catch(() => { if (!this.disposed) this.opts.onContextLost?.() })
    this.scene.background = BG[0]!.clone()
    this.scene.fog = new THREE.FogExp2(BG[0]!.getHex(), 0.012)
    canvas.addEventListener('webglcontextlost', this.onContextLost, false)

    const k = tier === 'low' ? 0.5 : tier === 'mid' ? 0.75 : 1
    this.buildStars(Math.round(1200 * k))
    // Isolate worlds at dwell, so later geometry cannot leak into an earlier shot.
    // Both neighbours remain visible during the original camera flight.
    for (const build of [() => this.buildSpace(k), () => this.buildInterference(k), () => this.buildArray(), () => this.buildFpga(k), () => this.buildPerception(k), () => this.buildFix(k)]) {
      const existing = new Set(this.scene.children)
      build()
      const group = new THREE.Group()
      for (const child of [...this.scene.children]) if (!existing.has(child)) group.add(child)
      this.scene.add(group); this.worlds.push(group)
    }
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
    // Distant celestial sphere moves with the camera: stars have no near-field parallax.
    const r = rng(1), pos = new Float32Array(n * 3), colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const y = r() * 2 - 1, phi = r() * Math.PI * 2, horizontal = Math.sqrt(1 - y*y)
      pos.set([horizontal*Math.cos(phi)*180, y*180, horizontal*Math.sin(phi)*180], i*3)
      const brightness = .08 + Math.pow(r(), 7) * .68
      colors.set([brightness*(.85+r()*.15), brightness*.94, brightness],i*3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color',new THREE.BufferAttribute(colors,3))
    this.starfield = new THREE.Points(g,new THREE.PointsMaterial({size:.55,vertexColors:true,map:this.glow,transparent:true,opacity:.7,depthWrite:false,fog:false,toneMapped:false}))
    this.starfield.renderOrder=-10
    this.starfield.frustumCulled=false
    this.scene.add(this.starfield)
  }

  /** World 0 — representative navigation spacecraft, textured Earth and scientific wave overlays. */
  private buildSpace(k: number) {
    const c = center(0)
    this.orbitalSky = orbitalBackdrop(k, this.timeUniform())
    this.scene.add(this.orbitalSky)
    const earth = orbitalEarth(this.earthAssets, k<.6?64:96)
    earth.position.set(c.x - 2, c.y - 11, c.z - 3)
    this.scene.add(earth)
    const sat = orbitalSatellite(this.kit)
    sat.position.set(c.x, c.y+3.5, c.z)
    this.satellite=sat
    this.scene.add(sat)
    // Same five expanding shells, same radius/time law; continuous wavefront caps replace particles.
    const geo = new THREE.SphereGeometry(1,64,28,0,Math.PI*2,Math.PI*.54,Math.PI*.43)
    for(let shell=0;shell<5;shell++){
      const wave=new THREE.Mesh(geo,new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,side:THREE.DoubleSide,
        uniforms:{uTime:this.timeUniform(),uShell:{value:shell}},
        vertexShader:`uniform float uTime,uShell;varying float vA;varying vec3 vN,vV;varying vec2 vUv;
          void main(){float r=mod(uTime*1.4+uShell*3.2,16.);vUv=uv;
            vA=(1.-r/16.)*smoothstep(0.,1.5,r);
            vec4 mv=modelViewMatrix*vec4(position*r,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);
            gl_Position=projectionMatrix*mv;}`,
        fragmentShader:`varying float vA;varying vec3 vN,vV;varying vec2 vUv;
          void main(){float edge=pow(1.-abs(dot(normalize(vN),normalize(vV))),6.);
            float cap=smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.8,1.,vUv.y));
            gl_FragColor=vec4(.4,.62,.85,vA*cap*(.003+.10*edge));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }))
      wave.frustumCulled=false;wave.position.copy(sat.position);this.scene.add(wave)
    }
  }

  /** World 1 — transmitter → fields → spectrum → receiver. */
  private buildInterference(k: number) {
    this.interference = interferenceWorld(this.kit, k)
    this.interference.root.position.copy(center(1))
    this.scene.add(this.interference.root)
  }

  /** World 2 — 4×4 array; pattern morphs from conventional to MVDR as you scroll. */
  private buildArray() {
    const c = center(2)
    const geom = ura(4, 4, 0.5)
    const sat = { az: 35, el: 58 }
    const jam = { az: 200, el: 12 }
    const grid: SkyGrid = { nAz: 144, nEl: 44 }
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
    const indices:number[]=[]
    for(let j=0;j<grid.nEl-1;j++)for(let i=0;i<grid.nAz;i++){
      const a=j*cols+i;indices.push(a,a+1,a+cols,a+1,a+cols+1,a+cols)
    }
    g.setIndex(indices);g.computeVertexNormals()
    const material=new THREE.MeshPhysicalMaterial({color:SIGNAL,metalness:.18,roughness:.38,clearcoat:.25,
      transparent:true,opacity:.62,side:THREE.DoubleSide,depthWrite:false})
    material.onBeforeCompile=(shader)=>{
      shader.vertexShader='attribute float aGain; varying float vGain;\n'+shader.vertexShader
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGain=aGain;')
      shader.fragmentShader='varying float vGain;\n'+shader.fragmentShader
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(vec3(.015,.04,.12),vec3(.055,.20,.48),smoothstep(.1,1.,vGain));')
    }
    const mesh=new THREE.Mesh(g,material)
    mesh.frustumCulled=false;mesh.position.copy(c);this.scene.add(mesh)
    const wireGeo=new THREE.BufferGeometry();wireGeo.setAttribute('position',attr);wireGeo.setIndex(lines)
    const wire=new THREE.LineSegments(wireGeo,new THREE.LineBasicMaterial({color:SIGNAL_BRIGHT,transparent:true,opacity:.12,depthWrite:false}))
    wire.position.copy(c);wire.frustumCulled=false;this.scene.add(wire)
    this.arrayPattern = { attr, gain, from: from.pos, to: to.pos, gFrom: from.gain, gTo: to.gain, last: -1, geometry:g }
    const array=receiveArray(this.kit,geom);array.position.copy(c);this.scene.add(array)

    const satPos = skyDir(sat.az, sat.el, 6.5).add(c)
    const satDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: SIGNAL_BRIGHT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    satDot.scale.setScalar(0.4)
    satDot.position.copy(satPos)
    this.scene.add(satDot)
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([satPos, c.clone().setY(0.15)]), new THREE.LineBasicMaterial({ color: SIGNAL_BRIGHT, transparent: true, opacity: 0.6 })))

    const jamPos = skyDir(jam.az, jam.el, 6.2).add(c)
    const jamBody = new THREE.Mesh(new THREE.CylinderGeometry(.06,.18,.6,18), this.kit.copper)
    jamBody.position.copy(jamPos)
    const jamGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: AMBER, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }))
    jamGlow.scale.setScalar(.6)
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
    const board=processingBoard(this.kit)
    board.position.copy(c);this.scene.add(board)
    const r=rng(5)

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
    const cloud=streetCloud(k);cloud.position.copy(c);this.scene.add(cloud)

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
    const vehicle = sensorVehicle(this.kit)
    this.scene.add(vehicle)
    const scan = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1, 64),
      new THREE.MeshBasicMaterial({ color: SIGNAL_BRIGHT, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    )
    scan.rotation.x = -Math.PI / 2
    this.scene.add(scan)
    this.trajectory = { line, curve, vehicle, scan, count }
  }

  /** World 5 — textured Earth; satellites' ranges converge on a single position fix. */
  private buildFix(k: number) {
    const c = center(5)
    const globe = new THREE.Group()
    globe.position.copy(c)
    globe.add(earthModel(6,this.earthAssets,k<.6?64:96))
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
    const satellitePositions:THREE.Vector3[]=[]
    for (const [x, y, z] of dirs) {
      const s = new THREE.Vector3(c.x + x, c.y + y, c.z + z)
      satPts.push(s.x, s.y, s.z, markerWorld.x, markerWorld.y, markerWorld.z)
      satellitePositions.push(new THREE.Vector3(x,y,z))
    }
    const satGroup=satelliteFleet(this.kit,satellitePositions);satGroup.position.copy(c);this.scene.add(satGroup)
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
      this.portalHalos.push(halo)
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
  /** Offline poster rendering uses exactly the same world, camera and materials as the live scene. */
  async captureStill(progress: number, elapsed = 3) {
    await this.earthAssets.ready
    if (this.disposed) throw new Error('Cannot render a disposed journey')
    this.setVisible(false)
    cancelAnimationFrame(this.raf);this.raf=0
    this.progress=this.progressSmoothed=progress;this.elapsed=elapsed
    this.pointer.set(0,0);this.pointerSmoothed.set(0,0)
    this.renderFrame(0)
    return this.renderer.domElement.toDataURL('image/webp', .86)
  }

  /** QA diagnostics; does not expose visitor data or run a polling loop. */
  getDiagnostics() {
    const { render, memory } = this.renderer.info
    return { calls:render.calls, triangles:render.triangles, points:render.points,
      geometries:memory.geometries, textures:memory.textures, pixelRatio:this.renderer.getPixelRatio() }
  }

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
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>()
    this.scene.traverse((o) => {
      const m=o as THREE.Mesh
      if(m.geometry)geometries.add(m.geometry)
      if(Array.isArray(m.material))m.material.forEach(x=>materials.add(x))
      else if(m.material)materials.add(m.material)
    })
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())
    this.glow.dispose();this.earthAssets.dispose();this.kit.dispose();this.environment.dispose();this.sun.shadow.dispose()
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
    this.starfield.position.copy(this.camera.position)
    this.starfield.visible=i!==0&&(i===5||j.travel>0)
    this.orbitalSky.position.copy(this.camera.position).multiplyScalar(.995)
    this.worlds.forEach((world,index)=>{world.visible=index===i||(j.travel>0&&index===next)})
    this.sun.target.position.copy(look)
    this.sun.position.copy(look).addScaledVector(SUN,60)
    this.sun.color.set(i===0 ? '#ffe5c2' : '#fff5e5')
    const inSpace=i===0||i===5
    this.fill.intensity=inSpace?.32:.75
    this.scene.environmentIntensity=inSpace?.18:.4
    // Downshift once if sustained frame time exceeds the budget. Never add resolution mid-scene.
    if(dt>0 && !this.economy){
      this.adaptiveFrames++;if(dt>.034)this.slowFrames++
      if(this.adaptiveFrames===8&&this.slowFrames>5){
        // Software rendering and constrained GPUs need a useful floor below native DPR.
        this.renderer.setPixelRatio(.75)
        this.renderer.shadowMap.enabled=false
        this.renderer.domElement.dataset.quality='economy'
        this.economy=true
        this.resize()
      }
      if(this.adaptiveFrames===8){this.adaptiveFrames=0;this.slowFrames=0}
    }
    this.sun.shadow.needsUpdate=i!==this.shadowWorld||i===0||j.travel>0
    this.shadowWorld=i

    // Background and fog blend between worlds.
    const bg = this.scene.background as THREE.Color
    bg.lerpColors(BG[i]!, BG[next]!, j.travel)
    ;(this.scene.fog as THREE.FogExp2).color.copy(bg)

    // World 0: satellite slowly rolls.
    this.satellite.rotation.y = t * 0.15
    this.satellite.rotation.z = Math.sin(t * 0.4) * 0.05

    // Scene-local phases leave the global camera, dwell and flight untouched.
    const interferencePhase = this.interference.update(i === 1 ? j.local : i > 1 ? 1 : 0, t)
    if (i === 1) {
      if (this.interference.moving || this.renderer.domElement.dataset.interferencePhase !== interferencePhase) this.sun.shadow.needsUpdate = true
      this.renderer.domElement.dataset.interferencePhase = interferencePhase
    }

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
      ap.geometry.computeVertexNormals()
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

    for (const [index, ring] of this.portals.entries()) {
      ring.rotation.z = t * 0.1
      ring.visible = j.index===index && j.travel>0
      this.portalHalos[index]!.visible=ring.visible
    }

    this.renderer.render(this.scene, this.camera)
    // Updates once per scene, so browser QA can distinguish captions from an actually rendered world.
    if (i!==this.renderedWorld) {
      this.renderedWorld=i
      this.renderer.domElement.dataset.renderStage=String(i)
    }
    if (!this.firstFrame) {
      this.firstFrame = true
      this.opts.onFirstFrame?.()
    }
  }
}
