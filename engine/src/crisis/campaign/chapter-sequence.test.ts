import { describe, expect, it } from "vitest";
import { SHIP_ARCHETYPES } from "../../floorplan/floorplan.types.js";
import type { CrisisDefinitionId } from "../crisis-definition.types.js";
import { CHAPTER_01_BY_ARCHETYPE } from "./chapter-01-primer-aviso.js";
import { CHAPTER_02_BY_ARCHETYPE } from "./chapter-02-ecos-en-el-pasillo.js";
import { CHAPTER_SEQUENCE_BY_ARCHETYPE, nextChapterAfter } from "./chapter-sequence.js";

describe("chapter-sequence", () => {
  it("arranca cada arquetipo con su capítulo 1 como primer elemento de la secuencia", () => {
    for (const archetype of SHIP_ARCHETYPES) {
      const sequence = CHAPTER_SEQUENCE_BY_ARCHETYPE[archetype];
      expect(sequence[0]).toBe(CHAPTER_01_BY_ARCHETYPE[archetype].id);
    }
  });

  it("encadena capítulo 1 → capítulo 2 en cada arquetipo (fin de la demo)", () => {
    for (const archetype of SHIP_ARCHETYPES) {
      const chapter01Id = CHAPTER_01_BY_ARCHETYPE[archetype].id;
      const chapter02Id = CHAPTER_02_BY_ARCHETYPE[archetype].id;
      expect(nextChapterAfter(chapter01Id, archetype)).toBe(chapter02Id);
      // El capítulo 2 es el último de la secuencia hoy (no hay capítulo 3).
      expect(nextChapterAfter(chapter02Id, archetype)).toBeUndefined();
    }
  });

  it("devuelve undefined para un id que no pertenece a la secuencia", () => {
    expect(
      nextChapterAfter("capitulo-inexistente" as CrisisDefinitionId, "exploracion"),
    ).toBeUndefined();
  });
});
