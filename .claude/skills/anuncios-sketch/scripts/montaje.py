"""Montaje del anuncio desde proyecto.json + manifest.json.

  python montaje.py <carpeta> [--solo-qa] [--forzar] [--recortar-de-nuevo]

1) Recorta cada clip a su línea: transcribe con marcas por palabra y ancla el corte entre la primera y la última
   palabra del guion (0,1 s antes, ~0,2 s después). Prueba medium y large-v3 y se queda con el mejor.
2) Evita los cortes de cámara que el modelo mete dentro del clip (causan "parpadeos").
3) Compara lo dicho con el guion; si una toma no coincide (< 0,8) NO exporta (salvo --forzar).
4) Arma: ambiente limpio en las tomas mudas, efectos (flash, obturador, archivos), packshot con la imagen fija +
   push-in + textos, tarjeta de texto con efecto máquina de escribir, cama musical nivelada con ducking.
5) Une las tomas con el filtro concat (audio y video sincronizados) y exporta FINAL_con_musica.mp4 y
   FINAL_sin_musica.mp4 a −14 LUFS, pico ≤ −1,5 dBFS. Escribe montaje/qa.json con el inicio de cada toma.

Campos de cada toma que usa el montaje (todos opcionales):
  "corte": {"inicio": 0.6, "dur": 1.3}   recorte fijo (tomas mudas o líneas que el transcriptor no entiende)
  "extra": 1.9                           segundos que se dejan después de la línea (gags, reacciones)
  "audio": "ambiente"                    reemplaza el audio del clip por ambiente limpio (sin voces)
  "efectos": [{"tipo": "flash", "t": 0.17}, {"tipo": "obturador", "t": 0.17},
              {"tipo": "archivo", "ruta": "sfx/risa.wav", "t": 0.5, "vol_db": -6}]
  "imagen_fija": true + "textos" + "banda" + "zoom"          packshot desde el fotograma
  "tarjeta": {"texto": "...", "dur": 4, "maquina": true}     tarjeta negra con texto (cierre tipo V3)
Si cambias 'linea', 'extra' o el idioma, el corte se recalcula solo; --recortar-de-nuevo los recalcula todos."""
import difflib, hashlib, json, re, sys, textwrap
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import (SKILL, Proyecto, cortes_internos, duracion, ff, fuente, linea_de, lufs, ruta_ffmpeg,  # noqa: E402
                   sonda, tiene_audio, tmp_seguro)

PRE, POST = 0.10, 0.22
TAM = {"9:16": (1080, 1920), "4:5": (1080, 1350), "1:1": (1080, 1080), "16:9": (1920, 1080)}
MASTER = "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.8:level=false:attack=1:release=60"
_modelos = {}


def whisper(nombre):
    if nombre not in _modelos:
        from faster_whisper import WhisperModel
        _modelos[nombre] = WhisperModel(nombre, device="cpu", compute_type="int8")
    return _modelos[nombre]


def norm(t):
    t = (t or "").lower()
    for a, b in zip("áéíóúàèìòùâêôãõç", "aeiouaeiouaeoaoc"):
        t = t.replace(a, b)
    return re.sub(r"[^a-zñü ]", "", t)


def tiene_voz(path):
    if not tiene_audio(path):
        return False
    from faster_whisper.audio import decode_audio
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    return bool(get_speech_timestamps(decode_audio(str(path), sampling_rate=16000), VadOptions(threshold=0.5)))


def anclar(path, linea, idioma, modelo, vad):
    """Corte (a, fin, oído) anclado a la primera y la última palabra del guion."""
    segs, _ = whisper(modelo).transcribe(str(path), language=idioma, word_timestamps=True, vad_filter=vad,
                                         temperature=0.0, condition_on_previous_text=False)
    words = [w for s in segs for w in s.words]
    toks = norm(linea).split()
    if not toks or not words:
        return None
    nw = [norm(w.word).strip() for w in words]
    i0 = next((i for i, t in enumerate(nw) if t == toks[0]), 0)
    k = toks.count(toks[-1])  # si la última palabra se repite en el guion, se corta en esa misma ocurrencia
    hits = [i for i in range(i0, len(nw)) if nw[i] == toks[-1]]
    i1 = hits[k - 1] if len(hits) >= k else (hits[-1] if hits else len(words) - 1)
    words = words[i0:i1 + 1]
    if not words:
        return None
    return max(0.0, words[0].start - PRE), words[-1].end, "".join(w.word for w in words).strip()


