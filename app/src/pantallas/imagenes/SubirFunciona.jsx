// SUBIR LO QUE YA TE FUNCIONA (2026-11-19h, pedido: «me debe permitir subir lo que me funciona y agregarse a la
// biblioteca»): imágenes o videos de anuncios tuyos que ya venden, desde tu PC. Quedan en «Lo que me funciona»
// (Anuncios de imagen → Variantes y Biblioteca → Lo que me funciona). Y el CONCEPTO de cada uno (por qué vende):
// una variante conserva ese concepto y cambia la ejecución y el título.
// (2026-11-19i) También se PEGAN: el botón «Pegar» o Cmd+V / Ctrl+V con el mouse sobre la zona (en Biblioteca, en
// cualquier parte que no sea un cuadro de texto), y se pueden arrastrar a la zona.
import { useEffect, useRef, useState } from 'react';
import { ClipboardPaste, LoaderCircle, Upload } from 'lucide-react';
import { AreaTexto, Boton, useAvisos } from '../../componentes/index.js';
import { editarFunciona, subirFunciona } from '../../datos/funcionan.js';

const nombrePegada = (f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `pegada-${Date.now().toString(36)}${i ? `-${i}` : ''}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }));

/**
 * El botón para subir y el de pegar. onSubidos(items) con los que entraron.
 * `zona`: el elemento (ref) donde Cmd+V y soltar archivos cuentan cuando el mouse está encima; con `pegarSiempre`,
 * Cmd+V cuenta en toda la pantalla (salvo escribiendo en un cuadro de texto).
 */
export function SubirFunciona({ productoId = null, onSubidos, bloqueado = false, variante = 'secundario', texto = 'Subir lo que te funciona', zona = null, pegarSiempre = false }) {
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
  const subirRef = useRef(subir);
  subirRef.current = subir;
  const ocupado = bloqueado || subiendo > 0;

  // Cmd+V / Ctrl+V: con el mouse sobre la zona (o el foco adentro), o en toda la pantalla con pegarSiempre
  const sobre = useRef(false);
  useEffect(() => {
    const el = zona?.current;
    if (!el) return undefined;
    const entra = () => (sobre.current = true);
    const sale = () => (sobre.current = false);
    const encima = (e) => e.preventDefault();
    const suelta = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!ocupado) subirRef.current(e.dataTransfer?.files || []);
    };
    el.addEventListener('mouseenter', entra);
    el.addEventListener('mouseleave', sale);
    el.addEventListener('dragover', encima);
    el.addEventListener('drop', suelta);
    return () => {
      el.removeEventListener('mouseenter', entra);
      el.removeEventListener('mouseleave', sale);
      el.removeEventListener('dragover', encima);
      el.removeEventListener('drop', suelta);
    };
  }); // (cada vez: la zona puede cambiar de elemento, por ejemplo de «vacío» a la lista)
  useEffect(() => {
    if (ocupado || (!zona && !pegarSiempre)) return undefined;
    const alPegar = (e) => {
      const enCampo = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
      const aqui = sobre.current || Boolean(zona?.current?.contains(document.activeElement));
      if (!aqui && !(pegarSiempre && !enCampo)) return;
      const archivos = [...(e.clipboardData?.items || [])].filter((it) => it.kind === 'file' && /^(image|video)\//.test(it.type)).map((it) => it.getAsFile()).filter(Boolean);
      if (!archivos.length) return;
      e.preventDefault();
      // (que no llegue también a la foto del producto del formulario)
      e.stopPropagation();
      subirRef.current(archivos.map(nombrePegada));
    };
    document.addEventListener('paste', alPegar, true);
    return () => document.removeEventListener('paste', alPegar, true);
  }, [zona, pegarSiempre, ocupado]);

  const pegar = async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error('sin-permiso');
      const items = await navigator.clipboard.read();
      const lista = [];
      for (const it of items) {
        const tipo = it.types.find((t) => /^image\//.test(t));
        if (!tipo) continue;
        lista.push(nombrePegada(new File([await it.getType(tipo)], '', { type: tipo }), lista.length));
      }
      if (!lista.length) {
        aviso({ tipo: 'aviso', titulo: 'No hay una imagen copiada', texto: 'Copia el anuncio (clic derecho → Copiar imagen, o una captura de pantalla) y vuelve a tocar Pegar.' });
        return;
      }
      subir(lista);
    } catch {
      aviso({ tipo: 'info', titulo: 'Pégala con el teclado', texto: 'Pon el mouse encima de «Lo que te funciona» y pulsa Cmd+V (Ctrl+V en Windows).' });
    }
  };

  return (
    <span className="img-subir-funciona">
      <Boton variante={variante} tamano="chico" icono={subiendo ? LoaderCircle : Upload} disabled={ocupado} onClick={() => entrada.current?.click()}>
        {subiendo ? `Subiendo ${subiendo}…` : texto}
      </Boton>
      <Boton variante="secundario" tamano="chico" icono={ClipboardPaste} disabled={ocupado} onClick={pegar} title="O pulsa Cmd+V (Ctrl+V) con el mouse encima">
        Pegar
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
