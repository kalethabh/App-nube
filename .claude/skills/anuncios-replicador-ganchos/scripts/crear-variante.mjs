// Prepara una VARIANTE de un anuncio con narrador en voz en off para cambiarle
// solo el gancho. Copia temp/<anuncio>/ a temp/<anuncio>-gancho-<id>/ y, en la
// copia, pasa a historial/ lo que el gancho nuevo obliga a rehacer:
//   - las imágenes y los clips de las tomas del gancho (por defecto, la 1)
//   - la voz (audio/voz.mp3 y sus tiempos): la voz es un solo archivo, así que
//     se vuelve a generar entera con la frase nueva (centavos)
//   - el plan de montaje y los subtítulos, que dependen de los tiempos
// Todo lo demás (las otras imágenes y clips, la música, las transiciones) se
// queda: el motor no vuelve a pagar lo que ya existe.
//
//   node .claude/skills/anuncios-replicador-ganchos/scripts/crear-variante.mjs temp/mi-anuncio 2 [--tomas 1,2] [--con-broll] [--reemplazar]
//
//   --con-broll  también rehace el B-roll que acompaña a esas tomas (si el gancho
//                nuevo cuenta otra cosa y el B-roll viejo ya no le calza)
//
// Después: editar en la copia el manifiesto (las tomas del gancho y la primera
// frase de voz_en_off) y producir como dice la skill. La carpeta original no se toca.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const iTomas = args.indexOf('--tomas');
const [carpetaArg, id] = args.filter((a, i) => !a.startsWith('--') && !(iTomas !== -1 && i === iTomas + 1));
const tomas = iTomas !== -1 ? args[iTomas + 1].split(',').map(Number).filter(Number.isInteger) : [1];
const reemplazar = args.includes('--reemplazar');
const conBroll = args.includes('--con-broll');

if (!carpetaArg || !id || !/^[a-z0-9-]+$/i.test(id) || !fs.existsSync(path.join(carpetaArg, 'manifiesto.json'))) {
  console.error('\n  Uso: node .claude/skills/anuncios-replicador-ganchos/scripts/crear-variante.mjs temp/<anuncio> <id> [--tomas 1,2] [--reemplazar]\n');
  process.exit(1);
}

const origen = path.resolve(carpetaArg);
const manifiesto = JSON.parse(fs.readFileSync(path.join(origen, 'manifiesto.json'), 'utf8'));
if (manifiesto.modo_audio !== 'voz_en_off') {
  console.error(`\n  Este anuncio no es de voz en off (modo_audio: ${manifiesto.modo_audio}).`);
  console.error('  En UGC los ganchos van con ganchos_alternativos y npm run ugc:gancho (ver la skill).\n');
  process.exit(1);
}
const destino = path.join(path.dirname(origen), `${path.basename(origen)}-gancho-${id}`);
if (fs.existsSync(destino)) {
  if (!reemplazar) {
    console.error(`\n  Ya existe ${path.relative(process.cwd(), destino)}. Para rehacerla: --reemplazar\n`);
    process.exit(1);
  }
  fs.rmSync(destino, { recursive: true, force: true });
}

// 1. La copia, sin las versiones anteriores de historial/ ni restos de render
fs.cpSync(origen, destino, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(origen, src).replace(/\\/g, '/');
    return !/^historial(\/|$)/.test(rel) && !/^\.props-remotion\.json$/.test(rel);
  },
});

// 2. Lo que se rehace va a historial/ (no se borra nada)
const historial = path.join(destino, 'historial', `antes-del-gancho-${id}`);
fs.mkdirSync(historial, { recursive: true });
const movidos = [];
const mover = (rel) => {
  const de = path.join(destino, rel);
  if (!fs.existsSync(de)) return;
  const a = path.join(historial, rel);
  fs.mkdirSync(path.dirname(a), { recursive: true });
  fs.renameSync(de, a);
  movidos.push(rel.replace(/\\/g, '/'));
};
const deTomas = (dir) =>
  fs.existsSync(path.join(destino, dir))
    ? fs.readdirSync(path.join(destino, dir)).filter((n) => tomas.some((t) => new RegExp(`^toma-0?${t}(?!\\d)`).test(n)))
    : [];
for (const n of deTomas('img')) mover(path.join('img', n));
for (const n of deTomas('video')) mover(path.join('video', n));
if (conBroll) {
  const nums = (manifiesto.broll || []).filter((b) => tomas.includes(Number(b.encima_de_toma ?? b.despues_de_toma))).map((b) => b.n);
  for (const dir of ['img', 'video']) {
    if (!fs.existsSync(path.join(destino, dir))) continue;
    for (const n of fs.readdirSync(path.join(destino, dir))) if (nums.some((b) => new RegExp(`^broll-0?${b}(?!\\d)`).test(n))) mover(path.join(dir, n));
  }
}
for (const n of ['voz.mp3', 'tiempos.json', 'voz-original.mp3']) mover(path.join('audio', n));
for (const n of fs.readdirSync(destino)) if (/^(plan-montaje|subtitulos)/.test(n)) mover(n);

fs.writeFileSync(
  path.join(destino, 'variante-gancho.json'),
  JSON.stringify({ de: path.basename(origen), id, tomas, fecha: new Date().toISOString(), movidos }, null, 2) + '\n'
);

const rel = path.relative(process.cwd(), destino).replace(/\\/g, '/');
console.log(`\n  Variante lista: ${rel}/`);
console.log(`  Tomas del gancho: ${tomas.join(', ')}. Quedaron en historial/: ${movidos.length ? movidos.join(', ') : 'nada (no había nada generado)'}`);
console.log('\n  Ahora, en el manifiesto de la variante:');
console.log(`    - cambia "linea" (y los prompts) de la(s) toma(s) ${tomas.join(', ')}`);
console.log('    - cambia la(s) misma(s) frase(s) al principio de "voz_en_off"');
console.log(`  y sigue con: npm run validar -- ${rel}/manifiesto.json\n`);
