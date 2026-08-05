import { describe, expect, it } from "vitest";
import { createShipTaskEffect } from "./ship-task-effect.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MissionPowerRuntime } from "../power/mission-power-runtime.js";
import { totalPowerBudget } from "../power/power-source.js";
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
const BATTERY = "bateria-1" as PlacedComponentInstanceId;

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
    sections: [{ id: SECTION, nameKey: "fixture-section", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

function fixtureShip(): Blueprint {
  return {
    metadata: {
      schemaVersion: 8,
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
      // Fuente REAL: sin ella `totalPowerBudget` es 0 y el reparto no puede
      // otorgarle nada a la sección, así que nada estaría vivo nunca.
      {
        instanceId: BATTERY,
        componentDefinitionId: "bateria-celda-simple" as ComponentId,
        placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
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
      sectionAllocations: [{ sectionId: SECTION, units: 1 }],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

/**
 * Monta el efecto de tarea con las consultas al mundo vivo que la misión real
 * le inyecta. `sectionHasGrantedPower` sale del **runtime de energía real**
 * (`MissionPowerRuntime`), no de un closure escrito a mano.
 *
 * Por qué importa (fix de playtest ronda 1): la primera versión de este test
 * inyectaba su propio `isInstancePowered` derivado de `sectionAllocations` —
 * es decir, implementaba la semántica que el runtime DEBERÍA tener. Los tres
 * tests pasaban en verde con el bug puesto en producción, porque el fixture
 * mentía a favor del código. Usar el runtime real es lo único que hace que
 * esta suite pueda volver a atrapar la regresión.
 */
function scenario() {
  const shipState = new MutableShipState(fixtureShip());
  const crew = new MutableCrewState([actorFixture()]);
  const floorplan = fixtureFloorplan();
  const powerRuntime = new MissionPowerRuntime(shipState, floorplan, REGISTRY);
  powerRuntime.recalculate();
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
    floorplan,
    {},
    {
      // Igual que en producción: el complemento de `sectionHasNoPowerGranted`,
      // recalculado tras cada escritura (el runtime no tickea en pausa).
      sectionHasGrantedPower: (sectionId) => {
        powerRuntime.recalculate();
        return !powerRuntime.sectionHasNoPowerGranted(sectionId);
      },
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

  const dischargeSource = () =>
    effect(
      createCrewTask({
        id: "t-discharge" as CrewTaskId,
        actorId: ACTOR_ID,
        type: "discharge-source",
        payload: { kind: "discharge-source", instanceId: BATTERY },
      }),
    );

  const dismantleBattery = () =>
    effect(
      createCrewTask({
        id: "t-dismantle-battery" as CrewTaskId,
        actorId: ACTOR_ID,
        type: "dismantle",
        payload: { kind: "dismantle", instanceId: BATTERY },
      }),
    );

  return {
    shipState,
    crew,
    powerRuntime,
    seenSalvage,
    seenCrew,
    dismantle,
    cutPower,
    dischargeSource,
    dismantleBattery,
  };
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
    expect(shipState.get().placedComponents.map((entry) => entry.instanceId)).toEqual([BATTERY]);
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

  it("a source keeps its own charge: cutting the section does NOT make a battery safe", () => {
    const { seenSalvage, cutPower, dismantleBattery } = scenario();

    cutPower();
    dismantleBattery();

    // La sección está a oscuras y aun así chispea: la carga es de la pieza, no
    // de la red (decisión del operador, ronda 1 de playtest).
    expect(seenSalvage.map((event) => event.kind)).toEqual(["dismantle-spark"]);
  });

  it("discharging the source makes it safe, at the cost of the ship's budget", () => {
    const { shipState, seenSalvage, seenCrew, dischargeSource, dismantleBattery } = scenario();
    const registry = REGISTRY;
    const before = totalPowerBudget(shipState.get().placedComponents, registry, []);

    dischargeSource();

    const afterShip = shipState.get();
    expect(afterShip.powerState.dischargedSourceIds).toEqual([BATTERY]);
    // El precio: esa unidad ya no está disponible para el resto de la nave.
    expect(
      totalPowerBudget(afterShip.placedComponents, registry, afterShip.powerState.dischargedSourceIds),
    ).toBe(before - 1);

    dismantleBattery();
    expect(seenSalvage).toEqual([]);
    expect(seenCrew).toEqual([]);
  });

  it("a piece with no electrical relevance never sparks, powered section or not", () => {
    const { shipState, seenSalvage, dismantle } = scenario();
    // La junta hermética declara `CE: "N"` y no tiene propiedad funcional: no
    // participa del sistema eléctrico, así que arrancarla no puede chispear
    // aunque la sección esté alimentada.
    const ship = shipState.get();
    shipState.set({
      ...ship,
      placedComponents: ship.placedComponents.map((entry) =>
        entry.instanceId === CONDUCTOR
          ? { ...entry, componentDefinitionId: "junta-hermetica" as ComponentId }
          : entry,
      ),
    });

    dismantle();

    expect(seenSalvage).toEqual([]);
  });
});