def evitar_cortes(a, d, cuts, voz=None):
    """Si un corte interno cae dentro del recorte: si está antes de la voz, el recorte empieza después de él;
    si está después de la última palabra, el recorte termina antes; si cae dentro de la línea, es un problema."""
    for c in sorted(cuts):
        if not (a < c < a + d):
            continue
        if voz is None:  # toma muda: quedarse con el tramo más largo
            if c - a >= (a + d) - c:
                d = c - a - 0.04
            else:
                a, d = c + 0.04, (a + d) - (c + 0.04)
        elif c <= voz[0]:
            a, d = c + 0.04, (a + d) - (c + 0.04)
        elif c >= voz[1]:
            d = c - a - 0.04
        else:
            return a, d, f"corte interno a {c:.2f} s en medio del diálogo"
    if d < 0.5:
        return a, d, "el tramo sin cortes internos dura menos de 0,5 s"
    return a, d, None


def ambiente_limpio(P, out, necesito):
    """Audio de un clip sin voces (verificado con VAD) para las tomas mudas, el packshot y la tarjeta."""
    f = out / "ambiente.json"
    pref = P.p.get("ambiente")
    if f.exists():
        c = json.loads(f.read_text(encoding="utf-8"))
        if Path(c["file"]).exists() and (not pref or c["toma"] == pref) and c.get("dur", 0) >= necesito + 0.3:
            return Path(c["file"])
    cands = ([pref] if pref else []) + [t["id"] for t in P.p["tomas"] if not t.get("habla")] + [t["id"] for t in P.p["tomas"]]
    for sid in dict.fromkeys(cands):
        src = P.archivo(f"clip_{sid}")
        if src and src.exists() and tiene_audio(src) and duracion(src) >= necesito + 0.3 and not tiene_voz(src):
            f.write_text(json.dumps({"toma": sid, "file": str(src), "dur": duracion(src)}), encoding="utf-8")
            print(f"Ambiente limpio: audio de {sid}")
            return src
    print("  aviso: ningún clip tiene ambiente sin voces; las tomas mudas quedan con silencio (la música las cubre)")
    return None


def obturador(out, t):
    """Sonido de obturador sintetizado: dos golpes mecánicos (espejo y cortina)."""
    f = out / f"_obturador_{int(t * 1000)}.wav"
    golpe = ("[{i}:a]bandpass=f={f}:width_type=o:width=1.5,afade=t=out:st=0.004:d={dd},volume={v},"
             "aformat=channel_layouts=stereo,adelay={ms}|{ms}[g{i}];")
    ms1, ms2 = int(t * 1000), int(t * 1000) + 80
    ff("-f", "lavfi", "-t", "0.6", "-i", "anullsrc=r=48000:cl=stereo",
       "-f", "lavfi", "-t", "0.03", "-i", "anoisesrc=color=white:amplitude=0.9:sample_rate=48000",
       "-f", "lavfi", "-t", "0.04", "-i", "anoisesrc=color=pink:amplitude=0.9:sample_rate=48000",
       "-f", "lavfi", "-t", "0.03", "-i", "sine=f=140:sample_rate=48000",
       "-filter_complex", "[0:a]anull[b];" + golpe.format(i=1, f=3200, dd=0.02, v=1.6, ms=ms1)
       + golpe.format(i=2, f=1800, dd=0.03, v=1.4, ms=ms2) + golpe.format(i=3, f=140, dd=0.025, v=0.8, ms=ms2)
       + "[b][g1][g2][g3]amix=inputs=4:duration=longest:normalize=0", f)
    return f


