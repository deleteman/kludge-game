import { describe, expect, it } from "vitest";
import { createShipTaskEffect } from "./ship-task-effect.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MutableCrewState } from "./mutable-crew-state.js";
import { MutableAtomicStock } from "../inventory/mutable-atomic-stock.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import { createCrewTask } from "../tasks/task-factory.js";
import type { CrewTaskId } from "../tasks/task.types.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewDomainEvent } from "../crew/crew-events.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { standardSectionAtmosphere } from "../atmosphere/section.types.js";
import type { SalvageDomainEvent } from "../salvage/salvage-hazard.types.js";

/**
 * Subfase 13d — el test que `nuevo-orden.md` pide textualmente: "desmontar
 * conductor energizado sin purga → evento de chispa/combustión; con purga
 * previa → seguro". Integración porque cruza tres dominios que en producción
 * solo se encuentran en misión: energía (13b, quién está vivo), tareas (el
 * acto de desmontar) y tripulación (quién se lleva la descarga).
 */

const ACTOR_ID = "crew-1" as CrewActorId;
const SECTION = "sala-motores" as SectionId;
const CONDUCTOR = "conductor-1" as PlacedComponentInstanceId;

/** Catálogo real: `cable-cobre` debe existir para que el desmontaje acredite stock. */
const REGISTRY = buildComponentCatalog().registry;

function actorFixture(): CrewActor {
  return {
    id: ACTOR_ID,
    name: "Vega",
    specialty: "ingeniero",
    tier: "veterano",
    trait: "disciplinado",
    hp: 100,
    maxHp: 100,
    status: "idle",
    currentSectionId: SECTION,
  };
}

function fixtureFloorplan(): ShipFloorplan {
  return {
    id: "fixture-floorplan",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 2, height: 2 },
    sections: [{ id: SECTION, nameKey: "fixture-section", cells: [{ x: 0, y: 0 }] }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

function fixtureShip(): Blueprint {
  return {
    metadata: {
      schemaVersion: 5,
      id: "t",
      name: "t",
      engineVersion: "0.0.0",
      createdAt: "2026-08-05",
      updatedAt: "2026-08-05",
    },
    placedComponents: [
      {
        instanceId: CONDUCTOR,
        componentDefinitionId: "cable-cobre" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: [{ sectionId: SECTION, units: 2 }],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
    },
  };
}

/**
 * Monta el efecto de tarea con las tres consultas al mundo vivo que la misión
 * real le inyecta. `powered` se resuelve leyendo la asignación de la sección
 * (en producción es `MissionPowerRuntime.isInstancePowered`), que es lo que
 * hace observable el ida y vuelta corte→seguro.
 */
function scenario() {
  const shipState = new MutableShipState(fixtureShip());
  const crew = new MutableCrewState([actorFixture()]);
  const salvageEvents = new EventEmitter<SalvageDomainEvent>();
  const crewEvents = new EventEmitter<CrewDomainEvent>();
  const seenSalvage: SalvageDomainEvent[] = [];
  const seenCrew: CrewDomainEvent[] = [];
  salvageEvents.onAny((event) => seenSalvage.push(event));
  crewEvents.onAny((event) => seenCrew.push(event));

  const effect = createShipTaskEffect(
    shipState,
    REGISTRY,
    new MutableAtomicStock({}),
    fixtureFloorplan(),
    {},
    {
      isInstancePowered: () =>
        shipState.get().powerState.sectionAllocations.some(
          (entry) => entry.sectionId === SECTION && entry.units > 0,
        ),
      atmosphereOf: () => standardSectionAtmosphere(),
      elapsedSecondsOf: () => 30,
      handler: {
        emitter: salvageEvents,
        crewEmitter: crewEvents,
        actorOf: (id) => crew.get(id),
        setActor: (actor) => crew.set(actor),
      },
    },
  );

  const dismantle = () =>
    effect(
      createCrewTask({
        id: "t-dismantle" as CrewTaskId,
        actorId: ACTOR_ID,
        type: "dismantle",
        payload: { kind: "dismantle", instanceId: CONDUCTOR },
      }),
    );

  const cutPower = () =>
    effect(
      createCrewTask({
        id: "t-cut" as CrewTaskId,
        actorId: ACTOR_ID,
        type: "cut-power",
        payload: { kind: "cut-power", sectionId: SECTION },
      }),
    );

  return { shipState, crew, seenSalvage, seenCrew, dismantle, cutPower };
}

describe("Subfase 13d — riesgo sistémico al desmontar (integración)", () => {
  it("dismantling a live conductor without cutting power sparks, hurts and degrades", () => {
    const { crew, seenSalvage, seenCrew, dismantle } = scenario();

    const result = dismantle();

    expect(seenSalvage.map((event) => event.kind)).toEqual(["dismantle-spark"]);
    expect(seenSalvage[0]).toMatchObject({ sectionId: SECTION, position: { x: 0, y: 0 } });
    expect(seenCrew[0]).toMatchObject({ kind: "crew-damaged", cause: "electrocution" });
    expect(crew.get(ACTOR_ID)?.hp).toBeLessThan(100);
    // Tercera consecuencia: la pieza sale peor de lo que la tirada de §6.5 dio.
    expect(result?.obtained?.[0]).toMatchObject({ wear: "usado", degraded: true });
  });

  it("cutting power first makes the very same dismantle safe", () => {
    const { shipState, crew, seenSalvage, seenCrew, dismantle, cutPower } = scenario();

    cutPower();
    const result = dismantle();

    expect(seenSalvage).toEqual([]);
    expect(seenCrew).toEqual([]);
    expect(crew.get(ACTOR_ID)?.hp).toBe(100);
    expect(result?.obtained?.[0]).toMatchObject({ wear: "nuevo", degraded: false });
    expect(shipState.get().placedComponents).toEqual([]);
  });

  it("the safe state is derived, not a flag: re-assigning power makes it risky again", () => {
    const { shipState, seenSalvage, cutPower, dismantle } = scenario();

    cutPower();
    // El jugador vuelve a alimentar la sección con el dial de reparto (13b).
    const ship = shipState.get();
    shipState.set({
      ...ship,
      powerState: { ...ship.powerState, sectionAllocations: [{ sectionId: SECTION, units: 1 }] },
    });
    dismantle();

    expect(seenSalvage.map((event) => event.kind)).toEqual(["dismantle-spark"]);
  });
});
