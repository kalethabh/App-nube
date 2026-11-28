# Cambios de Anuncios con IA

Cada versión nueva va arriba. La versión que tienes está en el archivo VERSION y en la app, en Ajustes, Acerca de.

## 2026-11-28a · La oficina virtual con el diseño de la app

- **La oficina 3D ahora se ve como el resto de Kads.** Se quitó el verde lima de la marca vieja: los neones, el logo, las líneas de producción, los estados y los muebles toman los colores del tema que tengas.
  - **Juego:** noche violeta con neón rosa y turquesa.
  - **Claro:** día de papel lila con rosa (antes salía en lima).
  - **Oscuro:** la noche de siempre con el acento del tema.
- **El logo del centro y el de la sala de reuniones son el ícono de la app.** Los letreros de cada sala usan la letra de los títulos (Bricolage) con el estilo «Ciudad creativa»: placa de tinta, borde de color y sombra corrida.
- **Los paneles siguen el tema**, ya no van forzados a oscuro: en Claro el chat, el equipo y la planta se leen sobre papel claro. Tarjetas, globos de los agentes, etiquetas de las salas, avisos y la tarjeta de «Presentar» usan la tinta, la sombra corrida y los colores de estado de la app (listo, revisando, devuelve, error).
- **La barra de arriba usa los botones y el logo de la app.** «Hablar con…» va en el botón rosa de la app. El aviso de «IA caída» va dentro de la tarjeta de arriba (antes la tapaba).
- **La coordinación y la sala de estar pasan del lima al dorado.** También cambian las que tenías guardadas en lima.
- La distribución, los personajes, sus animaciones, el chat y los datos no cambian.

## 2026-11-27l · Personas en landings, Google y permisos por sección

- Las imágenes de personas se adaptan al público de la investigación, con dirección de fotografía natural, variación de rostros y entornos, anatomía y empaque coherentes. Los combos muestran solo el producto.
- Las opiniones reales sin foto pueden llevar una escena generada e identificada como ilustrativa. Las fotos reales y los profesionales autorizados se conservan. Las consultas generadas no inventan nombres ni avales.
- Al adaptar una URL se cubren también personas, profesionales y opiniones, sin el límite anterior de ocho imágenes. Se actualizan las variantes de imagen y la carga diferida. Los trabajos se procesan de a tres.
- La landing muestra el avance por imagen, los fallos y las imágenes que la revisión visual pide revisar. No se anuncia como completa si quedan imágenes pendientes.
- Inicio de sesión con Google preparado en el sistema de cuentas de Kads. Requiere activar el proveedor Google y autorizar la dirección de retorno en el Supabase propio de la app.
- En Usuarios, el administrador puede aprobar una cuenta y elegir sus secciones. Los permisos se aplican al menú, los enlaces directos y las solicitudes al servidor. La actualización de la base se descarga desde el panel; hasta aplicarla se mantiene el acceso anterior de las cuentas aprobadas.

## 2026-11-27k · Landings AMUNA tal cual y el profesional de la salud en «cuidado»

- **Las landings vuelven al orden y el título de tu página de AMUNA**, como en el artefacto: los combos arriba, justo después del nombre del producto. Se quitaron el titular de resultado, el bloque de dolor y el auditor de la versión anterior.
- **«Tu rutina merece cuidado» lleva un profesional de la salud:**
  - **Si tienes uno real que te autorizó:** subes su foto, nombre y especialidad (y marcas «Me autorizó…»), y sale él con su placa.
  - **Si no:** ChatGPT hace una imagen de una consulta médica (doctora o doctor con su paciente, sin tu producto y sin nombre), con la nota «Imagen ilustrativa. No representa una recomendación médica del producto», como en tu página de AMUNA.

## 2026-11-27j · Landings con la clase «Cada página es una landing»

- **Primera pantalla nueva:**
  - arriba, el nombre del producto en chico;
  - debajo, el titular de resultado (beneficio + tiempo + deseo, siguiendo la promesa de tus anuncios);
  - un subtítulo «Para quién es»;
  - la prueba social, si hay reseñas reales;
  - y el botón «Pedir ahora · pago al recibir».
- **Bloque de dolor:** «¿Te pasa esto?», 3 frases de la clienta con sus palabras (de la investigación) y «¿Te suena? No eres la única».
- **El scroll en los 8 pasos de la clase:** engancho → dolor → promesa → pruebas en medio → ingredientes y modo de uso → combos (ahora después de beneficios y pruebas) → pago al recibir, dudas y preguntas → cierre. Siguen todas las secciones y la cantidad de AMUNA.
- **Reglas en los textos:** el titular dice el tiempo; el subtítulo empieza con «Para…»; nada de promesas de cura (bienestar, nunca curas).
- **Auditor de la clase:** cada landing sale con su nota (6 pilares, 18 puntos) y por dónde empezar a mejorarla. Sin reseñas ni capturas reales, te dice que las subas.

## 2026-11-27i · Plantilla AMUNA: titulares que no se cortan

- **Arreglado: el titular de la imagen principal salía cortado arriba y la última línea abajo.** ChatGPT solo hace imágenes 2:3 y copiaba la composición alta de AMUNA (9:16), así que se le salía el texto. Ahora le decimos el lienzo real que tiene, con márgenes de 8 % arriba y abajo.
- **Si aun así sale algo pegado al borde, la app la rehace una vez**, con todo más chico.

## 2026-11-27h · Plantilla AMUNA: la misma estructura y la misma cantidad de información

- **La misma cantidad que tu página de AMUNA:** 4 checks, 4 dudas, 4 momentos de la ruta, 3 pasos, 6 filas de comparación, 11 preguntas frecuentes y 2 avisos legales. Cada texto tiene el largo del de AMUNA; si sale más corto o más largo, el equipo lo rehace.
- **9 fotos en el carrusel de «Experiencias con…»**, como AMUNA, o hasta 9 capturas reales tuyas.
- **Con una sola reseña real ya salen todas las secciones de AMUNA:** testimonio, «Ellas cuentan», «Experiencias personales», reseñas con su nota, las estrellas bajo «Experiencias con…» y el selector para ordenarlas. Si una reseña no trae foto, va la de tu producto, nunca una persona inventada.
- **Pegar varias reseñas de una vez:** una por línea, «Nombre | Ciudad | Estrellas | Texto» (sirve copiar de Excel, Judge.me o Loox). Un contador te dice cuántas llevas para que quede igual a AMUNA: 11 reseñas (5 con foto) y 9 capturas.

## 2026-11-27g · Plantilla AMUNA: imágenes sin cortes, fotos caseras y más rápida

- **Ninguna imagen sale cortada.** A ChatGPT se le piden solo los tamaños que hace bien (cuadrada o 2:3) y después:
  - las imágenes con texto entran enteras, con el color de fondo de la página alrededor;
  - en las fotos, la persona y el producto quedan en el centro.
  - Las historias y los pasos tienen ahora la medida de la caja donde se ven.
- **Fotos caseras y variadas:** cada foto lleva otra mujer, otro lugar y otra ropa, con luz natural, como tomada con el celular.
- **Historias con el marco de Instagram de tu marca:** barritas, avatar, tu @ y una frase tipo sticker.
- **Capturas reales de tus clientas** (chats, mensajes; opcional, hasta 9): salen tal cual en «Experiencias con…», como en AMUNA. Sin ellas, esa parte lleva fotos caseras de tu producto; nunca se inventan chats.
- **Más rápida:** las imágenes se hacen de a 3 a la vez.

## 2026-11-27f · Landings con la estructura de tu página de AMUNA

- **Plantilla nueva en «Landings → Crear con el equipo»: «AMUNA: combos y ritual».** Ahora es la que sale por defecto; la de CEN sigue disponible. Hace la landing con la misma estructura de tu página de AMUNA:
  - galería de 11 imágenes, combos 1, 2 y 3 con insignia, tachado y «Ahorras», y pago al recibir;
  - dudas rápidas, aviso de pedido, creativo, ingredientes, historias, ruta de 3 meses, pasos y franja;
  - comparación, compra clara, cuidado, preguntas frecuentes, pie y barra fija.
- **Los textos siguen lo que hace cada parte de la de AMUNA**: el mismo largo, la misma intención y el mismo tono, para tu producto.
- **ChatGPT hace sus 31 imágenes, cada una con la medida exacta de la original** (por ejemplo, la primera de la galería, 942×1670). Para cada una mira la imagen de AMUNA que le corresponde y usa la foto de tu producto. Si alguna no sale, queda un recuadro gris con su medida.
- **Reseñas reales con foto y estrellas.** Con ellas salen el testimonio destacado, «Ellas cuentan» (las que tienen foto) y las reseñas con su nota y sus barras, calculadas de tus reseñas. Sin reseñas, esas partes no salen: la app no inventa testimonios, cifras de clientas ni calificaciones.
- **Las historias y las capturas son fotos de estilo de vida**, con títulos que no dicen que son clientas.
- **Los colores salen de tu empaque.** La letra es Inter y el fondo de la página es el mismo de las imágenes.

## 2026-11-27e · Landings terminadas: sin variables, letra Inter y el fondo de tus imágenes

- **Ya no queda nada para completar:** sin «Nombre Apellido», «XX», «Aquí va…» ni «Precio por definir». Lo que no se puede sostener se quita solo.
- **Reseñas, solo las reales:** en «Crear con el equipo» puedes pegar las reseñas de tus clientas (nombre, ciudad y lo que escribieron) y salen tal cual. Sin reseñas reales, la landing no lleva reseñas ni testimonios.
- **Sin médicos ni opiniones inventadas:** la sección de profesionales se quitó; la del médico pasa a «Cuidado» (cómo usarlo y cuándo consultar), con una foto de estilo de vida. La encuesta con porcentajes pasa a «Cómo funciona», en pasos.
  - Por qué: inventar reseñas, médicos o cifras de clientas engaña al comprador, y en Colombia la SIC lo sanciona; Meta también puede tumbar la cuenta.
- **Fotos de estilo de vida:** ChatGPT hace fotos de mujeres colombianas como tu clienta, usando el producto, sin bata ni nada de médico.
- **La letra es siempre Inter**, también en las landings que adaptas desde un link.
- **El fondo de la página es el mismo de las imágenes:** los creativos se piden con ese fondo liso y la app mide el color que de verdad quedó en sus bordes para usarlo en la página.
- **Sin los efectos típicos de ChatGPT:** nada de letras con brillo, sombras, destellos ni colores saturados.
- **Los precios ahora son obligatorios** (1, 2 y 3 unidades).

## 2026-11-27d · Anuncios de imagen más limpios: menos texto, letra grande y fondo claro

- **Menos texto y más grande:** cada imagen lleva pocos bloques de texto (lo ideal son 3) y nada de letra pequeña, párrafos ni franjas con texto diminuto. La propuesta de valor es más corta (de 8 a 16 palabras).
- **Nada cortado:** los títulos y los sellos quedan siempre lejos de los bordes, también en vertical y al cambiar el tamaño.
- **La tipografía de tu referencia:** letra negra muy gruesa y la frase clave en una barra del color de tu marca con letra blanca en cursiva. Sin contornos, brillos ni letras 3D.
- **Un mismo fondo claro y limpio en todo el lote:** blanco o un tono suave de tu marca, nunca oscuro ni morado.
- **Los resultados se ven grandes:** el antes y después ocupa la mitad de la imagen o más.
- **El INVIMA destacado:** grande, en una placa blanca redondeada con el número legible.
- **La revisión** rechaza las imágenes con texto cortado o pequeño, fondos oscuros o distintos al resto, o un INVIMA que no se lee.
- Cuando pides copiar una referencia, una variante o «Como las que funcionan», se respeta el diseño de esa imagen, pero igual con márgenes y letra que se lea.

## 2026-11-27c · Elegir varias imágenes en el chat, referencias sin límite y el error de «saldo» con la voz

- **Chat de imágenes, elegir varias:** marca el círculo arriba a la izquierda de cada imagen (o «Elegir estas N») y escribe qué les cambias.
  - Los cambios sencillos van a todas al instante: «borra el texto de abajo», «pon el fondo blanco».
  - «Pásalas a vertical» (o 4:5, o cuadradas) cambia el tamaño de todas; la de antes queda en «Versiones anteriores».
  - Lo más complejo lo hace la IA, imagen por imagen.
- **Crear anuncios de imagen:** ahora puedes subir hasta 99 referencias (antes eran 10).
- **Corregido: «Tu saldo de kie no alcanza» en el paso de la voz, aunque hubiera saldo.**
  - En realidad era ElevenLabs (la voz), que pedía un pago: casi siempre una voz de la biblioteca usada con un plan gratis, o un pago pendiente.
  - Ahora la app lo dice así y explica qué hacer: elegir otra voz (una «premade» o una propia) o activar un plan pago en ElevenLabs.

## 2026-11-27b · Chat de imágenes: libre, rápido y siempre con tu ChatGPT

- **Las imágenes de anuncios y del chat se hacen siempre con tu ChatGPT (gratis), nunca con kie.** Cada prompt pide la mayor calidad posible: nitidez, textos perfectos, piel y telas realistas.
- **Chat libre:** ya no trae un tamaño ni una cantidad elegidos.
  - Si no eliges, la IA hace lo que dice tu mensaje (si no dice cuántas, una).
  - Para el tamaño usa el de tu imagen de referencia o el que mejor sirva.
  - Si eliges un tamaño, tócalo otra vez para dejarlo libre.
- **Los cambios sencillos van directo:** borrar un texto, cambiar a la persona, un color, la tipografía o el tamaño de algo.
  - El chat los manda al instante, sin analizar, y queda la versión nueva de esa imagen.
  - Por ejemplo: «borra el texto de abajo en V02», «cambia en V01: el botón a verde» o «la última con fondo blanco».
- **Las imágenes que adjuntas se abren en grande** al tocarlas, con «Descargar» y flechas si hay varias.
- **«Editar y volver a enviar»** en cada mensaje tuyo: lo corriges y se vuelve a enviar con sus mismas imágenes.

## 2026-11-27a · Chat de imágenes

- **Nueva sección «Chat de imágenes»** en el menú, debajo de «Anuncios de imagen». Le pides imágenes con tus palabras y las crea directo.
- **Ya sabe cómo las quieres:**
  - tu producto y su foto, tu oferta y tus sellos, el cuerpo y el tiempo de transformación;
  - tu investigación y tus ganchos validados;
  - cómo trabaja Mayaverra y los títulos con propuesta de valor;
  - tus preferencias, lo que aprendió el supervisor y lo que te funciona.
  - Recuerda la conversación: le puedes decir «la última, pero en vertical».
- **Eliges el tamaño (1:1, 9:16 o 4:5) y cuántas** (1 a 4). Puedes adjuntar imágenes: pegarlas, arrastrarlas o subirlas.
- **Para cambiar una imagen, díselo**, por ejemplo «cambia el fondo de V02». Sale la versión nueva y la anterior queda en «Versiones anteriores».
- **Las imágenes quedan en la carpeta del producto**, en Anuncios de imagen, con todos sus botones: descargar, Me funciona, editar y versiones.
- **El costo:** con tu ChatGPT no cuesta por imagen. Con kie, la primera vez el chat te muestra cuánto cuesta cada imagen; después las crea sin preguntar y cada respuesta dice cuánto costó.

## 2026-11-26k · Anuncios de imagen: la imagen de antes ya no queda al lado

- **Los lotes donde creaste «otro tamaño» con la versión anterior** mostraban las dos imágenes lado a lado (por ejemplo, la 1:1 y la 4:5).
  - Al abrirlos, ahora queda una sola: la del tamaño nuevo.
  - La de antes pasa a «Versiones anteriores»: ábrela en grande y pasa a ella con las flechas.
- Desde la versión 2026-11-26j, cambiar el tamaño ya reemplaza la imagen así, como una edición.

## 2026-11-26j · Anuncios de imagen: cambiar el tamaño como una edición y anuncios como los que te funcionan

- **Cambiar el tamaño ya no pone otra imagen al lado:** en «¿Regenerar esta imagen?» toca «Vertical 9:16», «Retrato 4:5» o «Cuadrado 1:1».
  - La misma imagen se rehace en ese tamaño, con los mismos textos.
  - La de antes queda en «Versiones anteriores»: ábrela en grande y pasa con las flechas a la anterior, igual que después de una edición.
  - Si después la regeneras, sigue en el tamaño nuevo. Cuesta 1 imagen.
- **Más imágenes, «Como las que me funcionan»:** eliges imágenes que marcaste con «Me funciona» (de este producto o de otro, hasta 5).
  - Salen anuncios nuevos para este producto, con la estructura y el estilo de esas imágenes.
- **Ninguna imagen nueva repite un titular del lote**, ni en «Anuncios nuevos» ni en «Como las que me funcionan».

## 2026-11-26i · Anuncios de imagen: otro tamaño y más imágenes en el mismo lote

- **Otro tamaño de un anuncio:** en «¿Regenerar esta imagen?» elige «+ Vertical 9:16», «+ Retrato 4:5» o «+ Cuadrado 1:1».
  - Se crea ese tamaño del mismo anuncio, a partir de su cuadrado y con los mismos textos.
  - Cuesta 1 imagen y antes ves el costo.
  - La imagen que ya tienes no cambia.
  - Los tamaños que el anuncio ya tiene salen marcados con ✓.
- **Más imágenes en el lote:** con el botón «Más imágenes» (junto a «Hacer otro lote») eliges de 1 a 10.
  - **Anuncios nuevos:** distintos de los que ya tienes, con otras estructuras ganadoras y otros ganchos, y con tu mismo producto y tu oferta.
  - **Variantes de una imagen:** otra foto del mismo anuncio, con el mismo diseño, gancho y oferta, pero otra modelo, otra pose, otra escena y otra luz. Se piden con «Más como esta» en la imagen o desde «¿Regenerar esta imagen?».
  - Antes ves el costo. Las imágenes nuevas aparecen al final del lote y las que ya tenías no cambian.

## 2026-11-26h · Anuncios de imagen: adjuntar imágenes al pedir un cambio

- **En «¿Regenerar esta imagen?» puedes adjuntar hasta 3 imágenes:** una pose, una persona, un fondo o un sello. Las subes, las arrastras, las pegas con Cmd/Ctrl + V o las eliges de «Mis piezas».
- **Escribe qué hacer con ellas**, por ejemplo «Usa la pose de la imagen adjunta». La IA las mira y las usa solo para eso; el resto del anuncio queda igual.

## 2026-11-26g · Anuncios de imagen: cada momento, otro día

- **Antes y después y progreso:** en cada momento (antes, 24 horas, semana 1, mes 3…) cambian la pose, la ropa, el peinado, el lugar y la luz. Así se nota que pasó el tiempo y no parece la misma foto. La app lo revisa en cada imagen.
- **Regenerar una imagen:** la ventana «¿Regenerar esta imagen?» ahora muestra el anuncio al lado, para que veas qué estás cambiando.

## 2026-11-26f · Anuncios de imagen: títulos como Mayaverra, con propuesta de valor y tiempo

- **Cada imagen lleva ahora un gancho y debajo su propuesta de valor**, como Mayaverra, con tu fórmula: **deseo principal + tiempo de transformación + deseo central**.
  - Ejemplo: «LEVANTA TUS GLÚTEOS» y debajo «Glúteos más redondos y firmes en solo 4 semanas, para volver a lucir tus jeans con seguridad».
  - A veces también una línea de tiempo: «Semana 1 · Semana 4 · Mes 3».
- **Promesa directa** («en solo 4 semanas», «tu tratamiento de 3 meses»), como pediste. Siguen prohibidas las cifras inventadas, los testimonios con nombre, las enfermedades y la palabra «garantizado» si no tienes garantía.
- **Nuevo campo «Tiempo de transformación»**: por ejemplo, «Tratamiento de 3 meses · se nota desde la semana 4». Si lo dejas vacío, la IA lo deduce de tu oferta y lo recuerda.
- **La app revisa los títulos:** cada imagen lleva su propuesta de valor con las tres partes y el tiempo (salvo las fotos caseras y las cartas de texto).
- **Las fórmulas de títulos de Mayaverra están en el manual**, con su versión para glúteos y piernas.

## 2026-11-26e · Anuncios de imagen: se ve el resultado en TU zona del cuerpo

- **La imagen muestra la zona que mejora tu producto, con el resultado.** Antes la IA copiaba la escena de Mayaverra: pies hinchados, o una mujer mostrando el problema. Ahora la traduce a tu producto.
  - Para Aguaje son glúteos y piernas, mostrando el resultado (glúteo redondo y levantado) o el antes junto al después, siempre con jean o leggins.
  - Ejemplo: la foto de una pierna hinchada junto a la normal se vuelve el glúteo plano junto al levantado, en la misma foto.
