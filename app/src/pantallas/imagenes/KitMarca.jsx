// «Tu marca» del formulario: el kit de marca del producto (2 colores sacados solos de la foto, la letra gruesa, la letra
// a mano y el estilo del sticker). Lo usan todas las plantillas. Se guarda con el producto (el servidor, al generar).
import { Palette } from 'lucide-react';
import { Chip } from '../../componentes/index.js';

export const FUENTES_TITULO = ['Anton', 'Bebas Neue', 'Archivo Black'];
export const FUENTES_MANO = ['Caveat', 'Permanent Marker'];
export const STICKERS = [
  { id: 'estallido', nombre: 'Estallido' },
  { id: 'circulo', nombre: 'Círculo' },
  { id: 'cinta', nombre: 'Cinta' },
];
export const KIT_INICIAL = { primario: '#1F6F4A', secundario: '#F2C14E', fuenteTitulo: 'Anton', fuenteScript: 'Caveat', sticker: 'estallido' };

function Color({ etiqueta, valor, onCambiar, bloqueado }) {
  return (
    <label className="img-kit__color">
      <input type="color" value={valor} onChange={(e) => onCambiar(e.target.value.toUpperCase())} disabled={bloqueado} aria-label={etiqueta} />
      <span>
        <strong>{etiqueta}</strong>
        <span className="t-num t-3">{valor}</span>
      </span>
    </label>
  );
}

/** kit · onCambiar(kit) · automatico (los colores salieron de la foto) · bloqueado */
export function KitMarca({ kit, onCambiar, automatico, bloqueado }) {
  const poner = (c) => onCambiar({ ...kit, ...c });
  return (
    <div className="img-kit">
      <p className="img-nota">
        <Palette size={14} strokeWidth={2} aria-hidden="true" />
        <span>{automatico ? 'Los colores salieron solos de la foto de tu producto. Cámbialos si quieres: quedan guardados con el producto.' : 'Tu kit de marca: lo usan todas las plantillas y queda guardado con el producto.'}</span>
      </p>
      <div className="img-kit__colores">
        <Color etiqueta="Color de fondo" valor={kit.primario} onCambiar={(v) => poner({ primario: v })} bloqueado={bloqueado} />
        <Color etiqueta="Color de acento" valor={kit.secundario} onCambiar={(v) => poner({ secundario: v })} bloqueado={bloqueado} />
      </div>
      <div className="img-kit__fila" role="group" aria-label="Letra de los titulares">
        <span className="img-kit__etiqueta">Titulares</span>
        {FUENTES_TITULO.map((f) => (
          <Chip key={f} activo={kit.fuenteTitulo === f} onClick={() => poner({ fuenteTitulo: f })} disabled={bloqueado}>
            {f}
          </Chip>
        ))}
      </div>
      <div className="img-kit__fila" role="group" aria-label="Letra a mano">
        <span className="img-kit__etiqueta">A mano</span>
        {FUENTES_MANO.map((f) => (
          <Chip key={f} activo={kit.fuenteScript === f} onClick={() => poner({ fuenteScript: f })} disabled={bloqueado}>
            {f}
          </Chip>
        ))}
      </div>
      <div className="img-kit__fila" role="group" aria-label="Estilo del sticker">
        <span className="img-kit__etiqueta">Sticker</span>
        {STICKERS.map((s) => (
          <Chip key={s.id} activo={kit.sticker === s.id} onClick={() => poner({ sticker: s.id })} disabled={bloqueado}>
            {s.nombre}
          </Chip>
        ))}
      </div>
    </div>
  );
}
