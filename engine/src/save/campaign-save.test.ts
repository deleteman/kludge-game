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
