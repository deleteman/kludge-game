import { describe, expect, it } from "vitest";
import type { SectionId } from "../atmosphere/section.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import { composePressureSinks } from "../mission/composite-pressure-sink.js";
import type { DismantleLeakEvent } from "./salvage-hazard.types.js";
import { TransientLeakPressureSink } from "./transient-pressure-sink.js";

const SECTION = "bodega" as SectionId;

function leakEvent(overrides: Partial<DismantleLeakEvent> = {}): DismantleLeakEvent {
  return {
    kind: "dismantle-leak",
    instanceId: "pieza-1" as PlacedComponentInstanceId,
    position: { x: 0, y: 0 },
    sectionId: SECTION,
    elapsedSeconds: 0,
    drainRateKpaPerSecond: 1.5,
    durationSeconds: 20,
    ...overrides,
  };
}

describe("TransientLeakPressureSink (13d)", () => {
  it("drains the section while the leak is alive and stops when it expires", () => {
    const sink = new TransientLeakPressureSink();
    sink.register(leakEvent());
    const source = sink.asSinkSource();

    sink.advanceTo(10);
    expect(source().get(SECTION)).toBe(1.5);

    sink.advanceTo(21);
    expect(source().get(SECTION)).toBeUndefined();
    expect(sink.activeLeakCount).toBe(0);
  });

  it("adds up simultaneous leaks in the same section", () => {
    const sink = new TransientLeakPressureSink();
    sink.register(leakEvent());
    sink.register(leakEvent({ drainRateKpaPerSecond: 2 }));

    sink.advanceTo(5);
    expect(sink.asSinkSource()().get(SECTION)).toBe(3.5);
  });

  it("ignores a leak whose section the floorplan could not resolve", () => {
    const sink = new TransientLeakPressureSink();
    sink.register(leakEvent({ sectionId: undefined }));
    expect(sink.activeLeakCount).toBe(0);
  });
});

describe("composePressureSinks (13d)", () => {
  it("sums sources on the same section respecting the sign", () => {
    // Junta sellada RECUPERANDO (-2) mientras un desmontaje abre una fuga (+1.5).
    const sealed = () => new Map<SectionId, number>([[SECTION, -2]]);
    const leaking = () => new Map<SectionId, number>([[SECTION, 1.5]]);

    expect(composePressureSinks(sealed, leaking)().get(SECTION)).toBeCloseTo(-0.5);
  });

  it("skips undefined sources so callers can pass optional sinks", () => {
    const sealed = () => new Map<SectionId, number>([[SECTION, 3]]);
    expect(composePressureSinks(undefined, sealed, undefined)().get(SECTION)).toBe(3);
  });
});
