import { describe, expect, it } from "vitest";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewDomainEvent } from "../crew/crew-events.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import { standardSectionAtmosphere } from "../atmosphere/section.types.js";
import type { SalvageDomainEvent } from "./salvage-hazard.types.js";
import type { DismantleHazardContext } from "./dismantle-hazard-rules.js";
import { applyDismantleHazardDamage, handleDismantleHazards } from "./dismantle-hazard-handler.js";

const ACTOR_ID = "crew-1" as CrewActorId;
const INSTANCE_ID = "bateria-1" as PlacedComponentInstanceId;

const INSTANCE: PlacedComponentInstance = {
  instanceId: INSTANCE_ID,
  componentDefinitionId: "bateria-pequena" as ComponentId,
  placement: { position: { x: 1, y: 1 }, footprint: { width: 1, height: 1 }, rotation: 0 },
  condition: "ok",
  wear: "nuevo",
};

function actorFixture(hp = 100): CrewActor {
  return {
    id: ACTOR_ID,
    name: "Vega",
    specialty: "ingeniero",
    tier: "veterano",
    trait: "disciplinado",
    hp,
    maxHp: 100,
    status: "idle",
    currentSectionId: "pasillo-central" as SectionId,
  };
}

function contextOf(overrides: Partial<DismantleHazardContext> = {}): DismantleHazardContext {
  return {
    instance: INSTANCE,
    sectionId: "pasillo-central" as SectionId,
    powered: false,
    reservoirContents: [],
    atmosphere: standardSectionAtmosphere(),
    elapsedSeconds: 10,
    ...overrides,
  };
}

describe("handleDismantleHazards (13d)", () => {
  it("emits nothing and asks for no extra wear on a safe dismantle", () => {
    const emitter = new EventEmitter<SalvageDomainEvent>();
    const seen: SalvageDomainEvent[] = [];
    emitter.onAny((event) => seen.push(event));

    const outcome = handleDismantleHazards(contextOf(), { emitter });

    expect(seen).toEqual([]);
    expect(outcome.extraWearStep).toBe(false);
  });

  it("emits the hazard and asks for an extra wear step on an unsafe dismantle", () => {
    const emitter = new EventEmitter<SalvageDomainEvent>();
    const seen: SalvageDomainEvent[] = [];
    emitter.onAny((event) => seen.push(event));

    const outcome = handleDismantleHazards(contextOf({ powered: true }), { emitter });

    expect(seen.map((event) => event.kind)).toEqual(["dismantle-spark"]);
    expect(outcome.extraWearStep).toBe(true);
  });
});

describe("applyDismantleHazardDamage (13d)", () => {
  it("hurts the actor with the cause matching the hazard", () => {
    const crewEmitter = new EventEmitter<CrewDomainEvent>();
    const seen: CrewDomainEvent[] = [];
    crewEmitter.onAny((event) => seen.push(event));
    let stored: CrewActor | undefined;

    const events = handleDismantleHazards(contextOf({ powered: true })).events;
    applyDismantleHazardDamage(ACTOR_ID, events, 10, {
      crewEmitter,
      actorOf: () => actorFixture(),
      setActor: (actor) => {
        stored = actor;
      },
    });

    expect(seen[0]).toMatchObject({ kind: "crew-damaged", cause: "electrocution" });
    expect(stored?.hp).toBe(75);
  });

  it("never kills: a hazard leaves the actor at 1 HP at worst", () => {
    let stored: CrewActor | undefined;
    const events = handleDismantleHazards(contextOf({ powered: true })).events;

    applyDismantleHazardDamage(ACTOR_ID, events, 10, {
      actorOf: () => actorFixture(5),
      setActor: (actor) => {
        stored = actor;
      },
    });

    expect(stored?.hp).toBe(1);
  });

  it("does not hurt anyone when only a leak fired (the section takes it, not the crew)", () => {
    let stored: CrewActor | undefined;
    const events = handleDismantleHazards(
      contextOf({ atmosphere: { ...standardSectionAtmosphere(), pressureKpa: 50 } }),
    ).events;

    applyDismantleHazardDamage(ACTOR_ID, events, 10, {
      actorOf: () => actorFixture(),
      setActor: (actor) => {
        stored = actor;
      },
    });

    expect(events.map((event) => event.kind)).toEqual(["dismantle-leak"]);
    expect(stored).toBeUndefined();
  });

  it("applies only the worst hazard when several fired at once", () => {
    let stored: CrewActor | undefined;
    const events = handleDismantleHazards(
      contextOf({
        powered: true,
        reservoirContents: [
          { componentInstanceId: INSTANCE_ID, substanceId: "acido" as ChemicalSubstanceId, amount: 2 },
        ],
      }),
    ).events;

    applyDismantleHazardDamage(ACTOR_ID, events, 10, {
      actorOf: () => actorFixture(),
      setActor: (actor) => {
        stored = actor;
      },
    });

    // Dos hazards, UNA descarga de daño (25% de 100), no dos acumuladas.
    expect(events).toHaveLength(2);
    expect(stored?.hp).toBe(75);
  });
});
