# Subestilo Pixar — Los ingredientes son personajes

Referencia: `ref-01.jpg` a `ref-12.jpg` en esta carpeta. **Míralos con Read antes de escribir los personajes y las tomas.**

## Cuándo usarlo
Productos con **dos a cuatro ingredientes estrella** (plantas, raíces, semillas): el anuncio es un listicle, del tipo "3 ingredientes caseros para…", y **cada ingrediente es un personaje Pixar** con su personalidad, que ayuda a la protagonista. Funciona con públicos que confían en lo natural y en la tradición.

## Los personajes
- **La protagonista**: una mujer joven Pixar, de 22 a 30 años, con el **pelo rizado largo recogido en una cola alta**, aros dorados y una sonrisa grande. Lleva un **top blanco de tiras y jeans anchos** de tiro alto y zapatillas blancas.
- **Un personaje por ingrediente**, vestido con un traje de un color propio que lo identifica en todo el anuncio:
  - el **número uno**: una semilla o una fruta con hojas en la cabeza, de traje dorado;
  - el **número dos**: una raíz redonda con hojas, de traje café;
  - el **número tres**: una planta con rastas, de traje verde.

  Tienen caras redondas y tiernas, ojos grandes y una actitud de mentor.
- **El villano**: un monstruito rojo de pelo en punta (el cortisol, el estrés) que tiene la grasa encerrada en una jaula dorada.
- **Las mujeres de la tradición**: brasileñas o africanas Pixar con turbantes de colores, moliendo en morteros en un mercado.

## ADN visual
- **El presentador del número**: el ingrediente bajo un foco de luz dorada sobre un fondo negro brillante, con "NÚMERO N" grande (eso va en el montaje, no en el prompt).
- **Las escenas de vida**:
  - el probador de la tienda con las amigas asombradas;
  - la mesa del comedor con el plato vacío;
  - una montaña al amanecer con el monstruito;
  - un mercado tradicional;
  - una tienda naturista cara (la billetera vacía);
  - el sofá con la comida chatarra y las pesas en el suelo;
  - la calle soleada.
- **El mecanismo**: el estómago por dentro, de color naranja y fuego, con las **cápsulas que se deshacen** ("las pastillas se rompen antes de llegar"). Contra eso, la gota dorada del producto que estalla en partículas brillantes.
- **El cierre de producto**: el frasco sobre un pedestal negro con un aro de luz dorada. Los tres personajes vierten su esencia dentro del frasco, y "compra 2 y lleva 1" va con un moño dorado.
- **La luz**: un Pixar dorado y cálido, con contraluz de sol, partículas en el aire y profundidad de campo cinematográfica.

## Estructura del guion
1. **El gancho listicle**: "3 ingredientes caseros para <resultado>".
2. **Número 1**: el nombre, una advertencia que da curiosidad ("ten cuidado con este") y qué hace, con una escena concreta.
3. **Número 2**: el nombre, la señal que despierta y la escena.
4. **Número 3**: el nombre, el villano que vence y la escena.
5. **La tradición**: "las mujeres de <lugar> los usan hace siglos".
6. **El giro**: "pero nadie te dice…", comprarlos sueltos cuesta una fortuna y las pastillas no sirven.
7. **La solución**: <marca> puso los tres en dosis completas en un solo formato, y cómo se toma.
8. **Lo que no hace falta**: ni sentadillas, ni comer más, ni cirugía. El precio por día, la oferta, la garantía y la escasez.

Dura entre 70 y 80 segundos.

