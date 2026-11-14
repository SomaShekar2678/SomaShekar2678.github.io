import * as T from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Original, unbranded engineering models. Fixed components are batched by material. */
export function seeded(seed: number) {
  let x = seed >>> 0
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296 }
}

function canvasMap(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, color = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const map = new T.CanvasTexture(c)
  if (color) map.colorSpace = T.SRGBColorSpace
  map.anisotropy = 4
  return map
}

export class ModelKit {
  readonly textures: T.Texture[] = []
  readonly metal = new T.MeshStandardMaterial({ color: '#b9c1c8', metalness: .86, roughness: .28 })
  readonly gold = new T.MeshStandardMaterial({ color: '#c7a16a', metalness: .85, roughness: .32 })
  readonly white = new T.MeshStandardMaterial({ color: '#d8dad3', metalness: .15, roughness: .58 })
  readonly dark = new T.MeshStandardMaterial({ color: '#141b20', metalness: .35, roughness: .56 })
  readonly pcb = new T.MeshStandardMaterial({ color: '#16443b', metalness: .34, roughness: .4 })
  readonly ceramic = new T.MeshStandardMaterial({ color: '#e2d4b7', metalness: .1, roughness: .43 })
  readonly copper = new T.MeshStandardMaterial({ color: '#a86d3f', metalness: .78, roughness: .34 })
  readonly foil: T.MeshStandardMaterial
  readonly solar: T.MeshPhysicalMaterial

  constructor() {
    const foil = canvasMap(256, 256, (ctx) => {
      const r = seeded(81)
      ctx.fillStyle = '#888';ctx.fillRect(0,0,256,256)
      for (let i=0;i<320;i++) {
        const x=r()*256,y=r()*256,l=4+r()*36
        const g=ctx.createLinearGradient(x,y,x+l,y+l)
        g.addColorStop(0,'#777');g.addColorStop(.47,'#bbb');g.addColorStop(.5,'#555');g.addColorStop(1,'#888')
        ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+l,y+2);ctx.lineTo(x+l*.4,y+l);ctx.fill()
      }
    },false)
    foil.wrapS=foil.wrapT=T.RepeatWrapping;foil.repeat.set(2,2)
    const solar=canvasMap(512,512,(ctx)=>{
      ctx.fillStyle='#101820';ctx.fillRect(0,0,512,512)
      const r=seeded(13)
      for(let y=0;y<12;y++) for(let x=0;x<8;x++) {
        const px=x*64+3,py=y*42.66+3
        const g=ctx.createLinearGradient(px,py,px+60,py+38)
        g.addColorStop(0,`hsl(${218+r()*12} 40% ${15+r()*5}%)`);g.addColorStop(1,'#111f38')
        ctx.fillStyle=g;ctx.fillRect(px,py,58,36)
        ctx.strokeStyle='#496079';ctx.lineWidth=.65;ctx.strokeRect(px,py,58,36)
        ctx.fillStyle='#8b9aa7';ctx.fillRect(px+18,py, .6,36);ctx.fillRect(px+40,py,.6,36)
        ctx.fillStyle='#30465b';for(let a=4;a<36;a+=4)ctx.fillRect(px,py+a,58,.5)
      }
    })
    this.textures.push(foil,solar)
    this.foil=new T.MeshStandardMaterial({color:'#b99756',metalness:.92,roughness:.28,bumpMap:foil,bumpScale:.045})
    const grain=canvasMap(256,256,ctx=>{
      const r=seeded(55);ctx.fillStyle='#aaa';ctx.fillRect(0,0,256,256)
      for(let i=0;i<1600;i++){
        const v=130+Math.floor(r()*80);ctx.strokeStyle=`rgb(${v},${v},${v})`;ctx.lineWidth=.5
        const x=r()*256,y=r()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+10+r()*60,y);ctx.stroke()
      }
    },false)
    grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(3,3);this.textures.push(grain)
    this.metal.bumpMap=grain;this.metal.bumpScale=.006
    this.pcb.bumpMap=grain;this.pcb.bumpScale=.008
    this.dark.bumpMap=grain;this.dark.bumpScale=.003
    this.solar=new T.MeshPhysicalMaterial({map:solar,metalness:.35,roughness:.28,clearcoat:.65,clearcoatRoughness:.18,side:T.DoubleSide})
  }
  label(text: string, w=512, h=128) {
    const texture=canvasMap(w,h,c=>{c.clearRect(0,0,w,h);c.fillStyle='#c5cec7';c.font=`${h*.32}px monospace`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2)})
    this.textures.push(texture)
    return new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.8,toneMapped:false})
  }
  dispose() { this.textures.forEach(t=>t.dispose()); for(const v of Object.values(this)) if(v instanceof T.Material)v.dispose() }
}

