import teamConfig from './team-config.mjs';
// Calendar times are always Dutch club times, including daylight-saving changes.
function amsterdamTime(date, time) {
  const target = Date.parse(`${date}T${time}:00Z`);
  let instant = target;
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone:'Europe/Amsterdam', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });
  for (let i=0;i<3;i++) {
    const local = formatter.format(new Date(instant)).replace(' ', 'T');
    instant += target-Date.parse(local+'Z');
  }
  return instant;
}
export function within48Hours(match, now=Date.now()) {
  if(match.type==='info')return false;
  const end=now+48*60*60*1000;
  if(match.time){const start=amsterdamTime(match.isoDate,match.time);return start>=now&&start<=end;}
  return amsterdamTime(match.isoDate,'00:00')<=end && amsterdamTime(match.isoDate,'23:59')>=now;
}
export function outstanding(match, overview, fruit) {
  if(!Array.isArray(overview)||overview.length===0||!overview.every(row=>row&&typeof row.familyKey==='string')||(teamConfig.fruitEnabled&&(!fruit||!Object.hasOwn(fruit,'parentName'))))throw Error('Onvolledige status ontvangen.');
  const families=[...new Map(overview.map(row=>[row.familyKey,row])).values()];
  const issues=[];
  if(teamConfig.fruitEnabled&&!fruit.parentName)issues.push('Fruit is nog niet geregeld.');
  const cars=families.filter(row=>row.drive==='Ja').length;
  if(match.home===false&&cars<4)issues.push(`Er zijn ${cars} van de 4 benodigde auto's beschikbaar.`);
  const missing=families.filter(row=>!row.present&&!row.drive).length;
  if(missing)issues.push(`${missing} van de ${families.length} gezinnen hebben nog niet gereageerd.`);
  return issues;
}
export function reminder(match, issues, origin) {
  return `Hoi allemaal! Voor ${match.teams} op ${match.date}${match.time?' om '+match.time:' (tijd volgt)'} staat nog het volgende open:\n\n${issues.map(s=>'• '+s).join('\n')}\n\nWillen jullie dit in TeamRit bekijken en aanvullen?\n${new URL('/',origin).href}\n\nDank je wel!`;
}
