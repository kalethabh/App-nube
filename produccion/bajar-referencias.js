// Baja los videos de referencia desde sus links (2026-11-07).
//
// Para usar de referencia anuncios que ya venden sin tener que descargarlos a
// mano: links de la Biblioteca de anuncios de Meta
// (https://www.facebook.com/ads/library/?id=...), y también de TikTok,
// Instagram, YouTube o Facebook. Pueden ser varios. Un anuncio con varios
// videos (carrusel) baja todos.
//
//   npm run referencias:bajar -- temp/mi-anuncio/referencia/videos <link> [<link> ...]
//
// Deja en la carpeta ref-01.mp4, ref-02.mp4... y links.json (de que link salio
// cada video, la pagina que lo publico y su texto, si el link lo trae). No cobra
// nada. Usa yt-dlp (gratis); si no esta instalado:  npm run referencias:instalar

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buscarPython } from './recortar-host.js';

/** Como llamar a yt-dlp en este computador, o null. */
export function comandoYtDlp() {
  const prueba = (cmd, pre = []) => spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8', windowsHide: true }).status === 0;
  if (prueba('yt-dlp')) return { cmd: 'yt-dlp', pre: [] };
  const py = buscarPython();
  if (py && prueba(py.cmd, [...py.pre, '-m', 'yt_dlp'])) return { cmd: py.cmd, pre: [...py.pre, '-m', 'yt_dlp'] };
  return null;
}

/** Lo que es un link (y no una ruta de archivo). */
export const esLink = (s) => /^https?:\/\/\S+$/i.test(String(s || '').trim());

/** Un link de la Biblioteca de anuncios de Meta, con su id. */
export const idDeBiblioteca = (s) => String(s).match(/facebook\.com\/ads\/library\/?\?(?:[^#]*&)?id=(\d+)/i)?.[1] || null;

function bajarUno(yt, link, carpeta, desde) {
  const plantilla = path.join(carpeta, `tmp-${desde}-%(autonumber)02d.%(ext)s`);
  const r = spawnSync(
    yt.cmd,
    [...yt.pre, '--no-warnings', '--no-progress', '--yes-playlist', '-f', 'bv*+ba/b', '--merge-output-format', 'mp4', '--write-info-json', '-o', plantilla, '--print', 'after_move:filepath', link],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 }
  );
  if (r.status !== 0) {
    const motivo = String(r.stderr || r.stdout || '').trim().split('\n').filter(Boolean).pop() || 'no se pudo bajar';
    return { error: motivo };
  }
  const archivos = String(r.stdout).trim().split('\n').map((x) => x.trim()).filter((x) => x && fs.existsSync(x));
  return { archivos };
}

if (process.argv[1] && process.argv[1].endsWith('bajar-referencias.js')) {
  const [carpetaArg, ...links] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!carpetaArg || !links.length) {
    console.error('\n  Uso: npm run referencias:bajar -- temp/mi-anuncio/referencia/videos <link> [<link> ...]\n');
    process.exit(1);
  }
  const malos = links.filter((l) => !esLink(l));
  if (malos.length) {
    console.error(`\n  Esto no es un link: ${malos.join(', ')}\n`);
    process.exit(1);
  }
  const yt = comandoYtDlp();
  if (!yt) {
    console.error('\n  Para bajar videos desde un link hace falta yt-dlp (gratis), y no esta instalado.');
    console.error('  Instalalo con:  npm run referencias:instalar');
    console.error('  (o, si el usuario prefiere, que baje el video y lo suba a mano)\n');
    process.exit(2);
  }
  const carpeta = path.resolve(carpetaArg);
  fs.mkdirSync(carpeta, { recursive: true });
  const registro = path.join(carpeta, 'links.json');
  let lista = [];
  try {
    lista = JSON.parse(fs.readFileSync(registro, 'utf8'));
  } catch {
    lista = [];
  }
  let n = lista.reduce((m, x) => Math.max(m, ...(x.videos || []).map((v) => Number(v.match(/ref-(\d+)/)?.[1] || 0))), 0);

  console.log(`\n=== Videos de referencia — ${links.length} link(s) ===\n`);
  let fallaron = 0;
  for (const [i, link] of links.entries()) {
    const ya = lista.find((x) => x.link === link && (x.videos || []).every((v) => fs.existsSync(path.join(carpeta, v))));
    if (ya) {
      console.log(`  ya estaba  ${link}  ->  ${ya.videos.join(', ')}`);
      continue;
    }
    const r = bajarUno(yt, link, carpeta, i + 1);
    if (r.error || !r.archivos?.length) {
      fallaron++;
      console.log(`  NO SE PUDO  ${link}\n             ${r.error || 'el link no trae ningun video'}`);
      continue;
    }
    const videos = [];
    let info = {};
    for (const a of r.archivos) {
      const nombre = `ref-${String(++n).padStart(2, '0')}.mp4`;
      fs.renameSync(a, path.join(carpeta, nombre));
      const json = a.replace(/\.[^.]+$/, '.info.json');
      if (fs.existsSync(json)) {
        try {
          const j = JSON.parse(fs.readFileSync(json, 'utf8'));
          info = { pagina: j.uploader || j.channel || null, texto: (j.description || j.title || '').slice(0, 2000) || null, duracion: j.duration || null };
        } catch {
          /* sin datos igual sirve */
        }
        fs.rmSync(json, { force: true });
      }
      videos.push(nombre);
    }
    for (const f of fs.readdirSync(carpeta)) if (f.startsWith(`tmp-${i + 1}-`)) fs.rmSync(path.join(carpeta, f), { force: true });
    lista = lista.filter((x) => x.link !== link);
    lista.push({ link, biblioteca: idDeBiblioteca(link), videos, ...info, bajado: new Date().toISOString() });
    console.log(`  OK  ${link}  ->  ${videos.join(', ')}${info.pagina ? `  (${info.pagina})` : ''}`);
  }
  fs.writeFileSync(registro, JSON.stringify(lista, null, 2) + '\n', 'utf8');
  console.log(`\n  En ${path.relative(process.cwd(), carpeta) || carpeta}. Cada video se analiza despues como cualquier video de referencia.`);
  if (fallaron) console.log(`  ${fallaron} link(s) no se pudieron bajar: pidele al usuario que baje ese video y lo suba.`);
  console.log('');
  process.exit(fallaron === links.length ? 1 : 0);
}
