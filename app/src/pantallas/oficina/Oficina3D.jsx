// La OFICINA EN 3D. 2026-11-19q: hecha desde cero en Three.js. 2026-11-19r: con el DISEÑO que mandó el usuario (una
// imagen de referencia): una planta abierta de noche con piso de madera cálida, el logo K al centro sobre una jardinera
// con luz verde lima, líneas de neón lima en el piso, paredes gris oscuro con molduras de luz, y alrededor: la sala de
// reuniones de vidrio con la pared de listones y el logo (coordinación), la biblioteca con los escritorios (guiones),
// el taller de arte, la pared de datos con el mapa y las gráficas (investigación), el estudio de video con la pantalla
// grande, el aro de luz y la cámara (producción), la zona de revisión con su globo de chat (calidad), la oficina de
// vidrio (edición), la barra de café con taburetes y la sala de estar con el sofá, los sillones verdes y la mesa
// redonda. Plantas por todas partes.
// Los agentes trabajan sentados escribiendo, caminan cuando están libres (a veces al café o al sofá) y saludan con una
// alerta roja cuando te necesitan. Detalles vivos: pantallas, la pared de datos, el vapor del café, el robot aspiradora,
// los paquetes de luz que la coordinadora reparte, el reloj con la hora real y el logo que respira.
// Los nombres y lo que hace cada uno van en etiquetas HTML (CSS2D) encima de cada agente: se leen nítidas y se tocan.
//
//   <Oficina3D agentes={[{ id, nombre, avatar, color, estado, ahora, necesita }]} elegido={id} onElegir={(id) => …} />
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const LIMA = '#a3e635';
const ANCHO = 38; // la planta (x); el fondo (z) crece si se usa la fila nueva (lugares 9-12)
// los LUGARES de la planta (los mismos números que lib/oficina.js): centro (x, z), ancho y fondo
const LUGAR = [
  { x: -14.1, z: -10.6, w: 9.2, d: 8.4 },
  { x: -4.7, z: -10.6, w: 9.2, d: 8.4 },
  { x: 4.7, z: -10.6, w: 9.2, d: 8.4 },
  { x: 14.1, z: -10.6, w: 9.2, d: 8.4 },
  { x: -14.1, z: 1.4, w: 9.2, d: 8 },
  { x: 14.1, z: 1.4, w: 9.2, d: 8 },
  { x: -14.1, z: 11.2, w: 9.2, d: 7 },
  { x: 0, z: 11, w: 12, d: 8 },
  { x: 14.1, z: 11.2, w: 9.2, d: 7 },
  { x: -14.1, z: 20.6, w: 9.2, d: 8 },
  { x: -4.7, z: 20.6, w: 9.2, d: 8 },
  { x: 4.7, z: 20.6, w: 9.2, d: 8 },
  { x: 14.1, z: 20.6, w: 9.2, d: 8 },
];
// cómo se arma cada tipo de sala (las que crea el usuario usan el mobiliario de una de siempre)
// las de siempre, por si la pantalla todavía no trajo el diseño guardado
const ZONAS_DE_SIEMPRE = [
  ['coordinacion', 0], ['guion', 1], ['arte', 2], ['investigacion', 3], ['video', 4], ['calidad', 5], ['cafe', 6], ['sala', 7], ['edicion', 8],
].map(([id, lugar]) => ({ id, tipo: id, lugar, agente: !['cafe', 'sala'].includes(id) }));
const ARMADO = { escritorios: 'calidad', creativos: 'arte', estudio: 'video', reuniones: 'coordinacion', datos: 'investigacion', biblioteca: 'guion', vidrio: 'edicion' };
const PIELES = ['#f1c7a3', '#d9a17a', '#a8714a', '#7a4b2c', '#f5d5b8', '#c68b5e', '#e3b08a'];
const PELOS = ['#2b1d16', '#5a3a22', '#111111', '#8a5a2b', '#c9a15a', '#3b2a20', '#6b4423'];

// ---------------------------------------------------------------- texturas dibujadas a mano (canvas)

