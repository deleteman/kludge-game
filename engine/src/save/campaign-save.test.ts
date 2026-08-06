import { describe, expect, it } from "vitest";
import { createNewCampaignSave } from "./campaign-save-factory.js";
import {
  CampaignSaveParseError,
  deserializeCampaignSave,
  serializeCampaignSave,
} from "./campaign-save-serializer.js";
import type { CampaignSaveId } from "./campaign-save.types.js";
import type { CrewRoster } from "../crew/crew-roster.js";
import { SHIP_ARCHETYPES, type ShipArchetype } from "../floorplan/floorplan.types.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import {
  CHAPTER_01_BY_ARCHETYPE,
  CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE,
} from "../crisis/campaign/chapter-01-primer-aviso.js";

function actor(id: string, overrides: Partial<CrewActor> = {}): CrewActor {
  return {
    id: id as CrewActorId,
    name: `Tripulante ${id}`,
    specialty: "ingeniero",
    tier: "novato",
    trait: "estoico",
    hp: 100,
    maxHp: 100,
    status: "idle",
    ...overrides,
  };
}

function fixtureRoster(): CrewRoster {
  return {
    available: [actor("crew-1"), actor("crew-2"), actor("crew-3"), actor("crew-4")],
  };
}

function buildSave(archetype: ShipArchetype) {
  return createNewCampaignSave({
    id: "save-1" as CampaignSaveId,
    name: "Partida de prueba",
    archetype,
    roster: fixtureRoster(),
    chosenCrewIds: ["crew-1" as CrewActorId, "crew-2" as CrewActorId],
    engineVersion: "0.0.0",
    now: "2026-07-14T00:00:00.000Z",
  });
}

describe("createNewCampaignSave", () => {
  for (const archetype of SHIP_ARCHETYPES) {
    it(`produces a valid save for archetype "${archetype}"`, () => {
      const save = buildSave(archetype);
      expect(save.metadata.archetype).toBe(archetype);
      expect(save.shipState.placedComponents.length).toBeGreaterThan(0);
      expect(save.activeCrewIds).toEqual(["crew-1", "crew-2"]);
    });

    it(`seeds the chapter-1 jammed actuator and points chapterProgress at it for "${archetype}" (10c)`, () => {
      const save = buildSave(archetype);
      expect(save.chapterProgress).toEqual({
        currentChapterId: CHAPTER_01_BY_ARCHETYPE[archetype].id,
        completedChapterIds: [],
      });
      expect(save.shipState.placedComponents).toContainEqual(
        CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE[archetype],
      );
    });
  }

  /**
   * Bug reportado en el playtest de 13e: el reservorio de agua reciclada del
   * Cap.1 aparecía vacío, así que no se podía analizar ni extraer y todo el
   * ciclo de sustancias quedaba sin arrancar. La sustancia existía solo como
   * comentario en el catálogo; ahora es dato (`contains`).
   */
  it("los reservorios sembrados nacen con su contenido de fábrica (13e ronda 1)", () => {
    const save = buildSave("exploracion");
    const agua = save.shipState.reservoirContents.find(
      (entry) => entry.componentInstanceId === "semilla-semilla-reservorio-agua",
    );
    expect(agua).toBeDefined();
    expect(agua?.substanceId).toBe("agua");
    expect(agua?.amount).toBe(100);
  });

  it("cada entrada de reservoirContents referencia una instancia real del plano", () => {
    // `blueprint-integrity.ts` ya trata una referencia colgante como error;
    // este test lo fija desde el lado del sembrado.
    const save = buildSave("exploracion");
    const instanceIds = new Set(save.shipState.placedComponents.map((c) => c.instanceId));
    for (const entry of save.shipState.reservoirContents) {
      expect(instanceIds.has(entry.componentInstanceId)).toBe(true);
    }
  });

  it("rejects an initial crew selection exceeding archetype capacity (GDD 6.2)", () => {
    expect(() =>
      createNewCampaignSave({
        id: "save-2" as CampaignSaveId,
        name: "Partida sobrecargada",
        archetype: "investigacion",
        roster: fixtureRoster(),
        chosenCrewIds: ["crew-1", "crew-2", "crew-3", "crew-4", "crew-1"].map(
          (id) => id as CrewActorId,
        ),
        engineVersion: "0.0.0",
      }),
    ).toThrow();
  });
});

