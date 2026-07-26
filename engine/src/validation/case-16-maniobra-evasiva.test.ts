// GDD 9, caso 16 — "Maniobra Evasiva": especialidad de Piloto (afinidad vs. penalización del +20% de otro tripulante).
import { describe, expect, it } from "vitest";
import { durationMultiplierFor } from "../index.js";

describe("case 16 — Maniobra Evasiva", () => {
  it("assigns the Piloto (affinity, faster) vs. another crew member (+20% penalty, GDD 6.6) to execute the evasive maneuver before the crisis timer", () => {
    const CRISIS_TIMER_SECONDS = 15;
    const BASE_MANEUVER_DURATION_SECONDS = 15;

    // Piloto Veterano: afinidad, ×0.6 (GDD 6.6, -40% sobre el tiempo de reacción base).
    const pilotDuration =
      BASE_MANEUVER_DURATION_SECONDS * durationMultiplierFor("evasive-maneuver", "piloto", "veterano");
    // Ingeniero Experto (fuera de afinidad): +20% fijo, sin importar el tier.
    const otherCrewDuration =
      BASE_MANEUVER_DURATION_SECONDS * durationMultiplierFor("evasive-maneuver", "ingeniero", "experto");

    expect(pilotDuration).toBeCloseTo(9); // 15 * 0.6
    expect(otherCrewDuration).toBeCloseTo(18); // 15 * 1.2

    // El Piloto llega a tiempo antes de que expire el temporizador de la crisis;
    // el resto de la tripulación, aunque de tier más alto, no llega a tiempo.
    expect(pilotDuration).toBeLessThan(CRISIS_TIMER_SECONDS);
    expect(otherCrewDuration).toBeGreaterThan(CRISIS_TIMER_SECONDS);
  });
});
