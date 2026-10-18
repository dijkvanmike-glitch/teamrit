// Count volunteered driving on earlier away games, not confirmed actual journeys.
export function drivingHistory(matches, current, rows) {
  if(!current || !/^\d{4}-\d{2}-\d{2}$/.test(current.isoDate))throw Error('Wedstrijddatum ontbreekt');
  const earlier=new Map(matches.filter(m=>m.type!=='info'&&m.home===false&&m.isoDate<current.isoDate&&/^\d{4}-\d{2}-\d{2}$/.test(m.isoDate)).map(m=>[m.id,m.isoDate]));
  const totals=new Map(),seen=new Set();
  for(const row of rows){
    if(row.drive!=='Ja'||!earlier.has(row.match_id)||typeof row.family_key!=='string')continue;
    const key=row.match_id+'\0'+row.family_key;if(seen.has(key))continue;seen.add(key);
    const prev=totals.get(row.family_key)||{count:0,lastDate:''};
    totals.set(row.family_key,{count:prev.count+1,lastDate:[prev.lastDate,earlier.get(row.match_id)].sort().at(-1)});
  }
  return totals;
}
export function assignDrivers(list,match){
  const drivers=[...new Map(list.filter(p=>p.drive==='Ja').map(p=>[p.familyKey,p])).values()];
  if(Array.isArray(match?.selectedDriverKeys)){
    const keys=new Set(match.selectedDriverKeys);
    return {selected:match.selectedDriverKeys.map(k=>drivers.find(p=>p.familyKey===k)).filter(Boolean),reserves:drivers.filter(p=>!keys.has(p.familyKey)),manual:true,required:keys.size,available:drivers};
  }
  if(drivers.length<=4)return {selected:drivers,reserves:[],manual:false,required:4,available:drivers};
  if(drivers.some(p=>!Number.isInteger(p.driveHistoryCount)||p.driveHistoryCount<0))return {unavailable:true,available:drivers,selected:[],reserves:[],required:4};
  drivers.sort((a,b)=>a.driveHistoryCount-b.driveHistoryCount || (a.lastDriveSignupDate||'').localeCompare(b.lastDriveSignupDate||'') || a.familyKey.localeCompare(b.familyKey,'nl'));
  return {selected:drivers.slice(0,4),reserves:drivers.slice(4),manual:false,required:4,available:drivers};
}
export function transportHtml(list,match){
  const a=assignDrivers(list,match);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names=rows=>rows.map(p=>esc(p.name)).join(' · ');
  if(a.unavailable)return '<div class="dashLine">🟠 '+a.available.length+' auto\'s aangemeld · indeling nog niet beschikbaar</div><div class="dashSub">Eerdere rij-opgaven konden niet worden opgehaald. Vernieuw om opnieuw te proberen.</div><div class="dashSub">Aangemeld: '+names(a.available)+'</div>';
  let html=a.selected.length>=a.required?'<div class="dashLine">🟢 Vervoer geregeld · '+a.selected.length+' auto\'s ingedeeld</div>':'<div class="dashLine">🟠 Vervoer · '+a.selected.length+' van '+a.required+' auto\'s</div>';
  html+=a.selected.length?'<div class="dashSub">Rijden: '+names(a.selected)+'</div>':'<div class="dashSub">Nog geen chauffeurs '+(a.manual?'ingedeeld':'aangemeld')+'</div>';
  if(a.reserves.length)html+='<div class="dashSub"><strong>Reserve:</strong> '+names(a.reserves)+'</div>';
  if(a.manual)html+='<div class="dashSub">Bestaande handmatige rij-indeling.</div>';
  else if(a.reserves.length)html+='<div class="dashSub">Gezinnen met minder eerdere rij-opgaven krijgen voorrang. Dit zijn opgaven, geen bevestigde gereden ritten. Voorlopige indeling: kan wijzigen bij nieuwe aanmeldingen.</div>';
  return html;
}
