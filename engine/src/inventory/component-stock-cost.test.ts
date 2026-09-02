import { describe, expect, it } from "vitest";

import { componentStockCost, stockCostKey } from "./component-stock-cost.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { createPhysicalComponentFactory } from "../components/physical-component-factory.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";

const PLANCHA = "plancha-metalica" as ComponentId;
const CABLE = "cable-cobre" as ComponentId;
const PARCHE = "parche-compuesto" as ComponentId;

function fixtureRegistry(): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  const factory = createPhysicalComponentFactory(registry);
  const plancha = factory.buildAtomic({
    id: PLANCHA,
    name: "Plancha metálica",
    data: { footprint: { width: 1, height: 1 } },
  });
  registry.register(plancha.id, plancha);
  const cable = factory.buildAtomic({
    id: CABLE,
    name: "Cable de cobre",
    data: { footprint: { width: 1, height: 1 } },
  });
  registry.register(cable.id, cable);
  const parche = factory.buildComposite({
    id: PARCHE,
    name: "Parche compuesto",
    data: { footprint: { width: 1, height: 1 } },
    recipe: {
      ingredients: [
        { ref: PLANCHA, quantity: 2 },
        { ref: CABLE, quantity: 1 },
      ],
    },
  });
  registry.register(parche.id, parche);
  return registry;
}

describe("componentStockCost", () => {
  it("charges one unit of the requested wear bucket for an atomic component", () => {
    expect(componentStockCost(fixtureRegistry(), PLANCHA, "usado", false)).toEqual([
      { ref: PLANCHA, wear: "usado", quantity: 1 },
    ]);
  });

  it("charges the recipe ingredients, always in the `nuevo` bucket, for a composite with consumeRecipe", () => {
    // El desgaste pedido para el compuesto NO se propaga a los ingredientes:
    // una receta exige piezas nuevas, no las degradadas que hubiera a mano.
    expect(componentStockCost(fixtureRegistry(), PARCHE, "degradado", true)).toEqual([
      { ref: PLANCHA, wear: "nuevo", quantity: 2 },
      { ref: CABLE, wear: "nuevo", quantity: 1 },
    ]);
  });

  it("charges nothing for a composite without consumeRecipe (a player creation already paid at the workbench)", () => {
    expect(componentStockCost(fixtureRegistry(), PARCHE, "nuevo", false)).toEqual([]);
  });

  it("charges nothing for an id the registry does not know", () => {
    expect(componentStockCost(fixtureRegistry(), "inexistente" as ComponentId, "nuevo", true)).toEqual([]);
  });

  it("keys a cost line by component AND wear bucket", () => {
    // Dos buckets de la misma pieza son dos reservas distintas: agregar por id
    // haría que reservar un cable usado bloqueara los nuevos.
    expect(stockCostKey(CABLE, "nuevo")).not.toBe(stockCostKey(CABLE, "usado"));
  });
});
