// "Actualizar" (barra de arriba): baja lo último de tu repositorio de GitHub (POST /api/github/actualizar).
// Cada 10 minutos pregunta si hay algo nuevo (solo pregunta, no cambia nada) y, si hay, el botón lleva un punto lima.
import { useState } from 'react';
import { CircleAlert, CircleCheck, RefreshCw } from 'lucide-react';
import { Boton } from '../componentes/Boton.jsx';
import { Modal } from '../componentes/Modal.jsx';
import { useDatos, invalidar } from '../datos/api.js';

async function revisar() {
  const r = await fetch('/api/github/actualizar', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No pude revisar GitHub.');
  return r.json();
}

export function BotonActualizar() {
  const { datos, recargar } = useDatos('github-actualizar', revisar, { cadaMs: 10 * 60000 });
  const [abierto, setAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const nuevos = datos?.atrasados || 0;

  const abrir = async () => {
    setResultado(null);
    setAbierto(true);
    invalidar('github-actualizar');
    recargar?.();
  };
  const actualizar = async () => {
    setTrabajando(true);
    try {
      const r = await fetch('/api/github/actualizar', { method: 'POST', headers: { Accept: 'application/json' } });
      const d = await r.json().catch(() => ({}));
      setResultado(d?.mensaje ? d : { ok: false, mensaje: 'No pude actualizar. Vuelve a intentarlo.' });
      invalidar('github-actualizar');
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
      : nuevos
        ? `Hay ${nuevos} ${nuevos === 1 ? 'cambio nuevo' : 'cambios nuevos'} en GitHub${datos.ultimo?.titulo ? `. El último: «${datos.ultimo.titulo}».` : '.'}`
        : 'Tienes lo último: no hay nada nuevo en GitHub.';

  return (
    <>
      <span className="barra__actualizar">
        <Boton variante="secundario" tamano="chico" icono={RefreshCw} onClick={abrir}>
          Actualizar
        </Boton>
        {nuevos ? <span className="barra__actualizar-punto" aria-label={`${nuevos} cambios nuevos`} /> : null}
      </span>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Actualizar desde GitHub"
        descripcion="Baja lo último de tu repositorio. Antes guarda lo tuyo, así que no se pierde nada."
        icono={RefreshCw}
        tamano="chico"
        pie={
          resultado?.ok && resultado.cambios ? (
            <Boton variante="primario" onClick={() => window.location.reload()}>
              Recargar la página
            </Boton>
          ) : (
            <>
              <Boton variante="fantasma" onClick={() => setAbierto(false)}>
                Cerrar
              </Boton>
              <Boton variante="primario" icono={RefreshCw} onClick={actualizar} cargando={trabajando} disabled={!nuevos || Boolean(datos?.error)}>
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
