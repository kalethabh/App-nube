# Kads Studio como conector de Claude

Con esto le pides cosas a tu app **desde el chat de Claude** (claude.ai en el navegador o la app de Claude en el
celular), como si le hablaras a tu equipo:

- «¿Qué productos tengo?»
- «Analiza la investigación de mercado de VitalDrops (las dos partes) y dime qué ángulo usar.»
- «Investiga el mercado y la competencia de mi producto nuevo en Colombia.»
- «Hazme 2 anuncios Claymation de VitalDrops.» → después: «¿cómo va? ¿cuánto cuesta producirlo?» → «dale».
- «Hazme 5 anuncios de imagen con esta referencia: <link de la imagen>» → te dice el costo → «sí».
- «¿Cómo va todo en la oficina?»

**Nada se cobra sin tu sí:** Claude te muestra el costo y solo produce o genera si le dices que sí.

**Lo de siempre no cambia:** la app, la oficina, la coordinadora y Claude Code siguen igual. Esto es una puerta más.

---

## Lo que necesitas

La app **en un servidor** (sigue `DESPLEGAR.md`). Claude habla con tu app por internet: no puede llegar a tu Mac.

> Si instalaste el servidor antes del 20 de noviembre de 2026, actualiza la configuración una vez (paso 0).

## 0. (Solo servidores instalados antes) Dejar pasar al conector

El sitio pide usuario y contraseña; el conector entra con su propia clave secreta. En la Terminal del servidor
(`ssh root@TU-IP`), pega esto y toca Enter:

```bash
sed -i 's/^\tbasic_auth {/\t@privado {\n\t\tnot path \/mcp\/*\n\t}\n\tbasic_auth @privado {/' /etc/caddy/Caddyfile && caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy && echo LISTO
```

## 1. Prender el conector en la app

1. Abre tu app (la dirección de tu servidor) y ve a **Ajustes › Conector para Claude**.
2. Prende **Conector prendido**.
3. Toca **Copiar** para copiar la dirección. Es **secreta**: quien la tenga puede usar tu app. Si se te escapa,
   toca «Cambiar la clave» y la vieja deja de funcionar.

## 2. Agregarlo en Claude

1. En **claude.ai**: tu nombre (abajo a la izquierda) › **Configuración › Conectores** ›
   **Agregar conector personalizado**. (En planes de equipo, lo agrega quien administra la organización).
2. **Nombre:** `Kads Studio`. **URL:** la dirección que copiaste. No necesita OAuth ni nada más.
3. Toca **Agregar**.
4. En un chat nuevo, toca el botón de herramientas (o «+») y prende **Kads Studio**.
5. Pídele lo que quieras. La primera vez que use una herramienta, Claude te pide permiso: toca «Permitir».

En la app de Claude del celular aparece solo, una vez agregado en claude.ai.

---

## Lo que Claude puede hacer (las herramientas)

| Herramienta | Qué hace | ¿Cobra? |
| --- | --- | --- |
| `listar_productos` | Tus productos y si tienen ficha, foto e investigación | No |
| `leer_investigacion` | Trae la investigación entera para analizarla: **la de mercado y la de la competencia** | No |
| `investigar` | Lanza las dos partes de la investigación a la vez | No (usa tu cuenta de Claude del servidor) |
| `listar_estilos` | Los estilos de video y lo que hay que preguntar | No |
| `crear_anuncio_video` | Encarga el guion | No |
| `ver_anuncio` | El guion, **el costo** y cómo va la producción | No |
| `producir_anuncio` | Produce el video, solo con el costo que aceptaste | **Sí** |
| `crear_imagenes` | Prepara anuncios de imagen con el agente (con referencia o desde la investigación) y da el costo | No |
| `generar_imagenes` | Genera las imágenes, solo con el costo que aceptaste | **Sí** |
| `ver_imagenes` | Cómo va el lote y los enlaces de cada imagen | No |
| `estado_oficina` | Lo que está en marcha, lo que espera tu decisión y lo que se frenó | No |

## Si algo no funciona

- **Claude dice que no puede conectarse:** revisa que el conector esté prendido en Ajustes y que copiaste la
  dirección entera. Si instalaste el servidor antes del 20 de noviembre, haz el paso 0.
- **«No encuentro el producto»:** pídele primero «¿qué productos tengo?».
- **Las imágenes de referencia:** Claude no puede pasarle a tu app una imagen que subiste al chat. Dale un enlace
  público a la imagen (https://…), o súbela en la app (Anuncios de imagen) o en el chat de la coordinadora.

Detalle técnico: es un servidor MCP por HTTP (JSON-RPC, `initialize`, `tools/list`, `tools/call`) en
`/mcp/<clave>` (`app/server/lib/conector.js`). Prueba: `node app/herramientas/probar-conector.mjs`.
