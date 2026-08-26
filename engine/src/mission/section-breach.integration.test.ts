import { describe, expect, it } from "vitest";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type {
  Blueprint,
  PlacedComponentInstance,
  PlacedComponentInstanceId,
} from "../blueprint/blueprint.types.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { IntegrityDomainEvent } from "../integrity/integrity-events.types.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { MissionHazardRuntime } from "./mission-hazard-runtime.js";
import { MutableCrewState } from "./mutable-crew-state.js";
import { TaskScheduler } from "../tasks/task-scheduler.js";
import { createCrewTask } from "../tasks/task-factory.js";
import type { CrewTaskId } from "../tasks/task.types.js";
import type { CrewDomainEvent } from "../crew/crew-events.types.js";
import { MissionSectionIntegrityRuntime } from "./mission-section-integrity-runtime.js";
import { sectionBreachPressureSink } from "./section-breach-pressure-sink.js";
import { composePressureSinks } from "./composite-pressure-sink.js";
import { MutableShipState } from "./mutable-ship-state.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

const SECTION = "bahia-carga" as SectionId;
const PLATE = "plancha-metalica" as ComponentId;
const CRATE = "caja-generica" as ComponentId;
const CRATE_INSTANCE = "caja-1" as PlacedComponentInstanceId;

function componentRegistry(): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  // Parche válido: estructura (EST) con RE suficiente — identidad por
  // propiedades, no por id (ver `isBreachPatch`).
  registry.register(PLATE, {
    level: "atomic",
    id: PLATE,
    name: "Plancha metálica",
    data: {
      footprint: { width: 2, height: 2 },
      functional: [{ tag: "EST", damageResistance: 50, articulatedRange: undefined }],
      material: { RE: "M" },
    },
  });
  // Pieza cualquiera de la sección: se daña al colapsar, pero no sirve de parche.
  registry.register(CRATE, {
    level: "atomic",
    id: CRATE,
    name: "Caja",
    data: { footprint: { width: 1, height: 1 }, material: { RE: "B" } },
  });
  return registry;
}

const chemicalRegistry = new MapEntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>();

function placed(
  instanceId: PlacedComponentInstanceId,
  definitionId: ComponentId,
  x: number,
  y: number,
  footprint = { width: 1, height: 1 },
): PlacedComponentInstance {
  return {
    instanceId,
    componentDefinitionId: definitionId,
    placement: { position: { x, y }, footprint, rotation: 0 },
    condition: "ok",
    wear: "nuevo",
  };
}

function blueprintWith(placedComponents: PlacedComponentInstance[]): Blueprint {
  return {
    metadata: {
      schemaVersion: 9,
      id: "t",
      name: "t",
      engineVersion: "0.0.0",
      createdAt: "2026-08-24",
      updatedAt: "2026-08-24",
    },
    placedComponents,
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: {
      sectionAllocations: [],
      instancePriorities: [],
      permanentlyDisconnectedSectionIds: [],
      dischargedSourceIds: [],
    },
  };
}

