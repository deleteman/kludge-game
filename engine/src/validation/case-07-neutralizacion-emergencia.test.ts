// GDD 9, caso 7 — "La Neutralización de Emergencia": ácido+base (neutralización) cruzado con corrosividad sobre estructura — neutralizar a tiempo detiene la degradación del casco.
import { describe, expect, it } from "vitest";
import {
  ReactionResolver,
  StructuralIntegrity,
  buildChemicalCatalog,
  type ChemicalSubstanceId,
  type FailureDomainEvent,
  type ReactantSubstance,
  type ReactionContext,
  type TickContext,
} from "../index.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

describe("case 7 — La Neutralización de Emergencia", () => {
  it("neutralizing the acid leak in time halts hull corrosion before it fails", () => {
    const { registry } = buildChemicalCatalog();
    const acidoBateria = registry.get("acido-de-bateria" as ChemicalSubstanceId)!;
    const baseLaboratorio = registry.get("base-de-laboratorio" as ChemicalSubstanceId)!;

    const acidReactant: ReactantSubstance = {
      id: acidoBateria.id,
      name: acidoBateria.name,
      tags: acidoBateria.data.tags,
    };
    const baseReactant: ReactantSubstance = {
      id: baseLaboratorio.id,
      name: baseLaboratorio.name,
      tags: baseLaboratorio.data.tags,
    };

    const context = (reactants: ReactantSubstance[]): ReactionContext => ({
      reactants,
      oxygen: "normal",
      ignitionPresent: false,
      thermalRegulatorOverloaded: false,
      elapsedSeconds: 0,
    });

    const hull = new StructuralIntegrity("casco-bahia-carga", "A");
    const runExposure = (level: "A" | "M" | "B" | null, seconds: number): FailureDomainEvent[] => {
      const events: FailureDomainEvent[] = [];
      for (let t = 0; t < seconds; t++) events.push(...hull.tick(level, tickOf(t)));
      return events;
    };

    // La fuga corroe el casco sin intervención: 8s a corrosivo alto (~7.5s/nivel) ya degrada un nivel.
    const beforeNeutralizing = runExposure("A", 8);
    expect(beforeNeutralizing.some((e) => e.kind === "structural-degraded")).toBe(true);
    expect(hull.currentLevel).toBe("M");

    // El jugador mezcla base disponible en el mismo pasillo: ácido+base neutraliza.
    const resolver = new ReactionResolver();
    const outcome = resolver.resolve(context([acidReactant, baseReactant]));
    expect(outcome.result?.name).toBe("Solución neutralizada");
    expect(outcome.result?.tags).toEqual([{ name: "INERTE" }]);
    expect(outcome.events.some((e) => e.kind === "neutralization")).toBe(true);

    // Sin más corrosivo activo (neutralizado a tiempo), el casco no degrada más
    // aunque pase mucho más tiempo — la cicatriz ya hecha persiste, pero no crece.
    runExposure(null, 60);
    expect(hull.currentLevel).toBe("M");
    expect(hull.hasFailed).toBe(false);
  });
});
