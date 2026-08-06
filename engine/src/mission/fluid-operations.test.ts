import { describe, expect, it } from "vitest";
import { FluidOperationRegistry } from "./fluid-operations.js";
import { CANONICAL_SHIP_FLOORPLANS } from "../floorplan/canonical-ships.js";
import { sectionsConnectedByConduit } from "../floorplan/conduit-connectivity.js";
import type { SectionId } from "../atmosphere/section.types.js";

const BODEGA = "bodega-carga" as SectionId;
const PASILLO = "pasillo-central" as SectionId;
const SOPORTE = "soporte-vital" as SectionId;
const PROPULSION = "propulsion" as SectionId;

describe("FluidOperationRegistry", () => {
  it("una operación entra y sale con el ciclo de vida de su tarea", () => {
    const registry = new FluidOperationRegistry();
    expect(registry.isEmpty).toBe(true);

    registry.begin("t1", { fromSectionId: BODEGA, toSectionId: PASILLO, rate: 1 });
    expect(registry.rateBetween(BODEGA, PASILLO)).toBe(1);

    registry.end("t1");
    expect(registry.isEmpty).toBe(true);
    expect(registry.rateBetween(BODEGA, PASILLO)).toBe(0);
  });

  it("ignora caudales no positivos en vez de registrar operaciones invisibles", () => {
    const registry = new FluidOperationRegistry();
    registry.begin("t1", { fromSectionId: BODEGA, rate: 0 });
    registry.begin("t2", { fromSectionId: BODEGA, rate: -3 });
    expect(registry.isEmpty).toBe(true);
  });

  it("suma varias operaciones sobre el mismo par de secciones", () => {
    const registry = new FluidOperationRegistry();
    registry.begin("t1", { fromSectionId: BODEGA, toSectionId: PASILLO, rate: 1 });
    registry.begin("t2", { fromSectionId: PASILLO, toSectionId: BODEGA, rate: 0.5 });
    expect(registry.rateBetween(BODEGA, PASILLO)).toBeCloseTo(1.5);
  });

  it("no distingue dirección: un conducto se anima igual en cualquier sentido", () => {
    const registry = new FluidOperationRegistry();
    registry.begin("t1", { fromSectionId: PASILLO, toSectionId: BODEGA, rate: 2 });
    expect(registry.rateBetween(BODEGA, PASILLO)).toBe(2);
  });

  it("una operación in situ también mueve el conducto que alimenta su sección", () => {
    // Purgar/extraer no cruza a otra sección, pero el fluido igual se mueve.
    const registry = new FluidOperationRegistry();
    registry.begin("t1", { fromSectionId: BODEGA, rate: 1 });
    expect(registry.rateBetween(BODEGA, PASILLO)).toBe(1);
  });

  it("una operación ajena a ambas secciones no las afecta", () => {
    const registry = new FluidOperationRegistry();
    registry.begin("t1", { fromSectionId: PROPULSION, rate: 5 });
    expect(registry.rateBetween(BODEGA, SOPORTE)).toBe(0);
  });

  it("terminar una operación inexistente no rompe (eventos duplicados)", () => {
    const registry = new FluidOperationRegistry();
    expect(() => registry.end("fantasma")).not.toThrow();
  });
});

/**
 * Subfase 13e: sin conductos `fluido` autorados, el trasvase cross-section
 * queda bloqueado y la capa `fluido` nunca se anima entre secciones. Este test
 * fija el contenido mínimo del que depende el flujo de la subfase — cierra la
 * parte de la deuda #13 que 13e necesita.
 */
describe("nave-exploracion — red de conductos `fluido` (13e)", () => {
  const floorplan = CANONICAL_SHIP_FLOORPLANS.exploracion;

  it("bodega-carga (aparatos de fabricación) está en la red de fluido", () => {
    expect(sectionsConnectedByConduit(floorplan, "fluido", BODEGA, PASILLO)).toBe(true);
  });

  it("soporte-vital (reservorio de agua sembrado) está en la red de fluido", () => {
    expect(sectionsConnectedByConduit(floorplan, "fluido", SOPORTE, PASILLO)).toBe(true);
  });

  it("el reservorio sembrado alcanza a la estación química (multi-salto)", () => {
    expect(sectionsConnectedByConduit(floorplan, "fluido", SOPORTE, BODEGA)).toBe(true);
  });
});
