// Quien hace las imagenes de los anuncios de imagen: tu suscripcion de ChatGPT (Codex, sin costo por imagen) o kie.ai
// (GPT Image 2.5, se paga por imagen). Por defecto ChatGPT; kie queda como opcion apagada.
//
// La eleccion se guarda en app/config.json con la clave `motorImagenes` ('chatgpt' | 'kie'). Es aparte de la IA que
// escribe (motor-ia.js: Claude o ChatGPT): se puede escribir con Claude y hacer las imagenes con ChatGPT.
// En modo prueba siempre kie (el falso): nunca se gasta el uso de la cuenta de ChatGPT en una prueba.
//
//   motorDeImagenes()               -> 'chatgpt' | 'kie'
//   elegirMotorDeImagenes(id)       -> 'chatgpt' | 'kie'   (tira ErrorApp 400 si no es ninguno)
//   codexParaImagenes()             -> { cmd, pre, home, trabajo } | null   (lo que necesita produccion/chatgpt-imagen.js)
//   entornoParaImagenes()           -> { AIA_CHATGPT_IMAGENES } para el proceso del motor
import path from 'node:path';
import { leerConfig, guardarConfig } from './config.js';
import { modoPrueba } from './modo-prueba.js';
import { resolverCodex, carpetasCodex } from './codex-rutas.js';
import { ErrorApp } from './productos.js';

export const MOTORES_IMAGEN = Object.freeze({
  chatgpt: Object.freeze({ id: 'chatgpt', nombre: 'ChatGPT', texto: 'Con tu suscripción de ChatGPT: sin costo por imagen.' }),
  kie: Object.freeze({ id: 'kie', nombre: 'kie.ai', texto: 'GPT Image 2.5 a 2K en kie.ai: se cobra cada imagen de tu saldo.' }),
});

export function motorDeImagenes() {
  if (modoPrueba()) return 'kie';
  try {
    return leerConfig().motorImagenes === 'kie' ? 'kie' : 'chatgpt';
  } catch {
    return 'chatgpt';
  }
}

export function elegirMotorDeImagenes(id) {
  if (!Object.hasOwn(MOTORES_IMAGEN, id)) throw new ErrorApp(400, 'Elige ChatGPT o kie.ai.');
  guardarConfig({ motorImagenes: id });
  return id;
}

export function codexParaImagenes() {
  const bin = resolverCodex();
  if (!bin) return null;
  const c = carpetasCodex();
  return { cmd: bin.cmd, pre: bin.pre || [], home: c.home, trabajo: path.join(path.dirname(c.trabajo), 'codex-imagenes') };
}

export function entornoParaImagenes() {
  const c = codexParaImagenes();
  return c ? { AIA_CHATGPT_IMAGENES: JSON.stringify(c) } : {};
}
