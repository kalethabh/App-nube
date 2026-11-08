"""Producción de un anuncio sketch desde proyecto.json (imágenes y clips vía la API de Kie).

Uso (la carpeta del proyecto siempre es el primer argumento):
  python produccion.py <carpeta> refs                  personajes + locaciones (+ sube la foto del producto)
  python produccion.py <carpeta> frames [s01 s02 ...]  fotograma inicial de cada toma
  python produccion.py <carpeta> video  [s01 ...]      clip con diálogo de cada toma (salta el packshot con imagen_fija)
  python produccion.py <carpeta> rehacer frames|video <ids...>     archiva la versión actual y regenera
  python produccion.py <carpeta> rehacer refs char_<id>|loc_<id>   idem para una referencia
  python produccion.py <carpeta> pendientes            retoma las tareas creadas en Kie que no llegaron a descargarse
  python produccion.py <carpeta> registrar <clave> <archivo>       p. ej. frame_s03 hecho en Google Flow
  python produccion.py <carpeta> prompts refs|frames|video [ids]   imprime los prompts (revisar o usar en Flow)
  python produccion.py <carpeta> estimar               créditos estimados del proyecto completo
  python produccion.py <carpeta> costo                 créditos usados según el manifest
Opción: --simular  (arma y muestra los payloads sin gastar créditos ni tocar el manifest)

IMPORTANTE: refs/frames/video tardan minutos (los clips de 5 a 15). Córrelos en segundo plano (o con un timeout
largo) y no lances otra vez la misma etapa mientras la anterior siga viva. Si el proceso se corta, las tareas ya
creadas quedan como "pendientes" en el manifest y la próxima corrida las retoma sin volver a pagarlas.

Claves del manifest: char_<id>, loc_<id>, product, frame_<toma>, clip_<toma>; versiones viejas como <clave>_vN."""
import json, sys, threading, time, urllib.error
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import Proyecto, prompt_fotograma, prompt_ref_locacion, prompt_ref_personaje, prompt_video  # noqa: E402
import kie, modelos  # noqa: E402

RATE = threading.Semaphore(1)
SUBIDAS = defaultdict(threading.Lock)  # una subida por clave aunque varios hilos la necesiten
SIMULAR = "--simular" in sys.argv
VIGENCIA_SUBIDA = 20 * 3600       # Kie borra lo subido a las 24 h
VIGENCIA_GENERADO = 13 * 86400    # y lo generado a los 14 días


def url_vigente(P, clave):
    """URL utilizable como referencia; vuelve a subir el archivo local si la URL ya caducó."""
    with SUBIDAS[clave]:
        v = P.man()[clave]
        edad = time.time() - v.get("ts", 0)
        if v.get("url") and edad < (VIGENCIA_SUBIDA if v.get("subido") else VIGENCIA_GENERADO):
            return v["url"]
        if SIMULAR:
            return f"<se sube {Path(v['file']).name}>"
        url = kie.subir(P.archivo(clave))
        v.update(url=url, ts=time.time(), subido=True)
        P.guardar(clave, v)
        return url


def run(P, clave, payload, carpeta, forzar=False):
    """Crea la tarea, la registra como pendiente y espera el resultado. Lo ya hecho se salta;
    lo pendiente (de una corrida anterior que se cortó) se retoma sin crear otra tarea."""
    previo = P.man(pendientes=True).get(clave)
    if SIMULAR:
        if previo and not forzar:
            print(f"[{clave}] ya existe (se saltaría)", flush=True)
        else:
            print(f"[{clave}] SIMULADO\n{json.dumps(payload, ensure_ascii=False, indent=1)}\n", flush=True)
        return None
    if previo and not previo.get("pendiente"):
        return previo
    if previo and previo.get("incierto"):
        print(f"[{clave}] la creación quedó en duda (corte de red). Revisa kie.ai; si no se creó, usa 'rehacer'.", flush=True)
        return None
    if previo and previo.get("pendiente"):
        tid = previo["taskId"]
        print(f"[{clave}] retomando la tarea {tid}", flush=True)
    else:
        with RATE:  # espaciar creaciones (límite de Kie: 20 tareas cada 10 s)
            try:
                tid = kie.crear(payload)
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                # la red se cortó al crear: Kie pudo haber creado (y cobrado) la tarea igual
                P.guardar(clave, {"incierto": True, "pendiente": True, "modelo": payload.get("model"), "ts": time.time(),
                                  "error": str(e)})
                print(f"[{clave}] ERROR de red al crear ({e}). La tarea PUEDE existir y estar cobrada: revisa los logs "
                      "en kie.ai antes de relanzar. Si no existe, rehaz la toma con 'rehacer'.", flush=True)
                return None
            except Exception as e:
                print(f"[{clave}] ERROR al crear: {e}", flush=True)
                return None
            P.guardar(clave, {"taskId": tid, "pendiente": True, "modelo": payload.get("model"), "ts": time.time()})
            time.sleep(0.6)
        print(f"[{clave}] creada {tid}", flush=True)
    try:
        r = kie.esperar(tid, P.dir / carpeta, timeout=2400)
    except kie.TareaFallida as e:  # Kie dice que falló: no se cobra, se puede volver a intentar
        P.borrar(clave)
        print(f"[{clave}] FALLÓ (no se cobra): {e}", flush=True)
        return None
    except Exception as e:  # timeout o red: la tarea sigue viva en Kie; queda pendiente para retomarla
        print(f"[{clave}] sin resultado todavía ({e}). Queda pendiente: corre 'pendientes' o la misma etapa más tarde.",
              flush=True)
        return None
    val = {"taskId": tid, "url": r["urls"][0], "file": r["files"][0], "credits": r["credits"], "ts": time.time(),
           "modelo": payload.get("model")}
    P.guardar(clave, val)
    print(f"[{clave}] ok · {r['credits']} créditos · {val['file']}", flush=True)
    return val


