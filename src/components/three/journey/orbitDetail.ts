import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ModelKit, navigationSatellite, seeded } from './models'
import { earthModel, type EarthAssets, SUN } from './earth'

/** Scene-01-only detail; the small spacecraft in the positioning scene stay unchanged. */
export function orbitalSatellite(kit: ModelKit) {
  const sat = navigationSatellite(kit)
  // Silver multilayer insulation responds to the reference's cool faces/warm edge highlights.
  // Clone the material so the positioning scene's shared model cannot change.
  const silverBlanket = kit.foil.clone()
  silverBlanket.color.set('#9da8af')
  silverBlanket.roughness = .3
  silverBlanket.bumpScale = .085
  sat.traverse(object => {
    const mesh = object as T.Mesh
    if (mesh.material === kit.foil) mesh.material = silverBlanket
  })
  const batches = new Map<T.Material, T.BufferGeometry[]>()
  const add = (geometry: T.BufferGeometry, material: T.Material, position: T.Vector3, rotation = new T.Euler()) => {
    const matrix = new T.Matrix4().compose(position, new T.Quaternion().setFromEuler(rotation), new T.Vector3(1, 1, 1))
    const flat = geometry.index ? geometry.toNonIndexed() : geometry
    if (flat !== geometry) geometry.dispose()
    flat.applyMatrix4(matrix)
    const list = batches.get(material) ?? []
    list.push(flat); batches.set(material, list)
  }
  const cell = new T.MeshPhysicalMaterial({ color: '#172c48', metalness: .48, roughness: .24, clearcoat: .8, clearcoatRoughness: .16 })
  const interconnect = new T.MeshStandardMaterial({ color: '#8d9fba', metalness: .8, roughness: .32 })
  // Actual raised cells and busbars, above the existing thin composite wing substrates.
  const wingRotation = new T.Euler(.78, 0, 0)
  for (const side of [-1, 1]) for (let panel = 0; panel < 3; panel++) {
    const centre = side * (1.8 + panel * 1.1)
    const at = (x: number, y: number, z: number) => new T.Vector3(x, y, z).applyEuler(wingRotation).add(new T.Vector3(centre, 0, 0))
    for (let row = 0; row < 12; row++) for (let col = 0; col < 6; col++) {
      const x = -.42 + col * .168, z = -.85 + row * .155
      add(new T.BoxGeometry(.157, .008, .144), cell, at(x, .035, z), wingRotation)
      for (const dx of [-.043, .043]) add(new T.BoxGeometry(.003, .0015, .143), interconnect, at(x + dx, .04, z), wingRotation)
    }
    // Rear support stringers, paired hinge barrels and flex-cable bridge.
    for (const z of [-.65, .65]) add(new T.BoxGeometry(1.04, .035, .025), kit.metal, at(0, -.045, z), wingRotation)
    for (const z of [-.62, .62]) add(new T.CylinderGeometry(.035, .035, .15, 10), kit.metal, at(side * .54, 0, z), new T.Euler(Math.PI / 2 + .78, 0, 0))
  }
  // Blanket retention tapes and bolt rails run along actual bus edges.
  for (const x of [-.66, .66]) {
    for (const z of [-.7, .7]) add(new T.BoxGeometry(.032, 1.48, .035), kit.metal, new T.Vector3(x, 0, z))
    for (let y = -.6; y < .7; y += .3) for (const z of [-.72, .72]) {
      add(new T.SphereGeometry(.024, 8, 6), kit.metal, new T.Vector3(x, y, z))
    }
    // Harness routed to the panel-drive assembly rather than arbitrary loose wires.
    const curve = new T.CatmullRomCurve3([new T.Vector3(x, -.55, .6), new T.Vector3(x * 1.08, -.3, .63), new T.Vector3(x * 1.08, .05, .25), new T.Vector3(x * 1.45, .05, 0)])
    add(new T.TubeGeometry(curve, 20, .018, 6, false), kit.dark, new T.Vector3())
  }
  // Recessed sensor aperture, radiator louvres and supported antenna deck.
  add(new T.BoxGeometry(.3, .27, .12), kit.metal, new T.Vector3(.35, .42, -.79))
  add(new T.CylinderGeometry(.09, .09, .13, 20), kit.dark, new T.Vector3(.35, .42, -.86), new T.Euler(Math.PI / 2, 0, 0))
  for (let i = 0; i < 9; i++) add(new T.BoxGeometry(.75, .025, .055), kit.metal, new T.Vector3(0, -.48 + i * .12, .81), new T.Euler(.2, 0, 0))
  for (const x of [-.55, .55]) for (const z of [-.6, .6]) add(new T.CylinderGeometry(.045, .055, .17, 10), kit.metal, new T.Vector3(x, -.83, z))
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts)!
    parts.forEach(p => p.dispose())
    const mesh = new T.Mesh(geometry, material)
    mesh.castShadow = mesh.receiveShadow = true
    sat.add(mesh)
  }
  return sat
}

