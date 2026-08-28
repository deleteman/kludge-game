// GDD 9, caso 9 — "El Electroimán de Emergencia": MAG (GDD 5.2) + composición pura desde piezas atómicas, sin depender de un actuador pre-etiquetado como "cierre de puerta"; y (13h) el campo TRABA una puerta real y el intruso no pasa.
import { describe, expect, it } from "vitest";
import {
  activeCoilFieldIntensity,
  buildComponentCatalog,
  intensityAtDistance,
  instantiateDoorSeeds,
  MissionDoorRuntime,
  MutableCrewState,
  MutableEnemyState,
  EnemyThreatRuntime,
  type ComponentId,
  type DoorId,
  type DoorSeedId,
  type EnemyActor,
  type EnemyActorId,
  type ScriptedRoute,
  type ShipFloorplan,
} from "../index.js";
import type { SectionId } from "../atmosphere/section.types.js";

const CABLE_COBRE = "cable-cobre" as ComponentId;
const IMAN_PERMANENTE = "iman-permanente" as ComponentId;
const BATERIA = "bateria-celda-simple" as ComponentId;

const ARMERIA = "armeria" as SectionId;
const PASILLO = "pasillo" as SectionId;
/** Umbral entre las dos secciones: la puerta que el electroimán tiene que trabar. */
const THRESHOLD = { x: 1, y: 0 };
const DOOR = "instance:puerta-armeria-pasillo" as DoorId;
const INTRUSO = "intruso" as EnemyActorId;

