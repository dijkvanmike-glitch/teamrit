import {Script} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
test('both deployments preserve hockey and exclude hockey data and fruit in futsal',async()=>{
 for(const environment of ['zaalvoetbal','hockey']){
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,env:{...process.env,TEAMRIT_ENVIRONMENT:environment}});
  const out=path.join(root,'dist');
  const config=(await import(pathToFileURL(path.join(out,'lib/team-config.mjs'))+'?'+environment)).default;
  const seed=JSON.parse(await readFile(path.join(out,'matches-seed.json'),'utf8'));
  const page=await readFile(path.join(out,'index.html'),'utf8');
  for(const block of page.matchAll(/<script>([\s\S]*?)<\/script>/g))new Script(block[1]);
  assert.doesNotMatch(await readFile(path.join(out,'public/index.html'),'utf8'),/undefined/);
  const api=(await import(pathToFileURL(path.join(out,'netlify/functions/fruit.mts'))+'?'+environment)).default;
  if(environment==='zaalvoetbal'){
   assert.equal(config.fruitEnabled,false);assert.deepEqual(seed,[]);
   assert.doesNotMatch(page,/WFHC|JO14-1|wfhc-teamrit|wfhc-logo|Thijs/);
   assert.ok(page.includes('/'+config.logo));
   assert.ok(page.includes('property="og:image" content="https://teamrit-zaalvoetbal.netlify.app/'+config.logo));
   // Config is cached by module URL; this futsal import runs first in a fresh test process.
   const alerts=await import(pathToFileURL(path.join(out,'lib/admin-alerts.mjs')));
   assert.deepEqual(alerts.outstanding({home:true},[{familyKey:'1',present:'Ja'}],null),[]);
   assert.equal((await api(new Request('https://test/api/fruit',{method:'POST'}),{})).status,404);
   const {drivingEstimate}=await import(pathToFileURL(path.join(out,'netlify/lib/route.mjs')));
   await assert.rejects(()=>drivingEstimate('Test 1',()=>{throw Error('must not call');}),/vertrekpunt/);
  }else{
   assert.equal(config.fruitEnabled,true);assert.ok(seed.length>0);
   assert.match(page,/WFHC JO14-1/);
  }
 }
});
test('build requires explicit environment',()=>{
 assert.throws(()=>execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,env:{...process.env,TEAMRIT_ENVIRONMENT:''},stdio:'pipe'}));
});
