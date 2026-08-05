import { describe, expect, it } from "vitest";
import { buildComponentCatalog } from "../components/catalog/build-component-catalog.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import { totalPowerBudget } from "./power-source.js";

const REGISTRY = buildComponentCatalog().registry;

function instanceOf(instanceId: string, componentDefinitionId: string): PlacedComponentInstance {
  return {
    instanceId: instanceId as PlacedComponentInstanceId,
    componentDefinitionId: componentDefinitionId as ComponentId,
    placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
    condition: "ok",
    wear: "nuevo",
  };
}

describe("totalPowerBudget", () => {
  it("suma las unidades de cada fuente RES(E) instalada", () => {
    const placed = [
      instanceOf("bat-1", "bateria-celda-simple"), // 1 unidad
      instanceOf("panel-1", "celula-fotovoltaica"), // 2 unidades
      instanceOf("cable-1", "cable-cobre"), // no es fuente
    ];
    expect(totalPowerBudget(placed, REGISTRY)).toBe(3);
  });

  it("13d: una fuente descargada deja de aportar — ese es el precio de asegurarla", () => {
    const placed = [instanceOf("bat-1", "bateria-celda-simple"), instanceOf("panel-1", "celula-fotovoltaica")];
    expect(totalPowerBudget(placed, REGISTRY, ["panel-1" as PlacedComponentInstanceId])).toBe(1);
  });
});
