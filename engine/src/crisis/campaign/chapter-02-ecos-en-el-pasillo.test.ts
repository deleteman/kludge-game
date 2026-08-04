import { describe, expect, it } from "vitest";
import {
  CHAPTER_02_BY_ARCHETYPE,
  CHAPTER_02_GATE_NODE_ID,
  CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE,
  CHAPTER_02_SEEDED_SIGNAL_NODES_BY_ARCHETYPE,
  CHAPTER_02_SENSOR_A_NODE_ID,
  CHAPTER_02_SENSOR_B_NODE_ID,
} from "./chapter-02-ecos-en-el-pasillo.js";
import { SHIP_ARCHETYPES } from "../../floorplan/floorplan.types.js";
import { evaluateCrisis } from "../crisis-machine.js";
import {
  createDefaultCrisisResolutionRegistry,
  createDefaultCrisisTriggerRegistry,
} from "../rules/crisis-rule-registry.js";
import type { Blueprint } from "../../blueprint/blueprint.types.js";
import type { SignalEdgeId } from "../../signals/signal-edge.types.js";

function shipWith(archetype: (typeof SHIP_ARCHETYPES)[number], edges: Blueprint["signalGraph"]["edges"]): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: `fixture-${archetype}`,
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    },
    placedComponents: [...CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE[archetype]],
    reservoirContents: [],
    signalGraph: { nodes: [...CHAPTER_02_SEEDED_SIGNAL_NODES_BY_ARCHETYPE[archetype]], edges },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
  };
}

describe("capítulo 2 — Ecos en el Pasillo", () => {
  it("define una CrisisDefinition por arquetipo con timer, consecuencia crew-damage y briefing", () => {
    const ids = SHIP_ARCHETYPES.map((archetype) => CHAPTER_02_BY_ARCHETYPE[archetype].id);
    expect(new Set(ids).size).toBe(SHIP_ARCHETYPES.length);
    for (const archetype of SHIP_ARCHETYPES) {
      const definition = CHAPTER_02_BY_ARCHETYPE[archetype];
      expect(definition.chapterOrder).toBe(2);
      expect(definition.timer?.onExpire).toBe("resolved-failure");
      expect(definition.consequence.kind).toBe("crew-damage");
      expect(definition.briefingKey).toBeTruthy();
      // Castigo progresivo definido y NO letal (solo hiere en la demo).
      expect(definition.hazard?.kind).toBe("periodic-crew-damage");
      expect(definition.hazard?.lethal).toBe(false);
      expect(definition.consequence.kind === "crew-damage" && definition.consequence.lethal).toBe(false);
    }
  });

  it("siembra 2 sensores + panel combinador y 3 nodos (2 emisores + gate AND) sin cable", () => {
    for (const archetype of SHIP_ARCHETYPES) {
      const components = CHAPTER_02_SEEDED_COMPONENTS_BY_ARCHETYPE[archetype];
      const nodes = CHAPTER_02_SEEDED_SIGNAL_NODES_BY_ARCHETYPE[archetype];
      expect(components).toHaveLength(3);
      expect(nodes).toHaveLength(3);
      const gate = nodes.find((node) => node.id === CHAPTER_02_GATE_NODE_ID);
      expect(gate?.behavior).toEqual({ kind: "gate", mode: "AND" });
    }
  });

  it("dispara con los sensores presentes y resuelve solo al cablear AMBOS al combinador", () => {
    const triggerRules = createDefaultCrisisTriggerRegistry();
    const resolutionRules = createDefaultCrisisResolutionRegistry();

    for (const archetype of SHIP_ARCHETYPES) {
      const definition = CHAPTER_02_BY_ARCHETYPE[archetype];

      // Trigger: ambos sensores presentes → active.
      const unwired = shipWith(archetype, []);
      const triggered = evaluateCrisis(
        "not-triggered",
        definition,
        { ship: unwired, tick: { dtSeconds: 1, elapsedSeconds: 1 } },
        { triggerRules, resolutionRules },
      );
      expect(triggered.state).toBe("active");

      // Sin cablear → no resuelve (AND sin entradas es siempre falso).
      const stillActive = evaluateCrisis(
        "active",
        definition,
        { ship: unwired, tick: { dtSeconds: 1, elapsedSeconds: 2 } },
        { triggerRules, resolutionRules },
      );
      expect(stillActive.state).toBe("active");

      // Cableando AMBOS sensores al combinador → resuelve.
      const wired = shipWith(archetype, [
        { id: "e-a" as SignalEdgeId, from: CHAPTER_02_SENSOR_A_NODE_ID, to: CHAPTER_02_GATE_NODE_ID },
        { id: "e-b" as SignalEdgeId, from: CHAPTER_02_SENSOR_B_NODE_ID, to: CHAPTER_02_GATE_NODE_ID },
      ]);
      const resolved = evaluateCrisis(
        "active",
        definition,
        { ship: wired, tick: { dtSeconds: 1, elapsedSeconds: 3 } },
        { triggerRules, resolutionRules },
      );
      expect(resolved.state).toBe("resolved-success");
    }
  });

  it("no resuelve si solo un sensor está cableado al combinador", () => {
    const triggerRules = createDefaultCrisisTriggerRegistry();
    const resolutionRules = createDefaultCrisisResolutionRegistry();
    const definition = CHAPTER_02_BY_ARCHETYPE.exploracion;
    const partial = shipWith("exploracion", [
      { id: "e-a" as SignalEdgeId, from: CHAPTER_02_SENSOR_A_NODE_ID, to: CHAPTER_02_GATE_NODE_ID },
    ]);
    const result = evaluateCrisis(
      "active",
      definition,
      { ship: partial, tick: { dtSeconds: 1, elapsedSeconds: 3 } },
      { triggerRules, resolutionRules },
    );
    expect(result.state).toBe("active");
  });
});
