---
name: anuncios-realista-narrado
description: Genera anuncios con IA en formato "realista con narrador" — personas fotorrealistas grabadas como con un celular en su vida real (antes y después de una transformación), contadas por la voz de alguien cercano (un hijo, la esposa, el propio protagonista), con el mecanismo en anatomía médica 3D y el producto en primer plano — para marcas DTC/Ecommerce en Estados Unidos y Latinoamérica. Usa el mismo proceso que el estilo Pixar (guion por capítulos, voz en off, manifiesto, B-roll), pero todo realista. Acepta un guion ganador ya escrito. Usar SIEMPRE que el usuario pida un anuncio "realista con narrador", "testimonio de transformación", "antes y después real", "mi papá / mi mamá antes y después", "historia real narrada", o mencione crear anuncios con IA sin especificar estilo (ofrecerlo como opción). No es UGC (ahí la persona habla a cámara todo el anuncio con su voz) ni el sketch (ahí hay diálogo actuado). Arma el guion en ES/EN/PT, los prompts y el manifiesto interno; en el chat da un resumen corto y tres opciones (producirlo todo, solo imágenes y videos, o el paquete de prompts).
---

# Generador de Anuncios IA — Realista con narrador

Convierte un producto en un anuncio de **transformación real contada por alguien cercano**: se ve a la persona antes (cansada, hinchada, adolorida) y después (activa, firme, contenta) en lugares reales de su vida, grabada como con un celular, mientras una voz en off cuenta lo que pasó. El mecanismo se muestra con anatomía médica 3D y el producto con primeros planos de calidad. **Con el manifiesto, el motor de este sistema produce el anuncio** (imágenes, clips mudos, voz de ElevenLabs, música, montaje). Nada se genera antes de que el usuario elija cómo seguir y apruebe el costo.

Interactúa siempre en español con el usuario, sin importar el idioma del anuncio.

## El proceso: el de estilo Pixar, con estos cambios

**Lee `.claude/skills/anuncios-estilo-pixar/SKILL.md` y síguelo entero**, con todas sus reglas y en este orden:

- Paso 0 (guion ganador), Paso 1 (brief), Paso 2 (guion por capítulos, duración, desglose línea por línea);
- 3.3 (Start/End Frame) y 3.4 (B-roll);
- Paso 4, Paso 5, Paso 6 (manifiesto, referencias, verificación, foto del producto) y el Paso final A/B/C.

**Lo único que cambia es lo de esta página**: el ADN visual (reemplaza su 3.1 y su 3.2), quién narra, el valor de `estilo` y las referencias del antes y el después. Donde aquella skill dice "Pixar" para el look, aquí vale lo de abajo.

- `estilo`: siempre `"realista-narrado"`. `modo_audio`: siempre `"voz_en_off"`.
- **La música** se genera con Suno (`npm run musica`), como en Pixar. Va suave y emotiva, sin tapar la voz.
- **Subtítulos, transiciones y efectos**: como en cualquier estilo de voz en off.

## Cómo reconocer este estilo
- **Personas que parecen reales** en lugares reales, con el look de un video de celular: la luz natural del lugar, el leve temblor de cámara y nada de "comercial". La cara de la persona es la misma en todas las tomas.
- **La historia es una transformación**: una o dos tomas del "antes" (la panza, el cansancio, el dolor), el uso del producto en su rutina y el "después" en varios lugares (el patio, la cocina, el espejo), con gestos de orgullo como levantarse la camiseta o bailar.
- **Narra alguien que lo vivió de cerca**: un hijo que cuenta lo de su papá, la esposa, o el protagonista en primera persona. **Nunca un locutor.** La voz suena a persona real hablando con un amigo.
- **El mecanismo va en anatomía médica 3D**: un cuerpo translúcido sobre un fondo azul marino oscuro, con el sistema afectado iluminado (el linfático en verde neón, las articulaciones en rojo, el residuo como grumos ámbar). Es la única parte que no es realista, y está bien.
- **El producto** va en macros de calidad: en mano a contraluz, el gotero sobre la lengua, junto al cepillo de dientes en el lavamanos, y un bodegón final sobre fondo oscuro con un haz de luz.

