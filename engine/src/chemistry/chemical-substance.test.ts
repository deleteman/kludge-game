import { describe, expect, it } from "vitest";
import { isAtomicEntity, isCompositeEntity } from "../composition/composable-entity.types.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { createChemicalSubstanceFactory } from "./chemical-substance-factory.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "./chemical-substance.types.js";

// Fixtures sintéticas — NO son el catálogo real de GDD 5.4.1-5.4.2 (eso es Fase 4).
const FICTITIOUS_ELEMENT_X = "fixture-element-x" as ChemicalSubstanceId;
const FICTITIOUS_ELEMENT_Y = "fixture-element-y" as ChemicalSubstanceId;
const FICTITIOUS_COMPOUND_XY = "fixture-compound-xy" as ChemicalSubstanceId;

describe("chemistry: chemical substance factory (GDD 5.4.1-5.4.2)", () => {
  it("builds an element (Nivel 0) with 1-3 chemical tags", () => {
    const registry = new MapEntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>();
    const factory = createChemicalSubstanceFactory(registry);

    const elementX = factory.buildAtomic({
      id: FICTITIOUS_ELEMENT_X,
      name: "Fixture Element X",
      data: { tags: [{ name: "COMB" }, { name: "VOLAT" }] },
    });

    expect(isAtomicEntity(elementX)).toBe(true);
  });

  it("rejects an element with 0 or 4+ tags (reuses the same rule as the properties layer)", () => {
    const registry = new MapEntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>();
    const factory = createChemicalSubstanceFactory(registry);

    expect(() =>
      factory.buildAtomic({
        id: FICTITIOUS_ELEMENT_X,
        name: "Fixture Element X",
        data: { tags: [] },
      }),
    ).toThrow(/1-3 tags/);
  });

  it("builds a compound (Nivel 1) from a recipe of elements, using the same factory class as physical components", () => {
    const registry = new MapEntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>();
    const factory = createChemicalSubstanceFactory(registry);

    const elementX = factory.buildAtomic({
      id: FICTITIOUS_ELEMENT_X,
      name: "Fixture Element X",
      data: { tags: [{ name: "COMB" }] },
    });
    registry.register(elementX.id, elementX);

    const elementY = factory.buildAtomic({
      id: FICTITIOUS_ELEMENT_Y,
      name: "Fixture Element Y",
      data: { tags: [{ name: "OXI" }] },
    });
    registry.register(elementY.id, elementY);

    const compoundXY = factory.buildComposite({
      id: FICTITIOUS_COMPOUND_XY,
      name: "Fixture Compound XY",
      data: { tags: [{ name: "INERTE" }], state: "L" },
      recipe: {
        ingredients: [
          { ref: FICTITIOUS_ELEMENT_X, quantity: 1 },
          { ref: FICTITIOUS_ELEMENT_Y, quantity: 1 },
        ],
      },
    });

    expect(isCompositeEntity(compoundXY)).toBe(true);
    const resolved = factory.resolveIngredients(compoundXY.recipe);
    expect(resolved).toHaveLength(2);
    expect(resolved.every(({ entity }) => isAtomicEntity(entity))).toBe(true);
  });
});
