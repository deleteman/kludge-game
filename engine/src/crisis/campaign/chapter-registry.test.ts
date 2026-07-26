import { describe, expect, it } from "vitest";
import { CHAPTER_REGISTRY } from "./chapter-registry.js";
import { CHAPTER_01_BY_ARCHETYPE } from "./chapter-01-primer-aviso.js";
import { CHAPTER_02_BY_ARCHETYPE } from "./chapter-02-ecos-en-el-pasillo.js";
import { SHIP_ARCHETYPES } from "../../floorplan/floorplan.types.js";

describe("CHAPTER_REGISTRY", () => {
  it("resuelve el id de cada variante de capítulo (1 y 2) a su propia CrisisDefinition", () => {
    for (const archetype of SHIP_ARCHETYPES) {
      const chapter01 = CHAPTER_01_BY_ARCHETYPE[archetype];
      const chapter02 = CHAPTER_02_BY_ARCHETYPE[archetype];
      expect(CHAPTER_REGISTRY.get(chapter01.id)).toBe(chapter01);
      expect(CHAPTER_REGISTRY.get(chapter02.id)).toBe(chapter02);
    }
  });

  it("tiene una entrada por capítulo y arquetipo (2 capítulos × arquetipos)", () => {
    expect(CHAPTER_REGISTRY.size).toBe(SHIP_ARCHETYPES.length * 2);
  });
});
