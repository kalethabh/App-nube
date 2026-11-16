// Las pruebas de costo estan escritas con los precios de 720p (por ejemplo, Omni 1.2 a 9 creditos por segundo).
// Desde que la app hace los clips en 1080p por defecto (RESOLUCION_VIDEO en config.js), sin esto daban otro precio
// (10 por segundo) y fallaban aunque la app estuviera bien. Se importa PRIMERO, antes que config.js, para que la
// resolucion quede fija sin depender del .env de cada computador. Con RESOLUCION_VIDEO ya puesta, la respeta.
process.env.RESOLUCION_VIDEO ||= '720p';
