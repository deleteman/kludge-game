import { describe, expect, it } from "vitest";
import { sectionChemicalAlarm } from "./section-chemical-alarm.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";

const REGISTRY = buildComponentCatalog().registry;
const CHEMICAL_REGISTRY = buildChemicalCatalog().registry;
const AMONIACO = "amoniaco" as ChemicalSubstanceId;
const SALA = "sala" as SectionId;
const OTRA = "otra" as SectionId;
const SCANNER_A = "scanner-a" as PlacedComponentInstanceId;
const SCANNER_B = "scanner-b" as PlacedComponentInstanceId;

const floorplan: ShipFloorplan = {
  id: "fixture",
  archetype: "investigacion",
  nameKey: "fixture",
  gridSize: { width: 2, height: 1 },
  sections: [
    { id: SALA, nameKey: "sala", cells: [{ x: 0, y: 0 }] },
    { id: OTRA, nameKey: "otra", cells: [{ x: 1, y: 0 }] },
  ],
  conduits: [],
  anchors: [],
  componentSeeds: [],
  doors: [],
};

function scanner(instanceId: PlacedComponentInstanceId, x: number) {
  return {
    instanceId,
    componentDefinitionId: "escaner-espectro" as ComponentId,
    placement: { position: { x, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 as const },
    condition: "ok" as const,
    wear: "nuevo" as const,
  };
}

function blueprintWith(
  placed: ReadonlyArray<ReturnType<typeof scanner>>,
  instanceConfigs: Blueprint["instanceConfigs"] = [],
): Blueprint {
  return {
    metadata: { schemaVersion: 12, id: "f", name: "f", engineVersion: "0", createdAt: "x", updatedAt: "x" },
    placedComponents: placed,
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    instanceConfigs,
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

const air = (fraction: number): SectionAtmosphere => ({
  gases: new Map([[GAS.OXYGEN, 0.21], [AMONIACO as string, fraction]]),
  temperatureCelsius: 21,
  pressureKpa: 101,
});

const alarm = (blueprint: Blueprint, fraction: number, sectionId = SALA) =>
  sectionChemicalAlarm({
    blueprint,
    shipFloorplan: floorplan,
    sectionId,
    atmosphere: air(fraction),
    componentRegistry: REGISTRY,
    chemicalRegistry: CHEMICAL_REGISTRY,
  });

describe("mission: sectionChemicalAlarm (14b-3)", () => {
  it("sin ningún escáner en la sala se aplica el umbral de fábrica: el aviso no se calla por falta de instrumentos", () => {
    const empty = blueprintWith([]);
    expect(alarm(empty, 0.1)).toBe(true);
    expect(alarm(empty, 0.01)).toBe(false);
  });

  it("con un escáner, manda SU umbral: uno más alto silencia trazas que el de fábrica detectaría", () => {
    const configured = blueprintWith(
      [scanner(SCANNER_A, 0)],
      [{ instanceId: SCANNER_A, config: { kind: "sensor-threshold", comparator: ">", value: 0.3 } }],
    );
    expect(alarm(configured, 0.1)).toBe(false);
    expect(alarm(configured, 0.4)).toBe(true);
  });

  it("con varios escáneres alcanza con que uno dispare", () => {
    const two = blueprintWith(
      [scanner(SCANNER_A, 0), scanner(SCANNER_B, 0)],
      [{ instanceId: SCANNER_A, config: { kind: "sensor-threshold", comparator: ">", value: 0.9 } }],
    );
    // A no dispara (umbral 0.9) pero B usa el de fábrica y sí.
    expect(alarm(two, 0.1)).toBe(true);
  });

  it("un escáner de OTRA sala no cuenta para esta", () => {
    const elsewhere = blueprintWith(
      [scanner(SCANNER_A, 1)],
      [{ instanceId: SCANNER_A, config: { kind: "sensor-threshold", comparator: ">", value: 0.9 } }],
    );
    // En SALA no hay escáner: rige el de fábrica pese al umbral alto del de OTRA.
    expect(alarm(elsewhere, 0.1, SALA)).toBe(true);
    expect(alarm(elsewhere, 0.1, OTRA)).toBe(false);
  });

  it("REGRESIÓN: un escáner con comparador invertido no enciende la alarma de la sala con aire limpio", () => {
    // "< 0.05" es una señal de aire limpio (lógica de cableado), no un umbral de
    // fuga: con aire limpio la lectura (0) lo cumple, y la sala se declaraba en
    // alarma para siempre — tooltip incluido — sin que hubiera ningún gas.
    const inverted = blueprintWith(
      [scanner(SCANNER_A, 0)],
      [{ instanceId: SCANNER_A, config: { kind: "sensor-threshold", comparator: "<", value: 0.05 } }],
    );
    expect(alarm(inverted, 0)).toBe(false);
    // Con contaminación real rige el umbral de fábrica, como si no hubiera escáner.
    expect(alarm(inverted, 0.1)).toBe(true);
    expect(alarm(inverted, 0.01)).toBe(false);
  });

  it("REGRESIÓN: '=' y '<=' tampoco cuentan como umbral de fuga", () => {
    for (const comparator of ["=", "<="] as const) {
      const blueprint = blueprintWith(
        [scanner(SCANNER_A, 0)],
        [{ instanceId: SCANNER_A, config: { kind: "sensor-threshold", comparator, value: 0.05 } }],
      );
      expect(alarm(blueprint, 0.04)).toBe(false);
    }
  });
});
