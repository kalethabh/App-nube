"""Lo que va a cobrar una etapa de produccion.py, sin generar ni gastar nada.

Recibe los mismos argumentos que produccion.py:
  python costo_etapa.py <carpeta> refs|frames|video [ids...]
  python costo_etapa.py <carpeta> rehacer frames|video|refs <ids...>
  python costo_etapa.py <carpeta> pendientes
Imprime qué se generaría y cierra con "Costo: N creditos = US$X" (lo lee la app de escritorio
para la tarjeta de costo). Lo que ya está en el manifest no se cuenta: produccion.py lo salta.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from comun import Proyecto  # noqa: E402
import modelos  # noqa: E402

USD = 0.005


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        sys.exit(__doc__)
    P, cmd, resto = Proyecto(args[0]), args[1], args[2:]
    m = P.man()
    mi = P.p.get("modelos", {}).get("imagen", "gpt-image-2")
    mv = P.p.get("modelos", {}).get("video", "omni-flash")
    c_img = modelos.COSTO_IMAGEN.get(mi, 10)
    forzar = False
    if cmd == "rehacer":
        if len(resto) < 2:
            sys.exit("Uso: rehacer frames|video|refs <ids...>")
        cmd, resto, forzar = resto[0], resto[1:], True
    piezas = []  # (clave, créditos)
    if cmd == "refs":
        claves = [f"char_{c}" for c in P.p["personajes"]] + [f"loc_{l}" for l in P.p["locaciones"]]
        for k in claves:
            if resto and k not in resto:
                continue
            # sin referencias, seedream se genera con gpt-image-2
            costo = 10 if mi.startswith("seedream") else c_img
            if forzar or k not in m:
                piezas.append((k, costo))
    elif cmd == "frames":
        for sid in P.ids(resto):
            t = P.tomas[sid]
            if t.get("tarjeta"):
                continue
            if forzar or f"frame_{sid}" not in m:
                piezas.append((f"frame_{sid}", c_img))
    elif cmd == "video":
        for sid in P.ids(resto):
            t = P.tomas[sid]
            if t.get("imagen_fija") or t.get("tarjeta"):
                continue
            if f"frame_{sid}" not in m:
                print(f"[{sid}] falta el fotograma: no se genera (no cobra)")
                continue
            if forzar or f"clip_{sid}" not in m:
                piezas.append((f"clip_{sid}", modelos.costo_clip(mv, t.get("dur", 6))))
    elif cmd == "pendientes":
        print("Retoma tareas ya creadas (ya cobradas): no cobra de nuevo.")
    else:
        print(f"'{cmd}' no cobra.")
    if P.p.get("modelos", {}).get("proveedor", "kie") != "kie":
        print("Este proyecto se produce fuera de Kie: no cobra en Kie.")
        piezas = []
    for k, c in piezas:
        print(f"  {k}: {c:g} creditos")
    total = round(sum(c for _, c in piezas))
    print(f"Piezas: {len(piezas)}")
    print(f"Costo: {total} creditos = US${total * USD:.2f}")


if __name__ == "__main__":
    main()
