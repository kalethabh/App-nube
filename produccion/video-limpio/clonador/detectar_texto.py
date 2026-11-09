"""Detecta el texto quemado de un video (subtítulos, precios, llamados a la acción) y escribe un
text_analysis.json con el formato que lee borrar_texto (captions.chunks + overlays con fill_bbox).

Pasos:
1. OCR (RapidOCR en la GPU si hay, dentro del entorno de la GPU: CLONADOR_PY_GPU) sobre ~10 cuadros por segundo
   escalados a 540 px del lado corto; el reconocimiento se reutiliza si la caja no cambió. ~0,3 s por
   muestra (3 min para 61 s de video).
2. Las cajas se unen en pistas (misma zona y texto parecido en muestras seguidas). Las cajas partidas
   o las letras que aparecen de a una ("R" -> "R$1" -> "R$197") se absorben en la pista que las contiene.
3. Subtítulos: el grupo más grande de pistas quietas, derechas, de igual alto y a la misma altura del
   cuadro. Sus colores se miden juntos (todas las tarjetas comparten estilo).
4. Colores de glifo (k-medias de los píxeles junto a bordes fuertes): de diseño (blanco o saturado, no
   piel/ropa/sombra), de trazo fino y más claros que su entorno; o un relleno encerrado por un contorno
   claro. Máscara = esos colores en >= 50 % de las muestras; además trazo, halo (diferencia con la
   muestra vecina sin texto), palabras y, en subtítulos, emoji pegados a la línea.
5. Resto de pistas: sobreimpreso (aviso: precio, CTA) si está derecho, no se mueve con la cámara, sus
   glifos son estables y contrastan; si no, texto de escena (carteles, etiquetas, tatuajes): va a
   scene_text_kept y no se borra. Limitación: con cámara fija, un cartel muy contrastado y de color de
   diseño puede pasar por aviso.
6. Cuadro a cuadro: bordes de cada tarjeta, palabra resaltada y destellos del color del aviso fuera de
   los glifos (brillo verde de "R$10"), que salen como aviso aparte con máscara rectangular.

Los textos salen del OCR chino-latino de RapidOCR: pierde tildes y a veces espacios ("voce amamenta"),
así que para traducir conviene la transcripción; posición, tiempos, colores y tamaño sí sirven para
volver a dibujar el texto con el mismo estilo.

Uso: python -m clonador.detectar_texto "<video>" trabajos/<trabajo>/analisis/texto.json
"""
import difflib
import json
import math
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

import cv2
import numpy as np

from clonador.borrar_texto import DIL_SUB, PY_GPU, RAIZ, _cuadros, _elipse, motor_ocr

LADO_OCR, FPS_OCR, SCORE_MIN = 540, 10, 0.5
TOL_COLOR = 45                             # distancia máxima por canal para "mismo color" (igual en borrar_texto)
LUMA = np.array([0.114, 0.587, 0.299], np.float32)   # BGR


def _probar(video):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
                        "stream=width,height,r_frame_rate,nb_read_packets", "-of", "json", str(video)],
                       capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)["streams"][0]
    a, b = map(int, s["r_frame_rate"].split("/"))
    return {"w": s["width"], "h": s["height"], "fps": a / b, "n": int(s["nb_read_packets"])}


def _hex(bgr):
    b, g, r = (int(round(float(v))) for v in bgr)
    return f"#{r:02X}{g:02X}{b:02X}"


def _norm(t):
    return "".join(ch for ch in t.lower() if ch.isalnum())


def _iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - ix * iy
    return ix * iy / u if u > 0 else 0.0


# ---------------------------------------------------------------- 1. OCR sobre muestras

def _ocr(video, info):
    """[(cuadro, [(caja x0y0x1y1, ángulo en grados, texto, puntaje)])] en píxeles del original."""
    motor = motor_ocr()
    det = motor.text_detector
    esc = LADO_OCR / min(info["w"], info["h"])
    ow, oh = 2 * round(info["w"] * esc / 2), 2 * round(info["h"] * esc / 2)
    det.preprocess_op[0].limit_type, det.preprocess_op[0].limit_side_len = "max", max(ow, oh)
    paso = max(1, round(info["fps"] / FPS_OCR))
    fx, fy = info["w"] / ow, info["h"] / oh
    muestras, previos = [], []
    for i, img in enumerate(_cuadros(video, f"scale={ow}:{oh}:flags=bicubic", oh, ow, info["n"], "bgr24")):
        if i % paso:
            continue
        cajas, _ = det(img)
        res, actuales = [], []
        if cajas is not None and len(cajas):
            recortes = motor.get_crop_img_list(img, cajas)
            # el reconocimiento es lo caro: se reutiliza si la caja y su contenido no cambiaron
            minis = [cv2.resize(cv2.cvtColor(r, cv2.COLOR_BGR2GRAY), (64, 16)).astype(np.int16) for r in recortes]
            textos, falta = [None] * len(cajas), []
            for j, (q, m) in enumerate(zip(cajas, minis)):
                for q0, m0, tx in previos:
                    if np.abs(q - q0).max() <= 3 and np.abs(m - m0).mean() < 8:
                        textos[j] = tx
                        break
                else:
                    falta.append(j)
            if falta:
                nuevos, _ = motor.text_recognizer([recortes[j] for j in falta])
                for j, tx in zip(falta, nuevos):
                    textos[j] = tx
            actuales = [(np.asarray(q, np.float32), m, tx) for q, m, tx in zip(cajas, minis, textos)]
            for q, (t, s) in zip(cajas, textos):
                if s >= SCORE_MIN and _norm(t):
                    q = np.asarray(q, np.float32) * [fx, fy]
                    ang = math.degrees(math.atan2(q[1, 1] - q[0, 1], q[1, 0] - q[0, 0]))
                    res.append(([float(q[:, 0].min()), float(q[:, 1].min()), float(q[:, 0].max()), float(q[:, 1].max())],
                                ang, t.strip(), float(s)))
        muestras.append((i, res))
        previos = actuales
    return muestras


