# Cómo se produce un anuncio

Guía operativa para Claude Code. **Léela entera antes de generar nada.**

Cada regla de aquí salió de un anuncio real que salió mal. No son preferencias.

Todo lo que se genera se paga en las cuentas del propio usuario:

| Servicio | Para qué | |
|---|---|---|
| **kie.ai** | las imágenes, los videos, la música de fondo y las canciones (Suno) | **obligatorio**, con saldo cargado |
| **ElevenLabs** | la voz en off y las transcripciones (subtítulos de los estilos hablados, revisión del habla, voces coladas, tiempos de las canciones) | **obligatorio** |

Las claves viven en el `.env`, que **no se abre** para mirarlas: `npm run
verificar` dice si están cargadas (su punto 2) y si kie.ai responde (punto 3),
sin mostrarlas.

---

## 1. El flujo, de principio a fin

La skill del estilo hace la parte creativa —guion, prompts, manifiesto— y deja
un archivo `temp/[slug]/manifiesto.json`. Ese paquete queda interno: en el chat
el usuario ve un resumen corto y elige entre tres opciones (ver *Al terminar la
skill*, al final de esta sección). **Cuando elige producir, de ahí en adelante
el proceso es este**, y el orden importa:

```
npm run preparar    -- "<ruta de la foto>" [slug]   deja la foto del producto lista
npm run validar     -- temp/[slug]/manifiesto.json
   ... el COSTO de todo el anuncio, y esperar el sí (1.1) ...
npm run imagenes    -- temp/[slug] --si    las imágenes (en paralelo con la voz y la música: sección 14.4)
npm run audio       -- temp/[slug]          la voz en off
npm run musica      -- temp/[slug] --si     la música de fondo (sección 3)
   ... REVISAR CADA IMAGEN con Read antes de los videos (sección 14.3) ...
npm run videos      -- temp/[slug] --si
npm run revisar     -- temp/[slug]
   ...aquí van la MÚSICA y las TRANSICIONES (secciones 3 y 4) ...
npm run plan        -- temp/[slug]
npm run subtitulos  -- temp/[slug]          en dialogo_nativo: node produccion/subtitulos-dialogo.js temp/[slug]
npm run plan        -- temp/[slug]          OTRA VEZ. No es un error
npm run ensamblar   -- temp/[slug]
```

Ese es el flujo de los estilos de voz en off —crochet, claymation, zack-d-films,
estilo pixar, esqueleto y estilo lego— y del objeto parlante. Los demás cambian
el arranque o el medio:

| Estilo | Su flujo |
|---|---|
| **musical** | el de arriba, con la canción primero (abajo) |
| **historias musicales** | la canción primero (abajo) y la sección 9 |
| **estilo lego** | el de arriba, con lo propio de la sección 10: la voz la elige el usuario, se nivela sola, y la música es fija |
| **UGC** | sección 11: bloques hablados, sin B-roll, con su propia revisión |
| **podcast** y **entrevista** | sección 12: tomas habladas, sin música ni transiciones |
| **continuidad** (efecto, va encima de un estilo de voz en off) | sección 13: reemplaza el proceso de producción del estilo |

`npm run imagenes`, `npm run audio` y `npm run musica` no dependen entre sí: se
pueden correr a la vez, en tres terminales, y cobran lo mismo que en fila.
(`npm run producir -- temp/[slug] --si` encadena imágenes, voz y videos en un
solo paso, pero se salta la revisión de las imágenes: úsalo solo si el usuario
lo pide.) Antes esta guía nombraba `npm run arrancar`, que no existe.

`npm run revisar` lista los clips generados con su duración. En la terminal de
Claude Code no puede preguntar nada: la aprobación es la del usuario en el
chat, después de verlos.

**En el estilo musical el arranque es otro**, porque la canción existe antes que
el manifiesto y su duración es la del anuncio:

```
npm run cancion  -- temp/[slug] --solo-plan   el costo en kie.ai, sin gastar; se espera el sí
npm run cancion  -- temp/[slug] --si          genera las 2 versiones que da Suno
npm run cancion  -- temp/[slug] --elegir N    fija la que eligió el usuario
   ... aquí la skill visual escribe el manifiesto ...
npm run tiempos  -- temp/[slug]               mide la letra y escribe audio/tiempos.json
```

Y de ahí sigue igual, desde el costo de las imágenes y los videos y `npm run
imagenes`. En musical **no se corre `npm run audio` ni `npm run musica`**: los
dos se niegan solos y te dicen por qué.

**En historias musicales el arranque es el mismo que en musical, con dos pasos
más**, porque la canción dura 4-10 minutos y cada línea de la letra es una toma:

```
npm run cancion  -- temp/[slug] --solo-plan     el costo en kie.ai (dos estilos y, si los hay, los bloques de extend)
npm run cancion  -- temp/[slug] --si            genera 4 versiones (2 estilos × 2)
npm run cancion  -- temp/[slug] --elegir N      fija la que eligió el usuario y, si la
                                                letra iba en bloques, la extiende sola
npm run tiempos  -- temp/[slug] --lineas        mide cada línea de cancion/lineas.txt
   ... aquí la skill escribe el manifiesto con esas ventanas ...
npm run tiempos  -- temp/[slug]                 escribe audio/tiempos.json
```

Y de ahí sigue igual desde `npm run validar`. La sección 9 tiene el detalle.

### 1.1 La parada del costo: `--solo-plan`, el sí y `--si`

**Cuatro comandos cobran en kie.ai: `imagenes`, `videos`, `musica` y
`cancion`.** Sin `--si`, cada uno muestra el costo y pide la confirmación en la
terminal; en la de Claude Code nadie puede contestarla, y el comando se corta
sin generar nada. Por eso van siempre así:

1. El costo, sin gastar: con `--solo-plan` (o el comando de la tabla de abajo).
2. Se le dice al usuario en dólares y **se espera un sí**.
3. Con el sí, el mismo comando con `--si`.

**Donde este documento o una skill escribe `npm run imagenes`, `videos`,
`musica` o `cancion` sin marcas, va así.** Lo natural es una sola parada para
todo el anuncio —las imágenes, los clips y la música van juntos— y después
correr cada comando con `--si`, en su lugar del orden, sin volver a preguntar.

Qué dice el costo antes de generar, según el estilo:

| Estilo | El costo sale de |
|---|---|
| voz en off (crochet, claymation, zack-d-films, estilo pixar, esqueleto, estilo lego), objeto parlante, musical, historias musicales | `npm run imagenes -- temp/[slug] --solo-plan` (las imágenes) + `npm run estimar:video -- temp/[slug]` (los clips) + `npm run musica -- temp/[slug] --solo-plan` donde la música se genera (sección 3) |
| UGC, podcast, entrevista | `npm run validar`, que imprime el costo desglosado de imágenes y videos (en UGC, los ganchos alternativos aparte, como opcionales) + en UGC, `npm run musica -- temp/[slug] --solo-plan` |
| continuidad | en dos paradas: las imágenes antes de generarlas y los videos cuando ya tienen su duración (sección 13) |

`npm run videos -- temp/[slug] --solo-plan` necesita las imágenes ya hechas
(sin ellas dice cuáles faltan); por eso antes de generar nada el número de los
clips sale de `estimar:video`. Si entre medio cambió algo (una toma rehecha,
una duración), se muestra otra vez con `videos --solo-plan`.

**Lo que ya existe no se vuelve a pagar.** `imagenes` y `videos` se saltan todo
archivo que ya está en `img/` o `video/` con su nombre. Una corrida que se cortó
(un error, el saldo) se retoma con el mismo comando, sin `--rehacer`, y solo se
paga lo que falta. Los dos imprimen el saldo de la cuenta y avisan si no
alcanza.

**`--rehacer` vuelve a generar lo que ya existe** (lo viejo pasa a `historial/`:
se mueve, no se borra). Va **una sola vez, solo en `videos` y siempre acotado**:
`npm run videos -- temp/[slug] --tomas N --sin-broll --rehacer` para el clip de
una toma cuya imagen está bien (sección 6), o `--pasos K --rehacer` para un paso
de continuidad (sección 13, donde `--tomas K --rehacer` tampoco va: rehace los
dos pasos vecinos). Sin `--tomas` ni `--pasos` regenera, y cobra otra vez, todo
el anuncio. **En `imagenes` no se usa**, tampoco con `--tomas N`: ahí el plan
lleva también las hojas de referencia y el B-roll de esa toma, y `--rehacer` los
volvería a cobrar; una imagen se rehace con `npm run rehacer` (sección 6). La
única excepción es `npm run imagenes -- temp/[slug] --rehacer` en UGC, para la
imagen de la persona, que es la única imagen de ese anuncio (sección 11).

**El modelo de respaldo entra solo.** Si el modelo principal falla tres veces,
el motor pasa al respaldo sin preguntar (la tabla de la sección 8) y al
terminar lo avisa: *"ATENCION: N clip(s) salieron del modelo de respaldo"*. El
de los videos, Kling 3.0, cobra por segundo (sección 5), así que el gasto real
puede salir un poco distinto del estimado: `imagenes` y `videos` imprimen al
final el **gasto real**, que es el que va en el informe. Los clips hablados de
UGC, podcast y entrevista no tienen respaldo (secciones 11 y 12).

**En objeto parlante el respaldo sí entra, y ahí un clip de Kling es un
defecto.** El personaje habla dentro del clip, y Kling no genera el diálogo (o
lo pronuncia mal): la toma sale sin su línea del guion. Cada toma que el aviso
de *ATENCION* nombra (también `video/log-modelos.json`, con `respaldo: true`) se
mira y se escucha, y se rehace con Omni según el motivo que el motor imprimió al
cambiar de modelo (*"Motivo: ..."*):

- **Error del servidor** (500, 502, 503, 504, tiempo de espera): no se toca
  nada. `npm run videos -- temp/[slug] --tomas N --sin-broll --rehacer
  --solo-plan`, el costo al usuario, y con el sí el mismo comando con `--si`.
- **Rechazo de contenido** (políticas; casi siempre en salud y suplementos): se
  reescribe **solo la frase que lo dispara**, con su misma función y su mismo
  largo (la duración de la toma está atada a sus palabras), en la `linea` de la
  toma y en la misma frase dentro de su `prompt_video` (la línea hablada entre
  comillas). Se valida con `npm run validar -- temp/[slug]/manifiesto.json` y
  se regenera ese clip con el mismo comando de arriba (`--solo-plan`, el sí,
  `--si`), diciéndole al usuario qué frase cambió y por qué: es la única
  excepción a no tocar un guion ganador. Si Omni la vuelve a rechazar, el motor
  pasa otra vez a Kling y ese clip también se cobra; hasta 3 reescrituras, y a
  la tercera se para y se le muestran las frases probadas y los motivos.

Después del clip nuevo van plan → subtítulos → plan → ensamblar (sección 6).

Lo de ElevenLabs —la voz, las transcripciones— no pregunta en la terminal: sale
del plan del usuario y son centavos por anuncio (sección 5).

### 1.2 Los demás comandos que existen

