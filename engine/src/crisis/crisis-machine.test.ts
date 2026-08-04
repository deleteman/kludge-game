import { describe, expect, it } from "vitest";
import { evaluateCrisis, type CrisisRuleRegistries } from "./crisis-machine.js";
import type { CrisisDefinition, CrisisDefinitionId } from "./crisis-definition.types.js";
import type { CrisisEvalContext, CrisisResolutionRule, CrisisTriggerRule } from "./crisis-rule.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

const CRISIS_ID = "test-crisis" as CrisisDefinitionId;

function fixtureShip(): Blueprint {
  return {
    metadata: {
      schemaVersion: 3,
      id: "fixture",
      name: "Fixture",
      engineVersion: "0.0.0",
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
    placedComponents: [],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
  };
}

function ctxAt(elapsedSeconds: number): CrisisEvalContext {
  return { ship: fixtureShip(), tick: { dtSeconds: 1, elapsedSeconds } };
}

/**
 * Reglas reales de la máquina (mismo `kind` que la definición de prueba usa),
 * pero con `isTriggered`/`isResolved` controlados por una bandera externa —
 * evita depender del contenido real de un capítulo para probar la máquina
 * genérica en aislamiento.
 */
function registriesWith(triggered: boolean, resolved: boolean): CrisisRuleRegistries {
  const triggerRule: CrisisTriggerRule = {
    kind: "jammed-actuator-blocks-section",
    isTriggered: () => triggered,
  };
  const resolutionRule: CrisisResolutionRule = {
    kind: "replacement-installed-connected",
    isResolved: () => resolved,
  };
  return {
    triggerRules: new Map([[triggerRule.kind, triggerRule]]),
    resolutionRules: new Map([[resolutionRule.kind, resolutionRule]]),
  };
}

function definitionWithTimer(onExpire: "resolved-failure" | "resolved-partial"): CrisisDefinition {
  return {
    id: CRISIS_ID,
    chapterOrder: 1,
    name: "Test",
    triggers: [
      {
        kind: "jammed-actuator-blocks-section",
        instanceId: "instance-x" as PlacedComponentInstanceId,
        blockedSectionId: "section-y" as SectionId,
      },
    ],
    resolutions: [
      {
        kind: "replacement-installed-connected",
        anchorPosition: { x: 0, y: 0 },
        acceptableComponentDefinitionIds: [],
      },
    ],
    timer: { softDeadlineSeconds: 10, onExpire },
    consequence: { kind: "time-loss", severity: "minor" },
  };
}

function definitionWithoutTimer(): CrisisDefinition {
  return { ...definitionWithTimer("resolved-failure"), timer: undefined };
}

describe("crisis-machine: evaluateCrisis", () => {
  it("stays not-triggered when the trigger does not apply", () => {
    const result = evaluateCrisis(
      "not-triggered",
      definitionWithoutTimer(),
      ctxAt(0),
      registriesWith(false, false),
    );
    expect(result.state).toBe("not-triggered");
    expect(result.events).toEqual([]);
  });

  it("transitions not-triggered -> active and emits crisis-triggered when the trigger applies", () => {
    const result = evaluateCrisis(
      "not-triggered",
      definitionWithoutTimer(),
      ctxAt(5),
      registriesWith(true, false),
    );
    expect(result.state).toBe("active");
    expect(result.events).toEqual([{ kind: "crisis-triggered", crisisId: CRISIS_ID, elapsedSeconds: 5 }]);
  });

  it("stays active while resolution does not apply and timer has not expired", () => {
    const result = evaluateCrisis(
      "active",
      definitionWithTimer("resolved-failure"),
      ctxAt(3),
      registriesWith(true, false),
    );
    expect(result.state).toBe("active");
    expect(result.events).toEqual([]);
  });

  it("transitions active -> resolved-success and emits crisis-resolved when resolution applies", () => {
    const result = evaluateCrisis(
      "active",
      definitionWithoutTimer(),
      ctxAt(7),
      registriesWith(true, true),
    );
    expect(result.state).toBe("resolved-success");
    expect(result.events).toEqual([
      { kind: "crisis-resolved", crisisId: CRISIS_ID, outcome: "resolved-success", elapsedSeconds: 7 },
    ]);
  });

  it("resolution takes priority over an expired timer in the same tick", () => {
    const result = evaluateCrisis(
      "active",
      definitionWithTimer("resolved-failure"),
      ctxAt(10),
      registriesWith(true, true),
    );
    expect(result.state).toBe("resolved-success");
  });

  it("transitions active -> resolved-failure/partial per onExpire when the timer expires unresolved", () => {
    const failure = evaluateCrisis(
      "active",
      definitionWithTimer("resolved-failure"),
      ctxAt(10),
      registriesWith(true, false),
    );
    expect(failure.state).toBe("resolved-failure");
    expect(failure.events).toEqual([
      { kind: "crisis-resolved", crisisId: CRISIS_ID, outcome: "resolved-failure", elapsedSeconds: 10 },
    ]);

    const partial = evaluateCrisis(
      "active",
      definitionWithTimer("resolved-partial"),
      ctxAt(11),
      registriesWith(true, false),
    );
    expect(partial.state).toBe("resolved-partial");
  });

  it("never expires without a timer, no matter how much time elapses", () => {
    const result = evaluateCrisis(
      "active",
      definitionWithoutTimer(),
      ctxAt(10_000),
      registriesWith(true, false),
    );
    expect(result.state).toBe("active");
    expect(result.events).toEqual([]);
  });

  it.each(["resolved-success", "resolved-failure", "resolved-partial"] as const)(
    "is a no-op once terminal (%s)",
    (terminalState) => {
      const result = evaluateCrisis(
        terminalState,
        definitionWithTimer("resolved-failure"),
        ctxAt(999),
        registriesWith(true, true),
      );
      expect(result.state).toBe(terminalState);
      expect(result.events).toEqual([]);
    },
  );

  it("throws when a trigger/resolution spec references an unregistered rule kind", () => {
    const emptyRegistries: CrisisRuleRegistries = {
      triggerRules: new Map(),
      resolutionRules: new Map(),
    };
    expect(() =>
      evaluateCrisis("not-triggered", definitionWithoutTimer(), ctxAt(0), emptyRegistries),
    ).toThrow(/No hay CrisisTriggerRule/);
  });
});
