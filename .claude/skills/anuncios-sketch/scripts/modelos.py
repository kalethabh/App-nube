"""Adaptadores de modelos de Kie: traducen (prompt, referencias, aspecto, resolución, duración) al payload de cada modelo.
Para cambiar de modelo basta poner su alias en proyecto.json -> "modelos": {"imagen": ..., "video": ...}.
Parámetros verificados en docs.kie.ai el 2026-10-31 (ver references/modelos.md). Si Kie cambia un campo, se corrige aquí."""
import math
import sys

IMAGEN = ["gpt-image-2", "nano-banana-2", "nano-banana-2-1", "nano-banana-pro", "seedream-4.5", "seedream-5-lite"]
VIDEO = ["omni-flash", "seedance-2", "seedance-2-fast", "kling-3", "kling-3-pro", "veo-3.1-fast", "veo-3.1-lite", "veo-3.1"]


def _aviso(msg):
    print(f"  aviso: {msg}", file=sys.stderr, flush=True)


def _cerca(valor, permitidos):
    """El valor permitido más cercano por arriba (o el máximo)."""
    for p in sorted(permitidos):
        if p >= valor:
            return p
    return max(permitidos)


class PromptLargo(ValueError):
    pass


def _recortar(prompt, maximo, alias):
    """No se recorta a ciegas: el final del prompt trae el bloque de quién habla y "no music, no subtitles"."""
    if len(prompt) > maximo:
        raise PromptLargo(f"{alias}: el prompt tiene {len(prompt)} caracteres y el máximo es {maximo}. "
                          "Acorta 'encuadre', 'accion' o las descripciones de esa toma.")
    return prompt


# ---------- imagen ----------
def imagen(alias, prompt, refs, aspecto, res):
    refs = list(refs)
    if alias.startswith("seedream") and not refs:
        # Seedream solo edita (necesita al menos una referencia): las hojas de personaje/locación se hacen con GPT Image 2
        _aviso(f"{alias} necesita referencias; esta imagen (sin referencias) se genera con gpt-image-2")
        alias = "gpt-image-2"
    if alias == "gpt-image-2":  # 10 créditos a 2K; hasta 16 referencias
        if refs:
            return {"model": "gpt-image-2-image-to-image",
                    "input": {"prompt": prompt, "input_urls": refs[:16], "aspect_ratio": aspecto, "resolution": res}}
        return {"model": "gpt-image-2-text-to-image", "input": {"prompt": prompt, "aspect_ratio": aspecto, "resolution": res}}
    if alias in ("nano-banana-2", "nano-banana-2-1", "nano-banana-pro"):  # 2: 12 cr a 2K · 2.1: 6 cr · Pro: 18 cr
        maxref = 8 if alias == "nano-banana-pro" else 10
        if len(refs) > maxref:
            _aviso(f"{alias} acepta {maxref} referencias; se usan las primeras")
        return {"model": alias, "input": {"prompt": prompt, "image_input": refs[:maxref], "aspect_ratio": aspecto,
                                          "resolution": res, "output_format": "png"}}
    if alias == "seedream-4.5":  # 6,5 cr; quality basic = 2K, high = 4K
        return {"model": "seedream/4.5-edit", "input": {"prompt": _recortar(prompt, 3000, alias), "image_urls": refs[:14],
                                                        "aspect_ratio": aspecto, "quality": "basic"}}
    if alias == "seedream-5-lite":  # 5,5 cr
        return {"model": "seedream/5-lite-image-to-image", "input": {"prompt": _recortar(prompt, 2995, alias),
                "image_urls": refs[:14], "aspect_ratio": aspecto, "quality": "basic", "output_format": "png"}}
    raise SystemExit(f"Modelo de imagen desconocido: {alias}. Opciones: {', '.join(IMAGEN)}")


