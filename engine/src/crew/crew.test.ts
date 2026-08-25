import { describe, expect, it } from "vitest";
import { atomicRecoveryFraction } from "./atomic-recovery.js";
import { durationMultiplierFor, OFF_AFFINITY_DURATION_PENALTY } from "./crew-affinity.js";
import { HP_LOSS_FRACTION, applyCombustionDamage, applyCrewDamage, applyKineticDamage } from "./hp-resolution.js";
import { CREW_CAPACITY_BY_ARCHETYPE, selectActiveCrew, type CrewRoster } from "./crew-roster.js";
import { barkKey, pickBarkIndex } from "./bark-bank.js";
import type { CrewActor, CrewActorId } from "./crew-actor.types.js";
import type { CombustionEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { KineticImpactEvent } from "../kinetics/kinetic-events.types.js";

function actor(overrides: Partial<CrewActor> = {}): CrewActor {
  return {
    id: "actor-1" as CrewActorId,
    name: "Tripulante de prueba",
    specialty: "ingeniero",
    tier: "novato",
    trait: "estoico",
    hp: 100,
    maxHp: 100,
    status: "idle",
    ...overrides,
  };
}

describe("crew-affinity: durationMultiplierFor (GDD 6.6)", () => {
  it("gives the Ingeniero the tier bonus when dismantling (his own affinity)", () => {
    expect(durationMultiplierFor("dismantle", "ingeniero", "novato")).toBeCloseTo(0.9);
    expect(durationMultiplierFor("dismantle", "ingeniero", "veterano")).toBeCloseTo(0.75);
    expect(durationMultiplierFor("dismantle", "ingeniero", "experto")).toBeCloseTo(0.6);
  });

  it("applies the fixed +20% off-affinity penalty regardless of tier when another specialty dismantles", () => {
    expect(durationMultiplierFor("dismantle", "medico", "experto")).toBe(OFF_AFFINITY_DURATION_PENALTY);
    expect(durationMultiplierFor("dismantle", "seguridad", "novato")).toBe(OFF_AFFINITY_DURATION_PENALTY);
  });

  it("gives the Ingeniero the tier bonus when fabricating in the workbench (combine, 11c.2), penalizing others", () => {
    expect(durationMultiplierFor("combine", "ingeniero", "novato")).toBeCloseTo(0.9);
    expect(durationMultiplierFor("combine", "ingeniero", "experto")).toBeCloseTo(0.6);
    expect(durationMultiplierFor("combine", "piloto", "experto")).toBe(OFF_AFFINITY_DURATION_PENALTY);
  });

  it("gives the Piloto the tier bonus on evasive maneuvers (case 16), penalizing any other specialty", () => {
    expect(durationMultiplierFor("evasive-maneuver", "piloto", "novato")).toBeCloseTo(0.8);
    expect(durationMultiplierFor("evasive-maneuver", "piloto", "veterano")).toBeCloseTo(0.6);
    expect(durationMultiplierFor("evasive-maneuver", "piloto", "experto")).toBeCloseTo(0.4);
    expect(durationMultiplierFor("evasive-maneuver", "ingeniero", "experto")).toBe(
      OFF_AFFINITY_DURATION_PENALTY,
    );
  });

  it("gives the Médico the tier bonus analyzing a substance (Fase 11e), but never blocks another specialty from trying", () => {
    expect(durationMultiplierFor("analyze-substance", "medico", "novato")).toBeCloseTo(0.85);
    expect(durationMultiplierFor("analyze-substance", "medico", "veterano")).toBeCloseTo(0.65);
    expect(durationMultiplierFor("analyze-substance", "medico", "experto")).toBeCloseTo(0.45);
    expect(durationMultiplierFor("analyze-substance", "ingeniero", "experto")).toBe(
      OFF_AFFINITY_DURATION_PENALTY,
    );
  });
});

describe("atomic-recovery: atomicRecoveryFraction (GDD 6.5)", () => {
  it("recovers the tier's base fraction, plus the Ingeniero's +10% bonus", () => {
    expect(atomicRecoveryFraction("novato", "ingeniero")).toBeCloseTo(0.7);
    expect(atomicRecoveryFraction("veterano", "ingeniero")).toBeCloseTo(0.9);
    expect(atomicRecoveryFraction("experto", "ingeniero")).toBeCloseTo(1);
  });

  it("keeps the tier's base fraction without the bonus when another specialty dismantles", () => {
    expect(atomicRecoveryFraction("novato", "medico")).toBeCloseTo(0.6);
    expect(atomicRecoveryFraction("experto", "seguridad")).toBeCloseTo(0.925);
  });

  it("penalizes recovery further when the original compound has low structural resistance (RE=B)", () => {
    expect(atomicRecoveryFraction("veterano", "ingeniero", "B")).toBeCloseTo(0.75);
    expect(atomicRecoveryFraction("novato", "medico", "B")).toBeCloseTo(0.45);
  });
});

describe("hp-resolution: daño a tripulante (case 17 y combustión, caso 11)", () => {
  it("applies kinetic impact damage and reports crew-damaged when the actor survives", () => {
    const { actor: updated, event } = applyKineticDamage(actor({ hp: 100, maxHp: 100 }), {
      kind: "kinetic-impact",
      targetRef: "actor-1",
      targetKind: "crew",
      position: { x: 0, y: 0 },
      velocity: "M",
      severity: "medium",
      elapsedSeconds: 12,
    } satisfies KineticImpactEvent);
    expect(updated.hp).toBe(50);
    expect(event).toMatchObject({ kind: "crew-damaged", cause: "kinetic-impact", remainingHp: 50 });
  });

  it("a high-severity kinetic impact kills the crew member (permadeath, GDD 6.1)", () => {
    const { actor: updated, event } = applyKineticDamage(actor({ hp: 100, maxHp: 100 }), {
      kind: "kinetic-impact",
      targetRef: "actor-1",
      targetKind: "crew",
      position: { x: 0, y: 0 },
      velocity: "A",
      severity: "high",
      elapsedSeconds: 12,
    } satisfies KineticImpactEvent);
    expect(updated.hp).toBe(0);
    expect(event).toMatchObject({ kind: "crew-death", cause: "kinetic-impact" });
  });

  it("classifies violent combustion as 'explosion' and standard/weak damaging combustion as 'fire'", () => {
    const violent: CombustionEvent = {
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
      elapsedSeconds: 5,
    };
    const { event: explosionEvent } = applyCombustionDamage(actor(), violent);
    expect(explosionEvent).toMatchObject({ kind: "crew-death", cause: "explosion" });

    const standard: CombustionEvent = {
      kind: "combustion",
      intensity: "standard",
      radius: "half-section",
      crewDamage: "medium",
      elapsedSeconds: 5,
    };
    const { event: fireEvent } = applyCombustionDamage(actor(), standard);
    expect(fireEvent).toMatchObject({ kind: "crew-damaged", cause: "fire" });
  });

  it("applyCrewDamage con minHp hiere pero nunca mata (no letal), incluso con daño alto sobre HP bajo", () => {
    const { actor: updated, event } = applyCrewDamage(
      actor({ hp: 20, maxHp: 100 }),
      HP_LOSS_FRACTION.high, // 1.0 → letal sin piso
      "electrocution",
      30,
      { minHp: 1 },
    );
    expect(updated.hp).toBe(1);
    expect(event).toMatchObject({ kind: "crew-damaged", cause: "electrocution", remainingHp: 1 });
  });

  it("applyCrewDamage sin minHp sí puede matar (permadeath, comportamiento por defecto)", () => {
    const { actor: updated, event } = applyCrewDamage(actor({ hp: 20, maxHp: 100 }), HP_LOSS_FRACTION.high, "electrocution", 30);
    expect(updated.hp).toBe(0);
    expect(event).toMatchObject({ kind: "crew-death", cause: "electrocution" });
  });

  /**
   * REGRESIÓN de la ronda 1 de playtest de 13f. Una fuente de daño continua
   * que aplicaba una fracción por FRAME redondeaba a 0 de pérdida y aun así
   * emitía `crew-damaged`: partículas de sangre ~60 veces por segundo sobre un
   * tripulante que no perdía un solo punto de vida. El guard vive en
   * `applyHpLoss`, no en el llamador, para cortar la clase entera de bug.
   */
  it("un daño que no quita ni un punto de vida NO emite evento", () => {
    const { actor: updated, event } = applyCrewDamage(
      actor({ hp: 100, maxHp: 100 }),
      0.001, // Math.round(100 × 0.001) = 0
      "cold",
      1,
    );
    expect(updated.hp).toBe(100);
    expect(event).toBeUndefined();
  });

  it("tampoco emite si el HP ya está clavado en el piso `minHp`", () => {
    const { actor: updated, event } = applyCrewDamage(
      actor({ hp: 1, maxHp: 100 }),
      HP_LOSS_FRACTION.high,
      "electrocution",
      30,
      { minHp: 1 },
    );
    expect(updated.hp).toBe(1);
    expect(event).toBeUndefined();
  });
});

describe("crew-roster: selección pre-misión (GDD 6.2)", () => {
  const roster: CrewRoster = {
    available: [
      actor({ id: "a" as CrewActorId }),
      actor({ id: "b" as CrewActorId }),
      actor({ id: "c" as CrewActorId }),
    ],
  };

  it("selects a subset of the roster within the archetype's capacity", () => {
    const active = selectActiveCrew(roster, "exploracion", ["a" as CrewActorId, "b" as CrewActorId]);
    expect(active.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("rejects a selection that exceeds the archetype's capacity", () => {
    const tooMany = Array.from(
      { length: CREW_CAPACITY_BY_ARCHETYPE.exploracion + 1 },
      (_, i) => `x${i}` as CrewActorId,
    );
    expect(() => selectActiveCrew(roster, "exploracion", tooMany)).toThrow();
  });
});

describe("bark-bank: selección de frase por rasgo×evento (GDD 6.7.1)", () => {
  it("builds the i18n key from trait, event type and index", () => {
    expect(barkKey("temerario", "dangerous-task", 0)).toBe("crew.bark.temerario.dangerous-task.0");
  });

  it("rotates through the available lines deterministically", () => {
    expect(pickBarkIndex(0)).toBe(0);
    expect(pickBarkIndex(1)).toBe(1);
    expect(pickBarkIndex(2)).toBe(0);
  });
});