- **Nuevo en el formulario:** «Zona del cuerpo que mejora» (glúteos, piernas, abdomen…). Si no la eliges, la IA la deduce y la recuerda.
- **Sellos sin instrucciones:** si escribes «Agregar logo y sello de registro INVIMA…», la app deja solo «REGISTRO INVIMA…». Ya no se imprime la instrucción y no se agrega logo.
- **Fotos caseras:** llevan un titular corto arriba y la franja con «pagas al recibir» y tu registro.
- **Fichas revisadas una por una contra su imagen.** Cada una trae cómo se adapta a cualquier producto.
- **«Al azar» no repite el estilo seguido:** ningún estilo pasa de la mitad del lote.

## 2026-11-26d · Anuncios de imagen: solo Mayaverra, su manual y tus estructuras

- **Solo Mayaverra:** las estructuras ganadoras ahora son solo suyas, 55 anuncios. Se agregaron 35 de su tienda principal, la que más vende (sus anuncios llegan a más de 350 mil personas), y se quitaron las de otras marcas.
- **El manual de Mayaverra:** la app aprendió cómo varía y cómo vende. Lo usa en cada lote con estructuras.
  - Lo que nunca cambia: el frasco, los colores, la misma oferta escrita igual, el botón y un solo «enemigo».
  - Su mezcla de ideas: resultado, mecanismo, emoción, oferta, urgencia y segmento, y un tercio de fotos «de celular» sin texto.
  - Sus fórmulas de titular.
  - Cómo achica el precio y quita el riesgo.
  - Lo que nunca se copia: sus cifras, avales inventados y urgencias falsas.
- **«Al azar» sortea como Mayaverra:** cada lote sale con su misma mezcla de ideas, sin repetir el estilo seguido.
- **Agrega tus propios anuncios ganadores:** en «Estructuras ganadoras» → «Agregar un anuncio ganador», súbelo, pégalo o elígelo de «Lo que me funciona».
  - Tu IA lo analiza (sin costo) y queda como P01, P02…
  - Entra al sorteo: cada lote lleva al menos uno tuyo.
  - Lo puedes quitar cuando quieras.

## 2026-11-26c · Anuncios de imagen: supervisor, editor y carpetas más claras

- **Supervisor que aprende:** al terminar cada lote, la app compara lo que pediste con lo que salió. Te muestra qué falló en «Lo que aprendió el supervisor» y anota 1 a 3 reglas para que no vuelva a pasar. El próximo lote ya las usa.
- **Más detalle en cada imagen:** la IA describe cada zona del anuncio: luz, cámara, piel, letras con su color, frasco y el antes y después.
- **Editor de imágenes** (botón «Editar» en cada imagen del lote):
  - textos, formas (precios, cintas) y tus propias piezas, que mueves, agrandas y giras como en Canva;
  - **Mis piezas:** sube tus sellos, logos o precios, para un producto o para todos, y pégalos exactos;
  - **Cambiar una zona con IA:** marcas un rectángulo y escribes el cambio; el resto de la imagen queda idéntico;
  - **Integrar con IA:** la pieza se pega exacta y la IA ajusta la luz y la sombra para que se vea parte de la foto;
  - cada cambio se guarda como versión nueva y puedes volver atrás.
- **30 estructuras ganadoras más** (Mayaverra y anuncios del top de TrendTrack), que no se muestran: con «Al azar (recomendado)» cada lote sortea entre las 38 para que siempre varíen.
- **Carpetas por producto con bloques:** dentro de la carpeta de un producto, cada landing, lote o anuncio es un bloque con su imagen, no otra carpeta. Con el lápiz le pones el nombre que quieras («Ángulo 1», «Ángulo 2»…).
- **Crear anuncios de imagen más limpio:** pestañas arriba, el producto en una lista con su foto, una línea de ayuda por elección y lo opcional de venta plegado.

## 2026-11-26b · Anuncios de imagen: estructuras ganadoras

- **Nuevo modo «Estructuras ganadoras»** al crear anuncios de imagen:
  - cada imagen sale del diseño de un anuncio ganador distinto (8 estructuras de Mayaverra: antes y después 3D, antes y después real con oferta, lo invisible hecho visible, línea de tiempo, personaje 3D, ilustración lado a lado, bodegón premium y carta de texto);
  - se llenan con tu producto, tus textos y tu oferta, nunca con su texto ni su marca;
  - vienen marcadas las 4 de la primera prueba.
- **En todos los lotes**, cada imagen sale de una estructura distinta, y nunca se repiten seguidos el estilo (foto real, 3D, ilustración, bodegón, carta), la zona del cuerpo ni el segmento.
- **Comparación con la referencia:** al terminar ves cada imagen lado a lado con su estructura y 7 puntajes de 0 a 10:
  - estructura;
  - dolor visual;
  - titular;
  - texto limpio;
  - frasco fiel;
  - oferta y confianza;
  - diferencia real.

  Pasa con 8 o más en todos. La que no, queda «Para rehacer» con el prompt corregido.
- **Nada se rehace solo**: tú decides con «Rehacer con esta corrección». También desde Claude Code con `npm run rehacer temp/<lote> --pieza V02_1x1`, que muestra el costo antes.
- Las imágenes de referencia se bajan solas a tu biblioteca privada la primera vez. No van en el instalador.

## 2026-11-26a · Anuncios de imagen: variaciones distintas de verdad

- **«Qué tan distintas»** reemplaza a «Replicar validado (exacto)» al crear desde un anuncio ganador:
  - **Fieles**: tu anuncio tal cual (lo de antes).
  - **Vecinas** (por defecto): la mitad con el ángulo de tu ganador y el resto con 3 ángulos más o más, con otros formatos, escenas, modelos y cámaras.
  - **Conceptos nuevos**: cada imagen con un formato distinto.
- **Antes de todo, tu IA analiza por qué vende tu ganador**: el deseo, el dolor, la promesa, la emoción, lo que se ve primero, qué no se toca, qué se puede cambiar y qué probar. Lo ves arriba de las imágenes.
- **Reglas que la app revisa sola** en Vecinas y Conceptos (si fallan, la IA rehace el plan). Con 10 imágenes:
  - máximo 2 con el mismo formato;
  - al menos 4 ángulos;
  - escena, modelo, ropa, cámara y colores de apoyo distintos en cada una;
  - al menos 3 que parecen contenido normal y 3 con el producto como protagonista.

  Tu ganador se usa solo como guía de estilo: no se copia su diseño.
- **Campos nuevos (opcionales, se guardan con el producto):**
  - **Oferta**, que sale tal cual y con el punto de miles de Colombia (o el separador de tu país);
  - **Sellos de confianza**, exactos, sin inventar otros;
  - **País del precio**;
  - **Prohibido decir**.
- **Revisión con nota del 1 al 10**: cada tarjeta muestra su formato, su ángulo, por qué debería vender y su nota, y el lote sale ordenado de la mejor a la peor. Lo que la revisión no aprueba se rehace solo (hasta 2 veces). El costo máximo que ves antes de generar ya lo incluye.
- **Aprender de mis ventas** (botón en Anuncios de imagen): lee tus anuncios en Meta y guarda qué formato y ángulo vendió más de cada producto. Para eso, las imágenes se descargan con nombres como `producto_V03-F17-ugc-selfie-transformacion.png`: súbelas a Meta con ese nombre.

## 2026-11-25k · Landings creadas: revisadas de verdad contra la base

- Probé el proceso completo con CAYENNE PEPPER y su investigación real, y comparé cada sección con la base. Arreglos:
  - **Renata ahora mira la página terminada**, sección por sección, contra capturas de la base, y corrige lo que vea.
  - **Lo que no aplica se quita** en vez de inventarse: una fila de la comparación, una cifra, un profesional (con su filtro), una reseña, una pregunta, o una sección entera.
  - **Renata recibe los textos que quedaron igual que en la base** y los que pudieron quedar en el lugar equivocado (una pregunta donde iba una respuesta).
  - **Calificación, número de opiniones y «+40.000» ya no salen inventados**: quedan «X,X» y «XX» para tus datos reales.
  - Las negritas automáticas resaltan las palabras de tu producto, y la barra fija de abajo ya trae tu precio.

## 2026-11-25j · Landings creadas con todas las secciones de la base

- La plantilla es ahora la versión completa de la base: sello del registro sanitario, encuesta a clientas, médico asesor, opiniones de profesionales con filtros, comparación de costo y reseñas.
- Las fotos de los círculos (opiniones y testimonios) son personas como tu cliente ideal, hechas con ChatGPT; las de los profesionales, retratos con bata según el tema del producto. Los nombres y opiniones de profesionales quedan para que pongas los reales (no se inventan), y la encuesta sale con «XX %» para tus cifras.
- Nuevo campo «Registro sanitario» al crear: con el número sale el sello; sin él, no.
- Ninguna imagen se corta: todas se ven completas.

## 2026-11-25i · Landings creadas: galería sin espacios y de borde a borde en celular

- Las imágenes de la galería ya no salen con franjas blancas arriba y abajo: cada imagen se ve completa con su propia altura.
- En celular la landing ocupa todo el ancho de la pantalla: la imagen principal y los creativos van de borde a borde (los textos y las miniaturas conservan su margen). En computador sigue la columna centrada.
- Para las landings ya creadas: créalas otra vez.

## 2026-11-25h · Landings creadas: imágenes como las de la base y tus precios

- **Mateo y Simón miran las imágenes de la plantilla** antes de trabajar: la imagen principal ya no sale como una foto suelta, sino como el creativo de la base (titular grande, beneficios con íconos, sellos, el producto), con la misma proporción y sin franjas blancas. ChatGPT recibe la imagen de la plantilla solo como guía de cómo acomodar todo, nunca su marca.
- **Tus precios al crear:** 1, 2 y 3 unidades y el precio normal (opcional). Con el precio normal se calculan el tachado y el «Ahorras». Sin precios, los combos dicen «Precio por definir» y no quedan los precios tachados de la plantilla.

## 2026-11-25g · Landings creadas con la identidad de tu producto

- Las landings que crea el equipo ya no se ven como la plantilla: **Antonia** (diseñadora visual) mira el empaque de tu producto y su kit de marca y elige los colores y las tipografías; la página entera se pinta con eso (botones, precios, fondos, títulos).
- **Mateo** (director de imágenes) hace todas las imágenes con esa misma identidad.
- No queda nada de la plantilla: si una imagen no sale, la galería usa la foto de tu producto y las demás se quitan; los textos que todavía nombraban la marca de la plantilla se cambian.
- Las landings ya creadas no cambian: créala otra vez.

## 2026-11-25f · Crear landings desde cero con un equipo de agentes

- En Landings ahora eliges **Clonar una landing** (tal cual, como antes) o **Crear con el equipo**: eliges tu producto y la landing nace de la plantilla (la de Be Well CEN: galería, oferta por combos con pago contra entrega, creativos, reseñas y preguntas).
- La arma un equipo, cada uno con su trabajo: **Emilio** decide la estrategia con tu investigación de mercado, **Simón** entiende qué hace cada sección, cada título y cada imagen de la plantilla, **Valeria** escribe los textos, **Antonia** diseña las imágenes (ChatGPT, con la foto de tu producto) y **Renata** revisa que nada esté inventado.
- En la landing ves «Cómo la armó el equipo»: qué decidió cada uno y por qué, y lo que te toca completar (por ejemplo, reseñas reales).

## 2026-11-25e · Kads Studio abre sin la ventana de Terminal

- En los Mac donde se instaló con el comando, «Kads Studio» abría siempre una ventana de Terminal. Ahora abre como una app normal: arranca por detrás y abre el navegador. Para cerrarla: Cmd+Q, o clic derecho en su ícono del Dock › Salir.
- Para dejarla así en un Mac que ya la tenía: actualiza (Ajustes › Actualizar), cierra la ventana de Terminal de Kads y ábrela otra vez una vez; o pega de nuevo el comando de instalación.

## 2026-11-25d · Kads con dirección de Vercel

- Kads puede tener su propia dirección de Vercel (gratis): Vercel es solo la puerta y reenvía todo a tu servidor gratis de Oracle, que hace el trabajo; las cuentas siguen en el Supabase propio de Kads. Los pasos están en `DESPLEGAR-GRATIS.md` (paso 7).

## 2026-11-25c · La flecha del menú vuelve a funcionar

- Con el menú plegado, la flecha para abrirlo se ve otra vez (el botón «+» la tapaba).
- En ventanas angostas la flecha ahora abre el menú encima de la pantalla; se cierra solo al cambiar de pantalla.

## 2026-11-25b · Kads con su propio Supabase

- Kads ya no usa nada del Centro de Control: las cuentas van en un proyecto de Supabase **solo de Kads** (gratis). La guía `DESPLEGAR-GRATIS.md` explica cómo crearlo; cada persona crea su cuenta de Kads en la página de entrada.

## 2026-11-25a · Kads en internet gratis y con cuentas

- En un servidor, la app ahora pide **correo y clave**: las mismas cuentas del Centro de Control (mismo Supabase). El primero que entra queda **dueño**; los demás esperan a que los apruebes en **Tu cuenta › Usuarios** (socio, empleado o rechazado).
- Socios y empleados usan la app; solo el dueño cambia ajustes, claves, la IA conectada, el guardado y las tiendas conectadas.
- Guía nueva **DESPLEGAR-GRATIS.md**: la app en el servidor gratis de Oracle Cloud, paso a paso.
- En tu Mac no cambia nada: ahí no pide ingreso.

## 2026-11-24s · Borrar carpetas y generaciones

- Puedes borrar una generación desde su tarjeta o borrar una carpeta con las generaciones de esa sección. Disponible en imágenes, videos, Embudo, Landings, Sketch y Cambiar producto.
- La confirmación muestra el nombre y la lista exacta de generaciones. Solo se quitan las que confirmaste; los proyectos nuevos o de otras secciones se conservan.
- Los archivos pasan a una papelera local. El producto, la investigación, los avatares de la biblioteca y las páginas ya publicadas en tiendas se conservan.
- Si hay un trabajo activo o en cola, el borrado se bloquea antes de mover los proyectos. Si algún archivo no puede moverse, se informa cuáles siguen pendientes.

## 2026-11-24q · Secciones independientes y análisis visual de landings

- En Embudo puedes elegir títulos, editar mensajes y generar otras secciones mientras una está trabajando. Marca varias para generación conjunta; cada operación conserva su texto confirmado y muestra su progreso. Dos imágenes se procesan a la vez y las demás quedan en cola.
- Fondos con un acabado editorial más cuidado, profundidad suave y gráficos ligados al mensaje. Hero sigue en 9:16 y las otras secciones en 4:5, con color base y bordes compartidos.
- Los análisis nuevos de landings muestran tarjetas por sección: captura real ampliable, título, objetivo, análisis y mejora sugerida. «Analizar otra vez» actualiza un análisis anterior.
- Recibes avisos dentro de la app cuando una landing está lista y cuando su publicación en la tienda está confirmada. Quedan pendientes hasta que los abras o cierres; una vista previa no se anuncia como publicada.
- Las actualizaciones se presentan en una sola ventana central de tamaño medio, con el resumen de cambios. Desde ella puedes actualizar, posponer, activar el reinicio o recargar la pantalla nueva.

## 2026-11-24p · Fondos acordes al producto y visuales con intención

- Embudo usa una paleta cromática suave derivada del color de la investigación o de la categoría del producto. Fondo limpio con material gráfico discreto, sin blanco predeterminado ni saturación. Puedes elegir un color base personalizado o volver a la paleta automática.
- Las cinco piezas comparten color base, lenguaje gráfico y bordes de unión. Cada encargo recibe el mapa de mensajes del embudo para dar continuidad al conjunto, manteniendo Hero 9:16 y el resto 4:5.
- Los títulos se presentan y generan en MAYÚSCULAS; los subtítulos, en minúsculas. Se conservan las palabras y los acentos del texto original de investigación.
- La imagen principal debe explicar el título y su propuesta de valor. Se evitan personas, frascos o anatomía decorativos que podrían acompañar cualquier mensaje.
- Los embudos anteriores adoptan la paleta automática cuando tenían el blanco por defecto; conservan colores personalizados. Para aplicar la nueva dirección a una imagen ya generada, regenera esa sección con confirmación de costo.

## 2026-11-24o · Carpetas en las secciones de generación

- Imágenes, anuncios de video y estilos, Embudo, Landings, Sketch y Cambiar producto abren primero tus carpetas por producto o proyecto. Dentro están sus generaciones guardadas y el botón para crear otra.
- Las generaciones con el mismo producto se agrupan automáticamente. Los proyectos antiguos sin producto asociado conservan una carpeta independiente, aunque tengan el mismo nombre que otro.
- Búsqueda de carpetas y generaciones, contador de proyectos, estado y fecha. Puedes recargar o compartir el enlace de una carpeta para continuar después.
- Al crear videos desde una carpeta se conservan el producto y el estilo elegido. Landings ahora abre solo el proyecto seleccionado, con su vista previa y acciones; después de crear una, entra directamente a ella.

## 2026-11-24n · Embudo continuo, generación paralela y mensajes propios

- Genera las cinco secciones desde un botón, procesando hasta dos imágenes a la vez. Cada sección muestra si está en cola, generándose, lista o pendiente de retomar; al regenerar, la imagen anterior se conserva.
- Hero en 9:16 (1080 × 1920) y las otras cuatro imágenes en 4:5 (1080 × 1350). Fondo liso común, composición limpia y bordes del mismo color para colocarlas al mismo ancho, sin separaciones. Nueva vista del embudo unido.
- El avatar se reserva para el Hero y sigue guardándose en Biblioteca. Las demás secciones representan su propio mensaje con producto, objetos, ilustración anatómica o demostración. Para azúcar o circulación, el enfoque visual puede usar vasos sanguíneos y partículas de glucosa en lugar de repetir una persona.
- Cada sección permite regenerar títulos y subtítulos desde la investigación, elegir entre sus propuestas o escribir un par manual. Pedir títulos no genera imágenes ni reemplaza tu elección. Los mensajes manuales se conservan al actualizar la investigación.
- Las instrucciones para corregir una imagen aparecen debajo de ella. Puedes generar de nuevo una sección o corregir su versión actual con presupuesto previo, sin rehacer las demás.

## 2026-11-24m · Embudo visual y avatares reutilizables

- Embudo ya tiene Hero, Punto de dolor, Beneficios, Ingredientes y Modo de uso. Los títulos y subtítulos se traen literalmente de la investigación del producto; cuando hay varias opciones, puedes elegir el par que quieras para cada sección.
- Las referencias se usan solo como guía interna de contenido. No aparecen en pantalla ni se adjuntan al generador. Cada diseño se adapta al producto, su empaque y público, con sus propios colores, composición, personas, tipografía e iconos.
- Genera las cinco secciones o una sola. Cada imagen tiene su campo de correcciones y descarga independiente. Las versiones anteriores se conservan. Antes de generar o corregir se muestra el alcance y costo para confirmar.
- Los personajes se crean como un retrato independiente y se guardan automáticamente en Biblioteca, para reutilizarlos en otros embudos y anuncios. Puedes elegir un avatar existente o trabajar sin personas. Un retrato nuevo se incluye en el presupuesto; reutilizarlo no crea ni cotiza otro.
- Se guardan las elecciones y se detecta si cambió la investigación, ficha, foto o avatar. Las generaciones interrumpidas recuperan lo ya terminado; no se repite automáticamente una solicitud de resultado incierto.
- Si la investigación no tiene un título y subtítulo para una sección, lo indica. No toma ingredientes, dosis, garantías ni promesas de otros productos para completarla. Las investigaciones nuevas incluyen copy específico para las cinco secciones.

## 2026-11-24l · Ciudad de día y de noche, logo nuevo y Shopify por negocios

- Nuevo logo vectorial de Kads: monograma con los colores del atardecer, también en los iconos del navegador y los instaladores.
- Ciudad creativa oscura sigue como apariencia predeterminada. El modo claro ahora conserva el mismo estilo ilustrado, con superficies lila claras, tinta ciruela y acentos rosa y turquesa. Automático usa estas dos variantes.
- Shopify abre tus carpetas de negocios. Crea «District Shop» y conecta dentro sus tiendas de Colombia, Ecuador, Guatemala, Costa Rica, Perú o cualquier otro país. Puedes renombrar carpetas y mover tiendas sin reconectarlas.
- Las tiendas existentes se organizan por su cuenta anterior, conservando sus conexiones. Las carpetas vacías también se guardan; solo se eliminan cuando ya no tienen tiendas.
- Los cambios de temas, copias entre tiendas y vistas previas pendientes se revisan desde **Landings → Cambios en tiendas**. El apartado Shopify queda dedicado a conexiones.

## 2026-11-24k · Landings que se ven y funcionan bien en tiendas reales

