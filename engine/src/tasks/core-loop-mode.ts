import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { CoreLoopDomainEvent, CoreLoopMode } from "./task-events.types.js";

/**
 * Algo que avanza con el reloj de simulación. El `TaskScheduler` lo implementa;
 * en Fase 10 los subsistemas del motor (señales, química, atmósfera, fallo,
 * cinética) se adaptarán a esta interfaz y se registrarán en el mismo driver,
 * de modo que la pausa del core loop congele TODA la simulación con una sola
 * palanca (GDD §4.2: "pausa total del reloj … ninguna reacción química avanza").
 */
export interface Tickable {
  tick(ctx: TickContext): void;
}

/**
 * Máquina de modo del core loop de campaña (GDD §4): alterna entre
 * `planning` (pausa total) y `execution` (tiempo real), re-pausable en
 * cualquier momento (GDD §4.5). Es el DRIVER genérico de la simulación: posee
 * un registro de `Tickable` y acumula el tiempo simulado.
 *
 * ALCANCE (Fase 6): el registro es genérico a propósito. El cableado concreto
 * de cada subsistema del motor a este driver se hace en Fase 10 (integración
 * end-to-end); aquí solo se registra el `TaskScheduler`.
 */
export class CoreLoopModeMachine {
  private currentMode: CoreLoopMode = "planning";
  private elapsedSeconds = 0;
  private readonly tickables: Tickable[] = [];

  constructor(private readonly emitter?: EventEmitter<CoreLoopDomainEvent>) {}

  get mode(): CoreLoopMode {
    return this.currentMode;
  }

  get elapsed(): number {
    return this.elapsedSeconds;
  }

  /** Registra un subsistema tickable. Devuelve una función para desregistrarlo. */
  registerTickable(tickable: Tickable): () => void {
    this.tickables.push(tickable);
    return () => {
      const index = this.tickables.indexOf(tickable);
      if (index >= 0) {
        this.tickables.splice(index, 1);
      }
    };
  }

  /** Pasa a ejecución (reanuda el reloj). No-op si ya estaba en ejecución. */
  play(): void {
    this.transitionTo("execution");
  }

  /** Vuelve a planificación (congela el reloj). No-op si ya estaba en planificación. */
  pause(): void {
    this.transitionTo("planning");
  }

  private transitionTo(mode: CoreLoopMode): void {
    if (this.currentMode === mode) {
      return;
    }
    this.currentMode = mode;
    this.emitter?.emit({
      kind: "core-loop-mode-changed",
      mode,
      elapsedSeconds: this.elapsedSeconds,
    });
  }

  /**
   * Avanza un paso de simulación. En `planning` es un NO-OP (nada reacciona,
   * GDD §4.2); en `execution` acumula el tiempo y propaga un `TickContext` a
   * todos los tickables registrados. `dtSeconds` debe ser > 0.
   */
  tick(dtSeconds: number): void {
    if (dtSeconds <= 0) {
      throw new Error(`CoreLoopModeMachine.tick requires dtSeconds > 0, got ${dtSeconds}`);
    }
    if (this.currentMode !== "execution") {
      return;
    }
    this.elapsedSeconds += dtSeconds;
    const ctx: TickContext = { dtSeconds, elapsedSeconds: this.elapsedSeconds };
    // Copia defensiva: un tickable podría desregistrarse durante su propio tick.
    for (const tickable of [...this.tickables]) {
      tickable.tick(ctx);
    }
  }
}
