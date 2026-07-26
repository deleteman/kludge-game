import { describe, expect, it } from "vitest";
import { createNewCampaignSave } from "./campaign-save-factory.js";
import { advanceChapterProgress } from "./chapter-progression.js";
import type { CampaignSaveId } from "./campaign-save.types.js";
import type { CrewRoster } from "../crew/crew-roster.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import { CHAPTER_01_BY_ARCHETYPE } from "../crisis/campaign/chapter-01-primer-aviso.js";
import {
  CHAPTER_02_BY_ARCHETYPE,
  CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE,
} from "../crisis/campaign/chapter-02-ecos-en-el-pasillo.js";

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

function buildSave() {
  const roster: CrewRoster = {
    available: [actor("crew-1"), actor("crew-2"), actor("crew-3"), actor("crew-4")],
  };
  return createNewCampaignSave({
    id: "save-1" as CampaignSaveId,
    name: "Partida de prueba",
    archetype: "exploracion",
    roster,
    chosenCrewIds: ["crew-1" as CrewActorId, "crew-2" as CrewActorId],
    engineVersion: "0.0.0",
    now: "2026-07-17T00:00:00.000Z",
  });
}

describe("advanceChapterProgress", () => {
  const chapter01Id = CHAPTER_01_BY_ARCHETYPE.exploracion.id;
  const chapter02Id = CHAPTER_02_BY_ARCHETYPE.exploracion.id;

  it("marca el capítulo resuelto como completado", () => {
    const save = buildSave();
    const advanced = advanceChapterProgress(save, chapter01Id);
    expect(advanced.chapterProgress.completedChapterIds).toContain(chapter01Id);
  });

  it("avanza currentChapterId al capítulo 2 al resolver el capítulo 1", () => {
    const save = buildSave();
    const advanced = advanceChapterProgress(save, chapter01Id);
    expect(advanced.chapterProgress.currentChapterId).toBe(chapter02Id);
  });

  it("siembra los componentes/nodos iniciales del capítulo 2 en la nave al avanzar", () => {
    const save = buildSave();
    const advanced = advanceChapterProgress(save, chapter01Id);
    const seeded = CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE.exploracion;
    expect(advanced.shipState.placedComponents.length).toBe(
      save.shipState.placedComponents.length + seeded.length,
    );
    for (const component of seeded) {
      expect(
        advanced.shipState.placedComponents.some((entry) => entry.instanceId === component.instanceId),
      ).toBe(true);
    }
    // Los 3 nodos del cap. 2 (2 emisores + combinador) también se siembran.
    expect(advanced.shipState.signalGraph.nodes.length).toBe(
      save.shipState.signalGraph.nodes.length + 3,
    );
  });

  it("no avanza ni siembra al resolver el último capítulo (cap. 2, fin de la demo)", () => {
    const save = buildSave();
    const atChapter02 = advanceChapterProgress(save, chapter01Id);
    const afterLast = advanceChapterProgress(atChapter02, chapter02Id);
    expect(afterLast.chapterProgress.currentChapterId).toBe(chapter02Id);
    expect(afterLast.shipState.placedComponents.length).toBe(atChapter02.shipState.placedComponents.length);
  });

  it("no duplica el id al completar el mismo capítulo dos veces (dedup)", () => {
    const save = buildSave();
    const once = advanceChapterProgress(save, chapter01Id);
    const twice = advanceChapterProgress(once, chapter01Id);
    expect(twice.chapterProgress.completedChapterIds.filter((id) => id === chapter01Id)).toHaveLength(1);
  });
});
