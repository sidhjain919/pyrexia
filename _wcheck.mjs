import { chromium } from 'playwright'
const B='https://pyrexiaaiims.com'
const br=await chromium.launch(); const c=await br.newContext({viewport:{width:1440,height:2200}})
const p=await c.newPage()
const BAD=/main stage|all five evenings|every evening|biggest names light up|evenings on the main stage|attending star nights/i
// home (CTA + footer)
await p.goto(B+'/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000)
let home=await p.evaluate(()=>document.body.innerText)
console.log('HOME bad phrasing:', BAD.test(home))
console.log('HOME has "pro nights included":', /pro nights included/i.test(home))
// legal
await p.goto(B+'/terms',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000)
let legal=await p.evaluate(()=>document.body.innerText)
console.log('LEGAL bad phrasing:', BAD.test(legal))
console.log('LEGAL festival-pass line:', (legal.match(/The Festival Pass[^.]*\.[^.]*\./)||['(not found)'])[0].slice(0,200))
// register modal tier text
await p.goto(B+'/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500)
await p.getByRole('button',{name:/Register Now/i}).first().click().catch(()=>{})
await p.waitForTimeout(1500)
// advance to payment step if possible is complex; just scan modal text
const modal=await p.evaluate(()=>document.body.innerText)
console.log('MODAL open bad phrasing:', BAD.test(modal))
await br.close()
