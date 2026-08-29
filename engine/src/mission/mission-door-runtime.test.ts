import { describe, expect, it } from "vitest";
import {
  MissionDoorRuntime,
  buildComponentCatalog,
  instantiateDoorSeeds,
  ValveRuntime,
  composeApertureSources,
  doorAperture,
  DOOR_PARAMETERS,
  type DoorDomainEvent,
  type DoorId,
  type DoorSeedId,
  type MissionDoorRuntimeOptions,
  type ShipFloorplan,
} from "../index.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ConduitId } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";

const PASILLO = "pasillo" as SectionId;
const BODEGA = "bodega" as SectionId;
/** Celda del umbral: pertenece a `pasillo` y toca `bodega`. */
const THRESHOLD = { x: 1, y: 0 };

function floorplan(): ShipFloorplan {
  return {
    id: "nave-test",
    archetype: "exploracion",
    nameKey: "ship.test",
    gridSize: { width: 4, height: 1 },
    sections: [
      { id: PASILLO, nameKey: "section.pasillo", cells: [{ x: 0, y: 0 }, THRESHOLD] },
      { id: BODEGA, nameKey: "section.bodega", cells: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
    ],
    conduits: [
      {
        id: "ventilacion:pasillo:bodega:0" as ConduitId,
        a: PASILLO,
        b: BODEGA,
        kind: "ventilacion",
        position: { x: 1.5, y: 0 },
        initialAperture: 1,
      },
    ],
    anchors: [],
    componentSeeds: [],
    doors: [
      {
        id: "pasillo-bodega" as DoorSeedId,
        a: PASILLO,
        b: BODEGA,
        position: THRESHOLD,
        span: 1,
        axis: "x",
        initialOpen: false,
      },
    ],
  };
}

const REGISTRY = buildComponentCatalog().registry;

/**
 * Puerta del casco como INSTANCIA real (ronda 1 de playtest de 13h): la capa
 * `puertas` materializa `compuerta-blindada`, y el runtime la recoge por el
 * mismo camino que una instalada por el jugador.
 */
function mountDoors(options: Omit<MissionDoorRuntimeOptions, "floorplan" | "resolveDefinition"> = {}) {
  const plan = floorplan();
  const seeded = instantiateDoorSeeds(plan.doors, REGISTRY);
  const runtime = new MissionDoorRuntime({
    ...options,
    floorplan: plan,
    resolveDefinition: (id) => REGISTRY.get(id),
  });
  runtime.syncInstalledDoors(seeded.components);
  return { runtime, plan, seeded };
}

const DOOR = "instance:puerta-pasillo-bodega" as DoorId;

function tick(seconds: number, elapsed: number): TickContext {
  return { dtSeconds: seconds, elapsedSeconds: elapsed };
}

/** Corre `seconds` de simulación en pasos de 0.5 s, como hace el core loop real. */
function run(runtime: MissionDoorRuntime, seconds: number, from = 0): number {
  let elapsed = from;
  for (let step = 0; step < Math.round(seconds / 0.5); step += 1) {
    elapsed += 0.5;
    runtime.tick(tick(0.5, elapsed));
  }
  return elapsed;
}

describe("MissionDoorRuntime (13h)", () => {
  it("siembra las puertas autoradas CERRADAS: la nave arranca compartimentada", () => {
    const { runtime } = mountDoors();
    expect(runtime.doorById(DOOR)?.state).toBe("closed");
    expect(runtime.blocksCell(THRESHOLD)).toBe(true);
  });

  it("se abre al acercarse un actor y se cierra sola cuando se va", () => {
    let occupied: { x: number; y: number }[] = [];
    const { runtime } = mountDoors({ queries: { occupiedCells: () => occupied } });

    occupied = [{ x: 0, y: 0 }];
    const elapsed = run(runtime, 4);
    expect(runtime.doorById(DOOR)?.state).toBe("open");
    expect(runtime.blocksCell(THRESHOLD)).toBe(false);

    occupied = [];
    run(runtime, 4, elapsed);
    expect(runtime.doorById(DOOR)?.state).toBe("closed");
    expect(runtime.blocksCell(THRESHOLD)).toBe(true);
  });

  it("la transición tarda `cadence` y la apertura atmosférica INTERPOLA durante ese tramo", () => {
    const { runtime } = mountDoors({ queries: { occupiedCells: () => [{ x: 0, y: 0 }] } });
    const aperture = runtime.apertureSource();

    // A mitad de la cadencia la hoja va por la mitad: ni sellada ni abierta.
    // Se deriva de `transitionSecondsOf` en vez de escribir el número: la ronda
    // 2 de playtest bajó la cadencia de 3 s a 1.5 s y este test, que la tenía
    // hardcodeada, empezó a medir el ciclo YA TERMINADO en vez de la mitad.
    const cadence = runtime.transitionSecondsOf(DOOR);
    expect(cadence).toBe(1.5);
    run(runtime, cadence / 2);
    const midway = aperture()[0]?.valveAperture ?? 0;
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(1);
    // Y el paso sigue bloqueado hasta que llega a destino: nadie cruza una
    // puerta a medio abrir.
    expect(runtime.blocksCell(THRESHOLD)).toBe(true);

    run(runtime, cadence, cadence / 2);
    expect(aperture()[0]?.valveAperture).toBe(1);
    expect(runtime.blocksCell(THRESHOLD)).toBe(false);
  });

  it("sin energía se CONGELA donde está, no se cierra", () => {
    let powered = true;
    const { runtime } = mountDoors({
      queries: { occupiedCells: () => [{ x: 0, y: 0 }], powered: () => powered },
    });
    const elapsed = run(runtime, 4);
    expect(runtime.doorById(DOOR)?.state).toBe("open");

    powered = false;
    run(runtime, 6, elapsed);
    const door = runtime.doorById(DOOR);
    expect(door?.state).toBe("open");
    expect(door?.overrideSource).toBe("unpowered");
  });

  it("force-door abre a mano una puerta sin motor, y su coste escala con la fuerza del actuador", () => {
    const { runtime } = mountDoors({ queries: { powered: () => false } });
    run(runtime, 2);
    expect(runtime.doorById(DOOR)?.state).toBe("closed");

    runtime.forceOpen(DOOR, 10);
    expect(runtime.doorById(DOOR)?.state).toBe("open");
    expect(runtime.blocksCell(THRESHOLD)).toBe(false);
    // La puerta autorada usa la fuerza de referencia de parámetros.
    expect(runtime.forceDurationSeconds(DOOR)).toBeGreaterThan(DOOR_PARAMETERS.forceBaseSeconds);
  });

  it("el daño la rompe: hueco permanente que ya no compartimenta ni bloquea", () => {
    const events: DoorDomainEvent[] = [];
    const { runtime } = mountDoors({ emitter: (event) => events.push(event) });

    runtime.applyDamage(DOOR, 100, 1);
    expect(events.at(-1)).toMatchObject({ kind: "door-damaged", remainingHp: 200 });

    runtime.applyDamage(DOOR, 500, 2);
    expect(runtime.doorById(DOOR)?.state).toBe("destroyed");
    expect(events.at(-1)?.kind).toBe("door-destroyed");
    expect(runtime.blocksCell(THRESHOLD)).toBe(false);
    expect(runtime.apertureSource()()[0]?.valveAperture).toBe(1);
  });

  it("repair-door devuelve una puerta rota al servicio", () => {
    const { runtime } = mountDoors();
    runtime.applyDamage(DOOR, 1000, 1);
    expect(runtime.doorById(DOOR)?.state).toBe("destroyed");

    runtime.repair(DOOR, 5);
    const door = runtime.doorById(DOOR);
    expect(door?.state).toBe("closed");
    expect(door?.hp).toBe(door?.maxHp);
    expect(runtime.blocksCell(THRESHOLD)).toBe(true);
  });

  it("aplasta al tripulante que quede en el umbral al cerrarse", () => {
    const events: DoorDomainEvent[] = [];
    let occupied = [{ x: 0, y: 0 }];
    const { runtime } = mountDoors({
      queries: {
        occupiedCells: () => occupied,
        crewAt: (cell) => (cell.x === THRESHOLD.x ? ("victima" as CrewActorId) : undefined),
      },
      emitter: (event) => events.push(event),
    });

    const elapsed = run(runtime, 4);
    occupied = [];
    run(runtime, 1, elapsed);

    expect(events.some((event) => event.kind === "door-crushed-actor")).toBe(true);
  });

  it("una puerta cerrada NO aporta difusión, pero el conducto sigue abierto (la puerta no cierra el ducto)", () => {
    const { runtime, plan } = mountDoors();
    const valves = new ValveRuntime(plan);
    const combined = composeApertureSources(
      () => valves.effectiveConnections(),
      runtime.apertureSource(),
    );

    const connections = combined();
    expect(connections).toHaveLength(2);
    // La puerta sella su arista...
    expect(connections.find((c) => c.valveAperture === 0)).toBeDefined();
    // ...pero el ducto de ventilación sigue trasegando aire. Contener una fuga
    // del todo exige cerrar TAMBIÉN la válvula.
    expect(connections.find((c) => c.valveAperture === 1)).toBeDefined();

    valves.setAperture("ventilacion:pasillo:bodega:0" as ConduitId, 0);
    expect(combined().every((c) => c.valveAperture === 0)).toBe(true);
  });

  it("persiste y restaura el estado de la puerta", () => {
    const { runtime } = mountDoors();
    runtime.applyDamage(DOOR, 120, 1);
    const snapshots = runtime.toSnapshots();

    const { runtime: reloaded } = mountDoors({ snapshots });
    expect(reloaded.doorById(DOOR)?.hp).toBe(180);
  });
});

describe("doorAperture", () => {
  it("un hueco permanente difunde como una puerta abierta", () => {
    const door = {
      id: DOOR,
      instanceId: "puerta-x" as PlacedComponentInstanceId,
      a: PASILLO,
      b: BODEGA,
      cells: [THRESHOLD],
      mode: "override" as const,
      state: "destroyed" as const,
      transitionElapsedSeconds: 0,
      hp: 0,
      maxHp: 300,
    };
    expect(doorAperture(door, 3)).toBe(1);
  });
});