/** Sección de 3×3 celdas → 90 HP con los parámetros por defecto. */
function fixtureFloorplan(): ShipFloorplan {
  const cells = [];
  for (let x = 0; x < 3; x += 1) {
    for (let y = 0; y < 3; y += 1) {
      cells.push({ x, y });
    }
  }
  return {
    id: "fixture",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 3, height: 3 },
    sections: [{ id: SECTION, nameKey: "fixture-section", cells }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

/**
 * Monta el sistema REAL: atmósfera, integridad y sumidero de brecha
 * compuestos como en producción. Nada de dobles que implementen la semántica
 * bajo prueba — el único stub es el azar del colapso, que es I/O.
 */
function mount(options: { readonly random?: () => number } = {}) {
  const floorplan = fixtureFloorplan();
  const shipState = new MutableShipState(blueprintWith([placed(CRATE_INSTANCE, CRATE, 1, 1)]));
  const registry = componentRegistry();
  const reactionEvents = new EventEmitter<ReactionDomainEvent>();
  const integrityEvents = new EventEmitter<IntegrityDomainEvent>();
  const fired: IntegrityDomainEvent[] = [];
  const explosions: ReactionDomainEvent[] = [];
  integrityEvents.onAny((event) => fired.push(event));
  reactionEvents.onAny((event) => explosions.push(event));

  // Declaración diferida: el sumidero de presión y el piso por sección se
  // resuelven por closure contra el runtime que todavía no existe — es el
  // mismo nudo que se ata en producción (`mission-runtime.ts`).
  // eslint-disable-next-line prefer-const
  let integrityRuntime: MissionSectionIntegrityRuntime;
  const atmosphereRuntime = new MissionAtmosphereRuntime(
    floorplan,
    [],
    composePressureSinks(
      sectionBreachPressureSink(shipState, () => integrityRuntime.openBreaches(), registry),
    ),
    undefined,
    (sectionId) => integrityRuntime.pressureFloorFor(sectionId),
  );
  integrityRuntime = new MissionSectionIntegrityRuntime({
    shipState,
    shipFloorplan: floorplan,
    atmosphereRuntime,
    chemicalRegistry,
    componentRegistry: registry,
    emitter: integrityEvents,
    reactionEvents,
    random: options.random,
  });

  return { floorplan, shipState, registry, atmosphereRuntime, integrityRuntime, fired, explosions, reactionEvents };
}

/** Tripulante de fixture en una celda concreta. */
function crewAt(id: CrewActorId, cell: { x: number; y: number }): CrewActor {
  return {
    id,
    name: String(id),
    specialty: "ingeniero",
    tier: "novato",
    trait: "estoico",
    hp: 100,
    maxHp: 100,
    status: "idle",
    currentSectionId: SECTION,
    currentCell: cell,
  };
}

/** Instala una plancha metálica sobre la celda de la brecha (el parche válido del catálogo). */
function patchBreach(world: ReturnType<typeof mount>, cell: { x: number; y: number }): void {
  const blueprint = world.shipState.get();
  world.shipState.set({
    ...blueprint,
    placedComponents: [
      ...blueprint.placedComponents,
      placed("parche" as PlacedComponentInstanceId, PLATE, cell.x, cell.y, { width: 2, height: 2 }),
    ],
  });
}

describe("13f — una explosión abre una brecha que drena presión", () => {
  it("la combustión daña la sección, la colapsa y la vacía hasta el vacío real", () => {
    // `random: () => 0.99` fija el máximo de explosiones de colapso: el peor
    // caso, no el cómodo.
    const world = mount({ random: () => 0.99 });

    // Tres explosiones de media sección (120 cada una) sobre 90 HP: la primera
    // ya la revienta.
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });

    expect(world.integrityRuntime.integrityOf(SECTION)?.breached).toBe(true);
    expect(world.fired.some((event) => event.kind === "section-breached")).toBe(true);

    // La maquinaria de adentro salió dañada.
    const crate = world.shipState.get().placedComponents[0];
    expect(crate?.wear).toBe("usado");

    // Y hubo explosiones REALES por el emisor de reacciones (la que provocó el
    // colapso + las del colapso), no un efecto visual aparte.
    expect(world.explosions.length).toBeGreaterThan(1);

    // La presión cae hasta 0 y no se queda en el piso de 40 kPa de una fuga
    // normal: eso es lo que distingue a una sección colapsada.
    for (let second = 1; second <= 20; second += 1) {
      world.atmosphereRuntime.tick(tickOf(second));
    }
    expect(world.atmosphereRuntime.atmosphereOf(SECTION)?.pressureKpa).toBe(0);
  });

  it("el colapso no se realimenta: sus propias explosiones no vuelven a dañarla", () => {
    const world = mount({ random: () => 0.99 });
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });

    // Una sola brecha, por muchas explosiones que dispare el colapso.
    expect(world.fired.filter((event) => event.kind === "section-breached")).toHaveLength(1);
  });

  it("instalar una pieza estructural sobre la brecha detiene la fuga pero NO devuelve la vida", () => {
    const world = mount();
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });
    const breach = world.integrityRuntime.openBreaches()[0]!;

    // Presurizada a mano para poder ver si la fuga se detuvo de verdad.
    const atmosphere = world.atmosphereRuntime.atmosphereOf(SECTION)!;
    atmosphere.pressureKpa = 101;

    const blueprint = world.shipState.get();
    world.shipState.set({
      ...blueprint,
      placedComponents: [
        ...blueprint.placedComponents,
        placed("parche" as PlacedComponentInstanceId, PLATE, breach.cell.x, breach.cell.y, {
          width: 2,
          height: 2,
        }),
      ],
    });

    for (let second = 1; second <= 20; second += 1) {
      world.atmosphereRuntime.tick(tickOf(second));
    }

    expect(world.atmosphereRuntime.atmosphereOf(SECTION)?.pressureKpa).toBe(101);
    // La cicatriz sigue ahí (principio 5): sellar tapa el agujero, no repara
    // el casco. Un golpe más y se vuelve a abrir.
    expect(world.integrityRuntime.integrityOf(SECTION)?.hp).toBe(0);
    expect(world.integrityRuntime.fractionOf(SECTION)).toBe(0);
  });

  /**
   * REGRESIÓN de la ronda 2 de playtest: "he bloqueado la sección dañada con
   * una plancha de metal (...) pero la atmósfera no se restaura, ¿está bien
   * eso?". No lo estaba: sellar solo detenía el drenaje y NADA volvía a subir
   * la presión (`diffuse()` no toca `pressureKpa`), así que la sala quedaba a
   * 0 kPa y letal para siempre con el parche puesto.
   */
  it("sellar la brecha represuriza la sección hasta la estándar, sin pasarse", () => {
    const world = mount();
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });
    const breach = world.integrityRuntime.openBreaches()[0]!;

    // Se desangra hasta el vacío real con el agujero abierto.
    for (let second = 1; second <= 30; second += 1) {
      world.atmosphereRuntime.tick(tickOf(second));
    }
    expect(world.atmosphereRuntime.atmosphereOf(SECTION)?.pressureKpa).toBe(0);

    patchBreach(world, breach.cell);

    for (let second = 31; second <= 200; second += 1) {
      world.atmosphereRuntime.tick(tickOf(second));
    }

    // Recuperada, y clavada en el techo: no se pasa de la atmósfera estándar.
    expect(world.atmosphereRuntime.atmosphereOf(SECTION)?.pressureKpa).toBe(101);
    // La cicatriz NO se cura (principio 5): el casco sigue reventado y un
    // impacto más vuelve a abrir el agujero.
    expect(world.integrityRuntime.integrityOf(SECTION)?.hp).toBe(0);
    expect(world.integrityRuntime.integrityOf(SECTION)?.breached).toBe(true);
  });

  it("una pieza que no es estructura no sirve de parche", () => {
    const world = mount();
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });
    const breach = world.integrityRuntime.openBreaches()[0]!;

    const blueprint = world.shipState.get();
    world.shipState.set({
      ...blueprint,
      placedComponents: [
        ...blueprint.placedComponents,
        placed("caja-2" as PlacedComponentInstanceId, CRATE, breach.cell.x, breach.cell.y),
      ],
    });

    for (let second = 1; second <= 20; second += 1) {
      world.atmosphereRuntime.tick(tickOf(second));
    }

    expect(world.atmosphereRuntime.atmosphereOf(SECTION)?.pressureKpa).toBe(0);
  });

  /**
   * Ronda 1 de playtest de 13f. La brecha se abre PEGADA AL CASCO y la celda
   * queda grabada en el estado de la sección, no solo en el evento: si se
   * recalculara al cargar la partida, el agujero se mudaría de pared y el
   * parche que el jugador dejó puesto quedaría en el lugar equivocado.
   */
  it("la brecha se abre en una celda de borde y queda grabada para el save", () => {
    const world = mount();
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });

    const breach = world.integrityRuntime.openBreaches()[0]!;
    // En una sección de 3×3 que ocupa todo el plano, el centro (1,1) es la
    // ÚNICA celda que no toca el exterior: la brecha no puede caer ahí.
    expect(breach.cell).not.toEqual({ x: 1, y: 1 });

    const snapshot = world.integrityRuntime.toSnapshots().find((entry) => entry.sectionId === SECTION)!;
    expect(snapshot.breachCell).toEqual(breach.cell);
  });

  /**
   * Ronda 1 de playtest: "al presionar H una vez, la integridad del casco queda
   * en casi 0 de una". La sección brechada aporta 0, pero pesa; el resto de la
   * nave sigue contando.
   */
  it("una sección brechada pesa MÁS que su tamaño en el indicador de nave, sin hundirlo sola", () => {
    const world = mount();
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });

    const [entry] = world.integrityRuntime.weightedFractions();
    expect(entry?.fraction).toBe(0);
    expect(entry?.weight).toBe(90 * 3);
  });

  it("la descompresión sola deteriora la sección pero nunca la abre", () => {
    const world = mount();
    const atmosphere = world.atmosphereRuntime.atmosphereOf(SECTION)!;
    atmosphere.pressureKpa = 0;
    atmosphere.gases.set(GAS.OXYGEN, 0);

    for (let second = 1; second <= 500; second += 1) {
      world.integrityRuntime.tick(tickOf(second));
    }

    const integrity = world.integrityRuntime.integrityOf(SECTION)!;
    expect(integrity.breached).toBe(false);
    expect(integrity.hp).toBeGreaterThan(0);
    expect(integrity.hp).toBeLessThan(integrity.maxHp);
  });
});

