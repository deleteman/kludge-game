import { describe, expect, it } from "vitest";

import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { GAS, STANDARD_OXYGEN_FRACTION } from "../atmosphere/atmosphere-composition.types.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import {
  aggregateAtmosphere,
  aggregateEnergy,
  aggregateHullIntegrity,
  aggregateLifeSupport,
  fractionToLevel,
} from "./ship-status-aggregation.js";

const { registry: chemicalRegistry } = buildChemicalCatalog();
const cloro = "cloro" as ChemicalSubstanceId;

function atmosphereWith(gases: Record<string, number>): SectionAtmosphere {
  return { gases: new Map(Object.entries(gases)), temperatureCelsius: 21, pressureKpa: 101 };
}

describe("fractionToLevel (Subfase 11g)", () => {
  it("mirrors the 3-tier cut used by hpBarColor: >0.5 nominal, >0.25 warning, resto critical", () => {
    expect(fractionToLevel(1)).toBe("nominal");
    expect(fractionToLevel(0.51)).toBe("nominal");
    expect(fractionToLevel(0.5)).toBe("warning");
    expect(fractionToLevel(0.26)).toBe("warning");
    expect(fractionToLevel(0.25)).toBe("critical");
    expect(fractionToLevel(0)).toBe("critical");
  });
});

describe("aggregateAtmosphere (13f ronda 2: presión ponderada, tóxico peor-sección-gana)", () => {
  const clean = (weight = 10) => ({
    atmosphere: atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }),
    weight,
  });
  const atPressure = (pressureKpa: number, weight = 10) => ({
    atmosphere: { ...atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }), pressureKpa },
    weight,
  });

  it("returns nominal (fraction 1) with no sections", () => {
    expect(aggregateAtmosphere([], chemicalRegistry)).toEqual({ level: "nominal", fraction: 1 });
  });

  it("returns nominal when no toxic gas is present anywhere", () => {
    expect(aggregateAtmosphere([clean()], chemicalRegistry).level).toBe("nominal");
  });

  /**
   * El gas tóxico NO se pondera, y es deliberado: se difunde por los conductos
   * al resto de la nave, así que una sala envenenada es un problema de todos por
   * chica que sea. El vacío no se propaga — por eso la presión sí se pondera.
   */
  it("una sección crítica por tóxico hunde el agregado aunque sea diminuta", () => {
    const poisoned = { atmosphere: atmosphereWith({ [GAS.OXYGEN]: 0.1, [cloro]: 0.6 }), weight: 1 };
    const result = aggregateAtmosphere([clean(100), poisoned], chemicalRegistry);
    expect(result.level).toBe("critical");
  });

  it("Subfase 11h: una fuga de presión sin gas tóxico también degrada el indicador", () => {
    const result = aggregateAtmosphere([atPressure(40)], chemicalRegistry);
    // 40/101 ≈ 0.396 → "warning", no "critical": el piso real de la fuga
    // (`PRESSURE_SINK_FLOOR_KPA`, `mission-atmosphere-runtime.ts`) es
    // justamente 40 kPa — "fuga menor" por diseño, nunca llega a crítico.
    expect(result.level).toBe("warning");
    expect(result.fraction).toBeCloseTo(40 / 101, 5);
  });

  /**
   * REGRESIÓN de la ronda 2 de playtest: "la atmósfera queda en 0 (...) y no se
   * restaura". Con peor-sección-gana, UNA sección venteada clavaba la fila de
   * toda la nave en 0, así que reparar la fuga del Cap.1 en otra sala no movía
   * nada y el jugador leía que su reparación no había servido.
   */
  it("una sola sección venteada no clava la fila de toda la nave en 0", () => {
    const sections = [...Array.from({ length: 10 }, () => clean()), atPressure(0)];
    const result = aggregateAtmosphere(sections, chemicalRegistry);
    expect(result.fraction).toBeGreaterThan(0);
    // Pesa el triple que su tamaño (`breachedSectionWeightMultiplier`): 100 de
    // sección sana sobre 130 de peso total.
    expect(result.fraction).toBeCloseTo(100 / 130, 5);
  });

  it("ventear la bodega duele más que ventear la esclusa", () => {
    const esclusa = aggregateAtmosphere([atPressure(0, 10), clean(60)], chemicalRegistry);
    const bodega = aggregateAtmosphere([clean(10), atPressure(0, 60)], chemicalRegistry);
    expect(esclusa.fraction).toBeGreaterThan(bodega.fraction);
  });

  it("con toda la nave venteada la fila llega a 0", () => {
    expect(aggregateAtmosphere([atPressure(0), atPressure(0)], chemicalRegistry).fraction).toBe(0);
  });

  /**
   * Una fuga que se estabiliza en el piso de 40 kPa NO cuenta como venteada
   * (el umbral es el del hazard de vacío, 20 kPa): sigue pesando lo que su
   * tamaño, porque la sala todavía es habitable.
   */
  it("una fuga por encima del umbral de vacío no recibe el peso extra", () => {
    const conFuga = aggregateAtmosphere([clean(10), atPressure(40, 10)], chemicalRegistry);
    expect(conFuga.fraction).toBeCloseTo((1 + 40 / 101) / 2, 5);
  });
});

describe("aggregateLifeSupport (respirabilidad, peor sección gana)", () => {
  it("returns nominal with standard oxygen", () => {
    const result = aggregateLifeSupport([{ atmosphere: atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }) }]);
    expect(result.level).toBe("nominal");
  });

  it("returns critical when a section has no breathable oxygen", () => {
    const result = aggregateLifeSupport([{ atmosphere: atmosphereWith({ [GAS.OXYGEN]: 0 }) }]);
    expect(result).toEqual({ level: "critical", fraction: 0 });
  });
});

