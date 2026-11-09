// "Hay una versión nueva que todavía no está en uso": después de «Actualizar» (o de un git pull) sin reiniciar la
// app. «Reiniciar la app» la vuelve a levantar con lo nuevo y la página se recarga sola.
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Boton } from '../componentes/index.js';
import { useEstado } from '../datos/api.js';
import '../pantallas/produccion/modo-prueba.css';

export function BandaVersionNueva() {
  const { datos } = useEstado({ cadaMs: 30000 });
  const [reiniciando, setReiniciando] = useState(false);
  // una app de antes de este aviso (no dice nada de su versión): no se puede reiniciar desde aquí
  if (datos && !datos.servidor && !reiniciando) {
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
  if (!datos?.servidor?.desactualizado && !reiniciando) return null;
  const reiniciar = async () => {
    setReiniciando(true);
    await fetch('/api/reiniciar', { method: 'POST', headers: { Accept: 'application/json' } }).catch(() => null);
    await new Promise((r) => setTimeout(r, 3000));
    for (let i = 0; i < 60; i++) {
      const r = await fetch('/api/estado', { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null), () => null);
      if (r && !r.servidor?.desactualizado) return window.location.reload();
      await new Promise((ok) => setTimeout(ok, 1500));
    }
    setReiniciando(false);
  };
  return (
    <div className="modo-prueba modo-prueba--global" role="alert">
      <RefreshCw size={15} strokeWidth={2.2} aria-hidden="true" />
      <span style={{ flex: 1 }}>
        <strong>Hay una versión nueva de la app que todavía no está en uso.</strong> Reiníciala para usarla (unos segundos).
      </span>
      <Boton variante="primario" tamano="chico" onClick={reiniciar} cargando={reiniciando}>
        Reiniciar la app
      </Boton>
    </div>
  );
}
