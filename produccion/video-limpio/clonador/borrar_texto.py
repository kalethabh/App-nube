"""Borra el texto quemado (subtítulos y avisos) del video de referencia con STTN en la GPU, a 720p.

Es el método por defecto del paso 2. Tarda ~55 s por anuncio de 15 s en la RTX 3050 (el primer STTN
tardaba 566 s) y ~1,5-2 min si otro proceso usa la GPU a la vez. Lo que lo hace rápido:
- La red solo ve una franja de 720 px de ancho que cubre todos los textos (240 px de alto en video 1),
  no el cuadro entero.
- Ventanas de 12 cuadros que avanzan 10 (fundido en los 2 que se solapan) + 4 de referencia:
  cada cuadro pasa ~1,6 veces por la red, no 3.
- fp16 y memoria channels_last. La decodificación va en hilos mientras carga el modelo, y la
  codificación mientras la GPU calcula. FFmpeg pega la franja sobre el original escalado, así que
  fuera de las máscaras el video queda intacto.

Máscaras por tarjeta (de text_analysis.json, calculadas a la resolución original):
- Tarjetas (subtítulos y avisos con fill_bbox, p. ej. los de detectar_texto): píxeles de sus
  mask_colors_hex (si no tiene, blancos o amarillos) en >= mask_min_frac (60 %) de los cuadros de cada
  tarjeta, agrandados mask_dilate_px (por defecto 16 px de un original de 1080 de ancho). Con
  mask_rect se borra la caja entera (destellos y brillos sin color fijo).
- Avisos con line_fill_rows_px (hechos a mano): percentil 15 de la luma por línea.
Luego se agrandan y se reducen a 720 contando cualquier píxel tocado, así que nunca quedan más chicas.

Máscaras por cuadro (modo "cuadro"; "auto" lo usa si más del 10 % de los subtítulos duran < 2 cuadros, como en
video 2: texto con brillo que cambia de color y tamaño cada pocos cuadros). text_analysis solo da la zona (bandas
de filas con medio renglón de margen; la franja se alinea arriba para que entren las flechas de abajo). Dentro,
cada 2 cuadros:
- DBNet de RapidOCR (umbrales bajos) da las cajas de los renglones; se suman glifos sueltos a los lados ("I").
- Texto sin brillo: glifo + trazo. Con brillo: caja + 0,35 renglón, y si es de color, los píxeles vecinos
  teñidos hacia ese color (hasta 1,5 renglones; sobre piel, con rojo/amarillo, solo 0,75).
- Flechas, emojis y destellos junto al texto (compactos, de color vivo, sin tocar los bordes del lienzo) también
  se borran: todo lo sobreimpreso vuelve en la edición.
- Unión de ±1-2 cuadros: sin parpadeo y cubre la entrada y salida de cada tarjeta.
Brillo (solo en este modo): antes de la red se resta el brillo modelado (glifos de color desenfocados, ajustados
en el anillo de alrededor) y, al final, alrededor del hueco se quita el tinte hacia el color de los subtítulos
que pase el techo normal de la toma para esa luma y ese color (medido lejos del texto), sobre la imagen
desenfocada (tinte suave, el detalle queda).
Referencias: si la ventana tiene hueco, las 4 se eligen entre los cuadros de la misma toma a <= 10 s que más
destapan ese hueco (los subtítulos siempre en la misma zona dejaban a la red sin fondo real: manchas).
Probado en video 2 (360x640, 110 s): ~6,5 min (máscaras 75 s, brillo 110 s, STTN 200 s); videos 1 y 4 siguen
por tarjeta (50 y 90 s).
Con originales de menos de 720 de ancho (p. ej. 360x640) la red trabaja a la resolución original
(franja de 240 px, la escala para la que se entrenó STTN): a 720 rellenaba con manchas borrosas y tardaba
5 veces más. La franja rellena se escala a 720 con lanczos al superponerla.

Necesita torch con CUDA: en este Python o en el entorno de CLONADOR_PY_GPU (por defecto
%LOCALAPPDATA%/clonador/venv-sttn, con torch cu126). Pesos en modelos/sttn.pth. Si no hay GPU, avisa
y usa limpiar_texto (OpenCV Telea: segundos, pero deja manchas).

Uso: python -m clonador.borrar_texto "<video>" trabajos/<trabajo>/analisis/texto.json trabajos/<trabajo>/limpio.mp4 [auto|cuadro|tarjeta]
"""
import json
import math
import os
import queue
import subprocess
import sys
import threading
import time
from pathlib import Path

import cv2
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
PESOS = RAIZ / "modelos" / "sttn.pth"
PY_GPU = Path(os.environ.get("CLONADOR_PY_GPU") or
              Path(os.environ.get("LOCALAPPDATA", "")) / "clonador" / "venv-sttn" / "Scripts" / "python.exe")

def motor_ocr():
    """RapidOCR con sus 3 redes en la GPU si se puede (~2,5x más rápido que en CPU: 0,23 s por muestra en la
    RTX 3050). RapidOCR 1.2.3 no enciende CUDA por su cuenta: se rehacen sus sesiones de ONNX Runtime con
    CUDAExecutionProvider (onnxruntime-gpu 1.22 = CUDA 12, el mismo de torch cu126; torch carga las DLL)."""
    from rapidocr_onnxruntime import RapidOCR
    motor = RapidOCR()
    try:
        import onnxruntime as ort
        import torch
        if torch.cuda.is_available() and "CUDAExecutionProvider" in ort.get_available_providers():
            torch.zeros(1).cuda()  # carga cuBLAS/cuDNN de torch para que ONNX Runtime los encuentre
            for s in (motor.text_detector.infer, motor.text_recognizer.session, motor.text_cls.infer):
                s.session = ort.InferenceSession(s.session._model_path,
                                                 providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    except Exception as e:  # noqa: BLE001 — sin GPU sigue en CPU, más lento pero igual
        print(f"OCR en CPU ({e})", file=sys.stderr)
    return motor


OW = 720                                   # ancho de salida (máximo de referencia en Kie)
K, S, R, PASO_REF, VENTANA_REF = 12, 10, 4, 10, 30
DIL_SUB, DIL_AVISO, PAD_T = 16, 10, 2      # dilatación en px de un original de 1080 de ancho; cuadros extra
CONTEXTO = 12                              # px a 720 por encima y por debajo de los huecos
PASO_DB, T_SUAVE, GLOW = 1, 3, 0.35        # modo por cuadro: DBNet en cada cuadro, unión ±3 (si DBNet pierde un
                                           # gráfico 1-2 cuadros, la red lo copiaba de ahí a sus vecinos: video 3)
PIEL = np.array([-27, -7, 34], np.float32) / 44.0   # dirección de color de la piel (BGR sin gris)
RADIO_REF = 300                            # referencias que destapan el hueco: hasta 10 s, en la misma toma


def _elipse(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def _cuadros(video, vf, alto, ancho, n, fmt):
    """Decodifica con ffmpeg a un búfer reutilizado (hay que copiarlo si se guarda)."""
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(video), "-vf",
                          f"{vf},scale=in_color_matrix=bt709:in_range=limited,format={fmt}",
                          "-frames:v", str(n), "-f", "rawvideo", "-"], stdout=subprocess.PIPE, bufsize=0)
    buf = np.empty((alto, ancho, 3), np.uint8)
    mv = memoryview(buf).cast("B")
    for i in range(n):
        leido = 0
        while leido < len(mv):
            k = p.stdout.readinto(mv[leido:])
            if not k:
                raise RuntimeError(f"ffmpeg dio {i} cuadros y text_analysis dice {n}")
            leido += k
        yield buf
    p.stdout.close()
    p.wait()