- Algunas tiendas (por ejemplo, con íconos que la tienda deja mal cerrados) se copiaban desarmadas: el menú y el carrito sueltos y una rueda de carga gigante que no se iba. Ahora la app lee la página como la lee el navegador y la copia queda igual a la original, con sus pestañas, selectores y preguntas frecuentes funcionando.
- Se quitan también las apps que bloquean por país y más píxeles.
- Las landings que ya tenías: clónalas otra vez.

## 2026-11-24j · Landings que funcionan igual que la original, y con prompt

- Las landings clonadas ahora **funcionan como la original**: desplegables, pestañas, selectores (como el de «elige tu dolor»), variantes y carruseles. La copia deja el JavaScript de la tienda y quita solo la analítica, los píxeles, los chats y los popups.
- En Landings basta con **pegar la URL** y, si quieres, escribir en **«Qué quieres»** lo que le cambias con tus palabras («adáptala a mi producto…», «cambia el precio», «pásala a inglés»). Vacío, la clona tal cual. Un toque en tu producto escribe el pedido por ti.
- Las landings que ya tenías: clónalas otra vez para que funcionen.

## 2026-11-24i · Landings sin popups que tapan

- Al clonar, la app quita los **popups de las apps de la tienda** (ruletas como «Try your luck», boletines, descuentos…) que se copiaban abiertos y no dejaban usar la página, y deja la página desplazarse normal. La vista en celular y «Abrir» se pueden usar. Las landings que ya tenías: clónalas otra vez.

## 2026-11-24h · La vista previa abre la página que cambió

- «Vista previa» ahora abre directo **la página que cambió**: la de un producto si cambiaste la página de producto, la colección, el carrito… (antes abría la portada con todos los productos).
- La vista previa de las **landings** se abre en una dirección que funciona en todas las tiendas (antes, en algunas se veía el catálogo en vez de la landing). Las landings que ya subiste: súbelas otra vez para tener el enlace nuevo.

## 2026-11-24g · Conectar tiendas de cuentas distintas

- «Con mi cuenta de Shopify» ahora **copia el enlace** (no abre el navegador): lo pegas en el **perfil de Chrome donde tienes la sesión de esa tienda**, entras y apruebas.
- Cada tienda guarda **su propia sesión**: puedes conectar tiendas de **cuentas distintas** sin que una cierre la otra.

## 2026-11-24f · Conectar tu tienda de Shopify con un botón

- En Shopify › «Conectar una tienda», la forma nueva es **«Con mi cuenta de Shopify»**: pones la dirección de la tienda, tocas el botón, se abre Shopify, entras y apruebas. Sin claves. Sirve para los temas (cambios con IA, landings y copiar temas o secciones). Para páginas y productos sigue «Acceso completo».

## 2026-11-24e · Landings: tus tiendas a la vista

- En Landings ahora ves **tus tiendas de Shopify** y el botón **«Conectar mis tiendas»**, que te lleva al menú Shopify, donde se conectan.

## 2026-11-24d · La coordinadora copia entre tiendas

- Ahora le puedes pedir por chat a la coordinadora que **copie de una tienda a otras**: «copia la sección de ofertas de la tienda de Colombia a la de México», «pasa este producto a todas mis tiendas», «el mismo tema en las otras». También que haga **el mismo cambio en varias tiendas**. Todo queda para revisar en el menú Shopify (tema sin publicar o producto en borrador).

## 2026-11-24c · Shopify: varias cuentas, tiendas por país y copiar entre tiendas

- Conecta tiendas de **varias cuentas** de Shopify. Cada tienda dice su **cuenta y su país** (con acceso completo el país se lee solo; si no, lo eliges). Arriba eliges la cuenta y el país, y ves solo esas tiendas.
- **El mismo pedido en varias tiendas a la vez** («También en…»), con Claude Code o con **ChatGPT (Codex)**.
- **Copiar de una tienda a otras** (a una o a todas): el **tema completo**, solo **las partes que elijas** (secciones, plantillas… y lo que necesitan para funcionar) o **un producto**. Todo queda primero para revisar: el tema como tema nuevo sin publicar (con su vista previa) y el producto en borrador (te avisa si la moneda es otra). Publicas en cada tienda cuando quieras.
- En Landings, **«Subir a Shopify» a varias tiendas** a la vez.

## 2026-11-24b · Landings: análisis y vista previa en tu tienda antes de publicar

- Al clonar una landing (tal cual o para tu producto), **tu IA la analiza**: de qué va, a quién le habla, el ángulo, el gancho, la oferta, sus secciones en orden, la prueba social, las objeciones que resuelve, lo que mejor hace, lo que le falta e ideas para tu producto. También puedes analizar las que ya tenías («Analizar»).
- **«Subir a Shopify» ahora escribe la landing en el código de tu tema** (con Shopify CLI, solo archivos nuevos) y **primero te da la vista previa en tu tienda**. Nadie la ve sin ese enlace. Si te gusta, en el menú Shopify tocas **«Publicar la página»** y recién ahí se crea la página.

## 2026-11-24a · TrendTrack vuelve a funcionar en la investigación

- La investigación de la competencia (y «Mejores anuncios») decía «No se pudo usar TrendTrack»: tu conector se llama «Trendtrack» y la app lo buscaba como «TrendTrack», así que cada consulta se negaba. Ahora lo encuentra se llame como se llame.

## 2026-11-23b · Ciudad creativa: tu estudio como un videojuego

- Inicio con una portada ilustrada original, ciudad de atardecer, personajes, viñetas y accesos a crear videos, imágenes e investigar.
- Rediseño del tema Juego en menús, tarjetas, títulos, botones, formularios, galerías, oficina y coordinadora: contornos de tinta, rosa, violeta y turquesa.
- El editor también conserva Juego; la vista previa del video sigue en negro neutro. Se mantienen Claro, Oscuro y Automático.
- Los datos y las funciones siguen siendo los de tu estudio. No cambian los anuncios ni la forma de generarlos.

## 2026-11-23a · La app con aspecto de videojuego y la oficina más compacta

- **Tema «Juego»** (el nuevo de siempre): noche de ciudad costera con neón rosa y atardecer, palmeras y edificios en el horizonte, títulos tipo videojuego, tarjetas de vidrio y botones con esquinas cortadas. Puedes volver al oscuro de antes o al claro en Ajustes › Apariencia (o con el botón de arriba).
- **La oficina virtual**, rediseñada: las áreas más juntas (menos espacio vacío), cada departamento cerrado con **vidrio** de piso a techo y su puerta, y con el tema Juego, neones rosa y una ciudad violeta de noche.

## 2026-11-21i · Cambiar solo el audio: de narrado a cantado, con las mismas escenas

- En **«Editar este anuncio»** hay una pestaña nueva: **«Solo el audio: cantado»**. Tu anuncio con narrador pasa a ser **cantado** sin tocar las escenas: las frases de tu guion se vuelven la letra, la canción sale en dos versiones para que elijas la que más te guste, y el video se acomoda solo a la canción (cada escena dura lo que su frase cantada).
- Puedes decir cómo quieres que suene («reguetón alegre como el video de referencia») y si la voz es femenina o masculina.
- Cuesta solo la canción (unos US$0,06): **ninguna imagen ni video se paga otra vez**. El anuncio original no se toca: el cantado sale como uno nuevo.
- Para otras cosas puntuales, la misma ventana te recuerda dónde están: una escena → «Regenerar» en la producción; textos, música o cortes → el Editor.
- La coordinadora también lo hace si se lo pides por chat («que sea cantado como el de referencia»).

## 2026-11-21h · Editar un anuncio cuando quieras, e imágenes que no se quedan sin hacer

- **«Editar este anuncio»**, mientras se está haciendo o ya terminado (en la producción y en la entrega): escribes lo que quieres cambiar con tus palabras («que ya no sea cantado, que sea narrado», «cambia el gancho», «que sea un hombre de 40») y la app hace una **versión nueva** con ese cambio y todo lo demás igual (mismas personas y escenas, sin pagarlas otra vez). Si era cantado y pides que sea narrado, va con voz en off en el mismo look; también puedes elegir otro estilo. El original no se borra, y si se estaba haciendo se detiene para no gastar en lo que vas a cambiar. Ves el guion nuevo y su costo antes de producir. La coordinadora también lo hace si se lo pides por chat.
- **Imágenes rechazadas por política**: si kie no quiere hacer una imagen por su contenido, ya no se queda sin hacer. Tu IA la describe de otra forma (la misma escena, sin lo que frena al filtro) y la vuelve a pedir sola, varias veces si hace falta. Vale para las escenas de los videos y para Anuncios de imagen (ahí cambia solo lo que se ve; los textos quedan iguales).
- Arreglado: «Recrear para otro producto» llevaba a «No encuentro esta pantalla».

## 2026-11-21g · «Terminar después»

- Cuando un video te necesita (se trabó, falta saldo, está en pausa, espera la canción o su guion está listo para aprobar) ahora tienes dos caminos: **«Continuar»** o **«Terminar después»**.
- Con **«Terminar después»** deja de avisarte: sale de «Te necesitan», del punto rojo de arriba, del menú y de la oficina, y queda en la sección nueva **«Para después»** de Mis anuncios.
- Ahí, cuando quieras, tocas **«Continuar»** y sigue desde donde quedó (lo hecho no se vuelve a pagar). La campanita lo devuelve a «Te necesitan».
- Si después de continuarlo se vuelve a frenar, te avisa otra vez como siempre.

## 2026-11-21f · Escenas cuidadas al detalle y carpetas de producto

- **Las imágenes de las escenas se revisan antes de hacer los videos.** La IA compara cada una con la foto real de tu producto (la marca y la etiqueta, letra por letra), con la persona y el lugar de las otras escenas (misma cara, ropa, set, luz y hora) y mira los detalles (ojos, piel, manos, el producto bien agarrado). Si una está mal, la app la **rehace sola, una vez**, antes de gastar en su video. El costo que ves antes de producir ya incluye ese margen, y solo se cobra lo que de verdad se rehace.
- Los guiones se escriben con más detalle desde el principio: la descripción exacta del envase en cada escena donde sale, la misma descripción de cada persona y cada lugar en todas las escenas, y el tono de cada línea y de cada voz.
- **Carpetas de producto** (menú Tu contenido › **Carpetas**): crea, por ejemplo, «Aguaje». En Anuncios de imagen cada imagen tiene **«Guardar en carpeta»**, y la entrega de cada video también. Cada carpeta tiene **Imágenes** y **Videos**, puedes subir tus propios archivos (arrastrándolos) y **descargar la carpeta entera** en un zip con sus dos carpetas.

## 2026-11-21e · Nuevo anuncio: un paso por página

- Crear un video ya no es una sola página larga: ahora son **4 pasos, cada uno en su página**: **1 Tu producto · 2 Estilo · 3 Ajustes · 4 Guion**. La producción sigue en su propia pantalla.
- Abajo siempre tienes **«Atrás» y «Siguiente»**, y arriba la barra de pasos para saltar al que quieras.
- Al tocar «Escribir el guion» pasa sola a la página del guion, donde lo lees, pides cambios y das «Me gusta, producir».
- En el celular, la barra muestra los números y el nombre del paso en el que estás.

## 2026-11-21d · Variaciones en el chat de la coordinadora, con semáforo 🟢/🔴

- Pásale a la coordinadora tu **anuncio ganador** y pídele variaciones («hazme 6 variaciones de este, con otra modelo y en la playa»): ella misma escribe cada una (el titular y qué cambia) y **salen de una, ahí en el chat**, sin el proceso largo de la sección de imágenes (igual quedan guardadas en Anuncios de imagen).
- Los **titulares juegan con el de tu ganador** sin perder su esencia: si dice «Obtén unos glúteos, piernas y caderas con más volumen en 7 días», las variaciones juegan con eso, nada genérico. Si hay antes y después, **se nota de una**.
- Cada imagen tiene su **semáforo**: 👍 verde = está bien (ella tiene en cuenta cómo puso el titular, la modelo, la estructura y los detalles, sin copiarla) y 👎 rojo = no la quiero otra vez (puedes decir por qué). Lo tiene en cuenta en las próximas variaciones.

## 2026-11-21c · Clonar tal cual: las personas hablan ellas mismas, sin narrador

- Al clonar un video donde **hablan personas en cámara** (una entrevista, un programa, un reality, varias personas conversando), el anuncio nuevo ahora es **el mismo video tal cual**: cada persona dice sus líneas con su propia voz (lo de la presentadora lo dice la presentadora, lo de cada participante lo dice él), en las mismas escenas y con las mismas acciones (si explotan los globos, los explotan).
- **Nada de voz en off ni de escenas inventadas (B-roll)** cuando en tu video la gente habla. La voz en off queda solo para videos donde nadie habla en cámara.
- Si pides otra duración, se condensa: las mismas escenas, en el mismo orden, cada una más corta.
- En «Agregar», la opción ahora dice «Las personas hablan en cámara» (una o varias).

## 2026-11-21b · La coordinadora clona tu video tal cual

- Si le pasas un video a la coordinadora y le dices «replícalo tal cual», «clónalo» o «igual a este» sin nombrar un estilo, ahora lo hace **igual a tu video**: la misma estructura y el mismo look (si es una persona real hablando, una persona real; si es animado, animado igual), con las mismas tomas, el mismo ritmo, los mismos textos y el mismo gancho, pero con tu producto. Ya no lo pasa a uno de los estilos de la app.
- Si le nombras un estilo («en Zack», «en Pixar»), lo hace en ese estilo con la estructura de tu video, como antes.

## 2026-11-21a · Anuncios nuevos «Desde 0» con 6 zonas, y la coordinadora lo coordina todo

- En **Crear anuncios de imagen › Desde la investigación** hay un modo nuevo, **«Desde 0 (6 zonas)»** (viene elegido; «Variaciones del agente» sigue a un toque). Cada anuncio lleva:
  1. **Gancho** arriba, en mayúsculas y de máximo 8 palabras.
  2. **Visual principal**, de la mitad de la imagen.
  3. **2 o 3 beneficios** con check.
  4. **Tu frasco**, fiel a la etiqueta, con su sello (por ejemplo «3 EN 1 · TRIPLE ACCIÓN»).
  5. **La oferta**: «TRATAMIENTO COMPLETO X3 $precio» + «Pagas al recibir».
  6. **Un solo botón**: «Pide el tuyo», «Lo quiero»…
- **Titulares** afirmativos con la fórmula beneficio + tiempo + deseo, y máximo una pregunta por lote.
- **Formatos distintos** en el lote: hero, antes y después, nosotros vs. ellos, testimonio de celular, pregunta y respuesta, bodegón de ingredientes, recomendado y temporada. Nunca más de 3 iguales y nunca se repite la modelo ni el escenario.
- **Reglas para todos los anuncios** (también en «Replicar validado»): español colombiano sencillo y poco texto; promesas suaves («ayuda a», «de forma natural»), sin promesas médicas, cifras inventadas ni garantías; la marca y la etiqueta exactas, revisadas letra por letra, y ningún texto pegado al borde. La revisión de la IA rechaza lo que no cumpla.
- **La coordinadora** ya maneja todo: le pides imágenes con tu anuncio (las replica exacto) o sin él (las hace desde 0), clona landings y las sube a tu Shopify, además de lo que ya hacía con videos, investigaciones y tu tienda.

## 2026-11-21 · Replicar validado: tu anuncio exacto, con otra modelo

- En **Crear anuncios de imagen › Con referencia** hay un modo nuevo, **«Replicar validado (exacto)»** (viene elegido; «Variaciones del agente» sigue a un toque).
- Antes de generar, tu IA lee el **mapa** de tu anuncio: dónde va el titular, la modelo o el antes y después (y cuánto ocupa), el frasco, los checks, la oferta y el botón; qué se lee primero, segundo y tercero; las letras, los colores y el fondo de cada bloque; y el ángulo (el deseo, el beneficio y el dolor).
- Cada imagen conserva todo eso **exacto**. Solo cambian: **la modelo** (otra mujer en cada una: edad, contextura y tono de piel distintos, creíble), **el escenario** (cuarto, espejo, calle, gym en casa, probador, piscina…), **la pose y el encuadre**, y **la redacción del titular** (la misma promesa con otras palabras, del mismo largo para que quepa).
- Nunca se repite la modelo ni el escenario en el mismo lote, y no se mueven bloques, no se cambian letras ni colores, no se cambia el ángulo ni se inventan promesas.

## 2026-11-20v · Arreglo: «Actualizar» decía que lo nuevo chocaba

- En la versión anterior se coló, por error, un chat de prueba de la coordinadora. En tu computador ya tienes tu propio chat, así que al actualizar los dos chocaban y la app no bajaba nada (tu chat no se tocó).
- Se quitó el de prueba: «Actualizar» vuelve a funcionar y tu chat con la coordinadora queda como estaba.

## 2026-11-20u · Pegar en el chat de la coordinadora

- Ya puedes **pegar** (Ctrl+V o Cmd+V) en el chat de la coordinadora: imágenes, capturas de pantalla, archivos y textos.
- Un **texto largo** (un prompt, un documento, una tabla) le llega **entero** como documento adjunto; antes se cortaba.
- Funciona en la oficina, en la burbuja flotante y en Telegram (ahí un texto largo también le llega completo).

## 2026-11-20t · Los anuncios ganadores del catálogo, como guía en todo

- El catálogo de anuncios de imagen validados (las plantillas ganadoras) ahora también guía, por dentro, las imágenes «Nuevos» que salen de tu investigación, las del agente de variaciones y las que le pides a la coordinadora.
- Toma las de productos como el tuyo y de tipos distintos; la IA aprende cómo comunican el ángulo y la fórmula de su titular, sin copiarlas. Lo que ya te funciona sigue pesando más.
- No se muestran: son una referencia interna.

## 2026-11-20s · ChatGPT Business ya funciona

- Si tienes ChatGPT **Business** (o Team, Enterprise, Edu), la app ya no te dice que «no te queda uso»: en esos planes Codex usa los créditos del espacio de trabajo y la app ahora los tiene en cuenta.
- Si acabas de pagar un plan o cambiaste de espacio de trabajo, la app le pide a ChatGPT el plan al día ella sola (antes seguía viendo el plan viejo por días).
- En **Ajustes › Conexiones** ves con qué plan y en qué espacio de trabajo está tu sesión. Si no sale tu espacio, cierra sesión ahí y vuelve a entrar eligiéndolo en la página de ChatGPT.
- Si el espacio se queda sin créditos, te lo dice claro (lo arregla el dueño del espacio en chatgpt.com).

## 2026-11-20r · Tus tiendas de Shopify conectadas (las que quieras)

- Menú nuevo **Shopify**: conectas una o varias tiendas y eliges en cuál trabajar. Se conectan con el **Client ID y el secreto** de una app del Dev Dashboard de Shopify (la forma nueva; la app renueva el permiso sola cada día), con un token `shpat_` de una app vieja o con la contraseña de **Theme Access** (solo temas). Las claves quedan solo en tu computador y nunca se muestran.
- **Pídele a la IA**: escribes lo que quieres cambiar («el botón en verde y que diga Pídelo ya», «agrega preguntas frecuentes al producto»…) y eliges quién lo hace (**Claude Code** o **Codex**). Edita el código del tema en una copia y lo sube como **tema nuevo sin publicar**: lo ves en la vista previa y lo publicas con un botón (o lo descartas). Tu tienda no cambia hasta que tú digas.
- Con acceso completo también puede proponer cambios en páginas, productos, colecciones…: cada uno espera tu «Aplicar».
- **Subir una landing a Shopify** (botón en cada landing): queda como página de tu tienda, con sus imágenes, y los botones de comprar van a tu producto.
- La **coordinadora** también puede: «en mi tienda X cambia…».

## 2026-11-20q · Landings: clona cualquier landing y déjala volando

- **Crear › Landings** ya funciona: pegas la dirección de una landing y la app la clona.
- **Tal cual**: la copia la hace la app (sin IA, así nada se niega a copiar): mismos textos, imágenes, colores, estructura y carruseles. Los botones siguen llevando a la tienda original.
- **Para mi producto**: misma estructura y diseño, pero eliges quién escribe los textos (**Claude Code** o **Codex**), con la ficha y la investigación de tu producto, y **ChatGPT** hace las imágenes donde se ve el producto, con tu foto.
- **Optimizada al máximo**: imágenes en WebP y en su tamaño, sin el JavaScript de la tienda ni de las apps, solo el CSS que se usa, GIF pesados convertidos a video, la imagen principal primero. Con la landing de ejemplo: **68 → 97** de velocidad en celular (Lighthouse, lo mismo que PageSpeed).
- Te muestra la velocidad de la original y de la copia, la ves en un celular de muestra, la abres o la descargas en zip.

## 2026-11-20p · Tu coordinadora por Telegram y la autoevaluación con nota

