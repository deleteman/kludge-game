import { describe, expect, it } from "vitest";
import { allocateEmitterFanout } from "./emitter-fanout.js";
import { edgeElectricalLoad } from "../power/conductor-load.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { InstancePowerPriority } from "../power/power.types.js";
import type { SignalEdgeId } from "./signal-edge.types.js";
import type { SignalNodeId } from "./signal-node.types.js";

/**
 * Triaje de fan-out (14a-4, ronda 2 de playtest). Contra el CATÁLOGO REAL, como
 * `conductor-load.test.ts`: lo que importa es que el fotorreceptor y los LEDs
 * que el operador cableó de verdad den los números que dieron, no que mi
 * aritmética cierre sobre un fixture inventado.
 */

const REGISTRY = buildComponentCatalog().registry;

/** Una pieza del montaje: qué es y con qué rol participa del grafo. */
interface Pieza {
  readonly id: string;
  readonly componentId: string;
  readonly role: "emitter" | "receptor";
}

const nodeOf = (id: string): SignalNodeId => `${id}-node` as SignalNodeId;

/**
 * Blueprint mínimo a partir de piezas y cables. Los cables se declaran como
 * pares de ids de pieza, así que un test dice literalmente la topología que
 * está probando (estrella vs. tronco) en vez de enterrarla en índices.
 */
