import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { Blueprint } from "../blueprint/blueprint.types.js";
import type { ProjectileSimulation } from "../kinetics/projectile-simulation.js";
import {
  previewTrajectory,
  TRAJECTORY_PREVIEW_PARAMETERS,
  type TrajectoryPreviewStep,
} from "../kinetics/trajectory-preview.js";
import { SignalEvaluator } from "../signals/signal-evaluator.js";
import type { SignalGraphState } from "../signals/signal-state.types.js";
import type { SignalNodeId } from "../signals/signal-node.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import { MissionProjectileWorld } from "./mission-projectile-world.js";
import type { EmitterInputSource, SignalOutputReader } from "./mission-signal-runtime.js";
import { MutableShipState } from "./mutable-ship-state.js";

/**
 * Orquestador concreto de la trayectoria fantasma (Fase 11a.3, ASA 3):
 * arma, sobre una COPIA congelada del estado vivo actual, exactamente los
 * mismos ingredientes que corren en producción (`MissionProjectileWorld` +
 * `SignalEvaluator` + `previewTrajectory` del motor), en el mismo orden
 * señales-antes-que-proyectil que `MissionRuntime` — sin mutar `Blueprint`
 * ni `SignalGraphState` reales, y sin emitir ningún evento a los buses
 * reales (`signalEvents`/`kineticEvents`).
 *
 * Congela el `Blueprint` para toda la ventana de predicción: asume que no se
 * instala/desmonta/conecta nada mientras el jugador mira el fantasma, cosa
 * cierta en pausa táctica (el reloj real está congelado, así que ninguna
 * tarea encolada puede completarse y mutar el blueprint real mientras tanto).
 *
 * Vive en `mission/`, no en `kinetics/`, por la misma razón que
 * `MissionProjectileWorld`: necesita conocer `blueprint/` y `signals/`.
 */
export function previewMissionTrajectory(params: {
  readonly blueprint: Blueprint;
  /** Snapshot del `SignalGraphState` vivo (`MissionSignalRuntime.signalState`) — se clona, no se referencia. */
  readonly signalState: SignalGraphState;
  readonly emitterInputs: EmitterInputSource;
  readonly registry: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  readonly projectiles: ProjectileSimulation;
  readonly ref: string;
}): ReadonlyArray<TrajectoryPreviewStep> {
  const { blueprint, signalState, emitterInputs, registry, projectiles, ref } = params;

  const initialState = projectiles.stateOf(ref);
  const body = projectiles.bodyOf(ref);
  const initialAccumulatorSnapshot = projectiles.accumulatorSnapshotOf(ref);
  if (!initialState || !body || !initialAccumulatorSnapshot) {
    return [];
  }

  // Blueprint congelado: `MutableShipState` nunca recibe un `.set()` acá.
  const scratchShipState = new MutableShipState(blueprint);
  // Clon shallow-per-nodo: los `SignalNodeState` son mutables por diseño
  // (`signal-state.types.ts`), así que cada uno se copia para que el
  // dry-run no pise el estado real (latch/delay/contador en curso).
  const scratchState: SignalGraphState = new Map(
    [...signalState].map(([nodeId, nodeState]) => [nodeId, { ...nodeState }]),
  );
  // Sin `emitter`: un dry-run nunca debe disparar `signal-latched`/
  // `counter-threshold-reached` en el bus real.
  const scratchEvaluator = new SignalEvaluator(blueprint.signalGraph);
  const scratchSignals: SignalOutputReader = {
    outputOf: (nodeId: SignalNodeId) => scratchState.get(nodeId)?.output ?? false,
  };
  const scratchWorld = new MissionProjectileWorld(scratchShipState, scratchSignals, registry);

  const ticks = Math.round(
    TRAJECTORY_PREVIEW_PARAMETERS.horizonSeconds / TRAJECTORY_PREVIEW_PARAMETERS.dtSeconds,
  );

  return previewTrajectory({
    world: scratchWorld,
    body,
    initialState,
    initialAccumulatorSnapshot,
    ticks,
    dtSeconds: TRAJECTORY_PREVIEW_PARAMETERS.dtSeconds,
    beforeEachTick: (ctx: TickContext) => {
      scratchEvaluator.tick(scratchState, emitterInputs(), ctx);
    },
  });
}
