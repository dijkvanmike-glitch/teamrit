// Uses the public site's own client. No copied signatures, credentials, cookies or HTML parsing.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
export async function readSource(){
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({locale:'nl-NL',timezoneId:'Europe/Amsterdam'});
  const page=await context.newPage();
  const observed=[];
  page.on('response',r=>{if(r.url().startsWith('https://app.hockeyweerelt.nl/')&&/\/poules\/184935\/teams\/11481(?:\?|$)/.test(r.url()))observed.push({method:r.request().method(),status:r.status(),headerNames:Object.keys(r.request().headers())})});
  const responsePromise=page.waitForResponse(r=>r.ok()&&r.request().method()==='GET'&&r.url().startsWith('https://app.hockeyweerelt.nl/')&&/\/poules\/184935\/teams\/11481(?:\?|$)/.test(r.url()),{timeout:60000}).catch(()=>{throw Error('Geen geslaagde JSON-response. Alleen status/headerNAMEN: '+JSON.stringify(observed))});
  await page.goto('https://www.knhb.nl/match-center#/team/11481|184935',{waitUntil:'domcontentloaded',timeout:45000});
  const response=await responsePromise;
  if(!response.ok())throw Error('HockeyWeerelt geeft HTTP '+response.status());
  const body=await response.json();
  const candidates=[];
  function visit(value){if(Array.isArray(value)){for(const item of value){if(item&&typeof item==='object'&&(item.home?.id===11481||item.away?.id===11481)&&item.date&&item.id)candidates.push(item);else visit(item)}}else if(value&&typeof value==='object')for(const child of Object.values(value))visit(child)}
  visit(body);
  const matches=[...new Map(candidates.map(m=>[m.id,{id:m.id,date:m.date,status:m.status,home:{id:m.home.id,name:m.home.name},away:{id:m.away.id,name:m.away.name},location:{facility:{name:m.location?.facility?.name,address:m.location?.facility?.address},field:{name:m.location?.field?.name,type:m.location?.field?.type}},remarks:{facility_official:m.remarks?.facility_official??''}}])).values()];
  if(!matches.length)throw Error('Geen valide JO14-1-wedstrijden in website-JSON. Rootvelden: '+Object.keys(body).slice(0,15).join(','));
  return {checkedAt:new Date().toISOString(),teamId:11481,pouleId:184935,matches};
 }finally{await browser.close()}
}
if(process.argv[1]?.endsWith('browser-source.mjs')){
 const data=await readSource();
 if(process.env.TEAMRIT_SOURCE_OUTPUT)await fs.writeFile(process.env.TEAMRIT_SOURCE_OUTPUT,JSON.stringify(data),{mode:0o600});
 console.log(JSON.stringify({source:'KNHB website JSON',checkedAt:data.checkedAt,count:data.matches.length,ids:data.matches.map(m=>m.id)}));
}
