// Paso 1 "Tu producto": el formulario de una columna (izquierda) y la ficha que arma Claude (derecha).
//
// "Analizar mi producto" hace, en orden: POST /api/productos (crea temp/_productos/<id>/), sube cada foto
// con PUT /api/productos/:id/fotos/:n (cuerpo binario, la 1 es la principal) y lanza la sesión "ficha"
// de Claude con POST /api/productos/:id/analizar. La pantalla (index.jsx) mira el avance con
// GET /api/productos/:id hasta que llega la ficha real: lo deducido en amarillo y lo que falta en rojo,
// con sus preguntas. Las correcciones y las respuestas se guardan con PUT /api/productos/:id/ficha.
//
// Si cambias algo del formulario después de crear el producto, "Volver a analizar" crea uno nuevo (el
// servidor no edita un producto ya creado): así la ficha siempre corresponde a lo que ves.
import { useRef, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Check,
  CircleAlert,
  FileText,
  Hourglass,
  ImageOff,
  ImagePlus,
  Link2,
  MessageCircleQuestion,
  MonitorSmartphone,
  Package,
  PencilLine,
  Plus,
  RotateCcw,
  ScanSearch,
  Sparkles,
  SquarePen,
  Tag,
  X,
} from 'lucide-react';
import { AreaTexto, Boton, CampoTexto, Chip, SubirVideo, Tarjeta, useAvisos } from '../../componentes/index.js';
import { apiNuevo, urlFotoProducto, useEstilos } from '../../datos/api.js';
import { TIPOS_PRODUCTO, faltanDe, filasDeFicha } from './datos.js';
import { AvisoClaude, Progreso, TarjetaFalla } from './piezas.jsx';
import { SelloEstilo } from './SelloEstilo.jsx';

const TIPOS = [
  { id: 'fisico', icono: Package, titulo: 'Físico', texto: 'Suplementos, belleza, ropa, joyería…' },
  { id: 'digital', icono: MonitorSmartphone, titulo: 'Digital', texto: 'Ebooks, plantillas, cursos…' },
  { id: 'servicio', icono: Briefcase, titulo: 'Servicio', texto: 'Clínicas, asesorías, clases…' },
];

const AYUDAS_FOTOS = {
  fisico: 'El frente del envase con la etiqueta legible. Sin precios, botones ni marcas de agua.',
  digital: 'La portada o una captura. Si no tienes, la IA arma el mockup (tablet, laptop).',
  servicio: 'No hace falta foto: tu logo, tu local o un resultado, si los tienes.',
};

const EMPUJONES = ['Mi público es…', 'Lo que le duele es…', 'Vendo en…', 'Quiero que se vea…'];
const MAX_FOTOS = 6;
/** Lo que se guarda como respuesta cuando el usuario no tiene el dato. */
const SIN_DATO = 'No lo tengo: no lo menciones en el anuncio.';

/** El formulario vacío (también lo usa index.jsx). */
export const BORRADOR_VACIO = { tipo: 'fisico', nombre: '', link: '', fotos: [], cuentame: '', referencia: null, tieneGuion: false, guion: '' };

/** Lo que define un producto: si cambia, "Volver a analizar" crea otro. */
export function firmaDe(b) {
  return JSON.stringify([b.tipo, b.nombre.trim(), b.link.trim(), b.cuentame.trim(), b.tieneGuion ? b.guion.trim() : '', b.fotos.map((f) => f.id)]);
}

// ---------------------------------------------------------------- una foto chica (local o del servidor)

function FotoMini({ foto, ancho }) {
  const [fallo, setFallo] = useState(false);
  if (foto.heic && !foto.subidaEn) {
    return (
      <span className="nv-foto__heic" aria-hidden="true">
        HEIC
        <small>se convierte sola</small>
      </span>
    );
  }
  if (!foto.url || fallo) {
    return (
      <span className="nv-foto__heic nv-foto__heic--sin" aria-hidden="true">
        <ImageOff size={ancho > 100 ? 20 : 16} strokeWidth={1.8} />
      </span>
    );
  }
  return <img src={foto.url} alt={foto.nombre || ''} draggable="false" onError={() => setFallo(true)} />;
}

