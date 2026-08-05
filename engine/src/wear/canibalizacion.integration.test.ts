// Integración de la Subfase 13c — "canibalizar deja la pieza frágil".
//
// Recorre el ciclo completo que hasta 13c era GRATUITO: desmontar una pieza
// instalada, verla volver al stock con su historia, reinstalarla, y comprobar
// que la misma carga que la pieza de fábrica toleraba ahora la revienta. Es el
// Gap ① de Duskers ("hardware degradado pero funcional") y el Pilar 2 de
// CLAUDE.md (consecuencias permanentes) cerrados de punta a punta.
import { describe, expect, it } from "vitest";
import { createShipTaskEffect } from "../mission/ship-task-effect.js";
import { MissionOverloadRuntime } from "../mission/mission-overload-runtime.js";
import { MutableShipState } from "../mission/mutable-ship-state.js";
import { MutableAtomicStock } from "../inventory/mutable-atomic-stock.js";
import { stockOfWear } from "../inventory/inventory-ledger.js";
import { createCrewTask } from "../tasks/task-factory.js";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { sequenceRandom } from "../simulation/random-source.js";
import { effectiveResistance } from "./effective-resistance.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewTaskId } from "../tasks/task.types.js";
import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";

const NOVATO = "novato-1" as CrewActorId;
const CONDUCTOR = "cable-grueso" as ComponentId;
const INSTANCE = "cable-1" as PlacedComponentInstanceId;
const CAPACITY = 100;

const tickOf = (elapsed: number): TickContext => ({ dtSeconds: 1, elapsedSeconds: elapsed });

function crewActor(overrides: Partial<CrewActor> = {}): CrewActor {
  return {
    id: NOVATO,
    name: "Novato",
    specialty: "seguridad",
    tier: "novato",
    trait: "metodico",
    hp: 10,
    maxHp: 10,
    ...overrides,
  } as CrewActor;
}

function registryWithConductor(): MapEntityRegistry<ComponentId, PhysicalComponentDefinition> {
  const registry = new MapEntityRegistry<ComponentId, PhysicalComponentDefinition>();
  registry.register(CONDUCTOR, {
    level: "atomic",
    id: CONDUCTOR,
    name: "Cable grueso (fixture)",
    data: {
      footprint: { width: 1, height: 1 },
      functional: [{ tag: "COND", resourceType: "E", maxCapacity: CAPACITY }],
      material: { RE: "A", CE: "A" },
    },
  });
  return registry;
}

