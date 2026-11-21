// «Editar este anuncio» (2026-11-21h): mientras se hace o ya terminado, pides el cambio con tus palabras («que ya no
// sea cantado, que sea narrado», «cambia el gancho», «que la persona sea un hombre») y la app arma una VERSIÓN NUEVA:
// tu IA parte del guion (o la letra) de este y cambia solo eso, con las mismas personas y lugares (sin pagarlas otra
// vez). Si el cambio es de formato, cambia el estilo (o lo eliges tú). Este no se toca: si se estaba haciendo, se
// detiene para no gastar en lo que vas a cambiar (lo hecho queda guardado). Después ves el guion y lo apruebas.
// Servidor: POST /api/anuncios/:slug/editar (lib/anuncios-nuevos.js editarAnuncio).
//
// (2026-11-21i) «Solo el audio: que sea cantado»: pedido «que me deje editar cosas específicas y no todo el video, por
// ejemplo solo el audio». Un anuncio con narrador ya terminado pasa a CANTADO con sus MISMOS clips: la letra son sus
// mismas frases, eliges la versión de la canción y el montaje se acomoda solo. Cuesta solo la canción.
// Servidor: GET/POST /api/anuncios/:slug/cantar (lib/cambiar-audio.js). Lo demás puntual tiene su lugar: una escena,
// «Regenerar» en Producción; textos, música, cortes o tapar algo, el Editor.
import { useState } from 'react';
import { Music, PencilLine, Scissors } from 'lucide-react';
import { AreaTexto, Boton, Interruptor, Modal, Pestanas, Selector, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, refrescar, useDatos, useEstilos } from '../../datos/api.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';

const CANTADOS = ['musical', 'historias-musicales'];

