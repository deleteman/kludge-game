import { describe, expect, it } from "vitest";
import { GateRule } from "./gate-rule.js";
import { LatchRule } from "./latch-rule.js";
import { OscillatorRule } from "./oscillator-rule.js";
import { DelayRule } from "./delay-rule.js";
import { PassthroughRule } from "./passthrough-rule.js";
import { CounterRule } from "./counter-rule.js";
import { createSignalNodeState } from "../signal-state.types.js";
import type { SignalInput, SignalRuleContext } from "../signal-rule.js";
import type { SignalBehavior } from "../signal-behavior.types.js";

function ctx(
  inputs: SignalInput[],
  behavior: SignalBehavior,
  overrides: Partial<SignalRuleContext> = {},
): SignalRuleContext {
  return {
    inputs,
    state: overrides.state ?? createSignalNodeState(),
    tick: overrides.tick ?? { dtSeconds: 1, elapsedSeconds: 0 },
    behavior,
  };
}

const on: SignalInput = { value: true };
const off: SignalInput = { value: false };

describe("signals: GateRule (GDD 5.6 AND/OR/NOT)", () => {
  const gate = new GateRule();

  it("AND is true only when every input is active", () => {
    expect(gate.evaluate(ctx([on, on], { kind: "gate", mode: "AND" }))).toBe(true);
    expect(gate.evaluate(ctx([on, off], { kind: "gate", mode: "AND" }))).toBe(false);
  });

  it("AND with no inputs is false", () => {
    expect(gate.evaluate(ctx([], { kind: "gate", mode: "AND" }))).toBe(false);
  });

  it("OR is true when any input is active", () => {
    expect(gate.evaluate(ctx([off, on], { kind: "gate", mode: "OR" }))).toBe(true);
    expect(gate.evaluate(ctx([off, off], { kind: "gate", mode: "OR" }))).toBe(false);
  });

  it("NOT inverts the OR of its inputs", () => {
    expect(gate.evaluate(ctx([off], { kind: "gate", mode: "NOT" }))).toBe(true);
    expect(gate.evaluate(ctx([on], { kind: "gate", mode: "NOT" }))).toBe(false);
  });
});

describe("signals: LatchRule (GDD 5.6 memoria/latch)", () => {
  const latch = new LatchRule();

  it("holds its state after the trigger ceases", () => {
    const state = createSignalNodeState();
    expect(latch.evaluate(ctx([{ value: true, port: "set" }], { kind: "latch" }, { state }))).toBe(
      true,
    );
    // Trigger gone, memory retained.
    expect(latch.evaluate(ctx([], { kind: "latch" }, { state }))).toBe(true);
  });

  it("reset has absolute priority over set (caso 4)", () => {
    const state = createSignalNodeState();
    state.latchMemory = true;
    const result = latch.evaluate(
      ctx(
        [
          { value: true, port: "set" },
          { value: true, port: "reset" },
        ],
        { kind: "latch" },
        { state },
      ),
    );
    expect(result).toBe(false);
  });

  it("treats an unported input as set", () => {
    const state = createSignalNodeState();
    expect(latch.evaluate(ctx([{ value: true }], { kind: "latch" }, { state }))).toBe(true);
  });
});

describe("signals: OscillatorRule (GDD 5.6 temporización/reloj)", () => {
  const osc = new OscillatorRule();
  const behavior: SignalBehavior = { kind: "oscillator", periodSeconds: 2 };

  it("flips its output every period", () => {
    const state = createSignalNodeState();
    const tickHalf = { dtSeconds: 1, elapsedSeconds: 0 };
    expect(osc.evaluate(ctx([], behavior, { state, tick: tickHalf }))).toBe(false); // phase 1 < 2
    expect(osc.evaluate(ctx([], behavior, { state, tick: tickHalf }))).toBe(true); // phase 2 -> flip
    expect(osc.evaluate(ctx([], behavior, { state, tick: tickHalf }))).toBe(true); // phase 1
    expect(osc.evaluate(ctx([], behavior, { state, tick: tickHalf }))).toBe(false); // phase 2 -> flip
  });

  it("freezes (false) while its enable input is inactive", () => {
    const state = createSignalNodeState();
    const bigTick = { dtSeconds: 10, elapsedSeconds: 0 };
    expect(osc.evaluate(ctx([off], behavior, { state, tick: bigTick }))).toBe(false);
    expect(state.oscillatorPhaseSeconds).toBe(0);
  });
});

describe("signals: DelayRule (GDD 5.6 delay de propagación)", () => {
  const delay = new DelayRule();
  const behavior: SignalBehavior = { kind: "delay", delaySeconds: 3 };

  it("propagates a change only after the delay elapses", () => {
    const state = createSignalNodeState();
    const step = { dtSeconds: 1, elapsedSeconds: 0 };
    expect(delay.evaluate(ctx([on], behavior, { state, tick: step }))).toBe(false); // 3->2
    expect(delay.evaluate(ctx([on], behavior, { state, tick: step }))).toBe(false); // 2->1
    expect(delay.evaluate(ctx([on], behavior, { state, tick: step }))).toBe(true); // 1->0, adopts
  });

  it("cancels a pending transition if the input reverts", () => {
    const state = createSignalNodeState();
    const step = { dtSeconds: 1, elapsedSeconds: 0 };
    delay.evaluate(ctx([on], behavior, { state, tick: step })); // start pending true
    delay.evaluate(ctx([off], behavior, { state, tick: step })); // input reverts to output(false)
    expect(state.delayTarget).toBeNull();
    expect(state.output).toBe(false);
  });
});

describe("signals: CounterRule (GDD 5.6 memoria incremental, caso 5 'El Cañón que Aprende')", () => {
  const counter = new CounterRule();
  const behavior: SignalBehavior = { kind: "counter", threshold: 3 };

  it("activates only after `threshold` rising edges of its count input", () => {
    const state = createSignalNodeState();
    expect(counter.evaluate(ctx([on], behavior, { state }))).toBe(false); // edge 1/3
    expect(counter.evaluate(ctx([on], behavior, { state }))).toBe(false); // held high, no new edge
    expect(counter.evaluate(ctx([off], behavior, { state }))).toBe(false); // falling edge
    expect(counter.evaluate(ctx([on], behavior, { state }))).toBe(false); // edge 2/3
    expect(counter.evaluate(ctx([off], behavior, { state }))).toBe(false);
    expect(counter.evaluate(ctx([on], behavior, { state }))).toBe(true); // edge 3/3, threshold reached
  });

  it("resets the count with absolute priority, mirroring LatchRule's reset", () => {
    const state = createSignalNodeState();
    state.counterValue = 2;
    const result = counter.evaluate(
      ctx(
        [
          { value: true, port: "count" },
          { value: true, port: "reset" },
        ],
        behavior,
        { state },
      ),
    );
    expect(result).toBe(false);
    expect(state.counterValue).toBe(0);
  });
});

describe("signals: PassthroughRule (default behavior)", () => {
  it("outputs the OR of its inputs", () => {
    const pass = new PassthroughRule();
    expect(pass.evaluate(ctx([off, on], { kind: "passthrough" }))).toBe(true);
    expect(pass.evaluate(ctx([off, off], { kind: "passthrough" }))).toBe(false);
  });
});
