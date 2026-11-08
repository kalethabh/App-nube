// Aviso en la entrega: este anuncio ya está en tu Google Drive (lo pesado se borró de la Mac para liberar espacio).
// "Traer de vuelta" lo baja otra vez para verlo aquí (para editar, rehacer o sacar ganchos se trae solo).
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
        <strong>Este anuncio está en tu Google Drive.</strong> Para liberar espacio, sus videos e imágenes se borraron de este computador. Para editarlo, rehacer algo o sacar más ganchos, se trae solo.
      </p>
      <Boton variante="secundario" tamano="chico" icono={CloudDownload} onClick={traer} cargando={trayendo}>
        Traer de vuelta
      </Boton>
      {error ? <p className="ent-nube__error">{error}</p> : null}
    </div>
  );
}