# ---------------------------------------------------------------- 2. pistas

def _pistas(muestras):
    """Une las cajas de muestras seguidas (hasta 2 sin ver) en pistas con cajas, textos y puntajes."""
    pistas, activas = [], []
    for k, (_, res) in enumerate(muestras):
        usadas = set()
        for caja, ang, t, s in sorted(res, key=lambda r: -r[3]):
            mejor, puntos = None, 0.0
            for j in activas:
                p = pistas[j]
                if j in usadas:
                    continue
                iou = _iou(caja, p["cajas"][-1])
                sim = difflib.SequenceMatcher(None, _norm(t), _norm(p["textos"][-1])).ratio()
                if (iou >= 0.4 and sim >= 0.6 or iou >= 0.15 and sim >= 0.9) and iou + sim > puntos:
                    mejor, puntos = j, iou + sim
            if mejor is None:
                mejor = len(pistas)
                pistas.append({"k": [], "cajas": [], "ang": [], "textos": [], "scores": []})
                activas.append(mejor)
            usadas.add(mejor)
            p = pistas[mejor]
            for c, v in zip(("k", "cajas", "ang", "textos", "scores"), (k, caja, ang, t, s)):
                p[c].append(v)
        activas = [j for j in activas if k - pistas[j]["k"][-1] <= 2]
    for p in pistas:
        p["union"] = [min(c[0] for c in p["cajas"]), min(c[1] for c in p["cajas"]),
                      max(c[2] for c in p["cajas"]), max(c[3] for c in p["cajas"])]
        p["texto"] = _moda(p)
    # absorber cajas partidas y letras que se revelan de a una dentro de otra pista contemporánea
    pistas.sort(key=lambda p: -(p["union"][2] - p["union"][0]) * (p["union"][3] - p["union"][1]))
    fuera = set()
    for a, pa in enumerate(pistas):
        for b in range(a + 1, len(pistas)):
            pb = pistas[b]
            if b in fuera or pb["k"][0] > pa["k"][-1] + 2 or pb["k"][-1] < pa["k"][0] - 3:
                continue
            ua, ub = pa["union"], pb["union"]
            dentro = (max(0, min(ua[2], ub[2]) - max(ua[0], ub[0])) * max(0, min(ua[3], ub[3]) - max(ua[1], ub[1])) /
                      max(1.0, (ub[2] - ub[0]) * (ub[3] - ub[1])))
            na, nb = _norm(pa["texto"]), _norm(pb["texto"])
            m = difflib.SequenceMatcher(None, na, nb).find_longest_match(0, len(na), 0, len(nb)).size
            if dentro >= 0.7 and m >= 0.8 * len(nb):
                for c in ("k", "cajas", "ang", "textos", "scores"):
                    pa[c] += pb[c]
                orden = np.argsort(pa["k"], kind="stable")
                for c in ("k", "cajas", "ang", "textos", "scores"):
                    pa[c] = [pa[c][i] for i in orden]
                fuera.add(b)
    pistas = [p for j, p in enumerate(pistas) if j not in fuera]
    for p in pistas:
        p["union"] = [min(c[0] for c in p["cajas"]), min(c[1] for c in p["cajas"]),
                      max(c[2] for c in p["cajas"]), max(c[3] for c in p["cajas"])]
        p["texto"] = _moda(p)
        p["alto"] = float(np.median([c[3] - c[1] for c in p["cajas"]]))
        p["muestras"] = sorted(set(p["k"]))
    return sorted(pistas, key=lambda p: (p["k"][0], p["union"][1]))


def _moda(p):
    cuenta = Counter(_norm(t) for t in p["textos"])
    top = cuenta.most_common(1)[0][0]
    return max((t for t in p["textos"] if _norm(t) == top), key=len)


# ---------------------------------------------------------------- 3. recortes y análisis por pista

def _recortes(video, info, pistas, muestras):
    """Recortes (cuadro -> región) de cada pista en sus muestras y en la muestra anterior/siguiente."""
    w, h = info["w"], info["h"]
    por_cuadro = {}
    for j, p in enumerate(pistas):
        x0, y0, x1, y1 = p["union"]
        a = p["alto"]
        p["region"] = (max(0, int(x0 - 2 * a)), max(0, int(y0 - 0.7 * a)),
                       min(w, int(math.ceil(x1 + 2 * a))), min(h, int(math.ceil(y1 + 0.7 * a))))
        k0, k1 = p["muestras"][0], p["muestras"][-1]
        p["refs"] = [muestras[k][0] for k in (k0 - 1, k1 + 1) if 0 <= k < len(muestras)]
        p["rec"] = {}
        for f in [muestras[k][0] for k in p["muestras"]] + p["refs"]:
            por_cuadro.setdefault(f, []).append(j)
    if not por_cuadro:
        return
    ultimo = max(por_cuadro) + 1
    for i, buf in enumerate(_cuadros(video, "null", h, w, ultimo, "bgr24")):
        for j in por_cuadro.get(i, ()):
            x0, y0, x1, y1 = pistas[j]["region"]
            pistas[j]["rec"][i] = buf[y0:y1, x0:x1].copy()


