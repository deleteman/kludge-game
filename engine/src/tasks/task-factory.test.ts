import { describe, expect, it } from "vitest";
import { createCrewTask } from "./task-factory.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewTaskId, DismantleTaskPayload } from "./task.types.js";
import { TASK_BASE_DURATION_SECONDS } from "./task-parameters.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";

const ACTOR_A = "actor-a" as CrewActorId;

describe("createCrewTask", () => {
  it("defaults estimatedDurationSeconds to the base duration for the task type", () => {
    const task = createCrewTask({ id: "t1" as CrewTaskId, actorId: ACTOR_A, type: "dismantle" });
    expect(task.estimatedDurationSeconds).toBe(TASK_BASE_DURATION_SECONDS.dismantle);
    expect(task.state).toBe("pending");
    expect(task.elapsedSeconds).toBe(0);
    expect(task.dependsOn).toEqual([]);
  });

  it("honors an explicit estimatedDurationSeconds override", () => {
    const task = createCrewTask({
      id: "t1" as CrewTaskId,
      actorId: ACTOR_A,
      type: "dismantle",
      estimatedDurationSeconds: 3,
    });
    expect(task.estimatedDurationSeconds).toBe(3);
  });

  it("rejects a non-positive duration (GDD §4.2: no instantánea)", () => {
    expect(() =>
      createCrewTask({
        id: "t1" as CrewTaskId,
        actorId: ACTOR_A,
        type: "go-to",
        estimatedDurationSeconds: 0,
      }),
    ).toThrow();
  });

  it("carries the payload through untouched (Fase 10b)", () => {
    const payload: DismantleTaskPayload = {
      kind: "dismantle",
      instanceId: "instance-1" as PlacedComponentInstanceId,
    };
    const task = createCrewTask({ id: "t1" as CrewTaskId, actorId: ACTOR_A, type: "dismantle", payload });
    expect(task.payload).toBe(payload);
  });

  it("leaves payload undefined when omitted", () => {
    const task = createCrewTask({ id: "t1" as CrewTaskId, actorId: ACTOR_A, type: "go-to" });
    expect(task.payload).toBeUndefined();
  });
});
