import { describe, expect, it } from "vitest";
import { MissionPhaseRuntime } from "./mission-phase-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import type { PhaseDomainEvent } from "../chemistry/phase/phase-events.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { ComponentWear } from "../wear/wear.types.js";

/**
 * Subfase 14a-3: congelación del CONTENIDO de un reservorio.
 *
 * Se monta el catálogo químico REAL (los puntos de fusión son datos autorados, y
 * con una sustancia sintética este test probaría su propio fixture) y se maneja
 * la temperatura a mano, que es la única entrada que acá interesa.
 */

const SALA = "sala" as SectionId;
const TANQUE = "tanque-1" as PlacedComponentInstanceId;
const CHEMICALS = buildChemicalCatalog().registry;

const tickOf = (elapsed: number, dt = 1) => ({ dtSeconds: dt, elapsedSeconds: elapsed });

function floorplan(): ShipFloorplan {
  return {
    id: "nave-14a3",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 4, height: 1 },
    sections: [
      { id: SALA, nameKey: "section.sala", cells: [0, 1, 2, 3].map((x) => ({ x, y: 0 })) },
    ],
    conduits: [],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

function blueprintWith(wear: ComponentWear = "nuevo", amount = 10): Blueprint {
  return {
    metadata: {
      schemaVersion: 5,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-09-03T00:00:00.000Z",
      updatedAt: "2026-09-03T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: TANQUE,
        componentDefinitionId: "tanque-muestra-criogenica" as ComponentId,
        placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear,
      },
    ],
    reservoirContents:
      amount > 0
        ? [{ componentInstanceId: TANQUE, substanceId: "agua" as ChemicalSubstanceId, amount }]
        : [],
    signalGraph: { nodes: [], edges: [] },
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

function buildScene(options: { wear?: ComponentWear; amount?: number } = {}) {
  const shipState = new MutableShipState(blueprintWith(options.wear, options.amount ?? 10));
  const emitter = new EventEmitter<PhaseDomainEvent>();
  const events: PhaseDomainEvent[] = [];
  emitter.onAny((event) => events.push(event));
  let temperature = 21;
  const runtime = new MissionPhaseRuntime({
    shipState,
    shipFloorplan: floorplan(),
    sectionTemperatureOf: () => temperature,
    substanceOf: (id) => CHEMICALS.get(id),
    emitter,
  });
  return {
    shipState,
    events,
    runtime,
    setTemperature: (celsius: number) => {
      temperature = celsius;
    },
    instance: () => shipState.get().placedComponents[0]!,
  };
}

describe("MissionPhaseRuntime", () => {
  it("congelar el contenido emite UNA vez y desgasta el tanque UNA vez, aunque la sala siga helada", () => {
    const scene = buildScene();
    scene.runtime.tick(tickOf(0));
    expect(scene.events).toHaveLength(0);

    scene.setTemperature(-5);
    scene.runtime.tick(tickOf(1));
    expect(scene.events).toHaveLength(1);
    expect(scene.events[0]).toMatchObject({
      kind: "reservoir-content-phase-change",
      transition: "freeze",
      damagedContainer: true,
      destroyedContainer: false,
    });
    expect(scene.instance().wear).toBe("usado");

    // El cruce es un BORDE, no un estado: mantener la sala fría 30 ticks no
    // vuelve a cobrar desgaste ni a emitir. Sin esto sería un goteo por frame,
    // que además a cadencia real no se ve (la lección de 13f ronda 1).
    for (let i = 2; i < 32; i += 1) {
      scene.runtime.tick(tickOf(i));
    }
    expect(scene.events).toHaveLength(1);
    expect(scene.instance().wear).toBe("usado");
  });

  it("corre a cadencia de FRAME sin multiplicar el daño", () => {
    // Un test que solo corre a 1 tick = 1 s no distingue un evento de borde de
    // una tasa continua: a 60 fps una tasa daría 60 eventos por segundo.
    const scene = buildScene();
    scene.runtime.tick(tickOf(0, 1 / 60));
    scene.setTemperature(-5);
    for (let frame = 1; frame <= 120; frame += 1) {
      scene.runtime.tick(tickOf(frame / 60, 1 / 60));
    }
    expect(scene.events).toHaveLength(1);
    expect(scene.instance().wear).toBe("usado");
  });

  it("descongelar emite `melt` y NO daña: el castigo es la expansión al solidificar", () => {
    const scene = buildScene();
    scene.runtime.tick(tickOf(0));
    scene.setTemperature(-5);
    scene.runtime.tick(tickOf(1));
    scene.setTemperature(21);
    scene.runtime.tick(tickOf(2));

    expect(scene.events).toHaveLength(2);
    expect(scene.events[1]).toMatchObject({ transition: "melt", damagedContainer: false });
    expect(scene.instance().wear).toBe("usado");
  });

  it("un tanque ya en el peor desgaste no aguanta otra congelación", () => {
    const scene = buildScene({ wear: "critico" });
    scene.runtime.tick(tickOf(0));
    scene.setTemperature(-5);
    scene.runtime.tick(tickOf(1));

    expect(scene.events[0]).toMatchObject({ destroyedContainer: true });
    expect(scene.instance().condition).toBe("destroyed");
  });

  it("cargar una partida con el tanque YA congelado no vuelve a cobrarle el desgaste", () => {
    // El estado previo no se persiste: se SIEMBRA en el primer tick. Sin la
    // siembra, guardar y cargar en una sala fría sería un castigo por guardar.
    const scene = buildScene();
    scene.setTemperature(-40);
    scene.runtime.tick(tickOf(0));
    expect(scene.events).toHaveLength(0);
    expect(scene.instance().wear).toBe("nuevo");
  });

  it("un reservorio VACIADO pierde su registro y no hereda el estado de la sustancia anterior", () => {
    const scene = buildScene();
    scene.setTemperature(-5);
    scene.runtime.tick(tickOf(0));
    scene.runtime.tick(tickOf(1));
    expect(scene.events).toHaveLength(0);

    // El jugador purga el tanque (contenido fuera) y después vuelve a llenarlo
    // ya en la sala fría: se re-siembra, no se emite un `freeze` fantasma.
    const blueprint = scene.shipState.get();
    scene.shipState.set({ ...blueprint, reservoirContents: [] });
    scene.runtime.tick(tickOf(2));
    scene.shipState.set(scene.shipState.get());
    scene.shipState.set({
      ...scene.shipState.get(),
      reservoirContents: [
        { componentInstanceId: TANQUE, substanceId: "agua" as ChemicalSubstanceId, amount: 5 },
      ],
    });
    scene.runtime.tick(tickOf(3));
    expect(scene.events).toHaveLength(0);
  });

  it("un tanque destruido deja de evaluarse", () => {
    const scene = buildScene();
    const blueprint = scene.shipState.get();
    scene.shipState.set({
      ...blueprint,
      placedComponents: [{ ...blueprint.placedComponents[0]!, condition: "destroyed" }],
    });
    scene.setTemperature(-40);
    scene.runtime.tick(tickOf(0));
    scene.runtime.tick(tickOf(1));
    expect(scene.events).toHaveLength(0);
  });
});
