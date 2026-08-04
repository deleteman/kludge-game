// Extensión Subfase 11h — escenario de fuga en Capítulo 1, ahora objetivo
// formal de la crisis (ver `chapter-01-primer-aviso.ts`, resolución
// `replacement-installed-connected` anclada en `sealPosition`). Primer caso
// que conecta `MissionAtmosphereRuntime` REAL (tickeando `diffuse()` + el
// sumidero/recuperación de presión) con el Sensor de Presión/Pantalla
// LCD/Indicador LED (caso 19): la junta hermética sembrada rota drena
// `soporte-vital`, y repararla (desmontar+instalar, mismo criterio que la
// resolución de crisis: identidad por POSICIÓN, no por instanceId) invierte
// el drenaje en recuperación real hasta la atmósfera estándar.
import { describe, expect, it } from "vitest";
import {
  MissionAtmosphereRuntime,
  MissionSignalRuntime,
  MutableShipState,
  PRESSURE_SINK_FLOOR_KPA,
  allEmittersActive,
  pressureAwareEmitterInputs,
  resolveLcdDisplayValue,
  sealBreachPressureSink,
  standardSectionAtmosphere,
  type Blueprint,
  type ComponentId,
  type PlacedComponentInstanceId,
  type SectionId,
  type ShipFloorplan,
  type SignalEdgeId,
  type SignalNodeId,
} from "../index.js";

const SEAL_INSTANCE = "capitulo-1-junta-rota" as PlacedComponentInstanceId;
const SEAL_REPLACEMENT_INSTANCE = "junta-reemplazo" as PlacedComponentInstanceId;
const SENSOR_INSTANCE = "sensor-presion-1" as PlacedComponentInstanceId;
const LCD_INSTANCE = "pantalla-lcd-1" as PlacedComponentInstanceId;
const LED_INSTANCE = "indicador-led-1" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-node" as SignalNodeId;
const LCD_NODE = "lcd-node" as SignalNodeId;
const LED_NODE = "led-node" as SignalNodeId;
const SOPORTE_VITAL = "soporte-vital" as SectionId;
const SEAL_POSITION = { x: 6, y: 5 };
const DRAIN_RATE = 1.5;
const RECOVERY_RATE = 1.5;

