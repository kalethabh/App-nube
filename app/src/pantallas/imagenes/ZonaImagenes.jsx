// Una zona para arrastrar y soltar imágenes (o elegirlas con un clic), con sus vistas previas.
//
//   <ZonaImagenes archivos={refs} onCambiar={setRefs} max={10} titulo="Arrastra tus referencias aquí" numeradas />
//   <ZonaImagenes archivos={logo} onCambiar={setLogo} max={1} titulo="Sube tu logo" ayuda="De preferencia PNG sin fondo" />
//
// `archivos` es una lista de { id, archivo (File), url (vista previa local), nombre }. Las vistas previas se crean
// aquí y se liberan al quitar la imagen; la pantalla libera las que queden al salir (liberarVistas).
import { useRef, useState } from 'react';
import { ImageOff, ImagePlus, RefreshCw, X } from 'lucide-react';
import { Boton, useAvisos } from '../../componentes/index.js';

const PESO_MAXIMO = 25 * 1024 * 1024;
const NORMALES = /^image\/(png|jpe?g|webp)$/i;
const EXTENSIONES = /\.(png|jpe?g|webp)$/i;
const HEIC = /\.(heic|heif)$/i;

/** Libera las vistas previas locales de una lista (al salir de la pantalla). */
export function liberarVistas(lista) {
  for (const a of lista || []) if (a?.url?.startsWith('blob:')) URL.revokeObjectURL(a.url);
}

function Vista({ a }) {
  const [fallo, setFallo] = useState(false);
  if (a.heic) {
    return (
      <span className="img-zona__heic" aria-hidden="true">
        HEIC
        <small>se convierte sola</small>
      </span>
    );
  }
  if (!a.url || fallo) {
    return (
      <span className="img-zona__heic" aria-hidden="true">
        <ImageOff size={18} strokeWidth={1.8} />
      </span>
    );
  }
  return <img src={a.url} alt="" draggable="false" onError={() => setFallo(true)} />;
}

export function ZonaImagenes({
  archivos,
  onCambiar,
  max = 1,
  titulo = 'Arrastra tu imagen aquí',
  ayuda,
  heic = false,
  bloqueada = false,
  numeradas = false,
  etiqueta = 'Tus imágenes',
  id,
  fondoClaro = false,
  masculino = false, // «elegirlo» (el logo) en vez de «elegirla» (la foto)
}) {
  const [encima, setEncima] = useState(false);
  const entrada = useRef(null);
  const { aviso } = useAvisos();
  const formatos = heic ? 'JPG, PNG, WEBP o HEIC' : 'JPG, PNG o WEBP';

  const agregar = (lista) => {
    const todos = [...lista];
    const validos = todos.filter((f) => NORMALES.test(f.type) || EXTENSIONES.test(f.name) || (heic && (HEIC.test(f.name) || /heic|heif/i.test(f.type))));
    if (!validos.length) {
      aviso({ tipo: 'aviso', titulo: 'Eso no parece una imagen', texto: `Acepto ${formatos}.` });
      return;
    }
    const livianos = validos.filter((f) => f.size <= PESO_MAXIMO);
    if (livianos.length < validos.length) aviso({ tipo: 'aviso', titulo: 'Una imagen pesa demasiado', texto: 'El máximo son 25 MB por imagen. Prueba con una más liviana.' });
    if (!livianos.length) return;
    const nuevos = livianos.map((f) => {
      const esHeic = HEIC.test(f.name) || /heic|heif/i.test(f.type);
      return { id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`, archivo: f, nombre: f.name, heic: esHeic, url: esHeic ? null : URL.createObjectURL(f) };
    });
    if (max === 1) {
      liberarVistas(archivos);
      onCambiar(nuevos.slice(0, 1));
      return;
    }
    const lugar = max - archivos.length;
    if (lugar <= 0) {
      liberarVistas(nuevos);
      aviso({ tipo: 'aviso', titulo: `Ya tienes ${max}`, texto: 'Quita una para agregar otra.' });
      return;
    }
    if (nuevos.length > lugar) {
      liberarVistas(nuevos.slice(lugar));
      aviso({ tipo: 'info', titulo: `Agregué ${lugar} de ${nuevos.length}`, texto: `El máximo son ${max}.` });
    }
    onCambiar([...archivos, ...nuevos.slice(0, lugar)]);
  };

  const quitar = (idQuitar) => {
    liberarVistas(archivos.filter((a) => a.id === idQuitar));
    onCambiar(archivos.filter((a) => a.id !== idQuitar));
  };

  const abrir = () => entrada.current?.click();
  const uno = max === 1 ? archivos[0] : null;

  return (
    <div className="img-zona" id={id}>
      {uno ? (
        <div className={`img-zona__una${fondoClaro ? ' img-zona__una--claro' : ''}`}>
          <span className="img-zona__vista img-zona__vista--grande">
            <Vista a={uno} />
          </span>
          <div className="img-zona__una-textos">
            <span className="img-zona__nombre t-recortar" title={uno.nombre}>
              {uno.nombre}
            </span>
            <div className="fila fila--envolver" style={{ '--hueco': '6px' }}>
              <Boton variante="secundario" tamano="chico" icono={RefreshCw} onClick={abrir} disabled={bloqueada}>
                Cambiar
              </Boton>
              <Boton variante="fantasma" tamano="chico" icono={X} onClick={() => quitar(uno.id)} disabled={bloqueada}>
                Quitar
              </Boton>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`img-soltar${encima ? ' img-soltar--encima' : ''}${archivos.length ? ' img-soltar--chica' : ''}`}
          disabled={bloqueada || (max > 1 && archivos.length >= max)}
          onClick={abrir}
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault();
            setEncima(false);
            if (!bloqueada) agregar(e.dataTransfer.files);
          }}
        >
          <span className="img-soltar__icono" aria-hidden="true">
            <ImagePlus size={20} strokeWidth={1.8} />
          </span>
          <span className="img-soltar__textos">
            <span className="img-soltar__titulo">{archivos.length && max > 1 ? (archivos.length >= max ? `Ya tienes ${max}` : 'Agregar más') : titulo}</span>
            <span className="img-soltar__ayuda">
              o haz clic para {max > 1 ? 'elegirlas' : masculino ? 'elegirlo' : 'elegirla'} · {max > 1 ? `hasta ${max} · ` : ''}
              {formatos}
            </span>
          </span>
        </button>
      )}
      <input
        ref={entrada}
        type="file"
        accept={heic ? 'image/*,.heic,.heif' : 'image/png,image/jpeg,image/webp'}
        multiple={max > 1}
        hidden
        onChange={(e) => {
          agregar(e.target.files || []);
          e.target.value = '';
        }}
      />
      {max > 1 && archivos.length ? (
        <ul className="img-zona__lista" aria-label={etiqueta}>
          {archivos.map((a, i) => (
            <li key={a.id} className="img-zona__item">
              <span className="img-zona__vista">
                <Vista a={a} />
              </span>
              {numeradas ? <span className="img-zona__n t-num">R{i + 1}</span> : null}
              {bloqueada ? null : (
                <button type="button" className="img-zona__quitar" onClick={() => quitar(a.id)} aria-label={`Quitar ${a.nombre}`}>
                  <X size={13} strokeWidth={2.6} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {ayuda ? <p className="img-ayuda">{ayuda}</p> : null}
    </div>
  );
}
