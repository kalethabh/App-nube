# Anuncios con IA

De tu producto a un anuncio listo para Meta y TikTok, en tu propia computadora. Funciona en Windows y en Mac.

## Lo que necesitas

- **Internet.**
- **Tu cuenta de Claude** (la misma con la que entras a claude.ai, con un plan de pago). La app escribe los guiones con tu cuenta: no necesitas ninguna clave de Anthropic.
- **Una clave de kie.ai**, con saldo. Con ella se hacen las imágenes, los videos y la música. La sacas en kie.ai, en «API Key».
- **Una clave de ElevenLabs.** Con ella se hace la voz. La sacas en elevenlabs.io, en tu perfil, en «API Keys».
- **Unos 5 GB libres** en el disco, para los programas que usa la app y para tus anuncios.

Las claves se pegan dentro de la app (Ajustes, Conexiones). Nunca se las pases a nadie.

## Cómo empezar

### Desde GitHub (así se guarda todo solo)

1. Instala **Git** si no lo tienes (Mac: abre la Terminal y escribe `git --version`; si falta, la Mac ofrece instalarlo. Windows: https://git-scm.com).
2. En la Terminal, en tu carpeta de usuario:

   ```
   git clone https://github.com/kalethabh/App-nube.git "Anuncios con IA"
   ```

   (te pide iniciar sesión en GitHub la primera vez, porque el repositorio es privado).
3. Abre la carpeta «Anuncios con IA» y sigue desde el paso 2 de abajo (doble clic en el lanzador).

Con la app abierta, cada 2 minutos todo lo que crea, cambia o borra se sube solo a tu GitHub. Los videos y audios se copian a tu Google Drive (si tienes Google Drive para escritorio), en la carpeta «Anuncios con IA». Lo ves en **Ajustes, Guardado**.

### Desde el zip

1. **Descomprime el zip.** Te queda una carpeta llamada «Anuncios con IA». Déjala en un lugar fijo, en tu carpeta de usuario:
   - En **Windows**: abre el Explorador, escribe %USERPROFILE% en la barra de arriba, pulsa Enter y pega ahí la carpeta. Mejor no en Escritorio, Documentos ni Descargas: muchas veces están dentro de OneDrive, que intenta subir tus videos y puede trabar la instalación. Tampoco la metas dentro de muchas otras carpetas: si la ruta queda muy larga, Windows no deja armar los videos.
   - En **Mac**: en tu carpeta de inicio (la que tiene tu nombre, con la casita; en el Finder, menú Ir, Inicio). Mejor no en Descargas, Escritorio ni Documentos: ahí la Mac pide permisos de más e iCloud puede querer subir la carpeta entera.
2. **Abre la app con doble clic en el lanzador de tu sistema:**
   - En **Windows**: «Abrir Anuncios con IA.bat».
     Si Windows dice «Windows protegió su PC», toca «Más información» y después «Ejecutar de todas formas».
   - En **Mac**: «Abrir Anuncios con IA.command».
     La primera vez, haz clic derecho sobre el archivo, elige «Abrir» y otra vez «Abrir». Si la Mac igual dice que no lo puede abrir porque no sabe quién lo hizo, abre Ajustes del Sistema, entra a «Privacidad y seguridad», baja hasta el final y toca «Abrir igualmente». Solo pasa la primera vez.
3. **La primera vez, espera.** Si a tu computadora le falta algún programa que la app necesita (Node.js, ffmpeg, Python o Claude Code), el lanzador lo baja de su sitio oficial y lo instala solo, sin pedirte contraseña. Puede tardar entre 10 y 30 minutos según tu internet. Las veces siguientes abre en segundos.
4. **Se abre la app en tu navegador.** La bienvenida te guía para conectar tu cuenta de Claude y pegar tus claves de kie.ai y ElevenLabs.

Mientras uses la app, **deja abierta la ventana del lanzador** (la ventana de texto que se abre con el doble clic). Para cerrar la app, cierra esa ventana.

## Dónde quedan tus anuncios

Todo queda dentro de la carpeta «Anuncios con IA»:

- **output**: los videos terminados, listos para subir.
- **temp**: el trabajo de cada anuncio (imágenes, clips, voz). La app lo usa para retomar y para el editor: no lo borres mientras quieras seguir editando ese anuncio.

Desde la app también puedes ver y bajar cada versión de tus anuncios.

Si cierras la app a mitad de un anuncio, no pasa nada: al volver a abrirla sigue sola donde quedó.

## Cómo actualizar

Cuando recibas una versión nueva (otro archivo **anuncios-con-ia-app.zip**):

1. **No lo descomprimas encima de tu carpeta.** Déjalo en Descargas, como llegó.
   En **Mac con Safari**, el zip se descomprime solo al bajarlo y el archivo .zip va a la Papelera: ábrela, haz clic derecho sobre anuncios-con-ia-app.zip y elige «Devolver». Ese es el que vas a elegir.
2. Abre la app y entra a **Ajustes, Acerca de, «Actualizar la app»**. Elige el zip nuevo.
3. La app te dice qué versión es y qué trae. Toca «Actualizar».
4. Cuando termine, cierra la ventana del lanzador y vuelve a abrir «Abrir Anuncios con IA».

Tus anuncios, tus claves y tus ajustes se quedan como están. Lo que la actualización reemplaza queda guardado en la carpeta **respaldos** (las tres últimas actualizaciones), por si acaso.

## Si algo no anda

- Cierra la ventana del lanzador y vuelve a abrirlo. La mayoría de las veces se arregla así.
- En la app, **Ajustes, Tu PC** te dice si falta algo y qué hacer.
- La versión que tienes está en **Ajustes, Acerca de** y en el archivo VERSION de la carpeta.
