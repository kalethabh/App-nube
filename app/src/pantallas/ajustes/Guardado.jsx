// Ajustes · Guardado: todo lo que la app crea, cambia o borra se sube solo a tu GitHub cada 2 minutos; los videos y
// audios se copian a tu Google Drive (server/lib/guardado.js).
import { useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { Boton, Seccion, Tarjeta } from '../../componentes/index.js';
import { useDatos, invalidar } from '../../datos/api.js';

async function leer() {
  const r = await fetch('/api/guardado', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No pude leer el guardado.');
  return r.json();
}

function Linea({ titulo, e }) {
  const Icono = e?.ok ? CircleCheck : CircleAlert;
  return (
    <div className="guardado__linea">
      <Icono size={16} strokeWidth={2} className={e?.ok ? 'guardado__ok' : 'guardado__aviso'} aria-hidden="true" />
      <div>
        <strong>{titulo}</strong>
        <p className="ajustes__nota">{e?.mensaje || 'Todavía no se revisó (la primera vez, al minuto de abrir la app).'}</p>
      </div>
    </div>
  );
}

export function Guardado() {
  const { datos, recargar } = useDatos('guardado', leer, { cadaMs: 30000 });
  const [guardando, setGuardando] = useState(false);
  const ahora = async () => {
    setGuardando(true);
    try {
      await fetch('/api/guardado', { method: 'POST', headers: { Accept: 'application/json' } });
      invalidar('guardado');
      await recargar?.();
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Seccion id="guardado" className="ajustes__seccion" titulo="Guardado en la nube">
      <Tarjeta>
        <p className="ajustes__nota">
          Cada 2 minutos, todo lo que la app crea, cambia o borra se sube solo a tu GitHub (guiones, imágenes, ajustes y aprendizajes). Los videos y audios, que pesan mucho, se copian a tu Google Drive, en la carpeta «Anuncios con IA».
        </p>
        <Linea titulo="GitHub" e={datos?.github} />
        <Linea titulo="Google Drive" e={datos?.drive} />
        <Boton variante="secundario" tamano="chico" onClick={ahora} cargando={guardando}>
          Guardar ahora
        </Boton>
      </Tarjeta>
    </Seccion>
  );
}
