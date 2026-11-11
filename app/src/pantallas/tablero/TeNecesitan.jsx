// "Te necesitan": cada tarjeta es un anuncio de la app que está frenado y lo que hace falta para seguir.
// Sale de los conductor.json reales (p.necesitan de useEnProduccion, src/datos/produccion.js):
//   error  un paso falló: su mensaje en palabras simples y "Continuar" (lo reintenta; lo hecho no se paga)
//   saldo  "Tu saldo de kie no alcanza: recarga para seguir", sin números, y "Continuar"
//   pausa  en pausa: "Continuar"
//   cancion los cantados: la canción está lista y espera que elijas la versión ("Escuchar y elegir", en la producción)
// Solo frenan a su anuncio: los demás siguen solos. Sin nada frenado, un estado vacío tranquilo.
// Arriba van los guiones que esperan (p.guiones): "Tu guion está listo" para aprobarlo, o el guion que no salió,
// los dos con su botón a la pantalla del guion (ahí se aprueba, se piden cambios o se reintenta).
import { useState } from 'react';
import { ArrowRight, CirclePause, EighthNotes, FileText, Hand, RotateCcw, Settings, TriangleAlert, Wallet } from 'lucide-react';
import { Boton, Insignia, Seccion, useAvisos } from '../../componentes/index.js';
import { apiNuevo, invalidar, miniatura } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { enMinuscula, fechaRelativa } from '../../datos/formato.js';
import { TEXTO_ALTO, continuarProduccion, textoDePaso } from '../../datos/produccion.js';
import { BotonDescartar } from '../nuevo/Descartar.jsx';
import { MOTORES, mayuscula, useMotor } from '../ajustes/datos.js';

const ICONOS = { error: TriangleAlert, saldo: Wallet, pausa: CirclePause, cancion: EighthNotes };
const conPunto = (s) => (/[.!?…]$/.test(String(s).trim()) ? String(s).trim() : `${String(s).trim()}.`);

/** Lo que dice la tarjeta según por qué está frenado. */
function textos({ alto }) {
  const t = TEXTO_ALTO[alto.tipo] || TEXTO_ALTO.error;
  if (alto.tipo === 'saldo' || alto.tipo === 'cancion') return { titulo: t.titulo, texto: t.texto };
  const que = alto.paso ? enMinuscula(textoDePaso(alto.paso).haciendo) : null;
  if (alto.tipo === 'pausa') return { titulo: t.titulo, texto: `${que ? `Quedó en: ${que}. ` : ''}${t.texto}` };
  const causa = alto.paso?.error?.causa;
  if (causa) return { titulo: que ? `Se trabó: ${que}` : t.titulo, texto: `${causa.porque}${causa.dijo ? ` (kie.ai: «${causa.dijo}»)` : ''} ${causa.hacer?.join(' ') || t.texto}` };
  return { titulo: que ? `Se trabó: ${que}` : t.titulo, texto: `${alto.mensaje ? `${conPunto(alto.mensaje)} ` : ''}${t.texto}` };
}

