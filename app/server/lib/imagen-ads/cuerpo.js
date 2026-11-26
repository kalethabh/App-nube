// EL CUERPO DE ESTE PRODUCTO (2026-11-26e). Pedido (con imágenes reales de Aguaje vs Mayaverra): «el avatar debe salir
// con glúteos mostrando el resultado… el drenaje muestra pierna hinchada y la otra normal; en la del aguaje debe
// adaptarse para el tema de glúteos y piernas». La IA copiaba la escena de la referencia (pies hinchados, jean que sobra)
// en vez de traducirla a la zona que mejora el producto. Decisión del usuario: siempre con ropa (jean o leggins).
//
//   tieneCuerpo(ficha)                  ¿la estructura muestra un cuerpo (zona o dolor visual)?
//   textoCuerpo(brief)                  la sección de la estrategia y de los prompts
//   erroresCuerpoPlan(plan, brief)      plan.json: «cuerpo» y la zona de cada variación con cuerpo
//   erroresCuerpoAnuncio(ad, x, plan)   V##.json: el visual_prompt nombra la zona, el resultado y la ropa
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
- Se VE EL RESULTADO en esa zona, o el contraste antes/después con el MISMO recurso visual de la referencia: si la referencia pone una pierna hinchada junto a una normal en el mismo cuadro, la nuestra pone la zona del producto con el antes junto al después en el mismo encuadre y la misma luz (p. ej. glúteo plano junto a glúteo redondo y levantado, o pierna delgada junto a pierna torneada); si la referencia es una selfie del problema, la nuestra es la selfie del RESULTADO. Nunca solo el problema.
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