def _coincide(X, c):
    return np.abs(X.astype(np.int16) - np.asarray(c, np.int16)).max(-1) < TOL_COLOR


def _vivo(c):
    """Color de diseño: blanco/gris claro o saturado (la piel, la ropa oscura y la sombra no lo son)."""
    croma = float(c.max() - c.min())
    return float(c @ LUMA) >= 200 and croma < 60 or croma >= 110


def _geo(p):
    """Movimiento (mediana del corrimiento entre muestras, en altos de caja), inclinación y centro."""
    c = np.array(p["cajas"])
    mov = np.abs(np.diff((c[:, :2] + c[:, 2:]) / 2, axis=0)).sum(1) if len(c) > 1 else np.zeros(1)
    p["mov"] = float(np.median(mov) / p["alto"])
    p["angulo"] = float(np.median(np.abs(p["ang"])))
    # desnivel de la caja (px); en palabras cortas el ángulo del OCR es ruidoso
    p["torcido"] = float(np.median(np.abs(np.tan(np.radians(p["ang"]))) * (c[:, 2] - c[:, 0]))) > max(3.0, 0.25 * p["alto"])
    p["cx"], p["cy"] = float(np.median((c[:, 0] + c[:, 2]) / 2)), float(np.median((c[:, 1] + c[:, 3]) / 2))


def _prep(p, muestras):
    """Recortes de las muestras de la pista, núcleo (cajas del OCR) y zona de búsqueda (coords de región)."""
    x0r, y0r = p["region"][:2]
    X = np.stack([p["rec"][muestras[k][0]] for k in p["muestras"]])
    nucleo = np.zeros(X.shape[1:3], np.uint8)
    for c in p["cajas"]:
        nucleo[max(0, int(c[1] - y0r)):int(c[3] - y0r) + 1, max(0, int(c[0] - x0r)):int(c[2] - x0r) + 1] = 1
    return X, nucleo > 0, cv2.dilate(nucleo, _elipse(max(1, round(0.3 * p["alto"])))) > 0


def _colores(items, a):
    """Colores de glifo de una o varias pistas del mismo estilo -> (compactos, de glifo).

    k-medias de los píxeles junto a bordes fuertes dentro de las cajas del OCR; un color es de glifo si
    es de diseño (_vivo), forma trazos finos (no una mancha de fondo) y es más claro que lo que lo rodea
    (contorno o sombra)."""
    cerca = _elipse(max(1, round(0.08 * a)))
    px = []
    for X, nuc, _ in items:
        for s in range(len(X)):
            L = X[s].astype(np.float32) @ LUMA
            g = (np.abs(cv2.Sobel(L, cv2.CV_32F, 1, 0)) + np.abs(cv2.Sobel(L, cv2.CV_32F, 0, 1))) / 4
            px.append(X[s][(cv2.dilate((g > 60).astype(np.uint8), cerca) > 0) & nuc])
    px = np.concatenate(px).astype(np.float32)
    if len(px) < 30:
        return [], []
    px = px[np.random.default_rng(0).permutation(len(px))[:30000]]
    _, lab, cen = cv2.kmeans(px, 6, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0), 3,
                             cv2.KMEANS_PP_CENTERS)
    lab = lab.ravel()
    colores, claros = [], []
    for c in np.argsort(-np.bincount(lab, minlength=6)):
        m = lab == c
        if m.mean() < 0.04 or np.median(np.abs(px[m] - cen[c]).max(1)) > 38:   # el croma 4:2:0 dispersa
            continue
        col = np.median(px[m], 0)
        if any(np.abs(col - o).max() < 40 for o in colores):
            continue
        colores.append(col)
        if not _vivo(col):
            continue
        prof, lc, la = [], [], []
        for X, nuc, zona in items:
            M = _coincide(X, col) & zona
            for s in range(len(X)):
                prof.append(cv2.distanceTransform(M[s].astype(np.uint8), cv2.DIST_L2, 3)[M[s] & nuc])
                lc.append(X[s][M[s] & nuc])
                la.append(X[s][(cv2.dilate(M[s].astype(np.uint8), _elipse(2)) > 0) & ~M[s] & zona])
        prof, lc, la = np.concatenate(prof), np.concatenate(lc), np.concatenate(la)
        if (len(prof) and len(la) and np.percentile(prof, 75) <= max(1.5, 0.18 * a) and
                np.median(lc.astype(np.float32) @ LUMA) - np.median(la.astype(np.float32) @ LUMA) >= 35):
            claros.append(col)
    # relleno dentro de un contorno claro (R$197 rojo con borde blanco): color de diseño que ocupa tanto
    # como el glifo aceptado y cuyo entorno inmediato es, en buena parte, ese glifo (no un borde suavizado)
    for col in [c for c in colores if _vivo(c) and not any(c is x for x in claros)] if claros else []:
        toca = tot = area = area_g = 0
        for X, nuc, zona in items:
            M = _coincide(X, col) & zona
            G = np.stack([_coincide(X, c) for c in claros]).any(0) & zona
            area, area_g = area + int((M & nuc).sum()), area_g + int((G & nuc).sum())
            for s in range(len(X)):
                ani = (cv2.dilate(M[s].astype(np.uint8), _elipse(2)) > 0) & ~M[s] & nuc
                toca += int((ani & G[s]).sum())
                tot += int(ani.sum())
        if tot and toca / tot >= 0.35 and area >= 0.5 * area_g:
            claros.append(col)
    return colores, claros


