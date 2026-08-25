import { describe, expect, it } from "vitest";
import { CrisisRuntime } from "./crisis-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MutableCrewState } from "./mutable-crew-state.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { CrisisDomainEvent } from "../crisis/crisis-events.types.js";
import type { CrisisDefinition, CrisisDefinitionId } from "../crisis/crisis-definition.types.js";
import type { CrisisResolutionRule, CrisisTriggerRule } from "../crisis/crisis-rule.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewDomainEvent } from "../crew/crew-events.types.js";

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
    sectionIntegrity: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

function definitionOf(): CrisisDefinition {
  return {
    id: CRISIS_ID,
    chapterOrder: 1,
    name: "Test",
    triggers: [
      {
        kind: "jammed-actuator-blocks-section",
        instanceId: "x" as PlacedComponentInstanceId,
        blockedSectionId: "y" as SectionId,
      },
    ],
    resolutions: [
      { kind: "replacement-installed-connected", anchorPosition: { x: 0, y: 0 }, acceptableComponentDefinitionIds: [] },
    ],
    consequence: { kind: "time-loss", severity: "minor" },
  };
}

/** Reglas controladas por una bandera mutable, para dirigir el trigger/resolución desde el test. */
function registriesOf(flags: { triggered: boolean; resolved: boolean }) {
  const triggerRule: CrisisTriggerRule = {
    kind: "jammed-actuator-blocks-section",
    isTriggered: () => flags.triggered,
  };
  const resolutionRule: CrisisResolutionRule = {
    kind: "replacement-installed-connected",
    isResolved: () => flags.resolved,
  };
  return {
    triggerRules: new Map([[triggerRule.kind, triggerRule]]),
    resolutionRules: new Map([[resolutionRule.kind, resolutionRule]]),
  };
}

