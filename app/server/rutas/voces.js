// Las voces de la cuenta de ElevenLabs del usuario (listarlas es gratis).
//
// GET /api/voces?estilo=claymation   -> [{ id, nombre, muestra (preview de ElevenLabs), etiquetas, categoria, propia,
//                                       descripcion, ultima (la ultima que se uso en ese estilo), ultimaEn: [estilos] }]
// GET /api/voces/por-estilo          -> { claymation: { id, nombre }, ... } (app/config.json, vozPorEstilo)
//
// La lista sale de listarVoces() de produccion/elevenlabs-client.js, corrida en un proceso aparte: la clave se lee
// del .env alli (process.loadEnvFile) y nunca entra en el proceso de la app. El preview (preview_url) no lo devuelve
// listarVoces: se toma de las mismas respuestas de ElevenLabs en ese proceso, sin pedir nada mas.
// Siempre va a ElevenLabs de verdad, tambien en modo prueba (listar no cobra).
import { leerConfig } from '../lib/config.js';
import { voces, mensajeSimple, VOZ_DE_PRUEBA } from '../lib/voces.js';
import { fallaReportada } from '../lib/estado-servicios.js';

export default function rutasVoces(app) {
  app.get('/api/voces/por-estilo', (req, res) => {
    const v = leerConfig().vozPorEstilo;
    res.json(v && typeof v === 'object' ? v : {});
  });

  app.get('/api/voces', async (req, res) => {
    const r = await voces({ fresco: req.query.fresco === '1' });
    const porEstilo = leerConfig().vozPorEstilo || {};
    const estilo = typeof req.query.estilo === 'string' ? req.query.estilo : null;
    let lista;
    if (r.ok) lista = r.voces;
    else if (process.env.ANUNCIOS_MODO_PRUEBA === '1') lista = [VOZ_DE_PRUEBA];
    else {
      const falla = r.motivo === 'clave' || r.motivo === 'sin-clave' ? '' : await fallaReportada('elevenlabs');
      return res.status(502).json({ error: falla || mensajeSimple(r.mensaje) });
    }
    const salida = lista
      .map(({ ajustes, ...v }) => {
        const ultimaEn = Object.entries(porEstilo).filter(([, x]) => x && (x.id || x) === v.id).map(([e]) => e);
        return { ...v, ultimaEn, ultima: estilo ? ultimaEn.includes(estilo) : false };
      })
      .sort((a, b) => Number(b.propia) - Number(a.propia) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
    res.json(salida);
  });
}
