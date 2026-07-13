import { describe, expect, it } from "vitest";
import type { Footprint, GridPosition, PlacedFootprint, Rotation } from "./grid-position.types.js";

describe("geometry: grid position/footprint", () => {
  it("builds a GridPosition from integer-ish coordinates", () => {
    const position: GridPosition = { x: 3, y: 5 };
    expect(position).toEqual({ x: 3, y: 5 });
  });

  it("builds a Footprint independent of any grid pixel size", () => {
    const footprint: Footprint = { width: 2, height: 1 };
    expect(footprint.width).toBe(2);
    expect(footprint.height).toBe(1);
  });

  it("builds a PlacedFootprint combining position, footprint and rotation", () => {
    const rotation: Rotation = 90;
    const placed: PlacedFootprint = {
      position: { x: 0, y: 0 },
      footprint: { width: 2, height: 2 },
      rotation,
    };
    expect(placed.rotation).toBe(90);
    expect(placed.footprint).toEqual({ width: 2, height: 2 });
  });
});
