import { describe, expect, it } from "vitest";
import {
  actuatorEmitterInputs,
  actuatorOutputNodeId,
  allEmittersActive,
  blocksPathing,
  buildComponentCatalog,
  doorSignalOutput,
  instantiateDoorSeeds,
  MissionDoorRuntime,
  MissionSignalRuntime,
  motionAwareEmitterInputs,
  MutableShipState,
  type Blueprint,
  type ComponentId,
  type DoorId,
  type DoorSeedId,
  type GridPosition,
  type PlacedComponentInstanceId,
  type ShipFloorplan,
  type SignalEdgeId,
  type SignalNodeId,
} from "../index.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ConduitId } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

/**
 * Fotorreceptor → cable → evaluador → puerta (Subfase 13h, ronda 2 de playtest).
 *
 * Este es EL test que faltaba. La cadena existía entera y estaba cortada en
 * tres lugares distintos a la vez, y los tres cortes convivían en verde porque
 * cada pieza estaba probada sola: `SignalDoorRule` con `signalOutput` puesto a
 * mano, `motionAwareEmitterInputs` con un grafo sin puertas, y el pegamento —
 * que era donde estaban los bugs — sin ningún test.
 *
 * Recorre la cadena real de punta a punta: el sensor se dispara por la posición
 * de un actor, el evaluador propaga, y la puerta se gobierna con lo que llega.
 */

const PASILLO = "pasillo" as SectionId;
const HIBERNACION = "hibernacion" as SectionId;
const THRESHOLD: GridPosition = { x: 1, y: 0 };
const SENSOR_INSTANCE = "sensor-pasillo" as PlacedComponentInstanceId;
const SENSOR_NODE = "sensor-pasillo:em" as SignalNodeId;
const DOOR = "instance:puerta-pasillo-hibernacion" as DoorId;
const DOOR_INSTANCE = "puerta-pasillo-hibernacion" as PlacedComponentInstanceId;

const REGISTRY = buildComponentCatalog().registry;

function floorplan(): ShipFloorplan {
  return {
    id: "nave-test",
    archetype: "exploracion",
    nameKey: "ship.test",
    gridSize: { width: 4, height: 1 },
    sections: [
      { id: PASILLO, nameKey: "section.pasillo", cells: [{ x: 0, y: 0 }, THRESHOLD] },
      {
        id: HIBERNACION,
        nameKey: "section.hibernacion",
        cells: [
          { x: 2, y: 0 },
          { x: 3, y: 0 },
        ],
      },
    ],
    conduits: [
      {
        id: "ventilacion:pasillo:hibernacion:0" as ConduitId,
        a: PASILLO,
        b: HIBERNACION,
        kind: "ventilacion",
        position: { x: 1.5, y: 0 },
        initialAperture: 1,
      },
    ],
    anchors: [],
    componentSeeds: [],
    doors: [
      {
        id: "pasillo-hibernacion" as DoorSeedId,
        a: PASILLO,
        b: HIBERNACION,
        position: THRESHOLD,
        span: 1,
        axis: "x",
        initialOpen: false,
      },
    ],
  };
}

