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
if(environment==='hockey')for(const file of ['og-preview.jpg','og-preview-v2.jpg'])await cp(path.join(root,file),path.join(out,file));
for(const file of ['index.html','admin.html','admin.mjs','lib/matches.mjs']){
 let text=await readFile(path.join(out,file),'utf8');
 text=text.replaceAll('Vanaf WFHC, Roskam 6 in Zwaag.',config.gatheringDescription)
  .replaceAll('WFHC JO14-1',config.teamName).replaceAll('JO14-1',config.teamName)
  .replaceAll(".includes('WFHC')",'.includes('+JSON.stringify(config.teamName.toUpperCase())+')')
  .replaceAll('WFHC',config.clubName).replaceAll('/wfhc-logo.png','/'+config.logo);
 if(environment==='zaalvoetbal'){
  if(file==='index.html')text=text.replace('</style>','.top{flex-wrap:wrap;gap:12px}.logo{width:140px;height:58px;background:#fff;padding:4px}</style>');
  text=text.replaceAll('🏑','⚽').replaceAll('Voor Thijs (coach)','Voor de coach').replaceAll('Ben jij er, Thijs?','Ben jij er als coach?').replaceAll('Thijs','Coach').replaceAll('PILOT 1 VAN 3','PILOT').replaceAll('de afgesproken locatie logo','HV Hoorn logo');
  text=text.replace(/^<meta[^>]+(?:og:image|og:url|twitter:image)[^>]*>\n/gm,'');
  if(file==='index.html'){
   const site='https://teamrit-zaalvoetbal.netlify.app/';
   text=text.replace('</head>',`<meta property="og:url" content="${site}">
<meta property="og:site_name" content="TeamRit">
<meta property="og:locale" content="nl_NL">
<meta property="og:image" content="${site}${config.logo}?v=1">
<meta property="og:image:secure_url" content="${site}${config.logo}?v=1">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="693">
<meta property="og:image:height" content="175">
<meta property="og:image:alt" content="HV Hoorn · Hovocubo-Veerhuys clublogo">
<meta name="twitter:image" content="${site}${config.logo}?v=1">
</head>`);
  }
 }
 await writeFile(path.join(out,file),text);
}
await writeFile(path.join(out,'lib/team-config.mjs'),'export default '+JSON.stringify(config)+';\n');
await writeFile(path.join(out,'team-config.js'),'const trEnvironment = '+JSON.stringify({environment,fruitEnabled:config.fruitEnabled})+';\n');
if(environment==='zaalvoetbal')await writeFile(path.join(out,'matches-seed.json'),'[]\n');
// Publish only browser assets; server functions stay outside the public directory.
await mkdir(path.join(out,'public'));
for(const file of ['index.html','admin.html','admin.css','admin.mjs','_headers','lib','matches-seed.json','team-config.js',config.logo,...(environment==='hockey'?['og-preview.jpg','og-preview-v2.jpg']:[])])await cp(path.join(out,file),path.join(out,'public',file),{recursive:true});
console.log('Gebouwd: '+environment+' → dist (geen publicatie uitgevoerd)');