/**
 * Ronda 2 de playtest de 13f, reporte 3: "enviar un tripulante nuevo a la zona
 * que estaba dañada (pero ahora arreglada con la plancha de metal) sigue
 * dañando al tripulante, ¿está bien eso?".
 *
 * No lo estaba, y la causa no vivía en los hazards sino en la presión: la
 * sección parcheada seguía a 0 kPa para siempre, o sea por debajo del umbral de
 * vacío. Este test ata los dos runtimes precisamente porque el bug estaba en la
 * costura — cada uno por separado hacía lo correcto.
 */
describe("13f ronda 2 — la sección parcheada vuelve a ser habitable", () => {
  const ACTOR = "tripulante-1" as CrewActorId;

  function actorAt(hp: number): CrewActor {
    return {
      id: ACTOR,
      name: "Tripulante",
      specialty: "ingeniero",
      tier: "novato",
      trait: "estoico",
      hp,
      maxHp: 100,
      status: "idle",
      currentSectionId: SECTION,
      currentCell: { x: 1, y: 1 },
    };
  }

  function mountWithCrew() {
    const world = mount();
    const crewState = new MutableCrewState([actorAt(100)]);
    const hazardRuntime = new MissionHazardRuntime({
      shipFloorplan: world.floorplan,
      atmosphereRuntime: world.atmosphereRuntime,
      chemicalRegistry,
      crewState,
    });
    return { ...world, crewState, hazardRuntime };
  }

  /** Avanza atmósfera + hazards juntos, en el mismo orden que el core loop real. */
  function run(world: ReturnType<typeof mountWithCrew>, fromSecond: number, toSecond: number): void {
    for (let second = fromSecond; second <= toSecond; second += 1) {
      world.atmosphereRuntime.tick(tickOf(second));
      world.hazardRuntime.tick(tickOf(second));
    }
  }

  it("con la brecha abierta el vacío mata; con el parche puesto deja de dañar", () => {
    const world = mountWithCrew();
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "none",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });
    const breach = world.integrityRuntime.openBreaches()[0]!;

    // Con el agujero abierto, la sección se vacía y el tripulante sufre.
    run(world, 1, 20);
    expect(world.crewState.get(ACTOR)!.hp).toBeLessThan(100);

    // Parche + tiempo suficiente para represurizar por encima del umbral.
    patchBreach(world, breach.cell);
    world.crewState.set({ ...world.crewState.get(ACTOR)!, hp: 100 });
    run(world, 21, 60);
    expect(world.atmosphereRuntime.atmosphereOf(SECTION)!.pressureKpa).toBeGreaterThan(20);

    // A partir de acá, un relevo entra y NO recibe un solo punto de daño.
    const hpTrasParche = world.crewState.get(ACTOR)!.hp;
    run(world, 61, 200);
    expect(world.crewState.get(ACTOR)!.hp).toBe(hpTrasParche);
  });
});

