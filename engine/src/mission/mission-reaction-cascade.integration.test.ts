import { describe, expect, it } from "vitest";
import { MissionOverloadRuntime } from "./mission-overload-runtime.js";
import { MissionReactionRuntime } from "./mission-reaction-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { ReactionResolver } from "../chemistry/reaction/reaction-resolver.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ReactantSubstance } from "../chemistry/reaction/reaction-context.types.js";
import type { ScriptedOverloadSubject, ScriptedReactionSubject } from "../crisis/crisis-definition.types.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { ReactionDomainEvent } from "../chemistry/reaction/reaction-events.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { SectionAtmosphere, SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

const SECTION = "sala-refrigerante" as SectionId;
const THERMAL_CONDUCTOR_INSTANCE = "regulador-termico" as PlacedComponentInstanceId;

function componentRegistry(): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  registry.register("regulador-termico-fixture" as ComponentId, {
    level: "atomic",
    id: "regulador-termico-fixture" as ComponentId,
    name: "Regulador térmico (fixture)",
    data: { footprint: { width: 1, height: 1 }, functional: [{ tag: "COND", resourceType: "T", maxCapacity: 20 }] },
  });
  return registry;
}

function blueprint(): Blueprint {
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
        instanceId: THERMAL_CONDUCTOR_INSTANCE,
        componentDefinitionId: "regulador-termico-fixture" as ComponentId,
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

const COMBUSTIBLE_REACTANTS: ReactantSubstance[] = [
  { id: "vapor-refrigerante" as ChemicalSubstanceId, name: "Vapor de refrigerante", tags: [{ name: "COMB" }] },
];

describe("Fase 13a: cascada emergente overload -> combustión (sin encadenamiento scripteado explícito)", () => {
  it("un regulador térmico sobrecargado (fire) enciende una reacción scripteada en la misma sección, un tick después", () => {
    const shipState = new MutableShipState(blueprint());
    const floorplan = fixtureFloorplan();
    const failureEvents = new EventEmitter<FailureDomainEvent>();
    const reactionEvents = new EventEmitter<ReactionDomainEvent>();
    const firedReactions: ReactionDomainEvent[] = [];
    reactionEvents.onAny((event) => firedReactions.push(event));

    const scriptedOverloads: ScriptedOverloadSubject[] = [{ instanceId: THERMAL_CONDUCTOR_INSTANCE, load: 30 }];
    const overloadRuntime = new MissionOverloadRuntime(
      shipState,
      componentRegistry(),
      scriptedOverloads,
      failureEvents,
      // Subfase 13f: el plano es lo que permite estampar `sectionId` en el
      // `OverloadEvent`. El puente de ignición lee ese campo, ya no resuelve
      // la sección por su cuenta.
      floorplan,
    );

    // Ningún dato conecta explícitamente este subject con el overload de
    // arriba más allá de compartir `sectionId` — la cascada emerge del
    // estado compartido (evento de fallo -> ventana de ignición de sección),
    // no de una secuencia programada a mano.
    const scriptedReactions: ScriptedReactionSubject[] = [
      { id: "vapor-1", sectionId: SECTION, reactants: COMBUSTIBLE_REACTANTS, ignitionTrigger: "overload-bridge" },
    ];
    const reactionRuntime = new MissionReactionRuntime(
      shipState,
      floorplan,
      scriptedReactions,
      new ReactionResolver(),
      () => normalAtmosphere(),
      reactionEvents,
      failureEvents,
    );

    // Tick 0: el overload se dispara (load > capacity) y emite "fire"; la
    // reacción todavía no vio la ventana de ignición en este mismo tick
    // porque el listener del bridge corre síncrono ANTES del tick de
    // reacción, así que si se evalúan en el mismo paso, ya debería verlo.
    overloadRuntime.tick(tickOf(0));
    reactionRuntime.tick(tickOf(0));

    // "fire"/"explosion" no dejan cicatriz en `overloadedRefs` (solo "cut" lo
    // hace, ver `MissionOverloadRuntime`) — lo que importa acá es que el
    // evento de fallo haya alcanzado igual al puente de ignición.
    expect(firedReactions).toHaveLength(1);
    expect(firedReactions[0]).toMatchObject({ kind: "combustion", sectionId: SECTION });

    // Ticks posteriores no vuelven a disparar (cicatriz sin retorno).
    reactionRuntime.tick(tickOf(1));
    expect(firedReactions).toHaveLength(1);
  });

  it("sin overload previo, la misma reacción scripteada no combustiona", () => {
    const shipState = new MutableShipState(blueprint());
    const floorplan = fixtureFloorplan();
    const reactionEvents = new EventEmitter<ReactionDomainEvent>();
    const firedReactions: ReactionDomainEvent[] = [];
    reactionEvents.onAny((event) => firedReactions.push(event));

    const scriptedReactions: ScriptedReactionSubject[] = [
      { id: "vapor-1", sectionId: SECTION, reactants: COMBUSTIBLE_REACTANTS, ignitionTrigger: "overload-bridge" },
    ];
    const reactionRuntime = new MissionReactionRuntime(
      shipState,
      floorplan,
      scriptedReactions,
      new ReactionResolver(),
      () => normalAtmosphere(),
      reactionEvents,
    );

    reactionRuntime.tick(tickOf(0));
    reactionRuntime.tick(tickOf(1));

    expect(firedReactions).toHaveLength(0);
  });
});