function blueprintWith(
  piezas: ReadonlyArray<Pieza>,
  cables: ReadonlyArray<readonly [string, string]>,
  priorities: ReadonlyArray<InstancePowerPriority> = [],
): Blueprint {
  return {
    metadata: {
      schemaVersion: 11,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    },
    placedComponents: piezas.map((pieza, index) => ({
      instanceId: pieza.id as PlacedComponentInstanceId,
      componentDefinitionId: pieza.componentId as ComponentId,
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
      nodes: piezas.map((pieza, index) => ({
        id: nodeOf(pieza.id),
        role: pieza.role,
        position: { x: index, y: 0 },
        ownerRef: pieza.id as PlacedComponentInstanceId,
      })),
      edges: cables.map(([from, to], index) => ({
        id: `cable-${index}` as SignalEdgeId,
        from: nodeOf(from),
        to: nodeOf(to),
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
      instancePriorities: priorities,
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

const SENSOR: Pieza = { id: "sensor", componentId: "fotorreceptor", role: "emitter" };
const led = (n: number): Pieza => ({ id: `led-${n}`, componentId: "indicador-led", role: "receptor" });
const PUERTA: Pieza = { id: "puerta", componentId: "compuerta-blindada", role: "receptor" };
const LCD: Pieza = { id: "lcd", componentId: "pantalla-lcd", role: "receptor" };
const CHIP: Pieza = { id: "chip", componentId: "chip-circuito-generico", role: "receptor" };

/** Exactamente el montaje del reporte: 5 LEDs + compuerta + LCD, todos en estrella. */
const CONSUMIDORES = [led(1), led(2), led(3), led(4), led(5), PUERTA, LCD];
const ESTRELLA = CONSUMIDORES.map((pieza) => ["sensor", pieza.id] as const);

describe("allocateEmitterFanout", () => {
  it("dentro de capacidad no sacrifica a nadie", () => {
    const blueprint = blueprintWith([SENSOR, led(1), led(2)], [
      ["sensor", "led-1"],
      ["sensor", "led-2"],
    ]);
    const result = allocateEmitterFanout(blueprint, REGISTRY);
    expect([...result.starvedInstanceIds]).toEqual([]);
    expect(result.bySourceNode.get(nodeOf("sensor"))).toEqual({
      driven: 2,
      demand: 2,
      capacity: 3,
    });
  });

  it("el montaje del reporte: 7 consumidores, demanda 8, capacidad 3", () => {
    // El caso literal que el operador jugó. Antes de esta ronda no pasaba nada:
    // los 7 cables llevaban 1 cada uno y ningún cable llegaba jamás a ámbar.
    const blueprint = blueprintWith([SENSOR, ...CONSUMIDORES], ESTRELLA);
    const result = allocateEmitterFanout(blueprint, REGISTRY);
    const status = result.bySourceNode.get(nodeOf("sensor"));
    expect(status).toEqual({ driven: 7, demand: 8, capacity: 3 });
    expect(result.starvedInstanceIds.size).toBeGreaterThan(0);
    // Lo sostenido no puede exceder la capacidad: es la invariante del triaje.
    const sostenido = CONSUMIDORES.filter(
      (pieza) => !result.starvedInstanceIds.has(pieza.id as PlacedComponentInstanceId),
    ).reduce(
      (total, pieza) => total + (REGISTRY.get(pieza.componentId as ComponentId)?.data.powerDraw ?? 0),
      0,
    );
    expect(sostenido).toBeLessThanOrEqual(status!.capacity);
  });

  it("el dial de prioridad decide quién sobrevive", () => {
    // La misma decisión que en el triaje eléctrico, con el mismo dial: es lo
    // que el operador eligió para no tener que aprender dos sistemas.
    const blueprint = blueprintWith([SENSOR, ...CONSUMIDORES], ESTRELLA, [
      { instanceId: "puerta" as PlacedComponentInstanceId, priority: 0 },
    ]);
    const result = allocateEmitterFanout(blueprint, REGISTRY, blueprint.powerState.instancePriorities);
    expect(result.starvedInstanceIds.has("puerta" as PlacedComponentInstanceId)).toBe(false);
  });

  it("sin prioridades el desempate es determinista", () => {
    const blueprint = blueprintWith([SENSOR, ...CONSUMIDORES], ESTRELLA);
    const primero = allocateEmitterFanout(blueprint, REGISTRY);
    const segundo = allocateEmitterFanout(blueprint, REGISTRY);
    expect([...segundo.starvedInstanceIds]).toEqual([...primero.starvedInstanceIds]);
  });

  it("una pieza gobernada por DOS emisores sobrevive si uno la sostiene", () => {
    // Un respaldo redundante tiene que servir de respaldo. Sin esta regla, un
    // segundo sensor cableado "por las dudas" apagaría lo que venía a proteger.
    const OTRO: Pieza = { id: "sensor-b", componentId: "fotorreceptor", role: "emitter" };
    const blueprint = blueprintWith(
      [SENSOR, OTRO, ...CONSUMIDORES],
      [...ESTRELLA, ["sensor-b", "puerta"]],
      [],
    );
    const result = allocateEmitterFanout(blueprint, REGISTRY);
    // `sensor-b` gobierna solo la puerta (demanda 2 sobre capacidad 3), así que
    // la sostiene aunque el sensor sobrecargado la haya sacrificado.
    expect(result.starvedInstanceIds.has("puerta" as PlacedComponentInstanceId)).toBe(false);
  });

  it("un emisor sin nada colgado no aparece en el reporte", () => {
    const blueprint = blueprintWith([SENSOR], []);
    expect(allocateEmitterFanout(blueprint, REGISTRY).bySourceNode.size).toBe(0);
  });

  it("la demanda NO es transitiva: cada salida paga solo lo que cuelga de ella", () => {
    // La decisión central del módulo, en su forma más chica. El sensor alimenta
    // al chip y el chip a un LED: el sensor paga 1 (el chip), no 2.
    const blueprint = blueprintWith([SENSOR, CHIP, led(1)], [
      ["sensor", "chip"],
      ["chip", "led-1"],
    ]);
    const result = allocateEmitterFanout(blueprint, REGISTRY);
    expect(result.bySourceNode.get(nodeOf("sensor"))?.demand).toBe(1);
    expect(result.bySourceNode.get(nodeOf("chip"))?.demand).toBe(1);
  });

  /**
   * La regla anti-oscilación, anclada. Si el triaje descontara la demanda de lo
   * sacrificado, el cable se descargaría, la pieza volvería a entrar, y el
   * montaje parpadearía un tick sí y otro no. La carga es la demanda CABLEADA;
   * el triaje es solo quién la recibe.
   */
  it("sacrificar consumidores NO cambia la carga del cable", () => {
    const blueprint = blueprintWith([SENSOR, ...CONSUMIDORES], ESTRELLA);
    const cableDeLaPuerta = blueprint.signalGraph.edges.find((edge) => edge.to === nodeOf("puerta"))!;
    const cargaAntes = edgeElectricalLoad(blueprint, cableDeLaPuerta.id, REGISTRY);
    const result = allocateEmitterFanout(blueprint, REGISTRY);
    expect(result.starvedInstanceIds.size).toBeGreaterThan(0);
    expect(edgeElectricalLoad(blueprint, cableDeLaPuerta.id, REGISTRY)).toBe(cargaAntes);
  });
});

/**
 * El arco de diseño completo de la ronda, en un test. Es la lección que el
 * montaje del operador tenía que poder enseñar y no enseñaba: el sensor no da
 * abasto → hace falta un relé → el relé crea un tronco → el tronco se quema.
 */
describe("la lección: estrella → relé → tronco sobrecargado (14a-4 ronda 2)", () => {
  const TRONCO: ReadonlyArray<readonly [string, string]> = [
    ["sensor", "chip"],
    ...CONSUMIDORES.map((pieza) => ["chip", pieza.id] as const),
  ];

  it("con el relé nadie pasa hambre", () => {
    // La salida del relé. El sensor pasa a pagar SOLO el chip (1 sobre 3), y el
    // chip paga el montaje entero (8 sobre 8). Es lo que la demanda no
    // transitiva compra: sin ella el sensor seguiría viendo los 9 a través del
    // chip, el relé no resolvería nada y el jugador no tendría ninguna salida.
    const blueprint = blueprintWith([SENSOR, CHIP, ...CONSUMIDORES], TRONCO);
    const result = allocateEmitterFanout(blueprint, REGISTRY);
    expect(result.bySourceNode.get(nodeOf("sensor"))).toEqual({
      driven: 1,
      demand: 1,
      capacity: 3,
    });
    expect(result.bySourceNode.get(nodeOf("chip"))).toEqual({
      driven: 7,
      demand: 8,
      capacity: 8,
    });
    expect([...result.starvedInstanceIds]).toEqual([]);
  });

  it("el tronco lleva TODO lo que cuelga: 9 sobre un cobre de 6", () => {
    // Es el ámbar que el operador no veía. En estrella cada cable llevaba 1;
    // acá el primer cable lleva el montaje entero y revienta.
    const blueprint = blueprintWith([SENSOR, CHIP, ...CONSUMIDORES], TRONCO);
    const tronco = blueprint.signalGraph.edges.find((edge) => edge.to === nodeOf("chip"))!;
    expect(edgeElectricalLoad(blueprint, tronco.id, REGISTRY)).toBe(9);
    const capacidadCobre = REGISTRY.get("cable-cobre" as ComponentId)?.data.functional?.find(
      (property) => property.tag === "COND",
    );
    expect(capacidadCobre?.tag === "COND" && capacidadCobre.maxCapacity).toBe(6);
  });
});
