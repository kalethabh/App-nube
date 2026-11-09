// La app en un servidor (deploy): con ANUNCIOS_DOMINIO=<tu dirección> (p. ej. 1-2-3-4.sslip.io) la app también
// atiende pedidos que llegan con ese nombre, a través de Caddy (HTTPS y contraseña, ver deploy/). Sin la variable,
// todo queda como en la Mac: solo 127.0.0.1.
export const DOMINIO = String(process.env.ANUNCIOS_DOMINIO || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
export const EN_SERVIDOR = Boolean(DOMINIO);

/** Los nombres de host que la app acepta (el chequeo contra páginas que se hacen pasar por la app). */
export const hostsPermitidos = (puerto) => new Set([`127.0.0.1:${puerto}`, `localhost:${puerto}`, `[::1]:${puerto}`, ...(DOMINIO ? [DOMINIO, `${DOMINIO}:443`] : [])]);

/** Los orígenes desde los que se aceptan cambios (POST, PUT, DELETE). */
export const origenesPermitidos = (puerto) =>
  new Set([`http://127.0.0.1:${puerto}`, `http://localhost:${puerto}`, `http://[::1]:${puerto}`, ...(DOMINIO ? [`https://${DOMINIO}`] : [])]);
