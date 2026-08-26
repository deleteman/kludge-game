import type { CrewTask } from "./task.types.js";

/**
 * Identidad del OBJETIVO sobre el que trabaja una tarea, para que el avance
 * sobreviva al tripulante que lo empezó (ronda 3 de playtest de 13f).
 *
 * El operador reportó el caso: instalar la pieza equivocada sobre una brecha y
 * no poder deshacerlo nunca, porque desmontar tarda más de lo que sobrevive
 * nadie en el vacío y **"el desmonte inicia de 0 con cada nuevo tripulante"**.
 * El progreso vivía en `CrewTask.elapsedSeconds`, o sea en la tarea, y la tarea
 * muere con su actor.
 *
 * Con esta clave el avance pasa a acumularse por objetivo: dos tripulantes
 * pueden turnarse en un trabajo largo. Es una mecánica, no solo un parche —
 * relevar a alguien que no llega es exactamente el tipo de decisión que el core
 * loop de GDD §4 pide.
 *
 * La clave se deriva del `payload`, que ya identifica el objetivo de cada tipo,
 * y **nunca del `instanceId` de la propia tarea**: el de `install` se genera al
 * encolar, así que dos intentos de instalar la misma pieza en la misma celda
 * son instancias distintas y no compartirían nada. Incluye siempre el tipo de
 * tarea y la pieza concreta, para que cancelar la instalación de A y encolar la
 * de B en la misma celda no herede progreso ajeno.
 *
 * `undefined` = esta tarea no acumula. Es el caso de `go-to` y de cualquier
 * tipo sin payload: en un viaje no hay nada que retomar, el relevo es
 * simplemente otro tripulante caminando.
 */
export function taskProgressKey(task: CrewTask): string | undefined {
  const payload = task.payload;
  if (!payload) {
    return undefined;
  }
  switch (payload.kind) {
    case "dismantle":
      return `dismantle:${payload.instanceId}`;
    case "install": {
      const { x, y } = payload.placement.position;
      return `install:${payload.componentDefinitionId}@${x},${y}`;
    }
    case "connect":
      return `connect:${payload.fromNodeId}->${payload.toNodeId}`;
    case "analyze-substance":
      return `analyze-substance:${payload.substanceId}`;
    case "cut-power":
      return `cut-power:${payload.sectionId}`;
    case "purge-reservoir":
      return `purge-reservoir:${payload.instanceId}`;
    case "discharge-source":
      return `discharge-source:${payload.instanceId}`;
    case "transfer-substance":
      return `transfer-substance:${payload.fromInstanceId}->${payload.toInstanceId}:${payload.amount}`;
    case "apply-substance":
      return `apply-substance:${payload.fromInstanceId}->${payload.sectionId}:${payload.amount}`;
    case "extract-elements":
      return `extract-elements:${payload.instanceId}:${payload.amount}`;
  }
}
