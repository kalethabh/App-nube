// Mover con el mouse los textos y las imágenes de la vista previa.
//
// La composición marca cada texto y cada imagen con data-capa="<id>" (AnuncioEditado.jsx). Como el lienzo tiene
// el mismo tamaño que el video (9:16, el Player ocupa todo), su rectángulo es el del cuadro: lo que se arrastra en
// la pantalla se pasa a fracciones del cuadro y se guarda en x / y, igual que los deslizadores del panel.
//   - una imagen: x, y es su centro (0 a 1);
//   - un texto: y es su borde de arriba (0,05 a 0,85) y x su lugar a lo ancho (0,2 a 0,8, ver TextoEnPantalla).
//   - un subtítulo (data-capa="sub:<bloque>"): la altura (desde abajo) y el lado (corrimiento a lo ancho) de todos,
//     o solo de ese si está prendida «Mover solo el subtítulo que arrastro» (lugaresSubtitulos).
// Tocar uno lo elige (sin pausar ni reproducir el video); el elegido lleva un marco que lo sigue.
import { useEffect, useMemo, useRef } from 'react';

const entre = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;

/** El rectángulo de una capa: el suyo, o el de su contenido si ocupa todo el cuadro (los subtítulos). */
function rectDe(el) {
  if (!el.hasAttribute('data-capa-contenido')) return el.getBoundingClientRect();
  let r = null;
  for (const h of el.children) {
    const x = h.getBoundingClientRect();
    if (!x.width) continue;
    r = r ? { left: Math.min(r.left, x.left), top: Math.min(r.top, x.top), right: Math.max(r.right, x.right), bottom: Math.max(r.bottom, x.bottom) } : { left: x.left, top: x.top, right: x.right, bottom: x.bottom };
  }
  return r ? { ...r, width: r.right - r.left, height: r.bottom - r.top } : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
}

/** ¿Se puede arrastrar? Los textos e imágenes editables y los subtítulos. */
const sirve = (id, textos) => String(id).startsWith('sub:') || textos.some((t) => t.id === id && !t.fijo);

