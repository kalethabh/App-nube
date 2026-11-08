// Un lector de Markdown chico, sin dependencias, para los aprendizajes: títulos, listas, párrafos, **negrita**,
// `código`, tablas y bloques de código. Nada de HTML crudo: todo pasa como texto.
import { Fragment } from 'react';

function enLinea(texto, clave = '') {
  const partes = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let ultimo = 0;
  let m;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const t = m[0];
    partes.push(t.startsWith('**') ? <strong key={`${clave}b${i++}`}>{t.slice(2, -2)}</strong> : <code key={`${clave}c${i++}`}>{t.slice(1, -1)}</code>);
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export function Markdown({ texto = '' }) {
  const lineas = String(texto).replace(/\r/g, '').split('\n');
  const bloques = [];
  for (let i = 0; i < lineas.length; ) {
    const l = lineas[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    if (l.startsWith('```')) {
      const cuerpo = [];
      i++;
      while (i < lineas.length && !lineas[i].startsWith('```')) cuerpo.push(lineas[i++]);
      i++;
      bloques.push(<pre key={i}>{cuerpo.join('\n')}</pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      const N = `h${Math.min(6, h[1].length + 2)}`;
      bloques.push(<N key={i}>{enLinea(h[2], i)}</N>);
      i++;
      continue;
    }
    if (l.trim().startsWith('|')) {
      const filas = [];
      while (i < lineas.length && lineas[i].trim().startsWith('|')) filas.push(lineas[i++]);
      const celdas = filas.filter((f) => !/^\s*\|[\s:|-]+\|\s*$/.test(f)).map((f) => f.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      const [cab, ...resto] = celdas;
      bloques.push(
        <div className="md-tabla" key={i}>
          <table>
            <thead>
              <tr>{cab.map((c, j) => <th key={j}>{enLinea(c, `${i}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {resto.map((f, k) => (
                <tr key={k}>{f.map((c, j) => <td key={j}>{enLinea(c, `${i}-${k}-${j}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      const items = [];
      while (i < lineas.length && (/^\s*[-*]\s+/.test(lineas[i]) || (lineas[i].startsWith('  ') && lineas[i].trim() && items.length))) {
        if (/^\s*[-*]\s+/.test(lineas[i])) items.push(lineas[i].replace(/^\s*[-*]\s+/, ''));
        else items[items.length - 1] += ` ${lineas[i].trim()}`;
        i++;
      }
      bloques.push(
        <ul key={i}>
          {items.map((t, k) => (
            <li key={k}>{enLinea(t, `${i}-${k}`)}</li>
          ))}
        </ul>
      );
      continue;
    }
    const parrafo = [];
    while (i < lineas.length && lineas[i].trim() && !/^(#|```|\s*[-*]\s+|\s*\|)/.test(lineas[i])) parrafo.push(lineas[i++]);
    bloques.push(<p key={i}>{enLinea(parrafo.join(' '), i)}</p>);
  }
  return <div className="md">{bloques.map((b, k) => <Fragment key={k}>{b}</Fragment>)}</div>;
}
