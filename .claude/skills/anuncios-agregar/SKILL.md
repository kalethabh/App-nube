---
name: anuncios-agregar
description: Estilo «Agregar». El usuario sube un video (suyo, de la competencia o uno que le gusta), escribe lo que quiere con sus palabras ("este mismo pero estilo Pixar narrado y musical, de 1:30, manteniendo el guion") y se rehace para su producto: en el estilo que pide (uno de los de la app) o, si no pide ninguno, con la MISMA estructura y el MISMO look: cómo está armado toma por toma, cómo se ven las personas (edad, cuerpo, ropa, lugar, cámara, realismo), el ritmo, los textos, el gancho y el ángulo de venta, con el antes y después bien visible en la zona del cuerpo que vende. Decide si se produce como escenas habladas (una o varias personas hablan en cámara, cada una con su voz: nunca se pasa a voz en off) o con voz en off (solo si en el original nadie habla en cámara) y elige el mejor modelo de video para CADA escena (las que hablan, el B-roll, el antes y después). Usar cuando el usuario elige «Agregar» en la app, o pide "rehazme este video para mi producto", "hazlo igual a este video", "que se vea como este video".
---

# Agregar — un anuncio rehecho a partir del video del usuario

El video que sube el usuario **manda**. No se mete en el look de otro estilo (Pixar, crochet,
plastilina): se rehace **como se ve el original**, con su gente, sus lugares, su cámara y su ritmo,
pero para el producto del usuario y con personas nuevas. Interactúa siempre en español sencillo.

Esta skill se apoya en tres que ya existen y no se copian aquí:

- `.claude/skills/anuncios-clonacion/SKILL.md` — el análisis del video (Pasos 1 y 2), el ADN toma
  por toma (Paso 3) y el guion clonado (Paso 5). Lo que nunca se copia del original también vale aquí.
- `.claude/skills/anuncios-ugc/SKILL.md` — si en el video **hablan personas en cámara** (una o varias).
- `.claude/skills/anuncios-realista-narrado/SKILL.md` (que sigue `anuncios-estilo-pixar`) — solo si en el
  video **nadie habla en cámara**: una voz que cuenta sobre escenas (antes y después, B-roll, producto).

Las reglas de `CLAUDE.md` siguen igual: **nada que cobre se genera sin mostrar antes el costo y
esperar un sí** (en la app, la tarjeta del costo antes de «Me gusta, producir»).

## Paso 1 — El video, el pedido y el plan

El usuario escribe lo que quiere en `pedido` (con sus palabras). **El pedido manda** sobre lo demás del
formulario y sobre lo que harías tú. De ahí y del video sale el plan, en `app/plan.json` (la tarea da
el formato), que el usuario ve junto con el guion y el costo antes de gastar nada:

- **El estilo.** Si el pedido no nombra ninguno: `"agregar"`, el mismo look del video (Pasos 2 a 7).
  Si nombra uno, su clave, y ese estilo produce el anuncio con **su skill de siempre** (no se
  reimplementa nada aquí):

  | Lo que dice el pedido | `estilo` |
  |---|---|
  | "Pixar", "animado 3D con narrador" | `estilo-pixar` |
  | "Pixar narrado y musical", "cantado", "como canción" | `musical` (corto: con `visual` "Zack D Films" para el 3D tipo Pixar) o `historias-musicales` si es una historia larga cantada en 3D |
  | "plastilina", "tejido", "Lego", "esqueleto", "Zack D", "explicador 3D" | `claymation`, `crochet`, `estilo-lego`, `skeleton`, `zack-d-films` |
  | "real con narrador", "testimonio de transformación" | `realista-narrado` |
  | "una persona a cámara", "UGC", "podcast", "entrevista en la calle", "que hable el producto" | `ugc`, `podcast`, `entrevista`, `talking-object-pixar` |

  En `respuestas` van las preguntas de ese estilo que el pedido ya contesta (en el musical, `visual`
  es obligatorio). Lo que no dice, lo decide después la skill de ese estilo.
