// GDD 9, caso 8 — "Sofocar sin extintor / Trampa de chispa": combustión modulada por la concentración de O2 de la sección, en ambas direcciones (GDD 5.5).
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

const fuel = { id: "fuel" as ChemicalSubstanceId, name: "fuel", tags: [{ name: "COMB" as const }] };
const rule = new CombustionRule();
const ctxFor = (runtime: SectionRuntime): ReactionContext => ({
  reactants: [fuel],
  oxygen: sectionCombustionAtmosphere(runtime.atmosphere),
  ignitionPresent: true,
  thermalRegulatorOverloaded: false,
  elapsedSeconds: 0,
});

describe("case 8 — Sofocar sin extintor / Trampa de chispa", () => {
  it("draining a burning room's O2 into a large sink extinguishes the fire by asphyxiation, not cooling", () => {
    const salaEnLlamas = section("sala-en-llamas", 5, { [GAS.OXYGEN]: 0.21 });
    const pasilloVenteo = section("pasillo-venteo", 500, { [GAS.OXYGEN]: 0 });
    const sections = new Map([salaEnLlamas, pasilloVenteo].map((r) => [r.section.id, r]));
    const connection = {
      a: salaEnLlamas.section.id,
      b: pasilloVenteo.section.id,
      valveAperture: 1,
    };

    // Con atmósfera normal el fuego arde con normalidad.
    expect(rule.appliesTo(ctxFor(salaEnLlamas))).toBe(true);
    expect(rule.apply(ctxFor(salaEnLlamas)).events[0]).toMatchObject({ intensity: "standard" });

    // El jugador aísla la ventilación y drena el O2 de la sala.
    for (let t = 0; t < 60; t++) diffuse(sections, [connection], tickOf(t));

    // Sin O2 suficiente, la combustión deja de ser posible: se apagó por
    // asfixia, no por enfriamiento — ninguna regla de temperatura intervino.
    expect(rule.appliesTo(ctxFor(salaEnLlamas))).toBe(false);
  });

  it("deliberately enriching an empty room with O2 turns a minimal spark into a violent ignition", () => {
    const salaVacia = section("sala-vacia", 5, { [GAS.OXYGEN]: 0.02 }); // casi sin O2
    const tanqueMedico = section("tanque-medico", 500, { [GAS.OXYGEN]: 1 }); // fuente rica en O2
    const sections = new Map([salaVacia, tanqueMedico].map((r) => [r.section.id, r]));
    const connection = { a: salaVacia.section.id, b: tanqueMedico.section.id, valveAperture: 1 };

    // Antes de enriquecer, la ignición es prácticamente imposible/débil.
    expect(rule.appliesTo(ctxFor(salaVacia))).toBe(false);

    // El jugador enriquece deliberadamente la sección con O2 del tanque médico.
    for (let t = 0; t < 30; t++) diffuse(sections, [connection], tickOf(t));

    // Un cable pelado (chispa mínima) ahora detona violentamente — misma
    // mecánica de atmósfera, usada como arma en vez de como herramienta de
    // contención (GDD 5.5).
    expect(sectionCombustionAtmosphere(salaVacia.atmosphere)).toBe("high");
    expect(rule.apply(ctxFor(salaVacia)).events[0]).toMatchObject({
      intensity: "violent",
      radius: "full-section",
      crewDamage: "high",
    });
  });
});
