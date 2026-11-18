// ¿La app estuvo OCUPADA? (2026-11-18). Mide cada medio segundo cuánto se atrasa el reloj del servidor: si algo pesado
// corre sin soltar (un cálculo largo, una lectura enorme), todo lo demás espera, y una consulta a ElevenLabs o kie que
// ya llegó vence por tiempo aunque el servicio contestó rápido. Con esto el error lo dice y la consola lo anota.
//
//   ocupadaDesde(t)   -> los ms que estuvo ocupada (el atraso más grande) desde el instante t (Date.now())
const PASO = 500;
const registro = []; // [{ t, atraso }] de los últimos 3 minutos
let ultimo = Date.now();
const reloj = setInterval(() => {
  const ahora = Date.now();
  const atraso = Math.max(0, ahora - ultimo - PASO);
  ultimo = ahora;
  if (atraso > 50) registro.push({ t: ahora, atraso });
  while (registro.length && ahora - registro[0].t > 180000) registro.shift();
  if (atraso > 2000) console.warn(`[app] estuvo ocupada ${(atraso / 1000).toFixed(1)} s sin responder`);
}, PASO);
reloj.unref?.();

export function ocupadaDesde(t) {
  return registro.filter((x) => x.t >= t).reduce((m, x) => Math.max(m, x.atraso), 0);
}
