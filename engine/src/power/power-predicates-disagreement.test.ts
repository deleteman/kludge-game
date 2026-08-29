import { describe, expect, it } from "vitest";
import { allocateComponentPower } from "./power-allocation.js";
import { isInstanceEnergized } from "../salvage/instance-energized.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";

/**
 * La franja donde los DOS predicados de energía discrepan (13h, ronda 3 de
 * playtest).
 *
 * El operador clickeó una compuerta y el panel le mostró dos mensajes que se
 * leían como una contradicción: "Pieza energizada: desmontarla provocará un
 * chispazo" junto a "Sin energía: el motor no la mueve". Los dos eran ciertos.
 *
 *  - `isInstanceEnergized` pregunta "¿hay corriente viva acá?" — la SECCIÓN
 *    tiene unidades otorgadas y la pieza es eléctricamente relevante.
 *  - `allocateComponentPower` pregunta "¿su demanda está satisfecha?" — y es
 *    TODO O NADA: con 1 unidad y un consumo de 2, la pieza no arranca.
 *
 * Son semánticas distintas a propósito (ver el docblock de
 * `instance-energized.ts`) y ninguna estaba mal. Lo que faltaba era un test que
 * anclara que **discrepan en esta franja**: sin él, cualquier futuro "arreglo"
 * de uno de los dos predicados rompería el otro en silencio, y la UI que ahora
 * explica el caso volvería a mentir.
 */

const DOOR = "puerta-1" as PlacedComponentInstanceId;
const DOOR_DEFINITION_ID = "compuerta-blindada" as ComponentId;

const DEFINITION: PhysicalComponentDefinition = {
  id: DOOR_DEFINITION_ID,
  name: "Compuerta blindada",
  level: "atomic",
  data: {
    functional: [{ tag: "ACT", power: 70, cadence: 1.5, directional: false }],
    powerDraw: 2,
    material: { RE: "A" },
    footprint: { width: 1, height: 1 },
  },
};

const REGISTRY = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
REGISTRY.register(DOOR_DEFINITION_ID, DEFINITION);

const INSTANCE: PlacedComponentInstance = {
  instanceId: DOOR,
  componentDefinitionId: DOOR_DEFINITION_ID,
  placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
  condition: "ok",
  wear: "nuevo",
};

function poweredWith(sectionUnits: number): boolean {
  return allocateComponentPower(sectionUnits, [INSTANCE], [], REGISTRY).poweredInstanceIds.has(DOOR);
}

function energizedWith(sectionUnits: number): boolean {
  return isInstanceEnergized({
    definition: DEFINITION,
    sectionHasGrantedPower: sectionUnits > 0,
    sourceDischarged: false,
  });
}

describe("los dos predicados de energía (13h, ronda 3 de playtest)", () => {
  it("con la sección A CERO los dos coinciden: ni corriente ni demanda cubierta", () => {
    expect(energizedWith(0)).toBe(false);
    expect(poweredWith(0)).toBe(false);
  });

  it("con la sección CUBRIENDO el consumo los dos coinciden: viva y funcionando", () => {
    expect(energizedWith(2)).toBe(true);
    expect(poweredWith(2)).toBe(true);
  });

  it("DISCREPAN en la franja `0 < otorgado < powerDraw` — el caso exacto del reporte", () => {
    // Hay corriente en la sección (peligrosa de desmontar) pero no alcanza para
    // mover el motor (no arranca). Las dos cosas a la vez, y las dos ciertas.
    expect(energizedWith(1)).toBe(true);
    expect(poweredWith(1)).toBe(false);
  });

  it("el reparto es TODO O NADA: no hay alimentación parcial que suavice la franja", () => {
    // Si algún día se introdujera degradación parcial, este test tiene que
    // fallar y obligar a revisar los dos mensajes que el jugador ve.
    expect(poweredWith(1)).toBe(false);
    expect(poweredWith(2)).toBe(true);
  });
});