def partir(texto, tam, ancho):
    """Parte el texto en líneas que caben en el ancho (≈ 0,55 × tamaño de fuente por carácter)."""
    por_linea = max(8, int(ancho * 0.86 / (0.55 * tam)))
    return "\n".join(textwrap.fill(par, por_linea) for par in texto.split("\n"))


def drawtext(P, texto, clave, tipo, tam, x, y, color="white", extra=""):
    """drawtext con el texto en un archivo (sin problemas de comillas, dos puntos ni %) y la fuente en ruta segura."""
    h = hashlib.md5(texto.encode()).hexdigest()[:8]
    tf = tmp_seguro_texto(texto, f"txt_{clave}_{h}.txt")
    fnt = tmp_seguro(fuente(tipo, P.p), f"fuente_{tipo}{Path(fuente(tipo, P.p)).suffix}")
    return (f"drawtext=fontfile='{ruta_ffmpeg(fnt)}':textfile='{ruta_ffmpeg(tf)}':expansion=none:fontcolor={color}:"
            f"fontsize={tam}:line_spacing={-int(tam * 0.45)}:x={x}:y={y}:shadowcolor=black@0.6:shadowx=3:shadowy=3{extra}")


def tmp_seguro_texto(texto, nombre):
    import tempfile
    d = Path(tempfile.gettempdir()) / "anuncios_sketch"
    d.mkdir(exist_ok=True)
    (d / nombre).write_text(texto, encoding="utf-8")
    return d / nombre


def textos_vf(P, t, W, H):
    """Banda oscura + textos del cierre. Las medidas están pensadas para 1080×1920 y se escalan al formato."""
    vf, ey, et = [], H / 1920, min(W / 1080, H / 1920)
    b = t.get("banda")
    if b:
        vf.append(f"drawbox=x=0:y={int(b.get('y', 150) * ey)}:w=iw:h={int(b.get('alto', 290) * ey)}:"
                  f"color=black@{b.get('opacidad', 0.38)}:t=fill")
    for i, tx in enumerate(t.get("textos", [])):
        tam = int(tx.get("tam", 60) * et)
        vf.append(drawtext(P, partir(tx["texto"], tam, W), f"{t['id']}_{i}", tx.get("fuente", "normal"), tam,
                           "(w-text_w)/2", int(tx.get("y", 200) * ey), tx.get("color", "white"), ":text_align=C"))
    return vf


