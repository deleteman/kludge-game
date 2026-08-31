import { describe, expect, it } from "vitest";
import { conductorElectricalLoad } from "./conductor-load.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { declaredPowerDraw } from "./power-parameters.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";

/**
 * Carga eléctrica derivada del cableado (Subfase 14a-2).
 *
 * Contra el CATÁLOGO REAL, no fixtures sintéticos: el número que importa es el
 * `powerDraw` que las piezas declaran de verdad y la `maxCapacity` re-escalada,
 * y un fixture propio probaría mi aritmética en vez del contenido (patrón 50 de
 * las lecciones de playtest — el bug de 13g solo se veía con el catálogo real).
 */

const REGISTRY = buildComponentCatalog().registry;

const CABLE = "cable-1" as PlacedComponentInstanceId;
const CABLE_NODE = "cable-1-cond" as SignalNodeId;

interface Piece {
  readonly instanceId: PlacedComponentInstanceId;
  readonly componentDefinitionId: ComponentId;
  readonly nodeId: SignalNodeId;
}

/** Cable con `pieces` colgando aguas abajo, todas por una arista directa. */
function blueprintWith(pieces: ReadonlyArray<Piece>): Blueprint {
  return {
    metadata: {
      schemaVersion: 5,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: CABLE,
        componentDefinitionId: "cable-cobre" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
      ...pieces.map((piece, index) => ({
        instanceId: piece.instanceId,
        componentDefinitionId: piece.componentDefinitionId,
        placement: {
          position: { x: index + 1, y: 0 },
          footprint: { width: 1, height: 1 },
          rotation: 0 as const,
        },
        condition: "ok" as const,
        wear: "nuevo" as const,
      })),
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        { id: CABLE_NODE, role: "conductor" as const, position: { x: 0, y: 0 }, ownerRef: CABLE },
        ...pieces.map((piece, index) => ({
          id: piece.nodeId,
          role: "receptor" as const,
          position: { x: index + 1, y: 0 },
          ownerRef: piece.instanceId,
        })),
      ],
      edges: pieces.map((piece) => ({
        id: `${CABLE_NODE}->${piece.nodeId}` as Blueprint["signalGraph"]["edges"][number]["id"],
        from: CABLE_NODE,
        to: piece.nodeId,
      })),
    },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

function piece(n: number, componentDefinitionId: string): Piece {
  return {
    instanceId: `pieza-${n}` as PlacedComponentInstanceId,
    componentDefinitionId: componentDefinitionId as ComponentId,
    nodeId: `pieza-${n}-rec` as SignalNodeId,
  };
}

describe("conductorElectricalLoad (14a-2: la sobrecarga emerge del cableado, no del guion)", () => {
  it("un conductor sin nada cableado no lleva carga", () => {
    expect(conductorElectricalLoad(blueprintWith([]), CABLE, REGISTRY)).toBe(0);
  });

  it("suma el powerDraw REAL de cada pieza colgada", () => {
    const blueprint = blueprintWith([piece(1, "indicador-led"), piece(2, "compuerta-blindada")]);
    // Derivado de la tabla, no copiado: si el balance cambia, el test sigue
    // midiendo lo que dice medir (patrón 45).
    const expected =
      declaredPowerDraw("indicador-led" as ComponentId) +
      declaredPowerDraw("compuerta-blindada" as ComponentId);
    expect(conductorElectricalLoad(blueprint, CABLE, REGISTRY)).toBe(expected);
  });

  it("el conductor no se cuenta a sí mismo: COND(E) conduce, no consume", () => {
    const withAnotherCable = blueprintWith([piece(1, "cable-cobre")]);
    expect(conductorElectricalLoad(withAnotherCable, CABLE, REGISTRY)).toBe(0);
  });

  it("cuenta también lo que cuelga en cadena, no solo lo adyacente", () => {
    const blueprint = blueprintWith([piece(1, "indicador-led"), piece(2, "indicador-led")]);
    // Se re-encadena: pieza-2 pasa a colgar de pieza-1 en vez del cable.
    const chained: Blueprint = {
      ...blueprint,
      signalGraph: {
        ...blueprint.signalGraph,
        edges: [
          blueprint.signalGraph.edges[0]!,
          { ...blueprint.signalGraph.edges[1]!, from: "pieza-1-rec" as SignalNodeId },
        ],
      },
    };
    expect(conductorElectricalLoad(chained, CABLE, REGISTRY)).toBe(
      declaredPowerDraw("indicador-led" as ComponentId) * 2,
    );
  });

  it("tolera un ciclo en el grafo (el latch del GDD 5.6) sin colgarse", () => {
    const blueprint = blueprintWith([piece(1, "indicador-led")]);
    const cyclic: Blueprint = {
      ...blueprint,
      signalGraph: {
        ...blueprint.signalGraph,
        edges: [
          ...blueprint.signalGraph.edges,
          {
            id: "loop" as Blueprint["signalGraph"]["edges"][number]["id"],
            from: "pieza-1-rec" as SignalNodeId,
            to: CABLE_NODE,
          },
        ],
      },
    };
    expect(conductorElectricalLoad(cyclic, CABLE, REGISTRY)).toBe(
      declaredPowerDraw("indicador-led" as ComponentId),
    );
  });

  it("la escala del catálogo deja una franja donde SOLO la temperatura decide", () => {
    // El acoplamiento térmico solo significa algo si existe una carga que sea
    // segura en operación normal y mortal fuera de rango (patrón 23: un umbral
    // que colapsa contra otro número del sistema es un escritor muerto).
    const cable = REGISTRY.get("cable-cobre" as ComponentId);
    const capacity = cable?.data.functional?.find((property) => property.tag === "COND");
    expect(capacity?.tag).toBe("COND");
    const max = capacity?.tag === "COND" ? capacity.maxCapacity : 0;
    expect(max * 0.5).toBeLessThan(max);
    // Y esa franja es alcanzable con piezas reales: 4 LEDs entran en el cable
    // sano y lo revientan en frío.
    const fourLeds = declaredPowerDraw("indicador-led" as ComponentId) * 4;
    expect(fourLeds).toBeLessThanOrEqual(max);
    expect(fourLeds).toBeGreaterThan(max * 0.5);
  });
});