- **Telegram**: crea tu bot gratis con @BotFather, pega su token en **Ajustes › Telegram**, prende el interruptor y mándale a tu bot el código que te muestra la app (`/start CÓDIGO`). Desde ahí:
  - lo que le escribes le llega a tu coordinadora (el mismo chat de la oficina) y ella te contesta ahí;
  - le puedes mandar **audios** (los pasa a texto), **fotos**, **documentos** o **videos** (como si los adjuntaras en la app);
  - todo lo que ella te escribe te llega a Telegram, y lo que espera tu aprobación trae el botón **«✅ Dale · US$…»**.
  - Es privado: solo responde a tu chat. Funciona con la app abierta en tu computador (no necesita servidor).
- **Autoevaluación con nota**: lo que escribe tu coordinadora (variaciones, copies, revisiones) se califica de 0 a 10 en interés, claridad, credibilidad, valor, conversación y narrativa; si no llega a 8,5, lo reescribe antes de entregártelo. La nota se ve en la entrega. Los guiones también pasan por esa autoevaluación antes de quedar listos para tu aprobación.

## 2026-11-20o · La oficina como la de los videos: personajes de verdad, ciudad y «Presentar»

- **Personajes humanos de verdad**: los agentes ahora son personajes 3D con esqueleto (de traje, casuales, de trabajo; mujeres y hombres, con distintos tonos de piel), sentados en su silla. Mueven brazos y cabeza según lo que hacen: teclean, usan el mouse, revisan con la mano en la barbilla, se agarran la cabeza si algo se frena; y cuando están libres miran el celular, toman café, se estiran, conversan o se echan atrás con las manos en la nuca.
- **Un piso alto en la ciudad**: alrededor de la oficina hay edificios; de noche se encienden sus ventanas. Persianas en los ventanales y lámparas colgantes sobre los escritorios.
- **Botón «Presentar»** (abajo, junto a General, Arriba y Cine): un recorrido de cine por tu oficina para grabar un video. Vista aérea, tu coordinadora, cada departamento con sus agentes y un primer plano de uno de ellos (gira la silla, mira a la cámara y saluda), con tarjetas de nombre como en televisión («Julián · Planificador de producción · AGENTE DE IA · …») y el cierre «Nada se gasta sin tu aprobación». Mientras presenta se esconden los paneles. «Salir» o cualquier otra vista lo termina.
- Los archivos que le pasas a la coordinadora y lo que S.E.P trae de Meta quedan solo en tu computador (no se suben a GitHub).

## 2026-11-20n · Arreglo interno de las pruebas

- Las pruebas automáticas de la app ya no dejan anotados en el chat de la coordinadora los anuncios de prueba que crean. No cambia nada de lo que ves.

## 2026-11-20m · «Hazme un musical igual a este video» ya funciona

- Antes, si le pasabas un video a la coordinadora y pedías un **Musical** (o una Historia musical) igual, el guion se trababa: los estilos cantados no podían clonar un video y nadie escuchaba tu video, así que no había letra que copiar.
- Ahora la app **saca la letra de tu video** (la transcribe con tu ElevenLabs, centavos, una sola vez por video) y el guionista la usa: la **opción 1 de la letra es la del original palabra por palabra, con su estructura y sus rimas, cambiando solo el producto**. Las otras opciones cambian lo mínimo.
- Lo mismo en los demás estilos: además de analizar tu video toma por toma, el guionista recibe lo que se dice en él para copiarlo si se lo pides.
- Ojo: los estilos cantados se hacen animados (crochet, plastilina o 3D), no en video real. Si tu original es video real, la coordinadora te lo dice.
- El guion que se trabó antes no tiene la letra: pídeselo de nuevo a la coordinadora con el video.

## 2026-11-20l · S.E.P: elige ver el BM completo, una cuenta publicitaria o una campaña

- Arriba en S.E.P ahora eliges **qué ver**:
  - **BM completo**: todas las cuentas publicitarias de tu Business Manager juntas, con los anuncios que más venden de todas. Cada tarjeta dice de qué cuenta es.
  - **Cuenta publicitaria**: una sola cuenta (como antes).
  - **Campaña**: una campaña de esa cuenta. Se elige de una lista ordenada por compras.
- Si tienes varios BM, eliges cuál. Las cuentas que no están en ningún BM salen juntas como «Sin Business Manager».
- Si un BM tiene cuentas en monedas distintas (por ejemplo COP y USD), las compras se suman pero el dinero no, y te lo avisa. Cada tarjeta muestra el dinero en la moneda de su cuenta.
- La app recuerda lo último que elegiste.

## 2026-11-20k · S.E.P: tus anuncios de Meta que más venden y qué hacer con cada uno

- **S.E.P ya funciona** (dejó de ser «Pronto»). Conecta tu cuenta publicitaria de Meta y trae, del rango que elijas (7, 14, 30 o 90 días), tus anuncios ordenados por **compras**, con su gasto, ingresos, ROAS, CPA, CTR, CPM, frecuencia e impresiones.
- Arriba, las cifras del rango y dos gráficas: **compras por día** e **ingresos y gasto por día** (al pasar el mouse ves el día con su ROAS).
- Cada anuncio es una **tarjeta** con su imagen, sus métricas, sus compras día por día y lo que **sugiere el sistema S.E.P**:
  - **Escalar**: vende sobre tu objetivo, sostenido y sin fatiga → subir presupuesto de a poco y duplicarlo a públicos amplios.
  - **Hacer variaciones**: rinde pero se está cansando (frecuencia alta o el CTR cae) → con el botón «Hacer variaciones» su imagen va directo al agente de anuncios de imagen.
  - **Sostener**, **Probando** (pocos datos) o **Pausar** (gasta sin vender).
  - Con «Ver por qué y qué hacer» ves las razones con tus números y los pasos.
- Pones tu **ROAS objetivo** y, si quieres, tu **CPA máximo**: las sugerencias se ajustan al instante. Filtros por sugerencia y vista de **tabla**.
- **Solo lee** tu cuenta: nunca cambia nada en Meta. Se conecta en **Ajustes › Conexiones › Meta (tu cuenta publicitaria)** con un token con el permiso `ads_read` (los pasos están ahí). Si tu token de la Biblioteca ya tiene ese permiso, no hace falta otro.

## 2026-11-20j · La coordinadora te avisa en cualquier pantalla y tu «está bien» aprueba de verdad

- **Burbuja flotante** con la cara de tu coordinadora, abajo a la derecha, en todas las pantallas (menos en la oficina, donde ya está su chat). Lleva un número con sus mensajes sin leer y lo que espera tu aprobación.
- Cuando te escribe sola (un guion listo con su costo, algo que terminó o se frenó) sale una **tarjeta con lo que dice**. Si es una aprobación, tiene **«Dale · US$…»** ahí mismo y «Ver primero». Tocando la burbuja se abre su chat sin salir de donde estás.
- **Tu «sí» en el chat aprueba de verdad**: «dale», «está bien», «apruébalo» o «me gusta» aprueban el guion, se lo pasa al equipo y arranca la producción (siempre después de mostrarte el costo). Si hay varias cosas esperando, te pregunta cuál.
- Ahora sigue también los guiones nuevos que hiciste fuera del chat (en Nuevo anuncio, la oficina o desde Claude): cuando quedan listos te escribe con el costo y te pregunta si los produce.

## 2026-11-20i · Lo que hacen tus agentes, también en Progreso

- En **Progreso** hay una sección nueva, **«Tu equipo trabajando ahora»**: lo que tienen entre manos los agentes de la oficina en todos los departamentos (anuncios de imagen, investigaciones de mercado y de la competencia, los guiones que se están escribiendo).
- Cada trabajo muestra el departamento, quién lo tiene y en qué paso va, su cadena de pasos (hechos, el que avanza y los que faltan, por ejemplo «3/6»), si se frenó y por qué. Tocándolo lo abres.
- Los videos que ya se están produciendo siguen en «En producción» y los guiones por aprobar en «Te necesitan»: no se repiten.

## 2026-11-20h · La coordinadora clona tus videos y le puedes dictar por voz

- **Le pasas un video y le dices «hazme uno igual en Zack, que dure 1:50»**: ella lo encarga sola. La app analiza tu video toma por toma (la estructura, los tiempos, lo que se dice) y el guionista lo replica en el estilo y la duración que pediste, con el gancho adaptado a tu producto (o el mismo, si se lo pides). Ya no te manda a «Clonar un video».
- Si al estilo le falta algo obligatorio (por ejemplo, el fondo de Zack), te propone la opción más común en una sola pregunta, o la elige ella si le dices «decide tú».
- **Dictar por voz**: toca el micrófono del chat, habla y toca el cuadrado al terminar. El texto queda en la caja para revisarlo antes de enviar. En Chrome y Safari usa el dictado del navegador; si no lo trae, graba y lo pasa a texto con tu ElevenLabs (centavos).
- Los videos que le pasas pueden pesar hasta 400 MB.

## 2026-11-20g · El chat de la coordinadora se lee en el modo claro

- Con la app en modo claro, los mensajes de la coordinadora salían en blanco sobre blanco y no se leían. Ahora el chat (y los demás paneles de la oficina) usa sus propios colores oscuros, con letra clara, en los dos modos.
- En «En vivo» de la oficina, cuando un lote de anuncios de imagen se frena, ahora se ve **por qué** (el mensaje del error), sin tener que abrirlo.

## 2026-11-20f · Conector para Claude, las dos partes de la investigación y un índice más claro

- **Conector para Claude**: con la app en un servidor, la agregas a Claude (claude.ai o la app del celular) y desde ese chat le pides: tus productos, **analizar tu investigación de mercado (las dos partes)**, lanzar una investigación, crear anuncios de video e imagen, ver su costo y producirlos con tu sí, y cómo va la oficina. Se prende en **Ajustes › Conector para Claude**; la guía paso a paso está en `CONECTOR-CLAUDE.md`. Todo lo de antes sigue igual: es una puerta más.
- **La investigación muestra sus dos partes**: arriba eliges **1 · Investigación de mercado** o **2 · Competencia (TrendTrack)**, y la primera la puedes ver **en la app** o **como el PDF** de siempre (antes el PDF solo salía al descargarlo).
- **El índice de secciones se ve mejor**: flechas para pasar de una en una, «3/15», la sección elegida siempre completa y a la vista, nombres largos recortados con elegancia (el nombre entero al pasar el mouse) y, en el celular, solo los números con el nombre de la que estás leyendo.
- **La coordinadora** ahora lanza la investigación con sus dos partes a la vez (antes solo la de mercado) y puede leer y analizar tus investigaciones cuando se lo pides.

## 2026-11-20e · La coordinadora trabaja como una asistente y la oficina se mueve

- **La coordinadora, como una persona**: le puedes pasar archivos (el clip, pegar o arrastrar: imágenes, PDF, Word o texto) y los lee. Habla más natural y corto, y te pregunta lo que le falta.
- **Ella se encarga de principio a fin**: le pides un video, su equipo escribe el guion y, cuando está listo, **te escribe sola con el costo y te pregunta «¿le doy?»**. Con tu sí (escríbele «dale» o toca «Dale») lo produce, y cuando termina te deja el enlace. Si algo se frena o necesita que elijas algo, también te avisa.
- **Anuncios de imagen por el chat**: «hazme 10 imágenes con esta referencia» (adjuntas tu anuncio) o desde la investigación; te dice el costo y espera tu sí.
- **Lo que puede escribir, lo escribe ella**: «dame 10 variaciones de este texto», una revisión, títulos o ganchos llegan como una entrega que copias o descargas.
- **La oficina ya no se ve quieta**: quien trabaja se inclina a la pantalla, teclea, gira la silla y le salen tarjetitas de luz de la pantalla; quien revisa se pone la mano en la barbilla; quien espera tamborilea. Los libres miran el celular, toman café, se estiran o charlan con el de al lado. Por las líneas de producción corren puntos cuando un trabajo pasa por ahí, hay polvo en la luz y un robot aspiradora dando vueltas.
- **El día y la noche de la oficina son los de la app**: tema claro = día, oscuro = noche (el botón de la oficina cambia el tema de toda la app).

## 2026-11-20d · Anuncios de imagen: todo lo hace el agente

- «Crear anuncios de imagen» ahora tiene **solo dos modos, los dos con el agente** (sin plantillas):
  - **Con referencia**: subes, pegas o arrastras tu anuncio que funciona (o lo eliges de «Lo que me funciona») y el agente hace variaciones cercanas, conceptos vecinos y expandidos, conservando lo que lo hace vender.
  - **Desde la investigación**: sin referencia. El ángulo, las facetas, las objeciones y las palabras del cliente salen de la investigación de mercado de tu producto. Si el producto todavía no la tiene, la puedes lanzar desde ahí mismo.
- En los dos, el agente analiza, arma la matriz de facetas, escribe los prompts con diseño limpio, genera una imagen por anuncio, la revisa (pruebas de 1, 3 y 5 segundos y los 10 puntos) y corrige. Ves el costo antes, y en el lote, el análisis y qué cambió y qué hipótesis prueba cada anuncio.
- Lo mismo desde la oficina («Encargar» en Anuncios de imagen), desde la investigación («Crear anuncios» abre el modo desde la investigación) y desde «Lo que me funciona» («Hacer variantes» abre el modo con referencia con ese anuncio ya elegido).

## 2026-11-20c · El índice de la investigación ya no tapa la pantalla

- En la investigación de mercado (y en la de la competencia), el índice de secciones que queda pegado arriba ahora es **una sola fila delgada** que se desliza de lado, con la sección en la que estás siempre centrada. Antes era una grilla de tres filas que ocupaba media pantalla.
- En el celular, la investigación ya no se sale de la pantalla (el botón «Investigar otra marca», las tarjetas de anuncios y la escala se acomodan).

## 2026-11-20b · Agente de variaciones creativas y encargar desde la oficina

- **Agente de variaciones para Meta Ads** (con tu prompt maestro): analiza tu anuncio ganador (deseo, problema, promesa, mecanismo, lo que NO se toca, lo que se puede cambiar y lo que se puede probar), arma la matriz de facetas del comprador y crea variaciones en tres niveles: **A cercanas**, **B conceptos vecinos** y **C expandidas** (cambiando al menos dos variables sin abandonar el deseo). Diseño limpio de alta conversión, una imagen por variación, nada inventado, y una revisión con las pruebas de 1, 3 y 5 segundos y tus 10 puntos de control: lo que no pasa, se corrige.
- En el lote ves **el análisis del ganador** y, por cada variación, su nivel, **qué cambió y qué hipótesis prueba**.
- **Encargar desde la oficina**: toca un departamento y «Encargar». En Anuncios de imagen, «Encargar variaciones de un ganador»: subes o pegas el ganador (o lo eliges de «Lo que me funciona»), eliges el producto, cuántas y el formato, ves el costo y listo: lo ves avanzar por la cadena. En Investigación, el producto y el país. En Video, se lo pides a la coordinadora o vas a «Nuevo anuncio».
- **Investigación de mercado más fácil de leer**, sobre todo en modo oscuro: fondo carbón suave, textos más claros, colores de acento más suaves, tablas más legibles, letra de pantalla un poco más grande y líneas de largo cómodo.

## 2026-11-20a · La oficina es tu empresa: departamentos, cadenas de producción y efectos

- **La oficina de tu imagen de referencia**: planta clara y cálida vista desde arriba, seis departamentos alrededor del logo K (sobre su base redonda de madera con jardineras), la coordinación de vidrio arriba, la sala de estar con café abajo, divisiones bajas grafito con listones de madera y luz verde lima, plantas y estanterías.
- **Cada departamento es una cadena de producción** con sus agentes sentados en fila, cada uno con su escritorio, su computador y su parte del trabajo:
  - **Anuncios de video**: guion → plan de producción → storyboard e imágenes → producción → edición → revisión.
  - **Anuncios de imagen**: investigación → estrategia creativa → prompts → generación → control de calidad → entrega.
  - **Investigación de mercado**: recopilación → competencia → público → oportunidades → síntesis.
  - **Landing pages, Embudos de WhatsApp y Análisis**: su equipo ya está sentado, pero quietos y marcados «en construcción» hasta que la app tenga sus herramientas (no se inventa actividad).
- **Las líneas de producción responden a lo que pasa de verdad** en la app: verde cuando una parte pasa al siguiente agente (una luz viaja por un arco), naranja cuando la revisión devuelve algo para corregir, roja cuando algo se frena. Si no pasa nada, quedan grises.
- **Efectos de producción**: onda y chispas al recibir trabajo, el monitor que se enciende, destello rojo si algo falla y, al terminar, confeti, una onda grande, el logo K que gira y brilla y el aviso «¡Terminado!» arriba.
- **Íconos circulares** sobre cada agente (lupa, documento, imagen, check, código…) que cambian con lo que le pasa: revisando, corrigiendo, error, esperando. Su anillo en el piso se enciende con su estado.
- **Supervisión**: toca un departamento y ves su flujo, lo que está en marcha, lo que se frenó y lo terminado; toca un trabajo y la oficina resalta su recorrido; toca una línea y ves qué pasa por ahí; toca un agente y ves su estación, de quién recibe y a quién entrega.
- Los agentes ahora trabajan **sentados**: escriben, usan el mouse, piensan, revisan, levantan los brazos al terminar o se agarran la cabeza si algo se frena.

## 2026-11-20 · La oficina cobra vida: pantalla completa, conversaciones y recorrido guiado

- **Pantalla completa, diseño profesional**: la oficina ocupa todo el espacio y los controles flotan encima en paneles de vidrio. Arriba: tu oficina, cómo va todo y las acciones. A la derecha: tu equipo, el agente que tocaste o el chat (se oculta con un botón y la oficina se centra sola). Abajo: lo que pasa **en vivo**, el **minimapa** y las vistas.
- **Los agentes caminan entre oficinas y conversan**: salen por la puerta de su sala, van al escritorio de un compañero o se juntan en el pasillo, el café o la sala, y conversan de su trabajo real (lo que hace cada uno, lo que terminó, lo que espera tu decisión). Ves el globo de lo que dice cada uno, con sus gestos, y la charla queda en «En vivo».
- **Cómo funciona**: un recorrido guiado de 12 pasos. La cámara va a cada agente y te explica qué hace, qué significan los colores, cómo diseñar la oficina y cómo aprende tu equipo. Sale solo la primera vez y cuando quieras con «Cómo funciona».
- **Minimapa**: la planta desde arriba con tus agentes moviéndose en vivo; tocas una sala y la cámara va allá.
- **Vistas**: general, desde arriba, modo cine (la cámara gira sola) y de día o de noche.
- **Más visual**: los neones, las pantallas y el logo brillan de verdad. En equipos lentos, la oficina baja sola la calidad para moverse fluida.
- **Pedirle algo a un agente**: en el panel de cada uno, «Pedirle algo» abre el chat con tu coordinadora ya escrito para él.

## 2026-11-19t · Personajes mejor hechos y oficinas que se ven desde cualquier lado

- **Personajes nuevos**: cuerpo con forma (hombros, pecho, cintura y cadera), cuello, codos y rodillas que se doblan al sentarse y al caminar, manos, zapatos y una cara con ojos que parpadean, cejas, nariz, boca y orejas.
- **Mujer u hombre**: las mujeres con pelo largo (suelto, cola de caballo o moño), pestañas, labios y aretes; los hombres con hombros más anchos, pelo corto (algunos con barba) y cinturón. Lo eliges para cada agente en «Nombres y personajes». Además, el productor de video lleva audífonos y los de calidad e investigación, lentes.
- **Oficinas con más detalle**: escritorios con mouse, cuaderno, lápices y cajonera; lámparas de pie, cuadros, papeleras, una pizarra con notas en Calidad, archivadores e impresora en Investigación, una luz de estudio y cables en Producción, estantes con libros y trofeo, un sillón en Edición, el dispensador de agua y bancas en el pasillo.
- **Desde cualquier vista**: cuando giras la oficina, las paredes que quedan entre tú y una sala se vuelven transparentes, así siempre ves lo que pasa adentro.

## 2026-11-19s · Editar y regenerar las escenas de apoyo

- En el guion, cada **imagen de apoyo** (B-roll) tiene ahora **«Editar»** y **«Otra escena»**. Con «Editar» escribes la escena como la quieres; con el ✨ tu IA te propone otra escena distinta (con su cámara), en segundos y sin gastar. Al tocar **Guardar**, tu IA rehace la imagen y el video de esa escena de apoyo para mostrar eso, sin cambiar dónde entra ni cuánto dura.
- También funciona dentro de «Editar a mano», junto con los textos de cada parte. Los videos tuyos (los que subiste) no se tocan.

## 2026-11-19r · Oficina con tu diseño, a tu medida, y una coordinadora que te escucha