| | |
|---|---|
| `npm run musica -- temp/[slug]` | la pista de fondo (sección 3): con Suno, o la copia de la pista fija de estilo lego. `--solo-plan` dice el costo; `--si` genera sin preguntar en la terminal; `--suno` pide una de Suno en un estilo con pista fija; `--estilo "..."` cambia el estilo de música que se le pide |
| `npm run estimar:video -- temp/[slug]` | cuánto costarían los clips, sin generarlos y sin que existan las imágenes |
| `npm run rehacer -- temp/[slug] --toma N --contexto` | lo que no se toca de una toma y los prompts que fallaron (sección 6) |
| `npm run rehacer -- temp/[slug] --toma N --aplicar nuevos.json` | pone los prompts nuevos (los anteriores quedan en `prompts-anteriores.json`) y **borra** la imagen y el clip viejos de esa toma, para que se regeneren: no van a `historial/` (en las tomas habladas de podcast y entrevista, los bloques de UGC y los pasos de continuidad, en cambio, sí van) |
| `npm run plan:humano -- temp/[slug]` | el plan legible para montar a mano en CapCut |
| `npm run frames -- temp/[slug]` | tiras de fotogramas para revisar el resultado, en `qa/` |
| `npm run voces` | lista las voces de ElevenLabs de la cuenta (`--propias`, `--buscar ana`) |
| `npm run voces:revisar -- temp/[slug]` | busca voces coladas en los clips (sección 6). No hace falta en historias musicales: los clips van mudos |
| `npm run voz:nivelar -- temp/[slug]` | la nivelación de la voz de estilo lego, otra vez (sección 10) |
| `npm run verificar` | revisa que todo esté instalado y conectado; si algo del entorno falla, empieza por aquí |

Los de un estilo en particular están en su sección: `lineas`, `voz` y `recortar`
(12), `ugc:cola` y `ugc:gancho` (11), `continuidad` (13).

`--solo-plan` sirve en `imagenes`, `videos`, `musica`, `cancion`, `lineas`,
`ugc:cola`, `voz` y `recortar`: muestra qué harían y, si cobran, cuánto, sin
gastar. `--si` salta la confirmación de la terminal en `imagenes`, `videos`,
`musica` y `cancion`: úsalo solo si el usuario ya confirmó el costo.

### 1.3 El plan corre DOS veces, y saltarse la segunda no falla ruidosamente

`plan` escribe `plan-montaje.json`, que es de donde comen los subtítulos y el
ensamblado. Pero el plan también **necesita** los subtítulos, para meterlos
dentro del video. Por eso va: **plan → subtítulos → plan → ensamblar**.

Si te saltas la segunda pasada, `ensamblar` avisa *"todavía no hay
subtítulos"*, renderiza una versión de menos y **termina bien**. Es fácil no
notarlo. Corre el plan dos veces siempre.

Los subtítulos salen de dos comandos distintos, según el modo de audio:
`npm run subtitulos` en voz en off y en los cantados (lee los tiempos de la voz
o de la canción), y `node produccion/subtitulos-dialogo.js temp/[slug]` en
`dialogo_nativo` (UGC, objeto parlante, podcast, entrevista), que alinea la
`linea` del manifiesto con lo que se oye en cada clip. `npm run subtitulos` en un
anuncio hablado pide una pista de voz que ahí no existe.

### Al terminar la skill: un resumen corto y tres opciones

La skill arma el paquete completo —ángulo, hojas de referencia, guion por toma,
prompts de imagen y de video y, según el estilo, B-roll, textos en pantalla o
guion de voz— con todos sus chequeos, y lo deja guardado y validado en el
manifiesto. Lo que no va al manifiesto lo dice cada skill (en historias
musicales, los textos en pantalla quedan en `datos-editor.md`: sección 9,
punto 8). **No lo vuelca en el chat.** (En musical e historias musicales, antes
del paquete la skill muestra la letra —en musical, dos o tres opciones; en
historias, con la ficha y el guion por actos— y la canción se elige de oído,
como siempre.) Al usuario le muestra solo un resumen de 1 a 3 líneas —estilo,
producto, mercado e idioma, cuántas tomas y B-roll, duración aproximada y, si
la hay, una decisión que conviene que sepa— y tres opciones:

- **A)** Producirlo todo y entregarle el MP4 terminado, con el flujo de arriba.
- **B)** Generar solo las imágenes y los videos, para que los monte en CapCut.
- **C)** Entregarle el paquete de prompts en el chat, **completo, nunca una
  muestra**, para revisarlo o producirlo a mano. Los prompts se copian del
  manifiesto carácter por carácter: es la fuente de verdad. Si pide cambios, se
  cambian en el manifiesto y se vuelve a correr `npm run validar`. Al final se
  le ofrece seguir con la A o la B (o dejarlo ahí).

Si en cualquier momento pide ver una parte —*"muéstrame el guion"*, *"pásame
los prompts de la toma 3"*—, se le muestra esa parte, copiada del manifiesto
(o de donde diga la skill, si no va en él).

**El manifiesto nunca se muestra en el chat, ni siquiera en la C.** Es interno
del sistema; como mucho se dice en media línea que quedó guardado y validado.
(El de `ejemplo-anuncio/` sí se puede mostrar: está para mirarlo.)

---

## 2. Los tres modos de audio

El campo `modo_audio` del manifiesto decide todo el montaje. **No lo cambies:**
lo declara la skill.

| | `voz_en_off` | `dialogo_nativo` | `musica` |
|---|---|---|---|
| Estilos | crochet, claymation, zack-d, estilo pixar, esqueleto, estilo lego (y continuidad, que va encima de ellos) | UGC, objeto parlante, podcast, entrevista | musical, historias musicales |
| El audio manda | la voz en off de ElevenLabs | el clip: el personaje habla dentro | la canción |
| `npm run audio` | **sí** | no (se niega solo) | no (se niega solo) |
| Subtítulos | `npm run subtitulos` | `node produccion/subtitulos-dialogo.js` | `npm run subtitulos` |
| B-roll | en fila, rellena la ventana | **encima** de la toma (UGC no lleva; podcast y entrevista, sección 12) | en fila (historias musicales no lleva) |
| Las tomas se aceleran | sí | **nunca** las habladas | sí |
| Música de fondo | **obligatoria** (sección 3) | **obligatoria** en UGC y objeto parlante · **nunca** en podcast y entrevista | **nunca** |
| Animaciones + efectos | **obligatorias** (sección 4), salvo con continuidad | **obligatorias** en UGC y objeto parlante · **nunca** en podcast y entrevista | **nunca** |
| Versiones de salida | 3 | 3 (UGC, objeto parlante) · 2 (podcast, entrevista) | **2** |
| Parada obligatoria | no | **sí** | no |
| Ambiente de los clips | se mezcla bajo la voz | es el audio | musical: bajo la canción · historias musicales: **apagado** (`clips_mudos: true`) |

### La voz de ElevenLabs es MULTILINGÜE — nunca le adviertas del idioma

**Una voz que en ElevenLabs aparece como inglesa canta y habla español perfecto,
con ñ y con tildes.** El idioma lo pone el texto que se le manda, no la voz.

**Nunca le digas al usuario cosas como *"la voz que elegiste está en inglés, te
recomiendo una en español"*.** Es falso, y le hace dudar de una elección que
estaba bien. El modelo que se usa (`eleven_multilingual_v2`) es multilingüe por
diseño.

Lo único que sí importa del texto: **que lleve sus tildes y su ñ de verdad**. Un
guion escrito en ASCII puro le manda al modelo palabras distintas de las que se
escribieron —`quedo` no es `quedó`— y las pronuncia mal.

La voz en off es la del `ELEVENLABS_VOICE_ID` del `.env`. Si está vacía (o no
existe en la cuenta), `npm run audio` no puede preguntar en la terminal de
Claude Code: se detiene y pide elegirla con `npm run voces`. El usuario elige,
y la elegida va al `.env` (`ELEVENLABS_VOICE_ID=`). En estilo lego y en
continuidad la elige el usuario siempre, antes de `npm run audio`.

### La parada obligatoria de `dialogo_nativo`

**Después de generar los videos, párate y muéstraselos al usuario antes de
ensamblar.** No es opcional.

La razón: en ese modo las tomas habladas **no se pueden acelerar** —acelerarlas
deforma la voz y rompe el lip-sync—. Un clip que sale apurado o cortado tiene
una única salida, regenerar, y regenerar después de ensamblar es rehacer todo el
montaje. En los otros modos el montaje absorbe el desajuste; ahí no.

Cómo se revisa, según el estilo:

| Estilo | Con qué |
|---|---|
| objeto parlante | `npm run frames` (las tiras de `qa/`) y `npm run revisar`, mirando cada clip |
| UGC | `npm run frames` y `npm run ugc:cola`, que transcribe cada bloque (sección 11) |
| podcast y entrevista | `npm run frames` y `npm run lineas`, que transcribe cada clip y dice si está limpio (sección 12) |

Y nunca se le pide a una toma hablada otra duración con `--duracion`: está
atada a sus líneas, y se cambia solo en el manifiesto.

---

## 3. La música de fondo — obligatoria, y cambia según el estilo

**Todo anuncio lleva música de fondo, salvo los dos cantados (musical e historias
musicales) y los dos de conversación (podcast y entrevista).** No es opcional y
no se le pregunta al usuario si la quiere: se le pregunta, como mucho, si le
gusta la que salió.

Hay tres caminos, y el estilo decide cuál:

| Estilo | Qué se hace |
|---|---|
| **crochet** | se genera con Suno: `npm run musica -- temp/[slug]` |
| **claymation** | se genera con Suno |
| **objeto parlante** | se genera con Suno |
| **UGC** | se genera con Suno |
| **estilo pixar** | se genera con Suno (mismo proceso que zack-d, pero **sin** su pista fija) |
| **estilo lego** | **NO se genera**: pista fija `recursos/musica/estilo-lego.mp3` ("Open Up Emotions"), **la copia el motor solo** |
| **esqueleto** | **NO se genera**: pista fija `recursos/musica/esqueleto.mp3`, **se copia a mano** |
| **zack-d-films** | **NO se genera**: pista fija `recursos/musica/zack-d-films.mp3`, **se copia a mano** |
| **continuidad** | la del estilo sobre el que va, con su mismo camino |
| **musical** | **ninguna.** La canción ya es el audio del anuncio |
| **historias musicales** | **ninguna.** La canción ya es el audio del anuncio |
| **podcast** | **ninguna**, por decisión del estilo: solo se oyen las voces de los clips (`npm run musica` lo dice y no genera nada) |
| **entrevista** | **ninguna**, por decisión del estilo |

Un anuncio de zack-d-films que llega desde la skill de musicales no lleva su
pista fija: ahí la música es la canción que esa skill ya generó.

### Cuándo se corre y cómo se paga

La música generada se paga en kie.ai: **muéstrale el costo y espera un sí**.
`npm run musica -- temp/[slug] --solo-plan` lo dice sin gastar (una pista,
12 créditos = US$0.06), y lo natural es decírselo en la misma parada que las
imágenes y los videos (1.1). Con el sí, `npm run musica -- temp/[slug] --si`.
Deja `musica/fondo.mp3` y, si Suno devolvió dos, `musica/fondo-alternativa.mp3`.
Suena `fondo.mp3`. Si no le gusta, **primero se le ofrece la alternativa**, que ya
está pagada: se saca `fondo.mp3` de `musica/` y se renombra
`fondo-alternativa.mp3` a `fondo.mp3`. **Para generar una pista nueva hay que
sacar las dos** (`fondo.mp3` y `fondo-alternativa.mp3`), con su costo y su sí:
mientras quede cualquier pista en `musica/`, `npm run musica` dice *"Ya hay una
pista tuya"*, no genera nada, y el plan usa la que quedó (la alternativa
incluida) sin avisar.

