# Cámara, ejes y miradas

Este es el error que más delata a un anuncio hecho con IA: cortes donde el personaje no mira a quien le habla, o le habla a la cámara cuando la escena es una conversación. Las referencias lo hacen perfecto; nosotros también.

## Por qué pasa
- Cada toma se genera **aislada**. Si el prompt dice "primer plano de Caro", el modelo no sabe dónde está la tía, y por defecto **pone al personaje mirando al lente**.
- Frases como "sostiene el frasco cerca de la cámara" o "muestra el producto a cámara" hacen que el personaje le hable al espectador.
- Si nadie fija los lados, una toma pone a la tía a la izquierda y la siguiente a la derecha: el espectador se desorienta.

## La regla: un mapa de ejes ANTES de escribir las tomas
1. **Por escena, fija quién está a la IZQUIERDA y quién a la DERECHA del cuadro.** La víctima suele ir a la izquierda y mirar a la derecha; quienes la enfrentan van a la derecha y miran a la izquierda.
2. **La cámara nunca cruza el eje** (regla de los 180°): en todos los planos de esa conversación, la víctima sigue a la izquierda mirando a la derecha.
3. **Si alguien cambia de lado, se ve en cámara** (ejemplo: la tía se pone detrás de Caro para empujarla). A partir de ahí el nuevo lado manda.
4. **Nadie mira al lente**, salvo que haya un motivo dentro de la historia: una foto grupal (posan para el fotógrafo, que está donde la cámara), o el CTA final que rompe la cuarta pared.
5. **Fondos coherentes:** detrás de la víctima se ve siempre lo mismo (el arco de globos, la mesa de regalos). En el contraplano se ve lo que está frente a ella (el pergolado, las montañas).

Dibújalo en la propuesta para el usuario y en `GUION.md`:
```
ESCENA A · <lugar> (tomas 1–10)
  [VÍCTIMA] ──mira→      ←mira── [VERDUGO 1]
                         ←mira── [VERDUGO 2]
        cámara siempre de este lado ↓
```

## Cobertura que ancla la mirada
- **Plano de dos de perfil** para abrir cada conversación: los dos en cuadro, mirándose. Establece la geografía.
- **Sobre el hombro (OTS):** el hombro o el pelo del otro desenfocado en el borde del cuadro, del lado donde está. Es la forma más fiable de que el modelo dirija la mirada: el personaje mira a alguien que se ve.
- **Plano "sucio" (dirty single):** primer plano con un pedazo del otro (blusa, pelo) en el borde. Igual de útil que el OTS.
- **Contraplano:** el mismo OTS desde el otro lado (el hombro de la víctima en el borde izquierdo, el verdugo a la derecha mirando a la izquierda).
- **Plano de reacción muda:** primer plano de la víctima mirando hacia donde está quien la humilló.
- **Producto en conversación:** el mensajero le habla a la víctima (mirada hacia ella), y solo el frasco da a la cámara, quieto, a la altura del pecho. Así lo hace el mesero del V1.

## Cómo se escribe en cada toma de `proyecto.json`
- `encuadre`: el plano, quién está a qué lado, hacia dónde gira la cara ("face in three-quarter view turned to the RIGHT, looking at Tia just off-frame right") y el borde del cuadro donde está el otro ("a sliver of TIA's emerald blouse blurred on the RIGHT edge").
- `miradas`: la frase para el modelo de video ("CARO looks at TIA, just off-frame to the RIGHT; she never looks into the camera lens").
- `mira`: la etiqueta corta para la hoja de revisión ("Caro → der").

## Cómo se verifica (antes de gastar en la siguiente etapa)
1. **Fotogramas:** `hoja.py <carpeta> frames` y revisa con Read cada mirada contra la etiqueta `mira`. Haz un recorte de las caras si las miniaturas no alcanzan. Regenera las que fallen (10 créditos cada una).
2. **Clips:** `hoja.py <carpeta> clips` muestra cada clip en 4 instantes. Omni a veces gira al personaje hacia la cámara a mitad del clip. Si pasa durante la línea, regenera ese clip con la mirada reforzada ("her eyes stay fixed on VALE at the RIGHT edge for the whole shot; she never turns toward the camera").
3. **Los cortes internos** (el modelo cambia de plano dentro del clip) los detecta y evita `montaje.py`. Si caen en medio de la línea, la toma se bloquea y hay que regenerarla.
