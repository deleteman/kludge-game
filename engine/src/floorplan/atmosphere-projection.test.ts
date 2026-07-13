import { describe, expect, it } from "vitest";

import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import { diffuse } from "../atmosphere/diffusion.js";
import { getGasFraction } from "../atmosphere/section.types.js";
import type { SectionId, SectionRuntime } from "../atmosphere/section.types.js";
import { deriveAtmosphereModel } from "./atmosphere-projection.js";
import { parseShipFloorplan } from "./floorplan-parser.js";

/** Mapa de Tiled mínimo: dos secciones adyacentes de distinto tamaño + 2 conductos. */
const TWO_SECTION_MAP = {
  orientation: "orthogonal",
  width: 6,
  height: 2,
  tilewidth: 32,
  tileheight: 32,
  properties: [
    { name: "schemaVersion", type: "int", value: 1 },
    { name: "shipId", type: "string", value: "nave-test" },
    { name: "archetype", type: "string", value: "investigacion" },
    { name: "nameKey", type: "string", value: "ship.test.name" },
  ],
  layers: [
    {
      type: "objectgroup",
      name: "secciones",
      objects: [
        {
          id: 1,
          x: 0,
          y: 0,
          width: 64,
          height: 64,
          properties: [
            { name: "id", value: "cabina" },
            { name: "nameKey", value: "section.cabina" },
          ],
        },
        {
          id: 2,
          x: 64,
          y: 0,
          width: 128,
          height: 64,
          properties: [
            { name: "id", value: "bodega" },
            { name: "nameKey", value: "section.bodega" },
          ],
        },
      ],
    },
    {
      type: "objectgroup",
      name: "conductos",
      objects: [
        {
          id: 3,
          x: 64,
          y: 32,
          point: true,
          properties: [
            { name: "a", value: "cabina" },
            { name: "b", value: "bodega" },
            { name: "kind", value: "ventilacion" },
            { name: "initialAperture", type: "float", value: 0.5 },
          ],
        },
        {
          id: 4,
          x: 64,
          y: 48,
          point: true,
          properties: [
            { name: "a", value: "cabina" },
            { name: "b", value: "bodega" },
            { name: "kind", value: "electrico" },
          ],
        },
      ],
    },
    { type: "objectgroup", name: "anclajes", objects: [] },
  ],
};

describe("deriveAtmosphereModel", () => {
  it("deriva volumen = área en celdas y solo proyecta conductos de ventilación", () => {
    const floorplan = parseShipFloorplan(TWO_SECTION_MAP);
    const model = deriveAtmosphereModel(floorplan);

    expect(model.sections).toEqual([
      { id: "cabina", volume: 4 },
      { id: "bodega", volume: 8 },
    ]);
    // El conducto eléctrico no aparece: la atmósfera solo conoce ventilación.
    expect(model.connections).toEqual([{ a: "cabina", b: "bodega", valveAperture: 0.5 }]);
  });

  it("smoke de integración con Fase 2: diffuse() equilibra O2 sobre las secciones derivadas", () => {
    const floorplan = parseShipFloorplan(TWO_SECTION_MAP);
    const model = deriveAtmosphereModel(floorplan);

    // Cabina llena de O2, bodega vacía — masa total 0.21×4 = 0.84.
    const initialOxygen = new Map<SectionId, number>([
      ["cabina" as SectionId, 0.21],
      ["bodega" as SectionId, 0],
    ]);
    const sectionsById = new Map<SectionId, SectionRuntime>(
      model.sections.map((section) => [
        section.id,
        {
          section,
          atmosphere: {
            gases: new Map([[GAS.OXYGEN, initialOxygen.get(section.id) ?? 0]]),
            temperatureCelsius: 20,
            pressureKpa: 101,
          },
        },
      ]),
    );

    for (let seconds = 0; seconds < 300; seconds += 1) {
      diffuse(sectionsById, model.connections, { dtSeconds: 1, elapsedSeconds: seconds + 1 });
    }

    const cabina = sectionsById.get("cabina" as SectionId)!;
    const bodega = sectionsById.get("bodega" as SectionId)!;
    // Equilibrio ponderado por volumen: 0.84 / (4 + 8) = 0.07 en ambas.
    expect(getGasFraction(cabina.atmosphere, GAS.OXYGEN)).toBeCloseTo(0.07, 3);
    expect(getGasFraction(bodega.atmosphere, GAS.OXYGEN)).toBeCloseTo(0.07, 3);
  });

  it("una válvula sellada (apertura 0) mantiene las secciones aisladas", () => {
    const sealedMap = structuredClone(TWO_SECTION_MAP) as {
      layers: { name: string; objects: { properties: { name: string; value: unknown }[] }[] }[];
    };
    const conduits = sealedMap.layers.find((layer) => layer.name === "conductos")!;
    conduits.objects[0]!.properties.find((property) => property.name === "initialAperture")!.value =
      0;

    const model = deriveAtmosphereModel(parseShipFloorplan(sealedMap));
    const sectionsById = new Map<SectionId, SectionRuntime>(
      model.sections.map((section) => [
        section.id,
        {
          section,
          atmosphere: {
            gases: new Map([[GAS.OXYGEN, section.id === "cabina" ? 0.21 : 0]]),
            temperatureCelsius: 20,
            pressureKpa: 101,
          },
        },
      ]),
    );

    diffuse(sectionsById, model.connections, { dtSeconds: 10, elapsedSeconds: 10 });

    expect(getGasFraction(sectionsById.get("cabina" as SectionId)!.atmosphere, GAS.OXYGEN)).toBe(
      0.21,
    );
    expect(getGasFraction(sectionsById.get("bodega" as SectionId)!.atmosphere, GAS.OXYGEN)).toBe(0);
  });
});
