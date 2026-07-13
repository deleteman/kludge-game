// GDD 9, caso 10 — "Fuga de Amoníaco en el Invernadero": umbral de incapacitación por concentración/tiempo de un tóxico específico (Espec. §1), distinto de la asfixia por falta de O2 (caso 6).
import { describe, expect, it, vi } from "vitest";
import {
  createToxicHazardAccumulator,
  EventEmitter,
  type AtmosphereDomainEvent,
  type SectionId,
  type TickContext,
} from "../index.js";

const sectionId = (raw: string): SectionId => raw as SectionId;
const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

describe("case 10 — Fuga de Amoníaco en el Invernadero", () => {
  it("incapacitates crew after >30% concentration sustained >5s in a sealed, unventilated section", () => {
    const invernadero = sectionId("invernadero");
    const acc = createToxicHazardAccumulator();
    const emitter = new EventEmitter<AtmosphereDomainEvent>();
    const onToxic = vi.fn();
    emitter.on("toxic-threshold", onToxic);

    // El tanque dañado libera amoníaco (TOX) hacia una sección sellada (sin
    // ventilación que lo disipe, a diferencia del caso 6 que es sobre O2).
    for (let t = 0; t < 4; t++) acc.tick(invernadero, 0.4, tickOf(t), emitter);
    expect(onToxic).not.toHaveBeenCalled(); // todavía no pasaron los 5s

    acc.tick(invernadero, 0.4, tickOf(4), emitter); // 5s sostenidos > 30%
    expect(onToxic).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "toxic-threshold",
        sectionId: invernadero,
        severity: "incapacitation",
      }),
    );

    onToxic.mockClear();
    // La fuga sigue sin controlarse y la concentración sube por encima de 60%: letal.
    acc.tick(invernadero, 0.7, tickOf(5), emitter);
    expect(onToxic).toHaveBeenCalledWith(expect.objectContaining({ severity: "lethal" }));
  });
});
