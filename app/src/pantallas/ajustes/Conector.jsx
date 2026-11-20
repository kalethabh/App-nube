// Ajustes → Conector para Claude (2026-11-20e): prende la puerta MCP de la app (lib/conector.js) y da la dirección
// para pegar en Claude (Configuración › Conectores › Agregar conector personalizado). Funciona con la app en un
// servidor (DESPLEGAR.md): Claude no llega a tu computador. La guía completa está en CONECTOR-CLAUDE.md.
import { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { Boton, Interruptor, Seccion, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { fechaRelativa } from '../../datos/formato.js';

export function Conector() {
  const { aviso } = useAvisos();
  const { datos, recargar } = useDatos('conector', () => pedirNuevo('/api/conector'));
  const [ocupado, setOcupado] = useState(false);
  const cambiar = async (fn) => {
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
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(datos.url);
      aviso({ tipo: 'exito', titulo: 'Dirección copiada', texto: 'Pégala en Claude › Conectores › Agregar conector personalizado.' });
    } catch {
      aviso({ tipo: 'error', titulo: 'No pude copiarla', texto: 'Selecciónala y cópiala a mano.' });
    }
  };
  return (
    <Seccion id="conector" className="ajustes__seccion" titulo="Conector para Claude" descripcion="Pídele a tu app desde el chat de Claude (en la web o en el celular): ver tus productos, analizar tu investigación de mercado, crear anuncios de video e imagen, ver su costo y producirlos con tu sí. La app y la oficina siguen igual: esto es una puerta más.">
      {datos ? (
        <div className="conector">
          <Interruptor activado={datos.activo} onCambio={(v) => cambiar(() => pedirNuevo('/api/conector', { metodo: 'PUT', cuerpo: { activo: v } }))} deshabilitado={ocupado} etiqueta="Conector prendido" descripcion={datos.activo ? (datos.ultimoUso ? `Claude lo usó ${fechaRelativa(datos.ultimoUso)}.` : 'Todavía sin usar.') : 'Apagado: la dirección no responde.'} />
          {!datos.enServidor ? <p className="conector__aviso">La app corre en tu computador: Claude no puede llegar hasta aquí. El conector funciona con la app en un servidor (mira DESPLEGAR.md).</p> : null}
          {datos.activo ? (
            <>
              <label className="conector__etiqueta" htmlFor="conector-url">Dirección para Claude (es secreta: quien la tenga puede usar tu app)</label>
              <div className="conector__fila">
                <input id="conector-url" className="conector__url" readOnly value={datos.url} onFocus={(e) => e.target.select()} />
                <Boton variante="primario" tamano="chico" icono={Copy} onClick={copiar}>
                  Copiar
                </Boton>
              </div>
              <ol className="conector__pasos">
                <li>En Claude: Configuración › Conectores › <strong>Agregar conector personalizado</strong>.</li>
                <li>Nombre: «Kads Studio». URL: la dirección de arriba. Sin OAuth.</li>
                <li>En un chat, prende el conector y pídele, por ejemplo: «analiza la investigación de mi producto y dime qué ángulo usar».</li>
              </ol>
              <Boton variante="fantasma" tamano="chico" icono={RefreshCw} cargando={ocupado} onClick={() => cambiar(() => pedirNuevo('/api/conector/clave', { metodo: 'POST' }))}>
                Cambiar la clave (la dirección vieja deja de funcionar)
              </Boton>
            </>
          ) : null}
        </div>
      ) : null}
    </Seccion>
  );
}