### Los estilos con pista fija

**Estilo lego: el motor la copia solo.** `npm run musica -- temp/[slug]` copia
`recursos/musica/estilo-lego.mp3` a `musica/fondo.mp3`, sin Suno y sin costo, y
el plan también la copia si `musica/` quedó vacía. Si el usuario quiere otra:
su archivo en `musica/` (el suyo gana sobre la fija), o una de Suno con
`npm run musica -- temp/[slug] --suno` (sacando antes `fondo.mp3` y cualquier
otra pista de `musica/`).

**Esqueleto y zack-d-films: hay que copiarla a mano.** El motor **no la copia
solo**. Antes de correr el plan:

```
copia  recursos/musica/esqueleto.mp3      ->  temp/[slug]/musica/fondo.mp3
copia  recursos/musica/zack-d-films.mp3   ->  temp/[slug]/musica/fondo.mp3
```

`buscarMusica()` mira la subcarpeta `musica/` del anuncio y usa lo que
encuentre. **Si hay una pista ahí, `npm run musica` no genera nada y no se cobra
nada.** Y al revés: **no corras `npm run musica` en estos dos estilos sin la
pista en su lugar**: iría a Suno y, con `--si`, cobraría. Con `--solo-plan`
mostraría un costo de Suno que en estos estilos no corresponde.

Esas tres pistas son fijas y siempre las mismas: se eligieron una vez y
quedaron. Los otros cinco estilos con música generan una distinta en cada
anuncio, acorde al tono del guion.

### A qué volumen va

El nivel lo pone el motor solo. **No hay que tocarlo**, pero conviene saberlo
para no "corregir" algo que está bien:

| | dB |
|---|---|
| `voz_en_off` (crochet, claymation, esqueleto, estilo pixar) | **−26** |
| `dialogo_nativo` (UGC, objeto parlante) | **−22** |
| **zack-d-films** | **−16** |
| **estilo lego** | **medido**: el plan mide la pista que va a sonar y la deja donde quedó en el anuncio aprobado del estilo (unos −14 con su pista fija, pareja, sin subir en el payoff) |

> **Sí, los números son contraintuitivos y están medidos de oído.** En diálogo
> nativo la música va **más arriba** que en voz en off, no más abajo: el diálogo
> que genera el modelo no viene normalizado y suena constante, así que una
> música baja no se percibe nunca. Y zack-d va a −16 porque a −26 su pista no se
> oía bajo esa voz. En estilo lego el nivel se mide en vez de fijarse porque el
> usuario puede cambiar la pista, y cada pista viene masterizada a su manera.
>
> En el payoff la música sube +4 dB sola (menos en estilo lego, que va pareja).
> Nunca se cambia de canción a mitad del anuncio: la variación emocional se hace
> con volumen.

Para probar otro nivel sin gastar créditos:
`node produccion/ensamblar.js temp/[slug] --musica-db -22` (renderiza solo la
versión con música, a ese nivel).

### Si el usuario quiere poner la suya

Que deje su mp3 en `temp/[slug]/musica/` y ya está: se usa esa y no se genera
nada. Cualquier nombre que no sea `fondo` gana sobre la generada (en estilo lego,
la suya gana siempre sobre la fija).

---

## 4. Las animaciones de entrada y los efectos de sonido — obligatorias

**Todo anuncio lleva cuatro, salvo:**

- los dos cantados —musical e historias musicales—, que van a corte seco;
- podcast y entrevista, que tampoco llevan `transiciones.json`: la conversación
  se corta en seco, y lo que la entrevista lleva encima (el congelado con glitch,
  el check, el clic, el fundido) lo pone el motor por el manifiesto;
- un anuncio con **continuidad**: el paso de una escena a la otra lo hace la IA
  dentro de cada video, y `transiciones.json` se ignora.

Van atadas a las cinco partes del guion —hook, problema, solución, prueba, CTA—
y entran en **la primera toma de cada parte**, no en cualquier corte:

| # | Dónde entra | Animación | Efecto |
|---|---|---|---|
| 1 | **el problema** | `deslizar-derecha` | `woosh` |
| 2 | **la solución** (el giro) | `zoom` | `deep-woosh` |
| 3 | **la prueba social** o lo que haga sus veces | `deslizar-izquierda` | `woosh` |
| 4 | **el CTA** | `zoom` | `deep-woosh` |

> **No siempre salen cuatro, y está bien.** En un anuncio corto la prueba y el
> CTA pueden vivir en la misma toma, y tres transiciones en tres cortes seguidos
> se sienten como un tic. Cuando dos posiciones colapsan o quedan pegadas, se
> deja una. En los anuncios reales salieron 4, 4, 3 y 3.

### Cómo se ponen

**Primero copia los dos efectos** a la carpeta del anuncio. Remotion solo lee
archivos que estén dentro de ella:

```
copia  recursos/efectos-transiciones/woosh.mp3       ->  temp/[slug]/efectos/
copia  recursos/efectos-transiciones/deep-woosh.mp3  ->  temp/[slug]/efectos/
```

**Después escribe `temp/[slug]/transiciones.json`** con las posiciones que
decidiste, mirando el guion:

```json
{
  "efectos": {
    "woosh": "efectos/woosh.mp3",
    "deep-woosh": "efectos/deep-woosh.mp3"
  },
  "puntos": [
    { "toma": 2,  "animacion": "deslizar-derecha",  "efecto": "woosh",      "porque": "entrada del PROBLEMA" },
    { "toma": 6,  "animacion": "zoom",              "efecto": "deep-woosh", "porque": "entrada de la SOLUCION" },
    { "toma": 9,  "animacion": "deslizar-izquierda","efecto": "woosh",      "porque": "entrada de la PRUEBA" },
    { "toma": 11, "animacion": "zoom",              "efecto": "deep-woosh", "porque": "entrada del CTA" }
  ]
}
```

`toma` es el número de la toma donde entra esa parte del guion. **El campo
`porque` se escribe siempre**: es lo que permite revisar después si la posición
tenía sentido.

**En UGC, `toma` es el número del bloque que empieza con esa parte del guion**:
una transición solo puede ir en el corte entre dos bloques, porque los cortes de
dentro de un bloque ya vienen en el clip. Una parte que arranca en medio de un
bloque no lleva transición, y en un anuncio de pocos bloques salen menos de
cuatro.

**Sin ese archivo el anuncio sale con corte seco**, sin una sola transición.
`ensamblar` lo avisa antes de renderizar y lo repite al terminar, pero no detiene
nada: es fácil que el aviso pase de largo.

### La sincronía se mide sola — no la toques

El sonido no empieza en el corte: **empieza antes**, porque si no, llega tarde.

| | Duración | Su sonido arranca |
|---|---|---|
| `zoom` + `deep-woosh` | 0.5 s | **0.2 s antes del corte** |
| `deslizar-*` + `woosh` | 0.45 s | 0.05 s antes |

**Ese adelanto no está escrito en ninguna configuración**: el motor lo mide
sobre el archivo de sonido real cada vez que arma un plan. Si algún día se
cambia un efecto por otro, el adelanto se recalcula solo.

> **Por qué `deep-woosh` se adelanta tanto**: no es un golpe, es un *swell* —
> empieza casi inaudible y crece. Se ancla el **ataque** (cuando se vuelve
> audible), no el pico. Anclar el pico lo deja demasiado temprano, y recortarle
> la cabeza al archivo suena pobre. **El archivo no se toca; lo que se mueve es
> cuándo suena.**

### Lo que NO se hace

**Nada de esto se aplica por regla ni por heurística.** Las cuatro posiciones se
deciden leyendo el guion, una por una. Un woosh puesto "cada N tomas" se nota
como lo que es: una plantilla.

Y **nunca en musical, historias musicales, podcast, entrevista ni con
continuidad**: ahí no se escribe `transiciones.json` y no se copian los efectos.

---

## 5. Lo que cuesta

Cada usuario paga lo suyo, en sus propias cuentas.

### kie.ai — las imágenes, los videos, la música y las canciones

Precios de `produccion/config.js`, consultados en <https://kie.ai/pricing>.
1 crédito = US$0.005.

| | Modelo | créditos | US$ |
|---|---|---|---|
| Una imagen (hoja, frame, B-roll) | Nano Banana 2, 1K | 8 | 0.04 |
| Una imagen de estilo lego, podcast o entrevista, y la de la persona de UGC | GPT Image 2.5 Sunburst, 2K | 10 | 0.05 |
| Un icono de la entrevista | GPT Image 2, 1K, fondo transparente | 6 | 0.03 |
| Un clip de 4 s | Omni Flash 1.2, 1080p (10 por segundo) | 40 | 0.20 |
| Un clip de 6 s | Omni Flash 1.2, 1080p | 60 | 0.30 |
| Un clip de 8 s | Omni Flash 1.2, 1080p | 80 | 0.40 |
| Un clip de 10 s | Omni Flash 1.2, 1080p | 100 | 0.50 |
| Un clip de 15 s | Omni Flash 1.2, 1080p | 150 | 0.75 |
| Un B-roll de podcast o entrevista (mudo) | Kling 3.0, 720p, sin audio | 14 por segundo (5 s: 70) | 0.07 por segundo |
| Un clip del modelo de respaldo (solo si Omni falla) | Kling 3.0, 720p, con sonido | 20 por segundo | 0.10 por segundo |
| Una pista de música de fondo | Suno | 12 | 0.06 |
| Una canción (por cada prompt de estilo; Suno da dos versiones) | Suno | 12 | 0.06 |
| Cada bloque más de una canción larga (extend) | Suno | 12 | 0.06 |

**Bajar la resolución ahorra poco**: Omni Flash 1.2 cobra por segundo, 9
créditos en 720p y 10 en 1080p (4 en 360p, 22 en 4k). Las copias que hace el motor (el frame heredado de la toma anterior, la
hoja de un host copiada al primer cuadro de su toma, el fotograma de un lugar
que vuelve) no cuestan.

**Los precios cambian.** Los comandos imprimen la fecha en que se consultaron;
lo que vale al final es el **gasto real** que imprimen `imagenes` y `videos` al
terminar. Nunca le des al usuario una cifra inventada: si no está en esta tabla,
la dice el comando con `--solo-plan`.

### ElevenLabs — la voz y las transcripciones

Salen del plan de ElevenLabs del usuario: la voz en off, y las transcripciones
de `voces:revisar`, `ugc:cola`, `lineas`, `tiempos` y los subtítulos de los
estilos hablados. Son centavos por anuncio: la transcripción cobra unos US$0.22
por hora de audio, y un anuncio entero son un par de minutos de clips.

### Anuncios reales, para calibrar

| Anuncio | Costo en kie.ai |
|---|---|
| voz en off, 40 segundos | US$12.53 |
| voz en off, 65 segundos | US$18.32 |
| estilo lego, 38 segundos (10 tomas y 10 B-roll) | unos US$8.18 (27 imágenes y 20 clips) |
| estilo lego, 1:42 (29 tomas y 29 B-roll) | unos US$22.51 (70 imágenes y 58 clips) |
| UGC, 46 segundos, 5 bloques y 2 ganchos alternativos (con un bloque regenerado y la música) | US$5.05 |
| musical, 1:48 | US$23.40 |
| historia musical, 4:47 con 59 tomas | US$30.36 |

