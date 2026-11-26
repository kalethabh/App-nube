// EL CUERPO DE ESTE PRODUCTO (2026-11-26e). Pedido (con imágenes reales de Aguaje vs Mayaverra): «el avatar debe salir
// con glúteos mostrando el resultado… el drenaje muestra pierna hinchada y la otra normal; en la del aguaje debe
// adaptarse para el tema de glúteos y piernas». La IA copiaba la escena de la referencia (pies hinchados, jean que sobra)
// en vez de traducirla a la zona que mejora el producto. Decisión del usuario: siempre con ropa (jean o leggins).
//
//   tieneCuerpo(ficha)                  ¿la estructura muestra un cuerpo (zona o dolor visual)?
//   textoCuerpo(brief)                  la sección de la estrategia y de los prompts
//   erroresCuerpoPlan(plan, brief)      plan.json: «cuerpo» y la zona de cada variación con cuerpo
//   erroresCuerpoAnuncio(ad, x, plan)   V##.json: el visual_prompt nombra la zona, el resultado y la ropa
//   textoMomentos() · erroresMomentos(ad, x)   (2026-11-26g) antes/después y progreso: cada momento, otro día
import { ZONAS_CUERPO, zonaDe, limpiarCuerpo } from './ajustes-producto.js';
import { leerSkill } from './verificar.js';
import { fichaDe } from './estructuras.js';

const SIN = /^(ninguna|ninguno|no aplica|n\/a|-)?$/i;

/** ¿La estructura muestra un cuerpo? (su zona del cuerpo no es «ninguna»; las fichas se revisaron contra su imagen) */
export function tieneCuerpo(ficha) {
  if (!ficha) return false;
  return !SIN.test(String(ficha.zona_del_cuerpo || '').trim());
}
/** ¿Muestra un cuerpo de verdad (foto, 3D o lo invisible sobre el cuerpo)? Ahí va la ropa (jean o leggins); no en las ilustraciones de línea. */
const cuerpoReal = (ficha) => ['cuerpo-real-antes-despues', '3d-cartoon-antes-despues', 'invisible-visible'].includes(ficha?.dolor_visual?.tipo);

/** La ficha de una variación del plan (si su formato es una estructura ganadora), o null. */
export function fichaDeVariacion(x) {
  const f = leerSkill().formatos.get(x?.formato_id);
  return f?.estructura ? fichaDe(f) : null;
}

/** Las zonas del producto: las del formulario (venta.cuerpo) o las que escribió la IA en plan.json. */
export function zonasDe(brief, plan = null) {
  const delForm = limpiarCuerpo(brief?.venta?.cuerpo)?.zonas || [];
  if (delForm.length) return delForm;
  return limpiarCuerpo(plan?.cuerpo)?.zonas || [];
}

const RESULTADO = /\b(after|result|results|lifted|lift|toned|firm(er)?|round(er|ed)?|full(er)?|shap(ed|ely)|sculpted|curv(y|ier|es)|perky|transformation|before and after|before-and-after|después|resultado)\b/i;
const ROPA = /\b(jeans?|denim|leggings?)\b/i;

export function textoCuerpo(brief) {
  const c = limpiarCuerpo(brief?.venta?.cuerpo);
  const zonas = c?.zonas || [];
  return `
## El cuerpo de ESTE producto (manda sobre la referencia)
${zonas.length ? `Zona(s) que mejora este producto (las dio el usuario): ${zonas.join(', ')}${c.resultado ? `. Cómo se ve el resultado: ${c.resultado}` : ''}.` : 'Deduce de producto.json (y de la investigación, si está) qué zona(s) del cuerpo mejora este producto (glúteos, piernas, caderas, cintura, abdomen, brazos, cara, piel, cabello o busto; «ninguna» si no es de cuerpo).'}
En plan.json escribe además \`"cuerpo": { "zonas": [${zonas.length ? zonas.map((z) => `"${z}"`).join(', ') : '"…"'}], "antes": "<cómo se ve esa zona ANTES, concreto>", "despues": "<cómo se ve DESPUÉS, concreto>" }\`.
- Toda imagen con persona o cuerpo usa una de ESAS zonas en su \`zona_del_cuerpo\` (nunca la de la referencia: si la referencia muestra pies o un vientre y el producto es de glúteos y piernas, la nuestra muestra glúteos y piernas).
- Se VE EL RESULTADO en esa zona, o el contraste antes/después con el MISMO recurso visual de la referencia: si la referencia pone una pierna hinchada junto a una normal en el mismo cuadro, la nuestra pone la zona del producto con el antes junto al después con el mismo recurso visual, pero cada momento tomado OTRO DÍA (p. ej. glúteo plano junto a glúteo redondo y levantado, o pierna delgada junto a pierna torneada); si la referencia es una selfie del problema, la nuestra es la selfie del RESULTADO. Nunca solo el problema.
- Siempre con ropa que marque la forma: jean o leggins (nunca ropa interior).
- En el \`visual_prompt\` (en inglés) se nombra la zona (glutes, legs, hips…), cómo se ve el resultado (lifted, toned, rounder, fuller…) o el before/after, y la ropa (jeans o leggings).
`;
}