- **La oficina en 3D con el diseño que mandaste**: planta abierta de noche con piso de madera cálida, el logo K al centro sobre una jardinera con luz verde, líneas de neón en el piso, sala de reuniones de vidrio con la pared de listones, biblioteca, pared de datos con el mapa y las gráficas, estudio de video con aro de luz y cámara, zona de revisión, oficina de vidrio, barra de café con taburetes y sala de estar con sofá y sillones verdes. Plantas por todas partes.
- **Las pantallas muestran lo que se está haciendo de verdad**: en Arte, tres pantallas grandes (la del medio con la última imagen generada); en el estudio de video, la pantalla grande con el último clip; en Edición, el último video entregado.
- **Las secciones «Próximamente»** (Landings, Embudo WhatsApp y S.E.P) salen como oficinas en construcción (cinta, conos, escalera). Tocando su etiqueta vas a su sección.
- **Diseñar oficina**: un plano con todos los lugares. Tocas una oficina y después otro lugar para moverla (si está ocupado, se intercambian), le cambias el nombre y el color, y **creas las tuyas** eligiendo el tipo de sala (escritorios, creativos con pantallas grandes, estudio de video, reuniones, pared de datos, biblioteca, oficina de vidrio, café o sala de estar).
- **Si una IA se cae** (Claude, ChatGPT, kie.ai o ElevenLabs, según Salud de plataformas), la oficina lo dice arriba y los agentes que la usan se ponen en naranja con el aviso.
- En la **Oficina virtual**, el botón **«Hablar con Valentina»** (o el nombre que le pusiste) abre un chat con tu coordinadora. Escríbele lo que necesitas: «hazme 3 anuncios UGC de Aguaje», «investiga el mercado de mi producto en Colombia», «¿cómo va el trabajo?». Ella reparte el trabajo y te deja el enlace de cada cosa, con su estado en vivo (escribiendo el guion, espera tu aprobación…). **Nada se cobra sin tu sí**: los guiones te esperan para aprobarlos con su costo, como siempre. Si falta algo (el producto, el estilo o lo obligatorio de un estilo), te lo pregunta.
- Dile cómo quieres las cosas de ahora en adelante («los ganchos más cortos», «nunca uses fondos oscuros») y lo anota como regla para todos los guiones.
- En cada anuncio terminado, **«¿Cómo quedó?»**: 👍 o 👎, qué parte (guion, imágenes, clips, voces, montaje) y qué te gustó o no. Se vuelve una regla de ese estilo (o de todos) que tu equipo usa la próxima vez.
- En el panel de cada agente ves **lo que aprendió esta semana** y cuántos 👍/👎 recibió su trabajo.

## 2026-11-19q · Oficina virtual en 3D

- Nueva sección **Oficina virtual** (en el menú, debajo de Inicio): tu equipo de agentes trabajando en una **oficina en 3D**, hecha desde cero. Un piso flotante de noche con una sala por departamento (Dirección, Guiones, Arte, Producción, Edición, Calidad, Investigación y el Café), cada una con sus muebles y sus objetos: pantallas que se mueven, biblioteca, caballete con su cuadro, cámara en trípode con su luz roja, aro de luz, tablero de control, telescopio y globo terráqueo, pizarra con notas, reloj con la hora real, cafetera con vapor, un robot aspiradora por los pasillos y motas de luz.
- **Los agentes hacen el trabajo real de la app**: los que están trabajando se sientan y escriben en su computador; los libres caminan por su sala y a veces van al café; los que **te necesitan** se paran, saludan y tienen una alerta roja. La coordinadora les reparte paquetes de luz a quienes trabajan.
- **La primera vez** te pide ponerle nombre y personaje a cada agente (lo cambias cuando quieras en «Nombres y personajes»).
- Al tocar un agente, la cámara se acerca y ves **qué hace ahora, qué te necesita, qué terminó hoy** y lo que aprendió (con enlaces para ir a cada cosa). La oficina se gira y se acerca con el mouse.

## 2026-11-19p · Recrear un anuncio para otro producto, y «Cambiar el producto» en el Editor

- **Recrear para otro producto** (en la entrega de cada anuncio): eliges otro de tus productos y tu IA hace el mismo anuncio con el **mismo guion tal cual**, cambiando solo lo del producto («estas son las gotas» → «estas son las pastillas», cómo se usa, su envase en las imágenes) y lo que no encaje con él. Mismo estilo, misma voz, **mismas personas** (sus fotos se reutilizan sin pagarlas otra vez). Ves el guion y el costo antes de producir. (No en los cantados: su canción es de otro producto.)
- **«Cambiar el producto»** ahora está en **Editor** (botón arriba). Sigue igual: la IA encuentra las escenas donde sale el otro producto, las rehace con el tuyo y te muestra la propuesta para revisarla antes de producir.

## 2026-11-19o · Investigación de mercado: todo de una y con el mismo estilo

- **La primera parte** (la de mercado) ya no se ve como hojas de PDF: tiene el **mismo estilo que la segunda** (la de la competencia), con una pestaña por sección, tarjetas, tablas y cajas de colores, y la guía visual de los 4 mensajes con su maqueta. «Descargar PDF» sigue sacando el PDF de siempre.
- **Todo de una:** al tocar «Investigar» arrancan **a la vez** la investigación de mercado y la de tu competencia en TrendTrack. Puedes pegar la tienda de la competencia; si no, la IA busca sola la que más vende algo como tu producto.
- **Más rápida:** las dos buscan en paralelo y sin repetir búsquedas, sin recortar nada del contenido.

## 2026-11-19n · Imagen de cada escena en los anuncios por bloques

- En los anuncios donde una persona habla por bloques (UGC y «Agregar» con alguien que habla a cámara), **cada escena tiene ahora su imagen**: se hace primero, el clip sale usándola y en **Producción** la ves como «Inicio», con **«Editar esta imagen»** (y rehacer el clip con la imagen nueva) y «Regenerar con su imagen». Cuesta una imagen más por escena.

## 2026-11-19m · Podcast con dos voces distintas, y el cierre de los videos de prueba social

- **Podcast: cada host con su propia voz.** Después de hacer los clips, la app le pone a cada host una voz fija de tu cuenta de ElevenLabs, distinta para cada uno y según si es mujer u hombre («cambiar voz»: mismas palabras y mismos tiempos, la boca sigue sincronizada). Lo regenerado recibe su voz otra vez; tu propio video conserva la tuya. Si no se puede (sin clave o con una sola voz en tu cuenta), sigue con las voces del video y lo avisa. Usa créditos de tu ElevenLabs.
- **Podcast: dos personas que no se parecen.** Tu IA describe a la segunda persona con al menos cinco rasgos distintos (piel, pelo, cara, contextura y ropa) y las dos voces bien diferentes.
- **Prueba social (todos los estilos):** cuando el anuncio se apoya en un médico, un experto, un testimonio, un podcast o una entrevista, el cierre ya no es de venta: es una **recomendación** que convence, como la diría esa persona.

## 2026-11-19l · Las imágenes de apoyo (B-roll), detalladas en el guion

- En el guion, cada **imagen de apoyo** (B-roll) aparece debajo de la parte donde entra (en el podcast, todas juntas al final), con:
  - **lo que se ve**, en 2 o 3 frases muy visuales: quién y qué, dónde y con qué luz, la acción de principio a fin, el detalle que engancha y la emoción;
  - 🎥 **la cámara**: el encuadre y el movimiento;
  - con qué frase entra y cuánto dura.
- Tu IA escribe esa escena primero y la misma va a las instrucciones de la imagen y del video.

## 2026-11-19k · Arreglo: en Producción las escenas quedaban «En espera»

- En anuncios hechos por bloques (por ejemplo «Agregar» con una persona que habla), Producción esperaba una «imagen de inicio» por escena que ese tipo de anuncio no lleva: las escenas se veían «En espera», sin miniatura, y decía «faltan 5» aunque el anuncio estaba terminado. Ahora cada escena muestra su clip y el conteo es el real.

## 2026-11-19j · Podcast y entrevista: el guion de cada persona

- En el guion de un **podcast** o una **entrevista**, además de «La conversación», una pestaña por persona: **«Guion de Carla»**, **«Guion de Tomás»** (o del entrevistador y la persona). Cada una muestra solo las líneas de esa persona, a qué responde cada una y **cómo la dice** (emoción, tono, expresión, gesto, mirada), con **«Copiar su guion»**.
- En la conversación, debajo de cada línea, 🎭 cómo la dice esa persona.
- Tu IA escribe a cada persona distinta: su carácter y su **forma de hablar** («Cómo habla», también en «Quién aparece»), y la misma actuación va al video de cada bloque.

## 2026-11-19i · Pega tus anuncios ganadores

- En **Variantes → «Lo que te funciona»** y en **Biblioteca → «Lo que me funciona»**, además de subirlos: **pégalos**. Copia la imagen del anuncio (clic derecho → Copiar imagen, o una captura de pantalla) y toca **«Pegar»** o pulsa **Cmd+V** (Ctrl+V en Windows) con el mouse encima. También puedes **arrastrarlos** a esa zona.
- En Variantes, lo que pegas va a «Lo que te funciona» (no a la foto del producto) y queda elegido.

## 2026-11-19h · Sube lo que ya te funciona (Variantes)

- En **Anuncios de imagen → Variantes → «Lo que te funciona»**: botón **«Subir lo que te funciona»**. Subes imágenes (JPG, PNG, WEBP o HEIC) o videos de tus anuncios que ya venden, y quedan elegidos.
- Todo lo que subes queda guardado en **Biblioteca → «Lo que me funciona»**: ahí los ves (los videos se reproducen), les cambias el producto, los quitas o tocas «Hacer variantes».
- **El concepto creativo**: en cada uno escribes por qué vende (el gancho, la idea, a quién le habla). La variante **conserva ese concepto** y cambia la ejecución y el título.

## 2026-11-19g · Cambiar de cuenta de Claude

- En **Ajustes › Conexiones**, debajo de tu cuenta de Claude: **«Cambiar de cuenta»**. Se abre una ventana que cierra la cuenta anterior en Claude Code y te deja entrar con otra (Pro o Max).
- Ojo: entrar con otra cuenta en la aplicación de Claude de tu Mac no cambia la de la app; la app usa Claude Code, que tiene su propio inicio de sesión. Por eso hace falta este botón.
- La app nota la cuenta nueva en segundos, y lo que estaba esperando porque se acabó el uso **sigue solo** con la cuenta nueva.
- El aviso de «se acabó el uso de tu plan» ahora también te dice que puedes cambiar de cuenta.

## 2026-11-19f · «Clonar un video» a la vista

- En **Estilos**, «Clonar un video» aparece junto a «Agregar» (filtro «Desde tu video») y su botón lleva directo a clonar.
- **Nuevo anuncio en modo clonar**: lo primero es «El video que quieres clonar» (súbelo o pega su link); sin el video no sigue. En el paso 2 eliges el estilo en que se rehace, o varios para tener variaciones, y tu video ya va puesto en cada uno (también en los que eliges después). Puedes decidir si se adapta el gancho y el ángulo a tu producto.

## 2026-11-19e · Salud de plataformas: naranja solo cuando de verdad pasa algo

- Ya no se queda en naranja todo el día por reintentos viejos: solo cuentan los de las **últimas 2 horas**, y solo si la última generación también los necesitó.
- Una respuesta lenta o un error **suelto** ya no lo cambia de color: tiene que repetirse dos veces seguidas (se revisa cada 30 s).
- Al pasar el mouse o abrirlo, dice **cuál** plataforma lo pone en naranja o rojo y si igual se puede usar («kie.ai: va lento, pero se puede usar»).

## 2026-11-19d · Salud de plataformas en vivo

- El indicador **Salud de plataformas** (arriba a la derecha) ahora está **en vivo**: se revisa cada 30 segundos y cambia de color en cuanto una plataforma falla o vuelve, sin recargar. Al abrirlo dice «En vivo».

## 2026-11-19c · Arreglo: «Crear anuncios de imagen» no abría

- Si la última vez dejaste elegido **«De un video»**, al volver a **Crear anuncios de imagen** salía «Esta pantalla tuvo un problema». Ya abre bien.

## 2026-11-19b · Tus videos e imágenes en el anuncio

- En **Nuevo anuncio**, en los ajustes de cada estilo, un apartado opcional **«Tus videos e imágenes»**: subes (o arrastras) hasta 10 videos e imágenes y, si quieres, escribes dónde usar cada uno («en el antes y después», «como escena del producto al final»).
- Tu IA los mira al escribir el guion y los pone donde encajan:
  - un **video** como una escena (B-roll o una toma sin diálogo), tal cual;
  - una **imagen** como la imagen exacta de una escena (el video se anima desde ella);
  - una **imagen** como referencia: la persona, el lugar o el objeto de la foto, en una escena nueva.
- Las escenas hechas con tus archivos **no se generan ni se pagan**.

## 2026-11-19a · De un video: el ángulo, no los cuadros

- **«De un video»** ya no saca cuadros del video. Tu IA **mira y escucha** el video (las tomas y lo que se dice) y encuentra su **ángulo, gancho, dolor, deseo, a quién le habla y por qué funciona**. Con eso propone **anuncios para tu producto**: cada uno es un concepto distinto (faceta, momento y forma, como pide Andromeda), con su **titular** y su **escena**.
- Puedes **editar el titular y lo que se ve** de cada uno, quitar los que no te sirvan o pedir otras ideas (4, 6, 8 o 10).
- Las imágenes salen con las **plantillas ganadoras** (primero las de productos como el tuyo), tu producto y tus colores, con el modelo de imagen. Cuestan como cualquier lote (te muestra el costo antes).
- **Lo que se ve**, más detallado y llamativo: la IA describe la escena con quién aparece, dónde, la pose, el resultado bien visible, la luz, los colores y el encuadre (también en «Editar a mano» del guion), y el modelo de imagen la sigue de cerca.

## 2026-11-19 · Generar con IA una parte nueva del guion

- Al **agregar una parte** en «Editar a mano», el cuadro trae su ✨: la IA escribe lo que se dice en esa parte, enganchada con la de antes y la de después, y en seguida escribe lo que se ve. Lo puedes corregir antes de guardar, o tocar ✨ otra vez para otra versión.

## 2026-11-18z · Editar el guion con lo que se ve, partes nuevas, y portadas en Estilos

- En **«Editar a mano»**, debajo de lo que se dice está **«Lo que se ve»** (la escena). Cuando terminas de escribir una parte, la IA escribe sola lo que se ve, en segundos, siguiendo tu texto, los personajes y el estilo del anuncio. Lo puedes cambiar a mano o pedir otra versión con ✨.
- **«Agregar parte aquí»** debajo de cada parte: escribes lo que se dice y lo que se ve se escribe solo. Una parte nueva se puede quitar con la ✕ antes de guardar.
- Al **Guardar**, la IA pone tus textos tal cual y rehace las escenas (imagen y video) de esas partes para que muestren lo nuevo. Si solo cambiaste el texto de un anuncio con narrador, sigue siendo al instante y gratis.
- **Cambiar el producto** ahora vive en **Estilos** (en «Especiales») y ya no está en el menú.
- **Portadas que faltaban** en Estilos (Agregar, Cambiar el producto, Clonar un video, Más ganchos y Sketch de comedia): la app las hace sola con **ChatGPT Imágenes**, gratis con tu plan, un rato después de abrirla. Necesitas ChatGPT conectado en Ajustes → Conexiones; si no lo está, lo intenta de nuevo al otro día.

## 2026-11-18y · Lo que viene en el menú

- En «Crear», con la marca «Pronto»: **Embudo WhatsApp**, **Landings** (el Generador de Landings) y **S.E.P**. Cada uno abre su pantalla de «Próximamente».
- **Inspiración** ya no aparece en el menú.

## 2026-11-18x · Anuncios en la nube que se ven y se reproducen, y «Landings» (próximamente)

- **Anuncios en la nube**: cuando un anuncio se guarda en tu nube y se borra de tu computador para liberar espacio, sigue apareciendo como terminado, con su video, sus imágenes y sus miniaturas. Lo ves, lo reproduces (y lo adelantas) y lo descargas directo desde tu carpeta de nube, sin traerlo de vuelta. Para editarlo, exportar, rehacer algo o sacar más ganchos, se trae solo. En «Anuncios» llevan la marca **«En la nube»**.
- **Landings** en el menú (Crear), con la marca «Pronto»: el Generador de Landings viene próximamente.

## 2026-11-18w · Plantillas de productos relacionados

- La app reconoce de qué trata tu producto (glúteos, curvas, piernas, abdomen, hinchazón, celulitis, piel, peso, detox…) leyendo su ficha y su investigación, y sabe de qué producto viene cada plantilla.
- En el selector aparece **«Para tu producto»** (lo primero que ves) con las plantillas de productos como el tuyo, de la más cercana a la menos. En «Todas», esas plantillas llevan la marca «Para tu producto».
- **«Que la app elija»** toma primero las de productos relacionados, sin repetir la misma forma. Si tu producto es de otra cosa (por ejemplo, respiratorio), no toma plantillas que no le correspondan.

## 2026-11-18v · 24 plantillas ganadoras nuevas

- **54 plantillas** (antes 30): 24 nuevas, sacadas de TrendTrack. Son anuncios de imagen en español con meses activos y alcance real, por ejemplo: foto real apilada, lupa sobre el problema, nota escrita a mano, selfie en el espejo, «Pensado para…», «Señales de que necesitas…», pierna partida con deslizador, «Pasé de la talla L a la S», «Programa de 50 días», calendario de 21 días, «No dejes que… + El 86%» y mecanismo en rayos X. Cada una trae la fórmula de su titular.
- **Filtros por tipo** en el selector de plantillas (dolor y deseo, antes y después, línea de tiempo, comparación, beneficios, nativo), y en las nuevas, cuántos **días lleva activo** el anuncio original.

## 2026-11-18u · Titulares con la estructura de cada plantilla y productos organizados

- **Titulares que atacan el deseo principal**: cada plantilla tiene la fórmula de su titular («Bye bye + el problema», «Menos X en N semanas», «¿Tu zona todavía se ve así?», «No solo X, también tus Y», «Esta Navidad regálate…», los días…). El modelo la llena con el deseo o beneficio principal de tu producto, en las palabras de tu cliente y conectado con lo que se ve.
- **El resultado se ve grande**: si el deseo es más volumen (glúteos, caderas, piernas), el después, el último panel o la persona muestran claramente más volumen y forma, con la zona ocupando la mayor parte del cuadro.
- **Productos** (menú «Tu contenido»): todo lo generado, por producto (videos, lotes de imágenes, investigación e inversión). Si hay productos con el mismo nombre, avisa y los **unes en uno** con un toque. También puedes elegir varios a mano con «Unir productos». Nada se borra: los otros se guardan aparte.

## 2026-11-18t · Plantillas: la forma de la plantilla, el ángulo de tu producto

- La plantilla pone la **forma** y tu producto pone el **ángulo**. Por ejemplo, un antes y después de piernas hinchadas, para un producto de glúteos, caderas y piernas, sale como antes y después de glúteos, caderas y piernas, con la misma división y los mismos rótulos. Un «Día 1 · 14 · 30» muestra el cambio de tu producto, paso a paso. Una plantilla con una sola persona muestra tu resultado en ella, para que el ángulo se entienda antes de leer.
- **Andromeda en cada imagen**: cada una lleva un concepto distinto de tu investigación (la faceta, el problema, el momento y el escenario), con una persona de tu país que se ve como tu cliente. Sin investigación, cada imagen se ubica en un momento distinto.
- **Mejores textos**: el titular sale de los textos de tu investigación (con tus correcciones). Los rótulos son cortos y en las palabras de tu cliente. Los días o semanas, solo los que permite tu investigación, sin inventar números.

## 2026-11-18s · Plantillas: tus anuncios validados como referencia

- En «Crear anuncios de imagen», **«Con plantillas de anuncios validados»** ahora muestra los 30 anuncios validados que pasaste (Muna, Grüns, Sonvital, Vitaly, Lymphoria, Aurelys, Natures Sunshine, Aguaje…), por tipo: dolor y deseo, antes y después, línea de tiempo, comparación, beneficios, nativo y temporada.
- Ya no se rehacen a mano: cada plantilla va **al modelo de imagen como referencia**, con la foto de tu producto. Sale con la misma estructura, composición y letras, y con **tu producto, tus textos y tus colores**. Sin precios ni ofertas.
- Eliges hasta 10, o **«Que la app elija»**, que mezcla ideas distintas (una por imagen, nunca dos casi iguales).

## 2026-11-18r · Inicio: el dashboard principal