function shipWithConductor(wear: "nuevo" | "usado" | "degradado" | "critico" = "nuevo"): Blueprint {
  return {
    metadata: {
      schemaVersion: 7,
      id: "fixture-13c",
      name: "Fixture 13c",
      engineVersion: "0.0.0",
      createdAt: "2026-08-05T00:00:00.000Z",
      updatedAt: "2026-08-05T00:00:00.000Z",
    },
    placedComponents: [
      {
        instanceId: INSTANCE,
        componentDefinitionId: CONDUCTOR,
        placement: { position: { x: 0, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
        condition: "ok",
        wear,
      },
    ],
    reservoirContents: [],
    signalGraph: { nodes: [], edges: [] },
    sectionAtmospheres: [],
    unpoweredSectionIds: [],
    overloadedRefs: [],
    powerState: { sectionAllocations: [], instancePriorities: [], permanentlyDisconnectedSectionIds: [], dischargedSourceIds: [] },
  };
}

/** Corre la sobrecarga scripteada con una carga dada y dice si el conductor se cortó. */
function overloadsAt(ship: Blueprint, load: number): boolean {
  const shipState = new MutableShipState(ship);
  const runtime = new MissionOverloadRuntime(shipState, registryWithConductor(), [
    { instanceId: INSTANCE, load },
  ]);
  runtime.tick(tickOf(0));
  return shipState.get().overloadedRefs.includes(INSTANCE);
}

describe("13c — canibalizar deja la pieza frágil (integración)", () => {
  it("recorre el ciclo completo: desmontar → stock desgastado → reinstalar → más frágil", () => {
    const registry = registryWithConductor();
    const shipState = new MutableShipState(shipWithConductor());
    const atomicStock = new MutableAtomicStock({});
    const effect = createShipTaskEffect(shipState, registry, atomicStock, undefined, {
      // Tirada por encima del 0.6 del novato: la pieza sufre al salir.
      random: sequenceRandom([0.95]),
      actorOf: () => crewActor(),
    });

    const dismantle = effect(
      createCrewTask({
        id: "t-desmontar" as CrewTaskId,
        actorId: NOVATO,
        type: "dismantle",
        payload: { kind: "dismantle", instanceId: INSTANCE },
      }),
    );

    // 1. La pieza vuelve al stock CON su historia, no como repuesto de fábrica.
    expect(stockOfWear(atomicStock.get(), CONDUCTOR, "usado")).toBe(1);
    expect(stockOfWear(atomicStock.get(), CONDUCTOR, "nuevo")).toBe(0);
    // 2. El desmontaje reporta el desgaste, para que `/game` no mienta al notificarlo.
    expect(dismantle?.obtained).toEqual([
      { componentId: CONDUCTOR, quantity: 1, wear: "usado", degraded: true },
    ]);

    // 3. Reinstalarla consume el bucket desgastado y la instancia nace desgastada.
    effect(
      createCrewTask({
        id: "t-instalar" as CrewTaskId,
        actorId: NOVATO,
        type: "install",
        payload: {
          kind: "install",
          instanceId: "cable-2" as PlacedComponentInstanceId,
          componentDefinitionId: CONDUCTOR,
          placement: { position: { x: 1, y: 0 }, footprint: { width: 1, height: 1 }, rotation: 0 },
          wear: "usado",
        },
      }),
    );

    const reinstalled = shipState.get().placedComponents[0]!;
    expect(reinstalled.wear).toBe("usado");
    expect(stockOfWear(atomicStock.get(), CONDUCTOR, "usado")).toBe(0);

    // 4. Sigue funcionando igual (fragilidad, NO eficiencia): conserva su
    //    propiedad funcional intacta, no hay nerf de capacidad nominal.
    expect(registry.get(reinstalled.componentDefinitionId)?.data.functional).toEqual([
      { tag: "COND", resourceType: "E", maxCapacity: CAPACITY },
    ]);

    // 5. Pero aguanta menos: su RE efectiva bajó un escalón.
    expect(effectiveResistance("A", reinstalled.wear)).toBe("M");
  });

  it("la misma carga que la pieza nueva toleraba revienta a la desgastada", () => {
    // 90 < 100 (capacidad nominal) pero > 85 (capacidad efectiva de `usado`).
    expect(overloadsAt(shipWithConductor("nuevo"), 90)).toBe(false);
    expect(overloadsAt(shipWithConductor("usado"), 90)).toBe(true);
  });

  it("cada escalón de desgaste adelanta el punto de corte", () => {
    expect(overloadsAt(shipWithConductor("usado"), 75)).toBe(false);
    expect(overloadsAt(shipWithConductor("degradado"), 75)).toBe(true);
    expect(overloadsAt(shipWithConductor("degradado"), 60)).toBe(false);
    expect(overloadsAt(shipWithConductor("critico"), 60)).toBe(true);
  });

  it("un Ingeniero experto devuelve la pieza intacta donde el novato la rompe", () => {
    const roll = 0.9;
    const run = (actor: CrewActor): string => {
      const atomicStock = new MutableAtomicStock({});
      const effect = createShipTaskEffect(
        new MutableShipState(shipWithConductor()),
        registryWithConductor(),
        atomicStock,
        undefined,
        { random: sequenceRandom([roll]), actorOf: () => actor },
      );
      effect(
        createCrewTask({
          id: "t" as CrewTaskId,
          actorId: NOVATO,
          type: "dismantle",
          payload: { kind: "dismantle", instanceId: INSTANCE },
        }),
      );
      return stockOfWear(atomicStock.get(), CONDUCTOR, "nuevo") === 1 ? "nuevo" : "usado";
    };

    expect(run(crewActor())).toBe("usado");
    expect(run(crewActor({ tier: "experto", specialty: "ingeniero" }))).toBe("nuevo");
  });

  // Fix de playtest 13c ronda 1 (obs 4): sin este dato `/game` no puede
  // distinguir "el novato rompió algo" de "salió limpio" al notificar.
  describe("obtained.degraded reporta si ESTE desmontaje empeoró la pieza", () => {
    const dismantleWith = (wear: "nuevo" | "usado" | "degradado" | "critico", roll: number) => {
      const effect = createShipTaskEffect(
        new MutableShipState(shipWithConductor(wear)),
        registryWithConductor(),
        new MutableAtomicStock({}),
        undefined,
        { random: sequenceRandom([roll]), actorOf: () => crewActor() },
      );
      return effect(
        createCrewTask({
          id: "t" as CrewTaskId,
          actorId: NOVATO,
          type: "dismantle",
          payload: { kind: "dismantle", instanceId: INSTANCE },
        }),
      );
    };

    it("es true cuando la tirada falla y la pieza baja un escalón", () => {
      expect(dismantleWith("nuevo", 0.95)?.obtained?.[0]?.degraded).toBe(true);
    });

    it("es false cuando la tirada la salva", () => {
      expect(dismantleWith("nuevo", 0.1)?.obtained?.[0]?.degraded).toBe(false);
    });

    it("es false si la pieza ya venía usada y sigue usada — no sufrió en ESTE desmontaje", () => {
      const result = dismantleWith("usado", 0.1);
      expect(result?.obtained?.[0]?.wear).toBe("usado");
      expect(result?.obtained?.[0]?.degraded).toBe(false);
    });

    it("es false en una pieza ya critica, que no puede empeorar más", () => {
      const result = dismantleWith("critico", 0.99);
      expect(result?.obtained?.[0]?.wear).toBe("critico");
      expect(result?.obtained?.[0]?.degraded).toBe(false);
    });
  });

  it("sin RandomSource inyectado el desmontaje no degrada nada (pre-13c intacto)", () => {
    const atomicStock = new MutableAtomicStock({});
    const effect = createShipTaskEffect(
      new MutableShipState(shipWithConductor()),
      registryWithConductor(),
      atomicStock,
    );
    effect(
      createCrewTask({
        id: "t" as CrewTaskId,
        actorId: NOVATO,
        type: "dismantle",
        payload: { kind: "dismantle", instanceId: INSTANCE },
      }),
    );
    expect(stockOfWear(atomicStock.get(), CONDUCTOR, "nuevo")).toBe(1);
  });
});
