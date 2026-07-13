import { describe, expect, it, vi } from "vitest";
import {
  activeCoilFieldIntensity,
  intensityAtDistance,
  MAGNETIC_FIELD_PARAMETERS,
} from "./magnetic-field.js";
import { MagneticAccelerationAccumulator } from "./magnetic-acceleration.js";
import { KINETIC_IMPACT_PARAMETERS, resolveKineticImpact } from "./kinetic-impact.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { KineticDomainEvent } from "./kinetic-events.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

describe("kinetics: activeCoilFieldIntensity (documento §1, tabla de bobinas + corriente)", () => {
  it("una bobina + corriente baja -> Baja (literal)", () => {
    expect(activeCoilFieldIntensity(1, "B")).toBe("B");
  });

  it("una bobina + corriente alta -> Media (literal)", () => {
    expect(activeCoilFieldIntensity(1, "A")).toBe("M");
  });

  it("2-3 bobinas + corriente baja/media -> Media (literal)", () => {
    expect(activeCoilFieldIntensity(2, "B")).toBe("M");
    expect(activeCoilFieldIntensity(3, "M")).toBe("M");
  });

  it("múltiples bobinas (>=4) + corriente alta -> Alta (literal)", () => {
    expect(activeCoilFieldIntensity(MAGNETIC_FIELD_PARAMETERS.multipleCoilsThreshold, "A")).toBe(
      "A",
    );
  });

  it("sin bobinas activas -> sin campo", () => {
    expect(activeCoilFieldIntensity(0, "A")).toBe("N");
  });
});

describe("kinetics: intensityAtDistance (documento §2, decaimiento)", () => {
  it("no degrada dentro del rango efectivo", () => {
    expect(intensityAtDistance("A", MAGNETIC_FIELD_PARAMETERS.effectiveRangeUnits)).toBe("A");
  });

  it("degrada un nivel por cada tramo de exceso, saturando en N", () => {
    const farDistance =
      MAGNETIC_FIELD_PARAMETERS.effectiveRangeUnits +
      MAGNETIC_FIELD_PARAMETERS.degradeStepUnits * 5;
    expect(intensityAtDistance("A", farDistance)).toBe("N");
  });
});

describe("kinetics: MagneticAccelerationAccumulator (documento §2, inercia acumulada)", () => {
  it("accumulates velocity across sequential pulses instead of resetting between coils", () => {
    const accumulator = new MagneticAccelerationAccumulator("proyectil-1");
    const emitter = new EventEmitter<KineticDomainEvent>();
    const onAccel = vi.fn();
    emitter.on("magnetic-acceleration", onAccel);

    // 3 pulsos discretos (flanco N->activo), cada uno separado por un tick en
    // N — así se modela una bobina que dispara al paso del proyectil, no un
    // campo sostenido indefinidamente.
    accumulator.tick("A", tickOf(0), emitter); // pulso 1
    accumulator.tick("N", tickOf(1), emitter);
    accumulator.tick("A", tickOf(2), emitter); // pulso 2
    accumulator.tick("N", tickOf(3), emitter);

    expect(accumulator.currentVelocity).not.toBe("N");
    const velocityAfterTwoPulses = accumulator.currentVelocity;

    accumulator.tick("A", tickOf(4), emitter); // pulso 3
    expect(onAccel).toHaveBeenCalled();
    // La velocidad tras el tercer pulso nunca es menor que tras el segundo —
    // la inercia no se pierde entre bobinas (principio 5 CLAUDE.md).
    const order = ["N", "B", "M", "A"];
    expect(order.indexOf(accumulator.currentVelocity)).toBeGreaterThanOrEqual(
      order.indexOf(velocityAfterTwoPulses),
    );
  });

  it("holding the same active field for multiple ticks counts as ONE pulse, not one per tick", () => {
    const accumulator = new MagneticAccelerationAccumulator("proyectil-2");
    for (let t = 0; t < 5; t++) accumulator.tick("A", tickOf(t)); // un solo flanco N->A
    const velocityAfterSustained = accumulator.currentVelocity;

    const singlePulse = new MagneticAccelerationAccumulator("proyectil-3");
    singlePulse.tick("A", tickOf(0));
    expect(velocityAfterSustained).toBe(singlePulse.currentVelocity);
  });

  it("does not decay when the field leaves range (inercia)", () => {
    const accumulator = new MagneticAccelerationAccumulator("proyectil-4");
    accumulator.tick("A", tickOf(0));
    const velocityAfterPulse = accumulator.currentVelocity;
    for (let t = 1; t < 20; t++) accumulator.tick("N", tickOf(t)); // fuera de rango, sin nuevos pulsos
    expect(accumulator.currentVelocity).toBe(velocityAfterPulse);
  });
});

describe("kinetics: resolveKineticImpact (documento §3, velocidad × footprint)", () => {
  const smallFootprint = { width: 1, height: 1 };
  const largeFootprint = { width: 2, height: 2 };

  it("velocidad alta -> daño alto, sin importar el tamaño", () => {
    const event = resolveKineticImpact("A", smallFootprint, "panel", tickOf(0));
    expect(event).toMatchObject({ kind: "kinetic-impact", severity: "high" });
  });

  it("velocidad media -> daño medio", () => {
    expect(resolveKineticImpact("M", smallFootprint, "panel", tickOf(0)).severity).toBe("medium");
  });

  it("velocidad baja + footprint grande -> daño medio (masa compensa velocidad)", () => {
    expect(largeFootprint.width * largeFootprint.height).toBeGreaterThanOrEqual(
      KINETIC_IMPACT_PARAMETERS.largeFootprintArea,
    );
    expect(resolveKineticImpact("B", largeFootprint, "panel", tickOf(0)).severity).toBe("medium");
  });

  it("velocidad baja + footprint pequeño -> daño bajo", () => {
    expect(resolveKineticImpact("B", smallFootprint, "panel", tickOf(0)).severity).toBe("low");
  });
});