/** Nave con el sensor y la puerta ya cableados entre sí, como los deja el modo cableado. */
function wiredShip(plan: ShipFloorplan, wired = true): { blueprint: Blueprint; doorInstances: ReturnType<typeof instantiateDoorSeeds>["components"] } {
  const seeded = instantiateDoorSeeds(plan.doors, REGISTRY);
  const doorNode = seeded.signalNodes[0]!;
  expect(doorNode.role).toBe("receptor");
  expect(doorNode.ownerRef).toBe(DOOR_INSTANCE);

  const blueprint: Blueprint = {
    metadata: {
      schemaVersion: 10,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: SENSOR_INSTANCE,
        componentDefinitionId: "fotorreceptor" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
      ...seeded.components,
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        { id: SENSOR_NODE, role: "emitter", position: { x: 0, y: 0 }, ownerRef: SENSOR_INSTANCE },
        ...seeded.signalNodes,
      ],
      edges: wired ? [{ id: "cable-1" as SignalEdgeId, from: SENSOR_NODE, to: doorNode.id }] : [],
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
  return { blueprint, doorInstances: seeded.components };
}

/**
 * Monta la cadena completa. `poweredDoor` modela el reparto de energía de 13b:
 * la puerta declara `powerDraw`, así que puede quedar sin motor aunque el resto
 * de la nave funcione.
 */
function mountChain(options: { wired?: boolean; poweredDoor?: boolean } = {}) {
  const wired = options.wired ?? true;
  const poweredDoor = options.poweredDoor ?? true;
  const plan = floorplan();
  const { blueprint, doorInstances } = wiredShip(plan, wired);
  const shipState = new MutableShipState(blueprint);

  let actors: GridPosition[] = [];
  // Contenedor mutable declarado antes que el runtime de señales porque la
  // cebolla de emisores lo consulta perezosamente: la salida de la puerta sale
  // de su estado REAL (14a-4 ronda 1), y el runtime de puertas todavía no
  // existe en este punto. Mismo patrón que usa `MissionRuntime` en producción.
  const doorRuntimeRef: { current?: MissionDoorRuntime } = {};
  const signalRuntime = new MissionSignalRuntime(
    shipState,
    // La base es `allEmittersActive`, LA MISMA que produccion (13g ronda 1).
    // Con un mapa vacio como base, todo emisor que `motionAwareEmitterInputs`
    // no sepa resolver sale `false` en el test y `true` en el juego: el test no
    // podia fallar aunque el bug estuviera puesto.
    actuatorEmitterInputs(
      shipState,
      (instanceId) => doorRuntimeRef.current?.isActuatorActive(instanceId),
      motionAwareEmitterInputs(
        shipState,
        () => actors,
        { isBlocked: () => false },
        REGISTRY,
        allEmittersActive(shipState),
      ),
    ),
  );
  const isInstancePowered = (instanceId: PlacedComponentInstanceId): boolean =>
    instanceId === DOOR_INSTANCE ? poweredDoor : true;

  const doorRuntime = new MissionDoorRuntime({
    floorplan: plan,
    resolveDefinition: (id) => REGISTRY.get(id),
    queries: {
      // Deliberadamente vacío: si la puerta se abre en este test es POR LA
      // SEÑAL, no porque alguien esté parado al lado del umbral.
      occupiedCells: () => [],
      powered: (door) => isInstancePowered(door.instanceId),
      signalOutput: (door) =>
        doorSignalOutput(door, shipState.get().signalGraph, isInstancePowered, (nodeId) =>
          signalRuntime.outputOf(nodeId),
        ),
    },
  });
  doorRuntimeRef.current = doorRuntime;
  doorRuntime.syncInstalledDoors(doorInstances);

  /** Un tick del core loop, en el MISMO orden que `MissionRuntime`: señales y después puertas. */
  const tick = (dtSeconds: number, elapsedSeconds: number): void => {
    const ctx: TickContext = { dtSeconds, elapsedSeconds };
    signalRuntime.tick(ctx);
    doorRuntime.tick(ctx);
  };

  const run = (seconds: number, from = 0): number => {
    let elapsed = from;
    for (let step = 0; step < Math.round(seconds / 0.5); step += 1) {
      elapsed += 0.5;
      tick(0.5, elapsed);
    }
    return elapsed;
  };

  const doorReceptor = shipState
    .get()
    .signalGraph.nodes.find((node) => node.ownerRef === DOOR_INSTANCE && node.role === "receptor")!;

  return {
    doorRuntime,
    run,
    moveActorsTo: (positions: GridPosition[]) => {
      actors = positions;
    },
    /** Salida de señal de la puerta (14a-4 ronda 1): lo que emite hacia la cadena. */
    doorOutputNode: actuatorOutputNodeId(doorReceptor.id),
    outputOf: (nodeId: SignalNodeId) => signalRuntime.outputOf(nodeId),
  };
}

describe("cadena fotorreceptor → puerta (13h, ronda 2 de playtest)", () => {
  it("el sensor abre la puerta al detectar un actor y la cierra al perderlo", () => {
    const { doorRuntime, run, moveActorsTo } = mountChain();
    expect(doorRuntime.doorById(DOOR)?.state).toBe("closed");

    moveActorsTo([{ x: 0, y: 0 }]);
    const elapsed = run(4);
    const open = doorRuntime.doorById(DOOR);
    expect(open?.state).toBe("open");
    // Gobernada por la señal, no por proximidad: `occupiedCells` está vacío.
    expect(open?.mode).toBe("override");
    expect(open?.overrideSource).toBe("signal");

    moveActorsTo([]);
    run(4, elapsed);
    expect(doorRuntime.doorById(DOOR)?.state).toBe("closed");
  });

  it("sin cable tendido la puerta NO queda gobernada por el sensor", () => {
    // Si `undefined` (sin cable) se colapsara a `false`, instalar una puerta la
    // dejaría cerrada en override para siempre — y bloqueando el pathfinding.
    const { doorRuntime, run, moveActorsTo } = mountChain({ wired: false });
    moveActorsTo([{ x: 0, y: 0 }]);
    run(4);
    expect(doorRuntime.doorById(DOOR)?.mode).toBe("auto");
  });

  it("una puerta SIN MOTOR se congela: no oye el cable, que no es lo mismo que obedecer un cierre", () => {
    // El corte que rompía el reporte #3 del playtest. `outputOf` fuerza a
    // `false` la salida de un nodo cuya instancia no está alimentada, y el
    // dueño del nodo receptor de una puerta ES la puerta: la orden "sin
    // energía" llegaba disfrazada de "cerrá".
    const { doorRuntime, run, moveActorsTo } = mountChain({ poweredDoor: false });
    moveActorsTo([{ x: 0, y: 0 }]);
    run(4);
    const door = doorRuntime.doorById(DOOR);
    expect(door?.overrideSource).toBe("unpowered");
    expect(door?.overrideSource).not.toBe("signal");
  });

  it("devolverle el motor a la puerta la vuelve a poner bajo la señal", () => {
    const { doorRuntime, run, moveActorsTo } = mountChain();
    moveActorsTo([{ x: 0, y: 0 }]);
    run(4);
    expect(doorRuntime.doorById(DOOR)?.state).toBe("open");
  });

  /**
   * Ronda 1 de playtest de 14a-4. El reporte: "cableo la puerta de la bodega al
   * fotorreceptor, mi tripulante queda encerrado, traigo a otro para activar el
   * sensor, la puerta se abre — y el de adentro sigue sin poder salir".
   *
   * El bug vivía en el CRUCE de dos sistemas que estaban bien por separado: la
   * puerta se abría de verdad (esta misma cadena, ya cubierta) y el pathfinding
   * la seguía viendo como pared porque `blocksPathing` miraba `mode` y no
   * `state`. Por eso el caso va acá, sobre la cadena real, y no solo como
   * unitario del predicado.
   */
  it("una puerta ABIERTA por señal deja de ser obstáculo para el pathfinding", () => {
    const { doorRuntime, run, moveActorsTo } = mountChain();

    // Cerrada por señal (nadie a la vista): es un obstáculo real y el aviso de
    // "sin ruta" es información honesta.
    moveActorsTo([]);
    const elapsed = run(4);
    const cerrada = doorRuntime.doorById(DOOR)!;
    expect(cerrada.state).toBe("closed");
    expect(blocksPathing(cerrada)).toBe(true);
    expect(doorRuntime.blocksPathingAt(THRESHOLD)).toBe(true);

    // Llega el segundo tripulante y el sensor abre la puerta: el umbral tiene
    // que volverse transitable en el acto, o el de adentro queda encerrado por
    // una puerta que está abierta delante suyo.
    moveActorsTo([{ x: 0, y: 0 }]);
    run(4, elapsed);
    const abierta = doorRuntime.doorById(DOOR)!;
    expect(abierta.state).toBe("open");
    expect(abierta.mode).toBe("override");
    expect(blocksPathing(abierta)).toBe(false);
    expect(doorRuntime.blocksPathingAt(THRESHOLD)).toBe(false);
  });

  /**
   * Ronda 1 de playtest de 14a-4 — pedido del operador: "las puertas deberían
   * poder emitir señal también; cada vez que un ACT se activa debería emitir".
   *
   * Lo que este test ancla no es que emita, sino QUÉ emite: el estado real, no
   * la orden. La cadena corre sobre la puerta sembrada de siempre, con
   * `actuatorEmitterInputs` en la cebolla, igual que producción.
   */
  it("la puerta emite cuando está REALMENTE abierta, no cuando se lo ordenan", () => {
    const { doorRuntime, run, moveActorsTo, outputOf, doorOutputNode } = mountChain();

    // Cerrada: no emite.
    moveActorsTo([]);
    const elapsed = run(4);
    expect(doorRuntime.doorById(DOOR)?.state).toBe("closed");
    expect(outputOf(doorOutputNode)).toBe(false);

    // Abierta de verdad: emite, y eso es lo que puede gobernar a la siguiente
    // pieza de la cadena.
    moveActorsTo([{ x: 0, y: 0 }]);
    run(4, elapsed);
    expect(doorRuntime.doorById(DOOR)?.state).toBe("open");
    expect(outputOf(doorOutputNode)).toBe(true);
  });

  it("una puerta SIN MOTOR no emite, aunque la señal le esté ordenando abrirse", () => {
    // El caso que separa "estado real" de "orden": el sensor ve al actor y el
    // cable lleva la orden, pero la hoja no se mueve. Si la salida repitiera la
    // orden, encadenar dispararía con la puerta cerrada delante.
    const { doorRuntime, run, moveActorsTo, outputOf, doorOutputNode } = mountChain({
      poweredDoor: false,
    });
    moveActorsTo([{ x: 0, y: 0 }]);
    run(4);
    expect(doorRuntime.doorById(DOOR)?.state).not.toBe("open");
    expect(outputOf(doorOutputNode)).toBe(false);
  });

  it("la puerta reacciona en el MISMO tick, sin arrastrar la señal del anterior", () => {
    // El orden de tickables importa: señales antes que puertas. Al revés, la
    // puerta leía siempre la salida del tick previo y eso se sumaba al
    // hop-por-tick del evaluador — dos ticks de retraso perceptibles.
    const { doorRuntime, run, moveActorsTo } = mountChain();
    moveActorsTo([{ x: 0, y: 0 }]);
    run(1);
    expect(doorRuntime.doorById(DOOR)?.state).toBe("opening");
  });
});
