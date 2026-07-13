// GDD 9, caso 11 — "La Detonación Controlada": radio de explosión y daño a tripulante en el radio, como herramienta deliberada (Espec. §1) — el jugador calcula cuánto enriquecer para no dañar a su propia tripulación cercana.
import { describe, expect, it } from "vitest";
import {
  CombustionRule,
  diffuse,
  GAS,
  sectionCombustionAtmosphere,
  type ChemicalSubstanceId,
  type GasKey,
  type ReactionContext,
  type SectionId,
  type SectionRuntime,
  type TickContext,
} from "../index.js";

const sectionId = (raw: string): SectionId => raw as SectionId;
const tickOf = (elapsed: number, dt = 1): TickContext => ({
  dtSeconds: dt,
  elapsedSeconds: elapsed,
});

function section(id: string, volume: number, gases: Record<GasKey, number>): SectionRuntime {
  return {
    section: { id: sectionId(id), volume },
    atmosphere: { gases: new Map(Object.entries(gases)), temperatureCelsius: 21, pressureKpa: 101 },
  };
}

const combustible = {
  id: "combustible" as ChemicalSubstanceId,
  name: "combustible",
  tags: [{ name: "COMB" as const }],
};
const rule = new CombustionRule();
const ctxFor = (runtime: SectionRuntime): ReactionContext => ({
  reactants: [combustible],
  oxygen: sectionCombustionAtmosphere(runtime.atmosphere),
  ignitionPresent: true,
  thermalRegulatorOverloaded: false,
  elapsedSeconds: 0,
});

describe("case 11 — La Detonación Controlada", () => {
  it("bounds the blast to the target section (full-section, not beyond) when fully enriched before ignition", () => {
    const salaDetonacion = section("sala-puerta-bloqueada", 5, { [GAS.OXYGEN]: 0.02 });
    const tanqueOxidante = section("tanque-oxidante", 500, { [GAS.OXYGEN]: 1 });
    const sections = new Map([salaDetonacion, tanqueOxidante].map((r) => [r.section.id, r]));
    const connection = {
      a: salaDetonacion.section.id,
      b: tanqueOxidante.section.id,
      valveAperture: 1,
    };

    for (let t = 0; t < 30; t++) diffuse(sections, [connection], tickOf(t));
    expect(sectionCombustionAtmosphere(salaDetonacion.atmosphere)).toBe("high");

    const outcome = rule.apply(ctxFor(salaDetonacion));
    // Espec. §1: O2 alto -> 1 sección completa, daño alto a tripulante en el
    // radio -- pero acotado a ESA sección, no "toda la nave": la tripulación
    // en otra sección (fuera del radio) queda a salvo por diseño.
    expect(outcome.events[0]).toMatchObject({
      kind: "combustion",
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
    });
  });

  it("lets the player calculate a smaller, safer radius by choosing normal (not enriched) atmosphere", () => {
    const salaDetonacion = section("sala-puerta-bloqueada-2", 5, { [GAS.OXYGEN]: 0.21 }); // sin enriquecer
    const outcome = rule.apply(ctxFor(salaDetonacion));
    // Deliberadamente NO enriquecida: media sección, daño medio -- el jugador
    // controla el radio decidiendo cuánto oxidante añade antes de detonar.
    expect(outcome.events[0]).toMatchObject({
      radius: "half-section",
      crewDamage: "medium",
    });
  });
});