/**
 * Ronda 3 de playtest de 13f, reporte 1: instalar la pieza equivocada sobre una
 * brecha dejaba la partida sin salida, porque "desmontar una pieza puede
 * demorar más de lo que demoran en morirse los tripulantes de la sección
 * colapsada" y **"el desmonte inicia de 0 con cada nuevo tripulante"**.
 *
 * Ata los tres sistemas que participan (vacío, scheduler y relevo de trabajo)
 * porque el bug vivía entre ellos: cada uno por separado hacía lo correcto. La
 * suscripción `crew-death → standDown` vive en `MissionRuntime` (`/game`), así
 * que acá se cablea a mano — es la ÚNICA pieza de pegamento del test; el vacío,
 * el desmontaje y el relevo son los reales.
 */
describe("13f ronda 3 — un segundo tripulante termina el trabajo del que murió", () => {
  it("el relevo hereda el avance del desmontaje en vez de empezar de cero", () => {
    const world = mount();
    const primero = "tripulante-1" as CrewActorId;
    const relevo = "tripulante-2" as CrewActorId;

    // El relevo espera FUERA (sin celda: el vacío no lo alcanza) hasta que el
    // primero cae. Si entrara ya, moriría en la misma tanda y el test no
    // probaría el relevo sino una segunda muerte.
    const crewState = new MutableCrewState([
      crewAt(primero, { x: 1, y: 1 }),
      { ...crewAt(relevo, { x: 1, y: 1 }), currentCell: undefined },
    ]);
    const crewEvents = new EventEmitter<CrewDomainEvent>();
    const hazardRuntime = new MissionHazardRuntime({
      shipFloorplan: world.floorplan,
      atmosphereRuntime: world.atmosphereRuntime,
      chemicalRegistry,
      crewState,
      crewEmitter: crewEvents,
    });
    const scheduler = new TaskScheduler();
    crewEvents.on("crew-death", (event) => {
      crewState.markDead(event.actorId);
      scheduler.standDown(event.actorId, { dtSeconds: 0, elapsedSeconds: 0 });
    });

    // Sección abierta al vacío.
    world.reactionEvents.emit({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "none",
      sectionId: SECTION,
      elapsedSeconds: 0,
    });

    const dismantle = (taskId: string, actorId: CrewActorId) =>
      scheduler.enqueue(
        createCrewTask({
          id: taskId as CrewTaskId,
          actorId,
          type: "dismantle",
          estimatedDurationSeconds: 60, // más largo que la vida de nadie en vacío
          payload: { kind: "dismantle", instanceId: CRATE_INSTANCE },
        }),
      );

    dismantle("intento-1", primero);
    for (let second = 1; second <= 60; second += 1) {
      world.atmosphereRuntime.tick(tickOf(second));
      hazardRuntime.tick(tickOf(second));
      scheduler.tick(tickOf(second));
    }

    // El primero murió sin poder terminar.
    expect(crewState.get(primero)!.status).toBe("dead");
    expect(scheduler.getTask("intento-1" as CrewTaskId)?.state).toBe("cancelled");
    const avanceHeredado = scheduler.getTask("intento-1" as CrewTaskId)!.elapsedSeconds;
    expect(avanceHeredado).toBeGreaterThan(0);

    // Entra el relevo y NO empieza de cero: retoma el trabajo donde quedó.
    crewState.set({ ...crewState.get(relevo)!, currentCell: { x: 1, y: 1 } });
    dismantle("intento-2", relevo);
    scheduler.tick(tickOf(61));
    expect(scheduler.getTask("intento-2" as CrewTaskId)!.elapsedSeconds).toBeGreaterThanOrEqual(
      avanceHeredado,
    );
  });
});
