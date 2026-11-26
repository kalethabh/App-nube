// "¿Regenerar esta imagen?": costo estimado y confirmación antes de cobrar. Con una instrucción, la IA edita la imagen actual y cambia solo eso; vacío,
// sale otra versión con el mismo anuncio. La versión anterior queda guardada. Si la revisión marcó algo en esta imagen,
// se muestra arriba con «Corregir esto» (llena la caja con eso) y «otra versión» también le dice a la IA qué salió mal.
// (2026-11-26g) «que en esa ventana flotante también aparezca el anuncio»: la imagen va a la izquierda (arriba en el celular).
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, ImagePlus, RefreshCw, ScanEye, X } from 'lucide-react';
import { AreaTexto, Boton, Chip, Modal } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { partesDePieza } from '../../datos/imagenes.js';
import { costoDelLote } from '../../datos/costo-lote.js';
import { dinero } from '../../datos/formato.js';

const SUGERENCIAS = ['Corrige un texto', 'Titular más grande', 'Más contraste en los textos', 'Más grande el producto', 'Otro fondo', 'Otra persona', 'Más luz'];
const MAXIMO = 600;
// (2026-11-26h) «necesito poder adjuntar imágenes»: hasta 3 (subir, arrastrar, pegar o de «Mis piezas»)
const MAX_ADJUNTOS = 3;
// «Corregir esto»: la caja empieza así (el servidor lo reconoce y el aviso de listo dice «Corregí lo que notó la revisión»)
const CORREGIR = 'Corrige lo que notó la revisión:';
/** Lo que notó la revisión, después de los dos puntos (la primera letra en minúscula, salvo una sigla). */
const textoCorregir = (problemas) => `${CORREGIR} ${problemas.map((t) => t.replace(/^\p{Lu}(?!\p{Lu})/u, (c) => c.toLowerCase())).join(' ')}`.slice(0, MAXIMO);

