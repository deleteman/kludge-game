import type { GridPosition } from "../geometry/grid-position.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { AccumulatorSnapshot } from "./magnetic-acceleration.js";
import { ProjectileSimulation } from "./projectile-simulation.js";
import type { KineticDomainEvent, VelocityLevel } from "./kinetic-events.types.js";
import type { ProjectileBody, ProjectileState, ProjectileWorld } from "./projectile.types.js";
import { EventEmitter } from "../simulation/event-emitter.js";

/**
 * Paso predicho de una trayectoria fantasma (Fase 11a.3, ASA 3). Sin tabla
 * numérica en ningún documento — valores de referencia ajustables, mismo
 * criterio de honestidad que el resto de `..._PARAMETERS` de `kinetics/`.
 */
export const TRAJECTORY_PREVIEW_PARAMETERS = {
  /** Paso fijo, no ligado al framerate: la predicción se calcula una sola vez al entrar en pausa, no por frame. */
  dtSeconds: 0.1,
  /** Horizonte máximo de predicción — red de seguridad si nada detiene antes al proyectil (impacto o drag hasta reposo). */
  horizonSeconds: 10,
} as const;

export interface TrajectoryPreviewStep {
  readonly position: GridPosition;
  readonly velocity: VelocityLevel;
}

/**
 * Dry-run puro de N ticks sobre una `ProjectileSimulation` desechable,
 * reutilizando el mismo código que corre en producción — que la predicción y
 * la simulación real sean el mismo código es lo que garantiza que el
 * fantasma no mienta (una segunda implementación "aproximada" sería un bug
 * esperando). No emite ningún evento a un emisor real: la instancia interna
 * es descartable y solo se usa para detectar el primer impacto y truncar ahí.
 *
 * Agnóstico de dónde sale el `world`/las señales — `kinetics/` sigue sin
 * importar `blueprint/` ni `signals/` (Ports & Adapters, GDD/CLAUDE.md ya
 * establecido en 11a.0). `beforeEachTick` es el gancho por el que el llamador
 * (`mission/`) avanza cualquier estado externo (el grafo de señales) en el
 * mismo orden que la producción real: señales antes que proyectil, para que
 * una bobina que se energiza en el tick ya pulse en el tick.
 */
export function previewTrajectory(params: {
  readonly world: ProjectileWorld;
  readonly body: ProjectileBody;
  readonly initialState: ProjectileState;
  readonly initialAccumulatorSnapshot: AccumulatorSnapshot;
  readonly ticks: number;
  readonly dtSeconds: number;
  readonly beforeEachTick: (ctx: TickContext) => void;
}): ReadonlyArray<TrajectoryPreviewStep> {
  const { world, body, initialState, initialAccumulatorSnapshot, ticks, dtSeconds, beforeEachTick } = params;

  let impacted = false;
  const emitter = new EventEmitter<KineticDomainEvent>();
  emitter.on("kinetic-impact", () => {
    impacted = true;
  });

  const sim = new ProjectileSimulation(world, emitter);
  sim.registerFrom(body, initialState, initialAccumulatorSnapshot);

  const steps: TrajectoryPreviewStep[] = [];
  let elapsedSeconds = 0;
  for (let i = 0; i < ticks && !impacted; i += 1) {
    elapsedSeconds += dtSeconds;
    const ctx: TickContext = { dtSeconds, elapsedSeconds };
    beforeEachTick(ctx);
    sim.tick(ctx);
    const state = sim.stateOf(body.ref);
    if (!state) {
      break;
    }
    steps.push({ position: { ...state.position }, velocity: state.velocity });
  }
  return steps;
}
