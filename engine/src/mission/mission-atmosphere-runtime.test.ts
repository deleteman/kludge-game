import { describe, expect, it } from "vitest";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import { getGasFraction } from "../atmosphere/section.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { toSectionAtmosphereSnapshot } from "../atmosphere/atmosphere-snapshot.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

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
        a: CABINA,
        b: BODEGA,
        kind: "ventilacion",
        position: { x: 1.5, y: 0 },
        initialAperture: 1,
      },
    ],
    anchors: [],
    componentSeeds: [],
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
});
