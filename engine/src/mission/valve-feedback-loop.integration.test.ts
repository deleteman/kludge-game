import { describe, expect, it } from "vitest";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { MissionValveRuntime } from "./mission-valve-runtime.js";
import { TransientGasInjection } from "./section-gas-injection.js";
import { chemicalAwareEmitterInputs } from "./chemical-emitter-input-source.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { CHEMICAL_SENSOR_TRIGGER_CONCENTRATION } from "../atmosphere/chemical-sensor-parameters.js";
import { contentOf } from "../reservoir/reservoir-ledger.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

/**
 * Integración de la Subfase 14b-2: **el lazo cerrado completo**, que es lo que
 * justifica la subfase entera.
 *
 *   escáner detecta el tóxico → señal → válvula automática vierte
 *   → la purga desplaza al tóxico → la concentración cae bajo el umbral
 *   → el sensor se apaga → la válvula deja de verter
 *
 * 14b-1 dejó MEDIDO que sin esta pieza el lazo no existe: la difusión reparte
 * un contaminante entre secciones pero no lo saca de la nave, así que una fuga
 * no se resolvía nunca sola. Acá el jugador la resuelve sin tocar nada, que es
 * la promesa de "herramienta de corte automático" del orden de trabajo.
 *
 * No se cablea `MissionSignalRuntime`: la señal se simula leyendo el propio
 * `emitterInputs` del sensor químico, que es exactamente lo que un cable
 * directo sensor→válvula propaga. Lo que se está probando acá es la
 * REALIMENTACIÓN entre química y actuador, no el evaluador de señales (que
 * tiene sus propios tests).
 */

const LABORATORIO = "laboratorio" as SectionId;
const SENSOR_INSTANCE = "escaner-1" as PlacedComponentInstanceId;
const SENSOR_NODE = "escaner-1-em" as SignalNodeId;
const VALVE_INSTANCE = "purga-1" as PlacedComponentInstanceId;
const VALVE_NODE = "purga-1:receptor:1" as SignalNodeId;

const REGISTRY = buildComponentCatalog().registry;
const CHEMICAL_REGISTRY = buildChemicalCatalog().registry;

/** TOX(M) y gaseoso a 21 °C: lo que el sensor puede ver. */
const AMONIACO = "amoniaco" as ChemicalSubstanceId;
/** Lo que la válvula vierte para purgar. */
const OXIGENO = "oxigeno" as ChemicalSubstanceId;

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

