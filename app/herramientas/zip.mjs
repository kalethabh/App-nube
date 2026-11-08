// El escritor de zip del paquete (Node puro, sin dependencias). Lo usan el empaquetador (produccion/empaquetar-app.js)
// y la prueba de GitHub (.github/workflows/prueba-mac-windows.yml), que arma con él un zip de la app, lo descomprime
// como lo haría el alumno (ditto en Mac, Expand-Archive en Windows) en una carpeta con espacios y tildes, y abre el
// lanzador desde ahí: así se prueba que la Mac deja el .command ejecutable al descomprimir.
//
//   node app/herramientas/zip.mjs <destino.zip> [carpeta]
//     comprime [carpeta] (por defecto, la de la app: dos carpetas arriba de este archivo) dentro de "Anuncios con IA/",
//     sin .git, node_modules, temp/ y output/ con contenido (van vacías) ni el informe de la prueba de humo.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const YA_COMPRIMIDO = /\.(mp4|m4a|mp3|aac|png|jpe?g|webp|gif|zip|woff2?|ogg|webm|gz|7z)$/i;

function fechaDos(d) {
  const anio = Math.max(1980, d.getFullYear());
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    dia: ((anio - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Escribe un zip. `entradas`: [{ nombre (con /), origen (archivo) o null (carpeta), ejecutable }].
 * Nombres en UTF-8 (bandera 11), "hecho en Unix" con los permisos en los atributos externos (asi la
 * Mac deja el .command ejecutable al descomprimir), deflate salvo lo que ya viene comprimido. Sin zip64:
 * frena si pasa de 4 GB o de 65535 entradas.
 */
export function escribirZip(destino, entradas) {
  if (entradas.length > 0xfffe) throw new Error('demasiados archivos para un zip sin zip64');
  const fd = fs.openSync(destino, 'w');
  const central = [];
  let pos = 0;
  const escribir = (buf) => {
    fs.writeSync(fd, buf);
    pos += buf.length;
  };
  try {
    for (const e of entradas) {
      const nombre = Buffer.from(e.nombre, 'utf8');
      const carpeta = !e.origen;
      const datos = carpeta ? Buffer.alloc(0) : fs.readFileSync(e.origen);
      const crc = carpeta ? 0 : zlib.crc32(datos);
      let metodo = 0;
      let comp = datos;
      if (!carpeta && datos.length > 64 && !YA_COMPRIMIDO.test(e.nombre)) {
        const d = zlib.deflateRawSync(datos, { level: 9 });
        if (d.length < datos.length) {
          metodo = 8;
          comp = d;
        }
      }
      const { hora, dia } = fechaDos(carpeta ? new Date() : fs.statSync(e.origen).mtime);
      const desde = pos;
      if (desde > 0xffffffff - comp.length - 1024) throw new Error('el zip pasaria de 4 GB (sin zip64)');
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0800, 6);
      local.writeUInt16LE(metodo, 8);
      local.writeUInt16LE(hora, 10);
      local.writeUInt16LE(dia, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(comp.length, 18);
      local.writeUInt32LE(datos.length, 22);
      local.writeUInt16LE(nombre.length, 26);
      local.writeUInt16LE(0, 28);
      escribir(local);
      escribir(nombre);
      if (comp.length) escribir(comp);
      const modo = carpeta ? 0o40755 : e.ejecutable ? 0o100755 : 0o100644;
      central.push({ nombre, metodo, hora, dia, crc, comp: comp.length, tam: datos.length, desde, atributos: ((modo << 16) | (carpeta ? 0x10 : 0)) >>> 0 });
    }
    const inicioCentral = pos;
    for (const c of central) {
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0);
      h.writeUInt16LE((3 << 8) | 30, 4); // hecho en Unix, zip 3.0
      h.writeUInt16LE(20, 6);
      h.writeUInt16LE(0x0800, 8);
      h.writeUInt16LE(c.metodo, 10);
      h.writeUInt16LE(c.hora, 12);
      h.writeUInt16LE(c.dia, 14);
      h.writeUInt32LE(c.crc, 16);
      h.writeUInt32LE(c.comp, 20);
      h.writeUInt32LE(c.tam, 24);
      h.writeUInt16LE(c.nombre.length, 28);
      h.writeUInt16LE(0, 30);
      h.writeUInt16LE(0, 32);
      h.writeUInt16LE(0, 34);
      h.writeUInt16LE(0, 36);
      h.writeUInt32LE(c.atributos, 38);
      h.writeUInt32LE(c.desde, 42);
      escribir(h);
      escribir(c.nombre);
    }
    const tamCentral = pos - inicioCentral;
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50, 0);
    fin.writeUInt16LE(central.length, 8);
    fin.writeUInt16LE(central.length, 10);
    fin.writeUInt32LE(tamCentral, 12);
    fin.writeUInt32LE(inicioCentral, 16);
    escribir(fin);
  } finally {
    fs.closeSync(fd);
  }
}

export const esEjecutable = (rel) => /\.(command|sh)$/i.test(rel);

// ---------------------------------------------------------------- uso directo (la prueba de GitHub)
const SALTAR = new Set(['.git', 'node_modules', 'prueba-humo-informe', '.actualizando', 'respaldos']);

function principal([destino, carpeta]) {
  if (!destino) {
    console.error('Uso: node app/herramientas/zip.mjs <destino.zip> [carpeta]');
    process.exit(1);
  }
  const raiz = path.resolve(carpeta || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const fin = path.resolve(destino);
  const entradas = [];
  const recorrer = (rel) => {
    for (const d of fs.readdirSync(path.join(raiz, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (SALTAR.has(d.name) || path.join(raiz, r) === fin) continue;
      if (!rel && (d.name === 'temp' || d.name === 'output')) continue; // van vacias
      if (d.isDirectory()) recorrer(r);
      else if (d.isFile()) entradas.push({ nombre: `Anuncios con IA/${r}`, origen: path.join(raiz, r), ejecutable: esEjecutable(r) });
    }
  };
  recorrer('');
  for (const v of ['temp', 'output']) entradas.push({ nombre: `Anuncios con IA/${v}/`, origen: null });
  escribirZip(fin, entradas);
  console.log(`${fin}: ${entradas.length} entradas, ${(fs.statSync(fin).size / 1024 / 1024).toFixed(1)} MB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal(process.argv.slice(2));
