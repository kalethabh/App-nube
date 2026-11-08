---
name: anuncios-clonacion
description: Clona un anuncio a partir de un video de referencia que sube el usuario (uno de la competencia, un anuncio ganador, un video viral). Analiza el original (tomas, tiempos, plano de cada toma, función y tono de cada frase, ritmo, música y subtítulos), escribe su ADN y lo convierte en un anuncio nuevo para el producto del usuario con la misma estructura, produciéndolo con el estilo del sistema que más se parece (UGC, podcast, entrevista, objeto parlante o uno animado con narrador). Pregunta si adapta el título (el gancho) y el ángulo de venta al producto. Dos modos: clonar para otro producto, o traducir el mismo video a otro idioma. Usar SIEMPRE que el usuario suba o pegue un video y pida "clonar", "clonación", "copiar este anuncio", "hazme uno como este", "replicar este video", "este mismo pero para mi producto" o "traducir este video". No es el replicador de ganchos (ese cambia solo el inicio de un anuncio ya hecho).
---

# Clonación — un anuncio nuevo con el ADN de un video de referencia

Toma un video que ya funciona y hace uno nuevo para el producto del usuario
**con la misma estructura**: las mismas tomas en el mismo orden, con los mismos
tiempos, la misma función en cada frase y el mismo ritmo. No copia el video: copia
cómo está construido. Interactúa siempre en español con el usuario, sin importar el
idioma del anuncio.

Esta skill **no escribe los prompts de imagen ni de video ni el manifiesto**: eso lo
hace la skill del estilo que produce el anuncio, que recibe de aquí el guion por
tomas como un guion ganador (su Paso 0). Las reglas de `CLAUDE.md` siguen igual: el
costo se muestra antes de generar y se espera un sí.

## Lo que nunca se copia

- **Ni marcas, ni logos, ni nombres de producto, ni precios** del original.
- **Ni caras de personas reales.** Si en el original sale una persona, se crea una
  persona nueva con su mismo perfil (edad, estilo, encuadre, luz), con las reglas de
  `PERSONALIZACION.md` para personas reales.
- **Ni la música del original.** La música es la del estilo que lo produce.
- **Ni promesas que el producto del usuario no cumple.** Si el original dice "baja 5
  kilos en una semana", se conserva la función de la frase (una promesa concreta con
  tiempo) pero con lo que el producto de verdad hace. Si no sabes qué hace, pregúntalo.

## Paso 1 — Recibir el video

El video llega como archivo adjunto (en la app, en `mis_archivos/subidas/` o en la
carpeta del anuncio). Elige el `slug` del anuncio nuevo (minúsculas y guiones, como
siempre) y cópialo a `temp/[slug]/referencia/original.<extensión>`. Si el usuario pegó
un link en vez de subir el archivo, pídele que lo descargue y lo suba: no lo bajes tú.

## Paso 2 — Analizarlo

```
node .claude/skills/anuncios-clonacion/scripts/analizar-referencia.mjs temp/[slug]/referencia/original.mp4 temp/[slug]/referencia
```

No cobra en kie.ai: corta el video en tomas donde cambia la imagen, saca un fotograma
de cada toma (`referencia/tomas/`) y una hoja con todas (`referencia/hoja-tomas.jpg`),
y transcribe lo que se dice con el tiempo de cada palabra (ElevenLabs, centavos). Si
el idioma del video no es español, agrégale `--idioma eng` o `--idioma por`.

**Mira la hoja y cada fotograma** (léelos como imágenes) y lee `adn-base.json`. Los
cortes salen solos y pueden fallar: un corte rápido de dos tomas casi iguales puede
quedar como una sola, y un movimiento brusco de cámara puede partir una toma en dos.
Corrígelos tú mirando los fotogramas.

## Paso 3 — Escribir el ADN

Guárdalo en `temp/[slug]/referencia/adn.md`. Es lo que se conserva del original:

**Lo general**: formato (una persona a cámara · voz en off sobre escenas · dos
personas conversando · entrevista en la calle · el producto habla · una canción),
duración, ritmo (palabras por segundo, del análisis), si hay música y con qué energía,
cómo son los subtítulos (si se ven: tamaño, color, palabra por palabra o por frase),
textos en pantalla, y el **ángulo de venta** (el dolor o deseo que ataca y la promesa).

**Toma por toma**, una fila cada una:

| # | Tiempo | Plano y lo que se ve | Lo que se dice | Función | Tono |
|---|---|---|---|---|---|
| 1 | 0,0–2,1 s | primer plano, mujer frente al espejo tocándose la cara | "¿Por qué tu piel…?" | gancho: pregunta que nombra el dolor | intriga |

Las funciones son las de un anuncio de respuesta directa: gancho, problema,
agitación, causa o mecanismo, prueba, producto, beneficio, oferta, llamado a la
acción. Una toma puede tener dos.

