// Local club times are always interpreted in Europe/Amsterdam, including DST.
export function clubInstant(date,time){
 const target=Date.parse(`${date}T${time}:00Z`);let instant=target;
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
 for(let i=0;i<3;i++)instant+=target-Date.parse(fmt.format(new Date(instant)).replace(' ','T')+'Z');
 return instant;
}
export function activityVisible(m,now=Date.now()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(m?.isoDate||''))return true;
 // No known time: keep through the activity day plus four hours.
 const end=m.endTime?clubInstant(m.isoDate,m.endTime):m.time?clubInstant(m.isoDate,m.time)+90*60000:clubInstant(m.isoDate,'23:59');
 return !Number.isFinite(end)||now<end+4*3600000;
}
