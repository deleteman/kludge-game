import type { EventEmitter } from "../simulation/event-emitter.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type {
  ConductorProperty,
  ReservoirProperty,
  ResourceType,
} from "../properties/functional.types.js";
import type { FailureDomainEvent, FailureMode, OverloadEvent } from "./failure-events.types.js";

/**
 * Modo de fallo por tipo de recurso (GDD 5.6: "corte, incendio, explosión según
 * tipo de recurso"). Data-driven: mapa ajustable, no un switch.
 */
export const FAILURE_MODE_BY_RESOURCE: Record<ResourceType, FailureMode> = {
  E: "cut", // eléctrico → cortocircuito/corte
  T: "fire", // térmico → incendio
  G: "explosion", // gas a presión → explosión
  L: "cut", // líquido → ruptura/corte de flujo
};

/** Sujeto de una comprobación de sobrecarga: qué recurso, cuánta capacidad, cuánta carga. */
export interface OverloadSubject {
  readonly ref: string;
  readonly resourceType: ResourceType;
  readonly capacity: number;
  readonly load: number;
}

export function conductorOverloadSubject(
  ref: string,
  conductor: ConductorProperty,
  load: number,
): OverloadSubject {
  return { ref, resourceType: conductor.resourceType, capacity: conductor.maxCapacity, load };
}

export function reservoirOverloadSubject(
  ref: string,
  reservoir: ReservoirProperty,
  content: number,
): OverloadSubject {
  return { ref, resourceType: reservoir.resourceType, capacity: reservoir.capacity, load: content };
}

/**
 * Regla de sobrecarga (GDD 5.6). Si la carga supera la capacidad máxima del
 * conductor/reservorio, emite un evento de fallo con el modo correspondiente al
 * tipo de recurso. Devuelve el evento (o null) además de emitirlo, para que se
 * pueda comprobar sin un emisor.
 */
export class OverloadRule {
  evaluate(
    subject: OverloadSubject,
    tick: TickContext,
    emitter?: EventEmitter<FailureDomainEvent>,
  ): OverloadEvent | null {
    if (subject.load <= subject.capacity) {
      return null;
    }
    const event: OverloadEvent = {
      kind: "overload",
      ref: subject.ref,
      resourceType: subject.resourceType,
      failureMode: FAILURE_MODE_BY_RESOURCE[subject.resourceType],
      capacity: subject.capacity,
      load: subject.load,
      elapsedSeconds: tick.elapsedSeconds,
    };
    emitter?.emit(event);
    return event;
  }
}
