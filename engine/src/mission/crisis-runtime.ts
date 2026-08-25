import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import { evaluateCrisis, type CrisisRuleRegistries } from "../crisis/crisis-machine.js";
import type { CrisisState } from "../crisis/crisis-state.types.js";
import type { CrisisDefinition } from "../crisis/crisis-definition.types.js";
import type { CrisisDomainEvent } from "../crisis/crisis-events.types.js";
import type { CrewDamageCause, CrewDomainEvent } from "../crew/crew-events.types.js";
import { HP_LOSS_FRACTION, applyCrewDamage } from "../crew/hp-resolution.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { MutableShipState } from "./mutable-ship-state.js";
import type { MutableCrewState } from "./mutable-crew-state.js";

export interface CrisisRuntimeOptions {
  readonly definition: CrisisDefinition;
  readonly shipState: MutableShipState;
  readonly registries: CrisisRuleRegistries;
  readonly emitter?: EventEmitter<CrisisDomainEvent>;
  readonly initialState?: CrisisState;
  /** Catálogo de definiciones — lo necesitan reglas como `functional-tag-installed`. Opcional. */
  readonly componentRegistry?: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  /**
   * Tripulación activa viva de la misión (capítulo 2). Necesaria para aplicar
   * una consecuencia `crew-damage` cuando la crisis expira a `resolved-failure`
   * — `evaluateCrisis` es puro y no la conoce. Opcional: un capítulo sin
   * consecuencia de daño (cap. 1) no la necesita.
   */
  readonly crew?: MutableCrewState;
  readonly crewEmitter?: EventEmitter<CrewDomainEvent>;
}

/**
 * Adaptador `Tickable` (Fase 10b) sobre `evaluateCrisis` (dominio puro de
 * 10a): en cada tick de ejecución re-evalúa la crisis activa contra el
 * `Blueprint` vivo (`MutableShipState`, mutado por `ship-task-effect.ts` al
 * completarse tareas) y emite los eventos resultantes. Se registra en
 * `CoreLoopModeMachine.registerTickable` junto al `TaskScheduler` — la pausa
 * congela ambos con la misma palanca (GDD §4.2).
 */
export class CrisisRuntime implements Tickable {
  private state: CrisisState;
  private readonly definition: CrisisDefinition;
  private readonly shipState: MutableShipState;
  private readonly registries: CrisisRuleRegistries;
  private readonly emitter?: EventEmitter<CrisisDomainEvent>;
  private readonly crew?: MutableCrewState;
  private readonly crewEmitter?: EventEmitter<CrewDomainEvent>;
  private readonly componentRegistry?: EntityRegistry<ComponentId, PhysicalComponentDefinition>;
  /** Descargas del castigo progresivo (`hazard`) ya aplicadas — para no repetir la misma. */
  private hazardShocksApplied = 0;

  constructor(options: CrisisRuntimeOptions) {
    this.definition = options.definition;
    this.shipState = options.shipState;
    this.registries = options.registries;
    this.emitter = options.emitter;
    this.crew = options.crew;
    this.crewEmitter = options.crewEmitter;
    this.componentRegistry = options.componentRegistry;
    this.state = options.initialState ?? "not-triggered";
  }

  get crisisState(): CrisisState {
    return this.state;
  }

  /**
   * Estado de cada objetivo del checklist (Fase 10d, playtest #15): una meta
   * general por resolución de la crisis, marcada `done` cuando su regla
   * `isResolved` da true contra el estado VIVO de la nave. Es la misma fuente de
   * verdad que la resolución global (AND de todas), expuesta por-resolución para
   * mostrar progreso — no duplica la lógica, reusa las reglas registradas.
   */
  objectiveStatuses(): ReadonlyArray<{ readonly objectiveKey?: string; readonly done: boolean }> {
    const ship = this.shipState.get();
    return this.definition.resolutions.map((resolution) => {
      const rule = this.registries.resolutionRules.get(resolution.kind);
      const done = rule
        ? rule.isResolved(resolution, {
            ship,
            tick: { dtSeconds: 0, elapsedSeconds: 0 },
            componentRegistry: this.componentRegistry,
          })
        : false;
      return { objectiveKey: resolution.objectiveKey, done };
    });
  }

  tick(ctx: TickContext): void {
    const previousState = this.state;
    const result = evaluateCrisis(
      this.state,
      this.definition,
      { ship: this.shipState.get(), tick: ctx, componentRegistry: this.componentRegistry },
      this.registries,
    );
    this.state = result.state;
    // Al fallar por vencimiento del timer, aplicar la consecuencia declarada
    // (capítulo 2) ANTES de emitir los eventos de crisis: `evaluateCrisis` solo
    // decidió el desenlace, el efecto real sobre la tripulación vive aquí. El
    // orden importa — quien escucha `crisis-resolved` en `/game` lee de vuelta
    // el HP del tripulante (`toUpdatedSave`), así que el daño debe estar ya
    // aplicado en `crew` cuando ese evento se despacha.
    if (previousState !== "resolved-failure" && result.state === "resolved-failure") {
      this.applyFailureConsequence(ctx.elapsedSeconds);
    } else if (result.state === "active") {
      // Castigo progresivo mientras el timer corre (cap. 2): solo si la crisis
      // sigue activa (no en el tick que la resuelve/falla, para no duplicar daño).
      this.applyHazardIfDue(ctx.elapsedSeconds);
    }
    for (const event of result.events) {
      this.emitter?.emit(event);
    }
  }

  /** Descarga de daño a un tripulante, no-letal si `lethal === false`. Devuelve si golpeó a alguien. */
  private shockCrew(
    severity: "low" | "medium" | "high",
    cause: CrewDamageCause,
    lethal: boolean | undefined,
    elapsedSeconds: number,
    victim: ReturnType<MutableCrewState["firstAlive"]>,
  ): boolean {
    if (!victim) {
      return false;
    }
    const { actor, event } = applyCrewDamage(
      victim,
      HP_LOSS_FRACTION[severity],
      cause,
      elapsedSeconds,
      lethal === false ? { minHp: 1 } : undefined,
    );
    this.crew?.set(actor);
    if (event) {
      this.crewEmitter?.emit(event);
    }
    return true;
  }

  private applyFailureConsequence(elapsedSeconds: number): void {
    const consequence = this.definition.consequence;
    if (consequence.kind !== "crew-damage" || !this.crew) {
      return;
    }
    this.shockCrew(consequence.severity, consequence.cause, consequence.lethal, elapsedSeconds, this.crew.firstAlive());
  }

  private applyHazardIfDue(elapsedSeconds: number): void {
    const hazard = this.definition.hazard;
    const timer = this.definition.timer;
    if (!hazard || !timer || !this.crew) {
      return;
    }
    const startSeconds = timer.softDeadlineSeconds * hazard.startFraction;
    if (elapsedSeconds < startSeconds) {
      return;
    }
    // Cuántas descargas deberían haber ocurrido ya; se aplica de a una por tick
    // (los ticks son ~60fps, así que rara vez hay más de una pendiente).
    const shocksDue = Math.floor((elapsedSeconds - startSeconds) / hazard.intervalSeconds) + 1;
    if (this.hazardShocksApplied >= shocksDue) {
      return;
    }
    if (this.shockCrew(hazard.severity, hazard.cause, hazard.lethal, elapsedSeconds, this.crew.healthiestAlive())) {
      this.hazardShocksApplied += 1;
    }
  }
}
