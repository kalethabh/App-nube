// Los nombres de los modelos de IA como los ve el alumno, leídos del motor (produccion/config.js) SOLO
// COMO TEXTO: no se importa ni se ejecuta nada del motor. Así, cuando el motor cambia de modelo
// (p. ej. Kling 3.0 -> Kling 4.0), la app lo muestra sola sin tocar su código.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './rutas.js';

const CONFIG_MOTOR = path.join(RAIZ, 'produccion', 'config.js');
let cache = null; // { mtime, valor }

/** 'kling-4.0/keyframe-to-video' -> 'Kling 4.0' · 'google/gemini-omni-flash-1-1' -> 'Omni Flash 1.1' · ... */
export function nombreDeModelo(m, { respaldoActual } = {}) {
  const s = String(m || '').toLowerCase();
  if (!s) return null;
  if (s.includes('omni')) {
    const v = s.match(/flash[-_ ]?(\d+)[-_.](\d+)/);
    return v ? `Omni Flash ${v[1]}.${v[2]}` : 'Omni Flash';
  }
  if (s.includes('kling')) {
    const v = s.match(/kling[-_ v]*(\d+(?:\.\d+)?)/);
    return v ? `Kling ${v[1]}` : respaldoActual || 'Kling';
  }
  if (s.includes('sunburst')) {
    const v = s.match(/gpt-image-(\d+)-(\d+)/);
    return v ? `GPT Image ${v[1]}.${v[2]}` : 'GPT Image';
  }
  if (s.includes('gpt-image')) {
    const v = s.match(/gpt-image-(\d+)(?:-(\d+))?/);
    return v ? `GPT Image ${v[1]}${v[2] ? `.${v[2]}` : ''}` : 'GPT Image';
  }
  if (s.includes('nano-banana')) return 'Nano Banana';
  if (s.includes('seedream')) return 'Seedream';
  if (s.includes('veo')) return 'Veo';
  if (s.includes('suno')) return 'Suno';
  return null;
}

/** { imagen, video, respaldo, musica }: los nombres de los modelos que usa el motor hoy. */
export function modelosDelMotor() {
  let mtime = 0;
  try {
    mtime = fs.statSync(CONFIG_MOTOR).mtimeMs;
  } catch {
    /* sin motor: valores de siempre */
  }
  if (cache && cache.mtime === mtime) return cache.valor;
  let texto = '';
  try {
    texto = fs.readFileSync(CONFIG_MOTOR, 'utf8');
  } catch {
    texto = '';
  }
  const bloqueVideo = texto.match(/video:\s*\{([\s\S]*?)\n\s{2}\}/)?.[1] || '';
  const principal = bloqueVideo.match(/principal:\s*'([^']+)'/)?.[1];
  const respaldo = bloqueVideo.match(/respaldo:\s*'([^']+)'/)?.[1];
  const imagen = texto.match(/MODELO_IMAGEN_POR_DEFECTO\s*=\s*\{[\s\S]*?cascada:\s*\[\s*'([^']+)'/)?.[1];
  const valor = {
    imagen: nombreDeModelo(imagen) || 'GPT Image 2.5',
    video: nombreDeModelo(principal) || 'Omni Flash 1.1',
    respaldo: nombreDeModelo(respaldo) || 'Kling',
    musica: 'Suno',
  };
  cache = { mtime, valor };
  return valor;
}
