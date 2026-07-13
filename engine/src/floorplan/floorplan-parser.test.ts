import { describe, expect, it } from "vitest";

import { FloorplanParseError, parseShipFloorplan } from "./floorplan-parser.js";

/**
 * Fixtures inline: mapas de Tiled mínimos construidos a mano (mismo criterio
 * que los tests de blueprint). Los 4 mapas reales se validan en
 * `canonical-ships.test.ts`.
 */
interface RawProperty {
  name: string;
  type?: string;
  value: unknown;
}

function props(entries: Record<string, unknown>): RawProperty[] {
  return Object.entries(entries).map(([name, value]) => ({
    name,
    type: typeof value === "number" ? "float" : "string",
    value,
  }));
}

let nextObjectId = 1;

function rect(x: number, y: number, width: number, height: number, properties: RawProperty[]) {
  return { id: nextObjectId++, x, y, width, height, rotation: 0, visible: true, properties };
}

function point(x: number, y: number, properties: RawProperty[]) {
  return {
    id: nextObjectId++,
    x,
    y,
    width: 0,
    height: 0,
    point: true,
    rotation: 0,
    visible: true,
    properties,
  };
}

interface MinimalMapOptions {
  sections?: unknown[];
  conduits?: unknown[];
  anchors?: unknown[];
  tilewidth?: number;
  mapProperties?: RawProperty[];
}

function minimalMap(options: MinimalMapOptions = {}): unknown {
  // Dos secciones 2×2 adyacentes por arista vertical, un conducto de
  // ventilación en la frontera y un anclaje dentro de "alfa".
  const sections = options.sections ?? [
    rect(0, 0, 64, 64, props({ id: "alfa", nameKey: "section.alfa" })),
    rect(64, 0, 64, 64, props({ id: "beta", nameKey: "section.beta" })),
  ];
  const conduits = options.conduits ?? [
    point(64, 32, props({ a: "alfa", b: "beta", kind: "ventilacion" })),
  ];
  const anchors = options.anchors ?? [point(16, 16, props({ id: "alfa-a1" }))];

  return {
    type: "map",
    orientation: "orthogonal",
    width: 4,
    height: 2,
    tilewidth: options.tilewidth ?? 32,
    tileheight: options.tilewidth ?? 32,
    properties:
      options.mapProperties ??
      props({
        schemaVersion: 1,
        shipId: "nave-test",
        archetype: "investigacion",
        nameKey: "ship.test.name",
      }),
    layers: [
      { type: "objectgroup", name: "secciones", objects: sections },
      { type: "objectgroup", name: "conductos", objects: conduits },
      { type: "objectgroup", name: "anclajes", objects: anchors },
    ],
  };
}

describe("parseShipFloorplan", () => {
  it("parsea un mapa mínimo válido: secciones, conducto y anclaje", () => {
    const floorplan = parseShipFloorplan(minimalMap());

    expect(floorplan.id).toBe("nave-test");
    expect(floorplan.archetype).toBe("investigacion");
    expect(floorplan.gridSize).toEqual({ width: 4, height: 2 });

    expect(floorplan.sections).toHaveLength(2);
    const alfa = floorplan.sections.find((section) => section.id === "alfa");
    expect(alfa?.nameKey).toBe("section.alfa");
    expect(alfa?.cells).toHaveLength(4);
    expect(alfa?.cells).toContainEqual({ x: 1, y: 1 });

    expect(floorplan.conduits).toHaveLength(1);
    expect(floorplan.conduits[0]).toEqual({
      a: "alfa",
      b: "beta",
      kind: "ventilacion",
      position: { x: 2, y: 1 },
      initialAperture: 1,
    });

    expect(floorplan.anchors).toHaveLength(1);
    expect(floorplan.anchors[0]).toEqual({
      id: "alfa-a1",
      sectionId: "alfa",
      position: { x: 0, y: 0 },
    });
  });

  it("une varios rectángulos con el mismo id en una sección en L", () => {
    const floorplan = parseShipFloorplan(
      minimalMap({
        sections: [
          rect(0, 0, 64, 64, props({ id: "ele", nameKey: "section.ele" })),
          rect(0, 64, 32, 32, props({ id: "ele", nameKey: "section.ele" })),
        ],
        conduits: [],
        anchors: [],
      }),
    );

    expect(floorplan.sections).toHaveLength(1);
    expect(floorplan.sections[0]?.cells).toHaveLength(5);
    expect(floorplan.sections[0]?.cells).toContainEqual({ x: 0, y: 2 });
  });

  it("respeta initialAperture explícita (válvula sellada de fábrica)", () => {
    const floorplan = parseShipFloorplan(
      minimalMap({
        conduits: [
          point(64, 32, props({ a: "alfa", b: "beta", kind: "ventilacion", initialAperture: 0 })),
        ],
      }),
    );
    expect(floorplan.conduits[0]?.initialAperture).toBe(0);
  });

  it("rechaza un rectángulo de sección no alineado al grid de 32px", () => {
    expect(() =>
      parseShipFloorplan(
        minimalMap({
          sections: [rect(10, 0, 64, 64, props({ id: "alfa", nameKey: "section.alfa" }))],
          conduits: [],
          anchors: [],
        }),
      ),
    ).toThrow(FloorplanParseError);
  });

  it("rechaza una propiedad obligatoria ausente (nameKey de sección)", () => {
    expect(() =>
      parseShipFloorplan(
        minimalMap({
          sections: [rect(0, 0, 64, 64, props({ id: "alfa" }))],
          conduits: [],
          anchors: [],
        }),
      ),
    ).toThrow(FloorplanParseError);
  });

  it("rechaza un arquetipo desconocido", () => {
    expect(() =>
      parseShipFloorplan(
        minimalMap({
          mapProperties: props({
            schemaVersion: 1,
            shipId: "nave-test",
            archetype: "pirata",
            nameKey: "ship.test.name",
          }),
        }),
      ),
    ).toThrow(/archetype/i);
  });

  it("rechaza un tamaño de tile distinto de la unidad de grid (32px)", () => {
    expect(() => parseShipFloorplan(minimalMap({ tilewidth: 16 }))).toThrow(/32px/);
  });

  it("rechaza un tipo de conducto desconocido", () => {
    expect(() =>
      parseShipFloorplan(
        minimalMap({
          conduits: [point(64, 32, props({ a: "alfa", b: "beta", kind: "hidraulico" }))],
        }),
      ),
    ).toThrow(/conduit kind/i);
  });

  it("rechaza un anclaje que cae fuera de toda sección", () => {
    expect(() =>
      parseShipFloorplan(minimalMap({ anchors: [point(300, 300, props({ id: "huerfano" }))] })),
    ).toThrow(/outside every section/);
  });

  it("rechaza un mapa sin la capa 'secciones'", () => {
    const map = minimalMap() as { layers: { name: string }[] };
    map.layers = map.layers.filter((layer) => layer.name !== "secciones");
    expect(() => parseShipFloorplan(map)).toThrow(/secciones/);
  });
});
