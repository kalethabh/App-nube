"""Utilidades compartidas: proyecto.json, manifest.json, ffmpeg, fuentes y prompts."""
import json, os, re, shutil, subprocess, sys, tempfile, threading
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
LOCK = threading.RLock()
for _s in (sys.stdout, sys.stderr):  # tildes y ñ bien impresas en la consola de Windows
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

HOMBRE = {"m", "male", "man", "h", "hombre", "masculino", "masc"}
MUJER = {"f", "female", "woman", "mujer", "femenino", "fem"}


# ---------- proyecto y manifest ----------
class Proyecto:
    def __init__(self, carpeta, validar=True):
        self.dir = Path(carpeta).resolve()
        f = self.dir / "proyecto.json"
        if not f.exists():
            sys.exit(f"No existe {f}. Copia assets/plantilla_proyecto.json (o ejemplo/proyecto.json) y complétalo.")
        self.p = json.loads(f.read_text(encoding="utf-8"))
        self.man_f = self.dir / "manifest.json"
        self.tomas = {t["id"]: t for t in self.p.get("tomas", []) if "id" in t}
        os.environ.setdefault("KIE_PROYECTO", str(self.dir))  # kie.py busca el .env también desde aquí
        if validar:
            self.validar()

    def validar(self):
        err = []
        pj, locs = self.p.get("personajes", {}), self.p.get("locaciones", {})
        for k in ("estilo", "locaciones", "personajes", "tomas"):
            if k not in self.p:
                err.append(f"falta '{k}' en proyecto.json")
        for cid, c in pj.items():
            for k in ("descripcion", "aspecto", "voz"):
                if k not in c:
                    err.append(f"personaje {cid}: falta '{k}'")
        vistos = set()
        for t in self.p.get("tomas", []):
            sid = t.get("id")
            if not sid:
                err.append("una toma no tiene 'id'")
                continue
            if sid in vistos:
                err.append(f"toma {sid} repetida")
            vistos.add(sid)
            if t.get("tarjeta"):  # tarjeta de texto: no lleva personajes, locación ni imagen
                if not t["tarjeta"].get("texto"):
                    err.append(f"{sid}: la tarjeta necesita 'texto'")
                continue
            for c in t.get("personajes", []):
                if c not in pj:
                    err.append(f"{sid}: el personaje '{c}' no existe en 'personajes'")
            if t.get("locacion", "principal") not in locs:
                err.append(f"{sid}: la locación '{t.get('locacion', 'principal')}' no existe (pon 'locacion' en la toma o crea 'principal')")
            if t.get("habla") and t["habla"] not in pj:
                err.append(f"{sid}: 'habla' = '{t['habla']}' no es un personaje")
            elif t.get("habla") and t["habla"] not in t.get("personajes", []):
                err.append(f"{sid}: '{t['habla']}' habla pero no está en 'personajes' de la toma "
                           "(agrégalo: el modelo necesita su referencia para la sincronía de labios)")
            if t.get("habla") in pj and str(pj[t["habla"]].get("genero", "")).strip().lower() not in HOMBRE | MUJER:
                err.append(f"personaje {t['habla']}: 'genero' falta o no se reconoce (usa 'f' o 'm')")
            if t.get("habla") and not t.get("linea"):
                err.append(f"{sid}: tiene 'habla' pero no 'linea'")
            if t.get("linea") and not t.get("habla"):
                err.append(f"{sid}: tiene 'linea' pero no dice quién la dice ('habla')")
            if "encuadre" not in t:
                err.append(f"{sid}: falta 'encuadre'")
            if t.get("producto") and not self.p.get("producto", {}).get("descripcion"):
                err.append(f"{sid}: usa el producto pero falta 'producto.descripcion'")
        for k, v in self.p.get("variables", {}).items():
            if not isinstance(v, str):
                err.append(f"variable {k}: debe ser texto")
        if err:
            sys.exit("proyecto.json tiene problemas:\n- " + "\n- ".join(dict.fromkeys(err)))

    # variables {NOMBRE} usables en cualquier texto del proyecto (fondos, producto, etc.)
    def fmt(self, texto):
        if not isinstance(texto, str):
            return texto
        vars_ = {k: str(v) for k, v in self.p.get("variables", {}).items()}
        for _ in range(3):  # permite variables que contienen variables
            texto = re.sub(r"\{([A-Z0-9_]+)\}", lambda m: vars_.get(m.group(1), m.group(0)), texto)
        return texto

    def man(self, pendientes=False):
        """Manifest. Por defecto oculta las tareas pendientes (creadas en Kie pero sin resultado aún)."""
        with LOCK:
            m = json.loads(self.man_f.read_text(encoding="utf-8")) if self.man_f.exists() else {}
        return m if pendientes else {k: v for k, v in m.items() if not v.get("pendiente")}

    def _escribir(self, m):
        tmp = self.man_f.with_suffix(".tmp")
        tmp.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, self.man_f)  # escritura atómica: nunca queda un manifest a medias

    def guardar(self, clave, valor):
        with LOCK:
            m = self.man(pendientes=True)
            m[clave] = valor
            self._escribir(m)

    def borrar(self, clave):
        with LOCK:
            m = self.man(pendientes=True)
            m.pop(clave, None)
            self._escribir(m)

    def archivar(self, clave):
        """Mueve la entrada a clave_vN (para regenerar sin perder la anterior)."""
        with LOCK:
            m = self.man(pendientes=True)
            if clave not in m:
                return None
            n = 1
            while f"{clave}_v{n}" in m:
                n += 1
            m[f"{clave}_v{n}"] = m.pop(clave)
            self._escribir(m)
            return f"{clave}_v{n}"

    def archivo(self, clave):
        v = self.man().get(clave)
        if not v or not v.get("file"):
            return None
        f = Path(v["file"])
        return f if f.is_absolute() else self.dir / f

    def ids(self, pedidos=None):
        pedidos = [p for p in (pedidos or []) if p]
        for p in pedidos:
            if p not in self.tomas:
                sys.exit(f"No existe la toma '{p}'. Tomas: {', '.join(self.tomas)}")
        return pedidos or [t["id"] for t in self.p["tomas"]]

    def nombre(self, cid):
        return self.p["personajes"][cid].get("nombre", cid).upper()

    def es_hombre(self, cid):
        return str(self.p["personajes"][cid].get("genero", "f")).strip().lower() in HOMBRE

    def orientacion(self):
        a = self.p.get("formato", {}).get("aspecto", "9:16")
        w, h = (float(x) for x in a.split(":"))
        return ("vertical" if h > w else "horizontal" if w > h else "square") + f" {a}"


