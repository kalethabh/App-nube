// Mover con el mouse los textos y las imágenes de la vista previa.
//
// La composición marca cada texto y cada imagen con data-capa="<id>" (AnuncioEditado.jsx). Como el lienzo tiene
// el mismo tamaño que el video (9:16, el Player ocupa todo), su rectángulo es el del cuadro: lo que se arrastra en
// la pantalla se pasa a fracciones del cuadro y se guarda en x / y, igual que los deslizadores del panel.
//   - una imagen: x, y es su centro (0 a 1);
//   - un texto: y es su borde de arriba (0,05 a 0,85) y x su lugar a lo ancho (0,2 a 0,8, ver TextoEnPantalla).
// Tocar uno lo elige (sin pausar ni reproducir el video); el elegido lleva un marco que lo sigue.
import { useEffect, useMemo, useRef } from 'react';

const entre = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (v) => Math.round(v * 1000) / 1000;

/** El texto o la imagen bajo el puntero (el de más arriba), o null. */
function capaEn(lienzo, cx, cy) {
  if (!lienzo) return null;
  const capas = [...lienzo.querySelectorAll('[data-capa]')];
  for (let i = capas.length - 1; i >= 0; i--) {
    const r = capas[i].getBoundingClientRect();
    if (r.width && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return capas[i];
  }
  return null;
}

export function useArrastrarEnVideo({ lienzoRef, marcoRef, playerRef, textos, seleccion, setSeleccion, ajustar }) {
  const datos = useRef({});
  datos.current = { textos, ajustar, setSeleccion };
  const tocado = useRef(false);

  // el marco del elegido: lo sigue en cada cuadro (el texto entra con un pop y se mueve con el video)
  const elegido = seleccion?.pista === 'textos' ? seleccion.id : null;
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
        const r = el.getBoundingClientRect();
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

  return useMemo(
    () => ({
      onPointerDownCapture: (e) => {
        tocado.current = false;
        if (e.button !== 0) return;
        const lienzo = lienzoRef.current;
        const el = capaEn(lienzo, e.clientX, e.clientY);
        if (!el) return;
        const id = el.dataset.capa;
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
        const sirve = el && datos.current.textos.some((t) => t.id === el.dataset.capa && !t.fijo);
        lienzo.classList.toggle('sobre-capa', Boolean(sirve));
      },
      onPointerLeave: () => lienzoRef.current?.classList.remove('sobre-capa'),
    }),
    [lienzoRef, playerRef]
  );
}
