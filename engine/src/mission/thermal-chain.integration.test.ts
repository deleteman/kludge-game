import { describe, expect, it } from "vitest";
import { MissionThermalRuntime } from "./mission-thermal-runtime.js";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { temperatureAwareEmitterInputs } from "./temperature-emitter-input-source.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { NOMINAL_TEMPERATURE_CELSIUS } from "../atmosphere/thermal-parameters.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

/**
 * Integración de la Subfase 14a-1: el ciclo completo
 * **combustión → pulso de calor → temperatura de la sección → sensor térmico**.
 *
 * Es lo que el orden de trabajo pedía como "combustión sube temperatura que
 * degrada conductor", con el eslabón final adaptado: la degradación de
 * conductividad (`thermalConductivityRule`) es de 14a-2. Lo que sí cierra acá
 * es el ciclo entero de un eje nuevo: un evento discreto se vuelve estado
 * continuo del mundo, y una pieza del catálogo lo lee.
 */

const SALA = "sala-maquinas" as SectionId;
const PASILLO = "pasillo" as SectionId;
const SENSOR_INSTANCE = "sensor-1" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-1-em" as SignalNodeId;
const REGISTRY = buildComponentCatalog().registry;

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

/** Dos secciones unidas por un conducto abierto; el sensor va en la sala. */
function floorplan(): ShipFloorplan {
  return {
    id: "nave-termica",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 4, height: 1 },
    sections: [
      { id: SALA, nameKey: "section.sala", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { id: PASILLO, nameKey: "section.pasillo", cells: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
    ],
    conduits: [
      {
        id: "ventilacion:sala:pasillo:0" as ShipFloorplan["conduits"][number]["id"],
        a: SALA,
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
      nodes: [{ id: SENSOR_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: SENSOR_INSTANCE }],
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

function buildChain() {
  const reactionEvents = new EventEmitter<ReactionDomainEvent>();
  const thermal = new MissionThermalRuntime(reactionEvents);
  const plan = floorplan();
  const atmosphere = new MissionAtmosphereRuntime(
    plan,
    [],
    undefined,
    undefined,
    undefined,
    undefined,
    () => thermal.rates(),
  );
  const shipState = new MutableShipState(blueprint());
  const emitterInputs = temperatureAwareEmitterInputs(
    shipState,
    plan,
    (sectionId) => atmosphere.atmosphereOf(sectionId),
    REGISTRY,
    () => new Map(),
  );
  // Orden de registro real del core loop: el térmico antes que la atmósfera.
  const tick = (elapsed: number, dt = 1) => {
    thermal.tick(tickOf(elapsed, dt));
    atmosphere.tick(tickOf(elapsed, dt));
  };
  return { reactionEvents, atmosphere, emitterInputs, tick };
}

describe("integración 14a-1: combustión → temperatura → sensor térmico", () => {
  it("el sensor arranca apagado, dispara con el incendio y se apaga al enfriarse", () => {
    const { reactionEvents, atmosphere, emitterInputs, tick } = buildChain();

    // 1) Nave en reposo: el sensor está APAGADO. Antes de 14a-1 el fail-open lo
    //    daba por disparado desde el primer frame.
    tick(0);
    expect(emitterInputs().get(SENSOR_NODE)).toBe(false);
    expect(atmosphere.atmosphereOf(SALA)!.temperatureCelsius).toBeCloseTo(
      NOMINAL_TEMPERATURE_CELSIUS,
    );

    // 2) Combustión violenta en la sala.
    reactionEvents.emit({
      kind: "combustion",
      elapsedSeconds: 1,
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SALA,
    });
    for (let i = 1; i <= 6; i += 1) {
      tick(i);
    }

    expect(atmosphere.atmosphereOf(SALA)!.temperatureCelsius).toBeGreaterThan(60);
    expect(emitterInputs().get(SENSOR_NODE)).toBe(true);

    // 3) El calor llegó al pasillo contiguo, pero menos.
    const pasillo = atmosphere.atmosphereOf(PASILLO)!.temperatureCelsius;
    expect(pasillo).toBeGreaterThan(NOMINAL_TEMPERATURE_CELSIUS);
    expect(pasillo).toBeLessThan(atmosphere.atmosphereOf(SALA)!.temperatureCelsius);

    // 4) Sin más eventos, la climatización devuelve todo al nominal y el sensor
    //    se apaga solo: el incendio es un evento con final, no un estado.
    for (let i = 7; i < 300; i += 1) {
      tick(i);
    }
    expect(emitterInputs().get(SENSOR_NODE)).toBe(false);
    expect(atmosphere.atmosphereOf(SALA)!.temperatureCelsius).toBeCloseTo(
      NOMINAL_TEMPERATURE_CELSIUS,
      1,
    );
  });

  it("una combustión débil calienta pero NO llega a disparar el sensor", () => {
    const { reactionEvents, atmosphere, emitterInputs, tick } = buildChain();

    reactionEvents.emit({
      kind: "combustion",
      elapsedSeconds: 0,
      intensity: "weak",
      radius: "none",
      crewDamage: "none",
      sectionId: SALA,
    });
    for (let i = 0; i < 6; i += 1) {
      tick(i);
    }

    expect(atmosphere.atmosphereOf(SALA)!.temperatureCelsius).toBeGreaterThan(
      NOMINAL_TEMPERATURE_CELSIUS,
    );
    expect(emitterInputs().get(SENSOR_NODE)).toBe(false);
  });
});
