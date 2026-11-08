# Lecciones de producción (pruebas reales, octubre de 2026)

Producto de prueba: Nature's Sunshine Lymphatic Drainage. Sketch "El baby shower", 19 tomas, Colombia. La v2 quedó aprobada por el cliente.

1. **Miradas:** sin un mapa de ejes, los primeros planos miran al lente y los cortes no "conversan". Hay que fijar los lados, usar planos sobre el hombro o con el hombro del otro en el borde, y revisar las caras en los fotogramas y en los clips.
2. **El mensajero no le habla a la cámara.** Le habla a la víctima, y solo el frasco va de frente.
3. **Parpadeos:** Omni puede meter cortes de cámara dentro de un clip. Hay que pedir "one single continuous shot" y que el montaje detecte y esquive los cortes internos.
4. **Voces:** sin un bloque explícito de quién habla (por su aspecto) y quién calla, el modelo agrega voces. En las tomas mudas, ese bloque más el reemplazo del audio por ambiente verificado con VAD: un clip "sin voces" traía un diálogo de telenovela en inglés.
5. **Efectos en edición:** el flash y el obturador que el modelo no genera se hacen en edición, sincronizados. Es más confiable que pedírselo al modelo.
6. **Producto:** descríbelo por su forma real (frasco ámbar, gotero negro, bulbo de goma) y pasa la foto como referencia. "Un frasco" a secas se volvió un biberón en una fiesta de bebé, y en otra toma salió sin gotero.
7. **Packshot:** siempre con la imagen fija y un push-in en edición. El modelo de video deforma la etiqueta ("Lymphotic Droinage").
8. **Filtros de Omni:**
   - "Minors": bebé, embarazada, manos en la panza o caras muy jóvenes. Se evita con el aviso de edades y edades explícitas.
   - "Real brands": "label facing the camera" en el prompt de video. Se dice "its front facing the camera".
   - Los bloqueos no se cobran.
9. **Transcriptor:** el modelo `medium` alucinó en bucle ("¿qué es lo que ha pasado?") sobre una línea correcta, y otras veces corta los susurros. Antes de culpar al clip, verifica con `large-v3`. Whisper también alucina sobre el silencio ("Gracias por ver el video", "you", "Teksting av…"): manda la VAD.
10. **El modelo improvisa repeticiones** ("almorcé bastante… almorcé bastante"). A veces funcionan como actuación. Decide toma por toma: si suma, déjala; si no, el corte por anclas la recorta.
11. **Costos reales:** GPT Image 2 cuesta 10 créditos por imagen a 2K y Omni Flash 63/84/105 créditos (4/6/8 s). El anuncio completo, con algunas repeticiones, salió en ≈ 1.900 créditos.
12. **Música:** se nivela (la canción tiene subidas fuertes), va unos 15 LU bajo el diálogo y lleva ducking. A 18 LU ya quedaba demasiado baja.
13. **Sincronía al unir:** unir partes AAC con `-f concat -c copy` atrasa la voz unos 21 ms por toma (0,34 s al final de un anuncio de 62 s), y los labios se adelantan a la voz. `montaje.py` une con el filtro `concat` y `revision.py` mide la sincronía de cada toma. Pasó en la primera entrega de la v2 y se corrigió.
14. **Picos:** el limitador tiene que ir después de remuestrear a 48 kHz (`loudnorm` trabaja internamente a 192 kHz). Si no, la versión con música llegó a +1,3 dBFS.
15. **El público perdona la continuidad, no el aburrimiento:** primero el ritmo y el chiste, después la perfección. Pero los errores que rompen la ilusión de conversación (miradas, voces, parpadeos) sí se notan y hay que corregirlos.
