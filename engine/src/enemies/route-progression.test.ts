import { describe, expect, it } from "vitest";
import { cellAtElapsedSeconds } from "./route-progression.js";
import type { ScriptedRoute } from "./enemy-route.types.js";
import type { EnemyActorId } from "./enemy-actor.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

const sectionA = "seccion-a" as SectionId;
const sectionB = "seccion-b" as SectionId;

const route: ScriptedRoute = {
  enemyId: "enemigo-1" as EnemyActorId,
  onComplete: "hold",
  waypoints: [
    { cell: { x: 0, y: 0 }, sectionId: sectionA, arrivalSeconds: 0 },
    { cell: { x: 2, y: 0 }, sectionId: sectionA, arrivalSeconds: 5 },
    { cell: { x: 2, y: 3 }, sectionId: sectionB, arrivalSeconds: 12 },
  ],
};

describe("route-progression: cellAtElapsedSeconds (Fase 11d, ruta scripteada determinista)", () => {
  it("antes del primer waypoint, se considera ya en la celda de spawn (waypoint 0)", () => {
    expect(cellAtElapsedSeconds(route, -1)).toMatchObject({
      cell: { x: 0, y: 0 },
      waypointIndex: 0,
      completed: false,
    });
  });

  it("snap discreto: entre dos waypoints se queda en el ANTERIOR, sin interpolar", () => {
    expect(cellAtElapsedSeconds(route, 8)).toMatchObject({
      cell: { x: 2, y: 0 },
      sectionId: sectionA,
      waypointIndex: 1,
      completed: false,
    });
  });

  it("exactamente en el tiempo de arribo, salta a ese waypoint", () => {
    expect(cellAtElapsedSeconds(route, 5)).toMatchObject({ waypointIndex: 1 });
    expect(cellAtElapsedSeconds(route, 12)).toMatchObject({ waypointIndex: 2 });
  });

  it("al alcanzar o superar el último waypoint, marca completed = true y no avanza más allá", () => {
    expect(cellAtElapsedSeconds(route, 12)).toMatchObject({
      cell: { x: 2, y: 3 },
      sectionId: sectionB,
      completed: true,
    });
    expect(cellAtElapsedSeconds(route, 999)).toMatchObject({
      cell: { x: 2, y: 3 },
      completed: true,
    });
  });

  it("es determinista: misma entrada produce siempre la misma salida", () => {
    expect(cellAtElapsedSeconds(route, 8)).toEqual(cellAtElapsedSeconds(route, 8));
  });

  it("lanza si la ruta no tiene waypoints (dato de contenido inválido, no un estado alcanzable en juego)", () => {
    const empty: ScriptedRoute = { enemyId: "e" as EnemyActorId, onComplete: "hold", waypoints: [] };
    expect(() => cellAtElapsedSeconds(empty, 0)).toThrow();
  });
});
