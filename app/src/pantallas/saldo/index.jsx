// SALDO Y COSTOS (#/saldo), como en IA-VID-AUTOMATIC: el saldo de kie.ai (imágenes, videos y música), lo que queda del
// plan de ElevenLabs (la voz) y lo que llevas invertido en tus anuncios, por producto. Solo lee: no cobra nada.
// Sin costos estimados: solo lo que hay en tus cuentas y lo que ya gastaste de verdad.
import { useState } from 'react';
import { ArrowUpRight, CircleAlert, KeyRound, Mic, RefreshCw, Sparkles, Wallet } from 'lucide-react';
import { Boton, CabeceraPagina, Esqueleto } from '../../componentes/index.js';
import { useDatos } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { Inversion } from '../ajustes/Inversion.jsx';
import { leerSaldo, useSaldo } from '../../datos/saldo.js';
import '../ajustes/ajustes.css';
import './saldo.css';

const usd = (n) => `US$${(Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const miles = (n) => (Number(n) || 0).toLocaleString('es-ES');

function Aviso({ texto }) {
  return (
    <p className="sd-aviso" role="alert">
      <CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
      {texto}
    </p>
  );
}

function TarjetaKie({ kie, cargando }) {
  return (
    <div className="sd-tarjeta sd-tarjeta--marca">
      <span className="sd-tarjeta__titulo">
        <Wallet size={16} strokeWidth={2} aria-hidden="true" /> Generador visual · kie.ai
      </span>
      {cargando && !kie ? (
        <Esqueleto alto={44} ancho={160} />
      ) : kie?.creditos != null ? (
        <>
          <strong className="sd-tarjeta__cifra">{usd(kie.dolares)}</strong>
          <span className="sd-tarjeta__sub">{miles(kie.creditos)} créditos · imágenes, videos y música</span>
        </>
      ) : (
        <>
          <strong className="sd-tarjeta__cifra">—</strong>
          {kie?.error ? <Aviso texto={kie.error} /> : null}
        </>
      )}
      <a className="sd-tarjeta__enlace" href="https://kie.ai/billing" target="_blank" rel="noreferrer">
        Cargar saldo <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
      </a>
    </div>
  );
}

function TarjetaVoz({ voz, cargando }) {
  const limite = voz?.limite || 0;
  const usados = voz?.usados || 0;
  const parte = limite ? Math.min(1, usados / limite) : 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="sd-tarjeta">
      <span className="sd-tarjeta__titulo">
        <Mic size={16} strokeWidth={2} aria-hidden="true" /> Generador de voz · ElevenLabs
      </span>
      {cargando && !voz ? (
        <Esqueleto alto={120} />
      ) : voz?.error ? (
        <Aviso texto={voz.error} />
      ) : (
        <div className="sd-voz">
          <svg width="128" height="128" viewBox="0 0 128 128" className="sd-anillo" aria-hidden="true">
            <circle cx="64" cy="64" r={R} className="sd-anillo__fondo" />
            <circle cx="64" cy="64" r={R} className="sd-anillo__lleno" strokeDasharray={C} strokeDashoffset={C * (1 - parte)} />
            <text x="64" y="62" textAnchor="middle" className="sd-anillo__cifra">
              {limite ? `${Math.round(parte * 100)}%` : '—'}
            </text>
            <text x="64" y="80" textAnchor="middle" className="sd-anillo__texto">
              usado
            </text>
          </svg>
          <div className="sd-voz__datos">
            <strong>{miles(Math.max(0, limite - usados))}</strong>
            <span className="sd-tarjeta__sub">caracteres libres de {miles(limite)}</span>
            {voz?.plan ? <span className="sd-tarjeta__sub">Plan {voz.plan}</span> : null}
            {voz?.renueva ? <span className="sd-tarjeta__sub">Se renueva el {new Date(voz.renueva).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</span> : null}
          </div>
        </div>
      )}
      <a className="sd-tarjeta__enlace" href="https://elevenlabs.io/app/subscription" target="_blank" rel="noreferrer">
        Ver mi plan <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
      </a>
    </div>
  );
}

async function leerInversion() {
  const r = await fetch('/api/inversion', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No pude leer lo invertido.');
  return r.json();
}

function TarjetaGastado() {
  const { datos, cargando } = useDatos('inversion', leerInversion);
  const productos = datos?.productos?.length || 0;
  const anuncios = (datos?.productos || []).reduce((n, p) => n + (p.anuncios?.length || 0), 0);
  return (
    <div className="sd-tarjeta">
      <span className="sd-tarjeta__titulo">
        <Sparkles size={16} strokeWidth={2} aria-hidden="true" /> Gastado en anuncios
      </span>
      {cargando && !datos ? (
        <Esqueleto alto={44} ancho={140} />
      ) : (
        <>
          <strong className="sd-tarjeta__cifra sd-tarjeta__cifra--lima">{usd(datos?.total)}</strong>
          <span className="sd-tarjeta__sub">
            en {anuncios} {anuncios === 1 ? 'anuncio' : 'anuncios'} de {productos} {productos === 1 ? 'producto' : 'productos'}
          </span>
        </>
      )}
    </div>
  );
}

export default function Saldo() {
  const { datos, cargando, recargar } = useSaldo();
  const [refrescando, setRefrescando] = useState(false);
  const refrescar = async () => {
    setRefrescando(true);
    try {
      await leerSaldo({ fresco: true });
      await recargar?.();
    } finally {
      setRefrescando(false);
    }
  };
  return (
    <div className="pagina sd">
      <CabeceraPagina
        titulo="Saldo y costos"
        descripcion="Tu saldo del generador visual, lo que queda de tu plan de voz y lo que llevas gastado en tus anuncios."
        acciones={
          <>
            <Boton variante="secundario" icono={KeyRound} href={`${enlace.ajustes()}`}>
              Cambiar claves
            </Boton>
            <Boton variante="secundario" icono={RefreshCw} onClick={refrescar} cargando={refrescando}>
              Actualizar
            </Boton>
          </>
        }
      />
      {datos?.kie?.simulado ? <p className="sd-nota">Modo prueba: estos saldos son de los simuladores, no de tus cuentas.</p> : null}
      <div className="sd-rejilla">
        <TarjetaKie kie={datos?.kie} cargando={cargando} />
        <TarjetaVoz voz={datos?.elevenlabs} cargando={cargando} />
        <TarjetaGastado />
      </div>
      <Inversion />
    </div>
  );
}
