import * as T from 'three'

/** Shared local 2K maps. Source/CC BY 4.0 attribution: public/textures/journey/ATTRIBUTION.md. */
export class EarthAssets {
  readonly day: T.Texture
  readonly night: T.Texture
  readonly clouds: T.Texture
  readonly ready: Promise<void>
  private disposed = false
  constructor(anisotropy: number) {
    const pending: Promise<void>[]=[]
    const load=(name:string,color:boolean)=>{
      let resolve!:()=>void, reject!:(e:unknown)=>void
      pending.push(new Promise<void>((yes,no)=>{resolve=yes;reject=no}))
      const texture=new T.TextureLoader().load(`${import.meta.env.BASE_URL}textures/journey/earth-${name}.webp`,t=>{
        if(this.disposed)t.dispose()
        resolve()
      },undefined,reject)
      texture.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace
      texture.anisotropy=Math.min(4,anisotropy)
      return texture
    }
    this.day=load('day',true);this.night=load('night',true);this.clouds=load('clouds',false)
    this.ready=Promise.all(pending).then(()=>undefined)
  }
  dispose(){ this.disposed=true;this.day.dispose();this.night.dispose();this.clouds.dispose() }
}

const vert=`varying vec2 vUv; varying vec3 vN; varying vec3 vWorld;
void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`
export const SUN = new T.Vector3(-.45,.65,.8).normalize()

/** Textured surface + separate cloud deck + optically thin limb. Artistic sunlit-limb approximation; not a radiative-transfer solver. */
export function earthModel(radius:number,assets:EarthAssets,segments=96) {
  const group=new T.Group()
  const geo=new T.SphereGeometry(radius,segments,Math.round(segments*.66))
  const surface=new T.ShaderMaterial({
    uniforms:{uDay:{value:assets.day},uNight:{value:assets.night},uClouds:{value:assets.clouds},uSun:{value:SUN}},
    vertexShader:vert,
    fragmentShader:`uniform sampler2D uDay,uNight,uClouds;uniform vec3 uSun;
    varying vec2 vUv;varying vec3 vN;varying vec3 vWorld;
    void main(){
      vec3 n=normalize(vN),v=normalize(cameraPosition-vWorld);
      float ndl=dot(n,uSun);
      vec3 land=texture2D(uDay,vUv).rgb;
      land=mix(vec3(dot(land,vec3(.2126,.7152,.0722))),land,.86);
      // Ocean mask inferred from the blue-dominant albedo; not a bathymetry dataset.
      float water=smoothstep(.015,.09,land.b-max(land.r,land.g));
      float light=smoothstep(-.08,.25,ndl);
      float clouds=texture2D(uClouds,vUv+vec2(.002,.001)).r;
      vec3 day=land*(.018+max(ndl,0.)*1.3)*(1.-clouds*.25);
      vec3 h=normalize(v+uSun);
      float spec=pow(max(dot(n,h),0.),90.)*water*light*.3;
      vec3 city=texture2D(uNight,vUv).rgb*.6*(1.-smoothstep(-.12,.12,ndl));
      float rim=pow(1.-max(dot(n,v),0.),4.5)*light;
      vec3 col=day+spec+city+vec3(.05,.16,.32)*rim*.32;
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  })
  const planet=new T.Mesh(geo,surface)
  // Align longitude to x=cos(lat)*sin(lon), z=cos(lat)*cos(lon), also used by the fixed marker.
  planet.rotation.y=-Math.PI/2
  group.add(planet)
  const clouds=new T.Mesh(new T.SphereGeometry(radius*1.004,segments,48),new T.ShaderMaterial({
    uniforms:{uClouds:{value:assets.clouds},uSun:{value:SUN}},vertexShader:vert,
    transparent:true,depthWrite:false,
    fragmentShader:`uniform sampler2D uClouds;uniform vec3 uSun;varying vec2 vUv;varying vec3 vN;varying vec3 vWorld;
    void main(){float cloud=texture2D(uClouds,vUv).r;float light=max(dot(normalize(vN),uSun),0.);
      gl_FragColor=vec4(vec3(.92,.95,1.)*(.025+light*1.45),smoothstep(.13,.82,cloud)*.92);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }))
  clouds.rotation.y=-Math.PI/2;group.add(clouds)
  const atmosphere=new T.Mesh(new T.SphereGeometry(radius*1.015,segments,48),new T.ShaderMaterial({
    uniforms:{uSun:{value:SUN}},vertexShader:vert,transparent:true,depthWrite:false,side:T.BackSide,blending:T.AdditiveBlending,
    fragmentShader:`uniform vec3 uSun;varying vec3 vN;varying vec3 vWorld;
    void main(){vec3 n=normalize(vN),v=normalize(cameraPosition-vWorld);
      float limb=pow(max(0.,1.-abs(dot(n,v))),7.);
      float light=smoothstep(-.2,.6,dot(n,uSun));
      gl_FragColor=vec4(vec3(.12,.34,.63),limb*light*.28);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }))
  group.add(atmosphere)
  return group
}
