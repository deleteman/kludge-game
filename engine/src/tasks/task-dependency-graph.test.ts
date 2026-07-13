import { describe, expect, it } from "vitest";
import { validateTaskDependencies } from "./task-dependency-graph.js";
import { createCrewTask } from "./task-factory.js";
import type { CrewTask, CrewTaskId } from "./task.types.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";

const ENGINEER = "engineer" as CrewActorId;
const MEDIC = "medic" as CrewActorId;
const id = (raw: string): CrewTaskId => raw as CrewTaskId;

function indexOf(...tasks: CrewTask[]): Map<CrewTaskId, CrewTask> {
  return new Map(tasks.map((t) => [t.id, t]));
}

describe("task-dependency-graph: validateTaskDependencies", () => {
  it("accepts a cross-actor dependency on an existing task", () => {
    const dismantle = createCrewTask({ id: id("t1"), actorId: ENGINEER, type: "dismantle" });
    const combine = createCrewTask({
      id: id("t2"),
      actorId: MEDIC,
      type: "combine",
      dependsOn: [id("t1")],
    });
    expect(validateTaskDependencies(combine, indexOf(dismantle))).toEqual([]);
  });

  it("rejects a dependency on a task that does not exist", () => {
    const combine = createCrewTask({
      id: id("t2"),
      actorId: MEDIC,
      type: "combine",
      dependsOn: [id("ghost")],
    });
    const issues = validateTaskDependencies(combine, indexOf());
    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe("missing-dependency");
  });

  it("rejects a self-dependency", () => {
    const t = createCrewTask({
      id: id("t1"),
      actorId: ENGINEER,
      type: "dismantle",
      dependsOn: [id("t1")],
    });
    const issues = validateTaskDependencies(t, indexOf());
    expect(issues.map((i) => i.kind)).toContain("self-dependency");
  });

  it("rejects a cycle A->B->A introduced by the candidate", () => {
    // b already depends on a; adding a-that-depends-on-b closes the cycle.
    const b = createCrewTask({
      id: id("b"),
      actorId: MEDIC,
      type: "combine",
      dependsOn: [id("a")],
    });
    const a = createCrewTask({
      id: id("a"),
      actorId: ENGINEER,
      type: "dismantle",
      dependsOn: [id("b")],
    });
    const issues = validateTaskDependencies(a, indexOf(b));
    expect(issues.map((i) => i.kind)).toContain("circular-dependency");
  });
});