function lienzo(w, h, dibujar) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** El piso de madera cálida: tablas largas con vetas, para toda la planta. */
function texturaMadera() {
  const t = lienzo(1024, 1024, (g, w, h) => {
    g.fillStyle = '#b9824f';
    g.fillRect(0, 0, w, h);
    const alto = 42;
    for (let y = 0; y < h; y += alto) {
      for (let x = -Math.random() * 300; x < w; x += 300 + Math.random() * 120) {
        const largo = 300 + Math.random() * 120;
        const tono = 150 + Math.floor(Math.random() * 40);
        g.fillStyle = `rgb(${tono + 30},${tono - 20},${tono - 75})`;
        g.fillRect(x + 1, y + 1, largo - 2, alto - 2);
        g.strokeStyle = 'rgba(70,40,15,0.18)';
        g.lineWidth = 2;
        for (let v = 0; v < 3; v++) {
          g.beginPath();
          const yy = y + 8 + Math.random() * (alto - 16);
          g.moveTo(x + 6, yy);
          g.bezierCurveTo(x + largo * 0.3, yy + (Math.random() - 0.5) * 8, x + largo * 0.6, yy + (Math.random() - 0.5) * 8, x + largo - 6, yy);
          g.stroke();
        }
        g.fillStyle = 'rgba(40,20,5,0.35)';
        g.fillRect(x, y, 2, alto);
      }
      g.fillStyle = 'rgba(40,20,5,0.4)';
      g.fillRect(0, y, w, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3.2, 2.6);
  return t;
}

/** El logo K de Kads: cuadrado oscuro redondeado, la K y el punto en verde lima. */
function texturaLogo({ fondo = '#0d0f0c' } = {}) {
  return lienzo(512, 512, (g, w, h) => {
    g.fillStyle = fondo;
    g.beginPath();
    g.roundRect(0, 0, w, h, 96);
    g.fill();
    g.strokeStyle = LIMA;
    g.lineWidth = 14;
    g.shadowColor = LIMA;
    g.shadowBlur = 30;
    g.beginPath();
    g.roundRect(18, 18, w - 36, h - 36, 80);
    g.stroke();
    g.fillStyle = LIMA;
    g.font = '900 330px Inter, Arial Black, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('K', w / 2 - 24, h / 2 + 20);
    g.beginPath();
    g.arc(w / 2 + 118, h / 2 - 118, 30, 0, Math.PI * 2);
    g.fill();
  });
}

/** Un letrero pequeño del departamento (en la pared). */
function texturaLetrero(texto, color) {
  return lienzo(512, 112, (g, w, h) => {
    g.fillStyle = 'rgba(16,18,16,0.94)';
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 22);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = color;
    g.font = '800 50px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.fillText(texto.toUpperCase(), w / 2, h / 2 + 2);
  });
}

/** El globo de chat de la zona de revisión (un ícono propio: globo verde con un visto). */
function texturaChat() {
  return lienzo(256, 256, (g) => {
    g.fillStyle = '#16a34a';
    g.beginPath();
    g.roundRect(8, 8, 240, 240, 54);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(128, 118, 80, 66, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(70, 160);
    g.lineTo(56, 206);
    g.lineTo(104, 176);
    g.fill();
    g.strokeStyle = '#16a34a';
    g.lineWidth = 18;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(92, 120);
    g.lineTo(118, 146);
    g.lineTo(166, 96);
    g.stroke();
  });
}

/** Una pantalla que cambia: código, onda, barras, imágenes, video o la pared de datos (mapa + gráficas). */
function pantallaViva(tipo, color, { w = 256, h = 160 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  let fase = Math.random() * 10;
  // el mapa de puntos de la pared de datos (continentes aproximados)
  const puntos = [];
  if (tipo === 'datos') {
    const manchas = [[0.2, 0.32, 0.1, 0.12], [0.27, 0.62, 0.05, 0.13], [0.48, 0.3, 0.05, 0.07], [0.5, 0.55, 0.06, 0.13], [0.66, 0.33, 0.13, 0.1], [0.78, 0.68, 0.05, 0.05]];
    for (const [cx, cy, rx, ry] of manchas) for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      puntos.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
    }
  }
  const dibujar = (activa) => {
    fase += 1;
    g.fillStyle = activa ? '#0c1410' : '#0a0d0b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.strokeStyle = color;
    g.globalAlpha = activa ? 1 : 0.45;
    if (tipo === 'datos') {
      // a la izquierda dos medidores, al medio el mapa, a la derecha la línea y las barras que suben
      for (let i = 0; i < 2; i++) {
        const cx = w * 0.09;
        const cy = h * (0.3 + i * 0.4);
        g.lineWidth = 8;
        g.globalAlpha = 0.2;
        g.beginPath();
        g.arc(cx, cy, h * 0.12, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = activa ? 1 : 0.5;
        g.beginPath();
        g.arc(cx, cy, h * 0.12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (0.55 + 0.3 * Math.sin(fase / 20 + i)));
        g.stroke();
      }
      g.fillStyle = '#5b6b62';
      for (const [px, py] of puntos) g.fillRect(w * (0.18 + px * 0.45), h * py, 3, 3);
      g.fillStyle = color;
      for (let i = 0; i < 4; i++) {
        const [px, py] = puntos[(i * 61 + Math.floor(fase / 8)) % puntos.length];
        g.globalAlpha = 0.5 + 0.5 * Math.sin(fase / 4 + i);
        g.beginPath();
        g.arc(w * (0.18 + px * 0.45), h * py, 5, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = activa ? 1 : 0.5;
      g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i <= 20; i++) g.lineTo(w * (0.68 + i * 0.015), h * (0.45 - i * 0.012 - Math.sin(i * 1.3 + fase / 6) * 0.04));
      g.stroke();
      for (let i = 0; i < 10; i++) g.fillRect(w * (0.68 + i * 0.03), h * 0.92, w * 0.018, -h * (0.12 + i * 0.03 + Math.sin(i + fase / 5) * 0.03));
    } else if (tipo === 'video') {
      // un clip en el visor (cielo, sol, una figura) y la línea de tiempo
      const grad = g.createLinearGradient(0, 0, 0, h * 0.7);
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(1, '#7c3aed');
      g.globalAlpha = activa ? 1 : 0.6;
      g.fillStyle = grad;
      g.fillRect(w * 0.06, h * 0.06, w * 0.62, h * 0.62);
      g.fillStyle = '#fde68a';
      g.beginPath();
      g.arc(w * 0.37, h * 0.4, h * 0.08, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1f2937';
      g.fillRect(w * 0.06, h * 0.52, w * 0.62, h * 0.16);
      g.fillRect(w * (0.3 + Math.sin(fase / 20) * 0.08), h * 0.36, w * 0.025, h * 0.18);
      g.fillStyle = '#334155';
      for (let i = 0; i < 6; i++) g.fillRect(w * 0.72, h * (0.08 + i * 0.1), w * 0.22, h * 0.07);
      g.fillStyle = color;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 8; j++) g.fillRect(w * (0.06 + j * 0.075), h * (0.76 + i * 0.07), w * 0.065, h * 0.05);
      g.fillStyle = '#ef4444';
      g.fillRect(w * (0.06 + ((fase / 3) % 100) / 100 * 0.6), h * 0.72, 2, h * 0.25);
    } else if (tipo === 'onda') {
      g.lineWidth = 3;
      g.beginPath();
      for (let x = 0; x < w; x += 4) g.lineTo(x, h / 2 + Math.sin(x / 14 + fase / 3) * (activa ? h * 0.22 : 8) * Math.sin(x / 70 + fase / 9));
      g.stroke();
      g.fillRect(20, h - 20, (w - 40) * ((fase % 60) / 60), 5);
    } else if (tipo === 'barras') {
      for (let i = 0; i < 12; i++) g.fillRect(14 + i * ((w - 28) / 12), h - 20, (w - 28) / 12 - 8, -((Math.sin(i + fase / 4) + 1.2) * (activa ? h * 0.3 : 12)));
    } else if (tipo === 'imagen') {
      for (let i = 0; i < 6; i++) {
        g.globalAlpha = (activa ? 0.9 : 0.3) * (0.4 + ((i + fase / 6) % 6) / 10);
        g.fillRect(14 + (i % 3) * 78, 18 + Math.floor(i / 3) * 66, 70, 58);
      }
    } else {
      for (let i = 0; i < 9; i++) {
        const largo = ((Math.sin(i * 7.3 + Math.floor(fase / 6)) + 1) / 2) * 170 + 30;
        g.fillRect(16 + (i % 3) * 6, 14 + i * 15, activa ? largo : largo * 0.4, 7);
      }
    }
    g.globalAlpha = 1;
    t.needsUpdate = true;
  };
  dibujar(false);
  return { textura: t, dibujar };
}

/** El reloj de la pared, con la hora real. */
function relojVivo() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const dibujar = () => {
    const d = new Date();
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#111411';
    g.beginPath();
    g.arc(128, 128, 120, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = LIMA;
    g.stroke();
    g.fillStyle = '#e5e7eb';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillRect(128 + Math.sin(a) * 96 - 4, 128 - Math.cos(a) * 96 - 4, 8, 8);
    }
    const aguja = (frac, largo, ancho, color) => {
      const a = frac * Math.PI * 2;
      g.strokeStyle = color;
      g.lineWidth = ancho;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(128 + Math.sin(a) * largo, 128 - Math.cos(a) * largo);
      g.stroke();
    };
    aguja(((d.getHours() % 12) + d.getMinutes() / 60) / 12, 56, 10, '#f8fafc');
    aguja((d.getMinutes() + d.getSeconds() / 60) / 60, 84, 7, '#f8fafc');
    aguja(d.getSeconds() / 60, 92, 3, LIMA);
    t.needsUpdate = true;
  };
  dibujar();
  return { textura: t, dibujar };
}

// ---------------------------------------------------------------- piezas

const materiales = new Map();
function mat(color, { emisivo = null, intensidad = 1, rugoso = 0.75, metal = 0.05, opacidad = 1 } = {}) {
  const k = `${color}|${emisivo}|${intensidad}|${rugoso}|${metal}|${opacidad}`;
  if (!materiales.has(k)) {
    materiales.set(
      k,
      new THREE.MeshStandardMaterial({ color, roughness: rugoso, metalness: metal, ...(emisivo ? { emissive: emisivo, emissiveIntensity: intensidad } : {}), ...(opacidad < 1 ? { transparent: true, opacity: opacidad, depthWrite: false } : {}) })
    );
  }
  return materiales.get(k);
}
const neon = () => mat(LIMA, { emisivo: LIMA, intensidad: 2.2, rugoso: 0.4 });
const MADERA = () => mat('#a8703f', { rugoso: 0.6 });
const OSCURO = () => mat('#2b2d2f', { rugoso: 0.85 });
const NEGRO = () => mat('#141516', { rugoso: 0.5, metal: 0.3 });

function caja(w, h, d, material, x = 0, y = 0, z = 0, { redondo = 0, sombra = true } = {}) {
  const geo = redondo ? new RoundedBoxGeometry(w, h, d, 3, redondo) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
}
function cilindro(rArriba, rAbajo, h, material, x = 0, y = 0, z = 0, lados = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rArriba, rAbajo, h, lados), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Un rectángulo redondeado (forma de Three). */
function rectRedondo(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/** Una línea de neón en el piso: el contorno de un rectángulo redondeado. */
function lineaNeon(w, d, r = 1.2, grosor = 0.09, color = LIMA) {
  const s = rectRedondo(w, d, r);
  s.holes.push(rectRedondo(w - grosor * 2, d - grosor * 2, Math.max(0.05, r - grosor)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 24), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.025;
  return m;
}
/** Un tapete gris (rectangular o redondo). */
function tapete(w, d, { redondo = false, color = '#3a3c3f' } = {}) {
  const m = new THREE.Mesh(redondo ? new THREE.CircleGeometry(w / 2, 64) : new THREE.ShapeGeometry(rectRedondo(w, d, 0.3), 8), mat(color, { rugoso: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  m.receiveShadow = true;
  return m;
}

/** Una planta en su matera blanca: hojas largas que se abren (como las de la imagen). */
function planta(x, z, escala = 1) {
  const g = new THREE.Group();
  g.add(cilindro(0.3, 0.24, 0.55, mat('#ece7de', { rugoso: 0.45 }), 0, 0.28, 0));
  g.add(cilindro(0.27, 0.27, 0.04, mat('#3b2a1e', { rugoso: 1 }), 0, 0.54, 0));
  const tonos = [mat('#3f8f3a', { rugoso: 0.8 }), mat('#4fa443', { rugoso: 0.8 }), mat('#2f7a35', { rugoso: 0.8 })];
  const hoja = new THREE.SphereGeometry(0.17, 10, 8);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
    const alto = 0.6 + Math.random() * 0.9;
    const h = new THREE.Mesh(hoja, tonos[i % 3]);
    h.scale.set(0.9, 0.25, 2.6);
    h.position.set(Math.cos(a) * (0.18 + alto * 0.18), 0.55 + alto * 0.7, Math.sin(a) * (0.18 + alto * 0.18));
    h.rotation.set(-0.5 - Math.random() * 0.5, -a + Math.PI / 2, 0);
    h.castShadow = true;
    g.add(h);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(escala);
  g.userData.balanceo = Math.random() * 6;
  return g;
}

function silla(color = '#1d1f22') {
  const g = new THREE.Group();
  g.add(cilindro(0.05, 0.05, 0.45, mat('#3f4246', { metal: 0.6, rugoso: 0.4 }), 0, 0.25, 0, 10));
  g.add(cilindro(0.34, 0.34, 0.05, mat('#18191b', { metal: 0.5 }), 0, 0.03, 0, 5));
  g.add(caja(0.62, 0.1, 0.58, mat(color, { rugoso: 0.6 }), 0, 0.5, 0, { redondo: 0.04 }));
  g.add(caja(0.6, 0.78, 0.09, mat(color, { rugoso: 0.6 }), 0, 0.95, 0.27, { redondo: 0.04 }));
  return g;
}

/** Un escritorio de madera con su monitor vivo, teclado y taza. Mira hacia +z (la silla). */
function escritorio(tipoPantalla, color, pantallas, id, { ancho = 1.9, dobleMonitor = false } = {}) {
  const g = new THREE.Group();
  g.add(caja(ancho, 0.07, 0.95, MADERA(), 0, 0.78, 0, { redondo: 0.025 }));
  g.add(caja(0.06, 0.76, 0.85, NEGRO(), -ancho / 2 + 0.08, 0.38, 0));
  g.add(caja(0.06, 0.76, 0.85, NEGRO(), ancho / 2 - 0.08, 0.38, 0));
  const monitores = dobleMonitor ? [-0.42, 0.42] : [0];
  for (const mx of monitores) {
    const viva = pantallaViva(tipoPantalla, color);
    pantallas.push({ id, viva });
    g.add(caja(0.82, 0.52, 0.05, NEGRO(), mx, 1.3, -0.28, { redondo: 0.015 }));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.46), new THREE.MeshBasicMaterial({ map: viva.textura, toneMapped: false }));
    p.position.set(mx, 1.3, -0.252);
    g.add(p);
    g.add(cilindro(0.03, 0.03, 0.22, NEGRO(), mx, 0.93, -0.3, 8));
    g.add(caja(0.28, 0.02, 0.18, NEGRO(), mx, 0.82, -0.3));
  }
  g.add(caja(0.6, 0.03, 0.2, mat('#d4d4d4', { rugoso: 0.4 }), 0, 0.83, 0.16, { redondo: 0.01 }));
  for (let k = 0; k < 4; k++) g.add(caja(0.54, 0.008, 0.03, mat('#9ca3af'), 0, 0.848, 0.09 + k * 0.045, { sombra: false }));
  g.add(cilindro(0.06, 0.05, 0.13, mat('#f5f5f4', { rugoso: 0.4 }), ancho / 2 - 0.3, 0.88, 0.12, 12));
  // el mouse y su pad, un cuaderno con lápiz, el portalápices y la cajonera
  g.add(caja(0.26, 0.006, 0.22, mat('#1f2937'), 0.48, 0.817, 0.18, { sombra: false }));
  const raton = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), mat('#e5e7eb', { rugoso: 0.3 }));
  raton.scale.set(0.75, 0.45, 1.1);
  raton.position.set(0.48, 0.83, 0.18);
  g.add(raton);
  const libreta = caja(0.24, 0.025, 0.32, mat(['#f59e0b', '#3b82f6', '#ef4444', '#10b981'][Math.floor(Math.random() * 4)], { rugoso: 0.8 }), -ancho / 2 + 0.32, 0.83, 0.12);
  libreta.rotation.y = 0.3;
  g.add(libreta);
  const lapiz = cilindro(0.008, 0.008, 0.18, mat('#facc15'), -ancho / 2 + 0.36, 0.85, 0.1, 6);
  lapiz.rotation.z = Math.PI / 2;
  lapiz.rotation.y = 0.5;
  g.add(lapiz);
  g.add(cilindro(0.045, 0.04, 0.1, NEGRO(), ancho / 2 - 0.15, 0.86, -0.25, 12));
  for (const [dx, c] of [[-0.015, '#ef4444'], [0.015, '#3b82f6'], [0, '#111827']]) g.add(cilindro(0.006, 0.006, 0.16, mat(c), ancho / 2 - 0.15 + dx, 0.93, -0.25 + dx, 6));
  g.add(caja(0.42, 0.6, 0.55, mat('#2a2c2f', { rugoso: 0.6 }), -ancho / 2 + 0.36, 0.3, -0.12, { redondo: 0.02 }));
  for (let k = 0; k < 3; k++) g.add(caja(0.12, 0.02, 0.02, mat('#9ca3af', { metal: 0.8 }), -ancho / 2 + 0.36, 0.48 - k * 0.18, 0.165, { sombra: false }));
  return g;
}

// ---------------------------------------------------------------- detalles (2026-11-19t: «oficinas con más detalle»)

function papelera(x, z) {
  const g = new THREE.Group();
  g.add(cilindro(0.17, 0.13, 0.42, mat('#3f4246', { metal: 0.5, rugoso: 0.4 }), 0, 0.21, 0, 18));
  g.add(caja(0.12, 0.03, 0.1, mat('#f5f5f4'), 0.02, 0.43, 0.02, { sombra: false }));
  g.position.set(x, 0, z);
  return g;
}
function lamparaPie(x, z, color = '#ffcf8a') {
  const g = new THREE.Group();
  g.add(cilindro(0.2, 0.22, 0.04, NEGRO(), 0, 0.02, 0, 20));
  g.add(cilindro(0.02, 0.02, 1.7, NEGRO(), 0, 0.87, 0, 8));
  g.add(cilindro(0.18, 0.28, 0.34, mat('#f5efe3', { emisivo: color, intensidad: 0.9, rugoso: 0.9 }), 0, 1.8, 0, 22));
  const luz = new THREE.PointLight(color, 2.2, 4.5, 2);
  luz.position.y = 1.7;
  g.add(luz);
  g.position.set(x, 0, z);
  return g;
}
/** Un cuadro abstracto en la pared (mira hacia +z; rotY para las paredes de lado). */
function cuadro(w, h, x, y, z, colores, rotY = 0) {
  const g = new THREE.Group();
  g.add(caja(w + 0.08, h + 0.08, 0.04, mat('#e7e1d6', { rugoso: 0.5 }), 0, 0, 0));
  const t = lienzo(256, Math.round((256 * h) / w), (c, W, H) => {
    c.fillStyle = colores[0];
    c.fillRect(0, 0, W, H);
    for (let k = 1; k < colores.length; k++) {
      c.fillStyle = colores[k];
      c.globalAlpha = 0.85;
      c.beginPath();
      if (k % 2) c.arc(W * (0.25 + 0.5 * Math.random()), H * (0.25 + 0.5 * Math.random()), W * (0.12 + 0.15 * Math.random()), 0, Math.PI * 2);
      else c.rect(W * Math.random() * 0.6, H * Math.random() * 0.6, W * 0.4, H * 0.3);
      c.fill();
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
  m.position.z = 0.025;
  g.add(m);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}
function impresora(x, z) {
  const g = new THREE.Group();
  g.add(caja(0.9, 0.7, 0.6, mat('#2a2c2f'), 0, 0.35, 0, { redondo: 0.03 }));
  g.add(caja(0.7, 0.32, 0.5, mat('#e5e7eb', { rugoso: 0.4 }), 0, 0.86, 0, { redondo: 0.04 }));
  g.add(caja(0.5, 0.02, 0.3, mat('#ffffff'), 0, 1.03, 0.08, { sombra: false }));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02), new THREE.MeshBasicMaterial({ color: '#22c55e' }));
  led.position.set(0.28, 0.95, 0.25);
  g.add(led);
  g.position.set(x, 0, z);
  return g;
}
function dispensador(x, z) {
  const g = new THREE.Group();
  g.add(caja(0.42, 1.0, 0.4, mat('#e5e7eb', { rugoso: 0.4 }), 0, 0.5, 0, { redondo: 0.04 }));
  g.add(cilindro(0.17, 0.17, 0.45, mat('#93c5fd', { opacidad: 0.6, rugoso: 0.05 }), 0, 1.25, 0, 20));
  g.add(cilindro(0.06, 0.12, 0.08, mat('#93c5fd', { opacidad: 0.6 }), 0, 1.51, 0, 16));
  g.add(caja(0.05, 0.05, 0.05, mat('#3b82f6'), -0.08, 0.78, 0.21));
  g.add(caja(0.05, 0.05, 0.05, mat('#ef4444'), 0.08, 0.78, 0.21));
  g.position.set(x, 0, z);
  return g;
}
function archivador(x, z, rotY = 0) {
  const g = new THREE.Group();
  g.add(caja(0.5, 1.3, 0.6, mat('#4b5563', { metal: 0.4, rugoso: 0.5 }), 0, 0.65, 0));
  for (let k = 0; k < 4; k++) {
    g.add(caja(0.46, 0.005, 0.01, mat('#1f2937'), 0, 0.33 + k * 0.31, 0.305, { sombra: false }));
    g.add(caja(0.14, 0.03, 0.03, mat('#d1d5db', { metal: 0.8 }), 0, 0.5 + k * 0.31 - 0.1, 0.31));
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}
/** Una pizarra blanca con notas de colores y líneas escritas. */
function pizarraBlanca(w, h, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.add(caja(w, h, 0.05, mat('#f8fafc', { rugoso: 0.25 }), 0, 0, 0));
  g.add(caja(w + 0.06, 0.05, 0.08, mat('#9ca3af', { metal: 0.7 }), 0, -h / 2, 0.04));
  const notas = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74'];
  for (let k = 0; k < 7; k++) {
    const n = caja(0.24, 0.22, 0.01, mat(notas[k % notas.length], { rugoso: 0.9 }), -w / 2 + 0.25 + (k % 4) * (w / 4.2), h / 2 - 0.25 - Math.floor(k / 4) * 0.32, 0.03, { sombra: false });
    n.rotation.z = (Math.random() - 0.5) * 0.15;
    g.add(n);
  }
  for (let k = 0; k < 3; k++) g.add(caja(w * (0.3 + Math.random() * 0.3), 0.015, 0.01, mat('#334155'), w * 0.1, -h / 2 + 0.25 + k * 0.12, 0.03, { sombra: false }));
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}
/** Un estante de pared con libros, una matera pequeña y un trofeo. */
function estantePared(x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.add(caja(1.6, 0.05, 0.3, MADERA(), 0, 0, 0));
  for (let k = 0; k < 6; k++) g.add(caja(0.08, 0.28 + Math.random() * 0.06, 0.22, mat(['#7f1d1d', '#1e3a8a', '#14532d', '#a16207', '#4c1d95', '#d6d3d1'][k]), -0.65 + k * 0.09, 0.17, 0));
  const p = planta(0.2, 0, 0.28);
  p.position.y = 0.03;
  g.add(p);
  g.add(cilindro(0.05, 0.07, 0.05, mat('#d4af37', { metal: 0.9, rugoso: 0.25 }), 0.6, 0.05, 0, 12));
  g.add(cilindro(0.025, 0.025, 0.12, mat('#d4af37', { metal: 0.9, rugoso: 0.25 }), 0.6, 0.13, 0, 8));
  g.add(cilindro(0.08, 0.03, 0.1, mat('#d4af37', { metal: 0.9, rugoso: 0.25 }), 0.6, 0.24, 0, 14));
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}
/** Una luz de estudio (softbox) en su trípode. */
function softbox(x, z, rotY = 0) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const p = cilindro(0.02, 0.02, 1.2, NEGRO(), Math.sin(a) * 0.22, 0.58, Math.cos(a) * 0.22, 6);
    p.rotation.z = Math.sin(a) * 0.2;
    p.rotation.x = -Math.cos(a) * 0.2;
    g.add(p);
  }
  g.add(cilindro(0.02, 0.02, 0.9, NEGRO(), 0, 1.5, 0, 6));
  const caja1 = caja(0.75, 0.75, 0.35, NEGRO(), 0, 2.0, 0);
  g.add(caja1);
  const frente = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.68), new THREE.MeshBasicMaterial({ color: '#fff7e6', toneMapped: false }));
  frente.position.set(0, 2.0, 0.18);
  g.add(frente);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}
function audifonos(x, y, z) {
  const g = new THREE.Group();
  const d = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16, Math.PI), NEGRO());
  g.add(d);
  for (const lado of [-1, 1]) {
    const c = cilindro(0.04, 0.04, 0.03, NEGRO(), lado * 0.09, 0, 0, 12);
    c.rotation.z = Math.PI / 2;
    g.add(c);
  }
  g.position.set(x, y, z);
  g.rotation.x = -Math.PI / 2;
  return g;
}

/** Lo que suma cada sala para verse viva (va al final de armarZona). */
function detallesDe(tipo, g, W, D, color) {
  const paleta = [color, '#f5f5f4', '#111827', '#fbbf24', '#38bdf8'];
  if (tipo === 'coordinacion') {
    g.add(caja(2.2, 0.75, 0.5, MADERA(), -W + 1.6, 0.37, -D + 0.75, { redondo: 0.02 }));
    g.add(estantePared(-W + 1.6, 0.78, -D + 0.75));
    g.add(cuadro(0.9, 1.2, -W + 0.17, 1.7, 0.6, paleta, Math.PI / 2));
    g.add(papelera(W - 1.3, D - 1.3));
    g.add(lamparaPie(W - 0.6, D - 2.4));
  } else if (tipo === 'guion') {
    g.add(lamparaPie(-W + 0.7, 0.8));
    g.add(papelera(W - 0.8, 1.6));
    g.add(cuadro(1.0, 0.7, W - 1.1, 2.3, -D + 0.14, paleta));
    for (let k = 0; k < 5; k++) {
      const hoja = caja(0.21, 0.004, 0.3, mat('#fafaf9', { rugoso: 0.95 }), -2 + Math.random() * 4, 0.022, 1.9 + Math.random() * 0.8, { sombra: false });
      hoja.rotation.y = Math.random() * Math.PI;
      g.add(hoja);
    }
  } else if (tipo === 'arte') {
    g.add(lamparaPie(-W + 0.6, -D + 1.2, '#ffd6e8'));
    g.add(papelera(W - 0.5, 0.4));
    // la mesa de muestras: rollos de tela y frascos de pintura
    g.add(caja(1.6, 0.7, 0.6, mat('#3a3c3f'), -W + 1.2, 0.35, D - 0.6));
    for (let k = 0; k < 5; k++) g.add(cilindro(0.05, 0.05, 0.14, mat(['#f472b6', '#facc15', '#38bdf8', LIMA, '#fb923c'][k], { rugoso: 0.4 }), -W + 0.65 + k * 0.25, 0.77, D - 0.6, 10));
  } else if (tipo === 'investigacion') {
    g.add(archivador(-W + 0.5, D - 1.0));
    g.add(archivador(-W + 1.05, D - 1.0));
    g.add(impresora(-W + 2.1, D - 0.9));
    g.add(papelera(W - 1.2, D - 0.7));
  } else if (tipo === 'video') {
    g.add(softbox(-W + 1.0, D - 1.0, 0.6));
    g.add(papelera(W - 0.6, -0.2));
    for (const x of [-2, 0]) g.add(audifonos(x + 0.55, 0.83, -0.05));
    // los cables por el piso
    for (let k = 0; k < 3; k++) {
      const cable = new THREE.Mesh(new THREE.TorusGeometry(0.6 + k * 0.2, 0.012, 4, 24, Math.PI * 0.8), NEGRO());
      cable.rotation.x = -Math.PI / 2;
      cable.position.set(2.6, 0.02, 2.2);
      g.add(cable);
    }
  } else if (tipo === 'calidad') {
    g.add(pizarraBlanca(2.4, 1.3, 1.8, 1.7, -D + 0.16));
    g.add(dispensador(W - 0.7, D - 1.0));
    g.add(papelera(-W + 0.6, D - 0.7));
    for (const x of [-2.8, 0, 2.4]) g.add(audifonos(x + 0.1, 0.83, 0.3));
  } else if (tipo === 'edicion') {
    g.add(estantePared(-1.6, 0.6, -D + 0.32));
    g.add(cuadro(0.8, 1.0, W - 0.17, 1.6, -1.6, paleta, -Math.PI / 2));
    g.add(papelera(2.4, 0.4));
    // un sillón de lectura
    const s = new THREE.Group();
    const tela = mat('#7a9a1f', { rugoso: 0.9 });
    s.add(caja(0.9, 0.42, 0.85, tela, 0, 0.28, 0, { redondo: 0.12 }));
    s.add(caja(0.9, 0.65, 0.22, tela, 0, 0.65, -0.35, { redondo: 0.1 }));
    s.position.set(-2.6, 0, 1.6);
    s.rotation.y = 0.6;
    g.add(s);
  }
}

/** Una pared gris oscuro con una moldura de luz lima arriba. */
function pared(w, h, x, z, { rotada = false, luz = true, color = '#2e3033' } = {}) {
  const g = new THREE.Group();
  g.userData.muro = true;
  g.add(caja(w, h, 0.22, mat(color, { rugoso: 0.9 }), 0, h / 2, 0));
  if (luz) g.add(caja(w, 0.05, 0.05, neon(), 0, h - 0.06, 0.13, { sombra: false }));
  g.position.set(x, 0, z);
  if (rotada) g.rotation.y = Math.PI / 2;
  return g;
}

/** Un panel de vidrio con su marco negro. */
function vidrio(w, h, x, z, { rotada = false } = {}) {
  const g = new THREE.Group();
  g.userData.muro = true;
  g.add(caja(w, h, 0.05, mat('#a5c8c0', { opacidad: 0.16, rugoso: 0.05, metal: 0.2 }), 0, h / 2, 0, { sombra: false }));
  for (const px of [-w / 2, w / 2]) g.add(caja(0.08, h, 0.09, NEGRO(), px, h / 2, 0));
  g.add(caja(w, 0.08, 0.09, NEGRO(), 0, h, 0));
  g.add(caja(w, 0.06, 0.09, NEGRO(), 0, 0.03, 0));
  g.position.set(x, 0, z);
  if (rotada) g.rotation.y = Math.PI / 2;
  return g;
}

/** Un estante en la pared con una matera y luz lima (como los del estudio de la imagen). */
function nicho(x, y, z) {
  const g = new THREE.Group();
  g.add(caja(1.0, 0.7, 0.35, mat('#1d1f1d', { rugoso: 0.8 }), 0, 0, 0));
  g.add(caja(1.04, 0.04, 0.37, neon(), 0, 0.36, 0, { sombra: false }));
  g.add(caja(1.04, 0.04, 0.37, neon(), 0, -0.36, 0, { sombra: false }));
  const p = planta(0, 0, 0.35);
  p.position.set(0, -0.32, 0.02);
  g.add(p);
  g.position.set(x, y, z);
  return g;
}

// ---------------------------------------------------------------- los agentes

// (2026-11-19t) «que los muñecos tengan mejor forma y se diferencie si es hombre o mujer»: cuerpo con cadera, cintura,
// pecho y hombros (torno), cuello, brazos y piernas con codo y rodilla, manos, zapatos, y una cara con ojos (que
// parpadean), cejas, nariz, boca y orejas. Mujer: hombros más angostos, cintura marcada, pelo largo (suelto, cola o
// moño), pestañas, labios y aretes. Hombre: hombros anchos, pelo corto (y barba en algunos), cinturón. Además, por
// su trabajo: audífonos en Producción y lentes en Calidad e Investigación. `genero` lo elige el usuario.
function torno(perfil, material) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 28), material);
  m.castShadow = true;
  return m;
}
function capsula(r, largo, material, y) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, largo, 6, 14), material);
  m.position.y = y;
  m.castShadow = true;
  return m;
}
const oscurecer = (hex, k) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

