import { beforeEach, describe, expect, it } from "vitest";
import { EventEmitter } from "../simulation/event-emitter.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { KineticDomainEvent, KineticImpactEvent } from "./kinetic-events.types.js";
import { ProjectileSimulation } from "./projectile-simulation.js";
import type {
  ActiveCoil,
  CellOccupant,
  ProjectileBody,
  ProjectileWorld,
} from "./projectile.types.js";

/**
 * Fake del puerto `ProjectileWorld` — la razón de ser del puerto: el dominio
 * cinético se testea sin plano, sin blueprint y sin Phaser.
 */
class FakeWorld implements ProjectileWorld {
  coils: ActiveCoil[] = [];
  readonly occupants = new Map<string, CellOccupant>();

  occupantAt(cell: { x: number; y: number }): CellOccupant | null {
    return this.occupants.get(`${cell.x},${cell.y}`) ?? null;
  }

  activeCoils(): ReadonlyArray<ActiveCoil> {
    return this.coils;
  }

  put(x: number, y: number, ref: string): void {
    this.occupants.set(`${x},${y}`, { ref, kind: "component" });
  }
}

const IRON_SLUG: ProjectileBody = {
  ref: "pieza-hierro",
  footprint: { width: 1, height: 1 },
  re: "M",
};

let elapsed = 0;
function tickOf(dtSeconds: number): TickContext {
  elapsed += dtSeconds;
  return { dtSeconds, elapsedSeconds: elapsed };
}

