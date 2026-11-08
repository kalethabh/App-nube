"""Revisión final (QA) del anuncio ya montado. Escribe montaje/revision.md y sale con código 1 si algo falla.

  python revision.py <carpeta> [--modelo large-v3]

Revisa:
- Diálogo: transcribe cada toma recortada (montaje/sXX.mp4) con Whisper large-v3 y la compara con el guion;
  marca palabras fuera de guion u otro idioma (salvo "palabras_permitidas" del proyecto, p. ej. "baby shower").
- Voces fantasma: en las tomas sin diálogo, la VAD no debe detectar voz (los modelos de video inventan voces).
  Las alucinaciones de Whisper sobre silencio ("Gracias por ver el video", "you"...) no cuentan si la VAD no oye voz.
- Parpadeos: cada cambio de plano del video final debe caer en un corte entre tomas o en un flash.
- Sincronía: el audio de cada toma debe empezar junto con su imagen (±60 ms).
- Formato: −14 LUFS ±1, pico ≤ −1 dBFS, resolución, 30 fps y duración 45–70 s."""
import difflib, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import Proyecto, cortes_internos, duracion, linea_de, lufs, pico, sonda, tiene_audio  # noqa: E402
from montaje import TAM, norm, tiene_voz, whisper  # noqa: E402


