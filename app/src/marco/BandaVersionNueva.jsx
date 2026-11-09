// "Hay una versión nueva que todavía no está en uso": después de «Actualizar» (o de un git pull) sin reiniciar la
// app. «Reiniciar la app» la vuelve a levantar con lo nuevo y la página se recarga sola. Si hay un video
// produciéndose, no se corta: el reinicio queda pedido y se hace solo cuando termina.
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Boton } from '../componentes/index.js';
import { useEstado } from '../datos/api.js';
import '../pantallas/produccion/modo-prueba.css';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function BandaVersionNueva() {
  const { datos } = useEstado({ cadaMs: 30000 });
  const [reiniciando, setReiniciando] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const esperando = useRef(false);
  const servidor = datos?.servidor;

  // espera a que la app vuelva con lo nuevo y recarga la página
  const esperar = async () => {
    if (esperando.current) return;
    esperando.current = true;
    await dormir(3000);
    for (;;) {
      const r = await fetch('/api/estado', { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null), () => null);
      if (r?.servidor && !r.servidor.desactualizado) return window.location.reload();
      await dormir(3000);
    }
  };
  const reiniciar = async () => {
    setReiniciando(true);
    const r = await fetch('/api/reiniciar', { method: 'POST', headers: { Accept: 'application/json' } }).then((x) => x.json(), () => null);
    if (r?.pendiente) setPendiente(true);
    esperar();
  };
  // ya pedido (desde esta u otra pestaña): se espera solo
  useEffect(() => {
    if (servidor?.reinicioPedido) esperar();
  }, [servidor?.reinicioPedido]); // eslint-disable-line react-hooks/exhaustive-deps

  // una app de antes de este aviso (no dice nada de su versión): no se puede reiniciar desde aquí
  if (datos && !servidor && !reiniciando) {
    return (
      <div className="modo-prueba modo-prueba--global modo-prueba--error" role="alert">
        <RefreshCw size={15} strokeWidth={2.2} aria-hidden="true" />
        <span>
          <strong>Está corriendo una versión vieja de la app.</strong> Por eso algunas cosas dicen «No existe esa ruta». Reinicia la Mac y abre la app con
          doble clic en «Abrir Anuncios con IA».
        </span>
      </div>
    );
  }
  if (!servidor?.desactualizado && !reiniciando) return null;

  if (servidor?.reinicioPedido || pendiente) {
    return (
      <div className="modo-prueba modo-prueba--global" role="status">
        <RefreshCw size={15} strokeWidth={2.2} aria-hidden="true" className="girando" />
        <span style={{ flex: 1 }}>
          <strong>La app se reinicia sola cuando termine el video que se está produciendo.</strong> No tienes que hacer nada: la página se recarga sola.
        </span>
      </div>
    );
  }
  return (
    <div className="modo-prueba modo-prueba--global" role="alert">
      <RefreshCw size={15} strokeWidth={2.2} aria-hidden="true" className={reiniciando ? 'girando' : undefined} />
      <span style={{ flex: 1 }}>
        <strong>{reiniciando ? 'Reiniciando la app…' : 'Hay una versión nueva de la app que todavía no está en uso.'}</strong>{' '}
        {reiniciando ? 'La página se recarga sola en unos segundos.' : servidor?.ocupado ? 'Se puede reiniciar cuando termine el video que se está produciendo.' : 'Reiníciala para usarla (unos segundos).'}
      </span>
      {!reiniciando ? (
        <Boton variante="primario" tamano="chico" onClick={reiniciar}>
          {servidor?.ocupado ? 'Reiniciar al terminar' : 'Reiniciar la app'}
        </Boton>
      ) : null}
    </div>
  );
}
