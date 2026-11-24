const esHex=(x)=>typeof x==='string' && /^#[a-f0-9]{6}$/i.test(x);
export const REVISION_VISUAL=3;
export function identidadProducto(investigacion={},ficha={}) {
 const categoria=`${ficha?.tipo || ''} ${ficha?.queEs || ''} ${ficha?.ingredientes || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const acento=esHex(investigacion?.color)?investigacion.color.toUpperCase():/serum|belleza|piel|cosmetic|cabello/.test(categoria)?'#AD617D':/azucar|glucosa|salud|suplement|natural|aloe|botanic/.test(categoria)?'#378776':/hogar|cocina|limpieza/.test(categoria)?'#B17B42':'#687BA4';
 // Tono cromático suave, no blanco por omisión. Se deriva de la marca o de la categoría documentada.
 const canales=[1,3,5].map(i=>parseInt(acento.slice(i,i+2),16));
 const fondo='#'+canales.map((n,i)=>Math.round(n*.24+[237,232,224][i]*.76).toString(16).padStart(2,'0')).join('').toUpperCase();
 return {fondo,acento,grafica:'curvas suaves y trazos finos de bajo contraste, derivados del mecanismo, beneficio o componentes documentados; máximo dos acentos gráficos secundarios; sin decoración gratuita'};
}
export const modoFondo=(e)=>e.fondoModo || (e.fondo && e.fondo.toUpperCase()!=='#FFFFFF'?'manual':'auto');
export const fondoDe=(e)=>modoFondo(e)==='manual'?e.fondo:e.identidad?.fondo || '#CDD2DB';