def _glifos(p, X, nuc, zona, colores, claros):
    """Máscara de glifos (colores de glifo en >= 50 % de las muestras) y estilo de una pista."""
    x0r, y0r = p["region"][:2]
    N, H, W, _ = X.shape
    a = p["alto"]
    claros = list(claros)
    for _ in range(2):                         # texto con contorno claro: el relleno queda en los huecos
        Ms = np.stack([_coincide(X, c) for c in claros])
        U = (Ms.any(0).mean(0) >= 0.5) & zona
        _, lab = cv2.connectedComponents(np.pad(~U, 1).astype(np.uint8), connectivity=4)
        huecos = (lab[1:-1, 1:-1] != lab[0, 0]) & ~U
        if huecos.sum() < 0.1 * U.sum():
            break
        nuevos = [c for c in colores if _vivo(c) and not any(c is x for x in claros) and
                  _coincide(X, c)[:, huecos].mean() >= 0.5]
        if not nuevos:
            break
        claros += nuevos[:1]
    Ms = np.stack([_coincide(X, c) for c in claros])
    pres = Ms.any(0).mean(0)
    U = (pres >= 0.5) & zona
    n_, cc, st, _ = cv2.connectedComponentsWithStats(U.astype(np.uint8), connectivity=8)
    for j in range(1, n_):                     # motas y manchas del fondo fuera de la caja del OCR
        if st[j, cv2.CC_STAT_AREA] < max(3, 0.01 * a * a) or nuc[cc == j].mean() < 0.5:
            U[cc == j] = False
    # estabilidad: cerca de los glifos, de los píxeles que muestran el color a menudo, cuántos lo muestran
    # casi siempre (el texto de escena se corre con la cámara y reparte el color entre muchos píxeles)
    cerca = cv2.dilate(U.astype(np.uint8), _elipse(max(2, round(0.1 * a)))) > 0
    estab = float((U & nuc).sum() / max(1, ((pres >= 0.15) & nuc & cerca).sum()))
    if U.sum() < 0.03 * nuc.sum():
        return None

    # relleno, resalte (cambia con el tiempo en los mismos píxeles) y contorno claro (en el borde)
    borde = U & ~(cv2.erode(U.astype(np.uint8), _elipse(1)) > 0)
    interior = U & ~borde
    part = []
    for j in range(len(claros)):
        pc = Ms[j].mean(0)
        part.append((float(pc[U].mean()), float(pc[borde].mean()), float(pc[interior].mean()) if interior.any() else 0.0))
    trazo_claro = None
    if len(claros) >= 2:
        j = int(np.argmax([b - i for _, b, i in part]))
        if part[j][1] - part[j][2] >= 0.35:
            trazo_claro = j
    rell = sorted((j for j in range(len(claros)) if j != trazo_claro), key=lambda j: -part[j][0])
    relleno, resalte, extra = claros[rell[0]], None, []
    for j in rell[1:]:
        if part[j][0] < 0.04:
            continue
        pj = Ms[j].mean(0) >= 0.1
        alterna = ((Ms[rell[0]].mean(0) >= 0.1) & pj & U).sum() / max(1, (pj & U).sum())
        if alterna >= 0.3 and resalte is None:
            resalte = claros[j]
        else:
            extra.append(claros[j])

    med = np.median(X, 0).astype(np.float32)
    dist = cv2.distanceTransform((~U).astype(np.uint8), cv2.DIST_L2, 3)
    anillos = []
    for d in range(1, 8):
        r = (dist > d - 1) & (dist <= d)
        anillos.append(float(np.median(med[r] @ LUMA)) if r.any() else 255.0)
    r1 = (dist > 0) & (dist <= 2)
    fondo = np.median(med[r1], 0) if r1.any() else relleno
    if trazo_claro is not None:
        trazo = claros[trazo_claro]
        ancho = float(Ms[trazo_claro].mean(0)[U].sum() / max(1, borde.sum()))
    elif min(anillos[:2]) < 90:                # contorno o sombra oscura (el 1.er anillo puede estar suavizado)
        d0 = 0 if anillos[0] < 90 else 1
        r = (dist > d0) & (dist <= d0 + 1)
        trazo = np.median(med[r], 0)
        ancho = float(d0 + next((d for d, v in enumerate(anillos[d0:]) if v >= 90), 7 - d0))
    else:
        trazo, ancho = None, 0.0

    # halo (contorno + sombra/brillo): hasta dónde la muestra difiere de la muestra vecina sin texto
    halo, lejos = None, dist > 0.8 * a
    for f in p["refs"]:
        ref = p["rec"][f].astype(np.int16)
        mejor = 0
        for s in range(N):
            dif = np.abs(X[s].astype(np.int16) - ref).max(-1)
            base = float(np.median(dif[lejos])) if lejos.any() else 20.0
            if base > 25:
                continue
            d = 0
            while d < round(0.6 * a):
                ani = (dist > d) & (dist <= d + 1) & zona
                if not ani.any() or np.median(dif[ani]) <= base + 30:
                    break
                d += 1
            mejor = max(mejor, d)
        halo = mejor if halo is None else min(halo, mejor)

    # palabras: huecos en la proyección de columnas de los glifos
    col = cv2.morphologyEx(U.any(0).astype(np.uint8)[None], cv2.MORPH_CLOSE,
                           np.ones((1, max(3, round(0.2 * a))), np.uint8))[0]
    cortes = np.flatnonzero(np.diff(np.r_[0, col, 0]))
    ys, xs = np.nonzero(U)
    return {"U": U, "claros": claros, "relleno": relleno, "resalte": resalte, "extra": extra, "trazo": trazo,
            "ancho_trazo": ancho, "halo": halo or 0, "estab": estab,
            "contraste": float(np.abs(relleno - (trazo if trazo is not None else fondo)).max()),
            "palabras": [(int(i), int(j)) for i, j in zip(cortes[::2], cortes[1::2])],
            "bbox": [int(xs.min() + x0r), int(ys.min() + y0r), int(xs.max() + x0r + 1), int(ys.max() + y0r + 1)]}


