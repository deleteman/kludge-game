import { describe, expect, it } from "vitest";
import { effectiveResistance } from "../wear/effective-resistance.js";
import { MissionStructuralRuntime } from "./mission-structural-runtime.js";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { buildChemicalCatalog } from "../chemistry/catalog/build-chemical-catalog.js";
import { toSectionAtmosphereSnapshot } from "../atmosphere/atmosphere-snapshot.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

const CASCO = "casco-bahia-carga" as SectionId;
const INSTANCE = "hull-panel-1" as PlacedComponentInstanceId;
const ACIDO_BATERIA = "acido-de-bateria" as ChemicalSubstanceId;

function singleSectionFloorplan(): ShipFloorplan {
  return {
    id: "nave-test",
    archetype: "investigacion",
    nameKey: "ship.test.name",
    gridSize: { width: 2, height: 2 },
    sections: [{ id: CASCO, nameKey: "section.casco", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

function componentRegistryWithHullPanel(): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  registry.register("panel-casco" as ComponentId, {
    level: "atomic",
    id: "panel-casco" as ComponentId,
    name: "Panel de casco (fixture)",
    data: { footprint: { width: 1, height: 1 }, material: { RE: "A" } },
  });
  return registry;
}

function blueprintWithHullPanel(): Blueprint {
  return {
    metadata: {
      schemaVersion: 4,
      id: "t",
      name: "t",
      engineVersion: "0.0.0",
      createdAt: "2026-07-17",
      updatedAt: "2026-07-17",
    },
    placedComponents: [
      {
        instanceId: INSTANCE,
        componentDefinitionId: "panel-casco" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

describe("MissionStructuralRuntime (Fase 11b, cicatriz de RE por componente)", () => {
  it("degrades a placed instance's RE under sustained corrosive exposure and writes it back to the Blueprint", () => {
    const shipState = new MutableShipState(blueprintWithHullPanel());
    const floorplan = singleSectionFloorplan();
    const atmosphereRuntime = new MissionAtmosphereRuntime(floorplan, [
      toSectionAtmosphereSnapshot(CASCO, {
        gases: new Map([[ACIDO_BATERIA, 0.3]]),
        temperatureCelsius: 21,
        pressureKpa: 101,
      }),
    ]);
    const componentRegistry = componentRegistryWithHullPanel();
    const { registry: chemicalRegistry } = buildChemicalCatalog();

    const runtime = new MissionStructuralRuntime(
      shipState,
      floorplan,
      atmosphereRuntime,
      componentRegistry,
      chemicalRegistry,
    );

    // ~8s a corrosivo alto ya degrada un nivel (mismo umbral que case-07).
    for (let t = 0; t < 8; t++) {
      runtime.tick(tickOf(t));
    }

    const instance = shipState.get().placedComponents[0]!;
    // Fase 13c: la cicatriz se escribe como DESGASTE, no como override de RE.
    // El panel arranca en RE-A y `usado` = un escalón menos = RE efectiva M,
    // así que el ritmo observable de la Espec. §1 no cambió (mismos 8 ticks),
    // solo el campo donde queda registrado.
    expect(instance.wear).toBe("usado");
    expect(effectiveResistance("A", instance.wear)).toBe("M");
  });

  it("does not degrade a placed instance in a section with no corrosive exposure", () => {
    const shipState = new MutableShipState(blueprintWithHullPanel());
    const floorplan = singleSectionFloorplan();
    const atmosphereRuntime = new MissionAtmosphereRuntime(floorplan, []);
    const componentRegistry = componentRegistryWithHullPanel();
    const { registry: chemicalRegistry } = buildChemicalCatalog();

    const runtime = new MissionStructuralRuntime(
      shipState,
      floorplan,
      atmosphereRuntime,
      componentRegistry,
      chemicalRegistry,
    );

    for (let t = 0; t < 20; t++) {
      runtime.tick(tickOf(t));
    }

    const instance = shipState.get().placedComponents[0]!;
    expect(instance.structuralResistanceOverride).toBeUndefined();
  });
});
