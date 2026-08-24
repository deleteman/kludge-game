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

describe("aggregateAtmosphere (peor sección gana)", () => {
  it("returns nominal (fraction 1) with no sections", () => {
    expect(aggregateAtmosphere([], chemicalRegistry)).toEqual({ level: "nominal", fraction: 1 });
  });

  it("returns nominal when no toxic gas is present anywhere", () => {
    const result = aggregateAtmosphere(
      [{ atmosphere: atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }) }],
      chemicalRegistry,
    );
    expect(result.level).toBe("nominal");
  });

  it("a single critically-toxic section drags the ship-wide aggregate down even if others are clean", () => {
    const clean = { atmosphere: atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }) };
    const poisoned = { atmosphere: atmosphereWith({ [GAS.OXYGEN]: 0.1, [cloro]: 0.6 }) };
    const result = aggregateAtmosphere([clean, poisoned], chemicalRegistry);
    expect(result.level).toBe("critical");
  });

  it("Subfase 11h: una fuga de presión sin gas tóxico también degrada el indicador", () => {
    const leaking = {
      atmosphere: { ...atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }), pressureKpa: 40 },
    };
    const result = aggregateAtmosphere([leaking], chemicalRegistry);
    // 40/101 ≈ 0.396 → "warning", no "critical": el piso real de la fuga
    // (`PRESSURE_SINK_FLOOR_KPA`, `mission-atmosphere-runtime.ts`) es
    // justamente 40 kPa — "fuga menor" por diseño, nunca llega a crítico.
    expect(result.level).toBe("warning");
    expect(result.fraction).toBeCloseTo(40 / 101, 5);
  });

  it("Subfase 11h: una fuga en una sección degrada el agregado aunque otra esté a presión estándar", () => {
    const clean = { atmosphere: atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }) };
    const leaking = {
      atmosphere: { ...atmosphereWith({ [GAS.OXYGEN]: STANDARD_OXYGEN_FRACTION }), pressureKpa: 35 },
    };
    const result = aggregateAtmosphere([clean, leaking], chemicalRegistry);
    expect(result.level).toBe("warning");
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

describe("aggregateHullIntegrity (Subfase 13f: peor SECCIÓN gana sobre la vida por sección)", () => {
  it("nominal sin secciones", () => {
    expect(aggregateHullIntegrity([])).toEqual({ level: "nominal", fraction: 1 });
  });

  it("con la nave intacta, nominal", () => {
    expect(aggregateHullIntegrity([1, 1, 1])).toEqual({ level: "nominal", fraction: 1 });
  });

  it("peor sección gana: una sección a media vida degrada el indicador de toda la nave", () => {
    expect(aggregateHullIntegrity([1, 0.4, 1])).toEqual({ level: "warning", fraction: 0.4 });
  });

  it("una sección colapsada pone el casco en crítico", () => {
    expect(aggregateHullIntegrity([1, 1, 0])).toEqual({ level: "critical", fraction: 0 });
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
    const intacta = aggregateHullIntegrity([1, 1]);
    expect(aggregateHullIntegrity([1, 1])).toEqual(intacta);
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
