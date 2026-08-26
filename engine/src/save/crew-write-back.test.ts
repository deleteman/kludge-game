import { describe, expect, it } from "vitest";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import { assertCampaignSaveIntegrity } from "./campaign-save-integrity.js";
import { createNewCampaignSave } from "./campaign-save-factory.js";
import type { CampaignSaveId, CampaignSaveState } from "./campaign-save.types.js";
import { writeBackCrew, type LiveCrewSnapshot } from "./crew-write-back.js";

function actor(id: string): CrewActor {
  return {
    id: id as CrewActorId,
    name: `Tripulante ${id}`,
    specialty: "ingeniero",
    tier: "novato",
    trait: "estoico",
    hp: 100,
    maxHp: 100,
    status: "idle",
  };
}

const CREW_1 = "crew-1" as CrewActorId;
const CREW_2 = "crew-2" as CrewActorId;

function baseSave(): CampaignSaveState {
  return createNewCampaignSave({
    id: "save-1" as CampaignSaveId,
    name: "Partida",
    archetype: "exploracion",
    roster: { available: [actor("crew-1"), actor("crew-2"), actor("crew-3"), actor("crew-4")] },
    chosenCrewIds: [CREW_1, CREW_2],
    engineVersion: "0.0.0",
    now: "2026-08-26T00:00:00.000Z",
  });
}

/**
 * REGRESIÓN de la ronda 2 de playtest de 13f: "el tripulante no muere al llegar
 * a 0 vida, sigo usándolo para todo sin problema". El permadeath del GDD 6.1
 * existía como evento desde la Fase 9 y no tenía ninguna consecuencia; en el
 * save, además, el muerto volvía entero a la misión siguiente.
 */
describe("writeBackCrew (13f ronda 2: permadeath en el guardado)", () => {
  const nothingLive = (): LiveCrewSnapshot => ({});

  it("sin estado vivo devuelve la tripulación tal cual", () => {
    const base = baseSave();
    const result = writeBackCrew(base, nothingLive);
    expect(result.crew).toEqual(base.crew);
    expect(result.activeCrewIds).toEqual(base.activeCrewIds);
  });

  it("vuelca HP de `crewState` y status/sección del scheduler", () => {
    const base = baseSave();
    const result = writeBackCrew(base, (id) =>
      id === CREW_1
        ? {
            damaged: { hp: 40, status: "idle", currentCell: { x: 3, y: 4 } },
            scheduled: { status: "busy", currentSectionId: "ingenieria" as never },
          }
        : {},
    );
    const updated = result.crew.find((entry) => entry.id === CREW_1)!;
    expect(updated.hp).toBe(40);
    expect(updated.status).toBe("busy");
    expect(updated.currentSectionId).toBe("ingenieria");
    expect(updated.currentCell).toEqual({ x: 3, y: 4 });
  });

  it("un muerto queda `dead` con 0 HP, aunque el scheduler todavía lo crea ocupado", () => {
    const base = baseSave();
    const result = writeBackCrew(base, (id) =>
      id === CREW_1
        ? { damaged: { hp: 0, status: "dead" }, scheduled: { status: "busy" } }
        : {},
    );
    const updated = result.crew.find((entry) => entry.id === CREW_1)!;
    expect(updated.status).toBe("dead");
    expect(updated.hp).toBe(0);
  });

  it("el muerto sale de `activeCrewIds` pero SIGUE en `crew`", () => {
    const base = baseSave();
    const result = writeBackCrew(base, (id) =>
      id === CREW_1 ? { damaged: { hp: 0, status: "dead" } } : {},
    );
    expect(result.activeCrewIds).toEqual([CREW_2]);
    // El roster conserva a quien fue: los logros de GDD 6.8 dependen de eso, y
    // `assertCampaignSaveIntegrity` exige que todo id activo exista en `crew`.
    expect(result.crew.map((entry) => entry.id)).toContain(CREW_1);
  });

  it("el save resultante sigue siendo íntegro", () => {
    const base = baseSave();
    const { crew, activeCrewIds } = writeBackCrew(base, (id) =>
      id === CREW_1 ? { damaged: { hp: 0, status: "dead" } } : {},
    );
    expect(() => assertCampaignSaveIntegrity({ ...base, crew, activeCrewIds })).not.toThrow();
  });

  it("con toda la tripulación muerta no queda nadie activo", () => {
    const base = baseSave();
    const result = writeBackCrew(base, () => ({ damaged: { hp: 0, status: "dead" } }));
    expect(result.activeCrewIds).toEqual([]);
    expect(result.crew).toHaveLength(base.crew.length);
  });
});
