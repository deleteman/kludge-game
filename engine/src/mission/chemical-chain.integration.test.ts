import { describe, expect, it } from "vitest";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { TransientGasInjection } from "./section-gas-injection.js";
import { chemicalAwareEmitterInputs } from "./chemical-emitter-input-source.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { CHEMICAL_SENSOR_TRIGGER_CONCENTRATION } from "../atmosphere/chemical-sensor-parameters.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

/**
 * Integración de la Subfase 14b-1: el ciclo completo
 * **vertido de un tóxico → atmósfera de la sección → sensor químico**.
 *
 * Es el análogo del test de cadena térmica de 14a-1, y prueba lo mismo que
 * aquél probaba para el calor: que un evento del mundo se vuelve estado
 * continuo de una sección y que una pieza del catálogo lo lee de verdad. El
 * escáner de espectro estaba permanentemente disparado desde el arranque del
 * proyecto, así que los asserts de "apagado" de acá son la regresión que
 * importa.
 */

const LABORATORIO = "laboratorio" as SectionId;
const PASILLO = "pasillo" as SectionId;
const SENSOR_INSTANCE = "escaner-1" as PlacedComponentInstanceId;
const SENSOR_NODE = "escaner-1-em" as SignalNodeId;
const REGISTRY = buildComponentCatalog().registry;
const CHEMICAL_REGISTRY = buildChemicalCatalog().registry;

/** TOX(M), y gas a temperatura nominal (hierve a -33 °C): entra al aire. */
const AMONIACO = "amoniaco" as ChemicalSubstanceId;

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

/** Dos secciones unidas por un conducto abierto; el escáner va en el laboratorio. */
function floorplan(): ShipFloorplan {
  return {
    id: "nave-quimica",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 4, height: 1 },
    sections: [
      { id: LABORATORIO, nameKey: "section.laboratorio", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { id: PASILLO, nameKey: "section.pasillo", cells: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
    ],
    conduits: [
      {
        id: "ventilacion:lab:pasillo:0" as ShipFloorplan["conduits"][number]["id"],
        a: LABORATORIO,
        b: PASILLO,
        kind: "ventilacion",
        position: { x: 1.5, y: 0 },
        initialAperture: 1,
      },
    ],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

function blueprint(): Blueprint {
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
      nodes: [{ id: SENSOR_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: SENSOR_INSTANCE }],
      edges: [],
    },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    instanceConfigs: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

function buildChain() {
  const plan = floorplan();
  const volumeBySection = new Map(plan.sections.map((section) => [section.id, section.cells.length]));
  const injection = new TransientGasInjection({
    substanceOf: (substanceId) => CHEMICAL_REGISTRY.get(substanceId),
    sectionVolumeOf: (sectionId) => volumeBySection.get(sectionId) ?? 1,
  });
  const atmosphere = new MissionAtmosphereRuntime(
    plan,
    [],
    undefined,
    injection.asInjectionSource(),
  );
  const emitterInputs = chemicalAwareEmitterInputs(
    new MutableShipState(blueprint()),
    plan,
    (sectionId) => atmosphere.atmosphereOf(sectionId),
    REGISTRY,
    CHEMICAL_REGISTRY,
    () => new Map(),
  );
  const tick = (elapsed: number, dt = 1) => atmosphere.tick(tickOf(elapsed, dt));
  const concentrationOf = (sectionId: SectionId) =>
    atmosphere.atmosphereOf(sectionId)!.gases.get(AMONIACO) ?? 0;
  return { injection, atmosphere, emitterInputs, tick, concentrationOf };
}

describe("integración 14b-1: vertido de tóxico → atmósfera → sensor químico", () => {
  it("el escáner arranca apagado, dispara con la fuga y sigue disparado porque la fuga no se resuelve sola", () => {
    const { injection, emitterInputs, tick, concentrationOf } = buildChain();

    // 1) Nave en reposo: el sensor está APAGADO. Antes de 14b-1 el fail-open lo
    //    daba por disparado desde el primer frame, para siempre.
    tick(0);
    expect(emitterInputs().get(SENSOR_NODE)).toBe(false);
    expect(concentrationOf(LABORATORIO)).toBe(0);

    // 2) Se vuelca amoníaco en el laboratorio.
    injection.inject(LABORATORIO, AMONIACO, 4);
    tick(1);

    expect(concentrationOf(LABORATORIO)).toBeGreaterThan(CHEMICAL_SENSOR_TRIGGER_CONCENTRATION);
    expect(emitterInputs().get(SENSOR_NODE)).toBe(true);

    // 3) El gas se difunde al pasillo contiguo, pero menos.
    for (let i = 2; i <= 6; i += 1) {
      tick(i);
    }
    expect(concentrationOf(PASILLO)).toBeGreaterThan(0);
    expect(concentrationOf(PASILLO)).toBeLessThan(concentrationOf(LABORATORIO));

    // 4) Y acá está la diferencia con el eje térmico: la temperatura tiene
    //    deriva pasiva hacia el nominal, así que un incendio se apaga solo. Un
    //    contaminante NO. La difusión lo REPARTE entre las secciones, pero no
    //    lo saca de la nave: las dos salas se equilibran y el sensor sigue
    //    disparado para siempre.
    //
    //    Es el comportamiento correcto —consecuencias permanentes, principio 5
    //    del CLAUDE.md— y es exactamente lo que justifica 14b-2: sin una
    //    válvula que vierta un neutralizante, el jugador no tiene ninguna forma
    //    automática de bajar esta lectura.
    for (let i = 7; i < 400; i += 1) {
      tick(i);
    }
    expect(concentrationOf(LABORATORIO)).toBeCloseTo(concentrationOf(PASILLO), 3);
    expect(concentrationOf(LABORATORIO)).toBeGreaterThan(CHEMICAL_SENSOR_TRIGGER_CONCENTRATION);
    expect(emitterInputs().get(SENSOR_NODE)).toBe(true);
  });

  it("un vertido de agua NO dispara el sensor por más que sature la sala", () => {
    // El control negativo del filtro por tag: el agua es INERTE. Sin él, el
    // sensor sería un detector de "hay algo en el aire" y estaría encendido en
    // cualquier sala donde el jugador haya trabajado.
    const { injection, emitterInputs, tick } = buildChain();

    injection.inject(LABORATORIO, "agua" as ChemicalSubstanceId, 40);
    tick(0);
    tick(1);

    expect(emitterInputs().get(SENSOR_NODE)).toBe(false);
  });
});
