export function gatheringTime(time, home, travelMinutes) {
  if (!time) return '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Ongeldige wedstrijdtijd.');
  if (!home && (!Number.isInteger(travelMinutes) || travelMinutes < 0 || travelMinutes > 720)) throw Error('Bereken eerst de autorijtijd of kies handmatig verzamelen.');
  const [h,m]=time.split(':').map(Number);
  const total=h*60+m-(home?60:45+travelMinutes);
  if(total<0)throw Error('De verzameltijd valt op de vorige dag. Kies een handmatige afspraak.');
  const rounded=home?total:Math.floor(total/5)*5;
  return String(Math.floor(rounded/60)).padStart(2,'0')+':'+String(rounded%60).padStart(2,'0');
}
export const routeKey = location => location.trim().toLocaleLowerCase('nl-NL');