- **La duración.** La que pide ("1:30", "1 minuto") o null = la del video. **Acortar es condensar**:
  se conservan la estructura, el gancho, el ángulo, las objeciones y las frases clave, cada momento
  más corto; **nunca se corta el final** (la prueba, la oferta y el llamado a la acción van siempre).
  El `guion-clonado.md` ya va condensado a esa duración.
- **El idioma** y cualquier otra cosa que diga (lo que se mantiene, lo que cambia).
- `conserva` y `cambia` lo dicen en español sencillo; `resumen`, en una o dos frases.

Con otro estilo, esta skill termina en el plan (con `adn.md` y `guion-clonado.md` escritos): la app
pasa el anuncio a ese estilo y otra sesión escribe su guion o su letra con el guion clonado como guion
ganador. Con `"agregar"`, sigue con los Pasos 2 a 7.

**El video** ya está en la app: el video quedó en `temp/<slug>/referencia/original.<ext>` y analizado.
Por chat: cópialo ahí y corre el análisis de la skill de clonación (su Paso 2, gratis en kie.ai;
la transcripción de ElevenLabs cuesta centavos):

```
node .claude/skills/anuncios-clonacion/scripts/analizar-referencia.mjs temp/<slug>/referencia/original.mp4 temp/<slug>/referencia
```

## Paso 2 — Mirarlo entero (entenderlo de verdad)

Mira con Read `referencia/hoja-tomas.jpg`, **cada fotograma** de `referencia/tomas/` y **cada tira**
de `referencia/tomas/movimiento/` (comienzo, mitad y final de la toma, lado a lado: ahí se ven el
movimiento de la cámara, los gestos, cómo se mueve el cuerpo y si cambia la luz), y lee
`adn-base.json` (tomas, tiempos, lo que se dice, las palabras por segundo y lo medido de la imagen:
`imagen.luz`, `brillo`, `color`, `saturacion`, `temperatura`, `se_mueve`) y `transcripcion.json`.
Lo medido no reemplaza mirar: úsalo para nombrar la luz y el movimiento con palabras justas. Corrige los
cortes que el análisis haya hecho mal (dos tomas casi iguales que quedaron en una, un movimiento
brusco que partió una toma en dos). No sigas hasta poder contar qué pasa en cada segundo y **por qué
vende**.

## Paso 3 — El ADN visual (`referencia/adn.md`)

Todo lo de la skill de clonación (lo general y la tabla toma por toma) y, además, lo que hace que se
vea igual. **La esencia del video está en los detalles**: si se pierden, el anuncio sale "parecido" y
deja de funcionar. Escríbelo concreto, como se lo dirías a un camarógrafo, a un maquillador y a un
colorista; nunca "una mujer en un gimnasio" sino lo que hace que sea ESA imagen:

