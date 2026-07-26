import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { CrisisDefinitionId } from "./crisis-definition.types.js";

/**
 * Eventos de dominio de una crisis (patrón Observer, CLAUDE.md). Se agregan
 * al union `DomainEvent` de `index.ts`. `crisis-triggered` es el seam que la
 * sub-fase 10e usará para disparar el bark `"crisis-start"`
 * (`crew/bark-bank.ts`) — se define ahora, se cablea después. Deliberadamente
 * sin campos específicos de un trigger/resolución concretos (ej. qué sección
 * quedó bloqueada): esa metadata vive en la `CrisisDefinition` consultable
 * por id, no duplicada en el evento — evita inventar una forma de evento
 * heterogénea por cada `kind` de trigger/resolución.
 */
export interface CrisisTriggeredEvent extends DomainEventBase {
  readonly kind: "crisis-triggered";
  readonly crisisId: CrisisDefinitionId;
}

export interface CrisisResolvedEvent extends DomainEventBase {
  readonly kind: "crisis-resolved";
  readonly crisisId: CrisisDefinitionId;
  readonly outcome: "resolved-success" | "resolved-failure" | "resolved-partial";
}

export type CrisisDomainEvent = CrisisTriggeredEvent | CrisisResolvedEvent;
