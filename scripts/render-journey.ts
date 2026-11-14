/** Render mobile/reduced-motion posters from the real six-world renderer, one browser, no extra assets. */
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from '@playwright/test'
const root=resolve(import.meta.dirname,'..')
const server=await createServer({root,server:{host:'127.0.0.1',port:5198,strictPort:true},logLevel:'error'})
await server.listen()
const browser=await chromium.launch({channel:process.env.PW_CHANNEL??'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
type Studio=Window&{journeyStudio:{capture:(stage:number)=>Promise<{image:string;diagnostics:unknown}>;dispose:()=>unknown}}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
 page.on('pageerror',e=>{throw e})
 await page.goto('http://127.0.0.1:5198/scripts/journey.html')
 await page.waitForSelector('body[data-ready="true"]',{state:'attached'})
 const folder=resolve(root,'public/media/journey');mkdirSync(folder,{recursive:true})
 for(const [i,name] of ['space','interference','array','fpga','perception','fix'].entries()){
   const result=await page.evaluate(i=>(window as unknown as Studio).journeyStudio.capture(i),i)
   const buffer=Buffer.from(result.image.split(',')[1]!,'base64');writeFileSync(resolve(folder,`${name}.webp`),buffer)
   console.log(name,buffer.length,result.diagnostics)
 }
 console.log('After disposal:',await page.evaluate(()=>(window as unknown as Studio).journeyStudio.dispose()))
}finally{await browser.close();await server.close()}
