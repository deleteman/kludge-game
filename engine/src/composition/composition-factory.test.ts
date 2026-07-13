import { describe, expect, it } from "vitest";
import { isAtomicEntity, isCompositeEntity } from "./composable-entity.types.js";
import type { ComposableEntity } from "./composable-entity.types.js";
import { CompositionError, CompositionFactory } from "./composition-factory.js";
import { MapEntityRegistry } from "./entity-registry.js";

interface FixtureData {
  readonly label: string;
}

type FixtureEntity = ComposableEntity<string, FixtureData, FixtureData, string>;

function buildRegistryAndFactory(): {
  registry: MapEntityRegistry<string, FixtureEntity>;
  factory: CompositionFactory<string, FixtureData, FixtureData, string>;
} {
  const registry = new MapEntityRegistry<string, FixtureEntity>();
  const factory = new CompositionFactory<string, FixtureData, FixtureData, string>(registry, {
    validateAtomicData: (data) => {
      if (data.label.trim().length === 0) {
        throw new CompositionError("Atomic fixture label must not be empty");
      }
    },
  });
  return { registry, factory };
}

describe("composition: CompositionFactory", () => {
  it("builds an atomic entity", () => {
    const { factory } = buildRegistryAndFactory();
    const atomic = factory.buildAtomic({
      id: "widget-a",
      name: "Widget A",
      data: { label: "atom" },
    });

    expect(isAtomicEntity(atomic)).toBe(true);
    expect(atomic.level).toBe("atomic");
  });

  it("rejects an atomic entity that fails the domain-specific validation hook", () => {
    const { factory } = buildRegistryAndFactory();
    expect(() =>
      factory.buildAtomic({ id: "widget-a", name: "Widget A", data: { label: "" } }),
    ).toThrow(CompositionError);
  });

  it("builds a composite entity (Nivel 1) from a recipe of atomic parts", () => {
    const { registry, factory } = buildRegistryAndFactory();
    const atom = factory.buildAtomic({ id: "widget-a", name: "Widget A", data: { label: "atom" } });
    registry.register(atom.id, atom);

    const compound = factory.buildComposite({
      id: "widget-b",
      name: "Widget B",
      data: { label: "compound" },
      recipe: { ingredients: [{ ref: "widget-a", quantity: 2 }] },
    });

    expect(isCompositeEntity(compound)).toBe(true);
    expect(compound.recipe.ingredients).toEqual([{ ref: "widget-a", quantity: 2 }]);
  });

  it("emerges Nivel 2 (ensamblaje) for free: a composite recipe can reference another composite", () => {
    const { registry, factory } = buildRegistryAndFactory();
    const atom = factory.buildAtomic({ id: "widget-a", name: "Widget A", data: { label: "atom" } });
    registry.register(atom.id, atom);

    const compound = factory.buildComposite({
      id: "widget-b",
      name: "Widget B",
      data: { label: "compound" },
      recipe: { ingredients: [{ ref: "widget-a", quantity: 1 }] },
    });
    registry.register(compound.id, compound);

    const assembly = factory.buildComposite({
      id: "widget-c",
      name: "Widget C (assembly)",
      data: { label: "assembly" },
      recipe: { ingredients: [{ ref: "widget-b", quantity: 1 }] },
    });
    registry.register(assembly.id, assembly);

    const resolved = factory.resolveIngredients(assembly.recipe);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.entity.id).toBe("widget-b");
    expect(isCompositeEntity(resolved[0]!.entity)).toBe(true);
  });

  it("rejects a recipe with a dangling reference", () => {
    const { factory } = buildRegistryAndFactory();
    expect(() =>
      factory.buildComposite({
        id: "widget-b",
        name: "Widget B",
        data: { label: "compound" },
        recipe: { ingredients: [{ ref: "does-not-exist", quantity: 1 }] },
      }),
    ).toThrow(/Dangling recipe reference/);
  });

  it("rejects a recipe with a non-positive quantity", () => {
    const { registry, factory } = buildRegistryAndFactory();
    const atom = factory.buildAtomic({ id: "widget-a", name: "Widget A", data: { label: "atom" } });
    registry.register(atom.id, atom);

    expect(() =>
      factory.buildComposite({
        id: "widget-b",
        name: "Widget B",
        data: { label: "compound" },
        recipe: { ingredients: [{ ref: "widget-a", quantity: 0 }] },
      }),
    ).toThrow(/Invalid ingredient quantity/);
  });

  it("resolveIngredients throws CompositionError for a dangling reference", () => {
    const { factory } = buildRegistryAndFactory();
    expect(() =>
      factory.resolveIngredients({ ingredients: [{ ref: "ghost", quantity: 1 }] }),
    ).toThrow(CompositionError);
  });
});