class Parts {
  private batches = new Map<T.Material,T.BufferGeometry[]>()
  private dummy = new T.Object3D()
  add(g:T.BufferGeometry, mat:T.Material, pos:[number,number,number], rot:[number,number,number]=[0,0,0]) {
    this.dummy.position.set(...pos);this.dummy.rotation.set(...rot);this.dummy.updateMatrix()
    const flat=g.index?g.toNonIndexed():g
    if(flat!==g)g.dispose()
    flat.deleteAttribute('uv1');flat.applyMatrix4(this.dummy.matrix)
    const list=this.batches.get(mat)||[];list.push(flat);this.batches.set(mat,list)
  }
  box(size:[number,number,number],mat:T.Material,pos:[number,number,number],r=0) {
    this.add(r?new RoundedBoxGeometry(...size,2,r):new T.BoxGeometry(...size),mat,pos)
  }
  rod(a:T.Vector3,b:T.Vector3,r:number,mat:T.Material) {
    const geo=new T.CylinderGeometry(r,r,a.distanceTo(b),8)
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize())
    geo.applyQuaternion(q);geo.translate(...a.clone().add(b).multiplyScalar(.5).toArray())
    this.add(geo,mat,[0,0,0])
  }
  finish() {
    const group=new T.Group()
    for(const [mat,geos] of this.batches) {
      const geometry=mergeGeometries(geos,false)!
      geos.forEach(g=>g.dispose())
      const mesh=new T.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)
    }
    return group
  }
}

/** Generic GNSS-type bus with two solar wings and an Earth-facing navigation antenna deck. */
export function navigationSatellite(kit:ModelKit, detail=true) {
  const p=new Parts()
  const blanket=new T.BoxGeometry(1.3,1.55,1.5,14,14,14)
  const bp=blanket.getAttribute('position'),bn=blanket.getAttribute('normal')
  for(let i=0;i<bp.count;i++){
    const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i)
    const fold=.009*Math.sin(x*41+y*29+z*37)*Math.sin(y*23-x*17)
    bp.setXYZ(i,x+bn.getX(i)*fold,y+bn.getY(i)*fold,z+bn.getZ(i)*fold)
  }
  blanket.computeVertexNormals();p.add(blanket,kit.foil,[0,0,0])
  for(const y of [-.77,.77]) p.box([1.38,.07,1.58],kit.metal,[0,y,0],.02)
  p.box([1.07,1.25,.025],kit.white,[0,0,.77])
  // Radiator panel segmentation, retention rails and fasteners.
  for(const x of [-.56,.56]) p.box([.025,1.2,.035],kit.metal,[x,0,.795])
  for(let i=0;i<5;i++)p.box([1.1,.012,.035],kit.metal,[0,-.5+i*.25,.795])
  if(detail) for(const x of [-.6,.6])for(const y of [-.66,0,.66])p.add(new T.CylinderGeometry(.025,.025,.018,8),kit.metal,[x,y,.8],[Math.PI/2,0,0])
  const wingRot=.78
  for(const side of [-1,1]) {
    p.add(new T.CylinderGeometry(.11,.11,.48,16),kit.metal,[side*.88,0,0],[0,0,Math.PI/2])
    p.box([.75,.08,.09],kit.metal,[side*1.2,0,0])
    for(let panel=0;panel<3;panel++) {
      const x=side*(1.8+panel*1.1)
      p.add(new T.BoxGeometry(1.06,.045,1.95),kit.dark,[x,0,0],[wingRot,0,0])
      const wing=new T.PlaneGeometry(1.0,1.86)
      wing.rotateX(-Math.PI/2);wing.translate(0,.026,0)
      p.add(wing,kit.solar,[x,0,0],[wingRot,0,0])
      for(const z of [-.98,.98]) {
        const g=new T.BoxGeometry(1.08,.055,.025);g.translate(0,0,z)
        p.add(g,kit.metal,[x,0,0],[wingRot,0,0])
      }
      if(panel<2)p.box([.08,.09,.11],kit.metal,[x+side*.55,0,0])
    }
  }
  // Nadir-facing deck: ceramic patch apertures, no fictional communications dish.
  p.box([1.48,.075,1.65],kit.white,[0,-.88,0],.035)
  for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
    p.add(new T.CylinderGeometry(.135,.135,.045,20),kit.gold,[x*.4,-.94,z*.43])
    p.add(new T.CylinderGeometry(.105,.11,.035,20),kit.ceramic,[x*.4,-.98,z*.43])
  }
  // Two small telemetry helices and attitude-control nozzles mounted to the bus.
  for(const side of [-1,1]) {
    p.add(new T.CylinderGeometry(.07,.09,.16,12),kit.white,[side*.46,.89,.45])
    if(detail){
      const pts=Array.from({length:97},(_,i)=>new T.Vector3(side*.46+.07*Math.cos(i/96*Math.PI*8),.96+i/96*.42,.45+.07*Math.sin(i/96*Math.PI*8)))
      p.add(new T.TubeGeometry(new T.CatmullRomCurve3(pts),96,.009,5,false),kit.gold,[0,0,0])
    }
    for(const z of [-.57,.57])p.add(new T.CylinderGeometry(.045,.095,.16,12,1,true),kit.dark,[side*.72,-.55,z],[0,0,side*Math.PI/2])
  }
  return p.finish()
}

