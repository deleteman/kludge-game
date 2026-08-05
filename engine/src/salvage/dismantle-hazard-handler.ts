import type { EventEmitter } from "../simulation/event-emitter.js";
import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewDamageCause, CrewDomainEvent } from "../crew/crew-events.types.js";
import { applyCrewDamage } from "../crew/hp-resolution.js";
import type { SalvageDomainEvent, DismantleHazardKind } from "./salvage-hazard.types.js";
import type { DismantleHazardContext, DismantleHazardRule } from "./dismantle-hazard-rules.js";
import { assessDismantleHazards } from "./dismantle-hazard-assessment.js";
import { SALVAGE_HAZARD_PARAMETERS } from "./salvage-parameters.js";

/** Causa de daño (GDD 6.8) que corresponde a cada hazard de desmontaje. */
const DAMAGE_CAUSE_BY_KIND: Readonly<Record<DismantleHazardKind, CrewDamageCause>> = {
  "dismantle-spark": "electrocution",
  "dismantle-spill": "corrosion",
  // La fuga no daña a quien desmonta (ver `SALVAGE_HAZARD_PARAMETERS`); la
  // entrada existe para que el `Record` sea total y el compilador avise si
  // aparece un cuarto hazard sin causa asignada.
  "dismantle-leak": "cold",
};

export interface DismantleHazardHandlerDeps {
  readonly emitter?: EventEmitter<SalvageDomainEvent>;
  readonly crewEmitter?: EventEmitter<CrewDomainEvent>;
  /** Actor que ejecuta la tarea, para aplicarle el daño. */
  readonly actorOf?: (actorId: CrewActorId) => CrewActor | undefined;
  /** Persiste el actor dañado (`MutableCrewState.set`), igual que `CrisisRuntime`. */
  readonly setActor?: (actor: CrewActor) => void;
  readonly rules?: ReadonlyArray<DismantleHazardRule>;
}

export interface DismantleHazardOutcome {
  readonly events: ReadonlyArray<SalvageDomainEvent>;
  /**
   * `true` si el desmontaje fue inseguro: la pieza sale un escalón MÁS
   * degradada de lo que la tirada de GDD §6.5 ya decidió (13c). Tercera
   * consecuencia acordada con el operador, junto al daño y la ignición.
   */
  readonly extraWearStep: boolean;
}

/**
 * Parte con efectos del riesgo de desmontaje (Subfase 13d): evalúa,
 * emite y daña. Vive fuera de `ship-task-effect.ts` a propósito — ese archivo
 * ya ronda las 300 líneas y su responsabilidad es mutar el `Blueprint`, no
 * resolver consecuencias de dominio.
 *
 * La ignición real de la sección NO se decide acá: se emite `dismantle-spark`
 * y `MissionReactionRuntime` la escucha, igual que ya escuchaba `overload`.
 * El motor de reacciones sigue siendo el único que decide si algo arde.
 */
export function handleDismantleHazards(
  ctx: DismantleHazardContext,
  deps: DismantleHazardHandlerDeps = {},
): DismantleHazardOutcome {
  const events = assessDismantleHazards(ctx, deps.rules);
  if (events.length === 0) {
    return { events, extraWearStep: false };
  }

  for (const event of events) {
    deps.emitter?.emit(event);
  }
  return { events, extraWearStep: true };
}

/**
 * Aplica a un tripulante el daño del peor hazard disparado. Separado de
 * `handleDismantleHazards` porque necesita saber QUIÉN ejecutó la tarea, dato
 * que solo tiene el efecto de tarea.
 */
export function applyDismantleHazardDamage(
  actorId: CrewActorId,
  events: ReadonlyArray<SalvageDomainEvent>,
  elapsedSeconds: number,
  deps: DismantleHazardHandlerDeps,
): void {
  const actor = deps.actorOf?.(actorId);
  if (!actor || actor.hp <= 0) {
    return;
  }
  const worst = events.reduce<{ fraction: number; kind: DismantleHazardKind } | undefined>(
    (best, event) => {
      const fraction = SALVAGE_HAZARD_PARAMETERS.crewDamageFraction[event.kind];
      return best === undefined || fraction > best.fraction ? { fraction, kind: event.kind } : best;
    },
    undefined,
  );
  if (!worst || worst.fraction <= 0) {
    return;
  }
  const { actor: damaged, event } = applyCrewDamage(
    actor,
    worst.fraction,
    DAMAGE_CAUSE_BY_KIND[worst.kind],
    elapsedSeconds,
    // Un accidente de mantenimiento hiere pero nunca mata por sí solo: lo que
    // puede matar es la combustión que la chispa encienda (§5.5).
    { minHp: SALVAGE_HAZARD_PARAMETERS.crewDamageMinHp },
  );
  deps.setActor?.(damaged);
  deps.crewEmitter?.emit(event);
}