1. **Las personas**, una por una: edad aparente, sexo, origen y tono de piel, **tipo de cuerpo**
   (contextura, cómo es la zona que vende: piernas, glúteos, abdomen, brazos, cara, piel, pelo),
   pelo, maquillaje, **ropa exacta** (prenda, color, ajuste: "leggings grises ajustados de tiro alto
   y top deportivo negro"), postura, actitud y cómo mira a la cámara. Si alguien se repite, que se
   note que es la misma persona. **El avatar al detalle**: forma de la cara, cejas, ojos, labios,
   **textura de la piel** (poros, pecas, brillo, marcas, sin retoque o muy retocada), textura y largo
   del pelo (liso, ondulado, mojado, recogido, con frizz), uñas, joyas, tatuajes, lentes, accesorios.
   Si es animado (3D, plastilina, tejido), lo mismo con su material.
2. **El lugar y la luz**: dónde está (gimnasio, habitación, baño con espejo, calle), qué hay
   alrededor, de dónde viene la luz y a qué hora parece. **La iluminación al detalle**: la luz
   principal (ventana, aro de luz, sol, lámpara del techo, la pantalla del celular), de qué lado y a
   qué altura, dura o suave (sombras con borde o difusas), su color (cálida, fría, mixta: ventana fría
   y lámpara cálida), luces que se ven en cuadro, contraluz o brillo en el pelo, reflejos en la piel o
   en el espejo, y si es pareja o cambia de una toma a otra (usa `imagen.luz`, `brillo`, `temperatura`).
   **Las texturas**: telas (algodón, licra brillante, jean), superficies (azulejo, madera, cama
   deshecha), el producto (vidrio, gotero, etiqueta mate o brillante).
2b. **El color y el acabado**: paleta dominante, saturación (`imagen.color`), contraste, si tiene
   filtro o gradación (cálido de Instagram, lavado, alto contraste), grano o ruido de celular, nitidez,
   fondo desenfocado o todo en foco, formato y bordes.
3. **La cámara y el realismo**: selfie con la cámara frontal, celular apoyado, alguien que la
   filma, reflejo en el espejo o cámara de cine; plano (cuerpo entero, medio, detalle) y movimiento;
   si se ve casero (celular, sin retoque) o producido. **Ese mismo nivel de realismo es el del anuncio.**
4. **El ritmo**: cuánto dura cada toma en promedio, cómo corta (corte seco, zoom, giro, pasar la
   mano por la cámara), si acelera hacia el final.
4b. **Los movimientos y los gestos** (míralos en las tiras): de la **cámara** (quieta, en mano con
   temblor, se acerca, gira, sigue a la persona, el celular se da vuelta) y de la **persona** (camina,
   se gira frente al espejo, se agacha, se toca la zona del cuerpo, señala, muestra el producto a la
   cámara, lo abre, se sirve las gotas), y los **gestos y expresiones**: sonrisa, sorpresa, cejas,
   asentir, mirar de reojo, guiñar, morderse el labio, poner los ojos en blanco, la energía del cuerpo.
   Cada uno en su toma y en su momento (comienzo, mitad o final de la toma).
4c. **El tono**: cómo suena y se siente. La **voz** (quién habla, edad, energía, emoción —cómplice,
   indignada, eufórica, susurrando—, velocidad con `palabras_por_segundo`, pausas, acento y forma de
   hablar, muletillas), la **música** (género, tempo, si sube en el resultado) y los **sonidos**
   (`eventos`: risas, golpes, ASMR). Y el tono del anuncio: confesión, humor, urgencia, lujo, casero.
5. **Textos en pantalla y subtítulos**: qué dicen, dónde van, cómo se ven.
6. **El gancho**: qué se ve y qué se dice en los primeros 1 a 3 segundos, y su mecánica (una
   pregunta, un resultado de golpe, un antes y después, algo raro).
7. **El ángulo de venta**: el deseo o el dolor que ataca, **la zona del cuerpo** o el resultado que
   promete (por ejemplo: "levantar y redondear glúteos y tonificar piernas") y cómo lo prueba.
8. **El antes y después**, si lo hay: cómo se muestra (lado a lado, corte de uno al otro, giro,
   pantalla partida), en qué zona y cuánto cambia.

**La tabla toma por toma** (además de las columnas de la skill de clonación) lleva, para cada toma:
**luz** (fuente, lado, dura/suave, color) · **cámara** (plano y movimiento) · **persona** (qué hace,
gestos y expresión, en orden) · **texturas y acabado** · **tono de la voz**. Esa fila es la esencia
de la toma: después pasa a sus prompts (Paso 6).

Si el producto del usuario es para otra cosa que el del video, el ángulo sale de **su** producto
(su ficha y su investigación), con la misma mecánica del original. Si `ajustes_del_estilo.angulo`
trae lo que tiene que notarse, eso manda.

## Paso 4 — El formato de producción

**La regla de oro: si en el video original las personas hablan con la boca en cámara, en el tuyo también.**
Nunca conviertas en voz en off a alguien que habla en el original, ni metas escenas o B-roll que el
original no tiene. Es el mismo video, tal cual, para el producto del usuario.

| Lo que pasa en el video | Formato (`formato` del plan) | Cómo se escribe el manifiesto |
|---|---|---|
| **una o varias personas hablan en cámara** (testimonio, reseña, rutina, entrevista, un programa o show con presentadora y participantes, un reality, una conversación, un sketch) | **Escenas habladas** (`"ugc"`) | `anuncios-ugc`: bloques `R`, `"modo_audio": "dialogo_nativo"`; cada persona dice SUS líneas con su propia voz dentro del clip. Con varias personas, sigue «Escenas habladas, tal cual» (abajo) |
| **nadie** habla con la boca en cámara: una voz cuenta sobre escenas (antes y después, producto, textos con música) | **Voz en off** (`"voz-en-off"`) | `anuncios-realista-narrado` (proceso de Pixar): tomas A/B, B-roll y `"modo_audio": "voz_en_off"`; la voz la pone ElevenLabs |

- **Si el formulario trae `formato`**, ese manda. Con "que decida la IA", decides tú con la tabla.
- **Mezclado** (alguien habla en cámara y además hay cortes a detalles o planos sin diálogo): es
  **Escenas habladas**. Los planos sin diálogo del original van como tramos sin línea (o un bloque sin
  línea) con su misma acción; **no** se convierten en narración ni se agregan planos que no existen.
- **El antes y después** se hace como lo hace el original: si ahí lo cuentan las personas hablando,
  se queda así (no lo pases a voz en off).
- Cuenta el formato elegido y por qué en "decisiones".

### Escenas habladas, tal cual (varias personas en cámara)

Para un video como un programa de citas, una entrevista o un reality (presentadora, participantes,
público), el anuncio nuevo es **el mismo video con el producto del usuario**:

- **Las mismas personas (nuevas, del mismo tipo)**: una referencia `personaje` por cada persona que
  vuelve (la presentadora, la protagonista, cada participante), con su edad, cuerpo, piel, pelo, ropa y
  accesorios del original (nunca la cara de alguien real). Distínguelas por un rasgo o por la ropa.
- **Las mismas tomas, en el mismo orden**: un bloque por toma del original (o varias tomas seguidas en
  un bloque de hasta 15 s, como tramos). Mismo plano y cámara (cerrado, medio, abierto, quién está en
  cuadro), mismo set, misma luz, mismos subtítulos.
- **Cada línea la dice quien la dice en el original**: lo de la presentadora lo dice la presentadora
  (con su micrófono), lo de la protagonista lo dice ella, lo de cada participante, él. Un solo hablante
  por tramo, nombrado por su rasgo o su ropa («la presentadora de traje rojo»). La línea se adapta al
  producto solo donde el original habla del problema o de la solución; la estructura y la función de
  cada frase quedan iguales.
- **Quién habla, en el manifiesto**: cada tramo con línea lleva `"habla": "<id del personaje>"` (el
  validador lo pide cuando el bloque tiene más de una persona). Un tramo sin línea (alguien mira, se ríe,
  explota un globo) va con `"linea": null`.
- **La voz de cada persona, igual en todo el anuncio**: en LANGUAGE / VOICE describe la voz de cada
  persona (género, edad aproximada, acento, energía) y copia esa descripción palabra por palabra en
  todos los bloques donde habla.
- **Las mismas acciones**: si explotan los globos, los explotan; si alguien se ríe, se tapa la cara o
  camina, igual. Van en la acción de cada tramo, en orden.
- **Las referencias de cada bloque**: solo las personas que salen en ese plano (+ el producto si se
  ve), **máximo 7 imágenes**. En los planos abiertos donde salen muchas personas a la vez, usa la imagen
  de su escena (`prompt_imagen_inicial`, Sección «imagen de cada escena»): una foto del set con todas
  ellas descritas, en su lugar y con su ropa, y nombra esa imagen en el prompt de video.
- **Nada inventado**: sin voz en off, sin narrador, sin B-roll ni escenas que el original no tenga.
  El producto aparece donde el original muestra o nombra la solución (o como el original muestra su
  producto).
- **La duración**: si el usuario pide otra, se condensa como dice el Paso 1 (cada momento más corto,
  las mismas escenas en el mismo orden); sin duración pedida, la del original.

## Paso 5 — El guion

El Paso 5 de la skill de clonación: **mismo número de tomas y misma duración por toma (±15 %)**, la
misma función en cada frase, el mismo camino del ángulo y el ritmo del original (palabras por
segundo). Guárdalo en `referencia/guion-clonado.md`, con el original al lado. Si el usuario trajo su
propio guion, ese va palabra por palabra y el video solo guía lo visual. La duración es la del plan (sin
duración pedida, la del video original).

## Paso 6 — El manifiesto, con el look del video

Escribe el manifiesto con la skill del formato elegido (UGC o realista con narrador), con **todas
sus reglas técnicas y sus chequeos**, cambiando solo esto:

- `"estilo": "agregar"` (siempre, en los dos formatos).
- **El ADN visual es el de la referencia** (Paso 3), no el de esa skill. En voz en off, lo de
  realista con narrador sobre el look (celular, anatomía médica 3D para el mecanismo, quién narra)
  vale **solo si el video lo tiene**: si el original no muestra un mecanismo en 3D, no se inventa.
  Quién narra y cómo suena la voz salen del video.
- **Las personas**: cada hoja de personaje describe lo del Paso 3 al detalle (edad, cuerpo, piel,
  pelo, ropa, lugar, cámara). Es **una persona nueva del mismo tipo**: nunca la cara de alguien real
  del video. Las tomas repiten la ropa y el lugar del original.
- **La esencia en cada prompt.** El prompt de imagen y el de video de **cada** toma (y de cada
  bloque de UGC y cada B-roll) llevan la fila de su toma en la tabla del ADN, escrita en inglés para el
  generador: el avatar con su textura de piel, pelo, ropa y accesorios; la luz (fuente, lado, dureza,
  color, reflejos); el color y el acabado (filtro, grano, nitidez, profundidad de campo); el
  movimiento de la cámara; y lo que hace la persona con sus gestos y expresiones **en orden** ("she
  glances at the mirror, raises an eyebrow, then smiles at the camera and taps the bottle"). Nada de
  "same as reference": el generador no ve el video, solo lee el prompt. En los prompts de **voz**
  (UGC con diálogo, o la indicación de la voz en off) va el tono: energía, emoción, velocidad y forma
  de hablar.
- **Lo que se repite, igual en todas**: la descripción del avatar, de su ropa y de la luz del lugar se
  copia **palabra por palabra** en cada toma donde aparece (si cambia una palabra, el generador hace
  otra persona u otra luz). Si en el original cambian (otra ropa, de día a noche), cambian igual.
- **En UGC** los dos ganchos alternativos son opcionales (`ganchos_alternativos` puede no ir) y
  `notas-paquete.md` lleva el ADN resumido. **En voz en off**, el B-roll sale de los cortes a detalles
  del original, en su mismo lugar del guion.

### El antes y después (cuando el ángulo es un cambio del cuerpo)

- **Misma persona, misma pose, misma ropa, mismo encuadre, misma cámara, misma luz y mismo lugar.**
  Solo cambia el resultado, en la zona del ángulo. Así el ojo va directo a lo que cambió.
- **El cambio se tiene que notar a primera vista, en un celular, sin explicarlo**: escríbelo
  concreto y fuerte en el prompt del después (por ejemplo, para glúteos y piernas: "visibly lifted,
  rounder and firmer glutes, toned and defined thighs, smoother skin on the back of the legs"; y en
  el antes, lo contrario igual de concreto). Un cambio tímido no vende y no es lo que pidió el usuario.
- En voz en off: `protagonista_antes` y `protagonista_despues` como en realista con narrador (el
  después con `"referencias": ["protagonista_antes"]`, así sale la misma cara). El paso de uno al otro
  puede ir como **toma B** (imagen inicial = antes, final = después) o como dos tomas seguidas, como
  lo haga el original.
- Respeta el ángulo del video y del usuario **tal cual**: no lo suavices, no cambies la zona del
  cuerpo ni bajes el cambio a algo "más seguro". Lo único que no va es prometer lo que el producto no
  hace (cifras o plazos inventados): eso vale para todos los estilos.
- **Si un generador rechaza una toma** por sus políticas, la app pasa sola al siguiente modelo de la
  cascada. **Nunca** escribas prompts con trucos para que un filtro no lo note (palabras disfrazadas,
  faltas de ortografía a propósito, otro idioma para esconder algo): eso no se hace.

### El modelo de cada escena (`modelo_video`)

En **cada toma y cada B-roll** escribe `"modelo_video"` (uno de la tabla) y `"modelo_porque"` (una
frase corta). Ese modelo va primero; si falla o no puede hacer ese clip, la app sigue sola con la
cascada de siempre (Ajustes › Modelos). Usa solo estos (costo aproximado de un clip de 10 s):

| `modelo_video` | Modelo | Para qué | ≈ 10 s |
|---|---|---|---|
| `omni` | Omni Flash 1.2 (1080p) | **alguien habla con la boca** (labios sincronizados), el gancho, las tomas con persona que más venden; acepta imagen inicial y final hasta 10 s, y los bloques de UGC | US$ 0,50 |
| `grok15` | Grok Imagine 1.5 (720p) | **B-roll** barato: el producto, detalles, ambiente, manos, lugares; tomas cortas donde 720p no se nota | US$ 0,23 |
| `pixverse` | PixVerse V6 (720p, mudo) | **el paso del antes al después** en una toma B (necesita imagen inicial Y final) | US$ 0,36 |
| `kling` | Kling 3.0 (1080p) | el cuerpo en movimiento cuando el realismo del movimiento es la prueba (caminar, girar frente al espejo, una sentadilla); no habla. Es el más caro: 1 o 2 tomas como mucho | US$ 1,51 |
| `grok` | Grok Imagine (720p) | solo bloques de UGC sencillos, si conviene ahorrar; habla, con menos calidad que Omni | US$ 0,23 |

- **Gratis**: un plano que se entiende quieto (el producto sobre la mesa, el antes y el después
  como fotos fijas lado a lado) va con `"quieto"` y no lleva `modelo_video` (ver la sección «Ahorro»).
- Alguien que habla dentro del clip (bloques R, o tomas con diálogo) **solo** con `omni` o `grok`.
- En UGC no hay B-roll aparte: el modelo se elige por bloque (`omni` casi siempre).
- El costo total lo muestra la app antes de cobrar, con cuántas escenas van con cada modelo. No
  digas precios en el guion.

## Paso 7 — Chequeo y entrega

- `node produccion/validar-manifiesto.js temp/<slug>/manifiesto.json` hasta que no quede ningún
  ERROR (un AVISO de `modelo_video` dice que ese clip saldrá del siguiente modelo: corrígelo si no era
  la idea).
- Las transiciones (`transiciones.json`) como en el formato elegido.
- `app/guion.json` como dice la tarea de la app, con `"modelos"`: qué modelo hace qué escenas y por
  qué, en palabras sencillas.
- En "decisiones": el formato (UGC o voz en off) y por qué, el ángulo y la zona del cuerpo, quién es
  la persona en una frase, y cómo va el antes y después.
- **Chequeo de la esencia**, toma por toma, contra su fotograma y su tira: ¿el prompt nombra la luz
  (fuente, lado, dureza, color), la textura de la piel y de la ropa, el acabado, el movimiento de la
  cámara y los gestos en orden? ¿El avatar, la ropa y la luz están escritos igual en todas las tomas
  donde se repiten? ¿El tono de la voz está en su indicación? Lo que falte, agrégalo antes de entregar.

Por chat, cierra como la skill del formato elegido (resumen corto y las opciones A, B y C), con una
línea más: **"Rehecho de: [video] · [N] tomas · [duración] s · formato [UGC/voz en off]"**.
