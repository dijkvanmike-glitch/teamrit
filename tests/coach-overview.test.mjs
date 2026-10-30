import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=page.slice(page.indexOf('function badge(v)'),page.indexOf('async function init()'));
function setup(match){
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{toggle(c,v){this[c]=v},add(c){this[c]=true}}});return elements.get(id)};
 const ctx={trActiveMatch:match,trEnvironment:{environment:'zaalvoetbal',fruitEnabled:false},document:{getElementById:element,querySelector:element},playerAnswers:p=>p.children.map(child=>({child,present:p.childPresence?.[child]??p.present})),trTransportHtml:()=>'',go:id=>ctx.screen=id,fetch:async()=>({json:async()=>[{name:'Ouder A',children:['Speler A'],present:'Ja'},{name:'Ouder B',children:['Speler B'],present:null},{name:'Ouder C',children:['Speler C'],present:'Nee'}]})};
 runInNewContext(code,ctx);return {ctx,element};
}
test('futsal coach shows attendance and unanswered families with fruit disabled',async()=>{
 const {ctx,element}=setup({id:'m1',type:'training',home:true,date:'Zondag'});
 await ctx.coach();
 assert.equal(element('stats').classList.hidden,false);
 assert.equal(element('rowsCard').classList.hidden,false);
 assert.equal(element('coachCard').classList.hidden,true);
 assert.match(element('rows').innerHTML,/Speler A/);
 assert.match(element('rows').innerHTML,/Speler B.*Nog niet/);
 assert.match(element('rows').innerHTML,/Speler C.*Nee/);
 assert.equal(element('r').textContent,2);
 assert.equal(element('a').textContent,1);
});
test('direct coach link without selected activity opens activity picker',async()=>{
 const {ctx}=setup(null);await ctx.coach();assert.equal(ctx.screen,'coachpicker');
});
