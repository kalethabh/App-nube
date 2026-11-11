// Elegir una carpeta solo cambia el borrador; se aplica al guardar la configuración de este equipo.
import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, FolderOpen, Save } from 'lucide-react';
import { Boton, CampoTexto, Interruptor, Seccion, Selector, Tarjeta, useAvisos } from '../../componentes/index.js';
import { useDatos, invalidar } from '../../datos/api.js';

async function pedir(url = '/api/guardado', opciones = {}) {
  const r = await fetch(url, { ...opciones, headers: { Accept: 'application/json', ...(opciones.body ? { 'Content-Type': 'application/json' } : {}) } });
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(datos?.error || 'No pude completar el guardado. Vuelve a intentarlo.');
  return datos;
}
const leer = () => pedir();
const borradorDe = (a) => ({ modo: a?.modo || 'automatico', carpeta: a?.carpeta || '', conservarLocal: a?.modo === 'nube' ? !a.liberarEspacio : true });
function destinoDetectado(raiz) {
  const ruta = String(raiz || '').replace(/[\\/]+$/, '');
  return `${ruta}${ruta.includes('\\') ? '\\' : '/'}Anuncios con IA`;
}
function Linea({ titulo, e }) {
  const Icono = e?.ok ? CircleCheck : CircleAlert;
  return (
    <div className="guardado__linea">
      <Icono size={16} strokeWidth={2} className={e?.ok ? 'guardado__ok' : 'guardado__aviso'} aria-hidden="true" />
      <div><strong>{titulo}</strong><p className="ajustes__nota">{e?.mensaje || 'Todavía no se revisó (la primera vez, al minuto de abrir la app).'}</p></div>
    </div>
  );
}

