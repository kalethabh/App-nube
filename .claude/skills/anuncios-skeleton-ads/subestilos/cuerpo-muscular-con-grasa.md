# Subestilo Skeleton — Cuerpo de músculo con grasa

Referencia: `ref-01.jpg` a `ref-12.jpg` en esta carpeta. **Míralos con Read antes de escribir el Character Bible.**

## Cuándo usarlo
Productos de drenaje, retención o "desinflamar" (cara, panza, brazos), con resultados rápidos y visibles y un público joven y urbano. La narración va **en primera persona del personaje** ("empecé el lunes y el jueves…"), tipo testimonio. Es el formato alterno del 2.2 (parody-review).

## El personaje
- **Un cuerpo de anatomía muscular** (músculo rojo, tendones claros) **con depósitos de grasa amarilla** pegados en la cara, las mejillas, la papada, los brazos y una panza enorme. La calavera de hueso marfil tiene los ojos grandes castaños y expresivos.
- **Una gorra durag negra** en la cabeza: es la seña de identidad que no cambia nunca. Lleva un short negro.
- **El después**: el mismo cuerpo muscular, **sin la grasa**, marcado y con los abdominales. Se pone jeans.
- **Los extras**: esqueletos con ropa de oficina (los compañeros) y una farmacéutica esqueleto de blusa lila.

## ADN visual
- **Los lugares reales y luminosos de su día**:
  - la oficina de vidrio con la luz de la tarde;
  - el baño blanco con el espejo y el lavamanos;
  - el pasillo de un edificio;
  - el dormitorio con el espejo de pie;
  - la mesa de escritorio con las zapatillas;
  - el gimnasio;
  - una farmacia con estantes llenos del producto.
- **Recursos con humor**: el reloj de pared (orina cada 20 minutos), el inodoro desde arriba con el agua oscura, la cuenta larguísima de lo que gastó y el dedo índice sobre los dientes (el "shh" de secreto).
- **Los primeros planos de la cara** con la grasa en las mejillas, que después se ve deshinchada con los pómulos marcados.
- **La luz**: natural, cálida y realista, con un render 3D casi fotográfico de músculo húmedo y grasa brillante.

## Estructura del guion (primera persona)
1. **El gancho del resultado increíble**: "empecé el lunes y el jueves mis compañeros pensaban que me hice <cirugía>".
2. **Lo que vas a sentir** en segunda persona: tres o cuatro efectos concretos y graciosos (vas al baño, la cara se desinfla, la panza baja, los brazos se afinan).
3. **El pómulo que vuelve**: "por primera vez en años".
4. **La absolución con el gasto**: todo lo que gastaste en dietas y gimnasio, y "nunca fue tu tipo de cuerpo".
5. **Cómo se toma**, el nombre del producto y el resultado.
6. **El único problema**: que se agota. La oferta y la última reposición en 24 horas.

Dura entre 50 y 60 segundos.

## Fotogramas
| Foto | Qué muestra | Úsalo para |
|---|---|---|
| 01 | un primer plano, sostiene el frasco junto a la cara | el gancho |
| 02 | corre al baño agarrándose la panza, con el reloj en la pared | "vas a orinar cada 20 minutos" |
| 03 | el inodoro desde arriba, con el agua oscura | "años de desechos" |
| 04 | camina por el pasillo, ya marcado, junto a un compañero | "la gente va a pensar" |
| 05 | frente al espejo, se agarra el brazo con grasa | "hasta los brazos" |
| 06 | un primer plano con la mano en la mejilla, asombrado | "los pómulos" |
| 07 | sentado en el escritorio, con la grasa y las zapatillas | "intentaste de todo" |
| 08 | la cuenta larguísima de gastos que cae del escritorio | "miles de dólares" |
| 09 | un primer plano con la grasa en la cara, de reojo | "nunca fue tu tipo de cuerpo" |
| 10 | de pie, ya marcado y con jeans, en el dormitorio | "100% vale la pena" |
| 11 | una farmacéutica esqueleto con los estantes llenos | "se agota siempre" |
| 12 | sostiene el frasco y señala | "corre a buscarlo" |

## Movimientos y gestos
- **Comedia física**: corre con las rodillas juntas y aprieta la panza, flexiona el brazo y la grasa tiembla, se pellizca la mejilla, abre grandes los ojos.
- **El "shh"** con el índice sobre los dientes, en el secreto.
- **El después** posa con orgullo y saca músculo.
- **Frases para el prompt de video**: "he waddles quickly toward the toilet clutching his belly, knees together", "he flexes his arm in the mirror and the yellow fat jiggles", "he raises his index finger to his teeth in a shh gesture, eyes wide".