function floorplan(): ShipFloorplan {
  return {
    id: "nave-caso-09",
    archetype: "guerra",
    nameKey: "ship.test",
    gridSize: { width: 4, height: 1 },
    sections: [
      { id: ARMERIA, nameKey: "section.armeria", cells: [{ x: 0, y: 0 }, THRESHOLD] },
      { id: PASILLO, nameKey: "section.pasillo", cells: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
    ],
    conduits: [],
    anchors: [],
    componentSeeds: [],
    doors: [
      { id: "armeria-pasillo" as DoorSeedId, a: ARMERIA, b: PASILLO, position: THRESHOLD, span: 1, axis: "x", initialOpen: false },
    ],
  };
}

function intruder(): EnemyActor {
  return {
    id: INTRUSO,
    archetype: "armored",
    hp: 100,
    maxHp: 100,
    sectionId: PASILLO,
    cell: { x: 2, y: 0 },
    // Arma real del catálogo: es lo que le da `ACT` para golpear la puerta.
    weaponComponentId: "garra-de-abordaje" as ComponentId,
    status: "advancing",
  };
}

/** Ruta que cruza el umbral: sin puerta que lo frene, el intruso entra a la armería. */
function route(): ScriptedRoute {
  return {
    enemyId: INTRUSO,
    waypoints: [
      { cell: { x: 2, y: 0 }, sectionId: PASILLO, arrivalSeconds: 0 },
      { cell: THRESHOLD, sectionId: ARMERIA, arrivalSeconds: 2 },
      { cell: { x: 0, y: 0 }, sectionId: ARMERIA, arrivalSeconds: 4 },
    ],
    onComplete: "hold",
  };
}

describe("case 9 — El Electroimán de Emergencia", () => {
  it("assembles MAG from raw atomic pieces (copper wire + iron core + current), with no pre-tagged door-closer actuator", () => {
    const { registry } = buildComponentCatalog();

    // Recuperar componentes reales del catálogo Fase 4.
    const cobre = registry.get(CABLE_COBRE)!;
    const iman = registry.get(IMAN_PERMANENTE)!;
    const bateria = registry.get(BATERIA)!;

    // El resultado emerge de combinar conductor enrollado + núcleo ferromagnético + corriente (GDD 5.2).
    // Verificar propiedades del imán permanente catálogo.
    expect(iman.level).toBe("atomic");
    expect(iman.data.material?.MAG).toBe(true);

    // Verificar que el cable tiene conducción eléctrica.
    expect(cobre.level).toBe("atomic");
    expect(cobre.data.material?.CE).toBe("A");

    // Verificar que la batería es un reservorio.
    expect(bateria.level).toBe("atomic");
    const batRes = bateria.data.functional?.find((f) => f.tag === "RES");
    expect(batRes?.resourceType).toBe("E");
  });

  // Subfase 13h: hasta acá el caso 9 terminaba en el párrafo anterior —
  // comprobaba que se PODÍA ensamblar el `MAG` y nada más, porque no existía
  // ninguna puerta que trabar. Esta es la mitad que faltaba.
  it("the assembled electromagnet jams a real door and the intruder cannot get through", () => {
    // Bobina improvisada del jugador: 5 vueltas de cable con corriente alta.
    // El campo se compone con las funciones puras de `kinetics/`, igual que lo
    // hace la regla de gobierno — no hay un "modo trabar puerta" aparte.
    const coilCell = { x: 0, y: 0 };
    const baseIntensity = activeCoilFieldIntensity(5, "A");
    const fieldAt = (cell: { x: number; y: number }) =>
      intensityAtDistance(
        baseIntensity,
        Math.abs(cell.x - coilCell.x) + Math.abs(cell.y - coilCell.y),
      );

    const { registry } = buildComponentCatalog();
    const plan = floorplan();
    const doors = new MissionDoorRuntime({
      floorplan: plan,
      // El intruso está justo al lado del umbral: en `auto` puro la puerta se
      // le abriría sola, que es exactamente el problema que el electroimán
      // resuelve.
      queries: { occupiedCells: () => [{ x: 2, y: 0 }], magneticFieldAt: fieldAt },
      resolveDefinition: (id) => registry.get(id),
    });
    doors.syncInstalledDoors(instantiateDoorSeeds(plan.doors, registry).components);

    const enemies = new MutableEnemyState([intruder()]);
    const threat = new EnemyThreatRuntime({
      enemies,
      routes: new Map([[INTRUSO, route()]]),
      crew: new MutableCrewState([]),
      componentRegistry: registry,
      doorBlocking: (cell) => (doors.blocksCell(cell) ? DOOR : undefined),
      damageDoor: (doorId, amount, elapsedSeconds) => doors.applyDamage(doorId, amount, elapsedSeconds),
    });

    let elapsed = 0;
    for (let step = 0; step < 12; step += 1) {
      elapsed += 0.5;
      doors.tick({ dtSeconds: 0.5, elapsedSeconds: elapsed });
      threat.tick({ dtSeconds: 0.5, elapsedSeconds: elapsed });
    }

    // El campo la mantiene trabada pese a que hay alguien pegado a ella.
    expect(doors.doorById(DOOR)?.state).toBe("jammed");
    expect(doors.doorById(DOOR)?.overrideSource).toBe("magnetic-lock");
    // Y el intruso sigue del otro lado: no llegó a la armería.
    expect(enemies.get(INTRUSO)?.sectionId).toBe(PASILLO);
    expect(enemies.get(INTRUSO)?.cell).toEqual({ x: 2, y: 0 });
  });

  it("jamming the door buys time, not immunity: the intruder breaks it down and resumes its route", () => {
    // Misma escena SIN electroimán y con la puerta simplemente cerrada: el
    // intruso la golpea hasta romperla. Es lo que evita que una puerta trabada
    // deje el nivel muerto con un enemigo atascado para siempre.
    const { registry } = buildComponentCatalog();
    const plan = floorplan();
    const doors = new MissionDoorRuntime({
      floorplan: plan,
      resolveDefinition: (id) => registry.get(id),
    });
    doors.syncInstalledDoors(instantiateDoorSeeds(plan.doors, registry).components);
    const enemies = new MutableEnemyState([intruder()]);
    const threat = new EnemyThreatRuntime({
      enemies,
      routes: new Map([[INTRUSO, route()]]),
      crew: new MutableCrewState([]),
      componentRegistry: registry,
      doorBlocking: (cell) => (doors.blocksCell(cell) ? DOOR : undefined),
      damageDoor: (doorId, amount, elapsedSeconds) => doors.applyDamage(doorId, amount, elapsedSeconds),
    });

    let elapsed = 0;
    for (let step = 0; step < 200; step += 1) {
      elapsed += 0.5;
      doors.tick({ dtSeconds: 0.5, elapsedSeconds: elapsed });
      threat.tick({ dtSeconds: 0.5, elapsedSeconds: elapsed });
    }

    expect(doors.doorById(DOOR)?.state).toBe("destroyed");
    expect(enemies.get(INTRUSO)?.sectionId).toBe(ARMERIA);
  });
});