def sincronia(final, partes, inicios):
    """Desfase (ms) entre el inicio de la imagen de cada toma y el de su audio en el video final."""
    import numpy as np
    from faster_whisper.audio import decode_audio
    fin = decode_audio(str(final), sampling_rate=16000)
    env = lambda x: np.convolve(np.abs(x), np.ones(160) / 160, "same")[::16]  # envolvente a 1 ms
    res = []
    for p, s in zip(partes, inicios):
        if not p.exists() or not tiene_audio(p):
            continue
        part = decode_audio(str(p), sampling_rate=16000)
        if np.abs(part).max() < 0.01:
            continue
        s0 = max(0.0, s - 0.5)  # ventana de búsqueda ±0,5 s alrededor del inicio esperado
        seg = env(fin[int(s0 * 16000):int((s0 + len(part) / 16000 + 1.0) * 16000)])
        ep = env(part)
        if len(seg) <= len(ep):
            continue
        ep = (ep - ep.mean()) / (ep.std() + 1e-9)
        c = np.correlate(seg - seg.mean(), ep, "valid")
        norma = np.sqrt(np.convolve((seg - seg.mean()) ** 2, np.ones(len(ep)), "valid")) + 1e-9
        cn = c / norma / np.sqrt(len(ep))  # correlación normalizada (−1 a 1)
        k = int(np.argmax(cn))
        res.append((p.stem, round(1000 * (k / 1000 + s0 - s)) if cn[k] >= 0.5 else None))
    return res


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    modelo = sys.argv[sys.argv.index("--modelo") + 1] if "--modelo" in sys.argv else "large-v3"
    P = Proyecto(args[0])
    out = P.dir / "montaje"
    idioma = P.p.get("idioma_whisper", "es")
    ok_extra = {norm(w) for w in P.p.get("palabras_permitidas", [])}
    filas, problemas, notas = [], [], []

    for t in P.p["tomas"]:
        sid, linea = t["id"], linea_de(P, t)
        f = out / f"{sid}.mp4"
        if not f.exists():
            problemas.append(f"{sid}: falta montaje/{sid}.mp4 (corre montaje.py)")
            continue
        voz = tiene_voz(f)
        if not linea:
            if voz:
                segs, _ = whisper(modelo).transcribe(str(f), vad_filter=True, temperature=0.0)
                oido = " ".join(s.text for s in segs).strip()
                problemas.append(f"{sid}: se oye una voz en una toma sin diálogo: «{oido}» → \"audio\": \"ambiente\"")
            filas.append((sid, "—", "VOZ" if voz else "(sin voz)", "VOZ EN TOMA MUDA" if voz else "OK"))
            continue
        segs, info = whisper(modelo).transcribe(str(f), language=idioma, word_timestamps=True, vad_filter=False,
                                                temperature=0.0, condition_on_previous_text=False)
        words = [w for s in segs for w in s.words if w.probability > 0.15]
        oido = "".join(w.word for w in words).strip()
        guion = set(norm(linea).split())
        fuera = [norm(w.word).strip() for w in words if norm(w.word).strip() and norm(w.word).strip() not in guion
                 and norm(w.word).strip() not in ok_extra]
        sim = difflib.SequenceMatcher(None, norm(linea), norm(oido)).ratio()
        estado = "OK" if sim >= 0.85 and len(fuera) <= 1 else "REVISAR"
        if estado != "OK":
            problemas.append(f"{sid}: guion «{linea}» · se oye «{oido}» (similitud {sim:.2f}, fuera de guion {fuera}). "
                             "Si large-v3 duda, escucha el clip antes de regenerar.")
        filas.append((sid, linea, oido, f"{estado} {sim:.2f}" + (f" · fuera: {', '.join(fuera)}" if fuera else "")))

    sin, con = P.dir / "FINAL_sin_musica.mp4", P.dir / "FINAL_con_musica.mp4"
    audio = []
    qa_f = out / "qa.json"
    if sin.exists() and qa_f.exists():
        tomas = json.loads(qa_f.read_text(encoding="utf-8"))["tomas"]
        inicios = [x["inicio_en_video"] for x in tomas]
        # parpadeos: cada cambio de plano debe estar en un corte entre tomas o en un flash
        esperados = inicios[1:] + [x["inicio_en_video"] + e.get("t", 0.17) + dt for x in tomas
                                   for e in P.tomas[x["toma"]].get("efectos", []) if e["tipo"] == "flash"
                                   for dt in (0, 0.04, 0.11)]
        raros = [c for c in cortes_internos(sin) if all(abs(c - e) > 0.12 for e in esperados)]
        if raros:
            problemas.append(f"Video: cambios de plano fuera de los cortes entre tomas en {', '.join(f'{c:.2f} s' for c in raros)} "
                             "(posible parpadeo o salto dentro de una toma)")
        # sincronía audio/imagen
        con_voz = [(x, s) for x, s in zip(tomas, inicios)  # solo tomas cuyo audio es su propia voz
                   if P.tomas[x["toma"]].get("linea") and P.tomas[x["toma"]].get("audio") != "ambiente"
                   and not P.tomas[x["toma"]].get("imagen_fija") and not P.tomas[x["toma"]].get("tarjeta")]
        desf = sincronia(sin, [out / f"{x['toma']}.mp4" for x, _ in con_voz], [s for _, s in con_voz])
        malos = [(s, ms) for s, ms in desf if ms is not None and abs(ms) > 60]
        notas.append("Sincronía (ms por toma): " + ", ".join(f"{s} {ms:+d}" if ms is not None else f"{s} sin verificar"
                                                             for s, ms in desf))
        if malos:
            problemas.append(f"Audio desfasado de la imagen en: {', '.join(f'{s} ({ms:+d} ms)' for s, ms in malos)}")
    elif not sin.exists():
        problemas.append("Falta FINAL_sin_musica.mp4")
    W, H = TAM.get(P.p.get("formato", {}).get("aspecto", "9:16"), (1080, 1920))
    for f in (sin, con):
        if not f.exists():
            continue
        L, pk, du = lufs(f), pico(f), duracion(f)
        wh, fps = sonda(f, "stream=width,height,r_frame_rate").splitlines()[0].rsplit(",", 1)[0], \
            sonda(f, "stream=r_frame_rate").splitlines()[0]
        audio.append(f"{f.name}: {L:.1f} LUFS · pico {pk:.1f} dBFS · {du:.1f} s · {wh} · {fps} fps")
        if abs(L + 14) > 1 or pk > -1.0:
            problemas.append(f"{f.name}: volumen fuera de norma ({L:.1f} LUFS, pico {pk:.1f} dBFS)")
        if wh.replace(",", "x") != f"{W}x{H}" or fps != "30/1":
            problemas.append(f"{f.name}: formato {wh} a {fps} fps (se esperaba {W}x{H} a 30 fps)")
        if not 45 <= du <= 70:
            notas.append(f"{f.name}: dura {du:.1f} s (el formato rinde entre 45 y 70 s)")
    if not con.exists():
        problemas.append("Falta FINAL_con_musica.mp4")

    md = ["# Revisión final", "", "| Toma | Guion | Se oye | Estado |", "|---|---|---|---|"]
    md += [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in filas]
    md += ["", "## Formato y audio", *[f"- {x}" for x in audio + notas], "", "## Problemas",
           *([f"- {x}" for x in problemas] or ["- Ninguno"])]
    (out / "revision.md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md))
    sys.exit(1 if problemas else 0)


if __name__ == "__main__":
    main()