function agente(datos, i) {
  const g = new THREE.Group();
  const mujer = datos.genero !== 'hombre';
  const color = datos.color || '#94a3b8';
  const tonoPiel = PIELES[i % PIELES.length];
  const piel = mat(tonoPiel, { rugoso: 0.6 });
  const pielSombra = mat(oscurecer(tonoPiel, 0.85), { rugoso: 0.6 });
  const ropa = mat(color, { rugoso: 0.6 });
  const pantalon = mat(mujer ? ['#1f2937', '#3b2f4a', '#24324a'][i % 3] : ['#1f2937', '#2b3a4a', '#3a3328'][i % 3], { rugoso: 0.8 });
  const zapato = mat(mujer ? '#2a1a14' : '#111316', { rugoso: 0.45 });
  const pelo = mat(PELOS[i % PELOS.length], { rugoso: 0.85 });
  const partes = {};
  const CADERA = 0.84;

  // las piernas: cadera → muslo → rodilla → pantorrilla → zapato
  for (const lado of [-1, 1]) {
    const cadera = new THREE.Group();
    cadera.position.set(lado * (mujer ? 0.105 : 0.115), CADERA, 0);
    cadera.add(capsula(mujer ? 0.095 : 0.1, 0.3, pantalon, -0.2));
    const rodilla = new THREE.Group();
    rodilla.position.y = -0.42;
    rodilla.add(capsula(mujer ? 0.075 : 0.082, 0.3, pantalon, -0.19));
    const pie = caja(0.13, 0.08, 0.27, zapato, 0, -0.38, 0.05, { redondo: 0.035 });
    rodilla.add(pie);
    cadera.add(rodilla);
    g.add(cadera);
    partes[lado < 0 ? 'piernaI' : 'piernaD'] = cadera;
    partes[lado < 0 ? 'rodillaI' : 'rodillaD'] = rodilla;
  }

  // el cuerpo (de la cadera a los hombros), con su forma
  const perfil = mujer
    ? [[0.001, 0], [0.205, 0.0], [0.225, 0.08], [0.2, 0.2], [0.17, 0.3], [0.2, 0.42], [0.215, 0.5], [0.19, 0.58], [0.12, 0.63], [0.001, 0.64]]
    : [[0.001, 0], [0.2, 0.0], [0.21, 0.08], [0.215, 0.2], [0.225, 0.32], [0.255, 0.44], [0.27, 0.53], [0.24, 0.6], [0.13, 0.65], [0.001, 0.66]];
  const torso = torno(perfil, ropa);
  torso.position.y = CADERA - 0.04;
  torso.scale.z = 0.72;
  g.add(torso);
  partes.torso = torso;
  // la cintura del pantalón y, en los hombres, el cinturón
  const cintura = torno([[0.001, 0], [0.21, 0], [0.215, 0.1], [0.001, 0.1]], pantalon);
  cintura.position.y = CADERA - 0.06;
  cintura.scale.z = 0.74;
  g.add(cintura);
  if (!mujer) {
    const cinto = new THREE.Mesh(new THREE.TorusGeometry(0.212, 0.018, 6, 28), mat('#2a1d14', { rugoso: 0.5 }));
    cinto.rotation.x = Math.PI / 2;
    cinto.scale.y = 0.74;
    cinto.position.y = CADERA + 0.04;
    g.add(cinto);
  }
  // el cuello y el cuello de la camisa
  g.add(cilindro(0.065, 0.075, 0.14, piel, 0, CADERA + 0.66, 0, 14));
  const solapa = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.025, 8, 20), ropa);
  solapa.rotation.x = Math.PI / 2;
  solapa.position.y = CADERA + 0.6;
  g.add(solapa);

  // los brazos: hombro → brazo (manga) → codo → antebrazo → mano
  const hombroX = mujer ? 0.215 : 0.275;
  for (const lado of [-1, 1]) {
    const hombro = new THREE.Group();
    hombro.position.set(lado * hombroX, CADERA + 0.55, 0);
    const bola = new THREE.Mesh(new THREE.SphereGeometry(mujer ? 0.066 : 0.078, 14, 10), ropa);
    bola.position.x = -lado * 0.015;
    bola.castShadow = true;
    hombro.add(bola);
    hombro.add(capsula(mujer ? 0.062 : 0.072, 0.2, ropa, -0.15));
    const codo = new THREE.Group();
    codo.position.y = -0.31;
    codo.add(capsula(mujer ? 0.05 : 0.058, 0.2, piel, -0.13));
    const mano = new THREE.Mesh(new THREE.SphereGeometry(mujer ? 0.055 : 0.062, 12, 10), piel);
    mano.scale.set(0.85, 1.15, 0.7);
    mano.position.y = -0.29;
    codo.add(mano);
    hombro.add(codo);
    g.add(hombro);
    partes[lado < 0 ? 'brazoI' : 'brazoD'] = hombro;
    partes[lado < 0 ? 'codoI' : 'codoD'] = codo;
  }

  // la cabeza
  const cabeza = new THREE.Group();
  cabeza.position.y = CADERA + 0.93;
  const R = mujer ? 0.2 : 0.21;
  const cara = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), piel);
  cara.scale.set(0.95, 1.08, 1);
  cara.castShadow = true;
  cabeza.add(cara);
  // la quijada (más angulosa en los hombres)
  const quijada = new THREE.Mesh(new THREE.SphereGeometry(R * 0.78, 20, 14), piel);
  quijada.scale.set(mujer ? 0.92 : 1.02, 0.8, 0.95);
  quijada.position.set(0, -R * 0.38, R * 0.08);
  cabeza.add(quijada);
  for (const lado of [-1, 1]) {
    const oreja = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), pielSombra);
    oreja.scale.set(0.5, 1, 0.8);
    oreja.position.set(lado * R * 0.95, 0, 0);
    cabeza.add(oreja);
  }
  // los ojos (blanco + iris), las cejas, la nariz y la boca
  const blanco = mat('#f8fafc', { rugoso: 0.3 });
  const iris = mat(['#3b2416', '#1d4ed8', '#14532d', '#111827'][i % 4], { rugoso: 0.2 });
  partes.ojos = [];
  for (const lado of [-1, 1]) {
    const ojo = new THREE.Group();
    ojo.position.set(lado * R * 0.38, R * 0.08, R * 0.86);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), blanco);
    b.scale.set(1.15, 1, 0.6);
    ojo.add(b);
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), iris);
    n.position.z = 0.022;
    ojo.add(n);
    const brillo = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    brillo.position.set(0.008, 0.01, 0.042);
    ojo.add(brillo);
    if (mujer) {
      const pestana = caja(0.1, 0.014, 0.02, mat('#111111'), 0, 0.03, 0.012, { sombra: false });
      pestana.rotation.z = lado * -0.12;
      ojo.add(pestana);
    }
    cabeza.add(ojo);
    partes.ojos.push(ojo);
    const ceja = caja(mujer ? 0.075 : 0.09, mujer ? 0.014 : 0.022, 0.02, pelo, lado * R * 0.38, R * 0.32, R * 0.9, { sombra: false });
    ceja.rotation.z = lado * (mujer ? -0.18 : -0.08);
    cabeza.add(ceja);
  }
  const nariz = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), pielSombra);
  nariz.scale.set(0.8, 1.1, 1.1);
  nariz.position.set(0, -R * 0.12, R * 0.98);
  cabeza.add(nariz);
  const boca = new THREE.Mesh(new THREE.TorusGeometry(0.045, mujer ? 0.013 : 0.009, 6, 16, Math.PI), mat(mujer ? '#c2416b' : '#8b3a3a', { rugoso: 0.5 }));
  boca.rotation.z = Math.PI;
  boca.position.set(0, -R * 0.4, R * 0.9);
  cabeza.add(boca);

  // el pelo
  const estilo = i % 3;
  const casco = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 32, 20, 0, Math.PI * 2, 0, Math.PI * (mujer ? 0.56 : 0.48)), pelo);
  casco.rotation.x = -0.3;
  casco.position.y = R * 0.05;
  casco.castShadow = true;
  cabeza.add(casco);
  if (mujer) {
    // atrás: pelo largo suelto, cola de caballo o moño
    if (estilo === 0) {
      const largo = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.9, 0.34, 8, 18), pelo);
      largo.scale.z = 0.55;
      largo.position.set(0, -R * 0.7, -R * 0.45);
      largo.castShadow = true;
      cabeza.add(largo);
      for (const lado of [-1, 1]) {
        const mecha = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 6, 10), pelo);
        mecha.position.set(lado * R * 0.88, -R * 0.55, -R * 0.05);
        cabeza.add(mecha);
      }
    } else if (estilo === 1) {
      const atado = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), pelo);
      atado.position.set(0, R * 0.25, -R * 1.0);
      cabeza.add(atado);
      const cola = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.3, 6, 12), pelo);
      cola.position.set(0, -R * 0.45, -R * 1.12);
      cola.rotation.x = 0.25;
      cabeza.add(cola);
      partes.cola = cola;
    } else {
      const mono = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), pelo);
      mono.position.set(0, R * 0.95, -R * 0.55);
      cabeza.add(mono);
      const atras = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 24, 16, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.35), pelo);
      atras.rotation.x = 0.5;
      cabeza.add(atras);
    }
    // el flequillo de lado y los aretes
    const fleco = new THREE.Mesh(new THREE.SphereGeometry(R * 0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), pelo);
    fleco.position.set(R * 0.25, R * 0.55, R * 0.45);
    fleco.rotation.set(0.9, 0, -0.5);
    cabeza.add(fleco);
    for (const lado of [-1, 1]) {
      const arete = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), mat('#facc15', { metal: 0.9, rugoso: 0.2 }));
      arete.position.set(lado * R * 0.98, -R * 0.32, 0);
      cabeza.add(arete);
    }
  } else {
    // corto: con copete o con raya, y barba en algunos
    const copete = new THREE.Mesh(new THREE.SphereGeometry(R * 0.55, 16, 10), pelo);
    copete.scale.set(1.5, 0.45, 0.9);
    copete.position.set(estilo === 1 ? -R * 0.2 : 0, R * 0.82, R * 0.42);
    copete.rotation.x = 0.3;
    cabeza.add(copete);
    for (const lado of [-1, 1]) {
      const patilla = caja(0.03, 0.09, 0.07, pelo, lado * R * 0.93, -R * 0.05, R * 0.15, { sombra: false });
      cabeza.add(patilla);
    }
    if (estilo === 2) {
      const barba = new THREE.Mesh(new THREE.SphereGeometry(R * 0.8, 20, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), pelo);
      barba.scale.set(1.02, 0.9, 0.98);
      barba.position.set(0, -R * 0.3, R * 0.1);
      cabeza.add(barba);
    }
  }
  // por su trabajo: audífonos (Producción) o lentes (Calidad, Investigación)
  if (datos.id === 'video') {
    const diadema = new THREE.Mesh(new THREE.TorusGeometry(R * 1.1, 0.018, 8, 28, Math.PI), mat('#111827', { metal: 0.5 }));
    diadema.position.y = R * 0.1;
    cabeza.add(diadema);
    for (const lado of [-1, 1]) {
      const copa = cilindro(0.07, 0.07, 0.06, mat('#111827', { metal: 0.4 }), lado * R * 1.08, R * 0.05, 0, 18);
      copa.rotation.z = Math.PI / 2;
      cabeza.add(copa);
    }
  }
  if (datos.id === 'calidad' || datos.id === 'investigacion') {
    const marco = mat('#111827', { metal: 0.6, rugoso: 0.3 });
    for (const lado of [-1, 1]) {
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.009, 6, 20), marco);
      aro.position.set(lado * R * 0.38, R * 0.08, R * 0.99);
      cabeza.add(aro);
    }
    cabeza.add(caja(0.06, 0.012, 0.012, marco, 0, R * 0.1, R * 1.0, { sombra: false }));
  }
  g.add(cabeza);
  partes.cabeza = cabeza;

  // el anillo de estado en el piso
  const anillo = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 40), new THREE.MeshBasicMaterial({ color: '#64748b', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  anillo.rotation.x = -Math.PI / 2;
  anillo.position.y = 0.02;
  g.add(anillo);
  partes.anillo = anillo;
  // el signo de alerta (cuando te necesita)
  const alerta = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
  alerta.position.y = 2.55;
  alerta.visible = false;
  g.add(alerta);
  partes.alerta = alerta;
  g.userData = { id: datos.id, partes, fase: i * 1.7, parpadeo: 2 + Math.random() * 3 };
  g.traverse((o) => (o.userData.agente = datos.id));
  return g;
}

/** La etiqueta HTML de un agente: su personaje, su nombre y la burbuja de lo que hace. */
function etiqueta(onElegir, id) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'o3-etiqueta';
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onElegir.current?.(id);
  });
  el.innerHTML = '<span class="o3-burbuja"></span><span class="o3-tarjeta"><span class="o3-cara"></span><span class="o3-nombre"></span></span>';
  return el;
}

