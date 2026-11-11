"""
Convierte una imagen de anuncio cuadrada 1:1 en vertical 9:16.

METODO:
no se genera un anuncio nuevo ni se rellenan franjas vacias. Se le pide al modelo que
RECREE el mismo diseno, con los mismos textos, colores, persona y producto, cambiando
UNICAMENTE la dimension y re-maquetando los bloques para que la pieza se vea disenada
para vertical.

Dos claves para que no derive:
  1. Se enumeran los textos exactos uno por uno (salen del V##.json).
  2. Se adjuntan DOS imagenes: el cuadrado ya generado y la foto real del producto.

Uso:
    python extender_vertical.py cuadrado.png [--ad V01.json] [--producto producto.png] [--salida out.png]

Variables (en el entorno o en el .env de la raiz del proyecto):
    KIE_API_KEY        clave de kie.ai (obligatoria)
    KIE_MODELO         por defecto gpt-image-2-5-sunburst-image-to-image
    KIE_RESOLUCION     1K | 2K | 4K (por defecto 2K)
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from kie_cliente import (  # noqa: E402
    cargar_api_key,
    crear_tarea,
    descargar,
    esperar_tarea,
    subir_imagen,
    texto_exacto,
)

# Zona segura: Instagram y TikTok tapan arriba y abajo con su interfaz.
ZONA_SEGURA = (
    "Keep the top 15% and the bottom 15% of the vertical canvas free of important text "
    "and free of the product label, because Instagram, Facebook and TikTok cover those "
    "areas with their own interface. All headlines, texts and the product label must stay "
    "inside the central safe zone and remain perfectly legible."
)

CAMBIO_DIMENSION = (
    "The ONLY change is the dimension: convert it to a vertical 9:16 portrait layout for "
    "Instagram Stories, Reels and TikTok. Re-arrange the same elements so they fit "
    "naturally and look premium in the tall format: let the headline breathe at the top, "
    "give the person and the product more vertical room in the center, and spread the "
    "remaining blocks down the canvas instead of cramming them. Do not simply add empty "
    "bands, borders, blurred strips or solid color bars above and below the original "
    "square. Do not crop or cut off any element. Keep generous negative space and a clear "
    "visual hierarchy."
)

# El modelo tiende a poner fondo blanco cuando recrea un lienzo de color plano.
FIDELIDAD_COLOR = (
    "CRITICAL - colors must not change: the background keeps exactly the same color as in "
    "the first attached image, and every text, graphic element and highlight keeps exactly "
    "the color it already has there. Never turn a colored background into white or into a "
    "lighter tone. Never swap, invert or reassign colors between the background, the texts "
    "and the graphic elements. If the original background is a flat solid color, the "
    "vertical version must use that same flat solid color edge to edge."
)

CIERRE = (
    "Do not add, remove or rewrite any text, price, badge, seal, icon or visual block. "
    "Do not change the design, the palette, the typography, the person or the product."
)


def _resumen_identidad(ad: dict) -> str:
    """Arma la descripcion de 'que debe quedar igual' a partir del V##.json."""
    partes = []
    gi = ad.get("global_identity") or {}
    if gi.get("color_palette"):
        partes.append(f"the same colors ({gi['color_palette']})")
    if gi.get("text_typography"):
        partes.append(f"the same typography ({gi['text_typography']})")
    if gi.get("visual_style"):
        partes.append(f"the same visual style ({gi['visual_style']})")

    elementos = ad.get("mandatory_visual_elements") or []
    if elementos:
        partes.append("the same visual blocks: " + "; ".join(elementos))

    return ", ".join(partes)


def construir_prompt(ad: dict | None, con_producto: bool) -> str:
    """Prompt de recreacion cuadrado -> vertical."""
    p1 = (
        "Recreate this exact advertisement (the FIRST attached image) without changing "
        "anything in its design. Keep absolutely everything the same: the same texts word "
        "for word with exactly the same spelling and accents, the same typography, the "
        "same colors, the same photographic style and lighting, the same person (same "
        "face, hair, clothes, pose and expression), the same background and the same "
        "product"
    )
    if ad:
        resumen = _resumen_identidad(ad)
        if resumen:
            p1 += ". Specifically preserve: " + resumen
    p1 += "."

    bloques = [p1, FIDELIDAD_COLOR, CAMBIO_DIMENSION, ZONA_SEGURA]

    if con_producto:
        bloques.append(
            "The SECOND attached image is the real product: keep the product and its label "
            "identical to it, with the same shape, cap, label text, colors and proportions. "
            "Do not redesign or reinterpret it."
        )

    capas = (ad or {}).get("text_layers") or []
    if capas:
        lineas = [
            "Exact visible texts (each appears exactly once, correctly spelled, "
            "nothing else added):"
        ]
        for t in capas:
            funcion = t.get("reference_function", "text")
            lineas.append(f'- {funcion}: {texto_exacto(t["text"])}')
        bloques.append("\n".join(lineas))
    elif ad is not None:
        bloques.append("The image must contain NO text at all.")

    if (ad or {}).get("language_rule"):
        bloques.append(ad["language_rule"])
    bloques.append(CIERRE)
    return "\n\n".join(bloques)


def extender(
    cuadrado: Path,
    ad: dict | None = None,
    producto: Path | None = None,
    salida: Path | None = None,
    api_key: str | None = None,
) -> Path:
    api_key = api_key or cargar_api_key()
    salida = salida or cuadrado.with_name(f"{cuadrado.stem}_9x16{cuadrado.suffix}")

    imagenes = [subir_imagen(cuadrado, api_key)]
    if producto and producto.exists():
        imagenes.append(subir_imagen(producto, api_key))
    print(f"[subida] {len(imagenes)} imagen(es) de entrada")

    prompt = construir_prompt(ad, con_producto=len(imagenes) > 1)
    task_id = crear_tarea(prompt, imagenes, api_key, proporcion="9:16")
    print(f"[tarea 9:16] {task_id}")

    urls, creditos = esperar_tarea(task_id, api_key)
    descargar(urls[0], salida)
    print(f"[ok] vertical -> {salida}  ({creditos} creditos)")
    return salida


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)

    cuadrado = Path(args[0])
    if not cuadrado.exists():
        sys.exit(f"No existe el archivo: {cuadrado}")

    def opcion(nombre):
        return Path(args[args.index(nombre) + 1]) if nombre in args else None

    ruta_ad = opcion("--ad")
    ad = json.loads(ruta_ad.read_text(encoding="utf-8")) if ruta_ad else None
    extender(cuadrado, ad, opcion("--producto"), opcion("--salida"))


if __name__ == "__main__":
    main()
