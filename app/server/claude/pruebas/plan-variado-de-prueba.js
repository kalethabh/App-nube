// Un plan de «Vecinas» o «Conceptos nuevos» que cumple las reglas duras de imagen-ads/variedad.js, armado con el índice
// de formatos y los ángulos de la skill. Lo usan el Claude falso (claude-falso-imagen-ads.js) y la prueba
// app/herramientas/probar-variaciones-imagen.mjs. Nunca llama a nadie.
import { cupos } from '../../lib/imagen-ads/variedad.js';

/**
 * { variaciones } con n variaciones. `formatos` y `angulos`: las listas de indice.json y angulos.json. `analisis`:
 * { formato_ganador, angulo_ganador }.
 */
export function armarPlanVariado({ n, nivel = 'vecinas', analisis, formatos, angulos, historial = [] }) {
  const c = cupos(n, nivel);
  const fam = (f) => f.familia || f.id;
  const porId = new Map(formatos.map((f) => [f.id, f]));
  const famG = porId.get(analisis?.formato_ganador) ? fam(porId.get(analisis.formato_ganador)) : null;
  const ganadorA = analisis?.angulo_ganador || angulos[0].id;
  const otros = angulos.map((a) => a.id).filter((a) => a !== ganadorA);
  // el ángulo de cada una: Vecinas, la mitad con el del ganador; Conceptos, solo V01
  const conGanador = nivel === 'vecinas' ? Math.max(c.mitad.min, Math.min(c.mitad.max, Math.floor(n / 2))) : 1;
  const usos = new Map();
  let nativas = 0;
  let protas = 0;
  const conocidas = new Set(historial.map((h) => `${h.formato_id}+${h.angulo_id}`));
  const variaciones = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const quiere = i < conGanador ? [ganadorA] : [...otros.slice(k % otros.length), ...otros.slice(0, k % otros.length)];
    let elegido = null;
    for (const a of quiere) {
      const libres = formatos.filter((f) => {
        const t = fam(f) === famG ? c.maxGanador : c.maxFormato;
        return (usos.get(fam(f)) || 0) < t && (!f.angulos_compatibles?.length || f.angulos_compatibles.includes(a)) && !conocidas.has(`${f.id}+${a}`);
      });
      const orden = (f) => (c.nativas - nativas > 0 && f.nativo ? 0 : c.protagonistas - protas > 0 && f.protagonista ? 1 : 2) * 100 + (usos.get(fam(f)) || 0);
      libres.sort((x, y) => orden(x) - orden(y));
      if (libres.length) {
        elegido = { f: libres[0], a };
        break;
      }
    }
    if (!elegido) throw new Error(`no encuentro formato para V${i + 1}`);
    if (i >= conGanador) k++;
    usos.set(fam(elegido.f), (usos.get(fam(elegido.f)) || 0) + 1);
    if (elegido.f.nativo) nativas++;
    if (elegido.f.protagonista) protas++;
    const id = `V${String(i + 1).padStart(2, '0')}`;
    const a = angulos.find((x) => x.id === elegido.a);
    variaciones.push({
      id,
      fuente: 'biblioteca',
      formato_id: elegido.f.id,
      formato: elegido.f.nombre,
      angulo_id: a.id,
      angulo: a.nombre,
      concepto: `Concepto de prueba ${i + 1}`,
      titular: `Titular de prueba ${i + 1}`,
      escena: `Escena de prueba ${i + 1}`,
      camara: `Cámara de prueba ${i + 1}`,
      modelo: `Modelo de prueba ${i + 1}`,
      vestuario: `Vestuario de prueba ${i + 1}`,
      paleta_secundaria: `Paleta de prueba ${i + 1}`,
      variables_cambiadas: ['faceta', 'contexto'],
      por_que_vende: `Por qué vende la prueba ${i + 1}`,
      mismo_formato_que_ganador: fam(elegido.f) === famG,
    });
  }
  return { variaciones };
}
