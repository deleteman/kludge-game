import { describe, expect, it, vi } from "vitest";
import {
  activeCoilFieldIntensity,
  intensityAtDistance,
  MAGNETIC_FIELD_PARAMETERS,
} from "./magnetic-field.js";
import {
  MagneticAccelerationAccumulator,
  VELOCITY_ACCUMULATION_PARAMETERS,
} from "./magnetic-acceleration.js";
import { resolveKineticImpact } from "./kinetic-impact.js";
import { virtualMass, VIRTUAL_MASS_PARAMETERS } from "./virtual-mass.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { KineticDomainEvent, VelocityLevel } from "./kinetic-events.types.js";
import type { ProjectileBody } from "./projectile.types.js";
import type { Footprint } from "../geometry/grid-position.types.js";
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

  it("con corriente alta, el umbral de 'múltiples' separa 2-3 bobinas de >=4", () => {
    // El documento reserva "Alta" para múltiples bobinas + corriente alta: 3
    // bobinas no bastan. Hasta la Fase 11a.1 ambas ramas devolvían "A", lo que
    // hacía que `multipleCoilsThreshold` fuera código muerto sin test que lo
    // cubriera (pendiente #3).
    const threshold = MAGNETIC_FIELD_PARAMETERS.multipleCoilsThreshold;
    expect(activeCoilFieldIntensity(threshold - 1, "A")).toBe("M");
    expect(activeCoilFieldIntensity(threshold, "A")).toBe("A");
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

describe("kinetics: MagneticAccelerationAccumulator.applyDrag (ASA 2, decaimiento por celdas)", () => {
  const { dragThresholdCells } = VELOCITY_ACCUMULATION_PARAMETERS;

  /** Un pulso "A" (flanco N->A->N) para dejar el accumulator con velocidad conocida. */
  function pulseA(accumulator: MagneticAccelerationAccumulator, t: number): void {
    accumulator.tick("A", tickOf(t));
    accumulator.tick("N", tickOf(t + 1));
  }

  it("no decae antes de cruzar el umbral de celdas", () => {
    const accumulator = new MagneticAccelerationAccumulator("p1");
    pulseA(accumulator, 0); // un pulso "A" -> weight 3 -> velocidad "M"
    expect(accumulator.currentVelocity).toBe("M");

    const event = accumulator.applyDrag(dragThresholdCells - 1, tickOf(10));

    expect(event).toBeNull();
    expect(accumulator.currentVelocity).toBe("M");
  });

  it("decae un nivel exactamente al cruzar el umbral", () => {
    const accumulator = new MagneticAccelerationAccumulator("p2");
    pulseA(accumulator, 0); // velocidad "M"

    const event = accumulator.applyDrag(dragThresholdCells, tickOf(10));

    expect(event).toMatchObject({ kind: "magnetic-acceleration", velocity: "B" });
    expect(accumulator.currentVelocity).toBe("B");
  });

  it("decae varios niveles si cellsSinceLastPulse salta de golpe varios múltiplos del umbral", () => {
    const accumulator = new MagneticAccelerationAccumulator("p3");
    pulseA(accumulator, 0);
    pulseA(accumulator, 2); // dos pulsos "A" -> weight 6 -> velocidad "A"
    expect(accumulator.currentVelocity).toBe("A");

    // Un solo tick con un dt enorme puede reportar de golpe muchas celdas
    // recorridas (mismo patrón que el avance fraccionario de ProjectileSimulation).
    accumulator.applyDrag(dragThresholdCells * 3, tickOf(10));

    expect(accumulator.currentVelocity).toBe("N");
  });

  it("clampa en 'N' y no repite el evento si no se cruzó un nuevo escalón", () => {
    const accumulator = new MagneticAccelerationAccumulator("p4");
    pulseA(accumulator, 0); // velocidad "M"
    accumulator.applyDrag(dragThresholdCells, tickOf(10)); // decae a "B"

    const secondCall = accumulator.applyDrag(dragThresholdCells, tickOf(11)); // mismo escalón, sin avance nuevo

    expect(secondCall).toBeNull();
    expect(accumulator.currentVelocity).toBe("B");
  });

  it("no hace nada si el proyectil ya está en reposo", () => {
    const accumulator = new MagneticAccelerationAccumulator("p5");
    expect(accumulator.currentVelocity).toBe("N");

    const event = accumulator.applyDrag(dragThresholdCells * 10, tickOf(10));

    expect(event).toBeNull();
    expect(accumulator.currentVelocity).toBe("N");
  });

  it("el peso acumulado se reduce de verdad: un pulso débil tras el drag no restaura el nivel perdido", () => {
    const accumulator = new MagneticAccelerationAccumulator("p6");
    pulseA(accumulator, 0);
    pulseA(accumulator, 2); // dos pulsos "A" -> weight 6 -> velocidad "A"
    expect(accumulator.currentVelocity).toBe("A");

    accumulator.applyDrag(dragThresholdCells, tickOf(10)); // un escalón: "A" -> "M", weight ajustado a 3
    expect(accumulator.currentVelocity).toBe("M");

    // Si el peso acumulado siguiera en el pico histórico (6), un pulso "B" (+1)
    // daría 7 >= umbral de "A" (6) y restauraría el nivel perdido de gratis.
    // Con el peso reducido a 3, el mismo pulso da 4: sigue en "M".
    accumulator.tick("B", tickOf(11));

    expect(accumulator.currentVelocity).toBe("M");
  });
});

describe("kinetics: MagneticAccelerationAccumulator.snapshot/restore (Fase 11a.3, ASA 3)", () => {
  it("continuar desde un snapshot da el mismo resultado que continuar el original", () => {
    const original = new MagneticAccelerationAccumulator("p7");
    original.tick("A", tickOf(0));
    original.tick("N", tickOf(1)); // un pulso "A" -> weight 3 -> "M"
    original.applyDrag(VELOCITY_ACCUMULATION_PARAMETERS.dragThresholdCells - 5, tickOf(2));

    const clone = new MagneticAccelerationAccumulator("p7-clone", original.snapshot());
    expect(clone.currentVelocity).toBe(original.currentVelocity);

    // Avanzar ambos con la MISMA secuencia de intensidades debe dar el mismo desenlace.
    for (const [intensity, t] of [
      ["N", 3],
      ["A", 4],
      ["N", 5],
    ] as const) {
      original.tick(intensity, tickOf(t));
      clone.tick(intensity, tickOf(t));
    }

    expect(clone.currentVelocity).toBe(original.currentVelocity);
    expect(clone.snapshot()).toEqual(original.snapshot());
  });

  it("un snapshot restaurado sin drag previo no revive un escalón ya aplicado (dragStepsApplied se preserva)", () => {
    const original = new MagneticAccelerationAccumulator("p8");
    original.tick("A", tickOf(0));
    original.tick("N", tickOf(1)); // "M"
    original.applyDrag(VELOCITY_ACCUMULATION_PARAMETERS.dragThresholdCells, tickOf(2)); // decae a "B"
    expect(original.currentVelocity).toBe("B");

    const clone = new MagneticAccelerationAccumulator("p8-clone", original.snapshot());
    // Repetir el mismo cellsSinceLastPulse que ya produjo el decaimiento no debe decaer un escalón más.
    const event = clone.applyDrag(VELOCITY_ACCUMULATION_PARAMETERS.dragThresholdCells, tickOf(3));

    expect(event).toBeNull();
    expect(clone.currentVelocity).toBe("B");
  });

  it("constructor sin snapshot se comporta como antes de ASA 3 (arranca en reposo)", () => {
    const accumulator = new MagneticAccelerationAccumulator("p9");
    expect(accumulator.currentVelocity).toBe("N");
    expect(accumulator.snapshot()).toEqual({
      accumulatedWeight: 0,
      previousIntensity: "N",
      velocity: "N",
      dragStepsApplied: 0,
    });
  });
});

describe("kinetics: virtualMass (ASA 1, footprint × RE)", () => {
  const small = { width: 1, height: 1 };
  const medium = { width: 1, height: 2 };
  const large = { width: 2, height: 2 };

  it("el defecto que ASA 1 corrige: mismo footprint, RE distinta -> masa distinta", () => {
    // Carcasa plástica vs plancha metálica del catálogo: ambas 2×2. Antes de
    // ASA 1 eran indistinguibles al impactar; ahora no.
    expect(virtualMass(large, undefined)).toBe("M");
    expect(virtualMass(large, "M")).toBe("A");
  });

  it("RE ausente se evalúa como ligera (la mayoría del catálogo no la declara)", () => {
    expect(virtualMass(small, undefined)).toBe(virtualMass(small, "B"));
  });

  it("tabla masa completa (tamaño × RE)", () => {
    expect([virtualMass(small, "B"), virtualMass(small, "M"), virtualMass(small, "A")]).toEqual([
      "B",
      "B",
      "M",
    ]);
    expect([virtualMass(medium, "B"), virtualMass(medium, "M"), virtualMass(medium, "A")]).toEqual([
      "B",
      "M",
      "A",
    ]);
    expect([virtualMass(large, "B"), virtualMass(large, "M"), virtualMass(large, "A")]).toEqual([
      "M",
      "A",
      "A",
    ]);
  });

  it("los buckets de tamaño siguen los umbrales declarados", () => {
    const atMediumThreshold = { width: VIRTUAL_MASS_PARAMETERS.mediumFootprintArea, height: 1 };
    const atLargeThreshold = { width: VIRTUAL_MASS_PARAMETERS.largeFootprintArea, height: 1 };
    expect(virtualMass(atMediumThreshold, "M")).toBe("M");
    expect(virtualMass(atLargeThreshold, "M")).toBe("A");
  });
});

describe("kinetics: resolveKineticImpact (ASA 1, velocidad × masa virtual)", () => {
  const bodyOf = (footprint: Footprint, re?: "A" | "M" | "B"): ProjectileBody => ({
    ref: "proyectil",
    footprint,
    re,
  });
  const PANEL_TARGET = { ref: "panel", kind: "component" } as const;
  const PANEL_CELL = { x: 4, y: 2 };
  const light = bodyOf({ width: 1, height: 1 }); // masa B
  const mid = bodyOf({ width: 2, height: 2 }); // masa M
  const heavy = bodyOf({ width: 2, height: 2 }, "M"); // masa A

  const severityOf = (velocity: VelocityLevel, body: ProjectileBody) =>
    resolveKineticImpact(velocity, body, PANEL_TARGET, PANEL_CELL, tickOf(0)).severity;

  it("velocidad alta + masa baja -> daño medio (deroga el literal del documento §3)", () => {
    // El doc §3 decía "alto si la velocidad es alta" sin mirar el tamaño.
    // Decisión del operador (11a.1): la masa degrada, no solo agrava.
    const event = resolveKineticImpact("A", light, PANEL_TARGET, PANEL_CELL, tickOf(0));
    expect(event).toMatchObject({ kind: "kinetic-impact", severity: "medium" });
  });

  it("velocidad media + masa alta -> daño alto (la masa agrava)", () => {
    expect(severityOf("M", heavy)).toBe("high");
  });

  it("matriz completa velocidad × masa", () => {
    expect([severityOf("B", light), severityOf("B", mid), severityOf("B", heavy)]).toEqual([
      "low",
      "low",
      "medium",
    ]);
    expect([severityOf("M", light), severityOf("M", mid), severityOf("M", heavy)]).toEqual([
      "low",
      "medium",
      "high",
    ]);
    expect([severityOf("A", light), severityOf("A", mid), severityOf("A", heavy)]).toEqual([
      "medium",
      "high",
      "high",
    ]);
  });
});