# ---------- ffmpeg ----------
def ff(*args):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *map(str, args)], check=True)


def sonda(path, campos="format=duration"):
    return subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", campos, "-of", "csv=p=0", str(path)]).decode().strip()


def duracion(path):
    return float(sonda(path).splitlines()[0])


def tiene_audio(path):
    return bool(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                                "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout.strip())


def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return float(re.findall(r"I:\s+(-?[0-9.]+) LUFS", r.stderr)[-1])


def pico(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return float(re.findall(r"Peak:\s+(-?[0-9.]+) dBFS", r.stderr)[-1])


def cortes_internos(path, umbral=0.3):
    """Tiempos donde el clip cambia de plano por su cuenta (o hay un destello fuerte)."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-vf", f"select='gt(scene,{umbral})',showinfo",
                        "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    return [float(x) for x in re.findall(r"pts_time:([0-9.]+)", r.stderr)]


# ---------- fuentes (para textos en pantalla) ----------
FUENTES = {
    "negrita": ["C:/Windows/Fonts/seguibl.ttf", "C:/Windows/Fonts/arialbd.ttf",
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
    "normal": ["C:/Windows/Fonts/seguisb.ttf", "C:/Windows/Fonts/arial.ttf",
               "/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"],
}


def fuente(tipo="normal", proyecto=None):
    propia = (proyecto or {}).get("fuentes", {}).get(tipo)
    for f in ([propia] if propia else []) + FUENTES.get(tipo, FUENTES["normal"]):
        if f and Path(f).exists():
            return f
    sys.exit("No encontré una fuente TrueType; indica 'fuentes': {'negrita': ruta, 'normal': ruta} en proyecto.json")


def tmp_seguro(origen, nombre):
    """Copia un archivo a una ruta temporal sin espacios, apóstrofos ni dos puntos raros (para filtros de ffmpeg)."""
    d = Path(tempfile.gettempdir()) / "anuncios_sketch"
    d.mkdir(exist_ok=True)
    dst = d / nombre
    if Path(origen) != dst:
        shutil.copyfile(origen, dst)
    return dst


def ruta_ffmpeg(path):
    """Ruta escapada para filtros de ffmpeg (drawtext fontfile/textfile)."""
    return str(path).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


# ---------- prompts ----------
def linea_de(P, t):
    """La línea tal como se dice (con las {VARIABLES} ya reemplazadas)."""
    return P.fmt(t.get("linea") or "")


def personajes_txt(P, ids):
    return " ".join(P.fmt(P.p["personajes"][c]["descripcion"]) + "." for c in ids)


def prompt_ref_personaje(P, cid):
    c = P.p["personajes"][cid]
    return (f"Character reference sheet on a plain warm light-grey studio background, three views side by side: full body front view, "
            f"medium shot three-quarter view, and close-up portrait. Same person, same outfit in all views. {P.fmt(c['descripcion'])}. "
            f"Soft natural studio light, photorealistic, natural skin texture, no text, no labels.")


def prompt_ref_locacion(P, lid):
    return f"Wide establishing shot, empty of people. {P.fmt(P.p['locaciones'][lid])}. {P.fmt(P.p['estilo'])}"


def prompt_fotograma(P, t):
    chars = t.get("personajes", [])
    loc = t.get("locacion", "principal")
    orden = [P.nombre(c) for c in chars] + [f"the location ({loc})"] + (["the product"] if t.get("producto") else [])
    p = (f"{P.orientacion().capitalize()} frame from a {P.p.get('genero', 'comedic telenovela-style sketch')}. "
         f"{P.fmt(t['encuadre'])}. {personajes_txt(P, chars)} ")
    p += (f"Reference images in this order: {', '.join(orden)}. ")
    if chars:
        p += "Keep each character's face, hair and outfit exactly as in their reference sheet. "
    p += f"Location: {P.fmt(P.p['locaciones'][loc])}, matching the location reference. "
    if chars and not t.get("a_camara"):
        p += ("Characters look at each other, never into the camera lens. " if len(chars) > 1
              else f"{P.nombre(chars[0])} never looks into the camera lens. ")
    if t.get("producto"):
        p += (f"The product is exactly the one in the product reference image: {P.fmt(P.p['producto']['descripcion'])}; "
              f"reproduce its packaging and printed text faithfully and legibly. ")
    return p + P.fmt(P.p["estilo"])


def prompt_video(P, t):
    """Prompt del clip. La línea de diálogo se protege de 'reemplazos' (que solo cambian el resto del texto)."""
    v = P.p.get("video", {})
    chars = t.get("personajes", [])
    partes = [P.fmt(v.get("aviso_edades", "")),
              f"{P.fmt(v.get('genero', 'Cinematic comedic telenovela sketch'))}, {P.orientacion()}.",
              f"{P.fmt(t['encuadre'])}.",
              "ONE single continuous shot from start to end: no cuts, no scene changes, no change of camera angle.",
              f"{P.fmt(t.get('camara', v.get('camara', 'Static camera on a tripod with a very subtle slow push-in, shallow depth of field, golden hour light')))}.",
              f"Action: {P.fmt(t.get('accion', ''))}."]
    if t.get("miradas"):
        partes.append(f"Eyelines: {P.fmt(t['miradas'])}.")
    spk = t.get("habla")
    if spk:
        c = P.p["personajes"][spk]
        pr = "He" if P.es_hombre(spk) else "She"
        partes.append(f"SPEAKER: {P.nombre(spk)} ({P.fmt(c['aspecto'])}) is the ONLY person who talks in this clip. "
                      f"{pr} starts talking within the first half second and says in {P.p.get('idioma_dialogo', 'Spanish')}, "
                      f"{P.fmt(t.get('entrega', 'natural'))}, with a {P.fmt(c['voz'])}: \"@@LINEA@@\" "
                      f"{pr} says exactly those words and nothing else, with perfect lip sync, and then stays quiet.")
        for o in chars:
            if o != spk:
                partes.append(f"{P.nombre(o)} ({P.fmt(P.p['personajes'][o]['aspecto'])}) does NOT talk: mouth closed for the "
                              "whole clip, only silent facial reactions and small gestures.")
        partes.append("Audio: natural dialogue and soft ambience of the location only.")
    else:
        partes.append("Nobody talks in this clip: every mouth stays closed; no voices, no off-screen voices. "
                      "Audio: soft ambience of the location only.")
    partes.append("No background music, no subtitles, no on-screen text.")
    keep = (["faces", "outfits"] if chars else []) + (["the product"] if t.get("producto") else [])
    if keep:
        partes.append(f"Keep {', '.join(keep[:-1]) + ' and ' + keep[-1] if len(keep) > 1 else keep[0]} consistent with the first frame.")
    p = " ".join(x for x in partes if x)
    for a, b in v.get("reemplazos", {}).items():  # palabras que disparan filtros del modelo de video (no tocan la línea)
        p = p.replace(a, b)
    p = p.replace("@@LINEA@@", linea_de(P, t))
    return " ".join(p.split())