Los dos de estilo lego se pagaron con el modelo de imagen anterior (US$7.97 y
US$21.81, a 8 créditos por imagen y, el primero, con una pista de Suno): la
tabla los da recalculados a los precios de hoy, con las mismas imágenes y los
mismos clips (GPT Image 2.5 Sunburst a 10 créditos y la pista fija, sin costo).

Más la voz en ElevenLabs. Una historia musical de 8 minutos ronda los
US$45-55: es el estilo más caro y hay que decirlo antes de generar la canción
siquiera. En podcast y entrevista el costo lo da `npm run validar`: sobre los
manifiestos de las pruebas reales imprimió unos US$5.50 para un podcast de 7
generaciones y 3 B-roll, y unos US$9.40 para una entrevista A con 11 B-roll y
6 iconos.

> **Muestra siempre el costo antes de generar y espera un sí.** `--solo-plan` te
> lo dice sin gastar (sección 1.1). El usuario paga esto.

---

## 6. Antes de entregar un anuncio — la lista

Se corre **entera** sobre cada MP4 de salida. Lo que se puede medir, se arregla
sin preguntar: volver a renderizar no cuesta créditos.

### Antes de la lista: avisos normales vs. defectos reales

El motor imprime avisos mientras planea y mientras ensambla. **La mayoría no son
fallos: son el montaje funcionando y contándote qué decidió.** El propio motor
lo dice cuando los imprime: *"ninguno detiene el montaje"*.

| Aviso | Qué significa de verdad |
|---|---|
| `toma N acelerada a 1.3x` | el clip era más corto que su ventana y se ajustó el ritmo; es lo normal |
| `B-roll N no entra` | no había hueco; el anuncio queda igual de bien sin él |
| `música en loop` | la pista era más corta que el anuncio y se repitió; no se nota |
| `línea sin match en la canción` | esa línea no se subtitula sola; el resto sí |
| una cola cortada (UGC), un cutaway acortado (podcast), un icono en tarjeta blanca (entrevista) | decisiones del montaje de esos estilos |
| una velocidad alta o una llegada movida (continuidad) | ídem: el montaje cambia la velocidad y nunca corta |
| un clip del modelo de respaldo | en los estilos de voz en off no es un defecto por sí solo: se mira con más cuidado. **En objeto parlante sí lo es** (sale sin su línea): se rehace como dice la sección 1.1 |
| duración distinta a la pedida | ver el punto de abajo |

**Defectos de verdad hay pocos, y todos se miden:** fotogramas negros, tramos
congelados, voces coladas, contenido equivocado dentro de una toma, o texto
ilegible en el envase. Cada estilo suma los suyos en su skill (una minifigura
que salió humana en estilo lego, un clip hablado que no está limpio en podcast y
entrevista, un paso que no llega a su imagen en continuidad). Esos son los que
van en "lo que salió mal".

**La duración no es un defecto.** El tiempo que pide el usuario orienta el
presupuesto de palabras del guion — no es un contrato. Si pidió 40 segundos y
salieron 44.6, el anuncio está bien y se entrega así. Una diferencia del 10-20%
es normal, y viene de que la voz real no lee exactamente a la velocidad estimada.

**Nunca cortes una línea del guion, quites una toma ni inventes copy para llegar
a un número, y no se lo ofrezcas al usuario como opción.** El guion ya está
aprobado; recortarlo para cuadrar un cronómetro estropea un anuncio que
funcionaba. Se dice la duración real como dato, sin pedir disculpas.

### Lo que arreglas tú, sin consultar

**1. Fotogramas negros.**

```
ffmpeg -i <mp4> -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null -
```

Filtra los que den `YAVG < 5`. Cualquiera es un agujero en la línea de tiempo.

> Antes de darlo por negro, **compara contra el clip fuente**: un anuncio que
> abre de noche puede tener luma baja legítima. Lo que delata un agujero es que
> el clip fuente sea brillante y la salida no.

**2. Tramos congelados.**

```
ffmpeg -i <mp4> -vf "freezedetect=n=0.003:d=1.2" -f null -
```

Cualquier `freeze_start` es un clip que no alcanzó a cubrir su ventana y el
render repitió el último fotograma.

> **El chequeo de fotogramas negros NO encuentra esto.** Un clip corto no deja
> negro: congela, y el fotograma repetido tiene luma normal. Son dos fallos
> distintos y hacen falta las dos mediciones.

**3. La duración** se anota, no se corrige. Ver arriba.

**4. Los archivos son los recién generados** — mira la fecha de modificación
contra la hora actual. Medir un archivo viejo da un número correcto del objeto
equivocado.

**5. Voces coladas en los clips** — ver abajo.

### Voces coladas: la regla depende del modo

Los clips vienen con sonido ambiente, y **eso está bien y se respeta**: pasos,
pájaros, el roce de una tela. Lo que se busca es **habla** — una frase que nadie
escribió, muchas veces en inglés.

| `modo_audio` | Tomas principales | B-roll |
|---|---|---|
| `voz_en_off` | ninguna voz | ninguna voz |
| `dialogo_nativo` | **la voz ES el contenido**, no se toca | ninguna voz |
| `musica` | ninguna voz | ninguna voz |

**Dónde mirar primero: en las tomas donde dos personajes aparecen
interactuando** — uno entregándole algo al otro, dos figuras que parecen
conversar. Ese criterio ha acertado el 100% de las veces.

**Un guion con muchas interacciones va a traer voces. Cuenta con eso.** En un
anuncio aparecieron cinco.

**Los estilos que hablan son UGC, objeto parlante, podcast y entrevista** — los
de `dialogo_nativo`. Ahí la voz de las tomas principales es el anuncio y no se
toca; sus B-roll sí se revisan, porque en un B-roll nadie debería hablar en
ningún estilo. En podcast y entrevista el B-roll ya sale mudo: se genera sin
audio y el montaje lo pone sin sonido.

**Cómo se detecta**: transcribiendo el audio del clip. Uno limpio devuelve
etiquetas de sonido —`[birds chirping]`, `[ticking clock]`— o nada; uno con
habla devuelve una frase. **Mirar los niveles no sirve**: un clip con voz medía
más bajo que cuatro clips sin ella.

**No lo hagas a mano — hay un comando**, y sabe solo a qué clips les toca según
el modo (con continuidad, los clips de la cadena):

```
npm run voces:revisar -- temp/[slug]              revisa y reporta
npm run voces:revisar -- temp/[slug] --silenciar  además escribe silenciar.json
```

Cuesta unos centavos por clip (transcribe con ElevenLabs) y dice, clip por clip,
si detectó habla y qué frase. Los que salta los dice también, para que se vea
que no se le escapó ninguno.

**Qué hacer con los que traen voz**: silenciarles la pista. Queda en −91 dB, la
imagen intacta, no cuesta créditos. Regenerar es la otra opción, pero cuesta y
no garantiza nada — la misma toma volvió a salir con voz al regenerarla.

`--silenciar` deja un `silenciar.json` en la carpeta del anuncio, y **`npm run
plan` lo lee solo**: no hay que editar nada a mano. Vuelve a correr `plan` y
después `ensamblar`, y esos clips van mudos.

**Silenciar se decide sin consultar, pero se reporta siempre**, porque se pierde
el ambiente de esa toma.

**Un cero también hay que ganárselo.** Si el comando no encuentra nada, antes de
decir "está limpio" comprueba que el detector funciona: pásale un audio con voz
conocida y confirma que sí lo marca. Un cero de un detector roto y un cero de
verdad se ven idénticos.

### Lo que SÍ se consulta

**Regenerar una imagen o un clip se pregunta y se espera el OK.** Señala qué
regenerarías y cuánto costaría, y que decida el usuario. A lo mejor le gusta
como está. Rehacer la imagen de una toma obliga a rehacer su clip, que sale de
ella: los dos van en el costo.

Las excepciones las dicen las skills: en la entrevista, un clip hablado que no
está limpio se rehace sin preguntar, con su costo dicho (sección 12), y en los
estilos hablados, una frase que Omni rechaza por contenido se reescribe sin
preguntar (secciones 11 y 12): los intentos rechazados no cobran.

### Cómo se rehace una toma

**Nunca con el mismo prompt**: si una toma salió mal, el problema casi siempre
está en la instrucción, no en la suerte. Y **nunca con
`npm run imagenes -- temp/[slug] --tomas N --rehacer`**: con `--tomas N` el plan
también lleva las hojas de referencia y el B-roll de esa toma, y `--rehacer`
los volvería a generar y a cobrar. La toma nueva saldría con otro personaje y
otro envase que el resto del anuncio.

```
npm run rehacer  -- temp/[slug] --toma N --contexto           lo que no se toca y los prompts que fallaron
   ... escribe una escena distinta para la misma intención en nuevos.json:
       prompt_imagen_inicial, prompt_imagen_final (solo si la toma es B), prompt_video
       se le muestra al usuario, con el costo (la imagen o el par, y el clip) -> esperar el sí ...
npm run rehacer  -- temp/[slug] --toma N --aplicar nuevos.json   los pone en el manifiesto (los anteriores quedan
                                                                 en prompts-anteriores.json) y borra la imagen
                                                                 (o el par inicial/final) y el clip de esa toma,
                                                                 sin copia en historial/
npm run imagenes -- temp/[slug] --tomas N --si                solo la imagen de esa toma: las hojas ya están
npm run videos   -- temp/[slug] --tomas N --sin-broll --si    solo su clip
npm run plan     -- temp/[slug]
npm run ensamblar -- temp/[slug]
```

Sigue los pasos que imprime `--aplicar`, en ese orden, **sin `--rehacer` en
ningún comando**: lo viejo ya no está en la carpeta, y lo que existe no se
vuelve a pagar. Sin `--sin-broll`, `--tomas N` también pide el B-roll que va
encima de esa toma, si falta. El clip se rehace siempre, aunque solo cambie la
imagen, porque sale de ella. En objeto parlante, después del clip nuevo van
plan → subtítulos → plan → ensamblar: los subtítulos salen de lo que se oye en
cada clip.

Si la imagen está bien y solo el clip salió mal (una deformación, un salto),
basta `npm run videos -- temp/[slug] --tomas N --sin-broll --rehacer`, **una sola
vez**, con el costo antes (`--solo-plan`) y `--si` después: manda el clip viejo
a `historial/` y genera otro.

UGC, podcast, entrevista y continuidad rehacen a su manera: está en sus
secciones (11, 12 y 13).

### El informe de entrega

Con cada anuncio terminado va un informe, sin adornos, en **dos apartados
separados** — mezclarlos hace que un anuncio bueno parezca roto. Varias skills
le suman un tercero al principio, **lo que salió bien**: se respeta.

**Decisiones del montaje** — lo que el motor resolvió solo:

- Duración real, dicha como dato
- Tomas aceleradas y cuánto
- B-roll que no entraron, y por qué
- Música: cuál se usó, a qué dB, si se repitió en loop
- Qué decidiste tú sin consultar, y por qué

**Lo que salió mal** — solo defectos medidos:

- Fotogramas negros o tramos congelados: cuántos, dónde, y si se corrigieron
- Voces coladas, y qué se hizo con ellas
- Imágenes o clips con contenido equivocado, uno por uno
- Los clips que salieron del modelo de respaldo, y cómo quedaron
- Qué regenerarías y cuánto costaría

