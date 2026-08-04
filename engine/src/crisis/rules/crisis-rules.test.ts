import { describe, expect, it } from "vitest";
import { JammedActuatorBlocksSectionRule } from "./jammed-actuator-blocks-section.js";
import { MotionSensorsActiveRule } from "./motion-sensors-active.js";
import { ReplacementInstalledConnectedRule } from "./replacement-installed-connected.js";
import { FunctionalTagInstalledRule } from "./functional-tag-installed.js";
import { SignalNodesWiredRule } from "./signal-nodes-wired.js";
import { SignalOutputMatchesRule } from "./signal-output-matches.js";
import { buildComponentCatalog } from "../../components/catalog/build-component-catalog.js";
import type {
  FunctionalTagInstalledResolutionSpec,
  JammedActuatorBlocksSectionTriggerSpec,
  MotionSensorsActiveTriggerSpec,
  ReplacementInstalledConnectedResolutionSpec,
  SignalNodesWiredResolutionSpec,
  SignalOutputMatchesResolutionSpec,
} from "../crisis-definition.types.js";
import type { SignalBehavior } from "../../signals/signal-behavior.types.js";
import type { CrisisEvalContext } from "../crisis-rule.js";
import type { Blueprint, PlacedComponentInstanceId } from "../../blueprint/blueprint.types.js";
import type { ComponentId } from "../../components/physical-component.types.js";
import type { SectionId } from "../../atmosphere/section.types.js";
import type { SignalNodeId } from "../../signals/signal-node.types.js";
import type { SignalEdgeId } from "../../signals/signal-edge.types.js";

function shipWith(placedComponents: Blueprint["placedComponents"]): CrisisEvalContext {
  return {
    ship: {
      metadata: {
        schemaVersion: 3,
        id: "fixture",
        name: "Fixture",
        engineVersion: "0.0.0",
        createdAt: "2026-07-14T00:00:00.000Z",
        updatedAt: "2026-07-14T00:00:00.000Z",
      },
      placedComponents,
      reservoirContents: [],
      signalGraph: { nodes: [], edges: [] },
      sectionAtmospheres: [],
      unpoweredSectionIds: [],
      overloadedRefs: [],
      powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
    },
    tick: { dtSeconds: 1, elapsedSeconds: 0 },
  };
}

