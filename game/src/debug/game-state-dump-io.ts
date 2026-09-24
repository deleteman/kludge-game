import type { GameStateSnapshot } from "./game-state-snapshot.js";

/**
 * Escribe el snapshot a disco. El flujo real de prueba del operador es
 * `npm run dev` suelto en `/game` (navegador plano, sin Electron — mismo caso
 * que documenta `save-adapter.ts` para el guardado), así que no se agrega IPC
 * nuevo: se dispara una descarga de navegador, que cae en la carpeta de
 * Descargas del SO y es legible sin que el operador copie/pegue nada. Dentro
 * de Electron el comportamiento es el mismo (el navegador embebido también
 * descarga), así que no hace falta una rama especial.
 *
 * Devuelve el nombre de archivo generado para que quien llama lo muestre en
 * pantalla — es la única confirmación de que el volcado ocurrió.
 */
export function downloadGameStateSnapshot(snapshot: GameStateSnapshot): string {
  const filename = `kludge-debug-dump-${snapshot.capturedAt.replace(/[:.]/g, "-")}.json`;
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}