## Subestilos de referencia
Cada subestilo es una forma probada de hacer este estilo, sacada de un anuncio real que vende. Su ficha está en `subestilos/<id>.md` y sus fotogramas en `subestilos/<id>/ref-01.jpg` a `ref-12.jpg`.

| Subestilo | Cuándo |
|---|---|
| `transformacion-familiar` — La transformación del papá | suplementos para hombres o mujeres de más de 45 años: el hijo cuenta el antes y el después de su papá en 28 días, con la línea de tiempo semana a semana y el mecanismo en anatomía 3D |
| `disculpa-con-oferta` — "Les debemos una disculpa": la oferta en montaje | para anunciar una oferta (2x1, descuento) en 30 a 40 s: un montaje rápido de muchas mujeres distintas, grabado como con un celular (selfies en el espejo, el frasco en la mano, la bodega), con la voz en off que da la noticia |

- **Si el mensaje dice "Subestilo: <nombre>"**, es ese y no se pregunta.
- **Si no dice ninguno**, elige tú: `disculpa-con-oferta` si el anuncio es para anunciar una oferta, y `transformacion-familiar` en los demás casos. Dilo en una línea del resumen.
- **Antes de escribir los personajes y los prompts**, lee la ficha y **mira sus doce fotogramas con Read** (uno por plano): son la vara de calidad.
- **En el manifiesto, adjunta el fotograma de cada imagen**: `"fotograma"` en cada toma, B-roll y hoja, con la ruta del `ref-NN.jpg` que le toca según la tabla de la ficha, y `"fotograma_final"` en el frame final de una toma B. El motor lo manda al generador sin subtítulos (versión `limpio/`), junto con el prompt. No cuesta más ni tarda más.
- **Cada prompt de video, desde el movimiento del original**: antes de escribirlo, mira `subestilos/<id>/movimiento/<nombre del fotograma>.jpg` (seis cuadros del plano original) y su duración en `movimiento/planos.json`, y describe ese mismo movimiento de cámara y de la persona, con el ritmo de cortes del original (`ritmo-ref`).
- **Los avatares, como en la ficha**: la hoja de cada personaje sigue la sección «Los avatares» de la ficha, al detalle (la cara, el pelo, la piel, el cuerpo, la ropa, el material, la luz y el encuadre), con su prompt de hoja como base. Solo cambia lo que el usuario pidió. Si la ficha dice que va adjunto, la referencia del personaje lleva `"fotograma": ".claude/skills/<skill>/subestilos/<id>/avatar/<rol>.jpg"`. Si dice que es una persona real filmada, su foto nunca se adjunta: se crea una persona nueva del mismo tipo.
- **De las referencias nunca se copian** las caras, las marcas, los productos, las frases ni las cifras.

## ADN visual (reemplaza el 3.1 y el 3.2 de Pixar)

**Las tomas de persona (los capítulos 1, 2 y 4)** son fotorrealistas, en formato vertical 9:16, con el look de celular: la piel con poros y arrugas reales, la ropa común y lugares concretos de una casa o un barrio de verdad (la sala con sofá, la cocina con platos en el escurridor, el patio con cerca de madera, el auto, el baño con espejo, la oficina, el gimnasio). La luz es la del lugar (ventana, atardecer, lámpara cálida), sin luces de estudio. La cámara va en mano o apoyada, a la altura de quien filma (un hijo que graba a su papá). Un solo movimiento simple por clip.

```
Photorealistic vertical 9:16 smartphone photo, candid and unposed, [persona de la hoja] [acción concreta de la línea] in [lugar real concreto], [luz natural del lugar], real skin texture with pores, everyday clothes, slight handheld framing, shot on a phone, no studio lighting. No text, captions or watermarks.
```

