// Quitar el fondo de la foto del producto, GRATIS y en la computadora, solo si ya se puede: con rembg (el que usa el
// podcast en esquina, produccion/recortar-host.py) y un modelo que ya esté bajado. Nunca baja nada ni instala nada:
// si falta, las plantillas ponen la foto sobre una tarjeta limpia.
//
//   recortar(foto, carpetaDelProducto) -> ruta del PNG sin fondo | null
// Se guarda en la carpeta del producto (recorte-<sha1 de la foto>.png): cada foto se recorta una sola vez.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

const CODIGO = `
import sys, os
from pathlib import Path
foto, salida = sys.argv[1], sys.argv[2]
try:
    from rembg import new_session, remove
except Exception:
    print("SIN_REMBG"); sys.exit(3)
candidatos = ["birefnet-general-lite", "isnet-general-use", "u2net", "birefnet-general", "u2netp"]
elegido = None
for nombre in candidatos:
    try:
        from rembg.sessions import sessions_class
        clase = next((c for c in sessions_class if c.name() == nombre), None)
        if clase is None:
            continue
        if clase.resolve_existing(f"{clase.name()}.onnx") if hasattr(clase, "resolve_existing") else (Path(clase.model_dir()) / f"{clase.name()}.onnx").exists():
            elegido = nombre
            break
    except Exception:
        continue
if not elegido:
    print("SIN_MODELO"); sys.exit(4)
from PIL import Image
img = Image.open(foto).convert("RGBA")
res = remove(img, session=new_session(elegido))
bbox = res.getbbox()
if bbox:
    res = res.crop(bbox)
tmp = salida + ".tmp.png"
res.save(tmp)
os.replace(tmp, salida)
print("OK", elegido)
`;

const python = process.platform === 'win32' ? 'python' : 'python3';

export function recortar(foto, carpetaProducto) {
  return new Promise((resolve) => {
    let sha;
    try {
      sha = crypto.createHash('sha1').update(fs.readFileSync(foto)).digest('hex').slice(0, 12);
    } catch {
      resolve(null);
      return;
    }
    const dir = carpetaProducto && fs.existsSync(carpetaProducto) ? carpetaProducto : path.dirname(foto);
    const salida = path.join(dir, `recorte-${sha}.png`);
    if (fs.existsSync(salida)) {
      resolve(salida);
      return;
    }
    execFile(python, ['-E', '-c', CODIGO, foto, salida], { timeout: 180000, windowsHide: true }, (err, stdout) => {
      resolve(!err && /^OK/m.test(String(stdout)) && fs.existsSync(salida) ? salida : null);
    });
  });
}
