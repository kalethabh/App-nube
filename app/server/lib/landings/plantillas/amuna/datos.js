// La landing de AMUNA (klickshoppe-col) convertida en estructura (2026-11-27f): el ejemplo lleno (AMUNA) y la plantilla gris
// (GRIS: Producto X, con la medida exacta de cada imagen y textos del mismo largo). Sale del artefacto que aprobó el usuario.
/* eslint-disable */
export const AMUNA = {
  producto: { nombre: 'AMUNA Vitaldrops™', corto: 'Vitaldrops', marca: 'AMUA', unidad: 'frasco', unidades: 'frascos' },
  galeria: Array.from({ length: 11 }, (_, k) => `img/galeria-${String(k + 1).padStart(2, '0')}.webp`),
  pruebaSocial: { avatares: ['img/avatar-1.webp', 'img/avatar-2.webp', 'img/avatar-3.webp', 'img/avatar-4.webp'], texto: 'Opiniones de clientas', enlace: '+12,537 Clientas recibieron Vitaldrops™' },
  titulo: {
    lede: 'Dale un espacio a tu rutina, a tu ritmo y con buena actitud. Elige el combo que más te convenga, sin tantas vueltas.',
    checks: ['Formato líquido con gotero', 'Ingredientes de origen vegetal', 'Compra única, sin suscripción', 'Elige entre 1, 2 o 3 frascos'],
  },
  oferta: {
    titulo: 'Elige tu tratamiento',
    combos: [
      { id: 'tres', cantidad: 3, precio: 139900, antes: 239700, nombre: 'Tratamiento completo x3 meses — Resultados rápidos y duraderos, sin efecto rebote', insignia: 'SIN EFECTO REBOTE', foto: 'img/combo-3.webp' },
      { id: 'dos', cantidad: 2, precio: 119900, antes: 159800, nombre: 'Tratamiento doble - 2 Meses', foto: 'img/combo-2.webp' },
      { id: 'uno', cantidad: 1, precio: 79900, antes: null, nombre: 'Tratamiento inicial - 1 Mes', foto: 'img/combo-1.webp' },
    ],
    elegido: 'tres',
    envio: { titulo: 'Envío y cobertura:', texto: 'Precios en pesos colombianos. El envío y la cobertura se confirman en el formulario.' },
    boton: 'Pedir y pagar al recibir', subBoton: 'Quiero este tratamiento',
  },
  testimonio: { nombre: 'Valentina R.', foto: 'img/testimonio.webp', texto: '¡A mí sí me funcionó! Toda la vida sentí que tenía los glúteos planos —todavía un poquito, jaja—, pero la diferencia desde que empecé me parece enorme. En mi caso, la gente lo ha notado. Mi pareja también lo nota 😅😂. Lo que más cuidé fue ser constante.' },
  dudas: [
    ['¿Qué hace diferente a VitalDrops?', 'VitalDrops combina varios ingredientes en un formato líquido con gotero. Su presentación está **pensada para integrarse a tu rutina diaria** siguiendo la dosis y las indicaciones del producto. Sin hacer malabares.'],
    ['¿En cuánto tiempo veré cambios?', 'La respuesta a un suplemento varía entre personas. No podemos garantizar cambios en medidas ni un plazo concreto. Lo importante es seguir las indicaciones y escuchar a tu cuerpo.'],
    ['¿Cuándo recibiré mi pedido?', 'El tiempo depende de tu ciudad y de la transportadora. **Consulta los tiempos disponibles** en el formulario de pedido antes de confirmar tu compra. Si necesitas ayuda con el seguimiento, escríbenos con tu número de pedido.'],
    ['¿Qué pasa si necesito ayuda o una devolución?', 'Escríbenos con tu número de pedido y el motivo de tu solicitud. Revisaremos tu caso según las políticas de cambios y devoluciones de la tienda.'],
  ],
  aviso: { titulo: 'Revisa bien tu pedido.', texto: 'Antes de confirmar, comprueba el combo, tus datos, la cobertura y el total. Así evitamos enredos y tu pedido sale con la información correcta.' },
  creativo: 'img/creativo.webp',
  ellas: {
    titulo: 'Ellas cuentan su experiencia', sub: 'Historias compartidas por nuestras clientas, en sus propias palabras.',
    items: [
      { nombre: 'Maya J.', foto: 'img/antes-despues-1.webp', texto: 'En un asado, mi prima me llevó a un ladito y me preguntó de una si me había hecho algún tratamiento. Le dije: “No, amiga, son unas gotas que me pongo debajo de la lengua”. No me creyó hasta que le mostré el frasco. Siempre he sido delgadita, así que todo el mundo se dio cuenta. Esa es la parte que nadie te cuenta: la gente sí lo nota.' },
      { nombre: 'Renée W.', foto: 'img/antes-despues-2.webp', texto: 'Siempre fui la amiga que nadie notaba cuando salíamos. Dulce, divertida, pero invisible. Unos dos meses después de empezar con las gotas, una amiga me dijo: “¿Y ahora qué estás haciendo diferente?”. Ahora los hombres me abren las puertas. El vestido me queda como hecho a la medida. Siento que por fin encontré mi lugar en mi propia vida, si eso tiene sentido.' },
      { nombre: 'Tiana R.', foto: 'img/antes-despues-3.webp', texto: 'Un año entero haciendo sentadillas y lo único que conseguí fue tonificar. Firme, sí, pero plana como siempre. Mi entrenador me decía que comiera más, y yo comía más. Empecé con las gotas en marzo y seguí entrenando igual… y por fin hay algo ahí. Como si el músculo siempre hubiera estado, pero mi cuerpo nunca le hubiera añadido nada encima. Ahora sí.' },
      { nombre: 'Keisha M.', foto: 'img/antes-despues-4.webp', texto: 'He sido delgada toda la vida. Comía de todo y seguía igual; mis amigos me decían que estuviera agradecida, jaja. Tomaba estas gotas todas las mañanas sin esperar nada… En la semana 6, los leggings empezaron a quedarme diferentes en la parte de atrás. En la semana 10 tuve que comprarme unos jeans de una talla más porque no me cerraban por el trasero. Lloré un poquito, para ser sincera.' },
      { nombre: 'Jazmín T.', foto: 'img/antes-despues-5.webp', texto: 'Mi novio solía molestarme diciendo que tenía el trasero más plano que había visto. Yo me reía, pero en el fondo me daba duro. Después de unos dos meses tomando las gotas, literalmente no podía quitarme las manos de encima. No paraba de decir: “¡Uy, amor! ¿Qué cambió?”. Ahora, cada vez que salimos, me agarra el trasero, me anima y me hace sentir muy segura de mí misma. Por fin siento que mi cuerpo refleja cómo siempre me he sentido por dentro.' },
    ],
  },
  ingredientes: 'img/ingredientes.webp',
  historias: { usuario: '@amua.co', stickers: ['Mi ritual de cada mañana', 'Constancia > prisa', 'Gotas + agua + a darle', 'Día 21 del ritual', 'Lista para mi día', 'Pequeños hábitos, gran cambio'], titulo: 'Historias de clientas AMUA', texto: 'Fotos y mensajes que nos mandan las que ya empezaron su ritual.', boton: 'Quiero el mío', nota: 'Experiencias compartidas por nuestra comunidad AMUA.', fotos: [1, 2, 3, 4, 5, 6].map((k) => `img/historia-${k}.webp`) },
  ruta: {
    titulo: 'Tu rutina, *a tu ritmo*', sub: 'Una guía para organizar tus hábitos, sin promesas mágicas ni afanes.',
    pasos: [
      ['Primera semana', 'Conoce tu rutina', 'Empieza por leer la etiqueta y elegir un horario cómodo. No dupliques la dosis para intentar acelerar cambios: aquí las carreras no ayudan.'],
      ['Semanas 2 y 3', 'La constancia cuenta', 'Revisa cómo te sientes y mantén hábitos de alimentación, descanso y movimiento. Un suplemento no sustituye esos cuidados ni dirige el peso a zonas específicas.'],
      ['Un mes', 'Haz una pausa y revisa', 'Observa tu experiencia sin compararte con otras personas. Si notas alguna molestia, suspende el uso y consulta con un profesional de salud.'],
      ['Tres meses', 'Tu bienestar va primero', 'Revisa tu rutina y decide qué te funciona. No hay un plazo universal para obtener cambios físicos ni una garantía de transformación.'],
    ],
  },
  experiencias: {
    pill: 'Opiniones de nuestras clientas', titulo: 'Experiencias *personales*', fotoProducto: 'img/producto-mini.webp', precioDesde: 79900,
    items: [
      { nombre: 'Mariana G.', foto: 'img/experiencia-1.webp', texto: 'Casi no lo compré porque ya había probado de todo: pastillas para aumentar de peso, batidos, productos para el apetito… A veces no notaba nada y otras sentía que el peso se iba al abdomen. Llevo unos tres meses con VitalDrops y, en mi experiencia, he visto cambios en las caderas y los muslos. También siento más apetito y me preguntan si estoy entrenando 😂. Me alegra haberlo probado.' },
      { nombre: 'Daniela M.', foto: 'img/experiencia-2.webp', texto: 'No voy a mentir: pensé que sería otro producto con promesas enormes. Ya había comprado varias cosas y terminado decepcionada. Lo primero que noté fue que recuperé el apetito. Después de unas semanas, sentí las caderas más llenas y la ropa me quedaba diferente. Llevo un poco más de tres meses y estoy contenta con mi experiencia 💛.' },
      { nombre: 'Camila P.', foto: 'img/experiencia-3.webp', texto: 'Después de tener a mi hija, sentía que mi cuerpo había cambiado mucho. Gasté bastante probando productos porque quería recuperar mis curvas. En mi cuarto mes con VitalDrops, siento una diferencia en cómo me quedan los jeans y me da más confianza vestirme. Esa ha sido mi experiencia personal 🤎.' },
    ],
  },
  ugc: { titulo: 'Experiencias con VitalDrops', fotos: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `img/ugc-${k}.webp`) },
  pasos: {
    titulo: 'Un pequeño ritual *para tu rutina diaria*', sub: 'Tres pasos sencillos, sin complicarte el día',
    items: [
      { foto: 'img/paso-1.webp', titulo: 'Revisa y prepara', texto: 'Lee la dosis del empaque que recibas y utiliza el gotero según sus indicaciones. No aumentes la cantidad para intentar acelerar resultados.' },
      { foto: 'img/paso-2.webp', titulo: 'Úsalo según la etiqueta', texto: 'Sigue el modo de uso indicado en tu presentación. Si tienes dudas sobre cómo tomarlo, consulta con un profesional antes de empezar.' },
      { foto: 'img/paso-3.webp', titulo: 'Escucha a tu cuerpo', texto: 'Busca un horario cómodo y acompaña tu rutina con buenos hábitos. Si notas molestias, suspende el uso y consulta. Tu bienestar va primero.' },
    ],
  },
  franja: ['INGREDIENTES VEGETALES', 'PAGO AL RECIBIR', 'COMBOS CON AHORRO'],
  comparacion: {
    titulo: 'Una rutina que se adapta a ti', sub: 'Conoce la presentación y compara antes de decidir.',
    nuestra: 'Vitaldrops', nuestraSub: 'De Amua', otra: 'Otras opciones', otraSub: 'Compara la etiqueta',
    filas: ['Formato en gotas con gotero', 'Compra por combos', 'Presentación líquida', 'Ingredientes de origen vegetal', 'Compra única, sin suscripción', 'Información en el empaque'],
  },
  compraClara: { titulo: '*Tu compra,* con información clara', texto: 'Antes de confirmar, revisa tu combo, el envío y el total. Si necesitas ayuda después de comprar, escríbenos con tu número de pedido. Las solicitudes de cambio o devolución se revisan según las políticas de la tienda.', boton: 'Quiero hacer mi pedido', garantias: ['Compra única', 'Pago al recibir', 'Atención por correo'] },
  cuidado: {
    foto: 'img/cuidado.webp', titulo: 'Tu rutina merece cuidado, no promesas mágicas.',
    parrafos: [
      'Cada cuerpo responde de forma distinta. La alimentación, el descanso, el movimiento y tu estado de salud influyen en cómo te sientes. Un suplemento complementa tu rutina: no reemplaza un tratamiento ni puede garantizar que el peso se distribuya en una zona específica.',
      'VitalDrops reúne maca, ashwagandha, remolacha, fenogreco y L-arginina en una presentación líquida. Antes de usarlo, revisa la etiqueta y las indicaciones de tu empaque. Si estás embarazada, amamantando, tomas medicamentos o tienes una condición de salud, consulta con un profesional.',
      'Sin afán y sin comparaciones: escucha a tu cuerpo y decide con información.',
    ],
    pie: '5 testimonios compartidos por nuestras clientas',
  },
  resenas: {
    titulo: 'La comunidad AMUA opina', nota: '4,8', cuantas: 'Más de 10.000 opiniones', barras: [9, 2, 0, 0, 0],
    fotos: ['opinion-1', 'opinion-2', 'historia-4', 'opinion-3', 'opinion-4', 'opinion-5', 'opinion-6'].map((f) => `img/${f}.webp`),
    items: [
      { nombre: 'Alejandra Trejo', foto: 'img/opinion-1.webp', titulo: 'Mi apetito por fin ha cambiado', texto: 'Llevaba mucho tiempo intentando comer más y me costaba muchísimo. Con AMUA he notado más apetito durante el día y me resulta más fácil mantener mis comidas. Estoy siendo constante y quiero ver cómo evoluciona con el tiempo.', lugar: 'Córdoba, 12 de julio de 2026', estrellas: 5 },
      { nombre: 'Mariana López', foto: 'img/opinion-2.webp', titulo: 'Estoy empezando a notar más forma', texto: 'Siempre he sido muy delgada y me costaba muchísimo ganar volumen. Después de varias semanas noto más forma en caderas y muslos y, sobre todo, siento que por fin estoy avanzando hacia el objetivo que tenía.', lugar: 'Buenos Aires, Jal. 8 de julio de 2026', estrellas: 5 },
      { nombre: 'Mariana Beltrán', foto: 'img/historia-4.webp', titulo: 'Mis jeans me quedan diferente', texto: 'Lo que más me ha sorprendido es la ropa. Algunos jeans que antes me quedaban muy sueltos en la cadera ahora me sientan de otra manera. Llevo varias semanas y estoy muy contenta con cómo está evolucionando mi figura.', lugar: 'San Juan, N.L. 5 de julio de 2026', estrellas: 5 },
      { nombre: 'Rocío Hernández', foto: 'img/opinion-3.webp', titulo: 'Me siento más cómoda con mi silueta', texto: 'Siempre he tenido una figura bastante recta y era algo que me acomplejaba. Con constancia y una alimentación más cuidada estoy empezando a notar más volumen en la parte inferior y me siento mucho más segura.', lugar: 'Rosario, N.L. 3 de julio de 2026', estrellas: 5 },
      { nombre: 'Gabriela Sánchez', foto: 'img/opinion-4.webp', titulo: 'Hay que ser constante, pero merece la pena', texto: 'Los primeros días no esperaba notar gran cosa. Después de varias semanas empecé a notar más apetito y pequeños cambios en cómo me queda la ropa. Para mí lo importante está siendo mantener la rutina todos los días.', lugar: 'Tucumán, Cap. 1 de julio de 2026', estrellas: 4 },
      { nombre: 'Daniela Martínez', foto: 'img/opinion-5.webp', titulo: 'Noto más volumen en la parte inferior', texto: 'Lo compré pensando sobre todo en conseguir una figura más proporcionada. Estoy combinándolo con comidas completas y entrenamiento y, después de varias semanas, noto cambios especialmente en caderas y muslos.', lugar: 'Jujuy, Cap. 27 de junio de 2026', estrellas: 5 },
      { nombre: 'Alba Medina', foto: 'img/opinion-6.webp', titulo: 'Por fin siento que estoy avanzando', texto: 'Siempre me ha costado ganar peso y eso me frustraba bastante. Ahora estoy siguiendo la rutina de AMUA y prestando más atención a mis comidas. Poco a poco empiezo a notar cambios y eso me está motivando mucho.', lugar: 'Buenos Aires, B.C. 24 de junio de 2026', estrellas: 5 },
      { nombre: 'Sofía Ramírez', foto: 'img/historia-2.webp', titulo: 'Mi cuerpo se empieza a ver más proporcionado', texto: 'No buscaba simplemente ganar peso, quería sentir que mi figura tenía más forma. Después de varias semanas noto más volumen en la zona de las caderas y los muslos y me gusta mucho más cómo me queda la ropa.', lugar: 'Tierra del Fuego, USH. 21 de junio de 2026', estrellas: 5 },
      { nombre: 'Patricia González', foto: 'img/historia-1.webp', titulo: 'Me gusta cómo está cambiando mi figura', texto: 'Empecé porque siempre sentía que cuando ganaba peso se me notaba primero en el abdomen. Estoy siendo constante con AMUA, comiendo mejor y entrenando, y ahora noto una silueta más equilibrada.', lugar: 'Mendoza, B.C. 18 de junio de 2026', estrellas: 4 },
      { nombre: 'Carmen Vázquez', foto: 'img/opinion-7.webp', titulo: 'La ropa es donde más noto el cambio', texto: 'Lo que más me gusta es que puedo comparar cómo me queda la ropa. Antes sentía que todo me quedaba muy recto y ahora empiezo a notar más forma en caderas y muslos. Voy a seguir con la rutina.', lugar: 'CABA, Gto. 16 de junio de 2026', estrellas: 5 },
      { nombre: 'Lucía Peña', foto: 'img/historia-3.webp', titulo: 'Estoy mucho más segura con mi cuerpo', texto: 'Antes evitaba algunas prendas porque no me gustaba cómo se veía mi figura. Después de mantener la rutina durante varias semanas noto más forma y me siento mucho más cómoda conmigo misma.', lugar: 'Salta, 14 de junio de 2026', estrellas: 5 },
    ],
  },
  faq: {
    titulo: 'Preguntas frecuentes', sub: 'Resolvamos esas dudas antes de que hagas tu pedido.',
    items: [
      ['¿Cómo lo tomo?', 'Sigue la dosis y el modo de uso indicados en el empaque de tu presentación. No aumentes la dosis para intentar acelerar resultados. Si tienes dudas, consulta con un profesional de salud.'],
      ['¿En cuánto tiempo veré cambios?', 'Cada persona responde de forma diferente. No podemos garantizar un plazo, un aumento de medidas ni una transformación física. Escucha a tu cuerpo y sigue las indicaciones del producto.'],
      ['¿Qué hace diferente a VitalDrops?', 'Es una combinación de ingredientes en formato líquido con gotero. Revisa su composición, las indicaciones del empaque y tus necesidades antes de decidir si lo integras a tu rutina.'],
      ['¿Es adecuado para mi edad?', 'Antes de usar un suplemento, revisa la etiqueta y consulta con un profesional si tienes dudas. Las necesidades y precauciones pueden variar según la edad y el estado de salud.'],
      ['¿Funciona para cualquier tipo de cuerpo?', 'No existe una respuesta igual para todas las personas. No podemos garantizar cambios en una zona específica ni un resultado según tu tipo de cuerpo.'],
      ['¿Qué pasa si dejo de tomarlo?', 'Si tienes dudas sobre continuar o suspender un suplemento, revisa sus indicaciones y consulta con un profesional. No asumimos que los cambios físicos sean permanentes ni garantizados.'],
      ['¿Puede causar efectos no deseados?', 'Un ingrediente vegetal no es adecuado para todas las personas. Si estás embarazada, amamantando, tomas medicamentos, tienes alergias o una condición de salud, consulta antes de usarlo. Si notas molestias, suspende el uso y busca orientación profesional.'],
      ['¿Qué contiene VitalDrops?', 'La fórmula declarada incluye maca, ashwagandha, remolacha, fenogreco y L-arginina. La etiqueta de tu presentación es la referencia para revisar su composición.'],
      ['¿Cuándo recibiré mi pedido?', 'Depende de tu ciudad, la cobertura y la transportadora. Revisa la información del formulario y la confirmación del pedido. Si necesitas ayuda, escríbenos con tu número de pedido.'],
      ['¿Cómo pido un cambio o una devolución?', 'Escríbenos con tu número de pedido y el motivo de tu solicitud. Revisaremos tu caso según las políticas de cambios y devoluciones de la tienda.'],
      ['¿Es una suscripción?', 'No. Los combos de esta página son compras únicas, sin envíos automáticos ni cobros recurrentes.'],
    ],
  },
  pie: {
    contacto: '¿Necesitas una mano con tu pedido? Escríbenos y te ayudamos.',
    enlaces: ['Consulta tu pedido', 'Nuestra misión', 'Contáctanos'],
    tienda: ['Envíos', 'Cambios y devoluciones', 'Privacidad', 'Términos del servicio'],
    correo: 'klickshoppeinfo@gmail.com', empresa: 'KSP', pais: 'Colombia',
    legal: ['Este producto es un suplemento. No está destinado a diagnosticar, tratar, curar ni prevenir enfermedades.', 'Consulta con un profesional antes de usar suplementos si estás embarazada, amamantando, tomas medicamentos o tienes una condición de salud.'],
    copy: '© 2026 AMUA VITALDROPS',
  },
  avisosCompra: ['Valentina R.', 'Mariana G.', 'Daniela M.', 'Camila P.', 'Natalia C.', 'Carolina V.', 'Isabella T.', 'Juliana S.', 'Laura F.', 'Andrea B.'],
};

