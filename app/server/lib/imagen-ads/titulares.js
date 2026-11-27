// LOS TÍTULOS COMO MAYAVERRA (2026-11-26f). Pedido: «los títulos sí están flojos, mira cómo los coloca el drenaje: con
// propuesta de valor, tiempo de transformación, etc.» y «quiero que sea AGRESIVA la promesa». Mayaverra escribe en 2-3
// niveles: un GANCHO gigante («ELIMINA LA HINCHAZÓN EN TUS BRAZOS»), la PROPUESTA DE VALOR con TIEMPO («en solo 3
// semanas», «Elimina la hinchazón facial en 5 días y recupera tu mandíbula», «Programa de 30 días para mujeres de 45+»)
// y a veces la línea de tiempo (Día 1… Día 30; Antes · 24 horas · 1 semana · 4 semanas).
//
//   textoTitulosMayaverra(brief)          la sección de la estrategia, los prompts y los ajustes
//   erroresTitularesPlan(plan, brief, o)  plan.json: tiempo, deseo principal y central, y la propuesta con tiempo en cada una
// (2026-11-26f, el usuario) PROPUESTA DE VALOR = deseo principal + tiempo de transformación + deseo central.
//   erroresPropuestaAnuncio(ad, o)        V##.json: la capa de propuesta de valor (8-22 palabras, con tiempo) y nada de «garantizado» sin garantía
export const TIEMPO = /\b(\d+\s*(d[ií]as?|semanas?|meses|mes|horas?)|semana\s*\d+|d[ií]a\s*\d+|mes\s*\d+|en solo|programa|tratamiento|rutina de|ciclo|24 horas)\b/i;
const NO_PROPUESTA = /headline|titular|title|hook|offer|oferta|price|precio|seal|sello|trust|cta|button|bot[oó]n|badge|strip|franja|benefit|beneficio|bullet|check|logo|label|etiqueta|timeline|linea/i;
const palabras = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;

export function textoTitulosMayaverra(brief) {
  const tiempo = String(brief?.venta?.tiempo || '').trim();
  return `
## Títulos como Mayaverra (manda sobre cualquier regla de titular más vieja)
Cada imagen (salvo la carta de texto y las fotos caseras) lleva 2 o 3 niveles de texto, como los anuncios de Mayaverra:
1. GANCHO (2 a 7 palabras, gigante, en mayúsculas, con UNA palabra o línea resaltada en color): orden, reencuadre, alivio en primera persona o el segmento.
2. PROPUESTA DE VALOR (8 a 16 palabras, corta y grande, en su propia capa de \`text_layers\` con \`"reference_function": "value proposition"\`), SIEMPRE con esta fórmula del usuario: DESEO PRINCIPAL (el resultado concreto en la zona del producto) + TIEMPO DE TRANSFORMACIÓN + DESEO CENTRAL (lo que de verdad quiere sentir o lograr con ese resultado). Ej.: «Glúteos más redondos y firmes» + «en solo 4 semanas» + «para volver a lucir tus jeans con seguridad».
3. (Opcional, si la estructura lo trae) la línea de tiempo o los beneficios con su tiempo: «Semana 1 · Semana 4 · Mes 3».
El TIEMPO de transformación: ${tiempo ? `el del producto (lo dio el usuario): «${tiempo}». Usa esos plazos.` : 'deduce el tratamiento de la oferta y de la dosis del producto (p. ej. «x3» con 1 frasco por mes = tratamiento de 3 meses; marcas creíbles: semana 2, semana 4, 30 días, 90 días).'} En plan.json escribe \`"tiempo": "<el tratamiento y cuándo se empieza a notar>"\`, \`"deseo_principal": "<el resultado concreto que se ve>"\` y \`"deseo_central": "<lo que de verdad quiere sentir o lograr>"\` (de la investigación si la hay), y en CADA variación (salvo fotos caseras y cartas de texto) \`"propuesta_valor"\` con la fórmula completa: deseo principal + tiempo + deseo central (puedes variar las palabras y el deseo central entre variaciones).
PROMESA AGRESIVA (decisión del usuario), directa y con tiempo. Fórmulas de Mayaverra, con su versión para glúteos y piernas:
- «[Resultado] en solo [N semanas]» → «LEVANTA TUS GLÚTEOS» + «Más redondos y firmes en solo 4 semanas, para lucir tus jeans con seguridad»
- «Semana [N]: [resultado visible]» → «CURVAS NATURALES. SEMANA 4.» + «El jean ya se llena atrás»
- «Tu programa de [N días] para [resultado]» → «PROGRAMA CURVAS 90 DÍAS» + «Tu tratamiento de 3 meses para glúteos y piernas firmes»
- «Por fin mi [zona] volvió» → «POR FIN MIS CURVAS VOLVIERON» + Antes · Semana 2 · Semana 4 · Mes 3
- «Tomé esto [tiempo]. [Resultado].» → «LO TOMÉ 30 DÍAS» + «Y mi jean dejó de bailar atrás»
- «No es [creencia]. Es [causa]» → «NO ES GENÉTICA. ES NUTRICIÓN.» + «Glúteos con forma en 30 días, sin vivir en el gym»
- «[Segmento]: [diagnóstico simple]» → «DESPUÉS DE LOS 30: TU GLÚTEO SE APLANA» + «Recupera la forma en solo 8 semanas»
- «Deja de [X]. [Resultado] de verdad» → «DEJA DE RELLENAR EL JEAN» + «Glúteo levantado en 4 semanas, de verdad»
Nunca: cifras de clientas, kilos o centímetros inventados, testimonios con nombre, avales, enfermedades o curas, «garantizado» o «100 %» (salvo la garantía real del formulario), ni señalar el cuerpo de quien mira («tu grasa», «tu flacidez»).
`;
}

