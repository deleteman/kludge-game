import { describe, expect, it } from "vitest";
import { createNewCampaignSave } from "engine";
import type { CampaignSaveState, CrewActor, CrewRoster } from "engine";

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
});
