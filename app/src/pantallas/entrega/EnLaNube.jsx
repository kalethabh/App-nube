// Aviso en la entrega: este anuncio ya está en tu nube (lo pesado se borró del computador para liberar espacio). Se ve,
// se reproduce y se descarga desde la copia (lib/en-la-nube.js); «Traer de vuelta» lo baja otra vez (para editar,
// rehacer o sacar ganchos se trae solo).
import { useEffect, useState } from 'react';
import { CloudDownload } from 'lucide-react';
import { Boton } from '../../componentes/index.js';
import { invalidar } from '../../datos/api.js';

export function EnLaNube({ slug, alTraer }) {
  const [e, setE] = useState(null);
  const [trayendo, setTrayendo] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch(`/api/anuncios/${encodeURIComponent(slug)}/nube`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then(setE)
      .catch(() => {});
  }, [slug]);
  if (!e?.enLaNube) return null;
  const traer = async () => {
    setTrayendo(true);
    setError(null);
    try {
      const r = await fetch(`/api/anuncios/${encodeURIComponent(slug)}/nube/traer`, { method: 'POST', headers: { Accept: 'application/json' } });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || 'No pude traerlo.');
      setE({ enLaNube: false });
      invalidar('anuncio');
      invalidar('anuncios');
      alTraer?.();
    } catch (x) {
      setError(x.message);
    } finally {
      setTrayendo(false);
    }
  };
  return (
    <div className="ent-nube">
      <p className="ent-nube__texto">
        <strong>Está en tu nube.</strong> Lo ves, lo reproduces y lo descargas desde aquí. Para editarlo, rehacer algo o sacar más ganchos, se trae solo.
      </p>
      <Boton variante="secundario" tamano="chico" icono={CloudDownload} onClick={traer} cargando={trayendo}>
        Traer de vuelta
      </Boton>
      {error ? <p className="ent-nube__error">{error}</p> : null}
    </div>
  );
}