/** plan.json: el «cuerpo» y la zona de cada variación que muestra un cuerpo. */
export function erroresCuerpoPlan(plan, brief) {
  const vs = Array.isArray(plan?.variaciones) ? plan.variaciones : [];
  const conCuerpo = vs.filter((x) => tieneCuerpo(fichaDeVariacion(x)));
  if (!conCuerpo.length) return [];
  const errores = [];
  const delPlan = limpiarCuerpo(plan?.cuerpo);
  const sinCuerpo = Array.isArray(plan?.cuerpo?.zonas) && plan.cuerpo.zonas.some((z) => /ningun/i.test(String(z)));
  if (!delPlan && !sinCuerpo) {
    errores.push('plan.json → cuerpo: falta { "zonas": [la(s) zona(s) que mejora ESTE producto], "antes": "…", "despues": "…" }');
    return errores;
  }
  if (sinCuerpo) return errores; // un producto que no es de cuerpo: las estructuras con cuerpo se traducen a su uso
  if (!String(plan.cuerpo.antes || '').trim() || !String(plan.cuerpo.despues || '').trim()) errores.push('plan.json → cuerpo.antes y cuerpo.despues: cómo se ve la zona antes y después (concreto)');
  const zonas = zonasDe(brief, plan);
  const delForm = limpiarCuerpo(brief?.venta?.cuerpo)?.zonas || [];
  if (delForm.length && delPlan.zonas.some((z) => !delForm.includes(z))) errores.push(`plan.json → cuerpo.zonas: usa las del usuario: ${delForm.join(', ')}`);
  for (const x of conCuerpo) {
    const z = String(x?.zona_del_cuerpo || '')
      .split(/[,/]| y /)
      .map(zonaDe)
      .filter(Boolean);
    if (!z.length || z.some((k) => !zonas.includes(k))) errores.push(`plan.json → ${x.id}.zona_del_cuerpo: «${x?.zona_del_cuerpo || ''}» no es una zona de este producto; usa ${zonas.join(' o ')} (con el mismo recurso visual de su referencia, mostrando el resultado)`);
  }
  return errores;
}

/** V##.json: si su estructura muestra un cuerpo, el visual_prompt nombra la zona, el resultado y la ropa. */
export function erroresCuerpoAnuncio(ad, x, plan, brief) {
  const ficha = fichaDeVariacion(x);
  if (!x || !tieneCuerpo(ficha)) return [];
  const zonas = zonasDe(brief, plan);
  if (!zonas.length) return [];
  const vp = String(ad?.visual_prompt || '');
  const errores = [];
  const suyas = String(x.zona_del_cuerpo || '').split(/[,/]| y /).map(zonaDe).filter((k) => k && zonas.includes(k));
  const buscar = suyas.length ? suyas : zonas;
  if (!buscar.some((k) => ZONAS_CUERPO[k]?.en.test(vp))) errores.push(`visual_prompt: tiene que mostrar ${buscar.join(' o ')} (en inglés: ${buscar.map((k) => String(ZONAS_CUERPO[k].en.source).split('|')[0].replace(/\\b/g, '')).join(', ')}), la zona que mejora este producto`);
  if (!RESULTADO.test(vp)) errores.push('visual_prompt: tiene que verse el RESULTADO en esa zona (after, lifted, toned, rounder, fuller…) o el before/after; nunca solo el problema');
  if (cuerpoReal(ficha) && buscar.some((k) => ZONAS_CUERPO[k]?.ropa) && !ROPA.test(vp)) errores.push('visual_prompt: el cuerpo va con jean o leggins (jeans / leggings) que marquen la forma, nunca ropa interior');
  return errores;
}

// ---------------------------------------------------------------- cada momento, otro día (2026-11-26g)
// Pedido: «todo lo que haya antes y después, progreso por día, meses, semanas, etc. debe ser diferente en pose, ropa,
// peinado, escenario, iluminación, que se note que sí pasó esa cantidad de tiempo y no fue en el mismo momento».

