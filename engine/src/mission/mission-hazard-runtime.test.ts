import { describe, expect, it } from "vitest";
import { MapEntityRegistry } from "../composition/entity-registry.js";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import type { GasKey } from "../atmosphere/atmosphere-composition.types.js";
import { GAS } from "../atmosphere/atmosphere-composition.types.js";
import type { AtmosphereDomainEvent } from "../atmosphere/atmosphere-events.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewDomainEvent } from "../crew/crew-events.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { MissionHazardRuntime } from "./mission-hazard-runtime.js";
import { MutableCrewState } from "./mutable-crew-state.js";

const tickOf = (elapsed: number, dt = 1): TickContext => ({ dtSeconds: dt, elapsedSeconds: elapsed });

const SECTION = "invernadero" as SectionId;
const AMMONIA = "amoniaco" as ChemicalSubstanceId;
const ACID = "acido" as ChemicalSubstanceId;

function floorplan(): ShipFloorplan {
  return {
    id: "fixture",
    archetype: "exploracion",
    nameKey: "fixture",
    gridSize: { width: 2, height: 1 },
    sections: [{ id: SECTION, nameKey: "s", cells: [{ x: 0, y: 0 }] }],
    conduits: [],
    anchors: [],
    componentSeeds: [],
    doors: [],
  };
}

function chemicalRegistry(): MapEntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition> {
  const registry = new MapEntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>();
  registry.register(AMMONIA, {
    id: AMMONIA,
    name: "Amoníaco",
    data: { tags: [{ name: "TOX", level: "A" }] },
  } as unknown as ChemicalSubstanceDefinition);
  registry.register(ACID, {
    id: ACID,
    name: "Ácido",
    data: { tags: [{ name: "CORR", level: "A" }] },
  } as unknown as ChemicalSubstanceDefinition);
  return registry;
}

function actor(hp = 100): CrewActor {
  return {
    id: "tripulante-1" as CrewActorId,
    name: "Tripulante",
    specialty: "ingeniero",
    tier: 2,
    hp,
    maxHp: 100,
    traits: [],
    currentSectionId: SECTION,
    currentCell: { x: 0, y: 0 },
  } as unknown as CrewActor;
}

function mount(gases: ReadonlyArray<readonly [GasKey, number]>, pressureKpa = 101) {
  const plan = floorplan();
  const atmosphereRuntime = new MissionAtmosphereRuntime(plan, [
    { sectionId: SECTION, gases: [...gases], temperatureCelsius: 21, pressureKpa },
  ]);
  const crewState = new MutableCrewState([actor()]);
  const hazardEvents = new EventEmitter<AtmosphereDomainEvent>();
  const crewEvents = new EventEmitter<CrewDomainEvent>();
  const fired: AtmosphereDomainEvent[] = [];
  const crewFired: CrewDomainEvent[] = [];
  hazardEvents.onAny((event) => fired.push(event));
  crewEvents.onAny((event) => crewFired.push(event));

  const runtime = new MissionHazardRuntime({
    shipFloorplan: plan,
    atmosphereRuntime,
    chemicalRegistry: chemicalRegistry(),
    crewState,
    emitter: hazardEvents,
    crewEmitter: crewEvents,
  });
  return { runtime, crewState, fired, crewFired };
}

