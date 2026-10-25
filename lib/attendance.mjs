export function validateChildPresence(children, value, legacy) {
 if(value===undefined){if(!['Ja','Nee'].includes(legacy))throw Error('Kies aanwezigheid.');return Object.fromEntries(children.map(c=>[c,legacy]));}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==children.length||Object.keys(value).some(c=>!children.includes(c))||children.some(c=>!['Ja','Nee'].includes(value[c])))throw Error('Geef voor ieder kind Ja of Nee door.');
 return Object.fromEntries(children.map(c=>[c,value[c]]));
}
export function attendance(children, stored, legacy) {
 return Object.fromEntries(children.map(c=>[c,['Ja','Nee'].includes(stored?.[c])?stored[c]:legacy??null]));
}