def _extender(p, an, muestras):
    """Suma a la máscara piezas vecinas estables del tamaño de un carácter (emoji, letras fuera de la caja
    del OCR). Nada más grande: bancos, cielo o ropa clara quietos también son "vivos y estables"."""
    x0r, y0r, _, _ = p["region"]
    X = np.stack([p["rec"][muestras[k][0]] for k in p["muestras"]])
    if len(X) < 3:
        return
    U, a = an["U"], p["alto"]
    ys = np.nonzero(U.any(1))[0]
    alto_linea = max(ys[-1] - ys[0] + 1, a)
    filas = np.zeros_like(U)
    filas[max(0, ys[0] - round(0.3 * a)):ys[-1] + round(0.3 * a) + 1] = True
    Xi = X.astype(np.int16)
    quieto = (Xi.max(0) - Xi.min(0)).max(-1) < 40
    med = np.median(X, 0)
    viv = (med.max(-1) - med.min(-1) > 90) | (med @ LUMA > 200)
    cand = ((np.stack([_coincide(X, c) for c in an["claros"]]).any(0).mean(0) >= 0.6) | (quieto & viv)) & filas & ~U
    n_, cc, st, _ = cv2.connectedComponentsWithStats(cand.astype(np.uint8), connectivity=8)
    cambio = True
    while cambio:
        cambio = False
        xs = np.nonzero(U.any(0))[0]
        for j in range(1, n_):
            x, y, w, h, area = st[j]
            if (area and 0.3 * a <= h <= 1.5 * alto_linea and w <= 1.8 * alto_linea and area >= 0.05 * a * a and
                    x > 0 and y > 0 and x + w < U.shape[1] and y + h < U.shape[0] and
                    x <= xs[-1] + 0.6 * a and x + w >= xs[0] - 0.6 * a):
                U |= cc == j
                st[j, cv2.CC_STAT_AREA] = 0
                cambio = True
    yy, xx = np.nonzero(U)
    an["bbox"] = [int(xx.min() + x0r), int(yy.min() + y0r), int(xx.max() + x0r + 1), int(yy.max() + y0r + 1)]


# ---------------------------------------------------------------- 4-5. clasificar, agrupar, refinar

def _refinar(video, info, cartas, muestras):
    """Primer y último cuadro exactos de cada tarjeta, qué palabra está resaltada (si tiene resalte) y
    cuadros con destello/brillo del color del relleno fuera de los glifos (avisos)."""
    n = info["n"]
    fr = [f for f, _ in muestras]
    por_cuadro = {}
    for c in cartas:
        k0, k1 = c["p"]["muestras"][0], c["p"]["muestras"][-1]
        c["fa"] = fr[k0 - 1] + 1 if k0 > 0 else 0
        c["fb"] = fr[k1 + 1] - 1 if k1 + 1 < len(fr) else n - 1
        c["score"], c["res"], c["tinte"] = {}, {}, {}
        rel = np.asarray(c["an"]["relleno"], np.float32)
        d = rel - rel.mean()
        c["dir"] = d / np.linalg.norm(d) if not c["subtitulo"] and np.linalg.norm(d) > 80 else None
        for i in range(c["fa"], c["fb"] + 1):
            por_cuadro.setdefault(i, []).append(c)
    for i, buf in enumerate(_cuadros(video, "null", info["h"], info["w"], n, "bgr24")):
        for c in por_cuadro.get(i, ()):
            x0, y0, x1, y1 = c["p"]["region"]
            X = buf[y0:y1, x0:x1]
            U = c["an"]["U"]
            m = np.zeros(U.shape, bool)
            for col in c["colores"]:
                m |= _coincide(X, col)
            c["score"][i] = float(m[U].mean())
            if c["dir"] is not None:                  # teñido hacia el tono del relleno (brillo verde...)
                Xf = X.astype(np.float32)
                c["tinte"][i] = ((Xf - Xf.mean(-1, keepdims=True)) @ c["dir"]) > 60
            if c.get("resalte") is not None:
                r = _coincide(X, c["resalte"]) & U
                c["res"][i] = [float(r[:, a:b].sum() / max(1, U[:, a:b].sum())) for a, b in c["an"]["palabras"]]
    for c in cartas:
        k0, k1 = c["p"]["muestras"][0], c["p"]["muestras"][-1]
        dentro = [c["score"][fr[k]] for k in c["p"]["muestras"]]
        umbral = (0.25 if c["revelado"] else 0.5) * float(np.median(dentro))
        s, e = fr[k0], fr[k1]
        while s - 1 >= c["fa"] and c["score"][s - 1] >= umbral:
            s -= 1
        while e + 1 <= c["fb"] and c["score"][e + 1] >= umbral:
            e += 1
        c["s"], c["e"] = s, e
        c["destello"] = None
        if c["dir"] is not None:
            T = np.stack([c["tinte"][i] for i in range(s, e + 1)])
            fuera = T & (T.mean(0) < 0.5) & ~(cv2.dilate(c["an"]["U"].astype(np.uint8),
                                                         _elipse(c["an"]["halo"] + 2)) > 0)
            n_px = fuera.reshape(len(T), -1).sum(1)
            fl = np.flatnonzero(n_px > max(30, 3 * np.median(n_px) + 20))
            if len(fl):
                ys, xs = np.nonzero(fuera[fl].any(0))
                x0, y0 = c["p"]["region"][:2]
                c["destello"] = (s + int(fl[0]), s + int(fl[-1]),
                                 [int(xs.min() + x0), int(ys.min() + y0), int(xs.max() + x0 + 1), int(ys.max() + y0 + 1)])


