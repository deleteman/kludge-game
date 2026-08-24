import { describe, expect, it } from "vitest";
import { MagneticAccelerationAccumulator } from "./magnetic-acceleration.js";
import { DIRECTION_AT_REST } from "./projectile.types.js";
import type { ActiveCoil, CellOccupant, ProjectileBody, ProjectileState, ProjectileWorld } from "./projectile.types.js";
import { previewTrajectory, TRAJECTORY_PREVIEW_PARAMETERS } from "./trajectory-preview.js";

/** Mismo fake de `ProjectileWorld` que `projectile-simulation.test.ts` — el puerto existe para esto. */
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

function atRest(x: number, y: number): ProjectileState {
  return {
    ref: IRON_SLUG.ref,
    position: { x, y },
    direction: DIRECTION_AT_REST,
    velocity: "N",
    cellsSinceLastPulse: 0,
    cellProgress: 0,
  };
}

const REST_SNAPSHOT = new MagneticAccelerationAccumulator(IRON_SLUG.ref).snapshot();

describe("kinetics: previewTrajectory (Fase 11a.3, ASA 3)", () => {
  it("predice el avance por celdas bajo una bobina fija, sin mutar el mundo real", () => {
    const world = new FakeWorld();
    world.coils = [{ ref: "b1", position: { x: 4, y: 0 }, current: "A" }];

    const steps = previewTrajectory({
      world,
      body: IRON_SLUG,
      initialState: atRest(0, 0),
      initialAccumulatorSnapshot: REST_SNAPSHOT,
      ticks: 5,
      dtSeconds: 0.1,
      beforeEachTick: () => {},
    });

    expect(steps.length).toBe(5);
    expect(steps[0]?.velocity).not.toBe("N"); // el campo fijo pulsa en el primer tick
  });

  it("trunca la predicción en el primer impacto — no tiene sentido dibujar el fantasma después", () => {
    const world = new FakeWorld();
    world.put(2, 0, "mamparo-proa");
    world.coils = [{ ref: "b1", position: { x: 1, y: 0 }, current: "A" }];

    const steps = previewTrajectory({
      world,
      body: IRON_SLUG,
      initialState: atRest(0, 0),
      initialAccumulatorSnapshot: REST_SNAPSHOT,
      ticks: 100,
      dtSeconds: 0.1,
      beforeEachTick: () => {},
    });

    // El proyectil impacta y se detiene en la celda anterior a la ocupada:
    // ningún paso posterior al impacto debería aparecer en la predicción.
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThan(100);
    expect(steps[steps.length - 1]?.position).toEqual({ x: 1, y: 0 });
  });

  it("respeta el horizonte de ticks si nada detiene antes al proyectil", () => {
    const world = new FakeWorld(); // sin bobinas, sin obstáculos: nunca impacta
    const ticks = 7;

    const steps = previewTrajectory({
      world,
      body: IRON_SLUG,
      initialState: atRest(0, 0),
      initialAccumulatorSnapshot: REST_SNAPSHOT,
      ticks,
      dtSeconds: TRAJECTORY_PREVIEW_PARAMETERS.dtSeconds,
      beforeEachTick: () => {},
    });

    expect(steps.length).toBe(ticks);
  });

  it("el drag SÍ aparece en la predicción (si predice sin drag, miente — nota del ORDEN_DE_TRABAJO)", () => {
    const world = new FakeWorld(); // sin bobinas: nada que pulse, solo la inercia previa importa
    // Proyectil YA en movimiento (velocidad "M"), moviéndose lejos de toda bobina.
    const movingAtM: ProjectileState = {
      ref: IRON_SLUG.ref,
      position: { x: 0, y: 0 },
      direction: { dx: 1, dy: 0 },
      velocity: "M",
      cellsSinceLastPulse: 0,
      cellProgress: 0,
    };
    const snapshot = {
      accumulatedWeight: 3,
      previousIntensity: "N" as const,
      velocity: "M" as const,
      dragStepsApplied: 0,
    };

    // Sin drag, "M" (5 celdas/s) se conservaría para siempre (ASA Flaw 2).
    const drifting = previewTrajectory({
      world,
      body: IRON_SLUG,
      initialState: movingAtM,
      initialAccumulatorSnapshot: snapshot,
      ticks: 10,
      dtSeconds: 1,
      beforeEachTick: () => {},
    });

    const order = ["N", "B", "M", "A"];
    const finalVelocity = drifting[drifting.length - 1]?.velocity as string;
    expect(order.indexOf(finalVelocity)).toBeLessThan(order.indexOf("M"));
  });

  it("continúa desde un acumulador ya en movimiento (no arranca en reposo — el fantasma no miente sobre inercia previa)", () => {
    const world = new FakeWorld(); // sin más bobinas: solo la inercia importa

    const inMotion: ProjectileState = {
      ref: IRON_SLUG.ref,
      position: { x: 10, y: 0 },
      direction: { dx: 1, dy: 0 },
      velocity: "A",
      cellsSinceLastPulse: 0,
      cellProgress: 0,
    };
    const snapshot = {
      accumulatedWeight: 6,
      previousIntensity: "A" as const,
      velocity: "A" as const,
      dragStepsApplied: 0,
    };

    const steps = previewTrajectory({
      world,
      body: IRON_SLUG,
      initialState: inMotion,
      initialAccumulatorSnapshot: snapshot,
      ticks: 1,
      dtSeconds: 0.1,
      beforeEachTick: () => {},
    });

    // Velocidad "A" = 10 celdas/s: en 0.1s avanza exactamente 1 celda.
    expect(steps[0]?.position).toEqual({ x: 11, y: 0 });
    expect(steps[0]?.velocity).toBe("A");
  });

  it("beforeEachTick permite avanzar estado externo (señales) en el mismo orden que producción", () => {
    const world = new FakeWorld();
    world.coils = [{ ref: "b1", position: { x: 3, y: 0 }, current: "A" }];
    let externalTicks = 0;

    previewTrajectory({
      world,
      body: IRON_SLUG,
      initialState: atRest(0, 0),
      initialAccumulatorSnapshot: REST_SNAPSHOT,
      ticks: 4,
      dtSeconds: 0.1,
      beforeEachTick: () => {
        externalTicks += 1;
      },
    });

    expect(externalTicks).toBe(4);
  });
});