def cfg(P):
    f = P.p.get("formato", {})
    m = P.p.get("modelos", {})
    return (m.get("imagen", "gpt-image-2"), m.get("video", "omni-flash"), f.get("aspecto", "9:16"),
            f.get("resolucion_imagen", "2K"), f.get("resolucion_video", "720p"))


def trabajos_refs(P, solo=None):
    mi, _, ar, res, _ = cfg(P)
    jobs = {f"char_{c}": modelos.imagen(mi, prompt_ref_personaje(P, c), [], "16:9", res) for c in P.p["personajes"]}
    jobs.update({f"loc_{l}": modelos.imagen(mi, prompt_ref_locacion(P, l), [], ar, res) for l in P.p["locaciones"]})
    return {k: v for k, v in jobs.items() if not solo or k in solo}


def etapa_refs(P, solo=None, forzar=False):
    prod = P.p.get("producto", {}).get("imagen")
    if prod and "product" not in P.man() and not SIMULAR:
        f = (P.dir / prod) if not Path(prod).is_absolute() else Path(prod)
        if not f.exists():
            sys.exit(f"No existe la foto del producto: {f}")
        P.guardar("product", {"url": kie.subir(f), "file": str(f), "ts": time.time(), "subido": True, "credits": 0})
        print("producto subido", flush=True)
    jobs = trabajos_refs(P, solo)
    if solo and not jobs:
        sys.exit(f"No hay referencias con esas claves: {solo}. Usa char_<id> o loc_<id>.")
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda kv: run(P, kv[0], kv[1], "refs", forzar), jobs.items()))


def refs_toma(P, t):
    m = P.man()
    claves = [f"char_{c}" for c in t.get("personajes", [])] + [f"loc_{t.get('locacion', 'principal')}"]
    if t.get("producto"):
        claves.append("product")
    faltan = [c for c in claves if c not in m]
    if faltan and not SIMULAR:
        raise SystemExit(f"[{t['id']}] faltan referencias: {faltan} (corre la etapa refs)")
    return [url_vigente(P, c) if c in m else f"<{c}>" for c in claves]


def etapa_frames(P, ids, forzar=False):
    mi, _, ar, res, _ = cfg(P)

    def job(sid):
        t = P.tomas[sid]
        if t.get("tarjeta"):
            print(f"[{sid}] tarjeta: no necesita fotograma", flush=True)
            return None
        return run(P, f"frame_{sid}", modelos.imagen(mi, prompt_fotograma(P, t), refs_toma(P, t), ar, res), "frames", forzar)
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(job, ids))


def etapa_video(P, ids, forzar=False):
    _, mv, ar, _, rv = cfg(P)

    def job(sid):
        t = P.tomas[sid]
        if t.get("imagen_fija") or t.get("tarjeta"):  # el packshot sale del fotograma fijo; la tarjeta, del montaje
            print(f"[{sid}] {'imagen fija' if t.get('imagen_fija') else 'tarjeta'}: no necesita clip", flush=True)
            return None
        if f"frame_{sid}" not in P.man():
            if not SIMULAR:
                print(f"[{sid}] falta el fotograma", flush=True)
                return None
            frame = "<frame>"
        else:
            frame = url_vigente(P, f"frame_{sid}")
        try:
            payload = modelos.video(mv, prompt_video(P, t), frame, t.get("dur", 6), ar, rv)
        except modelos.PromptLargo as e:
            print(f"[{sid}] {e}", flush=True)
            return None
        return run(P, f"clip_{sid}", payload, "clips", forzar)
    with ThreadPoolExecutor(10) as ex:
        list(ex.map(job, ids))


