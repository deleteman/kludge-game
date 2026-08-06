import { describe, expect, it } from "vitest";
import {
  composeGasInjections,
  GAS_FRACTION_PER_SUBSTANCE_UNIT,
  TransientGasInjection,
  type SectionGasInjectionSource,
} from "./section-gas-injection.js";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const BODEGA = "bodega" as SectionId;
const PUENTE = "puente" as SectionId;
const ACIDO = "acido-de-laboratorio" as ChemicalSubstanceId;
const NEUTRALIZANTE = "base-de-laboratorio" as ChemicalSubstanceId;

const tick = (dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: dt });

/** Dos secciones SIN conducto de ventilación: aísla la inyección de la difusión. */
function floorplan(): ShipFloorplan {
  return {
    id: "nave-fixture",
    archetype: "exploracion",
    nameKey: "ship.fixture",
    gridSize: { width: 2, height: 1 },
    sections: [
      { id: BODEGA, nameKey: "section.bodega", cells: [{ x: 0, y: 0 }] },
      { id: PUENTE, nameKey: "section.puente", cells: [{ x: 1, y: 0 }] },
    ],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

describe("TransientGasInjection", () => {
  it("convierte unidades de sustancia en fracción de volumen", () => {
    const injection = new TransientGasInjection();
    injection.inject(BODEGA, ACIDO, 5);
    const emitted = injection.asInjectionSource()();
    expect(emitted.get(BODEGA)?.get(ACIDO)).toBeCloseTo(5 * GAS_FRACTION_PER_SUBSTANCE_UNIT);
  });

  it("se vacía al consumirse: cada inyección se aplica exactamente una vez", () => {
    const injection = new TransientGasInjection();
    injection.inject(BODEGA, ACIDO, 5);
    const source = injection.asInjectionSource();
    expect(source().size).toBe(1);
    expect(source().size).toBe(0);
    expect(injection.isEmpty).toBe(true);
  });

  it("acumula varias inyecciones de la misma sustancia antes de aplicarse", () => {
    const injection = new TransientGasInjection();
    injection.inject(BODEGA, ACIDO, 2);
    injection.inject(BODEGA, ACIDO, 3);
    expect(injection.asInjectionSource()().get(BODEGA)?.get(ACIDO)).toBeCloseTo(
      5 * GAS_FRACTION_PER_SUBSTANCE_UNIT,
    );
  });

  it("ignora cantidades no positivas", () => {
    const injection = new TransientGasInjection();
    injection.inject(BODEGA, ACIDO, 0);
    injection.inject(BODEGA, ACIDO, -4);
    expect(injection.isEmpty).toBe(true);
  });
});

describe("composeGasInjections", () => {
  it("sin fuentes devuelve undefined (no cablear una fuente vacía)", () => {
    expect(composeGasInjections(undefined, undefined)).toBeUndefined();
  });

  it("suma las fracciones de varias fuentes sobre la misma sección", () => {
    const a: SectionGasInjectionSource = () => new Map([[BODEGA, new Map([[ACIDO, 0.1]])]]);
    const b: SectionGasInjectionSource = () => new Map([[BODEGA, new Map([[ACIDO, 0.2]])]]);
    const merged = composeGasInjections(a, b);
    expect(merged?.().get(BODEGA)?.get(ACIDO)).toBeCloseTo(0.3);
  });
});

describe("MissionAtmosphereRuntime — inyección de sustancia (13e)", () => {
  it("es el PRIMER escritor real de un ChemicalSubstanceId en atmosphere.gases", () => {
    const injection = new TransientGasInjection();
    const runtime = new MissionAtmosphereRuntime(
      floorplan(),
      [],
      undefined,
      injection.asInjectionSource(),
    );
    expect(runtime.atmosphereOf(BODEGA)?.gases.get(ACIDO)).toBeUndefined();

    injection.inject(BODEGA, ACIDO, 5);
    runtime.tick(tick());

    expect(runtime.atmosphereOf(BODEGA)?.gases.get(ACIDO)).toBeGreaterThan(0);
  });

  it("solo afecta a la sección donde se vierte", () => {
    const injection = new TransientGasInjection();
    const runtime = new MissionAtmosphereRuntime(
      floorplan(),
      [],
      undefined,
      injection.asInjectionSource(),
    );
    injection.inject(BODEGA, ACIDO, 5);
    runtime.tick(tick());
    expect(runtime.atmosphereOf(PUENTE)?.gases.get(ACIDO)).toBeUndefined();
  });

  it("la suma de fracciones nunca supera 1: el gas entra desplazando al resto", () => {
    const injection = new TransientGasInjection();
    const runtime = new MissionAtmosphereRuntime(
      floorplan(),
      [],
      undefined,
      injection.asInjectionSource(),
    );
    // 100 unidades = fracción 2.0, muy por encima del volumen disponible.
    injection.inject(BODEGA, ACIDO, 100);
    runtime.tick(tick());

    const gases = runtime.atmosphereOf(BODEGA)!.gases;
    const total = [...gases.values()].reduce((sum, fraction) => sum + fraction, 0);
    expect(total).toBeLessThanOrEqual(1.0001);
    // Y el oxígeno que había quedó desplazado, no intacto.
    expect(gases.get(GAS.OXYGEN)).toBeLessThan(0.21);
  });

  it("dos sustancias distintas coexisten en la misma sección (base para neutralizar)", () => {
    const injection = new TransientGasInjection();
    const runtime = new MissionAtmosphereRuntime(
      floorplan(),
      [],
      undefined,
      injection.asInjectionSource(),
    );
    injection.inject(BODEGA, ACIDO, 3);
    injection.inject(BODEGA, NEUTRALIZANTE, 3);
    runtime.tick(tick());

    const gases = runtime.atmosphereOf(BODEGA)!.gases;
    expect(gases.get(ACIDO)).toBeGreaterThan(0);
    expect(gases.get(NEUTRALIZANTE)).toBeGreaterThan(0);
  });

  it("sin fuente de inyección el comportamiento es idéntico al anterior a 13e", () => {
    const runtime = new MissionAtmosphereRuntime(floorplan(), []);
    const before = new Map(runtime.atmosphereOf(BODEGA)!.gases);
    runtime.tick(tick());
    expect([...runtime.atmosphereOf(BODEGA)!.gases]).toEqual([...before]);
  });
});
