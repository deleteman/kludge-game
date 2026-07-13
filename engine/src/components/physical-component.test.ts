import { describe, expect, it } from "vitest";
import { CompositionError } from "../composition/composition-factory.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { isAtomicEntity, isCompositeEntity } from "../composition/composable-entity.types.js";
import { createPhysicalComponentFactory } from "./physical-component-factory.js";
import type { ComponentId, PhysicalComponentDefinition } from "./physical-component.types.js";

// Fixtures sintéticas — NO son el catálogo real de GDD 7.2-7.6 (eso es Fase 4).
const FICTITIOUS_WIRE = "fixture-wire" as ComponentId;
const FICTITIOUS_SENSOR = "fixture-sensor" as ComponentId;
const FICTITIOUS_TURRET = "fixture-turret" as ComponentId;

describe("components: physical component factory (GDD 7.1-7.2)", () => {
  it("builds an atomic component (Nivel 0) with a fixed footprint", () => {
    const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
    const factory = createPhysicalComponentFactory(registry);

    const wire = factory.buildAtomic({
      id: FICTITIOUS_WIRE,
      name: "Fixture Wire",
      data: { footprint: { width: 1, height: 1 }, material: { CE: "A" } },
    });

    expect(isAtomicEntity(wire)).toBe(true);
    expect(wire.data.footprint).toEqual({ width: 1, height: 1 });
  });

  it("rejects an atomic component with a non-positive footprint", () => {
    const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
    const factory = createPhysicalComponentFactory(registry);

    expect(() =>
      factory.buildAtomic({
        id: FICTITIOUS_WIRE,
        name: "Fixture Wire",
        data: { footprint: { width: 0, height: 1 } },
      }),
    ).toThrow(CompositionError);
  });

  it("assembles a 3-level chain (átomo→compuesto→ensamblaje) without a dedicated Assembly type", () => {
    const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
    const factory = createPhysicalComponentFactory(registry);

    const wire = factory.buildAtomic({
      id: FICTITIOUS_WIRE,
      name: "Fixture Wire",
      data: { footprint: { width: 1, height: 1 } },
    });
    registry.register(wire.id, wire);

    // Nivel 1: compuesto construido desde piezas atómicas.
    const sensor = factory.buildComposite({
      id: FICTITIOUS_SENSOR,
      name: "Fixture Sensor",
      data: { functional: [{ tag: "EM", range: 3, triggerType: "motion", frequency: 1 }] },
      recipe: { ingredients: [{ ref: FICTITIOUS_WIRE, quantity: 2 }] },
    });
    registry.register(sensor.id, sensor);

    // Nivel 2: ensamblaje construido desde OTRO compuesto, no desde átomos.
    const turret = factory.buildComposite({
      id: FICTITIOUS_TURRET,
      name: "Fixture Turret",
      data: { functional: [{ tag: "ACT", power: 10, cadence: 1, directional: true }] },
      recipe: { ingredients: [{ ref: FICTITIOUS_SENSOR, quantity: 1 }] },
    });
    registry.register(turret.id, turret);

    expect(isCompositeEntity(turret)).toBe(true);
    const resolved = factory.resolveIngredients(turret.recipe);
    expect(resolved).toHaveLength(1);
    expect(isCompositeEntity(resolved[0]!.entity)).toBe(true);
    expect(resolved[0]!.entity.id).toBe(FICTITIOUS_SENSOR);
  });
});