/** Spacing follows the actual 4×4 λ/2 array model, with the existing 1.3 scene scale. */
export function receiveArray(kit:ModelKit, elements:{n:number;x:Float64Array;y:Float64Array}) {
  const p=new Parts()
  p.box([2.8,.12,2.8],kit.metal,[0,-.09,0],.05)
  p.box([2.66,.045,2.66],kit.pcb,[0,-.005,0],.035)
  for(let i=0;i<elements.n;i++){
    const x=elements.x[i]!*1.3,z=-elements.y[i]!*1.3
    p.box([.43,.12,.43],kit.ceramic,[x,.075,z],.022)
    p.box([.37,.009,.37],kit.copper,[x,.14,z],.012)
    p.add(new T.CylinderGeometry(.012,.012,.045,8),kit.gold,[x+.09,.15,z+.09])
  }
  for(const x of [-1.27,1.27])for(const z of [-1.27,1.27]){
    p.add(new T.CylinderGeometry(.055,.055,.035,12),kit.metal,[x,.036,z])
    p.box([.06,.008,.01],kit.dark,[x,.057,z])
  }
  // SMA-style edge connectors grounded to the shared plate.
  for(let i=0;i<4;i++)p.add(new T.CylinderGeometry(.055,.055,.22,12),kit.gold,[-.9+i*.6,-.055,1.46],[Math.PI/2,0,0])
  return p.finish()
}