/** Additional optical-depth limb for the opening shot only; not a full atmosphere solver. */
export function orbitalEarth(assets: EarthAssets, segments: number) {
  const earth = earthModel(8, assets, segments)
  const limb = new T.Mesh(new T.SphereGeometry(8.13, segments, 48), new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.BackSide, blending: T.AdditiveBlending,
    uniforms: { sun: { value: SUN } },
    vertexShader: `varying vec3 n,w;void main(){n=normalize(mat3(modelMatrix)*normal);vec4 p=modelMatrix*vec4(position,1.);w=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `uniform vec3 sun;varying vec3 n,w;void main(){
      vec3 normal=normalize(n),view=normalize(cameraPosition-w);
      float grazing=1.-abs(dot(normal,view));
      float daylight=smoothstep(-.18,.45,dot(normal,sun));
      float optical=1.-exp(-pow(grazing,12.)*.55);
      gl_FragColor=vec4(vec3(.12,.32,.62),optical*daylight*.5);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }))
  earth.add(limb)
  return earth
}

/** Artistic celestial backdrop: stable far stars, very small depth parallax, two distant illustrative planets.
 * Not an ephemeris or accurate angular scale. No geocentric orbital motion is introduced. */
export function orbitalBackdrop(quality: number, time: { value: number }) {
  const group = new T.Group(), random = seeded(421)
  const count = Math.round(3600 * quality), positions = [], sizes = [], colors = [], phases = []
  for (let i = 0; i < count; i++) {
    const az = random() * Math.PI * 2, y = random() * 2 - 1
    const radius = i % 5 === 0 ? 115 + random() * 30 : 175 + random() * 15
    const horizontal = Math.sqrt(1 - y * y)
    positions.push(radius * horizontal * Math.cos(az), radius * y, radius * horizontal * Math.sin(az))
    const power = Math.pow(random(), 5)
    sizes.push(.65 + power * 1.3)
    const warm = random(), brightness = .18 + power * .65
    colors.push(brightness * (warm > .75 ? 1 : .79), brightness * .9, brightness * (warm > .75 ? .78 : 1))
    phases.push(i % 97 === 0 ? random() * 6.28 + 1 : 0)
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('size', new T.Float32BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new T.Float32BufferAttribute(phases, 1))
  const stars = new T.Points(geometry, new T.ShaderMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    uniforms: { time },
    vertexShader: `attribute float size,phase;uniform float time;varying vec3 tint;void main(){tint=color*(phase>0.?1.+.02*sin(time*.7+phase):1.);vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=size;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying vec3 tint;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;gl_FragColor=vec4(tint,(1.-smoothstep(.05,.5,r)));}`,
  }))
  stars.frustumCulled = false; stars.renderOrder = -8; group.add(stars)
  // Positions composed in the initial camera frame, fixed thereafter; no orbital path.
  const forward = new T.Vector3(-12, -3.5, -19).normalize()
  const right = new T.Vector3().crossVectors(forward, new T.Vector3(0, 1, 0)).normalize()
  const up = new T.Vector3().crossVectors(right, forward)
  for (const [x,y,r,gas] of [[-.27,.23,.6,0],[.28,.2,1.3,1]]) {
    const material = new T.ShaderMaterial({uniforms:{sun:{value:SUN},gas:{value:gas}},
      vertexShader:`varying vec3 n;varying vec2 tex;void main(){n=normalize(mat3(modelMatrix)*normal);tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform vec3 sun;uniform float gas;varying vec3 n;varying vec2 tex;void main(){
        float detail=sin(tex.y*110.+sin(tex.x*32.)*.7)*.5+.5;
        vec3 rocky=mix(vec3(.2,.07,.035),vec3(.42,.22,.11),detail);
        vec3 bands=mix(vec3(.28,.23,.17),vec3(.5,.43,.31),detail);
        gl_FragColor=vec4(mix(rocky,bands,gas)*(.03+max(dot(normalize(n),sun),0.)*1.4),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`})
    const body = new T.Mesh(new T.SphereGeometry(r!, 32, 24), material)
    body.position.copy(forward).multiplyScalar(100).addScaledVector(right,x!*100).addScaledVector(up,y!*100)
    group.add(body)
  }
  return group
}