## Fotogramas
| Foto | Qué muestra | Úsalo para |
|---|---|---|
| 01 | los tres personajes sentados sobre frascos de vidrio en una cocina soleada | el gancho |
| 02 | el número uno bajo el foco, sobre fondo negro | el número 1 |
| 03 | la protagonista en el probador, con las amigas | "los jeans te quedan apretados" |
| 04 | el número dos en la montaña al amanecer, posando | el número 2 |
| 05 | el personaje raíz a la mesa con ella y el plato vacío | "por fin terminas un plato" |
| 06 | el monstruito rojo con la jaula, ella y el número tres | el cortisol |
| 07 | las mujeres de la tradición en el mercado | "hace siglos" |
| 08 | el estómago naranja con las cápsulas que se deshacen | "las pastillas se rompen" |
| 09 | la gota dorada que cae en el frasco y estalla | "se absorbe rápido" |
| 10 | relajada en el sofá, con la comida y las pesas en el suelo | "sin sentadillas" |
| 11 | tres frascos en el pedestal, uno con moño | la oferta |
| 12 | sonríe con el frasco y señala hacia abajo | "el link abajo" |

## Movimientos y gestos
- **Los personajes ingrediente**: hacen gestos de mentor (le señalan, aplauden, se ríen), entran con un salto o se iluminan bajo el foco.
- **La protagonista**: se mira la cadera en el espejo, se ríe con las amigas, come con gusto, camina feliz por la calle, señala el link.
- **Los macros**: la cápsula que se disuelve en el ácido y la gota que cae en cámara lenta y estalla en partículas.
- **Frases para el prompt de video**: "the root character claps his hands and laughs as she finishes the plate", "slow-motion golden droplet falls into the bottle and bursts into glowing particles", "the capsule dissolves and fizzes away in the orange stomach acid".

## Tono e intención
- **Una amiga experta en remedios naturales**, cercana y con picardía. Cada número abre con su nombre como un pequeño redoble.
- **Por beat**: la advertencia del número 1 **da curiosidad**, la tradición **da autoridad**, el giro **frustra a propósito** (es caro, no sirve) y la solución **alivia**. El precio por día **minimiza el costo**.

## Cómo usar los fotogramas para que salga lo más parecido posible
- **Antes de escribir cada prompt de imagen**, abre con Read el fotograma de la tabla que corresponde a esa toma. Describe en el prompt lo que se ve: el plano y la altura de la cámara, dónde está la persona en el cuadro, de dónde viene la luz y de qué color es, el fondo, la ropa, la expresión y el gesto. Esa descripción es lo que acerca el resultado.
- **Además, cada imagen lleva su fotograma ADJUNTO al generador**, junto con el prompt. En el manifiesto, la toma lleva `"fotograma": ".claude/skills/<skill>/subestilos/<id>/ref-NN.jpg"` (la ruta del fotograma de la tabla); una toma B, además, `"fotograma_final"` para su frame final; el B-roll y la hoja del personaje, también `"fotograma"`. El motor manda la versión sin subtítulos (`limpio/`) como última referencia, y le avisa al modelo que de ahí copie solo el encuadre, la pose, la luz y la calidad, nunca el texto, la marca, el producto ni la cara. No cuesta más ni tarda más. El prompt igual describe el plano: los dos juntos son lo que más acerca el resultado.
- **Cada prompt de video sale del movimiento del plano original**, no solo de la imagen. Antes de escribir el `prompt_video` de una toma, abre con Read `movimiento/<nombre de su fotograma>.jpg`: seis cuadros de ese plano del anuncio original, de izquierda a derecha, con el segundo en cada uno. Mira también su `duracion` en `movimiento/planos.json`. Escribe lo que cambia del primer cuadro al último: cómo se mueve la cámara (se acerca, se aleja, sigue al personaje, panea o queda quieta) y a qué velocidad; qué hace el personaje y en qué momento del clip; cómo cambia su expresión; y qué se mueve en el fondo (luz, partículas, gente). Va un solo movimiento de cámara y una sola acción, como en el original, y las frases de "Movimientos y gestos" sirven de base. El ritmo del anuncio también se copia: `ritmo-ref` en `planos.json` dice cuánto dura en promedio cada plano del original, y las tomas se escriben con ese largo (si el original corta cada 2 segundos, nada de tomas de 6).
- **El texto del guion sale de "Tono e intención"**: cada beat tiene una intención y una energía. Se escribe desde cero para el producto del usuario, con esa intención.

