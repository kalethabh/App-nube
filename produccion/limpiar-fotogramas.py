"""Fotogramas de referencia sin subtitulos (2026-11-07).

Los fotogramas de los subestilos salen de anuncios reales y traen los
subtitulos quemados (y a veces texto estampado o etiquetas ajenas). Para
adjuntarlos al generador de imagenes como guia de encuadre, pose y luz, antes
se les borra el texto: se detectan las letras (blancas o amarillas con borde
negro, o negras sobre una caja blanca o amarilla) y se rellenan con lo que las
rodea (inpaint de OpenCV).

Se corre una sola vez, al agregar un subestilo (no durante la produccion):

    python3 produccion/limpiar-fotogramas.py                 todos los subestilos
    python3 produccion/limpiar-fotogramas.py <carpeta-subestilo> ...

Por cada subestilos/<id>/ref-NN.jpg deja subestilos/<id>/limpio/ref-NN.jpg
(y lo mismo con es-NN.jpg y gancho-*.jpg). Necesita opencv-python y numpy.
"""
import glob
import os
import sys

import cv2
import numpy as np

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def mascara_texto(img):
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    blanco = (V > 200) & (S < 45)
    amarillo = (H >= 18) & (H <= 38) & (S > 110) & (V > 190)
    naranja = (H >= 5) & (H < 18) & (S > 140) & (V > 210)  # letra naranja o durazno con borde
    claro = (blanco | amarillo | naranja).astype(np.uint8)
    negro = (V < 60).astype(np.uint8)
    k3 = np.ones((3, 3), np.uint8)
    # letra clara con borde negro, o letra negra sobre fondo claro
    textish = (claro & cv2.dilate(negro, k3, iterations=2)) | (negro & cv2.dilate(claro, k3, iterations=2))
    unido = cv2.morphologyEx(textish * 255, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (31, 9)))
    n, etiquetas, stats, _ = cv2.connectedComponentsWithStats(unido, 8)
    mask = np.zeros((h, w), np.uint8)
    cajas = []
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if bw < w * 0.05 or bh < h * 0.012 or bh > h * 0.11:
            continue
        densidad = textish[y:y + bh, x:x + bw].mean()
        # el texto es ancho y bajo; una palabra sola ("#3", "OH") es mas cuadrada
        # y se le pide mas densidad de letra con borde
        if bw / max(bh, 1) < 2.2 and (bw / max(bh, 1) < 1.1 or densidad < 0.22):
            continue
        if densidad < 0.10:
            continue
        cajas.append((x, y, bw, bh))
    for x, y, bw, bh in cajas:
        p = max(4, bh // 4)
        x0, y0, x1, y1 = max(0, x - p), max(0, y - p), min(w, x + bw + p), min(h, y + bh + p)
        trozo_claro = claro[y0:y1, x0:x1]
        if trozo_claro.mean() > 0.45:
            # caja de subtitulo (blanca o amarilla): se borra la caja entera
            # se agranda el rectangulo mientras su borde siga siendo la caja
            fondo = claro | negro
            for _ in range(80):
                crecio = False
                if y0 > 0 and fondo[y0 - 1, x0:x1].mean() > 0.6: y0 -= 1; crecio = True
                if y1 < h and fondo[y1 - 1 + 1 if y1 < h else h - 1, x0:x1].mean() > 0.6: y1 += 1; crecio = True
                if x0 > 0 and fondo[y0:y1, x0 - 1].mean() > 0.6: x0 -= 1; crecio = True
                if x1 < w and fondo[y0:y1, min(x1, w - 1)].mean() > 0.6: x1 += 1; crecio = True
                if not crecio:
                    break
            mask[max(0, y0 - 3):min(h, y1 + 3), max(0, x0 - 3):min(w, x1 + 3)] = 255
        else:
            m = cv2.dilate(textish[y0:y1, x0:x1] * 255, k3, iterations=3)
            mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], m)
    # Letra blanca pura sin borde (subtitulos finos): trazos blancos con huecos,
    # en una franja baja y ancha. Un objeto blanco macizo (hueso, camisa) no
    # pasa: su relleno es casi total.
    puro = ((V > 238) & (S < 30)).astype(np.uint8)
    pu = cv2.morphologyEx(puro * 255, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (17, 5)))
    n, _, stats, _ = cv2.connectedComponentsWithStats(pu, 8)
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if not (bw >= w * 0.06 and h * 0.012 <= bh <= h * 0.06 and bw / max(bh, 1) >= 2.5):
            continue
        dens = puro[y:y + bh, x:x + bw].mean()
        if 0.15 <= dens <= 0.6:
            trozo = cv2.dilate(puro[y:y + bh, x:x + bw] * 255, k3, iterations=3)
            mask[y:y + bh, x:x + bw] = np.maximum(mask[y:y + bh, x:x + bw], trozo)
            cajas.append((x, y, bw, bh))
    # El borde suave de las cajas amarillas: si queda fuera de la mascara, el
    # relleno lo arrastra hacia adentro y la caja reaparece. Se come el amarillo
    # pegado a lo ya marcado.
    am8 = amarillo.astype(np.uint8) * 255
    for _ in range(6):
        mask = np.maximum(mask, cv2.dilate(mask, np.ones((5, 5), np.uint8)) & am8)
    return mask, cajas


def limpiar(ruta, destino):
    img = cv2.imread(ruta)
    mask, cajas = mascara_texto(img)
    if mask.any():
        img = cv2.inpaint(img, cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2), 9, cv2.INPAINT_TELEA)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    cv2.imwrite(destino, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return len(cajas)


def carpetas(args):
    if args:
        return [os.path.abspath(a) for a in args]
    return sorted(d for d in glob.glob(os.path.join(RAIZ, '.claude', 'skills', '*', 'subestilos', '*')) if os.path.isdir(d))


if __name__ == '__main__':
    total = 0
    for d in carpetas(sys.argv[1:]):
        fotos = sorted(glob.glob(os.path.join(d, 'ref-*.jpg')) + glob.glob(os.path.join(d, 'gancho-*.jpg')))
        for sub in ('es',):
            fotos += sorted(glob.glob(os.path.join(d, sub, 'es-*.jpg')))
        for f in fotos:
            rel = os.path.relpath(f, d)
            destino = os.path.join(d, 'limpio', os.path.basename(f)) if os.sep not in rel else os.path.join(d, os.path.dirname(rel), 'limpio', os.path.basename(f))
            limpiar(f, destino)
            total += 1
        print(f'  {os.path.relpath(d, RAIZ)}: {len(fotos)} fotogramas')
    print(f'\n  Listo: {total} fotogramas sin texto (carpetas limpio/).')
