// Piezas propias de Ajustes y de la Bienvenida (no son compartidas con otras pantallas).
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Check, Eye, EyeOff, KeyRound, LoaderCircle, PlugZap, TriangleAlert, X } from 'lucide-react';
import { Boton, Insignia, Tooltip, useAvisos } from '../../componentes/index.js';
import { apiAjustes } from './datos.js';

/** Cuadrito con el icono de un servicio (kie.ai, ElevenLabs, tu IA). */
export function Marca({ icono: Icono, tono = 'acento', tamano = 'normal', apagada = false }) {
  return (
    <span className={`marca-servicio marca-servicio--${tono} marca-servicio--${tamano}${apagada ? ' marca-servicio--apagada' : ''}`} aria-hidden="true">
      <Icono size={tamano === 'grande' ? 24 : tamano === 'chico' ? 16 : 20} strokeWidth={1.9} />
    </span>
  );
}

/** "Guardada" o "Falta". null = todavía revisando (nunca dice "Falta" antes de saber). */
export function EstadoClave({ guardada }) {
  if (guardada === null || guardada === undefined) return <Insignia tono="neutro" icono={LoaderCircle} texto="Revisando" className="estado-clave" />;
  return guardada ? (
    <Insignia estado="listo" texto="Guardada" className="estado-clave" />
  ) : (
    <Insignia tono="error" icono={X} texto="Falta" className="estado-clave" />
  );
}

/**
 * Campo para pegar una clave. Muestra solo "Guardada" o "Falta", nunca el valor.
 * Guardar la manda a la app (PUT /api/claves), que la prueba gratis antes de escribirla en el .env de
 * tu PC: si el servicio no la reconoce, no se guarda y la de antes sigue igual. "Probar" hace la misma
 * consulta gratis con la clave guardada.
 */
export function CampoClave({ id, nombre, para, icono, tono, guardada, enlace, compacto = false, alCambiar }) {
  const { aviso } = useAvisos();
  const [valor, setValor] = useState('');
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState(null); // { tono: 'ok' | 'aviso' | 'error', texto }
  const idCampo = useId();
  const vivo = useRef(true);
  useEffect(
    () => () => {
      vivo.current = false;
    },
    []
  );

  const guardar = async (e) => {
    e.preventDefault();
    const v = valor.trim();
    if (!v || guardando) return;
    setGuardando(true);
    setResultado(null);
    try {
      const r = await apiAjustes.guardarClave(id, v);
      if (!vivo.current) return;
      setValor('');
      setVer(false);
      const avisoDeEsta = r?.avisos?.find((a) => a.cual === id);
      setResultado(avisoDeEsta ? { tono: 'aviso', texto: avisoDeEsta.mensaje } : { tono: 'ok', texto: 'Guardada y comprobada: funciona.' });
      aviso({ tipo: 'ok', titulo: 'Clave guardada', texto: `Tu clave de ${nombre} quedó guardada solo en esta PC.` });
      await alCambiar?.();
    } catch (err) {
      if (!vivo.current) return;
      // lo pegado queda en el campo para que lo puedas corregir
      setResultado({ tono: 'error', texto: err.message });
    } finally {
      if (vivo.current) setGuardando(false);
    }
  };

  const probar = async () => {
    setProbando(true);
    setResultado(null);
    try {
      const r = await apiAjustes.probarClave(id);
      if (!vivo.current) return;
      setResultado({ tono: r.ok ? 'ok' : r.motivo === 'sin-conexion' || r.motivo === 'servicio' ? 'aviso' : 'error', texto: r.mensaje });
      if (id === 'kie') await alCambiar?.();
    } catch (err) {
      if (vivo.current) setResultado({ tono: 'error', texto: err.message });
    } finally {
      if (vivo.current) setProbando(false);
    }
  };

  const IconoResultado = resultado?.tono === 'ok' ? Check : TriangleAlert;

  return (
    <form className={`clave${compacto ? ' clave--compacta' : ''}`} onSubmit={guardar} autoComplete="off">
      <div className="clave__cabecera">
        <Marca icono={icono} tono={tono} tamano={compacto ? 'chico' : 'normal'} />
        <div className="clave__textos">
          <label className="clave__nombre" htmlFor={idCampo}>
            Clave de {nombre}
          </label>
          {para ? <span className="clave__para">{para}</span> : null}
        </div>
        <EstadoClave guardada={guardada} />
      </div>

      <div className="clave__fila">
        <div className="clave__control">
          <KeyRound size={16} strokeWidth={2} className="clave__icono" aria-hidden="true" />
          <input
            id={idCampo}
            className="clave__entrada"
            type={ver ? 'text' : 'password'}
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              if (resultado?.tono === 'error') setResultado(null);
            }}
            placeholder={guardada ? 'Ya está guardada. Pega otra solo si quieres cambiarla' : `Pega aquí tu clave de ${nombre}`}
            autoComplete="off"
            spellCheck="false"
            disabled={guardando}
            aria-invalid={resultado?.tono === 'error' && valor ? true : undefined}
            data-1p-ignore=""
            data-lpignore="true"
          />
          {valor ? (
            <button type="button" className="clave__ver" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar lo que pegaste' : 'Ver lo que pegaste'}>
              {ver ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
            </button>
          ) : null}
        </div>
        <Boton type="submit" variante={guardada ? 'secundario' : 'primario'} disabled={!valor.trim()} cargando={guardando}>
          {guardando ? 'Comprobando…' : 'Guardar'}
        </Boton>
      </div>

      <div className="clave__pie">
        {enlace ? (
          <a className="clave__enlace" href={enlace} target="_blank" rel="noopener noreferrer">
            ¿Dónde la consigo?
            <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" />
          </a>
        ) : null}
        <span className="clave__separador" aria-hidden="true" />
        <Tooltip texto={guardada ? 'Hace una consulta gratis para ver que la clave funcione' : 'Primero guarda tu clave'}>
          <Boton variante="fantasma" tamano="chico" icono={PlugZap} cargando={probando} disabled={!guardada || guardando} onClick={probar}>
            {probando ? 'Probando…' : 'Probar'}
          </Boton>
        </Tooltip>
      </div>

      <div className="clave__resultado-zona" role="status" aria-live="polite">
        {resultado ? (
          <span className={`clave__resultado clave__resultado--${resultado.tono}`}>
            <IconoResultado size={14} strokeWidth={2.6} aria-hidden="true" />
            <span>{resultado.texto}</span>
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** Fila de una revisión: icono de estado + qué es + el dato. */
export function FilaRevision({ icono: Icono, titulo, detalle, ok, revisando, accion, style }) {
  const estado = revisando ? 'revisando' : ok ? 'ok' : 'falta';
  return (
    <div className={`revision revision--${estado}`} style={style}>
      <span className="revision__icono" aria-hidden="true">
        {revisando ? <LoaderCircle size={16} strokeWidth={2.2} className="girando" /> : <Icono size={16} strokeWidth={2} />}
      </span>
      <span className="revision__textos">
        <span className="revision__titulo">{titulo}</span>
        {detalle ? <span className="revision__detalle">{detalle}</span> : null}
      </span>
      {accion || (
        <span className={`revision__marca revision__marca--${estado}`}>
          {revisando ? 'Revisando…' : ok ? <Check size={14} strokeWidth={2.8} aria-label="Bien" /> : <X size={14} strokeWidth={2.8} aria-label="Falta" />}
        </span>
      )}
    </div>
  );
}
