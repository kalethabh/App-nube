"""Borra el texto quemado (subtítulos y avisos) de un video para usarlo como referencia.

Respaldo sin GPU de borrar_texto.py (el método por defecto, STTN): máscaras rectangulares (una por
tarjeta de subtítulo mientras está en pantalla y una banda por línea del aviso) + inpainting OpenCV
Telea, a 720x1280 (el máximo que Seedance 2.5 acepta como referencia en Kie). Tarda segundos pero deja
manchas visibles.
"""
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import numpy as np

W, H = 720, 1280


def _rect(m, x0, y0, x1, y1, esc, pad):
    m[max(0, int(y0 * esc) - pad):int(y1 * esc) + pad, max(0, int(x0 * esc) - pad):int(x1 * esc) + pad] = 255


def mascaras_rectangulares(ta: dict, n_frames: int) -> list[np.ndarray]:
    """Un rectángulo por tarjeta de subtítulo (solo mientras está en pantalla) y una banda por
    línea del aviso. Las máscaras de glifo dejaban el contorno negro como "fantasma" de las letras."""
    esc = W / ta["width"]
    base = np.zeros((H, W), np.uint8)
    for o in (o for o in ta.get("overlays", []) if "line_fill_rows_px" in o):
        x0, _, x1, _ = o["bbox_px_x0y0x1y1_incl_outline"]
        for y0, y1 in o.get("line_fill_rows_px", []):
            _rect(base, x0, y0, x1, y1, esc, 5)
    mascaras = [base.copy() for _ in range(n_frames)]
    from clonador.borrar_texto import _tarjetas
    for c in _tarjetas(ta):
        x0, y0, x1, y1 = c["fill_bbox_px_x0y0x1y1"]
        for i in range(max(0, c["start_frame"] - 2), min(n_frames, c["end_frame"] + 3)):
            _rect(mascaras[i], x0, y0, x1, y1, esc, 9)
    return mascaras


def limpiar(video: Path, text_analysis: Path, salida: Path) -> Path:
    ta = json.loads(text_analysis.read_text(encoding="utf-8"))

    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(cv2.resize(f, (W, H), interpolation=cv2.INTER_LANCZOS4))
    cap.release()

    mascaras = mascaras_rectangulares(ta, len(frames))
    tmp = salida.with_suffix(".sinaudio.mp4")
    out = cv2.VideoWriter(str(tmp), cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, H))
    with ThreadPoolExecutor() as pool:  # cv2.inpaint libera el GIL
        for f in pool.map(lambda fm: cv2.inpaint(fm[0], fm[1], 5, cv2.INPAINT_TELEA) if fm[1].any() else fm[0],
                          zip(frames, mascaras)):
            out.write(f)
    out.release()

    # H.264 yuv420p con el audio original (Kie exige mp4/mov, 24-60 fps, <=927.408 px).
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-i", str(video),
                    "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-crf", "16", "-preset", "slow", "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", str(salida)], check=True)
    tmp.unlink()
    return salida


if __name__ == "__main__":
    limpiar(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
