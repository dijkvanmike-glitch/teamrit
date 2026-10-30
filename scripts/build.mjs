import { cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const environment=process.env.TEAMRIT_ENVIRONMENT;
if(!['hockey','zaalvoetbal'].includes(environment))throw Error('Stel TEAMRIT_ENVIRONMENT expliciet in op hockey of zaalvoetbal.');
const config=JSON.parse(await readFile(path.join(root,'environments',environment+'.json'),'utf8'));
// Identity values are inserted in HTML and existing JS strings. Keep them plain text.
for(const value of [config.teamName,config.clubName,config.gatheringDescription])if(typeof value!=='string'||/[<>"'&\\\r\n]/.test(value))throw Error('Gebruik gewone tekst zonder HTML of aanhalingstekens in de teaminstellingen.');
if(!/^[a-z0-9-]+\.(png|svg|jpg|webp)$/.test(config.logo))throw Error('Ongeldige logobestandsnaam.');
if(config.routeOrigin!==null&&!/^[-\d.]+,[-\d.]+$/.test(config.routeOrigin))throw Error('Ongeldig vertrekpunt.');
const out=path.join(root,'dist');
await rm(out,{recursive:true,force:true});await mkdir(out);
for(const file of ['index.html','admin.html','admin.css','admin.mjs','_headers','lib','netlify','matches-seed.json',config.logo])await cp(path.join(root,file),path.join(out,file),{recursive:true});
if(environment==='zaalvoetbal')for(const file of ['veerhuys-theme.css','og-preview-veerhuys-v2.jpg'])await cp(path.join(root,file),path.join(out,file));
if(environment==='hockey')for(const file of ['og-preview.jpg','og-preview-v2.jpg'])await cp(path.join(root,file),path.join(out,file));
for(const file of ['index.html','admin.html','admin.mjs','lib/matches.mjs']){
 let text=await readFile(path.join(out,file),'utf8');
 text=text.replaceAll('Vanaf WFHC, Roskam 6 in Zwaag.',config.gatheringDescription)
  .replaceAll('WFHC JO14-1',config.teamName).replaceAll('JO14-1',config.teamName)
  .replaceAll(".includes('WFHC')",'.includes('+JSON.stringify(config.teamName.toUpperCase())+')')
  .replaceAll('WFHC',config.clubName).replaceAll('/wfhc-logo.png','/'+config.logo);
 if(environment==='zaalvoetbal'){
  if(file==='index.html'){
   text=text.replace('</head>','<link rel="stylesheet" href="/veerhuys-theme.css"></head>')
    .replace('Mijn wedstrijden','Samen het veld in').replace('<h2 style="font-size:28px;margin:12px 0 4px">'+config.teamName+'</h2>','<h2 style="font-size:28px;margin:12px 0 4px">Trainingen en wedstrijden</h2>')
    .replace('Kies een wedstrijd om te organiseren.','Geef eenvoudig door wie erbij is.')
    .replace('<h2 style="font-size:28px;margin:12px 0 4px">Coachstatus beheren</h2>','<h2 style="font-size:28px;margin:12px 0 4px">Coach- en teamoverzicht</h2>')
    .replace('Kies een wedstrijd. Dit is coachbeheer, geen ouderreactie.','Kies een training of wedstrijd om het teamoverzicht te bekijken.')
    .replace("box.innerHTML=actief.map(m=>trCardShell(m)).join('');","box.innerHTML=actief.map((m,i)=>(i===0?'<div class=\"nextMatchLabel\">Eerstvolgende '+(m.type==='training'?'training':'wedstrijd')+'</div>':'')+trCardShell(m)).join('');");
   text=text.replace('function trTimingHtml(m){',`function trTimingDisplay(html){
return '<div class="timingTimeline">'+html.replace(/<div class="dashLine">([^<]*)<\\/div>/g,(_,text)=>{
const clean=text.replace(/^[^\\p{L}\\p{N}]+/u,'');const split=clean.lastIndexOf(' · ');
return '<div class="timingRow"><span class="timingLabel">'+(split<0?clean:clean.slice(0,split))+'</span> '+(split<0?'':'<strong class="timingValue">'+clean.slice(split+3)+'</strong>')+'</div>';
})+'</div>';
}
function trTimingHtml(m){`)
    .replace('html+=trTimingHtml(m);','html+=trTimingDisplay(trTimingHtml(m));')
    .replace("'+trTimingHtml(m)+'","'+trTimingDisplay(trTimingHtml(m))+'")
    .replace("part!==m.time&&", "part!==m.time&&part!==m.time+'–'+m.endTime&&")
    .replace("<div class=\"matchMeta\">'+m.meta+'</div>'+trMapsHtml(m)","<div class=\"matchMeta\">'+trCardMeta(m)+'</div><div class=\"dashBlock\">'+trTimingDisplay(trTimingHtml(m))+'</div>'+trMapsHtml(m)");
   const a=text.indexOf('let body;',text.indexOf('function trMatchContextHtml'));
   const b=text.indexOf('\nfunction trSameChildSet',a);
   if(a<0||b<a)throw Error('Wedstrijdcontext niet gevonden; publicatie gestopt.');
   text=text.slice(0,a)+`return '<div class="card">'+head+'<div class="matchMeta">'+trCardMeta(m)+'</div><div class="dashBlock">'+trTimingDisplay(trTimingHtml(m))+'</div>'+trMapsHtml(m)+'</div>';`+'\n}'+text.slice(b);
  }
  if(file==='admin.html')text=text.replace('</head>','<link rel="stylesheet" href="/veerhuys-theme.css"></head>').replace('Bijvoorbeeld Alkmaar JO14-2','Bijvoorbeeld tegenstander JO11-2').replace('Thuis: één uur voor de wedstrijd. Uit: wedstrijdtijd min 45 minuten en de autorijtijd, naar beneden afgerond op vijf minuten. Handmatig instellen gaat voor.','Gebruik de afgesproken verzameltijd. Handmatige afspraken gaan voor; controleer automatisch berekende tijden altijd voor jouw zaalvoetbalteam.').replace('<header>','<header><img class="adminBrand" src="/'+config.logo+'" alt="Hovocubo-Veerhuys logo">');
  text=text.replaceAll('🏑','⚽').replaceAll('Voor Thijs (coach)','Voor de coach').replaceAll('Ben jij er, Thijs?','Ben jij er als coach?').replaceAll('Thijs','Coach').replaceAll('PILOT 1 VAN 3','PILOT').replaceAll('de afgesproken locatie logo','HV Hoorn logo');
  text=text.replace(/^<meta[^>]+(?:og:image|og:url|twitter:image)[^>]*>\n/gm,'');
  if(file==='index.html'){
   const site='https://teamrit-zaalvoetbal.netlify.app/';
   text=text.replace('</head>',`<meta property="og:url" content="${site}">
<meta property="og:site_name" content="TeamRit">
<meta property="og:locale" content="nl_NL">
<meta property="og:image" content="${site}og-preview-veerhuys-v2.jpg">
<meta property="og:image:secure_url" content="${site}og-preview-veerhuys-v2.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="HV Hoorn · Hovocubo-Veerhuys clublogo">
<meta name="twitter:image" content="${site}og-preview-veerhuys-v2.jpg">
</head>`);
  }
 }
 await writeFile(path.join(out,file),text);
}
await writeFile(path.join(out,'lib/team-config.mjs'),'export default '+JSON.stringify(config)+';\n');
await writeFile(path.join(out,'team-config.js'),'const trEnvironment = '+JSON.stringify({environment,fruitEnabled:config.fruitEnabled,coaches:config.coaches||[]})+';\n');
if(environment==='zaalvoetbal')await writeFile(path.join(out,'matches-seed.json'),'[]\n');
// Publish only browser assets; server functions stay outside the public directory.
await mkdir(path.join(out,'public'));
for(const file of ['index.html','admin.html','admin.css','admin.mjs','_headers','lib','matches-seed.json','team-config.js',config.logo,...(environment==='hockey'?['og-preview.jpg','og-preview-v2.jpg']:['veerhuys-theme.css','og-preview-veerhuys-v2.jpg'])])await cp(path.join(out,file),path.join(out,'public',file),{recursive:true});
console.log('Gebouwd: '+environment+' → dist (geen publicatie uitgevoerd)');