export function ModalRegenerar({ pieza: p, conVertical, precio, onCerrar, onConfirmar, lote = null, productoId = null, formatosHechos = [], onTamano = null, onMasComoEsta = null }) {
  const [texto, setTexto] = useState('');
  // { id, archivo?: File, pieza?: id de Mis piezas, url }
  const [adjuntos, setAdjuntos] = useState([]);
  const subir = useRef(null);
  const { datos: piezasDatos } = useDatos(lote ? `imagen-ads:piezas:${productoId || ''}` : null, () => pedirNuevo(`/api/imagen-ads/piezas${productoId ? `?producto=${encodeURIComponent(productoId)}` : ''}`));
  const misPiezas = (piezasDatos?.piezas || []).slice(0, 12);
  const urls = useMemo(() => new Map(adjuntos.filter((a) => a.archivo).map((a) => [a.id, URL.createObjectURL(a.archivo)])), [adjuntos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const agregarArchivos = (lista) => {
    const nuevos = [...(lista || [])].filter((f) => /^image\//.test(f.type)).map((f) => ({ id: `f-${f.name}-${f.size}-${Math.random().toString(36).slice(2, 6)}`, archivo: f }));
    if (nuevos.length) setAdjuntos((l) => [...l, ...nuevos].slice(0, MAX_ADJUNTOS));
  };
  const alternarPieza = (x) => setAdjuntos((l) => (l.some((a) => a.pieza === x.id) ? l.filter((a) => a.pieza !== x.id) : [...l, { id: `p-${x.id}`, pieza: x.id, url: x.url }].slice(0, MAX_ADJUNTOS)));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const area = useRef(null);
  const clave = p?.pieza || null;

  const problemas = (Array.isArray(p?.problemas) ? p.problemas : []).map((t) => String(t || '').trim()).filter(Boolean);
  // abierto desde «Corregir esto» de la variación: la caja ya viene con lo que notó la revisión
  const conCorreccion = Boolean(p?.corregirAlAbrir) && problemas.length > 0;
  useEffect(() => {
    setTexto(conCorreccion ? textoCorregir(problemas) : '');
    setAdjuntos([]);
    setError(null);
    setEnviando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, conCorreccion]);

  // pegar una imagen (Cmd/Ctrl + V) mientras la ventana está abierta la adjunta
  useEffect(() => {
    if (!p || !lote) return undefined;
    const alPegar = (e) => {
      const fs = [...(e.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type));
      if (fs.length) {
        e.preventDefault();
        agregarArchivos(fs);
      }
    };
    window.addEventListener('paste', alPegar);
    return () => window.removeEventListener('paste', alPegar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, lote]);

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

  const faltaInstruccion = adjuntos.length > 0 && !texto.trim();
  const confirmar = async () => {
    if (!costo || enviando || faltaInstruccion) return;
    setEnviando(true);
    setError(null);
    try {
      // primero se suben las imágenes adjuntas al lote; después va el pedido con sus rutas
      const archivos = [];
      for (const a of adjuntos) {
        const r = a.pieza
          ? await pedirNuevo(`/api/imagen-ads/${encodeURIComponent(lote)}/adjuntos?pieza=${encodeURIComponent(a.pieza)}`, { metodo: 'PUT' })
          : await pedirNuevo(`/api/imagen-ads/${encodeURIComponent(lote)}/adjuntos`, { metodo: 'PUT', binario: a.archivo });
        archivos.push(r.archivo);
      }
      await onConfirmar(p, texto.trim().slice(0, MAXIMO), costo.max, archivos);
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
      tamano={p.url ? 'grande' : 'normal'}
      titulo="¿Regenerar esta imagen?"
      descripcion={`${nombre}. La versión de ahora queda guardada en Versiones anteriores.`}
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono={RefreshCw} cargando={enviando} disabled={!costo || faltaInstruccion} onClick={confirmar}>
            {texto.trim() ? 'Hacer el cambio' : 'Hacer otra versión'}
          </Boton>
        </>
      }
    >
      <div className={p.url ? 'lote-regenerar__cuerpo' : undefined}>
      {p.url ? (
        <a className={`lote-regenerar__anuncio${vertical ? ' lote-regenerar__anuncio--vertical' : ''}`} href={p.url} target="_blank" rel="noreferrer" title="Ver la imagen en grande">
          <img src={p.url} alt={`El anuncio ${nombre}`} />
        </a>
      ) : null}
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
        {lote ? (
          <div
            className="lote-regenerar__adjuntos"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              agregarArchivos(e.dataTransfer?.files);
            }}
          >
            <div className="lote-regenerar__adjuntos-fila">
              {adjuntos.map((a) => (
                <span key={a.id} className="lote-regenerar__adjunto">
                  <img src={a.url || urls.get(a.id)} alt="Imagen adjunta" />
                  <button type="button" onClick={() => setAdjuntos((l) => l.filter((y) => y.id !== a.id))} aria-label="Quitar la imagen adjunta" disabled={enviando}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              {adjuntos.length < MAX_ADJUNTOS ? (
                <Boton variante="secundario" tamano="chico" icono={ImagePlus} onClick={() => subir.current?.click()} disabled={enviando}>
                  Adjuntar imagen
                </Boton>
              ) : null}
              <input ref={subir} type="file" accept="image/*" multiple hidden onChange={(e) => { agregarArchivos(e.target.files); e.target.value = ''; }} />
            </div>
            <span className="t-chico t-3">Una pose, una persona, un fondo, un sello… (hasta 3). También puedes arrastrarla o pegarla con Cmd/Ctrl + V.</span>
            {misPiezas.length ? (
              <div className="lote-regenerar__piezas" aria-label="De Mis piezas">
                <span className="t-chico t-3">De Mis piezas:</span>
                {misPiezas.map((x) => {
                  const activa = adjuntos.some((a) => a.pieza === x.id);
                  return (
                    <button key={x.id} type="button" className={activa ? 'activo' : ''} aria-pressed={activa} title={x.nombre} onClick={() => alternarPieza(x)} disabled={enviando || (!activa && adjuntos.length >= MAX_ADJUNTOS)}>
                      <img src={x.url} alt={x.nombre} />
                    </button>
                  );
                })}
              </div>
            ) : null}
            {faltaInstruccion ? <span className="lote-regenerar__falta">Escribe qué hacer con la imagen adjunta (por ejemplo: «Usa la pose de la imagen adjunta»).</span> : null}
          </div>
        ) : null}
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
        {onTamano ? (
          <div className="lote-regenerar__tamanos">
            <span className="t-chico">
              <strong>Otro tamaño de este anuncio</strong> · sale de su cuadrado, con los mismos textos (1 imagen). Lo que ya tienes no cambia.
            </span>
            <div className="fila">
              {[
                ['1:1', 'Cuadrado 1:1'],
                ['9:16', 'Vertical 9:16'],
                ['4:5', 'Retrato 4:5'],
              ].map(([f, t]) => {
                const ya = formatosHechos.includes(f);
                return (
                  <Chip key={f} tamano="chico" onClick={() => onTamano(partesDePieza(p.pieza).v, f)} disabled={enviando || ya} title={ya ? 'Ya tiene este tamaño' : `Crear su ${t.toLowerCase()}`}>
                    {ya ? `${t} ✓` : `+ ${t}`}
                  </Chip>
                );
              })}
            </div>
          </div>
        ) : null}
        {onMasComoEsta && partesDePieza(p.pieza).formato === '1:1' && p.url ? (
          <div className="lote-regenerar__tamanos">
            <span className="t-chico">
              <strong>Más como esta</strong> · nuevas imágenes de este mismo anuncio con otra modelo, pose y escena (eliges cuántas).
            </span>
            <div className="fila">
              <Chip tamano="chico" onClick={() => onMasComoEsta(partesDePieza(p.pieza).v)} disabled={enviando}>
                + Variantes de esta imagen
              </Chip>
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="lote-regenerar__error" role="alert">
            <CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </div>
      </div>
    </Modal>
  );
}