// ---------------------------------------------------------------- las zonas

// Cada zona se arma en su propio grupo (centro en 0, 0). Devuelve el asiento de su agente en coordenadas de la zona:
// { silla, frente } (la silla mira hacia -z, al escritorio).
function armarZona(id, tipoSala, z, color, nombre, ctx) {
  const tipo = ARMADO[tipoSala] || tipoSala;
  const g = new THREE.Group();
  const { pantallas, animados } = ctx;
  const W = z.w / 2;
  const D = z.d / 2;
  const plantaEn = (x, zz, e = 1) => {
    const p = planta(x, zz, e);
    g.add(p);
    animados.push(p);
  };
  const letrero = (x, y, zz, rotY = 0) => {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.5), new THREE.MeshBasicMaterial({ map: texturaLetrero(nombre, color), transparent: true, toneMapped: false }));
    l.position.set(x, y, zz);
    l.rotation.y = rotY;
    g.add(l);
  };
  const fila = (n, zFila, tipo, { separacion = 2.3, doble = false, sillaColor } = {}) => {
    const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * separacion);
    for (const x of xs) {
      const e = escritorio(tipo, color, pantallas, id, { dobleMonitor: doble });
      e.position.set(x, 0, zFila);
      g.add(e);
      const s = silla(sillaColor);
      s.position.set(x, 0, zFila + 0.95);
      g.add(s);
    }
    return xs;
  };
  let asiento = { silla: new THREE.Vector3(0, 0, 0.4), frente: new THREE.Vector3(0, 0, 2) };

  if (tipo === 'coordinacion') {
    // la sala de reuniones de vidrio: pared de listones con el logo, mesa larga, televisor con las ventas y el reloj
    const listones = new THREE.Group();
    listones.userData.muro = true;
    listones.add(caja(z.w, 3.2, 0.25, mat('#1b1c1d', { rugoso: 0.8 }), 0, 1.6, -D));
    for (let i = 0; i < 24; i++) listones.add(caja(0.12, 3.1, 0.12, mat('#2c2e30', { rugoso: 0.7 }), -W + 0.25 + i * 0.38, 1.6, -D + 0.18));
    g.add(listones);
    const logo = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.7, 0.18, 3, 0.25), [NEGRO(), NEGRO(), NEGRO(), NEGRO(), new THREE.MeshBasicMaterial({ map: texturaLogo(), toneMapped: false }), NEGRO()]);
    logo.position.set(-W + 1.6, 1.8, -D + 0.38);
    g.add(logo);
    g.add(pared(z.d, 3.2, -W, 0, { rotada: true }));
    g.add(vidrio(z.w - 1.6, 2.7, 0.8, D));
    g.add(vidrio(z.d, 2.7, W, 0, { rotada: true }));
    g.add(caja(z.w, 0.06, 0.06, neon(), 0, 2.74, D, { sombra: false }));
    g.add(caja(3.8, 0.07, 1.5, MADERA(), 0.8, 0.76, -0.6, { redondo: 0.03 }));
    g.add(caja(0.25, 0.72, 0.9, NEGRO(), -0.6, 0.37, -0.6));
    g.add(caja(0.25, 0.72, 0.9, NEGRO(), 2.2, 0.37, -0.6));
    for (const [x, zz, r] of [[-0.3, -1.65, 0], [0.8, -1.65, 0], [1.9, -1.65, 0], [-0.3, 0.45, Math.PI], [1.9, 0.45, Math.PI]]) {
      const s = silla();
      s.position.set(x, 0, zz);
      s.rotation.y = r;
      g.add(s);
    }
    const s = silla();
    s.position.set(0.8, 0, 0.45);
    g.add(s);
    asiento = { silla: new THREE.Vector3(0.8, 0, 0.35), frente: new THREE.Vector3(0.8, 0, 1.9) };
    const tv = pantallaViva('barras', LIMA, { w: 320, h: 180 });
    pantallas.push({ id, viva: tv });
    g.add(caja(2.4, 1.4, 0.08, NEGRO(), 2.2, 1.95, -D + 0.32));
    const ptv = new THREE.Mesh(new THREE.PlaneGeometry(2.28, 1.28), new THREE.MeshBasicMaterial({ map: tv.textura, toneMapped: false }));
    ptv.position.set(2.2, 1.95, -D + 0.37);
    g.add(ptv);
    ctx.relojEn(g, new THREE.Vector3(-W + 3.4, 2.3, -D + 0.32));
    plantaEn(-W + 0.8, D - 0.8, 1.1);
    plantaEn(W - 0.7, -D + 0.8, 1);
    letrero(2.2, 2.95, -D + 0.33);
  } else if (tipo === 'guion') {
    // la biblioteca de madera y los escritorios en fila
    g.add(pared(z.w, 3.2, 0, -D));
    g.add(caja(6.2, 2.8, 0.55, mat('#7a4a26', { rugoso: 0.8 }), 0, 1.4, -D + 0.4));
    for (let f = 0; f < 5; f++) {
      g.add(caja(6.0, 0.05, 0.5, mat('#5c361b'), 0, 0.25 + f * 0.6, -D + 0.45));
      for (let i = 0; i < 22; i++) {
        if (Math.random() < 0.15) continue;
        const alto = 0.34 + Math.random() * 0.14;
        g.add(caja(0.2, alto, 0.34, mat(['#7f1d1d', '#a16207', '#14532d', '#1e3a8a', '#4c1d95', '#d6d3d1', '#78350f'][(i * 3 + f) % 7], { rugoso: 0.8 }), -2.85 + i * 0.27, 0.28 + f * 0.6 + alto / 2, -D + 0.48));
      }
    }
    g.add(tapete(7.6, 3.6));
    g.children.at(-1).position.z = 0.2;
    const xs = fila(3, -0.3, 'codigo', { separacion: 2.3, doble: true });
    asiento = { silla: new THREE.Vector3(xs[1], 0, 0.55), frente: new THREE.Vector3(xs[1], 0, 2.2) };
    g.add(lineaNeon(8.2, 4.4, 0.8));
    g.children.at(-1).position.z = 0.3;
    plantaEn(W - 0.6, -D + 0.9, 1.1);
    plantaEn(-W + 0.6, -D + 0.9, 0.9);
    letrero(0, 3.0, -D + 0.14);
  } else if (tipo === 'arte') {
    // los creativos: tres pantallas grandes en la pared (la del medio muestra la última imagen o clip que se hizo),
    // un caballete y dos mesas con su monitor
    g.add(pared(z.w, 3.4, 0, -D));
    const tonos = ['#f472b6', '#facc15', '#38bdf8', LIMA, '#fb923c', '#a78bfa'];
    for (const [x, ancho, real] of [[-2.85, 1.9, false], [0, 2.9, true], [2.85, 1.9, false]]) {
      g.add(caja(ancho + 0.12, ancho * 0.6 + 0.12, 0.1, NEGRO(), x, 2.0, -D + 0.18));
      const viva = pantallaViva(real ? 'imagen' : x < 0 ? 'imagen' : 'video', color, { w: 384, h: 230 });
      pantallas.push({ id, viva });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho * 0.6), new THREE.MeshBasicMaterial({ map: viva.textura, toneMapped: false }));
      m.position.set(x, 2.0, -D + 0.24);
      g.add(m);
      if (real) ctx.reales.push({ agente: id, fuente: 'ahora', mesh: m, viva });
    }
    g.add(caja(z.w - 1.2, 0.05, 0.05, mat(color, { emisivo: color, intensidad: 2 }), 0, 3.25, -D + 0.24, { sombra: false }));
    const tonosEasel = tonos;
    for (const [x, rx, rz] of [[W - 1.3, 0.15, 0.12], [W - 0.7, 0.15, -0.12]]) {
      const p = cilindro(0.04, 0.04, 2.2, mat('#a16207'), x, 1.05, D - 1.6, 8);
      p.rotation.set(-rx, 0, rz);
      g.add(p);
    }
    g.add(caja(1.1, 0.85, 0.05, mat('#ffffff'), W - 1.0, 1.55, D - 1.7));
    for (let i = 0; i < 4; i++) g.add(caja(0.8 - i * 0.12, 0.13, 0.01, mat(tonosEasel[i], { emisivo: tonosEasel[i], intensidad: 0.3 }), W - 1.0, 1.85 - i * 0.17, D - 1.67));
    g.add(tapete(6.4, 3.4));
    g.children.at(-1).position.z = 0.6;
    const xs = fila(2, 0.2, 'imagen', { separacion: 2.6, doble: true });
    asiento = { silla: new THREE.Vector3(xs[0], 0, 1.05), frente: new THREE.Vector3(xs[0], 0, 2.6) };
    plantaEn(-W + 0.6, D - 0.8, 1.1);
    letrero(0, 3.6, -D + 0.14);
  } else if (tipo === 'investigacion') {
    // la pared de datos (el mapa y las gráficas) y los escritorios con dos monitores
    g.add(pared(z.w, 3.4, 0, -D));
    g.add(pared(z.d, 3.4, W, 0, { rotada: true }));
    const datos = pantallaViva('datos', LIMA, { w: 768, h: 256 });
    pantallas.push({ id: 'pared-datos', viva: datos });
    g.add(caja(7.6, 2.6, 0.1, NEGRO(), -0.2, 1.9, -D + 0.2));
    const marco = lineaNeon(7.75, 2.75, 0.25, 0.06);
    marco.rotation.x = 0;
    marco.position.set(-0.2, 1.9, -D + 0.26);
    g.add(marco);
    const pd = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 2.45), new THREE.MeshBasicMaterial({ map: datos.textura, toneMapped: false }));
    pd.position.set(-0.2, 1.9, -D + 0.27);
    g.add(pd);
    g.add(tapete(8, 3.6));
    g.children.at(-1).position.z = 0.6;
    const xs = fila(3, 0.1, 'barras', { separacion: 2.4, doble: true });
    asiento = { silla: new THREE.Vector3(xs[1], 0, 0.95), frente: new THREE.Vector3(xs[1], 0, 2.6) };
    g.add(caja(3.4, 0.5, 0.5, mat('#1e1f20'), W - 2.2, 0.25, -D + 0.6));
    for (let i = 0; i < 4; i++) plantaEn(W - 3.6 + i * 0.95, -D + 0.6, 0.5);
    plantaEn(W - 0.7, D - 0.8, 1.2);
  } else if (tipo === 'video') {
    // el estudio: pantalla grande con el editor, nichos con luz, el aro de luz y la cámara en su trípode
    g.add(pared(z.w, 3.2, 0, -D));
    g.add(pared(z.d, 3.2, -W, 0, { rotada: true }));
    const vid = pantallaViva('video', LIMA, { w: 512, h: 288 });
    pantallas.push({ id, viva: vid });
    g.add(caja(3.9, 2.2, 0.1, NEGRO(), -1.0, 1.85, -D + 0.18));
    const pv = new THREE.Mesh(new THREE.PlaneGeometry(3.75, 2.05), new THREE.MeshBasicMaterial({ map: vid.textura, toneMapped: false }));
    pv.position.set(-1.0, 1.85, -D + 0.24);
    g.add(pv);
    ctx.reales.push({ agente: id, fuente: 'ahora', mesh: pv, viva: vid });
    g.add(nicho(2.0, 2.3, -D + 0.3));
    g.add(nicho(2.0, 1.35, -D + 0.3));
    g.add(nicho(-W + 0.3, 1.9, -1.2).rotateY(Math.PI / 2));
    g.add(tapete(6.4, 3.4));
    g.children.at(-1).position.set(-0.8, 0.015, 0.6);
    const xs = fila(3, 0.0, 'onda', { separacion: 2.0 });
    asiento = { silla: new THREE.Vector3(xs[0], 0, 0.85), frente: new THREE.Vector3(xs[0], 0, 2.4) };
    // el aro de luz y la cámara
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 12, 48), mat('#ffffff', { emisivo: '#fff7e6', intensidad: 2.5 }));
    aro.position.set(3.3, 2.0, 1.6);
    aro.rotation.y = -0.9;
    g.add(aro);
    g.add(cilindro(0.025, 0.025, 1.6, NEGRO(), 3.3, 0.8, 1.6, 8));
    g.add(cilindro(0.3, 0.3, 0.03, NEGRO(), 3.3, 0.02, 1.6, 3));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const p = cilindro(0.025, 0.025, 1.5, NEGRO(), 2.4 + Math.sin(a) * 0.25, 0.72, 2.6 + Math.cos(a) * 0.25, 6);
      p.rotation.z = Math.sin(a) * 0.2;
      p.rotation.x = -Math.cos(a) * 0.2;
      g.add(p);
    }
    const camara = new THREE.Group();
    camara.add(caja(0.45, 0.32, 0.6, NEGRO(), 0, 0, 0, { redondo: 0.04 }));
    const lente = cilindro(0.12, 0.15, 0.3, NEGRO(), 0, 0, -0.42, 18);
    lente.rotation.x = Math.PI / 2;
    camara.add(lente);
    const rec = new THREE.Mesh(new THREE.SphereGeometry(0.035), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
    rec.position.set(0.15, 0.2, 0.1);
    rec.userData.parpadea = true;
    camara.add(rec);
    animados.push(rec);
    camara.position.set(2.4, 1.6, 2.6);
    camara.rotation.y = 0.9;
    g.add(camara);
    plantaEn(-W + 0.7, D - 0.7, 1.2);
    letrero(-1.0, 3.25, -D + 0.14);
  } else if (tipo === 'calidad') {
    // la zona de revisión: pared con el globo de chat, divisiones bajas y escritorios con dos monitores
    g.add(pared(z.w, 3.2, 0, -D));
    g.add(pared(z.d, 3.2, W, 0, { rotada: true }));
    const chat = new THREE.Mesh(new RoundedBoxGeometry(1.2, 1.2, 0.12, 3, 0.2), [NEGRO(), NEGRO(), NEGRO(), NEGRO(), new THREE.MeshBasicMaterial({ map: texturaChat(), toneMapped: false }), NEGRO()]);
    chat.position.set(W - 0.3, 2.1, 1.2);
    chat.rotation.y = -Math.PI / 2;
    g.add(chat);
    g.add(caja(1.6, 1.4, 0.08, mat(LIMA, { emisivo: LIMA, intensidad: 0.6 }), -2.6, 1.6, -D + 0.16));
    g.add(nicho(-0.6, 1.9, -D + 0.3));
    g.add(caja(7.2, 1.2, 0.12, mat('#3a3c3f', { rugoso: 0.9 }), -0.4, 0.6, -1.1));
    g.add(caja(7.2, 0.04, 0.14, neon(), -0.4, 1.22, -1.1, { sombra: false }));
    g.add(tapete(7.6, 3.6));
    g.children.at(-1).position.set(-0.4, 0.015, 1.0);
    const xs = fila(3, 0.25, 'barras', { separacion: 2.4, doble: true });
    asiento = { silla: new THREE.Vector3(xs[1] - 0.4, 0, 1.1), frente: new THREE.Vector3(xs[1] - 0.4, 0, 2.7) };
    g.children.slice(-6).forEach((o) => (o.position.x -= 0.4));
    for (let i = 0; i < 3; i++) {
      const p = planta(-3.6 + i * 3.2, -1.1, 0.45);
      p.position.y = 1.24;
      g.add(p);
      animados.push(p);
    }
    plantaEn(W - 0.7, D - 0.8, 1.1);
    letrero(1.4, 3.0, -D + 0.14);
  } else if (tipo === 'edicion') {
    // la oficina de vidrio: marco negro, luz lima en el borde, escritorio con lámpara y su sillón
    g.add(pared(z.d, 3.0, W, 0, { rotada: true }));
    g.add(pared(z.w, 3.0, 0, -D));
    g.add(vidrio(z.d, 2.8, -W, 0, { rotada: true }));
    g.add(vidrio(z.w - 2.0, 2.8, 1.0, D));
    g.add(caja(z.w, 0.07, 0.07, neon(), 0, 2.84, D, { sombra: false }));
    g.add(caja(0.07, 0.07, z.d, neon(), -W, 2.84, 0, { sombra: false }));
    const tvEd = pantallaViva('video', color, { w: 384, h: 216 });
    pantallas.push({ id, viva: tvEd });
    g.add(caja(2.9, 1.7, 0.1, NEGRO(), -1.6, 1.85, -D + 0.18));
    const mtv = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 1.55), new THREE.MeshBasicMaterial({ map: tvEd.textura, toneMapped: false }));
    mtv.position.set(-1.6, 1.85, -D + 0.24);
    g.add(mtv);
    ctx.reales.push({ agente: id, fuente: 'hechos', mesh: mtv, viva: tvEd });
    const e = escritorio('onda', color, pantallas, id, { ancho: 2.2, dobleMonitor: true });
    e.position.set(1.2, 0, -0.9);
    g.add(e);
    const s = silla();
    s.position.set(1.2, 0, 0.05);
    g.add(s);
    asiento = { silla: new THREE.Vector3(1.2, 0, -0.05), frente: new THREE.Vector3(1.2, 0, 1.6) };
    const lampara = new THREE.Group();
    lampara.add(cilindro(0.02, 0.02, 1.6, NEGRO(), 0, 0.8, 0, 8));
    lampara.add(cilindro(0.06, 0.2, 0.22, mat('#18181b', { emisivo: '#ffcf8a', intensidad: 0.4 }), 0, 1.65, 0, 16));
    lampara.position.set(2.9, 0, -0.6);
    g.add(lampara);
    const luz = new THREE.PointLight('#ffcf8a', 3, 4, 2);
    luz.position.set(2.9, 1.5, -0.6);
    g.add(luz);
    plantaEn(-W + 0.7, -D + 0.7, 0.9);
    plantaEn(W - 0.6, D - 0.6, 0.8);
    letrero(0.6, 2.6, -D + 0.14);
  } else if (tipo === 'pronto') {
    // en construcción: la cinta amarilla y negra, conos, cajas, el plano en el piso y el letrero «Próximamente»
    g.add(caja(z.w - 1, 0.5, 0.18, mat('#26272a', { rugoso: 0.9 }), 0, 0.25, -D + 0.3));
    const plano = lineaNeon(z.w - 2.2, z.d - 2.4, 0.4, 0.05, color);
    g.add(plano);
    for (let i = 1; i < 5; i++) {
      const l = caja(0.03, 0.01, z.d - 2.6, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }), -W + 1.1 + i * ((z.w - 2.2) / 5), 0.03, 0, { sombra: false });
      g.add(l);
    }
    const amarillo = mat('#facc15', { rugoso: 0.6 });
    const negro = mat('#111111', { rugoso: 0.6 });
    for (const [x0, zz, rot] of [[-W + 0.6, D - 0.5, 0], [W - 0.5, 0, Math.PI / 2]]) {
      const cinta = new THREE.Group();
      const largo = rot ? z.d - 1.2 : z.w - 1.2;
      for (let i = 0; i < 14; i++) cinta.add(caja(largo / 14, 0.16, 0.05, i % 2 ? negro : amarillo, -largo / 2 + (i + 0.5) * (largo / 14), 0.95, 0, { sombra: false }));
      for (const px of [-largo / 2, largo / 2]) cinta.add(cilindro(0.05, 0.05, 1.0, mat('#d4d4d4', { metal: 0.6 }), px, 0.5, 0, 8));
      cinta.position.set(rot ? x0 : 0, 0, rot ? zz : zz);
      if (!rot) cinta.position.x = 0;
      cinta.rotation.y = rot;
      g.add(cinta);
    }
    const naranja = mat('#f97316', { rugoso: 0.6 });
    for (const [x, zz] of [[-1.6, 1.4], [1.9, -0.4], [0.4, 2.2]]) {
      g.add(cilindro(0.04, 0.22, 0.55, naranja, x, 0.3, zz, 16));
      g.add(cilindro(0.11, 0.15, 0.08, mat('#ffffff'), x, 0.33, zz, 16));
      g.add(caja(0.48, 0.04, 0.48, naranja, x, 0.02, zz));
    }
    const carton = mat('#b98a55', { rugoso: 0.95 });
    g.add(caja(0.9, 0.7, 0.7, carton, -W + 1.4, 0.35, -D + 1.2));
    g.add(caja(0.7, 0.55, 0.6, carton, -W + 1.4, 0.98, -D + 1.15));
    g.add(caja(0.8, 0.6, 0.6, carton, -W + 2.4, 0.3, -D + 1.1));
    const escalera = new THREE.Group();
    for (const px of [-0.28, 0.28]) {
      const lado = caja(0.06, 2.2, 0.06, mat('#9ca3af', { metal: 0.6 }), px, 1.1, 0);
      escalera.add(lado);
    }
    for (let i = 0; i < 6; i++) escalera.add(caja(0.56, 0.04, 0.06, mat('#9ca3af', { metal: 0.6 }), 0, 0.3 + i * 0.35, 0));
    escalera.position.set(W - 1.6, 0, -D + 0.6);
    escalera.rotation.x = -0.25;
    g.add(escalera);
    const cartel = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.8), new THREE.MeshBasicMaterial({ map: texturaLetrero('Próximamente', '#facc15'), transparent: true, toneMapped: false }));
    cartel.position.set(0, 0.95, -D + 0.6);
    cartel.rotation.x = -0.35;
    g.add(cartel);
    letrero(0, 1.75, -D + 0.62);
    const holo = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color, wireframe: true, toneMapped: false }));
    holo.position.set(0, 1.4, 0.6);
    holo.userData.gira = true;
    g.add(holo);
    animados.push(holo);
  }
  detallesDe(tipo, g, W, D, color);
  g.position.set(z.x, 0, z.z);
  g.userData.zona = true;
  return { grupo: g, asiento };
}

