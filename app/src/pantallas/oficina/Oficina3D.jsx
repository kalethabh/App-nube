// La OFICINA EN 3D (2026-11-19q, pedido: «el diseño de la oficina créalo tú de cero, en 3D, profesional, con el
// detalle de las cosas, animaciones e inventándole varias cosas»). Three.js puro, hecho a mano: un piso de oficina
// flotando de noche, una sala por departamento con su mobiliario y sus objetos propios, y los agentes (personajes
// con su color) que trabajan sentados escribiendo, caminan cuando están libres (a veces al café) y saludan con una
// alerta roja cuando te necesitan. Detalles: pantallas animadas, vapor del café, un robot aspiradora, paquetes de
// luz que la coordinadora reparte a quien trabaja, el reloj de la pared con la hora real y motas de luz.
// Los nombres y lo que hace cada uno van en etiquetas HTML (CSS2D) encima de cada agente: se leen nítidas y se tocan.
//
//   <Oficina3D agentes={[{ id, nombre, avatar, color, estado, ahora, necesita }]} elegido={id} onElegir={(id) => …} />
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const SALA = 7.2; // el lado de una sala (en metros de la escena)
const PASILLO = 1.1;
// dónde va cada departamento (columna, fila) en la planta de 3 x 3; el café ocupa dos
const PLANTA = { guion: [0, 0], coordinacion: [1, 0], arte: [2, 0], video: [0, 1], edicion: [1, 1], calidad: [2, 1], investigacion: [0, 2] };
const CAFE = { col: 1, fila: 2, ancho: 2 };
const centro = (col, fila, ancho = 1) => new THREE.Vector3((col - 1) * (SALA + PASILLO) + ((ancho - 1) * (SALA + PASILLO)) / 2, 0, (fila - 1) * (SALA + PASILLO));
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
  t.anisotropy = 4;
  return t;
}

/** El piso de madera de una sala, con un tapete del color del departamento. */
function texturaPiso(color) {
  return lienzo(512, 512, (g, w, h) => {
    g.fillStyle = '#c8a27a';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      for (let x = (y / 32) % 2 ? -64 : 0; x < w; x += 128) {
        const tono = 175 + Math.floor(Math.random() * 30);
        g.fillStyle = `rgb(${tono},${tono - 40},${tono - 85})`;
        g.fillRect(x + 1, y + 1, 126, 30);
        g.strokeStyle = 'rgba(80,50,25,0.25)';
        g.beginPath();
        g.moveTo(x + 10, y + 16 + Math.random() * 6);
        g.lineTo(x + 116, y + 14 + Math.random() * 6);
        g.stroke();
      }
    }
    // el tapete
    g.fillStyle = color;
    g.globalAlpha = 0.85;
    const m = 120;
    g.beginPath();
    g.roundRect(m, m, w - 2 * m, h - 2 * m, 30);
    g.fill();
    g.globalAlpha = 0.35;
    g.strokeStyle = '#fff';
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(m + 14, m + 14, w - 2 * m - 28, h - 2 * m - 28, 22);
    g.stroke();
    g.globalAlpha = 1;
  });
}

/** El letrero luminoso de un departamento. */
function texturaLetrero(texto, color) {
  return lienzo(512, 128, (g, w, h) => {
    g.fillStyle = 'rgba(10,14,24,0.92)';
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 26);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = color;
    g.font = '800 56px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 18;
    g.fillText(texto.toUpperCase(), w / 2, h / 2 + 2);
  });
}

