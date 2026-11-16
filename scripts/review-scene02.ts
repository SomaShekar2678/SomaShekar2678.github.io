/** Repeatable visual review. One software-rendered Chrome instance; no parallel GPU workers. */
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from '@playwright/test'
const root=resolve(import.meta.dirname,'..'),folder=resolve(root,'docs/review/scene02')
mkdirSync(folder,{recursive:true})
const server=await createServer({root,server:{host:'127.0.0.1',port:5199,strictPort:true},logLevel:'error'})
await server.listen()
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
type Studio=Window&{journeyStudio:{captureAt:(p:number)=>Promise<{image:string;diagnostics:unknown}>;dispose:()=>unknown}}
const phases=[['A',.06],['B',.19],['C',.31],['D',.47],['E',.56]] as const
const errors:string[]=[],diagnostics:Record<string,unknown>={}
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`)})
  await page.goto('http://127.0.0.1:5199/scripts/journey.html')
  await page.waitForSelector('body[data-ready=true]')
  for(const [name,progress]of [...phases.map(([n,p])=>[n,(1+p)/6] as const),['into',.88/6],['out',1.72/6]] as const){
    const shot=await page.evaluate(p=>(window as unknown as Studio).journeyStudio.captureAt(p),progress)
    writeFileSync(resolve(folder,`${name}.webp`),Buffer.from(shot.image.split(',')[1]!,'base64'));diagnostics[name]=shot.diagnostics
  }
  diagnostics.disposal=await page.evaluate(()=>(window as unknown as Studio).journeyStudio.dispose())
  await page.goto('http://127.0.0.1:5199/');await page.waitForFunction(()=>document.documentElement.dataset.loading==='false')
  const section=page.locator('#journey')
  for(const [name,local]of phases){
    const y=await section.evaluate((el,p)=>el.getBoundingClientRect().top+scrollY+((el as HTMLElement).offsetHeight-innerHeight)*p,(1+local)/6)
    await page.evaluate(target=>scrollTo({top:target,behavior:'instant'}),y);await page.waitForFunction(target=>Math.abs(scrollY-target)<2,y);await page.waitForTimeout(2200)
    await page.screenshot({path:resolve(folder,`desktop-${name}.jpg`),type:'jpeg',quality:88})
  }
  await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(400)
  const laptopY=await section.evaluate(el=>el.getBoundingClientRect().top+scrollY+((el as HTMLElement).offsetHeight-innerHeight)*1.31/6)
  await page.evaluate(target=>scrollTo({top:target,behavior:'instant'}),laptopY);await page.waitForFunction(target=>Math.abs(scrollY-target)<2,laptopY);await page.waitForTimeout(2200)
  await page.screenshot({path:resolve(folder,'laptop.jpg'),type:'jpeg',quality:88});await page.close()
  for(const [name,width,height]of [['mobile',390,844],['tablet',820,1180],['landscape',844,390]] as const){
    const p=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1})
    p.on('pageerror',e=>errors.push(e.message))
    await p.goto('http://127.0.0.1:5199/',{waitUntil:'networkidle'})
    await p.waitForFunction(()=>document.documentElement.dataset.loading==='false')
    await p.waitForTimeout(400)
    await p.locator('#journey-title').evaluate(el=>scrollTo({top:el.getBoundingClientRect().top+scrollY-100,behavior:'instant'}))
    const list=p.locator('#journey ol[role="list"]')
    await list.evaluate(el=>{const child=el.children[1] as HTMLElement;el.scrollTo({left:child.offsetLeft-el.getBoundingClientRect().left,behavior:'instant'})})
    if(name==='landscape')await list.locator(':scope > li').nth(1).evaluate(el=>scrollTo({top:el.getBoundingClientRect().top+scrollY-85,behavior:'instant'}))
    await p.waitForTimeout(700);await p.screenshot({path:resolve(folder,`${name}.jpg`),type:'jpeg',quality:88})
    diagnostics[name]={horizontalOverflow:await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)}
    await p.close()
  }
  writeFileSync(resolve(folder,'diagnostics.json'),JSON.stringify({errors,...diagnostics},null,2))
  console.log(JSON.stringify({errors,...diagnostics},null,2))
  if(errors.length)throw new Error('Browser errors recorded')
}finally{await browser.close();await server.close()}
