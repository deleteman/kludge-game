import { describe, expect, it } from "vitest";
import type { ComponentId } from "../components/physical-component.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { Blueprint } from "../blueprint/blueprint.types.js";
import type { SignalEdgeId } from "../signals/signal-edge.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { SignalGraph } from "../signals/signal-graph.types.js";
import {
  assertSignalWiringReachable,
  exposeExternalPorts,
  mergeInstalledSignalGraph,
  SignalWiringUnreachableError,
  translateWorkbenchNodesToBlueprint,
  wireExternalPort,
} from "./port-wiring.js";
import { WorkbenchError, type WorkbenchPieceId } from "./workbench-state.types.js";
import type { ConduitConnection, ConduitKind, ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

const nodeId = (value: string) => value as SignalNodeId;
const edgeId = (value: string) => value as SignalEdgeId;
const instanceId = (value: string) => value as PlacedComponentInstanceId;

function blueprintWith(signalGraph: SignalGraph<PlacedComponentInstanceId>): Blueprint {
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
        instanceId: instanceId("existing-node-owner"),
        componentDefinitionId: "comp" as ComponentId,
        placement: { position: { x: 5, y: 5 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
      {
        instanceId: instanceId("creation-1"),
        componentDefinitionId: "mi-creacion" as ComponentId,
        placement: { position: { x: 2, y: 3 }, footprint: { width: 2, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph,
    sectionAtmospheres: [],
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    doorStates: [],
    valveApertures: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

describe("workbench: port wiring", () => {
  it("translates workbench-local node positions to blueprint-global positions under one owner", () => {
    const workbenchGraph: SignalGraph<WorkbenchPieceId> = {
      nodes: [
        {
          id: nodeId("n1"),
          role: "emitter",
          position: { x: 0, y: 0 },
          ownerRef: "piece-a" as WorkbenchPieceId,
        },
        {
          id: nodeId("n2"),
          role: "receptor",
          position: { x: 1, y: 0 },
          ownerRef: "piece-b" as WorkbenchPieceId,
        },
      ],
      edges: [{ id: edgeId("e-internal"), from: nodeId("n1"), to: nodeId("n2") }],
    };

    const translated = translateWorkbenchNodesToBlueprint(
      workbenchGraph,
      instanceId("creation-1"),
      { x: 2, y: 3 },
    );

    expect(translated.nodes).toEqual([
      { id: nodeId("n1"), role: "emitter", position: { x: 2, y: 3 }, ownerRef: instanceId("creation-1") },
      { id: nodeId("n2"), role: "receptor", position: { x: 3, y: 3 }, ownerRef: instanceId("creation-1") },
    ]);
    expect(translated.edges).toBe(workbenchGraph.edges);
  });

  it("exposes only the nodes owned by the installed instance", () => {
    const blueprint = blueprintWith({
      nodes: [
        {
          id: nodeId("n1"),
          role: "emitter",
          position: { x: 2, y: 3 },
          ownerRef: instanceId("creation-1"),
        },
        {
          id: nodeId("existing-node"),
          role: "receptor",
          position: { x: 5, y: 5 },
          ownerRef: instanceId("existing-node-owner"),
        },
      ],
      edges: [],
    });

    const exposed = exposeExternalPorts(blueprint, instanceId("creation-1"));
    expect(exposed.map((node) => node.id)).toEqual([nodeId("n1")]);
  });

  it("merges a translated signal graph into the blueprint's own signal graph", () => {
    const blueprint = blueprintWith({ nodes: [], edges: [] });
    const translated = translateWorkbenchNodesToBlueprint(
      {
        nodes: [
          {
            id: nodeId("n1"),
            role: "emitter",
            position: { x: 0, y: 0 },
            ownerRef: "piece-a" as WorkbenchPieceId,
          },
        ],
        edges: [],
      },
      instanceId("creation-1"),
      { x: 2, y: 3 },
    );

    const merged = mergeInstalledSignalGraph(blueprint, translated);
    expect(merged.signalGraph.nodes).toEqual([
      { id: nodeId("n1"), role: "emitter", position: { x: 2, y: 3 }, ownerRef: instanceId("creation-1") },
    ]);
  });

  it("wires an external port to an existing node in the plan, without installation implying it automatically", () => {
    const blueprint = blueprintWith({
      nodes: [
        {
          id: nodeId("n1"),
          role: "emitter",
          position: { x: 2, y: 3 },
          ownerRef: instanceId("creation-1"),
        },
        {
          id: nodeId("existing-node"),
          role: "receptor",
          position: { x: 5, y: 5 },
          ownerRef: instanceId("existing-node-owner"),
        },
      ],
      edges: [],
    });

    // Instalar no conecta automáticamente (GDD 10.1): antes de cablear, no hay edges.
    expect(blueprint.signalGraph.edges).toEqual([]);

    const wired = wireExternalPort(blueprint, edgeId("e-external"), nodeId("n1"), nodeId("existing-node"));
    expect(wired.signalGraph.edges).toEqual([
      { id: edgeId("e-external"), from: nodeId("n1"), to: nodeId("existing-node"), toPort: undefined },
    ]);
  });

  it("rejects wiring a node to itself", () => {
    const blueprint = blueprintWith({ nodes: [], edges: [] });
    expect(() => wireExternalPort(blueprint, edgeId("e1"), nodeId("n1"), nodeId("n1"))).toThrow(
      WorkbenchError,
    );
  });

  it("rejects wiring to a node that does not exist in the blueprint's signal graph", () => {
    const blueprint = blueprintWith({
      nodes: [
        {
          id: nodeId("n1"),
          role: "emitter",
          position: { x: 2, y: 3 },
          ownerRef: instanceId("creation-1"),
        },
      ],
      edges: [],
    });
    expect(() =>
      wireExternalPort(blueprint, edgeId("e1"), nodeId("n1"), nodeId("missing")),
    ).toThrow(WorkbenchError);
  });
});

describe("assertSignalWiringReachable (Fase 11f: cableado restringido por conducto)", () => {
  const conduit = (a: string, b: string, kind: ConduitKind): ConduitConnection => ({
    id: `${kind}:${a}:${b}` as ConduitConnection["id"],
    a: a as SectionId,
    b: b as SectionId,
    kind,
    position: { x: 0, y: 0 },
    initialAperture: 1,
  });

  /** `alfa` = celda (2,3); `beta` = celda (5,5); una celda suelta (9,9) fuera de toda sección. */
  const floorplanWith = (conduits: ConduitConnection[]): ShipFloorplan => ({
    id: "nave-test",
    archetype: "exploracion",
    nameKey: "ship.test.name",
    gridSize: { width: 12, height: 12 },
    sections: [
      { id: "alfa" as SectionId, nameKey: "section.alfa", cells: [{ x: 2, y: 3 }] },
      { id: "beta" as SectionId, nameKey: "section.beta", cells: [{ x: 5, y: 5 }] },
    ],
    conduits,
    anchors: [],
    componentSeeds: [],
    doors: [],
  });

  const graph: SignalGraph<PlacedComponentInstanceId> = {
    nodes: [
      { id: nodeId("en-alfa"), role: "emitter", position: { x: 2, y: 3 }, ownerRef: instanceId("o1") },
      { id: nodeId("en-beta"), role: "receptor", position: { x: 5, y: 5 }, ownerRef: instanceId("o2") },
      { id: nodeId("en-la-nada"), role: "receptor", position: { x: 9, y: 9 }, ownerRef: instanceId("o3") },
    ],
    edges: [],
  };

  it("permite cablear dos nodos de la MISMA sección sin conducto", () => {
    const floorplan = floorplanWith([]);
    const sameSectionGraph: SignalGraph<PlacedComponentInstanceId> = {
      nodes: [
        { id: nodeId("a1"), role: "emitter", position: { x: 2, y: 3 }, ownerRef: instanceId("o1") },
        { id: nodeId("a2"), role: "receptor", position: { x: 2, y: 3 }, ownerRef: instanceId("o2") },
      ],
      edges: [],
    };
    expect(() => assertSignalWiringReachable(floorplan, sameSectionGraph, nodeId("a1"), nodeId("a2"))).not.toThrow();
  });

  it("permite cruzar de sección a sección CUANDO hay conducto `senal`", () => {
    const floorplan = floorplanWith([conduit("alfa", "beta", "senal")]);
    expect(() => assertSignalWiringReachable(floorplan, graph, nodeId("en-alfa"), nodeId("en-beta"))).not.toThrow();
  });

  it("RECHAZA cruzar de sección a sección sin conducto `senal` (aunque exista uno `electrico`)", () => {
    const floorplan = floorplanWith([conduit("alfa", "beta", "electrico")]);
    expect(() => assertSignalWiringReachable(floorplan, graph, nodeId("en-alfa"), nodeId("en-beta"))).toThrow(
      SignalWiringUnreachableError,
    );
  });

  it("fail-open: si un extremo no cae en ninguna sección, no bloquea", () => {
    const floorplan = floorplanWith([]);
    expect(() => assertSignalWiringReachable(floorplan, graph, nodeId("en-alfa"), nodeId("en-la-nada"))).not.toThrow();
  });
});