def _cartas(pistas, muestras, info):
    """Separa subtítulos, avisos y texto de escena -> (tarjetas, texto de escena conservado)."""
    fps = info["fps"]
    for p in pistas:
        _geo(p)
    quietas = [p for p in pistas if not p["torcido"] and p["mov"] <= 0.12]
    # subtítulos: el grupo más grande de pistas quietas de igual alto y a la misma altura del cuadro
    grupos = []
    for p in sorted(quietas, key=lambda p: -len(p["muestras"])):
        for g in grupos:
            if 0.7 <= p["alto"] / g[0]["alto"] <= 1.4 and abs(p["cy"] - g[0]["cy"]) <= g[0]["alto"]:
                g.append(p)
                break
        else:
            grupos.append([p])
    subs = max(grupos, key=len) if grupos else []
    subs = subs if len(subs) >= 3 else []
    ids = {id(p) for p in subs}
    cartas, escena = [], []

    def a_escena(p, motivo):
        f0, f1 = muestras[p["muestras"][0]][0], muestras[p["muestras"][-1]][0]
        escena.append({"text": p["texto"], "start": round(f0 / fps, 3), "end": round((f1 + 1) / fps, 3),
                       "bbox_px_x0y0x1y1": [round(v) for v in p["union"]], "reason": motivo})

    if subs:                                   # colores comunes a todos los subtítulos
        items = [_prep(p, muestras) for p in subs]
        colores, claros = _colores(items, float(np.median([p["alto"] for p in subs])))
        ans = [(_glifos(p, *it, colores, claros) if claros else None) for p, it in zip(subs, items)]
        buenos = [an for an in ans if an]
        if buenos:
            def cual(c):
                return min(range(len(claros)), key=lambda j: np.abs(claros[j] - c).max())
            fill = Counter(cual(an["relleno"]) for an in buenos).most_common(1)[0][0]
            res = Counter(cual(an["resalte"]) for an in buenos if an["resalte"] is not None).most_common(1)
            res = res[0][0] if res and res[0][0] != fill else None
            for an in buenos:
                an["relleno"] = claros[fill]
                an["resalte"] = claros[res] if res is not None else None
                an["extra"] = [c for j, c in enumerate(claros) if j not in (fill, res) and
                               (an["trazo"] is None or np.abs(c - an["trazo"]).max() >= 40)]
        for p, an in zip(subs, ans):
            if an is None:
                a_escena(p, "subtítulo sin glifos medibles (revisar)")
            else:
                cartas.append({"p": p, "an": an, "subtitulo": True})
    for p in pistas:
        if id(p) in ids:
            continue
        if p["torcido"] or p["mov"] > 0.12:
            a_escena(p, "se mueve con la cámara" if p["mov"] > 0.12 else "inclinado")
            continue
        it = _prep(p, muestras)
        colores, claros = _colores([it], p["alto"])
        an = _glifos(p, *it, colores, claros) if claros else None
        if an is None:
            a_escena(p, "sin glifos de color de diseño estables")
        elif an["estab"] < 0.45 or an["contraste"] < 60:
            a_escena(p, "glifos inestables" if an["estab"] < 0.45 else "poco contraste")
        else:
            cartas.append({"p": p, "an": an, "subtitulo": False})
    for c in cartas:
        p, an = c["p"], c["an"]
        if c["subtitulo"]:                     # emoji al lado del subtítulo; en avisos grandes agarraría fondo
            _extender(p, an, muestras)
        t = c["texto"] = p["texto"]
        c["revelado"] = (sum(1 for x in p["textos"] if len(_norm(x)) < len(_norm(t)) - 1) >= 2 and
                         len({_norm(x) for x in p["textos"]}) > 1)
        c["resalte"] = an["resalte"]
        c["colores"] = ([an["relleno"]] + ([an["resalte"]] if an["resalte"] is not None else []) + an["extra"] +
                        ([an["trazo"]] if an["trazo"] is not None and _vivo(an["trazo"]) else []))
    return cartas, escena


def _dil(c, w):
    return int(max(round(DIL_SUB * w / 1080), c["an"]["halo"] + 1))