/** La barra de café (barra de madera con luz cálida, cafetera, frascos, mesa alta y taburetes). */
function armarCafe(z, animados) {
  const g = new THREE.Group();
  const D = z.d / 2;
  const W = z.w / 2;
  g.add(caja(6.4, 1.05, 0.9, MADERA(), -1.2, 0.52, -D + 1.0, { redondo: 0.04 }));
  for (let i = 0; i < 18; i++) g.add(caja(0.04, 0.95, 0.02, mat('#7a4a26'), -4.3 + i * 0.36, 0.5, -D + 1.46));
  g.add(caja(6.5, 0.07, 1.0, mat('#2b2622', { rugoso: 0.35 }), -1.2, 1.08, -D + 1.0));
  g.add(caja(6.3, 0.04, 0.04, mat('#ffb45c', { emisivo: '#ffb45c', intensidad: 2.2 }), -1.2, 0.08, -D + 1.47, { sombra: false }));
  const maquina = new THREE.Group();
  maquina.add(caja(0.8, 0.7, 0.55, NEGRO(), 0, 0.35, 0, { redondo: 0.05 }));
  maquina.add(caja(0.5, 0.06, 0.2, mat('#9ca3af', { metal: 0.9, rugoso: 0.2 }), 0, 0.3, 0.3));
  maquina.position.set(-3.6, 1.12, -D + 0.9);
  g.add(maquina);
  for (let i = 0; i < 5; i++) {
    g.add(cilindro(0.12, 0.12, 0.3, mat('#d6d3d1', { opacidad: 0.6, rugoso: 0.1 }), -2.6 + i * 0.35, 1.27, -D + 0.85, 14));
    g.add(cilindro(0.11, 0.11, 0.16, mat('#6b3f1d'), -2.6 + i * 0.35, 1.2, -D + 0.85, 14));
  }
  for (let i = 0; i < 4; i++) g.add(cilindro(0.06, 0.05, 0.12, mat('#fafaf9', { rugoso: 0.3 }), 0.4 + i * 0.3, 1.18, -D + 0.9, 12));
  // la mesa alta con tres taburetes
  g.add(caja(3.6, 0.07, 0.8, MADERA(), 0.2, 1.05, D - 2.4, { redondo: 0.03 }));
  g.add(caja(0.08, 1.0, 0.6, NEGRO(), -1.4, 0.5, D - 2.4));
  g.add(caja(0.08, 1.0, 0.6, NEGRO(), 1.8, 0.5, D - 2.4));
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Group();
    t.add(cilindro(0.03, 0.03, 0.75, NEGRO(), 0, 0.38, 0, 8));
    t.add(cilindro(0.2, 0.2, 0.02, NEGRO(), 0, 0.25, 0, 16));
    t.add(cilindro(0.22, 0.2, 0.08, mat('#1c1c1c', { rugoso: 0.6 }), 0, 0.78, 0, 18));
    t.position.set(-0.9 + i * 1.1, 0, D - 1.6);
    g.add(t);
  }
  for (const [x, zz, e] of [[W - 0.8, -D + 0.9, 1.2], [-W + 0.6, D - 0.8, 1.1], [2.6, D - 2.4, 0.4]]) {
    const p = planta(x, zz, e);
    if (e < 0.5) p.position.y = 1.09;
    g.add(p);
    animados.push(p);
  }
  g.position.set(z.x, 0, z.z);
  return { grupo: g, punto: new THREE.Vector3(z.x - 1.2, 0, z.z - D + 2.2), boca: new THREE.Vector3(z.x - 3.6, 1.9, z.z - D + 0.95) };
}