def pendientes(P):
    pend = {k: v for k, v in P.man(pendientes=True).items() if v.get("pendiente")}
    if not pend:
        print("No hay tareas pendientes.")
        return
    carpeta = {"char": "refs", "loc": "refs", "frame": "frames", "clip": "clips"}
    with ThreadPoolExecutor(10) as ex:
        list(ex.map(lambda k: run(P, k, {"model": pend[k].get("modelo")}, carpeta.get(k.split("_")[0], "otros")), pend))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        sys.exit(__doc__)
    P, cmd, resto = Proyecto(args[0]), args[1], args[2:]
    prov = P.p.get("modelos", {}).get("proveedor", "kie")
    if prov != "kie" and cmd in ("refs", "frames", "video", "rehacer", "pendientes") and "--kie" not in sys.argv:
        sys.exit(f"Este proyecto se produce en '{prov}', no en Kie: genera en el navegador siguiendo "
                 "references/google-flow.md, saca los prompts con 'prompts' y guarda cada archivo con 'registrar'. "
                 "(--kie para generar igual en Kie)")
    if cmd == "refs":
        etapa_refs(P)
    elif cmd == "frames":
        etapa_frames(P, P.ids(resto))
    elif cmd == "video":
        etapa_video(P, P.ids(resto))
    elif cmd == "rehacer":
        if len(resto) < 2 or resto[0] not in ("frames", "video", "refs"):
            sys.exit("Uso: rehacer frames|video <tomas...>  ·  rehacer refs char_<id>|loc_<id> ...")
        etapa, ids = resto[0], resto[1:]
        pref = {"frames": "frame_", "video": "clip_", "refs": ""}[etapa]
        if etapa == "refs":
            malas = [i for i in ids if i not in trabajos_refs(P)]
            if malas:
                sys.exit(f"Claves de referencia inválidas: {malas}. Usa char_<id> o loc_<id> "
                         "(la foto del producto se cambia con 'registrar product <archivo>').")
        else:
            P.ids(ids)  # valida que existan
        manuales = [pref + i for i in ids if P.man().get(pref + i, {}).get("origen") == "manual"]
        if manuales and "--kie" not in sys.argv:
            sys.exit(f"{manuales} se hicieron a mano (p. ej. en Google Flow). 'rehacer' genera en Kie: rehazlos donde se "
                     "hicieron y usa 'registrar', o agrega --kie para regenerarlos en Kie.")
        if not SIMULAR:
            for i in ids:
                print("archivado:", P.archivar(pref + i) or f"(no había {pref + i})")
        if etapa == "frames":
            etapa_frames(P, ids, forzar=True)
        elif etapa == "video":
            etapa_video(P, ids, forzar=True)
        else:
            etapa_refs(P, solo=ids, forzar=True)
    elif cmd == "pendientes":
        pendientes(P)
    elif cmd == "registrar":
        if len(resto) != 2:
            sys.exit("Uso: registrar <clave> <archivo>   (clave: frame_s05, clip_s05, char_caro, loc_principal, product)")
        clave, f = resto[0], Path(resto[1])
        f = (f if f.is_absolute() else P.dir / f).resolve()
        if not f.exists():
            sys.exit(f"No existe {f}")
        if SIMULAR:
            print(f"(simulado) se registraría {clave} <- {f}; el manifest no cambia")
            return
        P.archivar(clave)
        P.guardar(clave, {"file": str(f), "url": None, "ts": 0, "subido": True, "credits": 0, "origen": "manual"})
        print(f"{clave} <- {f}")
    elif cmd == "prompts":
        etapa = resto[0] if resto and resto[0] in ("refs", "frames", "video") else "frames"
        ids = [r for r in resto if r not in ("refs", "frames", "video")]
        if etapa == "refs":
            for c in P.p["personajes"]:
                if not ids or f"char_{c}" in ids:
                    print(f"===== char_{c} (16:9)\n{prompt_ref_personaje(P, c)}\n")
            for l in P.p["locaciones"]:
                if not ids or f"loc_{l}" in ids:
                    print(f"===== loc_{l}\n{prompt_ref_locacion(P, l)}\n")
        else:
            for sid in P.ids(ids):
                t = P.tomas[sid]
                if t.get("tarjeta") or (etapa == "video" and t.get("imagen_fija")):
                    continue
                print(f"===== {sid} ({etapa})\n{prompt_fotograma(P, t) if etapa == 'frames' else prompt_video(P, t)}\n")
        return
    elif cmd == "estimar":
        print(json.dumps(modelos.estimar(P), ensure_ascii=False, indent=1))
        return
    elif cmd == "costo":
        tot = {}
        for k, v in P.man(pendientes=True).items():
            tipo = k.split("_")[0]
            tot[tipo] = tot.get(tipo, 0) + (v.get("credits") or 0)
        print(json.dumps(tot, indent=1), "\nTotal:", sum(tot.values()))
        return
    else:
        sys.exit(__doc__)
    if not SIMULAR:
        m = P.man(pendientes=True)
        pend = [k for k, v in m.items() if v.get("pendiente")]
        print(f"Créditos acumulados en el proyecto: {sum((v.get('credits') or 0) for v in m.values())}"
              + (f" · PENDIENTES: {', '.join(pend)}" if pend else ""), flush=True)


if __name__ == "__main__":
    main()