function floorplan(): ShipFloorplan {
  return {
    id: "nave-purga",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 2, height: 1 },
    sections: [{ id: LABORATORIO, nameKey: "section.lab", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    conduits: [],
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
      createdAt: "2026-09-14T00:00:00.000Z",
      updatedAt: "2026-09-14T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: SENSOR_INSTANCE,
        componentDefinitionId: "escaner-espectro" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
      {
        instanceId: VALVE_INSTANCE,
        componentDefinitionId: "generador-oxigeno-precision" as ComponentId,
        placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [
      { componentInstanceId: VALVE_INSTANCE, substanceId: OXIGENO, amount: 200 },
    ],
    signalGraph: {
      nodes: [
        { id: SENSOR_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: SENSOR_INSTANCE },
        { id: VALVE_NODE, role: "receptor", position: { x: 1, y: 0 }, ownerRef: VALVE_INSTANCE },
      ],
      // El cable que el jugador tiende: sensor → válvula.
      edges: [{ id: "cable-1" as SignalEdgeId, from: SENSOR_NODE, to: VALVE_NODE }],
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

function buildLoop() {
  const plan = floorplan();
  const shipState = new MutableShipState(blueprint());
  const volumeBySection = new Map(plan.sections.map((section) => [section.id, section.cells.length]));
  const injection = new TransientGasInjection({
    substanceOf: (substanceId) => CHEMICAL_REGISTRY.get(substanceId),
    sectionVolumeOf: (sectionId) => volumeBySection.get(sectionId) ?? 1,
  });
  const atmosphere = new MissionAtmosphereRuntime(plan, [], undefined, injection.asInjectionSource());
  const emitterInputs = chemicalAwareEmitterInputs(
    shipState,
    plan,
    (sectionId) => atmosphere.atmosphereOf(sectionId),
    REGISTRY,
    CHEMICAL_REGISTRY,
    () => new Map(),
  );
  // El cable: la salida del sensor gobierna la válvula. Es lo que
  // `MissionSignalRuntime` propaga por una arista directa.
  const sensorFiring = () => emitterInputs().get(SENSOR_NODE) === true;
  const valves = new MissionValveRuntime(shipState, {
    registry: REGISTRY,
    floorplan: plan,
    isInstancePowered: () => true,
    outputOf: (nodeId) => (nodeId === VALVE_NODE ? sensorFiring() : false),
    gasInjection: injection,
    frozen: {
      substanceOf: (substanceId) => CHEMICAL_REGISTRY.get(substanceId),
      sectionTemperatureOf: (sectionId) => atmosphere.atmosphereOf(sectionId)?.temperatureCelsius,
    },
  });
  // Orden real del core loop: la válvula vierte ANTES de que la atmósfera
  // difunda, para que lo vertido este tick se reparta este tick.
  const tick = (elapsed: number, dt = 1) => {
    valves.tick(tickOf(elapsed, dt));
    atmosphere.tick(tickOf(elapsed, dt));
  };
  const toxicFraction = () => atmosphere.atmosphereOf(LABORATORIO)!.gases.get(AMONIACO) ?? 0;
  const storedOxygen = () => contentOf(shipState.get().reservoirContents, VALVE_INSTANCE)?.amount ?? 0;
  return { injection, atmosphere, sensorFiring, tick, toxicFraction, storedOxygen };
}

describe("integración 14b-2: sensor químico → válvula automática → purga", () => {
  it("la válvula se abre sola con la fuga, purga la sala y se cierra sola", () => {
    const { injection, sensorFiring, tick, toxicFraction, storedOxygen } = buildLoop();

    // 1) Nave limpia: el sensor está apagado y la válvula NO vierte. Que una
    //    válvula recién instalada no se vacíe sola es la mitad del diseño.
    tick(0);
    expect(sensorFiring()).toBe(false);
    expect(storedOxygen()).toBe(200);

    // 2) Fuga de amoníaco.
    injection.inject(LABORATORIO, AMONIACO, 4);
    tick(1);
    expect(toxicFraction()).toBeGreaterThan(CHEMICAL_SENSOR_TRIGGER_CONCENTRATION);
    expect(sensorFiring()).toBe(true);

    // 3) La válvula, cableada al sensor, se abrió sola y empezó a gastar.
    tick(2);
    expect(storedOxygen()).toBeLessThan(200);

    // 4) El lazo se cierra: la purga desplaza al tóxico por debajo del umbral y
    //    el sensor se apaga. Sin la válvula esto no pasaba NUNCA — 14b-1 dejó
    //    medido que la difusión sola no saca nada de la nave.
    for (let i = 3; i < 120 && sensorFiring(); i += 1) {
      tick(i);
    }
    expect(sensorFiring()).toBe(false);
    expect(toxicFraction()).toBeLessThan(CHEMICAL_SENSOR_TRIGGER_CONCENTRATION);

    // 5) Y deja de gastar: apagada la señal, la válvula cierra. Un actuador que
    //    siguiera vaciando el tanque con la alarma apagada sería el bug que
    //    `isAutomaticValveActive` existe para evitar.
    const afterPurge = storedOxygen();
    expect(afterPurge).toBeGreaterThan(0);
    tick(200);
    tick(201);
    expect(storedOxygen()).toBe(afterPurge);
  });

  it("el oxígeno vertido entra como O2 respirable, no como un gas aparte", () => {
    // Regla general de 14b-2 (`atmosphericGasKeyOf`): una sustancia que ES uno
    // de los gases de fondo se escribe en SU clave. Sin esto, purgar con
    // oxígeno agregaba una entrada `oxigeno` que desplazaba al `O2` real y
    // dejaba la sala MENOS respirable mientras la UI decía lo contrario.
    const { injection, atmosphere, tick } = buildLoop();
    const oxygenBefore = atmosphere.atmosphereOf(LABORATORIO)!.gases.get("O2") ?? 0;

    injection.inject(LABORATORIO, OXIGENO, 5);
    tick(0);

    const gases = atmosphere.atmosphereOf(LABORATORIO)!.gases;
    expect(gases.has(OXIGENO)).toBe(false);
    expect(gases.get("O2") ?? 0).toBeGreaterThan(oxygenBefore);
  });
});