// ---------------------------------------------------------------- fotos (arrastrar y soltar)

function ZonaFotos({ tipo, fotos, onCambiar, bloqueada }) {
  const [encima, setEncima] = useState(false);
  const entrada = useRef(null);
  const { aviso } = useAvisos();

  // (las vistas previas locales NO se liberan al salir de esta zona: el borrador las sigue mostrando en el paso 2 y
  // al volver. Se liberan al quitar la foto, y al subirla la reemplaza la del servidor)

  const agregar = (lista) => {
    const archivos = [...lista].filter((f) => /^image\//.test(f.type) || /\.(heic|heif|webp|jpe?g|png)$/i.test(f.name));
    if (!archivos.length) {
      aviso({ tipo: 'aviso', titulo: 'Eso no parece una foto', texto: 'Acepto JPG, PNG, WEBP y HEIC.' });
      return;
    }
    const lugar = MAX_FOTOS - fotos.length;
    if (lugar <= 0) {
      aviso({ tipo: 'aviso', titulo: 'Ya tienes 6 fotos', texto: 'Quita una para agregar otra.' });
      return;
    }
    const nuevas = archivos.slice(0, lugar).map((f) => {
      const heic = /\.(heic|heif)$/i.test(f.name) || /heic|heif/i.test(f.type);
      const url = heic ? null : URL.createObjectURL(f);
      return { id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 6)}`, nombre: f.name, url, heic, archivo: f, subidaEn: null };
    });
    if (archivos.length > lugar) aviso({ tipo: 'info', titulo: `Agregué ${lugar} de ${archivos.length}`, texto: 'El máximo son 6 fotos.' });
    onCambiar([...fotos, ...nuevas]);
  };

  const quitar = (id) => {
    const f = fotos.find((x) => x.id === id);
    if (f?.url?.startsWith('blob:')) URL.revokeObjectURL(f.url);
    onCambiar(fotos.filter((x) => x.id !== id));
  };

  return (
    <div className="nv-fotos">
      <button
        type="button"
        className={`nv-soltar${encima ? ' nv-soltar--encima' : ''}${fotos.length ? ' nv-soltar--chica' : ''}`}
        disabled={bloqueada}
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          if (!bloqueada) agregar(e.dataTransfer.files);
        }}
      >
        <span className="nv-soltar__icono" aria-hidden="true">
          <ImagePlus size={22} strokeWidth={1.8} />
        </span>
        <span className="nv-soltar__textos">
          <span className="nv-soltar__titulo">{fotos.length ? 'Agregar más fotos' : 'Arrastra tus fotos aquí'}</span>
          <span className="nv-soltar__ayuda">o haz clic para elegirlas · hasta 6 · JPG, PNG, WEBP o HEIC</span>
        </span>
      </button>
      <input
        ref={entrada}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          agregar(e.target.files || []);
          e.target.value = '';
        }}
      />
      {fotos.length ? (
        <ul className="nv-fotos__lista" aria-label="Tus fotos">
          {fotos.map((f, i) => (
            <li key={f.id} className="nv-foto">
              <FotoMini foto={f} ancho={120} />
              {i === 0 ? <span className="nv-foto__principal">Principal</span> : null}
              {bloqueada ? null : (
                <button type="button" className="nv-foto__quitar" onClick={() => quitar(f.id)} aria-label={`Quitar ${f.nombre}`}>
                  <X size={13} strokeWidth={2.6} />
                </button>
              )}
            </li>
          ))}
          {fotos.length < MAX_FOTOS && !bloqueada ? (
            <li className="nv-foto nv-foto--agregar">
              <button type="button" onClick={() => entrada.current?.click()} aria-label="Agregar otra foto">
                <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
                <span>Agregar</span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      <p className="nv-campo-ayuda">{AYUDAS_FOTOS[tipo]}</p>
    </div>
  );
}

// ---------------------------------------------------------------- el formulario (izquierda)

function Grupo({ n, titulo, opcional, children, derecha }) {
  return (
    <div className="nv-grupo">
      <div className="nv-grupo__cabecera">
        <span className="nv-grupo__n t-num" aria-hidden="true">
          {n}
        </span>
        <h3 className="nv-grupo__titulo">
          {titulo}
          {opcional ? <span className="nv-grupo__opcional">opcional</span> : null}
        </h3>
        {derecha ? <div className="nv-grupo__derecha">{derecha}</div> : null}
      </div>
      <div className="nv-grupo__cuerpo">{children}</div>
    </div>
  );
}

function Formulario({ borrador, setBorrador, ocupado, fichaLista, cambioDesdeLaFicha, hayProducto, onAnalizar, onOtro }) {
  const p = borrador;
  const poner = (cambios) => setBorrador((x) => ({ ...x, ...cambios }));
  const puede = Boolean(p.fotos.length || p.cuentame.trim());
  const cuentameRef = useRef(null);

  const empujar = (texto) => {
    const base = p.cuentame.trim();
    poner({ cuentame: `${base}${base ? ' ' : ''}${texto} ` });
    requestAnimationFrame(() => {
      const el = cuentameRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  };

  return (
    <Tarjeta variante="elevada" relleno="ninguno" className="nv-form">
      <div className="nv-form__cabecera">
        <div>
          <h2 className="nv-form__titulo">Tu producto</h2>
          <p className="nv-form__subtitulo">Solo lo necesario: lo demás lo resuelve la IA.</p>
        </div>
        {hayProducto ? (
          <Boton variante="fantasma" tamano="chico" icono={SquarePen} onClick={onOtro} disabled={ocupado}>
            Otro producto
          </Boton>
        ) : null}
      </div>

      <Grupo n={1} titulo="La foto de tu producto">
        <ZonaFotos tipo="fisico" fotos={p.fotos} onCambiar={(fotos) => poner({ fotos })} bloqueada={ocupado} />
      </Grupo>

      <Grupo n={2} titulo="Indicaciones a tener en cuenta" opcional>
        <AreaTexto
          ref={cuentameRef}
          filas={4}
          placeholder="Lo que la IA debe saber o respetar: el nombre, para quién es, qué no decir, el tono, el país…"
          value={p.cuentame}
          onChange={(e) => poner({ cuentame: e.target.value })}
          disabled={ocupado}
          aria-label="Indicaciones a tener en cuenta"
        />
      </Grupo>

      <Grupo n={3} titulo="Video de referencia" opcional>
        <SubirVideo valor={p.referencia || null} onCambio={(referencia) => poner({ referencia })} deshabilitado={ocupado} />
        <p className="nv-form__nota">Se copia cómo está armado: no sus caras, su marca ni su música.</p>
      </Grupo>

      <Grupo n={4} titulo="¿Quién escribe el guion?">
        <div className="nv-segmentos" role="radiogroup" aria-label="¿Quién escribe el guion?">
          {[
            { v: false, t: 'La IA', i: Sparkles },
            { v: true, t: 'Lo escribo yo', i: FileText },
          ].map((o) => {
            const Icono = o.i;
            return (
              <button key={String(o.v)} type="button" role="radio" aria-checked={p.tieneGuion === o.v} className="nv-segmento" onClick={() => poner({ tieneGuion: o.v })} disabled={ocupado}>
                <Icono size={15} strokeWidth={2} aria-hidden="true" />
                {o.t}
              </button>
            );
          })}
        </div>
        {p.tieneGuion ? (
          <AreaTexto
            filas={5}
            className="nv-aparece"
            placeholder="Escribe o pega tu guion. La IA respeta tus palabras y lo convierte en tomas."
            value={p.guion}
            onChange={(e) => poner({ guion: e.target.value })}
            disabled={ocupado}
            ayuda="Si es un guion ganador de otro formato, se adapta al estilo sin cambiarle el mensaje."
            aria-label="Tu guion"
          />
        ) : null}
      </Grupo>

      <div className="nv-form__pie">
        <Boton variante="primario" tamano="grande" iconoDerecha={ArrowRight} cargando={ocupado} disabled={!puede && !ocupado} onClick={onAnalizar}>
          {ocupado ? 'Guardando…' : 'Continuar'}
        </Boton>
        <p className="nv-form__nota">{puede ? 'Después eliges el estilo.' : 'Sube la foto de tu producto para seguir.'}</p>
      </div>
    </Tarjeta>
  );
}

// ---------------------------------------------------------------- la ficha (derecha)

function FichaAntes({ activa, fase, progreso, inicio }) {
  return (
    <div className={`nv-ficha-antes${activa ? ' nv-ficha-antes--activa' : ''}`}>
      <div className="nv-ficha-antes__fantasma" aria-hidden="true">
        <div className="nv-fantasma__cabeza">
          <span className="nv-fantasma__foto" />
          <span className="nv-fantasma__lineas">
            <span style={{ width: '58%' }} />
            <span style={{ width: '38%' }} />
          </span>
        </div>
        {[72, 88, 54, 80, 64, 46].map((w, i) => (
          <span key={i} className={`nv-fantasma__fila nv-fantasma__fila--${i % 3}`}>
            <span style={{ width: '22%' }} />
            <span style={{ width: `${w}%` }} />
          </span>
        ))}
      </div>
      <div className="nv-ficha-antes__texto">
        {activa ? (
          <Progreso
            icono={ScanSearch}
            titulo={fase ? 'Preparando tu producto' : 'Claude está armando tu ficha'}
            frases={fase ? [fase] : progreso}
            inicio={fase ? undefined : inicio}
            suele="suele tardar uno o dos minutos"
            maximo={4}
          />
        ) : (
          <>
            <span className="nv-ficha-antes__icono" aria-hidden="true">
              <ScanSearch size={22} strokeWidth={1.8} />
            </span>
            <h3 className="nv-ficha-antes__titulo">Tu ficha aparece aquí</h3>
            <p className="nv-ficha-antes__descripcion">Claude junta todo lo de tu producto en una ficha que puedes corregir:</p>
            <ul className="nv-leyenda nv-leyenda--columna">
              <li>
                <span className="nv-leyenda__muestra nv-leyenda__muestra--pagina" /> Lo que sacó de tu página, tus fotos y lo que contaste
              </li>
              <li>
                <span className="nv-leyenda__muestra nv-leyenda__muestra--dedujo" /> En amarillo, lo que dedujo
              </li>
              <li>
                <span className="nv-leyenda__muestra nv-leyenda__muestra--falta" /> En rojo, lo que falta (te lo pregunta)
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** El valor de una fila, con el lápiz para corregirlo. */
function ValorCampo({ fila, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const { valor, origen } = fila;

  if (editando) {
    return (
      <form
        className="nv-campo-editar"
        onSubmit={(e) => {
          e.preventDefault();
          const t = texto.trim();
          if (t) onGuardar(fila.lista ? t.split(/\s*[,;\n]\s*/).filter(Boolean) : t);
          setEditando(false);
        }}
      >
        <input
          className="nv-campo-editar__entrada"
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setEditando(false)}
          placeholder={fila.lista ? 'Sepáralos con comas' : undefined}
          aria-label={fila.etiqueta}
        />
        <Boton type="submit" variante="secundario" tamano="chico" icono={Check} soloIcono etiqueta="Guardar" />
      </form>
    );
  }

  return (
    <div className="nv-campo-valor">
      {origen === 'falta' ? (
        <span className="nv-campo-valor__falta">
          <CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" /> Te lo pregunto abajo
        </span>
      ) : origen === 'completar' ? (
        <span className="nv-campo-valor__texto">
          {String(valor)}{' '}
          <span className="nv-campo-valor__falta">
            <CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" /> Te pregunto lo que le falta abajo
          </span>
        </span>
      ) : origen === 'vacio' ? (
        <span className="nv-campo-valor__vacio">Sin dato: no entra en el guion</span>
      ) : Array.isArray(valor) ? (
        <span className="nv-campo-valor__chips">
          {valor.map((v) => (
            <span key={v} className={`nv-beneficio${origen === 'dedujo' ? ' nv-beneficio--dedujo' : ''}`}>
              {origen === 'dedujo' ? <Sparkles size={11} strokeWidth={2.4} aria-hidden="true" /> : null}
              {v}
            </span>
          ))}
        </span>
      ) : (
        <span className="nv-campo-valor__texto">{String(valor)}</span>
      )}
      <button
        type="button"
        className="nv-campo-valor__editar"
        aria-label={`Corregir ${fila.etiqueta}`}
        onClick={() => {
          setTexto(Array.isArray(valor) ? valor.join(', ') : origen === 'falta' || origen === 'vacio' ? '' : String(valor ?? ''));
          setEditando(true);
        }}
      >
        <PencilLine size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

function Ficha({ ficha, producto, fotos, cambios, onGuardar }) {
  const { correcciones, respuestas } = cambios;
  const filas = filasDeFicha(ficha, correcciones, respuestas);
  const nombre = correcciones.nombre || respuestas.nombre || ficha.nombre || producto?.nombre || 'Tu producto';
  const principal = fotos[0];
  const tipo = ficha.tipo || producto?.tipo;
  const faltan = faltanDe(ficha).filter((f) => !respuestas[f.campo] && !correcciones[f.campo]).length;

  const corregir = (campo, valor) => onGuardar({ correcciones: { ...correcciones, [campo]: valor } });

  return (
    <Tarjeta variante="elevada" relleno="ninguno" className="nv-ficha nv-aparece">
      <div className="nv-ficha__cabecera">
        <div className={`nv-ficha__foto${principal ? '' : ' nv-ficha__foto--sin'}`}>
          {principal ? <FotoMini foto={principal} ancho={160} /> : <Package size={26} strokeWidth={1.7} aria-hidden="true" />}
        </div>
        <div className="nv-ficha__titulos">
          <span className="t-etiqueta">Ficha del producto</span>
          <h2 className="nv-ficha__nombre">{nombre}</h2>
          {ficha.queEs ? <p className="nv-ficha__sub">{correcciones.queEs || ficha.queEs}</p> : null}
          <div className="fila fila--envolver" style={{ '--hueco': '6px' }}>
            {tipo ? (
              <Chip tamano="chico" icono={Package}>
                {TIPOS_PRODUCTO[tipo] || tipo}
              </Chip>
            ) : null}
          </div>
        </div>
      </div>

      <ul className="nv-leyenda" aria-label="Qué significa cada color">
        <li>
          <span className="nv-leyenda__muestra nv-leyenda__muestra--pagina" /> De tu página, tus fotos o lo que contaste
        </li>
        <li>
          <span className="nv-leyenda__muestra nv-leyenda__muestra--dedujo" /> Lo dedujo la IA
        </li>
        <li>
          <span className="nv-leyenda__muestra nv-leyenda__muestra--falta" /> Falta
        </li>
      </ul>

      <dl className="nv-campos">
        {filas.map((c) => {
          const clase = c.origen === 'corregido' ? 'respondido' : c.origen === 'vacio' ? 'vacio' : c.origen === 'completar' ? 'falta' : c.origen;
          return (
            <div key={c.id} className={`nv-campo nv-campo--${clase}`}>
              <dt className="nv-campo__etiqueta">
                {c.etiqueta}
                {c.origen === 'dedujo' ? (
                  <span className="nv-campo__marca nv-campo__marca--dedujo">
                    <Sparkles size={11} strokeWidth={2.4} aria-hidden="true" /> La IA lo dedujo
                  </span>
                ) : c.origen === 'falta' || c.origen === 'completar' ? (
                  <span className="nv-campo__marca nv-campo__marca--falta">{c.origen === 'completar' ? 'Falta un dato' : 'Falta'}</span>
                ) : c.origen === 'respondido' ? (
                  <span className="nv-campo__marca nv-campo__marca--ok">
                    <Check size={11} strokeWidth={3} aria-hidden="true" /> Lo contestaste
                  </span>
                ) : c.origen === 'corregido' ? (
                  <span className="nv-campo__marca nv-campo__marca--ok">
                    <Check size={11} strokeWidth={3} aria-hidden="true" /> Lo corregiste
                  </span>
                ) : null}
              </dt>
              <dd className="nv-campo__dd">
                <ValorCampo fila={c} onGuardar={(v) => corregir(c.id, v)} />
              </dd>
            </div>
          );
        })}
      </dl>

      {fotos.length ? (
        <div className="nv-ficha__fotos">
          <span className="t-etiqueta">Tus fotos</span>
          <ul className="nv-revisadas">
            {fotos.map((x, i) => (
              <li key={x.id} className="nv-revisada">
                <span className="nv-revisada__foto">
                  <FotoMini foto={x} ancho={60} />
                </span>
                <span className="nv-revisada__texto">{i === 0 ? 'La principal: la que va en las tomas del producto' : 'De apoyo'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {faltan ? null : (
        <p className="nv-ficha__completa nv-aparece">
          <Check size={15} strokeWidth={2.6} aria-hidden="true" /> La ficha está completa.
        </p>
      )}
    </Tarjeta>
  );
}

function Preguntas({ ficha, cambios, onGuardar, onSeguir }) {
  const { correcciones, respuestas } = cambios;
  const preguntas = faltanDe(ficha);
  const [borrador, setBorrador] = useState({});
  const respondida = (campo) => respuestas[campo] || correcciones[campo];
  const contestadas = preguntas.filter((p) => respondida(p.campo)).length;
  const faltan = preguntas.length - contestadas;

  const responder = (campo, valor) => onGuardar({ respuestas: { ...respuestas, [campo]: valor } });

  if (!preguntas.length) {
    return (
      <Tarjeta variante="destacada" relleno="ninguno" className="nv-preguntas nv-aparece">
        <div className="nv-preguntas__pie">
          <Boton variante="primario" tamano="grande" bloque iconoDerecha={ArrowRight} onClick={onSeguir}>
            Seguir con tu anuncio
          </Boton>
          <p className="nv-preguntas__nota">Claude tiene todo lo que necesita. Puedes corregir cualquier dato con el lápiz.</p>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta variante="destacada" relleno="ninguno" className="nv-preguntas nv-aparece">
      <div className="nv-preguntas__cabecera">
        <span className="nv-preguntas__icono" aria-hidden="true">
          <MessageCircleQuestion size={18} strokeWidth={2} />
        </span>
        <div>
          <h3 className="nv-preguntas__titulo">{!faltan ? 'Listo, ya tengo todo' : faltan === 1 ? 'Me falta 1 cosa' : `Me faltan ${faltan} cosas`}</h3>
          <p className="nv-preguntas__sub">{!faltan ? 'Con esto escribo tus guiones. Puedes cambiar cualquier respuesta.' : 'Contesta lo que sepas. Lo que dejes vacío no entra en el guion.'}</p>
        </div>
        <span className="nv-preguntas__contador t-num">
          {contestadas}/{preguntas.length}
        </span>
      </div>
      <ol className="nv-preguntas__lista">
        {preguntas.map((p, i) => {
          const r = respondida(p.campo);
          return (
            <li key={p.campo} className={`nv-pregunta${r ? ' nv-pregunta--lista' : ''}`}>
              <div className="nv-pregunta__cabecera">
                <span className="nv-pregunta__n t-num" aria-hidden="true">
                  {r ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <div className="nv-pregunta__textos">
                  <span className="nv-pregunta__texto">{p.pregunta}</span>
                  {r ? <span className="nv-pregunta__respuesta">{Array.isArray(r) ? r.join(', ') : r}</span> : null}
                </div>
                {r && respuestas[p.campo] ? (
                  <Boton variante="fantasma" tamano="chico" onClick={() => responder(p.campo, '')}>
                    Cambiar
                  </Boton>
                ) : null}
              </div>
              {!r ? (
                <div className="nv-pregunta__cuerpo">
                  <form
                    className="nv-pregunta__form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = (borrador[p.campo] || '').trim();
                      if (v) responder(p.campo, v);
                    }}
                  >
                    <input
                      className="nv-pregunta__entrada"
                      placeholder="Escribe tu respuesta"
                      value={borrador[p.campo] || ''}
                      onChange={(e) => setBorrador((b) => ({ ...b, [p.campo]: e.target.value }))}
                      aria-label={p.pregunta}
                    />
                    <Boton type="submit" variante="secundario" tamano="chico" disabled={!(borrador[p.campo] || '').trim()}>
                      Listo
                    </Boton>
                  </form>
                  <div className="fila fila--envolver" style={{ '--hueco': '6px' }}>
                    <Chip tamano="chico" onClick={() => responder(p.campo, SIN_DATO)}>
                      No lo tengo, sigue sin esto
                    </Chip>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="nv-preguntas__pie">
        <Boton variante="primario" tamano="grande" bloque iconoDerecha={ArrowRight} onClick={onSeguir}>
          Seguir con tu anuncio
        </Boton>
        <p className="nv-preguntas__nota">{!faltan ? 'Todo listo.' : 'Puedes seguir aunque falte algo: no se inventa nada.'}</p>
      </div>
    </Tarjeta>
  );
}

// ---------------------------------------------------------------- si vienes de Estilos con uno elegido

function EstiloElegido({ clave, pronto, continuidad = false }) {
  const { datos } = useEstilos();
  const e = datos?.estilos?.find((x) => x.clave === clave);
  return (
    <p className="nv-elegido nv-aparece">
      {pronto ? <Hourglass size={18} strokeWidth={2} aria-hidden="true" className="nv-elegido__pronto" /> : <SelloEstilo clave={clave} familia={e?.familia} tamano="chico" />}
      <span>
        {pronto ? (
          <>
            No encuentro ese estilo. En el paso 2 eliges el que quieras de la galería.
          </>
        ) : (
          <>
            Elegiste <strong>{e?.nombre || 'un estilo'}</strong>
            {continuidad ? ' con continuidad' : ''}: lo vas a ver marcado en el paso 2.
          </>
        )}
      </span>
    </p>
  );
}

// ---------------------------------------------------------------- el paso completo

/**
 * borrador        el formulario (fotos con su File local o su url del servidor)
 * productoId      el producto creado (o null)
 * leido           leerProducto() de GET /api/productos/:id
 * analizando      la sesión "ficha" está corriendo (o recién lanzada)
 */
export function PasoProducto({
  borrador,
  setBorrador,
  productoId,
  firmaCreada,
  leido,
  analizando,
  cambios,
  onGuardarFicha,
  onCreado,
  onAnalizado,
  onOtroProducto,
  estiloElegido,
  estiloPronto,
  estiloConContinuidad,
  claude,
  onSeguir,
}) {
  const { aviso } = useAvisos();
  const [fase, setFase] = useState(null); // texto de lo que hace la app antes de Claude (guardar, subir fotos)
  const tarea = leido.tarea;
  const ficha = leido.ficha;
  const fichaLista = Boolean(ficha) && !analizando;
  const ocupado = Boolean(fase) || analizando;
  const cambioDesdeLaFicha = Boolean(productoId && firmaCreada && firmaDe(borrador) !== firmaCreada);

  const lanzar = async (id) => {
    setFase('Preparando');
    await apiNuevo.analizarProducto(id);
    onAnalizado(id);
  };

  const analizar = async () => {
    if (claude.estado && !claude.listo) {
      aviso({ tipo: 'aviso', titulo: 'Falta tu sesión de Claude', texto: 'Inicia sesión con tu cuenta de Claude para que pueda escribir tus guiones.' });
      return;
    }
    // ya creado con lo mismo: se sigue directo (la ficha se arma sola, sin preguntar nada)
    if (productoId && firmaDe(borrador) === firmaCreada && !borrador.fotos.some((f) => f.subidaEn !== productoId)) {
      if ((borrador.referencia || null) !== (leido.producto?.referencia || null)) await apiNuevo.actualizarProducto(productoId, { referencia: borrador.referencia || '' }).catch(() => {});
      if (tarea.estado === 'error') await lanzar(productoId).catch(() => {});
      setFase(null);
      onSeguir();
      return;
    }
    try {
      let id = productoId;
      const firma = firmaDe(borrador);
      let fotos = borrador.fotos;
      if (!id || firma !== firmaCreada) {
        setFase('Guardando tu producto');
        const r = await apiNuevo.crearProducto({
          nombre: borrador.nombre.trim() || undefined,
          tipo: borrador.tipo,
          url: borrador.link.trim() || undefined,
          descripcion: borrador.cuentame.trim() || undefined,
          guionPropio: borrador.tieneGuion && borrador.guion.trim() ? borrador.guion.trim() : undefined,
          referencia: borrador.referencia || undefined,
        });
        if (!r?.id) throw new Error('La app no devolvió tu producto. Vuelve a intentarlo.');
        id = r.id;
        fotos = fotos.map((f) => ({ ...f, subidaEn: null }));
        onCreado(id, firma);
      }
      // las fotos van de a una, en el orden de la lista (la 1 es la principal)
      for (let i = 0; i < fotos.length; i++) {
        const f = fotos[i];
        if (f.subidaEn === id) continue;
        setFase(fotos.length === 1 ? 'Subiendo tu foto' : `Subiendo tus fotos (${i + 1} de ${fotos.length})`);
        let archivo = f.archivo;
        if (!archivo && f.url) archivo = await fetch(f.url).then((x) => (x.ok ? x.blob() : null), () => null);
        if (!archivo) {
          aviso({ tipo: 'aviso', titulo: `No pude subir «${f.nombre || `la foto ${i + 1}`}»`, texto: 'Sigo con las demás. Si es importante, quítala y vuelve a agregarla.' });
          continue;
        }
        await apiNuevo.subirFoto(id, i + 1, archivo);
        // desde ahora se ve la del servidor (la vista previa local se libera): sigue bien en el paso 2 y al volver
        const n = i + 1;
        setBorrador((b) => ({
          ...b,
          fotos: b.fotos.map((x) => {
            if (x.id !== f.id) return x;
            if (x.url?.startsWith('blob:')) URL.revokeObjectURL(x.url);
            return { ...x, subidaEn: id, url: urlFotoProducto(id, n), heic: false };
          }),
        }));
      }
      await lanzar(id);
      onSeguir();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude guardar tu producto', texto: e.message, duracion: 9000 });
    } finally {
      setFase(null);
    }
  };

  const derecha =
    claude.estado && !claude.listo ? (
      <Tarjeta variante="elevada" relleno="amplio" className="nv-aparece">
        <AvisoClaude claude={claude} para="escribir tus guiones" />
      </Tarjeta>
    ) : null;

  return (
    <div className={`nv-paso1${derecha ? '' : ' nv-paso1--solo'}`}>
      <div className="nv-paso1__izq">
        {estiloElegido ? <EstiloElegido clave={estiloElegido} pronto={estiloPronto} continuidad={estiloConContinuidad} /> : null}
        <Formulario
          borrador={borrador}
          setBorrador={setBorrador}
          ocupado={ocupado}
          fichaLista={false}
          cambioDesdeLaFicha={cambioDesdeLaFicha}
          hayProducto={Boolean(productoId)}
          onAnalizar={analizar}
          onOtro={onOtroProducto}
        />
      </div>
      {derecha ? <div className="nv-paso1__der nv-paso1__der--fija">{derecha}</div> : null}
    </div>
  );
}
