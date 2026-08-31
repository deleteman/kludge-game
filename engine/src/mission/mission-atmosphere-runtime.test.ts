import { describe, expect, it } from "vitest";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import { getGasFraction } from "../atmosphere/section.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { toSectionAtmosphereSnapshot } from "../atmosphere/atmosphere-snapshot.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import { NOMINAL_TEMPERATURE_CELSIUS } from "../atmosphere/thermal-parameters.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

const CABINA = "cabina" as SectionId;
const BODEGA = "bodega" as SectionId;

/** Plano mínimo: dos secciones adyacentes unidas por un conducto de ventilación abierto. */
function twoSectionFloorplan(): ShipFloorplan {
  return {
    id: "nave-test",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 4, height: 2 },
    sections: [
      { id: CABINA, nameKey: "section.cabina", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
      { id: BODEGA, nameKey: "section.bodega", cells: [{ x: 2, y: 0 }, { x: 3, y: 0 }] },
    ],
    conduits: [
      {
        id: "ventilacion:cabina:bodega:0" as ShipFloorplan["conduits"][number]["id"],
        a: CABINA,
        b: BODEGA,
        kind: "ventilacion",
        position: { x: 1.5, y: 0 },
        initialAperture: 1,
      },
    ],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

describe("MissionAtmosphereRuntime (Fase 11b, atmósfera viva en misión)", () => {
  it("seeds standard air per section when there is no saved snapshot", () => {
    const runtime = new MissionAtmosphereRuntime(twoSectionFloorplan(), []);
    const cabina = runtime.atmosphereOf(CABINA)!;
    expect(getGasFraction(cabina, GAS.OXYGEN)).toBeCloseTo(0.21);
  });

  it("restores a saved snapshot instead of standard air", () => {
    const savedCabina = toSectionAtmosphereSnapshot(CABINA, {
      gases: new Map([[GAS.OXYGEN, 0.05]]),
      temperatureCelsius: 4,
      pressureKpa: 80,
    });
    const runtime = new MissionAtmosphereRuntime(twoSectionFloorplan(), [savedCabina]);
    const cabina = runtime.atmosphereOf(CABINA)!;
    expect(getGasFraction(cabina, GAS.OXYGEN)).toBeCloseTo(0.05);
    expect(cabina.temperatureCelsius).toBe(4);
  });

  it("diffuses gas between connected sections on tick (reuses diffuse(), no reimplementation)", () => {
    const savedCabina = toSectionAtmosphereSnapshot(CABINA, {
      gases: new Map([[GAS.OXYGEN, 1]]),
      temperatureCelsius: 21,
      pressureKpa: 101,
    });
    const savedBodega = toSectionAtmosphereSnapshot(BODEGA, {
      gases: new Map([[GAS.OXYGEN, 0]]),
      temperatureCelsius: 21,
      pressureKpa: 101,
    });
    const runtime = new MissionAtmosphereRuntime(twoSectionFloorplan(), [savedCabina, savedBodega]);

    runtime.tick(tickOf(0, 1));

    const bodegaAfter = getGasFraction(runtime.atmosphereOf(BODEGA)!, GAS.OXYGEN);
    expect(bodegaAfter).toBeGreaterThan(0);
    expect(bodegaAfter).toBeLessThan(1);
  });

  it("round-trips the live state back into snapshots for toUpdatedSave", () => {
    const runtime = new MissionAtmosphereRuntime(twoSectionFloorplan(), []);
    const snapshots = runtime.toSnapshots();
    expect(snapshots.map((s) => s.sectionId).sort()).toEqual([BODEGA, CABINA].sort());
  });

  // 13f ronda 4: el signo del sumidero es lo único que distingue "se está
  // vaciando" de "se está volviendo a llenar", y la UI lo necesita para
  // explicar por qué una sala recién parchada sigue siendo letal un rato.
  describe("netPressureRateOf (diagnóstico de presión para la UI)", () => {
    it("expone la tasa de drenaje del último tick con el signo del sumidero", () => {
      const runtime = new MissionAtmosphereRuntime(
        twoSectionFloorplan(),
        [],
        () => new Map([[CABINA, 12]]),
      );
      runtime.tick(tickOf(0, 1));
      expect(runtime.netPressureRateOf(CABINA)).toBe(12);
    });

    it("devuelve tasa NEGATIVA cuando la sección está recuperando presión", () => {
      let sealed = false;
      const runtime = new MissionAtmosphereRuntime(
        twoSectionFloorplan(),
        [],
        () => new Map([[CABINA, sealed ? -2 : 12]]),
      );
      runtime.tick(tickOf(0, 1));
      expect(runtime.netPressureRateOf(CABINA)).toBeGreaterThan(0);

      sealed = true;
      runtime.tick(tickOf(1, 1));
      expect(runtime.netPressureRateOf(CABINA)).toBeLessThan(0);
    });

    it("devuelve 0 para una sección sin sumidero y para un id desconocido", () => {
      const runtime = new MissionAtmosphereRuntime(
        twoSectionFloorplan(),
        [],
        () => new Map([[CABINA, 12]]),
      );
      runtime.tick(tickOf(0, 1));
      expect(runtime.netPressureRateOf(BODEGA)).toBe(0);
      expect(runtime.netPressureRateOf("no-existe" as SectionId)).toBe(0);
    });

    it("devuelve 0 sin fuente de sumidero, sin romper el camino previo a 11h", () => {
      const runtime = new MissionAtmosphereRuntime(twoSectionFloorplan(), []);
      runtime.tick(tickOf(0, 1));
      expect(runtime.netPressureRateOf(CABINA)).toBe(0);
    });
  });
});

describe("MissionAtmosphereRuntime: temperatura (Subfase 14a-1)", () => {
  /** Firma posicional: sink, gasInjection, pressureFloor, aperture, heat. */
  function withHeat(rates: ReadonlyMap<SectionId, number>): MissionAtmosphereRuntime {
    return new MissionAtmosphereRuntime(
      twoSectionFloorplan(),
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      () => rates,
    );
  }

  it("sin fuente de calor, una nave en reposo se queda en el nominal", () => {
    const runtime = new MissionAtmosphereRuntime(twoSectionFloorplan(), []);
    for (let i = 0; i < 100; i += 1) {
      runtime.tick(tickOf(i, 1));
    }
    expect(runtime.atmosphereOf(CABINA)!.temperatureCelsius).toBeCloseTo(
      NOMINAL_TEMPERATURE_CELSIUS,
    );
  });

  it("la fuente de calor sube la temperatura de su sección", () => {
    const runtime = withHeat(new Map([[CABINA, 20]]));
    runtime.tick(tickOf(0, 1));
    expect(runtime.atmosphereOf(CABINA)!.temperatureCelsius).toBeGreaterThan(
      NOMINAL_TEMPERATURE_CELSIUS + 15,
    );
  });

  it("la deriva pasiva devuelve al nominal cuando el calor se corta", () => {
    let rates: ReadonlyMap<SectionId, number> = new Map([[CABINA, 40]]);
    const runtime = new MissionAtmosphereRuntime(
      twoSectionFloorplan(),
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      () => rates,
    );
    for (let i = 0; i < 5; i += 1) {
      runtime.tick(tickOf(i, 1));
    }
    const pico = runtime.atmosphereOf(CABINA)!.temperatureCelsius;
    expect(pico).toBeGreaterThan(100);

    rates = new Map();
    for (let i = 0; i < 400; i += 1) {
      runtime.tick(tickOf(i, 1));
    }
    expect(runtime.atmosphereOf(CABINA)!.temperatureCelsius).toBeCloseTo(
      NOMINAL_TEMPERATURE_CELSIUS,
      1,
    );
  });

  it("la deriva NO se pasa del nominal, ni con un dt enorme", () => {
    // Regresión de la deriva exponencial: con un `dt` grande, una fórmula
    // lineal cruzaría el objetivo y la sección terminaría más fría que el
    // nominal después de un incendio.
    const runtime = withHeat(new Map([[CABINA, 200]]));
    runtime.tick(tickOf(0, 1));
    const caliente = runtime.atmosphereOf(CABINA)!.temperatureCelsius;
    expect(caliente).toBeGreaterThan(NOMINAL_TEMPERATURE_CELSIUS);

    const enfriando = new MissionAtmosphereRuntime(twoSectionFloorplan(), [
      toSectionAtmosphereSnapshot(CABINA, {
        gases: new Map([[GAS.OXYGEN, 0.21]]),
        temperatureCelsius: 500,
        pressureKpa: 101,
      }),
    ]);
    enfriando.tick(tickOf(0, 1000));
    expect(enfriando.atmosphereOf(CABINA)!.temperatureCelsius).toBeGreaterThanOrEqual(
      NOMINAL_TEMPERATURE_CELSIUS,
    );
  });

  it("el calor de una sección se propaga a la contigua por el conducto", () => {
    const runtime = withHeat(new Map([[CABINA, 60]]));
    for (let i = 0; i < 10; i += 1) {
      runtime.tick(tickOf(i, 1));
    }
    const cabina = runtime.atmosphereOf(CABINA)!.temperatureCelsius;
    const bodega = runtime.atmosphereOf(BODEGA)!.temperatureCelsius;
    expect(bodega).toBeGreaterThan(NOMINAL_TEMPERATURE_CELSIUS);
    expect(bodega).toBeLessThan(cabina);
  });
});
