import { describe, expect, it } from "vitest";
import { evaluateCrisis } from "../crisis-machine.js";
import {
  createDefaultCrisisResolutionRegistry,
  createDefaultCrisisTriggerRegistry,
} from "../rules/crisis-rule-registry.js";
import { buildComponentCatalog } from "../../components/catalog/build-component-catalog.js";
import {
  CHAPTER_01_ACTUATOR_INSTANCE_ID,
  CHAPTER_01_ANCHOR_POSITION,
  CHAPTER_01_GATE_NODE_ID,
  CHAPTER_01_PRIMER_AVISO,
  CHAPTER_01_SEAL_INSTANCE_ID,
  CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE,
  CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE,
  CHAPTER_01_SENSOR_NODE_ID,
} from "./chapter-01-primer-aviso.js";
import type { CrisisState } from "../crisis-state.types.js";
import type { CrisisEvalContext } from "../crisis-rule.js";
import type { Blueprint } from "../../blueprint/blueprint.types.js";
import type { ComponentId } from "../../components/physical-component.types.js";
import type { SignalEdgeId } from "../../signals/signal-edge.types.js";

/** Grafo con los dos nodos del cap. 1 y (opcionalmente) el cable que los une. */
function chapter01Graph(wired: boolean): Blueprint["signalGraph"] {
  return {
    nodes: [...CHAPTER_01_SEEDED_SIGNAL_NODES_BY_ARCHETYPE.exploracion],
    edges: wired
      ? [{ id: "cable-test" as SignalEdgeId, from: CHAPTER_01_SENSOR_NODE_ID, to: CHAPTER_01_GATE_NODE_ID }]
      : [],
  };
}

/**
 * Escenario de integración del capítulo 1 ("Primer Aviso"), sin caso de
 * validación GDD §9 asociado — vive junto al contenido (`crisis/campaign/`)
 * en vez de `validation/case-XX-*.test.ts`. Precedente para capítulos
 * futuros que tampoco mapeen a un caso de validación.
 */
function shipWithActuator(condition: "ok" | "jammed", definitionId: ComponentId): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: "capitulo-1-fixture",
      name: "Fixture capítulo 1",
      engineVersion: "0.0.0",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: CHAPTER_01_ACTUATOR_INSTANCE_ID,
        componentDefinitionId: definitionId,
        placement: {
          position: CHAPTER_01_ANCHOR_POSITION,
          footprint: { width: 1, height: 1 },
          rotation: 0,
        },
        condition,
      },
    ],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
  };
}

describe("Capítulo 1 — Primer Aviso (escenario completo)", () => {
  const triggerRules = createDefaultCrisisTriggerRegistry();
  const resolutionRules = createDefaultCrisisResolutionRegistry();
  const componentRegistry = buildComponentCatalog().registry;

  it("dispara al encontrar la válvula atascada y resuelve al reinstalarla reparada/sustituida", () => {
    let state: CrisisState = "not-triggered";

    // Tick 1: la válvula sigue atascada -> dispara y emite crisis-triggered.
    const jammedCtx: CrisisEvalContext = {
      ship: shipWithActuator("jammed", "valvula-simple" as ComponentId),
      tick: { dtSeconds: 1, elapsedSeconds: 1 },
    };
    const triggerResult = evaluateCrisis(state, CHAPTER_01_PRIMER_AVISO, jammedCtx, {
      triggerRules,
      resolutionRules,
    });
    state = triggerResult.state;
    expect(state).toBe("active");
    expect(triggerResult.events).toEqual([
      { kind: "crisis-triggered", crisisId: CHAPTER_01_PRIMER_AVISO.id, elapsedSeconds: 1 },
    ]);

    // Tick 2: sigue atascada -> permanece activa, sin nuevos eventos.
    const stillJammedResult = evaluateCrisis(state, CHAPTER_01_PRIMER_AVISO, jammedCtx, {
      triggerRules,
      resolutionRules,
    });
    expect(stillJammedResult.state).toBe("active");
    expect(stillJammedResult.events).toEqual([]);

    // Tick 3: el jugador sustituyó la válvula por un motor pequeño ("ok"), pero
    // el sensor SIGUE sin cablear -> la resolución es AND, sigue activa.
    const replacedUnwiredCtx: CrisisEvalContext = {
      ship: { ...shipWithActuator("ok", "motor-pequeno" as ComponentId), signalGraph: chapter01Graph(false) },
      tick: { dtSeconds: 1, elapsedSeconds: 60 },
      componentRegistry,
    };
    const replacedResult = evaluateCrisis(state, CHAPTER_01_PRIMER_AVISO, replacedUnwiredCtx, {
      triggerRules,
      resolutionRules,
    });
    expect(replacedResult.state).toBe("active");

    // Tick 4: además cableó el sensor al panel de la compuerta Y selló la
    // fuga de presión (Subfase 11h) -> ahora sí resuelve (AND de las 3).
    const sealSeed = CHAPTER_01_SEEDED_COMPONENTS_BY_ARCHETYPE.exploracion.find(
      (entry) => entry.instanceId === CHAPTER_01_SEAL_INSTANCE_ID,
    )!;
    const resolvedShip = shipWithActuator("ok", "motor-pequeno" as ComponentId);
    const resolvedCtx: CrisisEvalContext = {
      ship: {
        ...resolvedShip,
        placedComponents: [...resolvedShip.placedComponents, { ...sealSeed, condition: "ok" }],
        signalGraph: chapter01Graph(true),
      },
      tick: { dtSeconds: 1, elapsedSeconds: 120 },
      componentRegistry,
    };
    const resolveResult = evaluateCrisis(state, CHAPTER_01_PRIMER_AVISO, resolvedCtx, {
      triggerRules,
      resolutionRules,
    });
    expect(resolveResult.state).toBe("resolved-success");
    expect(resolveResult.events).toEqual([
      {
        kind: "crisis-resolved",
        crisisId: CHAPTER_01_PRIMER_AVISO.id,
        outcome: "resolved-success",
        elapsedSeconds: 120,
      },
    ]);
  });

  it("no tiene timer — nunca falla por expiración, coherente con 'sin amenaza de vidas'", () => {
    expect(CHAPTER_01_PRIMER_AVISO.timer).toBeUndefined();
  });
});
