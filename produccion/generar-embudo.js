// Una sección del embudo, con el mismo modelo/precio de Anuncios de imagen. Sin cascadas ni reintentos pagados.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { RAIZ, cargarEnv } from './config.js';
import { MODELO, RESOLUCION, FONDO } from './imagen-ads.js';
import { generarImagen, subirArchivo } from './kie-client.js';
import { generarConChatGPT, codexDesdeEntorno } from './chatgpt-imagen.js';
const [rel, seccion] = process.argv.slice(2);
const leer = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const imagenValida = (p) => { try { const b = fs.readFileSync(p); return b.length > 24 && b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && b.subarray(-8).toString('hex') === '49454e44ae426082'; } catch { return false; } };
const escribir = (p, v) => { const tmp = `${p}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(v, null, 2)); fs.renameSync(tmp, p); };
// Exclusión entre procesos, incluso si la app se reinicia mientras termina una subida.
function marcarSolicitud(marca) {
  try { fs.writeFileSync(marca, JSON.stringify({inicio:new Date().toISOString()}), {flag:'wx'}); }
  catch(e) { if(e.code==='EEXIST') throw new Error('La solicitud anterior no dejó un resultado verificable. No se pide otra imagen automáticamente.'); throw e; }
}
function normalizar(destino,job,seccion) {
  if(!job.visualPorSeccion || seccion==='avatar') return;
  const alto=seccion==='hero'?1920:1350;
  const fondo=/^#[a-f0-9]{6}$/i.test(job.fondo || '')?job.fondo:'#FFFFFF';
  const temporal=destino.replace(/\.png$/,'.normalizada.png');
  // No recorta contenido: ajusta al lienzo común y deja dos bordes limpios de 8 px para unir las piezas.
  execFileSync(process.env.FFMPEG_BIN || 'ffmpeg',['-v','error','-y','-filter_threads','1','-i',destino,'-vf',`scale=1080:${alto}:force_original_aspect_ratio=decrease,pad=1080:${alto}:(ow-iw)/2:(oh-ih)/2:color=${fondo},drawbox=x=0:y=0:w=iw:h=8:color=${fondo}:t=fill,drawbox=x=0:y=ih-8:w=iw:h=8:color=${fondo}:t=fill,format=rgb24`,'-threads','1','-frames:v','1',temporal],{timeout:60000,stdio:['ignore','ignore','pipe']});
  fs.renameSync(temporal,destino);
}
async function principal() {
  if (!/^temp[\\/]_embudo-e-[a-f0-9]{12}[\\/]trabajos[\\/]j-[a-f0-9]{16}$/.test(rel || '') || !['avatar', 'hero', 'dolor', 'beneficios', 'ingredientes', 'uso'].includes(seccion)) throw new Error('Encargo de embudo inválido.');
  const dir = path.join(RAIZ, rel), proyecto = path.dirname(path.dirname(dir));
  const job = leer(path.join(dir, 'trabajo.json'));
  const p = job?.piezas?.find((p) => p.id === seccion);
  if (!p || !['chatgpt', 'kie'].includes(job.motor) || process.env.EMBUDO_MOTOR !== job.motor) throw new Error('No coincide el motor aprobado.');
  const destino = path.join(dir, `${seccion}.png`), resultado = path.join(dir, `${seccion}.resultado.json`);
  if (leer(resultado)?.ok && imagenValida(destino)) return;
  // Si la descarga terminó antes de cerrarse el proceso, se recupera sin pedir otra imagen.
  if (imagenValida(destino)) { normalizar(destino,job,seccion); escribir(resultado, { ok: true, recuperada: true }); return; }
  if (!/^producto\.(png|jpe?g|webp)$/i.test(job.foto || '')) throw new Error('Foto de producto inválida.');
  const referencias = seccion==='avatar' ? [] : [path.join(dir, job.foto)];
  const roles = seccion==='avatar' ? [] : ['real product photograph'];
  if (p.anterior) {
    if (!/^trabajos\/j-[a-f0-9]{16}\/(hero|dolor|beneficios|ingredientes|uso)\.png$/.test(p.anterior)) throw new Error('Imagen anterior inválida.');
    referencias.push(path.join(proyecto, p.anterior)); roles.push('previous section image to edit');
  }
  if(job.usarAvatar && (job.visualPorSeccion ? seccion==='hero' && p.visual==='persona' : !['avatar','ingredientes'].includes(seccion))) {
    if(!/^avatar(?:-base)?\.(png|jpe?g|webp)$/i.test(job.avatarArchivo || '') || !fs.existsSync(path.join(dir,job.avatarArchivo))) throw new Error('El avatar aprobado todavía no está listo.');
    referencias.push(path.join(dir,job.avatarArchivo)); roles.push('approved avatar identity: preserve this exact face and character, do not invent another person');
  }
  // Los encargos anteriores conservan exactamente sus referencias y texto para retomar la misma tarea.
  // El hero NUEVO, cuando existe, aporta identidad de marca a las otras secciones, no una plantilla ajena.
  const hero = path.join(dir, 'hero.png');
  if (!job.visualPorSeccion && !['hero','avatar'].includes(seccion) && !p.anterior && leer(path.join(dir, 'hero.resultado.json'))?.ok && fs.existsSync(hero)) { referencias.push(hero); roles.push('generated hero for brand/style consistency ONLY; not its layout, text or pose'); }
  const personaAnterior = seccion==='avatar' ? '' : job.usarAvatar && seccion!=='ingredientes' ? 'Use ONLY the approved avatar identity whenever a person is shown. For hero, pain and benefits sections show this avatar as a relevant main figure. For usage include the avatar when demonstrating the documented application is appropriate. The approved avatar overrides any different face in an older section. Preserve facial identity; vary pose, action and composition for this section. No additional unidentified people.' : 'NO HUMAN PEOPLE OR FACES. Use product, component or contextual still-life visuals only.';
  const persona = !job.visualPorSeccion ? personaAnterior : seccion==='avatar' ? '' : seccion==='hero' && p.visual==='persona' && !job.usarAvatar ? 'NO HUMAN PEOPLE OR FACES. Use the real product and objects only; the user selected no avatar.' : seccion==='hero' && p.visual==='persona' && job.usarAvatar ? 'Use the approved avatar identity for this Hero only.' : 'No recurring avatar or portrait. Follow the section-specific visual direction; an educational anatomy illustration or close-up hands is allowed when relevant.';
  const prompt = `${p.prompt}\nREFERENCE ORDER: ${JSON.stringify(roles.map((r,i)=>`${i+1}: ${r}`))}. ${persona}`;
  const aspecto=seccion==='avatar'?'1:1':p.formato || job.formato;
  if (job.motor === 'chatgpt') {
    const codex = codexDesdeEntorno();
    if (!codex) throw new Error('CHATGPT_SIN_SESION');
    // Sin respaldo pagado en kie.ai. Una respuesta incierta nunca provoca otra llamada automática.
    const marca = path.join(dir, `${seccion}.solicitada.json`);
    if (leer(marca)) throw new Error('La solicitud anterior no dejó resultado verificable. Revisa antes de pedir una generación nueva.');
    marcarSolicitud(marca);
    const r = await generarConChatGPT({ prompt, referencias, aspecto, rutaDestino: destino, codex });
    if (!imagenValida(destino)) throw new Error('El proveedor no devolvió una imagen PNG válida.');
    normalizar(destino,job,seccion);
    escribir(resultado, { ok: true, motor: job.motor, creditos: 0, modelo: r.modeloReal || 'ChatGPT' });
  } else {
    cargarEnv();
    const urls = [];
    for (const f of referencias) urls.push(await subirArchivo(f));
    const huella = crypto.createHash('sha256').update(prompt + aspecto + referencias.map((f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')).join('')).digest('hex');
    const marca = path.join(dir, `${seccion}.solicitada.json`);
    const r = await generarImagen({ modelo: MODELO, resolucion: RESOLUCION, fondo: FONDO, prompt, imagenesReferencia: urls, aspectRatio: aspecto, rutaDestino: destino, huella,
      antesDeCrear: async () => {
        if (leer(marca)) throw new Error('La tarea anterior no puede retomarse con seguridad. No se pide otra automáticamente.');
        marcarSolicitud(marca);
      },
    });
    if (!imagenValida(destino)) throw new Error('El proveedor no devolvió una imagen PNG válida.');
    normalizar(destino,job,seccion);
    escribir(resultado, { ok: true, motor: job.motor, creditos: r.creditos ?? null, taskId: r.taskId || null, modelo: r.modeloReal || MODELO });
  }
  if (!fs.existsSync(destino) || fs.statSync(destino).size < 24) throw new Error('El proveedor no devolvió una imagen.');
}
principal().catch((e) => { console.error(e.message); process.exitCode = 1; });
