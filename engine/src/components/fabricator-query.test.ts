import { describe, expect, it } from "vitest";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { buildComponentCatalog } from "./catalog/build-component-catalog.js";
import {
  fabricatorDomainOf,
  findFabricators,
  hasFabricator,
  instanceFabricatorDomain,
} from "./fabricator-query.js";
import { INITIAL_SHIP_STATE_BY_ARCHETYPE } from "../floorplan/initial-ship-state.js";
import { SHIP_ARCHETYPES } from "../floorplan/floorplan.types.js";
import type { Blueprint, PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "./physical-component.types.js";

const { registry } = buildComponentCatalog();

function instance(
  id: string,
  definitionId: string,
  condition: PlacedComponentInstance["condition"] = "ok",
): PlacedComponentInstance {
  return {
    instanceId: id as PlacedComponentInstanceId,
    componentDefinitionId: definitionId as ComponentId,
    placement: { position: { x: 0, y: 0 }, footprint: { width: 2, height: 2 }, rotation: 0 },
    condition,
    wear: "nuevo",
  };
}

function blueprintWith(...placedComponents: PlacedComponentInstance[]): Blueprint {
  return {
    metadata: {
      schemaVersion: 8,
      id: "fixture",
      name: "fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    },
    placedComponents,
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { allocationsBySection: {}, componentPriorityByInstance: {}, permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  } as unknown as Blueprint;
}

describe("fabricatorDomainOf", () => {
  it("lee el dominio de la propiedad FAB del catálogo", () => {
    expect(fabricatorDomainOf(registry.get("banco-de-trabajo" as ComponentId))).toBe("fisica");
    expect(fabricatorDomainOf(registry.get("estacion-quimica" as ComponentId))).toBe("quimica");
  });

  it("devuelve undefined para una pieza sin FAB y para una definición ausente", () => {
    expect(fabricatorDomainOf(registry.get("plancha-metalica" as ComponentId))).toBeUndefined();
    expect(fabricatorDomainOf(undefined)).toBeUndefined();
  });

  it("no depende del ComponentId: cualquier pieza que declare FAB habilita su mesa", () => {
    // Principio 1 — la identificación es por propiedad, nunca por identidad.
    const improvised = {
      id: "creation-9999" as ComponentId,
      data: { functional: [{ tag: "FAB", domain: "quimica" }] },
    } as unknown as PhysicalComponentDefinition;
    expect(fabricatorDomainOf(improvised)).toBe("quimica");
  });
});

describe("instanceFabricatorDomain", () => {
  it("un aparato destruido deja de habilitar su mesa", () => {
    expect(instanceFabricatorDomain(instance("a", "banco-de-trabajo"), registry)).toBe("fisica");
    expect(
      instanceFabricatorDomain(instance("a", "banco-de-trabajo", "destroyed"), registry),
    ).toBeUndefined();
  });

  it("un aparato atascado sigue habilitándola", () => {
    expect(instanceFabricatorDomain(instance("a", "banco-de-trabajo", "jammed"), registry)).toBe(
      "fisica",
    );
  });
});

describe("findFabricators / hasFabricator", () => {
  it("filtra por dominio", () => {
    const blueprint = blueprintWith(
      instance("banco", "banco-de-trabajo"),
      instance("estacion", "estacion-quimica"),
      instance("chatarra", "plancha-metalica"),
    );
    expect(findFabricators(blueprint, registry, "fisica")).toEqual(["banco"]);
    expect(findFabricators(blueprint, registry, "quimica")).toEqual(["estacion"]);
    expect(hasFabricator(blueprint, registry, "fisica")).toBe(true);
  });

  it("una nave sin aparatos no habilita ninguna mesa", () => {
    const blueprint = blueprintWith(instance("chatarra", "plancha-metalica"));
    expect(hasFabricator(blueprint, registry, "fisica")).toBe(false);
    expect(hasFabricator(blueprint, registry, "quimica")).toBe(false);
  });

  it("un registry vacío no resuelve ningún aparato", () => {
    const empty = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
    expect(hasFabricator(blueprintWith(instance("banco", "banco-de-trabajo")), empty, "fisica")).toBe(
      false,
    );
  });
});

describe("kit inicial por arquetipo", () => {
  it.each(SHIP_ARCHETYPES)("%s nace con exactamente un aparato de cada dominio", (archetype) => {
    const blueprint = blueprintWith(...INITIAL_SHIP_STATE_BY_ARCHETYPE[archetype]);
    expect(findFabricators(blueprint, registry, "fisica")).toHaveLength(1);
    expect(findFabricators(blueprint, registry, "quimica")).toHaveLength(1);
  });

  it.each(SHIP_ARCHETYPES)("%s no solapa los dos aparatos entre sí", (archetype) => {
    const cells = new Set<string>();
    for (const placed of INITIAL_SHIP_STATE_BY_ARCHETYPE[archetype]) {
      const { position, footprint } = placed.placement;
      for (let dx = 0; dx < footprint.width; dx += 1) {
        for (let dy = 0; dy < footprint.height; dy += 1) {
          const key = `${position.x + dx},${position.y + dy}`;
          expect(cells.has(key)).toBe(false);
          cells.add(key);
        }
      }
    }
  });
});
