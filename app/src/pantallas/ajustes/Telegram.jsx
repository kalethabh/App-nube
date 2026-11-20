// Ajustes → Telegram (2026-11-20p): tu coordinadora por Telegram (lib/telegram.js). El token de tu bot (de @BotFather),
// el código para vincular tu chat y el interruptor. Funciona con la app en tu computador: no necesita servidor.
import { useState } from 'react';
import { Copy, RefreshCw, Send, Unlink } from 'lucide-react';
import { Boton, Interruptor, Seccion, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { CampoClave } from './piezas.jsx';

export function Telegram({ estado: estadoApp, recargar: recargarApp }) {
  const { aviso } = useAvisos();
  const { datos, recargar } = useDatos('telegram', () => pedirNuevo('/api/telegram'), { cadaMs: 5000 });
  const [ocupado, setOcupado] = useState(false);
  const hacer = async (fn) => {
    setOcupado(true);
    try {
      await fn();
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude guardarlo', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  const copiar = async (t) => {
    try {
      await navigator.clipboard.writeText(t);
      aviso({ tipo: 'exito', titulo: 'Copiado' });
    } catch {
      /* se copia a mano */
    }
  };
  return (
    <Seccion id="telegram" className="ajustes__seccion" titulo="Telegram" descripcion="Habla con tu coordinadora desde Telegram, como en la app: escríbele, mándale audios, fotos o documentos. Te responde ahí, te avisa lo que espera tu aprobación y lo apruebas con un botón. Funciona con la app abierta en tu computador.">
      <div className="conector">
        <ol className="conector__pasos">
          <li>
            En Telegram, abre <strong>@BotFather</strong>, escribe <code>/newbot</code>, ponle un nombre (por ejemplo «Mi oficina Kads») y copia el <strong>token</strong> que te da.
          </li>
          <li>Pégalo aquí abajo y toca Guardar.</li>
        </ol>
        <CampoClave id="telegram" nombre="Telegram (tu bot)" para="El token que te dio @BotFather" icono={Send} tono="cian" guardada={estadoApp ? Boolean(estadoApp.claves?.telegram) : datos?.token ?? null} enlace="https://t.me/BotFather" alCambiar={async () => { await recargarApp?.(); await recargar?.(); }} />
        {datos?.token ? (
          <>
            <Interruptor activado={datos.activo} onCambio={(v) => hacer(() => pedirNuevo('/api/telegram', { metodo: 'PUT', cuerpo: { activo: v } }))} deshabilitado={ocupado} etiqueta="Coordinadora en Telegram" descripcion={datos.error ? datos.error : datos.activo ? (datos.vinculado ? `Conectada con ${datos.chatNombre}.` : 'Prendida: falta vincular tu chat (abajo).') : 'Apagada.'} />
            {datos.activo && !datos.vinculado ? (
              <div className="tg-vincular">
                <p>
                  Abre tu bot{datos.nombreBot ? (
                    <>
                      {' '}
                      <a href={`https://t.me/${datos.nombreBot}?start=${datos.codigo}`} target="_blank" rel="noopener noreferrer">@{datos.nombreBot}</a>
                    </>
                  ) : null}{' '}
                  en Telegram y mándale:
                </p>
                <div className="conector__fila">
                  <input className="conector__url" readOnly value={`/start ${datos.codigo}`} onFocus={(e) => e.target.select()} />
                  <Boton variante="primario" tamano="chico" icono={Copy} onClick={() => copiar(`/start ${datos.codigo}`)}>Copiar</Boton>
                </div>
                <Boton variante="fantasma" tamano="chico" icono={RefreshCw} onClick={() => hacer(() => pedirNuevo('/api/telegram/codigo', { metodo: 'POST' }))}>Otro código</Boton>
              </div>
            ) : null}
            {datos.vinculado ? (
              <Boton variante="fantasma" tamano="chico" icono={Unlink} cargando={ocupado} onClick={() => hacer(() => pedirNuevo('/api/telegram/desvincular', { metodo: 'POST' }))}>
                Desvincular {datos.chatNombre}
              </Boton>
            ) : null}
          </>
        ) : null}
      </div>
    </Seccion>
  );
}