- Pantalla nueva **Inicio**, la primera del menú y la que abre al entrar (el logo también lleva ahí).
- Arriba, cuatro cifras del mes: **anuncios** y **imágenes** hechos (contra el mes anterior), lo que **te necesita** o está **en producción**, y lo **invertido**.
- **Últimos 14 días** en un gráfico: gasto, anuncios o imágenes por día (pasa el mouse por una barra para ver el detalle).
- **Ahora**: lo que te necesita y lo que se está produciendo, con su avance.
- **Saldo** (kie.ai y ElevenLabs), **Plataformas** (la salud de cada servicio) y **Modelos de la semana** (cuántas piezas hizo cada uno).
- **Por producto** (videos, lotes de imágenes, investigación e inversión) y **Lo último** que terminó.

## 2026-11-18q · Salud de plataformas más simple, con kie por modelo y revisión por servicio

- Cada servicio en una sola línea: nombre, estado y, solo si hay falla, una línea corta con cuál.
- **kie.ai con desplegable**: toca su nombre y ves cada modelo que usas (GPT Image, Omni Flash, Kling, Seedance, Veo, Suno…) con su estado, según tus generaciones de los últimos 7 días (amarillo si hoy la mitad de sus piezas necesitaron reintentos).
- Cada servicio tiene su **↻** para revisarlo solo, al instante.

## 2026-11-18p · Salud de plataformas: también Meta

- En «Salud de plataformas», un grupo nuevo **Meta**, con lo que usas para vender: **Ads Manager** (crear, publicar y medir tus anuncios, y su API), **Biblioteca de anuncios** (la Inspiración «Meta (oficial)») y **WhatsApp Business** (anuncios «Clic a WhatsApp» y tus ventas). Sale de metastatus.com, la página de estado oficial de Meta: verde sin problemas, amarillo con fallas leves o medias, rojo con fallas graves, con la parte afectada y desde qué hora. Los productos de Meta que no usas no cuentan.

## 2026-11-18o · Salud de plataformas

- En la barra de arriba, un botón **«Salud de plataformas»** con un punto de color: verde (todo bien), amarillo (algo va lento o tiene fallas) o rojo (un servicio no responde).
- Al tocarlo, el estado de cada servicio que usa la app: **Claude** y **ChatGPT** (la IA que escribe), **ElevenLabs** (la voz y las transcripciones) y **kie.ai** (imágenes, videos y música: GPT Image, Seedream, Kling, Seedance, Veo y Suno), con el nombre de la falla, desde qué hora y el enlace a su página de estado.
- Mira las páginas de estado oficiales, pero solo lo que usa la app (por ejemplo, de Claude mira «Claude Code» y la API, no «Claude no puede unirse a reuniones»), y además prueba gratis tus claves de kie y ElevenLabs: así nota también una falla que el servicio todavía no reportó, o si va lento.
- Se revisa solo cada 2 minutos y al abrirlo (con el botón ↻, al instante).

## 2026-11-18n · Si ElevenLabs tiene una falla, la app te lo dice

- El 18 de noviembre ElevenLabs tuvo una falla («Increased latency and API errors», desde las 10:34 a. m.): las consultas con clave se quedaban esperando. No era tu clave, ni tu internet, ni la app (comprobado desde otra red con tu misma clave).
- Ahora, si «Probar», la lista de voces o la elección de la voz fallan, la app mira la página de estado de ElevenLabs y, si hay una falla reportada, te lo dice: «ElevenLabs reporta una falla ahora: … No es tu clave ni la app: hay que esperar a que la arreglen».

## 2026-11-18m · La app no insiste con ElevenLabs cuando falla

- Si traer tus voces o elegir la voz falla, la app ya no vuelve a pedírselo a ElevenLabs sola cada 30 segundos: espera 2 minutos para la lista de voces y 10 minutos para elegir la voz. Pedírselo una y otra vez puede hacer que ElevenLabs frene la cuenta. Los botones **Reintentar** y **Volver a intentar** lo piden enseguida.

## 2026-11-18l · «Probar» la clave de ElevenLabs ya no se pasa de tiempo, y dice por qué si falla

- Con una clave sin el permiso «User» (por ejemplo, una clave nueva con permisos recortados), «Probar» comprobaba la clave pidiendo la lista de voces con el conteo total de la cuenta, que es lento con muchas voces: «ElevenLabs no respondió a tiempo». Ahora la pide sin ese conteo. Lo mismo en el motor que genera la voz.
- Si una consulta falla, el mensaje dice si la app estaba ocupada (no fue ElevenLabs ni tu internet) o el detalle de la conexión, y la consola lo anota.
- Nueva prueba para la Terminal: `node app/herramientas/diagnostico-elevenlabs.mjs` mide, con tu clave y sin mostrarla, cuánto tarda cada consulta que hace la app.

## 2026-11-18k · Arreglo: la app ya no se congela al elegir la voz (y ElevenLabs vuelve a responder)

- La causa de «ElevenLabs no respondió a tiempo» (en las voces y hasta en «Probar» la clave) era de la app, no de tu red ni de ElevenLabs: para elegir la voz parecida a la del video de referencia, la app medía su audio de una forma que la dejaba ocupada, y con un video de varios minutos todo lo demás se pasaba de tiempo.
- Ahora esa medición corre en un proceso aparte y es mucho más rápida: un video de 5 minutos se mide en menos de 1 segundo, y la app sigue respondiendo mientras tanto.

## 2026-11-18j · La app conecta con ElevenLabs y kie como el navegador

- Con algunas redes (IPv6 a medias), la app se quedaba esperando a ElevenLabs aunque en Chrome todo anduviera: «ElevenLabs no respondió a tiempo» al probar la clave o al traer las voces. Ahora la app y los procesos que generan la voz y las imágenes conectan primero por IPv4 y, si una dirección no contesta, prueban la otra enseguida, como el navegador.
- La prueba de la clave espera hasta 30 segundos (antes 15).

## 2026-11-18i · Las voces de ElevenLabs llegan rápido (y aunque ElevenLabs tarde)

- La lista de voces se pide sin el conteo total de voces de la cuenta, que según ElevenLabs es lo que la hace lenta («ElevenLabs tardó demasiado en mandar tus voces»).
- Más tiempo de espera (45 s), y si la lista nueva no llega, la app prueba la de siempre.
- La app guarda en tu computador la última lista que llegó bien: la muestra al instante y la actualiza por detrás. Si un día ElevenLabs no responde, sigue con la guardada (la voz, la muestra y la elección automática funcionan igual).
- En la tarjeta «Voz del narrador», si no pudo elegirla, un botón **Volver a intentar**.

## 2026-11-18h · Arreglo: el guion de «Agregar» vuelve a su lugar

- En los anuncios de «Agregar», el bloque «Lo que entendió de tu video y tu pedido» ocupaba la columna ancha y empujaba el guion a la columna angosta de la derecha. Ahora el plan va arriba del guion, los dos en la columna ancha, y a la derecha quedan «Pedir cambios», la voz del narrador y «Me gusta, producir», desde arriba.
- El botón «Editar a mano» ya no queda pegado al borde de la hoja.

## 2026-11-18g · Regenerar con IA una parte del guion

- En «Editar a mano», cada cuadro tiene arriba a la derecha un ícono ✨ **Regenerar con IA**: tu IA escribe otra versión de esa parte (con el guion completo como contexto: misma función, que enganche con la anterior y la siguiente, el mismo largo para que entre en el mismo tiempo y las palabras de tu público).
- El texto nuevo aparece en el cuadro sin guardarse: tócalo otra vez para otra opción, corrígelo a mano o guárdalo con **Guardar** (con narrador queda al instante y gratis).
- Es una consulta corta aparte del guion: tarda segundos y no espera en la fila.

## 2026-11-18f · Editar el guion a mano

- En la hoja del guion, un botón **«Editar a mano»**: cada parte se vuelve un cuadro de texto, la escribes como la quieres y tocas **Guardar**.
- **Con narrador** (Claymation, Pixar, Lego, Zack D Films, Realista con narrador, Agregar con voz en off…): tu texto se aplica al instante y sin costo a lo que lee la voz. La app revisa que el guion siga bien y, si algo no cuadra, lo deja como estaba.
- **Cuando alguien habla en el video** (UGC, podcast, entrevista, objeto que habla): la frase va dentro de las indicaciones del video con sus tiempos, así que tu IA pone tus palabras tal cual y ajusta los tiempos y el video de esas partes.
- Queda anotado en «Lo que cambió». Se puede editar hasta aprobar el guion; después, los textos se cambian en el editor.

## 2026-11-18e · La voz de ElevenLabs se ve, se escucha y se cambia en la pantalla del guion

- En la pantalla del guion, al lado, una tarjeta nueva **«Voz del narrador»**: la voz de tu cuenta de ElevenLabs que se va a usar, con **Escuchar** y una lista para **cambiarla** (o volver a «Que la elija la app») hasta que se genera la voz.
- Si la eligió la app, dice por qué (por ejemplo: «como pide el plan: mujer joven, firme y cercana, con acento colombiano · Valentina - Conversational Medellin: voz femenina, acento colombiano, joven, cercana»).
- Si el guion ya está y la app todavía no la había elegido (o no pudo), la elige al abrir esa pantalla. En «Agregar», usa también lo que dice el plan sobre la voz del video. Reconoce las ciudades en el nombre de la voz (Medellín, Bogotá) como acento.
- Si ElevenLabs no responde, la tarjeta lo dice con el motivo y un botón para reintentar.

## 2026-11-18d · Las voces de ElevenLabs se traen como el saldo (sin «error de conexión» falso)

- La lista de tus voces de ElevenLabs (en «Voz del narrador» y para la voz que elige la app) ahora se pide directo desde la app, igual que el saldo de ElevenLabs que ves abajo a la izquierda. Antes se pedía en un proceso aparte que, si escribía cualquier aviso o tardaba más de 30 segundos, salía como «No pude conectar con ElevenLabs» aunque tu clave y tu internet estuvieran bien.
- El error ahora dice la causa real: falta la clave, ElevenLabs la rechazó (por ejemplo, si no tiene permiso para leer las voces), no hay conexión, o ElevenLabs tardó demasiado.

## 2026-11-18c · Si no eliges la voz del narrador, la elige la app

- En la voz del narrador, la primera opción ahora es **«Que la elija la app»** (ya no hace falta elegir una para escribir el guion).
- **Con video de referencia** (Agregar o Clonar): la app mide la voz del narrador del video en tu computadora, gratis (si es grave o aguda, qué tan expresiva es y su ritmo) y busca en tu cuenta de ElevenLabs la más parecida.
- **Sin video:** la IA que escribe el guion describe la voz ideal para ese anuncio (género, edad, acento y tono) y la app elige la de tu cuenta que más se le parece. Si no hay nada más, usa a quién le habla tu producto y tu país (por ejemplo, femenina y latina para un producto de mujeres en Colombia).
- La compara con las etiquetas de tus voces (género, edad, acento, idioma, uso) y prefiere las que hablan español y las hechas para narrar. Ya elegida, no cambia: el anuncio suena siempre igual.
- Te dice cuál eligió y por qué, mientras se escribe el guion y en el informe del anuncio. Si eliges una voz, se respeta como siempre.

## 2026-11-18b · Arreglo: «Crear anuncios de imagen» volvía a abrir

- La pantalla «Crear anuncios de imagen» mostraba «Esta pantalla tuvo un problema» desde la versión 2026-11-18a: buscaba los formatos que propone la investigación antes de saber qué producto elegiste. Ya abre bien.
- Nueva revisión automática que abre cada pantalla en el navegador y avisa si alguna se rompe (`app/herramientas/abrir-pantallas.cjs`).

## 2026-11-18a · Plantillas clonadas de anuncios validados y la investigación escribe sus textos

- **8 plantillas nuevas clonadas de los anuncios que mandaste**, con su misma composición y su misma letra (llegaron Poppins y DM Serif Display, como en Sonvital, Grüns y Muna); solo cambian tus colores y tu producto. Todas atacan directo el dolor, el beneficio o el deseo, casi siempre con el tiempo de transformación, y ninguna lleva oferta:
  - Etapas en neón (Muna) · Antes y después con plazo (Sonvital, B/N con pedestal) · Dos mitades de color (Sonvital, el titular cambia de color en la mitad) · Ahora → después con rótulos (Lymphoria) · Hinchada vs. drenada (Aurelys) · Cuadrícula de tiempos 2×2 (Aurelys) · Antes y después con íconos a los lados (Natures Sunshine, sin la oferta) · Día 1 · 14 · 30 en blanco (Muna).
  - La «Historia con antes y después» ahora usa la letra serif de Muna.
- **La investigación de mercado escribe los textos de tus anuncios de imagen**: 10 a 16, uno por concepto de la matriz de Andromeda, cada uno en su plantilla. **Matriz creativa, diversidad real:** entre dos anuncios cambian al menos 2 de estas cosas: a quién le habla, el ángulo, el momento y la plantilla; si no, la app se los devuelve a la IA.
- **En la investigación, «Textos para tus anuncios de imagen»**: cada uno dibujado con la foto de tu producto y un botón **Editar**. Lo que corrijas queda guardado, lo usan tus anuncios de ese producto y **se anota como aprendizaje**: la próxima investigación escribe como tú lo quieres.
- **Anuncios de imagen:** si no eliges formatos, van los que propuso la investigación con sus textos (el formulario lo dice y el costo cuenta esos).
- Las investigaciones ya hechas: «Agregar conceptos y textos para Meta» arma la sección de Andromeda y los textos sin rehacer la investigación.
- **Revisión del diseño:** la investigación ya no se sale de la pantalla en el celular (las tablas anchas se deslizan de lado dentro de su hoja, la portada se ajusta y el botón de la competencia baja de línea). Revisé las 33 plantillas en cuadrado y vertical, las 22 hojas de la investigación y la guía de 4 mensajes.

## 2026-11-18 · La investigación de mercado trae los conceptos para Meta (Andromeda)

- **Sección nueva al final de la investigación: «Conceptos para Meta (Andromeda)».** Convierte la investigación en anuncios distintos para Meta, como pide su sistema nuevo:
  - **Facetas del cliente:** la misma persona como mamá, trabajadora, la que se cuida para diciembre o la hija que compra para su mamá, cada una con su dolor en sus palabras y una escena del país.
  - **Momentos y contexto:** madrugada, almuerzo, noche, quincena, mitad de mes y la próxima temporada, con el mensaje y el formato de cada uno.
  - **Matriz de 8 conceptos:** faceta × problema × contexto × formato, cada uno distinto en al menos 2 cosas, con su hook. Dice cuáles 3 probar primero.
  - **Estructura y señal:** segmentación amplia, 6 a 10 conceptos por conjunto, no forzar el gasto, enviar a Meta la compra confirmada y medir confirmación y entrega por anuncio.
  - **Prompt con contexto** listo para pedirle anuncios a la IA.
- **Las investigaciones que ya tenías:** botón **«Agregar conceptos para Meta (Andromeda)»** arriba de la investigación. Tarda unos minutos, no la rehace ni busca en internet (funciona también con ChatGPT); si algo falla, la investigación queda como estaba.
- Los lotes de anuncios de imagen de ese producto leen también esta sección.

## 2026-11-17q · Plantillas de ángulos ganadores (sin oferta) y «Actualizar» vuelve a traer las versiones nuevas

- **8 formatos nuevos en «Ángulos ganadores»**, sacados de anuncios ya validados de la categoría (sin copiar marcas ni textos):
  - **Silueta con zonas (neón):** fondo negro, la silueta en línea de neón con tu color y las zonas rotuladas («+ caderas», «cintura pequeña»).
  - **Solo X vs. X + tu producto:** «Solo sentadillas» | «Sentadillas + tu producto», con la ilustración partida y un botón «Prueba…» (sin precio).
  - **Tu producto vs. lo de siempre:** mitad con tu color y mitad en gris, 3 diferencias por lado con flechas.
  - **No compres esto si…:** psicología inversa sobre un antes y después, con recuadros negros como en TikTok.
  - **Pregunta y revelación:** «¿Sientes que…?» + «¡No es tu culpa!», con la persona y el producto.
  - **Historia con antes y después:** «Siempre decía: …» + «Hasta que descubrí TU MARCA», con 3 íconos.
  - **Zonas y semanas:** las zonas del cuerpo dibujadas y lo que pasa en cada etapa.
  - **Foto grande con íconos:** la zona del resultado en una foto, el titular, 3 íconos y el producto (en noviembre y diciembre, a veces «Esta Navidad regálate…»).
- **Ya no hay plantillas de oferta** en el formulario ni en «Que la app elija»: la mezcla empieza por los ángulos ganadores. Los lotes viejos con oferta se siguen viendo igual.
- Los textos salen de tu ficha, sin precios ni descuentos, y los cambias gratis con «Editar textos».
- **«Actualizar» en una copia instalada con el comando:** las versiones con número al final (2026-11-17p1, p2…) no las reconocía, y no se publicaba ninguna desde el 16. La versión vuelve al formato de fecha con una letra y la app ahora entiende los dos.

## 2026-11-17p1 · Las imágenes siguen las fórmulas de los anuncios ganadores

- La app usa por dentro (sin mostrarlo) lo que aprendimos de anuncios de imagen ganadores: cómo comunican el ángulo, qué título usan y qué muestra la imagen.
- **Títulos con la fórmula ganadora:** la línea de tiempo dice el resultado con su plazo («Piernas más ligeras en 20 días»), la pizarra ataca lo que la clienta ya probó («¿Tomas diuréticos? Prueba esto.») y el mapa del cuerpo dice «La diferencia se nota».
- **Escenas como las ganadoras:** en el antes y después, foto real de celular en casa con la zona del cuerpo llenando el cuadro; en la línea de tiempo, fondo limpio y de perfil o de espaldas para que el cambio se lea de un vistazo.
- La IA usa las mismas reglas al elegir cuadros de un video y al hacer imágenes desde una referencia: una sola idea por imagen, el ángulo se ve antes de leerse y la oferta nunca va en el título.

## 2026-11-17p · Anuncios de imagen con plantillas: la app dibuja los textos (limpios, sin errores y en segundos)

- **La app dibuja los textos y los gráficos, no el modelo de imagen.** Titular enorme, letra a mano, flechas dibujadas a mano, sticker girado, burbujas de chat, tuit con verificado y estrellas, subtítulos blancos de TikTok, filas con íconos, barra de datos, franja de oferta y la línea legal chiquita: perfectos, con tildes, con tus colores y tus letras. El modelo de imagen solo hace la escena (una persona, un antes y después), **sin ningún texto**.
- **17 formatos en 4 familias** (Anuncios de imagen › Nuevos › «Formato», con una muestra de cada uno hecha con la foto de TU producto):
  - Dolor y resultado: Antes y después · Línea de tiempo (Día 1/7/14 o Mes 1/2/3) · Pizarra «tu objeción vs. esto» · Mapa del cuerpo.
  - Beneficio explicado: Producto con flechas (ingrediente → beneficio) · Lista de beneficios con íconos · Producto protagonista + datos («200 mg aguaje») · Mecanismo con flecha · Foto con titular.
  - Nativo de redes: Nota de texto · Burbujas «tus problemas / nuestro consejo» · Foto casera con subtítulos · Reseña tipo tuit · Captura de un comentario.
  - Oferta (siempre aparte de las de dolor): Sticker · Casi agotado · Buena noticia / mala noticia.
  - Sin elegir ninguno, **«Que la app elija»** mezcla las familias (de cada 4, una con escena).
- **Gratis y al instante** los que no necesitan escena (12 de los 17): salen de la foto de tu producto, sin llamar a kie ni a ChatGPT. La pantalla del costo lo dice: «Sin costo · Todo en tu computadora». Los de escena (antes y después, línea de tiempo, mapa del cuerpo, foto casera, foto con titular) cuestan **una imagen por anuncio**: el vertical usa la misma escena (antes eran dos).
- **No esperas a la escena:** el anuncio aparece enseguida con sus textos y un fondo de espera; la escena llega sola (todas a la vez) y se vuelve a dibujar.
- **Los textos salen sin esperar a la IA**: de los ganchos validados de TrendTrack, la ficha del producto y tu investigación (las palabras de tu cliente para las burbujas, las dudas para el comentario, los ingredientes y sus mg de la etiqueta para las flechas y la barra). Nunca inventa números ni promesas médicas: si un número no está en la ficha, no aparece. Un tuit sin una reseña real lo firma tu marca (nunca una clienta inventada) y va sin estrellas: las pones tú si quieres.
- **«Editar textos»** en cada anuncio del lote: cambias cualquier texto y se vuelve a dibujar en un segundo, sin IA y sin costo. «Regenerar» en uno sin escena saca otra versión de los textos, también gratis.
- **Tu marca** (en el formulario): 2 colores sacados solos de la foto del producto (los fuertes, no la piel ni el fondo), la letra de los titulares (Anton, Bebas Neue o Archivo Black), la letra a mano (Caveat o Permanent Marker) y el estilo del sticker. Queda guardada con el producto. Las letras vienen con la app (licencias libres, sin internet).
- **Medido (PC de 4 núcleos, modo prueba):** cada imagen se dibuja en **0,3 a 1 s** con el dibujante ya abierto (la primera vez que se abre la app, armarlo tarda unos 15 s y queda guardado; las siguientes, medio segundo). Un lote de 4 anuncios en cuadrado y vertical (8 imágenes) sin escenas: **2,4 s**. Del clic en «Generar» a ver las 8 imágenes en la pantalla: **5,4 s**. Cambiar un texto: **0,5 s** (0,9 s con la pantalla).
- Si ya tienes en la computadora lo del podcast en esquina (rembg con su modelo), la app le quita el fondo a la foto del producto una vez y gratis; si no, la pone sobre una tarjeta limpia.
- Lo de antes sigue igual: apaga «Con plantillas» para el diseño libre con tus referencias, y «Variantes» sigue copiando lo que ya te funciona.

