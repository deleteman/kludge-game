// Fase 11d (integración, "sub-fase 11d.2") — "Intruso en el pasillo": un
// enemigo a distancia (torreta portátil) y uno cuerpo a cuerpo (garra de
// abordaje) avanzan por su `ScriptedRoute` real hasta entrar en rango de
// combate contra la tripulación, tal como correría en misión real
// (`EnemyThreatRuntime`, no un runtime de test simplificado) — mismo criterio
// que el caso 17 valida el sistema real, no una maqueta del sistema.
import { describe, expect, it } from "vitest";
import {
  EnemyThreatRuntime,
  EventEmitter,
  MapEntityRegistry,
  MutableCrewState,
  MutableEnemyState,
  type ComponentId,
  type CrewActor,
  type CrewActorId,
  type CrewDomainEvent,
  type EnemyActor,
  type EnemyActorId,
  type EnemyDomainEvent,
  type PhysicalComponentDefinition,
  type ScriptedRoute,
  type SectionId,
} from "../index.js";

const sectionA = "seccion-a" as SectionId;

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

function registry(): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const map = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  map.register(meleeWeapon.id, meleeWeapon);
  map.register(rangedWeapon.id, rangedWeapon);
  return map;
}

describe("case 18 — Intruso en el pasillo", () => {
  it("un enemigo a distancia y uno cuerpo a cuerpo avanzan por su ruta real y conectan sus ataques al entrar en rango", () => {
    const tripulanteA: CrewActor = {
      id: "tripulante-a" as CrewActorId,
      name: "Tripulante A",
      specialty: "seguridad",
      tier: "novato",
      trait: "temerario",
      hp: 100,
      maxHp: 100,
      status: "idle",
      currentSectionId: sectionA,
      currentCell: { x: 10, y: 0 },
    };
    const tripulanteB: CrewActor = {
      id: "tripulante-b" as CrewActorId,
      name: "Tripulante B",
      specialty: "ingeniero",
      tier: "novato",
      trait: "estoico",
      hp: 100,
      maxHp: 100,
      status: "idle",
      currentSectionId: sectionA,
      currentCell: { x: 0, y: 20 },
    };
    const crew = new MutableCrewState([tripulanteA, tripulanteB]);

    const enemyRanged: EnemyActor = {
      id: "enemigo-torreta" as EnemyActorId,
      archetype: "agile",
      hp: 40,
      maxHp: 40,
      sectionId: sectionA,
      cell: { x: 0, y: 0 },
      weaponComponentId: rangedWeapon.id,
      status: "advancing",
    };
    const enemyMelee: EnemyActor = {
      id: "enemigo-garra" as EnemyActorId,
      archetype: "armored",
      hp: 60,
      maxHp: 60,
      sectionId: sectionA,
      cell: { x: 0, y: 20 },
      weaponComponentId: meleeWeapon.id,
      status: "advancing",
    };
    const enemies = new MutableEnemyState([enemyRanged, enemyMelee]);

    // La torreta se detiene a distancia 3 de tripulante-A (rango a distancia
    // 2-3): |10-7| = 3. La garra llega adyacente a tripulante-B: |0-1| = 1.
    const rangedRoute: ScriptedRoute = {
      enemyId: enemyRanged.id,
      waypoints: [
        { cell: { x: 0, y: 0 }, sectionId: sectionA, arrivalSeconds: 0 },
        { cell: { x: 7, y: 0 }, sectionId: sectionA, arrivalSeconds: 2 },
      ],
      onComplete: "hold",
    };
    const meleeRoute: ScriptedRoute = {
      enemyId: enemyMelee.id,
      waypoints: [
        { cell: { x: 0, y: 20 }, sectionId: sectionA, arrivalSeconds: 0 },
        { cell: { x: 1, y: 20 }, sectionId: sectionA, arrivalSeconds: 3 },
      ],
      onComplete: "hold",
    };
    const routes = new Map([
      [enemyRanged.id, rangedRoute],
      [enemyMelee.id, meleeRoute],
    ]);

    const enemyEvents: EnemyDomainEvent[] = [];
    const enemyEmitter = new EventEmitter<EnemyDomainEvent>();
    enemyEmitter.onAny((event) => enemyEvents.push(event));
    const crewEvents: CrewDomainEvent[] = [];
    const crewEmitter = new EventEmitter<CrewDomainEvent>();
    crewEmitter.onAny((event) => crewEvents.push(event));

    const runtime = new EnemyThreatRuntime({
      enemies,
      routes,
      crew,
      componentRegistry: registry(),
      enemyEmitter,
      crewEmitter,
    });

    const dt = 0.1;
    for (let t = 0; t < 58; t += 1) {
      runtime.tick({ dtSeconds: dt, elapsedSeconds: (t + 1) * dt });
    }

    // Avance por waypoints: cada enemigo emitió su único cambio de celda
    // (llegó al waypoint final y se detuvo ahí, `onComplete: "hold"`).
    const advancedIds = enemyEvents.filter((event) => event.kind === "enemy-advanced").map((event) => event.enemyId);
    expect(advancedIds).toContain(enemyRanged.id);
    expect(advancedIds).toContain(enemyMelee.id);

    // Ataque a distancia: la torreta conecta contra tripulante-A apenas entra
    // en rango 2-3 (t=2s) — severidad "high" (letal, GDD 6.1 permadeath).
    const rangedAttack = enemyEvents.find(
      (event) => event.kind === "enemy-attacked" && event.enemyId === enemyRanged.id,
    );
    expect(rangedAttack).toMatchObject({ rangeKind: "ranged", targetId: tripulanteA.id });
    expect(crew.get(tripulanteA.id)?.hp).toBe(0);
    expect(crewEvents).toContainEqual(
      expect.objectContaining({ kind: "crew-death", actorId: tripulanteA.id, cause: "enemy-attack" }),
    );

    // Ataque cuerpo a cuerpo: la garra conecta contra tripulante-B al llegar
    // adyacente (t=3s) — severidad "medium", hiere pero no mata.
    const meleeAttack = enemyEvents.find(
      (event) => event.kind === "enemy-attacked" && event.enemyId === enemyMelee.id,
    );
    expect(meleeAttack).toMatchObject({ rangeKind: "melee", targetId: tripulanteB.id });
    expect(crew.get(tripulanteB.id)?.hp).toBe(50);
    expect(crewEvents).toContainEqual(
      expect.objectContaining({ kind: "crew-damaged", actorId: tripulanteB.id, cause: "enemy-attack", hpLost: 50 }),
    );

    // Cadencia: dentro de la ventana de 5.8s ninguna de las dos armas repitió
    // ataque (torreta cada 5s, garra cada 4s — el siguiente caería recién en
    // t=7s), así que solo hay un `enemy-attacked` por enemigo.
    expect(enemyEvents.filter((event) => event.kind === "enemy-attacked")).toHaveLength(2);
  });
});
