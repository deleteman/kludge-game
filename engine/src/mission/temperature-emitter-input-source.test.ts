import { describe, expect, it } from "vitest";
import { temperatureAwareEmitterInputs } from "./temperature-emitter-input-source.js";
import { THERMAL_SENSOR_TRIGGER_CELSIUS } from "../atmosphere/thermal-parameters.js";
import { MutableShipState } from "./mutable-ship-state.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";

/**
 * Catálogo REAL, igual que en el test del sensor de presión: el sensor térmico
 * es una pieza COMPUESTA (`sensor-termico-precision`), así que con un registro
 * de fixture no se probaría lo que rompía antes — la búsqueda contra el
 * registro completo es justamente lo que lo saca del fail-open.
 */
const REGISTRY = buildComponentCatalog().registry;

const SENSOR_INSTANCE = "sensor-instance" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-node" as SignalNodeId;
const SECTION = "seccion-incendio" as SectionId;

function buildFixtureBlueprint(): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: SENSOR_INSTANCE,
        componentDefinitionId: "sensor-termico-precision" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        {
          id: SENSOR_NODE,
          role: "emitter",
          position: { x: 0, y: 0 },
          ownerRef: SENSOR_INSTANCE,
        },
      ],
      edges: [],
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

function buildFixtureFloorplan(): ShipFloorplan {
  return {
    id: "fixture-floorplan",
    archetype: "investigacion",
    nameKey: "fixture",
    gridSize: { width: 1, height: 1 },
    sections: [{ id: SECTION, nameKey: "fixture-section", cells: [{ x: 0, y: 0 }] }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

function atmosphereAt(temperatureCelsius: number): SectionAtmosphere {
  return { gases: new Map([[GAS.OXYGEN, 0.21]]), temperatureCelsius, pressureKpa: 101 };
}

describe("mission: temperatureAwareEmitterInputs (Subfase 14a-1)", () => {
  it("el sensor térmico dispara solo por ENCIMA del umbral", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    let temperatureCelsius = THERMAL_SENSOR_TRIGGER_CELSIUS;
    const inputs = temperatureAwareEmitterInputs(
      shipState,
      buildFixtureFloorplan(),
      (sectionId) => (sectionId === SECTION ? atmosphereAt(temperatureCelsius) : undefined),
      REGISTRY,
      () => new Map(),
    );

    // En el umbral exacto todavía no: el disparo es estrictamente por encima.
    expect(inputs().get(SENSOR_NODE)).toBe(false);

    temperatureCelsius = THERMAL_SENSOR_TRIGGER_CELSIUS + 1;
    expect(inputs().get(SENSOR_NODE)).toBe(true);

    // Y se APAGA solo cuando la sección se enfría — el sensor no tiene memoria.
    temperatureCelsius = 21;
    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("sin dato de atmósfera para la sección, el sensor no se da por disparado", () => {
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = temperatureAwareEmitterInputs(
      shipState,
      buildFixtureFloorplan(),
      () => undefined,
      REGISTRY,
      () => new Map(),
    );

    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("a temperatura nominal el sensor está APAGADO (regresión del fail-open)", () => {
    // El bug que cierra 14a-1: sin resolvedor para `triggerType: "thermal"`, el
    // sensor caía en `allEmittersActive` y llegaba acá como `true` fijo.
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = temperatureAwareEmitterInputs(
      shipState,
      buildFixtureFloorplan(),
      () => atmosphereAt(21),
      REGISTRY,
      () => new Map([[SENSOR_NODE, true]]),
    );

    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("preserva las entradas de la fuente base para emisores que no son sensores térmicos", () => {
    const OTHER_NODE = "other-node" as SignalNodeId;
    const shipState = new MutableShipState(buildFixtureBlueprint());
    const inputs = temperatureAwareEmitterInputs(
      shipState,
      buildFixtureFloorplan(),
      () => atmosphereAt(300),
      REGISTRY,
      () => new Map([[OTHER_NODE, true]]),
    );

    expect(inputs().get(OTHER_NODE)).toBe(true);
    expect(inputs().get(SENSOR_NODE)).toBe(true);
  });
});