**Las tomas de mecanismo (el capítulo 3)** son de anatomía médica 3D hiperrealista: un cuerpo humano translúcido de frente, sobre un fondo azul marino oscuro y liso, con el sistema afectado iluminado y el resto en azul tenue. Primero el problema (vasos o conductos lentos, el residuo ámbar acumulado, las articulaciones en rojo) y después la solución (el flujo que se mueve, el residuo que sale, el rojo que se apaga). Van con Start/End Frame como en Pixar (3.3). **Este fondo de estudio oscuro sí se permite aquí.**

```
Hyper-realistic 3D medical anatomy render, vertical 9:16, a translucent human body front view on a plain dark navy background, the [sistema] glowing [color] and clearly highlighted, [estado: amber waste clumps backed up in the lower abdomen / flowing freely and draining], the rest of the body faint blue, cinematic medical visualization, high detail. No text, labels or watermarks.
```

**Las tomas de producto** son macros fotorrealistas de la hoja del producto en situaciones reales. Por ejemplo:
- en una mano a contraluz, con el sol de la ventana;
- el gotero sobre la lengua;
- en la repisa del baño con el cepillo de dientes;
- un bodegón final sobre fondo gris oscuro, con un haz de luz suave desde arriba.

La etiqueta se dicta literal, como en la hoja de producto de Pixar, pero en versión fotográfica.

**El negativo de las tomas de persona y de producto**, al final del prompt:
`Negative prompt: cartoon, 3D render, CGI, illustration, Pixar, plastic skin, airbrushed, beauty filter, studio lighting, text, watermark`.

**El negativo de las tomas de anatomía**:
`Negative prompt: cartoon, text, labels, watermark, photograph of a real person`.

## Las referencias: el antes y el después de la misma persona
- `protagonista_antes`: la hoja fotorrealista de la persona en su "antes", de cuerpo entero, de pie y relajada, con la ropa del anuncio, en una pared lisa de casa con luz de ventana, sin marco. Lleva el texto de la hoja de la skill Pixar ("The image is full-bleed… no picture frame…").
- `protagonista_despues`: la misma persona, con el cambio físico que promete el anuncio (la panza más plana, la cara más definida, la postura erguida), **con `"referencias": ["protagonista_antes"]`** dentro de la entrada. Así el motor la genera con la hoja del antes adjunta y sale la misma cara. Va después de `protagonista_antes` en la lista.
- **Cada toma declara solo la que le toca**: el antes o el después, nunca las dos.
- **Si hay una segunda persona** (la esposa, quien narra cuando aparece), es una entrada más con su propia hoja.
- **El producto**, con `archivo` y `generar_desde_archivo: true`, si dio foto.
- **Personas generadas con IA, nunca fotos de gente real.** Si el usuario sube fotos, sirven solo de inspiración (edad, aspecto, ropa), como en el casting de UGC.

## La voz
- **Quien narra se define en el brief**: si el usuario no lo dice, un hijo o una hija adultos que cuentan lo de su papá o su mamá. Las primeras líneas van en presente, a cámara ("¿ves eso?"), y el resto como relato.
- **La voz de ElevenLabs** se elige cercana y conversacional, de la edad de quien narra, nunca de locutor. Las voces son multilingües: el idioma lo pone el texto.
- **Las líneas** son cortas y habladas, con frases que la gente dice ("dame seis semanas", "tu esposa no lo va a creer").

## Reglas que nunca se rompen (además de las de Pixar)
1. **Todas las tomas de persona y de producto son fotorrealistas**: nada Pixar ni de plastilina. Solo el mecanismo va en anatomía 3D.
2. **La misma cara en todo el anuncio**: el antes y el después salen de la misma hoja.
3. **Nunca personas reales ni fotos de bancos de imágenes.**
4. **Las promesas son las que el producto del usuario puede sostener.** Los plazos y las cifras son los suyos.