Y al final, el **costo real**: el gasto que imprimieron `imagenes` y `videos`
(lo regenerado incluido) y lo de la música o la canción. Si el apartado de
defectos queda vacío, se dice que quedó vacío: eso es información, no falta de
rigor.

---

## 7. Reglas de medición — cómo NO engañarte solo

Estas tres costaron horas de conclusiones equivocadas.

**Mide la propiedad correcta, no una que se le parezca.** Comparar
`mean_volume` entre dos versiones para saber si una lleva música da −24.6 contra
−24.7: parecen iguales y no lo son. Hay que **restar las señales**.

**Y para restar dos archivos estéreo hay que cruzar los canales de los dos**,
no los del primero:

```
ffmpeg -i a.wav -i b.wav -filter_complex \
  "[0:a][1:a]amerge=inputs=2,pan=stereo|c0=c0-c2|c1=c1-c3,volumedetect" -f null -
```

Con `pan=mono|c0=c0-c1` estarías midiendo el **ancho estéreo de un archivo**, no
la diferencia entre dos. **El control que lo delata**: restar un archivo contra
sí mismo tiene que dar ~−91 dB.

**Si los dos audios no están alineados al sample, la resta no sirve** — 15 ms de
desfase anulan la cancelación y el resultado *sube*. Ahí se comparan
**envolventes** por ventanas. Y para saber si dos archivos son idénticos, lo más
simple es el **MD5 del PCM decodificado**.

**Valida un filtro antes de creerle su silencio.** Un `freezedetect` que no
imprime nada puede significar "no hay congelados" o "no corrió". Se comprueba en
diez segundos fabricando un video con un congelado a propósito.

**Confirma que el archivo que mides es el que acabas de generar.** Un render que
falló deja el archivo viejo en su sitio, y la medición dice que tu arreglo no
sirve cuando ni siquiera corrió. Lo mismo con la generación: un archivo que ya
estaba en `img/` o `video/` no se vuelve a generar (sección 1.1), así que lo que
mides puede seguir siendo el viejo.

---

## 8. Cosas del motor que conviene saber

**Un archivo está terminado cuando existe con su nombre exacto** en `img/` o
`video/`. Lo que ya existe no se vuelve a pedir ni a pagar, y por eso para
rehacer algo primero tiene que salir de ahí: `--rehacer` lo mueve a
`historial/`, y `npm run rehacer` en una toma normal **lo borra** (los prompts
anteriores quedan en `prompts-anteriores.json`; el archivo viejo, no). En las
tomas habladas de podcast y entrevista, los bloques de UGC y los pasos de
continuidad, `npm run rehacer` lo mueve a `historial/`.

**Un clip de Omni no pasa de 15 segundos (10 si lleva imagen final).** Una
toma que necesite más se parte en dos.
La `duracion` de una toma en el manifiesto es la que dice la skill (en
historias musicales, su ventana con un decimal); **el clip se pide con esa
duración redondeada hacia arriba al entero, de 3 a 15 s (hasta 10 con imagen
final)**: Omni Flash 1.2 cobra por segundo. Una toma de 7,2 s se pide de 8; una
de 5, de 5: el motor
ajusta el número de "Duración:" dentro del prompt para que no se contradigan, y
el montaje la acomoda a su ventana. Algunas tomas llevan ya en el manifiesto un
entero de 3 a 15, porque su clip se pide con ese largo exacto: los bloques
de UGC y las tomas habladas de podcast y entrevista (el validador lo exige), y
los pasos de continuidad (los calcula `npm run continuidad -- temp/[slug]
--duraciones`).

**El B-roll de Omni se pide a 3 segundos como mínimo** (en segundos enteros,
como las tomas), porque el modelo no baja de ahí. Si su hueco en el
montaje es mayor, hay que pedirlo más largo o el render congela el último
fotograma. En podcast y entrevista el B-roll va a Kling 3.0, mudo, con la
duración entera que pide el manifiesto: de 3 a 15 s, que es lo que acepta el
validador.

**Las transiciones y la música tienen su propia sección** — la 3 y la 4. No las
saltes: son obligatorias en ocho estilos (crochet, claymation, zack-d, estilo
pixar, esqueleto, estilo lego, UGC y objeto parlante; con continuidad va la
música del estilo, no las transiciones) y **el motor te avisa si faltan**
—`ensamblar`, antes de renderizar y otra vez al terminar—, pero el aviso no
detiene nada: un anuncio sin ellas se renderiza perfecto y sale plano.

**El montaje automático es opcional.** Llevarse los clips a CapCut es una salida
legítima. `npm run plan:humano -- temp/[slug]` deja `plan-montaje.txt` en la
carpeta del anuncio: dice qué toma va con qué línea, en qué segundo, y qué
B-roll le toca. Está escrito para que lo lea una persona.

**Si el usuario deja un mp3 propio en `musica/` dentro de la carpeta del
anuncio, no se genera música con IA** — se usa la suya y no se cobra nada.

**Las herramientas están fijas en el código**, no en las skills. Cuando una
skill menciona Midjourney o Kling, eso es para quien copia los prompts a mano.
El motor usa lo que dice `produccion/config.js` y nada más:

| | Principal | Si falla |
|---|---|---|
| Imágenes, en casi todos los estilos | Nano Banana 2, 1K | GPT Image 2 |
| Imágenes de estilo lego, podcast y entrevista | GPT Image 2.5 Sunburst, 2K | Nano Banana 2, 1K |
| La imagen de la persona de UGC | GPT Image 2.5 Sunburst, 2K | Nano Banana 2 |
| Iconos de la entrevista | GPT Image 2, 1K, fondo transparente | Nano Banana 2 (sin transparencia: el montaje lo pone en una tarjeta blanca) |
| Videos | Omni Flash 1.2, 1080p | Kling 3.0, con sonido (en objeto parlante entra igual, pero no genera el diálogo: sección 1.1) |
| Bloques de UGC y tomas habladas de podcast y entrevista | Omni Flash 1.2, 1080p | **ninguno**: Kling no genera el diálogo |
| B-roll de podcast y entrevista | Kling 3.0, 720p, sin audio | — |
| Música y canciones | Suno, por kie.ai | — |
| Voz y transcripciones | ElevenLabs | — |

**Un proceso pesado a la vez.** El render de `ensamblar`, el recorte del host
del podcast y el paso `voz` de la entrevista trabajan con video en la
computadora del usuario: de a uno, nunca dos a la vez. Si la máquina tiene poca
memoria libre, o el render falla con *"No frame found at position"*, se corre
`npm run ensamblar -- temp/[slug] --concurrencia 1`: tarda más y sale bien.

---

## 9. Historias musicales — el flujo propio

Es el único estilo donde **primero existe la canción y después todo lo demás**.
La letra es el guion entero (una historia en primera persona de 4-10 minutos),
Suno la canta de principio a fin, y **cada línea de la letra es una toma**. Lo
que cambia respecto a los demás estilos, en orden:

**1. La letra decide la duración, nunca al revés.** Minutos ≈ palabras ÷ 125.
A Suno **no se le manda `duration`** (trunca por el final y se lleva el CTA).
Si la canción salió de 4:47 cuando el usuario pidió "4 minutos", eso está bien:
el anuncio dura lo que dura la canción y **la letra no se recorta ni se estira
para cuadrar un número**.

**2. Se generan dos estilos y el usuario elige de oído.** `npm run cancion`
genera 4 versiones (2 por cada prompt de estilo). Se le dice dónde están, cuánto
dura cada una y cuál estilo es cada par. **Nunca se elige por él.** Si ninguna
le convence se ajusta el prompt de estilo (no la letra) y se vuelve a generar,
con su costo y su sí. `--elegir N` deja `audio/cancion.mp3`, los tiempos medidos
con Scribe y el **mapa de la canción**: la duración real y los huecos sin letra.

**3. Letras largas van por bloques.** Suno canta bien hasta ~3.500 caracteres.
Más largo, la skill parte la letra en bloques (siempre al final de un acto) y
`--elegir` los agrega solo con *extend* sobre la versión elegida, 12 créditos
por bloque, quedándose con la versión de cada extend que mejor canta la letra.
Ese costo ya sale en el `--solo-plan` de la canción, y entra en el mismo sí.

**4. `cancion/lineas.txt` y `npm run tiempos --lineas`.** Una línea por toma:
el texto exacto de cada línea de la letra, en orden, más las marcas
`[intro]`, `[instrumental]` y `[cierre]` para los huecos sin letra. **Los huecos
se cubren con tomas de ~3 s, no con una larga**: una intro de 8,5 s son tres
`[intro]` seguidos, una cola de 14 s son cinco `[cierre]`; el comando reparte el
hueco en partes iguales. Imprime inicio, fin y **ventana** de cada línea; una
línea que pase de 10 s se parte en dos en `lineas.txt` y se vuelve a medir.
**La `duracion` de cada toma del manifiesto es su ventana**, con un decimal; el
clip se pide con esa ventana redondeada hacia arriba al entero (sección 8).

**5. Los clips van mudos y sin transiciones.** El manifiesto lleva
`"clips_mudos": true` y el plan apaga el ambiente de los 50-80 clips: el único
audio es la canción. No se corre `npm run musica`, no se escribe
`transiciones.json`, no hace falta `npm run voces:revisar` (una voz colada no
se oye). Salen **dos** versiones: con y sin subtítulos.

**6. Personajes con hoja de referencia, y el producto con la etiqueta dictada.**
En 60-80 tomas la protagonista cambia de cara si no hay hoja: la skill genera
`protagonista_antes`, `protagonista_despues` (con la de antes como referencia
para que sea la misma persona), villano, mensajero y los secundarios que se
repiten. La hoja del producto se genera desde la foto **con el texto de la
etiqueta escrito literal en el prompt**: con la foto sola, el modelo reescribe
el texto chico ("B-Vitamins" donde decía "Elderberry Extract"), y como esa hoja
se adjunta a todas las tomas con envase, el error se repite en cada una.

**7. Tipo B solo en cambios de estado** (el mecanismo apagado → encendido, el
espejo antes → después). Todo lo demás Tipo A. Sin B-roll: `"broll": []`.

