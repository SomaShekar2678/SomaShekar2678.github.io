import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ModelKit, navigationSatellite, receiveArray, seeded } from './models'
import { ura } from '../../../lib/beamforming'
import { smoothstep } from '../../../lib/journeyPath'
import { correlationExperiment, INTERFERENCE_MODEL } from '../../../lib/interferenceModel'

const BLUE = '#70d6ff', AMBER = '#f5a452'
/** Original models and synthetic signal illustrations. Scene-local choreography only. */
export function interferenceWorld(kit:ModelKit, quality:number) {
  const root=new T.Group(), ground=new T.Group(), frequency=new T.Group(), receiver=new T.Group(), bridge=new T.Group()
  root.add(ground,frequency,receiver,bridge)
  const metal=kit.metal.clone();metal.color.set('#68747d');metal.roughness=.42
  const paint=new T.MeshStandardMaterial({color:'#737d75',roughness:.72,metalness:.3})
  const batches=new Map<T.Material,T.BufferGeometry[]>()
  const matrix=new T.Object3D()
  function part(g:T.BufferGeometry,m:T.Material,p:[number,number,number],rotation:[number,number,number]=[0,0,0]) {
    matrix.position.set(...p);matrix.rotation.set(...rotation);matrix.updateMatrix()
    const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose()
    flat.applyMatrix4(matrix.matrix);const list=batches.get(m)||[];list.push(flat);batches.set(m,list)
  }
  const box=(size:[number,number,number],m:T.Material,p:[number,number,number])=>part(new T.BoxGeometry(...size),m,p)
  function rod(a:T.Vector3,b:T.Vector3,r:number,m:T.Material) {
    const geo=new T.CylinderGeometry(r,r,a.distanceTo(b),8)
    geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()))
    geo.translate(...a.clone().add(b).multiplyScalar(.5).toArray());part(geo,m,[0,0,0])
  }
  function finish(target:T.Group) {
    for(const [m,geos] of batches){const merged=mergeGeometries(geos,false)!;geos.forEach(g=>g.dispose());const mesh=new T.Mesh(merged,m);mesh.castShadow=mesh.receiveShadow=true;target.add(mesh)}batches.clear()
  }
  function label(group:T.Group,text:string,w:number,p:[number,number,number],color?:string) {
    const width=Math.max(40,text.length*20)
    const material=kit.label(text,width,96);material.opacity=1;if(color)material.color.set(color)
    const mesh=new T.Mesh(new T.PlaneGeometry(w,w*96/width),material);mesh.position.set(...p);mesh.rotation.x=-.52;group.add(mesh);return mesh
  }
  // Rugged plateau, with a flattened equipment pad. The remote ridge gives an earthly horizon.
  const terrain=new T.PlaneGeometry(90,70,Math.round(180*quality),Math.round(140*quality));terrain.rotateX(-Math.PI/2)
  const vertices=terrain.getAttribute('position')
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i)
    const ridge=Math.max(0,-z-9)*.24
    const rough=Math.sin(x*.29+z*.13)*Math.cos(z*.31)+.3*Math.sin(x*1.4+z*.7)+.12*Math.sin(x*3.6-z*2)
    const pad=1-Math.exp(-((x-3)**2+(z+3)**2)/50)
    vertices.setY(i,-1.2+pad*rough*.9+ridge*(.7+.3*Math.sin(x*.19)))
  }
  terrain.computeVertexNormals()
  const noiseCanvas=document.createElement('canvas');noiseCanvas.width=noiseCanvas.height=256
  const ctx=noiseCanvas.getContext('2d')!,pixels=ctx.createImageData(256,256),random=seeded(204)
  for(let i=0;i<pixels.data.length;i+=4){const v=90+random()*90;pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=255}
  ctx.putImageData(pixels,0,0)
  const rockMap=new T.CanvasTexture(noiseCanvas);rockMap.wrapS=rockMap.wrapT=T.RepeatWrapping;rockMap.repeat.set(28,24);kit.textures.push(rockMap)
  const rockMaterial=new T.MeshStandardMaterial({color:'#29353e',roughness:.96,metalness:.06,bumpMap:rockMap,bumpScale:.13,map:rockMap})
  const earth=new T.Mesh(terrain,rockMaterial);earth.receiveShadow=true;ground.add(earth)
  const stones=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),rockMaterial,Math.round(240*quality))
  for(let i=0;i<stones.count;i++){
    const x=(random()-.5)*45,z=(random()-.5)*35
    const pad=1-Math.exp(-((x-3)**2+(z+3)**2)/50)
    const rough=Math.sin(x*.29+z*.13)*Math.cos(z*.31)+.3*Math.sin(x*1.4+z*.7)+.12*Math.sin(x*3.6-z*2)
    matrix.position.set(x,-1.2+pad*rough*.9+Math.max(0,-z-9)*.24*(.7+.3*Math.sin(x*.19)),z)
    const radius=.07+random()*.22;matrix.scale.set(radius,radius*.6,radius);matrix.rotation.set(random(),random()*6,random());matrix.updateMatrix();stones.setMatrixAt(i,matrix.matrix)
  }
  matrix.scale.setScalar(1);stones.receiveShadow=true;ground.add(stones)
  // Ground transmitter: skid, louvred shelter, mast with diagonal bracing, parabolic dish and feed.
  box([5.4,.28,3.4],metal,[3,-.66,-3]);box([3.4,1.6,2.2],paint,[3,.28,-3])
  box([3.6,.12,2.4],metal,[3,1.12,-3])
  for(let i=0;i<15;i++)box([.045,.75,.08],kit.dark,[1.6+i*.16,.4,-1.86])
  for(const x of [.6,5.4])for(const z of [-4.4,-1.6]){
    part(new T.CylinderGeometry(.11,.14,.9,12),metal,[x,-.5,z]);box([.55,.08,.55],metal,[x,-.94,z])
  }
  box([.8,1.1,1],kit.dark,[5.05,.15,-3.4])
  for(let i=0;i<6;i++)box([.82,.045,.85],metal,[5.05,-.25+i*.15,-3.4])
  for(const x of [5.9,6.7])for(const z of [-4.6,-3.8])rod(new T.Vector3(x,-.8,z),new T.Vector3(x,7,z),.045,metal)
  for(let i=0;i<7;i++)for(const z of [-4.6,-3.8]){
    rod(new T.Vector3(5.9,i-.8,z),new T.Vector3(6.7,i+.2,z),.025,metal)
    rod(new T.Vector3(6.7,i-.8,z),new T.Vector3(5.9,i+.2,z),.025,metal)
  }
  for(let i=0;i<14;i++)box([.8,.035,.035],metal,[6.3,i*.48,-3.78])
  part(new T.CylinderGeometry(.14,.14,.3,12),new T.MeshStandardMaterial({color:'#ad573a',emissive:'#b33811',emissiveIntensity:.7}),[6.3,7.1,-4.2])
  part(new T.CylinderGeometry(.22,.32,1.7,20),metal,[2.6,1.8,-3])
  box([3.1,.5,3.1],paint,[-5,-.8,2]);finish(ground)
  const dish=new T.Group();dish.position.set(2.6,2.75,-3);dish.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(-7.6,-2.75,5).normalize())
  const profile=Array.from({length:25},(_,i)=>{const r=i/24*1.65;return new T.Vector2(r,r*r*.24)})
  const bowl=new T.Mesh(new T.LatheGeometry(profile,64),new T.MeshStandardMaterial({color:'#78838b',metalness:.76,roughness:.38,side:T.DoubleSide}));bowl.castShadow=true;dish.add(bowl)
  part(new T.TorusGeometry(1.65,.045,8,64),metal,[0,.65,0],[Math.PI/2,0,0])
  for(let j=0;j<4;j++){const a=j*Math.PI/2;rod(new T.Vector3(Math.cos(a)*1.5,.55,Math.sin(a)*1.5),new T.Vector3(0,1.4,0),.025,metal)}
  part(new T.CylinderGeometry(.13,.19,.24,16),kit.gold,[0,1.43,0]);finish(dish);ground.add(dish)
  const satellite=navigationSatellite(kit,false);satellite.scale.setScalar(.25);satellite.position.set(-9,7,-10);satellite.rotation.set(.4,.5,.5);ground.add(satellite)
  const initialArray=receiveArray(kit,ura(4,4,.5));initialArray.position.set(-5,-.45,2);ground.add(initialArray)
  label(ground,'01 / RF TRANSMITTER',5,[4,2,-.3],AMBER)
  label(ground,'GPS L1 / 1575.42 MHz',5,[-8,5.7,-9],BLUE)
  label(ground,'RECEIVING ARRAY',4,[-5,-.2,4.5],BLUE)

  // Curved wavefront shells: angular aperture and spacing are deliberately enlarged.
  // These illustrate sources/directions, not optical light or a Maxwell-field solution.
  const time={value:0},attack={value:0},fieldGain={value:1}
  function field(source:T.Vector3,target:T.Vector3,color:string,interferer:boolean,owner=ground){
    const length=source.distanceTo(target),shells=8
    const g=new T.SphereGeometry(1,Math.round(64*quality),Math.round(28*quality),0,Math.PI*2,0,.48)
    const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{uTime:time,uAttack:attack,uGain:fieldGain,uColor:{value:new T.Color(color)},uLength:{value:length},uJammer:{value:interferer?1:0}},
      vertexShader:`uniform float uTime,uLength;varying vec3 vN;varying vec3 vView;varying float vR;varying vec2 vUv;
      void main(){float id=instanceMatrix[3].x;float r=mod(id+uTime*.045,1.);vR=r;vUv=uv;
      vec3 p=position*(.2+r*uLength);vec4 mv=modelViewMatrix*vec4(p,1.);vN=normalize(normalMatrix*normal);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float uAttack,uGain,uJammer;uniform vec3 uColor;varying vec3 vN,vView;varying float vR;varying vec2 vUv;
      void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vView))),2.);
      float grid=pow(.5+.5*cos(vUv.x*100.),14.)*.15+pow(.5+.5*cos(vUv.y*120.),18.)*.16;
      float fade=smoothstep(0.,.1,vR)*(1.-smoothstep(.7,1.,vR));float strength=mix(.7,uAttack,uJammer);
      gl_FragColor=vec4(uColor*(.6+rim*.5),(.045+rim*.22+grid)*fade*strength*uGain);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`})
    const mesh=new T.InstancedMesh(g,mat,shells),m=new T.Matrix4()
    for(let i=0;i<shells;i++){m.makeTranslation(i/shells,0,0);mesh.setMatrixAt(i,m)}
    mesh.position.copy(source);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),target.clone().sub(source).normalize());mesh.frustumCulled=false;owner.add(mesh)
  }
  const destination=new T.Vector3(-5,0,2)
  field(new T.Vector3(-9,7,-10),destination,BLUE,false)
  field(new T.Vector3(2.6,2.75,-3).addScaledVector(new T.Vector3(-7.6,-2.75,5).normalize(),1.43),destination,AMBER,true)

  // Time-frequency landscape. Horizontal units MHz; height relative PSD in dB, not dBm.
  const strength={value:0},mode={value:0}
  const spectrumGeo=new T.PlaneGeometry(19,12,Math.round(280*quality),Math.round(90*quality));spectrumGeo.rotateX(-Math.PI/2)
  const spectrumMaterial=new T.ShaderMaterial({side:T.DoubleSide,uniforms:{uStrength:strength,uMode:mode},
    vertexShader:`uniform float uStrength,uMode;varying float vDb,vDesired;varying vec3 vView;varying vec2 vPlane;
    void main(){vec3 p=position;float f=p.x/9.5*2.046;float history=(p.z+6.)/12.;float a=3.14159265*f/1.023;
    float sinc=abs(a)<.0001?1.:sin(a)/a;float desired=.06*sinc*sinc;
    float center=uMode>1.5?-1.5+3.*history:.65;
    float jam=uMode>.5&&uMode<1.5?10.:120.*exp(-pow((f-center)/.055,2.));
    float ramp=smoothstep(.05,.85,history);float total=1.+desired+uStrength*jam*ramp;
    vDb=10.*log(total)/log(10.);vDesired=sinc*sinc;p.y=.1+vDb*.145;vPlane=p.xz;
    vec4 mv=modelViewMatrix*vec4(p,1.);vView=mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying float vDb,vDesired;varying vec3 vView;varying vec2 vPlane;
    void main(){vec3 n=normalize(cross(dFdx(vView),dFdy(vView)));float light=.5+.5*abs(dot(n,normalize(vec3(-.4,.8,.5))));
    vec3 base=mix(vec3(.025,.085,.15),vec3(.06,.32,.5),vDesired*.55);
    vec3 col=mix(base,vec3(.62,.19,.025),smoothstep(1.,30.,vDb));col=mix(col,vec3(.95,.61,.18),smoothstep(30.,42.,vDb));
    float line=pow(.5+.5*cos(vPlane.y*9.),28.);gl_FragColor=vec4(col*light+col*line*.3,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`})
  const surface=new T.Mesh(spectrumGeo,spectrumMaterial);surface.frustumCulled=false;frequency.add(surface)
  box([19.4,.18,12.4],kit.dark,[0,-.12,0]);finish(frequency)
  for(const [x,text]of [[-9.5,'1573.374'],[0,'1575.420'],[9.5,'1577.466']] as const)label(frequency,text,3,[x,.1,7.1])
  label(frequency,'FREQUENCY / MHz',5,[0,.1,8.2])
  const powerAxis=new T.BufferGeometry().setFromPoints([new T.Vector3(-10,0,-5),new T.Vector3(-10,5.8,-5)])
  frequency.add(new T.Line(powerAxis,new T.LineBasicMaterial({color:'#91a6ae'})))
  for(const db of [0,20,40])label(frequency,`${db} dB`,2,[-10.8,.1+db*.145,-5])
  label(frequency,'HISTORY / 0 - 1 ms',4,[-8,.1,-7.2])
  label(frequency,'SYNTHETIC PSD / dB ABOVE THERMAL FLOOR',12,[1,6,-5.8])
  const modeLabels=['CW / +0.65 MHz OFFSET','BROADBAND / RAISED FLOOR','SWEEP / -1.5 TO +1.5 MHz'].map(text=>label(frequency,text,9,[1,5,-4],AMBER))
  frequency.position.set(1.2,0,-2)

  // A machined receiver enclosure, with paired correlation instruments above its cutaway.
  box([15,.45,7],metal,[0,-.4,0]);box([14.4,.18,6.4],kit.pcb,[0,-.08,0])
  for(let i=0;i<4;i++){
    box([2.3,.6,2.1],kit.dark,[-5.2+i*3.45,.3,0])
    for(let j=0;j<8;j++)box([.12,.08,2.5],kit.metal,[-6.1+i*3.45+j*.25,.04,0])
  }
  for(let i=0;i<22;i++)box([.08,.6,6.3],kit.dark,[-7.1+i*.09,-.05,0])
  for(let i=0;i<4;i++){
    part(new T.CylinderGeometry(.12,.12,.4,16),kit.gold,[-5+i*3.3,-.25,3.6],[Math.PI/2,0,0])
    for(let j=0;j<8;j++)box([.025,.012,1.5],kit.copper,[-5.8+i*3.45+j*.16,.025,1.9])
    box([.8,.26,.7],kit.metal,[-5.2+i*3.45,.14,-2.3])
  }
  finish(receiver)
  const screen=new T.Group();screen.rotation.x=-.52;screen.position.set(0,4.8,1);receiver.add(screen)
  const panel=new T.Mesh(new T.PlaneGeometry(19,9.8),new T.MeshBasicMaterial({color:'#081a23',side:T.DoubleSide}));screen.add(panel)
  function screenLabel(text:string,w:number,x:number,y:number,color?:string){const l=label(screen,text,w,[x,y,.04],color);l.rotation.x=0;return l}
  screenLabel('CODE CORRELATION / PRN 01',12,0,3.45)
  screenLabel('BEFORE INTERFERENCE',6,-4.8,2.5,BLUE);screenLabel('WITH BROADBAND INTERFERENCE',8,4.8,2.5,AMBER)
  screenLabel('1 ms / zero Doppler / magnitude relative to clean peak',14,0,-3.65)
  for(const x of [-4.8,4.8]) {
    screenLabel('CODE DELAY / chips',5,x,-2.75)
    for(const [dx,text]of [[-3.7,'-4'],[0,'0'],[3.7,'+4']] as const)screenLabel(text,.6,x+dx,-2.1)
    const lines:number[]=[]
    for(let y=0;y<=4;y++)lines.push(x-3.8,-1.7+y*.8,.02,x+3.8,-1.7+y*.8,.02)
    for(let j=0;j<5;j++)lines.push(x-3.8+j*1.9,-1.7,.02,x-3.8+j*1.9,1.5,.02)
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(lines,3));screen.add(new T.LineSegments(geo,new T.LineBasicMaterial({color:'#24424d'})))
  }
  const experiment=correlationExperiment(),frames=Array.from({length:INTERFERENCE_MODEL.maxJsrDb+1},(_,db)=>experiment.response(db===0?0:10**(db/10)))
  // Shared fixed ordinate for before/after; never normalize away interference-driven growth.
  const yMax=Math.ceil(Math.max(...frames[45]!,...experiment.clean)),data=new Float32Array(65*3)
  const traceGeo=new T.BufferGeometry();traceGeo.setAttribute('position',new T.BufferAttribute(data,3).setUsage(T.DynamicDrawUsage))
  const after=new T.Line(traceGeo,new T.LineBasicMaterial({color:AMBER}));screen.add(after)
  const cleanGeo=new T.BufferGeometry().setFromPoints(experiment.clean.map((v,i)=>new T.Vector3(-4.8+experiment.lags[i]!/4*3.8,-1.7+v/yMax*3.2,.06)))
  screen.add(new T.Line(cleanGeo,new T.LineBasicMaterial({color:BLUE})))
  for(const x of [-9,-.1]){screenLabel(String(yMax),.6,x,1.5);screenLabel('0',.6,x,-1.7)}
  const strengthLabels=[0,15,30,45].map(db=>screenLabel(db===0?'JAMMER OFF':`J/S = ${db} dB / SYNTHETIC`,8,4.8,1.95,AMBER))
  screenLabel('No tracking loop / no measured lock status',12,0,-4.4)
  receiver.position.set(0,0,-1);receiver.scale.setScalar(.88)

  const array=receiveArray(kit,ura(4,4,.5));array.scale.setScalar(3.25);array.position.set(0,.3,0);bridge.add(array)
  label(bridge,'16 ELEMENTS / SPATIAL OBSERVATIONS',10,[0,.5,6],BLUE)
  label(bridge,'NEXT / ADAPTIVE BEAMFORMING',8,[0,.4,7.5])
  function direction(a:T.Vector3,b:T.Vector3,color:string){
    const g=new T.BufferGeometry().setFromPoints([a,b]);bridge.add(new T.Line(g,new T.LineBasicMaterial({color,transparent:true,opacity:.7})))
    const ring=new T.Mesh(new T.TorusGeometry(.36,.025,8,32),new T.MeshBasicMaterial({color}));ring.position.copy(a);ring.lookAt(b);bridge.add(ring)
  }
  direction(new T.Vector3(-6,7,-5),new T.Vector3(0,.7,0),BLUE)
  direction(new T.Vector3(8,2,-2),new T.Vector3(0,.7,0),AMBER)
  field(new T.Vector3(-6,7,-5),new T.Vector3(0,.7,0),BLUE,false,bridge)
  field(new T.Vector3(8,2,-2),new T.Vector3(0,.7,0),AMBER,true,bridge)
  label(bridge,'DESIRED',3,[-6,7.8,-5],BLUE);label(bridge,'INTERFERENCE',4,[8,3,-2],AMBER)
  const note=label(root,'ILLUSTRATIVE FIELDS + SYNTHETIC DATA / NOT TO SCALE',12,[0,-3,5])
  note.renderOrder=5;note.material.depthTest=false
  let lastDb=-1, moving=false
  function update(local:number,elapsed:number){
    time.value=elapsed;attack.value=smoothstep(.02,.19,local);fieldGain.value=1+smoothstep(.1,.19,local)*.7
    const enterSpectrum=smoothstep(.22,.265,local),enterReceiver=smoothstep(.365,.4,local),enterArray=smoothstep(.485,.54,local)
    moving=(enterSpectrum>0&&enterSpectrum<1)||(enterReceiver>0&&enterReceiver<1)||(enterArray>0&&enterArray<1)
    ground.visible=enterSpectrum<1;ground.position.y=-enterSpectrum*12
    frequency.visible=enterSpectrum>0&&enterReceiver<1;frequency.scale.setScalar(.5+.22*enterSpectrum);frequency.position.y=(1-enterSpectrum)*-12-enterReceiver*14
    strength.value=120*smoothstep(.24,.365,local)
    mode.value=local<.29?0:local<.33?2:1
    modeLabels.forEach((l,i)=>{l.visible=i===mode.value})
    receiver.visible=enterReceiver>0&&enterArray<1;receiver.position.y=(1-enterReceiver)*-12-enterArray*13
    const db=local<.405?0:local<.43?15:local<.46?30:45
    strengthLabels.forEach((l,i)=>{l.visible=i===[0,15,30,45].indexOf(db)})
    if(db!==lastDb){const values=frames[db]!;for(let i=0;i<65;i++){data[i*3]=4.8+experiment.lags[i]!/4*3.8;data[i*3+1]=-1.7+values[i]!/yMax*3.2;data[i*3+2]=.07}traceGeo.attributes.position!.needsUpdate=true;traceGeo.computeBoundingSphere();lastDb=db}
    bridge.visible=enterArray>0;bridge.position.y=(1-enterArray)*-10
    return local<.12?'transmitter':local<.24?'fields':local<.38?'spectrum':local<.51?'receiver':'array'
  }
  return {root,update,get moving(){return moving}}
}