function buildBlueprint(sealInstance: Blueprint["placedComponents"][number] | null): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "case-20-fixture",
      name: "Fuga por junta rota",
      engineVersion: "0.0.0",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    },
    placedComponents: [
      ...(sealInstance ? [sealInstance] : []),
      {
        instanceId: SENSOR_INSTANCE,
        componentDefinitionId: "sensor-presion" as ComponentId,
        placement: { position: { x: 8, y: 5 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
      {
        instanceId: LCD_INSTANCE,
        componentDefinitionId: "pantalla-lcd" as ComponentId,
        placement: { position: { x: 9, y: 5 }, footprint: { width: 2, height: 1 }, rotation: 0 },
        condition: "ok",
      },
      {
        instanceId: LED_INSTANCE,
        componentDefinitionId: "indicador-led" as ComponentId,
        placement: { position: { x: 11, y: 5 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        { id: SENSOR_NODE, role: "emitter", position: { x: 8, y: 5 }, ownerRef: SENSOR_INSTANCE },
        { id: LCD_NODE, role: "receptor", position: { x: 9, y: 5 }, ownerRef: LCD_INSTANCE },
        { id: LED_NODE, role: "receptor", position: { x: 11, y: 5 }, ownerRef: LED_INSTANCE },
      ],
      edges: [
        { id: "sensor-to-lcd" as SignalEdgeId, from: SENSOR_NODE, to: LCD_NODE },
        { id: "sensor-to-led" as SignalEdgeId, from: SENSOR_NODE, to: LED_NODE },
      ],
    },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
  };
}

function jammedSeal(): Blueprint["placedComponents"][number] {
  return {
    instanceId: SEAL_INSTANCE,
    componentDefinitionId: "junta-hermetica" as ComponentId,
    placement: { position: SEAL_POSITION, footprint: { width: 1, height: 1 }, rotation: 0 },
    condition: "jammed",
  };
}

function buildFloorplan(): ShipFloorplan {
  const cells = Array.from({ length: 12 }, (_, x) => ({ x, y: 5 }));
  return {
    id: "case-20-floorplan",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 12, height: 6 },
    sections: [{ id: SOPORTE_VITAL, nameKey: "fixture-soporte-vital", cells }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

function buildSink(shipState: MutableShipState) {
  return sealBreachPressureSink(shipState, {
    position: SEAL_POSITION,
    acceptableComponentDefinitionIds: ["junta-hermetica" as ComponentId],
    sectionId: SOPORTE_VITAL,
    drainRateKpaPerSecond: DRAIN_RATE,
    recoveryRateKpaPerSecond: RECOVERY_RATE,
  });
}

describe("case 20 — Fuga por junta rota (escenario de Capítulo 1, Subfase 11h)", () => {
  it("la presión cae mientras la junta está rota, el sensor/LCD/LED lo reflejan, y reparar (desmontar+instalar) la recupera", () => {
    const shipState = new MutableShipState(buildBlueprint(jammedSeal()));
    const floorplan = buildFloorplan();
    const atmosphereRuntime = new MissionAtmosphereRuntime(floorplan, [], buildSink(shipState));
    const atmosphereOf = (sectionId: SectionId) => atmosphereRuntime.atmosphereOf(sectionId);
    const signalRuntime = new MissionSignalRuntime(
      shipState,
      pressureAwareEmitterInputs(shipState, floorplan, atmosphereOf, allEmittersActive(shipState)),
    );

    expect(atmosphereOf(SOPORTE_VITAL)?.pressureKpa).toBe(standardSectionAtmosphere().pressureKpa);

    // 10 ticks de 1s: la presión cae 1.5 kPa/s.
    for (let t = 1; t <= 10; t += 1) {
      atmosphereRuntime.tick({ dtSeconds: 1, elapsedSeconds: t });
      signalRuntime.tick({ dtSeconds: 1, elapsedSeconds: t });
    }
    expect(atmosphereOf(SOPORTE_VITAL)?.pressureKpa).toBeCloseTo(101 - 10 * DRAIN_RATE, 5);
    expect(signalRuntime.outputOf(LED_NODE)).toBe(true); // sensor disparado (presión bajo 101 kPa)
    expect(resolveLcdDisplayValue(shipState.get(), floorplan, LCD_INSTANCE, atmosphereOf)).toMatchObject({
      kind: "pressure",
      sectionId: SOPORTE_VITAL,
    });

    // El jugador repara: DESMONTA la junta rota (queda sin instancia en esa
    // posición) e INSTALA una de repuesto — otro instanceId, misma posición.
    shipState.set(buildBlueprint(null));
    const pressureAtDismantle = atmosphereOf(SOPORTE_VITAL)!.pressureKpa;
    atmosphereRuntime.tick({ dtSeconds: 1, elapsedSeconds: 11 });
    // Sin nada sellando la posición, el drenaje sigue mientras esté vacía.
    expect(atmosphereOf(SOPORTE_VITAL)!.pressureKpa).toBeLessThan(pressureAtDismantle);

    shipState.set(
      buildBlueprint({
        instanceId: SEAL_REPLACEMENT_INSTANCE,
        componentDefinitionId: "junta-hermetica" as ComponentId,
        placement: { position: SEAL_POSITION, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      }),
    );
    const pressureAtRepair = atmosphereOf(SOPORTE_VITAL)!.pressureKpa;
    for (let t = 12; t <= 60; t += 1) {
      atmosphereRuntime.tick({ dtSeconds: 1, elapsedSeconds: t });
      signalRuntime.tick({ dtSeconds: 1, elapsedSeconds: t });
    }

    // La presión se recuperó de verdad, no solo dejó de caer.
    const pressureAfterRecovery = atmosphereOf(SOPORTE_VITAL)!.pressureKpa;
    expect(pressureAfterRecovery).toBeGreaterThan(pressureAtRepair);
    expect(pressureAfterRecovery).toBe(standardSectionAtmosphere().pressureKpa);
    expect(signalRuntime.outputOf(LED_NODE)).toBe(false); // sensor ya no detecta fuga
  });

  it("el drenaje nunca baja del piso de fuga menor", () => {
    const shipState = new MutableShipState(buildBlueprint(jammedSeal()));
    const floorplan = buildFloorplan();
    const atmosphereRuntime = new MissionAtmosphereRuntime(floorplan, [], buildSink(shipState));

    for (let t = 1; t <= 200; t += 1) {
      atmosphereRuntime.tick({ dtSeconds: 1, elapsedSeconds: t });
    }
    expect(atmosphereRuntime.atmosphereOf(SOPORTE_VITAL)?.pressureKpa).toBe(PRESSURE_SINK_FLOOR_KPA);
  });

  it("la recuperación nunca sobrepasa la atmósfera estándar", () => {
    const shipState = new MutableShipState(
      buildBlueprint({
        instanceId: SEAL_INSTANCE,
        componentDefinitionId: "junta-hermetica" as ComponentId,
        placement: { position: SEAL_POSITION, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      }),
    );
    const floorplan = buildFloorplan();
    const atmosphereRuntime = new MissionAtmosphereRuntime(floorplan, [], buildSink(shipState));

    for (let t = 1; t <= 200; t += 1) {
      atmosphereRuntime.tick({ dtSeconds: 1, elapsedSeconds: t });
    }
    expect(atmosphereRuntime.atmosphereOf(SOPORTE_VITAL)?.pressureKpa).toBe(
      standardSectionAtmosphere().pressureKpa,
    );
  });
});