## Tono e intención
- **Un testimonio entusiasmado y exagerado**, como quien no puede creer lo que le pasó. Va rápido, con exageraciones graciosas ("pensaban que me hice lipo").
- **Por beat**: el gancho **sorprende**, los efectos **hacen reír y dan ganas**, la absolución **libera** y la escasez **da prisa**.

## Cómo usar los fotogramas para que salga lo más parecido posible
- **Antes de escribir cada prompt de imagen**, abre con Read el fotograma de la tabla que corresponde a esa toma. Describe en el prompt lo que se ve: el plano y la altura de la cámara, dónde está la persona en el cuadro, de dónde viene la luz y de qué color es, el fondo, la ropa, la expresión y el gesto. Esa descripción es lo que acerca el resultado.
- **Además, cada imagen lleva su fotograma ADJUNTO al generador**, junto con el prompt. En el manifiesto, la toma lleva `"fotograma": ".claude/skills/<skill>/subestilos/<id>/ref-NN.jpg"` (la ruta del fotograma de la tabla); una toma B, además, `"fotograma_final"` para su frame final; el B-roll y la hoja del personaje, también `"fotograma"`. El motor manda la versión sin subtítulos (`limpio/`) como última referencia, y le avisa al modelo que de ahí copie solo el encuadre, la pose, la luz y la calidad, nunca el texto, la marca, el producto ni la cara. No cuesta más ni tarda más. El prompt igual describe el plano: los dos juntos son lo que más acerca el resultado.
- **Cada prompt de video sale del movimiento del plano original**, no solo de la imagen. Antes de escribir el `prompt_video` de una toma, abre con Read `movimiento/<nombre de su fotograma>.jpg`: seis cuadros de ese plano del anuncio original, de izquierda a derecha, con el segundo en cada uno. Mira también su `duracion` en `movimiento/planos.json`. Escribe lo que cambia del primer cuadro al último: cómo se mueve la cámara (se acerca, se aleja, sigue al personaje, panea o queda quieta) y a qué velocidad; qué hace el personaje y en qué momento del clip; cómo cambia su expresión; y qué se mueve en el fondo (luz, partículas, gente). Va un solo movimiento de cámara y una sola acción, como en el original, y las frases de "Movimientos y gestos" sirven de base. El ritmo del anuncio también se copia: `ritmo-ref` en `planos.json` dice cuánto dura en promedio cada plano del original, y las tomas se escriben con ese largo (si el original corta cada 2 segundos, nada de tomas de 6).
- **El texto del guion sale de "Tono e intención"**: cada beat tiene una intención y una energía. Se escribe desde cero para el producto del usuario, con esa intención.

## Los avatares (así tienen que verse los personajes)
Así son los personajes del anuncio de referencia, al detalle. Cada avatar de un anuncio con este subestilo se hace así: la hoja del personaje sigue este retrato y este prompt. Lo único que cambia es lo que el usuario pida (su producto, la edad, el origen o un detalle de su público). Su ficha para la app está en `avatar/avatar.json`.

### El músculo con grasa (`esqueleto`)
Retrato de referencia: `avatar/esqueleto.jpg` (sale de `ref-12.jpg`).
- Cuerpo de anatomía muscular roja a la vista, con depósitos de grasa amarilla globosa en las mejillas, la panza, los brazos y el pecho.
- Calavera marfil limpia con ojos grandes de caricatura, café y muy expresivos.
- Durag negro con las tiras atrás y boxers negros; al final, ya marcado, pantalón negro.
- Comedia física: se aprieta la grasa, flexiona el bíceps frente al espejo, se agarra la cara.
- En casa o en el baño, con luz cálida de ventana y render suave tipo Pixar realista.
- **Va adjunto a su hoja**: en el manifiesto, la referencia de este personaje lleva `"fotograma": ".claude/skills/anuncios-skeleton-ads/subestilos/cuerpo-muscular-con-grasa/avatar/esqueleto.jpg"`. El motor manda la versión limpia, sin texto, y el prompt de la hoja sale del de abajo.

Prompt de la hoja (en inglés; `{persona}` es el origen y el género: por ejemplo, "Colombian woman"):
```
Hyper-detailed 3D render of a humanoid figure with exposed red anatomical muscles and lumpy glossy yellow fat deposits on the cheeks, belly, arms and chest, a clean ivory skull head with big expressive brown cartoon eyes, wearing a black durag with tails and black boxer briefs, comically squeezing the fat on his belly, bright home bathroom with warm window light, soft cinematic render, medium-full shot. Vertical 9:16, one single character, full face clearly visible, plain background or the location described, no text, no logos, no watermark.
```

## Lo que no se copia
Ni la marca, ni las promesas tal cual (se dicen las que el producto del usuario sostiene), ni las frases.
