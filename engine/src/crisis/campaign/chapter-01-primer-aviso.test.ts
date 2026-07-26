import { describe, expect, it } from "vitest";
import {
  CHAPTER_01_ACTUATOR_INSTANCE_ID,
  CHAPTER_01_BY_ARCHETYPE,
  CHAPTER_01_GATE_NODE_ID,
  CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE,
  CHAPTER_01_PRIMER_AVISO,
  CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE,
  CHAPTER_01_SENSOR_NODE_ID,
} from "./chapter-01-primer-aviso.js";
import { SHIP_ARCHETYPES } from "../../floorplan/floorplan.types.js";
import { evaluateCrisis } from "../crisis-machine.js";
import {
  createDefaultCrisisResolutionRegistry,
  createDefaultCrisisTriggerRegistry,
} from "../rules/crisis-rule-registry.js";
import { buildComponentCatalog } from "../../components/catalog/build-component-catalog.js";
import type { Blueprint } from "../../blueprint/blueprint.types.js";
import type { SignalEdgeId } from "../../signals/signal-edge.types.js";

describe("capítulo 1 — variantes por arquetipo", () => {
  it("define exactamente una CrisisDefinition por arquetipo, con id único", () => {
    const ids = SHIP_ARCHETYPES.map((archetype) => CHAPTER_01_BY_ARCHETYPE[archetype].id);
    expect(new Set(ids).size).toBe(SHIP_ARCHETYPES.length);
    for (const archetype of SHIP_ARCHETYPES) {
      const definition = CHAPTER_01_BY_ARCHETYPE[archetype];
      expect(definition.chapterOrder).toBe(1);
      expect(definition.archetypeHint).toBe(archetype);
      expect(definition.timer).toBeUndefined();
      expect(definition.briefingKey).toBeTruthy();
    }
  });

  it("la instancia semilla de cada arquetipo referencia el mismo instanceId y queda 'jammed'", () => {
    for (const archetype of SHIP_ARCHETYPES) {
      const seed = CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE[archetype];
      expect(seed.instanceId).toBe(CHAPTER_01_ACTUATOR_INSTANCE_ID);
      expect(seed.condition).toBe("jammed");
      expect(seed.componentDefinitionId).toBe("valvula-simple");
    }
  });

  it("la posición de la instancia semilla coincide con el anchorPosition de su propia resolución", () => {
    for (const archetype of SHIP_ARCHETYPES) {
      const seed = CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE[archetype];
      const resolution = CHAPTER_01_BY_ARCHETYPE[archetype].resolutions[0]!;
      expect(resolution.kind).toBe("functional-tag-installed");
      expect(seed.placement.position).toEqual(
        (resolution as { anchorPosition: typeof seed.placement.position }).anchorPosition,
      );
    }
  });

  it("el trigger de cada arquetipo referencia el mismo instanceId que su instancia semilla", () => {
    for (const archetype of SHIP_ARCHETYPES) {
      const trigger = CHAPTER_01_BY_ARCHETYPE[archetype].triggers[0]!;
      expect(trigger.kind).toBe("jammed-actuator-blocks-section");
      expect((trigger as { instanceId: string }).instanceId).toBe(CHAPTER_01_ACTUATOR_INSTANCE_ID);
    }
  });

  it("CHAPTER_01_PRIMER_AVISO (alias de compatibilidad) apunta a la variante de Exploración", () => {
    expect(CHAPTER_01_PRIMER_AVISO).toBe(CHAPTER_01_BY_ARCHETYPE.exploracion);
  });

  it("dispara y resuelve mecánicamente en los 4 arquetipos, no solo en Exploración", () => {
    const triggerRules = createDefaultCrisisTriggerRegistry();
    const resolutionRules = createDefaultCrisisResolutionRegistry();
    const componentRegistry = buildComponentCatalog().registry;

    for (const archetype of SHIP_ARCHETYPES) {
      const definition = CHAPTER_01_BY_ARCHETYPE[archetype];
      const seed = CHAPTER_01_INITIAL_COMPONENT_BY_ARCHETYPE[archetype];

      const jammedShip: Blueprint = {
        metadata: {
          schemaVersion: 3,
          id: `fixture-${archetype}`,
          name: "Fixture",
          engineVersion: "0.0.0",
          createdAt: "2026-07-14T00:00:00.000Z",
          updatedAt: "2026-07-14T00:00:00.000Z",
        },
        placedComponents: [seed],
        reservoirContents: [],
        signalGraph: { nodes: [], edges: [] },
        sectionAtmospheres: [],
        unpoweredSectionIds: [],
      };

      const triggered = evaluateCrisis(
        "not-triggered",
        definition,
        { ship: jammedShip, tick: { dtSeconds: 1, elapsedSeconds: 1 }, componentRegistry },
        { triggerRules, resolutionRules },
      );
      expect(triggered.state).toBe("active");

      // Resolución AND: además de reparar la válvula, hay que cablear el sensor
      // al panel de la compuerta (los dos nodos sembrados, unidos por un edge).
      const repairedShip: Blueprint = {
        ...jammedShip,
        placedComponents: [{ ...seed, condition: "ok" }],
        signalGraph: {
          nodes: [...CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE[archetype]],
          edges: [{ id: "cable" as SignalEdgeId, from: CHAPTER_01_SENSOR_NODE_ID, to: CHAPTER_01_GATE_NODE_ID }],
        },
      };
      const resolved = evaluateCrisis(
        "active",
        definition,
        { ship: repairedShip, tick: { dtSeconds: 1, elapsedSeconds: 2 }, componentRegistry },
        { triggerRules, resolutionRules },
      );
      expect(resolved.state).toBe("resolved-success");
    }
  });
});