## Paso 4 — Preguntar (una sola vez, con botones)

Muéstrale al usuario un resumen corto del ADN (formato, duración, número de tomas,
ángulo de venta en una frase) y pregúntale todo junto con `AskUserQuestion`:

1. **El modo** — "Clonar para mi producto" (un anuncio nuevo para su producto) o
   "Traducir este mismo video" (el mismo producto y el mismo mensaje, en otro idioma).
   Si en su primer mensaje ya quedó claro, no lo preguntes.
2. **El título y el ángulo** — "¿Adapto el título (el gancho) y el ángulo de venta a
   tu producto?":
   - **Sí, adáptalo a mi producto** (recomendado cuando el producto es distinto): se
     conserva la estructura y la función de cada toma, pero el gancho y el ángulo
     salen del dolor y la promesa de SU producto.
   - **No, conserva el del original**: se conserva el gancho y el ángulo casi
     palabra por palabra, cambiando solo lo que es del producto (nombre, ingrediente,
     beneficio, oferta).
   En modo traducir, esta pregunta es otra: "¿Traducción literal o adaptada al país?"
   (adaptada = mismas ideas con las expresiones de ese mercado).
3. **El estilo con que se produce** — recomienda el que corresponde al formato del
   original (tabla de abajo) y deja elegir otro. Muestra al lado de cada opción su
   costo aproximado (el de `COMO-PRODUCIR.md`, sección 5).

| Formato del original | Estilo que lo produce |
|---|---|
| una persona habla a cámara | `anuncios-ugc` |
| dos personas conversando | `anuncios-podcast` |
| alguien entrevista a otro en la calle | `anuncios-entrevista` |
| el producto o un objeto habla | `anuncios-talking-object-pixar` |
| voz en off sobre escenas | uno animado con narrador: `anuncios-estilo-pixar`, `anuncios-zack-d-films`, `anuncios-crochet`, `anuncios-claymation`, `anuncios-estilo-lego` o `anuncios-skeleton-ads` (pregunta cuál; si el original es realista, recomienda Pixar o Zack D Films) |
| una canción | `anuncios-musicales` |

Si faltan datos del producto (qué es, para quién, la oferta, la foto), pídelos en la
misma pregunta o justo después. Nada más: lo demás lo decides tú con el ADN.

## Paso 5 — El guion clonado

Escribe el guion nuevo **toma por toma**, en el mismo orden y con la misma función
que el ADN:

- **Mismo número de tomas** y **misma duración por toma** (±15%). Con el ritmo del
  original (palabras por segundo) calcula cuántas palabras caben en cada toma.
- **El gancho**: si eligió adaptarlo, escribe uno nuevo con la misma mecánica (si el
  original abre con una pregunta que nombra el dolor, el nuevo también, con el dolor
  de su producto). Si eligió conservarlo, cámbiale solo lo que es del producto.
- **El ángulo**: el mismo camino del original (dolor → causa → solución → prueba →
  oferta, o el que tenga), con lo verdadero del producto del usuario.
- Guárdalo en `temp/[slug]/referencia/guion-clonado.md`, con el original al lado de
  cada toma para comparar.

## Paso 6 — Delegar al estilo

Invoca la skill del estilo elegido en esta misma conversación. Todas aceptan un
guion ganador ya escrito (su Paso 0). Pásale:

| Qué | De dónde |
|---|---|
| El guion clonado, toma por toma, con la duración de cada una | Paso 5 |
| El plano y lo que se ve en cada toma del original | ADN, Paso 3 |
| Los fotogramas del original (`referencia/tomas/`), como guía de encuadre | Paso 2 |
| El producto, la foto, el mercado, el idioma y la oferta | el usuario |
| Las fotos de referencia de personas, si las hay | el usuario |

Y dile explícitamente:

1. **El número de tomas y sus duraciones son los del ADN**: no los reparte de nuevo
   (en UGC, agrupa las tomas en bloques de 10, 8 o 6 s respetando los cortes).
2. **Cada toma conserva su plano y su acción** del original, pero con el look del
   estilo (en un estilo animado, el mismo encuadre hecho Pixar, crochet, etc.).
3. **Los textos en pantalla y los subtítulos** van como en el original si el estilo
   los admite.

La skill del estilo escribe los prompts, el manifiesto y cierra con su resumen y sus
opciones A, B y C, como siempre. En el resumen agrega una línea: **"Clonado de:
[nombre del video] · [N] tomas · [duración] s"**.

## Paso 7 — Producción

La del estilo, sin cambios (y con lo de `PERSONALIZACION.md`: revisar las imágenes
antes de los videos, voces distintas por personaje). Al entregar, muestra el original
y el nuevo uno al lado del otro: las rutas de los dos MP4.
