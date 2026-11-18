// Diagnóstico de la conexión con ElevenLabs, FUERA de la app y con la misma clave (la del .env; nunca se muestra):
//   node app/herramientas/diagnostico-elevenlabs.mjs
// Mide lo que hace la app: el usuario (Probar), el plan (el saldo), las voces (la lista de «Voz del narrador»). Si
// aquí todo responde en un segundo y en la app no, el problema es de la app (estaba ocupada); si aquí también tarda,
// es la cuenta o la clave.
import { leerClave } from '../server/lib/claves.js';

const BASE = 'https://api.elevenlabs.io';
const clave = leerClave('ELEVENLABS_API_KEY');
if (!clave) {
  console.log('\n  No encuentro ELEVENLABS_API_KEY en el .env de la app. Pégala en Ajustes → Conexiones y vuelve a correr esto.\n');
  process.exit(1);
}
console.log(`\n  Clave: guardada (${clave.length} caracteres, empieza con ${clave.slice(0, 3)}…)\n`);

const PRUEBAS = [
  ['Probar la clave (usuario)', '/v1/user'],
  ['El saldo (plan)', '/v1/user/subscription'],
  ['Las voces, como ahora (sin conteo)', '/v2/voices?page_size=100&include_total_count=false'],
  ['Las voces, como antes (con conteo)', '/v2/voices?page_size=100'],
  ['Una voz, como «Probar» con permisos recortados', '/v2/voices?page_size=1&include_total_count=false'],
];

for (const [nombre, ruta] of PRUEBAS) {
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + ruta, { headers: { Accept: 'application/json', 'xi-api-key': clave }, signal: AbortSignal.timeout(60000) });
    const texto = await r.text();
    let detalle = '';
    try {
      const j = JSON.parse(texto);
      if (Array.isArray(j.voices)) detalle = `${j.voices.length} voces`;
      else if (j.detail) detalle = String(j.detail.status || j.detail.code || j.detail.message || JSON.stringify(j.detail)).slice(0, 80);
    } catch {
      /* no era JSON */
    }
    console.log(`  ${r.ok ? 'OK   ' : 'MAL  '} ${nombre}: ${r.status} en ${((Date.now() - t0) / 1000).toFixed(2)} s ${detalle ? `· ${detalle}` : ''}`);
  } catch (e) {
    console.log(`  FALLA ${nombre}: ${e?.cause?.code || e?.name || e?.message} en ${((Date.now() - t0) / 1000).toFixed(2)} s`);
  }
}
console.log('\n  Copia todo esto y mándalo.\n');
