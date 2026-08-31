import { describe, expect, it, vi } from "vitest";
import { diffuse } from "./diffusion.js";
import { oxygenToCombustionBucket, sectionCombustionAtmosphere } from "./combustion-atmosphere.js";
import {
  createToxicHazardAccumulator,
  createCorrosiveCrewHazardAccumulator,
} from "./hazard-accumulation.js";
import { GAS } from "./atmosphere-composition.types.js";
import type { GasKey } from "./atmosphere-composition.types.js";
import type { SectionId, SectionRuntime } from "./section.types.js";
import { CombustionRule } from "../chemistry/reaction/rules/combustion.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { AtmosphereDomainEvent } from "./atmosphere-events.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ReactionContext } from "../chemistry/reaction/reaction-context.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

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

function o2(runtime: SectionRuntime): number {
  return runtime.atmosphere.gases.get(GAS.OXYGEN) ?? 0;
}

describe("atmosphere: diffuse (GDD 5.5, Espec. §4)", () => {
  it("reduces the concentration difference ~10%/s at full aperture", () => {
    const a = section("a", 1, { [GAS.OXYGEN]: 1 });
    const b = section("b", 1, { [GAS.OXYGEN]: 0 });
    const map = new Map([a, b].map((r) => [r.section.id, r]));

    diffuse(map, [{ a: a.section.id, b: b.section.id, valveAperture: 1 }], tickOf(0));

    expect(o2(a)).toBeCloseTo(0.95);
    expect(o2(b)).toBeCloseTo(0.05);
  });

  it("a closed valve isolates the sections (drenar/contener, GDD 5.5)", () => {
    const a = section("a", 1, { [GAS.OXYGEN]: 1 });
    const b = section("b", 1, { [GAS.OXYGEN]: 0 });
    const map = new Map([a, b].map((r) => [r.section.id, r]));

    diffuse(map, [{ a: a.section.id, b: b.section.id, valveAperture: 0 }], tickOf(0));

    expect(o2(a)).toBe(1);
    expect(o2(b)).toBe(0);
  });

  it("conserves gas mass and moves a larger section proportionally less", () => {
    const small = section("small", 1, { [GAS.OXYGEN]: 1 });
    const large = section("large", 3, { [GAS.OXYGEN]: 0 });
    const map = new Map([small, large].map((r) => [r.section.id, r]));

    diffuse(map, [{ a: small.section.id, b: large.section.id, valveAperture: 1 }], tickOf(0));

    const mass = o2(small) * 1 + o2(large) * 3;
    expect(mass).toBeCloseTo(1); // conservada
    const smallDelta = Math.abs(1 - o2(small));
    const largeDelta = Math.abs(0 - o2(large));
    expect(largeDelta).toBeLessThan(smallDelta); // la grande cambia menos
  });
});

describe("atmosphere: conducción de calor en diffuse (Subfase 14a-1)", () => {
  function hot(id: string, volume: number, temperatureCelsius: number): SectionRuntime {
    return {
      section: { id: sectionId(id), volume },
      atmosphere: {
        gases: new Map([[GAS.OXYGEN, 0.21]]),
        temperatureCelsius,
        pressureKpa: 101,
      },
    };
  }

  it("dos secciones conectadas convergen en temperatura", () => {
    const a = hot("a", 1, 200);
    const b = hot("b", 1, 20);
    const map = new Map([a, b].map((r) => [r.section.id, r]));

    diffuse(map, [{ a: a.section.id, b: b.section.id, valveAperture: 1 }], tickOf(0));

    expect(a.atmosphere.temperatureCelsius).toBeLessThan(200);
    expect(b.atmosphere.temperatureCelsius).toBeGreaterThan(20);
    // Equilibrio ponderado por volumen: con volúmenes iguales, la media.
    const media = (a.atmosphere.temperatureCelsius + b.atmosphere.temperatureCelsius) / 2;
    expect(media).toBeCloseTo(110);
  });

  it("una puerta cerrada FRENA el calor pero no lo aísla (MIN_THERMAL_APERTURE)", () => {
    const abiertaA = hot("abierta-a", 1, 200);
    const abiertaB = hot("abierta-b", 1, 20);
    const cerradaA = hot("cerrada-a", 1, 200);
    const cerradaB = hot("cerrada-b", 1, 20);
    const map = new Map(
      [abiertaA, abiertaB, cerradaA, cerradaB].map((r) => [r.section.id, r]),
    );

    diffuse(
      map,
      [
        { a: abiertaA.section.id, b: abiertaB.section.id, valveAperture: 1 },
        { a: cerradaA.section.id, b: cerradaB.section.id, valveAperture: 0 },
      ],
      tickOf(0),
    );

    // Cerrada: el gas NO se movió (contraste con el bloque de gases)…
    expect(cerradaA.atmosphere.gases.get(GAS.OXYGEN)).toBeCloseTo(0.21);
    // …pero el calor sí, aunque menos que con la puerta abierta.
    expect(cerradaB.atmosphere.temperatureCelsius).toBeGreaterThan(20);
    expect(cerradaB.atmosphere.temperatureCelsius).toBeLessThan(
      abiertaB.atmosphere.temperatureCelsius,
    );
  });

  it("una sala chica al lado de un incendio se calienta más que un hangar", () => {
    const foco = hot("foco", 1, 400);
    const chica = hot("chica", 1, 21);
    const hangar = hot("hangar", 10, 21);
    const map = new Map([foco, chica, hangar].map((r) => [r.section.id, r]));

    diffuse(
      map,
      [
        { a: foco.section.id, b: chica.section.id, valveAperture: 1 },
        { a: foco.section.id, b: hangar.section.id, valveAperture: 1 },
      ],
      tickOf(0),
    );

    expect(chica.atmosphere.temperatureCelsius).toBeGreaterThan(
      hangar.atmosphere.temperatureCelsius,
    );
  });
});

