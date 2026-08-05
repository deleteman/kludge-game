import { describe, expect, it } from "vitest";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { CompositionError } from "../composition/composition-factory.js";
import { createPhysicalComponentFactory } from "../components/physical-component-factory.js";
import type {
  ComponentId,
  PhysicalComponentDefinition,
} from "../components/physical-component.types.js";
import { nameAndRegisterCreation } from "./creation-naming.js";
import { WorkbenchError, type WorkbenchPiece, type WorkbenchPieceId } from "./workbench-state.types.js";

function setup() {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  const factory = createPhysicalComponentFactory(registry);

  const motor = factory.buildAtomic({
    id: "motor-pequeno" as ComponentId,
    name: "Motor pequeño",
    data: { footprint: { width: 1, height: 1 } },
  });
  registry.register(motor.id, motor);

  const cable = factory.buildAtomic({
    id: "cable-cobre" as ComponentId,
    name: "Cable de cobre",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "COND", resourceType: "E", maxCapacity: 100 }],
    },
  });
  registry.register(cable.id, cable);

  const sensor = factory.buildAtomic({
    id: "fotorreceptor" as ComponentId,
    name: "Fotorreceptor",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "EM", range: 10, triggerType: "optical", frequency: 1 }],
    },
  });
  registry.register(sensor.id, sensor);

  const plancha = factory.buildAtomic({
    id: "plancha-metalica" as ComponentId,
    name: "Plancha metálica",
    data: { footprint: { width: 1, height: 1 }, material: { RE: "A", MAG: true, CE: "M", ES: "S" } },
  });
  registry.register(plancha.id, plancha);

  const lente = factory.buildAtomic({
    id: "lente" as ComponentId,
    name: "Lente",
    data: { footprint: { width: 1, height: 1 }, material: { RE: "B", CE: "N", ES: "S" } },
  });
  registry.register(lente.id, lente);

  return { registry, factory };
}

function piece(id: string, componentDefinitionId: string, x: number, y: number): WorkbenchPiece {
  return {
    id: id as WorkbenchPieceId,
    componentDefinitionId: componentDefinitionId as ComponentId,
    placement: { position: { x, y }, footprint: { width: 1, height: 1 }, rotation: 0 },
  };
}

describe("workbench: creation naming", () => {
  it("names and registers a new composite from workbench pieces", () => {
    const { registry, factory } = setup();
    const pieces = [piece("a", "motor-pequeno", 0, 0), piece("b", "cable-cobre", 1, 0)];

    const composite = nameAndRegisterCreation(factory, registry, pieces, {
      id: "mi-creacion" as ComponentId,
      name: "Mi creación",
    });

    expect(composite.level).toBe("composite");
    expect(composite.name).toBe("Mi creación");
    if (composite.level === "composite") {
      expect(composite.data.footprint).toEqual({ width: 2, height: 1 });
      expect(composite.recipe.ingredients).toEqual([
        { ref: "motor-pequeno", quantity: 1 },
        { ref: "cable-cobre", quantity: 1 },
      ]);
    }
    expect(registry.get("mi-creacion" as ComponentId)).toBe(composite);
  });

  it("aggregates the pieces' functional properties into the composite (11c.1: makes it wireable once installed)", () => {
    const { registry, factory } = setup();
    const pieces = [piece("a", "fotorreceptor", 0, 0), piece("b", "cable-cobre", 1, 0)];

    const composite = nameAndRegisterCreation(factory, registry, pieces, {
      id: "sensor-cableado" as ComponentId,
      name: "Sensor cableado",
    });

    if (composite.level === "composite") {
      expect(composite.data.functional).toEqual([
        { tag: "EM", range: 10, triggerType: "optical", frequency: 1 },
        { tag: "COND", resourceType: "E", maxCapacity: 100 },
      ]);
    }
  });

  it("aggregates the pieces' MATERIAL properties into the composite (deuda #6: para poder corroerse y ser ferromagnética)", () => {
    const { registry, factory } = setup();
    const pieces = [piece("a", "plancha-metalica", 0, 0), piece("b", "lente", 1, 0)];

    const composite = nameAndRegisterCreation(factory, registry, pieces, {
      id: "visor-blindado" as ComponentId,
      name: "Visor blindado",
    });

    if (composite.level === "composite") {
      // RE = peor de las partes (la lente frágil manda), MAG = OR, CE = mayor.
      expect(composite.data.material).toEqual({ CE: "M", MAG: true, RE: "B", ES: "S" });
    }
  });

  it("leaves material undefined when no piece declares any (compuestos puramente funcionales)", () => {
    const { registry, factory } = setup();
    const pieces = [piece("a", "fotorreceptor", 0, 0), piece("b", "cable-cobre", 1, 0)];

    const composite = nameAndRegisterCreation(factory, registry, pieces, {
      id: "sensor-cableado" as ComponentId,
      name: "Sensor cableado",
    });

    if (composite.level === "composite") {
      expect(composite.data.material).toBeUndefined();
    }
  });

  it("rejects an empty name", () => {
    const { registry, factory } = setup();
    const pieces = [piece("a", "motor-pequeno", 0, 0)];
    expect(() =>
      nameAndRegisterCreation(factory, registry, pieces, {
        id: "mi-creacion" as ComponentId,
        name: "   ",
      }),
    ).toThrow(WorkbenchError);
  });

  it("propagates a dangling recipe reference from the underlying CompositionFactory", () => {
    const { registry, factory } = setup();
    const pieces = [piece("a", "componente-inexistente", 0, 0)];
    expect(() =>
      nameAndRegisterCreation(factory, registry, pieces, {
        id: "mi-creacion" as ComponentId,
        name: "Mi creación",
      }),
    ).toThrow(CompositionError);
  });

  it("throws instead of silently defaulting when the workbench is empty", () => {
    const { registry, factory } = setup();
    expect(() =>
      nameAndRegisterCreation(factory, registry, [], {
        id: "mi-creacion" as ComponentId,
        name: "Mi creación",
      }),
    ).toThrow(WorkbenchError);
  });
});
