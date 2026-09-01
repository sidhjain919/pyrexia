import { chromium } from 'playwright'
const br=await chromium.launch(); const c=await br.newContext({viewport:{width:1440,height:3000}})
const p=await c.newPage()
await p.goto('https://pyrexiaaiims.com/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4500)
// scroll through to load lazy sections
const h=await p.evaluate(()=>document.body.scrollHeight)
for(let y=0;y<h;y+=800){await p.evaluate(yy=>scrollTo(0,yy),y);await p.waitForTimeout(150)}
const txt=await p.evaluate(()=>document.body.innerText)
for(const pat of ['main stage','all five evenings','every evening','biggest names','evenings on the main','headline']){
  const re=new RegExp(pat,'i'); const m=txt.match(new RegExp('.{0,40}'+pat+'.{0,40}','i'))
  console.log(pat+':', re.test(txt)?('MATCH -> "'+(m?m[0]:'')+'"'):'no')
}
await br.close()
