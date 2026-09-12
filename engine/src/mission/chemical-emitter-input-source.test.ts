import { describe, expect, it } from "vitest";
import { chemicalAwareEmitterInputs } from "./chemical-emitter-input-source.js";
import { CHEMICAL_SENSOR_TRIGGER_CONCENTRATION } from "../atmosphere/chemical-sensor-parameters.js";
import { MutableShipState } from "./mutable-ship-state.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";

/**
 * Catálogos REALES, igual que en el test del sensor térmico: `escaner-espectro`
 * es una pieza COMPUESTA, así que con un registro de fixture no se probaría lo
 * que estaba roto — la búsqueda contra el registro completo es justamente lo
 * que la saca del fail-open. Y el registro químico tiene que ser el real porque
 * lo que se está probando es que el sensor distinga un tóxico de agua, cosa que
 * un fixture con tags inventados no demostraría (eje 9 de los patrones: un test
 * que inyecta su propia versión de la dependencia no puede ver el bug).
 */
const REGISTRY = buildComponentCatalog().registry;
const CHEMICAL_REGISTRY = buildChemicalCatalog().registry;

const SENSOR_INSTANCE = "sensor-instance" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-node" as SignalNodeId;
const SECTION = "seccion-fuga" as SectionId;

/** TOX(M) en el catálogo real. */
const AMONIACO = "amoniaco" as ChemicalSubstanceId;
/** CORR(M) en el catálogo real. */
const ACIDO = "acido-de-laboratorio" as ChemicalSubstanceId;
/** INERTE en el catálogo real: el control negativo. */
const AGUA = "agua" as ChemicalSubstanceId;

function buildFixtureBlueprint(): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-09-11T00:00:00.000Z",
      updatedAt: "2026-09-11T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: SENSOR_INSTANCE,
        componentDefinitionId: "escaner-espectro" as ComponentId,
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

function atmosphereWith(
  substanceId: ChemicalSubstanceId,
  fraction: number,
): SectionAtmosphere {
  return {
    gases: new Map([
      [GAS.OXYGEN, 0.21],
      [substanceId as string, fraction],
    ]),
    temperatureCelsius: 21,
    pressureKpa: 101,
  };
}

function cleanAtmosphere(): SectionAtmosphere {
  return { gases: new Map([[GAS.OXYGEN, 0.21]]), temperatureCelsius: 21, pressureKpa: 101 };
}

function inputsFor(atmosphereOf: (sectionId: SectionId) => SectionAtmosphere | undefined, base = new Map<SignalNodeId, boolean>()) {
  return chemicalAwareEmitterInputs(
    new MutableShipState(buildFixtureBlueprint()),
    buildFixtureFloorplan(),
    atmosphereOf,
    REGISTRY,
    CHEMICAL_REGISTRY,
    () => new Map(base),
  );
}

describe("mission: chemicalAwareEmitterInputs (Subfase 14b-1)", () => {
  it("dispara solo por ENCIMA del umbral con un contaminante TOX", () => {
    let fraction = CHEMICAL_SENSOR_TRIGGER_CONCENTRATION;
    const inputs = inputsFor((sectionId) =>
      sectionId === SECTION ? atmosphereWith(AMONIACO, fraction) : undefined,
    );

    // En el umbral exacto todavía no: el disparo es estrictamente por encima.
    expect(inputs().get(SENSOR_NODE)).toBe(false);

    fraction = CHEMICAL_SENSOR_TRIGGER_CONCENTRATION + 0.01;
    expect(inputs().get(SENSOR_NODE)).toBe(true);

    // Y se APAGA cuando el gas se difunde: el sensor no tiene memoria.
    fraction = 0;
    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("dispara también con un contaminante CORR, no solo con TOX", () => {
    const inputs = inputsFor(() =>
      atmosphereWith(ACIDO, CHEMICAL_SENSOR_TRIGGER_CONCENTRATION + 0.01),
    );

    expect(inputs().get(SENSOR_NODE)).toBe(true);
  });

  it("NO dispara con una sustancia inerte por encima del umbral", () => {
    // La razón de ser del filtro por tag: el sensor es un detector de
    // contaminación peligrosa, no un analizador de composición. Una sala llena
    // de vapor de agua no es una emergencia, y un indicador encendido casi
    // siempre no informa nada.
    const inputs = inputsFor(() => atmosphereWith(AGUA, 0.5));

    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("sin dato de atmósfera para la sección, el sensor no se da por disparado", () => {
    const inputs = inputsFor(() => undefined);

    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("con aire limpio el sensor está APAGADO (regresión del fail-open)", () => {
    // El bug que cierra 14b-1: sin resolvedor para `triggerType: "spectral"`,
    // el escáner caía en `allEmittersActive` y llegaba acá como `true` fijo
    // desde el arranque del proyecto. La base lo entrega disparado a propósito.
    const inputs = inputsFor(() => cleanAtmosphere(), new Map([[SENSOR_NODE, true]]));

    expect(inputs().get(SENSOR_NODE)).toBe(false);
  });

  it("preserva las entradas de la fuente base para emisores que no son sensores químicos", () => {
    const OTHER_NODE = "other-node" as SignalNodeId;
    const inputs = inputsFor(
      () => atmosphereWith(AMONIACO, 0.5),
      new Map([[OTHER_NODE, true]]),
    );

    expect(inputs().get(OTHER_NODE)).toBe(true);
    expect(inputs().get(SENSOR_NODE)).toBe(true);
  });
});