### De un video, imágenes

- **Anuncios de imagen › «De un video»**: subes un video, eliges uno de tus anuncios o tocas el botón de imagen en un video de **Inspiración**. La app saca el **cuadro más nítido de cada toma** (nunca uno borroso ni de una transición), le **quita los subtítulos** (los borra si tienes OpenCV; si no, recorta su franja), lo agranda si es chico y propone varias imágenes con **ángulos distintos**: dolor, antes y después (el primer cuadro y el último), mecanismo, prueba social, ingrediente, objeción, estatus y producto.
- **Gratis y en tu computadora**: un video de 72 s se analiza en **4 s** y sus 12 imágenes (6 anuncios × 2 tamaños) se arman en **3 s**: **7 s en total**.
- **«Elegir con mi IA»** (opcional): tu IA mira los cuadros y escribe los textos con tu plan de Claude o ChatGPT (sin costo por imagen). Sin ella, la app elige los más nítidos repartidos en el video.
- **«Pulir con IA»** (opcional, en cada anuncio del lote): el modelo de imagen rehace ese cuadro limpio y nítido, sin texto, y la app le vuelve a poner tus textos. Cuesta una imagen y te muestra el costo antes.
- El lote es uno normal: descargas, ZIP, «Editar textos», «Me funciona».

## 2026-11-17o · Exportar del editor: solo se rehace lo que cambiaste

- **Un ajuste chico sale en segundos.** El video se arma en partes de 4 segundos («tramos») que quedan guardadas. Cuando vuelves a exportar, solo se rehacen los tramos que tocaste; lo demás se reutiliza y se junta sin volver a procesarlo.
- **Si solo cambiaste el sonido** (silenciar una palabra, el volumen de la voz o de la música, un efecto de sonido), no se rehace ninguna imagen: solo el sonido, en unos segundos.
- **Mientras exporta, la ventana te dice qué hace:** «Rehaciendo 2 de 10 tramos (lo demás ya estaba)», «Solo cambió el sonido: armando en segundos» o, la primera vez, «Armando los 10 tramos del video».
- **Medido en un anuncio de prueba de 38 s (720p, en una PC de 4 núcleos):**
  - primera exportación: 69 s (antes 66 a 83 s; la primera vez cuesta casi lo mismo);
  - cambiar un texto en la mitad: **19 s** (antes 65 s);
  - silenciar una palabra: **11 s** (antes 68 s);
  - exportar otra vez sin cambios: al instante (igual que antes).
  - en 1080p: primera vez 91 s, cambiar un texto 26 s.
- **Mismo resultado:** el video sale con los mismos cuadros, el mismo largo y exactamente el mismo sonido que armándolo entero (comparado cuadro a cuadro y el sonido muestra a muestra), y pasa la misma revisión final (que ahora también mide solo lo nuevo).
- **En la Mac usa el codificador de video de la Mac** (VideoToolbox), más rápido. Si en tu Mac no anda, sigue solo con el de siempre.
- Lo guardado vive dentro de la carpeta de cada anuncio (`app/exportes/.tramos`), no se sube a GitHub ni a Drive, se borra solo lo más viejo (como mucho unas dos veces el video o 500 MB por anuncio) y se va con el anuncio cuando lo eliminas. Si algo no se puede armar por tramos, el video se exporta entero como antes.

## 2026-11-17n · Inspiración: los anuncios salen de Meta mismo

- **Arriba del feed eliges de dónde salen:** «Meta (oficial)», «Desde Chrome» o «TrendTrack». Las tres tienen las mismas tarjetas, el formato y el sonido, los guardados, Detalles y Replicar, y nunca muestran tus marcas.
- **Meta (oficial), gratis:** busca una palabra (o toca una marca) y ves los anuncios de la Biblioteca de anuncios de Meta, sin créditos. Primero pega tu token de Meta en **Ajustes › Conexiones › Inspiración: Biblioteca de anuncios de Meta**: ahí están los 5 pasos (Meta te pide verificar tu identidad una sola vez; el token dura un par de horas y lo puedes extender a unos 60 días; cuando vence, la app te avisa).
- **El límite de Meta, sin vueltas:** la API oficial solo entrega anuncios que se mostraron en **Europa** (Unión Europea y Reino Unido). Los que corren solo en Latinoamérica no salen por ahí: para esos está el botón de Chrome. Los países que puedes elegir en esta fuente son los de Europa.
- El video de cada anuncio de Meta se trae recién cuando la tarjeta aparece en tu pantalla. Si Meta no deja sacarlo, la tarjeta te ofrece **«Ver en Meta»**.
- **Botón de Chrome «Guardar en Kads»:** en la Biblioteca de anuncios de Meta (también la de Latinoamérica) cada anuncio tiene un botón verde. Al tocarlo, ese anuncio llega a **Inspiración › Desde Chrome** con su video o su imagen ya guardados en tu computador. Solo se guarda el que tocas: la extensión no hace clic ni se desplaza por ti. Puedes borrar lo que guardaste; si todavía no cumple 30 días activo, lo ves igual con la insignia «Sin validar».
- **Cómo instalar el botón:** en Inspiración toca **«Botón de Chrome»** › «Descargar la extensión» y descomprime el zip. En Chrome abre `chrome://extensions`, prende el **Modo de desarrollador**, toca **«Cargar descomprimida»** y elige la carpeta «kads-guardar-en-chrome». En sus **Opciones** pega el código que te muestra Kads, toca Guardar y luego «Probar conexión». Kads tiene que estar abierta.
- TrendTrack sigue igual que antes, como tercera fuente.

## 2026-11-17m1 · Inspiración: solo creativos validados de otras tiendas

- **Solo lo que ya funcionó:** por defecto Inspiración trae creativos **activos hace 30 días o más** (o con más de 100.000 personas alcanzadas), ordenados por alcance, como Starpop. Se puede apagar en «Más filtros» › «Solo creativos validados».
- **Nunca tus marcas:** en la columna de la izquierda, **«Tus marcas (no salen aquí)»**. Ahí está Vitalabh y puedes agregar o quitar otras (tu tienda, tu página). Sus anuncios no aparecen aunque coincidan con la búsqueda.
- Arriba del feed dice cuántos dejó afuera («no muestro 4 de tus marcas ni 1 sin validar»).

## 2026-11-17m · Inspiración: los anuncios que funcionan, como en Starpop

- **«Mejores anuncios» ahora se llama «Inspiración»** (menú Crear) y se ve como Starpop: a la izquierda las marcas que sigues; arriba **Todo / Video / Imagen**, **Guardados**, desde cuándo salieron y el orden (más alcance, más tiempo activos, escalando esta semana, más duplicados, los más nuevos); y una rejilla de tarjetas. Los enlaces viejos a «Mejores anuncios» abren esta pantalla.
- **Cada tarjeta:** la marca, cuándo salió y cuántos días lleva, el marcador para guardarlo, el video que se reproduce ahí mismo (o la imagen), insignias (su puesto en la marca, cuánto creció esta semana, cuántas variantes tiene, el formato y el sonido), el título, el texto en 2 líneas y los botones **Replicar**, copiar el texto y **Detalles**.
- **Formato y sonido con chips y cuántos hay:** Animación / Realista y luego Realista, UGC, Animación 3D, 2D, Pixar, Crochet, Esqueleto, Claymation, Lego, Acuarela, Pixel art y Papel; sonido: Voz, Canción, Instrumental, Sin audio y Otro. TrendTrack no dice el formato: la app lo saca gratis de las palabras del anuncio y, si lo dejas prendido, **tu IA mira la miniatura de cada anuncio una sola vez** (usa tu plan de Claude o ChatGPT, no créditos de TrendTrack) y lo recuerda para siempre. El sonido sale de lo que TrendTrack transcribió (con voz = Voz; con ♪ o un coro que se repite = Canción; una imagen = Sin audio). Lo que no se sabe queda en «Sin dato»: nunca se inventa. Los números son de **los anuncios cargados**, y así lo dice la pantalla.
- **Replicar:** en un video abre **Nuevo anuncio con el estilo «Agregar» y ese video ya puesto**; si el anuncio es de un formato que la app tiene (Claymation, Crochet, Pixar, Lego, Esqueleto, Animación 3D), además le pide ese estilo. En una imagen abre **Anuncios de imagen** con esa imagen como referencia.
- **Detalles:** el video en grande, todo el texto, lo que dice, las cifras (personas que lo vieron, cuánto creció, gasto estimado, días, variantes, puesto, anuncios de la marca, países), la página a la que lleva, y «Seguir esta marca» o «Ver sus anuncios».
- **Cuentas que sigues:** sigue una marca desde Detalles, búscala en TrendTrack o tráela de tu Brandtracker. Al tocarla ves sus anuncios. Sus anuncios activos se ponen al día solos cada vez que una búsqueda trae uno suyo (gratis).
- **Cuidado de los créditos de TrendTrack:** antes de buscar ves cuánto cuesta (unos 30 créditos por 20 anuncios); lo que ya buscaste en las últimas 12 horas se abre solo y gratis; «Cargar 20 más» trae la página siguiente solo cuando lo tocas; y arriba ves cuántos créditos te quedan.

## 2026-11-17l1 · «Agregar» y «Clonar» no pierden la esencia del video

- **Mira cada escena en movimiento:** de tu video ahora se sacan tres fotogramas por escena (comienzo, mitad y final), más grandes, para ver los movimientos de la cámara, los gestos, cómo se mueve la persona y si cambia la luz. También se mide la luz, el color y el movimiento de cada escena.
- **El detalle va a cada imagen y cada video:** el avatar (cara, textura de la piel y del pelo, ropa, accesorios), la iluminación (de dónde viene, de qué lado, si es suave o dura, cálida o fría, los reflejos), las texturas, el color y el acabado (filtro, grano, nitidez), los movimientos y los gestos en orden, y el tono de la voz. Lo que se repite (la persona, su ropa, la luz) se escribe igual en todas las escenas para que no cambie.
- Antes de entregar, la IA revisa escena por escena que no falte nada de eso.

## 2026-11-17l · Nuevo estilo «Agregar»: sube un video y di lo que quieres

- **En Estilos y en Nuevo anuncio hay un estilo nuevo, «Agregar»** (grupo «Desde tu video»). Subes un video (o pegas su link) y, si quieres, escribes con tus palabras lo que quieres: por ejemplo «este mismo video pero estilo Pixar narrado, que dure 1:30 y no 5 minutos, manteniendo el guion y los ángulos».
- **La IA mira tu video entero:** cómo está armado escena por escena, cómo se ven las personas (edad, cuerpo, ropa, lugar, cámara), el gancho, el ángulo de venta y el antes y después. Si vende un cambio del cuerpo (por ejemplo glúteos y piernas), el antes y después se hace con la misma persona, la misma pose y la misma ropa, y el cambio se nota a primera vista.
- **Si no pides otro estilo**, sale con el mismo look de tu video: como UGC si alguien habla a cámara, o con narrador si una voz cuenta sobre escenas. **Si pides uno** (Pixar, musical, plastilina, UGC…), se hace con ese estilo de siempre, con el guion de tu video condensado a la duración que pediste (se mantienen la estructura, el gancho, el ángulo y las frases clave; nunca se corta el final).
- **El mejor modelo para cada escena:** las escenas donde alguien habla con Omni, el B-roll con uno más barato (Grok Imagine 1.5), el paso del antes al después con PixVerse… Si un modelo falla, sigue solo con el siguiente.
- **Antes de gastar ves todo:** lo que entendió de tu video y tu pedido (estilo, duración, lo que se mantiene y lo que cambia), el guion, qué modelo hace cada escena y el costo. Nada se genera hasta que tocas «Me gusta, producir».

## 2026-11-17k · Editor: el audio como en CapCut (silenciar o ponerle pitido a una palabra)

- **Nueva pestaña «Audio»** (panel de la izquierda): ves todo lo que dice la voz, palabra por palabra. **Toca una palabra** y elige **Silenciar** o **Pitido** solo para esa. Es gratis y no usa la IA.
- **Buscar una palabra:** escribe, por ejemplo, **AMUA** y la app la encuentra todas las veces que se dice (aunque tenga tilde, mayúsculas o el reconocedor la haya partido en «a mua»). Con un toque: **«Silenciar todas»** o **«Pitido en todas»**.
- **Editar con IA** entiende «**Lo que diga AMUA mutearlo**» (mutear, silenciar, callar = silencio; censurar, pitido, bip = pitido) y lo hace al instante, gratis, sin gastar tu IA.
- **Pista «Censuras»** en la línea de tiempo: cada palabra censurada o tramo silenciado se ve ahí (y tachado sobre la voz). Arrastra sus bordes para alargarla o acortarla, muévela, bórrala, o cámbiala entre **pitido y silencio** en el panel de la derecha.
- **Silenciar un tramo a mano:** el botón **+** de la pista Censuras (o «Silenciar un tramo» en la pestaña Audio) calla la voz desde donde está el cursor; después ajustas sus bordes.
- **La voz por partes:** elige la voz y **divídela** (Ctrl B) para darle a cada parte su propio **volumen** (o silenciarla), con **fundido de entrada y de salida**. La voz no se mueve: todo el anuncio la sigue.
- **Volumen de cada clip** que tiene sonido (tu video, o las escenas de UGC y estilos hablados, donde la voz va dentro del clip).
- **Tus audios:** arrastra un **efecto de sonido** o cualquier audio (MP3, WAV, M4A) a la nueva pista «Audio»: lo mueves, lo recortas, lo divides, lo duplicas y le cambias el volumen y los fundidos.
- **Tus videos subidos sin «Subtítulos»:** en la pestaña Audio aparece **«Transcribir la voz (unos centavos)»**: la escucha ElevenLabs una sola vez y ya puedes buscar y censurar lo que se dice.
- Además, lo básico que faltaba: **duplicar** un texto, una imagen o un audio (botón o Ctrl D), **congelar la imagen** de una escena 1,5 s donde está el cursor, **brillo, contraste y saturación** de cada clip (hasta blanco y negro) y **fundido a negro** al comenzar y al terminar el video.
- Todo se deshace con Cmd/Ctrl+Z y lo que ves en la vista previa es lo que sale en el video descargado.

## 2026-11-17j2 · Lo último arriba y eliminar lotes de imágenes

- **Lo más reciente arriba:** en Anuncios, el Editor y Anuncios de imagen, lo último que creaste **o cambiaste** (un cambio en el editor, una imagen nueva, una corrección) sube al primer lugar.
- **Eliminar lotes en Anuncios de imagen:** cada lote que no se esté creando tiene **Eliminar**. Pregunta antes y no borra nada: el lote y sus imágenes quedan guardados aparte (temp/_descartados) por si los necesitas. Los borradores (sin nada hecho) se siguen borrando del todo.

## 2026-11-17j1 · Descargar y guardar del editor, más rápido

- **Exportar es más rápido:** en la Mac la app armaba el video de a un cuadro por vez porque la Mac informa poca memoria libre; ahora usa varios a la vez según tu equipo (si falta memoria, baja sola). También codifica más rápido, con la misma calidad. En la prueba, un video de 38 s pasó de 76 a 57 s, y en una Mac la mejora debería ser mayor.
- **Lo mismo no se arma dos veces:** si descargas y después tocas «Guardar» (o descargas otra vez) sin cambiar nada, el video sale al instante: la app reutiliza el que ya hizo.

## 2026-11-17i · Alargar un texto que sigue al video ahora se ve

- Si un texto, una imagen o una censura sigue a algo del video (por ejemplo «VITALABH» encima de «AMUA») y lo alargas en la línea de tiempo porque le faltó un poco, ahora **también se ve en el video**: pasado el último lugar donde se vio lo de abajo, se queda quieto ahí hasta el final que elegiste (y lo mismo si lo alargas hacia el comienzo). Antes se alargaba en la línea de tiempo pero desaparecía en el video.

## 2026-11-17h · Mueve todo libremente en el editor

- **El video de cada escena:** arrástralo en la vista previa para moverlo, y acércalo o aléjalo con Ctrl/⌘ + rueda del mouse (o pellizcando en el trackpad), o con los botones de lupa de la barra de herramientas. El botón de centrar lo deja como estaba. También sirve con las imágenes de apoyo.
- **Textos e imágenes** van a cualquier parte del cuadro, sin topes; los **subtítulos** también llegan más arriba y más a los lados.
- **Las censuras** y lo que sigue a algo del video también se arrastran: se corren respecto de lo que siguen.
- En podcast y entrevista, los **íconos y textos** de la escena también se pueden mover.
- Un clic sobre el video sigue reproduciendo o pausando; solo se mueve si arrastras.

## 2026-11-17g · Editor: barra de herramientas junto al video

- A la derecha del video, una barra de herramientas limpia, como en los editores profesionales:
  - **Zona segura** de **Meta** o de **TikTok**: muestra lo que tapan los botones y textos de cada app, para que tus textos no queden debajo.
  - **Cuadrícula** de tercios con el centro marcado, para acomodar textos y logos.
  - **Pincel para censurar.**
  - **Guardar este cuadro** como imagen (para una portada o como referencia de un anuncio de imagen).
  - **Velocidad de la vista previa:** 1×, 1,5×, 2× o 0,5×. Solo cambia cómo la ves, no el video.
- La barra de abajo del video queda más despejada.

## 2026-11-17f · Pincel para censurar en el editor

- Debajo del video, **«Pincel para censurar»**: el video se pausa, pintas encima de lo que quieres tapar (un logo, una marca, un texto, una cara) y tocas **Censurar**. La app lo busca y lo sigue sola, hacia adelante y hacia atrás, mientras dure esa escena, y lo difumina de forma discreta. Es gratis: se hace en tu computador.
- Queda como una capa más en la línea de tiempo: puedes moverla, alargarla o borrarla, y deshacerla con Cmd+Z.

## 2026-11-17e · Eliminar anuncios y marcarlos como ganadores

- En **Editor** y en **Anuncios**, debajo de cada anuncio: el trofeo **«Me funciona»** (para hacer variantes ganadoras en Anuncios de imagen) y **Eliminar**. Eliminar pregunta antes y no borra nada: el anuncio y sus videos quedan guardados aparte por si los necesitas recuperar.

## 2026-11-17d · El editor ya no avisa «Deshacer» al borrar

- Al borrar un texto, una escena, la música o un pedazo del video en el editor, ya no sale el aviso «Borraste… toca Deshacer». Para deshacer usa Cmd+Z (Ctrl+Z en Windows) o la flecha de arriba.

## 2026-11-17c · Las imágenes respetan el ángulo y el gancho de la referencia

- **Lee el ángulo y el gancho de cada referencia antes de diseñar:** qué zona del cuerpo o qué deseo vende (glúteos y curvas, barriga, piernas hinchadas, tos…), qué la hace parar el scroll (antes y después, promesa, número o días, pregunta, testimonio) y cómo lo muestra. Tu imagen vende **lo mismo y de la misma forma**: si la referencia de VitalDrops es de glúteos, la tuya es de glúteos.
- **Antes y después que se note:** el cambio es grande y se ve de un vistazo, en la misma zona del cuerpo (en glúteos: plano antes, más redondo y levantado después), con la misma persona, pose, ropa, cámara y luz, para que lo único distinto sea el resultado. Siempre con ropa (leggings, jeans o vestido).
- **El título va con el gancho:** si el título de tu investigación no dice lo mismo que la referencia, se escribe el gancho de la referencia adaptado a tu producto (la misma idea, el mismo número o los mismos días).
- Ya no se le asigna a cada imagen un ángulo distinto que podía chocar con el de la referencia.

## 2026-11-17b · Edita tus videos con tus palabras

