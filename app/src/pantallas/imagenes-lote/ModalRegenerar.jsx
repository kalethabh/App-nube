// "¿Regenerar esta imagen?": costo estimado y confirmación antes de cobrar. Con una instrucción, la IA edita la imagen actual y cambia solo eso; vacío,
// sale otra versión con el mismo anuncio. La versión anterior queda guardada. Si la revisión marcó algo en esta imagen,
// se muestra arriba con «Corregir esto» (llena la caja con eso) y «otra versión» también le dice a la IA qué salió mal.
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, RefreshCw, ScanEye } from 'lucide-react';
import { AreaTexto, Boton, Chip, Modal } from '../../componentes/index.js';
import { partesDePieza } from '../../datos/imagenes.js';
import { costoDelLote } from '../../datos/costo-lote.js';
import { dinero } from '../../datos/formato.js';

const SUGERENCIAS = ['Corrige un texto', 'Titular más grande', 'Más contraste en los textos', 'Más grande el producto', 'Otro fondo', 'Otra persona', 'Más luz'];
const MAXIMO = 600;
// «Corregir esto»: la caja empieza así (el servidor lo reconoce y el aviso de listo dice «Corregí lo que notó la revisión»)
const CORREGIR = 'Corrige lo que notó la revisión:';
/** Lo que notó la revisión, después de los dos puntos (la primera letra en minúscula, salvo una sigla). */
const textoCorregir = (problemas) => `${CORREGIR} ${problemas.map((t) => t.replace(/^\p{Lu}(?!\p{Lu})/u, (c) => c.toLowerCase())).join(' ')}`.slice(0, MAXIMO);

export function ModalRegenerar({ pieza: p, conVertical, precio, onCerrar, onConfirmar }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const area = useRef(null);
  const clave = p?.pieza || null;

  const problemas = (Array.isArray(p?.problemas) ? p.problemas : []).map((t) => String(t || '').trim()).filter(Boolean);
  // abierto desde «Corregir esto» de la variación: la caja ya viene con lo que notó la revisión
  const conCorreccion = Boolean(p?.corregirAlAbrir) && problemas.length > 0;
  useEffect(() => {
    setTexto(conCorreccion ? textoCorregir(problemas) : '');
    setError(null);
    setEnviando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, conCorreccion]);

  if (!p) return null;
  const { nombre, formato } = partesDePieza(p.pieza);
  const vertical = formato === '9:16';
  // (plantillas: el servidor dice cuántas imágenes cobra: 0 si la dibuja la app, 1 si pide otra escena)
  const deServidor = typeof p.imagenesRegenerar === 'number' ? p.imagenesRegenerar : null;
  const cantidad = deServidor !== null ? deServidor : conVertical && (!vertical || texto.trim()) ? 2 : 1;
  const costo = deServidor === 0 ? { min: 0, max: 0, gratis: true } : costoDelLote(precio, cantidad);

  const corregirEsto = () => {
    setTexto(textoCorregir(problemas));
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const sumar = (s) => {
    setTexto((t) => {
      const base = t.trim();
      const nuevo = s === 'Corrige un texto' ? `${base ? `${base} ` : ''}Corrige el texto «» por «».` : `${base ? `${base.replace(/[.\s]*$/, '.')} ` : ''}${s}.`;
      return nuevo.slice(0, MAXIMO);
    });
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      const i = el.value.indexOf('«»');
      if (i >= 0) el.setSelectionRange(i + 1, i + 1);
      else el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const confirmar = async () => {
    if (!costo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(p, texto.trim().slice(0, MAXIMO), costo.max);
    } catch (e) {
      // (un 409 trae su porqué del servidor: un cambio en camino, la imagen todavía creándose, su cuadrado sin imagen…)
      setError(e?.estado === 409 ? (e?.datos?.error && typeof e.datos.error === 'string' ? e.datos.error : 'Esta imagen ya tiene un cambio en camino.') : e?.message || 'No pude pedirlo. Vuelve a intentarlo.');
      setEnviando(false);
    }
  };

  const nota = deServidor === 1
    ? 'Se pide otra escena, sin texto (lo que escribas va a la escena). El cuadrado y el vertical se vuelven a dibujar con ella y con los mismos textos; para cambiar un texto usa «Editar textos», gratis.'
    : deServidor === 0
      ? null
      : vertical
    ? 'Solo cambia el vertical. Si cambias un texto, también se cambia el cuadrado, para que sigan siendo el mismo anuncio.'
    : conVertical
      ? 'También se regenera su vertical.'
      : null;

  return (
    <Modal
      abierto
      onCerrar={enviando ? undefined : onCerrar}
      icono={RefreshCw}
      titulo="¿Regenerar esta imagen?"
      descripcion={`${nombre}. La versión de ahora queda guardada en Versiones anteriores.`}
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono={RefreshCw} cargando={enviando} disabled={!costo} onClick={confirmar}>
            {texto.trim() ? 'Hacer el cambio' : 'Hacer otra versión'}
          </Boton>
        </>
      }
    >
      <div className="pila" style={{ '--hueco': '12px' }}>
        <p className="t-chico" role="status">
          {costo?.gratis ? 'Sin costo: la dibuja la app con otros textos, en un segundo. Para cambiar un texto puntual, usa «Editar textos».' : costo?.conChatGPT ? 'Sin costo: la hace tu suscripción de ChatGPT (usa un poco de tu cupo).' : costo ? `Costo estimado${cantidad > 1 ? ' máximo' : ''}: ${dinero(costo.max)}. Al confirmar autorizas esta generación.` : 'Calculando el costo antes de regenerar…'}
        </p>
        {problemas.length ? (
          <div className="lote-regenerar__revision">
            <p className="lote-regenerar__revision-titulo">La revisión notó:</p>
            <ul className="lote-var__problemas">
              {problemas.map((t, i) => (
                <li key={i}>
                  <ScanEye size={13} strokeWidth={2.2} aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="fila fila--envolver" style={{ '--hueco': '8px' }}>
              <Chip tamano="chico" onClick={corregirEsto} disabled={enviando}>
                Corregir esto
              </Chip>
              <span className="t-chico t-3">Si haces otra versión sin escribir nada, la IA también sabe qué salió mal.</span>
            </div>
          </div>
        ) : null}
        {deServidor === 0 ? null : (
        <>
        <AreaTexto
          ref={area}
          etiqueta="¿Qué quieres cambiar?"
          opcional
          filas={3}
          maxLength={MAXIMO}
          placeholder="Déjalo vacío para otra versión."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirmar();
          }}
          ayuda={texto.length > MAXIMO - 100 ? `${texto.length} de ${MAXIMO} letras` : 'Con tus palabras: la IA cambia solo eso y deja el resto igual.'}
          disabled={enviando}
          data-autofocus
        />
        <div className="fila fila--envolver" style={{ '--hueco': '6px' }} aria-label="Ideas">
          {SUGERENCIAS.map((s) => (
            <Chip key={s} tamano="chico" onClick={() => sumar(s)} disabled={enviando}>
              {s}
            </Chip>
          ))}
        </div>
        </>
        )}
        {nota ? <p className="t-chico t-3">{nota}</p> : null}
        {error ? (
          <p className="lote-regenerar__error" role="alert">
            <CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
