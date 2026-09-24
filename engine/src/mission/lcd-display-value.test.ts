import { describe, expect, it } from "vitest";
import { resolveLcdDisplayValue } from "./lcd-display-value.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";

const REGISTRIES = {
  componentRegistry: buildComponentCatalog().registry,
  chemicalRegistry: buildChemicalCatalog().registry,
};

const SENSOR_INSTANCE = "sensor-instance" as PlacedComponentInstanceId;
const LCD_INSTANCE = "lcd-instance" as PlacedComponentInstanceId;
const OTHER_INSTANCE = "other-instance" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-node" as SignalNodeId;
const LCD_NODE = "lcd-node" as SignalNodeId;
const OTHER_NODE = "other-node" as SignalNodeId;
const SECTION = "seccion-fuga" as SectionId;

function baseBlueprint(): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "fixture",
      name: "Fixture",
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
        wear: "nuevo",
      },
      {
        instanceId: LCD_INSTANCE,
        componentDefinitionId: "pantalla-lcd" as ComponentId,
        placement: { position: { x: 1, y: 0 }, footprint: { width: 2, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        { id: SENSOR_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: SENSOR_INSTANCE },
        { id: LCD_NODE, role: "receptor", position: { x: 1, y: 0 }, ownerRef: LCD_INSTANCE },
      ],
      edges: [{ id: "edge-1" as SignalEdgeId, from: SENSOR_NODE, to: LCD_NODE }],
    },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    instanceConfigs: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

function fixtureFloorplan(): ShipFloorplan {
  return {
    id: "fixture-floorplan",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 2, height: 1 },
    sections: [{ id: SECTION, nameKey: "fixture-section", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

function atmosphere(pressureKpa: number): SectionAtmosphere {
  return { gases: new Map([[GAS.OXYGEN, 0.21]]), temperatureCelsius: 21, pressureKpa };
}

describe("mission: resolveLcdDisplayValue (Subfase 11h, caso 19)", () => {
  it("resuelve la presión real de la sección del sensor cableado", () => {
    const value = resolveLcdDisplayValue(
      baseBlueprint(),
      fixtureFloorplan(),
      LCD_INSTANCE,
      (sectionId) => (sectionId === SECTION ? atmosphere(87) : undefined),
      REGISTRIES,
    );

    expect(value).toEqual({ kind: "pressure", sectionId: SECTION, pressureKpa: 87 });
  });

  it("devuelve null si el LCD no tiene ningún cable entrante", () => {
    const blueprint = baseBlueprint();
    const unwired: Blueprint = { ...blueprint, signalGraph: { ...blueprint.signalGraph, edges: [] } };

    const value = resolveLcdDisplayValue(unwired, fixtureFloorplan(), LCD_INSTANCE, () => atmosphere(101), REGISTRIES);

    expect(value).toBeNull();
  });

  it("devuelve null si el LCD está cableado a una fuente sin variante de valor conocida", () => {
    const blueprint = baseBlueprint();
    const rewired: Blueprint = {
      ...blueprint,
      placedComponents: [
        ...blueprint.placedComponents,
        {
          instanceId: OTHER_INSTANCE,
          componentDefinitionId: "chip-circuito-generico" as ComponentId,
          placement: { position: { x: 0, y: 1 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          condition: "ok",
          wear: "nuevo",
        },
      ],
      signalGraph: {
        nodes: [
          ...blueprint.signalGraph.nodes,
          { id: OTHER_NODE, role: "receptor", position: { x: 0, y: 1 }, ownerRef: OTHER_INSTANCE },
        ],
        edges: [{ id: "edge-2" as SignalEdgeId, from: OTHER_NODE, to: LCD_NODE }],
      },
    };

    const value = resolveLcdDisplayValue(rewired, fixtureFloorplan(), LCD_INSTANCE, () => atmosphere(101), REGISTRIES);

    expect(value).toBeNull();
  });

  /** Cambia el sensor cableado al LCD y devuelve el blueprint resultante. */
  function withSensor(componentDefinitionId: string): Blueprint {
    const blueprint = baseBlueprint();
    return {
      ...blueprint,
      placedComponents: blueprint.placedComponents.map((instance) =>
        instance.instanceId === SENSOR_INSTANCE
          ? { ...instance, componentDefinitionId: componentDefinitionId as ComponentId }
          : instance,
      ),
    };
  }

  it("REGRESIÓN 14b-3: un LCD cableado al sensor de presión COMPUESTO muestra la presión (antes no mostraba nada)", () => {
    // `sensor-presion-gas` es compuesto y no está en `ATOMIC_COMPONENT_CATALOG`:
    // la copia privada de `isPressureSensor` sólo miraba los átomos.
    const value = resolveLcdDisplayValue(
      withSensor("sensor-presion-gas"),
      fixtureFloorplan(),
      LCD_INSTANCE,
      () => atmosphere(87),
      REGISTRIES,
    );
    expect(value).toEqual({ kind: "pressure", sectionId: SECTION, pressureKpa: 87 });
  });

  it("un LCD cableado al sensor térmico muestra la temperatura real de la sala", () => {
    const value = resolveLcdDisplayValue(
      withSensor("sensor-termico-precision"),
      fixtureFloorplan(),
      LCD_INSTANCE,
      () => ({ ...atmosphere(101), temperatureCelsius: 73 }),
      REGISTRIES,
    );
    expect(value).toEqual({ kind: "temperature", sectionId: SECTION, temperatureCelsius: 73 });
  });

  it("un LCD cableado al escáner de espectro muestra la concentración del peor contaminante, no la de agua ni la de O2", () => {
    const air = (substance: string, fraction: number): SectionAtmosphere => ({
      gases: new Map([[GAS.OXYGEN, 0.21], [substance, fraction]]),
      temperatureCelsius: 21,
      pressureKpa: 101,
    });
    const read = (substance: ChemicalSubstanceId, fraction: number) =>
      resolveLcdDisplayValue(
        withSensor("escaner-espectro"),
        fixtureFloorplan(),
        LCD_INSTANCE,
        () => air(substance, fraction),
        REGISTRIES,
      );
    expect(read("amoniaco" as ChemicalSubstanceId, 0.12)).toEqual({ kind: "chemical", sectionId: SECTION, concentration: 0.12 });
    // El agua está en el aire pero no es contaminante: el escáner no la ve.
    expect(read("agua" as ChemicalSubstanceId, 0.3)).toEqual({ kind: "chemical", sectionId: SECTION, concentration: 0 });
  });
});