/** Cutaway architecture board. Packages are stages, not a claimed commercial board layout. */
export function processingBoard(kit:ModelKit) {
  const p=new Parts()
  p.box([20.4,.18,12.8],kit.pcb,[0,-.12,0],.13)
  p.box([20.5,.1,12.9],kit.dark,[0,-.29,0],.12)
  const stages=[-6.5,-2.2,2.2,6.5]
  stages.forEach((x,index)=>{
    p.box([2.58,.11,3.65],kit.dark,[x,.05,0],.05)
    p.box([2.3,.54,3.4],kit.dark,[x,.38,0],.09)
    p.box([1.75,.04,2.8],kit.metal,[x,.67,0],.055)
    // BGA escape lines and local decoupling, arranged around each package.
    for(let pin=0;pin<18;pin++)for(const side of [-1,1]){
      const z=-1.52+pin*.18
      p.box([.26,.035,.065],kit.metal,[x+side*1.22,.12,z])
    }
    for(const side of [-1,1])for(let cap=0;cap<10;cap++){
      const z=side*(2.1+(cap%2)*.38),cx=x-1+Math.floor(cap/2)*.5
      p.box([.24,.1,.13],kit.ceramic,[cx,.08,z],.018)
      p.box([.055,.11,.14],kit.metal,[cx-.1,.08,z]);p.box([.055,.11,.14],kit.metal,[cx+.1,.08,z])
    }
    // Adjacent memory/clock blocks tied to their owning stage.
    p.box([1.5,.2,.85],kit.dark,[x,.13,-4],.04)
    for(let pin=0;pin<10;pin++)for(const side of [-1,1])p.box([.075,.04,.2],kit.metal,[x-.65+pin*.145,.05,-4+side*.48])
    for(let lane=0;lane<5;lane++){
      const z=(lane-2)*.62
      // Differential copper traces under the original five sample streams.
      for(const d of [-.035,.035])p.box([4.1,.012,.018],kit.copper,[x+2.0,.015,z+d])
    }
    for(let lane=0;lane<8;lane++){
      const lx=x-.7+lane*.2
      p.box([.018,.012,1.8],kit.copper,[lx,.016,-2.7])
      p.add(new T.CylinderGeometry(.035,.035,.014,8),kit.gold,[lx,.017,-3.5])
    }
    // Status lamp reflects pipeline position, not live device telemetry.
    p.box([.1,.06,.16],new T.MeshStandardMaterial({color:index<2?'#7e9bb6':'#819578',emissive:index<2?'#203d55':'#203819',emissiveIntensity:.2}),[x+1.5,.07,3.1])
  })
  for(const x of [-9.5,9.5])for(const z of [-5.7,5.7]){
    p.add(new T.CylinderGeometry(.22,.22,.25,6),kit.metal,[x,.05,z])
    p.add(new T.CylinderGeometry(.08,.08,.02,12),kit.dark,[x,.185,z])
  }
  for(let lane=0;lane<5;lane++){
    const z=(lane-2)*.62
    p.add(new T.CylinderGeometry(.14,.14,.7,16),kit.gold,[-10.2,.15,z],[0,0,Math.PI/2])
    p.add(new T.CylinderGeometry(.065,.065,.72,12),kit.dark,[-10.22,.15,z],[0,0,Math.PI/2])
    p.box([.55,.3,.36],kit.dark,[10.1,.13,z],.03)
  }
  // Power distribution rails along both board margins connect the local stage supplies.
  for(const z of [-5.15,5.15]) {
    p.box([18.5,.012,.09],kit.copper,[0,.017,z])
    for(const x of stages){
      p.box([.055,.012,1.1],kit.copper,[x+1.6,.017,z-Math.sign(z)*.55])
      for(let i=0;i<6;i++)p.add(new T.CylinderGeometry(.028,.028,.015,8),kit.gold,[x-1+i*.4,.018,z+.25])
    }
  }
  const group=p.finish()
  for(const [i,text]of ['I / Q','COVARIANCE','WEIGHTS','BEAMFORM'].entries()){
    const label=new T.Mesh(new T.PlaneGeometry(2.6,.65),kit.label(text));label.rotation.x=-Math.PI/2;label.position.set(stages[i]!, .025,3.3);group.add(label)
    const etch=new T.Mesh(new T.PlaneGeometry(1.5,.42),kit.label(text));etch.rotation.x=-Math.PI/2;etch.position.set(stages[i]!, .696,.25);etch.material.opacity=.38;group.add(etch)
  }
  return group
}

export function sensorVehicle(kit:ModelKit) {
  const p=new Parts()
  p.box([.95,.26,.53],kit.white,[0,0,0],.09)
  p.box([.46,.22,.44],kit.dark,[-.08,.19,0],.055)
  p.add(new T.CylinderGeometry(.1,.1,.11,16),kit.dark,[0,.36,0])
  p.add(new T.CylinderGeometry(.105,.105,.025,16),kit.metal,[0,.43,0])
  for(const x of [-.3,.3])for(const z of [-.28,.28])p.add(new T.CylinderGeometry(.125,.125,.08,16),kit.dark,[x,-.1,z],[Math.PI/2,0,0])
  return p.finish()
}

/** Reuse spacecraft geometry/materials across the four ranging observations. */
export function satelliteFleet(kit:ModelKit, positions:T.Vector3[]) {
  const prototype=navigationSatellite(kit,false)
  const fleet=new T.Group(),transform=new T.Object3D()
  for(const part of prototype.children) {
    const source=part as T.Mesh
    const instances=new T.InstancedMesh(source.geometry,source.material,positions.length)
    positions.forEach((position,index)=>{
      transform.position.copy(position);transform.scale.setScalar(.18)
      transform.rotation.set(.35,Math.atan2(position.x,position.z),.1)
      transform.updateMatrix();instances.setMatrixAt(index,transform.matrix)
    })
    instances.castShadow=true;instances.receiveShadow=true;fleet.add(instances)
  }
  return fleet
}
