# Subestilo UGC — Alerta de imitaciones

Referencia: `ref-01.jpg` a `ref-12.jpg` en esta carpeta. **Míralos con Read antes de escribir el personaje y los bloques.**

## Cuándo usarlo
Un producto que ya se vende bien y tiene copias más baratas (en Amazon, AliExpress o Temu). También sirve como un segundo anuncio para quien ya lo vio: no explica el producto desde cero, sino que **convierte el miedo a que lo estafen en urgencia por comprar el original**.

## ADN visual
- **La persona**: alguien de la marca o una clienta fiel, de 35 a 50 años, natural y sin producir. En la referencia es una mujer con pelo rizado, sin maquillaje marcado y con una camiseta negra lisa. Habla rápido, con las manos y algo indignada.
- **El lugar**: una cocina moderna de noche, con luces colgantes cálidas sobre la isla, gabinetes oscuros y metal. Delante, la mesa de la isla, de cuarzo claro.
- **La utilería**: un vaso de agua transparente y el producto en una mano. **La prueba**: echa una gota del producto en el agua y se ve el color real (en la referencia, el agua se vuelve color miel). Esa es la demostración que hace creíble la diferencia con las copias.
- **La cámara**: el celular apoyado en la isla, en plano medio y algo picado. Ella se inclina hacia la cámara en las frases fuertes.
- **La luz**: cálida, de interior, en contraluz suave desde arriba. La piel es real y el producto se lee bien.
- **Las inserciones del montaje** (no van en los prompts, regla 9): una captura de la copia con una flecha roja y la foto de cada ingrediente cuando se nombra. Anótalas en la Sección A como textos o imágenes para editar.

## Estructura del guion (se copia el orden, nunca las frases)
1. **Gancho**: "No te dejes estafar con <marca>".
2. **Cuando algo se hace viral, salen las copias**: así se reconoce el original (el logo, la etiqueta).
3. **Dónde están las copias y a qué precio**, y la que más circula ahora.
4. **Qué traen las copias**: uno o dos ingredientes, o solo relleno.
5. **Cómo comprobarlo**, con la prueba del vaso.
6. **Las pruebas del original**: análisis de laboratorio, dónde se hace y la fórmula completa con sus ingredientes nombrados uno por uno.
7. **Qué resuelve**: el dolor del público, con su sensación concreta.
8. **La oferta más grande del año**: 24 horas, el porcentaje, la garantía y "se está agotando".
9. **CTA**: "toca el botón ahora", más el cierre "no te dejes estafar, compra el original".

Dura entre 60 y 105 segundos, todo en el mismo lugar.

## Plantilla del personaje (en inglés, se adapta)
```
Photorealistic vertical 9:16 smartphone video still. A natural, expressive woman in her 40s, curly shoulder-length hair, no visible makeup, plain black t-shirt, standing behind a light quartz kitchen island at night, warm pendant lights above, dark modern cabinets and stainless appliances softly out of focus behind her. A clear glass of water on the counter and the product held in one hand toward the camera, label readable. Phone propped on the counter slightly below eye level, medium shot, real skin texture, warm indoor light.
```

## Fotogramas
| Foto | Qué muestra | Úsalo para |
|---|---|---|
| 01 | se acerca a la cámara con la palma abierta, mientras en el montaje entra la foto de la copia | el gancho ("no te dejes estafar") |
| 02, 09 | la palma hacia la cámara, en un gesto de "alto, escucha" | "escucha", "y ahora mismo" |
| 03–04 | la mano en el aire, contando dónde se venden las copias | las tiendas y la copia de plástico |
| 05–06 | el gotero en alto, echando gotas en el vaso | la prueba del color |
| 07 | las manos juntas, ofreciendo; en el montaje entra la foto de la hierba | cuando nombra cada ingrediente |
| 08, 10–12 | el vaso ya color miel y el producto en mano, acercándolo | lo que resuelve, la oferta y la escasez |

## Movimientos y gestos
- **La cámara apoyada en la isla, algo picada.** Ella se inclina hacia la lente en las frases fuertes y vuelve atrás.
- **Las manos muy activas**:
  - la palma abierta hacia la cámara ("alto");
  - los dedos extendidos agitándose ("esa pesadez, esa hinchazón");
  - la mano que se acerca a la lente;
  - el gotero en pinza.
- **El vaso pasa de transparente a color miel** entre un bloque y otro: es la continuidad que vende.
- **Frases para el prompt de video**: "she holds the dropper above the glass and lets drops fall, the water turning light honey color", "pushes her open palm toward the lens", "shakes her spread fingers while describing the heavy puffy feeling".

## Tono e intención
- **Indignada y protectora**, como quien avisa a una amiga. Va rápido, con énfasis en "eso es una estafa", y sonríe recién en la oferta.
- **Por beat**: el gancho **para en seco**, las copias **dan rabia**, la prueba **da seguridad**, los ingredientes **dan autoridad** y la oferta **da urgencia**. El cierre repite el gancho para cerrar el círculo.