/** Una pantalla que cambia: líneas de código, una onda o barras, según el departamento. */
function pantallaViva(tipo, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  let fase = Math.random() * 10;
  const dibujar = (activa) => {
    fase += 1;
    g.fillStyle = activa ? '#0b1324' : '#0a0d14';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = color;
    g.globalAlpha = activa ? 1 : 0.35;
    if (tipo === 'onda') {
      g.strokeStyle = color;
      g.lineWidth = 3;
      g.beginPath();
      for (let x = 0; x < 256; x += 4) g.lineTo(x, 80 + Math.sin(x / 14 + fase / 3) * (activa ? 34 : 8) * Math.sin(x / 70 + fase / 9));
      g.stroke();
      g.fillRect(20, 140, 216 * ((fase % 60) / 60), 5);
    } else if (tipo === 'barras') {
      for (let i = 0; i < 12; i++) g.fillRect(14 + i * 20, 140, 12, -((Math.sin(i + fase / 4) + 1.2) * (activa ? 50 : 12)));
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
    g.fillStyle = '#f8fafc';
    g.beginPath();
    g.arc(128, 128, 120, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#1f2937';
    g.stroke();
    g.fillStyle = '#1f2937';
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
    aguja(((d.getHours() % 12) + d.getMinutes() / 60) / 12, 56, 10, '#111827');
    aguja((d.getMinutes() + d.getSeconds() / 60) / 60, 84, 7, '#111827');
    aguja(d.getSeconds() / 60, 92, 3, '#ef4444');
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

function planta(x, z, escala = 1) {
  const g = new THREE.Group();
  g.add(cilindro(0.32, 0.24, 0.55, mat('#e7e1d6', { rugoso: 0.5 }), 0, 0.28, 0));
  const hojas = mat('#3f8f4a', { rugoso: 0.9 });
  for (let i = 0; i < 7; i++) {
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + Math.random() * 0.12, 0), hojas);
    h.position.set((Math.random() - 0.5) * 0.45, 0.75 + Math.random() * 0.55, (Math.random() - 0.5) * 0.45);
    h.castShadow = true;
    g.add(h);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(escala);
  g.userData.balanceo = Math.random() * 6;
  return g;
}

function silla(color) {
  const g = new THREE.Group();
  g.add(cilindro(0.06, 0.06, 0.45, mat('#374151', { metal: 0.6, rugoso: 0.4 }), 0, 0.25, 0, 10));
  g.add(cilindro(0.35, 0.35, 0.05, mat('#1f2937', { metal: 0.5 }), 0, 0.03, 0, 5));
  g.add(caja(0.62, 0.1, 0.58, mat(color, { rugoso: 0.6 }), 0, 0.5, 0, { redondo: 0.04 }));
  g.add(caja(0.6, 0.7, 0.09, mat(color, { rugoso: 0.6 }), 0, 0.9, 0.27, { redondo: 0.04 }));
  return g;
}

/** Un escritorio con su pantalla viva, teclado, taza y lámpara. */
function escritorio(color, tipoPantalla, pantallas) {
  const g = new THREE.Group();
  const madera = mat('#f3efe8', { rugoso: 0.55 });
  g.add(caja(2.4, 0.08, 1.1, madera, 0, 0.78, 0, { redondo: 0.03 }));
  for (const [x, z] of [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]]) g.add(cilindro(0.04, 0.04, 0.76, mat('#4b5563', { metal: 0.7, rugoso: 0.3 }), x, 0.38, z, 8));
  // la pantalla (mira hacia la silla, +z)
  const viva = pantallaViva(tipoPantalla, color);
  pantallas.push(viva);
  g.add(caja(1.25, 0.78, 0.06, mat('#111827', { metal: 0.4, rugoso: 0.4 }), 0, 1.42, -0.3, { redondo: 0.02 }));
  const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.68), new THREE.MeshBasicMaterial({ map: viva.textura, toneMapped: false }));
  pantalla.position.set(0, 1.42, -0.265);
  g.add(pantalla);
  g.add(cilindro(0.04, 0.04, 0.3, mat('#374151', { metal: 0.6 }), 0, 0.97, -0.32, 8));
  g.add(caja(0.4, 0.03, 0.22, mat('#374151'), 0, 0.83, -0.32));
  g.add(caja(0.8, 0.04, 0.26, mat('#e5e7eb', { rugoso: 0.4 }), 0, 0.84, 0.18, { redondo: 0.01 }));
  g.add(caja(0.14, 0.04, 0.2, mat('#e5e7eb'), 0.6, 0.84, 0.2, { redondo: 0.01 }));
  // la taza y la lámpara
  g.add(cilindro(0.08, 0.07, 0.16, mat(color, { rugoso: 0.4 }), -0.85, 0.9, 0.15, 14));
  const lampara = new THREE.Group();
  lampara.add(cilindro(0.12, 0.14, 0.04, mat('#111827'), 0, 0.84, 0, 16));
  lampara.add(cilindro(0.02, 0.02, 0.5, mat('#111827'), 0, 1.08, 0, 8));
  lampara.add(cilindro(0.08, 0.16, 0.16, mat('#111827', { emisivo: '#fff3c4', intensidad: 0.25 }), 0.05, 1.33, 0.05, 16));
  lampara.position.set(0.95, 0, -0.3);
  g.add(lampara);
  return g;
}

