"""
Genera las imagenes de un lote de anuncios con Kie.ai, por fases.

Lee los V##.json (AD_CREATIVE_SCHEMA) de la carpeta del lote y genera:
  - fase cuadrado: la imagen 1:1 de cada variacion desde su prompt.
  - fase vertical: recrea cada cuadrado ya generado en 9:16 (ver proporciones.md).

Se genera por fases para poder revisar cada imagen antes de seguir y regenerar
una sola vez las que fallen (PASO 6 del SKILL.md).

Uso:
    python generar_lote.py <carpeta_lote> <foto_producto> [opciones]

Opciones:
    --fase cuadrado|vertical   que generar (por defecto: cuadrado)
    --solo V01,V08             solo esas variaciones
    --rehacer                  vuelve a generar aunque la imagen ya exista; la
                               anterior se conserva como V08_1x1.v1.png, .v2...

Sin --rehacer, las imagenes que ya existen se saltan (no se gasta credito en ellas).

Salida:
    <carpeta_lote>/imagenes/V01_1x1.png, V01_9x16.png, ...
    <carpeta_lote>/_resumen.json  (creditos y errores por variacion y fase)

Variables (en el entorno o en el .env de la raiz del proyecto):
    KIE_API_KEY        clave de kie.ai (obligatoria)
    KIE_MODELO         por defecto gpt-image-2-5-sunburst-image-to-image
    KIE_RESOLUCION     1K | 2K | 4K (por defecto 2K)
"""
from __future__ import annotations
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extender_vertical import construir_prompt as construir_prompt_vertical  # noqa: E402
from kie_cliente import (  # noqa: E402
    cargar_api_key,
    crear_tarea,
    descargar,
    estado_tarea,
    modelo,
    resolucion,
    subir_imagen,
    texto_exacto,
)

PAUSA_ENTRE_TAREAS = 0.6  # limite de Kie: 20 peticiones cada 10 s
PAUSA_SONDEO = 6
TIMEOUT_LOTE = 20 * 60
SUFIJO = {"cuadrado": "1x1", "vertical": "9x16"}
PROPORCION = {"cuadrado": "1:1", "vertical": "9:16"}


def construir_prompt(ad: dict) -> str:
    """Convierte un AD_CREATIVE_SCHEMA en el prompt de texto que recibe el modelo."""
    partes = [ad["visual_prompt"]]

    capas = ad.get("text_layers") or []
    if capas:
        lineas = ["EXACT VISIBLE TEXT (render exactly, no spelling changes):"]
        for t in capas:
            lineas.append(
                f'- {t.get("reference_function", "text")} '
                f'({t.get("reference_position", "")}): {texto_exacto(t["text"])} — {t.get("text_style", "")}'
            )
        partes.append("\n".join(lineas))
    else:
        partes.append("The image must contain NO text at all.")

    identidad = ad.get("global_identity") or {}
    lineas_id = [f"{k}: {identidad[k]}" for k in ("color_palette", "text_typography") if identidad.get(k)]
    if lineas_id:
        partes.append("BRAND IDENTITY:\n- " + "\n- ".join(lineas_id))

    if ad.get("mandatory_visual_elements"):
        partes.append("MANDATORY ELEMENTS:\n- " + "\n- ".join(ad["mandatory_visual_elements"]))

    exclusiones = list(ad.get("final_generation_exclusions") or [])
    prohibidos = (ad.get("reference_structure_analysis") or {}).get("forbidden_additions") or []
    exclusiones += [f"Do not add: {p}" for p in prohibidos if p not in exclusiones]
    if exclusiones:
        partes.append("STRICT EXCLUSIONS:\n- " + "\n- ".join(exclusiones))

    partes.append(
        "The attached image is the user's real product. Reproduce it with total fidelity: "
        "same shape, packaging, cap, label, label text, colors and proportions. "
        "Never redesign, replace or reinterpret it."
    )
    return "\n\n".join(partes)


def guardar_version(destino: Path) -> Path | None:
    """Mueve la imagen existente a V##_1x1.vN.png para no perderla al regenerar."""
    if not destino.exists():
        return None
    n = 1
    while (version := destino.with_name(f"{destino.stem}.v{n}{destino.suffix}")).exists():
        n += 1
    destino.rename(version)
    return version


