import * as T from 'three'
import { seeded } from './models'

interface Box { min: [number,number,number]; max:[number,number,number]; kind:'building'|'curb'|'pole' }
/** Deterministic ray samples from a synthetic spinning multi-beam LiDAR, accumulated at seven poses.
 * Nearest AABB/ground hit only: real occlusion and scan geometry, not a captured dataset. */
export function streetCloud(quality:number) {
  const boxes:Box[]=[]
  const box=(x:number,z:number,w:number,d:number,h:number,kind:Box['kind']='building')=>boxes.push({min:[x-w/2,0,z-d/2],max:[x+w/2,h,z+d/2],kind})
  for(const [x,z,w,d,h] of [[-9,-6,4,3.5,5],[-9.5,3,3.5,4,3.6],[8.5,-5,4.5,3,6.5],[9,4,3.5,4.5,4.2],[-2.5,-8.5,6,2.5,3],[3,8.5,5,2.5,3.8]])box(x!,z!,w!,d!,h!)
  for(const z of [-3.7,3.7]) {
    box(0,z,29,.16,.18,'curb')
    for(const x of [-12,-5,2,11])box(x,z,.14,.14,3.5,'pole')
  }
  const positions:number[]=[],colors:number[]=[]
  const random=seeded(992),rays=Math.round(520+quality*280),channels=Math.round(32+quality*24)
  const poses=[-12,-8,-4,0,4,8,12]
  const o=[0,1.4,0],d=[0,0,0]
  for(const px of poses) {
    o[0]=px;o[2]=Math.sin(px*.22)*.65
    for(let channel=0;channel<channels;channel++) {
      const el=(-27+channel/(channels-1)*46)*Math.PI/180
      for(let az=0;az<rays;az++) {
        const angle=(az/rays)*Math.PI*2
        d[0]=Math.cos(el)*Math.cos(angle);d[1]=Math.sin(el);d[2]=Math.cos(el)*Math.sin(angle)
        let distance=d[1]!<-.001?-o[1]!/d[1]!:Infinity
        let normal=1,kind='ground'
        for(const b of boxes) {
          let near=0,far=60,axis=0
          for(let a=0;a<3;a++) {
            if(Math.abs(d[a]!)<1e-7){if(o[a]!<b.min[a]!||o[a]!>b.max[a]!)far=-1;continue}
            const t1=(b.min[a]!-o[a]!)/d[a]!,t2=(b.max[a]!-o[a]!)/d[a]!
            const start=Math.min(t1,t2)
            if(start>near){near=start;axis=a}
            far=Math.min(far,Math.max(t1,t2))
          }
          if(near<far&&near>.25&&near<distance){distance=near;normal=axis;kind=b.kind}
        }
        if(distance>32||distance<.5||random()<.065)continue
        const x=o[0]!+d[0]!*distance,y=o[1]!+d[1]!*distance,z=o[2]!+d[2]!*distance
        if(Math.abs(x)>15||Math.abs(z)>11)continue
        const incidence=Math.abs(d[normal]!)
        const intensity=(.35+.65*incidence)/(.8+distance*.035)
        let value=Math.min(.92,.25+intensity*.52)
        if(kind==='ground'){
          value*=.6
          // Road edge and dashed centre paint have higher return intensity.
          if(Math.abs(Math.abs(z)-3.3)<.07||(Math.abs(z)<.065&&((x+20)%3)<1.5))value=.85
        }
        if(kind==='building'){
          const window=y>1&&(y%1.45)>.3&&((normal===0?z:x)+30)%1.6>.4
          if(window)value*=.58
        }
        const jitter=(random()-.5)*(.012+distance*.001)
        positions.push(x+d[0]!*jitter,y+d[1]!*jitter,z+d[2]!*jitter)
        colors.push(value*.30,value*.42,value*.55)
      }
    }
  }
  const geometry=new T.BufferGeometry()
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3))
  const material=new T.ShaderMaterial({vertexColors:true,transparent:false,depthWrite:true,
    uniforms:{uPixelRatio:{value:Math.min(devicePixelRatio,1.6)}},
    vertexShader:`uniform float uPixelRatio;varying vec3 vColor;varying float vDepth;
    void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vDepth=-mv.z;vColor=color;
      gl_PointSize=clamp(30./(-mv.z),1.,1.8)*uPixelRatio;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec3 vColor;varying float vDepth;
    void main(){vec2 p=gl_PointCoord-.5;if(dot(p,p)>.25)discard;
      gl_FragColor=vec4(vColor*mix(1.,.55,smoothstep(12.,40.,vDepth)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  })
  const points=new T.Points(geometry,material)
  points.name='Synthetic multi-pose LiDAR scan'
  return points
}