## Los avatares (así tienen que verse los personajes)
Así son los personajes del anuncio de referencia, al detalle. Cada avatar de un anuncio con este subestilo se hace así: la hoja del personaje sigue este retrato y este prompt. Lo único que cambia es lo que el usuario pida (su producto, la edad, el origen o un detalle de su público). Su ficha para la app está en `avatar/avatar.json`.

### La protagonista (`protagonista`)
Retrato de referencia: `avatar/protagonista.jpg` (sale de `ref-12.jpg`).
- Una chica joven de 20 a 26 años en Pixar, latina o mestiza, de piel canela clara.
- Pelo castaño oscuro en rizos, recogido en una cola alta con mechones sueltos. Ojos enormes café, pestañas y argollas doradas.
- Top blanco corto de tiras y jeans anchos claros; al final, jeans ajustados.
- Expresiones muy exageradas y alegres: boca abierta de emoción, señala con el dedo.
- **Va adjunto a su hoja**: en el manifiesto, la referencia de este personaje lleva `"fotograma": ".claude/skills/anuncios-estilo-pixar/subestilos/ingredientes-personaje/avatar/protagonista.jpg"`. El motor manda la versión limpia, sin texto, y el prompt de la hoja sale del de abajo.

Prompt de la hoja (en inglés; `{persona}` es el origen y el género: por ejemplo, "Colombian woman"):
```
Pixar-style 3D animated {persona} in her early 20s, light caramel skin, dark-brown curly hair in a high ponytail with loose strands, huge brown eyes with lashes, gold hoop earrings, white cropped tank top and baggy light-wash jeans, white sneakers, excited open-mouth smile pointing at the camera, bright warm kitchen behind, full body, high-end 3D animated feature film render (Pixar / Disney 2020s look), soft subsurface skin, glossy expressive eyes with catchlights, detailed hair strands, warm cinematic light. Vertical 9:16, one single character, full face clearly visible, plain background or the location described, no text, no logos, no watermark.
```

### El ingrediente personaje (`ingrediente`)
Retrato de referencia: `avatar/ingrediente.jpg` (sale de `ref-05.jpg`).
- Cada ingrediente es un personaje con cuerpo humano curvilíneo de mujer y cabeza del ingrediente: la raíz de maca redonda con hojas de pelo, una semilla o una piña de fenogreco.
- Cara tierna con ojos enormes, mejillas rosadas y una sonrisa pícara.
- Ropa de conjunto deportivo del color del ingrediente: amarillo, café o verde, con zapatillas.
- Posa como una estrella: entra caminando por una pasarela de luz dorada o posa en su paisaje de origen, la montaña andina al amanecer.
- **Va adjunto a su hoja**: en el manifiesto, la referencia de este personaje lleva `"fotograma": ".claude/skills/anuncios-estilo-pixar/subestilos/ingredientes-personaje/avatar/ingrediente.jpg"`. El motor manda la versión limpia, sin texto, y el prompt de la hoja sale del de abajo.

Prompt de la hoja (en inglés; `{persona}` es el origen y el género: por ejemplo, "Colombian woman"):
```
Pixar-style 3D animated character: a living [ingredient, e.g. maca root] with a round root head topped with leafy green hair, a cute face with huge eyes, rosy cheeks and a playful smile, on a curvy feminine humanoid body wearing a matching [ingredient color] tracksuit and sneakers, posing confidently with a hand on the hip, Andean mountains at golden sunrise behind with mist and floating golden particles, full body, high-end 3D animated feature film render (Pixar / Disney 2020s look), soft subsurface skin, glossy expressive eyes with catchlights, detailed hair strands, warm cinematic light. Vertical 9:16, one single character, full face clearly visible, plain background or the location described, no text, no logos, no watermark.
```

## Lo que no se copia
Ni la marca, ni el producto, ni los ingredientes de la referencia: los personajes son **los ingredientes del producto del usuario**.