def generar(fase, variaciones, url_producto, api_key, carpeta_img, rehacer):
    """Crea las tareas de una fase en paralelo y descarga cada imagen al terminar."""
    sufijo = SUFIJO[fase]
    tareas, resultados = {}, {}

    for vid, ad in variaciones:
        destino = carpeta_img / f"{vid}_{sufijo}.png"
        if destino.exists() and not rehacer:
            print(f"[salta {sufijo}] {vid}: ya existe")
            continue
        try:
            if fase == "cuadrado":
                prompt, imagenes = construir_prompt(ad), [url_producto]
            else:
                cuadrado = carpeta_img / f"{vid}_1x1.png"
                if not cuadrado.exists():
                    resultados[vid] = {"error": "falta el cuadrado: genera primero la fase cuadrado"}
                    print(f"[fallo 9:16] {vid}: {resultados[vid]['error']}")
                    continue
                prompt = construir_prompt_vertical(ad, con_producto=True)
                imagenes = [subir_imagen(cuadrado, api_key), url_producto]
            tareas[vid] = crear_tarea(prompt, imagenes, api_key, PROPORCION[fase])
        except (SystemExit, Exception) as e:  # una variacion que falla no detiene el lote
            resultados[vid] = {"error": f"no se pudo crear la tarea: {e}"}
            print(f"[fallo {sufijo}] {vid}: {resultados[vid]['error']}")
            continue
        print(f"[tarea {sufijo}] {vid} -> {tareas[vid]}")
        time.sleep(PAUSA_ENTRE_TAREAS)

    pendientes = dict(tareas)
    inicio = time.time()
    while pendientes and time.time() - inicio < TIMEOUT_LOTE:
        time.sleep(PAUSA_SONDEO)
        for vid, task_id in list(pendientes.items()):
            try:
                d = estado_tarea(task_id, api_key)
            except (SystemExit, Exception) as e:  # error de red pasajero: se reintenta en la siguiente vuelta
                print(f"[aviso] no se pudo consultar {vid} ({e}); reintento en la siguiente vuelta")
                continue
            estado = d.get("state")
            if estado == "success":
                destino = carpeta_img / f"{vid}_{sufijo}.png"
                temporal = destino.with_name(f"{destino.stem}.descarga.png")
                try:
                    descargar(json.loads(d["resultJson"])["resultUrls"][0], temporal)
                except (SystemExit, Exception) as e:  # se reintenta la descarga en la siguiente vuelta
                    print(f"[aviso] no se pudo descargar {vid} ({e}); reintento en la siguiente vuelta")
                    continue
                anterior = guardar_version(destino)
                temporal.rename(destino)
                resultados[vid] = {"archivo": str(destino), "creditos": d.get("creditsConsumed") or 0}
                if anterior:
                    resultados[vid]["version_anterior"] = str(anterior)
                print(f"[ok {sufijo}] {vid} -> {destino.name}"
                      + (f" (anterior guardada como {anterior.name})" if anterior else ""))
                pendientes.pop(vid)
            elif estado == "fail":
                resultados[vid] = {"error": f'{d.get("failCode")} {d.get("failMsg")}'}
                print(f"[fallo {sufijo}] {vid}: {resultados[vid]['error']}")
                pendientes.pop(vid)
        if pendientes:
            print(f"[lote] pendientes {sufijo}: {len(pendientes)}")

    for vid in pendientes:
        resultados[vid] = {"error": "timeout"}
    return resultados


def opcion(nombre: str):
    return sys.argv[sys.argv.index(nombre) + 1] if nombre in sys.argv else None


def main():
    valores = {opcion("--fase"), opcion("--solo")}
    args = [a for a in sys.argv[1:] if not a.startswith("--") and a not in valores]
    if len(args) < 2:
        sys.exit(__doc__)

    fase = opcion("--fase") or "cuadrado"
    if fase not in SUFIJO:
        sys.exit("--fase debe ser 'cuadrado' o 'vertical'")
    solo = set((opcion("--solo") or "").split(",")) - {""}
    rehacer = "--rehacer" in sys.argv

    carpeta, producto = Path(args[0]), Path(args[1])
    if not carpeta.is_dir():
        sys.exit(f"No existe la carpeta del lote: {carpeta}")
    if not producto.exists():
        sys.exit(f"No existe la foto del producto: {producto}")

    archivos = sorted(carpeta.glob("V*.json"))
    if solo:
        archivos = [f for f in archivos if f.stem in solo]
    if not archivos:
        sys.exit(f"No encontre archivos V##.json para generar en {carpeta}")

    variaciones = [(f.stem, json.loads(f.read_text(encoding="utf-8"))) for f in archivos]
    carpeta_img = carpeta / "imagenes"
    carpeta_img.mkdir(parents=True, exist_ok=True)

    api_key = cargar_api_key()
    print(f"[cfg] modelo={modelo()} resolucion={resolucion()} fase={fase} "
          f"variaciones={len(variaciones)} rehacer={'si' if rehacer else 'no'}")

    url_producto = subir_imagen(producto, api_key)
    resultados = generar(fase, variaciones, url_producto, api_key, carpeta_img, rehacer)

    resumen_ruta = carpeta / "_resumen.json"
    resumen = json.loads(resumen_ruta.read_text(encoding="utf-8")) if resumen_ruta.exists() else {}
    for vid, r in resultados.items():
        resumen.setdefault(vid, {})[fase] = r
    resumen_ruta.write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")

    ok = sum(1 for r in resultados.values() if "archivo" in r)
    creditos = sum(r.get("creditos", 0) for r in resultados.values())
    print(f"[listo] fase {fase}: {ok} generadas | creditos: {creditos}")
    print(f"[listo] imagenes en: {carpeta_img}")


if __name__ == "__main__":
    main()
