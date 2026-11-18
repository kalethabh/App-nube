// ¿El servicio tiene una falla REPORTADA? (2026-11-18: ElevenLabs tuvo «Increased latency and API errors» y la app
// decía solo «no respondió a tiempo»). Lee la página de estado pública del servicio (gratis, sin claves) y devuelve una
// frase para el mensaje de error, o '' si no hay nada reportado o no se pudo leer. Se recuerda 3 minutos.
//
//   fallaReportada('elevenlabs') -> 'ElevenLabs reporta una falla ahora: «Increased latency and API errors» (desde las 10:34). No es tu clave ni la app: hay que esperar a que la arreglen.'
const PAGINAS = { elevenlabs: { nombre: 'ElevenLabs', url: 'https://status.elevenlabs.io/api/v2/summary.json' } };
const recordado = new Map(); // servicio -> { t, frase }

const hora = (iso) => {
  try {
    return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso));
  } catch {
    return '';
  }
};

export async function fallaReportada(servicio) {
  const p = PAGINAS[servicio];
  if (!p) return '';
  const r = recordado.get(servicio);
  if (r && Date.now() - r.t < 3 * 60000) return r.frase;
  let frase = '';
  try {
    const res = await fetch(p.url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    const d = res.ok ? await res.json() : null;
    const abiertos = (d?.incidents || []).filter((i) => i && i.status !== 'resolved' && i.status !== 'postmortem');
    if (abiertos.length) {
      const i = abiertos[0];
      frase = `${p.nombre} reporta una falla ahora: «${String(i.name || 'problemas en el servicio').slice(0, 120)}»${i.created_at ? ` (desde las ${hora(i.created_at)})` : ''}. No es tu clave ni la app: hay que esperar a que la arreglen (status.elevenlabs.io).`;
    } else if (d?.status?.indicator && d.status.indicator !== 'none') {
      frase = `${p.nombre} reporta problemas ahora («${String(d.status.description || '').slice(0, 80)}»). Revisa status.elevenlabs.io.`;
    }
  } catch {
    frase = '';
  }
  recordado.set(servicio, { t: Date.now(), frase });
  return frase;
}