/** La sala de estar: tapete redondo, sofá en L con cojines lima, mesa redonda y dos sillones verdes. */
function armarSala(z, animados) {
  const g = new THREE.Group();
  g.add(tapete(7.4, 7.4, { redondo: true, color: '#3b3d40' }));
  const tela = mat('#b8ada0', { rugoso: 0.95 });
  g.add(caja(5.2, 0.45, 1.1, tela, 0, 0.32, -1.7, { redondo: 0.12 }));
  g.add(caja(5.2, 0.75, 0.32, tela, 0, 0.75, -2.15, { redondo: 0.1 }));
  g.add(caja(1.1, 0.45, 2.2, tela, -2.05, 0.32, -0.6, { redondo: 0.12 }));
  g.add(caja(0.32, 0.75, 2.6, tela, -2.55, 0.75, -0.8, { redondo: 0.1 }));
  for (const [x, c] of [[-1.4, LIMA], [-0.3, '#4b5563'], [0.8, LIMA], [1.9, '#4b5563']]) {
    const cojin = caja(0.62, 0.55, 0.18, mat(c === LIMA ? '#8fbf2a' : c, { rugoso: 0.95 }), x, 0.85, -1.9, { redondo: 0.08 });
    cojin.rotation.x = -0.2;
    g.add(cojin);
  }
  g.add(cilindro(0.95, 0.95, 0.08, MADERA(), 0.2, 0.48, 0.3, 40));
  g.add(cilindro(0.15, 0.3, 0.45, NEGRO(), 0.2, 0.23, 0.3, 16));
  g.add(caja(0.5, 0.02, 0.36, mat('#e7e5e4'), 0.5, 0.53, 0.4));
  const pm = planta(-0.1, 0.2, 0.35);
  pm.position.y = 0.52;
  g.add(pm);
  animados.push(pm);
  const verde = mat('#7a9a1f', { rugoso: 0.9 });
  for (const [x, rot] of [[-1.6, 0.5], [2.0, -0.5]]) {
    const s = new THREE.Group();
    s.add(caja(1.1, 0.45, 1.0, verde, 0, 0.3, 0, { redondo: 0.15 }));
    s.add(caja(1.1, 0.7, 0.28, verde, 0, 0.7, 0.42, { redondo: 0.12 }));
    s.add(caja(0.22, 0.55, 1.0, verde, -0.5, 0.55, 0, { redondo: 0.1 }));
    s.add(caja(0.22, 0.55, 1.0, verde, 0.5, 0.55, 0, { redondo: 0.1 }));
    s.position.set(x, 0, 2.2);
    s.rotation.y = Math.PI + rot;
    g.add(s);
  }
  g.add(cilindro(0.35, 0.35, 0.05, MADERA(), 3.3, 0.55, -1.6, 24));
  g.add(cilindro(0.04, 0.04, 0.55, NEGRO(), 3.3, 0.27, -1.6, 8));
  for (const [x, zz, e] of [[-3.8, -2.4, 1.3], [3.6, 2.6, 1.2], [-4.6, 1.8, 1.0]]) {
    const p = planta(x, zz, e);
    g.add(p);
    animados.push(p);
  }
  g.position.set(z.x, 0, z.z);
  return { grupo: g, punto: new THREE.Vector3(z.x + 0.2, 0, z.z + 1.4) };
}

