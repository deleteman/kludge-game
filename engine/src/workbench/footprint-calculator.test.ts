import { describe, expect, it } from "vitest";
import type { ComponentId } from "../components/physical-component.types.js";
import { calculateFootprint } from "./footprint-calculator.js";
import { WorkbenchError, type WorkbenchPiece, type WorkbenchPieceId } from "./workbench-state.types.js";

function piece(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270 = 0,
): WorkbenchPiece {
  return {
    id: id as WorkbenchPieceId,
    componentDefinitionId: "comp" as ComponentId,
    placement: { position: { x, y }, footprint: { width, height }, rotation },
  };
}

describe("workbench: footprint-calculator", () => {
  it("throws for an empty workbench instead of returning an undefined result", () => {
    expect(() => calculateFootprint([])).toThrow(WorkbenchError);
  });

  it("returns the piece's own footprint for a single piece", () => {
    expect(calculateFootprint([piece("a", 0, 0, 2, 3)])).toEqual({ width: 2, height: 3 });
  });

  it("computes the minimal bounding box including gaps between scattered pieces", () => {
    const pieces = [piece("a", 0, 0, 1, 1), piece("b", 4, 3, 1, 1)];
    expect(calculateFootprint(pieces)).toEqual({ width: 5, height: 4 });
  });

  it("shrinks the footprint for a compact arrangement vs. a scattered one", () => {
    const compact = [piece("a", 0, 0, 1, 1), piece("b", 1, 0, 1, 1)];
    const scattered = [piece("a", 0, 0, 1, 1), piece("b", 3, 0, 1, 1)];
    expect(calculateFootprint(compact)).toEqual({ width: 2, height: 1 });
    expect(calculateFootprint(scattered)).toEqual({ width: 4, height: 1 });
  });

  it("accounts for 90/270 rotation swapping a piece's effective width/height", () => {
    const rotated = piece("a", 0, 0, 2, 1, 90);
    expect(calculateFootprint([rotated])).toEqual({ width: 1, height: 2 });
  });

  it("leaves 0/180 rotation unaffecting the effective extent", () => {
    const rotated = piece("a", 0, 0, 2, 1, 180);
    expect(calculateFootprint([rotated])).toEqual({ width: 2, height: 1 });
  });
});