function Frenado({ n, alSeguir }) {
  const { anuncio: a, conductor: c, alto } = n;
  const { aviso } = useAvisos();
  const [siguiendo, setSiguiendo] = useState(false);
  const Icono = ICONOS[alto.tipo] || Hand;
  const { titulo, texto } = textos(n);
  const cuando = c?.actualizado || alto.paso?.fin || null;

  const seguir = async () => {
    setSiguiendo(true);
    try {
      await continuarProduccion(a.slug);
      aviso({ tipo: 'info', titulo: 'Sigue desde donde quedó', texto: `${a.titulo}: lo que ya estaba hecho no se vuelve a pagar.` });
      invalidar('anuncios');
      alSeguir?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude continuar', texto: e.message });
    } finally {
      setSiguiendo(false);
    }
  };

  return (
    <article className={`tb-decision tb-decision--${alto.tipo}`}>
      <a className="tb-decision__foto" href={enlace.produccion(a.slug)} tabIndex={-1} aria-hidden="true">
        {a.miniatura ? <img src={miniatura(a.miniatura, 240)} alt="" loading="lazy" decoding="async" draggable="false" /> : null}
        <span className="tb-decision__icono">
          <Icono size={15} strokeWidth={2.2} />
        </span>
      </a>
      <div className="tb-decision__cuerpo">
        <div className="tb-decision__arriba">
          {alto.tipo === 'error' ? <Insignia estado="error" tamano="chico" /> : <Insignia estado="te-necesita" tamano="chico" />}
          {cuando ? <span className="tb-decision__espera t-num">{fechaRelativa(cuando)}</span> : null}
        </div>
        <p className="tb-decision__anuncio t-recortar" title={a.titulo}>
          {a.titulo}
          {a.estiloNombre ? <span> · {a.estiloNombre}</span> : null}
        </p>
        <h3 className="tb-decision__titulo">{titulo}</h3>
        <p className="tb-decision__texto">{texto}</p>
        <div className="tb-decision__pie">
          {alto.tipo === 'cancion' ? (
            <Boton variante="primario" tamano="chico" iconoDerecha={ArrowRight} href={enlace.produccion(a.slug)}>
              Escuchar y elegir
            </Boton>
          ) : (
            <>
              <Boton variante="fantasma" tamano="chico" iconoDerecha={ArrowRight} href={enlace.produccion(a.slug)}>
                Ver producción
              </Boton>
              <Boton variante="primario" tamano="chico" icono={RotateCcw} onClick={seguir} cargando={siguiendo}>
                Continuar
              </Boton>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// "Se acabó… Toca "Reintentar" cuando…" -> solo lo que pasó: qué hacer lo dicen los botones de la tarjeta
const loQuePaso = (m) =>
  String(m || '')
    .split(/(?<=[.!?])\s+/)
    .filter((f) => f.trim() && !/^(toca|ábrelo|abrelo)\b/i.test(f.trim()))
    .join(' ')
    .trim();
const horaDe = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null;
};

/**
 * Lo que dice la tarjeta de un guion que no salió, según el tipo de falla. `ia`: el nombre de la IA que lo intentó (la
 * del anuncio, si el servidor la manda; si no, la elegida).
 */
function textoDeFalla(a, ia) {
  if (a.errorTipo === 'limite') {
    const h = horaDe(a.reinicio);
    return `Se acabó por ahora el uso de tu plan de ${ia}${h ? `: se renueva a las ${h}` : ''}. Después toca «Reintentar»: lo ya hecho no se repite.`;
  }
  const paso = loQuePaso(a.error) || `${ia} no terminó el guion.`;
  if (a.errorTipo === 'bloqueo') return `${conPunto(paso)} Ábrelo y contesta lo que falta.`;
  if (['sin-sesion', 'sin-claude', 'sin-motor'].includes(a.errorTipo)) return `${conPunto(paso)} Arréglalo en Ajustes y después reintenta.`;
  return conPunto(paso);
}

/** Un guion que espera: listo para aprobar, o que no salió (con "Reintentar" ahí mismo). */
function GuionEspera({ a, alSeguir }) {
  const listo = a.estado !== 'error';
  const { aviso } = useAvisos();
  const motor = useMotor();
  const elegida = mayuscula(motor.nombre);
  const ia = MOTORES[a.motor]?.nombre || elegida;
  const [reintentando, setReintentando] = useState(false);
  const href = enlace.nuevo({ paso: '2', anuncios: a.slug, ...(a.productoId ? { producto: a.productoId } : {}) });
  const aAjustes = ['sin-sesion', 'sin-claude', 'sin-motor'].includes(a.errorTipo);
  const puedeReintentar = !listo && !aAjustes && a.errorTipo !== 'bloqueo';
  const reintentar = async () => {
    setReintentando(true);
    try {
      await apiNuevo.reintentarGuion(a.slug);
      invalidar('anuncios');
      aviso({ tipo: 'info', titulo: `${elegida} vuelve a escribir el guion`, texto: `${a.titulo}: sigue desde donde quedó.` });
      alSeguir?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude reintentar', texto: e.message });
    } finally {
      setReintentando(false);
    }
  };
  return (
    <article className={`tb-decision tb-decision--${listo ? 'guion' : 'error'}`}>
      <a className="tb-decision__foto" href={href} tabIndex={-1} aria-hidden="true">
        {a.miniatura ? <img src={miniatura(a.miniatura, 240)} alt="" loading="lazy" decoding="async" draggable="false" /> : null}
        <span className="tb-decision__icono">{listo ? <FileText size={15} strokeWidth={2.2} /> : <TriangleAlert size={15} strokeWidth={2.2} />}</span>
      </a>
      <div className="tb-decision__cuerpo">
        <div className="tb-decision__arriba">
          {listo ? <Insignia estado="te-necesita" tamano="chico" texto="Para aprobar" /> : <Insignia estado="error" tamano="chico" />}
          {a.fecha ? <span className="tb-decision__espera t-num">{fechaRelativa(a.fecha)}</span> : null}
        </div>
        <p className="tb-decision__anuncio t-recortar" title={a.titulo}>
          {a.titulo}
          {a.estiloNombre ? <span> · {a.estiloNombre}</span> : null}
        </p>
        <h3 className="tb-decision__titulo">{listo ? 'Tu guion está listo' : 'El guion no salió'}</h3>
        <p className="tb-decision__texto">{listo ? 'Léelo y apruébalo, o pide cambios con tus palabras. Después todo sigue solo hasta los videos.' : textoDeFalla(a, ia)}</p>
        <div className="tb-decision__pie">
          <BotonDescartar slug={a.slug} titulo={a.titulo} alDescartar={alSeguir} soloIcono texto="Descartar este anuncio" />
          {listo ? (
            <Boton variante="primario" tamano="chico" iconoDerecha={ArrowRight} href={href}>
              Ver el guion
            </Boton>
          ) : (
            <span className="tb-decision__acciones">
              <Boton variante={puedeReintentar || aAjustes ? 'fantasma' : 'primario'} tamano="chico" iconoDerecha={ArrowRight} href={href}>
                Abrir el guion
              </Boton>
              {puedeReintentar ? (
                <Boton variante="primario" tamano="chico" icono={RotateCcw} onClick={reintentar} cargando={reintentando}>
                  Reintentar
                </Boton>
              ) : null}
              {aAjustes ? (
                <Boton variante="primario" tamano="chico" icono={Settings} href={enlace.ajustes()}>
                  Ir a Ajustes
                </Boton>
              ) : null}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** p = useEnProduccion() (src/datos/produccion.js). */
export function TeNecesitan({ p, alSeguir }) {
  const lista = p.necesitan;
  const guiones = p.guiones || [];
  const total = lista.length + guiones.length;
  // Solo aparece cuando de verdad algo te necesita (Diego, 2026-10-25): sin nada, la sección no se muestra.
  if (!total) return null;
  return (
    <Seccion
      titulo="Te necesitan"
      contador={total}
      icono={Hand}
      tono="error"
      descripcion="Solo frenan a su anuncio: los demás siguen solos."
    >
      <div className="tb-decisiones escalonado">
        {lista.map((n) => (
          <Frenado key={n.anuncio.slug} n={n} alSeguir={alSeguir} />
        ))}
        {guiones.map((a) => (
          <GuionEspera key={a.slug} a={a} alSeguir={alSeguir} />
        ))}
      </div>
    </Seccion>
  );
}
