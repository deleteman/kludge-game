import { describe, expect, it } from "vitest";
import { LooseFerromagneticPromoter } from "./loose-ferromagnetic-promoter.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { ProjectileSimulation } from "../kinetics/projectile-simulation.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { Blueprint, PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ActiveCoil, CellOccupant, ProjectileWorld } from "../kinetics/projectile.types.js";

const instance = (value: string): PlacedComponentInstanceId => value as PlacedComponentInstanceId;
const componentId = (value: string): ComponentId => value as ComponentId;

/** Ferromagnético SUELTO: MAG sin conducción — candidato a proyectil. */
const IRON_PIECE: PhysicalComponentDefinition = {
  id: componentId("pieza-hierro"),
  name: "Pieza de hierro",
  level: "atomic",
  data: { footprint: { width: 1, height: 1 }, material: { MAG: true, RE: "A" } },
};

/** Bobina: MAG + conducción eléctrica — NUNCA debe promoverse (es la fuente, no el proyectil). */
const ELECTROMAGNET: PhysicalComponentDefinition = {
  id: componentId("electroiman"),
  name: "Electroimán improvisado",
  level: "atomic",
  data: {
    footprint: { width: 1, height: 1 },
    functional: [{ tag: "COND", resourceType: "E", maxCapacity: 100 }],
    material: { MAG: true, CE: "A" },
  },
};

/** Pieza sin MAG en absoluto: nunca candidata. */
const PLAIN_PANEL: PhysicalComponentDefinition = {
  id: componentId("panel"),
  name: "Panel liso",
  level: "atomic",
  data: { footprint: { width: 1, height: 1 } },
};

function registryOf(...definitions: PhysicalComponentDefinition[]): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  for (const definition of definitions) {
    registry.register(definition.id, definition);
  }
  return registry;
}

function placed(instanceId: string, definitionId: string, x: number, y: number): PlacedComponentInstance {
  return {
    instanceId: instance(instanceId),
    componentDefinitionId: componentId(definitionId),
    placement: { position: { x, y }, footprint: { width: 1, height: 1 }, rotation: 0 },
    condition: "ok",
    wear: "nuevo",
  };
}

function blueprintOf(placedComponents: PlacedComponentInstance[]): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: "t",
      name: "t",
      engineVersion: "0.0.0",
      createdAt: "2026-07-17",
      updatedAt: "2026-07-17",
    },
    placedComponents,
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

/** ProjectileWorld de mentira: no importa para este test, la promoción no lo consulta. */
class NoopWorld implements ProjectileWorld {
  occupantAt(): CellOccupant | null {
    return null;
  }
  activeCoils(): ReadonlyArray<ActiveCoil> {
    return [];
  }
}

describe("mission: LooseFerromagneticPromoter (Fase 11a.3, ASA 3 — el efecto emergente)", () => {
  it("promueve una pieza ferromagnética suelta: sale de placedComponents y aparece en la simulación", () => {
    const ship = new MutableShipState(blueprintOf([placed("hierro-1", "pieza-hierro", 5, 5)]));
    const projectiles = new ProjectileSimulation(new NoopWorld());
    const promoter = new LooseFerromagneticPromoter(ship, projectiles, registryOf(IRON_PIECE));

    promoter.promote();

    expect(ship.get().placedComponents).toHaveLength(0);
    expect(projectiles.all).toHaveLength(1);
    const state = projectiles.stateOf("hierro-1");
    expect(state?.position).toEqual({ x: 5, y: 5 });
    expect(state?.velocity).toBe("N");
  });

  it("NUNCA promueve una bobina (MAG + COND): es la fuente, no el proyectil", () => {
    const ship = new MutableShipState(blueprintOf([placed("bobina-1", "electroiman", 3, 0)]));
    const projectiles = new ProjectileSimulation(new NoopWorld());
    const promoter = new LooseFerromagneticPromoter(ship, projectiles, registryOf(ELECTROMAGNET));

    promoter.promote();

    expect(ship.get().placedComponents).toHaveLength(1);
    expect(projectiles.all).toHaveLength(0);
  });

  it("no promueve una pieza sin MAG en absoluto", () => {
    const ship = new MutableShipState(blueprintOf([placed("panel-1", "panel", 2, 2)]));
    const projectiles = new ProjectileSimulation(new NoopWorld());
    const promoter = new LooseFerromagneticPromoter(ship, projectiles, registryOf(PLAIN_PANEL));

    promoter.promote();

    expect(ship.get().placedComponents).toHaveLength(1);
    expect(projectiles.all).toHaveLength(0);
  });

  it("no promueve una pieza destruida", () => {
    const blueprint = blueprintOf([
      { ...placed("hierro-1", "pieza-hierro", 5, 5), condition: "destroyed" },
    ]);
    const ship = new MutableShipState(blueprint);
    const projectiles = new ProjectileSimulation(new NoopWorld());
    const promoter = new LooseFerromagneticPromoter(ship, projectiles, registryOf(IRON_PIECE));

    promoter.promote();

    expect(ship.get().placedComponents).toHaveLength(1);
    expect(projectiles.all).toHaveLength(0);
  });

  it("no duplica una pieza ya promovida en una pasada posterior", () => {
    const ship = new MutableShipState(blueprintOf([placed("hierro-1", "pieza-hierro", 5, 5)]));
    const projectiles = new ProjectileSimulation(new NoopWorld());
    const promoter = new LooseFerromagneticPromoter(ship, projectiles, registryOf(IRON_PIECE));

    promoter.promote();
    promoter.tick();
    promoter.tick();

    expect(projectiles.all).toHaveLength(1);
  });

  it("conserva el componentDefinitionId de catálogo accesible por ref tras promover (Fase 12f, deuda #5)", () => {
    const ship = new MutableShipState(blueprintOf([placed("hierro-1", "pieza-hierro", 5, 5)]));
    const projectiles = new ProjectileSimulation(new NoopWorld());
    const promoter = new LooseFerromagneticPromoter(ship, projectiles, registryOf(IRON_PIECE));

    promoter.promote();

    expect(promoter.definitionIdForRef("hierro-1")).toBe("pieza-hierro");
    expect(promoter.definitionIdForRef("inexistente")).toBeUndefined();
  });

  it("conserva otras piezas fijas intactas al promover una suelta entre ellas", () => {
    const ship = new MutableShipState(
      blueprintOf([placed("panel-1", "panel", 0, 0), placed("hierro-1", "pieza-hierro", 5, 5)]),
    );
    const projectiles = new ProjectileSimulation(new NoopWorld());
    const promoter = new LooseFerromagneticPromoter(ship, projectiles, registryOf(PLAIN_PANEL, IRON_PIECE));

    promoter.promote();

    expect(ship.get().placedComponents).toEqual([placed("panel-1", "panel", 0, 0)]);
    expect(projectiles.all).toHaveLength(1);
  });
});
