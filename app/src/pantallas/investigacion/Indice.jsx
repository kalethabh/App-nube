// El ÍNDICE de secciones de la investigación (2026-11-20e, «que se vea mejor»): una barra que queda pegada arriba con
// flechas para pasar de a una, el contador «3 de 14», las secciones en píldoras que se deslizan (la elegida siempre
// centrada), el borde que se desvanece solo del lado donde hay más y los nombres largos recortados (el nombre entero al
// pasar el mouse). Lo usan las dos partes: el mercado (MercadoApp.jsx) y la competencia (Competencia.jsx).
//
//   <Indice titulos={['Resumen', …]} actual={i} onElegir={(k) => …} etiqueta="Secciones de…" />
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Indice({ titulos, actual, onElegir, etiqueta }) {
  const pista = useRef(null);
  const caja = useRef(null);
  const [bordes, setBordes] = useState({ izq: false, der: false });
  const medir = () => {
    const n = pista.current;
    if (!n) return;
    setBordes({ izq: n.scrollLeft > 4, der: n.scrollLeft + n.clientWidth < n.scrollWidth - 4 });
  };
  useEffect(() => {
    const n = pista.current;
    const b = n?.querySelector('.tt-indice__item--activa');
    if (b && n) n.scrollTo({ left: b.offsetLeft - n.offsetLeft - Math.max(4, (n.clientWidth - b.offsetWidth) / 2), behavior: 'smooth' });
    const t = setTimeout(medir, 350);
    return () => clearTimeout(t);
  }, [actual]);
  useEffect(() => {
    medir();
    const ro = new ResizeObserver(medir);
    if (pista.current) ro.observe(pista.current);
    return () => ro.disconnect();
  }, [titulos.length]);
  const elegir = (k) => {
    if (k < 0 || k >= titulos.length) return;
    onElegir(k);
    // si la barra ya está pegada arriba, vuelve al comienzo de la sección
    const arriba = caja.current?.getBoundingClientRect().top ?? 999;
    if (arriba < 80) caja.current?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <nav ref={caja} className={`tt-indice${bordes.izq ? ' tt-indice--izq' : ''}${bordes.der ? ' tt-indice--der' : ''}`} aria-label={etiqueta}>
      <button type="button" className="tt-indice__flecha" onClick={() => elegir(actual - 1)} disabled={actual <= 0} aria-label="Sección anterior">
        <ChevronLeft size={16} />
      </button>
      <div ref={pista} className="tt-indice__pista" onScroll={medir}>
        {titulos.map((t, k) => (
          <button key={k} type="button" className={`tt-indice__item${k === actual ? ' tt-indice__item--activa' : ''}${k < actual ? ' tt-indice__item--vista' : ''}`} onClick={() => elegir(k)} aria-current={k === actual ? 'step' : undefined} title={t}>
            <b>{k + 1}</b>
            <span>{t}</span>
          </button>
        ))}
      </div>
      <span className="tt-indice__cuenta" aria-hidden="true">
        {actual + 1}/{titulos.length}
      </span>
      <button type="button" className="tt-indice__flecha" onClick={() => elegir(actual + 1)} disabled={actual >= titulos.length - 1} aria-label="Sección siguiente">
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
