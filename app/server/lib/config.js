// Ajustes de la app, en app/config.json. Las claves NO van aca: van al .env de la raiz (lib/claves.js).
//
//   leerConfig()                      -> { preferencias, bienvenidaVista, vozPorEstilo, ... }
//   guardarConfig({ algo })           -> junta los cambios con lo que habia (primer nivel) y guarda
//   vozDeEstilo('claymation')         -> { id, nombre } | null   (la ultima voz elegida para ese estilo)
//   recordarVoz('claymation', voz)    -> la guarda para la proxima vez
//
// Los videos y la musica los hace siempre kie.ai. Las imagenes de los anuncios de imagen: `motorImagenes` ('chatgpt' |
// 'kie', lib/motor-imagenes.js; sin la clave, ChatGPT).
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, CONFIG_PRINCIPAL } from './rutas.js';
import { leerJSON, escribirJSONSeguro } from './archivos.js';

// Lo que guardaban versiones anteriores y ya no se usa: se borra al guardar.
const VIEJO = ['proveedor'];

export function leerConfig() {
  // una app de prueba sin sus ajustes todavia arranca con los de siempre (solo los lee: nunca los escribe)
  const c = leerJSON(CONFIG) ?? (CONFIG !== CONFIG_PRINCIPAL ? leerJSON(CONFIG_PRINCIPAL) : null);
  const config = c && typeof c === 'object' && !Array.isArray(c) ? { ...c } : {};
  for (const k of VIEJO) delete config[k];
  return config;
}

export function guardarConfig(cambios) {
  const nueva = { ...leerConfig(), ...cambios };
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
  escribirJSONSeguro(CONFIG, nueva);
  return nueva;
}

// ---------------------------------------------------------------- voz por estilo

const ID_VOZ = /^[A-Za-z0-9_-]{1,64}$/;

/** La ultima voz que se eligio para un estilo: { id, nombre } o null. */
export function vozDeEstilo(estilo) {
  const v = leerConfig().vozPorEstilo?.[estilo];
  return v && typeof v.id === 'string' && ID_VOZ.test(v.id) ? { id: v.id, nombre: typeof v.nombre === 'string' ? v.nombre : v.id } : null;
}

/** Guarda la voz de un estilo ({ id, nombre }) sin tocar la de los demas. */
export function recordarVoz(estilo, voz) {
  if (typeof estilo !== 'string' || !estilo || !voz || typeof voz.id !== 'string' || !ID_VOZ.test(voz.id)) return leerConfig();
  const actuales = leerConfig().vozPorEstilo;
  const vozPorEstilo = { ...(actuales && typeof actuales === 'object' ? actuales : {}) };
  vozPorEstilo[estilo] = { id: voz.id, nombre: String(voz.nombre || voz.id).slice(0, 80) };
  return guardarConfig({ vozPorEstilo });
}
