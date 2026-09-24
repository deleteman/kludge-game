import { describe, expect, it } from "vitest";
import { resolveLedIndicatorState } from "./led-indicator-state.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { OutputIndicatorConfig } from "../instance-config/instance-config.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";

const REGISTRIES = {
  componentRegistry: buildComponentCatalog().registry,
  chemicalRegistry: buildChemicalCatalog().registry,
};
const SENSOR = "sensor" as PlacedComponentInstanceId;
const LED = "led" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-node" as SignalNodeId;
const LED_NODE = "led-node" as SignalNodeId;
const SECTION = "sala" as SectionId;

function blueprint(sensorDefinition: string | undefined, config?: OutputIndicatorConfig): Blueprint {
  const sensorBlock = sensorDefinition
    ? {
        placed: [
          {
            instanceId: SENSOR,
            componentDefinitionId: sensorDefinition as ComponentId,
            placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 as const },
            condition: "ok" as const,
            wear: "nuevo" as const,
          },
        ],
        nodes: [{ id: SENSOR_NODE, role: "emitter" as const, position: { x: 0, y: 0 }, ownerRef: SENSOR }],
        edges: [{ id: "e" as SignalEdgeId, from: SENSOR_NODE, to: LED_NODE }],
      }
    : { placed: [], nodes: [], edges: [] };
  return {
    metadata: { schemaVersion: 12, id: "f", name: "f", engineVersion: "0", createdAt: "x", updatedAt: "x" },
    placedComponents: [
      ...sensorBlock.placed,
      {
        instanceId: LED,
        componentDefinitionId: "indicador-led" as ComponentId,
        placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [...sensorBlock.nodes, { id: LED_NODE, role: "receptor", position: { x: 1, y: 0 }, ownerRef: LED }],
      edges: sensorBlock.edges,
    },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    instanceConfigs: config ? [{ instanceId: LED, config }] : [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

const floorplan: ShipFloorplan = {
  id: "f",
  archetype: "investigacion",
  nameKey: "f",
  gridSize: { width: 2, height: 1 },
  sections: [{ id: SECTION, nameKey: "sala", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
  conduits: [],
  anchors: [],
  componentSeeds: [],
  doors: [],
};

const air = (over: Partial<SectionAtmosphere> & { extra?: [string, number] } = {}): SectionAtmosphere => ({
  gases: new Map<string, number>([[GAS.OXYGEN, 0.21], ...(over.extra ? [over.extra] : [])]),
  temperatureCelsius: over.temperatureCelsius ?? 21,
  pressureKpa: over.pressureKpa ?? 101,
});

const led = (bp: Blueprint, atmosphere: SectionAtmosphere, live = { signalActive: false, powered: true }) =>
  resolveLedIndicatorState(bp, floorplan, LED, () => atmosphere, REGISTRIES, live);

const indicator = (color: OutputIndicatorConfig["color"], trigger: OutputIndicatorConfig["trigger"]): OutputIndicatorConfig => ({
  kind: "output-indicator",
  color,
  trigger,
});

describe("mission: resolveLedIndicatorState (14b-3)", () => {
  it("sin configuración es el LED de siempre: ámbar, encendido cuando le llega señal", () => {
    const bp = blueprint("sensor-termico-precision");
    expect(led(bp, air(), { signalActive: true, powered: true })).toEqual({ lit: true, color: "amber" });
    expect(led(bp, air(), { signalActive: false, powered: true })).toEqual({ lit: false, color: "amber" });
  });

  it("el color configurado se aplica, encendido o no", () => {
    const bp = blueprint(undefined, indicator("green", { kind: "level", high: true }));
    expect(led(bp, air(), { signalActive: true, powered: true })).toEqual({ lit: true, color: "green" });
    expect(led(bp, air(), { signalActive: false, powered: true }).color).toBe("green");
  });

  it("trigger 'sin señal': se enciende cuando NO llega señal — pero un LED sin energía sigue apagado", () => {
    const bp = blueprint(undefined, indicator("red", { kind: "level", high: false }));
    expect(led(bp, air(), { signalActive: false, powered: true }).lit).toBe(true);
    expect(led(bp, air(), { signalActive: true, powered: true }).lit).toBe(false);
    expect(led(bp, air(), { signalActive: false, powered: false }).lit).toBe(false);
  });

  it("compare sobre un sensor térmico: usa la temperatura REAL con el umbral PROPIO del LED", () => {
    const bp = blueprint(
      "sensor-termico-precision",
      indicator("red", { kind: "compare", comparator: ">=", value: 40 }),
    );
    // La señal del sensor (umbral de fábrica 60 °C) está APAGADA, pero a 45 °C el LED ya enciende.
    expect(led(bp, air({ temperatureCelsius: 45 }), { signalActive: false, powered: true }).lit).toBe(true);
    expect(led(bp, air({ temperatureCelsius: 30 }), { signalActive: true, powered: true }).lit).toBe(false);
  });

  it("compare sobre presión y sobre química lee la magnitud de cada sensor", () => {
    const pressure = blueprint("sensor-presion-gas", indicator("blue", { kind: "compare", comparator: "<", value: 95 }));
    expect(led(pressure, air({ pressureKpa: 90 })).lit).toBe(true);
    expect(led(pressure, air({ pressureKpa: 100 })).lit).toBe(false);

    const chemical = blueprint("escaner-espectro", indicator("red", { kind: "compare", comparator: ">", value: 0.2 }));
    expect(led(chemical, air({ extra: ["amoniaco", 0.3] })).lit).toBe(true);
    expect(led(chemical, air({ extra: ["amoniaco", 0.1] })).lit).toBe(false);
  });

  it("substance: '=CORR' sólo se enciende con un corrosivo, no con un tóxico ni con agua", () => {
    const bp = blueprint("escaner-espectro", indicator("red", { kind: "substance", tag: "CORR" }));
    // Los ids reales del catálogo: ácido = corrosivo, amoníaco = tóxico.
    expect(led(bp, air({ extra: ["acido-de-laboratorio" as ChemicalSubstanceId, 0.2] })).lit).toBe(true);
    expect(led(bp, air({ extra: ["amoniaco" as ChemicalSubstanceId, 0.2] })).lit).toBe(false);
    expect(led(bp, air({ extra: ["agua" as ChemicalSubstanceId, 0.3] })).lit).toBe(false);
  });

  it("sin sensor cableado, los triggers que necesitan una lectura no se encienden (sin dato no hay alarma)", () => {
    const compare = blueprint(undefined, indicator("red", { kind: "compare", comparator: ">", value: 0 }));
    const substance = blueprint(undefined, indicator("red", { kind: "substance", tag: "TOX" }));
    expect(led(compare, air(), { signalActive: true, powered: true }).lit).toBe(false);
    expect(led(substance, air(), { signalActive: true, powered: true }).lit).toBe(false);
  });
});
