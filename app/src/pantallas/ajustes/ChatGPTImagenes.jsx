// Ajustes › Conexiones › «ChatGPT · Imágenes»: las imágenes de los anuncios de imagen con tu suscripción de ChatGPT
// (Codex, sin costo por imagen) o con kie.ai (se cobra cada una). Es aparte de la IA que escribe: puedes escribir con
// Claude y hacer las imágenes con ChatGPT. Conectar usa /api/ia/instalar y /api/ia/login con 'codex' (no cambia tu IA).
//
//   useMotorImagenes() -> { motor, chatgpt, login, instalando, conectado, revisando, recargar, elegir(id) }
//   TarjetaChatGPTImagenes()
import { useEffect, useState } from 'react';
import { Download, Image as IconoImagen, LogIn, RefreshCw } from 'lucide-react';
import { Boton, Insignia, Tarjeta, Tooltip, useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';
import { DetalleLoginCodex, AccionesLoginCodex, textoErrorLogin } from './Conexiones.jsx';
import { avisarConexiones } from './datos.js';

const CLAVE = 'imagenes-motor';
const cargar = () => pedirNuevo('/api/imagenes/motor');

export function useMotorImagenes() {
  const [cadaMs, setCadaMs] = useState(undefined);
  const { datos, cargando, recargar } = useDatos(CLAVE, cargar, { cadaMs });
  const enMarcha = Boolean(datos?.login?.enCurso || (datos?.instalando && !datos.instalando.error));
  useEffect(() => setCadaMs(enMarcha ? 3000 : undefined), [enMarcha]);
  const c = datos?.chatgpt || null;
  const conectado = Boolean(c?.instalado && !c?.actualizar && c?.sesion === 'ok');
  const elegir = async (motor) => {
    await pedirNuevo('/api/imagenes/motor', { metodo: 'PUT', cuerpo: { motor } });
    invalidar(CLAVE);
    invalidar('imagen-ads'); // el costo del formulario cambia
    await recargar();
  };
  return {
    motor: datos?.motor || null,
    chatgpt: c,
    login: datos?.login || null,
    instalando: datos?.instalando || null,
    conectado,
    revisando: cargando && !datos,
    recargar,
    elegir,
  };
}

const hora = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString('es-CO', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
};

function Cupo({ limites }) {
  if (!limites) return null;
  const libre5 = limites.usado5h === null ? null : 100 - limites.usado5h;
  return (
    <p className="conexion-bloque__texto">
      Cupo de tu ChatGPT: {libre5 === null ? 'sin datos' : `te queda ${libre5}% de las 5 horas`}
      {limites.renueva5h ? ` (se renueva ${hora(limites.renueva5h)})` : ''}
      {limites.usadoSemana !== null ? ` · usaste ${limites.usadoSemana}% de la semana` : ''}. Cada imagen gasta más o menos 1% de las 5 horas.
    </p>
  );
}

export function TarjetaChatGPTImagenes() {
  const m = useMotorImagenes();
  const { aviso } = useAvisos();
  const [ocupado, setOcupado] = useState(null);
  const c = m.chatgpt;

  const accion = async (que, fn) => {
    setOcupado(que);
    try {
      await fn();
    } catch (e) {
      aviso({ tipo: 'error', titulo: que === 'instalar' ? 'No pude instalar Codex' : que === 'elegir' ? 'No pude guardar tu elección' : 'No pude abrir el inicio de sesión', texto: e.message });
    } finally {
      setOcupado(null);
      avisarConexiones();
      m.recargar();
    }
  };
  const instalar = () => accion('instalar', () => pedirNuevo('/api/ia/instalar', { metodo: 'POST', cuerpo: { motor: 'codex' } }));
  const conectar = (conCodigo = false) =>
    accion('login', () => pedirNuevo('/api/ia/login', { metodo: 'POST', cuerpo: { motor: 'codex', ...(conCodigo ? { conCodigo: true } : {}) } }));
  const elegir = (id) => accion('elegir', () => m.elegir(id));

  // lo que esperan DetalleLoginCodex y AccionesLoginCodex (los mismos de «Tu IA»)
  const comoMotor = {
    id: 'codex',
    login: m.login,
    porPuerto: false,
    sinCodigo: false,
    iniciarSesion: ({ conCodigo } = {}) => conectar(conCodigo),
    cancelarLogin: async () => {
      try {
        await pedirNuevo('/api/ia/login/cancelar', { metodo: 'POST', cuerpo: {} });
      } finally {
        m.recargar();
      }
    },
  };

  let detalle;
  let acciones;
  if (m.revisando) {
    detalle = 'Revisando…';
    acciones = null;
  } else if (!c?.instalado || c?.actualizar) {
    const instalandoAhora = Boolean(m.instalando && !m.instalando.error);
    detalle = instalandoAhora ? m.instalando.fase || 'Instalando Codex…' : 'Falta Codex, el programa de ChatGPT, en esta PC (unos 150 MB).';
    acciones = (
      <Boton variante="primario" tamano="chico" icono={Download} cargando={instalandoAhora || ocupado === 'instalar'} onClick={instalar}>
        Instalar
      </Boton>
    );
  } else if (m.conectado) {
    detalle = `Conectado${c.plan ? ` con tu plan ${c.plan.charAt(0).toUpperCase()}${c.plan.slice(1)}` : ''}.`;
    acciones = <Insignia estado="listo" texto="Conectado" />;
  } else if (m.login?.enCurso) {
    detalle = <DetalleLoginCodex motor={comoMotor} />;
    acciones = <AccionesLoginCodex motor={comoMotor} />;
  } else {
    detalle = textoErrorLogin(comoMotor) || (c?.sesion === 'desconocido' ? 'No pude comprobar tu sesión todavía.' : 'Inicia sesión con tu cuenta de ChatGPT (Plus o Pro).');
    acciones = (
      <>
        {c?.sesion === 'desconocido' ? (
          <Tooltip texto="Volver a revisar">
            <Boton variante="fantasma" tamano="chico" soloIcono icono={RefreshCw} etiqueta="Volver a revisar" onClick={() => m.recargar()} />
          </Tooltip>
        ) : null}
        <Boton variante="primario" tamano="chico" icono={LogIn} cargando={ocupado === 'login'} onClick={() => conectar(false)}>
          Conectar
        </Boton>
      </>
    );
  }

  const conKie = m.motor === 'kie';
  return (
    <Tarjeta className="conexion-bloque">
      <div className="conexion-bloque__cabecera">
        <div className="pila" style={{ '--hueco': '4px' }}>
          <span className="t-etiqueta">Imágenes</span>
          <h3 className="conexion-bloque__titulo">ChatGPT · Imágenes</h3>
          <p className="conexion-bloque__texto">
            Las imágenes de tus anuncios de imagen las hace tu suscripción de ChatGPT: <strong>sin costo por imagen</strong>. Los guiones y los textos los sigue escribiendo tu IA.
          </p>
        </div>
      </div>
      <div className="claude-fila">
        <span className={`claude-fila__icono${m.conectado ? ' claude-fila__icono--ok' : ''}`} aria-hidden="true">
          <IconoImagen size={17} strokeWidth={2} />
        </span>
        <span className="claude-fila__textos">
          <span className="claude-fila__titulo">Tu cuenta de ChatGPT</span>
          <span className="claude-fila__detalle">{detalle}</span>
        </span>
        <span className="claude-fila__acciones">{acciones}</span>
      </div>
      {m.conectado ? <Cupo limites={c.limites} /> : null}
      <div className="claude-fila">
        <span className="claude-fila__textos">
          <span className="claude-fila__titulo">{conKie ? 'Ahora: kie.ai (se cobra cada imagen)' : 'Ahora: tu ChatGPT (sin costo por imagen)'}</span>
          <span className="claude-fila__detalle">
            {conKie
              ? 'Las imágenes se hacen con GPT Image 2.5 en kie.ai y se descuentan de tu saldo.'
              : 'kie.ai queda apagado para las imágenes de anuncios. Úsalo solo si se te acaba el cupo de ChatGPT y no quieres esperar.'}
          </span>
        </span>
        <span className="claude-fila__acciones">
          <Boton variante={conKie ? 'primario' : 'fantasma'} tamano="chico" cargando={ocupado === 'elegir'} onClick={() => elegir(conKie ? 'chatgpt' : 'kie')}>
            {conKie ? 'Usar mi ChatGPT' : 'Usar kie.ai'}
          </Boton>
        </span>
      </div>
    </Tarjeta>
  );
}