export function textoMomentos() {
  return `
## Antes/después y progreso: cada momento, OTRO DÍA (regla del usuario)
Todo antes y después, progreso o línea de tiempo con personas (Antes · 24 horas · 1 semana · 4 semanas; Día 1 · Día 30; Mes 1 · Mes 2 · Mes 3) se ve tomado en días distintos, no en el mismo momento. En CADA momento cambian, como mínimo:
- la POSE (de frente / de perfil / mano en la cadera / sentada…);
- la ROPA (otra prenda y otro color; siempre jean o leggins abajo);
- el PEINADO (moño, cola, suelto, ondas…);
- el ESCENARIO o lugar (cuarto, baño, sala, cocina, afuera…);
- la ILUMINACIÓN u hora del día (luz fría de la mañana, tarde cálida, lámpara de noche…).
También pueden cambiar el maquillaje, los accesorios y el ángulo de cámara. Se conserva la misma persona (cara, tono de piel, cuerpo base) y el producto. En el progreso, que se note el tiempo (ropa de otra temporada, el pelo un poco más largo, otro cuarto).
En el \`visual_prompt\` (en inglés) describe cada momento por separado con esas 5 cosas; nunca «same outfit», «same pose», «same lighting» ni «same background».
`;
}

const MOMENTOS = [/\bbefore\b/i, /\bafter\b/i, /\bweek\s*\d+/i, /\bday\s*\d+/i, /\bmonth\s*\d+/i, /\b\d+\s*(weeks?|days?|months?|hours?)\b/i, /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i];
const DIFERENCIAS = {
  pose: /\b(pose[sd]?|posing|stand(s|ing)?|sit(s|ting)?|lean(s|ing)?|hands? on|arms? (crossed|down|up|raised)|walking|turned|twist(s|ing|ed)?|facing|kneel(s|ing)?|squat(s|ting)?)\b/gi,
  ropa: /\b(outfit|wearing|wears|t-shirt|tee|blouse|shirt|sweater|tank top|crop top|top|dress|hoodie|cardigan|jacket|jeans|leggings|denim|sports bra)\b/gi,
  peinado: /\b(hair|ponytail|bun|braid(s|ed)?|curls|curly|waves|wavy|hairstyle|updo|loose)\b/gi,
  escenario: /\b(setting|background|room|bedroom|bathroom|kitchen|living room|outdoors?|park|street|gym|hallway|closet|beach|garden|office|balcony|patio)\b/gi,
  luz: /\b(lighting|light|lit|morning|evening|afternoon|night|sunset|sunrise|daylight|golden hour|lamp|overcast|sunny)\b/gi,
};
const NOMBRES = { pose: 'la pose', ropa: 'la ropa', peinado: 'el peinado', escenario: 'el escenario', luz: 'la iluminación' };
const MISMO = /\b(same|identical|matching)\s+(outfit|clothes|clothing|pose|lighting|light|background|setting|room|hair|hairstyle|moment|day|scene|location)\b/i;

/** ¿La variación muestra antes/después o progreso con una persona? */
function conProgreso(ficha, vp) {
  const momentos = MOMENTOS.filter((r) => r.test(vp)).length;
  const deFicha = ['cuerpo-real-antes-despues', '3d-cartoon-antes-despues', 'invisible-visible'].includes(ficha?.dolor_visual?.tipo) || ficha?.beneficios?.tipo === 'linea-de-tiempo';
  const persona = tieneCuerpo(ficha) || /\b(woman|women|man|girl|person|she|her|model|lady)\b/i.test(vp);
  return persona && (deFicha ? momentos >= 1 || /before|after/i.test(vp) : momentos >= 2);
}

/** V##.json: en un antes/después o progreso, cada momento con otra pose, ropa, peinado, escenario e iluminación. */
export function erroresMomentos(ad, x) {
  const vp = String(ad?.visual_prompt || '');
  const ficha = x ? fichaDeVariacion(x) : null;
  if (!conProgreso(ficha, vp)) return [];
  const errores = [];
  if (MISMO.test(vp)) errores.push(`visual_prompt: dice «${MISMO.exec(vp)[0]}»; en el antes/después o el progreso cada momento es OTRO DÍA (otra pose, ropa, peinado, escenario y luz)`);
  const faltan = Object.entries(DIFERENCIAS)
    .filter(([, r]) => (vp.match(r) || []).length < 2)
    .map(([k]) => NOMBRES[k]);
  if (faltan.length > 1) errores.push(`visual_prompt: describe cada momento por separado, tomado otro día; falta que cambie ${faltan.join(', ')} (como mínimo pose, ropa, peinado, escenario e iluminación distintos en cada momento)`);
  return errores;
}
