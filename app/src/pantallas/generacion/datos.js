// Índice de referencias: no mueve ni duplica archivos de los proyectos.
const idDe = (x) => x.id || x.lote || x.slug;
export function proyectosDe(tipo,datos,productos=[],estilo=null,continuidad=false,propios={}) {
  const nombres=new Map(productos.map(p=>[p.id,p.nombre])), fotos=new Map(productos.map(p=>[p.id,p.foto]));
  const listas={imagenes:datos?.lotes,videos:datos?.anuncios,embudo:datos?.embudos,landings:datos?.landings,sketch:datos?.sketches,cambiar:datos?.trabajos};
  return (listas[tipo] || []).filter(x=>tipo!=='videos' || ((!estilo || x.estilo===estilo) && (!continuidad || x.continuidad))).map(x=>{
    const id=idDe(x), productoId=x.productoId || null;
    const nombre=(tipo==='videos' ? x.tituloGuion || [x.titulo,x.estiloNombre].filter(Boolean).join(' · ') : null) || x.nombre || x.titulo || x.producto || id;
    // (2026-11-26c) el bloque: el nombre que le puso el usuario («Ángulo 1») y su imagen
    const propio=propios?.[`${tipo}:${id}`] || null;
    const miniatura=x.portada || x.mosaico?.[0] || x.miniatura || null;
    const vista=tipo==='landings' && ['lista','listo'].includes(x.estado) ? `/landing/${encodeURIComponent(id)}/index.html` : null;
    const grupo=productoId ? `producto:${productoId}` : `proyecto:${id}`;
    const href=tipo==='imagenes'?`#/imagenes/${encodeURIComponent(id)}`:tipo==='videos'?`#/anuncio/${encodeURIComponent(id)}`:tipo==='embudo'?`#/embudo-whatsapp/${encodeURIComponent(id)}`:tipo==='landings'?`#/landings?proyecto=${encodeURIComponent(id)}`:`#/${tipo}/${encodeURIComponent(id)}`;
    return {id,productoId,grupo,nombre:propio || nombre,nombreOriginal:nombre,propio:Boolean(propio),miniatura,vista,foto:fotos.get(productoId) || (typeof x.foto==='string'?x.foto:null),grupoNombre:nombres.get(productoId) || (productoId ? x.producto || x.titulo || x.nombre : nombre),href,estado:x.estado || x.etapa || '',fecha:x.actualizado || x.fecha || x.creado || '',detalle:tipo==='embudo'?`${x.generadas || 0} de 5 imágenes`:tipo==='imagenes'?`${x.cantidad || 0} anuncios`:null};
  }).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
}
export function agruparProyectos(proyectos) {
  const grupos=new Map();
  for(const p of proyectos) {
    if(!grupos.has(p.grupo))grupos.set(p.grupo,{id:p.grupo,nombre:p.grupoNombre || p.nombre,productoId:p.productoId,foto:p.foto,fecha:p.fecha,proyectos:[]});
    grupos.get(p.grupo).proyectos.push(p);
  }
  return [...grupos.values()];
}
