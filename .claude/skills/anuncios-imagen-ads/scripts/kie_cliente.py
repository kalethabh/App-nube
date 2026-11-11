"""
Cliente minimo de la API de Kie.ai (solo libreria estandar de Python 3.10+).

Flujo: subir imagen local -> crear tarea -> consultar hasta que termine -> descargar.
Lo usan generar_lote.py y extender_vertical.py.
"""
from __future__ import annotations
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.kie.ai/api/v1"
UPLOAD_URL = "https://kieai.redpandaai.co/api/file-base64-upload"
CREATE_URL = f"{API}/jobs/createTask"
STATUS_URL = f"{API}/jobs/recordInfo"

# Modelo por defecto: GPT Image 2.5 Sunburst (maxima fidelidad al producto).
MODELO_POR_DEFECTO = "gpt-image-2-5-sunburst-image-to-image"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) imagen-ads-skill/1.0"

LIMITE_PROMPT = 20000
ESPERA_SEGUNDOS = 5
TIMEOUT_SEGUNDOS = 15 * 60


_ENV_CARGADO = False


def cargar_env() -> None:
    """Copia las variables KIE_* del .env mas cercano (hasta 4 niveles arriba) al entorno.

    Lo que ya este definido en el entorno manda sobre el .env.
    """
    global _ENV_CARGADO
    if _ENV_CARGADO:
        return
    _ENV_CARGADO = True
    base = Path.cwd()
    for carpeta in [base, *base.parents[:4]]:
        env = carpeta / ".env"
        if not env.exists():
            continue
        for linea in env.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            linea = linea.strip()
            if linea.startswith("#") or "=" not in linea:
                continue
            clave, valor = linea.split("=", 1)
            clave = clave.strip()
            if clave.startswith("KIE_"):
                os.environ.setdefault(clave, valor.strip().strip('"').strip("'"))
        return


def modelo() -> str:
    cargar_env()
    return os.environ.get("KIE_MODELO") or os.environ.get("KIE_MODEL") or MODELO_POR_DEFECTO


def resolucion() -> str:
    cargar_env()
    return os.environ.get("KIE_RESOLUCION") or os.environ.get("KIE_RESOLUTION") or "2K"


def cargar_api_key() -> str:
    """Lee KIE_API_KEY del entorno o del .env mas cercano (hasta 4 niveles arriba)."""
    cargar_env()
    key = os.environ.get("KIE_API_KEY")
    if key and key.strip() in ("pega_aqui_tu_clave", "tu_clave"):
        key = None
    if not key:
        sys.exit(
            "Falta KIE_API_KEY.\n"
            "Crea un archivo .env en la raiz del proyecto con esta linea:\n"
            "    KIE_API_KEY=tu_clave\n"
            "La clave se saca en https://kie.ai/api-key"
        )
    return key


def pedir(url: str, api_key: str, payload: dict | None = None, reintentos: int = 3) -> dict:
    datos = json.dumps(payload).encode("utf-8") if payload is not None else None
    for intento in range(1, reintentos + 1):
        req = urllib.request.Request(
            url,
            data=datos,
            method="POST" if payload is not None else "GET",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": UA,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            cuerpo = e.read().decode("utf-8", errors="replace")
            if e.code in (429, 500, 502, 503) and intento < reintentos:
                time.sleep(3 * intento)
                continue
            sys.exit(f"HTTP {e.code} en {url}: {cuerpo}")
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            if intento < reintentos:
                time.sleep(3 * intento)
                continue
            sys.exit(f"Error de conexion con {url}: {e}")
    sys.exit(f"No se pudo contactar {url}")


def subir_imagen(ruta: Path, api_key: str, carpeta: str = "imagen-ads") -> str:
    """Sube un archivo local y devuelve una URL publica temporal (Kie la borra en ~24 h)."""
    mime = mimetypes.guess_type(ruta.name)[0] or "image/png"
    b64 = base64.b64encode(ruta.read_bytes()).decode("ascii")
    res = pedir(
        UPLOAD_URL,
        api_key,
        {
            "base64Data": f"data:{mime};base64,{b64}",
            "uploadPath": carpeta,
            "fileName": f"{int(time.time())}-{ruta.name}",
        },
    )
    datos = res.get("data") or {}
    url = datos.get("downloadUrl") or datos.get("fileUrl")
    if not url:
        sys.exit(f"Fallo la subida de {ruta.name}: {res}")
    return url


def crear_tarea(prompt: str, imagenes: list[str], api_key: str, proporcion: str = "1:1") -> str:
    if len(prompt) > LIMITE_PROMPT:
        prompt = prompt[: LIMITE_PROMPT - 10]
    res = pedir(
        CREATE_URL,
        api_key,
        {
            "model": modelo(),
            "input": {
                "prompt": prompt,
                "input_urls": imagenes,
                "aspect_ratio": proporcion,
                "resolution": resolucion(),
                "background": "opaque",
            },
        },
    )
    if res.get("code") != 200:
        sys.exit(f"createTask fallo: {res}")
    return res["data"]["taskId"]


def estado_tarea(task_id: str, api_key: str) -> dict:
    return pedir(f"{STATUS_URL}?taskId={task_id}", api_key).get("data", {})


def esperar_tarea(task_id: str, api_key: str) -> tuple[list[str], float]:
    inicio = time.time()
    while time.time() - inicio < TIMEOUT_SEGUNDOS:
        d = estado_tarea(task_id, api_key)
        estado = d.get("state")
        if estado == "success":
            return json.loads(d["resultJson"])["resultUrls"], d.get("creditsConsumed") or 0
        if estado == "fail":
            sys.exit(f"La generacion fallo: {d.get('failCode')} {d.get('failMsg')}")
        time.sleep(ESPERA_SEGUNDOS)
    sys.exit(f"Tiempo de espera agotado para la tarea {task_id}")


def texto_exacto(texto: str) -> str:
    """Escribe un texto con saltos de linea sin separadores que el modelo pueda dibujar."""
    lineas = [linea for linea in texto.split("\n") if linea.strip()]
    if len(lineas) <= 1:
        return f'"{texto.strip()}"'
    return f"{len(lineas)} stacked lines: " + "; ".join(
        f'line {i}: "{linea}"' for i, linea in enumerate(lineas, 1)
    )


def descargar(url: str, destino: Path) -> Path:
    destino.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        destino.write_bytes(r.read())
    return destino
