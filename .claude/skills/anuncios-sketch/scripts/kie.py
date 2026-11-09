"""Cliente mínimo de la API de Kie (https://docs.kie.ai). Nunca imprime la clave.

La clave se busca en este orden: variable de entorno KIE_API_KEY, y luego un archivo .env
(línea KIE_API_KEY=...) en la carpeta actual o en cualquiera de sus carpetas padre.

Uso suelto:
  python kie.py credito
  python kie.py subir <archivo>                    -> URL pública (Kie la borra a las 24 h)
  python kie.py crear <payload.json>               -> taskId
  python kie.py esperar <taskId> <carpeta_salida>  -> descarga los resultados
"""
import base64, json, mimetypes, os, sys, time, urllib.error, urllib.request, uuid
from pathlib import Path

# la app (modo prueba) puede apuntar a su kie simulado; si no, el de verdad
BASE = (os.environ.get("KIE_BASE_URL") or "https://api.kie.ai").rstrip("/")


class TareaFallida(RuntimeError):
    """Kie terminó la tarea con estado 'fail' (no se cobra)."""
UPLOAD_BASE = (os.environ.get("KIE_BASE_ARCHIVOS_URL") or "https://kieai.redpandaai.co").rstrip("/")  # las subidas de archivos viven en otro host


def api_key():
    if os.environ.get("KIE_API_KEY"):
        return os.environ["KIE_API_KEY"].strip()
    inicios = [Path(os.environ["KIE_PROYECTO"])] if os.environ.get("KIE_PROYECTO") else []  # carpeta del proyecto
    inicios.append(Path.cwd())
    for d in inicios:
        d = d.resolve()
        for p in [d, *d.parents]:
            f = p / ".env"
            if f.exists():
                for line in f.read_text(encoding="utf-8").splitlines():
                    if line.strip().startswith("KIE_API_KEY="):
                        key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if key:
                            return key
    sys.exit("Falta KIE_API_KEY: el usuario debe pegarla en un archivo .env de la carpeta del proyecto "
             "(o de una carpeta padre) como KIE_API_KEY=...  Nunca la pidas por el chat.")


def call(method, path, body=None, base=BASE, intentos=4, reintentar_red=True):
    """reintentar_red=False en createTask: si la red se corta después de enviar, Kie pudo crear (y cobrar) la tarea,
    y reintentar crearía otra. Los errores 4xx nunca se reintentan."""
    for i in range(intentos):
        req = urllib.request.Request(
            base + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": f"Bearer {api_key()}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                res = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if (e.code == 429 or (e.code >= 500 and reintentar_red)) and i < intentos - 1:  # 429: la tarea no se creó
                time.sleep(5 * (i + 1))
                continue
            try:
                cuerpo = e.read().decode(errors="replace")[:300]
            except Exception:
                cuerpo = ""
            raise RuntimeError(f"Kie {path} -> HTTP {e.code} {cuerpo}") from None
        except (urllib.error.URLError, TimeoutError):
            if not reintentar_red or i == intentos - 1:
                raise
            time.sleep(3 * (i + 1))
            continue
        code = res.get("code")
        if code == 429 and i < intentos - 1:  # límite de 20 tareas cada 10 s (la tarea NO se creó)
            time.sleep(5 * (i + 1))
            continue
        if code != 200:
            raise RuntimeError(f"Kie {path} -> code={code} msg={res.get('msg')}")
        return res["data"]


def credito():
    return call("GET", "/api/v1/chat/credit")


def subir(path):
    p = Path(path)
    mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    b64 = base64.b64encode(p.read_bytes()).decode()
    data = call("POST", "/api/file-base64-upload", {
        "base64Data": f"data:{mime};base64,{b64}",
        "uploadPath": "anuncios-sketch",
        "fileName": f"{p.stem}-{uuid.uuid4().hex[:8]}{p.suffix}",
    }, base=UPLOAD_BASE)
    return data["downloadUrl"]


def crear(payload):
    return call("POST", "/api/v1/jobs/createTask", payload, reintentar_red=False)["taskId"]


def estado(task_id):
    return call("GET", f"/api/v1/jobs/recordInfo?taskId={task_id}")


def esperar(task_id, out_dir, timeout=2400):
    """Espera la tarea y descarga los resultados. Devuelve {files, urls, credits, seconds}.
    Lanza RuntimeError con el motivo si la tarea falla (las fallidas no se cobran)."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    delay, t0 = 3, time.time()
    while time.time() - t0 < timeout:
        d = estado(task_id)
        if d["state"] == "success":
            urls = json.loads(d["resultJson"]).get("resultUrls", [])
            files = []
            for i, u in enumerate(urls):
                ext = Path(u.split("?")[0]).suffix or ".bin"
                f = out / f"{task_id}_{i}{ext}"
                urllib.request.urlretrieve(u, f)
                files.append(str(f))
            return {"files": files, "urls": urls, "credits": d.get("creditsConsumed"), "seconds": d.get("costTime")}
        if d["state"] == "fail":
            raise TareaFallida(f"Tarea {task_id} falló: {d.get('failCode')} {d.get('failMsg')}")
        time.sleep(delay)
        delay = min(delay * 1.5, 20)
    raise TimeoutError(task_id)


if __name__ == "__main__":
    cmd, *args = sys.argv[1:] or ["credito"]
    if cmd == "credito":
        print("Créditos disponibles:", credito())
    elif cmd == "subir":
        print(subir(args[0]))
    elif cmd == "crear":
        print(crear(json.loads(Path(args[0]).read_text(encoding="utf-8"))))
    elif cmd == "esperar":
        print(json.dumps(esperar(args[0], args[1]), ensure_ascii=False))