describe("13f — HazardEvent en producción (deuda #16)", () => {
  it("una atmósfera limpia no emite nada ni hiere a nadie", () => {
    const world = mount([[GAS.OXYGEN, 0.21]]);
    for (let second = 1; second <= 30; second += 1) {
      world.runtime.tick(tickOf(second));
    }

    expect(world.fired).toHaveLength(0);
    expect(world.crewState.all()[0]?.hp).toBe(100);
  });

  it("el cruce a 'incapacitation' avisa e hiere, pero NUNCA mata (aviso previo)", () => {
    // 40% de amoníaco: por encima del umbral de incapacitación (30%) y por
    // debajo del letal (60%).
    const world = mount([
      [GAS.OXYGEN, 0.21],
      [AMMONIA as unknown as GasKey, 0.4],
    ]);
    for (let second = 1; second <= 200; second += 1) {
      world.runtime.tick(tickOf(second));
    }

    expect(world.fired.some((event) => event.kind === "toxic-threshold")).toBe(true);
    const survivor = world.crewState.all()[0]!;
    expect(survivor.hp).toBeGreaterThan(0);
    expect(survivor.hp).toBeLessThan(100);
    expect(world.crewFired.every((event) => event.kind !== "crew-death")).toBe(true);
  });

  it("la severidad 'lethal' sí mata", () => {
    const world = mount([
      [GAS.OXYGEN, 0.21],
      [AMMONIA as unknown as GasKey, 0.9],
    ]);
    world.runtime.tick(tickOf(1));

    expect(world.crewState.all()[0]?.hp).toBe(0);
    expect(world.crewFired.some((event) => event.kind === "crew-death")).toBe(true);
  });

  it("emite 'corrosive-exposure': el efecto y el sonido de 12b por fin tienen quien los dispare", () => {
    const world = mount([
      [GAS.OXYGEN, 0.21],
      [ACID as unknown as GasKey, 0.5],
    ]);
    for (let second = 1; second <= 15; second += 1) {
      world.runtime.tick(tickOf(second));
    }

    expect(world.fired.some((event) => event.kind === "corrosive-exposure")).toBe(true);
  });

  it("el vacío de una sección brechada mata a quien entre, con la causa 'cold' que ya existía", () => {
    const world = mount([[GAS.OXYGEN, 0]], 0);
    for (let second = 1; second <= 40; second += 1) {
      world.runtime.tick(tickOf(second));
    }

    expect(world.crewState.all()[0]?.hp).toBe(0);
    expect(world.crewFired.some((event) => event.kind === "crew-death")).toBe(true);
    // No se inventó un fenómeno nuevo: la muerte por frío ya tiene su variante
    // visual en `crew-death-effect.ts`.
    expect(world.crewFired.at(-1)).toMatchObject({ cause: "cold" });
  });

  /**
   * REGRESIÓN de la ronda 1 de playtest de 13f: "sigue recibiendo daño (veo
   * sangre saltandole aunque no recibe daño en su vida)".
   *
   * El vacío escalaba una fracción con `dtSeconds`. Con el core loop corriendo
   * por FRAME (~0.016 s), `Math.round(100 × 0.1 × 0.016)` = 0: cero daño real y
   * un `crew-damaged` por frame. Este test corre a cadencia de frame a
   * propósito — con ticks de 1 segundo el bug era invisible.
   */
  describe("vacío a cadencia de frame (ronda 1 de playtest)", () => {
    const FRAME = 1 / 60;

    /** Corre `seconds` de simulación a 60 fps. */
    const runFrames = (world: ReturnType<typeof mount>, seconds: number) => {
      const frames = Math.round(seconds / FRAME);
      for (let frame = 1; frame <= frames; frame += 1) {
        world.runtime.tick({ dtSeconds: FRAME, elapsedSeconds: frame * FRAME });
      }
    };

    it("cada mordisco quita vida DE VERDAD y no se emite un evento por frame", () => {
      const world = mount([[GAS.OXYGEN, 0]], 0);
      runFrames(world, 20);

      expect(world.crewFired.length).toBeGreaterThan(0);
      // 20 segundos a 60 fps son 1200 ticks. Mordiscos cada 8 s (+ el
      // inmediato): 3 eventos, no 1200.
      expect(world.crewFired.length).toBeLessThanOrEqual(5);
      for (const event of world.crewFired) {
        if (event.kind === "crew-damaged") {
          expect(event.hpLost).toBeGreaterThan(0);
        }
      }
    });

    it("el primer mordisco avisa pero no mata, ni siquiera con el tripulante a 1 HP", () => {
      const world = mount([[GAS.OXYGEN, 0]], 0);
      world.crewState.set({ ...world.crewState.all()[0]!, hp: 5 });
      world.runtime.tick({ dtSeconds: FRAME, elapsedSeconds: FRAME });

      expect(world.crewState.all()[0]?.hp).toBe(1);
      expect(world.crewFired.every((event) => event.kind !== "crew-death")).toBe(true);
    });

    /**
     * Ronda 3 de playtest: la ventana pasó de ~8 s a ~32 s porque con la
     * anterior era imposible instalar el parche siquiera a la primera (instalar
     * tarda 8-9,6 s y el daño empieza al ENTRAR en la sección). El test fija el
     * margen por los dos lados: tiene que aguantar la cadena de reparación
     * completa (~28 s) y aun así matar si el jugador no reacciona.
     */
    it("aguanta la cadena de reparación completa (~28 s) y mata poco después", () => {
      const world = mount([[GAS.OXYGEN, 0]], 0);
      runFrames(world, 28);
      expect(world.crewState.all()[0]!.hp).toBeGreaterThan(0);

      runFrames(world, 8);
      expect(world.crewState.all()[0]!.hp).toBe(0);
      expect(world.crewFired.some((event) => event.kind === "crew-death")).toBe(true);
    });

    it("salir de la sección brechada resetea la cuenta de mordiscos", () => {
      const world = mount([[GAS.OXYGEN, 0]], 0);
      runFrames(world, 20);
      const hurtHp = world.crewState.all()[0]!.hp;

      // El tripulante sale del plano: deja de estar expuesto.
      world.crewState.set({ ...world.crewState.all()[0]!, currentCell: undefined });
      runFrames(world, 20);
      expect(world.crewState.all()[0]!.hp).toBe(hurtHp);

      // Al volver, el primer mordisco vuelve a ser el aviso no letal.
      world.crewState.set({ ...world.crewState.all()[0]!, currentCell: { x: 0, y: 0 }, hp: 5 });
      world.runtime.tick({ dtSeconds: FRAME, elapsedSeconds: 100 });
      expect(world.crewState.all()[0]!.hp).toBe(1);
    });
  });

  it("una fuga que se estabiliza en el piso de 40 kPa no mata a nadie", () => {
    const world = mount([[GAS.OXYGEN, 0.21]], 40);
    for (let second = 1; second <= 60; second += 1) {
      world.runtime.tick(tickOf(second));
    }

    expect(world.crewState.all()[0]?.hp).toBe(100);
  });
});
