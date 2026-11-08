// APRENDIZAJES (#/aprendizajes), como en IA-VID-AUTOMATIC: lo que Claude aprendió de tus anuncios (de las dos apps,
// por la biblioteca compartida) y tus preferencias. Se leen al escribir cada guion. Cada archivo se puede editar.
//   Tus preferencias   mis_archivos/preferencias.md
//   Para todo          aprendizajes/general.md
//   Solo <estilo>      aprendizajes/<estilo>.md
//   Bitácora           aprendizajes/generaciones.md (la llenan la app y el supervisor de IA-VID-AUTOMATIC)
import { useMemo, useState } from 'react';
import { BookOpen, Check, GraduationCap, NotebookPen, Pencil, Sparkles, X } from 'lucide-react';
import { AreaTexto, Boton, CabeceraPagina, Esqueleto, Pestanas, useAvisos } from '../../componentes/index.js';
import { useDatos, invalidar } from '../../datos/api.js';
import { biblioteca, nombreDeCarpeta } from '../biblioteca/datos.js';
import { Markdown } from './Markdown.jsx';
import './aprendizajes.css';

const TITULO = {
  preferencias: { titulo: 'Tus preferencias', sub: 'Valen para todos los anuncios. Las escribes tú.', icono: Sparkles },
  general: { titulo: 'Para todo', sub: 'Reglas que valen para cualquier producto y estilo.', icono: GraduationCap },
  bitacora: { titulo: 'Bitácora de generaciones', sub: 'Lo que hubo que rehacer y por qué, y qué fotogramas funcionan. La llenan solas las dos apps.', icono: NotebookPen },
};
const tituloDe = (a) => TITULO[a.clase] || { titulo: `Solo ${nombreDeCarpeta(a.nombre.replace(/\.md$/, ''))}`, sub: 'Lo que vale solo en este estilo.', icono: BookOpen };
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');

function Archivo({ a, alGuardar }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(a.texto);
  const [guardando, setGuardando] = useState(false);
  const { aviso } = useAvisos();
  const t = tituloDe(a);
  const Icono = t.icono;
  const guardar = async () => {
    setGuardando(true);
    try {
      await biblioteca.guardarAprendizaje(a.nombre, texto);
      setEditando(false);
      aviso({ tipo: 'ok', titulo: 'Guardado', texto: 'Claude lo aplica desde el próximo guion.' });
      alGuardar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo guardar', texto: e.message });
    } finally {
      setGuardando(false);
    }
  };
  return (
    <article className="apr-archivo">
      <header className="apr-archivo__cabecera">
        <span className="apr-archivo__icono" aria-hidden="true">
          <Icono size={18} strokeWidth={2} />
        </span>
        <div className="apr-archivo__titulos">
          <h2>{t.titulo}</h2>
          <p>
            {t.sub} {a.fecha ? <span className="apr-archivo__fecha">Último cambio: {fecha(a.fecha)}</span> : null}
          </p>
        </div>
        {editando ? (
          <div className="apr-archivo__acciones">
            <Boton variante="fantasma" tamano="chico" icono={X} onClick={() => { setTexto(a.texto); setEditando(false); }}>
              Cancelar
            </Boton>
            <Boton variante="primario" tamano="chico" icono={Check} onClick={guardar} cargando={guardando}>
              Guardar
            </Boton>
          </div>
        ) : (
          <Boton variante="secundario" tamano="chico" icono={Pencil} onClick={() => setEditando(true)}>
            Editar
          </Boton>
        )}
      </header>
      {editando ? (
        <AreaTexto etiqueta="" filas={18} value={texto} onChange={(e) => setTexto(e.target.value)} className="apr-editor" aria-label={`Editar ${t.titulo}`} />
      ) : (
        <Markdown texto={a.texto} />
      )}
    </article>
  );
}

export default function Aprendizajes() {
  const { datos, cargando, recargar } = useDatos('aprendizajes', biblioteca.aprendizajes, { cadaMs: 60000 });
  const archivos = datos?.archivos || [];
  const grupos = useMemo(
    () => [
      { id: 'reglas', etiqueta: 'Reglas', icono: GraduationCap, lista: archivos.filter((a) => a.clase !== 'bitacora') },
      { id: 'bitacora', etiqueta: 'Bitácora', icono: NotebookPen, lista: archivos.filter((a) => a.clase === 'bitacora') },
    ],
    [archivos]
  );
  const [pestana, setPestana] = useState('reglas');
  const actual = grupos.find((g) => g.id === pestana);
  return (
    <div className="pagina pagina--angosta apr">
      <CabeceraPagina
        titulo="Aprendizajes"
        descripcion="Lo que Claude aprendió de tus anuncios, como reglas generales que valen para cualquier producto, y tus preferencias. Se aplican en cada guion nuevo y se comparten con tu otra app por GitHub. También puedes escribir tus propias reglas."
      />
      <Pestanas items={grupos.map((g) => ({ id: g.id, etiqueta: g.etiqueta, icono: g.icono, contador: g.lista.length }))} activa={pestana} onCambio={setPestana} />
      {cargando && !datos ? (
        <Esqueleto alto={240} />
      ) : (
        <div className="apr-lista" key={pestana}>
          {actual.lista.map((a) => (
            <Archivo key={`${a.nombre}-${a.fecha}`} a={a} alGuardar={() => { invalidar('aprendizajes'); recargar?.(); }} />
          ))}
          {!actual.lista.length ? <p className="apr-vacio">Todavía no hay nada aquí. Aparece apenas se termine tu primer anuncio.</p> : null}
        </div>
      )}
    </div>
  );
}