describe("JammedActuatorBlocksSectionRule", () => {
  const rule = new JammedActuatorBlocksSectionRule();
  const spec: JammedActuatorBlocksSectionTriggerSpec = {
    kind: "jammed-actuator-blocks-section",
    instanceId: "valvula-1" as PlacedComponentInstanceId,
    blockedSectionId: "bodega-carga" as SectionId,
  };

  it("triggers when the referenced instance has condition 'jammed'", () => {
    const ctx = shipWith([
      {
        instanceId: "valvula-1" as PlacedComponentInstanceId,
        componentDefinitionId: "valvula-simple" as ComponentId,
        placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "jammed",
      },
    ]);
    expect(rule.isTriggered(spec, ctx)).toBe(true);
  });

  it("does not trigger when the referenced instance is 'ok'", () => {
    const ctx = shipWith([
      {
        instanceId: "valvula-1" as PlacedComponentInstanceId,
        componentDefinitionId: "valvula-simple" as ComponentId,
        placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
    ]);
    expect(rule.isTriggered(spec, ctx)).toBe(false);
  });

  it("does not trigger when the referenced instance is missing entirely", () => {
    expect(rule.isTriggered(spec, shipWith([]))).toBe(false);
  });
});

describe("MotionSensorsActiveRule", () => {
  const rule = new MotionSensorsActiveRule();
  const spec: MotionSensorsActiveTriggerSpec = {
    kind: "motion-sensors-active",
    sensorInstanceIds: ["sensor-a" as PlacedComponentInstanceId, "sensor-b" as PlacedComponentInstanceId],
  };

  function sensor(id: string): Blueprint["placedComponents"][number] {
    return {
      instanceId: id as PlacedComponentInstanceId,
      componentDefinitionId: "fotorreceptor" as ComponentId,
      placement: { position: { x: 12, y: 9 }, footprint: { width: 1, height: 1 }, rotation: 0 },
      condition: "ok",
    };
  }

  it("triggers while both motion sensors are present", () => {
    expect(rule.isTriggered(spec, shipWith([sensor("sensor-a"), sensor("sensor-b")]))).toBe(true);
  });

  it("does not trigger if one of the sensors is missing", () => {
    expect(rule.isTriggered(spec, shipWith([sensor("sensor-a")]))).toBe(false);
  });
});

describe("SignalOutputMatchesRule", () => {
  const rule = new SignalOutputMatchesRule();
  const sensorA = "nodo-sensor-a" as SignalNodeId;
  const sensorB = "nodo-sensor-b" as SignalNodeId;
  const gate = "nodo-combinador" as SignalNodeId;
  const owner = "panel" as PlacedComponentInstanceId;

  const spec: SignalOutputMatchesResolutionSpec = {
    kind: "signal-output-matches",
    outputNodeId: gate,
    cases: [
      {
        inputs: [
          { nodeId: sensorA, active: true },
          { nodeId: sensorB, active: true },
        ],
        expected: true,
      },
      {
        inputs: [
          { nodeId: sensorA, active: true },
          { nodeId: sensorB, active: false },
        ],
        expected: false,
      },
      {
        inputs: [
          { nodeId: sensorA, active: false },
          { nodeId: sensorB, active: true },
        ],
        expected: false,
      },
    ],
  };

  const andGate: SignalBehavior = { kind: "gate", mode: "AND" };

  function shipWithGraph(edges: Blueprint["signalGraph"]["edges"]): CrisisEvalContext {
    const ctx = shipWith([]);
    return {
      ...ctx,
      ship: {
        ...ctx.ship,
        signalGraph: {
          nodes: [
            { id: sensorA, role: "emitter", position: { x: 12, y: 9 }, ownerRef: owner },
            { id: sensorB, role: "emitter", position: { x: 16, y: 9 }, ownerRef: owner },
            { id: gate, role: "receptor", position: { x: 14, y: 9 }, ownerRef: owner, behavior: andGate },
          ],
          edges,
        },
      },
    };
  }

  it("does not resolve while the combiner is unwired (AND with no inputs is always false)", () => {
    expect(rule.isResolved(spec, shipWithGraph([]))).toBe(false);
  });

  it("resolves when both sensors feed the AND gate (correct wiring reproduces the truth table)", () => {
    const wired = shipWithGraph([
      { id: "e-a" as SignalEdgeId, from: sensorA, to: gate },
      { id: "e-b" as SignalEdgeId, from: sensorB, to: gate },
    ]);
    expect(rule.isResolved(spec, wired)).toBe(true);
  });

  it("does not resolve when only one sensor is wired (single-input AND fails the A-only case)", () => {
    const partial = shipWithGraph([{ id: "e-a" as SignalEdgeId, from: sensorA, to: gate }]);
    expect(rule.isResolved(spec, partial)).toBe(false);
  });
});

describe("ReplacementInstalledConnectedRule", () => {
  const rule = new ReplacementInstalledConnectedRule();
  const spec: ReplacementInstalledConnectedResolutionSpec = {
    kind: "replacement-installed-connected",
    anchorPosition: { x: 6, y: 4 },
    acceptableComponentDefinitionIds: ["valvula-simple" as ComponentId, "motor-pequeno" as ComponentId],
  };

  it("resolves when an acceptable, 'ok' instance occupies the anchor position (repair path)", () => {
    const ctx = shipWith([
      {
        instanceId: "valvula-1" as PlacedComponentInstanceId,
        componentDefinitionId: "valvula-simple" as ComponentId,
        placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
    ]);
    expect(rule.isResolved(spec, ctx)).toBe(true);
  });

  it("resolves when a different acceptable instance replaces the original at the anchor (replace path)", () => {
    const ctx = shipWith([
      {
        instanceId: "motor-2" as PlacedComponentInstanceId,
        componentDefinitionId: "motor-pequeno" as ComponentId,
        placement: { position: { x: 6, y: 4 }, footprint: { width: 2, height: 2 }, rotation: 0 },
        condition: "ok",
      },
    ]);
    expect(rule.isResolved(spec, ctx)).toBe(true);
  });

  it("does not resolve when the instance at the anchor is still 'jammed'", () => {
    const ctx = shipWith([
      {
        instanceId: "valvula-1" as PlacedComponentInstanceId,
        componentDefinitionId: "valvula-simple" as ComponentId,
        placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "jammed",
      },
    ]);
    expect(rule.isResolved(spec, ctx)).toBe(false);
  });

  it("does not resolve when an 'ok' instance is at the anchor but not an acceptable definition", () => {
    const ctx = shipWith([
      {
        instanceId: "cable-1" as PlacedComponentInstanceId,
        componentDefinitionId: "cable-cobre" as ComponentId,
        placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
    ]);
    expect(rule.isResolved(spec, ctx)).toBe(false);
  });

  it("does not resolve when an acceptable, 'ok' instance is at a different position", () => {
    const ctx = shipWith([
      {
        instanceId: "valvula-elsewhere" as PlacedComponentInstanceId,
        componentDefinitionId: "valvula-simple" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
    ]);
    expect(rule.isResolved(spec, ctx)).toBe(false);
  });
});

describe("FunctionalTagInstalledRule", () => {
  const rule = new FunctionalTagInstalledRule();
  const componentRegistry = buildComponentCatalog().registry;
  const spec: FunctionalTagInstalledResolutionSpec = {
    kind: "functional-tag-installed",
    anchorPosition: { x: 6, y: 4 },
    requiredTag: "ACT",
  };

  it("resolves when an 'ok' instance at the anchor carries the required tag (any acceptable id, not a closed list)", () => {
    const ctx = {
      ...shipWith([
        {
          instanceId: "motor-2" as PlacedComponentInstanceId,
          componentDefinitionId: "motor-pequeno" as ComponentId,
          placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          condition: "ok",
        },
      ]),
      componentRegistry,
    };
    expect(rule.isResolved(spec, ctx)).toBe(true);
  });

  it("resolves for a different ACT-tagged component id at the anchor (valvula-simple, not just motor-pequeno)", () => {
    const ctx = {
      ...shipWith([
        {
          instanceId: "valvula-1" as PlacedComponentInstanceId,
          componentDefinitionId: "valvula-simple" as ComponentId,
          placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          condition: "ok",
        },
      ]),
      componentRegistry,
    };
    expect(rule.isResolved(spec, ctx)).toBe(true);
  });

  it("does not resolve when the instance at the anchor lacks the required tag", () => {
    const ctx = {
      ...shipWith([
        {
          instanceId: "cable-1" as PlacedComponentInstanceId,
          componentDefinitionId: "cable-cobre" as ComponentId,
          placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          condition: "ok",
        },
      ]),
      componentRegistry,
    };
    expect(rule.isResolved(spec, ctx)).toBe(false);
  });

  it("does not resolve when the ACT-tagged instance at the anchor is still 'jammed'", () => {
    const ctx = {
      ...shipWith([
        {
          instanceId: "valvula-1" as PlacedComponentInstanceId,
          componentDefinitionId: "valvula-simple" as ComponentId,
          placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          condition: "jammed",
        },
      ]),
      componentRegistry,
    };
    expect(rule.isResolved(spec, ctx)).toBe(false);
  });

  it("does not resolve without a componentRegistry in the context (cannot resolve the definition)", () => {
    const ctx = shipWith([
      {
        instanceId: "motor-2" as PlacedComponentInstanceId,
        componentDefinitionId: "motor-pequeno" as ComponentId,
        placement: { position: { x: 6, y: 4 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
      },
    ]);
    expect(rule.isResolved(spec, ctx)).toBe(false);
  });
});

describe("SignalNodesWiredRule", () => {
  const rule = new SignalNodesWiredRule();
  const spec: SignalNodesWiredResolutionSpec = {
    kind: "signal-nodes-wired",
    fromNodeId: "nodo-sensor" as SignalNodeId,
    toNodeId: "nodo-compuerta" as SignalNodeId,
  };
  const owner = "panel" as PlacedComponentInstanceId;

  function shipWithGraph(edges: Blueprint["signalGraph"]["edges"]): CrisisEvalContext {
    const ctx = shipWith([]);
    return {
      ...ctx,
      ship: {
        ...ctx.ship,
        signalGraph: {
          nodes: [
            { id: "nodo-sensor" as SignalNodeId, role: "emitter", position: { x: 7, y: 9 }, ownerRef: owner },
            { id: "nodo-compuerta" as SignalNodeId, role: "receptor", position: { x: 7, y: 6 }, ownerRef: owner },
          ],
          edges,
        },
      },
    };
  }

  it("does not resolve while the two nodes are unwired", () => {
    expect(rule.isResolved(spec, shipWithGraph([]))).toBe(false);
  });

  it("resolves when a direct edge connects the two nodes (either direction)", () => {
    const emitterToReceptor = shipWithGraph([
      { id: "cable-1" as SignalEdgeId, from: "nodo-sensor" as SignalNodeId, to: "nodo-compuerta" as SignalNodeId },
    ]);
    expect(rule.isResolved(spec, emitterToReceptor)).toBe(true);

    const receptorToEmitter = shipWithGraph([
      { id: "cable-1" as SignalEdgeId, from: "nodo-compuerta" as SignalNodeId, to: "nodo-sensor" as SignalNodeId },
    ]);
    expect(rule.isResolved(spec, receptorToEmitter)).toBe(true);
  });

  it("resolves when the two nodes are connected through an intermediate node (path, not just direct edge)", () => {
    const ctx = shipWith([]);
    const withMiddle: CrisisEvalContext = {
      ...ctx,
      ship: {
        ...ctx.ship,
        signalGraph: {
          nodes: [
            { id: "nodo-sensor" as SignalNodeId, role: "emitter", position: { x: 7, y: 9 }, ownerRef: owner },
            { id: "medio" as SignalNodeId, role: "conductor", position: { x: 7, y: 8 }, ownerRef: owner },
            { id: "nodo-compuerta" as SignalNodeId, role: "receptor", position: { x: 7, y: 6 }, ownerRef: owner },
          ],
          edges: [
            { id: "e1" as SignalEdgeId, from: "nodo-sensor" as SignalNodeId, to: "medio" as SignalNodeId },
            { id: "e2" as SignalEdgeId, from: "medio" as SignalNodeId, to: "nodo-compuerta" as SignalNodeId },
          ],
        },
      },
    };
    expect(rule.isResolved(spec, withMiddle)).toBe(true);
  });

  it("does not resolve when an edge touches only one of the two target nodes", () => {
    const ctx = shipWith([]);
    const danglingElsewhere: CrisisEvalContext = {
      ...ctx,
      ship: {
        ...ctx.ship,
        signalGraph: {
          nodes: [
            { id: "nodo-sensor" as SignalNodeId, role: "emitter", position: { x: 7, y: 9 }, ownerRef: owner },
            { id: "otro" as SignalNodeId, role: "conductor", position: { x: 1, y: 1 }, ownerRef: owner },
            { id: "nodo-compuerta" as SignalNodeId, role: "receptor", position: { x: 7, y: 6 }, ownerRef: owner },
          ],
          edges: [{ id: "e1" as SignalEdgeId, from: "nodo-sensor" as SignalNodeId, to: "otro" as SignalNodeId }],
        },
      },
    };
    expect(rule.isResolved(spec, danglingElsewhere)).toBe(false);
  });
});