def _ancho_red(ta):
    """Ancho al que trabaja STTN: 720, o el del original si es más chico (par)."""
    return min(OW, 2 * (ta["width"] // 2))


def _geometria(ta, por_cuadro=False):
    """Franja al ancho de la red (y0, alto múltiplo de 240) que cubre todos los huecos + su lienzo en el
    original."""
    sw, sh = ta["width"], ta["height"]
    esc, f = _ancho_red(ta) / sw, sw / 1080
    oh = round(sh * esc / 2) * 2
    cajas = ([c["fill_bbox_px_x0y0x1y1"] for c in _tarjetas(ta)] +
             [o["bbox_px_x0y0x1y1_incl_outline"] for o in _avisos(ta)])
    dil = max([DIL_SUB * f] + [c.get("mask_dilate_px", 0) for c in _tarjetas(ta)])
    if por_cuadro:                                    # bandas con medio renglón + brillo de una caja de DBNet
        bandas, alto = _bandas(ta)
        cajas, dil = [[0, a, 0, z] for a, z in bandas], 2 * GLOW * alto
    lo = max(0, (min(b[1] for b in cajas) - 6 - dil) * esc - CONTEXTO)
    hi = min(oh, (max(b[3] for b in cajas) + 7 + dil) * esc + CONTEXTO)
    ch = 240 * math.ceil((hi - lo) / 240)
    assert ch <= oh, "los textos ocupan casi todo el alto; STTN por franjas no aplica"
    cy0 = min(max(0, round((lo + hi - ch) / 2)), oh - ch)
    if por_cuadro:                                    # el sobrante va abajo: las flechas suelen ir bajo el texto
        cy0 = min(max(0, round(lo)), oh - ch)
    cy0 -= cy0 % 2                                    # par, para no correr el croma al superponer
    return oh, cy0, ch, round(cy0 / esc), round(ch / esc)


def _avisos(ta):
    return [o for o in ta.get("overlays", []) if "line_fill_rows_px" in o]


def _tarjetas(ta):
    """Subtítulos + avisos con caja de relleno y cuadros (los que escribe detectar_texto)."""
    return ta["captions"]["chunks"] + [o for o in ta.get("overlays", [])
                                       if "fill_bbox_px_x0y0x1y1" in o and "line_fill_rows_px" not in o]


def _rgb(h):
    return [int(h[i:i + 2], 16) for i in (1, 3, 5)]


def mascaras(video, ta, n, lienzo):
    """Lista de (desde, hasta, máscara) en el lienzo del original (filas lienzo[0]..+lienzo[1])."""
    sw, f = ta["width"], ta["width"] / 1080
    y0c, hc = lienzo
    chunks, avisos = _tarjetas(ta), _avisos(ta)
    colores = [np.array([_rgb(h)[::-1] for h in c.get("mask_colors_hex", [])], np.int16).reshape(-1, 3) for c in chunks]
    geo, cuenta, por_cuadro = [], [], {}
    for k, c in enumerate(chunks):
        x0, y0, x1, y1 = c["fill_bbox_px_x0y0x1y1"]
        g = (max(0, y0 - y0c - 6), min(hc, y1 - y0c + 7), max(0, x0 - 6), min(sw, x1 + 7))
        geo.append(g)
        cuenta.append(np.zeros((g[1] - g[0], g[3] - g[2]), np.int32))
        for i in range(c["start_frame"], min(n, c["end_frame"] + 1)):
            if not c.get("mask_rect"):
                por_cuadro.setdefault(i, []).append(k)
    muestras = []                                     # por aviso: caja, rango, paso, lumas
    for o in avisos:
        x0, y0, x1, y1 = o["bbox_px_x0y0x1y1_incl_outline"]
        s, e = o.get("start_frame", 0), min(n - 1, o.get("end_frame", n - 1))
        paso = max(2, math.ceil((e - s + 1) / 225))   # <=225 muestras para el percentil
        g = (max(0, y0 - y0c - 6), min(hc, y1 - y0c + 7), max(0, x0 - 6), min(sw, x1 + 7))
        muestras.append((g, s, e, paso, np.empty((len(range(s, e + 1, paso)), g[1] - g[0], g[3] - g[2]), np.float32)))

    for i, buf in enumerate(_cuadros(video, f"crop={sw}:{hc}:0:{y0c}", hc, sw, n, "bgr24")):
        for k in por_cuadro.get(i, ()):
            r0, r1, c0, c1 = geo[k]
            c = buf[r0:r1, c0:c1].astype(np.int16)
            b, g, r = c[..., 0], c[..., 1], c[..., 2]
            mn, mx = np.minimum(np.minimum(b, g), r), np.maximum(np.maximum(b, g), r)
            if len(colores[k]):                       # colores medidos por detectar_texto (verde, rojo...)
                m = np.zeros(b.shape, bool)
                for col in colores[k]:
                    m |= np.abs(c - col).max(-1) < 45
            else:
                m = ((mn > 185) & ((mx - mn) < 70)) | ((r > 170) & (g > 170) & (b < 150))
            cuenta[k] += m
        for (r0, r1, c0, c1), s, e, paso, luma in muestras:
            if s <= i <= e and (i - s) % paso == 0:
                c = buf[r0:r1, c0:c1]
                luma[(i - s) // paso] = 0.0722 * c[..., 0] + 0.7152 * c[..., 1] + 0.2126 * c[..., 2]

    res = []
    for k, c in enumerate(chunks):
        r0, r1, c0, c1 = geo[k]
        m = np.zeros((hc, sw), np.uint8)
        m[r0:r1, c0:c1] = (True if c.get("mask_rect") else
                           cuenta[k] / float(c["end_frame"] - c["start_frame"] + 1) >= c.get("mask_min_frac", 0.6))
        m = cv2.dilate(cv2.morphologyEx(m, cv2.MORPH_CLOSE, _elipse(2)),
                       _elipse(round(c.get("mask_dilate_px", DIL_SUB * f))))
        res.append((max(0, c["start_frame"] - PAD_T), min(n - 1, c["end_frame"] + PAD_T), m))
    for o, ((r0, r1, c0, c1), s, e, _, luma) in zip(avisos, muestras):
        txt = (np.percentile(luma, 15, axis=0) > 185).astype(np.uint8)
        filas = np.zeros_like(txt)
        for a, b in o["line_fill_rows_px"]:
            filas[max(0, a - y0c - r0 - 3):b - y0c - r0 + 4] = 1
        m = np.zeros((hc, sw), np.uint8)
        m[r0:r1, c0:c1] = txt & filas
        m = cv2.dilate(cv2.morphologyEx(m, cv2.MORPH_CLOSE, _elipse(2)), _elipse(round(DIL_AVISO * f)))
        res.append((s, e, m))
    return res


def _tarjetas_fiables(ta):
    """Las tarjetas sirven si casi todas duran >= 2 cuadros (en video 2 un tercio salían invertidas o de 1 cuadro)."""
    cs = ta["captions"]["chunks"]
    malas = sum(c["end_frame"] - c["start_frame"] < 1 for c in cs)
    return not cs or malas <= 0.1 * len(cs)


def _bandas(ta):
    """Franjas de filas (del original) donde el detector vio texto sobreimpreso, con 0,8 renglón de margen (con
    medio renglón, el texto que aparece agrandándose se salía por abajo: video 3)."""
    cajas = sorted([c["fill_bbox_px_x0y0x1y1"] for c in _tarjetas(ta) if not c.get("mask_rect")] +
                   [o["bbox_px_x0y0x1y1_incl_outline"] for o in _avisos(ta)], key=lambda b: b[1])
    alto = float(np.median([b[3] - b[1] for b in cajas]))
    bandas = []
    for b in cajas:
        a, z = b[1] - 0.8 * alto, b[3] + 0.8 * alto
        if bandas and a <= bandas[-1][1]:
            bandas[-1][1] = max(bandas[-1][1], z)
        else:
            bandas.append([a, z])
    return bandas, alto


def _mascara_cuadro(det, c, s_db, bandas, abajo_es_borde=False, alto_ref=None):
    """Máscara del texto sobreimpreso de un cuadro (recorte BGR del lienzo, bandas en sus filas).

    DBNet (el detector de RapidOCR, con umbrales bajos: 0,2/0,3) da la caja de cada renglón (una caja cuadrada
    de más de 1,5 renglones y de color vivo junto a otras es un gráfico y no se toma); se borra la caja
    agrandada GLOW renglón (trazo y brillo). Si la caja tiene glifos de color saturado (verde, rojo, cian), su
    brillo llega más lejos: se suman los píxeles vecinos (hasta 1,5 renglones) teñidos hacia ese color más que el
    fondo de 1,5-2,2 renglones y conectados con la caja. También se suman glifos sueltos a los lados del renglón.
    Si los glifos (claros o vivos con borde oscuro) no tienen brillo alrededor, la máscara es solo glifo + trazo.
    Devuelve (texto, gráficos): gráficos son manchas compactas de color vivo junto al texto (flechas, emojis; no
    telas grandes), las cajas cuadradas vivas de DBNet y los destellos claros pegados a ellos. Se borran también."""
    h, w = c.shape[:2]
    b = cv2.resize(c, (round(w * s_db), round(h * s_db)), interpolation=cv2.INTER_AREA) if s_db != 1 else c
    det.preprocess_op[0].limit_type, det.preprocess_op[0].limit_side_len = "max", max(b.shape[:2])
    det.postprocess_op.thresh, det.postprocess_op.box_thresh = 0.2, 0.3
    cajas, _ = det(b)
    out = np.zeros((h, w), np.uint8)
    if cajas is None or not len(cajas):
        if not alto_ref:
            return out, out
        cajas = []  # sin texto en el cuadro: igual se buscan flechas/emojis en la franja de subtítulos
    cajas = [np.asarray(q, np.float32) / s_db for q in cajas]
    lados = [sorted(cv2.minAreaRect(q)[1]) for q in cajas]
    altos, iconos = [], np.zeros((h, w), np.uint8)
    for j, (q, (hb, wb)) in enumerate(zip(cajas, lados)):
        if not any(a <= q[:, 1].mean() <= z for a, z in bandas):
            continue                                  # texto fuera de la zona de subtítulos/avisos: se respeta
        otros = [l[0] for k, l in enumerate(lados) if k != j]
        if otros and wb < 1.6 * hb and hb > 1.5 * np.median(otros):
            x0, y0 = np.clip(q.min(0).astype(int), 0, [w, h])
            x1, y1 = np.clip(q.max(0).astype(int) + 1, 0, [w, h])
            z = c[y0:y1, x0:x1].astype(np.int16)
            mx = z.max(-1)
            if ((mx - z.min(-1) > 0.6 * mx) & (mx > 150)).mean() > 0.25:
                if x0 > 0 and y0 > 0 and x1 < w and (y1 < h or abajo_es_borde):
                    cv2.fillPoly(iconos, [np.int32(np.round(q))], 1)
                continue                              # caja cuadrada, grande y de color vivo: flecha o ícono
        altos.append(hb)
        rg, rl, ra = max(2, round(GLOW * hb)), round(1.5 * hb), round(2.2 * hb)
        x0, y0 = max(0, int(q[:, 0].min()) - ra - 2), max(0, int(q[:, 1].min()) - ra - 2)
        x1, y1 = min(w, int(q[:, 0].max()) + ra + 3), min(h, int(q[:, 1].max()) + ra + 3)
        caja = np.zeros((y1 - y0, x1 - x0), np.uint8)
        cv2.fillPoly(caja, [np.int32(np.round(q - [x0, y0]))], 1)
        z = c[y0:y1, x0:x1].astype(np.float32)
        mx, mn = z.max(-1), z.min(-1)
        # glifos sueltos que DBNet dejó fuera del renglón ("so I"): claros o vivos, con borde oscuro, altos, a
        # menos de un renglón a los lados
        lado = cv2.dilate(caja, cv2.getStructuringElement(cv2.MORPH_RECT, (2 * round(hb) + 1, 1))) & (1 - caja)
        diseno = ((mn > 170) & (mx - mn < 70)) | ((mx - mn > 0.6 * mx) & (mx > 150))
        borde = cv2.erode(mx, _elipse(max(2, round(0.15 * hb)))) < mx - 60
        k, lab, st, _ = cv2.connectedComponentsWithStats((diseno & (lado > 0)).astype(np.uint8), connectivity=8)
        semillas = np.bincount(lab[borde & (lab > 0)], minlength=k)
        for u in np.flatnonzero((semillas >= 3) & (st[:, 3] >= 0.4 * hb)):
            if u:
                caja |= (lab == u).astype(np.uint8)
        dist = cv2.distanceTransform(1 - caja, cv2.DIST_L2, 5)   # agrandar por distancia: radios grandes baratos
        m = (dist <= rg).astype(np.uint8)
        nucleo = cv2.erode(caja, _elipse(max(1, round(0.2 * hb))))   # sin el margen de DBNet (flechas pegadas)
        # glifos con trazo: si no tienen brillo alrededor, la máscara va pegada a ellos (texto fijo sin brillo,
        # p. ej. avisos legales: una caja entera cuadro tras cuadro deja una mancha)
        k, lab = cv2.connectedComponents((diseno & (caja > 0)).astype(np.uint8), connectivity=8)
        vivo = np.bincount(lab[borde & (lab > 0)], minlength=k) >= 3
        vivo[0] = False
        g = vivo[lab]
        if g.sum() >= 0.15 * nucleo.sum():
            rs = max(2, round(0.25 * hb))             # margen (0,18 dejaba el borde de abajo: video 3)
            dg = cv2.distanceTransform((~g).astype(np.uint8), cv2.DIST_L2, 5)
            cerca_g, lejos_g = (dg > rs + 1) & (dg <= rs + 3), (dg > 0.6 * hb) & (dg <= 0.9 * hb) & (dist > rg)
            # brillo = algún canal más alto junto al trazo que lejos (el rojo casi no sube la luma)
            if cerca_g.any() and lejos_g.any() and (np.median(z[cerca_g], 0) - np.median(z[lejos_g], 0)).max() < 12:
                pegada = ((dg <= rs + 2) & (dist <= rg + round(0.2 * hb))).astype(np.uint8)
                # sombra paralela (abajo y a la derecha, fuera del trazo): quedaba como una raya bajo el renglón
                ds = max(1, round(0.15 * hb))
                sombra = np.zeros_like(pegada)
                sombra[ds:, ds // 2:] = pegada[:-ds, :pegada.shape[1] - ds // 2]
                out[y0:y1, x0:x1] |= pegada | sombra
                continue
        sat = (mx - mn > 90) & (mx > 140) & (nucleo > 0)
        if sat.sum() > 0.05 * nucleo.sum():           # brillo de color: teñido hacia el color del glifo
            f = np.median(z[sat], 0)
            f -= f.mean()
            t = (z - z.mean(-1, keepdims=True)) @ f / (f @ f)
            afuera = (dist <= ra) & (dist > rl)
            base = float(np.median(t[afuera])) if afuera.any() else 0.0   # ropa o fondo ya teñidos
            tinte = t > base + 0.1
            tinte &= (mx - mn <= 0.6 * mx) | (mx <= 150)          # un color vivo y macizo no es brillo
            tinte &= dist <= rl
            if f @ PIEL / np.linalg.norm(f) > 0.7:    # rojo/naranja/amarillo: la piel ya está teñida así;
                bb, gg, rr = z[..., 0], z[..., 1], z[..., 2]   # en piel solo el brillo pegado al texto
                piel = (rr > 95) & (rr > gg) & (gg > bb + 10) & (rr - bb > 25)
                tinte &= ~piel | (dist <= 0.5 * rl)
            zona = tinte.astype(np.uint8) | m
            k, lab = cv2.connectedComponents(zona, connectivity=8)
            vivo = np.zeros(k, bool)
            vivo[np.unique(lab[m > 0])] = True
            vivo[0] = False
            m = cv2.dilate(vivo[lab].astype(np.uint8), _elipse(2))
        out[y0:y1, x0:x1] |= m
    graf = iconos
    if altos or alto_ref:                             # flechas, emojis y destellos junto al texto: también se borran
        hb = float(np.median(altos)) if altos else float(alto_ref)
        mx, mn = c.max(-1).astype(np.int16), c.min(-1).astype(np.int16)
        vivo = ((mx - mn > 0.6 * mx) & (mx > 150) & (out == 0)).astype(np.uint8)   # fuera del texto: la
        k, lab, st, _ = cv2.connectedComponentsWithStats(vivo, connectivity=8)       # flecha no se une a él
        if altos:
            cerca = cv2.distanceTransform(1 - (out | iconos), cv2.DIST_L2, 5) <= 1.5 * hb
        else:  # cuadro sin texto (la flecha queda sola entre dos subtítulos): la franja de subtítulos y debajo
            cerca = np.zeros((h, w), bool)
            for a, z in bandas:
                cerca[max(0, int(a - hb)):min(h, int(z + 3 * hb))] = True
        a = st[:, 4]
        x, y, bw, bh = st[:, 0], st[:, 1], st[:, 2], st[:, 3]
        # gráfico: compacto (<= 4 renglones de lado), macizo y sin tocar los bordes del lienzo (salvo el de abajo
        # si es el del cuadro); ropa o escenario de color vivo son más grandes o siguen fuera del lienzo
        ok = ((a >= 0.3 * hb * hb) & (bw <= 4 * hb) & (bh <= 4 * hb) & (a >= 0.35 * bw * bh) & (x > 0) & (y > 0) &
              (x + bw < w) & ((y + bh < h) | abajo_es_borde))
        for j in np.flatnonzero(ok):
            if j:
                x, y, bw, bh, area = st[j]
                comp = lab[y:y + bh, x:x + bw] == j
                if cerca[y:y + bh, x:x + bw][comp].any():
                    graf[y:y + bh, x:x + bw] |= comp
        # destellos: trazos claros chicos con contraste junto a lo que se borra (gráfico o renglón: una flecha sola
        # DBNet la toma como renglón y sus rayitas blancas quedaban: video 3, 48 s)
        base = graf | out
        if base.any():
            claro = ((mn > 170) & (mx - mn < 70)).astype(np.uint8)
            borde = cv2.erode(mx, _elipse(2)) < mx - 60
            k, lab, st, _ = cv2.connectedComponentsWithStats(claro, connectivity=8)
            junto = cv2.distanceTransform(1 - base, cv2.DIST_L2, 5) <= 2.5 * hb
            for j in np.flatnonzero((st[:, 4] >= 4) & (st[:, 4] <= 2 * hb * hb)):
                if j:
                    x, y, bw, bh, area = st[j]
                    comp = lab[y:y + bh, x:x + bw] == j
                    if junto[y:y + bh, x:x + bw][comp].any() and borde[y:y + bh, x:x + bw][comp].any():
                        graf[y:y + bh, x:x + bw] |= comp
        graf = cv2.dilate(graf, _elipse(max(3, round(GLOW * hb))))   # con su brillo
    return out, graf


def mascaras_por_cuadro(video, ta, n, lienzo, red):
    """Máscaras cuadro a cuadro ya a la resolución de la red, empaquetadas en bits: (n, alto, ceil(ancho/8)),
    una para el texto (lo que se reemplaza) y otra con los gráficos vecinos (lo que la red no ve).

    Se calculan cada PASO_DB cuadros; cada cuadro toma las de las muestras a <= 1 cuadro y luego la unión de
    ±1 cuadro (sin parpadeo, y cubre la entrada y salida de cada tarjeta)."""
    det = motor_ocr().text_detector
    sw, sh = ta["width"], ta["height"]
    y0c, hc = lienzo
    tw, ch = red
    s_db = min(1.0, 540 / min(sw, sh))
    bandas_px, alto_b = _bandas(ta)
    bandas = [(a - y0c, z - y0c) for a, z in bandas_px]
    abajo = y0c + hc >= sh - 1
    m = np.zeros((n, 2, ch, (tw + 7) // 8), np.uint8)

    def una(i, buf):
        m[i] = [np.packbits(cv2.resize(x.astype(np.float32), (tw, ch), interpolation=cv2.INTER_AREA) > 1e-3, -1)
                for x in _mascara_cuadro(det, buf, s_db, bandas, abajo, alto_b)]

    # en paralelo (la sesión de ONNX Runtime admite llamadas desde varios hilos); a lo sumo 2 por núcleo en
    # memoria, así un video largo no la llena
    from concurrent.futures import ThreadPoolExecutor
    hilos_n = os.cpu_count() or 4
    cupo = threading.BoundedSemaphore(2 * hilos_n)
    tareas = []
    with ThreadPoolExecutor(max_workers=hilos_n) as hilos:
        for i, buf in enumerate(_cuadros(video, f"crop={sw}:{hc}:0:{y0c}", hc, sw, n, "bgr24")):
            if i % PASO_DB and i != n - 1:
                continue
            cupo.acquire()
            tareas.append(hilos.submit(una, i, buf.copy()))
            tareas[-1].add_done_callback(lambda _: cupo.release())
    for t in tareas:
        t.result()  # si un cuadro falló, que se note
    for _ in range(1 + T_SUAVE):                      # muestras a <= 1 cuadro, luego unión de ±T_SUAVE
        u = m.copy()
        m[1:] |= u[:-1]
        m[:-1] |= u[1:]
    m = m[:, 0] | m[:, 1]                             # texto y gráficos se borran igual (se vuelven a poner en edición)
    return m, m


def _ventanas(n):
    """(vecinos, referencias, pesos de fundido, primer cuadro de la ventana siguiente)."""
    k = min(K, n)
    inicios = list(range(0, n - k + 1, S))
    if inicios[-1] + k < n:
        inicios.append(n - k)
    rejilla = list(range(0, n, PASO_REF))
    vs = []
    for a in inicios:
        c = a + (k - 1) / 2
        cand = sorted((g for g in rejilla if g < a or g >= a + k), key=lambda g: (abs(g - c), g))
        cerca = [g for g in cand if abs(g - c) <= VENTANA_REF]
        vs.append((list(range(a, a + k)), sorted((cerca + [g for g in cand if g not in cerca])[:R])))
    out = []
    for j, (nb, refs) in enumerate(vs):
        ant = max(0, vs[j - 1][0][-1] + 1 - nb[0]) if j else 0
        sig = max(0, nb[-1] + 1 - vs[j + 1][0][0]) if j + 1 < len(vs) else 0
        w = [min(1.0, (p + 1) / (ant + 1), (len(nb) - p) / (sig + 1)) for p in range(len(nb))]
        out.append((nb, refs, w, vs[j + 1][0][0] if j + 1 < len(vs) else n))
    return out


def _tomas(hs, th):
    """Número de toma de cada cuadro: corte donde la diferencia media con el cuadro anterior (fuera de los huecos)
    salta a más de 20 niveles de luma y a 4 veces la mediana de su alrededor."""
    n = len(th)
    d = np.zeros(n, np.float32)
    for i in range(1, n):
        fuera = ~hs[i] & ~hs[i - 1]
        d[i] = np.abs(th[i] - th[i - 1])[fuera].mean() if fuera.any() else 0
    corte = np.array([i and d[i] > 20 and d[i] > 4 * np.median(d[max(1, i - 15):i + 16]) for i in range(n)])
    return np.cumsum(corte)


def _referencias(nb, refs, n, hs, toma):
    """Cambia las referencias fijas por las que mejor destapan el hueco de la ventana: cuadros de la rejilla de la
    misma toma, a <= RADIO_REF, que dejan ver lo que la ventana tiene tapado (el subtítulo cambió de lugar o de
    largo). Con subtítulos siempre en la misma zona, las 4 vecinas fijas solo ven texto y la red inventa
    (manchas); así copia fondo real de hasta 10 s antes o después."""
    hueco = hs[nb].any(0)
    total = hueco.sum()
    if not total:
        return refs
    c = nb[len(nb) // 2]
    cand = [(g, hueco & ~hs[g]) for g in range(max(0, nb[0] - RADIO_REF) // PASO_REF * PASO_REF,
                                                min(n, nb[-1] + RADIO_REF + 1), PASO_REF)
            if not nb[0] <= g <= nb[-1] and toma[g] == toma[c]]
    elegidas, visto = [], np.zeros_like(hueco)
    while cand and len(elegidas) < R:
        g, v = max(cand, key=lambda x: ((x[1] & ~visto).sum(), -abs(x[0] - c)))
        if (v & ~visto).sum() < 0.02 * total:
            break
        elegidas.append(g)
        visto |= v
        cand = [x for x in cand if x[0] != g]
    resto = [g for g in refs if g not in elegidas]
    return sorted(elegidas + resto[:R - len(elegidas)])


TONOS = np.array([[255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255]], np.float32)
TONOS = (TONOS - TONOS.mean(1, keepdims=True)) / np.linalg.norm(TONOS - TONOS.mean(1, keepdims=True), axis=1,
                                                                 keepdims=True)   # rojo...magenta sin gris (RGB)


def _quitar_brillo(franja, bits, hb):
    """Resta el brillo de los subtítulos de color alrededor del hueco, en la franja (in situ).

    El brillo de estos estilos es una copia desenfocada del texto en su color, sumada encima. Por cuadro y por
    color de texto (verde, rojo, cian...: píxeles vivos dentro del hueco), se modela como la máscara de esos
    glifos desenfocada (sigma 0,3-1,2 renglones, la que mejor ajusta) por una amplitud, ajustada por mínimos
    cuadrados contra el tinte hacia ese color en el anillo de 2,5 renglones fuera del hueco, con un fondo que
    depende de la luz (la piel ya es rojiza, la ropa oscura no). Se resta ese tinte sin bajar del fondo de cada
    punto (así la piel no queda verdosa bajo el texto rojo) y solo si el modelo explica el tinte. Sin esto el brillo
    quedaba alrededor y la red lo copiaba dentro del hueco (manchas verdes y vino). Devuelve dónde corrigió, en
    bits como los huecos."""
    n, ch, tw = franja.shape[:3]
    corregido = np.zeros((n, ch, (tw + 7) // 8), np.uint8)
    tonos = np.zeros((n, len(TONOS)), bool)
    # cada cuadro es independiente: se reparten entre los núcleos (numpy y OpenCV sueltan el GIL)
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as hilos:
        list(hilos.map(lambda i: _brillo_cuadro(i, franja, bits, hb, corregido, tonos), range(n)))
    return corregido, tonos


def _brillo_cuadro(i, franja, bits, hb, corregido, tonos):
    """Un cuadro de _quitar_brillo (escribe en franja[i], corregido[i] y tonos[i])."""
    ch, tw = franja.shape[1:3]
    hueco = np.unpackbits(bits[i], -1, count=tw).astype(bool)
    if not hueco.any():
        return
    z = franja[i].astype(np.float32)
    mx, mn = z.max(-1), z.min(-1)
    viva = hueco & (mx - mn > 0.6 * mx) & (mx > 140)   # color de diseño, no piel (la piel es poco saturada)
    if viva.sum() < 20:
        return
    cz = z - z.mean(-1, keepdims=True)
    tono = (cz[viva] @ TONOS.T).argmax(1)
    cuenta = np.bincount(tono, minlength=len(TONOS))
    dh = cv2.distanceTransform((~hueco).astype(np.uint8), cv2.DIST_L2, 5)
    anillo = (~hueco) & (dh <= 2.5 * hb)
    cerca = np.clip((3 * hb - dh) / hb, 0, 1)        # la resta se apaga entre 2 y 3 renglones del hueco
    if anillo.sum() < 50:
        return
    resta = np.zeros_like(z)
    luma = z.mean(-1)
    ys, xs = np.nonzero(anillo)
    sel = slice(None, None, max(1, len(ys) // 4000))  # ~4000 puntos bastan para 4 coeficientes
    ys, xs = ys[sel], xs[sel]
    for k in np.flatnonzero(cuenta >= max(20, 0.15 * len(tono))):
        tonos[i, k] = True
        u = TONOS[k]
        glifo = np.zeros((ch, tw), np.float32)
        glifo[viva] = tono == k
        t = cz @ u
        base = np.stack([np.ones(len(ys), np.float32), luma[ys, xs]], 1)   # fondo según la luz (piel/ropa)
        err0 = float(((base @ np.linalg.lstsq(base, t[ys, xs], rcond=None)[0] - t[ys, xs]) ** 2).mean())
        mejor = None
        for sg in (0.3, 0.5, 0.8, 1.2):
            g = cv2.GaussianBlur(glifo, (0, 0), sg * hb)
            g /= max(float(g.max()), 1e-6)
            a = np.concatenate([base, g[ys, xs, None]], 1)
            coef = np.linalg.lstsq(a, t[ys, xs], rcond=None)[0]
            err = float(((a @ coef - t[ys, xs]) ** 2).mean())
            if mejor is None or err < mejor[0]:
                mejor = (err, coef, g)
        err, (b0, b1, amp), g = mejor
        if amp > 3 and err < 0.8 * err0:           # el brillo explica el tinte (no es el color de la escena)
            resta += (np.minimum(amp * g, np.maximum(t - b0 - b1 * luma, 0)) * cerca)[..., None] * u
    if resta.any():
        corregido[i] = np.packbits(np.abs(resta).max(-1) > 1.5, -1)
        franja[i] = np.clip(z - resta + 0.5, 0, 255)


GRIS = np.ones(3, np.float32) / np.sqrt(3)
OTRO = np.cross(TONOS, GRIS)                          # por tono, el otro eje del plano de color (sin gris)


def _celda(l, v):
    """Tramo de luma (16) y del otro eje de color (8, de -35 a 35) de cada punto."""
    return np.minimum((l / 16).astype(int), 15), np.clip(((v + 35) / 10).astype(int), 0, 7)


def _techos(franja, bits, toma, hb):
    """Por toma y color de subtítulo: el tinte máximo normal (percentil 97) hacia ese color según la luma y el otro
    eje de color (este solo en rojo y amarillo, los tonos de la piel), medido en los píxeles a más de 2,5
    renglones de todo texto. Así la piel (naranja) tiene su límite y el chaleco oscuro el suyo: el brillo rojo
    sobre el chaleco (vino) se distingue de la piel."""
    n, ch, tw = franja.shape[:3]
    techos = {}
    for tm in np.unique(toma):
        ids = np.flatnonzero(toma == tm)[::4]
        zs = []
        for i in ids:
            h = np.unpackbits(bits[i], -1, count=tw).astype(bool)
            lejos = cv2.distanceTransform((~h).astype(np.uint8), cv2.DIST_L2, 5)[::4, ::4] > 2.5 * hb
            zs.append(franja[i, ::4, ::4].astype(np.float32)[lejos])
        z = np.concatenate(zs)
        l = z.mean(1)
        cz = z - l[:, None]
        tabla = np.zeros((len(TONOS), 16, 8), np.float32)
        for k in range(len(TONOS)):
            t, (bl, bv) = cz @ TONOS[k], _celda(l, cz @ OTRO[k])
            glob = np.percentile(t, 97) if len(t) else 0.0
            solo_l = np.full(16, np.nan, np.float32)
            for b in range(16):
                if (bl == b).sum() >= 30:
                    solo_l[b] = np.percentile(t[bl == b], 97)
            ok = np.flatnonzero(~np.isnan(solo_l))
            solo_l = solo_l[ok[np.abs(ok[None] - np.arange(16)[:, None]).argmin(1)]] if len(ok) else np.full(16, glob)
            tabla[k] = solo_l[:, None]
            if TONOS[k] @ PIEL[::-1] < 0.5:           # verde, cian, azul: basta la luma (el otro eje daba
                continue                              # techos raros en bordes piel/ropa: manchas magenta)
            celda = bl * 8 + bv
            cuenta = np.bincount(celda, minlength=128)
            for c in np.flatnonzero(cuenta >= 30):
                tabla[k, c // 8, c % 8] = np.percentile(t[celda == c], 97)
        techos[tm] = tabla
    return techos


def _ajustar_color(rgb, huecos_bits, tonos, techo, hb):
    """Pasada final (in situ, rgb float HxWx3): alrededor del hueco (hasta 3 renglones), lo que un punto está
    teñido hacia el color de los subtítulos por encima del techo de la toma para su celda de color se resta,
    suavizado. Quita el brillo verde/rojo que la red copió o que quedó alrededor. Devuelve dónde se tocó."""
    tw = rgb.shape[1]
    h = np.unpackbits(huecos_bits, -1, count=tw).astype(bool)
    if not h.any() or not tonos.any():
        return None
    d = cv2.distanceTransform((~h).astype(np.uint8), cv2.DIST_L2, 5)
    peso = np.clip((3 * hb - d) / hb, 0, 1)
    # el brillo es un tinte suave: se mide sobre la imagen desenfocada (las rayas finas de la ropa no cuentan)
    # y se resta parejo, así el detalle queda y no aparecen puntos magenta/cian
    borrosa = cv2.GaussianBlur(rgb, (0, 0), 3)
    l = borrosa.mean(-1)
    cz = borrosa - l[..., None]
    resta = np.zeros_like(rgb)
    for k in np.flatnonzero(tonos):
        u = TONOS[k]
        bl, bv = _celda(l, cz @ OTRO[k])
        exceso = np.maximum(cz @ u - techo[k][bl, bv] - 2, 0) * peso
        resta += cv2.GaussianBlur(exceso, (0, 0), 2)[..., None] * u
    if not resta.any():
        return None
    rgb -= resta
    return np.minimum(np.abs(resta).max(-1) / 4, 1) * (peso > 0)


def _sttn(video: Path, text_analysis: Path, salida: Path, modo: str = "auto") -> Path:
    import torch
    import torch.nn.functional as F
    from clonador.sttn import InpaintGenerator

    t0 = time.time()
    ta = json.loads(Path(text_analysis).read_text(encoding="utf-8"))
    n = int(ta["n_frames"])
    tw = _ancho_red(ta)
    # ancho de salida: 720 (referencia para Kie) o el del original (Video Limpio: CLONADOR_SALIDA=original, así
    # el video vuelve con la misma calidad; solo la franja borrada viene escalada desde la red)
    sw = 2 * (ta["width"] // 2) if os.environ.get("CLONADOR_SALIDA") == "original" else OW
    fo = sw / tw                                      # la franja se escala así al superponerla
    alto_sal = round(ta["height"] * sw / ta["width"] / 2) * 2
    por_cuadro = modo == "cuadro" or (modo == "auto" and not _tarjetas_fiables(ta))
    oh, cy0, ch, y0c, hc = _geometria(ta, por_cuadro)
    padx = (432 * math.ceil(tw / 432) - tw) // 2
    fps = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                          "-of", "csv=p=0", str(video)], capture_output=True, text=True, check=True).stdout.strip()

    franja = np.empty((n, ch, tw, 3), np.uint8)
    res = {}

    def dec_franja():
        for i, b in enumerate(_cuadros(video, f"scale={tw}:{oh}:flags=lanczos,crop={tw}:{ch}:0:{cy0}", ch, tw, n, "rgb24")):
            franja[i] = b
        res["f"] = True

    def dec_mascaras():
        t = time.time()
        res["m"] = (mascaras_por_cuadro(video, ta, n, (y0c, hc), (tw, ch)) if por_cuadro else
                    mascaras(video, ta, n, (y0c, hc)))
        res["tm"] = time.time() - t
    hilos = [threading.Thread(target=dec_franja), threading.Thread(target=dec_mascaras)]
    for h in hilos:
        h.start()

    # Kads Studio (2026-11-09): también sin tarjeta NVIDIA. En la Mac con chip Apple usa su GPU (MPS); si no, el
    # procesador. Fuera de CUDA va en float32 (fp16 en CPU es lento y en MPS no siempre es estable).
    if torch.cuda.is_available():
        dev, dt = torch.device("cuda"), torch.float16
        libre = torch.cuda.mem_get_info()[0] / 2**30
        if libre < 1.5:
            print(f"borrar_texto: solo {libre:.1f} GB libres en la GPU (¿otro proceso?); puede ir lento", file=sys.stderr)
        torch.backends.cudnn.benchmark = False        # afinarlo costaba 5-9 s y no ganaba nada
    elif getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() and os.environ.get("CLONADOR_SIN_MPS") != "1":
        dev, dt = torch.device("mps"), torch.float32
        print("borrar_texto: STTN en la GPU de la Mac (MPS)", file=sys.stderr)
    else:
        dev, dt = torch.device("cpu"), torch.float32
        torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))
        print("borrar_texto: STTN en el procesador (sin GPU): más lento, misma calidad", file=sys.stderr)
    cl = torch.channels_last
    modelo = InpaintGenerator().cargar(PESOS).to(dev).eval().to(dt).to(memory_format=cl)
    with torch.inference_mode():                      # calentamiento con la forma real
        modelo.run(torch.zeros(K + R, 3, ch, tw + 2 * padx, device=dev, dtype=dt).contiguous(memory_format=cl), K)
    for h in hilos:
        h.join()
    if "m" not in res or "f" not in res:
        raise RuntimeError("falló la decodificación o las máscaras")

    # huecos por cuadro a la resolución de la red (cualquier píxel tocado cuenta), en bits
    esc = tw / ta["width"]
    if por_cuadro:
        bits, bits_red = res["m"]
    else:
        m720 = [(s, e, np.packbits(cv2.resize(m.astype(np.float32), (tw, ch), interpolation=cv2.INTER_AREA) > 1e-3, -1))
                for s, e, m in res["m"]]
        bits = np.zeros((n, ch, (tw + 7) // 8), np.uint8)
        for s, e, m in m720:
            bits[s:e + 1] |= m
        bits_red = bits
    con_hueco = bits.reshape(n, -1).any(1)

    def huecos(ids, b=bits):
        return np.unpackbits(b[ids], -1, count=tw)

    # miniaturas (1/8) de la franja y de los huecos para elegir referencias
    hs = np.empty((n, ch // 8, tw // 8), bool)
    for a in range(0, n, 256):
        u = np.unpackbits(bits_red[a:a + 256], -1, count=tw)[:, :ch // 8 * 8, :tw // 8 * 8]
        hs[a:a + 256] = u.reshape(len(u), ch // 8, 8, tw // 8, 8).max((2, 4)) > 0
    toma = _tomas(hs, franja[:, 4:ch // 8 * 8:8, 4:tw // 8 * 8:8].mean(-1, dtype=np.float32))
    t2 = time.time()
    hb = 1.25 * _bandas(ta)[1] * esc if por_cuadro else 0
    corregido, tonos = _quitar_brillo(franja, bits, hb) if por_cuadro else (None, None)
    techos = _techos(franja, bits, toma, hb) if por_cuadro else None
    t_brillo = time.time() - t2

    borde_al = np.ones((ch, 1), np.float32)          # la franja se funde en sus bordes que no son del cuadro
    rampa = np.linspace(0, 1, 10, dtype=np.float32)
    if cy0 > 0:
        borde_al[:10, 0] = rampa
    if cy0 + ch < oh:
        borde_al[-10:, 0] = rampa[::-1]
    borde_al = torch.from_numpy(borde_al).to(dev)

    def alfa(h):                                      # borde suave para pegar la franja
        hf = h.astype(np.float32)
        return np.maximum(cv2.GaussianBlur(cv2.dilate(hf, _elipse(max(1, round(2 * esc)))), (0, 0), 2 * esc), hf)

    # ffmpeg escala el original a 720 y le pega encima la franja RGBA (escalada si la red trabajó a menos)
    fc = (f"[1:v]scale={sw}:{alto_sal}:flags=lanczos,format=yuv420p[bg];"
          f"[0:v]scale={sw}:{round(ch * fo)}:flags=lanczos:out_color_matrix=bt709:out_range=limited,"
          f"format=yuva420p[fg];"
          f"[bg][fg]overlay=x=0:y={2 * round(cy0 * fo / 2)}:format=yuv420:shortest=1,format=yuv420p[o]")
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{tw}x{ch}",
                            "-framerate", fps, "-i", "-", "-i", str(video), "-filter_complex", fc,
                            "-map", "[o]", "-map", "1:a?", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
                            "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709",
                            "-color_trc", "bt709", "-color_range", "tv", "-c:a", "aac", "-b:a", "192k",
                            "-movflags", "+faststart", str(salida)], stdin=subprocess.PIPE)
    cola, err = queue.Queue(maxsize=64), []

    def escritor():
        while (item := cola.get()) is not None:
            if not err:
                try:
                    enc.stdin.write(item)
                except OSError as e:
                    err.append(e)                     # sigue vaciando la cola para no bloquear la GPU
    hilo = threading.Thread(target=escritor, daemon=True)
    hilo.start()

    t1 = time.time()
    acc, wsum, emitido = {}, {}, 0
    with torch.inference_mode():
        for nb, refs, w, sig in _ventanas(n):
            if con_hueco[nb].any():
                refs = _referencias(nb, refs, n, hs, toma)
            ids = nb + refs
            x = torch.from_numpy(franja[ids]).to(dev).permute(0, 3, 1, 2).float()
            if con_hueco[nb].any():
                mk = torch.from_numpy(huecos(ids, bits_red)).to(dev)[:, None].float()
                x = F.pad((x / 127.5 - 1.0) * (1 - mk), (padx, padx, 0, 0), mode="reflect").to(dt)
                out = modelo.run(x.contiguous(memory_format=cl), len(nb))[:, :, :, padx:padx + tw].float() * 255.0
            else:                                     # sin texto en toda la ventana: alfa 0, se deja igual
                out = x[:len(nb)]
            for kk, i in enumerate(nb):
                acc[i] = acc.get(i, 0) + out[kk] * w[kk]
                wsum[i] = wsum.get(i, 0) + w[kk]
            if sig > emitido:
                listos = range(emitido, sig)
                rgb = torch.stack([acc.pop(i) / wsum.pop(i) for i in listos])
                al = torch.from_numpy(np.stack([alfa(h) for h in huecos(list(listos))])).to(dev)[:, None]
                if corregido is not None:                # hueco sobre la franja sin brillo, pegada donde se corrigió
                    fr = torch.from_numpy(franja[emitido:sig]).to(dev).permute(0, 3, 1, 2).float()
                    rgb = rgb * al + fr * (1 - al)
                    ac = np.stack([alfa(h) for h in huecos(list(listos), corregido)])
                    al = torch.maximum(al, torch.from_numpy(ac).to(dev)[:, None])
                    rn, an = rgb.permute(0, 2, 3, 1).contiguous().cpu().numpy(), al[:, 0].cpu().numpy()
                    for kk, i in enumerate(listos):     # pasada de color contra el techo de la toma
                        pw = _ajustar_color(rn[kk], bits[i], tonos[max(0, i - 2):i + 3].any(0), techos[toma[i]], hb)
                        if pw is not None:
                            an[kk] = np.maximum(an[kk], cv2.GaussianBlur(pw.astype(np.float32), (0, 0), 1.5))
                    rgb = torch.from_numpy(rn).to(dev).permute(0, 3, 1, 2)
                    al = torch.from_numpy(an).to(dev)[:, None]
                al = al * borde_al
                rgba = torch.cat([rgb, al * 255.0], 1).add_(0.5).clamp_(0, 255).to(torch.uint8)
                for f in rgba.permute(0, 2, 3, 1).contiguous().cpu().numpy():
                    cola.put(f.tobytes())
                emitido = sig
                # avance para la app: «PROGRESO <hechos>/<total>» cada ~2 %
                if emitido * 50 // n > (emitido - len(listos)) * 50 // n or emitido == n:
                    print(f"PROGRESO {emitido}/{n}", file=sys.stderr, flush=True)
    t_red = time.time() - t1
    cola.put(None)
    hilo.join()
    enc.stdin.close()
    enc.wait()
    if err or enc.returncode:
        raise RuntimeError(f"ffmpeg falló al codificar ({err[0] if err else enc.returncode})")
    print(f"borrar_texto: {n} cuadros en {time.time() - t0:.0f} s (STTN {t_red:.0f} s, franja {tw}x{ch} en y={cy0}, "
          f"máscaras {'por cuadro' if por_cuadro else 'por tarjeta'} {res['tm']:.0f} s, brillo {t_brillo:.0f} s, "
          f"{toma[-1] + 1} tomas)",
          file=sys.stderr)
    return salida


def borrar(video: Path, text_analysis: Path, salida: Path, modo: str = "auto") -> Path:
    """STTN en la GPU (torch en este Python o en CLONADOR_PY_GPU); si no se puede, Telea con aviso.
    modo: "auto" (por cuadro si las tarjetas no son fiables), "cuadro" o "tarjeta"."""
    video, text_analysis, salida = (Path(p).resolve() for p in (video, text_analysis, salida))
    try:
        import torch  # noqa: F401
        import rapidocr_onnxruntime  # noqa: F401
        # Kads Studio: STTN con lo que haya (CUDA, MPS o CPU); Telea solo si se pide (CLONADOR_TELEA=1) o si falla
        if os.environ.get("CLONADOR_TELEA") != "1":
            try:
                return _sttn(video, text_analysis, salida, modo)
            except Exception as e:  # noqa: BLE001
                print(f"borrar_texto: STTN falló ({e}); uso Telea (calidad menor, revisar)", file=sys.stderr)
                from clonador.limpiar_texto import limpiar
                return limpiar(video, text_analysis, salida)
    except ImportError:
        pass
    if PY_GPU.exists():
        r = subprocess.run([str(PY_GPU), "-m", "clonador.borrar_texto", "--gpu", str(video), str(text_analysis), str(salida),
                            modo], cwd=RAIZ)
        if r.returncode == 0:
            return salida
        print("borrar_texto: STTN falló; uso Telea (calidad menor, revisar)", file=sys.stderr)
    else:
        print(f"borrar_texto: no encuentro {PY_GPU}; uso Telea (calidad menor, revisar)", file=sys.stderr)
    from clonador.limpiar_texto import limpiar
    return limpiar(video, text_analysis, salida)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "--gpu":
        _sttn(*map(Path, a[1:4]), *a[4:5])
    else:
        print(borrar(*map(Path, a[:3]), *a[3:4]))