def _salida(video, info, cartas, escena, t):
    w, h, fps, n = info["w"], info["h"], info["fps"], info["n"]
    subs = sorted((c for c in cartas if c["subtitulo"]), key=lambda c: c["s"])
    for a, b in zip(subs, subs[1:]):          # tarjetas del mismo renglón no se solapan
        if a["e"] >= b["s"]:
            a["e"] = b["s"] - 1

    def base(c, k):
        b = c["an"]["bbox"]
        an = c["an"]
        return {
            "id": k, "text": c["texto"], "n_words": len(an["palabras"]), "n_chars": len(c["texto"]),
            "start_frame": c["s"], "end_frame": c["e"], "start": round(c["s"] / fps, 3),
            "end": round((c["e"] + 1) / fps, 3), "duration": round((c["e"] - c["s"] + 1) / fps, 3),
            "fill_bbox_px_x0y0x1y1": b, "fill_center_x_px": (b[0] + b[2]) / 2,
            "cleanup_bbox_norm": [round(b[0] / w, 4), round(b[1] / h, 4), round((b[2] - b[0]) / w, 4), round((b[3] - b[1]) / h, 4)],
            "colors": {"fill_hex": _hex(an["relleno"]),
                       "highlight_hex": _hex(c["resalte"]) if c["resalte"] is not None else None,
                       "extra_fill_hex": [_hex(x) for x in an["extra"]],
                       "stroke_hex": _hex(an["trazo"]) if an["trazo"] is not None else None},
            "stroke_width_px": round(an["ancho_trazo"], 1),
            "text_height_px": b[3] - b[1], "font_size_px_est": round((b[3] - b[1]) * 1.05),
            "center_norm": [round((b[0] + b[2]) / 2 / w, 4), round((b[1] + b[3]) / 2 / h, 4)],
            "ocr_score": round(float(np.median(c["p"]["scores"])), 3),
            "animation": "letras que aparecen de a una" if c["revelado"] else "corte seco",
            "mask_colors_hex": [_hex(x) for x in c["colores"]],
            "mask_dilate_px": _dil(c, w), "mask_min_frac": 0.25 if c["revelado"] else 0.6,
            "detector": {"estabilidad": round(an["estab"], 2), "movimiento": round(c["p"]["mov"], 3),
                         "angulo": round(c["p"]["angulo"], 1), "contraste": round(an["contraste"]), "halo_px": an["halo"]},
        }

    chunks = []
    for k, c in enumerate(subs, 1):
        d = base(c, k)
        x0r = c["p"]["region"][0]
        pal = c["texto"].split()
        seq = []
        for j, (a, b) in enumerate(c["an"]["palabras"]):
            on = [i for i in range(c["s"], c["e"] + 1) if c["res"].get(i, [0] * (j + 1))[j] >= 0.35]
            s = e = None
            if on:                              # tramo más largo
                runs, r0 = [], on[0]
                for u, v in zip(on, on[1:] + [None]):
                    if v != u + 1:
                        runs.append((r0, u))
                        r0 = v
                s, e = max(runs, key=lambda r: r[1] - r[0])
            seq.append({"word": pal[j] if len(pal) == len(c["an"]["palabras"]) else None,
                        "highlight_start_frame": s, "highlight_end_frame": e,
                        "start": round(s / fps, 3) if s is not None else None,
                        "end": round((e + 1) / fps, 3) if e is not None else None,
                        "fill_x_px": [a + x0r, b + x0r], "highlight_color": d["colors"]["highlight_hex"]})
        d["highlight_sequence"] = seq
        chunks.append(d)

    # avisos: las líneas que aparecen juntas y están pegadas se unen en un solo aviso
    otros = sorted((c for c in cartas if not c["subtitulo"]), key=lambda c: (c["s"], c["an"]["bbox"][1]))
    grupos = []
    for c in otros:
        for g in grupos:
            u = g[-1]
            bu, bc = u["an"]["bbox"], c["an"]["bbox"]
            if (abs(c["s"] - u["s"]) <= 0.3 * fps and abs(c["e"] - u["e"]) <= 0.3 * fps and
                    0 <= bc[1] - bu[3] <= u["p"]["alto"] and min(bu[2], bc[2]) > max(bu[0], bc[0])):
                g.append(c)
                break
        else:
            grupos.append([c])
    overlays = []
    for k, g in enumerate(grupos, 1):
        lineas = [base(c, j) for j, c in enumerate(g, 1)]
        d = dict(lineas[0])
        bb = [min(l["fill_bbox_px_x0y0x1y1"][0] for l in lineas), min(l["fill_bbox_px_x0y0x1y1"][1] for l in lineas),
              max(l["fill_bbox_px_x0y0x1y1"][2] for l in lineas), max(l["fill_bbox_px_x0y0x1y1"][3] for l in lineas)]
        s, e = min(l["start_frame"] for l in lineas), max(l["end_frame"] for l in lineas)
        d.update({"id": f"aviso_{k}", "type": "overlay_text (precio / CTA / aviso)",
                  "text": "\n".join(l["text"] for l in lineas), "lines": len(lineas),
                  "start_frame": s, "end_frame": e, "start": round(s / fps, 3), "end": round((e + 1) / fps, 3),
                  "duration": round((e - s + 1) / fps, 3), "fill_bbox_px_x0y0x1y1": bb,
                  "bbox_norm": [round(bb[0] / w, 4), round(bb[1] / h, 4), round((bb[2] - bb[0]) / w, 4), round((bb[3] - bb[1]) / h, 4)],
                  "mask_colors_hex": sorted({x for l in lineas for x in l["mask_colors_hex"]}),
                  "mask_dilate_px": max(l["mask_dilate_px"] for l in lineas),
                  "mask_min_frac": min(l["mask_min_frac"] for l in lineas)})
        if len(lineas) > 1:
            d["line_details"] = lineas
        d.pop("highlight_sequence", None)
        overlays.append(d)
        for c in g:
            if c.get("destello"):
                s0, e0, bb = c["destello"]
                pad = round(0.15 * c["p"]["alto"])
                bb = [max(0, bb[0] - pad), max(0, bb[1] - pad), min(w, bb[2] + pad), min(h, bb[3] + pad)]
                overlays.append({"id": f"aviso_{k}_destello", "type": "brillo/destello del aviso (sin texto)",
                                 "of": d["id"], "start_frame": s0, "end_frame": e0, "start": round(s0 / fps, 3),
                                 "end": round((e0 + 1) / fps, 3), "fill_bbox_px_x0y0x1y1": bb, "mask_rect": True,
                                 "mask_dilate_px": round(DIL_SUB * w / 1080)})

    # estilo común de los subtítulos (para volver a dibujarlos igual)
    estilo = {}
    if chunks:
        def med(v):
            v = [x for x in v if x is not None]
            return float(np.median(v)) if v else None

        def moda(v):
            v = [x for x in v if x]
            return Counter(v).most_common(1)[0][0] if v else None
        txt = " ".join(c["text"] for c in chunks)
        letras = [ch for ch in txt if ch.isalpha()]
        mayus = sum(ch.isupper() for ch in letras) / max(1, len(letras))
        cx = [c["center_norm"][0] for c in chunks]
        ub = [min(c["fill_bbox_px_x0y0x1y1"][0] for c in chunks), min(c["fill_bbox_px_x0y0x1y1"][1] for c in chunks),
              max(c["fill_bbox_px_x0y0x1y1"][2] for c in chunks), max(c["fill_bbox_px_x0y0x1y1"][3] for c in chunks)]
        fs = med([c["font_size_px_est"] for c in chunks])
        con_res = [c for c in chunks if any(s["highlight_start_frame"] is not None for s in c["highlight_sequence"])]
        estilo = {
            "type": ("karaoke palabra por palabra: la palabra activa cambia al color de resalte" if con_res else
                     "tarjetas de subtítulo de un color"),
            "case": "UPPERCASE" if mayus > 0.9 else "lowercase" if mayus < 0.1 else "mixed",
            "max_words_per_chunk": max(c["n_words"] for c in chunks),
            "min_words_per_chunk": min(c["n_words"] for c in chunks),
            "max_chars_per_chunk": max(c["n_chars"] for c in chunks), "lines_per_chunk": 1,
            "colors": {"normal_text_hex": moda([c["colors"]["fill_hex"] for c in chunks]),
                       "highlight_hex": moda([c["colors"]["highlight_hex"] for c in chunks]),
                       "stroke_hex": moda([c["colors"]["stroke_hex"] for c in chunks])},
            "size": {"text_height_px": med([c["text_height_px"] for c in chunks]), "font_size_px_est": fs,
                     "font_size_pct_of_frame_height_est": round(100 * fs / h, 2)},
            "stroke": {"width_px": med([c["stroke_width_px"] for c in chunks]),
                       "mask_dilate_px": int(med([c["mask_dilate_px"] for c in chunks]))},
            "position": {"alignment": "center" if np.median(np.abs(np.array(cx) - 0.5)) < 0.03 else "left/right",
                         "anchor_center_x_norm": round(med(cx), 4),
                         "center_y_norm": round(med([c["center_norm"][1] for c in chunks]), 4),
                         "union_bbox_px_x0y0x1y1": ub},
            "animation": {"chunk_in": "corte seco", "chunk_out": "corte seco",
                          "word_highlight": "cambio instantáneo de color en la palabra activa" if con_res else "ninguno"},
        }
        # la mediana del halo de todas las tarjetas es más fiable que el de cada una (tarjetas pegadas)
        for c in chunks:
            c["mask_dilate_px"] = max(estilo["stroke"]["mask_dilate_px"], round(DIL_SUB * w / 1080))
    libres, ult = [], 0
    for c in chunks:
        if c["start_frame"] > ult:
            libres.append([round(ult / fps, 3), round(c["start_frame"] / fps, 3)])
        ult = max(ult, c["end_frame"] + 1)
    if ult < n:
        libres.append([round(ult / fps, 3), round(n / fps, 3)])
    return {
        "video": Path(video).name, "width": w, "height": h, "fps": round(fps, 3), "duration": round(n / fps, 3),
        "n_frames": n,
        "method": (f"automático (clonador.detectar_texto): RapidOCR a {FPS_OCR} fps y {LADO_OCR} px, pistas, "
                   f"colores y máscaras por tarjeta, bordes a {round(fps)} fps; {t:.0f} s"),
        "captions": {"style": estilo, "chunks": chunks, "full_text_ocr": " ".join(c["text"] for c in chunks),
                     "caption_free_intervals_s": libres},
        "overlays": overlays,
        "scene_text_kept": escena,
    }


