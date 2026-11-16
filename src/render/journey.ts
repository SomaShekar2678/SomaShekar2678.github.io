/** Development-only poster/diagnostics entry. Not referenced by the production application. */
import { JourneyScene } from '../components/three/JourneyScene'
const canvas=document.querySelector<HTMLCanvasElement>('#journey-studio')!
const scene=new JourneyScene({canvas,tier:'high'})
const studio={
  async captureAt(progress:number) { return {image:await scene.captureStill(progress,3),diagnostics:scene.getDiagnostics()} },
  async capture(stage:number) {
    const url=await scene.captureStill((stage+(stage===1?.19:.3))/6,3)
    const image=new Image();image.src=url;await image.decode()
    const output=document.createElement('canvas');output.width=960;output.height=640
    output.getContext('2d')!.drawImage(image,400,100,1040,1040*2/3,0,0,960,640)
    return { image:output.toDataURL('image/webp',.84), diagnostics:scene.getDiagnostics() }
  },
  dispose(){scene.dispose();return scene.getDiagnostics()},
}
Object.assign(window,{journeyStudio:studio})
document.body.dataset.ready='true'