# ---------- video (imagen a video con diálogo) ----------
def video(alias, prompt, frame_url, dur, aspecto, res):
    if alias == "omni-flash":  # Omni Flash 1.2 (desde 2026-11-13): de 3 a 15 s, por segundo (720p 9 cr/s · 1080p 10)
        if dur > 15:
            _aviso(f"omni-flash: máximo 15 s (pediste {dur}); divide la toma en dos")
        return {"model": "google/gemini-omni-flash-1-2", "input": {
            "prompt": prompt, "first_frame_url": frame_url, "aspect_ratio": aspecto, "resolution": res,
            "duration": _segundos_omni(dur)}}
    if alias in ("seedance-2", "seedance-2-fast"):  # 720p: 41 cr/s (2) · 24,8 cr/s (fast); audio nativo
        if alias == "seedance-2-fast" and res not in ("480p", "720p"):
            _aviso("seedance-2-fast solo hace 480p/720p; se usa 720p")
            res = "720p"
        if dur > 15:
            _aviso(f"{alias}: máximo 15 s (pediste {dur}); divide la toma en dos")
        return {"model": f"bytedance/{alias}", "input": {
            "prompt": prompt, "first_frame_url": frame_url, "generate_audio": True, "resolution": res,
            "aspect_ratio": aspecto, "duration": int(min(max(round(dur), 4), 15))}}
    if alias in ("kling-3", "kling-3-pro"):  # std con audio 20 cr/s · pro 27 cr/s
        if dur > 15:
            _aviso(f"{alias}: máximo 15 s (pediste {dur}); divide la toma en dos")
        return {"model": "kling-3.0/video", "input": {
            "prompt": _recortar(prompt, 2500, alias), "image_urls": [frame_url], "sound": True,
            "duration": str(int(min(max(round(dur), 3), 15))), "aspect_ratio": aspecto,
            "mode": "pro" if alias == "kling-3-pro" else "std", "multi_shots": False}}
    if alias in ("veo-3.1-fast", "veo-3.1-lite", "veo-3.1"):  # fast 720p ≈ 60 cr por clip
        sub = {"veo-3.1-fast": "veo3_fast", "veo-3.1-lite": "veo3_lite", "veo-3.1": "veo3"}[alias]
        if dur > 8:
            _aviso(f"{alias}: máximo 8 s (pediste {dur})")
        return {"model": "veo-3-1", "input": {
            "model": sub, "prompt": prompt, "image_urls": [frame_url], "generation_type": "FIRST_AND_LAST_FRAMES_2_VIDEO",
            "aspect_ratio": aspecto, "resolution": res, "duration": _cerca(dur, [4, 6, 8])}}
    raise SystemExit(f"Modelo de video desconocido: {alias}. Opciones: {', '.join(VIDEO)}")


# ---------- costo estimado (créditos de Kie; 1 crédito ≈ USD 0,005) ----------
COSTO_IMAGEN = {"gpt-image-2": 10, "nano-banana-2": 12, "nano-banana-2-1": 6, "nano-banana-pro": 18,
                "seedream-4.5": 6.5, "seedream-5-lite": 5.5}


def _segundos_omni(dur):
    """Omni Flash 1.2 pide un entero de 3 a 15: el largo de la toma, redondeado hacia arriba."""
    return int(min(max(math.ceil(dur - 1e-9), 3), 15))


def costo_clip(alias, dur):
    if alias == "omni-flash":  # 720p, la del sketch: 9 cr/s
        return 9 * _segundos_omni(dur)
    if alias.startswith("seedance"):
        return (41 if alias == "seedance-2" else 24.8) * int(min(max(round(dur), 4), 15))
    if alias.startswith("kling"):
        return (27 if alias == "kling-3-pro" else 20) * int(min(max(round(dur), 3), 15))
    if alias.startswith("veo"):
        return {"veo-3.1-fast": 60, "veo-3.1-lite": 30, "veo-3.1": 250}[alias]
    return 15 * dur


def estimar(P, margen=0.15):
    """Créditos para producir el proyecto completo + un margen para repeticiones (por defecto 15 %)."""
    mi = P.p.get("modelos", {}).get("imagen", "gpt-image-2")
    mv = P.p.get("modelos", {}).get("video", "omni-flash")
    tomas = [t for t in P.p["tomas"] if not t.get("tarjeta")]
    clips = [t for t in tomas if not t.get("imagen_fija")]
    if P.p.get("modelos", {}).get("proveedor", "kie") == "flow":
        # Google Flow: las imágenes no gastan créditos (tienen tope diario); Omni Flash 720p = 7/10/12/15 por clip
        vid = sum({4: 7, 6: 10, 8: 12, 10: 15}[_cerca(t.get("dur", 6), [4, 6, 8, 10])] for t in clips)
        return {"proveedor": "Google Flow", "imagenes": "sin créditos (tope diario por modelo)",
                "video_creditos_flow": vid, "total_con_margen": round(vid * (1 + margen))}
    n_img = len(P.p["personajes"]) + len(P.p["locaciones"]) + len(tomas)
    img = COSTO_IMAGEN.get(mi, 10) * n_img
    vid = sum(costo_clip(mv, t.get("dur", 6)) for t in clips)
    total = (img + vid) * (1 + margen)
    return {"proveedor": "Kie", "imagenes": round(img), "video": round(vid), "margen": f"{int(margen * 100)} %",
            "total": round(total), "usd_aprox": round(total * 0.005, 2)}
