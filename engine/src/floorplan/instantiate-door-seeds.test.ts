import { describe, expect, it } from "vitest";
import {
  AUTHORED_DOOR_COMPONENT_ID,
  buildComponentCatalog,
  CANONICAL_SHIP_FLOORPLANS,
  instantiateDoorSeeds,
} from "../index.js";

const REGISTRY = buildComponentCatalog().registry;

describe("instantiateDoorSeeds (13h, ronda 1 de playtest)", () => {
  const plan = CANONICAL_SHIP_FLOORPLANS.exploracion;
  const seeded = instantiateDoorSeeds(plan.doors, REGISTRY);

  it("materializa una instancia de compuerta por puerta autorada", () => {
    expect(seeded.components).toHaveLength(plan.doors.length);
    expect(
      seeded.components.every(
        (instance) => instance.componentDefinitionId === AUTHORED_DOOR_COMPONENT_ID,
      ),
    ).toBe(true);
  });

  it("un vano de dos celdas es UNA instancia 2×1, no dos piezas", () => {
    // Dos puertas aportarían dos aristas de difusión y ese vano intercambiaría
    // aire al doble de velocidad que uno de una celda.
    const anchos = seeded.components.filter(
      (instance) => instance.placement.footprint.width * instance.placement.footprint.height > 1,
    );
    const vanosDeDos = plan.doors.filter((door) => door.span > 1);
    expect(anchos).toHaveLength(vanosDeDos.length);
    expect(vanosDeDos.length).toBeGreaterThan(0);
    for (const instance of anchos) {
      expect(instance.placement.footprint).toEqual({ width: 2, height: 1 });
    }
  });

  it("cada puerta trae su nodo RECEPTOR, que es lo que la vuelve cableable", () => {
    // El reporte #5 del playtest era exactamente esto: las puertas no aparecían
    // en modo cableado porque no tenían nodo. El nodo sale del `ACT` de la
    // compuerta (`derive-signal-nodes.ts`), no de una lista especial.
    expect(seeded.signalNodes).toHaveLength(plan.doors.length);
    expect(seeded.signalNodes.every((node) => node.role === "receptor")).toBe(true);

    const owners = new Set(seeded.components.map((instance) => instance.instanceId));
    expect(seeded.signalNodes.every((node) => owners.has(node.ownerRef))).toBe(true);
  });

  it("el nodo cae sobre una celda de la propia puerta (el modo cableado busca por posición)", () => {
    for (const node of seeded.signalNodes) {
      const owner = seeded.components.find((instance) => instance.instanceId === node.ownerRef)!;
      const { position, footprint } = owner.placement;
      expect(node.position.x).toBeGreaterThanOrEqual(position.x);
      expect(node.position.x).toBeLessThan(position.x + footprint.width);
      expect(node.position.y).toBeGreaterThanOrEqual(position.y);
      expect(node.position.y).toBeLessThan(position.y + footprint.height);
    }
  });

  it("los arquetipos sin capa `puertas` no siembran nada", () => {
    expect(instantiateDoorSeeds(CANONICAL_SHIP_FLOORPLANS.guerra.doors, REGISTRY).components).toEqual([]);
  });
});