describe("kinetics: ProjectileSimulation", () => {
  let world: FakeWorld;
  let events: EventEmitter<KineticDomainEvent>;
  let sim: ProjectileSimulation;

  beforeEach(() => {
    elapsed = 0;
    world = new FakeWorld();
    events = new EventEmitter<KineticDomainEvent>();
    sim = new ProjectileSimulation(world, events);
  });

  it("deja el proyectil en reposo mientras no hay bobinas activas", () => {
    sim.register(IRON_SLUG, { x: 0, y: 0 });
    sim.tick(tickOf(1));
    const state = sim.stateOf(IRON_SLUG.ref);
    expect(state?.velocity).toBe("N");
    expect(state?.position).toEqual({ x: 0, y: 0 });
  });

  it("un pulso acelera el proyectil y lo orienta hacia la bobina que lo pulsó", () => {
    sim.register(IRON_SLUG, { x: 0, y: 0 });
    world.coils = [{ ref: "bobina-1", position: { x: 3, y: 0 }, current: "A" }];

    sim.tick(tickOf(0.1));

    const state = sim.stateOf(IRON_SLUG.ref);
    // Intensidad de campo y nivel de velocidad NO son la misma escala: 1 bobina
    // + corriente alta da un campo "M" (tabla del doc §1, literal), que pesa 2;
    // el umbral de velocidad "M" es 3. Un solo pulso deja el proyectil en "B" —
    // hace falta encadenar bobinas para acumular, que es la mecánica del caso 17.
    expect(state?.velocity).toBe("B");
    expect(state?.direction).toEqual({ dx: 1, dy: 0 });
  });

  it("orienta hacia atrás si el jugador pulsa una bobina ya superada (mistiming legible)", () => {
    sim.register(IRON_SLUG, { x: 5, y: 0 });
    world.coils = [{ ref: "bobina-atras", position: { x: 3, y: 0 }, current: "A" }];

    sim.tick(tickOf(0.1));

    expect(sim.stateOf(IRON_SLUG.ref)?.direction).toEqual({ dx: -1, dy: 0 });
  });

  it("avanza por celdas según el nivel de velocidad", () => {
    sim.register(IRON_SLUG, { x: 0, y: 0 });
    world.coils = [{ ref: "bobina-1", position: { x: 3, y: 0 }, current: "A" }];
    sim.tick(tickOf(0.1)); // un pulso → velocidad "B" = 2 celdas/s

    world.coils = []; // fuera de campo: la inercia lo mantiene (doc §2)
    sim.tick(tickOf(1));

    // 2 celdas/s: 0.2 celdas acumuladas en el tick del pulso + 2 en este = 2.2
    // → dos celdas completas, la fracción sobrante queda para el próximo tick.
    const state = sim.stateOf(IRON_SLUG.ref);
    expect(state?.position.x).toBe(2);
    expect(state?.velocity).toBe("B");
  });

  it("conserva la velocidad entre bobinas — la inercia no se reinicia (doc §2)", () => {
    sim.register(IRON_SLUG, { x: 0, y: 0 });
    world.coils = [{ ref: "b1", position: { x: 2, y: 0 }, current: "A" }];
    sim.tick(tickOf(0.01));
    world.coils = []; // el campo cae: hace falta para que la próxima sea flanco de subida
    sim.tick(tickOf(0.01));
    world.coils = [{ ref: "b2", position: { x: 4, y: 0 }, current: "A" }];
    sim.tick(tickOf(0.01));

    // Dos pulsos de intensidad "M" (peso 2+2=4) → umbral de "M" es 3, el de "A" es 6.
    expect(sim.stateOf(IRON_SLUG.ref)?.velocity).toBe("M");
  });

  it("un campo sostenido cuenta como UN pulso, no uno por tick", () => {
    sim.register(IRON_SLUG, { x: 0, y: 0 });
    world.coils = [{ ref: "b1", position: { x: 2, y: 0 }, current: "B" }];
    for (let i = 0; i < 5; i += 1) {
      sim.tick(tickOf(0.01));
    }
    // Un solo pulso de intensidad "B" (peso 1) → velocidad "B", no acumulada 5 veces.
    expect(sim.stateOf(IRON_SLUG.ref)?.velocity).toBe("B");
  });

  it("una bobina débil fuera de alcance no pulsa (decaimiento por distancia, doc §2)", () => {
    sim.register(IRON_SLUG, { x: 0, y: 0 });
    // Campo "B" a 8 celdas: excede el rango efectivo (3) lo suficiente para
    // degradar hasta "N" — no llega. Es lo que castiga espaciar mal las bobinas.
    world.coils = [{ ref: "b-lejana", position: { x: 8, y: 0 }, current: "B" }];
    sim.tick(tickOf(0.1));

    expect(sim.stateOf(IRON_SLUG.ref)?.velocity).toBe("N");
  });

  it("resuelve el impacto contra el ocupante de la celda y detiene el proyectil", () => {
    const impacts: KineticImpactEvent[] = [];
    events.on("kinetic-impact", (event) => impacts.push(event));

    sim.register(IRON_SLUG, { x: 0, y: 0 });
    world.put(3, 0, "mamparo-proa");
    // La bobina envuelve el riel (doc §5): el proyectil atraviesa su celda, no choca con ella.
    world.coils = [{ ref: "b1", position: { x: 2, y: 0 }, current: "A" }];
    sim.tick(tickOf(0.1));
    world.coils = [];
    sim.tick(tickOf(2));

    expect(impacts).toHaveLength(1);
    expect(impacts[0]?.targetRef).toBe("mamparo-proa");
    expect(impacts[0]?.velocity).toBe("B");
    // Subfase 13f: el evento lleva la celda golpeada y qué clase de objetivo
    // era. La celda es la del OCUPANTE, no la del proyectil (que se queda en
    // la anterior) — es dónde ocurre el fenómeno, que es lo que /game pinta.
    expect(impacts[0]?.position).toEqual({ x: 3, y: 0 });
    expect(impacts[0]?.targetKind).toBe("component");

    const state = sim.stateOf(IRON_SLUG.ref);
    // Se detiene EN LA CELDA ANTERIOR: no entra en la celda ocupada.
    expect(state?.position).toEqual({ x: 2, y: 0 });
    expect(state?.velocity).toBe("N");
  });

  it("no atraviesa un obstáculo intermedio aunque cruce varias celdas en un tick", () => {
    const impacts: KineticImpactEvent[] = [];
    events.on("kinetic-impact", (event) => impacts.push(event));

    sim.register(IRON_SLUG, { x: 0, y: 0 });
    world.put(2, 0, "tripulante-1");
    world.coils = [{ ref: "b1", position: { x: 1, y: 0 }, current: "A" }];
    sim.tick(tickOf(0.1));
    world.coils = [];
    sim.tick(tickOf(10)); // dt enorme: 50 celdas de avance en un solo paso

    expect(impacts).toHaveLength(1);
    expect(impacts[0]?.targetRef).toBe("tripulante-1");
    expect(sim.stateOf(IRON_SLUG.ref)?.position).toEqual({ x: 1, y: 0 });
  });

  it("cuenta las celdas recorridas desde el último pulso (insumo del drag, ASA 2)", () => {
    sim.register(IRON_SLUG, { x: 0, y: 0 });
    world.coils = [{ ref: "b1", position: { x: 1, y: 0 }, current: "A" }];
    sim.tick(tickOf(0.1));
    world.coils = [];
    sim.tick(tickOf(1));

    expect(sim.stateOf(IRON_SLUG.ref)?.cellsSinceLastPulse).toBe(2);
  });

  it("pierde la inercia acumulada al colisionar y puede reacelerarse desde cero", () => {
    sim.register(IRON_SLUG, { x: 0, y: 0 });
    world.put(2, 0, "mamparo");
    world.coils = [{ ref: "b1", position: { x: 1, y: 0 }, current: "A" }];
    sim.tick(tickOf(0.1));
    world.coils = [];
    sim.tick(tickOf(1)); // impacta contra el mamparo

    expect(sim.stateOf(IRON_SLUG.ref)?.velocity).toBe("N");

    world.coils = [{ ref: "b2", position: { x: 1, y: 2 }, current: "B" }];
    sim.tick(tickOf(0.01));

    // Reacelera desde cero: un pulso "B" pesa 1 → velocidad "B". Si la inercia
    // previa hubiera sobrevivido al choque, el peso acumulado (2+1=3) daría "M".
    expect(sim.stateOf(IRON_SLUG.ref)?.velocity).toBe("B");
  });

  it("emite la transición de velocidad para la estela de partículas (doc §4)", () => {
    const velocities: string[] = [];
    events.on("magnetic-acceleration", (event) => velocities.push(event.velocity));

    sim.register(IRON_SLUG, { x: 0, y: 0 });
    world.coils = [{ ref: "b1", position: { x: 1, y: 0 }, current: "A" }];
    sim.tick(tickOf(0.01));

    expect(velocities).toEqual(["B"]);
  });

  describe("ASA 2 — drag por celdas recorridas (Fase 11a.2)", () => {
    it("pierde velocidad al recorrer suficientes celdas sin ninguna bobina activa", () => {
      sim.register(IRON_SLUG, { x: 0, y: 0 });
      world.coils = [{ ref: "b1", position: { x: 2, y: 0 }, current: "A" }];
      sim.tick(tickOf(0.01));
      world.coils = [];
      sim.tick(tickOf(0.01));
      world.coils = [{ ref: "b2", position: { x: 4, y: 0 }, current: "A" }];
      sim.tick(tickOf(0.01)); // mismo riel que "conserva la velocidad entre bobinas" -> velocidad "M"
      world.coils = [];
      const velocityBeforeDrift = sim.stateOf(IRON_SLUG.ref)?.velocity;

      // Recorre muchas celdas sin ninguna bobina activa, más allá del umbral de drag.
      for (let i = 0; i < 10; i += 1) {
        sim.tick(tickOf(1));
      }

      const order = ["N", "B", "M", "A"];
      const finalVelocity = sim.stateOf(IRON_SLUG.ref)?.velocity as string;
      expect(order.indexOf(finalVelocity)).toBeLessThan(order.indexOf(velocityBeforeDrift as string));
    });

    it("suficientemente lejos y sin nuevos pulsos, el proyectil termina en reposo total (previene rebotes infinitos)", () => {
      sim.register(IRON_SLUG, { x: 0, y: 0 });
      world.coils = [{ ref: "b1", position: { x: 2, y: 0 }, current: "A" }];
      sim.tick(tickOf(0.01));
      world.coils = [];
      sim.tick(tickOf(0.01));
      world.coils = [{ ref: "b2", position: { x: 4, y: 0 }, current: "A" }];
      sim.tick(tickOf(0.01));
      world.coils = [];

      for (let i = 0; i < 50; i += 1) {
        sim.tick(tickOf(1));
      }

      const state = sim.stateOf(IRON_SLUG.ref);
      expect(state?.velocity).toBe("N");
      expect(state?.direction).toEqual({ dx: 0, dy: 0 });

      const positionAfterStop = state?.position.x;
      sim.tick(tickOf(5));
      // En reposo, no vuelve a moverse por sí solo.
      expect(sim.stateOf(IRON_SLUG.ref)?.position.x).toBe(positionAfterStop);
    });

    it("un campo sostenido (sin flanco nuevo) no dispara drag aunque el proyectil recorra muchas celdas", () => {
      sim.register(IRON_SLUG, { x: 0, y: 0 });
      // Cadena de bobinas solapadas (huecos de 4 celdas, bien dentro del rango
      // efectivo + margen de decaimiento de cada una): el campo nunca cae a
      // "N" en ningún punto del recorrido, así que nunca hay un flanco de
      // subida nuevo -- es UN pulso sostenido espacialmente, no una serie.
      world.coils = [
        { ref: "b0", position: { x: 2, y: 0 }, current: "A" },
        { ref: "b1", position: { x: 6, y: 0 }, current: "A" },
        { ref: "b2", position: { x: 10, y: 0 }, current: "A" },
        { ref: "b3", position: { x: 14, y: 0 }, current: "A" },
        { ref: "b4", position: { x: 18, y: 0 }, current: "A" },
        { ref: "b5", position: { x: 22, y: 0 }, current: "A" },
      ];
      sim.tick(tickOf(0.01));
      const velocityAfterPulse = sim.stateOf(IRON_SLUG.ref)?.velocity;

      for (let i = 0; i < 10; i += 1) {
        sim.tick(tickOf(1));
      }

      expect(sim.stateOf(IRON_SLUG.ref)?.velocity).toBe(velocityAfterPulse);
    });
  });
});
