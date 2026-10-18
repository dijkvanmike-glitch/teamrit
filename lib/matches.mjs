// Shared by the mobile editor and the Netlify API. IDs never change on edits.
export const validId = id => typeof id === 'string' && /^(?:m\d+|a\d+|match-[0-9a-f-]{36})$/.test(id);
export function validateFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Ongeldige wedstrijd.');
  const { isoDate, home, opponent, time = '', gathering = '', location = '', note = '' } = value;
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !Number.isFinite(Date.parse(isoDate)) || new Date(isoDate).toISOString().slice(0,10) !== isoDate) throw Error('Vul een geldige datum in.');
  if (typeof home !== 'boolean') throw Error('Kies thuis of uit.');
  const fields = { isoDate, home };
  for (const [key, text, max] of [['opponent', opponent, 120], ['time', time, 5], ['gathering', gathering, 5], ['location', location, 240], ['note', note, 500]]) {
    if (typeof text !== 'string' || text.length > max) throw Error('Controleer de ingevulde velden.');
    fields[key] = text.trim();
  }
  if (!fields.opponent) throw Error('Vul een tegenstander in.');
  for (const key of ['time', 'gathering']) if (fields[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(fields[key])) throw Error('Gebruik een tijd tussen 00:00 en 23:59.');
  return fields;
}
export function editableFields(m) {
  if (m.opponent !== undefined) return validateFields(m);
  const parts = m.teams.split('·').map(s => s.trim());
  const extras = m.meta.split('·').map(s => s.trim()).filter(s => s && !['Thuis','Uit',m.time,'Tijd volgt'].includes(s) && !s.startsWith('Verzamelen '));
  return { isoDate: m.isoDate, home: !!m.home, opponent: parts.find(s => !s.toUpperCase().includes('WFHC')) || parts[0], time: m.time || '', gathering: m.departOverride || '', location: m.mapsQuery || '', note: extras.filter(s => s !== m.mapsQuery).join(' · ') };
}
export function displayMatch(m) {
  if (m.opponent === undefined) return m;
  const date = new Intl.DateTimeFormat('nl-NL', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'Europe/Amsterdam' }).format(new Date(m.isoDate+'T12:00:00Z'));
  return { ...m, date: date[0].toUpperCase()+date.slice(1), teams: m.home ? 'WFHC JO14-1 · '+m.opponent : m.opponent+' · WFHC JO14-1', meta: [m.home?'Thuis':'Uit', m.time || 'Tijd volgt', m.gathering && 'Verzamelen '+m.gathering, m.location, m.note].filter(Boolean).join(' · '), time: m.time || undefined, departOverride: m.gathering || undefined, mapsQuery: m.location || undefined };
}
export function mergeMatches(seed, rows) {
  const byId = new Map(seed.map(m => [m.id, { ...m, revision:0 }]));
  for (const row of rows) {
    if (!validId(row.id) || !Number.isInteger(row.revision) || row.revision < 1) throw Error('Ongeldige opgeslagen wedstrijd.');
    const base = byId.get(row.id) || {};
    if (base.type === 'info') continue;
    byId.set(row.id, { ...base, ...validateFields(row.data), id:row.id, revision:row.revision });
  }
  return [...byId.values()].sort((a,b) => a.isoDate.localeCompare(b.isoDate) || a.id.localeCompare(b.id));
}
export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function safeDisplayMatch(m) {
  const out = displayMatch(m);
  if (!validId(out.id)) throw Error('Ongeldig wedstrijd-ID.');
  for (const field of ['date','teams','meta','desc']) if (out[field]) out[field] = escapeHtml(out[field]);
  return out;
}
