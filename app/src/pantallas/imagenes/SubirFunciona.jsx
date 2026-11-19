// SUBIR LO QUE YA TE FUNCIONA (2026-11-19h, pedido: «me debe permitir subir lo que me funciona y agregarse a la
// biblioteca»): imágenes o videos de anuncios tuyos que ya venden, desde tu PC. Quedan en «Lo que me funciona»
// (Anuncios de imagen → Variantes y Biblioteca → Lo que me funciona). Y el CONCEPTO de cada uno (por qué vende):
// una variante conserva ese concepto y cambia la ejecución y el título.
import { useRef, useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import { AreaTexto, Boton, useAvisos } from '../../componentes/index.js';
import { editarFunciona, subirFunciona } from '../../datos/funcionan.js';

/** El botón: sube los archivos elegidos (o soltados) con el producto. onSubidos(items) con los que entraron. */
export function SubirFunciona({ productoId = null, onSubidos, bloqueado = false, variante = 'secundario', texto = 'Subir lo que te funciona' }) {
  const entrada = useRef(null);
  const [subiendo, setSubiendo] = useState(0);
  const { aviso } = useAvisos();
  const subir = async (lista) => {
    const archivos = [...lista].filter((a) => /^(image|video)\//.test(a.type));
    if (!archivos.length) {
      aviso({ tipo: 'aviso', titulo: 'Sube imágenes o videos', texto: 'JPG, PNG o WEBP, o un video MP4 o MOV.' });
      return;
    }
    setSubiendo(archivos.length);
    const hechos = [];
    for (const a of archivos) {
      try {
        hechos.push(await subirFunciona(a, { productoId }));
      } catch (e) {
        aviso({ tipo: 'error', titulo: `No pude subir «${a.name}»`, texto: e.message });
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
    if (hechos.length) {
      aviso({ tipo: 'ok', titulo: hechos.length === 1 ? 'Quedó en «Lo que me funciona»' : `${hechos.length} anuncios quedaron en «Lo que me funciona»`, texto: 'También los ves en Biblioteca. Escribe por qué funcionan: las variantes conservan ese concepto.' });
      onSubidos?.(hechos);
    }
  };
  return (
    <span
      className="img-subir-funciona"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!bloqueado && !subiendo) subir(e.dataTransfer.files || []);
      }}
    >
      <Boton variante={variante} tamano="chico" icono={subiendo ? LoaderCircle : Upload} disabled={bloqueado || subiendo > 0} onClick={() => entrada.current?.click()}>
        {subiendo ? `Subiendo ${subiendo}…` : texto}
      </Boton>
      <input
        ref={entrada}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          subir(e.target.files || []);
          e.target.value = '';
        }}
      />
    </span>
  );
}

/** «Por qué funciona» de un creativo: se guarda al salir del cuadro. onGuardado(item) con el creativo al día. */
export function ConceptoFunciona({ item, onGuardado, bloqueado = false, filas = 2 }) {
  const [texto, setTexto] = useState(item.concepto || '');
  const [guardando, setGuardando] = useState(false);
  const { aviso } = useAvisos();
  const guardar = async () => {
    if ((item.concepto || '') === texto.trim()) return;
    setGuardando(true);
    try {
      onGuardado?.(await editarFunciona(item.id, { concepto: texto }));
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude guardar el concepto', texto: e.message });
    } finally {
      setGuardando(false);
    }
  };
  return (
    <AreaTexto
      filas={filas}
      maxLength={500}
      value={texto}
      disabled={bloqueado || guardando}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={guardar}
      placeholder="¿Por qué funciona? El concepto: el gancho, la idea, a quién le habla. Ej.: «antes y después de la mamá a los 40, con el titular en pregunta»"
      aria-label={`Por qué funciona ${item.titulo || item.producto || 'este anuncio'}`}
    />
  );
}