// los objetos propios de cada departamento
function objetosDe(id, color) {
  const g = new THREE.Group();
  if (id === 'guion') {
    // una biblioteca con libros de colores y hojas en el piso
    const estante = mat('#8b5e3c', { rugoso: 0.8 });
    g.add(caja(2.2, 2.4, 0.5, estante, -2.2, 1.2, -2.8));
    for (let f = 0; f < 4; f++) {
      g.add(caja(2.1, 0.05, 0.48, mat('#6d4729'), -2.2, 0.35 + f * 0.6, -2.8));
      for (let i = 0; i < 8; i++) g.add(caja(0.18, 0.4 + Math.random() * 0.12, 0.34, mat(['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][(i + f) % 6], { rugoso: 0.7 }), -3.05 + i * 0.24, 0.6 + f * 0.6, -2.75));
    }
    for (let i = 0; i < 5; i++) {
      const hoja = caja(0.3, 0.01, 0.4, mat('#ffffff', { rugoso: 0.9 }), 1.6 + Math.random(), 0.01, 1.4 + Math.random(), { sombra: false });
      hoja.rotation.y = Math.random() * Math.PI;
      g.add(hoja);
    }
  } else if (id === 'arte') {
    // un caballete con un cuadro y una paleta
    const madera = mat('#a16207', { rugoso: 0.8 });
    const pata = (x, z, rx, rz) => {
      const p = cilindro(0.04, 0.04, 2.2, madera, x, 1.05, z, 8);
      p.rotation.set(rx, 0, rz);
      g.add(p);
    };
    pata(-2.6, -2.3, 0.15, 0.12);
    pata(-2.0, -2.3, 0.15, -0.12);
    pata(-2.3, -2.75, -0.35, 0);
    const cuadro = caja(1.0, 0.8, 0.05, mat('#ffffff'), -2.3, 1.55, -2.18);
    g.add(cuadro);
    for (let i = 0; i < 5; i++) g.add(caja(0.7 - i * 0.1, 0.12, 0.01, mat(['#f472b6', '#facc15', '#38bdf8', '#a3e635', '#fb923c'][i], { emisivo: ['#f472b6', '#facc15', '#38bdf8', '#a3e635', '#fb923c'][i], intensidad: 0.15 }), -2.3, 1.85 - i * 0.14, -2.15));
    g.add(planta(2.6, -2.6, 1.1));
  } else if (id === 'video') {
    // una cámara en su trípode, un aro de luz y una claqueta
    const negro = mat('#111827', { metal: 0.5, rugoso: 0.35 });
    for (let i = 0; i < 3; i++) {
      const p = cilindro(0.03, 0.03, 1.6, negro, -2.4 + Math.sin((i / 3) * Math.PI * 2) * 0.25, 0.75, 2.2 + Math.cos((i / 3) * Math.PI * 2) * 0.25, 6);
      p.rotation.z = Math.sin((i / 3) * Math.PI * 2) * 0.18;
      p.rotation.x = -Math.cos((i / 3) * Math.PI * 2) * 0.18;
      g.add(p);
    }
    g.add(caja(0.5, 0.35, 0.7, negro, -2.4, 1.65, 2.2, { redondo: 0.05 }));
    g.add(cilindro(0.14, 0.17, 0.3, negro, -2.4, 1.65, 1.78, 18).rotateX(Math.PI / 2));
    const luzRoja = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
    luzRoja.position.set(-2.25, 1.86, 2.0);
    luzRoja.userData.parpadea = true;
    g.add(luzRoja);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 12, 48), mat('#ffffff', { emisivo: '#ffffff', intensidad: 1.4 }));
    aro.position.set(2.6, 1.9, -2.6);
    g.add(aro);
    g.add(cilindro(0.03, 0.03, 1.4, negro, 2.6, 0.7, -2.6, 6));
    const claqueta = caja(0.5, 0.04, 0.4, mat('#111827'), 1.6, 0.86, 0.1);
    g.add(claqueta);
  } else if (id === 'edicion') {
    // una segunda pantalla ancha y un sofá
    g.add(caja(2.4, 0.5, 0.9, mat('#6b7280', { rugoso: 0.9 }), 2.4, 0.3, 2.6, { redondo: 0.15 }));
    g.add(caja(2.4, 0.6, 0.25, mat('#6b7280', { rugoso: 0.9 }), 2.4, 0.75, 3.0, { redondo: 0.1 }));
    g.add(caja(0.4, 0.4, 0.4, mat(color, { rugoso: 0.9 }), 1.6, 0.7, 2.5, { redondo: 0.12 }));
  } else if (id === 'calidad') {
    // un tablero de control con luces verdes y una lupa gigante
    g.add(caja(2.2, 1.3, 0.1, mat('#1f2937'), -2.3, 1.6, -3.1));
    for (let i = 0; i < 12; i++) {
      const luz = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshBasicMaterial({ color: i % 5 === 3 ? '#facc15' : '#4ade80' }));
      luz.position.set(-3.1 + (i % 4) * 0.5, 2.0 - Math.floor(i / 4) * 0.35, -3.04);
      luz.userData.parpadea = i % 3 === 0;
      g.add(luz);
    }
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 12, 40), mat('#d4af37', { metal: 0.8, rugoso: 0.25 }));
    aro.position.set(2.4, 1.1, 2.4);
    aro.rotation.y = -0.6;
    g.add(aro);
    const vidrio = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), mat('#bae6fd', { opacidad: 0.35, rugoso: 0.05 }));
    vidrio.position.copy(aro.position);
    vidrio.rotation.y = -0.6;
    g.add(vidrio);
    const mango = cilindro(0.06, 0.06, 0.9, mat('#111827'), 2.4, 0.45, 2.4, 10);
    g.add(mango);
  } else if (id === 'investigacion') {
    // un telescopio hacia la ventana y un globo terráqueo
    const bronce = mat('#b45309', { metal: 0.7, rugoso: 0.3 });
    for (let i = 0; i < 3; i++) {
      const p = cilindro(0.03, 0.03, 1.3, mat('#374151'), -2.5 + Math.sin((i / 3) * 6.28) * 0.25, 0.6, -2.4 + Math.cos((i / 3) * 6.28) * 0.25, 6);
      p.rotation.z = Math.sin((i / 3) * 6.28) * 0.2;
      g.add(p);
    }
    const tubo = cilindro(0.12, 0.18, 1.5, bronce, -2.5, 1.45, -2.4, 18);
    tubo.rotation.set(-0.9, 0, 0.4);
    g.add(tubo);
    const globo = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 20), mat('#2563eb', { rugoso: 0.5 }));
    globo.position.set(2.4, 1.25, 2.3);
    globo.userData.gira = true;
    g.add(globo);
    const tierra = new THREE.Mesh(new THREE.SphereGeometry(0.385, 16, 10), new THREE.MeshStandardMaterial({ color: '#22c55e', wireframe: true }));
    globo.add(tierra);
    g.add(cilindro(0.06, 0.2, 0.8, bronce, 2.4, 0.45, 2.3, 16));
  } else if (id === 'coordinacion') {
    // una mesa de reuniones, un pizarrón y el reloj
    g.add(caja(3.2, 0.08, 1.4, mat('#f3efe8', { rugoso: 0.45 }), 0, 0.76, 2.2, { redondo: 0.04 }));
    g.add(cilindro(0.1, 0.25, 0.74, mat('#374151', { metal: 0.6 }), -1.1, 0.37, 2.2, 12));
    g.add(cilindro(0.1, 0.25, 0.74, mat('#374151', { metal: 0.6 }), 1.1, 0.37, 2.2, 12));
    for (const x of [-1.1, 0, 1.1]) {
      const s = silla('#334155');
      s.position.set(x, 0, 3.2);
      s.scale.setScalar(0.85);
      g.add(s);
    }
    const pizarra = caja(2.4, 1.3, 0.06, mat('#f8fafc', { rugoso: 0.3 }), 2.2, 1.7, -3.15);
    g.add(pizarra);
    for (let i = 0; i < 4; i++) g.add(caja(0.5, 0.35, 0.01, mat(['#fde047', '#86efac', '#93c5fd', '#f9a8d4'][i], { rugoso: 0.9 }), 1.4 + (i % 2) * 0.7, 1.95 - Math.floor(i / 2) * 0.45, -3.1));
  }
  return g;
}

