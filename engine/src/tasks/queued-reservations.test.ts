import { describe, expect, it } from "vitest";

import { reservedCellKey, reservedCells, reservedStock } from "./queued-reservations.js";
import { createCrewTask } from "./task-factory.js";
import type { CrewTask, CrewTaskId, TaskState } from "./task.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentWear } from "../wear/wear.types.js";
import { stockCostKey, type StockCostLine } from "../inventory/component-stock-cost.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";

const ACTOR = "engineer" as CrewActorId;
const SENSOR = "fotorreceptor" as ComponentId;
const CABLE = "cable-cobre" as ComponentId;

/** Coste de juguete: toda pieza cuesta 1 unidad de sí misma en el bucket pedido. */
const oneEach = (componentId: ComponentId, wear: ComponentWear): ReadonlyArray<StockCostLine> => [
  { ref: componentId, wear, quantity: 1 },
];

function installTask(
  rawId: string,
  position: { x: number; y: number },
  options: {
    readonly state?: TaskState;
    readonly footprint?: { width: number; height: number };
    readonly wear?: ComponentWear;
  } = {},
): CrewTask {
  const task = createCrewTask({
    id: rawId as CrewTaskId,
    actorId: ACTOR,
    type: "install",
    payload: {
      kind: "install",
      instanceId: `i-${rawId}` as PlacedComponentInstanceId,
      componentDefinitionId: SENSOR,
      placement: { position, footprint: options.footprint ?? { width: 1, height: 1 }, rotation: 0 },
      ...(options.wear ? { wear: options.wear } : {}),
    },
  });
  if (options.state) task.state = options.state;
  return task;
}

function connectTask(rawId: string, conductorId?: ComponentId, state?: TaskState): CrewTask {
  const task = createCrewTask({
    id: rawId as CrewTaskId,
    actorId: ACTOR,
    type: "connect",
    payload: {
      kind: "connect",
      edgeId: `e-${rawId}` as SignalEdgeId,
      fromNodeId: "n1" as SignalNodeId,
      toNodeId: "n2" as SignalNodeId,
      ...(conductorId ? { conductorId } : {}),
    },
  });
  if (state) task.state = state;
  return task;
}

describe("queued-reservations: reservedCells", () => {
  it("reserves every cell of a multi-cell footprint, not just its anchor", () => {
    const cells = reservedCells([installTask("t1", { x: 3, y: 4 }, { footprint: { width: 2, height: 2 } })]);
    expect([...cells.keys()].sort()).toEqual(["3,4", "3,5", "4,4", "4,5"]);
    expect(cells.get(reservedCellKey({ x: 4, y: 5 }))).toBe("t1" as CrewTaskId);
  });

  it("reserves for a blocked task: it is still alive and can be unblocked", () => {
    const cells = reservedCells([installTask("t1", { x: 1, y: 1 }, { state: "blocked" })]);
    expect(cells.has("1,1")).toBe(true);
  });

  it("reserves for an in-progress task: the effect has not run, the piece is still in the ledger", () => {
    const cells = reservedCells([installTask("t1", { x: 1, y: 1 }, { state: "in-progress" })]);
    expect(cells.has("1,1")).toBe(true);
  });

  it.each<TaskState>(["completed", "cancelled", "failed"])(
    "releases the cell once the task reaches the terminal state '%s'",
    (state) => {
      expect(reservedCells([installTask("t1", { x: 1, y: 1 }, { state })]).size).toBe(0);
    },
  );

  it("ignores tasks that do not occupy floor space (connect has no cells)", () => {
    expect(reservedCells([connectTask("t1", CABLE)]).size).toBe(0);
  });

  it("keeps the FIRST task that claimed a cell when two overlap", () => {
    const cells = reservedCells([installTask("t1", { x: 2, y: 2 }), installTask("t2", { x: 2, y: 2 })]);
    expect(cells.get("2,2")).toBe("t1" as CrewTaskId);
  });
});

describe("queued-reservations: reservedStock", () => {
  it("adds up units per wear bucket across the whole queue", () => {
    const reserved = reservedStock(
      [
        installTask("t1", { x: 1, y: 1 }),
        installTask("t2", { x: 2, y: 2 }),
        installTask("t3", { x: 3, y: 3 }, { wear: "usado" }),
      ],
      oneEach,
    );
    expect(reserved.get(stockCostKey(SENSOR, "nuevo"))).toBe(2);
    // Buckets separados: reservar el usado no toca el disponible de los nuevos.
    expect(reserved.get(stockCostKey(SENSOR, "usado"))).toBe(1);
  });

  it("reserves the conductor of a queued wire — the same double-enqueue crash reaches connect", () => {
    const reserved = reservedStock([connectTask("t1", CABLE), connectTask("t2", CABLE)], oneEach);
    expect(reserved.get(stockCostKey(CABLE, "nuevo"))).toBe(2);
  });

  it("reserves nothing for a connect without conductor (old callers/tests do not charge stock either)", () => {
    expect(reservedStock([connectTask("t1")], oneEach).size).toBe(0);
  });

  it.each<TaskState>(["completed", "cancelled", "failed"])(
    "releases the stock once the task reaches the terminal state '%s'",
    (state) => {
      expect(reservedStock([installTask("t1", { x: 1, y: 1 }, { state })], oneEach).size).toBe(0);
    },
  );

  it("keeps reserving for a blocked connect: cancelling is the only way out, never a silent expiry", () => {
    const reserved = reservedStock([connectTask("t1", CABLE, "blocked")], oneEach);
    expect(reserved.get(stockCostKey(CABLE, "nuevo"))).toBe(1);
  });
});
