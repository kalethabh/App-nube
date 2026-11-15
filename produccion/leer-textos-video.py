"""Los textos que se ven en un video, con dónde y cuándo aparecen (seguimiento del editor, 2026-11-14).

    .venv-limpio/bin/python produccion/leer-textos-video.py <video> <salida.json> [--fps 3]

Lee el video en esta PC (gratis) con RapidOCR, el mismo de «Borrar subtítulos», unas veces por segundo, y junta lo
que ve en PISTAS: el mismo texto en muestras seguidas (aunque se mueva o el OCR lo lea un poco distinto).

Deja en <salida.json>:
  { "duracion": s, "fps": 3, "pistas": [ { "id": "t1", "texto": "ENVÍO GRATIS",
        "apariciones": [[t, x, y, w, h], ...] } ] }
  t en segundos del video; x, y el centro de la caja y w, h su ancho y alto, todo en fracción del cuadro (0 a 1).

Mientras trabaja escribe en la salida estándar:  @@avance {"valor": 0-100}
"""
import difflib
import json
import sys

import cv2

LADO = 640          # el lado largo con que se lee (más chico es más rápido; los textos de anuncio son grandes)
PUNTAJE_MIN = 0.6   # lo que el OCR lee con menos confianza que esto no cuenta
PARECIDO = 0.72     # cuánto se tienen que parecer dos lecturas para ser el mismo texto
HUECO = 1.6         # segundos sin verlo y sigue siendo la misma pista
VERSION = 2         # 2: una aparición que salta de lugar es otra pista; 3 lecturas por segundo


def norm(t):
    return "".join(ch for ch in t.lower() if ch.isalnum())


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print("Uso: leer-textos-video.py <video> <salida.json> [--fps 3]", file=sys.stderr)
        return 2
    video, salida = args[0], args[1]
    fps_lectura = float(args[args.index("--fps") + 1]) if "--fps" in args else 3.0

    from rapidocr_onnxruntime import RapidOCR

    motor = RapidOCR()
    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        print("No pude abrir el video", file=sys.stderr)
        return 1
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duracion = n / fps if n else 0.0
    paso = max(1, round(fps / fps_lectura))

    pistas = []  # {id, lecturas: {texto: veces}, apariciones: [...], ultima: t, clave}
    i = 0
    ultimo_aviso = -1
    while True:
        ok = cap.grab()
        if not ok:
            break
        if i % paso:
            i += 1
            continue
        ok, img = cap.retrieve()
        if not ok:
            break
        t = i / fps
        h0, w0 = img.shape[:2]
        esc = LADO / max(h0, w0)
        if esc < 1:
            img = cv2.resize(img, (round(w0 * esc), round(h0 * esc)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]
        res, _ = motor(img)
        usadas = set()
        for caja, texto, puntaje in res or []:
            texto = str(texto).strip()
            clave = norm(texto)
            if float(puntaje) < PUNTAJE_MIN or len(clave) < 2:
                continue
            xs = [p[0] for p in caja]
            ys = [p[1] for p in caja]
            x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
            ap = [round(t, 3), round((x0 + x1) / 2 / w, 4), round((y0 + y1) / 2 / h, 4), round((x1 - x0) / w, 4), round((y1 - y0) / h, 4)]
            mejor, mejor_valor = None, None
            for k, p in enumerate(pistas):
                if k in usadas or t - p["ultima"] > HUECO:
                    continue
                ult = p["apariciones"][-1]
                # el mismo texto que aparece de golpe en otro lugar es OTRA aparición (otro frasco, otra escena): si se
                # juntaran, lo que lo sigue saltaría de un lado al otro. Se deja moverse según el tiempo que pasó.
                pasado = max(0.0, t - ult[0])
                if abs(ult[1] - ap[1]) > max(0.1, 1.2 * ult[3]) + 0.06 * pasado or abs(ult[2] - ap[2]) > max(0.05, 2.5 * ult[4]) + 0.04 * pasado:
                    continue
                r = difflib.SequenceMatcher(None, clave, p["clave"]).ratio()
                if r < PARECIDO:
                    continue
                # entre dos pistas con un texto parecido gana la que está más cerca (y la que se vio hace menos)
                valor = r - (abs(ult[1] - ap[1]) + abs(ult[2] - ap[2])) - 0.02 * pasado
                if mejor_valor is None or valor > mejor_valor:
                    mejor, mejor_valor = k, valor
            if mejor is not None:
                p = pistas[mejor]
                p["apariciones"].append(ap)
                p["ultima"] = t
                p["lecturas"][texto] = p["lecturas"].get(texto, 0) + 1
                usadas.add(mejor)
            else:
                pistas.append({"clave": clave, "ultima": t, "apariciones": [ap], "lecturas": {texto: 1}})
                usadas.add(len(pistas) - 1)
        i += 1
        if n:
            v = int(100 * i / n)
            if v != ultimo_aviso:
                ultimo_aviso = v
                print("@@avance " + json.dumps({"valor": v}), flush=True)
    cap.release()

    salida_pistas = []
    for k, p in enumerate(sorted(pistas, key=lambda p: p["apariciones"][0][0])):
        texto = max(p["lecturas"].items(), key=lambda kv: kv[1])[0]
        salida_pistas.append({"id": f"t{k + 1}", "texto": texto, "apariciones": p["apariciones"]})
    with open(salida, "w", encoding="utf-8") as f:
        json.dump({"version": VERSION, "duracion": round(duracion, 3), "fps": fps_lectura, "pistas": salida_pistas}, f, ensure_ascii=False)
    print("@@listo " + json.dumps({"pistas": len(salida_pistas)}), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
