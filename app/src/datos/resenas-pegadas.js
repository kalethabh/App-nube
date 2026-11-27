// (2026-11-27h) «Pegar varias reseñas»: una por línea, «Nombre | Ciudad | Estrellas | Texto» (también con tabulaciones,
// como sale de Excel, o con punto y coma). Las estrellas pueden ser un número (1-5) o ★★★★★. Sin ciudad o sin estrellas
// también sirve: «Nombre | Texto». Devuelve [{ nombre, ciudad, estrellas, texto }] (las líneas sin nombre o sin texto, fuera).
export function resenasPegadas(texto) {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\s*(?:\||\t|;)\s*/).map((x) => x.trim()))
    .map((p) => {
      const esEstrellas = (x) => /^([1-5](?:[.,]\d)?|★{1,5})$/.test(x || '');
      const nombre = p[0] || '';
      let ciudad = '';
      let estrellas = 5;
      let resto = p.slice(1);
      if (resto.length >= 3) {
        ciudad = resto[0];
        resto = resto.slice(1);
      }
      if (resto.length >= 2 && esEstrellas(resto[0])) {
        estrellas = /★/.test(resto[0]) ? resto[0].length : Math.round(Number(resto[0].replace(',', '.')));
        resto = resto.slice(1);
      } else if (resto.length >= 2 && !ciudad) {
        ciudad = resto[0];
        resto = resto.slice(1);
      }
      const texto = resto.join(' ').trim();
      return { nombre: nombre.slice(0, 60), ciudad: ciudad.slice(0, 40), estrellas: Math.min(5, Math.max(1, estrellas || 5)), texto: texto.slice(0, 700) };
    })
    .filter((r) => r.nombre && r.texto.length >= 8);
}