def tarjeta_vf(P, t, W, H):
    """Tarjeta negra con texto centrado; con 'maquina' aparece letra por letra."""
    c = t["tarjeta"]
    tam = int(c.get("tam", 64) * min(W / 1080, H / 1920))
    texto = partir(c["texto"], tam, W)
    vel = c.get("letras_por_seg", 18)
    if not c.get("maquina", True):
        return [drawtext(P, texto, t["id"], c.get("fuente", "negrita"), tam, "(w-text_w)/2", "(h-text_h)/2", extra=":text_align=C")]
    # máquina de escribir: el bloque queda fijo (alineado a la izquierda, centrado en el cuadro) y las letras aparecen
    lineas = texto.split("\n")
    x0 = int((W - max(len(l) for l in lineas) * 0.55 * tam) / 2)
    y0 = int((H - len(lineas) * tam * 1.3) / 2)
    vf = []
    for n in range(1, len(texto) + 1):  # un drawtext por prefijo, cada uno visible en su intervalo
        if texto[n - 1] in " \n" and n < len(texto):
            continue
        siguiente = next((m for m in range(n + 1, len(texto) + 1) if texto[m - 1] not in " \n"), None)
        t0, t1 = (n - 1) / vel, ((siguiente - 1) / vel if siguiente else 999)
        vf.append(drawtext(P, texto[:n], f"{t['id']}_{n}", c.get("fuente", "negrita"), tam, x0, y0,
                           extra=f":enable='between(t,{t0:.3f},{t1:.3f})'"))
    return vf


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    solo_qa, forzar = "--solo-qa" in sys.argv, "--forzar" in sys.argv
    P = Proyecto(args[0])
    out = P.dir / "montaje"
    out.mkdir(exist_ok=True)
    idioma = P.p.get("idioma_whisper", "es")
    W, H = TAM.get(P.p.get("formato", {}).get("aspecto", "9:16"), (1080, 1920))
    cache_f = out / "cortes_validados.json"
    cache = {} if "--recortar-de-nuevo" in sys.argv or not cache_f.exists() else json.loads(cache_f.read_text(encoding="utf-8"))

    cuts, qa = [], []
    for t in P.p["tomas"]:
        sid, linea = t["id"], (linea_de(P, t) or None)
        if t.get("tarjeta"):
            cuts.append((t, None, 0.0, round(float(t["tarjeta"].get("dur", 4)) * 30) / 30))
            qa.append((sid, 1.0, "—", "(tarjeta)"))
            continue
        src = P.archivo(f"clip_{sid}")
        if t.get("imagen_fija"):
            src = P.archivo(f"frame_{sid}")
        if not src or not src.exists():
            sys.exit(f"Falta {'el fotograma' if t.get('imagen_fija') else 'el clip'} de {sid} en el manifest")
        if linea and not t.get("imagen_fija") and not tiene_audio(src):
            sys.exit(f"clip_{sid} no tiene audio pero la toma tiene diálogo: regenéralo (rehacer video {sid})")
        firma = {"file": str(src), "linea": linea, "extra": t.get("extra", 0), "idioma": idioma, "pre": PRE, "post": POST}
        oido, voz = "", None
        if t.get("corte"):
            a, d = float(t["corte"]["inicio"]), float(t["corte"]["dur"])
            if linea:  # corte fijo en una toma con diálogo: toda la ventana cuenta como diálogo
                voz = (a, a + d)
        elif not linea:
            a, d = 0.5, min(t.get("dur", 4) - 0.6, 2.0)
        elif all(cache.get(sid, {}).get(k) == v for k, v in firma.items()):
            a, d, oido, voz = cache[sid]["a"], cache[sid]["d"], cache[sid]["heard"], cache[sid].get("voz")
        else:
            mejor, mejor_sim = None, -1
            for modelo, vad in (("medium", True), ("large-v3", False)):  # medium a veces alucina en bucle
                r = anclar(src, linea, idioma, modelo, vad)
                sim = difflib.SequenceMatcher(None, norm(linea), norm(r[2] if r else "")).ratio()
                if sim > mejor_sim:
                    mejor, mejor_sim = r, sim
                if sim >= 0.8:
                    break
            if mejor:
                a, fin, oido = mejor
                voz = (a + PRE, fin)
                d = fin + POST + t.get("extra", 0) - a
            else:
                a, d = 0.3, 3.0
        sim = 1.0 if (not linea or t.get("corte")) else difflib.SequenceMatcher(None, norm(linea), norm(oido)).ratio()
        if not t.get("imagen_fija"):
            a, d, prob = evitar_cortes(a, d, cortes_internos(src), tuple(voz) if voz else None)
            if prob:
                print(f"  {sid}: {prob}")
                sim = 0.0
        if linea and sim >= 0.8 and not t.get("corte"):
            cache[sid] = {**firma, "a": a, "d": d, "heard": oido, "voz": voz}
        qa.append((sid, round(sim, 2), linea or "—", oido or ("(corte fijo)" if t.get("corte") else "—")))
        cuts.append((t, src, round(a, 3), round(d * 30) / 30))  # duración en fotogramas exactos: audio = video
    cache_f.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")

    print("\nQA de diálogo (similitud guion vs. lo que se oye):")
    for sid, sim, linea, oido in qa:
        print(f"  {'OK ' if sim >= 0.8 else 'REVISAR'} {sid} {sim:.2f} | guion: {linea} | oído: {oido}")
    inicio, filas = 0.0, []
    for (t, _, a, d), q in zip(cuts, qa):
        filas.append({"toma": t["id"], "inicio_en_video": round(inicio, 2), "dur": d, "recorte_desde": a,
                      "similitud": q[1], "guion": q[2], "oido": q[3]})
        inicio += d
    (out / "qa.json").write_text(json.dumps({"tomas": filas, "cuts": [(c[0]["id"], c[2], c[3]) for c in cuts]},
                                            ensure_ascii=False, indent=1), encoding="utf-8")
    malas = [q for q in qa if q[1] < 0.8]
    if solo_qa or (malas and not forzar):
        if malas:
            print("\nHay tomas por revisar: no se exporta. Escucha el clip (o transcríbelo con large-v3); si la línea "
                  "está bien, fija 'corte' en la toma; si no, regenera el clip. (--forzar exporta igual)")
        return

    mudas = [d for t, s, _, d in cuts if t.get("audio") == "ambiente" or t.get("imagen_fija") or t.get("tarjeta")
             or (s is not None and not tiene_audio(s))]
    amb = ambiente_limpio(P, out, max(mudas)) if mudas else None
    base_vf = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,format=yuv420p"
    parts, cursor = [], 0.0  # cursor: cada toma muda usa otro tramo del ambiente (no se repite el mismo audio)
    dur_amb = duracion(amb) if amb else 0
    for t, src, a, d in cuts:
        sid = t["id"]
        p = out / f"{sid}.mp4"
        if t.get("tarjeta"):
            inputs = ["-f", "lavfi", "-t", d, "-i", f"color=c={t['tarjeta'].get('fondo', 'black')}:s={W}x{H}:r=30"]
            vf = ["format=yuv420p"] + tarjeta_vf(P, t, W, H)
        elif t.get("imagen_fija"):
            # packshot: el modelo de video deforma etiquetas, así que se usa el fotograma fijo + push-in en edición
            n = max(1, int(d * 30))
            inputs = ["-loop", "1", "-framerate", "30", "-t", d, "-i", src]
            vf = [f"scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},"
                  f"zoompan=z='1+{t.get('zoom', 0.07)}*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps=30,"
                  "format=yuv420p"]
        else:
            inputs = ["-ss", a, "-t", d, "-i", src]
            vf = [base_vf]
        vf += textos_vf(P, t, W, H)
        # audio: el del clip, o ambiente limpio (tomas mudas, packshot, tarjeta, clips sin audio), más efectos
        usa_amb = t.get("audio") == "ambiente" or t.get("imagen_fija") or t.get("tarjeta") or not (src and tiene_audio(src))
        if usa_amb and amb:
            ss = 0.2 + cursor % max(0.01, dur_amb - d - 0.3)
            cursor += d
            audio_src = ["-ss", f"{ss:.2f}", "-t", d, "-i", amb]
        elif usa_amb:
            audio_src = ["-f", "lavfi", "-t", d, "-i", "anullsrc=r=48000:cl=stereo"]
        else:
            audio_src = ["-ss", a, "-t", d, "-i", src]
        capas = []
        for e in t.get("efectos", []):
            if e["tipo"] == "flash":
                t0 = e.get("t", 0.17)
                vf.append(f"drawbox=x=0:y=0:w=iw:h=ih:color=white@0.85:t=fill:enable='between(t,{t0},{t0 + 0.04})',"
                          f"drawbox=x=0:y=0:w=iw:h=ih:color=white@0.35:t=fill:enable='between(t,{t0 + 0.04},{t0 + 0.11})'")
            elif e["tipo"] == "obturador":
                capas.append((obturador(out, e.get("t", 0.17)), 0, 0))
            elif e["tipo"] == "archivo":
                ruta = Path(e["ruta"]) if Path(e["ruta"]).is_absolute() else P.dir / e["ruta"]
                if not ruta.exists():
                    sys.exit(f"{sid}: no existe el efecto {ruta}")
                capas.append((ruta, e.get("t", 0), e.get("vol_db", 0)))
        aud = out / f"_{sid}_audio.wav"
        ins, fc = list(audio_src), ["[0:a]aresample=48000,aformat=channel_layouts=stereo,apad[a0]"]
        for i, (f, t0, vol) in enumerate(capas, 1):
            ins += ["-i", f]
            ms = int(t0 * 1000)
            fc.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume={vol}dB,adelay={ms}|{ms}[a{i}]")
        mezcla = "".join(f"[a{i}]" for i in range(len(capas) + 1))
        fc.append(f"{mezcla}amix=inputs={len(capas) + 1}:duration=first:normalize=0,atrim=0:{d},"
                  f"afade=t=in:d=0.02,afade=t=out:st={max(0, d - 0.04):.2f}:d=0.04[a]")
        ff(*ins, "-filter_complex", ";".join(fc), "-map", "[a]", "-c:a", "pcm_s16le", aud)
        ff(*inputs, "-i", aud, "-map", "0:v", "-map", "1:a", "-vf", ",".join(vf), "-t", d,
           "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-c:a", "pcm_s16le", p.with_suffix(".mov"))
        ff("-i", p.with_suffix(".mov"), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", p)  # copia liviana para revisar
        parts.append(p.with_suffix(".mov"))

    # inicio real de cada toma en el video final (cada segmento del concat dura lo que su stream más largo)
    inicio = 0.0
    for fila, p in zip(filas, parts):
        fila["inicio_en_video"] = round(inicio, 3)
        inicio += max(float(x) for x in sonda(p, "stream=duration").split() if x.replace(".", "", 1).isdigit())
    (out / "qa.json").write_text(json.dumps({"tomas": filas, "cuts": [(c[0]["id"], c[2], c[3]) for c in cuts]},
                                            ensure_ascii=False, indent=1), encoding="utf-8")

    # unión con el filtro concat (decodifica cada parte): el concat demuxer con -c copy ignora el retardo inicial
    # del AAC (~21 ms por parte) y el audio se iba atrasando respecto de la imagen (0,34 s al final de un anuncio)
    base = out / "base.mov"
    ins = [x for p in parts for x in ("-i", p)]
    fc = "".join(f"[{i}:v][{i}:a]" for i in range(len(parts))) + f"concat=n={len(parts)}:v=1:a=1[v][a]"
    ff(*ins, "-filter_complex", fc, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "17", "-preset", "medium",
       "-c:a", "pcm_s16le", base)
    dur = duracion(base)

    sin = P.dir / "FINAL_sin_musica.mp4"
    ff("-i", base, "-af", MASTER, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", sin)

    mus = P.p.get("musica", {})
    archivo = mus.get("archivo")
    if archivo:
        musica = Path(archivo) if Path(archivo).is_absolute() else P.dir / archivo
        if not musica.exists():
            sys.exit(f"No existe la música {musica}")
    else:
        musica = SKILL / "assets" / "musica" / "musica_sketch.mp3"
    inicio = float(mus.get("inicio", 4.0 if not archivo else 0.0))
    cama = out / "musica_cama.wav"
    # tramo de la canción (en bucle si es corta), nivelado (sin saltos de volumen), N LU bajo el diálogo, con ducking
    ff("-stream_loop", "-1", "-ss", inicio, "-i", musica, "-t", f"{dur:.2f}", "-af",
       "dynaudnorm=f=500:g=31:m=8,aresample=48000,aformat=channel_layouts=stereo", cama)
    gain = (lufs(base) - float(mus.get("bajo_dialogo_lu", 15.0))) - lufs(cama)
    print(f"Música: {musica.name} desde {inicio} s · ganancia {gain:+.1f} dB")
    fc = (f"[1:a]volume={gain:.2f}dB,afade=t=in:d=0.4,afade=t=out:st={max(0, dur - 1.5):.2f}:d=1.5[m];"
          "[0:a]asplit=2[dlg][sc];"
          "[m][sc]sidechaincompress=threshold=0.02:ratio=4:attack=20:release=400[md];"
          f"[dlg][md]amix=inputs=2:duration=first:normalize=0,{MASTER}[a]")
    con = P.dir / "FINAL_con_musica.mp4"
    ff("-i", base, "-i", cama, "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
       "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", con)
    print(f"\nListo: {con.name} y {sin.name} · {dur:.1f} s")


if __name__ == "__main__":
    main()
