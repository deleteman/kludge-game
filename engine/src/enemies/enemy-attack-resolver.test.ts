import { describe, expect, it } from "vitest";
import { resolveEnemyAttack } from "./enemy-attack-resolver.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { EnemyActor, EnemyActorId } from "./enemy-actor.types.js";
import type { SectionId } from "../atmosphere/section.types.js";

const sectionA = "seccion-a" as SectionId;

function registryWith(...defs: PhysicalComponentDefinition[]): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  for (const def of defs) {
    registry.register(def.id, def);
  }
  return registry;
}

const meleeWeapon: PhysicalComponentDefinition = {
  level: "atomic",
  id: "garra-de-abordaje" as ComponentId,
  name: "Garra de abordaje",
  data: { footprint: { width: 1, height: 1 }, functional: [{ tag: "ACT", power: 50, cadence: 4, directional: true }] },
};

const rangedWeapon: PhysicalComponentDefinition = {
  level: "atomic",
  id: "torreta-automatizada" as ComponentId,
  name: "Torreta automatizada",
  data: {
    footprint: { width: 1, height: 1 },
    functional: [
      { tag: "EM", range: 18, triggerType: "motion", frequency: 2 },
      { tag: "ACT", power: 80, cadence: 5, directional: true },
    ],
  },
};

function enemy(overrides: Partial<EnemyActor> = {}): EnemyActor {
  return {
    id: "enemigo-1" as EnemyActorId,
    archetype: "agile",
    hp: 40,
    maxHp: 40,
    sectionId: sectionA,
    cell: { x: 0, y: 0 },
    weaponComponentId: "garra-de-abordaje" as ComponentId,
    status: "advancing",
    ...overrides,
  };
}

function actor(overrides: Partial<CrewActor> = {}): CrewActor {
  return {
    id: "tripulante-1" as CrewActorId,
    name: "Tripulante de prueba",
    specialty: "ingeniero",
    tier: "novato",
    trait: "estoico",
    hp: 100,
    maxHp: 100,
    status: "idle",
    currentSectionId: sectionA,
    currentCell: { x: 1, y: 0 },
    ...overrides,
  };
}

describe("enemy-attack-resolver: resolveEnemyAttack (Fase 11d)", () => {
  it("un enemigo cuerpo a cuerpo conecta ataque cuando el tripulante está adyacente", () => {
    const outcome = resolveEnemyAttack(enemy(), [actor()], 10, {
      componentRegistry: registryWith(meleeWeapon),
    });
    expect(outcome).not.toBeNull();
    expect(outcome?.rangeKind).toBe("melee");
    expect(outcome?.hp.event).toMatchObject({ kind: "crew-damaged", cause: "enemy-attack" });
  });

  it("un enemigo cuerpo a cuerpo NO conecta si el tripulante está a distancia 2", () => {
    const outcome = resolveEnemyAttack(enemy(), [actor({ currentCell: { x: 2, y: 0 } })], 10, {
      componentRegistry: registryWith(meleeWeapon),
    });
    expect(outcome).toBeNull();
  });

  it("un enemigo a distancia conecta ataque a 2-3 celdas pero no cuerpo a cuerpo", () => {
    const farEnemy = enemy({ weaponComponentId: "torreta-automatizada" as ComponentId });
    const registry = registryWith(rangedWeapon);

    const outcomeAt2 = resolveEnemyAttack(farEnemy, [actor({ currentCell: { x: 2, y: 0 } })], 10, {
      componentRegistry: registry,
    });
    expect(outcomeAt2?.rangeKind).toBe("ranged");

    const outcomeAdjacent = resolveEnemyAttack(farEnemy, [actor({ currentCell: { x: 1, y: 0 } })], 10, {
      componentRegistry: registry,
    });
    expect(outcomeAdjacent).toBeNull();
  });

  it("no conecta contra un tripulante ya muerto (hp 0)", () => {
    const outcome = resolveEnemyAttack(enemy(), [actor({ hp: 0 })], 10, {
      componentRegistry: registryWith(meleeWeapon),
    });
    expect(outcome).toBeNull();
  });

  it("no conecta contra un tripulante sin celda conocida", () => {
    const outcome = resolveEnemyAttack(enemy(), [actor({ currentCell: undefined })], 10, {
      componentRegistry: registryWith(meleeWeapon),
    });
    expect(outcome).toBeNull();
  });

  it("no conecta contra un tripulante en otra sección", () => {
    const outcome = resolveEnemyAttack(
      enemy(),
      [actor({ currentSectionId: "otra-seccion" as SectionId })],
      10,
      { componentRegistry: registryWith(meleeWeapon) },
    );
    expect(outcome).toBeNull();
  });

  it("un ataque letal produce crew-death con cause enemy-attack", () => {
    const outcome = resolveEnemyAttack(enemy(), [actor({ hp: 10, maxHp: 100 })], 10, {
      componentRegistry: registryWith(meleeWeapon),
    });
    // garra-de-abordaje (power 50, cadence 4) -> severidad "medium" (HP_LOSS_FRACTION.medium = 0.5 de maxHp = 50 > hp 10)
    expect(outcome?.hp.event).toMatchObject({ kind: "crew-death", cause: "enemy-attack" });
  });

  it("devuelve null si el componente de arma no existe en el registro", () => {
    const outcome = resolveEnemyAttack(enemy(), [actor()], 10, {
      componentRegistry: new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>(),
    });
    expect(outcome).toBeNull();
  });
});