/**
 * plan.json: el «tiempo», el «deseo_principal» y el «deseo_central», y en cada variación (salvo las exentas: fotos
 * caseras y cartas de texto) su «propuesta_valor» con el TIEMPO (fórmula del usuario: deseo principal + tiempo + deseo central).
 */
export function erroresTitularesPlan(plan, brief, { exenta = () => false } = {}) {
  const vs = Array.isArray(plan?.variaciones) ? plan.variaciones : [];
  if (vs.length < 2) return [];
  const errores = [];
  if (!String(plan?.tiempo || brief?.venta?.tiempo || '').trim()) errores.push('plan.json → tiempo: falta el tiempo de transformación del producto (p. ej. «Tratamiento de 3 meses · se nota desde la semana 4»)');
  for (const k of ['deseo_principal', 'deseo_central']) if (!String(plan?.[k] || '').trim()) errores.push(`plan.json → ${k}: falta (${k === 'deseo_principal' ? 'el resultado concreto que se ve, p. ej. «glúteos más redondos y firmes»' : 'lo que de verdad quiere sentir o lograr, p. ej. «volver a lucir sus jeans con seguridad»'})`);
  const sinTiempo = vs.filter((x) => !exenta(x) && !(String(x?.propuesta_valor || '').trim() && TIEMPO.test(x.propuesta_valor))).map((x) => x?.id);
  if (sinTiempo.length) errores.push(`plan.json → ${sinTiempo.join(', ')}.propuesta_valor: falta o no dice el TIEMPO; usa la fórmula deseo principal + tiempo + deseo central («Glúteos más redondos y firmes en solo 4 semanas, para volver a lucir tus jeans con seguridad»)`);
  return errores;
}

/** La capa de propuesta de valor de un V##.json (la que no es titular, oferta, sello, botón ni beneficio), o null. */
export function capaPropuesta(ad) {
  const capas = Array.isArray(ad?.text_layers) ? ad.text_layers : [];
  const marcada = capas.find((t) => /value|propuesta|subhead|subtitle|subt[ií]tulo|promise|promesa|supporting/i.test(`${t?.reference_function || ''} ${t?.block_id || ''}`));
  if (marcada) return marcada;
  const titular = capas.find((t) => /headline|titular|title|hook/i.test(`${t?.reference_function || ''} ${t?.block_id || ''}`)) || capas[0];
  return capas.find((t) => t !== titular && !NO_PROPUESTA.test(`${t?.reference_function || ''} ${t?.block_id || ''}`) && palabras(t?.text) >= 6) || null;
}

/** V##.json: la propuesta de valor (salvo nativas y cartas de texto) y «garantizado» solo con garantía real. */
export function erroresPropuestaAnuncio(ad, { sinPropuesta = false, venta = null } = {}) {
  const errores = [];
  if (!sinPropuesta) {
    const c = capaPropuesta(ad);
    const n = palabras(c?.text);
    if (!c) errores.push('text_layers: falta la PROPUESTA DE VALOR debajo del gancho (en su propia capa, "reference_function": "value proposition"): deseo principal + tiempo de transformación + deseo central, de 8 a 16 palabras');
    else if (n < 7 || n > 18) errores.push(`text_layers: la propuesta de valor «${c.text}» tiene ${n} palabras: de 8 a 16, corta y grande (deseo principal + tiempo + deseo central)`);
    else if (!TIEMPO.test(String(c.text))) errores.push(`text_layers: la propuesta de valor «${c.text}» no dice el TIEMPO de transformación (deseo principal + tiempo + deseo central)`);
  }
  const todo = (Array.isArray(ad?.text_layers) ? ad.text_layers : []).map((t) => String(t?.text || '')).join(' ');
  const conGarantia = /garant/i.test(`${venta?.oferta || ''} ${(venta?.sellos || []).join(' ')}`);
  if (!conGarantia && /garantiz|100\s?%/i.test(todo)) errores.push('text_layers: «garantizado» o «100 %» solo si el formulario trae una garantía real; promete con el resultado y el tiempo');
  return errores;
}
