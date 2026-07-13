import { describe, expect, it, vi } from "vitest";
import { CoreLoopModeMachine, type Tickable } from "./core-loop-mode.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { CoreLoopDomainEvent } from "./task-events.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

function recordingTickable(): Tickable & { calls: TickContext[] } {
  const calls: TickContext[] = [];
  return {
    calls,
    tick(ctx) {
      calls.push(ctx);
    },
  };
}

describe("core-loop-mode: CoreLoopModeMachine", () => {
  it("starts in planning and does not advance tickables (clock frozen, GDD §4.2)", () => {
    const machine = new CoreLoopModeMachine();
    const t = recordingTickable();
    machine.registerTickable(t);

    machine.tick(1);
    machine.tick(1);

    expect(machine.mode).toBe("planning");
    expect(machine.elapsed).toBe(0);
    expect(t.calls).toHaveLength(0);
  });

  it("advances tickables in execution, accumulating elapsedSeconds", () => {
    const machine = new CoreLoopModeMachine();
    const t = recordingTickable();
    machine.registerTickable(t);

    machine.play();
    machine.tick(0.5);
    machine.tick(1.5);

    expect(t.calls).toHaveLength(2);
    expect(t.calls[0]).toEqual({ dtSeconds: 0.5, elapsedSeconds: 0.5 });
    expect(t.calls[1]).toEqual({ dtSeconds: 1.5, elapsedSeconds: 2 });
  });

  it("re-pausing freezes the clock again (GDD §4.5)", () => {
    const machine = new CoreLoopModeMachine();
    const t = recordingTickable();
    machine.registerTickable(t);

    machine.play();
    machine.tick(1);
    machine.pause();
    machine.tick(1); // ignorado

    expect(machine.elapsed).toBe(1);
    expect(t.calls).toHaveLength(1);
  });

  it("emits core-loop-mode-changed only on actual transitions", () => {
    const emitter = new EventEmitter<CoreLoopDomainEvent>();
    const handler = vi.fn();
    emitter.on("core-loop-mode-changed", handler);
    const machine = new CoreLoopModeMachine(emitter);

    machine.play();
    machine.play(); // no-op, ya en ejecución
    machine.pause();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ mode: "execution" });
    expect(handler.mock.calls[1]?.[0]).toMatchObject({ mode: "planning" });
  });

  it("rejects a non-positive dtSeconds", () => {
    const machine = new CoreLoopModeMachine();
    machine.play();
    expect(() => machine.tick(0)).toThrow();
  });
});
