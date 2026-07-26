import { describe, expect, it } from "vitest";

import type { SectionId } from "../atmosphere/section.types.js";
import type { ConduitConnection, ConduitKind, ShipFloorplan } from "./floorplan.types.js";
import { findConduitRoute, sectionsConnectedByConduit } from "./conduit-connectivity.js";

function conduit(a: string, b: string, kind: ConduitKind): ConduitConnection {
  return {
    a: a as SectionId,
    b: b as SectionId,
    kind,
    position: { x: 0, y: 0 },
    initialAperture: 1,
  };
}

/** Cadena: puente — pasillo — soporte, unida por conductos `senal`; `bodega` cuelga solo por `electrico`. */
const floorplan: ShipFloorplan = {
  id: "nave-test",
  archetype: "exploracion",
  nameKey: "ship.test.name",
  gridSize: { width: 8, height: 8 },
  sections: [],
  conduits: [
    conduit("puente", "pasillo", "senal"),
    conduit("pasillo", "soporte", "senal"),
    conduit("pasillo", "bodega", "electrico"),
  ],
  anchors: [],
  componentSeeds: [],
};

describe("sectionsConnectedByConduit", () => {
  it("misma sección: siempre conectada, sin necesitar conducto", () => {
    expect(sectionsConnectedByConduit(floorplan, "senal", "puente" as SectionId, "puente" as SectionId)).toBe(true);
  });

  it("conducto directo del tipo pedido", () => {
    expect(sectionsConnectedByConduit(floorplan, "senal", "puente" as SectionId, "pasillo" as SectionId)).toBe(true);
  });

  it("multi-salto: puente → pasillo → soporte por conductos `senal`", () => {
    expect(sectionsConnectedByConduit(floorplan, "senal", "puente" as SectionId, "soporte" as SectionId)).toBe(true);
  });

  it("sin conducto del tipo pedido entre esas secciones: no conectada", () => {
    expect(sectionsConnectedByConduit(floorplan, "senal", "puente" as SectionId, "bodega" as SectionId)).toBe(false);
  });

  it("ignora conductos de OTRO tipo: `bodega` cuelga por `electrico`, no por `senal`", () => {
    expect(sectionsConnectedByConduit(floorplan, "electrico", "pasillo" as SectionId, "bodega" as SectionId)).toBe(true);
    expect(sectionsConnectedByConduit(floorplan, "senal", "pasillo" as SectionId, "bodega" as SectionId)).toBe(false);
  });
});

describe("findConduitRoute", () => {
  it("misma sección: ruta vacía (cero conductos)", () => {
    expect(findConduitRoute(floorplan, "senal", "puente" as SectionId, "puente" as SectionId)).toEqual([]);
  });

  it("devuelve la secuencia de conductos del camino multi-salto", () => {
    const route = findConduitRoute(floorplan, "senal", "puente" as SectionId, "soporte" as SectionId);
    expect(route).toHaveLength(2);
    expect(route?.[0]?.a).toBe("puente");
    expect(route?.[1]?.b).toBe("soporte");
  });

  it("undefined cuando no hay ruta del tipo pedido", () => {
    expect(findConduitRoute(floorplan, "senal", "puente" as SectionId, "bodega" as SectionId)).toBeUndefined();
  });
});
