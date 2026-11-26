// LOS PRECIOS POR PAÍS (2026-11-26a). Pedido: «precio con el separador de miles del país (Colombia: PUNTO)». La oferta que
// escribe el usuario en el formulario («Tratamiento completo x3 139900») sale en el anuncio con el formato de su país
// («$139.900»), y el resto del texto queda letra por letra.
//
//   PAISES                         código -> { nombre, simbolo, miles, decimal }
//   paisDe(texto)                  'Colombia' | 'co' | 'CO' -> 'CO' (o null)
//   formatearPrecio(valor, pais)   139900, 'CO' -> '$139.900'
//   normalizarOferta(texto, pais)  los números de dinero del texto, con el separador del país

export const PAISES = {
  CO: { nombre: 'Colombia', simbolo: '$', miles: '.', decimal: ',' },
  MX: { nombre: 'México', simbolo: '$', miles: ',', decimal: '.' },
  PE: { nombre: 'Perú', simbolo: 'S/ ', miles: ',', decimal: '.' },
  CL: { nombre: 'Chile', simbolo: '$', miles: '.', decimal: ',' },
  EC: { nombre: 'Ecuador', simbolo: '$', miles: ',', decimal: '.' },
  AR: { nombre: 'Argentina', simbolo: '$', miles: '.', decimal: ',' },
  GT: { nombre: 'Guatemala', simbolo: 'Q', miles: ',', decimal: '.' },
  CR: { nombre: 'Costa Rica', simbolo: '₡', miles: '.', decimal: ',' },
  PA: { nombre: 'Panamá', simbolo: '$', miles: ',', decimal: '.' },
  BO: { nombre: 'Bolivia', simbolo: 'Bs ', miles: '.', decimal: ',' },
  PY: { nombre: 'Paraguay', simbolo: '₲', miles: '.', decimal: ',' },
  UY: { nombre: 'Uruguay', simbolo: '$', miles: '.', decimal: ',' },
  DO: { nombre: 'República Dominicana', simbolo: 'RD$', miles: ',', decimal: '.' },
  US: { nombre: 'Estados Unidos', simbolo: '$', miles: ',', decimal: '.' },
  ES: { nombre: 'España', simbolo: '€', miles: '.', decimal: ',' },
};

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** El código del país a partir de lo que haya escrito el usuario (código o nombre). */
export function paisDe(texto) {
  const t = String(texto || '').trim();
  if (!t) return null;
  if (PAISES[t.toUpperCase()]) return t.toUpperCase();
  const n = sinTildes(t);
  for (const [k, v] of Object.entries(PAISES)) if (n.includes(sinTildes(v.nombre))) return k;
  if (/\bmexico\b|\bmx\b/.test(n)) return 'MX';
  return null;
}

const agrupar = (entero, sep) => String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

/** El precio con el símbolo y el separador de miles del país (sin decimales si es entero). */
export function formatearPrecio(valor, pais = 'CO') {
  const p = PAISES[paisDe(pais) || 'CO'];
  const v = Number(valor);
  if (!Number.isFinite(v)) return '';
  const entero = Math.trunc(Math.abs(v));
  const dec = Math.round((Math.abs(v) - entero) * 100);
  return `${v < 0 ? '-' : ''}${p.simbolo}${agrupar(entero, p.miles)}${dec ? `${p.decimal}${String(dec).padStart(2, '0')}` : ''}`;
}

/**
 * Los números de dinero del texto con el separador de miles del país: «139900», «139,900» o «139 900» en Colombia ->
 * «139.900». Solo los que son dinero: con separadores de miles, de 5 cifras o más, o de 4 cifras junto a un símbolo de
 * moneda. Lo demás del texto (palabras, «x3», «2x1», «60 cápsulas») queda igual.
 */
export function normalizarOferta(texto, pais = 'CO') {
  const p = PAISES[paisDe(pais) || 'CO'];
  return String(texto || '').replace(/(\$|S\/\s?|Q|₡|Bs\s?|₲|RD\$|€)?(\d{1,3}(?:[.,\s]\d{3})+(?![\d.,]\d)|\d{4,})(?![\d])/g, (m, simbolo, num) => {
    const limpio = num.replace(/[.,\s]/g, '');
    const conSeparadores = /[.,\s]/.test(num);
    if (!conSeparadores && limpio.length === 4 && !simbolo) return m; // un año, un código: no es dinero
    return `${simbolo || ''}${agrupar(limpio, p.miles)}`;
  });
}

/** Los separadores de miles equivocados para el país en un texto (para la revisión). */
export function separadoresMal(texto, pais = 'CO') {
  const p = PAISES[paisDe(pais) || 'CO'];
  const otro = p.miles === '.' ? ',' : '.';
  return [...String(texto || '').matchAll(new RegExp(`\\d{1,3}(?:\\${otro}\\d{3})+(?!\\d)`, 'g'))].map((m) => m[0]);
}
