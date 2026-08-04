// Extensión GDD 9, caso 19 — "El Panel de Diagnóstico Improvisado":
// docs/Extension_indicador_led_pantalla_lcd.md §4. Numerado 19 en vez del 18
// que propone el documento fuente porque ese número ya lo usa
// case-18-intruso-en-el-pasillo.test.ts (Fase 11d) — corregido al implementar
// (Subfase 11h), ver PENDIENTES_OBSERVACIONES.md punto 4.
//
// El jugador cablea un Sensor de Presión a una Pantalla LCD (para leer el
// nivel real de una sección con fuga activa) y a un Indicador LED (para saber
// de un vistazo si la fuga sigue activa sin tener que leer el número). Valida
// de punta a punta, con el motor real (mismo criterio que el caso 17/18, no
// una maqueta):
//  - `pressureAwareEmitterInputs`: el sensor se dispara solo cuando la
//    sección cae bajo la atmósfera estándar (resuelve el punto 3 de
//    PENDIENTES_OBSERVACIONES.md, acotado a `triggerType: "pressure"`).
//  - `resolveLcdDisplayValue`: el LCD sigue la presión real tick a tick.
//  - `MissionSignalRuntime.outputOf`: el LED (booleano) se enciende un tick
//    después de que el sensor se dispara (semántica síncrona del evaluador).
import { describe, expect, it } from "vitest";
import {
  MissionSignalRuntime,
  MutableShipState,
  allEmittersActive,
  pressureAwareEmitterInputs,
  resolveLcdDisplayValue,
  standardSectionAtmosphere,
  type Blueprint,
  type ComponentId,
  type PlacedComponentInstanceId,
  type SectionAtmosphere,
  type SectionId,
  type ShipFloorplan,
  type SignalEdgeId,
  type SignalNodeId,
} from "../index.js";

const SENSOR_INSTANCE = "sensor-presion-1" as PlacedComponentInstanceId;
const LCD_INSTANCE = "pantalla-lcd-1" as PlacedComponentInstanceId;
const LED_INSTANCE = "indicador-led-1" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-node" as SignalNodeId;
const LCD_NODE = "lcd-node" as SignalNodeId;
const LED_NODE = "led-node" as SignalNodeId;
const INVERNADERO = "invernadero" as SectionId;

function buildBlueprint(): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "case-19-fixture",
      name: "Panel de Diagnóstico Improvisado",
      engineVersion: "0.0.0",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: SENSOR_INSTANCE,
        componentDefinitionId: "sensor-presion" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
      {
        instanceId: LCD_INSTANCE,
        componentDefinitionId: "pantalla-lcd" as ComponentId,
        placement: { position: { x: 1, y: 0 }, footprint: { width: 2, height: 1 }, rotation: 0 },
        condition: "ok",
      },
      {
        instanceId: LED_INSTANCE,
        componentDefinitionId: "indicador-led" as ComponentId,
        placement: { position: { x: 3, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        { id: SENSOR_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: SENSOR_INSTANCE },
        { id: LCD_NODE, role: "receptor", position: { x: 1, y: 0 }, ownerRef: LCD_INSTANCE },
        { id: LED_NODE, role: "receptor", position: { x: 3, y: 0 }, ownerRef: LED_INSTANCE },
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

function buildFloorplan(): ShipFloorplan {
  return {
    id: "case-19-floorplan",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 4, height: 1 },
    sections: [
      {
        id: INVERNADERO,
        nameKey: "fixture-invernadero",
        cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
      },
    ],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

describe("case 19 — El Panel de Diagnóstico Improvisado", () => {
  it("el LCD sigue la presión real de la fuga y el LED se enciende al detectarla", () => {
    const shipState = new MutableShipState(buildBlueprint());
    const floorplan = buildFloorplan();
    let pressureKpa = standardSectionAtmosphere().pressureKpa;
    const atmosphereOf = (sectionId: SectionId): SectionAtmosphere | undefined =>
      sectionId === INVERNADERO
        ? { ...standardSectionAtmosphere(), pressureKpa }
        : undefined;
    const signalRuntime = new MissionSignalRuntime(
      shipState,
      pressureAwareEmitterInputs(shipState, floorplan, atmosphereOf, allEmittersActive(shipState)),
    );

    // Tick 1: sin fuga todavía — el LCD ya lee 101 kPa (canal de lectura
    // directa, no depende del grafo booleano), pero el LED sigue apagado.
    signalRuntime.tick({ dtSeconds: 1, elapsedSeconds: 1 });
    expect(resolveLcdDisplayValue(shipState.get(), floorplan, LCD_INSTANCE, atmosphereOf)).toEqual({
      kind: "pressure",
      sectionId: INVERNADERO,
      pressureKpa: 101,
    });
    expect(signalRuntime.outputOf(LED_NODE)).toBe(false);

    // La fuga arranca: la presión cae tick a tick.
    pressureKpa = 90;
    signalRuntime.tick({ dtSeconds: 1, elapsedSeconds: 2 });
    expect(resolveLcdDisplayValue(shipState.get(), floorplan, LCD_INSTANCE, atmosphereOf)).toEqual({
      kind: "pressure",
      sectionId: INVERNADERO,
      pressureKpa: 90,
    });
    // El evaluador propaga con un hop de retraso (semántica síncrona): el
    // sensor ya está activo, pero el LED todavía refleja el tick anterior.
    expect(signalRuntime.outputOf(LED_NODE)).toBe(false);

    signalRuntime.tick({ dtSeconds: 1, elapsedSeconds: 3 });
    expect(signalRuntime.outputOf(LED_NODE)).toBe(true);

    pressureKpa = 60;
    signalRuntime.tick({ dtSeconds: 1, elapsedSeconds: 4 });
    expect(resolveLcdDisplayValue(shipState.get(), floorplan, LCD_INSTANCE, atmosphereOf)).toEqual({
      kind: "pressure",
      sectionId: INVERNADERO,
      pressureKpa: 60,
    });
    expect(signalRuntime.outputOf(LED_NODE)).toBe(true);

    // La fuga se sella y la presión se recupera: el LED se apaga (con el
    // mismo hop de retraso) y el LCD sigue mostrando el valor real.
    pressureKpa = 101;
    signalRuntime.tick({ dtSeconds: 1, elapsedSeconds: 5 });
    signalRuntime.tick({ dtSeconds: 1, elapsedSeconds: 6 });
    expect(resolveLcdDisplayValue(shipState.get(), floorplan, LCD_INSTANCE, atmosphereOf)).toEqual({
      kind: "pressure",
      sectionId: INVERNADERO,
      pressureKpa: 101,
    });
    expect(signalRuntime.outputOf(LED_NODE)).toBe(false);
  });
});
