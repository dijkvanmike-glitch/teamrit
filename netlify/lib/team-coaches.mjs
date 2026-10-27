export async function teamCoaches(req,base,headers,names,fetcher=fetch){
 const json=(v,status=200)=>Response.json(v,{status,headers:{'cache-control':'no-store'}});
 if(req.method==='GET'){
  const match=new URL(req.url).searchParams.get('match');
  if(!match)return json({present:null,substitute:null,coaches:Object.fromEntries(names.map(n=>[n,null]))});
  const ids=names.map(n=>match+':coach:'+n);
  const res=await fetcher(`${base}/rest/v1/coach_status?match_id=in.(${ids.map(encodeURIComponent).join(',')})&select=match_id,present`,{headers});
  if(!res.ok)return json({error:'Kon coachstatus niet ophalen'},502);
  const rows=await res.json();const coaches=Object.fromEntries(names.map((n,i)=>[n,rows.find(r=>r.match_id===ids[i])?.present??null]));
  return json({coaches,present:Object.values(coaches).includes('Ja')?'Ja':Object.values(coaches).every(v=>v==='Nee')?'Nee':null,substitute:null});
 }
 if(req.method==='POST'){
  let body;try{body=await req.json();}catch{return json({error:'Ongeldige aanvraag'},400);}
  if(typeof body.matchId!=='string'||!body.matchId||body.matchId.length>100||!names.includes(body.coachName)||!['Ja','Nee'].includes(body.present))return json({error:'Kies een coach en aanwezigheid.'},400);
  const res=await fetcher(`${base}/rest/v1/coach_status`,{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{match_id:body.matchId+':coach:'+body.coachName,present:body.present,substitute_name:null,updated_at:new Date().toISOString()}])});
  return res.ok?json({ok:true}):json({error:'Coachstatus opslaan mislukt'},502);
 }
 return json({error:'Methode niet toegestaan'},405);
}