export function Guardado() {
  const { datos, error: errorLectura, recargar } = useDatos('guardado', leer, { cadaMs: 30000 });
  const { aviso } = useAvisos();
  const [borrador, setBorrador] = useState(null);
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);
  const [notaSelector, setNotaSelector] = useState(null);
  const almacenamiento = datos?.almacenamiento;
  const liberarAutomatico = almacenamiento?.modo === 'automatico' ? Boolean(almacenamiento.liberarEspacio) : true;
  // El sondeo actualiza los estados, pero nunca pisa lo que estás escribiendo.
  useEffect(() => {
    if (almacenamiento && !sucio && !ocupado) setBorrador(borradorDe(almacenamiento));
  }, [almacenamiento, sucio, ocupado]);
  const cambiar = (cambio) => {
    setBorrador((b) => ({ ...b, ...cambio }));
    setSucio(true);
    setError(null);
  };
  const refrescar = async () => { invalidar('guardado'); await recargar?.(); };
  const guardarConfiguracion = async (e) => {
    e.preventDefault();
    if (!borrador || ocupado) return;
    setOcupado('configuracion');
    setError(null);
    try {
      const r = await pedir('/api/guardado/configuracion', {
        method: 'PUT',
        body: JSON.stringify({
          modo: borrador.modo,
          carpeta: borrador.modo === 'nube' ? borrador.carpeta.trim() : null,
          liberarEspacio: borrador.modo === 'nube' ? !borrador.conservarLocal : borrador.modo === 'automatico' ? liberarAutomatico : false,
        }),
      });
      await refrescar();
      setBorrador(borradorDe(r?.almacenamiento || almacenamiento));
      setSucio(false);
      aviso({ tipo: 'ok', titulo: 'Configuración guardada en este equipo', texto: 'El próximo guardado usará el destino elegido. Los archivos que ya están en la nube siguen disponibles.' });
    } catch (err) {
      setError(err.message);
    } finally { setOcupado(null); }
  };
  const elegirCarpeta = async () => {
    if (ocupado) return;
    setOcupado('carpeta');
    setError(null);
    setNotaSelector(null);
    try {
      const r = await pedir('/api/guardado/elegir-carpeta', { method: 'POST' });
      if (r?.cancelado) return;
      if (r?.carpeta) cambiar({ carpeta: r.carpeta });
      else setNotaSelector('No se pudo abrir el selector de carpetas. Puedes escribir o pegar la ruta completa abajo.');
    } catch (err) { setNotaSelector(`${err.message} También puedes escribir o pegar la ruta completa.`); }
    finally { setOcupado(null); }
  };
  const ahora = async () => {
    if (ocupado) return;
    setOcupado('ahora');
    setError(null);
    try { await pedir('/api/guardado', { method: 'POST' }); await refrescar(); }
    catch (err) { setError(err.message); }
    finally { setOcupado(null); }
  };
  const bloqueado = Boolean(ocupado) || !borrador;
  const detectadas = (almacenamiento?.carpetasDetectadas || []).map((c) => ({ valor: c.ruta, etiqueta: c.nombre || c.ruta }));
  const elegidaDetectada = detectadas.some((c) => c.valor === borrador?.carpeta) ? borrador.carpeta : '';
  const carpetaAutomatica = almacenamiento?.modo === 'automatico'
    ? almacenamiento.carpetaEfectiva
    : almacenamiento?.carpetasDetectadas?.[0]?.ruta ? destinoDetectado(almacenamiento.carpetasDetectadas[0].ruta) : null;

  return (
    <Seccion id="guardado" className="ajustes__seccion" titulo="Guardado y almacenamiento">
      <Tarjeta>
        <p className="ajustes__nota">Elige dónde guardar tus videos, audios e imágenes en este equipo. Los guiones, ajustes y aprendizajes se siguen guardando en GitHub cada 2 minutos.</p>
        {errorLectura ? <div className="guardado__error" role="alert"><p>{errorLectura.message}</p><Boton variante="fantasma" tamano="chico" onClick={refrescar} disabled={Boolean(ocupado)}>Volver a intentar</Boton></div> : null}
        <form className="guardado__formulario" onSubmit={guardarConfiguracion} aria-busy={ocupado ? true : undefined}>
          <Selector etiqueta="Dónde guardar los archivos" value={borrador?.modo || 'automatico'} disabled={bloqueado} onChange={(e) => cambiar({ modo: e.target.value })}
            opciones={[{ valor: 'automatico', etiqueta: 'Automático (como hasta ahora)' }, { valor: 'local', etiqueta: 'En este computador' }, { valor: 'nube', etiqueta: 'En una carpeta de nube' }]} />
          {borrador?.modo === 'automatico' ? (
            <div className="guardado__destino">
              <p className="ajustes__nota">La app detecta Google Drive para escritorio y usa su carpeta «Anuncios con IA», con el funcionamiento que ya tenías.</p>
              <CampoTexto etiqueta="Carpeta detectada" value={carpetaAutomatica || 'No se detectó Google Drive en este equipo'} readOnly disabled={bloqueado} icono={FolderOpen} />
              <p className="ajustes__nota">{liberarAutomatico ? 'Los anuncios de video que se pueden recuperar liberan espacio local después de verificar su copia.' : 'Se conserva la copia de los archivos en este computador.'}</p>
            </div>
          ) : borrador?.modo === 'local' ? (
            <div className="guardado__destino">
              <CampoTexto etiqueta="Carpeta de trabajo de la app" value={almacenamiento?.carpetaLocal || ''} readOnly disabled={bloqueado} icono={FolderOpen} />
              <p className="ajustes__nota">Los archivos nuevos se quedan en las carpetas de la app. Los anuncios que ya estaban en la nube se pueden traer de vuelta para editarlos.</p>
            </div>
          ) : borrador?.modo === 'nube' ? (
            <div className="guardado__destino">
              <p className="ajustes__nota">Elige una carpeta sincronizada con Google Drive para escritorio, Dropbox o OneDrive. La app copia allí los archivos; el programa de esa nube se encarga de subirlos.</p>
              {detectadas.length ? <Selector etiqueta="Google Drive detectado" value={elegidaDetectada} disabled={bloqueado} onChange={(e) => { if (e.target.value) cambiar({ carpeta: e.target.value }); }}
                opciones={[{ valor: '', etiqueta: 'Elegir una carpeta detectada…' }, ...detectadas]} ayuda="Usará esta carpeta. Puedes elegir una subcarpeta existente con «Elegir carpeta»." /> : null}
              <div className="guardado__ruta">
                <CampoTexto etiqueta="Carpeta de destino" value={borrador.carpeta} onChange={(e) => cambiar({ carpeta: e.target.value })} disabled={bloqueado} required autoComplete="off" spellCheck={false} icono={FolderOpen}
                  ayuda="La ruta completa de una carpeta de este equipo, no un enlace de internet. Se usará exactamente esta carpeta." />
                <Boton variante="secundario" tamano="chico" icono={FolderOpen} onClick={elegirCarpeta} disabled={bloqueado || almacenamiento?.selectorDisponible === false} cargando={ocupado === 'carpeta'}>Elegir carpeta</Boton>
              </div>
              {notaSelector || almacenamiento?.selectorDisponible === false ? <p className="ajustes__nota" role="status">{notaSelector || 'El selector de carpetas no está disponible aquí. Escribe o pega la ruta completa.'}</p> : null}
              <Interruptor etiqueta="Conservar una copia en este computador" activado={borrador.conservarLocal} onCambio={(v) => cambiar({ conservarLocal: v })} deshabilitado={bloqueado}
                descripcion={borrador.conservarLocal ? 'Los archivos se copian al destino y también se quedan aquí.' : 'Libera espacio de los anuncios de video que la app puede recuperar, solo después de verificar la copia. Al editarlos, vuelven de esa carpeta. Los lotes de imágenes, Cambiar el producto y Sketch conservan sus archivos aquí.'} />
              <p className="ajustes__nota">La producción y el editor siempre necesitan algo de espacio temporal en este computador.</p>
            </div>
          ) : null}
          <p className="ajustes__nota">Los archivos ya archivados permanecen en su carpeta anterior y la app conserva cómo recuperarlos.</p>
          <div className="guardado__acciones">
            <Boton variante="primario" tamano="chico" icono={Save} type="submit" disabled={bloqueado || !sucio || (borrador?.modo === 'nube' && !borrador.carpeta.trim())} cargando={ocupado === 'configuracion'}>Guardar configuración</Boton>
            {sucio ? <span className="ajustes__nota" role="status">Cambios sin guardar</span> : <span className="ajustes__nota">Esta configuración se guarda solo en este equipo.</span>}
          </div>
        </form>
        {error ? <p className="guardado__error" role="alert"><CircleAlert size={15} aria-hidden="true" />{error}</p> : null}
        <div className="guardado__estado">
          <Linea titulo="GitHub" e={datos?.github} />
          <Linea titulo="Archivos" e={datos?.drive} />
          <Boton variante="secundario" tamano="chico" onClick={ahora} disabled={Boolean(ocupado) || !datos || sucio} cargando={ocupado === 'ahora'}>Guardar ahora</Boton>
          {sucio ? <p className="ajustes__nota">Guarda la configuración para usar el nuevo destino.</p> : null}
        </div>
      </Tarjeta>
    </Seccion>
  );
}