def detectar(video: Path, salida: Path) -> Path:
    """Corre en el entorno de la GPU (CLONADOR_PY_GPU) si existe: el OCR va en la GPU, varias veces más rápido.
    Si no existe (computadora sin NVIDIA), corre aquí mismo en CPU, más lento."""
    video, salida = Path(video).resolve(), Path(salida).resolve()
    if PY_GPU.exists() and Path(sys.executable).resolve() != PY_GPU.resolve():
        subprocess.run([str(PY_GPU), "-m", "clonador.detectar_texto", str(video), str(salida)], cwd=RAIZ, check=True)
        return salida
    try:
        import rapidocr_onnxruntime  # noqa: F401
    except ImportError as e:
        raise RuntimeError("Falta rapidocr-onnxruntime: sigue INSTALAR.md") from e
    t0 = time.time()
    info = _probar(video)
    muestras = _ocr(video, info)
    t_ocr = time.time() - t0
    pistas = _pistas(muestras)
    _recortes(video, info, pistas, muestras)
    cartas, escena = _cartas(pistas, muestras, info)
    _refinar(video, info, cartas, muestras)
    ta = _salida(video, info, cartas, escena, time.time() - t0)
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps(ta, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
    print(f"detectar_texto: {len(ta['captions']['chunks'])} subtítulos, {len(ta['overlays'])} avisos, "
          f"{len(escena)} textos de escena conservados; {time.time() - t0:.0f} s (OCR {t_ocr:.0f} s, "
          f"{len(muestras)} muestras)", file=sys.stderr)
    return salida


if __name__ == "__main__":
    print(detectar(Path(sys.argv[1]), Path(sys.argv[2])))
