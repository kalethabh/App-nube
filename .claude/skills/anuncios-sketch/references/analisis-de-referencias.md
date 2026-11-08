# Adaptar un video de referencia del usuario

Cuando el usuario manda un video ("quiero uno así, pero para mi producto"), primero se desarma la referencia y después se adapta su estructura, no su contenido.

## 1. Desarmar
```
python analizar_referencia.py <video.mp4> <carpeta>/referencia --idioma es
```
Genera `tomas.png` (un fotograma por toma, con número y duración), `fotogramas_NN.png` (cada 0,5 s) y `analisis.md`, con la tabla de tiempos, líneas y entrega medida (volumen relativo, sílabas por segundo y melodía, si está librosa).

Después, mira las hojas con Read y completa a mano la última columna de cada toma:
- **Plano:** PG, plano de dos, OTS, PMC, PP, inserto o packshot.
- **Movimiento:** casi siempre estático o con un push-in.
- **Quién está a qué lado y a quién mira:** arma su mapa de ejes.
- **Expresión y gesto,** y si el chiste es la línea, la reacción o el gag.
- **Beat:** gancho, excusa, escalada, humillación, mensajero, producto, remate o CTA (ver `formato.md` §3).

## 2. Extraer el esqueleto
Arma una tabla con lo que se conserva:
- Duración, número de tomas, ritmo (promedio por toma) y la posición del producto (% del video).
- **Estructura de beats** y su orden.
- **Tipos de chiste:** excusa absurda + desmentido, falso cumplido, apodo, escalada, callback (ver `formato.md` §6).
- **Arquetipos:** quién humilla, quién remata, quién es el mensajero.
- **Curva de energía:** dónde grita, dónde susurra, dónde va la pausa.
- **Cierre:** packshot, nota, voz en off o mirada a cámara.

## 3. Adaptar al producto
- **El problema social del producto reemplaza al de la referencia.** Lo que otros notan y comentan: calvicie → hinchazón → manchas…
- **El escenario** se elige donde ese problema duele más en público (`formato.md` §9). Puede ser el mismo de la referencia si encaja.
- **Mismos beats, mismos tipos de chiste, chistes nuevos.** No copies las líneas: escribe otras con la misma función.
- **La línea del producto** sigue la plantilla: qué es + "ayuda a" + mecanismo de calle + oferta.
- **El idioma y la jerga** son los del país del usuario, aunque la referencia sea de otro.
- **Mantén el ritmo** de la referencia (número de tomas y duración) con un margen de ±15 %.

En la propuesta al usuario, muestra lado a lado la toma de la referencia y la toma adaptada. Así ve que se respetó lo que le gustó.

## 4. Si el usuario manda su propio guion
- Respétalo palabra por palabra salvo problemas reales. Señálalos y propón el cambio sin imponerlo:
  - Promesas que Meta rechaza.
  - Líneas demasiado largas para una toma.
  - Producto demasiado temprano.
  - Falta de remate.
- Tú pones la dirección: plano, mapa de ejes, entrega de cada línea, casting y vestuario, locación y cierre.
- Si el guion es de otro formato (UGC, testimonio), conviértelo a sketch: busca el problema social, los arquetipos y el mensajero. Propónlo como adaptación.
