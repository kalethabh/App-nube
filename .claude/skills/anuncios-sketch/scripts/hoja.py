"""Hojas de revisión visual (para mirarlas con Read antes de gastar en la siguiente etapa).

  python hoja.py <carpeta> refs     personajes y locaciones en una sola imagen
  python hoja.py <carpeta> frames   los fotogramas en fila, con la toma y la mirada esperada ("mira")
  python hoja.py <carpeta> clips    cada clip completo en 4 instantes (15/40/65/90 % de su duración), 5 clips por hoja
  python hoja.py <carpeta> caras    igual que clips pero recortado a la mitad superior (caras más grandes)
  python hoja.py <carpeta> final    un fotograma (el del medio) de cada toma ya montada (montaje/sXX.mp4)
Salida: <carpeta>/revision/hoja_*.png"""
import subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import Proyecto, duracion, fuente  # noqa: E402


def rotulo(im, txt, sub=""):
    d = ImageDraw.Draw(im)
    f1 = ImageFont.truetype(fuente("negrita"), max(16, im.width // 12))
    f2 = ImageFont.truetype(fuente("normal"), max(13, im.width // 18))
    h = f1.size + (f2.size + 8 if sub else 0) + 10
    d.rectangle([0, 0, im.width, h], fill=(0, 0, 0))
    d.text((8, 2), txt, font=f1, fill="yellow")
    if sub:
        d.text((8, f1.size + 6), sub, font=f2, fill="white")
    return im


def encajar(im, w, h):
    im = im.copy()
    im.thumbnail((w, h))
    c = Image.new("RGB", (w, h), "black")
    c.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    return c


def instante(path, t):
    out = Path(tempfile.gettempdir()) / f"hoja_{abs(hash((str(path), round(t, 2))))}.png"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{t:.2f}", "-i", str(path), "-frames:v", "1", str(out)])
    return Image.open(out).convert("RGB") if out.exists() else None


def grilla(tiles, cols):
    w, h = tiles[0].size
    s = Image.new("RGB", (w * cols, h * ((len(tiles) + cols - 1) // cols)), "black")
    for i, t in enumerate(tiles):
        s.paste(t, ((i % cols) * w, (i // cols) * h))
    return s


def apilar(filas, nombre, dst, por_hoja):
    salidas = []
    for i in range(0, len(filas), por_hoja):
        grupo = filas[i:i + por_hoja]
        hoja = Image.new("RGB", (max(g.width for g in grupo), sum(g.height for g in grupo)), "black")
        y = 0
        for g in grupo:
            hoja.paste(g, (0, y))
            y += g.height
        f = dst / f"{nombre}_{i // por_hoja + 1}.png"
        hoja.save(f)
        salidas.append(f)
    return salidas


def main():
    if len(sys.argv) < 3 or sys.argv[2] not in ("refs", "frames", "clips", "caras", "final"):
        sys.exit(__doc__)
    P, modo = Proyecto(sys.argv[1]), sys.argv[2]
    dst = P.dir / "revision"
    dst.mkdir(exist_ok=True)
    m = P.man()
    aspecto = P.p.get("formato", {}).get("aspecto", "9:16")
    aw, ah = (float(x) for x in aspecto.split(":"))
    tw, th = (360, int(360 * ah / aw)) if ah >= aw else (int(360 * aw / ah), 360)
    salidas = []
    if modo == "refs":
        tiles = [rotulo(encajar(Image.open(P.archivo(k)).convert("RGB"), 900, 900), k)
                 for k in [f"char_{c}" for c in P.p["personajes"]] + [f"loc_{l}" for l in P.p["locaciones"]] if k in m]
        if tiles:
            grilla(tiles, 3).save(dst / "hoja_refs.png")
            salidas.append(dst / "hoja_refs.png")
    elif modo == "frames":
        tiles = [rotulo(encajar(Image.open(P.archivo(f"frame_{t['id']}")).convert("RGB"), tw, th), t["id"], t.get("mira", ""))
                 for t in P.p["tomas"] if P.archivo(f"frame_{t['id']}")]
        if tiles:
            grilla(tiles, 10).save(dst / "hoja_frames.png")
            salidas.append(dst / "hoja_frames.png")
    elif modo in ("clips", "caras"):
        filas = []
        for t in P.p["tomas"]:
            f = P.archivo(f"clip_{t['id']}")
            if not f or t.get("imagen_fija"):
                continue
            d = duracion(f)
            tiles = []
            for frac in (0.15, 0.40, 0.65, 0.90):
                im = instante(f, d * frac)
                if im is None:
                    continue
                if modo == "caras":
                    im = im.crop((0, 0, im.width, int(im.height * 0.55)))
                    im = im.resize((360, int(360 * im.height / im.width)))
                else:
                    im = encajar(im, tw, th)
                tiles.append(rotulo(im, f"{t['id']} {d * frac:.1f}s", t.get("mira", "") if frac == 0.15 else ""))
            if tiles:
                filas.append(grilla(tiles, 4))
        salidas = apilar(filas, f"hoja_{modo}", dst, 5 if modo == "clips" else 6)
    elif modo == "final":
        tiles = []
        for t in P.p["tomas"]:
            f = P.dir / "montaje" / f"{t['id']}.mp4"
            if f.exists():
                im = instante(f, duracion(f) / 2)
                if im:
                    tiles.append(rotulo(encajar(im, tw, th), t["id"], t.get("mira", "")))
        if tiles:
            grilla(tiles, 10).save(dst / "hoja_final.png")
            salidas.append(dst / "hoja_final.png")
    if not salidas:
        sys.exit(f"No hay material para la hoja '{modo}' todavía.")
    print("\n".join(map(str, salidas)))


if __name__ == "__main__":
    main()