## Cómo usar los fotogramas para que salga lo más parecido posible
- **Antes de escribir cada prompt de imagen**, abre con Read el fotograma de la tabla que corresponde a esa toma. Describe en el prompt lo que se ve: el plano y la altura de la cámara, dónde está la persona en el cuadro, de dónde viene la luz y de qué color es, el fondo, la ropa, la expresión y el gesto. Esa descripción es lo que acerca el resultado.
- **Además, cada imagen lleva su fotograma ADJUNTO al generador**, junto con el prompt. En el manifiesto, la toma lleva `"fotograma": ".claude/skills/<skill>/subestilos/<id>/ref-NN.jpg"` (la ruta del fotograma de la tabla); una toma B, además, `"fotograma_final"` para su frame final; el B-roll y la hoja del personaje, también `"fotograma"`. El motor manda la versión sin subtítulos (`limpio/`) como última referencia, y le avisa al modelo que de ahí copie solo el encuadre, la pose, la luz y la calidad, nunca el texto, la marca, el producto ni la cara. No cuesta más ni tarda más. El prompt igual describe el plano: los dos juntos son lo que más acerca el resultado.
- **Cada prompt de video sale del movimiento del plano original**, no solo de la imagen. Antes de escribir el `prompt_video` de una toma, abre con Read `movimiento/<nombre de su fotograma>.jpg`: seis cuadros de ese plano del anuncio original, de izquierda a derecha, con el segundo en cada uno. Mira también su `duracion` en `movimiento/planos.json`. Escribe lo que cambia del primer cuadro al último: cómo se mueve la cámara (se acerca, se aleja, sigue al personaje, panea o queda quieta) y a qué velocidad; qué hace el personaje y en qué momento del clip; cómo cambia su expresión; y qué se mueve en el fondo (luz, partículas, gente). Va un solo movimiento de cámara y una sola acción, como en el original, y las frases de "Movimientos y gestos" sirven de base. El ritmo del anuncio también se copia: `ritmo-ref` en `planos.json` dice cuánto dura en promedio cada plano del original, y las tomas se escriben con ese largo (si el original corta cada 2 segundos, nada de tomas de 6).
- **El texto del guion sale de "Tono e intención"**: cada beat tiene una intención y una energía. Se escribe desde cero para el producto del usuario, con esa intención.

## Los avatares (así tienen que verse los personajes)
Así son los personajes del anuncio de referencia, al detalle. Cada avatar de un anuncio con este subestilo se hace así: la hoja del personaje sigue este retrato y este prompt. Lo único que cambia es lo que el usuario pida (su producto, la edad, el origen o un detalle de su público). Su ficha para la app está en `avatar/avatar.json`.

### La que avisa de las imitaciones (`creadora`)
Retrato de referencia: `avatar/creadora.jpg` (sale de `ref-02.jpg`).
- Una mujer real de 45 a 55 años, de piel morena oscura, con aspecto de clienta que sabe del tema, no de modelo.
- Pelo natural rizado apretado (3C-4A), a la altura del hombro, con volumen y sin peinar de peluquería.
- Cara sin maquillaje o casi, con la piel real: poros, líneas de expresión y ojeras suaves.
- Camiseta negra lisa de manga corta, sin joyas ni accesorios.
- Sentada detrás de la mesada de su cocina. Delante, un vaso de agua y el producto en la mano.
- Cámara frontal del celular apoyada en la mesada, un poco por debajo de los ojos, en plano de pecho para arriba. Luz cálida de los focos del techo de la cocina.
- Gesticula mucho con las manos abiertas hacia la cámara. Habla con energía de 'escúchame bien'.
- **Es una persona real filmada: su foto NUNCA va al generador**, porque sería copiar la cara de alguien real. Se genera una persona nueva y original del mismo tipo (edad, rasgos, pelo, ropa, lugar, luz y encuadre), con el prompt de abajo. El retrato solo se mira, para calibrar.

Prompt de la hoja (en inglés; `{persona}` es el origen y el género: por ejemplo, "Colombian woman"):
```
Smartphone front-camera video still of an original, non-famous {persona} in her late 40s with deep brown skin, natural tightly coiled shoulder-length curly hair with volume, no makeup, wearing a plain black short-sleeve t-shirt and no jewelry, sitting behind a light stone kitchen counter, a glass of water in front of her, talking to the camera with an open hand gesture, phone resting on the counter slightly below eye level, chest-up framing, warm overhead kitchen spotlights, modern kitchen with dark cabinets softly blurred behind, photorealistic, shot on a smartphone, natural skin texture with visible pores, fine lines and slight under-eye shadows, real flyaway hair strands, no beauty filter, no retouching. Vertical 9:16, one single character, full face clearly visible, plain background or the location described, no text, no logos, no watermark.
```

## Lo que no se copia
Ni la marca, ni las tiendas nombradas tal cual (se usan las del mercado del usuario), ni las cifras: el precio y la oferta son los del usuario. Si no tiene copias reales en el mercado, este subestilo no aplica: díselo en una línea.