// ---------------------------------------------------------------- los agentes

function agente(datos, i) {
  const g = new THREE.Group();
  const color = datos.color || '#94a3b8';
  const piel = mat(PIELES[i % PIELES.length], { rugoso: 0.65 });
  const ropa = mat(color, { rugoso: 0.55 });
  const pantalon = mat('#1f2937', { rugoso: 0.8 });
  const partes = {};
  // las piernas (giran desde la cadera)
  for (const lado of [-1, 1]) {
    const cadera = new THREE.Group();
    cadera.position.set(lado * 0.13, 0.78, 0);
    const pierna = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), pantalon);
    pierna.position.y = -0.36;
    pierna.castShadow = true;
    cadera.add(pierna);
    const zapato = caja(0.16, 0.08, 0.26, mat('#0f172a'), 0, -0.72, 0.05);
    cadera.add(zapato);
    g.add(cadera);
    partes[lado < 0 ? 'piernaI' : 'piernaD'] = cadera;
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.5, 6, 16), ropa);
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);
  partes.torso = torso;
  // los brazos (giran desde el hombro)
  for (const lado of [-1, 1]) {
    const hombro = new THREE.Group();
    hombro.position.set(lado * 0.36, 1.42, 0);
    const brazo = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 10), ropa);
    brazo.position.y = -0.27;
    brazo.castShadow = true;
    hombro.add(brazo);
    const mano = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), piel);
    mano.position.y = -0.55;
    hombro.add(mano);
    g.add(hombro);
    partes[lado < 0 ? 'brazoI' : 'brazoD'] = hombro;
  }
  const cabeza = new THREE.Group();
  cabeza.position.y = 1.86;
  const cara = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 18), piel);
  cara.castShadow = true;
  cabeza.add(cara);
  const pelo = new THREE.Mesh(new THREE.SphereGeometry(0.275, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(PELOS[i % PELOS.length], { rugoso: 0.9 }));
  pelo.rotation.x = -0.25;
  cabeza.add(pelo);
  for (const lado of [-1, 1]) {
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#111827'));
    ojo.position.set(lado * 0.09, 0.03, 0.235);
    cabeza.add(ojo);
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
  g.userData = { id: datos.id, partes, fase: i * 1.7 };
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

// ---------------------------------------------------------------- la escena

export function Oficina3D({ agentes, elegido, onElegir }) {
  const caja3d = useRef(null);
  const estado = useRef({ agentes: [], elegido: null });
  const elegir = useRef(onElegir);
  elegir.current = onElegir;
  estado.current.agentes = agentes || [];
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
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    raiz.appendChild(renderer.domElement);
    const etiquetas = new CSS2DRenderer();
    etiquetas.domElement.className = 'o3-capa';
    raiz.appendChild(etiquetas.domElement);

    const escena = new THREE.Scene();
    const hora = new Date().getHours();
    const deNoche = hora >= 19 || hora < 6;
    escena.background = new THREE.Color(deNoche ? '#0b1220' : '#16233a');
    escena.fog = new THREE.Fog(escena.background, 60, 120);

    const camara = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
    camara.position.set(21, 25, 28);
    const controles = new OrbitControls(camara, etiquetas.domElement);
    controles.target.set(0, 0, 0.8);
    controles.enableDamping = true;
    controles.dampingFactor = 0.08;
    controles.minDistance = 12;
    controles.maxDistance = 70;
    controles.maxPolarAngle = 1.25;
    controles.minPolarAngle = 0.35;
    controles.enablePan = true;
    controles.screenSpacePanning = false;

    // luces: el cielo, el sol (con sombras) y un relleno cálido
    escena.add(new THREE.HemisphereLight('#dbeafe', '#3b2f2a', deNoche ? 0.55 : 0.85));
    const sol = new THREE.DirectionalLight('#fff4e0', deNoche ? 1.4 : 2.2);
    sol.position.set(18, 32, 14);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.camera.left = -22;
    sol.shadow.camera.right = 22;
    sol.shadow.camera.top = 22;
    sol.shadow.camera.bottom = -22;
    sol.shadow.bias = -0.0004;
    sol.shadow.normalBias = 0.02;
    escena.add(sol);
    const relleno = new THREE.PointLight('#ffd7a0', 30, 40, 2);
    relleno.position.set(-8, 10, 12);
    escena.add(relleno);

    // la base del edificio, flotando
    const ancho = 3 * SALA + 2 * PASILLO + 2.4;
    const base = caja(ancho, 1.4, ancho, mat('#1e293b', { rugoso: 0.6 }), 0, -0.72, 0, { redondo: 0.3 });
    escena.add(base);
    const borde = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.08, 0.06, ancho + 0.08), new THREE.MeshBasicMaterial({ color: '#a3e635' }));
    borde.position.y = -1.36;
    escena.add(borde);
    const pasillo = caja(ancho - 0.6, 0.06, ancho - 0.6, mat('#cbd5e1', { rugoso: 0.35, metal: 0.1 }), 0, 0.0, 0, { sombra: false });
    escena.add(pasillo);
    // el logo del estudio en la entrada
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: texturaLetrero('Kads Studio', '#a3e635'), transparent: true }));
    logo.position.set(0, 0.06, ancho / 2 - 0.5);
    logo.rotation.x = -Math.PI / 2;
    escena.add(logo);

    const pantallas = [];
    const animados = []; // plantas, luces que parpadean, globo
    const asientos = {}; // id -> { silla: Vector3, frente: Vector3, centro: Vector3 }
    const construirSala = (id, nombre, color, c, anchoSalas = 1) => {
      const w = SALA * anchoSalas + PASILLO * (anchoSalas - 1);
      const sala = new THREE.Group();
      sala.position.copy(c);
      const piso = caja(w, 0.12, SALA, new THREE.MeshStandardMaterial({ map: texturaPiso(color), roughness: 0.7 }), 0, 0.06, 0, { sombra: false });
      sala.add(piso);
      // las paredes de vidrio (atrás e izquierda) con su moldura de color
      const vidrio = mat('#bfdbfe', { opacidad: 0.18, rugoso: 0.05, metal: 0.2 });
      const moldura = mat(color, { emisivo: color, intensidad: 0.35, rugoso: 0.4 });
      sala.add(caja(w, 2.2, 0.08, vidrio, 0, 1.22, -SALA / 2 + 0.04, { sombra: false }));
      sala.add(caja(w, 0.12, 0.14, moldura, 0, 2.36, -SALA / 2 + 0.04));
      sala.add(caja(0.08, 2.2, SALA, vidrio, -w / 2 + 0.04, 1.22, 0, { sombra: false }));
      sala.add(caja(0.14, 0.12, SALA, moldura, -w / 2 + 0.04, 2.36, 0));
      // el zócalo de las paredes
      sala.add(caja(w, 0.18, 0.12, mat('#e2e8f0'), 0, 0.2, -SALA / 2 + 0.06));
      sala.add(caja(0.12, 0.18, SALA, mat('#e2e8f0'), -w / 2 + 0.06, 0.2, 0));
      // el letrero
      const letrero = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: texturaLetrero(nombre, color), transparent: true }));
      letrero.position.set(0, 2.85, -SALA / 2 + 0.05);
      sala.add(letrero);
      // la luz de la sala
      const luz = new THREE.PointLight(color, 6, 9, 2);
      luz.position.set(0, 3.2, 0);
      sala.add(luz);
      escena.add(sala);
      return sala;
    };

    const tiposPantalla = { guion: 'codigo', arte: 'imagen', video: 'onda', edicion: 'onda', calidad: 'barras', investigacion: 'barras', coordinacion: 'barras' };
    const reloj = relojVivo();
    for (const a of estado.current.agentes) {
      const pos = PLANTA[a.id];
      if (!pos) continue;
      const c = centro(pos[0], pos[1]);
      const sala = construirSala(a.id, a.depto || a.rol, a.color, c);
      const mesa = escritorio(a.color, tiposPantalla[a.id] || 'codigo', pantallas);
      mesa.position.set(0.6, 0, -1.4);
      sala.add(mesa);
      const s = silla('#334155');
      s.position.set(0.6, 0, -0.35);
      sala.add(s);
      sala.add(objetosDe(a.id, a.color));
      const p = planta(SALA / 2 - 0.7, -SALA / 2 + 0.7);
      sala.add(p);
      animados.push(p);
      sala.traverse((o) => {
        if (o.userData?.parpadea || o.userData?.gira) animados.push(o);
      });
      if (a.id === 'coordinacion') {
        const r = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshBasicMaterial({ map: reloj.textura, transparent: true }));
        r.position.set(-1.6, 2.0, -SALA / 2 + 0.1);
        sala.add(r);
      }
      asientos[a.id] = { silla: c.clone().add(new THREE.Vector3(0.6, 0, -0.45)), frente: c.clone().add(new THREE.Vector3(0.6, 0, 0.9)), centro: c.clone() };
    }

    // el café: barra, cafetera con vapor, taburetes, sofá y plantas
    const cafe = construirSala('cafe', 'Café', '#f59e0b', centro(CAFE.col, CAFE.fila, CAFE.ancho), CAFE.ancho);
    cafe.add(caja(5, 1.05, 0.9, mat('#78350f', { rugoso: 0.7 }), -2.5, 0.52, -2.7, { redondo: 0.05 }));
    cafe.add(caja(5.1, 0.08, 1.0, mat('#e7e5e4', { rugoso: 0.3 }), -2.5, 1.08, -2.7));
    const cafetera = caja(0.6, 0.75, 0.5, mat('#9ca3af', { metal: 0.85, rugoso: 0.25 }), -4.2, 1.5, -2.8, { redondo: 0.06 });
    cafe.add(cafetera);
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Group();
      t.add(cilindro(0.04, 0.04, 0.8, mat('#374151', { metal: 0.6 }), 0, 0.4, 0, 8));
      t.add(cilindro(0.24, 0.24, 0.08, mat('#f59e0b', { rugoso: 0.5 }), 0, 0.82, 0, 18));
      t.position.set(-4.2 + i * 1.2, 0, -1.8);
      cafe.add(t);
    }
    cafe.add(caja(3.2, 0.55, 1.1, mat('#0f766e', { rugoso: 0.85 }), 3.6, 0.35, 2.4, { redondo: 0.18 }));
    cafe.add(caja(3.2, 0.7, 0.3, mat('#0f766e', { rugoso: 0.85 }), 3.6, 0.85, 2.85, { redondo: 0.12 }));
    cafe.add(caja(1.4, 0.06, 0.8, mat('#f3efe8'), 3.6, 0.5, 1.4, { redondo: 0.03 }));
    for (const [x, z] of [[6.6, -2.6], [-6.4, 2.6], [0.6, 2.8]]) {
      const p = planta(x, z, 1.25);
      cafe.add(p);
      animados.push(p);
    }
    const puntoCafe = centro(CAFE.col, CAFE.fila, CAFE.ancho).add(new THREE.Vector3(-2.5, 0, -1.3));
    // el vapor del café
    const vapor = [];
    const matVapor = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const v = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), matVapor.clone());
      v.userData.t = i / 10;
      cafe.add(v);
      vapor.push(v);
    }
    const bocaCafe = new THREE.Vector3(-4.2, 1.9, -2.6);

    // el robot aspiradora
    const robot = new THREE.Group();
    robot.add(cilindro(0.32, 0.34, 0.12, mat('#e5e7eb', { metal: 0.3, rugoso: 0.35 }), 0, 0.12, 0, 28));
    const ojoRobot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#22d3ee' }));
    ojoRobot.position.set(0, 0.19, 0.22);
    robot.add(ojoRobot);
    escena.add(robot);

    // motas de luz
    const motas = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 240 }, (_, i) => (i % 3 === 1 ? Math.random() * 14 + 1 : (Math.random() - 0.5) * 50)), 3)),
      new THREE.PointsMaterial({ color: '#a3e635', size: 0.08, transparent: true, opacity: 0.6, depthWrite: false })
    );
    escena.add(motas);

    // los paquetes de trabajo que la coordinadora reparte
    const paquetes = [];
    const matPaquete = new THREE.MeshBasicMaterial({ color: '#a3e635' });
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
      personajes.set(a.id, { g, el, destino: null, espera: Math.random() * 3, andando: false });
    });

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
    const objetivoCam = new THREE.Vector3(0, 0, 1.5);
    let enfocado = null;
    const tmp = new THREE.Vector3();
    const enXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

    const actualizarEtiquetas = () => {
      for (const a of estado.current.agentes) {
        const p = personajes.get(a.id);
        if (!p) continue;
        const burbuja = a.estado === 'te-necesita' ? a.necesita?.[0]?.titulo : a.estado === 'trabajando' ? a.ahora?.[0]?.titulo : '';
        const clave = `${a.nombre}|${a.avatar}|${a.estado}|${burbuja}|${estado.current.elegido === a.id}`;
        if (p.el.dataset.clave === clave) continue;
        p.el.dataset.clave = clave;
        p.el.className = `o3-etiqueta o3-etiqueta--${a.estado}${estado.current.elegido === a.id ? ' o3-etiqueta--elegida' : ''}`;
        p.el.style.setProperty('--color', a.color);
        p.el.querySelector('.o3-cara').textContent = a.avatar || '🙂';
        p.el.querySelector('.o3-nombre').textContent = a.nombre;
        const b = p.el.querySelector('.o3-burbuja');
        b.textContent = burbuja || '';
        b.hidden = !burbuja;
        p.el.setAttribute('aria-label', `${a.nombre}: ${a.estado === 'te-necesita' ? 'te necesita' : a.estado}`);
        const anillo = p.g.userData.partes.anillo;
        anillo.material.color.set(a.estado === 'te-necesita' ? '#ef4444' : a.estado === 'trabajando' ? '#4ade80' : estado.current.elegido === a.id ? a.color : '#64748b');
        p.g.userData.partes.alerta.visible = a.estado === 'te-necesita';
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
        const ids = Object.keys(PLANTA);
        pantallas.forEach((p, k) => p.dibujar(trabajando.has(ids[k]) || Math.random() < 0.05));
      }
      if (t - ultimoReloj > 1) {
        ultimoReloj = t;
        reloj.dibujar();
      }

      // los agentes
      for (const a of lista) {
        const p = personajes.get(a.id);
        const asiento = asientos[a.id];
        if (!p || !asiento) continue;
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
            g.position.y = -0.32; // sentado
            partes.piernaI.rotation.x = partes.piernaD.rotation.x = -1.35;
            partes.brazoI.rotation.x = -1.2 + Math.sin(t * 14 + fase) * 0.12;
            partes.brazoD.rotation.x = -1.2 + Math.sin(t * 14 + fase + 1.6) * 0.12;
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
            partes.brazoD.rotation.x = -2.8;
            partes.brazoD.rotation.z = Math.sin(t * 8 + fase) * 0.5;
            partes.brazoI.rotation.x = 0;
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
              const alCafe = Math.random() < 0.3;
              p.destino = alCafe
                ? puntoCafe.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 1.2))
                : asiento.centro.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4.2, 0, 0.4 + Math.random() * 2.4));
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
            partes.piernaI.rotation.x = Math.sin(t * 9 + fase) * 0.6;
            partes.piernaD.rotation.x = -Math.sin(t * 9 + fase) * 0.6;
            if (a.estado !== 'te-necesita') {
              partes.brazoI.rotation.x = -Math.sin(t * 9 + fase) * 0.5;
              partes.brazoD.rotation.x = Math.sin(t * 9 + fase) * 0.5;
              partes.brazoD.rotation.z = 0;
            }
          } else if (a.estado === 'libre') {
            g.position.y = 0;
            partes.piernaI.rotation.x = partes.piernaD.rotation.x = 0;
            partes.brazoI.rotation.x = Math.sin(t * 1.5 + fase) * 0.05;
            partes.brazoD.rotation.x = -Math.sin(t * 1.5 + fase) * 0.05;
            partes.cabeza.rotation.y = Math.sin(t * 0.7 + fase) * 0.4;
          }
        }
        // la respiración
        partes.torso.scale.y = 1 + Math.sin(t * 2.4 + fase) * 0.015;
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
        v.position.set(bocaCafe.x + Math.sin(k * 8 + v.id) * 0.1, bocaCafe.y + k * 1.2, bocaCafe.z);
        v.scale.setScalar(0.6 + k * 1.6);
        v.material.opacity = 0.45 * (1 - k);
      }
      for (const o of animados) {
        if (o.userData.balanceo !== undefined) o.rotation.z = Math.sin(t * 0.8 + o.userData.balanceo) * 0.03;
        if (o.userData.parpadea) o.visible = Math.sin(t * 3 + o.id) > -0.3;
        if (o.userData.gira) o.rotation.y += dt * 0.4;
      }
      // (por los pasillos: un cuadrado alrededor de la sala del medio)
      const m = SALA / 2 + PASILLO / 2;
      const k = (t * 0.035) % 1;
      const lado = Math.floor(k * 4);
      const f = (k * 4) % 1;
      const esquinas = [[-m, -m], [m, -m], [m, m], [-m, m]];
      const [x0, z0] = esquinas[lado];
      const [x1, z1] = esquinas[(lado + 1) % 4];
      robot.position.set(x0 + (x1 - x0) * f, 0.03, z0 + (z1 - z0) * f);
      robot.rotation.y = Math.atan2(x1 - x0, z1 - z0);
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
        controles.userData = { hacia: new THREE.Vector3(21, 25, 28) };
      } else if (controles.userData?.hacia) {
        controles.target.lerp(objetivoCam.set(0, 0, 0.8), dt * 2.5);
        camara.position.lerp(controles.userData.hacia, dt * 2);
        if (camara.position.distanceTo(controles.userData.hacia) < 0.3) controles.userData = {};
      }
      controles.update();
      renderer.render(escena, camara);
      etiquetas.render(escena, camara);
    };
    animar();

    return () => {
      cancelAnimationFrame(marco);
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
  }, [(agentes || []).map((a) => a.id).join(',')]);

  return <div className="o3" ref={caja3d} />;
}
