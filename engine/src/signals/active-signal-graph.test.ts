import { describe, expect, it } from "vitest";
import { burnedWiresTouching } from "./active-signal-graph.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalEdgeId } from "./signal-edge.types.js";
import type { SignalNodeId } from "./signal-node.types.js";

/**
 * Ronda 3 de playtest de 14a-4. El operador quemó el tronco
 * `fotorreceptor → chip`, vio la cicatriz sobre el chip y no tuvo desde dónde
 * confirmar qué se había roto. Esta es la consulta que se lo dice desde la
 * pieza, que es donde estaba mirando.
 */

const SENSOR = "sensor" as PlacedComponentInstanceId;
const CHIP = "chip" as PlacedComponentInstanceId;
const LED = "led" as PlacedComponentInstanceId;
const nodeOf = (id: string): SignalNodeId => `${id}-node` as SignalNodeId;

function blueprintWith(burnedEdgeIds: ReadonlyArray<string>): Blueprint {
  const piezas: ReadonlyArray<[PlacedComponentInstanceId, string]> = [
    [SENSOR, "fotorreceptor"],
    [CHIP, "chip-circuito-generico"],
    [LED, "indicador-led"],
  ];
  return {
    metadata: {
      schemaVersion: 11,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
    placedComponents: piezas.map(([instanceId, componentId], index) => ({
      instanceId,
      componentDefinitionId: componentId as ComponentId,
      placement: {
        position: { x: index, y: 0 },
        footprint: { width: 1, height: 1 },
        rotation: 0 as const,
      },
      condition: "ok" as const,
      wear: "nuevo" as const,
    })),
    reservoirContents: [],
    signalGraph: {
      nodes: piezas.map(([instanceId], index) => ({
        id: nodeOf(instanceId),
        role: index === 0 ? ("emitter" as const) : ("receptor" as const),
        position: { x: index, y: 0 },
        ownerRef: instanceId,
      })),
      // El montaje del reporte: sensor → chip (el TRONCO) y chip → led.
      edges: [
        { id: "tronco" as SignalEdgeId, from: nodeOf(SENSOR), to: nodeOf(CHIP) },
        { id: "rama" as SignalEdgeId, from: nodeOf(CHIP), to: nodeOf(LED) },
      ],
    },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    instanceConfigs: [],
    overloadedRefs: burnedEdgeIds as unknown as Blueprint["overloadedRefs"],
    powerState: {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

describe("burnedWiresTouching (14a-4 ronda 3)", () => {
  it("cuenta el cable quemado que SALE de la pieza", () => {
    expect(burnedWiresTouching(blueprintWith(["tronco"]), SENSOR)).toBe(1);
  });

  it("cuenta el cable quemado que ENTRA a la pieza", () => {
    // El caso exacto del reporte: el chip fue la pieza que pareció rota, y su
    // cable quemado es entrante. Contar solo salientes lo habría dejado mudo.
    expect(burnedWiresTouching(blueprintWith(["tronco"]), CHIP)).toBe(1);
  });

  it("una pieza con el cableado sano no cuenta nada", () => {
    expect(burnedWiresTouching(blueprintWith(["tronco"]), LED)).toBe(0);
    expect(burnedWiresTouching(blueprintWith([]), CHIP)).toBe(0);
  });

  it("suma los dos cuando la pieza tiene quemados de los dos lados", () => {
    expect(burnedWiresTouching(blueprintWith(["tronco", "rama"]), CHIP)).toBe(2);
  });

  it("una pieza sin nodos de señal no cuenta nada", () => {
    const sinNodos = "plancha" as PlacedComponentInstanceId;
    expect(burnedWiresTouching(blueprintWith(["tronco"]), sinNodos)).toBe(0);
  });

  it("una instancia sobrecargada en `overloadedRefs` no se confunde con un cable", () => {
    // `overloadedRefs` es heterogéneo (instancias + aristas). Si la cuenta
    // mirara el ref suelto en vez de comparar contra los ids de arista, una
    // pieza quemada se contaría a sí misma como cable roto.
    expect(burnedWiresTouching(blueprintWith([CHIP]), CHIP)).toBe(0);
  });
});
