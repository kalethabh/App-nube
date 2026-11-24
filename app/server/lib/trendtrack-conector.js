// EL NOMBRE DEL CONECTOR DE TRENDTRACK (2026-11-24). Claude Code nombra las herramientas de un conector de claude.ai
// como mcp__claude_ai_<nombre del conector>__<herramienta>, y el permiso tiene que coincidir letra por letra. La app
// lo tenía escrito «TrendTrack» y en la cuenta del usuario el conector se llama «Trendtrack»: cada consulta se negaba
// antes de salir («No se pudo usar TrendTrack»). Aquí van todas las formas en que puede venir el nombre, y las tareas
// permiten cualquiera (y buscan las herramientas por palabra si el nombre exacto no aparece).
export const SERVIDORES = ['claude_ai_Trendtrack', 'claude_ai_TrendTrack', 'claude_ai_trendtrack', 'claude_ai_TRENDTRACK', 'claude_ai_Trend_Track', 'claude_ai_Trend_track', 'Trendtrack', 'TrendTrack', 'trendtrack'];

/** El nombre de hoy (el primero que se pide con ToolSearch). */
export const TT = (corto) => `mcp__${SERVIDORES[0]}__${corto}`;

/** Todas las formas del nombre de esa herramienta (para los permisos). */
export const ttTodas = (corto) => SERVIDORES.map((s) => `mcp__${s}__${corto}`);

/** ¿`nombre` es esa herramienta de TrendTrack, venga como venga el nombre del conector? */
export const esTT = (nombre, corto) => new RegExp(`^mcp__(claude_ai_)?trend_?track__${corto}$`, 'i').test(String(nombre || ''));
