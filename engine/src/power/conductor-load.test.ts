import { describe, expect, it } from "vitest";
import { edgeElectricalLoad } from "./conductor-load.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { declaredPowerDraw } from "./power-parameters.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";

/**
 * Carga eléctrica derivada del cableado (Subfase 14a-2, mudada a la ARISTA en
 * 14a-4).
 *
 * Contra el CATÁLOGO REAL, no fixtures sintéticos: el número que importa es el
 * `powerDraw` que las piezas declaran de verdad y la `maxCapacity` re-escalada,
 * y un fixture propio probaría mi aritmética en vez del contenido (patrón 13 de
 * las lecciones de playtest — el bug de 13g solo se veía con el catálogo real).
 */

const REGISTRY = buildComponentCatalog().registry;

const FUENTE = "fuente-1" as PlacedComponentInstanceId;
const FUENTE_NODE = "fuente-1-em" as SignalNodeId;
/** La arista bajo prueba: sale de la fuente hacia la primera pieza colgada. */
const WIRE = "wire-1" as SignalEdgeId;

interface Piece {
  readonly instanceId: PlacedComponentInstanceId;
  readonly componentDefinitionId: ComponentId;
  readonly nodeId: SignalNodeId;
}

/**
 * Fuente con `pieces` colgando en CADENA por aristas sucesivas: la fuente
 * alimenta a la pieza 1 (arista `WIRE`), la pieza 1 a la 2, y así. Es el montaje
 * que interesa — el cable de arriba carga con todo lo que cuelga debajo.
 */
function blueprintWith(pieces: ReadonlyArray<Piece>): Blueprint {
  const chain = [{ nodeId: FUENTE_NODE }, ...pieces];
  return {
    metadata: {
      schemaVersion: 11,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: FUENTE,
        componentDefinitionId: "fotorreceptor" as ComponentId,
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
        { id: FUENTE_NODE, role: "emitter" as const, position: { x: 0, y: 0 }, ownerRef: FUENTE },
        ...pieces.map((piece, index) => ({
          id: piece.nodeId,
          role: "receptor" as const,
          position: { x: index + 1, y: 0 },
          ownerRef: piece.instanceId,
        })),
      ],
      edges: pieces.map((piece, index) => ({
        id: (index === 0 ? WIRE : `wire-${index + 1}`) as SignalEdgeId,
        from: chain[index]!.nodeId,
        to: piece.nodeId,
        conductorId: "cable-cobre" as ComponentId,
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

describe("edgeElectricalLoad (14a-4: el cable del jugador es el conductor)", () => {
  it("una arista inexistente no lleva carga", () => {
    expect(edgeElectricalLoad(blueprintWith([]), WIRE, REGISTRY)).toBe(0);
  });

  it("cuenta la pieza que alimenta, no solo lo que hay más abajo", () => {
    // Es la diferencia deliberada con la versión por instancia de 14a-2: si el
    // dueño de `edge.to` no contara, un cable con una sola pieza colgada nunca
    // podría sobrecargarse.
    const blueprint = blueprintWith([piece(1, "indicador-led")]);
    expect(edgeElectricalLoad(blueprint, WIRE, REGISTRY)).toBe(
      declaredPowerDraw("indicador-led" as ComponentId),
    );
  });

  it("suma el powerDraw REAL de toda la cadena que cuelga", () => {
    const blueprint = blueprintWith([piece(1, "indicador-led"), piece(2, "compuerta-blindada")]);
    // Derivado de la tabla, no copiado: si el balance cambia, el test sigue
    // midiendo lo que dice medir.
    const expected =
      declaredPowerDraw("indicador-led" as ComponentId) +
      declaredPowerDraw("compuerta-blindada" as ComponentId);
    expect(edgeElectricalLoad(blueprint, WIRE, REGISTRY)).toBe(expected);
  });

  it("la fuente aguas arriba no pesa sobre el cable", () => {
    // `fotorreceptor` cuelga de `edge.from`, no de `edge.to`.
    const blueprint = blueprintWith([piece(1, "indicador-led")]);
    expect(edgeElectricalLoad(blueprint, WIRE, REGISTRY)).toBe(
      declaredPowerDraw("indicador-led" as ComponentId),
    );
    expect(declaredPowerDraw("fotorreceptor" as ComponentId)).toBeGreaterThan(0);
  });

  it("un cable quemado aguas abajo DESCARGA al de arriba", () => {
    // Consecuencia sistémica de 14a-4: la cadena de fallos se detiene sola en
    // vez de ser una lista de eventos independientes.
    const blueprint = blueprintWith([piece(1, "indicador-led"), piece(2, "compuerta-blindada")]);
    const conElSegundoQuemado: Blueprint = {
      ...blueprint,
      overloadedRefs: ["wire-2" as SignalEdgeId],
    };
    expect(edgeElectricalLoad(conElSegundoQuemado, WIRE, REGISTRY)).toBe(
      declaredPowerDraw("indicador-led" as ComponentId),
    );
  });

  it("una arista quemada no lleva carga ella misma", () => {
    const blueprint = blueprintWith([piece(1, "indicador-led")]);
    const quemada: Blueprint = { ...blueprint, overloadedRefs: [WIRE] };
    expect(edgeElectricalLoad(quemada, WIRE, REGISTRY)).toBe(0);
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
            id: "loop" as SignalEdgeId,
            from: "pieza-1-rec" as SignalNodeId,
            to: FUENTE_NODE,
            conductorId: "cable-cobre" as ComponentId,
          },
        ],
      },
    };
    // Con el lazo cerrado, la fuente pasa a estar aguas abajo del cable y sí
    // cuenta: el recorrido es correcto, no se cuelga, y no cuenta dos veces.
    expect(edgeElectricalLoad(cyclic, WIRE, REGISTRY)).toBe(
      declaredPowerDraw("indicador-led" as ComponentId) +
        declaredPowerDraw("fotorreceptor" as ComponentId),
    );
  });

  it("la escala del catálogo deja una franja donde SOLO la temperatura decide", () => {
    // El acoplamiento térmico solo significa algo si existe una carga que sea
    // segura en operación normal y mortal fuera de rango (un umbral que colapsa
    // contra otro número del sistema es un escritor muerto).
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