describe("atmosphere: combustión dependiente de O2 (acople Bloque 3 ↔ Bloque 2, caso 8)", () => {
  it("maps O2 fraction to the GDD 5.5 buckets", () => {
    expect(oxygenToCombustionBucket(0)).toBe("none");
    expect(oxygenToCombustionBucket(0.03)).toBe("none");
    expect(oxygenToCombustionBucket(0.1)).toBe("low");
    expect(oxygenToCombustionBucket(0.21)).toBe("normal");
    expect(oxygenToCombustionBucket(0.5)).toBe("high");
  });

  it("the combustion rule reads the section's O2 bucket (imposible en vacío, violenta enriquecida)", () => {
    const rule = new CombustionRule();
    const fuel = {
      id: "fuel" as ChemicalSubstanceId,
      name: "fuel",
      tags: [{ name: "COMB" as const }],
    };
    const ctxFor = (runtime: SectionRuntime): ReactionContext => ({
      reactants: [fuel],
      oxygen: sectionCombustionAtmosphere(runtime.atmosphere),
      ignitionPresent: true,
      thermalRegulatorOverloaded: false,
      elapsedSeconds: 0,
    });

    const vacuum = section("v", 1, { [GAS.OXYGEN]: 0 });
    const enriched = section("e", 1, { [GAS.OXYGEN]: 0.6 });

    expect(rule.appliesTo(ctxFor(vacuum))).toBe(false);
    expect(rule.apply(ctxFor(enriched)).events[0]).toMatchObject({ intensity: "violent" });
  });
});

describe("atmosphere: HazardAccumulator (GDD 5.3 por tiempo, Espec. §1)", () => {
  it("emits toxic incapacitation after >5s over 30% (caso 10)", () => {
    const acc = createToxicHazardAccumulator();
    const id = sectionId("greenhouse");
    const emitter = new EventEmitter<AtmosphereDomainEvent>();
    const onToxic = vi.fn();
    emitter.on("toxic-threshold", onToxic);

    for (let t = 0; t < 4; t++) acc.tick(id, 0.4, tickOf(t), emitter);
    expect(onToxic).not.toHaveBeenCalled(); // solo 4s acumulados
    acc.tick(id, 0.4, tickOf(4), emitter); // 5s
    expect(onToxic).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "toxic-threshold", severity: "incapacitation" }),
    );
  });

  it("emits lethal immediately above 60%", () => {
    const acc = createToxicHazardAccumulator();
    const events = acc.tick(sectionId("s"), 0.7, tickOf(0));
    expect(events[0]).toMatchObject({ severity: "lethal" });
  });

  it("resets exposure when concentration drops below the threshold", () => {
    const acc = createToxicHazardAccumulator();
    const id = sectionId("s");
    for (let t = 0; t < 4; t++) acc.tick(id, 0.4, tickOf(t));
    acc.tick(id, 0.1, tickOf(4)); // se disipa
    const later = acc.tick(id, 0.4, tickOf(5)); // vuelve a subir: contador reiniciado
    expect(later).toHaveLength(0);
  });

  it("corrosive crew exposure is lethal after ~10s of contact", () => {
    const acc = createCorrosiveCrewHazardAccumulator();
    const id = sectionId("s");
    let lethal = false;
    for (let t = 0; t < 10; t++) {
      const events = acc.tick(id, 0.05, tickOf(t));
      if (events.some((e) => e.severity === "lethal")) lethal = true;
    }
    expect(lethal).toBe(true);
  });
});
