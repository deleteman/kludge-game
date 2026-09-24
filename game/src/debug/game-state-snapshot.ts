import type { CampaignSaveState, InstanceState, PlacedComponentInstanceId } from "engine";
import type { MissionRuntime } from "../mission/mission-runtime.js";

/**
 * Volcado de gamestate para validación automática de playtest (ronda 2 de
 * 14b-2). El operador reportaba números "de memoria" que había que reconstruir
 * a mano con exploradores; esto los pone en un archivo que se puede `Read`.
 *
 * Extensible por diseño: cada dominio es una sección propia (`save`/`live`),
 * agregar un dominio nuevo no toca los que ya existen.
 *
 * `save` reusa `MissionRuntime.toUpdatedSave` — el MISMO serializador que ya
 * usa el guardado real (nave, atmósferas, puertas, válvulas, tripulación,
 * stock) — en vez de reinventar uno. `live.instanceStates` es lo único que el
 * save NO persiste: el estado derivado del frame actual (`deriveInstanceStates`,
 * vía `MissionRuntime.instanceStates`).
 */
export interface GameStateSnapshot {
  readonly schemaVersion: 1;
  readonly capturedAt: string;
  readonly save: CampaignSaveState;
  readonly live: {
    readonly instanceStates: Readonly<Record<PlacedComponentInstanceId, ReadonlyArray<InstanceState>>>;
  };
}

export function buildGameStateSnapshot(mission: MissionRuntime, base: CampaignSaveState): GameStateSnapshot {
  const instanceStates: Record<PlacedComponentInstanceId, ReadonlyArray<InstanceState>> = {};
  for (const instance of mission.blueprint.placedComponents) {
    const states = mission.instanceStates(instance);
    if (states.length > 0) {
      instanceStates[instance.instanceId] = states;
    }
  }
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    save: mission.toUpdatedSave(base),
    live: { instanceStates },
  };
}