/** El centro: la jardinera con el logo K que respira y sus líneas de luz. */
function armarCentro(animados) {
  const g = new THREE.Group();
  g.add(lineaNeon(10.5, 7.6, 2.2, 0.1));
  g.add(lineaNeon(11.6, 8.7, 2.6, 0.05));
  const base = new THREE.Mesh(new THREE.ExtrudeGeometry(rectRedondo(7.4, 4.8, 1.2), { depth: 0.55, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), mat('#2a2b2c', { rugoso: 0.7 }));
  base.rotation.x = -Math.PI / 2;
  base.castShadow = base.receiveShadow = true;
  g.add(base);
  const borde = lineaNeon(7.5, 4.9, 1.25, 0.08);
  borde.position.y = 0.62;
  g.add(borde);
  const tierra = new THREE.Mesh(new THREE.ShapeGeometry(rectRedondo(7.0, 4.4, 1.0), 12), mat('#2f2015', { rugoso: 1 }));
  tierra.rotation.x = -Math.PI / 2;
  tierra.position.y = 0.6;
  g.add(tierra);
  for (const [x, zz, e] of [[-2.7, -1.3, 1.3], [-2.9, 1.2, 1.0], [2.8, -1.2, 1.25], [2.9, 1.3, 1.0], [-1.6, 1.6, 0.8], [1.7, 1.7, 0.85], [0, -1.7, 1.1]]) {
    const p = planta(x, zz, e);
    p.position.y = 0.0;
    p.children[0].visible = false;
    p.children[1].visible = false;
    p.position.y = 0.2;
    g.add(p);
    animados.push(p);
  }
  // el letrero: un cuadrado redondeado negro con el borde lima y la K en las dos caras
  const cara = new THREE.MeshBasicMaterial({ map: texturaLogo(), toneMapped: false });
  const logo = new THREE.Mesh(new RoundedBoxGeometry(3.2, 3.2, 0.7, 4, 0.5), [NEGRO(), NEGRO(), NEGRO(), NEGRO(), cara, cara]);
  logo.position.set(0, 2.4, 0);
  logo.castShadow = true;
  logo.userData.logo = true;
  g.add(logo);
  const marco = new THREE.Mesh(new RoundedBoxGeometry(3.4, 3.4, 0.6, 4, 0.55), mat(LIMA, { emisivo: LIMA, intensidad: 1.6 }));
  marco.position.copy(logo.position);
  g.add(marco);
  animados.push(logo);
  const luz = new THREE.PointLight(LIMA, 18, 9, 2);
  luz.position.set(0, 2.2, 2.5);
  luz.userData.respira = true;
  g.add(luz);
  animados.push(luz);
  g.position.set(0, 0, -0.6);
  g.rotation.y = 0.35;
  return g;
}

// ---------------------------------------------------------------- la escena

export function Oficina3D({ agentes, zonas = [], elegido, onElegir }) {
  const caja3d = useRef(null);
  const estado = useRef({ agentes: [], elegido: null });
  const elegir = useRef(onElegir);
  elegir.current = onElegir;
  estado.current.agentes = agentes || [];
  estado.current.zonas = zonas || [];
  estado.current.elegido = elegido || null;

  useEffect(() => {
    const raiz = caja3d.current;
    if (!raiz) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      raiz.classList.add('o3--sin-3d');
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    raiz.appendChild(renderer.domElement);
    const etiquetas = new CSS2DRenderer();
    etiquetas.domElement.className = 'o3-capa';
    raiz.appendChild(etiquetas.domElement);

    const escena = new THREE.Scene();
    escena.background = new THREE.Color('#110f0d');
    escena.fog = new THREE.Fog(escena.background, 70, 130);

    // las salas de la planta (con su lugar); sin datos del servidor, las de siempre
    const zonas = (estado.current.zonas?.length ? estado.current.zonas : ZONAS_DE_SIEMPRE).filter((z) => LUGAR[z.lugar]);
    const filaNueva = zonas.some((z) => z.lugar >= 9);
    const FONDO = filaNueva ? 40.4 : 30.2;
    const zCentro = -15 + FONDO / 2;
    const CAMARA = filaNueva ? [6, 45, 55] : [8, 29, 33];
    const MIRA = filaNueva ? 3.5 : 0.5;
    const camara = new THREE.PerspectiveCamera(33, 1, 0.1, 400);
    camara.position.set(...CAMARA);
    const controles = new OrbitControls(camara, etiquetas.domElement);
    controles.target.set(0, 0, MIRA);
    controles.enableDamping = true;
    controles.dampingFactor = 0.08;
    controles.minDistance = 10;
    controles.maxDistance = 90;
    controles.maxPolarAngle = 1.25;
    controles.minPolarAngle = 0.35;
    controles.enablePan = true;
    controles.screenSpacePanning = false;

    // luces cálidas de noche: el ambiente, una luz principal con sombras y lámparas ámbar por zona
    escena.add(new THREE.HemisphereLight('#ffe7c7', '#3a2618', 0.75));
    const sol = new THREE.DirectionalLight('#ffe0b8', 1.6);
    sol.position.set(14, 30, 18);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -24, right: 24, top: 20, bottom: -20 });
    sol.shadow.bias = -0.0004;
    sol.shadow.normalBias = 0.02;
    escena.add(sol);
    for (const z of zonas) {
      const l = new THREE.PointLight('#ffb468', 9, 11, 2);
      l.position.set(LUGAR[z.lugar].x, 3.6, LUGAR[z.lugar].z + 0.5);
      escena.add(l);
    }

    // el piso de madera, la losa con su borde de luz y las paredes de fondo
    const madera = texturaMadera();
    madera.repeat.set(3.2, (2.6 * FONDO) / 30);
    const piso = caja(ANCHO, 0.5, FONDO, [OSCURO(), OSCURO(), new THREE.MeshStandardMaterial({ map: madera, roughness: 0.55, metalness: 0.05 }), OSCURO(), OSCURO(), OSCURO()], 0, -0.25, zCentro, { sombra: false });
    escena.add(piso);
    const losa = caja(ANCHO + 0.6, 0.9, FONDO + 0.6, mat('#1a1b1c', { rugoso: 0.6 }), 0, -0.95, zCentro, { redondo: 0.2 });
    escena.add(losa);
    const borde = new THREE.Mesh(new THREE.BoxGeometry(ANCHO + 0.66, 0.05, FONDO + 0.66), new THREE.MeshBasicMaterial({ color: LIMA, toneMapped: false }));
    borde.position.set(0, -1.42, zCentro);
    escena.add(borde);
    escena.add(pared(ANCHO, 3.4, 0, -15 + 0.11, { luz: false, color: '#232426' }));
    escena.add(pared(FONDO, 3.4, -ANCHO / 2 + 0.11, zCentro, { rotada: true, luz: false, color: '#232426' }));
    // las líneas de luz del pasillo
    const pasillo = lineaNeon(21, 11.2, 1.6, 0.07);
    pasillo.position.set(0, 0.025, 0.4);
    escena.add(pasillo);
    if (filaNueva) {
      const pasillo2 = lineaNeon(ANCHO - 2, 1.6, 0.6, 0.06);
      pasillo2.position.set(0, 0.025, 15.9);
      escena.add(pasillo2);
    }

    const pantallas = [];
    const animados = [];
    const reales = []; // las pantallas que muestran lo que se está haciendo de verdad
    const reloj = relojVivo();
    const ctx = {
      pantallas,
      animados,
      reales,
      relojEn: (grupo, pos) => {
        const r = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshBasicMaterial({ map: reloj.textura, transparent: true, toneMapped: false }));
        r.position.copy(pos);
        grupo.add(r);
      },
    };
    const asientos = {};
    const etiquetasZona = [];
    let cafe = null;
    let sala = null;
    for (const z of zonas) {
      const geo = LUGAR[z.lugar];
      if (z.tipo === 'cafe') {
        const c = armarCafe(geo, animados);
        escena.add(c.grupo);
        cafe ||= c;
      } else if (z.tipo === 'sala') {
        const c = armarSala(geo, animados);
        escena.add(c.grupo);
        sala ||= c;
      } else {
        const { grupo, asiento } = armarZona(z.id, z.tipo, geo, z.color || LIMA, z.nombre || z.id, ctx);
        escena.add(grupo);
        if (z.agente) {
          const base = new THREE.Vector3(geo.x, 0, geo.z);
          asientos[z.id] = { silla: asiento.silla.clone().add(base), frente: asiento.frente.clone().add(base), zona: geo };
        }
      }
      // las salas sin agente (en construcción o tuyas) llevan su etiqueta para leerla y tocarla
      if (z.pronto || z.propia) {
        const el = document.createElement(z.href ? 'a' : 'span');
        el.className = `o3-zona${z.pronto ? ' o3-zona--pronto' : ''}`;
        el.style.setProperty('--color', z.color || LIMA);
        if (z.href) el.href = z.href;
        el.textContent = z.pronto ? `${z.nombre} · Pronto` : z.nombre;
        const etq = new CSS2DObject(el);
        etq.position.set(geo.x, 3.3, geo.z);
        escena.add(etq);
        etiquetasZona.push(etq);
      }
    }
    const geoCafe = LUGAR[6];
    cafe ||= { punto: new THREE.Vector3(geoCafe.x, 0, geoCafe.z), boca: new THREE.Vector3(geoCafe.x, -5, geoCafe.z) };
    sala ||= { punto: new THREE.Vector3(0, 0, 9) };
    escena.add(armarCentro(animados));
    escena.add(dispensador(-8.4, -4.6));
    escena.add(papelera(-7.8, -4.5));
    for (const [x, z, r] of [[8.4, 4.6, Math.PI], [-8.4, 4.8, Math.PI]]) {
      const banca = new THREE.Group();
      banca.add(caja(1.8, 0.08, 0.5, MADERA(), 0, 0.45, 0, { redondo: 0.02 }));
      for (const px of [-0.75, 0.75]) banca.add(caja(0.06, 0.45, 0.45, NEGRO(), px, 0.22, 0));
      banca.position.set(x, 0, z);
      banca.rotation.y = r;
      escena.add(banca);
    }

    // (2026-11-19t) «que se vean bien desde cualquier vista»: las paredes (y los vidrios) que quedan entre la cámara y
    // su sala se vuelven casi transparentes, como en una casa de muñecas; las del fondo siguen sólidas.
    const muros = [];
    escena.updateMatrixWorld(true);
    escena.traverse((o) => {
      if (!o.userData?.muro) return;
      const caja3 = new THREE.Box3().setFromObject(o);
      const pos = caja3.getCenter(new THREE.Vector3());
      let centro = new THREE.Vector3(0, 0, zCentro);
      for (let x = o.parent; x; x = x.parent) if (x.userData?.zona) { centro = x.position.clone(); break; }
      const mallas = [];
      o.traverse((m) => {
        if (!m.isMesh) return;
        m.material = m.material.clone();
        m.userData.op0 = m.material.transparent ? m.material.opacity : 1;
        m.userData.dw0 = m.material.depthWrite;
        mallas.push(m);
      });
      muros.push({ pos, centro, mallas, f: 1 });
    });
    const desvanecerMuros = (dt) => {
      const alto = Math.atan2(camara.position.y - 0, Math.hypot(camara.position.x - controles.target.x, camara.position.z - controles.target.z));
      for (const w of muros) {
        const dx = w.pos.x - w.centro.x;
        const dz = w.pos.z - w.centro.z;
        const cx = camara.position.x - w.centro.x;
        const cz = camara.position.z - w.centro.z;
        const lw = Math.hypot(dx, dz) || 1;
        const lc = Math.hypot(cx, cz) || 1;
        // la pared está del lado de la cámara (y la cámara no mira casi desde arriba)
        const tapa = (dx * cx + dz * cz) / (lw * lc) > 0.25 && alto < 1.25;
        const meta = tapa ? 0.12 : 1;
        if (Math.abs(w.f - meta) < 0.005) continue;
        w.f += (meta - w.f) * Math.min(1, dt * 6);
        for (const m of w.mallas) {
          m.material.opacity = m.userData.op0 * w.f;
          const transparente = w.f < 0.99 || m.userData.op0 < 1;
          if (m.material.transparent !== transparente) {
            m.material.transparent = transparente;
            m.material.needsUpdate = true;
          }
          m.material.depthWrite = w.f > 0.99 ? m.userData.dw0 : false;
          m.castShadow = w.f > 0.5;
        }
      }
    };
    // plantas grandes en las esquinas y los pasillos
    for (const [x, z, e] of [[-ANCHO / 2 + 0.9, -1.8, 1.4], [ANCHO / 2 - 0.9, -4.6, 1.3], [-6.8, 5.2, 1.2], [6.8, 5.4, 1.2], [8.6, -5.4, 1.1], [-8.6, -5.0, 1.0], [ANCHO / 2 - 0.9, 6.4, 1.3]]) {
      const p = planta(x, z, e);
      escena.add(p);
      animados.push(p);
    }

    // el vapor del café
    const vapor = [];
    const matVapor = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const v = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), matVapor.clone());
      v.userData.t = i / 10;
      escena.add(v);
      vapor.push(v);
    }

    // el robot aspiradora
    const robot = new THREE.Group();
    robot.add(cilindro(0.32, 0.34, 0.12, mat('#e5e7eb', { metal: 0.3, rugoso: 0.35 }), 0, 0.12, 0, 28));
    const ojoRobot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: LIMA }));
    ojoRobot.position.set(0, 0.19, 0.22);
    robot.add(ojoRobot);
    escena.add(robot);

    // motas de luz
    const motas = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 240 }, (_, i) => (i % 3 === 1 ? Math.random() * 12 + 1 : (Math.random() - 0.5) * 44)), 3)),
      new THREE.PointsMaterial({ color: '#ffd58a', size: 0.07, transparent: true, opacity: 0.55, depthWrite: false })
    );
    escena.add(motas);

    // los paquetes de trabajo que la coordinadora reparte
    const paquetes = [];
    const matPaquete = new THREE.MeshBasicMaterial({ color: LIMA, toneMapped: false });
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), matPaquete);
      p.visible = false;
      p.userData = { t: 0, de: null, a: null };
      escena.add(p);
      paquetes.push(p);
    }

    // los agentes y sus etiquetas
    const personajes = new Map();
    estado.current.agentes.forEach((a, i) => {
      const g = agente(a, i);
      const asiento = asientos[a.id];
      if (asiento) g.position.copy(asiento.frente);
      escena.add(g);
      const el = etiqueta(elegir, a.id);
      const etq = new CSS2DObject(el);
      etq.position.set(0, 2.7, 0);
      g.add(etq);
      personajes.set(a.id, { g, el, destino: null, espera: Math.random() * 3 });
    });

    // (para las capturas de prueba: mover la cámara desde fuera)
    raiz.__o3 = { camara, controles, personajes, THREE };
    const rayos = new THREE.Raycaster();
    const puntero = new THREE.Vector2();
    const alTocar = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rayos.setFromCamera(puntero, camara);
      const cuerpos = [...personajes.values()].map((p) => p.g);
      const golpe = rayos.intersectObjects(cuerpos, true).find((h) => h.object.userData.agente);
      if (golpe) elegir.current?.(golpe.object.userData.agente);
    };
    let abajo = null;
    const alBajar = (e) => (abajo = [e.clientX, e.clientY]);
    const alSoltar = (e) => {
      if (abajo && Math.hypot(e.clientX - abajo[0], e.clientY - abajo[1]) < 5) alTocar(e);
      abajo = null;
    };
    etiquetas.domElement.addEventListener('pointerdown', alBajar);
    etiquetas.domElement.addEventListener('pointerup', alSoltar);

    const medir = () => {
      const w = raiz.clientWidth || 800;
      const h = raiz.clientHeight || 560;
      renderer.setSize(w, h);
      etiquetas.setSize(w, h);
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(raiz);

    // ---------------------------------------------------------------- el bucle
    const relojAnim = new THREE.Clock();
    let ultimoPantallas = 0;
    let ultimoReloj = 0;
    let ultimoPaquete = 0;
    let marco = 0;
    const objetivoCam = new THREE.Vector3(0, 0, MIRA);
    let enfocado = null;
    const tmp = new THREE.Vector3();
    const enXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

    const actualizarEtiquetas = () => {
      for (const a of estado.current.agentes) {
        const p = personajes.get(a.id);
        if (!p) continue;
        const burbuja = a.estado === 'te-necesita' ? a.necesita?.[0]?.titulo : a.caida ? `⚠ ${a.caida}` : a.estado === 'trabajando' ? a.ahora?.[0]?.titulo : '';
        const clave = `${a.nombre}|${a.avatar}|${a.estado}|${burbuja}|${a.caida}|${estado.current.elegido === a.id}`;
        if (p.el.dataset.clave === clave) continue;
        p.el.dataset.clave = clave;
        p.el.className = `o3-etiqueta o3-etiqueta--${a.estado}${a.caida && a.estado !== 'te-necesita' ? ' o3-etiqueta--caida' : ''}${estado.current.elegido === a.id ? ' o3-etiqueta--elegida' : ''}`;
        p.el.style.setProperty('--color', a.color);
        p.el.querySelector('.o3-cara').textContent = a.avatar || '🙂';
        p.el.querySelector('.o3-nombre').textContent = a.nombre;
        const b = p.el.querySelector('.o3-burbuja');
        b.textContent = burbuja || '';
        b.hidden = !burbuja;
        p.el.setAttribute('aria-label', `${a.nombre}: ${a.estado === 'te-necesita' ? 'te necesita' : a.estado}`);
        const anillo = p.g.userData.partes.anillo;
        anillo.material.color.set(a.estado === 'te-necesita' ? '#ef4444' : a.caida ? '#f59e0b' : a.estado === 'trabajando' ? '#4ade80' : estado.current.elegido === a.id ? a.color : '#64748b');
        p.g.userData.partes.alerta.visible = a.estado === 'te-necesita' || Boolean(a.caida);
        p.g.userData.partes.alerta.material.color.set(a.estado === 'te-necesita' ? '#ef4444' : '#f59e0b');
      }
    };

    // las pantallas grandes muestran la última imagen o clip de lo que se está haciendo (o lo último entregado)
    const cargador = new THREE.TextureLoader();
    const soltar = (r) => {
      if (r.video) {
        r.video.pause();
        r.video.removeAttribute('src');
        r.video.load();
        r.video = null;
      }
      if (r.textura) r.textura.dispose();
      r.textura = null;
    };
    const actualizarReales = () => {
      for (const r of reales) {
        const a = estado.current.agentes.find((x) => x.id === r.agente);
        const vista = r.fuente === 'hechos' ? a?.hechos?.[0]?.vista : a?.estado === 'trabajando' ? a?.ahora?.find((x) => x.vista)?.vista : null;
        const url = vista?.url || null;
        if (url === r.url) continue;
        r.url = url;
        soltar(r);
        if (!url) {
          r.mesh.material.map = r.viva.textura;
          r.mesh.material.needsUpdate = true;
          continue;
        }
        if (vista.tipo === 'video') {
          const v = document.createElement('video');
          Object.assign(v, { src: url, muted: true, loop: true, playsInline: true, autoplay: true, crossOrigin: 'anonymous' });
          v.play().catch(() => {});
          const tex = new THREE.VideoTexture(v);
          tex.colorSpace = THREE.SRGBColorSpace;
          r.video = v;
          r.textura = tex;
          r.mesh.material.map = tex;
          r.mesh.material.needsUpdate = true;
        } else {
          cargador.load(
            url,
            (tex) => {
              if (r.url !== url) return tex.dispose();
              tex.colorSpace = THREE.SRGBColorSpace;
              r.textura = tex;
              r.mesh.material.map = tex;
              r.mesh.material.needsUpdate = true;
            },
            undefined,
            () => {}
          );
        }
      }
    };

    const animar = () => {
      marco = requestAnimationFrame(animar);
      if (document.hidden) return;
      const dt = Math.min(relojAnim.getDelta(), 0.05);
      const t = relojAnim.elapsedTime;
      actualizarEtiquetas();
      const lista = estado.current.agentes;
      const trabajando = new Set(lista.filter((a) => a.estado === 'trabajando').map((a) => a.id));

      // las pantallas (más vivas si su agente trabaja) y el reloj
      if (t - ultimoPantallas > 0.18) {
        ultimoPantallas = t;
        for (const p of pantallas) p.viva.dibujar(p.id === 'pared-datos' || trabajando.has(p.id) || Math.random() < 0.05);
      }
      if (t - ultimoReloj > 1) {
        ultimoReloj = t;
        reloj.dibujar();
        actualizarReales();
      }

      // los agentes
      for (const a of lista) {
        const p = personajes.get(a.id);
        const asiento = asientos[a.id];
        if (!p || !asiento) continue;
        const zona = asiento.zona;
        const { partes, fase } = p.g.userData;
        const g = p.g;
        let andando = false;
        if (a.estado === 'trabajando') {
          // va a su silla y escribe
          tmp.copy(asiento.silla);
          if (enXZ(g.position, tmp) > 0.08) {
            andando = true;
            tmp.y = 0;
            g.position.lerp(tmp, Math.min(1, dt * 2.2));
            g.rotation.y = Math.atan2(tmp.x - g.position.x, tmp.z - g.position.z);
          } else {
            g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.PI, dt * 6);
            g.position.y = -0.27; // sentado: muslos adelante, pantorrillas abajo
            partes.piernaI.rotation.x = partes.piernaD.rotation.x = -1.5;
            partes.rodillaI.rotation.x = partes.rodillaD.rotation.x = 1.45;
            // escribiendo: los brazos hacia el teclado y los codos doblados
            partes.brazoI.rotation.set(-0.55 + Math.sin(t * 14 + fase) * 0.06, 0, 0.12);
            partes.brazoD.rotation.set(-0.55 + Math.sin(t * 14 + fase + 1.6) * 0.06, 0, -0.12);
            partes.codoI.rotation.x = partes.codoD.rotation.x = -0.95;
            partes.cabeza.rotation.x = 0.12 + Math.sin(t * 2 + fase) * 0.04;
          }
        } else if (a.estado === 'te-necesita') {
          // de pie frente a su escritorio, mirando hacia ti, saludando
          tmp.copy(asiento.frente);
          if (enXZ(g.position, tmp) > 0.08) {
            andando = true;
            g.position.lerp(tmp, Math.min(1, dt * 2.2));
            g.rotation.y = Math.atan2(tmp.x - g.position.x, tmp.z - g.position.z);
          } else {
            g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0.5, dt * 5);
            g.position.y = Math.abs(Math.sin(t * 4 + fase)) * 0.12;
            partes.piernaI.rotation.x = partes.piernaD.rotation.x = 0;
            partes.rodillaI.rotation.x = partes.rodillaD.rotation.x = 0;
            partes.brazoD.rotation.set(-2.75, 0, Math.sin(t * 8 + fase) * 0.45);
            partes.codoD.rotation.x = -0.35;
            partes.brazoI.rotation.set(0, 0, 0.08);
            partes.codoI.rotation.x = 0;
            partes.cabeza.rotation.x = 0;
          }
          partes.alerta.position.y = 2.55 + Math.sin(t * 5) * 0.1;
          partes.alerta.rotation.y += dt * 3;
          partes.anillo.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
        } else {
          // libre: camina por su sala y, a veces, al café
          if (!p.destino || enXZ(g.position, p.destino) < 0.15) {
            p.espera -= dt;
            if (p.espera <= 0) {
              const r = Math.random();
              p.destino =
                r < 0.2
                  ? cafe.punto.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 1.0))
                  : r < 0.35
                    ? sala.punto.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 1.2))
                    : new THREE.Vector3(zona.x + (Math.random() - 0.5) * (zona.w - 3), 0, zona.z + zona.d / 2 - 0.8 - Math.random() * 1.6);
              p.espera = 2 + Math.random() * 4;
            }
          } else {
            andando = true;
            tmp.copy(p.destino).sub(g.position);
            tmp.y = 0;
            const paso = Math.min(tmp.length(), dt * 1.6);
            tmp.normalize().multiplyScalar(paso);
            g.position.add(tmp);
            g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(tmp.x, tmp.z), dt * 8);
          }
          partes.anillo.scale.setScalar(1);
        }
        if (a.estado !== 'trabajando') {
          if (andando) {
            g.position.y = Math.abs(Math.sin(t * 9 + fase)) * 0.05;
            partes.piernaI.rotation.x = Math.sin(t * 9 + fase) * 0.55;
            partes.piernaD.rotation.x = -Math.sin(t * 9 + fase) * 0.55;
            partes.rodillaI.rotation.x = Math.max(0, -Math.sin(t * 9 + fase)) * 0.7;
            partes.rodillaD.rotation.x = Math.max(0, Math.sin(t * 9 + fase)) * 0.7;
            if (a.estado !== 'te-necesita') {
              partes.brazoI.rotation.set(-Math.sin(t * 9 + fase) * 0.45, 0, 0.06);
              partes.brazoD.rotation.set(Math.sin(t * 9 + fase) * 0.45, 0, -0.06);
              partes.codoI.rotation.x = partes.codoD.rotation.x = -0.25;
            }
          } else if (a.estado === 'libre') {
            g.position.y = 0;
            partes.piernaI.rotation.x = partes.piernaD.rotation.x = 0;
            partes.rodillaI.rotation.x = partes.rodillaD.rotation.x = 0;
            partes.brazoI.rotation.set(Math.sin(t * 1.5 + fase) * 0.05, 0, 0.07);
            partes.brazoD.rotation.set(-Math.sin(t * 1.5 + fase) * 0.05, 0, -0.07);
            partes.codoI.rotation.x = partes.codoD.rotation.x = -0.12;
            partes.cabeza.rotation.y = Math.sin(t * 0.7 + fase) * 0.4;
          }
        }
        // la respiración
        partes.torso.scale.y = 1 + Math.sin(t * 2.4 + fase) * 0.015;
        // el parpadeo (cada pocos segundos) y la cola de caballo que se mueve
        p.g.userData.parpadeo -= dt;
        const cerrado = p.g.userData.parpadeo < 0.12;
        for (const ojo of partes.ojos || []) ojo.scale.y = cerrado ? 0.1 : 1;
        if (p.g.userData.parpadeo < 0) p.g.userData.parpadeo = 2.5 + Math.random() * 3.5;
        if (partes.cola) partes.cola.rotation.z = Math.sin(t * 3 + fase) * (andando ? 0.25 : 0.06);
      }

      // los paquetes: de la coordinadora a quien trabaja
      if (trabajando.size && t - ultimoPaquete > 1.4 && asientos.coordinacion) {
        const libre = paquetes.find((q) => !q.visible);
        const ids = [...trabajando].filter((id) => asientos[id] && id !== 'coordinacion');
        if (libre && ids.length) {
          ultimoPaquete = t;
          libre.visible = true;
          libre.userData = { t: 0, de: asientos.coordinacion.silla.clone().setY(1.2), a: asientos[ids[Math.floor(Math.random() * ids.length)]].silla.clone().setY(1.0) };
        }
      }
      for (const q of paquetes) {
        if (!q.visible) continue;
        q.userData.t += dt * 0.5;
        const k = q.userData.t;
        if (k >= 1) {
          q.visible = false;
          continue;
        }
        q.position.lerpVectors(q.userData.de, q.userData.a, k);
        q.position.y += Math.sin(k * Math.PI) * 3.2;
        q.rotation.x += dt * 4;
        q.rotation.y += dt * 3;
      }

      // el vapor, las plantas, las luces, el globo, el robot y las motas
      for (const v of vapor) {
        v.userData.t = (v.userData.t + dt * 0.35) % 1;
        const k = v.userData.t;
        v.position.set(cafe.boca.x + Math.sin(k * 8 + v.id) * 0.1, cafe.boca.y + k * 1.2, cafe.boca.z);
        v.scale.setScalar(0.6 + k * 1.6);
        v.material.opacity = 0.45 * (1 - k);
      }
      for (const o of animados) {
        if (o.userData.balanceo !== undefined) o.rotation.z = Math.sin(t * 0.8 + o.userData.balanceo) * 0.03;
        if (o.userData.parpadea) o.visible = Math.sin(t * 3 + o.id) > -0.3;
        if (o.userData.gira) o.rotation.y += dt * 0.4;
        if (o.userData.logo) o.position.y = 2.4 + Math.sin(t * 1.2) * 0.06;
        if (o.userData.respira) o.intensity = 14 + Math.sin(t * 1.6) * 5;
      }
      // (por el pasillo: una vuelta alrededor de la jardinera del logo)
      const vuelta = t * 0.12;
      robot.position.set(Math.cos(vuelta) * 6.6, 0.03, -0.4 + Math.sin(vuelta) * 4.9);
      robot.rotation.y = -vuelta;
      ojoRobot.material.color.setHSL(0.52, 0.9, 0.5 + Math.sin(t * 4) * 0.15);
      motas.rotation.y += dt * 0.02;

      // la cámara: si elegiste a alguien, lo sigue de cerca
      const sel = estado.current.elegido ? personajes.get(estado.current.elegido) : null;
      if (sel) {
        if (enfocado !== estado.current.elegido) {
          enfocado = estado.current.elegido;
          const dir = camara.position.clone().sub(controles.target).normalize();
          controles.userData = { hacia: sel.g.position.clone().add(dir.multiplyScalar(16)).setY(Math.max(9, camara.position.y * 0.55)) };
        }
        objetivoCam.copy(sel.g.position).setY(1);
        controles.target.lerp(objetivoCam, dt * 3);
        if (controles.userData?.hacia) {
          camara.position.lerp(controles.userData.hacia, dt * 2);
          if (camara.position.distanceTo(controles.userData.hacia) < 0.2) controles.userData = {};
        }
      } else if (enfocado) {
        enfocado = null;
        controles.userData = { hacia: new THREE.Vector3(...CAMARA) };
      } else if (controles.userData?.hacia) {
        controles.target.lerp(objetivoCam.set(0, 0, MIRA), dt * 2.5);
        camara.position.lerp(controles.userData.hacia, dt * 2);
        if (camara.position.distanceTo(controles.userData.hacia) < 0.3) controles.userData = {};
      }
      controles.update();
      desvanecerMuros(dt);
      renderer.render(escena, camara);
      etiquetas.render(escena, camara);
    };
    animar();

    return () => {
      cancelAnimationFrame(marco);
      for (const r of reales) soltar(r);
      ro.disconnect();
      etiquetas.domElement.removeEventListener('pointerdown', alBajar);
      etiquetas.domElement.removeEventListener('pointerup', alSoltar);
      controles.dispose();
      const vistos = new Set();
      escena.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          if (vistos.has(m)) continue;
          vistos.add(m);
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
      materiales.clear();
      renderer.dispose();
      raiz.innerHTML = '';
    };
    // (la escena se arma una vez con los agentes que hay; los cambios de estado se leen en cada cuadro)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(agentes || []).map((a) => `${a.id}:${a.genero}`).join(','), (zonas || []).map((z) => `${z.id}:${z.lugar}:${z.tipo}:${z.color}:${z.nombre}`).join('|')]);

  return <div className="o3" ref={caja3d} />;
}
