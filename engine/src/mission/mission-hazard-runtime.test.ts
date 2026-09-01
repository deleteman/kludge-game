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
import {
  TEMPERATURE_CEILING_CELSIUS,
  TEMPERATURE_FLOOR_CELSIUS,
  THERMAL_SENSOR_TRIGGER_CELSIUS,
} from "../atmosphere/thermal-parameters.js";
import { SECTION_INTEGRITY_PARAMETERS } from "../integrity/section-integrity-parameters.js";
import { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import { HAZARD_PARAMETERS } from "./mission-hazard-parameters.js";
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

function mount(gases: ReadonlyArray<readonly [GasKey, number]>, pressureKpa = 101, temperatureCelsius = 21) {
  const plan = floorplan();
  const atmosphereRuntime = new MissionAtmosphereRuntime(plan, [
    { sectionId: SECTION, gases: [...gases], temperatureCelsius, pressureKpa },
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

/**
 * Ronda 1 de playtest de 14a-2. El operador: "la caída de temperatura debería
 * congelar toda la sección — ¿no debería afectar al tripulante?". El GDD ya lo
 * pedía (6.1 "frío extremo/congelación", 11.1 "daño a tripulante (térmico)") y
 * no existía NINGÚN camino por el que la temperatura tocara a una persona: el
 * único consumidor del eje para daño era la estructura de la sección.
 */
describe("14a-2 ronda 1 — daño térmico a la tripulación", () => {
  const CLEAN: ReadonlyArray<readonly [GasKey, number]> = [[GAS.OXYGEN, 0.21]];
  const FRAME = 1 / 60;

  const runFrames = (world: ReturnType<typeof mount>, seconds: number) => {
    const frames = Math.round(seconds / FRAME);
    for (let frame = 1; frame <= frames; frame += 1) {
      world.runtime.tick({ dtSeconds: FRAME, elapsedSeconds: frame * FRAME });
    }
  };

  it("el rango de operación no hiere a nadie, ni siquiera a lo largo de minutos", () => {
    // 21 °C, y también los bordes de adentro del rango seguro: el test que
    // impide que un rebalanceo deje el umbral mordiendo la sala habitable.
    for (const temperature of [21, -9, 59]) {
      const world = mount(CLEAN, 101, temperature);
      runFrames(world, 120);
      expect(world.crewState.all()[0]?.hp).toBe(100);
      expect(world.crewFired).toHaveLength(0);
    }
  });

  it("el frío extremo mata, con la causa 'cold' que ya tenía variante visual", () => {
    const world = mount(CLEAN, 101, -60);
    runFrames(world, 90);

    expect(world.crewState.all()[0]?.hp).toBe(0);
    expect(world.crewFired.at(-1)).toMatchObject({ kind: "crew-death", cause: "cold" });
  });

  it("el calor extremo mata, con la causa 'fire'", () => {
    const world = mount(CLEAN, 101, 400);
    runFrames(world, 90);

    expect(world.crewState.all()[0]?.hp).toBe(0);
    expect(world.crewFired.at(-1)).toMatchObject({ kind: "crew-death", cause: "fire" });
  });

  /**
   * El bug que originó el molde de mordiscos discretos en 13f: una fracción
   * continua × `dtSeconds` a cadencia de frame redondea a 0, o sea cero daño
   * real y un `crew-damaged` por frame — sangre sobre alguien inmortal. Se
   * verifica en el llamador NUEVO, no solo en el que ya lo tenía.
   */
  it("a cadencia de frame los mordiscos son contables y cada uno quita vida de verdad", () => {
    const world = mount(CLEAN, 101, -60);
    runFrames(world, 30);

    expect(world.crewFired.length).toBeGreaterThan(0);
    // 30 s a 60 fps son 1800 ticks. Mordiscos cada 10 s (+ el inmediato): 4, no 1800.
    expect(world.crewFired.length).toBeLessThanOrEqual(5);
    for (const event of world.crewFired) {
      if (event.kind === "crew-damaged") {
        expect(event.hpLost).toBeGreaterThan(0);
      }
    }
  });

  it("el primer mordisco avisa pero no mata, ni con el tripulante a 1 HP", () => {
    const world = mount(CLEAN, 101, -60);
    world.crewState.set({ ...world.crewState.all()[0]!, hp: 5 });
    world.runtime.tick({ dtSeconds: FRAME, elapsedSeconds: FRAME });

    expect(world.crewState.all()[0]?.hp).toBe(1);
    expect(world.crewFired.every((event) => event.kind !== "crew-death")).toBe(true);
  });

  /**
   * El camino de SALIDA, no solo el de entrada: sacar a alguien de la sala
   * congelada tiene que salvarlo, o el jugador no tiene ninguna jugada.
   */
  it("salir de la sala congelada detiene el daño y resetea la cuenta", () => {
    const world = mount(CLEAN, 101, -60);
    runFrames(world, 25);
    const hurtHp = world.crewState.all()[0]!.hp;
    expect(hurtHp).toBeLessThan(100);

    world.crewState.set({ ...world.crewState.all()[0]!, currentCell: undefined });
    runFrames(world, 60);
    expect(world.crewState.all()[0]!.hp).toBe(hurtHp);

    // Al volver, el primer mordisco es otra vez el aviso no letal.
    world.crewState.set({ ...world.crewState.all()[0]!, currentCell: { x: 0, y: 0 }, hp: 5 });
    world.runtime.tick({ dtSeconds: FRAME, elapsedSeconds: 200 });
    expect(world.crewState.all()[0]!.hp).toBe(1);
  });

  /**
   * Decisión del operador: vacío y frío SE ACUMULAN. Cada uno lleva su propia
   * cuenta de mordiscos, así que una sala brechada Y congelada duele el doble
   * que cualquiera de las dos sola.
   */
  it("vacío y frío se acumulan: la sala brechada y congelada mata más rápido que solo brechada", () => {
    const onlyVacuum = mount([[GAS.OXYGEN, 0]], 0, 21);
    runFrames(onlyVacuum, 20);

    const both = mount([[GAS.OXYGEN, 0]], 0, -60);
    runFrames(both, 20);

    expect(both.crewState.all()[0]!.hp).toBeLessThan(onlyVacuum.crewState.all()[0]!.hp);
  });
});

/**
 * Coherencia del EJE TÉRMICO completo, como test y no como comentario. Impide
 * que un rebalanceo futuro deje un umbral fuera del rango de otro sin que nada
 * avise — que es exactamente cómo la escarcha había quedado atada al umbral de
 * estructura (-40) en vez de al del tripulante.
 */
describe("14a-2 ronda 1 — orden de los umbrales térmicos", () => {
  it("la gente sufre antes que la estructura, y la estructura antes que el clamp, por los dos lados", () => {
    const crew = HAZARD_PARAMETERS.thermal;
    const structure = SECTION_INTEGRITY_PARAMETERS.thermal;

    // Lado frío: -10 > -40 > -80. La sala mata antes de partirse.
    expect(crew.coldOnsetCelsius).toBeGreaterThan(structure.coldOnsetCelsius);
    expect(structure.coldOnsetCelsius).toBeGreaterThan(TEMPERATURE_FLOOR_CELSIUS);

    // Lado caliente: 60 < 100 < 900.
    expect(crew.hotOnsetCelsius).toBeLessThan(structure.hotOnsetCelsius);
    expect(structure.hotOnsetCelsius).toBeLessThan(TEMPERATURE_CEILING_CELSIUS);

    // El rango habitable existe y contiene la temperatura nominal de la nave.
    expect(crew.coldOnsetCelsius).toBeLessThan(crew.hotOnsetCelsius);
  });

  it("el umbral de calor del tripulante es el MISMO que dispara el sensor térmico y el vapor", () => {
    // 14a-1 ató el vapor al sensor para que ver vapor significara sensor
    // disparado. Esto extiende el mismo contrato al daño: si el balance mueve
    // el sensor, se mueven juntos y la UI no puede mentir sobre el motor.
    expect(HAZARD_PARAMETERS.thermal.hotOnsetCelsius).toBe(THERMAL_SENSOR_TRIGGER_CELSIUS);
  });
});
