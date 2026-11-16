// "Actualizar" (barra de arriba): baja lo último de tu repositorio de GitHub (POST /api/github/actualizar).
// Cada 2 minutos pregunta si hay algo nuevo publicado en main (solo pregunta, no cambia nada) y, si hay, el botón lleva
// un punto lima y arriba aparece la franja «Hay cambios nuevos» (BandaActualizacion.jsx) con «Actualizar ahora».
// Si la app se instaló con el comando (sin repositorio), el mismo botón baja la última versión PUBLICADA
// (ActualizarPublica: GET y POST /api/actualizar/publica).
import { useState } from 'react';
import { CircleAlert, CircleCheck, RefreshCw } from 'lucide-react';
import { Boton } from '../componentes/Boton.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { useDatos, invalidar } from '../datos/api.js';

/** Lo que dice GitHub (el servidor lo recuerda un minuto; `ahora` pregunta sí o sí). */
export async function revisarGithub({ ahora = false } = {}) {
  const r = await fetch(`/api/github/actualizar${ahora ? '?ahora=1' : ''}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No pude revisar GitHub.');
  return r.json();
}
const revisar = () => revisarGithub();
export const CADA_MS_GITHUB = 2 * 60000;

/**
 * Baja lo publicado y deja la app al día: si la app se reinicia sola, espera a que vuelva y recarga la página.
 * Devuelve la respuesta del servidor ({ ok, mensaje, cambios, reinicia, recargar }).
 */
export async function actualizarDesdeGithub() {
  const r = await fetch('/api/github/actualizar', { method: 'POST', headers: { Accept: 'application/json' } });
  const d = await r.json().catch(() => ({}));
  const resultado = d?.mensaje ? d : { ok: false, mensaje: 'No pude actualizar. Vuelve a intentarlo.' };
  if (d?.reinicia) {
    await new Promise((ok) => setTimeout(ok, 4000));
    for (let i = 0; i < 60; i++) {
      const e = await fetch('/api/estado', { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null), () => null);
      if (e?.servidor && !e.servidor.desactualizado) {
        window.location.reload();
        return resultado;
      }
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
  invalidar('github-actualizar');
  return resultado;
}

const mb = (b) => `${Math.round((Number(b) || 0) / (1024 * 1024))} MB`;

async function revisarPublica() {
  const r = await fetch('/api/actualizar/publica', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No pude revisar si hay una versión nueva.');
  return r.json();
}

/** El botón «Actualizar» de quien instaló la app con el comando: baja la última versión publicada y la pone. */
function ActualizarPublica() {
  const [trabajando, setTrabajando] = useState(false);
  const { datos, recargar } = useDatos('actualizar-publica', revisarPublica, { cadaMs: trabajando ? 1500 : 10 * 60000 });
  const [abierto, setAbierto] = useState(false);
  const [resultado, setResultado] = useState(null);
  const hay = Boolean(datos?.hayNueva);

  const abrir = () => {
    setResultado(null);
    setAbierto(true);
    invalidar('actualizar-publica');
    recargar?.();
  };
  const actualizar = async () => {
    setTrabajando(true);
    try {
      const r = await fetch('/api/actualizar/publica', { method: 'POST', headers: { Accept: 'application/json' } });
      const d = await r.json().catch(() => ({}));
      setResultado(
        r.ok && d?.ok
          ? { ok: true, mensaje: `Listo: ya tienes la versión ${d.version}. Para usarla, cierra la ventana de la app (la ventana de texto que se abrió con ella) y vuelve a abrir Kads Studio.` }
          : { ok: false, mensaje: d?.error || 'No pude actualizar. Vuelve a intentarlo.' }
      );
    } catch {
      setResultado({ ok: false, mensaje: 'No pude conectar con la app.' });
    } finally {
      setTrabajando(false);
      invalidar('actualizar-publica');
      recargar?.();
    }
  };

  const b = datos?.bajando;
  const texto = trabajando
    ? b
      ? `Bajando la versión nueva: ${mb(b.bytes)}${b.total ? ` de ${mb(b.total)}` : ''}. No cierres la app.`
      : 'Poniendo la versión nueva… No cierres la app.'
    : datos?.reabrir
      ? datos.reabrir.mensaje
      : datos?.error
        ? datos.error
        : !datos
          ? 'Revisando si hay una versión nueva…'
          : hay
            ? `Hay una versión nueva: ${datos.nueva} (tienes la ${datos.version || 'anterior'}).${datos.bytes ? ` Pesa ${mb(datos.bytes)}.` : ''} Tus anuncios, tus claves y tus ajustes no se tocan.`
            : `Tienes la última versión${datos.version ? ` (${datos.version})` : ''}.`;

  return (
    <>
      <span className="barra__actualizar">
        <Boton variante="secundario" tamano="chico" icono={RefreshCw} onClick={abrir}>
          Actualizar
        </Boton>
        {hay ? <span className="barra__actualizar-punto" aria-label="Hay una versión nueva" /> : null}
      </span>
      <Modal
        abierto={abierto}
        onCerrar={() => (trabajando ? null : setAbierto(false))}
        titulo="Actualizar Kads Studio"
        descripcion="Baja la última versión de la app y la deja lista. Lo tuyo no se toca."
        icono={RefreshCw}
        tamano="chico"
        cerrarAfuera={!trabajando}
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setAbierto(false)} disabled={trabajando}>
              Cerrar
            </Boton>
            {resultado?.ok ? null : (
              <Boton variante="primario" icono={RefreshCw} onClick={actualizar} cargando={trabajando} disabled={!hay}>
                Actualizar ahora
              </Boton>
            )}
          </>
        }
      >
        <div className="actualizar-gh">
          {resultado && !trabajando ? (
            <p className={`actualizar-gh__linea${resultado.ok ? ' actualizar-gh__linea--ok' : ' actualizar-gh__linea--error'}`} role="status">
              {resultado.ok ? <CircleCheck size={16} strokeWidth={2} aria-hidden="true" /> : <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />}
              {resultado.mensaje}
            </p>
          ) : (
            <p className="actualizar-gh__linea" role="status">
              {texto}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

export function BotonActualizar() {
  const { datos: gh } = useDatos('github-actualizar', revisar, { cadaMs: CADA_MS_GITHUB });
  // la app llegó con el comando de instalación (sin repositorio): se actualiza con la última versión publicada
  if (gh?.repositorio === false) return <ActualizarPublica />;
  return <ActualizarDeGithub />;
}

function ActualizarDeGithub() {
  const { datos, recargar } = useDatos('github-actualizar', revisar, { cadaMs: CADA_MS_GITHUB });
  const [abierto, setAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const nuevos = datos?.atrasados || 0;
  const sinArmar = !nuevos && Boolean(datos?.pantallaSinArmar); // lo nuevo ya bajó, falta armar la pantalla

  const abrir = async () => {
    setResultado(null);
    setAbierto(true);
    // al abrir se pregunta a GitHub en ese momento (no lo que se revisó hace un rato)
    await revisarGithub({ ahora: true }).catch(() => null);
    invalidar('github-actualizar');
    recargar?.();
  };
  const actualizar = async () => {
    setTrabajando(true);
    try {
      setResultado(await actualizarDesdeGithub());
      recargar?.();
    } catch {
      setResultado({ ok: false, mensaje: 'No pude conectar con la app.' });
    } finally {
      setTrabajando(false);
    }
  };

  const texto = datos?.error
    ? datos.error
    : !datos
      ? 'Revisando tu GitHub…'
      : sinArmar
        ? 'Ya bajó lo último de GitHub, pero falta armar la pantalla nueva. Toca «Actualizar ahora» (unos segundos).'
        : nuevos
        ? `Hay ${nuevos} ${nuevos === 1 ? 'cambio nuevo' : 'cambios nuevos'} en GitHub${datos.ultimo?.titulo ? `. El último: «${datos.ultimo.titulo}».` : '.'}`
        : 'Tienes lo último: no hay nada nuevo en GitHub.';

  return (
    <>
      <span className="barra__actualizar">
        <Boton variante="secundario" tamano="chico" icono={RefreshCw} onClick={abrir}>
          Actualizar
        </Boton>
        {nuevos || sinArmar ? <span className="barra__actualizar-punto" aria-label={`${nuevos} cambios nuevos`} /> : null}
      </span>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Actualizar desde GitHub"
        descripcion="Baja lo último de tu repositorio. Antes guarda lo tuyo, así que no se pierde nada."
        icono={RefreshCw}
        tamano="chico"
        pie={
          resultado?.ok && (resultado.cambios || resultado.recargar) ? (
            <Boton variante="primario" onClick={() => window.location.reload()}>
              Recargar la página
            </Boton>
          ) : (
            <>
              <Boton variante="fantasma" onClick={() => setAbierto(false)}>
                Cerrar
              </Boton>
              <Boton variante="primario" icono={RefreshCw} onClick={actualizar} cargando={trabajando} disabled={(!nuevos && !sinArmar) || Boolean(datos?.error)}>
                Actualizar ahora
              </Boton>
            </>
          )
        }
      >
        <div className="actualizar-gh">
          {resultado ? (
            <p className={`actualizar-gh__linea${resultado.ok ? ' actualizar-gh__linea--ok' : ' actualizar-gh__linea--error'}`} role="status">
              {resultado.ok ? <CircleCheck size={16} strokeWidth={2} aria-hidden="true" /> : <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />}
              {resultado.mensaje}
            </p>
          ) : (
            <p className="actualizar-gh__linea">{texto}</p>
          )}
        </div>
      </Modal>
    </>
  );
}
