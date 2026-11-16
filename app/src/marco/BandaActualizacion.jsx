// «Hay cambios nuevos publicados»: apenas aparece algo nuevo en main (lo revisa BotonActualizar cada 2 minutos), una
// franja arriba lo dice con «Actualizar ahora». Así lo publicado se usa al instante, sin buscar el puntito del botón.
// La app se reinicia sola si hace falta y la página se recarga. «Después» la esconde hasta que haya otro cambio.
import { useState } from 'react';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { Boton } from '../componentes/index.js';
import { useDatos } from '../datos/api.js';
import { revisarGithub, actualizarDesdeGithub, CADA_MS_GITHUB } from './BotonActualizar.jsx';
import '../pantallas/produccion/modo-prueba.css';

const LLAVE = 'kads:actualizacion-despues';
const leer = () => {
  try {
    return window.localStorage.getItem(LLAVE);
  } catch {
    return null;
  }
};

export function BandaActualizacion() {
  const { datos, recargar } = useDatos('github-actualizar', () => revisarGithub(), { cadaMs: CADA_MS_GITHUB });
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [despues, setDespues] = useState(leer);
  const nuevos = datos?.atrasados || 0;
  const ultimo = datos?.ultimo?.fecha || '';
  // «Después» vale hasta que se publique otra cosa (otra fecha del último cambio)
  if (!datos?.repositorio || datos?.error || (!nuevos && !trabajando && !resultado)) return null;
  if (despues && despues === ultimo && !trabajando && !resultado) return null;

  const actualizar = async () => {
    setTrabajando(true);
    setResultado(null);
    try {
      const r = await actualizarDesdeGithub();
      setResultado(r);
      if (r?.ok && (r.recargar || (r.cambios && !r.reabrir && !r.reinicia))) window.location.reload();
    } catch {
      setResultado({ ok: false, mensaje: 'No pude conectar con la app.' });
    } finally {
      setTrabajando(false);
      recargar?.();
    }
  };
  const ocultar = () => {
    try {
      window.localStorage.setItem(LLAVE, ultimo);
    } catch {
      /* sin almacenamiento: se esconde solo en esta visita */
    }
    setDespues(ultimo);
  };

  if (resultado && !resultado.ok) {
    return (
      <div className="modo-prueba modo-prueba--global modo-prueba--error" role="alert">
        <CircleAlert size={15} strokeWidth={2.2} aria-hidden="true" />
        <span style={{ flex: 1 }}>{resultado.mensaje}</span>
        <Boton variante="secundario" tamano="chico" onClick={() => setResultado(null)}>
          Cerrar
        </Boton>
      </div>
    );
  }
  return (
    <div className="modo-prueba modo-prueba--global" role="status">
      <RefreshCw size={15} strokeWidth={2.2} aria-hidden="true" className={trabajando ? 'girando' : undefined} />
      <span style={{ flex: 1 }}>
        {trabajando ? (
          <>
            <strong>Actualizando…</strong> Guardo lo tuyo, bajo lo nuevo y la app se reinicia sola si hace falta. No cierres la app.
          </>
        ) : resultado?.ok ? (
          <>
            <strong>Listo.</strong> {resultado.mensaje}
          </>
        ) : (
          <>
            <strong>
              Hay {nuevos} {nuevos === 1 ? 'cambio nuevo publicado' : 'cambios nuevos publicados'}.
            </strong>{' '}
            {datos?.ultimo?.titulo ? `El último: «${datos.ultimo.titulo}». ` : ''}Tus anuncios, claves y ajustes no se tocan.
          </>
        )}
      </span>
      {!trabajando && !resultado ? (
        <>
          <Boton variante="fantasma" tamano="chico" onClick={ocultar}>
            Después
          </Boton>
          <Boton variante="primario" tamano="chico" icono={RefreshCw} onClick={actualizar}>
            Actualizar ahora
          </Boton>
        </>
      ) : null}
    </div>
  );
}
