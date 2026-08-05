import { describe, expect, it } from "vitest";
import { MissionReactionRuntime } from "./mission-reaction-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { ReactionResolver } from "../chemistry/reaction/reaction-resolver.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ChemicalProperties } from "../properties/chemical-tag.types.js";
import type { ReactantSubstance } from "../chemistry/reaction/reaction-context.types.js";
import type { ScriptedReactionSubject } from "../crisis/crisis-definition.types.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

const SECTION = "sala-combustible" as SectionId;
const CONDUCTOR_INSTANCE = "panel-electrico" as PlacedComponentInstanceId;

function sub(id: string, tags: ChemicalProperties): ReactantSubstance {
  return { id: id as ChemicalSubstanceId, name: id, tags };
}

function emptyBlueprint(): Blueprint {
  return {
    metadata: {
      schemaVersion: 5,
      id: "t",
      name: "t",
      engineVersion: "0.0.0",
      createdAt: "2026-08-04",
      updatedAt: "2026-08-04",
    },
    placedComponents: [
      {
        instanceId: CONDUCTOR_INSTANCE,
        componentDefinitionId: "panel-electrico" as ComponentId,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear: "nuevo",
      },
    ],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [] },
  };
}

function fixtureFloorplan(): ShipFloorplan {
  return {
    id: "fixture-floorplan",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 1, height: 1 },
    sections: [{ id: SECTION, nameKey: "fixture-section", cells: [{ x: 0, y: 0 }] }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
  };
}

function normalAtmosphere(): SectionAtmosphere {
  return { gases: new Map([[GAS.OXYGEN, 0.21]]), temperatureCelsius: 21, pressureKpa: 101 };
}

const COMBUSTIBLE_REACTANTS: ReactantSubstance[] = [sub("fuel", [{ name: "COMB" }])];

describe("MissionReactionRuntime (Fase 13a, deuda #16 — química viva de misión)", () => {
  it("ignitionTrigger 'always': combustiona una sola vez con oxígeno real de la sección", () => {
    const shipState = new MutableShipState(emptyBlueprint());
    const floorplan = fixtureFloorplan();
    const scripted: ScriptedReactionSubject[] = [
      { id: "fuga-1", sectionId: SECTION, reactants: COMBUSTIBLE_REACTANTS, ignitionTrigger: "always" },
    ];
    const emitter = new EventEmitter<ReactionDomainEvent>();
    const events: ReactionDomainEvent[] = [];
    emitter.onAny((event) => events.push(event));

    const runtime = new MissionReactionRuntime(
      shipState,
      floorplan,
      scripted,
      new ReactionResolver(),
      () => normalAtmosphere(),
      emitter,
    );

    runtime.tick(tickOf(0));
    runtime.tick(tickOf(1));
    runtime.tick(tickOf(2));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "combustion", sectionId: SECTION });
  });

  it("ignitionTrigger 'overload-bridge': no combustiona sin un overload fire/explosion previo en la sección", () => {
    const shipState = new MutableShipState(emptyBlueprint());
    const floorplan = fixtureFloorplan();
    const scripted: ScriptedReactionSubject[] = [
      { id: "fuga-1", sectionId: SECTION, reactants: COMBUSTIBLE_REACTANTS, ignitionTrigger: "overload-bridge" },
    ];
    const emitter = new EventEmitter<ReactionDomainEvent>();
    const events: ReactionDomainEvent[] = [];
    emitter.onAny((event) => events.push(event));

    const runtime = new MissionReactionRuntime(
      shipState,
      floorplan,
      scripted,
      new ReactionResolver(),
      () => normalAtmosphere(),
      emitter,
    );
    runtime.tick(tickOf(0));

    expect(events).toHaveLength(0);
  });

  it("ignitionTrigger 'overload-bridge': combustiona tras un OverloadEvent fire en la sección del subject", () => {
    const shipState = new MutableShipState(emptyBlueprint());
    const floorplan = fixtureFloorplan();
    const scripted: ScriptedReactionSubject[] = [
      { id: "fuga-1", sectionId: SECTION, reactants: COMBUSTIBLE_REACTANTS, ignitionTrigger: "overload-bridge" },
    ];
    const reactionEmitter = new EventEmitter<ReactionDomainEvent>();
    const events: ReactionDomainEvent[] = [];
    reactionEmitter.onAny((event) => events.push(event));
    const failureEmitter = new EventEmitter<FailureDomainEvent>();

    const runtime = new MissionReactionRuntime(
      shipState,
      floorplan,
      scripted,
      new ReactionResolver(),
      () => normalAtmosphere(),
      reactionEmitter,
      failureEmitter,
    );

    failureEmitter.emit({
      kind: "overload",
      ref: CONDUCTOR_INSTANCE,
      resourceType: "E",
      failureMode: "fire",
      capacity: 20,
      load: 25,
      elapsedSeconds: 0,
    });
    runtime.tick(tickOf(1));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "combustion", sectionId: SECTION });
  });

  it("no dispara nada sin subjects scripteados", () => {
    const shipState = new MutableShipState(emptyBlueprint());
    const floorplan = fixtureFloorplan();
    const runtime = new MissionReactionRuntime(shipState, floorplan, [], new ReactionResolver(), () => normalAtmosphere());
    expect(() => runtime.tick(tickOf(0))).not.toThrow();
  });
});
