import { describe, expect, it, vi } from "vitest";
import {
  OverloadRule,
  conductorOverloadSubject,
  reservoirOverloadSubject,
} from "./overload-rule.js";
import { StructuralIntegrity } from "./structural-failure.js";
import {
  THERMAL_CONDUCTIVITY_PARAMETERS,
  thermalCapacityFactor,
  thermallyAdjustedConductorOverloadSubject,
} from "./thermal-conductivity-rule.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { FailureDomainEvent } from "./failure-events.types.js";
import type { ConductorProperty, ReservoirProperty } from "../properties/functional.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

describe("failure: OverloadRule (GDD 5.6 sobrecarga)", () => {
  const rule = new OverloadRule();

  it("fails an electrical conductor over capacity with a 'cut'", () => {
    const conductor: ConductorProperty = { tag: "COND", resourceType: "E", maxCapacity: 10 };
    const event = rule.evaluate(conductorOverloadSubject("cable-1", conductor, 15), tickOf(0));
    expect(event).toMatchObject({ kind: "overload", failureMode: "cut", capacity: 10, load: 15 });
  });

  it("does not fire when load is within capacity", () => {
    const conductor: ConductorProperty = { tag: "COND", resourceType: "E", maxCapacity: 10 };
    expect(rule.evaluate(conductorOverloadSubject("cable-1", conductor, 5), tickOf(0))).toBeNull();
  });

  it("a gas reservoir over capacity explodes, and the event is emitted", () => {
    const reservoir: ReservoirProperty = {
      tag: "RES",
      resourceType: "G",
      capacity: 100,
      dischargeRate: 5,
    };
    const emitter = new EventEmitter<FailureDomainEvent>();
    const onOverload = vi.fn();
    emitter.on("overload", onOverload);

    rule.evaluate(reservoirOverloadSubject("tank-1", reservoir, 120), tickOf(0), emitter);
    expect(onOverload).toHaveBeenCalledWith(
      expect.objectContaining({ failureMode: "explosion", load: 120 }),
    );
  });
});

describe("failure: thermallyAdjustedConductorOverloadSubject (GDD 5.2 conductividad vs. temperatura, caso 2)", () => {
  const rule = new OverloadRule();
  const conductor: ConductorProperty = { tag: "COND", resourceType: "E", maxCapacity: 10 };

  it("keeps nominal capacity above the cooling trigger threshold", () => {
    const subject = thermallyAdjustedConductorOverloadSubject("cable-1", conductor, 8, 20);
    expect(rule.evaluate(subject, tickOf(0))).toBeNull();
  });

  it("shrinks effective capacity and triggers overload once cooled past the trigger threshold", () => {
    const subject = thermallyAdjustedConductorOverloadSubject(
      "cable-1",
      conductor,
      8,
      THERMAL_CONDUCTIVITY_PARAMETERS.triggerTemperatureCelsius - 10,
    );
    const event = rule.evaluate(subject, tickOf(0));
    expect(event).toMatchObject({
      kind: "overload",
      failureMode: "cut",
      capacity:
        conductor.maxCapacity *
        THERMAL_CONDUCTIVITY_PARAMETERS.effectiveCapacityFractionOutsideRange,
      load: 8,
    });
  });

  it("shrinks effective capacity and triggers overload once heated past the hot threshold (14a-2)", () => {
    const subject = thermallyAdjustedConductorOverloadSubject(
      "cable-1",
      conductor,
      8,
      THERMAL_CONDUCTIVITY_PARAMETERS.hotTriggerTemperatureCelsius + 10,
    );
    expect(rule.evaluate(subject, tickOf(0))).toMatchObject({
      failureMode: "cut",
      capacity:
        conductor.maxCapacity *
        THERMAL_CONDUCTIVITY_PARAMETERS.effectiveCapacityFractionOutsideRange,
    });
  });

  it("stays nominal between both thresholds, where the ship actually operates", () => {
    const { triggerTemperatureCelsius, hotTriggerTemperatureCelsius } = THERMAL_CONDUCTIVITY_PARAMETERS;
    for (const temperature of [triggerTemperatureCelsius + 1, 21, hotTriggerTemperatureCelsius - 1]) {
      expect(thermalCapacityFactor(temperature)).toBe(1);
    }
  });

  it("lets thermal insulation (CT: B) survive a temperature that degrades a conductive one (CT: A)", () => {
    const { hotTriggerTemperatureCelsius, hotTriggerOffsetByThermalConductivity } =
      THERMAL_CONDUCTIVITY_PARAMETERS;
    const justAboveNominalTrigger = hotTriggerTemperatureCelsius + 1;
    expect(thermalCapacityFactor(justAboveNominalTrigger, "A")).toBeLessThan(1);
    expect(thermalCapacityFactor(justAboveNominalTrigger, "B")).toBe(1);
    // Y el aislante también cede si se sigue calentando: protege, no inmuniza.
    expect(
      thermalCapacityFactor(
        hotTriggerTemperatureCelsius + hotTriggerOffsetByThermalConductivity.B + 1,
        "B",
      ),
    ).toBeLessThan(1);
  });

  it("assumes the worst case when the material declares no CT (fail-safe, not fail-open)", () => {
    const justAbove = THERMAL_CONDUCTIVITY_PARAMETERS.hotTriggerTemperatureCelsius + 1;
    expect(thermalCapacityFactor(justAbove, undefined)).toBe(thermalCapacityFactor(justAbove, "A"));
  });
});

describe("failure: StructuralIntegrity (GDD 5.3/5.6 corrosión, Espec. §1)", () => {
  function runExposure(
    integrity: StructuralIntegrity,
    level: "A" | "M" | "B" | null,
    seconds: number,
  ): FailureDomainEvent[] {
    const events: FailureDomainEvent[] = [];
    for (let t = 0; t < seconds; t++) {
      events.push(...integrity.tick(level, tickOf(t)));
    }
    return events;
  }

  it("drops RE one level at a time and finally fails (A→M→B→fallo at ~15s/level medium)", () => {
    const hull = new StructuralIntegrity("hull", "A");
    const events = runExposure(hull, "M", 45);
    expect(events.map((e) => e.kind)).toEqual([
      "structural-degraded",
      "structural-degraded",
      "structural-failure",
    ]);
    expect(hull.hasFailed).toBe(true);
  });

  it("degrades twice as fast under high-level corrosive", () => {
    const hull = new StructuralIntegrity("hull", "A");
    const events = runExposure(hull, "A", 8); // 7.5s/nivel → primer descenso antes de 8s
    expect(events.some((e) => e.kind === "structural-degraded")).toBe(true);
  });

  it("keeps accumulated damage when exposure pauses (consecuencia permanente)", () => {
    const hull = new StructuralIntegrity("hull", "A");
    runExposure(hull, "M", 10); // 10/15 hacia el primer descenso, sin llegar
    runExposure(hull, null, 100); // pausa: el daño NO se recupera
    const resumed = runExposure(hull, "M", 5); // 10+5 = 15 → descenso ahora
    expect(resumed.some((e) => e.kind === "structural-degraded")).toBe(true);
  });
});
