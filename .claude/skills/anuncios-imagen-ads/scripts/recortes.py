"""
Prepara una imagen generada para la revision automatica (PASO 6).

Las imagenes completas se ven reducidas al abrirlas, y asi se escapan tildes, letras
cambiadas o espacios que faltan. Este script corta cada imagen en cuatro cuartos con
solape (cada uno ~56% del lado) a resolucion original, para leer los textos letra por
letra.

Uso:
    python recortes.py <carpeta_lote> [--fase cuadrado|vertical] [--solo V01,V03]

Salida:
    <carpeta_lote>/revision/V01_1x1_r1.png ... _r4.png
"""
from __future__ import annotations
import sys
from pathlib import Path

LADO = 0.56


def recortar(imagen: Path, destino: Path) -> list[Path]:
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Falta la libreria Pillow. Instalala con: python -m pip install pillow")

    im = Image.open(imagen).convert("RGB")
    W, H = im.size
    ancho, alto = round(W * LADO), round(H * LADO)
    destino.mkdir(parents=True, exist_ok=True)
    rutas = []
    for n, (x, y) in enumerate([(0, 0), (W - ancho, 0), (0, H - alto), (W - ancho, H - alto)], 1):
        ruta = destino / f"{imagen.stem}_r{n}.png"
        im.crop((x, y, x + ancho, y + alto)).save(ruta)
        rutas.append(ruta)
    return rutas


def opcion(nombre: str):
    return sys.argv[sys.argv.index(nombre) + 1] if nombre in sys.argv else None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    lote = Path(args[0])
    sufijo = "9x16" if opcion("--fase") == "vertical" else "1x1"
    solo = set((opcion("--solo") or "").split(",")) - {""}

    imagenes = sorted((lote / "imagenes").glob(f"V*_{sufijo}.png"))
    if solo:
        imagenes = [i for i in imagenes if i.stem.split("_")[0] in solo]
    if not imagenes:
        sys.exit(f"No hay imagenes *_{sufijo}.png que revisar en {lote / 'imagenes'}")

    for img in imagenes:
        rutas = recortar(img, lote / "revision")
        print(f"[recortes] {img.name} -> {', '.join(r.name for r in rutas)}")


if __name__ == "__main__":
    main()
