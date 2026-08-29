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

  it("el footprint de cada instancia refleja el `span` autorado de su vano", () => {
    // Dos puertas aportarían dos aristas de difusión y ese vano intercambiaría
    // aire al doble de velocidad que uno de una celda: un vano de N celdas tiene
    // que ser UNA instancia de N×1 (o 1×N), no N piezas.
    //
    // RECALIBRADO en la ronda 2 de playtest de 13g: antes exigía que el mapa
    // autorado tuviera al menos un vano ancho, y el operador editó los suyos a
    // `span: 1` a propósito. Un test que se cae porque el CONTENIDO cambió no
    // estaba probando el mapeo, estaba probando el mapa. Ahora deriva lo
    // esperado del `span` de cada puerta, sea cual sea.
    for (const [index, door] of plan.doors.entries()) {
      const instance = seeded.components[index]!;
      const expected =
        door.axis === "x"
          ? { width: door.span, height: 1 }
          : { width: 1, height: door.span };
      expect(instance.placement.footprint, `vano '${door.id}'`).toEqual(expected);
    }
  });

  it("un vano ancho es UNA instancia, no N piezas de una celda", () => {
    // El mapeo de arriba con un vano ANCHO de verdad, independiente de lo que
    // el mapa autore hoy — es la propiedad que importa y no puede quedar sin
    // cobertura porque el contenido cambie.
    const ancho = instantiateDoorSeeds(
      [{ ...plan.doors[0]!, span: 2, axis: "x" as const }],
      REGISTRY,
    );
    expect(ancho.components).toHaveLength(1);
    expect(ancho.components[0]!.placement.footprint).toEqual({ width: 2, height: 1 });
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
