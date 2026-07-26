import { describe, expect, it } from "vitest";
import {
  ComponentSeedError,
  baseComponentSeeds,
  componentSeedsForChapter,
  instantiateComponentSeeds,
} from "./instantiate-component-seeds.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { ComponentSeedId, ComponentSeedPoint } from "./floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

function seed(overrides: Partial<Omit<ComponentSeedPoint, "id">> & { id?: string } = {}): ComponentSeedPoint {
  return {
    sectionId: "soporte-vital" as SectionId,
    position: { x: 3, y: 3 },
    componentId: "herramientas-reparacion-externa",
    ...overrides,
    id: (overrides.id ?? "semilla-1") as ComponentSeedId,
  };
}

describe("instantiateComponentSeeds", () => {
  const registry = buildComponentCatalog().registry;

  it("instancia un compuesto real del catálogo con condition/instanceId por defecto", () => {
    const [instance] = instantiateComponentSeeds([seed()], registry);
    expect(instance).toEqual({
      instanceId: "semilla-semilla-1",
      componentDefinitionId: "herramientas-reparacion-externa",
      placement: { position: { x: 3, y: 3 }, footprint: { width: 2, height: 1 }, rotation: 0 },
      condition: "ok",
    });
  });

  it("respeta instanceId/condition explícitos de la semilla", () => {
    const [instance] = instantiateComponentSeeds(
      [seed({ instanceId: "capitulo-1-herramientas", condition: "jammed" })],
      registry,
    );
    expect(instance?.instanceId).toBe("capitulo-1-herramientas");
    expect(instance?.condition).toBe("jammed");
  });

  it("rechaza una semilla con condition inválida", () => {
    expect(() => instantiateComponentSeeds([seed({ condition: "oxidado" })], registry)).toThrow(
      ComponentSeedError,
    );
  });

  it("rechaza una semilla que referencia un componentId desconocido", () => {
    expect(() =>
      instantiateComponentSeeds([seed({ componentId: "no-existe" })], registry),
    ).toThrow(ComponentSeedError);
  });

  it("rechaza una semilla que referencia una pieza ATÓMICA (solo compuestos, GDD 7.1-7.2)", () => {
    expect(() =>
      instantiateComponentSeeds([seed({ componentId: "motor-pequeno" })], registry),
    ).toThrow(/atomic/i);
  });

  it("rechaza una semilla que resuelve a un compuesto de catálogo sin footprint autorado", () => {
    // panel-solar-desplegable existe en el catálogo de Exploración pero no se
    // le pobló footprint (solo se completó para los 3 elegidos del capítulo 1).
    expect(() =>
      instantiateComponentSeeds([seed({ componentId: "panel-solar-desplegable" })], registry),
    ).toThrow(/footprint/i);
  });

  it("instancia varias semillas en una sola llamada", () => {
    const instances = instantiateComponentSeeds(
      [
        seed({ id: "s1", componentId: "herramientas-reparacion-externa" }),
        seed({ id: "s2", componentId: "radio-largo-alcance", position: { x: 5, y: 5 } }),
      ],
      registry,
    );
    expect(instances).toHaveLength(2);
    expect(instances.map((i) => i.componentDefinitionId)).toEqual([
      "herramientas-reparacion-externa",
      "radio-largo-alcance",
    ]);
  });
});

describe("baseComponentSeeds / componentSeedsForChapter", () => {
  const seeds: ComponentSeedPoint[] = [
    seed({ id: "ambiente-1" }),
    seed({ id: "capitulo-1-solo", chapterId: "1" }),
    seed({ id: "capitulo-2-solo", chapterId: "2" }),
  ];

  it("baseComponentSeeds devuelve solo las semillas sin chapterId", () => {
    expect(baseComponentSeeds(seeds).map((s) => s.id)).toEqual(["ambiente-1"]);
  });

  it("componentSeedsForChapter filtra por el chapterId exacto", () => {
    expect(componentSeedsForChapter(seeds, "1").map((s) => s.id)).toEqual(["capitulo-1-solo"]);
    expect(componentSeedsForChapter(seeds, "2").map((s) => s.id)).toEqual(["capitulo-2-solo"]);
    expect(componentSeedsForChapter(seeds, "3")).toEqual([]);
  });
});
