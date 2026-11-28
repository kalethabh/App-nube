// Ajustes · Acerca de: la marca, la versión, volver a ver la bienvenida y actualizar la app con un paquete nuevo.
// Nada técnico ni sensible (ni direcciones, ni rutas de carpetas, ni versiones de lo que usa por dentro).
//
// "Actualizar la app": el alumno elige el anuncios-con-ia-app.zip nuevo; se sube a la app (POST /api/actualizar?solo=revisar),
// que lo revisa y dice qué versión es; si confirma, la app lo aplica (POST /api/actualizar/:id/aplicar) sin tocar sus
// anuncios, sus claves ni sus ajustes. Después hay que cerrar la ventana de la app y volver a abrir el lanzador.
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, RefreshCw, Sparkles } from 'lucide-react';
import { BarraDeProgreso, Boton, Esqueleto, Logo, Modal, Seccion, Tarjeta } from '../../componentes/index.js';

const AUTOR = 'by Kalethabh';

/** Sube el zip tal cual, con su avance (fetch no lo da). Devuelve la respuesta de la app o tira un Error con su mensaje. */
function subirPaquete(archivo, alAvanzar) {
  if(window.kadsNube) return window.kadsNube.enviar('/api/actualizar?solo=revisar',{method:'POST',headers:{'Content-Type':'application/zip',Accept:'application/json'},body:archivo,onprogress:alAvanzar}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error || 'No se pudo revisar el paquete.');return d;});
  return new Promise((resolver, rechazar) => {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/actualizar?solo=revisar');
    x.setRequestHeader('Content-Type', 'application/zip');
    x.setRequestHeader('Accept', 'application/json');
    x.upload.onprogress = (e) => e.lengthComputable && alAvanzar(Math.round((e.loaded / e.total) * 100));
    x.onerror = () => rechazar(new Error('No pude conectar con la app. ¿Sigue abierta la ventana del lanzador?'));
    x.onload = () => {
      let datos = null;
      try {
        datos = JSON.parse(x.responseText);
      } catch {
        datos = null;
      }
      if (x.status >= 200 && x.status < 300 && datos) resolver(datos);
      else rechazar(new Error(datos?.error || 'No se pudo revisar el paquete. Vuelve a intentarlo.'));
    };
    x.send(archivo);
  });
}

