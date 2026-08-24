import { describe, expect, it } from "vitest";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewDomainEvent } from "../crew/crew-events.types.js";
import type { EnemyActor, EnemyActorId } from "../enemies/enemy-actor.types.js";
import type { EnemyDomainEvent } from "../enemies/enemy-events.types.js";
import type { ComponentId } from "../components/physical-component.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type {
  KineticDomainEvent,
  KineticImpactEvent,
} from "../kinetics/kinetic-events.types.js";
import { registerKineticDamage } from "./kinetic-damage-handler.js";
import { MutableCrewState } from "./mutable-crew-state.js";
import { MutableEnemyState } from "./mutable-enemy-state.js";

const CREW = "tripulante-1" as CrewActorId;
const ENEMY = "intruso-1" as EnemyActorId;

function crewActor(): CrewActor {
  return {
    id: CREW,
    name: "Tripulante",
    specialty: "ingeniero",
    tier: 2,
    hp: 100,
    maxHp: 100,
    traits: [],
    currentCell: { x: 1, y: 1 },
  } as unknown as CrewActor;
}

function enemyActor(): EnemyActor {
  return {
    id: ENEMY,
    archetype: "armored",
    hp: 100,
    maxHp: 100,
    sectionId: "pasillo" as SectionId,
    cell: { x: 2, y: 2 },
    weaponComponentId: "garra-de-abordaje" as ComponentId,
    status: "advancing",
  };
}

function impact(
  targetRef: string,
  targetKind: KineticImpactEvent["targetKind"],
  severity: KineticImpactEvent["severity"],
): KineticImpactEvent {
  return {
    kind: "kinetic-impact",
    targetRef,
    targetKind,
    position: { x: 1, y: 1 },
    velocity: "A",
    severity,
    elapsedSeconds: 5,
  };
}

function mount() {
  const kineticEvents = new EventEmitter<KineticDomainEvent>();
  const crewState = new MutableCrewState([crewActor()]);
  const enemyState = new MutableEnemyState([enemyActor()]);
  const crewEmitter = new EventEmitter<CrewDomainEvent>();
  const enemyEmitter = new EventEmitter<EnemyDomainEvent>();
  const crewFired: CrewDomainEvent[] = [];
  const enemyFired: EnemyDomainEvent[] = [];
  crewEmitter.onAny((event) => crewFired.push(event));
  enemyEmitter.onAny((event) => enemyFired.push(event));

  registerKineticDamage({ kineticEvents, crewState, enemyState, crewEmitter, enemyEmitter });
  return { kineticEvents, crewState, enemyState, crewFired, enemyFired };
}

describe("13f — daño cinético real sobre actores (llamador de producción que faltaba)", () => {
  it("un proyectil que golpea a un tripulante le quita HP", () => {
    const world = mount();
    world.kineticEvents.emit(impact(CREW, "crew", "medium"));

    expect(world.crewState.get(CREW)?.hp).toBe(50);
    expect(world.crewFired.at(-1)).toMatchObject({ kind: "crew-damaged", cause: "kinetic-impact" });
  });

  it("un impacto de severidad alta mata (permadeath, GDD 6.1)", () => {
    const world = mount();
    world.kineticEvents.emit(impact(CREW, "crew", "high"));

    expect(world.crewState.get(CREW)?.hp).toBe(0);
    expect(world.crewFired.at(-1)).toMatchObject({ kind: "crew-death" });
  });

  it("derriba a un enemigo: el cañón de riel del caso 17 deja de ser una maqueta", () => {
    const world = mount();
    world.kineticEvents.emit(impact(ENEMY, "enemy", "high"));

    expect(world.enemyState.get(ENEMY)).toMatchObject({ hp: 0, status: "defeated" });
    expect(world.enemyFired.at(-1)).toMatchObject({ kind: "enemy-defeated", enemyId: ENEMY });
  });

  it("un impacto que no basta lo deja herido y avanzando", () => {
    const world = mount();
    world.kineticEvents.emit(impact(ENEMY, "enemy", "low"));

    expect(world.enemyState.get(ENEMY)).toMatchObject({ hp: 75, status: "advancing" });
    expect(world.enemyFired).toHaveLength(0);
  });

  it("un impacto contra pared o contra una pieza no toca a ningún actor", () => {
    const world = mount();
    world.kineticEvents.emit(impact("wall:3,3", "wall", "high"));
    world.kineticEvents.emit(impact("panel-1", "component", "high"));

    expect(world.crewState.get(CREW)?.hp).toBe(100);
    expect(world.enemyState.get(ENEMY)?.hp).toBe(100);
  });
});