export function EditarAnuncio({ slug, productoId = null, estilo = null, enMarcha = false, variante = 'secundario', bloque = false }) {
  const [abierto, setAbierto] = useState(false);
  const [pedido, setPedido] = useState('');
  const [elegido, setElegido] = useState('auto');
  const [detener, setDetener] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [modo, setModo] = useState(null); // 'cantar' | 'otro' (null: el que toque)
  const [como, setComo] = useState('');
  const [voz, setVoz] = useState('');
  const { aviso } = useAvisos();
  const { datos: cantar } = useDatos(abierto ? `cantar:${slug}` : null, () => pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/cantar`));
  const puedeCantar = Boolean(cantar && !cantar.motivo);
  const vista = modo || (puedeCantar ? 'cantar' : 'otro');
  const hacerCantado = async () => {
    setOcupado(true);
    try {
      const r = await pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/cantar`, { metodo: 'POST', cuerpo: { como, voz: voz || null } });
      refrescar('anuncios');
      aviso({ tipo: 'ok', titulo: 'Componiendo tu canción', texto: 'Con las mismas escenas. Cuando estén las versiones, elige la que más te guste y sigue sola.' });
      setAbierto(false);
      ir(rutas.produccion(r.slug));
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude cambiar el audio', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  const { datos } = useEstilos();
  const estilos = (Array.isArray(datos) ? datos : datos?.estilos || []).filter((e) => e.clave && e.clave !== 'agregar' && e.instalado !== false);
  const nombreDe = (k) => estilos.find((e) => e.clave === k)?.nombre || k;
  const cantado = CANTADOS.includes(estilo);
  const editar = async () => {
    setOcupado(true);
    try {
      const r = await pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/editar`, { metodo: 'POST', cuerpo: { pedido, estilo: elegido, detener } });
      refrescar('anuncios');
      aviso({
        tipo: 'ok',
        titulo: 'Tu IA está haciendo la versión nueva',
        texto: `${r.cambioDeEstilo ? `Va en «${r.estiloNombre}». ` : ''}${r.detenido ? 'Este quedó detenido (lo hecho está guardado). ' : ''}Revisa el guion y apruébalo antes de producir.`,
      });
      setAbierto(false);
      ir(rutas.nuevo({ ...(r.productoId || productoId ? { producto: r.productoId || productoId } : {}), paso: '2', anuncios: r.slug }));
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude editarlo', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <>
      <Boton variante={variante} icono={PencilLine} onClick={() => setAbierto(true)} bloque={bloque}>
        Editar este anuncio
      </Boton>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Editar este anuncio"
        descripcion="Elige qué cambiar: solo el audio (mismas escenas) o cualquier otro cambio con tus palabras. Siempre sale una versión nueva y este no se borra."
        icono={PencilLine}
      >
        <div className="ent-editar">
          <Pestanas
            etiqueta="Qué quieres cambiar"
            activa={vista}
            onCambio={setModo}
            items={[
              { id: 'cantar', etiqueta: 'Solo el audio: cantado' },
              { id: 'otro', etiqueta: 'Otro cambio' },
            ]}
          />
          {vista === 'cantar' ? (
            <>
              {!cantar ? <p className="t-chico t-3">Mirando el anuncio…</p> : null}
              {cantar?.motivo ? <p className="t-chico">{cantar.motivo}</p> : null}
              {puedeCantar ? (
                <>
                  <p className="t-chico t-2">Mismas escenas, mismos clips: solo cambia el audio. Las frases de tu guion pasan a ser la letra de una canción; escuchas las versiones, eliges una y el video se acomoda solo a la canción. Este no se toca.</p>
                  <AreaTexto
                    etiqueta="¿Cómo quieres que suene?"
                    opcional
                    filas={2}
                    maxLength={600}
                    value={como}
                    onChange={(e) => setComo(e.target.value)}
                    placeholder="Por ejemplo: reguetón alegre como el video de referencia, o balada pop suave"
                  />
                  <Selector
                    etiqueta="Voz"
                    value={voz}
                    onChange={(e) => setVoz(e.target.value)}
                    opciones={[
                      { valor: '', etiqueta: 'Que decida la canción' },
                      { valor: 'f', etiqueta: 'Femenina' },
                      { valor: 'm', etiqueta: 'Masculina' },
                    ]}
                  />
                  <p className="t-chico t-3">Cuesta solo la canción: {cantar.costo?.creditos} créditos de kie (unos US${String(cantar.costo?.dolares ?? '').replace('.', ',')}). Ninguna imagen ni video se paga otra vez.</p>
                  <Boton variante="primario" icono={Music} onClick={hacerCantado} cargando={ocupado}>
                    Hacer la versión cantada
                  </Boton>
                </>
              ) : null}
            </>
          ) : (
            <>
          <AreaTexto
            etiqueta="¿Qué quieres cambiar?"
            filas={4}
            maxLength={3000}
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder={cantado ? 'Por ejemplo: que ya no sea cantado, que sea narrado con voz en off' : 'Por ejemplo: cambia el gancho por una pregunta, que la persona sea un hombre de 40 años, más corto'}
            autoFocus
          />
          <Selector
            etiqueta="Estilo de la versión nueva"
            value={elegido}
            onChange={(e) => setElegido(e.target.value)}
            opciones={[
              { valor: 'auto', etiqueta: `El mismo (${nombreDe(estilo) || 'este'}), o el que pida tu cambio` },
              ...estilos.filter((e) => e.clave !== estilo).map((e) => ({ valor: e.clave, etiqueta: e.nombre })),
            ]}
            ayuda={cantado ? 'Si pides que ya no sea cantado, va narrado con voz en off en el mismo look.' : undefined}
          />
          {enMarcha ? (
            <Interruptor activado={detener} onCambio={setDetener} etiqueta="Detener el que se está haciendo" descripcion="Para no gastar en lo que vas a cambiar. Lo hecho queda guardado y lo puedes continuar después." />
          ) : null}
          <p className="t-chico t-3">Antes de producir ves el guion nuevo y su costo, como siempre.</p>
          <Boton variante="primario" icono={PencilLine} onClick={editar} cargando={ocupado} disabled={pedido.trim().length < 3}>
            Hacer la versión nueva
          </Boton>
            </>
          )}
          <div className="ent-editar__otras">
            <span className="t-chico t-3">Otras cosas puntuales, sin rehacer nada más:</span>
            <span className="t-chico t-3">una escena → «Regenerar» en la producción · textos, música, cortes o tapar algo → el Editor.</span>
            <Boton variante="fantasma" tamano="chico" icono={Scissors} href={enlace.editor(slug)}>
              Abrir en el Editor
            </Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}
