"""Desarma un video de referencia para adaptarlo: tomas, fotogramas, transcripción y entonación por línea.

  python analizar_referencia.py <video> <carpeta_salida> [--idioma es]

Genera en <carpeta_salida>:
  tomas.png              un fotograma (el del medio) de cada toma, numerado, con su duración
  fotogramas_NN.png      hojas de contacto cada 0,5 s (24 cuadros por hoja) con la marca de tiempo
  analisis.json / .md    tabla toma por toma: tiempos, duración, línea(s) dichas y su entrega medida
                         (volumen relativo a la mediana del video, sílabas por segundo, melodía si hay librosa)
Después: mira tomas.png y las hojas con Read, y completa a mano el plano, la cámara, quién habla a quién
(mapa de ejes), la expresión y el beat de cada toma (ver references/analisis-de-referencias.md)."""
import json, re, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import cortes_internos, duracion, fuente  # noqa: E402


def silabas(txt):
    return max(1, len(re.findall(r"[aeiouyáéíóúüàâêôãõ]+", txt.lower())))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    video, out = Path(args[0]), Path(args[1])
    idioma = sys.argv[sys.argv.index("--idioma") + 1] if "--idioma" in sys.argv else None
    out.mkdir(parents=True, exist_ok=True)
    dur = duracion(video)

    # 1) tomas por detección de cambio de plano
    cortes = [c for c in cortes_internos(video, 0.3) if 0.2 < c < dur - 0.2]
    lim = [0.0] + cortes + [dur]
    tomas = [{"n": i + 1, "inicio": round(a, 2), "fin": round(b, 2), "dur": round(b - a, 2)}
             for i, (a, b) in enumerate(zip(lim, lim[1:])) if b - a > 0.15]

    # 2) fotograma del medio de cada toma (hoja numerada)
    tmp = Path(tempfile.mkdtemp())
    f1 = ImageFont.truetype(fuente("negrita"), 26)
    tiles = []
    for t in tomas:
        f = tmp / f"t{t['n']}.png"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str((t["inicio"] + t["fin"]) / 2), "-i", str(video),
                        "-frames:v", "1", "-vf", "scale=270:-2", str(f)])
        im = Image.open(f).convert("RGB")
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, im.width, 36], fill=(0, 0, 0))
        d.text((6, 2), f"{t['n']} · {t['inicio']:.1f}s · {t['dur']:.1f}s", font=f1, fill="yellow")
        tiles.append(im)
    if tiles:
        w, h = tiles[0].size
        cols = 8
        hoja = Image.new("RGB", (w * cols, h * ((len(tiles) + cols - 1) // cols)), "black")
        for i, im in enumerate(tiles):
            hoja.paste(im.resize((w, h)), ((i % cols) * w, (i // cols) * h))
        hoja.save(out / "tomas.png")

    # 3) hojas de contacto cada 0,5 s
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(video), "-vf",
                    "fps=2,scale=180:-2,drawtext=fontfile='" + fuente("negrita").replace("\\", "/").replace(":", "\\:") +
                    "':text='%{pts\\:hms}':fontcolor=yellow:fontsize=16:box=1:boxcolor=black@0.7:x=4:y=4,tile=6x4",
                    str(out / "fotogramas_%02d.png")])

    # 4) transcripción con marcas por palabra
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    import numpy as np
    w = WhisperModel("large-v3", device="cpu", compute_type="int8")
    segs, info = w.transcribe(str(video), language=idioma, word_timestamps=True, vad_filter=True, temperature=0.0)
    segs = list(segs)
    audio = decode_audio(str(video), sampling_rate=16000)
    rms = lambda a, b: float(20 * np.log10(np.sqrt(np.mean(audio[int(a * 16000):max(int(b * 16000), int(a * 16000) + 1)] ** 2)) + 1e-9))
    niveles = [rms(s.start, s.end) for s in segs] or [0.0]
    mediana = float(np.median(niveles))
    try:
        import librosa
    except ImportError:
        librosa = None
    def melodia(a, b):
        if librosa is None:
            return None
        f0 = librosa.yin(audio[int(a * 16000):int(b * 16000)], fmin=70, fmax=500, sr=16000)
        f0 = f0[(f0 > 70) & (f0 < 500)]
        return round(float(12 * np.log2(np.percentile(f0, 90) / np.percentile(f0, 10))), 1) if len(f0) > 5 else None

    def etiqueta(vol, ss):
        return (("ALTO " if vol >= 2 else "BAJO " if vol <= -2.5 else "")
                + ("rápido" if ss >= 8 else "LENTO" if ss < 5 else "normal")).strip()

    lineas = []
    for s, nv in zip(segs, niveles):
        L = {"inicio": round(s.start, 2), "fin": round(s.end, 2), "texto": s.text.strip(),
             "volumen_rel_db": round(float(nv - mediana), 1),
             "silabas_seg": round(silabas(s.text) / max(0.3, s.end - s.start), 1),
             "palabras": [(round(float(w.start), 2), round(float(w.end), 2), w.word) for w in (s.words or [])]}
        if librosa is not None:
            f0 = librosa.yin(audio[int(s.start * 16000):int(s.end * 16000)], fmin=70, fmax=500, sr=16000)
            f0 = f0[(f0 > 70) & (f0 < 500)]
            if len(f0) > 5:
                st = 12 * np.log2(np.percentile(f0, 90) / np.percentile(f0, 10))
                L["melodia_semitonos"] = round(float(st), 1)
        L["entrega"] = (("ALTO " if L["volumen_rel_db"] >= 2 else "BAJO " if L["volumen_rel_db"] <= -2.5 else "")
                        + ("rápido" if L["silabas_seg"] >= 8 else "LENTO" if L["silabas_seg"] < 5 else "normal")).strip()
        lineas.append(L)
    # cada palabra va a la toma donde empieza (los segmentos de Whisper a veces cruzan cortes)
    for t in tomas:
        pal = [w for L in lineas for w in L["palabras"] if t["inicio"] <= w[0] < t["fin"]]
        t["texto"] = "".join(w[2] for w in pal).strip()
        t["lineas"] = [L for L in lineas if any(t["inicio"] <= w[0] < t["fin"] for w in L["palabras"])]
        if pal:  # entrega medida sobre las palabras de ESTA toma (no del segmento completo de Whisper)
            a, b = pal[0][0], pal[-1][1]
            vol, ss = round(rms(a, b) - mediana, 1), round(silabas(t["texto"]) / max(0.3, b - a), 1)
            t["entrega_medida"] = {"volumen_rel_db": vol, "silabas_seg": ss, "melodia_semitonos": melodia(a, b),
                                   "entrega": etiqueta(vol, ss)}

    res = {"video": str(video), "duracion": round(dur, 2), "idioma": info.language, "n_tomas": len(tomas),
           "toma_promedio": round(dur / max(1, len(tomas)), 2), "primera_palabra": lineas[0]["inicio"] if lineas else None,
           "tomas": tomas, "lineas": lineas}
    (out / "analisis.json").write_text(json.dumps(res, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
    md = [f"# Análisis de {video.name}", "",
          f"- Duración {dur:.1f} s · {len(tomas)} tomas · promedio {res['toma_promedio']} s · idioma {info.language} · "
          f"primera palabra en {res['primera_palabra']} s", "",
          "| # | Tiempo | Dur | Línea(s) | Entrega medida | Plano / quién mira a quién / acción (completar) |", "|---|---|---|---|---|---|"]
    for t in tomas:
        txt = t["texto"] or "—"
        e = t.get("entrega_medida")
        ent = (f"{e['entrega']} ({e['volumen_rel_db']:+} dB, {e['silabas_seg']} síl/s"
               + (f", melodía {e['melodia_semitonos']} st" if e.get("melodia_semitonos") is not None else "") + ")") if e else "—"
        md.append(f"| {t['n']} | {t['inicio']:.1f}–{t['fin']:.1f} | {t['dur']:.1f} | {txt} | {ent} | |")
    (out / "analisis.md").write_text("\n".join(md), encoding="utf-8")
    print(f"Listo: {out / 'analisis.md'} · {len(tomas)} tomas · {len(lineas)} líneas")


if __name__ == "__main__":
    main()
