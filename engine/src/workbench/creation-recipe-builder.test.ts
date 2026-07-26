import { describe, expect, it } from "vitest";
import type { ComponentId } from "../components/physical-component.types.js";
import { buildRecipeFromPieces } from "./creation-recipe-builder.js";
import type { WorkbenchPiece, WorkbenchPieceId } from "./workbench-state.types.js";

function piece(id: string, componentDefinitionId: string, x: number, y: number): WorkbenchPiece {
  return {
    id: id as WorkbenchPieceId,
    componentDefinitionId: componentDefinitionId as ComponentId,
    placement: { position: { x, y }, footprint: { width: 1, height: 1 }, rotation: 0 },
  };
}

describe("workbench: creation recipe builder", () => {
  it("builds one ingredient per unique component id", () => {
    const recipe = buildRecipeFromPieces([
      piece("a", "motor-pequeno", 0, 0),
      piece("b", "cable-cobre", 1, 0),
    ]);
    expect(recipe.ingredients).toEqual([
      { ref: "motor-pequeno", quantity: 1 },
      { ref: "cable-cobre", quantity: 1 },
    ]);
  });

  it("aggregates repeated pieces of the same component into one ingredient with summed quantity", () => {
    const recipe = buildRecipeFromPieces([
      piece("a", "motor-pequeno", 0, 0),
      piece("b", "motor-pequeno", 1, 0),
      piece("c", "cable-cobre", 2, 0),
    ]);
    expect(recipe.ingredients).toEqual([
      { ref: "motor-pequeno", quantity: 2 },
      { ref: "cable-cobre", quantity: 1 },
    ]);
  });

  it("preserves the order of first appearance", () => {
    const recipe = buildRecipeFromPieces([
      piece("a", "cable-cobre", 0, 0),
      piece("b", "motor-pequeno", 1, 0),
      piece("c", "cable-cobre", 2, 0),
    ]);
    expect(recipe.ingredients.map((ingredient) => ingredient.ref)).toEqual([
      "cable-cobre",
      "motor-pequeno",
    ]);
  });
});
