import { describe, expect, it } from "vitest";
import {
  candidateCellsInSection,
  rotateExteriorFootprint,
} from "./installation-placement.js";

describe("workbench: installation placement", () => {
  it("leaves 0/180 rotation unaffecting the exterior footprint", () => {
    expect(rotateExteriorFootprint({ width: 2, height: 1 }, 0)).toEqual({ width: 2, height: 1 });
    expect(rotateExteriorFootprint({ width: 2, height: 1 }, 180)).toEqual({ width: 2, height: 1 });
  });

  it("swaps width/height for 90/270 rotation", () => {
    expect(rotateExteriorFootprint({ width: 2, height: 1 }, 90)).toEqual({ width: 1, height: 2 });
    expect(rotateExteriorFootprint({ width: 2, height: 1 }, 270)).toEqual({ width: 1, height: 2 });
  });

  it("computes the absolute cells a footprint would occupy anchored at a position", () => {
    const cells = candidateCellsInSection({ width: 2, height: 1 }, { x: 3, y: 4 }, 0);
    expect(cells).toEqual([
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]);
  });

  it("applies rotation before computing candidate cells", () => {
    const cells = candidateCellsInSection({ width: 2, height: 1 }, { x: 0, y: 0 }, 90);
    expect(cells).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

});