/** El texto, la imagen o el subtítulo bajo el puntero (el de más arriba), o null. */
function capaEn(lienzo, cx, cy) {
  if (!lienzo) return null;
  const capas = [...lienzo.querySelectorAll('[data-capa]')];
  for (let i = capas.length - 1; i >= 0; i--) {
    const r = rectDe(capas[i]);
    if (r.width && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return capas[i];
  }
  return null;
}

export function useArrastrarEnVideo({ lienzoRef, marcoRef, playerRef, textos, seleccion, setSeleccion, ajustar, subtitulos, moverSubtitulo }) {
  const datos = useRef({});
  datos.current = { textos, ajustar, setSeleccion, subtitulos, moverSubtitulo };
  const tocado = useRef(false);

  // el marco del elegido: lo sigue en cada cuadro (el texto entra con un pop y se mueve con el video)
  const elegido = seleccion?.pista === 'textos' ? seleccion.id : seleccion?.pista === 'subtitulos' ? `sub:${seleccion.id}` : null;
  useEffect(() => {
    const marco = marcoRef.current;
    if (!marco) return undefined;
    if (!elegido) {
      marco.style.display = 'none';
      return undefined;
    }
    let vuelta = 0;
    const dibujar = () => {
      const lienzo = lienzoRef.current;
      const el = lienzo?.querySelector(`[data-capa="${CSS.escape(elegido)}"]`);
      if (el && lienzo) {
        const r = rectDe(el);
        const l = lienzo.getBoundingClientRect();
        marco.style.display = 'block';
        marco.style.transform = `translate(${r.left - l.left - 4}px, ${r.top - l.top - 4}px)`;
        marco.style.width = `${r.width + 8}px`;
        marco.style.height = `${r.height + 8}px`;
      } else marco.style.display = 'none';
      vuelta = requestAnimationFrame(dibujar);
    };
    dibujar();
    return () => cancelAnimationFrame(vuelta);
  }, [elegido, lienzoRef, marcoRef]);

  /** Un subtítulo: se mueven todos (la altura y el lado de siempre) o solo ese, según la casilla. */
  function arrastrarSubtitulo(e, lienzo, bloque) {
    const s = datos.current.subtitulos;
    if (!s || !datos.current.moverSubtitulo || !Number.isInteger(bloque)) return;
    e.preventDefault();
    e.stopPropagation();
    tocado.current = true;
    playerRef.current?.pause();
    datos.current.setSeleccion({ pista: 'subtitulos', id: bloque });
    const solo = Boolean(s.soloEste);
    const propio = (solo && s.porBloque?.[bloque]) || {};
    const l = lienzo.getBoundingClientRect();
    const piso = s.piso ?? 0.04;
    const inicio = { cx: e.clientX, cy: e.clientY, altura: Math.max(piso, propio.altura ?? s.altura), lado: propio.lado ?? s.lado ?? 0 };
    const grupo = `arrastrar-sub-${bloque}-${Date.now()}`;
    let movio = false;
    lienzo.classList.add('es-arrastrando');
    const mover = (ev) => {
      const dx = ev.clientX - inicio.cx;
      const dy = ev.clientY - inicio.cy;
      if (!movio && Math.hypot(dx, dy) < 3) return;
      movio = true;
      // la altura se cuenta desde abajo: bajar el mouse la achica
      const cambios = { altura: r3(entre(inicio.altura - dy / l.height, piso, 0.78)), lado: r3(entre(inicio.lado + dx / l.width, -0.35, 0.35)) };
      datos.current.moverSubtitulo(solo ? bloque : null, cambios, { etiqueta: solo ? `Mover el subtítulo ${bloque + 1}` : 'Mover los subtítulos', grupo });
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      lienzo.classList.remove('es-arrastrando');
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
  }
  const arrastrarSubRef = useRef(arrastrarSubtitulo);
  arrastrarSubRef.current = arrastrarSubtitulo;

  return useMemo(
    () => ({
      onPointerDownCapture: (e) => {
        tocado.current = false;
        if (e.button !== 0) return;
        const lienzo = lienzoRef.current;
        const el = capaEn(lienzo, e.clientX, e.clientY);
        if (!el) return;
        const id = el.dataset.capa;
        if (id.startsWith('sub:')) return arrastrarSubRef.current(e, lienzo, Number(id.slice(4)));
        const x = datos.current.textos.find((t) => t.id === id && !t.fijo);
        if (!x) return;
        // es nuestro: el Player no lo toma (ni pausa ni reproduce)
        e.preventDefault();
        e.stopPropagation();
        tocado.current = true;
        playerRef.current?.pause();
        datos.current.setSeleccion({ pista: 'textos', id });

        const imagen = Boolean(x.archivo);
        const est = imagen ? x.imagenEstilo || {} : x.estilo || {};
        const l = lienzo.getBoundingClientRect();
        const caja = el.getBoundingClientRect();
        // lo que el texto se puede correr a lo ancho (el espacio libre dentro del margen de 4 % a cada lado)
        const libre = Math.max(1, l.width * 0.92 - caja.width);
        const inicio = { cx: e.clientX, cy: e.clientY, x: est.x ?? 0.5, y: est.y ?? (imagen ? 0.42 : 0.17) };
        const grupo = `arrastrar-${id}-${Date.now()}`;
        let movio = false;
        const objetivo = e.target;
        try {
          objetivo.setPointerCapture?.(e.pointerId);
        } catch {
          // sin captura igual funciona mientras el puntero siga sobre la ventana
        }
        lienzo.classList.add('es-arrastrando');

        const mover = (ev) => {
          const dx = ev.clientX - inicio.cx;
          const dy = ev.clientY - inicio.cy;
          if (!movio && Math.hypot(dx, dy) < 3) return;
          movio = true;
          const cambios = imagen
            ? { x: r3(entre(inicio.x + dx / l.width, 0, 1)), y: r3(entre(inicio.y + dy / l.height, 0, 1)) }
            : { x: r3(entre(inicio.x + (0.6 * dx) / libre, 0.2, 0.8)), y: r3(entre(inicio.y + dy / l.height, 0.05, 0.85)) };
          datos.current.ajustar(id, cambios, { etiqueta: imagen ? 'Mover la imagen' : 'Mover el texto', grupo });
        };
        const soltar = () => {
          window.removeEventListener('pointermove', mover);
          window.removeEventListener('pointerup', soltar);
          window.removeEventListener('pointercancel', soltar);
          lienzo.classList.remove('es-arrastrando');
        };
        window.addEventListener('pointermove', mover);
        window.addEventListener('pointerup', soltar);
        window.addEventListener('pointercancel', soltar);
      },
      // el clic que sigue a tocar un texto o una imagen no pausa ni reproduce
      onClickCapture: (e) => {
        if (!tocado.current) return;
        tocado.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
      // la manito de mover cuando se pasa por encima de uno
      onPointerMove: (e) => {
        const lienzo = lienzoRef.current;
        if (!lienzo || lienzo.classList.contains('es-arrastrando')) return;
        const el = capaEn(lienzo, e.clientX, e.clientY);
        lienzo.classList.toggle('sobre-capa', Boolean(el && sirve(el.dataset.capa, datos.current.textos)));
      },
      onPointerLeave: () => lienzoRef.current?.classList.remove('sobre-capa'),
    }),
    [lienzoRef, playerRef]
  );
}