- **Editar con IA, debajo del video en el editor:** escribe lo que quieres y la IA lo hace. Por ejemplo:
  - «Todo lo que diga AMUA se censura»: la voz calla en esa palabra y suena un pitido, cada vez que se dice. Con «silencia» solo calla, sin pitido.
  - «Donde diga AMUA coloca VITALABH»: un texto nuevo que sigue al de la pantalla y lo tapa.
  - «Donde diga AMUA pon algo que lo siga y no lo deje ver»: una caja (del color que digas) que sigue a ese texto.
  - «Recorta las escenas donde sale el frasco»: la IA mira un cuadro de cada escena y quita las que lo muestran. En tus videos subidos el corte es de verdad (imagen y sonido).
  - Y textos nuevos en un lugar o momento («ENVÍO GRATIS arriba en todo el video»).
- Todo entra de una vez: **Ctrl+Z lo deshace**. Las censuras se quitan con un toque en «N censuras».
- Si el pedido es sobre un texto de la pantalla y todavía no se leyó, la app lo lee sola (gratis, en tu computador) y sigue.
- Límites: censurar necesita las palabras de la voz (los anuncios de la app las tienen; tus videos, si los subiste con «Subtítulos»). En los estilos podcast y entrevista todavía no se puede censurar, y donde la voz va dentro de las escenas (UGC) no se quitan escenas, solo imágenes de apoyo.

## 2026-11-17a · Solo referencias ganadoras, y las tuyas se agregan pegando o subiendo

- **Solo ganadoras (validadas):** en «Elegir de tu biblioteca», la pestaña ahora se llama **Ganadoras** y solo tiene anuncios que funcionaron: más de 100.000 personas alcanzadas o activos hace 30 días o más. Se quitaron 22 que no cumplían (todas las de aguaje de antes y las de Amua que duraron un día). Se sumaron 6 de Amua/VitalDrops activas hace más de 110 días y 2 de aguaje activas hace más de 80 (Peguero Market y Le Monet). Quedan 53.
- **Agrega las tuyas:** elige la categoría (o crea una nueva), opcionalmente la marca, y sube imágenes o **pega lo copiado** (Ctrl+V, ⌘V en Mac). Las tuyas salen primero.
- **Borra las que no quieras:** el botón de la papelera en cada una; se toca dos veces para confirmar.

## 2026-11-16m · Anuncios de imagen rápidos, sin elegir títulos, y referencias de marcas que están funcionando

- **Rápido, como pedirle a ChatGPT que te las varíe:** cada imagen sale de tu referencia y la foto de tu producto, con un título distinto, sin esperar a la IA de texto. Antes un lote de 5 tardaba 15-20 minutos (títulos, estrategia y revisión de cada imagen); ahora solo lo que tarda en hacerse cada imagen. Si quieres lo de antes, activa «Más elaborado (más lento)».
- **Ya no se eligen títulos:** salen de los ganchos validados de tu investigación con TrendTrack y, si no hay, de los beneficios de la ficha del producto. Uno distinto por imagen.
- **Referencias de tendencia para elegir:** en «Elegir de tu biblioteca» hay una pestaña nueva, **Tendencias**, con 67 creativos de imagen de marcas de salud que están funcionando (Amua/VitalDrops, aguaje y curvas, drenaje linfático, pulmones y mullein, suplementos), por categoría y con su alcance. Los eliges como cualquier referencia; la IA hace tu versión sin copiar marcas ni textos.
- **3 estructuras más para los videos**, vistas en esos creativos: «roncar mata matrimonios», «aviso oficial: no lo compres en…» y «subirse a la tendencia del momento» (GLP-1 + producto).

## 2026-11-16l · Lo que está funcionando en TrendTrack, dentro de tus guiones

- **6 estructuras nuevas aprendidas de anuncios que están creciendo ahora** (Meta, noviembre 2026): «una sola dosis: lo que pasa en las próximas 72 horas» (se repite en 5 marcas de suplementos, también de mullein), «no lo tomes hasta que conozcas la regla de…», «personaje 3D con tres señales → experto», «ese dolor no es lo que crees… y hay tres señales más», «lo que pasa si lo usas 60 días» y «ningún suplemento cura esto». Ya son 23 estructuras para elegir.
- **Esqueleto con diseños nuevos:** el esqueleto verde caricatura dentro de un cuerpo de vidrio con los síntomas marcados, la anatomía realista en corte, el órgano sobre un cuerpo real y más. La IA los usa para variar, sin copiar marcas ni textos.
- Quedan en `mis_archivos/estructuras/` y `mis_archivos/tendencias/`, con la evidencia (alcance y crecimiento) de cada uno.

## 2026-11-16k · Guiones con tu investigación de mercado y estructuras variadas

- **Los guiones de video ahora leen tu investigación de mercado:** antes solo la usaban los anuncios de imagen. La IA saca de ahí el deseo principal, el beneficio principal, los dolores, las objeciones y las palabras de tu cliente, y con eso escribe el gancho, contesta la objeción y cierra con el beneficio. Sin investigación, usa lo que haya (ficha, página, lo que contaste) y no inventa datos.
- **Estructuras de todos los estilos para cualquier estilo:** un catálogo de 17 estructuras (problema oculto, Día 1 → Día 30, ¿qué le pasa a tu cuerpo si…?, la alternativa fallida confiesa, mito vs. realidad, la objeción primero, testimonio…). Para cada anuncio la IA elige la más adecuada: la de la referencia si es una variante de un video; si es desde cero, la que mejor encaja con la investigación y el tipo de producto. Ya no sale siempre la misma del estilo.
- **No repite lo que ya hiciste:** la IA ve los últimos anuncios del mismo producto (estilo, estructura y decisiones) y evita repetir la estructura y el diseño del personaje. En Esqueleto, además, varía la variante, el escenario y el vestuario.
- La estructura elegida y el porqué quedan anotados en cada guion.

## 2026-11-16j · Las imágenes de tus videos con tu ChatGPT

- **Nueva opción en Ajustes → Conexiones → «Videos, música e imágenes de los videos»:** «Imágenes de tus videos: kie.ai o Mi ChatGPT». Con ChatGPT no se cobra cada imagen (en un claymation de ejemplo el estimado baja de US$4,36 a US$3,36).
- **Nunca se frena:** si una imagen no sale con ChatGPT, o se acaba el uso de tu suscripción, esa y las que falten se hacen con kie.ai (se cobran) y el anuncio sigue.
- El costo estimado lo cuenta solo: las imágenes de ChatGPT van en US$0. Los iconos con fondo transparente siguen con kie.ai.

## 2026-11-16i · «Actualizar» ve al instante todo lo publicado

- **Siempre ve lo publicado:** «Actualizar» compara contra lo publicado en GitHub (`main`), esté tu carpeta en la rama que esté. Antes, si la carpeta había quedado en otra rama, lo nuevo nunca aparecía.
- **Más rápido:** revisa cada 2 minutos (antes cada 10) y, al abrir «Actualizar», pregunta a GitHub en ese momento.
- **Franja arriba:** apenas hay algo nuevo aparece «Hay N cambios nuevos publicados» con **Actualizar ahora** (y «Después»). La app se reinicia sola si hace falta y la página se recarga.

## 2026-11-16h · Ajustes rediseñado: más compacto y ordenado

- **Una sección a la vez:** el menú de la izquierda (arriba en el celular) cambia de sección en vez de bajar por una página larguísima. El enlace guarda la sección (`#/ajustes?seccion=modelos`).
- **Más compacto:** cabecera más baja, títulos más chicos, menos relleno en las tarjetas, filas de Modelos más bajas, Tu PC y Acerca de más chicos. La ilustración grande de «Tu IA» se quitó de Ajustes (sigue en la bienvenida).
- Mismos colores, fuentes, logo y textos de Kads; en claro y en oscuro.

## 2026-11-16g · Anuncios de imagen: Nuevos con lo que ya te funciona, y notificaciones en modo claro

- **«Nuevos» aprende de lo que ya te funciona:** además de tu investigación y la foto del producto, la IA mira sola tus anuncios validados («Me funciona», los de este producto primero, y tu biblioteca de referencias) para elegir formatos, estructuras y ganchos que te funcionan. Crea diseños nuevos con eso; no los copia.
- **«Variantes» siempre sale de algo que ya te funciona:** sin un creativo elegido no arranca, y esos creativos ya no se duplican en tu biblioteca de referencias.
- **Sin investigación igual puedes generar**, con un aviso claro de que los títulos y ángulos salen menos precisos y un botón para investigar primero.
- **Se quitó «Variar solo los títulos» de Nuevos:** hacía lo mismo que Variantes.
- **Modo claro:** las notificaciones, los tooltips, el panel de una pieza en Producción y el índice de Ajustes en el celular ya no quedan oscuros (el texto no se leía).

## 2026-11-16f · Correcciones de la revisión técnica (sin cambios en cómo se crean los anuncios)

- **La app en un servidor ya deja producir:** producir, editar, exportar, rehacer, la canción, los modelos y «Actualizar» respondían «Solo desde la app» cuando se entraba por el dominio del servidor. Ahora hay un solo control para toda la app, que además protege rutas que antes no lo tenían.
- **No se paga dos veces si se pierde la respuesta de kie.ai:** si el pedido de una imagen o un video llega a kie.ai y la respuesta se corta, la app ya no pide otra sola (podía cobrar las dos). Se detiene esa pieza y te dice que mires en kie.ai si se creó.
- **La música desde la terminal tampoco se paga dos veces:** `npm run musica` y `npm run cancion` ahora retoman la misma tarea de Suno si el proceso se corta, y un corte de internet de unos segundos ya no corta la espera.
- **El guardado en GitHub es más confiable:** los archivos con tildes o espacios ahora respetan el tope de 45 MB, un archivo que ya estaba en GitHub y creció de más ya no traba la subida, y si GitHub tiene cambios de otra máquina sobre los mismos archivos te lo dice claro.
- **Abrir un anuncio guardado en Drive ya no congela la app** mientras trae los videos de vuelta.
- **Tus claves**: el archivo `.env` queda legible solo por tu usuario.
- **La pantalla consulta menos**: con la pestaña oculta deja de preguntar al servidor y no repite el mismo pedido desde el menú, la barra y el tablero.
- **La guía de producción** (`COMO-PRODUCIR.md`) ya no nombra comandos que no existen (`arrancar`, `revisar:imagenes`) y los topes de velocidad (`CONCURRENCIA_IMAGENES`, `CONCURRENCIA_VIDEOS` en el `.env`) ahora sí se leen.

## 2026-11-17a · Censura difuminada en el editor

- Cuando pides en el editor «censura», «tapa» o «difumina» un texto del video (por ejemplo una marca), ya no sale un recuadro de color: sale un difuminado discreto que sigue al texto, con los bordes suaves que se funden con el video. No se lee y no se ve feo. Las censuras que ya tenías también pasan a verse así.
- Si quieres una caja de color, pídela con su color («una caja roja que tape AMUA») y sale sólida como antes.

## 2026-11-16e · Anuncios de imagen: Nuevos, Variantes y «Me funciona»

- **Menos preguntas:** el formulario ya no pide precio, moneda, llamado a la acción, idioma (siempre en español), ángulo principal ni logo.
- **Títulos con ganchos ya validados:** los títulos juegan con los ganchos de la segunda parte de tu investigación (TrendTrack, «Base de hooks»), primero los menos saturados. Cada título dice de qué gancho sale y su evidencia.
- **Nuevos o Variantes:** arriba eliges. «Nuevos» crea de cero. «Variantes» sale de algo que ya te funciona y conserva su diseño, tipografía, posición de los textos y enfoque; si es de otro producto, adapta los colores al tuyo.
- **«Me funciona» (trofeo):** en cada imagen de tus lotes y en la entrega de cada video. Lo marcado aparece en «Variantes», con filtros por imágenes o videos y por producto, para elegir de cuáles sacar más.

## 2026-11-16d · Investigación con TrendTrack en modo claro

- La segunda parte de la investigación de mercado (la competitiva con TrendTrack, las 6 etapas) ahora también cambia con el modo claro y oscuro. Los colores siguen diciendo lo mismo (verde libre, ámbar medio, rojo saturado, azul dato), en tonos que se leen bien sobre blanco.

## 2026-11-16c · La pantalla nueva llega sola

- Si el guardado automático trae una versión nueva desde GitHub, la app ahora vuelve a armar la pantalla sola y te avisa arriba con «Recargar». Antes, Ajustes decía la versión nueva pero se seguía viendo la vieja (por ejemplo, sin el botón del modo claro).
- «Actualizar» también lo nota: si ya bajó todo pero falta armar la pantalla, lo hace y te pide recargar.

## 2026-11-16b · Modo claro y modo oscuro

- **Modo claro:** botón de sol/luna arriba a la derecha para cambiar en un toque. En Ajustes → Apariencia eliges Claro, Oscuro o Automático (igual que tu computador, cambia solo).
- **Todo legible en los dos:** textos, botones, tarjetas, semáforo del saldo, avisos y errores tienen su color para cada tema. El verde lima queda como fondo de los botones; sobre fondo claro, los textos verdes van en un verde más oscuro.
- El editor de video va siempre oscuro, para ver bien los colores del video. Lo que elijas se guarda en este navegador.

## 2026-11-16a · Variaciones fieles y títulos elegidos

- **Primero los títulos:** antes de generar imágenes, la IA propone títulos basados en la investigación de mercado y lo resaltado. Muestra la esencia que se conserva, el motivo de cada título y su base. Tú seleccionas los que usará el lote; después confirmas el costo y generas.
- **Variar solo los títulos:** conserva el diseño, la escena, el beneficio y la razón de compra de la referencia. No pide cambiar a otros ángulos ni rehace los textos secundarios entre variaciones.
- **Menos trabajo repetido:** las propuestas se reutilizan si no cambian las entradas. Las variaciones de una misma referencia comparten una plantilla visual validada; se cambia el título sin otra sesión para redactar cada prompt. Se conserva la generación simultánea que ya tenía el motor.
- Las comprobaciones rechazan títulos distintos de los elegidos y propuestas de entradas antiguas. Los lotes anteriores pueden continuar como antes.

## 2026-11-15a · Investigación de mercado

- **Investigación de mercado:** sección nueva. Con la foto de tu producto, la IA investiga su mercado (qué quiere tu cliente, qué le duele, tu competencia y con qué mensajes venderlo). Se hace una vez por producto y funciona con Claude.
- **Informe visual:** veredicto, deseo central, beneficio principal y dolores con gráficas; puedes resaltar lo que te importa.
- **Anuncios de imagen** usan sola la investigación del producto, con lo que resaltaste primero.
- **Imagen rechazada por contenido:** la sugerencia conserva la misma escena y cambia solo las palabras que frenan.

## 2026-11-15 · Editor, textos con IA y anuncios de imagen

- **Actualizar con un clic:** si instalaste la app con el comando, el botón «Actualizar» de arriba ahora baja la última versión publicada y la deja lista. Tus anuncios, tus claves y tus ajustes no se tocan.
- **Editor de videos:** la sección «Editor» edita cualquier video tuyo. Puedes cortar escenas (el video queda más corto), deshacer y rehacer, y alargar cuánto duran los textos e imágenes que agregas.
- **Textos con IA y seguimiento:** en la pestaña Textos del editor escribes lo que quieres («ENVÍO GRATIS arriba en todo el video», «en la escena 5 pon OFERTA abajo», «AMUA encima de "muna"») y la IA los pone, también siguiendo un texto que se ve en el video.
- **Imagen rechazada por contenido:** cuando el modelo no acepta una imagen, la tarjeta muestra su descripción para cambiarla o pedir una versión que sí pase, sin perder la escena.
- **Anuncios de imagen:** investigación de mercado (deseo central, beneficio principal y puntos de dolor), «Más de lo mismo» (copia el diseño y la tipografía de tu referencia), biblioteca de referencias y pegar imágenes copiadas.
- El instalador de Mac abre la app aunque macOS no abra la aplicación recién creada.

## 2026-11-11b · Carpeta de guardado

- En **Ajustes → Guardado** puedes elegir entre este computador, la detección automática de Google Drive o una carpeta sincronizada de Google Drive, Dropbox o OneDrive. Puedes elegirla con una ventana de Mac/Windows o pegar su ruta.
- La selección es propia de cada computador. La app sigue usando espacio temporal local mientras produce y edita; la aplicación de nube sincroniza las copias.
- Las nuevas carpetas de nube conservan una copia local por defecto. Puedes liberar espacio de los anuncios de video terminados después de comprobar su copia. Los lotes de imágenes, Cambiar el producto y Sketch también se respaldan, conservando sus archivos locales.
- Cambiar de destino conserva la ubicación de cada archivo archivado anteriormente. Las copias y recuperaciones se verifican por contenido, y el registro se guarda antes de liberar espacio.

## 2026-11-11 · Kads Studio

Actualización funcional del paquete 2026-11-10, conservando la marca, los colores, las fuentes y la estructura visual de Kads Studio.

- **Claude o ChatGPT:** conexión e instalación desde Ajustes, con las cuentas del usuario. Los guiones, las revisiones y las herramientas propias respetan la IA elegida.
- **Anuncios de imagen:** lotes de 1 a 100 anuncios, referencias, logo, versiones cuadradas y verticales, regeneración y descarga individual o en ZIP. El costo se muestra y se confirma antes de generar o regenerar.
- **Modelos y costos:** selección por categoría en Ajustes y antes de aprobar el guion. Los precios usan la resolución efectiva del motor; se conserva el video final en 1080p y el saldo con semáforo.
- **Revisión sin gastos automáticos:** los problemas de calidad quedan como avisos. Cada pieza permite descargar, regenerar, contar qué cambiar o aplicar la sugerencia de la revisión, con su costo a la vista.
- **Editor:** reemplazar clips por videos propios, ajustar velocidad y contenido visible, restaurar el original y descargar el video con los cambios del editor.
- Se conservan Realista con narrador, subestilos, clonación, Cambiar el producto, Sketch, Más ganchos, biblioteca, aprendizajes, guardado en la nube y los mensajes detallados de errores.

## 2026-11-08 · App-nube

Lo de IA-VID-AUTOMATIC que le faltaba a esta app, sin cambiar cómo genera (igual de rápido, sin presupuestos ni costos estimados nuevos).

- **Estilo nuevo: Realista con narrador** (personas que parecen reales, grabadas como con un celular, y la voz de alguien cercano).
- **Subestilos**: formas probadas de 7 estilos, sacadas de anuncios reales que venden. Se eligen en el formulario del estilo; al pasar el mouse se ve su referencia. El motor manda el fotograma de cada imagen junto con el prompt.
- **Clonar un video**: en los ajustes de cualquier estilo (menos los cantados), sube el video de un anuncio que funciona o pega su link. Se copia cómo está armado, con tu producto.
- **Más ganchos**: en la entrega de un anuncio con narrador terminado, de 2 a 5 versiones con otro inicio. Solo se hace el gancho nuevo.
- **Especiales** en Estilos (Clonar, Más ganchos y Sketch de comedia; el Sketch, por ahora, desde Claude Code).
- **Clips sin cobro**: el B-roll que no necesita acción se arma desde su imagen ("quieto") y los clips guardados se reutilizan (biblioteca de clips).
- **Aprendizajes**: lo que hubo que rehacer se anota solo y se le pasa a Claude en el siguiente guion.
- **Guardado en la nube** (Ajustes): todo a GitHub cada 2 minutos; los videos y audios, a Google Drive.
- **Inversión** (Ajustes): lo que ya gastaste de verdad en cada producto.

## 2026-11-06

La primera versión de la app para alumnos.

### Lo principal

- Una app que se abre con doble clic, en Windows y en Mac, y funciona en tu propia computadora.
- Le das tu producto (una foto y, si quieres, el enlace de su página) y la app escribe el guion, hace las imágenes, los videos, la voz y la música, y arma el anuncio terminado.
- 12 estilos: Claymation, Crochet, Zack D Films, Estilo Pixar, Esqueleto, Estilo Lego, UGC, Objeto parlante, Podcast, Entrevista callejera, Musical e Historia musical. Más el efecto Continuidad, para que las escenas pasen de una a otra sin cortes.
- Cada estilo trae un video de muestra para que veas cómo queda antes de elegirlo.
- Varios anuncios a la vez, y si cierras la app a mitad de camino, al volver a abrirla sigue sola donde quedó.
- Un editor para retocar el anuncio terminado: textos con color, fondo, tamaño, posición y letra; recortar, mover y borrar tomas, B-roll, textos y música; deshacer y rehacer.

### Para instalar

- Descomprime el zip y abre «Abrir Anuncios con IA.bat» (Windows) o «Abrir Anuncios con IA.command» (Mac). El LEEME.md tiene los pasos.
- La primera vez el lanzador instala solo lo que le falte a tu computadora. Tarda un rato: déjalo terminar.

### Para actualizar más adelante

- Las versiones nuevas se instalan desde la app: Ajustes, Acerca de, «Actualizar la app». Tus anuncios, tus claves y tus ajustes se quedan como están.
