import { describe, expect, it } from "vitest";
import { createNewCampaignSave } from "engine";
import type { CampaignSaveState, ComponentId, CrewActor, CrewRoster, PlacedComponentInstanceId } from "engine";

import { MissionRuntime } from "../mission/mission-runtime.js";
import { buildGameStateSnapshot } from "./game-state-snapshot.js";

/**
 * Ronda 2 de playtest de 14b-2: el operador pidió poder validar un playtest
 * sin depender de que se lo describan de memoria. Este test ancla que el
 * snapshot es JSON serializable de punta a punta y trae las secciones que
 * promete — no la exactitud de cada dominio, que ya cubren sus propios tests
 * (`toUpdatedSave`, `deriveInstanceStates`).
 */

function actor(id: string): CrewActor {
  return {
    id,
    name: id,
    specialty: "ingenieria",
    tier: 1,
    hp: 100,
    status: "idle",
  } as unknown as CrewActor;
}

const ROSTER = { available: [actor("crew-1"), actor("crew-2")] } as CrewRoster;

function newSave(): CampaignSaveState {
  return createNewCampaignSave({
    id: "campaign-test" as CampaignSaveState["metadata"]["id"],
    name: "test",
    archetype: "exploracion",
    roster: ROSTER,
    chosenCrewIds: [actor("crew-1").id],
    engineVersion: "0.0.0",
    now: "2026-09-02T00:00:00.000Z",
  });
}

describe("buildGameStateSnapshot", () => {
  it("es JSON serializable sin perder nada (sin `undefined` sueltos)", () => {
    const save = newSave();
    const mission = new MissionRuntime(save);
    const snapshot = buildGameStateSnapshot(mission, save);
    const roundTripped = JSON.parse(JSON.stringify(snapshot)) as unknown;
    expect(roundTripped).toEqual(snapshot);
  });

  it("trae las cuatro secciones que promete el schema", () => {
    const save = newSave();
    const mission = new MissionRuntime(save);
    const snapshot = buildGameStateSnapshot(mission, save);
    expect(snapshot.schemaVersion).toBe(1);
    expect(typeof snapshot.capturedAt).toBe("string");
    expect(snapshot.save.metadata.id).toBe(save.metadata.id);
    expect(snapshot.live.instanceStates).toBeDefined();
  });

  it("una nave recién creada, sin nada notable, no lista estados vacíos", () => {
    // `deriveInstanceStates` devuelve `[]` para una pieza sin nada que avisar;
    // el snapshot los omite en vez de acumular ruido de instancias silenciosas.
    const save = newSave();
    const mission = new MissionRuntime(save);
    const snapshot = buildGameStateSnapshot(mission, save);
    for (const states of Object.values(snapshot.live.instanceStates)) {
      expect(states.length).toBeGreaterThan(0);
    }
  });

  it("14b-3: vuelca la config por instancia guardada y el umbral EFECTIVO de cada sensor", () => {
    const base = newSave();
    const sensorId = "sensor-de-prueba" as PlacedComponentInstanceId;
    const save: CampaignSaveState = {
      ...base,
      shipState: {
        ...base.shipState,
        placedComponents: [
          ...base.shipState.placedComponents,
          {
            instanceId: sensorId,
            componentDefinitionId: "sensor-termico-precision" as ComponentId,
            placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
            condition: "ok",
            wear: "nuevo",
          },
        ],
      },
    };
    const mission = new MissionRuntime(save);

    // Sin tocar: no hay entrada guardada, pero el umbral efectivo es el de fábrica.
    let snapshot = buildGameStateSnapshot(mission, save);
    expect(snapshot.live.instanceConfigs).toEqual([]);
    expect(snapshot.live.sensorThresholds[sensorId]).toEqual({
      kind: "thermal",
      threshold: { kind: "sensor-threshold", comparator: ">", value: 60 },
    });

    // Tocado: aparece guardado Y como efectivo.
    expect(mission.setSensorThreshold(sensorId, { kind: "sensor-threshold", comparator: "<", value: 10 })).toBeUndefined();
    snapshot = buildGameStateSnapshot(mission, save);
    expect(snapshot.live.instanceConfigs).toEqual([
      { instanceId: sensorId, config: { kind: "sensor-threshold", comparator: "<", value: 10 } },
    ]);
    expect(snapshot.live.sensorThresholds[sensorId]?.threshold.value).toBe(10);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("14b-3: setSensorThreshold rechaza una pieza sin umbral configurable", () => {
    const save = newSave();
    const mission = new MissionRuntime(save);
    const any = mission.blueprint.placedComponents[0]?.instanceId;
    if (any) {
      expect(mission.setSensorThreshold(any, { kind: "sensor-threshold", comparator: ">", value: 1 })).toBe("not-configurable");
    }
  });
});