describe("campaign-save-serializer round trip", () => {
  it("serializes and deserializes back to an equivalent state", () => {
    const save = buildSave("guerra");
    const restored = deserializeCampaignSave(serializeCampaignSave(save));
    expect(restored).toEqual(save);
  });

  it("rejects invalid JSON", () => {
    expect(() => deserializeCampaignSave("{not json")).toThrow(CampaignSaveParseError);
  });

  it("rejects a shipState that is not a valid Blueprint shape", () => {
    const save = buildSave("medica");
    const broken = { ...save, shipState: { not: "a blueprint" } };
    expect(() => deserializeCampaignSave(JSON.stringify(broken))).toThrow(CampaignSaveParseError);
  });

  it("rejects activeCrewIds referencing a crew member that does not exist", () => {
    const save = buildSave("exploracion");
    const broken = { ...save, activeCrewIds: [...save.activeCrewIds, "ghost-crew"] };
    expect(() => deserializeCampaignSave(JSON.stringify(broken))).toThrow(CampaignSaveParseError);
  });
});

/**
 * Subfase 13e: `schemaVersion` 4→5. Un save de v4 no trae ninguno de los tres
 * campos de química, así que se migra a vacío en vez de romper la carga —
 * mismo criterio con que v3 se migró al ausentarse `atomicStock`.
 */
describe("campaign-save-serializer — migración 4→5 (química, 13e)", () => {
  function v4SaveJson(): string {
    const save = buildSave("exploracion");
    const legacy: Record<string, unknown> = {
      ...save,
      metadata: { ...save.metadata, schemaVersion: 4 },
    };
    delete legacy.elementStock;
    delete legacy.substanceProvenance;
    delete legacy.analyzedSubstanceIds;
    return JSON.stringify(legacy);
  }

  it("un save v4 carga con los campos de química vacíos", () => {
    const restored = deserializeCampaignSave(v4SaveJson());
    expect(restored.elementStock).toEqual({});
    expect(restored.substanceProvenance).toEqual({});
    expect(restored.analyzedSubstanceIds).toEqual([]);
  });

  it("una campaña nueva nace en v5 sin elementos ni sustancias analizadas", () => {
    const save = buildSave("exploracion");
    expect(save.metadata.schemaVersion).toBe(5);
    expect(save.elementStock).toEqual({});
    expect(save.analyzedSubstanceIds).toEqual([]);
  });

  it("el stock de elementos y la procedencia sobreviven un round-trip", () => {
    const save = {
      ...buildSave("medica"),
      elementStock: { hidrogeno: 4, oxigeno: 2 },
      substanceProvenance: { "mezcla-sin-identificar-1": ["hidrogeno", "hidrogeno", "cloro"] },
      analyzedSubstanceIds: ["mezcla-sin-identificar-1"],
    } as unknown as ReturnType<typeof buildSave>;
    const restored = deserializeCampaignSave(serializeCampaignSave(save));
    expect(restored.elementStock).toEqual({ hidrogeno: 4, oxigeno: 2 });
    expect(restored.substanceProvenance).toEqual({
      "mezcla-sin-identificar-1": ["hidrogeno", "hidrogeno", "cloro"],
    });
    expect(restored.analyzedSubstanceIds).toEqual(["mezcla-sin-identificar-1"]);
  });

  it("rechaza cantidades de elemento negativas o fraccionarias", () => {
    const save = buildSave("guerra");
    for (const bad of [-1, 1.5, "3"]) {
      const broken = { ...save, elementStock: { hidrogeno: bad } };
      expect(() => deserializeCampaignSave(JSON.stringify(broken))).toThrow(CampaignSaveParseError);
    }
  });

  it("rechaza una procedencia que no sea una lista de ids", () => {
    const save = buildSave("guerra");
    const broken = { ...save, substanceProvenance: { agua: "hidrogeno" } };
    expect(() => deserializeCampaignSave(JSON.stringify(broken))).toThrow(CampaignSaveParseError);
  });
});