// La PLANTILLA GRIS: un producto genérico («Producto X») con el mismo formato, posiciones, tamaños de imagen y largo
// de textos que la landing de AMUNA. Cada imagen es un recuadro gris (gris:<ancho>x<alto>:<qué va ahí>).
export const GRIS = {
  tema: { amarillo: '#CFCFCF', fuerte: '#8F8F8F', suave: '#F1F1F1', borde: '#D9D9D9', estrella: '#A3A3A3', sobre: '#262626', pie: '#E2E2E2', aviso: '#F6F6F6', ahorro: '#5C5C5C', enlace: '#5C5C5C', chip: '#555555', foto: '#ECECEC', sombra: 'rgba(0,0,0,.10)', verde: '#6B6B6B', verdeSuave: '#ECECEC' },
  producto: { nombre: 'Producto X™', corto: 'Producto X', marca: 'TU MARCA', unidad: 'unidad', unidades: 'unidades' },
  galeria: ['gris:942x1670:Imagen principal: el producto y su gran promesa', 'gris:1200x1200:El producto y sus ingredientes', 'gris:1200x1200:Cómo se usa', 'gris:1200x1200:Ruta de resultados', 'gris:1200x1200:Testimonio con foto', 'gris:1200x1200:Experiencias de clientas', 'gris:1200x1200:Detalle del producto', 'gris:1200x1200:Comparación', 'gris:1200x1200:Pasos de uso', 'gris:1200x1200:Compra clara y envío', 'gris:1200x1200:Información de la etiqueta'],
  pruebaSocial: { avatares: ['gris:50x50', 'gris:50x50', 'gris:50x50', 'gris:50x50'], texto: 'Opiniones de clientas', enlace: '+N.NNN Clientas recibieron Producto X™' },
  titulo: {
    lede: 'Una frase corta con el beneficio principal, para quién es y cómo se usa. Elige el combo que más te convenga, sin tantas vueltas.',
    checks: ['Formato y presentación del producto', 'Ingrediente o característica principal', 'Compra única, sin suscripción', 'Elige entre 1, 2 o 3 unidades'],
  },
  oferta: {
    titulo: 'Elige tu tratamiento',
    combos: [
      { id: 'tres', cantidad: 3, precio: 139900, antes: 239700, nombre: 'Tratamiento completo x3 meses — Beneficio principal y razón para elegir este combo', insignia: 'MÁS VENDIDO', foto: 'gris:1200x1200:3 unidades' },
      { id: 'dos', cantidad: 2, precio: 119900, antes: 159800, nombre: 'Tratamiento doble - 2 Meses', foto: 'gris:1200x1200:2 unidades' },
      { id: 'uno', cantidad: 1, precio: 79900, antes: null, nombre: 'Tratamiento inicial - 1 Mes', foto: 'gris:1200x1200:1 unidad' },
    ],
    elegido: 'tres',
    envio: { titulo: 'Envío y cobertura:', texto: 'Precios en pesos colombianos. El envío y la cobertura se confirman en el formulario.' },
    boton: 'Pedir y pagar al recibir', subBoton: 'Quiero este tratamiento',
  },
  testimonio: { nombre: 'Nombre A.', foto: 'gris:1080x1080', texto: 'Testimonio corto de una clienta real, contado en sus palabras: qué le pasaba antes, qué cambió desde que empezó con Producto X y una escena concreta de su día a día. Cercano, con un toque de humor y con emojis si los usó 😅. Lo que más cuidó fue ser constante.' },
  dudas: [
    ['¿Qué hace diferente a Producto X?', 'Producto X combina sus ingredientes principales en un formato práctico. Su presentación está **pensada para integrarse a tu rutina diaria** siguiendo la dosis y las indicaciones del producto. Sin hacer malabares.'],
    ['¿En cuánto tiempo veré cambios?', 'La respuesta a un producto varía entre personas. No podemos garantizar cambios en medidas ni un plazo concreto. Lo importante es seguir las indicaciones y escuchar a tu cuerpo.'],
    ['¿Cuándo recibiré mi pedido?', 'El tiempo depende de tu ciudad y de la transportadora. **Consulta los tiempos disponibles** en el formulario de pedido antes de confirmar tu compra. Si necesitas ayuda con el seguimiento, escríbenos con tu número de pedido.'],
    ['¿Qué pasa si necesito ayuda o una devolución?', 'Escríbenos con tu número de pedido y el motivo de tu solicitud. Revisaremos tu caso según las políticas de cambios y devoluciones de la tienda.'],
  ],
  aviso: { titulo: 'Revisa bien tu pedido.', texto: 'Antes de confirmar, comprueba el combo, tus datos, la cobertura y el total. Así evitamos enredos y tu pedido sale con la información correcta.' },
  creativo: 'gris:1092x1440:Creativo vertical: titular grande, beneficios con íconos, ingredientes, el producto y una persona con el resultado',
  ellas: {
    titulo: 'Ellas cuentan su experiencia', sub: 'Historias compartidas por nuestras clientas, en sus propias palabras.',
    items: [1, 2, 3, 4, 5].map((k) => ({
      nombre: `Nombre ${'ABCDE'[k - 1]}.`, foto: `gris:${['606x990', '620x994', '610x1003', '616x999', '619x1002'][k - 1]}:Tarjeta de testimonio en una imagen: antes y después, nombre, estrellas y su historia`,
      texto: 'Historia de una clienta real, en primera persona y en sus palabras: la situación de antes, una escena concreta con alguien que notó el cambio, qué dijo ella y cómo se siente ahora con su cuerpo. Cercana y con detalles del día a día, como una conversación entre amigas. Termina con la frase que más recuerda.',
    })),
  },
  ingredientes: 'gris:1122x1402:Infografía de ingredientes: el producto al centro y cada ingrediente con su beneficio',
  historias: { titulo: 'Historias de clientas TU MARCA', texto: 'Fotos y mensajes que nos mandan las que ya empezaron su ritual.', boton: 'Quiero el mío', nota: 'Experiencias compartidas por nuestra comunidad TU MARCA.', fotos: ['1087x1446', '1087x1446', '1086x1448', '1086x1448', '941x1671', '1003x1568'].map((m) => `gris:${m}:Foto o historia de clienta con el producto`) },
  ruta: {
    titulo: 'Tu rutina, *a tu ritmo*', sub: 'Una guía para organizar tus hábitos, sin promesas mágicas ni afanes.',
    pasos: [
      ['Primera semana', 'Conoce tu rutina', 'Qué hacer al empezar: leer la etiqueta, elegir un horario cómodo y seguir la dosis indicada. Sin duplicar para acelerar: aquí las carreras no ayudan.'],
      ['Semanas 2 y 3', 'La constancia cuenta', 'Qué revisar en estas semanas: cómo te sientes y tus hábitos de alimentación, descanso y movimiento. El producto acompaña esos cuidados, no los sustituye.'],
      ['Un mes', 'Haz una pausa y revisa', 'Observa tu experiencia sin compararte con otras personas. Si notas alguna molestia, suspende el uso y consulta con un profesional de salud.'],
      ['Tres meses', 'Tu bienestar va primero', 'Revisa tu rutina y decide qué te funciona. Cada cuerpo tiene su tiempo y ningún producto puede garantizar una transformación igual para todas.'],
    ],
  },
  experiencias: {
    pill: 'Opiniones de nuestras clientas', titulo: 'Experiencias *personales*', fotoProducto: 'gris:1080x1080', precioDesde: 79900,
    items: [1, 2, 3].map((k) => ({
      nombre: `Nombre ${'FGH'[k - 1]}.`, foto: `gris:${['993x1323', '1200x1200', '1080x1080'][k - 1]}:Clienta sonriendo con el producto`,
      texto: 'Experiencia larga de una clienta real: qué había probado antes sin resultado, por qué casi no lo compra, qué notó primero con Producto X y qué cambió después de unas semanas. Cuánto tiempo lleva usándolo y cómo se siente hoy con su experiencia personal, contado con sus palabras y un emoji 💛.',
    })),
  },
  ugc: { titulo: 'Experiencias con Producto X', fotos: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => 'gris:941x1672:Captura de historia o chat de clienta') },
  pasos: {
    titulo: 'Un pequeño ritual *para tu rutina diaria*', sub: 'Tres pasos sencillos, sin complicarte el día',
    items: [
      { foto: 'gris:400x400:Paso 1 en video corto', titulo: 'Revisa y prepara', texto: 'Primer paso: qué revisar en el empaque y cómo preparar la dosis según sus indicaciones. Sin aumentar la cantidad para acelerar resultados.' },
      { foto: 'gris:400x400:Paso 2 en video corto', titulo: 'Úsalo según la etiqueta', texto: 'Segundo paso: cómo se usa en el día a día, según la presentación. Si hay dudas sobre cómo usarlo, consultar con un profesional antes de empezar.' },
      { foto: 'gris:400x400:Paso 3 en video corto', titulo: 'Escucha a tu cuerpo', texto: 'Tercer paso: el mejor momento del día y los hábitos que lo acompañan. Si notas molestias, suspende el uso y consulta. Tu bienestar va primero.' },
    ],
  },
  franja: ['BENEFICIO CLAVE', 'PAGO AL RECIBIR', 'COMBOS CON AHORRO'],
  comparacion: {
    titulo: 'Una rutina que se adapta a ti', sub: 'Conoce la presentación y compara antes de decidir.',
    nuestra: 'Producto X', nuestraSub: 'De Tu Marca', otra: 'Otras opciones', otraSub: 'Compara la etiqueta',
    filas: ['Formato práctico y fácil de usar', 'Compra por combos', 'Presentación del producto', 'Ingrediente o característica clave', 'Compra única, sin suscripción', 'Información en el empaque'],
  },
  compraClara: { titulo: '*Tu compra,* con información clara', texto: 'Antes de confirmar, revisa tu combo, el envío y el total. Si necesitas ayuda después de comprar, escríbenos con tu número de pedido. Las solicitudes de cambio o devolución se revisan según las políticas de la tienda.', boton: 'Quiero hacer mi pedido', garantias: ['Compra única', 'Pago al recibir', 'Atención por correo'] },
  cuidado: {
    foto: 'gris:1080x1080:Foto de estilo de vida: una clienta con el producto en su día a día', titulo: 'Tu rutina merece cuidado, no promesas mágicas.',
    parrafos: [
      'Cada cuerpo responde de forma distinta. La alimentación, el descanso, el movimiento y tu estado de salud influyen en cómo te sientes. Un producto complementa tu rutina: no reemplaza un tratamiento ni puede garantizar un resultado igual para todas las personas.',
      'Producto X reúne sus ingredientes principales en una presentación práctica. Antes de usarlo, revisa la etiqueta y las indicaciones de tu empaque. Si estás embarazada, amamantando, tomas medicamentos o tienes una condición de salud, consulta con un profesional.',
      'Sin afán y sin comparaciones: escucha a tu cuerpo y decide con información.',
    ],
    pie: 'N testimonios compartidos por nuestras clientas',
  },
  resenas: {
    titulo: 'La comunidad TU MARCA opina', nota: '4,8', cuantas: 'Número real de opiniones', barras: [9, 2, 0, 0, 0],
    fotos: ['972x1619', '1200x1156', '1086x1448', '1086x1448', '1028x1530', '972x1619', '1119x1405'].map((m) => `gris:${m}:Foto de reseña`),
    items: [
      ...['972x1619', '1200x1156', '1086x1448', '1086x1448', '1028x1530', '972x1619', '1119x1405', '1087x1446', '1087x1446', '1088x1445', '1086x1448'].map((m, k) => ({ nombre: `Nombre ${'IJKLMNOPQRS'[k]}`, titulo: 'Título corto de la reseña real', texto: k % 3 === 2 ? 'Reseña real: lo que más le gustó, cuánto tiempo lleva con el producto y el cambio que notó, contado en tres o cuatro líneas y con sus propias palabras.' : 'Reseña real de una clienta: qué buscaba, qué notó después de varias semanas y cómo se siente ahora. Cuatro o cinco líneas, en sus palabras, con un detalle concreto de su ropa, su rutina o su día a día.', lugar: 'Ciudad, fecha de la reseña', foto: `gris:${m}:Foto de la clienta`, estrellas: k === 4 || k === 8 ? 4 : 5 })),
    ],
  },
  faq: {
    titulo: 'Preguntas frecuentes', sub: 'Resolvamos esas dudas antes de que hagas tu pedido.',
    items: [
      ['¿Cómo lo uso?', 'Sigue la dosis y el modo de uso indicados en el empaque de tu presentación. No aumentes la dosis para intentar acelerar resultados. Si tienes dudas, consulta con un profesional de salud.'],
      ['¿En cuánto tiempo veré cambios?', 'Cada persona responde de forma diferente. No podemos garantizar un plazo ni una transformación física. Escucha a tu cuerpo y sigue las indicaciones del producto.'],
      ['¿Qué hace diferente a Producto X?', 'Su combinación de ingredientes en un formato práctico. Revisa su composición, las indicaciones del empaque y tus necesidades antes de decidir si lo integras a tu rutina.'],
      ['¿Es adecuado para mi edad?', 'Antes de usar el producto, revisa la etiqueta y consulta con un profesional si tienes dudas. Las necesidades y precauciones pueden variar según la edad y el estado de salud.'],
      ['¿Funciona para cualquier tipo de cuerpo?', 'No existe una respuesta igual para todas las personas. No podemos garantizar un resultado según tu tipo de cuerpo.'],
      ['¿Qué pasa si dejo de usarlo?', 'Si tienes dudas sobre continuar o suspender el producto, revisa sus indicaciones y consulta con un profesional. Los cambios no son permanentes ni garantizados.'],
      ['¿Puede causar efectos no deseados?', 'Ningún ingrediente es adecuado para todas las personas. Si estás embarazada, amamantando, tomas medicamentos, tienes alergias o una condición de salud, consulta antes de usarlo. Si notas molestias, suspende el uso y busca orientación profesional.'],
      ['¿Qué contiene Producto X?', 'La fórmula declarada en la etiqueta, con sus ingredientes principales. La etiqueta de tu presentación es la referencia para revisar su composición.'],
      ['¿Cuándo recibiré mi pedido?', 'Depende de tu ciudad, la cobertura y la transportadora. Revisa la información del formulario y la confirmación del pedido. Si necesitas ayuda, escríbenos con tu número de pedido.'],
      ['¿Cómo pido un cambio o una devolución?', 'Escríbenos con tu número de pedido y el motivo de tu solicitud. Revisaremos tu caso según las políticas de cambios y devoluciones de la tienda.'],
      ['¿Es una suscripción?', 'No. Los combos de esta página son compras únicas, sin envíos automáticos ni cobros recurrentes.'],
    ],
  },
  pie: {
    contacto: '¿Necesitas una mano con tu pedido? Escríbenos y te ayudamos.',
    enlaces: ['Consulta tu pedido', 'Nuestra misión', 'Contáctanos'],
    tienda: ['Envíos', 'Cambios y devoluciones', 'Privacidad', 'Términos del servicio'],
    correo: 'correo@tutienda.com', empresa: 'TU MARCA', pais: 'Colombia',
    legal: ['Aviso legal del tipo de producto: qué es y que no está destinado a diagnosticar, tratar, curar ni prevenir enfermedades.', 'Consulta con un profesional antes de usarlo si estás embarazada, amamantando, tomas medicamentos o tienes una condición de salud.'],
    copy: '© 2026 TU MARCA',
  },
  avisosCompra: ['Nombre A.', 'Nombre B.', 'Nombre C.', 'Nombre D.'],
};