describe("CrisisRuntime", () => {
  it("starts not-triggered by default and persists state across ticks", () => {
    const flags = { triggered: false, resolved: false };
    const runtime = new CrisisRuntime({
      definition: definitionOf(),
      shipState: new MutableShipState(fixtureShip()),
      registries: registriesOf(flags),
    });
    expect(runtime.crisisState).toBe("not-triggered");

    runtime.tick({ dtSeconds: 1, elapsedSeconds: 1 });
    expect(runtime.crisisState).toBe("not-triggered");

    flags.triggered = true;
    runtime.tick({ dtSeconds: 1, elapsedSeconds: 2 });
    expect(runtime.crisisState).toBe("active");

    runtime.tick({ dtSeconds: 1, elapsedSeconds: 3 });
    expect(runtime.crisisState).toBe("active");
  });

  it("emits crisis-triggered/crisis-resolved through the provided emitter", () => {
    const flags = { triggered: true, resolved: false };
    const emitter = new EventEmitter<CrisisDomainEvent>();
    const events: CrisisDomainEvent[] = [];
    emitter.onAny((event) => events.push(event));

    const runtime = new CrisisRuntime({
      definition: definitionOf(),
      shipState: new MutableShipState(fixtureShip()),
      registries: registriesOf(flags),
      emitter,
    });

    runtime.tick({ dtSeconds: 1, elapsedSeconds: 1 });
    flags.resolved = true;
    runtime.tick({ dtSeconds: 1, elapsedSeconds: 2 });

    expect(events).toEqual([
      { kind: "crisis-triggered", crisisId: CRISIS_ID, elapsedSeconds: 1 },
      { kind: "crisis-resolved", crisisId: CRISIS_ID, outcome: "resolved-success", elapsedSeconds: 2 },
    ]);
  });

  it("objectiveStatuses maps each resolution to its objectiveKey and live done-state", () => {
    const flags = { first: false, second: false };
    const definition: CrisisDefinition = {
      ...definitionOf(),
      resolutions: [
        {
          kind: "replacement-installed-connected",
          anchorPosition: { x: 0, y: 0 },
          acceptableComponentDefinitionIds: [],
          objectiveKey: "obj.first",
        },
        {
          kind: "signal-nodes-wired",
          fromNodeId: "a" as never,
          toNodeId: "b" as never,
          objectiveKey: "obj.second",
        },
      ],
    };
    const firstRule: CrisisResolutionRule = {
      kind: "replacement-installed-connected",
      isResolved: () => flags.first,
    };
    const secondRule: CrisisResolutionRule = { kind: "signal-nodes-wired", isResolved: () => flags.second };
    const runtime = new CrisisRuntime({
      definition,
      shipState: new MutableShipState(fixtureShip()),
      registries: {
        triggerRules: registriesOf({ triggered: false, resolved: false }).triggerRules,
        resolutionRules: new Map([
          [firstRule.kind, firstRule],
          [secondRule.kind, secondRule],
        ]),
      },
    });

    expect(runtime.objectiveStatuses()).toEqual([
      { objectiveKey: "obj.first", done: false },
      { objectiveKey: "obj.second", done: false },
    ]);

    flags.first = true;
    expect(runtime.objectiveStatuses()).toEqual([
      { objectiveKey: "obj.first", done: true },
      { objectiveKey: "obj.second", done: false },
    ]);
  });

  it("applies the crew-damage consequence and emits a crew event when the timer expires (chapter 2)", () => {
    const definition: CrisisDefinition = {
      ...definitionOf(),
      timer: { softDeadlineSeconds: 90, onExpire: "resolved-failure" },
      consequence: { kind: "crew-damage", severity: "medium", cause: "electrocution" },
    };
    // Triggered, never resolved → el timer decide el desenlace.
    const flags = { triggered: true, resolved: false };
    const victim: CrewActor = {
      id: "crew-1" as CrewActorId,
      name: "Ríos",
      specialty: "ingeniero",
      tier: "novato",
      trait: "estoico",
      hp: 100,
      maxHp: 100,
      status: "idle",
    };
    const crew = new MutableCrewState([victim]);
    const crewEmitter = new EventEmitter<CrewDomainEvent>();
    const crewEvents: CrewDomainEvent[] = [];
    crewEmitter.onAny((event) => crewEvents.push(event));

    const runtime = new CrisisRuntime({
      definition,
      shipState: new MutableShipState(fixtureShip()),
      registries: registriesOf(flags),
      crew,
      crewEmitter,
    });

    runtime.tick({ dtSeconds: 1, elapsedSeconds: 1 });
    expect(runtime.crisisState).toBe("active");
    expect(crewEvents).toHaveLength(0);

    // El timer vence: fallo + daño real (medium = 50% de maxHp) al tripulante vivo.
    runtime.tick({ dtSeconds: 1, elapsedSeconds: 95 });
    expect(runtime.crisisState).toBe("resolved-failure");
    expect(crew.get("crew-1" as CrewActorId)?.hp).toBe(50);
    expect(crewEvents).toEqual([
      { kind: "crew-damaged", actorId: "crew-1", cause: "electrocution", hpLost: 50, remainingHp: 50, elapsedSeconds: 95 },
    ]);
  });

  it("aplica descargas periódicas del hazard mientras el timer corre, no letales (cap. 2)", () => {
    const definition: CrisisDefinition = {
      ...definitionOf(),
      timer: { softDeadlineSeconds: 100, onExpire: "resolved-failure" },
      consequence: { kind: "crew-damage", severity: "medium", cause: "electrocution", lethal: false },
      hazard: {
        kind: "periodic-crew-damage",
        startFraction: 0.6, // empieza a los 60s
        intervalSeconds: 15,
        severity: "high", // 100% de maxHp: sin piso mataría — el minHp lo impide
        cause: "electrocution",
        lethal: false,
      },
    };
    const flags = { triggered: true, resolved: false };
    const victim: CrewActor = {
      id: "crew-1" as CrewActorId,
      name: "Ríos",
      specialty: "ingeniero",
      tier: "novato",
      trait: "estoico",
      hp: 100,
      maxHp: 100,
      status: "idle",
    };
    const crew = new MutableCrewState([victim]);
    const crewEmitter = new EventEmitter<CrewDomainEvent>();
    const crewEvents: CrewDomainEvent[] = [];
    crewEmitter.onAny((event) => crewEvents.push(event));

    const runtime = new CrisisRuntime({
      definition,
      shipState: new MutableShipState(fixtureShip()),
      registries: registriesOf(flags),
      crew,
      crewEmitter,
    });

    // Antes del umbral (t=50s): sin descargas.
    runtime.tick({ dtSeconds: 1, elapsedSeconds: 50 });
    expect(crewEvents).toHaveLength(0);

    // Pasado el umbral: una descarga (t=60s) y otra al siguiente intervalo (t=75s).
    //
    // Solo la PRIMERA emite: con severidad `high` y `lethal: false`, la primera
    // descarga ya deja al tripulante clavado en el piso de 1 HP, y desde la
    // ronda 1 de playtest de 13f un daño que no quita vida no emite evento
    // (`applyHpLoss`). Antes se emitía un `crew-damaged` con `hpLost: 0` por
    // cada descarga: sangre saltando sobre alguien que no perdía nada.
    runtime.tick({ dtSeconds: 1, elapsedSeconds: 60 });
    runtime.tick({ dtSeconds: 1, elapsedSeconds: 75 });
    expect(crewEvents).toHaveLength(1);
    expect(crewEvents.every((event) => event.kind === "crew-damaged")).toBe(true);
    // No letal: el HP nunca baja de 1 pese a severidad "high".
    expect(crew.get("crew-1" as CrewActorId)!.hp).toBeGreaterThanOrEqual(1);
    expect(runtime.crisisState).toBe("active");
  });

  it("reads the live ship state from MutableShipState on every tick", () => {
    // Trigger real (no controlado por flag): depende del `condition` real del ship.
    const shipState = new MutableShipState(fixtureShip());
    const realTriggerRule: CrisisTriggerRule = {
      kind: "jammed-actuator-blocks-section",
      isTriggered: (_spec, ctx) =>
        ctx.ship.placedComponents.some((c) => c.instanceId === "x" && c.condition === "jammed"),
    };
    const runtime = new CrisisRuntime({
      definition: definitionOf(),
      shipState,
      registries: {
        triggerRules: new Map([[realTriggerRule.kind, realTriggerRule]]),
        resolutionRules: registriesOf({ triggered: false, resolved: false }).resolutionRules,
      },
    });

    runtime.tick({ dtSeconds: 1, elapsedSeconds: 1 });
    expect(runtime.crisisState).toBe("not-triggered");

    shipState.set({
      ...shipState.get(),
      placedComponents: [
        {
          instanceId: "x" as PlacedComponentInstanceId,
          componentDefinitionId: "valvula-simple" as never,
          placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          condition: "jammed",
          wear: "nuevo",
        },
      ],
    });
    runtime.tick({ dtSeconds: 1, elapsedSeconds: 2 });
    expect(runtime.crisisState).toBe("active");
  });
});
