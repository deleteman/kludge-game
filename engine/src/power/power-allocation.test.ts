import { describe, expect, it } from "vitest";
import { allocateComponentPower, allocateSectionBudget } from "./power-allocation.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { InstancePowerPriority } from "./power.types.js";

const SECTION_A = "puente" as SectionId;
const SECTION_B = "bahia-carga" as SectionId;

function instance(id: string, componentDefinitionId: string): PlacedComponentInstance {
  return {
    instanceId: id as PlacedComponentInstanceId,
    componentDefinitionId: componentDefinitionId as ComponentId,
    placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
    condition: "ok",
  };
}

function registryWithDraw(entries: ReadonlyArray<[string, number | undefined]>) {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  for (const [id, powerDraw] of entries) {
    registry.register(id as ComponentId, {
      level: "atomic",
      id: id as ComponentId,
      name: `${id} (fixture)`,
      data: {
        footprint: { width: 1, height: 1 },
        functional: [{ tag: "ACT", power: 1, cadence: 1, directional: false, powerDraw }],
      },
    });
  }
  return registry;
}

describe("allocateSectionBudget (Fase 13b, nivel 1: global→sección)", () => {
  it("refleja la asignación del jugador tal cual cuando el presupuesto alcanza", () => {
    const result = allocateSectionBudget(
      10,
      [
        { sectionId: SECTION_A, units: 3 },
        { sectionId: SECTION_B, units: 2 },
      ],
      [SECTION_A, SECTION_B],
    );
    expect(result.grantedBySectionId.get(SECTION_A)).toBe(3);
    expect(result.grantedBySectionId.get(SECTION_B)).toBe(2);
    expect(result.darkSectionIds.size).toBe(0);
  });

  it("una sección sin asignación queda a oscuras", () => {
    const result = allocateSectionBudget(10, [{ sectionId: SECTION_A, units: 3 }], [SECTION_A, SECTION_B]);
    expect(result.darkSectionIds.has(SECTION_B)).toBe(true);
    expect(result.grantedBySectionId.get(SECTION_B)).toBe(0);
  });

  it("sin ninguna fuente de energía instalada (presupuesto 0), todas las secciones quedan a oscuras", () => {
    const result = allocateSectionBudget(0, [], [SECTION_A, SECTION_B]);
    expect(result.darkSectionIds.size).toBe(2);
    expect(result.grantedBySectionId.get(SECTION_A)).toBe(0);
    expect(result.grantedBySectionId.get(SECTION_B)).toBe(0);
  });

  it("recorta proporcionalmente ante déficit global (pedido total > presupuesto total)", () => {
    const result = allocateSectionBudget(
      5,
      [
        { sectionId: SECTION_A, units: 3 },
        { sectionId: SECTION_B, units: 2 },
      ],
      [SECTION_A, SECTION_B],
    );
    const totalGranted = (result.grantedBySectionId.get(SECTION_A) ?? 0) + (result.grantedBySectionId.get(SECTION_B) ?? 0);
    expect(totalGranted).toBeLessThanOrEqual(5);
    expect(result.grantedBySectionId.get(SECTION_A)).toBeGreaterThan(result.grantedBySectionId.get(SECTION_B) ?? 0);
  });
});

describe("allocateComponentPower (Fase 13b, nivel 2: sección→componentes)", () => {
  it("triaje interno: la prioridad manual decide quién se apaga cuando el pool no alcanza", () => {
    const registry = registryWithDraw([
      ["sensor", 2],
      ["torreta", 3],
    ]);
    const instances = [instance("i-sensor", "sensor"), instance("i-torreta", "torreta")];
    const priorities: InstancePowerPriority[] = [
      { instanceId: "i-torreta" as PlacedComponentInstanceId, priority: 0 },
      { instanceId: "i-sensor" as PlacedComponentInstanceId, priority: 1 },
    ];

    const result = allocateComponentPower(3, instances, priorities, registry);

    expect(result.poweredInstanceIds.has("i-torreta" as PlacedComponentInstanceId)).toBe(true);
    expect(result.unpoweredInstanceIds.has("i-sensor" as PlacedComponentInstanceId)).toBe(true);
  });

  it("empate de prioridad se resuelve por instanceId de forma determinista", () => {
    const registry = registryWithDraw([
      ["a", 2],
      ["b", 2],
    ]);
    const instances = [instance("z-instance", "a"), instance("a-instance", "b")];

    const result = allocateComponentPower(2, instances, [], registry);

    expect(result.poweredInstanceIds.has("a-instance" as PlacedComponentInstanceId)).toBe(true);
    expect(result.unpoweredInstanceIds.has("z-instance" as PlacedComponentInstanceId)).toBe(true);
  });

  it("un componente sin powerDraw siempre está alimentado y no resta del pool", () => {
    const registry = registryWithDraw([
      ["gratis", undefined],
      ["caro", 5],
    ]);
    const instances = [instance("i-gratis", "gratis"), instance("i-caro", "caro")];
    const priorities: InstancePowerPriority[] = [{ instanceId: "i-gratis" as PlacedComponentInstanceId, priority: 0 }];

    const result = allocateComponentPower(0, instances, priorities, registry);

    expect(result.poweredInstanceIds.has("i-gratis" as PlacedComponentInstanceId)).toBe(true);
    expect(result.unpoweredInstanceIds.has("i-caro" as PlacedComponentInstanceId)).toBe(true);
  });
});
