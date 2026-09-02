import { describe, expect, it } from "vitest";
import type { BlockingReason, CrewTaskId, TaskState } from "engine";

import { buildQueueRows, type QueueRowInput, type QueueRowSource } from "./queue-rows.js";

/**
 * Ronda 4a de playtest de 14a-4. El anidado es lo que hace visible que cancelar
 * un movimiento bloquea la acción que lo seguía — un orden equivocado dibujaría
 * un árbol que miente sobre qué espera a qué, y eso ningún smoke test visual lo
 * atrapa.
 */

const id = (value: string): CrewTaskId => value as CrewTaskId;

function entry(
  taskId: string,
  options: {
    readonly dependsOn?: ReadonlyArray<string>;
    readonly state?: TaskState;
    readonly actorIndex?: number;
  } = {},
): QueueRowInput<QueueRowSource> {
  return {
    task: {
      id: id(taskId),
      dependsOn: (options.dependsOn ?? []).map(id),
      state: options.state ?? "pending",
    },
    row: {
      taskId: id(taskId),
      actorIndex: options.actorIndex ?? 0,
      actorName: "Ana",
      label: taskId,
      state: options.state ?? "pending",
      estimatedDurationSeconds: 5,
      elapsedSeconds: 0,
      selected: false,
    },
  };
}

const noReasons = (): BlockingReason | undefined => undefined;
const idsOf = (rows: ReadonlyArray<{ readonly taskId: CrewTaskId }>): string[] =>
  rows.map((row) => row.taskId as string);

describe("buildQueueRows", () => {
  it("pone al dependiente inmediatamente debajo de su dependencia, con depth 1", () => {
    const rows = buildQueueRows([entry("mover"), entry("instalar", { dependsOn: ["mover"] })], noReasons);
    expect(idsOf(rows)).toEqual(["mover", "instalar"]);
    expect(rows.map((row) => row.depth)).toEqual([0, 1]);
  });

  it("lo anida aunque el llamador lo pase antes que su dependencia", () => {
    // El orden de entrada es el de encolado por actor, pero la cola unificada
    // mezcla varios tripulantes: no se puede asumir que el padre venga primero.
    const rows = buildQueueRows([entry("instalar", { dependsOn: ["mover"] }), entry("mover")], noReasons);
    expect(idsOf(rows)).toEqual(["mover", "instalar"]);
  });

  it("sin dependencias respeta el orden de encolado, todo a depth 0", () => {
    const rows = buildQueueRows([entry("a"), entry("b"), entry("c")], noReasons);
    expect(idsOf(rows)).toEqual(["a", "b", "c"]);
    expect(rows.every((row) => row.depth === 0)).toBe(true);
  });

  it("una dependencia que ya no está en la lista deja al dependiente como RAÍZ", () => {
    // Caso real y frecuente: el `go-to` se completó y la cola lo filtró. Sangrar
    // la acción bajo nada la dejaría flotando sin conector.
    const rows = buildQueueRows([entry("instalar", { dependsOn: ["mover-ya-hecho"] })], noReasons);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.depth).toBe(0);
  });

  it("varios dependientes del mismo padre salen todos debajo, en orden", () => {
    const rows = buildQueueRows(
      [entry("mover"), entry("instalar", { dependsOn: ["mover"] }), entry("cablear", { dependsOn: ["mover"] })],
      noReasons,
    );
    expect(idsOf(rows)).toEqual(["mover", "instalar", "cablear"]);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 1]);
  });

  it("dos tripulantes no se entrelazan: cada árbol sale entero", () => {
    const rows = buildQueueRows(
      [
        entry("ana-mover", { actorIndex: 0 }),
        entry("leo-mover", { actorIndex: 1 }),
        entry("ana-instalar", { dependsOn: ["ana-mover"], actorIndex: 0 }),
        entry("leo-instalar", { dependsOn: ["leo-mover"], actorIndex: 1 }),
      ],
      noReasons,
    );
    expect(idsOf(rows)).toEqual(["ana-mover", "ana-instalar", "leo-mover", "leo-instalar"]);
  });

  it("adjunta el motivo SOLO a las bloqueadas", () => {
    const rows = buildQueueRows(
      [entry("mover"), entry("instalar", { dependsOn: ["mover"], state: "blocked" })],
      () => "dependency-cancelled",
    );
    expect(rows[0]?.blockReason).toBeUndefined();
    expect(rows[1]?.blockReason).toBe("dependency-cancelled");
  });

  it("una bloqueada sin motivo conocido no inventa uno", () => {
    const rows = buildQueueRows([entry("x", { state: "blocked" })], noReasons);
    expect(rows[0]?.blockReason).toBeUndefined();
  });

  it("una cadena de tres niveles se sangra progresivamente", () => {
    const rows = buildQueueRows(
      [entry("a"), entry("b", { dependsOn: ["a"] }), entry("c", { dependsOn: ["b"] })],
      noReasons,
    );
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2]);
  });

  it("no dibuja dos veces una tarea alcanzable por dos caminos", () => {
    // `linkDependency` ya rechaza ciclos, pero esta función no tiene por qué
    // confiar en eso para no colgarse ni duplicar filas.
    const rows = buildQueueRows(
      [entry("a"), entry("b", { dependsOn: ["a"] }), entry("c", { dependsOn: ["a", "b"] })],
      noReasons,
    );
    expect(idsOf(rows)).toHaveLength(3);
    expect(new Set(idsOf(rows)).size).toBe(3);
  });

  it("una tarea cancelada NO se dibuja", () => {
    // El reporte de la ronda 4b: el operador borró una tarea y la fila se quedó
    // ahí con la barra en cero, así que concluyó que cancelar no hacía nada.
    const rows = buildQueueRows(
      [entry("mover", { state: "cancelled" }), entry("otra")],
      noReasons,
    );
    expect(idsOf(rows)).toEqual(["otra"]);
  });

  it("tampoco se dibujan las completadas ni las fallidas", () => {
    const rows = buildQueueRows(
      [entry("a", { state: "completed" }), entry("b", { state: "failed" }), entry("c")],
      noReasons,
    );
    expect(idsOf(rows)).toEqual(["c"]);
  });

  it("cancelado el padre, el dependiente bloqueado pasa a RAÍZ con su motivo", () => {
    // Es la fila que le queda al jugador para entender por qué no va a pasar
    // nada; sangrada bajo una fila que ya no se dibuja, no se entendería.
    const rows = buildQueueRows(
      [entry("mover", { state: "cancelled" }), entry("instalar", { dependsOn: ["mover"], state: "blocked" })],
      () => "dependency-cancelled",
    );
    expect(idsOf(rows)).toEqual(["instalar"]);
    expect(rows[0]?.depth).toBe(0);
    expect(rows[0]?.blockReason).toBe("dependency-cancelled");
  });

  it("una lista vacía no revienta", () => {
    expect(buildQueueRows([], noReasons)).toEqual([]);
  });
});
