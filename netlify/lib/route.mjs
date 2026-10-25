import teamConfig from '../../lib/team-config.mjs';
// Public club addresses only. Netherlands, single address lookup; no autocomplete.
const origin=teamConfig.routeOrigin; // PDOK: Roskam 6, 1689VR Zwaag (WFHC).
const headers={ 'User-Agent':'TeamRit/1.0 (https://wfhc-teamrit.netlify.app)', Referer:'https://wfhc-teamrit.netlify.app/' };
const normalized=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b\d{4}\s?[a-z]{2}\b/g,'').replace(/[^a-z0-9]/g,'');
export async function drivingEstimate(location, fetcher=fetch) {
  if(!origin)throw Error("Stel eerst het vertrekpunt in of kies handmatig verzamelen.");
  if(typeof location!=='string'||location.length>240||!location.trim())throw Error('Vul straat, huisnummer en plaats in. Zet veldinformatie bij Notitie.');
  const url=new URL('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free');
  url.search=new URLSearchParams({q:location,rows:'10',fq:'type:adres',fl:'weergavenaam,centroide_ll'});
  const geo=await fetcher(url,{headers,signal:AbortSignal.timeout(6000)});
  if(!geo.ok)throw Error('De adresdienst is tijdelijk niet beschikbaar. Probeer opnieuw of kies handmatig.');
  const candidates=(await geo.json()).response?.docs?.filter(d=>normalized(d.weergavenaam)===normalized(location))||[];
  if(candidates.length!==1)throw Error('Adres niet eenduidig herkend. Gebruik straat, huisnummer en plaats; zet veldinformatie bij Notitie.');
  const point=/^POINT\(([-\d.]+) ([-\d.]+)\)$/.exec(candidates[0].centroide_ll);
  if(!point)throw Error('Kon het adres niet op de kaart vinden.');
  const lon=Number(point[1]),lat=Number(point[2]);
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||lon<3||lon>8||lat<50||lat>54)throw Error('Gebruik een adres in Nederland.');
  const route=await fetcher(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${origin};${lon},${lat}?overview=false&steps=false`,{headers,signal:AbortSignal.timeout(8000)});
  if(!route.ok)throw Error('De routedienst is tijdelijk niet beschikbaar. Probeer opnieuw of kies handmatig.');
  const result=await route.json();const duration=result.routes?.[0]?.duration;
  if(result.code!=='Ok'||!Number.isFinite(duration)||duration<=0||duration>43200)throw Error('Geen bruikbare autoroute gevonden. Kies handmatig verzamelen.');
  return {travelMinutes:Math.ceil(duration/60),matchedAddress:candidates[0].weergavenaam,source:'OSRM / OpenStreetMap',calculatedAt:new Date().toISOString()};
}