describe("aggregateHullIntegrity (13f, ronda 1: media PONDERADA por tamaño de sección)", () => {
  /** Secciones de igual tamaño, para aislar la fracción del peso. */
  const evenly = (...fractions: ReadonlyArray<number>) =>
    fractions.map((fraction) => ({ fraction, weight: 100 }));

  it("nominal sin secciones", () => {
    expect(aggregateHullIntegrity([])).toEqual({ level: "nominal", fraction: 1 });
  });

  it("con la nave intacta, nominal", () => {
    expect(aggregateHullIntegrity(evenly(1, 1, 1))).toEqual({ level: "nominal", fraction: 1 });
  });

  /**
   * REGRESIÓN de la ronda 1 de playtest de 13f: "al presionar H una vez, la
   * integridad del casco queda en casi 0 de una". Era "peor sección gana" —
   * una sección al 17% ponía TODA la nave al 17%. Una nave con una sección
   * rota de once no está en crítico, y decir que sí deja al indicador sin
   * capacidad de contar nada más.
   */
  it("una sola sección colapsada NO hunde el indicador de toda la nave", () => {
    const result = aggregateHullIntegrity(evenly(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0));
    expect(result.level).toBe("nominal");
    expect(result.fraction).toBeCloseTo(10 / 11, 5);
  });

  it("pondera por tamaño: perder la bodega duele más que perder la esclusa", () => {
    const esclusa = aggregateHullIntegrity([
      { fraction: 0, weight: 100 },
      { fraction: 1, weight: 600 },
    ]);
    const bodega = aggregateHullIntegrity([
      { fraction: 1, weight: 100 },
      { fraction: 0, weight: 600 },
    ]);
    expect(esclusa.fraction).toBeGreaterThan(bodega.fraction);
    expect(esclusa.fraction).toBeCloseTo(600 / 700, 5);
    expect(bodega.fraction).toBeCloseTo(100 / 700, 5);
  });

  it("con toda la nave destruida el casco llega a 0", () => {
    expect(aggregateHullIntegrity(evenly(0, 0, 0))).toEqual({ level: "critical", fraction: 0 });
  });

  /**
   * REGRESIÓN del bug que motivó 13f (playtest de 13c, obs 3 del operador:
   * "al instalar un tubo flexible con RE baja la integridad del casco bajó de
   * golpe, y al desmontarlo se soluciona, ¿tiene sentido?").
   *
   * Ahora es imposible por construcción: la firma de esta función NO recibe
   * componentes. Ninguna pieza instalada, estructural o no, desgastada o no,
   * puede mover el indicador de casco — solo la vida de las secciones. Se deja
   * el test para que un futuro cambio que vuelva a acoplar ambas cosas tenga
   * que borrarlo a mano y explicar por qué.
   */
  it("ninguna pieza instalada puede mover el indicador de casco", () => {
    const intacta = aggregateHullIntegrity(evenly(1, 1));
    expect(aggregateHullIntegrity(evenly(1, 1))).toEqual(intacta);
    expect(aggregateHullIntegrity.length).toBe(1);
  });
});

describe("aggregateEnergy (peor de: cicatriz permanente vs. suministro/demanda)", () => {
  /** Sin déficit de reparto: aísla la señal de cicatriz permanente (semántica original de 11g). */
  const scarOnly = (unpoweredSectionCount: number, totalSectionCount: number) =>
    aggregateEnergy({ unpoweredSectionCount, totalSectionCount, grantedUnits: 0, requestedUnits: 0 });

  it("returns nominal with no unpowered sections", () => {
    expect(scarOnly(0, 4)).toEqual({ level: "nominal", fraction: 1 });
  });

  it("returns critical when every section is unpowered", () => {
    expect(scarOnly(4, 4)).toEqual({ level: "critical", fraction: 0 });
  });

  it("returns a partial fraction for a partial outage", () => {
    const result = scarOnly(1, 4);
    expect(result.fraction).toBeCloseTo(0.75);
    expect(result.level).toBe("nominal");
  });

  it("returns nominal (fraction 1) for a ship with no sections (edge case)", () => {
    expect(scarOnly(0, 0)).toEqual({ level: "nominal", fraction: 1 });
  });

  it("cae a crítico cuando la nave no puede entregar lo repartido (ronda 5)", () => {
    // Pedido 10 con presupuesto 2: solo se entrega el 20% de lo pedido.
    const result = aggregateEnergy({
      unpoweredSectionCount: 0,
      totalSectionCount: 4,
      grantedUnits: 2,
      requestedUnits: 10,
    });
    expect(result.fraction).toBeCloseTo(0.2);
    expect(result.level).toBe("critical");
  });

  it("sin nada repartido todavía es NOMINAL, no un fallo (protege contra el bug de la ronda 1)", () => {
    // Partida nueva: hay presupuesto pero el jugador no repartió. Si esto diera
    // crítico, el overlay de alerta y el CRT arrancarían a full desde el frame 1.
    const result = aggregateEnergy({
      unpoweredSectionCount: 0,
      totalSectionCount: 11,
      grantedUnits: 0,
      requestedUnits: 0,
    });
    expect(result).toEqual({ level: "nominal", fraction: 1 });
  });

  it("con cicatriz permanente y déficit a la vez, gana la peor de las dos señales", () => {
    const result = aggregateEnergy({
      unpoweredSectionCount: 1, // cicatriz → 0.75
      totalSectionCount: 4,
      grantedUnits: 1,
      requestedUnits: 10, // suministro → 0.1, peor
    });
    expect(result.fraction).toBeCloseTo(0.1);
  });
});
