import { describe, expect, it } from "vitest";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { createPhysicalComponentFactory } from "../components/physical-component-factory.js";
import type {
  ComponentId,
  PhysicalComponentDefinition,
} from "../components/physical-component.types.js";
import { validateBlueprintIntegrity } from "../blueprint/blueprint-integrity.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { FloorplanSection } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import { addPiece, createEmptyWorkbenchState, type WorkbenchPieceId } from "./workbench-state.types.js";
import { addSignalNode, connectNodes } from "./workbench-signal-adapter.js";
import { nameAndRegisterCreation } from "./creation-naming.js";
import { installCreationInFloorplan } from "./installation.js";
import {
  exposeExternalPorts,
  mergeInstalledSignalGraph,
  translateWorkbenchNodesToBlueprint,
  wireExternalPort,
} from "./port-wiring.js";

const rectSection: FloorplanSection = {
  id: "puente" as SectionId,
  nameKey: "section.puente",
  cells: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
};

function emptyBlueprintWithExistingNode(): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: "power-bus" as PlacedComponentInstanceId,
        componentDefinitionId: "generador-electrico" as ComponentId,
        placement: { position: { x: 2, y: 1 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: {
      nodes: [
        {
          id: "power-bus-output" as SignalNodeId,
          role: "emitter",
          position: { x: 2, y: 1 },
          ownerRef: "power-bus" as PlacedComponentInstanceId,
        },
      ],
      edges: [],
    },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

describe("workbench: end-to-end (place -> name -> install -> wire)", () => {
  it("takes a creation from workbench pieces through installation without automatic wiring, then wires it manually", () => {
    // 1. Colocar piezas en la mesa (grid de composición espacial, punto 1).
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
      data: { footprint: { width: 1, height: 1 } },
    });
    registry.register(cable.id, cable);

    let workbench = createEmptyWorkbenchState();
    workbench = addPiece(workbench, {
      id: "piece-motor" as WorkbenchPieceId,
      componentDefinitionId: "motor-pequeno" as ComponentId,
      placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
    });
    workbench = addPiece(workbench, {
      id: "piece-cable" as WorkbenchPieceId,
      componentDefinitionId: "cable-cobre" as ComponentId,
      placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
    });
    workbench = addSignalNode(
      workbench,
      "internal-in" as SignalNodeId,
      "piece-motor" as WorkbenchPieceId,
      "receptor",
      { x: 0, y: 0 },
    );
    workbench = addSignalNode(
      workbench,
      "internal-out" as SignalNodeId,
      "piece-cable" as WorkbenchPieceId,
      "conductor",
      { x: 1, y: 0 },
    );
    workbench = connectNodes(
      workbench,
      "internal-edge" as SignalEdgeId,
      "internal-in" as SignalNodeId,
      "internal-out" as SignalNodeId,
    );

    // 2. Nombrar (footprint dinámico + registro como compuesto nuevo, punto 2).
    const creation = nameAndRegisterCreation(factory, registry, workbench.pieces, {
      id: "propulsor-improvisado" as ComponentId,
      name: "Propulsor improvisado",
    });
    expect(creation.level).toBe("composite");
    const creationFootprint =
      creation.level === "composite" ? creation.data.footprint! : undefined;
    expect(creationFootprint).toEqual({ width: 2, height: 1 });

    // 3. Instalar en el plano (validación de espacio, punto 2).
    const blueprintBeforeInstall = emptyBlueprintWithExistingNode();
    const installResult = installCreationInFloorplan(
      blueprintBeforeInstall,
      rectSection,
      creation.id,
      creationFootprint!,
      { x: 0, y: 1 },
      0,
      "propulsor-instance-1" as PlacedComponentInstanceId,
    );
    expect(installResult.outcome).toBe("installed");
    if (installResult.outcome !== "installed") return;

    // Instalar no conecta automáticamente (GDD 10.1 párrafo 7) — chequeo negativo explícito.
    expect(installResult.blueprint.signalGraph.edges).toEqual(
      blueprintBeforeInstall.signalGraph.edges,
    );

    // 4. Incorporar el grafo interno de la creación al plano (aún sin conexión externa).
    const translatedGraph = translateWorkbenchNodesToBlueprint(
      workbench.signalGraph,
      installResult.instanceId,
      { x: 0, y: 1 },
    );
    const blueprintWithInternalWiring = mergeInstalledSignalGraph(
      installResult.blueprint,
      translatedGraph,
    );
    expect(validateBlueprintIntegrity(blueprintWithInternalWiring)).toEqual([]);

    const exposedPorts = exposeExternalPorts(blueprintWithInternalWiring, installResult.instanceId);
    expect(exposedPorts).toHaveLength(2);
    expect(
      blueprintWithInternalWiring.signalGraph.edges.some(
        (edge) => edge.from === "power-bus-output" || edge.to === "power-bus-output",
      ),
    ).toBe(false);

    // 5. Conexión externa de puertos (punto 3): cablear manualmente el puerto externo.
    const finalBlueprint = wireExternalPort(
      blueprintWithInternalWiring,
      "external-edge" as SignalEdgeId,
      "power-bus-output" as SignalNodeId,
      "internal-in" as SignalNodeId,
    );

    expect(validateBlueprintIntegrity(finalBlueprint)).toEqual([]);
    expect(
      finalBlueprint.signalGraph.edges.some(
        (edge) => edge.from === "power-bus-output" && edge.to === "internal-in",
      ),
    ).toBe(true);
  });
});