**8. Los textos en pantalla no van al manifiesto.** El motor no dibuja textos;
la skill los guarda como *datos para el editor* (sticker de la oferta, "Semana
3", tarjeta final) en `temp/[slug]/datos-editor.md`, para quien monte a mano en
CapCut —se muestran, copiados de ese archivo, si elige la C, si los pide y al
entregar la A o la B—, y el manifiesto lleva `"overlays": []`.

**9. El costo se dice dos veces**: antes de la canción (US$0,12 por dos
estilos, más US$0,06 por cada bloque de extend; `npm run cancion --
temp/[slug] --solo-plan` lo imprime) y antes de las imágenes y los videos
(US$25-35 para 5 minutos, US$45-55 para 8). `npm run imagenes -- temp/[slug]
--solo-plan` da el de las imágenes y `npm run estimar:video` el de los clips.
Se muestra y se espera el sí.

El orden completo:

```
npm run preparar   -- "<ruta de la foto>" [slug]
npm run cancion    -- temp/[slug] --solo-plan
npm run cancion    -- temp/[slug] --si
npm run cancion    -- temp/[slug] --elegir N
npm run tiempos    -- temp/[slug] --lineas
   ... manifiesto ...
npm run validar    -- temp/[slug]/manifiesto.json
npm run tiempos    -- temp/[slug]
npm run imagenes   -- temp/[slug] --solo-plan
npm run estimar:video -- temp/[slug]
   ... el costo -> esperar el sí ...
npm run imagenes   -- temp/[slug] --si
npm run videos     -- temp/[slug] --si
npm run revisar    -- temp/[slug]
npm run plan       -- temp/[slug]
npm run subtitulos -- temp/[slug]
npm run plan       -- temp/[slug]
npm run ensamblar  -- temp/[slug]
```

Si después de un cambio hay que rehacer tomas y la numeración se corre (por
ejemplo, al partir la intro en tres), **las imágenes y clips que siguen
sirviendo se renombran al número nuevo, no se regeneran**: renombrar es gratis
y solo se paga lo que no existe. Después hay que volver a correr
`npm run tiempos` (sin `--lineas`) antes de `plan`, o el plan usa los tiempos
viejos.

---

## 10. Estilo Lego — lo propio

Es un estilo de voz en off y sigue el flujo de la sección 1. Lo que cambia:

**1. La voz la elige el usuario.** El motor narra con la `ELEVENLABS_VOICE_ID`
del `.env` sin preguntar, así que antes de `npm run audio` se listan las voces
con `npm run voces` y el usuario elige (de hombre o de mujer, la que quiera). La
elegida va al `.env`.

**2. La voz se nivela sola.** `npm run audio` la deja al nivel del anuncio
aprobado del estilo (unos −13,6 dB donde se habla), sin mover una muestra. La
original queda en `audio/voz-original.mp3` y no se nivela dos veces;
`npm run voz:nivelar -- temp/[slug]` lo repite si hace falta (con `--solo-medir`
mide sin escribir nada). **Los niveles no se tocan a mano**: ni el de la voz ni
el de la música.

**3. La música es fija**: "Open Up Emotions", la copia el motor
(`npm run musica`, y el plan si `musica/` quedó vacía). Sin Suno y sin costo,
salvo que el usuario pida una de Suno. Queda pareja, unos 20 dB por debajo de la
voz, sin subir al final (sección 3).

**4. Las imágenes** salen de GPT Image 2.5 Sunburst a 2K (10 créditos cada una)
y, si una falla, de Nano Banana 2: el modelo lo pone el motor, no se cambia a
mano. `npm run imagenes -- temp/[slug] --solo-plan` ya lo cuenta con ese precio.

**5. Defectos propios del estilo**, que se regeneran con el prompt revisado (y
el costo dicho): una minifigura que salió humana o que se dobla, ladrillos que
se derriten, una pieza Lego colada en una toma médica (o una toma médica sobre
grid o como diagrama), el producto convertido en piezas, algo real que salió
como pieza Lego. La lista completa está en la skill.

---

## 11. UGC — el flujo propio

Una persona generada con IA habla a cámara todo el anuncio, por **bloques** de
3 a 15 s (10 por defecto): cada bloque se genera de una vez en Omni Flash
con referencias, hasta 6 (la imagen de la persona, la foto del producto y, si
vuelve a un lugar, el fotograma de ese lugar), sin frames encadenados, sin B-roll y **sin modelo de
respaldo**. La voz la genera el clip: no hay `npm run audio`.

```
npm run preparar     -- "<ruta de la foto>" [slug]   si hay foto y no se hizo
npm run validar      -- temp/[slug]/manifiesto.json  el costo: la imagen, los bloques y, aparte, los ganchos
npm run musica       -- temp/[slug] --solo-plan      el costo de la música, sin gastar (sección 3)
   ... costo, ganchos y música -> PARADA 1: esperar el sí ...
npm run imagenes     -- temp/[slug] --si             solo la imagen de la persona: mirarla
npm run videos       -- temp/[slug] --si             los bloques (con --ganchos si los aprobó)
npm run frames       -- temp/[slug]                  un fotograma a mitad de cada tramo
npm run ugc:cola     -- temp/[slug]                  transcribe cada bloque y marca dónde cortar si repite el final
   ... revisión de cada bloque -> PARADA 2 ...
npm run musica       -- temp/[slug] --si
   ... efectos y transiciones.json (sección 4: toma = número de bloque) ...
npm run plan         -- temp/[slug]
node produccion/subtitulos-dialogo.js temp/[slug]
npm run plan         -- temp/[slug]                  OTRA VEZ
npm run ensamblar    -- temp/[slug]
```

- **La imagen de la persona, antes de los bloques.** Esa cara va en todo el
  anuncio. Si salió con texto, con algo en las manos, con otra persona o no se
  parece a la descripción, se le muestra al usuario con su costo (10 créditos)
  y, con el sí, `npm run imagenes -- temp/[slug] --rehacer --si`, una vez.
- **Los lugares que vuelven los resuelve el motor.** `npm run videos` genera
  primero los bloques cuyas referencias ya existen; después saca de cada bloque
  de origen el fotograma de su lugar (con ffmpeg, gratis, en `img/<id>.png`) y
  genera los que vuelven a ese lugar. `npm run videos -- temp/[slug] --solo-plan`
  muestra ese orden sin gastar.
- **La repetición del final no es un defecto.** Si a un bloque le sobró tiempo y
  repite al final lo que ya dijo, `ugc:cola` deja `toma-N.cola.json` y el
  montaje corta después de la última palabra del guion. Una repetición en medio,
  una frase que falta o un "no se pudo decidir" sí se revisan.
- **Rehacer un bloque** (la tirada falló: otra cara, texto, apurado) es con el
  mismo prompt, con el costo dicho y el sí: `npm run rehacer -- temp/[slug] N`
  saca el clip a `historial/` (y su corte de cola), después
  `npm run videos -- temp/[slug] --si` genera solo lo que falta, `npm run frames`
  y `npm run ugc:cola -- temp/[slug] --tomas N`.
- **Si Omni falla**, `npm run videos` se para y dice el motivo. Un **error del
  servidor** (500, 502, 503, 504, tiempo de espera) no se arregla tocando nada:
  se espera y se vuelve a correr `npm run videos -- temp/[slug] --si`, sin
  `--rehacer` (los intentos fallidos no cobran); si sigue, se le avisa al
  usuario que es una caída del servicio y se reintenta cada 15 minutos. Un
  **rechazo de contenido** (políticas; casi siempre en salud y suplementos) se
  arregla reescribiendo solo la frase que lo dispara, con su misma función y
  duración, en `linea`, `tramos` y `prompt_video` de ese bloque; se valida con
  `npm run rehacer -- temp/[slug] N` y se vuelve a correr `videos --si`. Hasta 3
  reescrituras; a la tercera, se para y se le avisa al usuario.
- **Los ganchos alternativos** son opcionales: un clip más cada uno, del largo
  del Bloque 1, y solo con el sí del usuario. Con el anuncio ya ensamblado, cada
  gancho es otra versión:

  ```
  npm run ugc:gancho -- temp/[slug] 1b          crea temp/[slug]-gancho-1b/ con el gancho como Bloque 1
  npm run ugc:cola   -- temp/[slug]-gancho-1b --tomas 1
  npm run plan       -- temp/[slug]-gancho-1b
  node produccion/subtitulos-dialogo.js temp/[slug]-gancho-1b
  npm run plan       -- temp/[slug]-gancho-1b
  npm run ensamblar  -- temp/[slug]-gancho-1b
  ```

  Para rehacer un gancho: `npm run rehacer -- temp/[slug] --gancho 1b`,
  `npm run videos -- temp/[slug] --ganchos --si` y
  `npm run ugc:gancho -- temp/[slug] 1b --reemplazar`.

La skill tiene el detalle: qué mirar en cada fotograma y en cada transcripción.

---

## 12. Podcast y entrevista — el flujo propio

Los dos son `dialogo_nativo` con **tomas habladas** (tipo H): la voz la genera
Omni dentro de cada clip, sin voz en off. **Sin música y sin transiciones**, y
salen **dos** versiones (con y sin subtítulos). Los clips hablados no tienen
modelo de respaldo: si Omni no lo saca, se sigue lo de "Si Omni falla", abajo.

### Las imágenes

Todas salen de GPT Image 2.5 Sunburst a 2K (10 créditos cada una), salvo los
iconos.

- **Podcast**: las hojas de los dos hosts (A, y B generada con A adjunta), y las
  imágenes de B-roll. El primer cuadro de cada generación es una copia de la
  hoja de su host: `npm run imagenes` la hace solo, sin costo.
- **Entrevista**: las hojas (la persona, la calle vacía, la mano con el
  micrófono), la imagen de cada clip, los iconos y las imágenes de B-roll. Los
  iconos salen de GPT Image 2 a 1K, cuadrados y con fondo transparente; si uno
  no sale transparente, el montaje lo muestra en una tarjeta blanca (no es un
  defecto), y las manchas semitransparentes de adentro las tapa el motor con
  Python.
- **Se miran antes de pagar los clips.** Las hojas, apenas llegan: todo lo que
  esté en ellas se repite en cada clip. Si una salió mal, se le muestra al
  usuario con su costo y, con el sí, sale a mano a `historial/` (con las
  imágenes que se hicieron con ella; en el podcast, si es la de A, también la
  de B) y se vuelve a correr `npm run imagenes -- temp/[slug] --si`, que genera
  solo lo que falta. Lo mismo con una imagen de clip o de B-roll que salió mal.

### El orden

Hasta `lineas` es igual en los dos:

```
npm run preparar  -- "<ruta de la foto>" [slug]   si hay foto y no se hizo
npm run validar   -- temp/[slug]/manifiesto.json  el costo desglosado -> PARADA 1: esperar el sí
npm run imagenes  -- temp/[slug] --si             mirar las hojas y las imágenes
npm run videos    -- temp/[slug] --si             los clips hablados (Omni) y los B-roll (Kling, mudos)
npm run frames    -- temp/[slug]
npm run lineas    -- temp/[slug]                  transcribe: ¿dijo todo?, ¿está limpio?
   ... revisión de cada clip -> PARADA 2 ...
```

Después, según el estilo:

```
Podcast, pantalla dividida   plan -> subtitulos-dialogo -> plan -> ensamblar --concurrencia 1
Podcast, esquina             plan -> subtitulos-dialogo -> plan -> recortar -> plan -> ensamblar --concurrencia 1
Entrevista A (gancho)        voz -> lineas --tomas <las que imprime voz> -> plan -> subtitulos-dialogo -> plan -> ensamblar
Entrevista B (completa)      plan -> subtitulos-dialogo -> plan -> ensamblar
Montaje a mano (opción B)    lo mismo hasta el último plan, y después  npm run plan:humano
```

(`plan` = `npm run plan -- temp/[slug]`; `subtitulos-dialogo` =
`node produccion/subtitulos-dialogo.js temp/[slug]`; `voz` y `recortar` =
`npm run voz -- temp/[slug]` y `npm run recortar -- temp/[slug]`.)

- **`--concurrencia 1` va siempre en el podcast**, y en la entrevista si hay
  poca memoria libre. Cada versión tarda unos 10 minutos así.
- **El recorte del host (podcast en esquina) va entre plan y plan**: recorta
  solo los tramos en que el host va en su esquina. Tarda unos 7 minutos por
  cada segundo de host recortado (con tres B-roll, alrededor de una hora), sin
  créditos; la primera vez baja el modelo de recorte (unos 220 MB). Corre solo,
  nada pesado en paralelo.
- **El paso `voz` (entrevista A)** corta cada clip de la historia en sus
  palabras, le quita los silencios de adentro y lo acelera a 1,2x. Es la única
  voz que se acelera, y la acelera el motor. El original queda en
  `video/originales/`; se puede correr otra vez sin daño (`--forzar` rehace lo
  ya hecho). Al terminar imprime el `lineas --tomas …` exacto: ese se corre.
- **Python 3** hace falta solo aquí: para tapar los huecos de los iconos de la
  entrevista (Pillow y numpy) y para el host en la esquina del podcast (rembg y
  onnxruntime). El punto 8 de `npm run verificar` dice qué falta y el comando
  exacto para el Python que encontró, del tipo
  `python -m pip install --user rembg onnxruntime pillow numpy`. Si
  `npm run imagenes` avisa iconos sin revisar los huecos, se resuelve Python y
  se corre `npm run imagenes -- temp/[slug] --tapar-huecos` (no genera ni cobra
  nada).

### La revisión del habla — `npm run lineas`

Transcribe cada clip hablado, lo compara con su `linea` del manifiesto y dice si
dijo todo y si está **limpio**. **Cualquier palabra repetida, trabada, cambiada
o agregada es un defecto, y el clip se regenera**, aunque "suene natural": nunca
se ofrece dejarlo pasar. El costo de rehacerlo se dice siempre: en la entrevista
se rehace sin preguntar (hasta 3 veces; a la tercera se para y se le muestran al
usuario las tres transcripciones), y en el podcast con el sí a su costo, como
dice su skill.

**La única excepción la decide el motor, no tú**: una palabra de una sola letra
("a", "y", "e", "o", "u") dicha dos veces seguidas, con las dos juntas en menos
de 0,2 s y menos de 0,15 s de pausa entre ellas. `lineas` la deja en
`toleradas` y la toma sale "LIMPIO (con 1 repeticion tolerada)". No se regenera,
pero **siempre se le informa al usuario, con su clip y su segundo**, para que la
escuche. Tú no toleras nada por tu cuenta.

Las diferencias que son solo de escritura no cuentan (el motor ya las iguala):
cifras o letras, símbolos de precio, tildes, mayúsculas, la marca mal escrita
por el transcriptor. Pero un "%" escrito se tiene que oír. En el podcast, los
clips de reacciones se transcriben también: **una palabra en una reacción es
falla**, sin excepción.

Al regenerar un clip, el motor le quita su medida vieja: se vuelve a medir con
`npm run lineas -- temp/[slug] --tomas N` antes de planear. Si es un clip de la
historia de la entrevista A, después pasa otra vez por `voz -- … --tomas N` y
por `lineas -- … --tomas N` (abajo). Si se regenera después de haber planeado,
sigue plan → subtítulos → plan (y, en esquina, recortar → plan).

### Rehacer un clip

```
npm run rehacer  -- temp/[slug] --toma N --contexto                el diálogo y el prompt de ese clip
npm run rehacer  -- temp/[slug] --toma N --aplicar nuevos.json     saca el clip (y su imagen en la entrevista) a historial/
npm run imagenes -- temp/[slug] --tomas N --si                     SOLO entrevista: la imagen del clip (10 créditos)
npm run videos   -- temp/[slug] --tomas N --sin-broll --si         el clip; lo demás no se vuelve a pagar
npm run frames   -- temp/[slug]
npm run lineas   -- temp/[slug] --tomas N
   ... se revisa como cualquier clip; cuando está bien: ...
npm run voz      -- temp/[slug] --tomas N                          SOLO entrevista A, clip de la historia: el clip nuevo, sin silencios y a 1,2x
npm run lineas   -- temp/[slug] --tomas N                          SOLO entrevista A, clip de la historia: OTRA VEZ, la voz cambió sus tiempos
```

Sigue los pasos que imprime `--aplicar`, en ese orden: son estos, y siguen con
plan → subtítulos → plan (con recortar → plan si el host va en la esquina) →
ensamblar.

**El diálogo no se toca**: si un clip salió con otra cara, mirando a cámara o con
palabras de más, falló la tirada, no el guion. Se cambia algo pequeño del prompt
que ayude (una nota de entrega más concreta, una línea de lo que no debe pasar),
nunca las líneas. En la entrevista, si la imagen del clip estaba bien, se copia
de vuelta desde `historial/` antes de correr `imagenes` y no se paga otra vez.
En estos estilos **no se usa `--rehacer` en `imagenes`**: arrastra las hojas.

### Si Omni falla

`npm run videos` se para, muestra el motivo (`failCode` y `failMsg`) y dice de
qué tipo es:

- **Error del servidor** (500, 502, 503 o 504; "Internal Error", tiempo de
  espera, servidor ocupado): no es un rechazo de contenido y **no se toca
  nada**. El motor ya reintentó solo. Se espera unos minutos y se vuelve a
  correr `npm run videos -- temp/[slug] --si`, sin `--rehacer`: los intentos
  fallidos no cobran y lo ya generado no se vuelve a pagar. Si sigue igual, se
  le avisa al usuario que es una caída del servicio y no un problema de su
  anuncio, y se reintenta cada 15 minutos.
- **Rechazo de contenido** (el motivo habla de políticas; casi siempre en salud
  y suplementos): se reescribe **solo la frase que lo dispara**, con su misma
  función y largo, en el manifiesto (la línea en el guion, la `linea` de la
  toma, su prompt, y la frase ancla que colgara de ella), se valida y se vuelve
  a correr `videos --si`. Hasta 3 reescrituras; a la tercera, se para y se le
  muestran al usuario las frases probadas y los motivos. Es la única excepción
  a no tocar un guion ganador.
- **Los B-roll de Kling** tampoco tienen respaldo: el motor reintenta solo, y si
  sigue fallando se para y lo dice. Se tratan igual: esperar si es del
  servidor; si es de contenido, corregir solo su prompt.

Las skills de los dos estilos tienen el detalle: qué mirar en cada fotograma,
las líneas de "lo que no debe pasar" para cada fallo, y lo que el usuario
necesita para montar a mano.

---

## 13. Continuidad — el flujo propio

Es un efecto que va **encima** de un anuncio animado con narrador en voz en off
(estilo pixar, claymation, zack-d-films, crochet, estilo lego o esqueleto): cada
video va de la imagen de una toma a la imagen de la siguiente, y la IA hace el
paso entre las dos escenas, sin cortes, de principio a fin. **El estilo hace
primero su trabajo completo** (guion, prompts, manifiesto y la pregunta A/B/C).
Si elige C, el paquete es el del estilo (un video por toma, con B-roll y
cortes): los prompts de video de cada paso se escriben recién mirando las
imágenes generadas y no vienen ahí; al entregarlo, avísale en una línea que,
producido a mano, sale con cortes, y que el anuncio sin cortes es con A o B.
Cuando el usuario elige A o B, la skill `anuncios-continuidad` toma la
producción desde el manifiesto, con este orden, que **reemplaza** el proceso de
producción del estilo:

```
npm run continuidad  -- temp/[slug] --preparar     B-roll a un lado, agrega el bloque "continuidad"
npm run validar      -- temp/[slug]/manifiesto.json
npm run imagenes     -- temp/[slug] --solo-plan     el costo de las imágenes -> esperar el sí
npm run imagenes     -- temp/[slug] --si            revisar las imágenes
npm run voces                                       que el usuario elija la voz (va al .env)
npm run audio        -- temp/[slug]
npm run continuidad  -- temp/[slug] --duraciones    la duración de cada paso, de los tiempos reales de la voz
npm run continuidad  -- temp/[slug] --pares         mirar las dos imágenes de cada par y escribir su prompt
npm run plan         -- temp/[slug] --prediccion    velocidades previstas, no escribe nada
npm run validar      -- temp/[slug]/manifiesto.json
npm run videos       -- temp/[slug] --solo-plan     el costo de los videos -> esperar el sí
npm run videos       -- temp/[slug] --si
npm run voces:revisar -- temp/[slug]
npm run frames       -- temp/[slug]
npm run frames       -- temp/[slug] --uniones       cada unión: dónde termina, a dónde tenía que llegar, dónde arranca el siguiente
   ... música, según el estilo base (sección 3) ...
npm run plan         -- temp/[slug]
npm run subtitulos   -- temp/[slug]
npm run plan         -- temp/[slug]
npm run ensamblar    -- temp/[slug]
```

- **Si no aplica, el motor lo dice**: `--preparar` responde "No se puede" en los
  estilos y modos que no lo admiten (donde alguien habla a cámara, se canta o el
  producto habla) o con menos de 2 tomas. Se le dice al usuario en una frase y
  se sigue con el anuncio normal.
- **Sin B-roll, sin transiciones de editor**: no se escribe `transiciones.json`
  ni se produce el B-roll, aunque el estilo los marque como obligatorios. La voz,
  la música, los subtítulos y los niveles siguen las reglas del estilo.
- **La música es la del estilo base**: Suno en estilo pixar, claymation y
  crochet (`npm run musica -- temp/[slug] --solo-plan`, el sí, y `--si`); la
  copia el motor en estilo lego; **en zack-d-films y esqueleto se copia a mano
  la pista fija antes**, y no se corre `npm run musica` sin ella en su lugar
  (iría a Suno y cobraría).
- **Los prompts de los pasos se escriben mirando las dos imágenes** de cada par;
  `--pares` tiene que terminar diciendo "Prompts escritos: X de X". Si una imagen
  se rehace después (`npm run rehacer`), sus dos pasos quedan marcados para
  revisar y sus videos van a `historial/`; mientras esa marca esté, los videos no
  arrancan.
- **La predicción decide la duración antes de pagar**: un video por encima de
  2,5x cuya duración no está en el mínimo (3 s) baja un segundo, como dice
  la skill. Si ya está en 3 s, se paga así y la velocidad va en el informe.
- **El montaje nunca corta un video**: solo cambia su velocidad para que empiece
  con su frase y llegue a la imagen siguiente cuando empieza la frase siguiente.
  Las velocidades altas y las llegadas movidas (hasta 0,3 s antes o 0,4 s
  después) son decisiones del montaje, no defectos.
- **Rehacer un paso** que salió mal (no arranca en su imagen, no llega, se
  desliza, hace un fundido, aparecen líneas de luz o texto): se reescribe su
  prompt y `npm run videos -- temp/[slug] --pasos K --rehacer --solo-plan`; con
  el sí, el mismo comando con `--si`, **una sola vez**. El clip propio de una
  toma o el de cierre: se corrige su `prompt_video`, el archivo va a
  `historial/` a mano y `npm run videos -- temp/[slug] --tomas K` (con
  `--solo-plan` y después `--si`) lo pide solo a él. Nunca `--tomas K
  --rehacer`: rehace también los dos pasos vecinos.
- **Solo imágenes y videos (opción B)**: todo igual hasta revisar la cadena (la
  voz hace falta para las duraciones); después, solo la música y
  `npm run plan:humano -- temp/[slug]`, que dice en qué segundo entra cada video
  y a qué velocidad. No se corren plan, subtítulos ni ensamblar.

---

## 14. Ahorrar y producir en paralelo (2026-11-07)

Casi todo el costo de un anuncio son los **clips de video** (en un anuncio
típico, cerca del 90%): una imagen cuesta ~US$0,05 y un clip entre US$0,30 y
US$0,60. Lo que más ahorra es no pedir un clip que no hace falta, reusar uno ya
pagado, y no tener que repetirlo.

### 14.1 B-roll quieto (y tomas A quietas): `"quieto"`

Un plano que **no necesita acción** —el producto sobre la mesa, los
ingredientes, el bodegón final, un lugar vacío— no se le pide al generador de
video. Con `"quieto"` en su entrada del manifiesto, el motor arma el clip desde
su imagen ya generada, con un movimiento suave (acercamiento o paneo), en un
segundo y **sin cobrar**:

```json
{ "n": 4, "despues_de_toma": 4, "duracion": 3, "prompt_imagen": "...", "prompt_video": "...", "quieto": true }
```

`true` es un acercamiento; también `"alejar"`, `"paneo-izquierda"` y
`"paneo-derecha"`. Vale en el **B-roll** y en las **tomas A** de los estilos con
narrador. **No** en tomas B (su gracia es pasar de un frame a otro), ni en las
habladas (R, H), ni con continuidad. El `prompt_video` se deja escrito igual:
si el usuario después quiere ese clip animado, se quita `"quieto"` y se genera.

**Cuándo sí:** el plano se entiende quieto y el movimiento no aporta (producto,
ingredientes, texto/oferta de fondo, el lugar antes de que entre alguien).
**Cuándo no:** hay una acción (alguien toma, vierte, se mueve), el mecanismo en
marcha, o el gancho. **Como guía, entre un tercio y la mitad del B-roll de un
estilo con narrador puede ir quieto** sin que se note: se dice en el resumen
del costo ("5 de los 9 B-roll van quietos: US$X menos").

### 14.2 La biblioteca de clips: `"guardar_en_biblioteca"` y `"desde_biblioteca"`

Los clips que se repiten casi iguales en los anuncios del mismo producto —el
producto en mano, cada ingrediente, el mecanismo en 3D— se guardan una vez y se
reusan:

- **Guardar:** en la toma o el B-roll, `"guardar_en_biblioteca": { "tipo":
  "mecanismo", "nombre": "Drenaje linfático en 3D", "producto": "<producto>" }`
  (tipo: producto, ingrediente, mecanismo, escena, broll). Al terminar
  `npm run videos`, el motor copia el clip a
  `mis_archivos/biblioteca/clips/<estilo>/` con su primer fotograma y un json
  (prompts, duración, de qué anuncio salió). Márcalo en los clips que
  **otro anuncio del mismo producto podría usar tal cual**; no en los del gancho
  ni en los que llevan el personaje de esta historia.
- **Usar:** antes de escribir el manifiesto, mira los clips guardados
  (`mis_archivos/biblioteca/clips/*/*.json`, y la miniatura `.png` con Read).
  Si uno sirve para una toma o un B-roll de **este** anuncio (mismo producto,
  mismo estilo, la misma idea), en esa entrada va
  `"desde_biblioteca": "mis_archivos/biblioteca/clips/<estilo>/<id>.mp4"`: no
  se genera su imagen ni su clip, se copian. La duración de la toma, igual o
  menor que la del clip. Se dice en el resumen del costo ("3 clips de la
  biblioteca: US$X menos").
- La app los muestra en **Biblioteca → Clips** (y ahí se borran), y se
  sincronizan con GitHub como el resto de la biblioteca.

### 14.3 Revisión de las imágenes antes de los videos — obligatoria

**Ojo: el motor NO lo hace cumplir.** No existe un comando `revisar:imagenes`
(esta guía lo nombraba por error) y `npm run videos --si` cobra aunque nadie
haya mirado las imágenes. La revisión depende de ti: antes de los videos, mira
CADA imagen de `temp/[slug]/img/` con Read (y de nuevo las que cambien después:
rehacer, lápiz).

Se revisa, imagen por imagen, contra la skill (y el subestilo, si hay): la
misma cara, pelo, ropa y cuerpo que la hoja del personaje; ningún texto o letra
inventados; ninguna persona, mano o personaje de más; la etiqueta del producto
fiel; el plano, el lugar y la luz que pide la toma. **Si una sale mal se arregla
antes de los videos** (lápiz ~US$0,06, o rehacer con su costo y el sí del
usuario): una imagen mala hecha clip se paga dos veces. Con el director
creativo (fase 2) la revisión es la suya. `--sin-revision` existe solo para
cuando el usuario lo pide expresamente.

**Con un subestilo, además, el supervisor de generaciones**
(`.claude/agents/supervisor-generaciones.md`, en paralelo con el director
creativo). Cada imagen lleva su fotograma adjunto (`"fotograma"` en la toma,
el B-roll o la hoja, y `"fotograma_final"` en el frame final de una B: el motor
manda la versión sin texto de `subestilos/<id>/limpio/`). El supervisor entra
en tres momentos: **prompts** (qué fotograma lleva cada imagen, según su
bitácora), **imágenes** (cada imagen al lado de su fotograma: parecido y
fugas, es decir texto, la marca, el producto o la cara del anuncio original) y
**videos** (si el clip mantuvo la calidad de la imagen). Lleva la bitácora
`mis_archivos/biblioteca/aprendizajes/generaciones.md`: los fotogramas que
funcionan, los que van "con cuidado" (con la frase que los arregla) y los de
"no adjuntar", más una fila por anuncio. Así cada anuncio nuevo sale con lo
aprendido de los anteriores.

**Y los clips se mueven como el original.** Cada fotograma tiene su plano del
anuncio original en `subestilos/<id>/movimiento/<nombre>.jpg` (seis cuadros, de
inicio a fin, con el segundo en cada uno) y su duración en
`movimiento/planos.json`, con el ritmo de cortes del original (`ritmo-ref`).
Cada `prompt_video` se escribe mirando esa tira: el mismo movimiento de cámara,
a la misma velocidad, y la misma acción del personaje. El supervisor lo revisa
en el momento de los prompts y otra vez con los clips hechos. Para un
subestilo nuevo no hay todavía un script que arme la tira (esta guía nombraba
`produccion/movimiento-subestilos.py`, que no existe en esta app): se hace a
mano o se trae de IA-VID-AUTOMATIC.

### 14.4 En paralelo

- **Imágenes, voz y música a la vez:** `npm run imagenes`, `npm run audio` y
  `npm run musica` en paralelo (no hay un comando único `arrancar`). En
  esqueleto y Zack D Films `musica` copia sola su pista fija.
- **Imágenes:** hasta 12 a la vez. Las hojas de personaje ya no van
  todas primero y de a una: cada hoja espera solo a las que usa (la "después"
  a la "antes"), y cada toma arranca apenas está su hoja; un B-roll sin
  personaje arranca enseguida.
- **Videos:** hasta 10 clips a la vez.
- Los topes se cambian en el `.env` (`CONCURRENCIA_IMAGENES`,
  `CONCURRENCIA_VIDEOS`, de 1 a 20; `produccion/config.js`). Si kie.ai respondiera 429, el motor espera
  y reintenta solo.

**Los avatares, como los de las referencias.** Cada subestilo trae, en su
ficha, la sección «Los avatares»: cómo es cada personaje al detalle, su retrato
(`subestilos/<id>/avatar/<rol>.jpg`, con su versión sin texto en `limpio/`) y
su prompt de hoja (todo también en `avatar/avatar.json`). La hoja de cada
personaje se hace con ese prompt y, si la ficha lo dice, con el retrato
adjunto (`"fotograma"` en la referencia). Las personas reales filmadas (UGC,
realista) nunca se adjuntan: se crea una persona nueva del mismo tipo. En la
app, Biblioteca → Avatares → "Hazla tú" → "Como en un anuncio de referencia"
usa lo mismo.

### 14.4 bis Referencias por link (2026-11-07)

Los videos de referencia (el "video ganador" de un anuncio nuevo, el de
"Clonar un video" y los de "Varios a la vez") también pueden llegar como
**links**: de la Biblioteca de anuncios de Meta
(`https://www.facebook.com/ads/library/?id=…`), TikTok, Instagram, YouTube o
Facebook, y pueden ser varios.

```
npm run referencias:bajar -- temp/[slug]/referencia/videos "<link>" "<link>" …
```

Deja `ref-01.mp4`, `ref-02.mp4`… (un anuncio con varios videos baja todos) y
`links.json` (el link, la página que lo publicó y su texto). No cobra y no
baja dos veces el mismo link. Usa yt-dlp, gratis: si falta, `npm run
referencias:instalar` (con el Python del computador; en Mac también `brew
install yt-dlp`). Un link que no baja no frena los demás: se le pide al
usuario que suba ese video. Después cada video se analiza como cualquier
video de referencia.
### 14.4 ter El catálogo de creativos, para las campañas (2026-11-07)

La app lleva sola la lista de todos los videos terminados, para que otra
conversación (la que monta las campañas en Meta) sepa cuáles hay, dónde están
y cuáles son nuevos. Con la app abierta, cada 2 minutos y solo si algo cambió,
escribe `catalogo-creativos.csv`, `catalogo-creativos.json` y
`PARA-CAMPANAS.md` (las instrucciones para esa conversación):
- en Google Drive, en "Estudio de anuncios/", con la ruta de cada video en
  `en_drive`, si está configurado el guardado en la nube;
- en `output/`;
- y el .json en `mis_archivos/biblioteca/`, que se sube al GitHub sin los videos.

Cada fila es un video: `id` (no cambia nunca), anuncio, producto, estilo,
versión, idioma, mercado, duración, gancho (la primera frase), fecha,
`en_drive`, `en_computador`, `subido_a_meta` e `id_anuncio_meta`. Lo que ya se
subió lo anota la otra conversación en "Estudio de anuncios/subidos-a-meta.csv"
(`id,id_anuncio_meta,fecha,campana`). La app nunca escribe ese archivo: lo lee
para marcar cada creativo. Los nuevos son los que tienen `subido_a_meta`
vacío. En la app, en Anuncios → "Catálogo para tus campañas", se ve cuántos
faltan y se copia el texto para pegarle a esa conversación
(`lib/catalogo.ts`, `api/catalogo`).

### 14.5 Los anuncios salen en 1080p (2026-11-07)

Los clips se piden en **1080p** y el MP4 final sale en **1080x1920**
(`RESOLUCION_VIDEO` en `produccion/config.js`; Remotion compone a 720x1280 y
`ensamblar.js` lo agranda entero con `--scale=1.5`, letras y animaciones
incluidas). Los clips quietos se arman del mismo tamaño.

- **Costo**: el modelo principal (Omni Flash 1.2) cobra 10 créditos por segundo
  en 1080p y 9 en 720p (el 1.1 cobraba igual en las dos). Kling
  (el respaldo, y el B-roll de podcast y entrevista) pasa de 14 a 18 créditos
  por segundo en 1080p, en su modo "pro".
- **Tiempo de montaje**: medido, un 22% más que en 720p (9 s de video: 20,4 s
  contra 25,0 s). El archivo pesa cerca del doble.
- **Para volver a 720p**: `RESOLUCION_VIDEO=720p` en el `.env`.

Medido con un kie.ai simulado (los tiempos reales de una imagen ~40 s y de un
clip ~3 min), en un anuncio de esqueleto de 9 tomas + 9 B-roll (20 imágenes,
18 clips):

| | Antes | Ahora |
|---|---|---|
| Imágenes | ~4,9 min | ~3,0 min |
| Videos | ~20 min | ~10 min |
| Voz y música | en fila, ~2 min más | dentro del tiempo de las imágenes |
| Con 5 B-roll quietos | — | videos ~9 min y US$5,78 en vez de US$7,35 |