async function aplicarPaquete(id) {
  let r;
  try {
    r = await fetch(`/api/actualizar/${encodeURIComponent(id)}/aplicar`, { method: 'POST', headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('No pude conectar con la app. ¿Sigue abierta la ventana del lanzador?');
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok || !datos) throw new Error(datos?.error || 'No se pudo actualizar la app. Vuelve a intentarlo.');
  return datos;
}

/** El alumno canceló: la app borra el paquete que guardó al revisarlo (pesa cientos de MB). */
function descartarPaquete(id) {
  if (!id) return;
  fetch(`/api/actualizar/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Accept: 'application/json' } }).catch(() => {});
}

// En Mac, Safari descomprime solo lo que baja y manda el .zip a la Papelera.
const EN_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent || '');

/** Las notas de la versión (de CAMBIOS.md) en texto simple: viñetas, subtítulos y párrafos. */
function Notas({ texto }) {
  if (!texto) return null;
  const limpio = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 40);
  return (
    <div style={{ maxHeight: 260, overflowY: 'auto', fontSize: 'var(--t-ui)', color: 'var(--texto-2)', display: 'grid', gap: 6 }}>
      {lineas.map((l, i) =>
        /^#{2,4}\s/.test(l) ? (
          <strong key={i} style={{ color: 'var(--texto-1)', marginTop: i ? 6 : 0 }}>
            {limpio(l.replace(/^#+\s*/, ''))}
          </strong>
        ) : /^[-*]\s/.test(l) ? (
          <div key={i} style={{ display: 'flex', gap: 8 }}>
            <span aria-hidden="true">·</span>
            <span>{limpio(l.replace(/^[-*]\s*/, ''))}</span>
          </div>
        ) : (
          <p key={i}>{limpio(l)}</p>
        )
      )}
    </div>
  );
}

function Actualizar() {
  const entrada = useRef(null);
  const [info, setInfo] = useState(null); // GET /api/actualizar
  const [etapa, setEtapa] = useState('quieto'); // quieto | subiendo | revisado | aplicando | listo
  const [avance, setAvance] = useState(0);
  const [revisado, setRevisado] = useState(null);
  const [hecho, setHecho] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/actualizar', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && setInfo(d))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const elegido = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setError(null);
    if (!/\.zip$/i.test(archivo.name)) {
      setError('Elige el paquete de la app: un archivo .zip (por ejemplo, anuncios-con-ia-app.zip).');
      return;
    }
    setEtapa('subiendo');
    setAvance(0);
    try {
      const r = await subirPaquete(archivo, setAvance);
      setRevisado(r);
      setEtapa('revisado');
    } catch (err) {
      setError(err.message);
      setEtapa('quieto');
    }
  };

  const confirmar = async () => {
    if (!revisado) return;
    setEtapa('aplicando');
    setError(null);
    try {
      const r = await aplicarPaquete(revisado.id);
      setHecho(r);
      setEtapa('listo');
    } catch (err) {
      setError(err.message);
      setEtapa('quieto');
    }
    setRevisado(null);
  };

  const cancelar = () => {
    descartarPaquete(revisado?.id);
    setRevisado(null);
    setEtapa('quieto');
  };

  const desarrollo = Boolean(info?.desarrollo);
  const ocupado = etapa === 'subiendo' || etapa === 'aplicando';
  // ya se actualizó (en esta pantalla o antes de recargarla): falta cerrar y volver a abrir el lanzador
  const reabrir = etapa !== 'listo' ? info?.reabrir : null;

  return (
    <div style={{ borderTop: '1px solid var(--borde-1)', padding: 'var(--e-6) var(--e-8)', display: 'grid', gap: 'var(--e-3)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--e-4)' }}>
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'grid', gap: 4 }}>
          <strong style={{ color: 'var(--texto-1)' }}>Actualizar la app</strong>
          <span style={{ fontSize: 'var(--t-ui)', color: 'var(--texto-2)' }}>
            {desarrollo
              ? 'En esta copia la app no se actualiza desde un paquete.'
              : 'Cuando recibas una versión nueva (el archivo anuncios-con-ia-app.zip), elígela aquí. Tus anuncios, tus claves y tus ajustes se quedan como están.'}
          </span>
          {!desarrollo && EN_MAC ? (
            <span style={{ fontSize: 'var(--t-mini)', color: 'var(--texto-3)' }}>
              Si Safari lo descomprimió solo, el archivo anuncios-con-ia-app.zip quedó en la Papelera: sácalo de ahí (clic derecho, «Devolver») y elígelo.
            </span>
          ) : null}
        </div>
        <Boton variante="secundario" icono={RefreshCw} cargando={ocupado} disabled={desarrollo || ocupado || etapa === 'listo' || Boolean(reabrir)} onClick={() => entrada.current?.click()}>
          {etapa === 'subiendo' ? 'Revisando el paquete…' : etapa === 'aplicando' ? 'Actualizando…' : 'Actualizar la app'}
        </Boton>
        <input ref={entrada} type="file" accept=".zip,application/zip" hidden onChange={elegido} />
      </div>

      {etapa === 'subiendo' ? <BarraDeProgreso valor={avance} tono="cian" animada etiqueta="Leyendo el paquete" mostrarValor /> : null}
      {etapa === 'aplicando' ? <BarraDeProgreso indeterminada tono="cian" etiqueta="Poniendo la versión nueva" /> : null}

      {error ? (
        <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 'var(--e-3) var(--e-4)', borderRadius: 'var(--r-m)', background: 'var(--error-suave)', border: '1px solid var(--error-borde)', fontSize: 'var(--t-ui)', color: 'var(--texto-1)' }}>
          <CircleAlert size={18} style={{ color: 'var(--error)', flex: 'none', marginTop: 1 }} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {reabrir ? (
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 'var(--e-4)', borderRadius: 'var(--r-m)', background: 'rgba(var(--marca-1-rgb), 0.10)', border: '1px solid var(--borde-2)', fontSize: 'var(--t-ui)', color: 'var(--texto-1)' }}>
          <CircleCheck size={18} style={{ color: 'var(--acento)', flex: 'none', marginTop: 1 }} aria-hidden="true" />
          <span>{reabrir.mensaje}</span>
        </div>
      ) : null}

      {etapa === 'listo' && hecho ? (
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 'var(--e-4)', borderRadius: 'var(--r-m)', background: 'rgba(var(--marca-1-rgb), 0.10)', border: '1px solid var(--borde-2)', fontSize: 'var(--t-ui)', color: 'var(--texto-1)' }}>
          <CircleCheck size={18} style={{ color: 'var(--acento)', flex: 'none', marginTop: 1 }} aria-hidden="true" />
          <div style={{ display: 'grid', gap: 6 }}>
            <strong>Listo: ya tienes la versión {hecho.version}.</strong>
            <span>
              Para terminar, cierra la ventana del lanzador (la ventana de texto que quedó abierta junto a la app) y vuelve a abrir «Abrir Anuncios con IA».
              {hecho.dependencias ? ' Esa vez tarda unos minutos más: prepara lo nuevo antes de abrir.' : ''}
            </span>
            {hecho.respaldo ? <span style={{ color: 'var(--texto-3)' }}>Lo que se reemplazó quedó guardado en la carpeta «respaldos» de la app.</span> : null}
          </div>
        </div>
      ) : null}

      <Modal
        abierto={etapa === 'revisado' && Boolean(revisado)}
        onCerrar={cancelar}
        titulo={`Actualizar a la versión ${revisado?.version || ''}`}
        descripcion={
          revisado?.versionActual
            ? `Ahora tienes la versión ${revisado.versionActual}. Tus anuncios, tus claves y tus ajustes se quedan como están.`
            : 'Tus anuncios, tus claves y tus ajustes se quedan como están.'
        }
        icono={RefreshCw}
        pie={
          <>
            <Boton variante="fantasma" onClick={cancelar}>
              Cancelar
            </Boton>
            <Boton variante="primario" icono={RefreshCw} onClick={confirmar} data-autofocus>
              Actualizar
            </Boton>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--e-3)' }}>
          {revisado?.notas ? (
            <>
              <span style={{ fontSize: 'var(--t-mini)', color: 'var(--texto-3)', fontWeight: 600 }}>Qué trae esta versión</span>
              <Notas texto={revisado.notas} />
            </>
          ) : null}
          <span style={{ fontSize: 'var(--t-ui)', color: 'var(--texto-2)' }}>
            Al terminar vas a tener que cerrar la ventana del lanzador y volver a abrir «Abrir Anuncios con IA».
          </span>
        </div>
      </Modal>
    </div>
  );
}

export function AcercaDe({ ajustes, alVerBienvenida }) {
  const a = ajustes?.app;
  return (
    <Seccion id="acerca" className="ajustes__seccion" titulo="Acerca de">
      <Tarjeta relleno="ninguno" className="acerca">
        <div className="acerca__portada">
          <span className="acerca__logo">
            <Logo tamano={56} />
          </span>
          <div className="acerca__textos">
            <h3 className="acerca__nombre">
              {a?.nombre || 'Kads Studio'}
              <span className="acerca__punto" aria-hidden="true">
                ·
              </span>
              <span className="acerca__autor">{AUTOR}</span>
            </h3>
            <p className="acerca__texto">De tu producto a un anuncio listo para Meta y TikTok, en tu propia PC.</p>
            <div className="acerca__version">
              <span className="acerca__version-etiqueta">Versión</span>
              {a ? <span className="t-mono">{a.version || '—'}</span> : <Esqueleto ancho={48} alto={14} />}
            </div>
          </div>
          <div className="acerca__acciones">
            <Boton variante="secundario" icono={Sparkles} onClick={alVerBienvenida}>
              Ver la bienvenida
            </Boton>
          </div>
        </div>
        <Actualizar />
      </Tarjeta>
    </Seccion>
  );
}
