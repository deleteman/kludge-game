/**
 * Eventos de dominio del motor (patrón Observer, CLAUDE.md). El motor emite
 * estos eventos cuando una regla se dispara; `/game` (Fase 8) se suscribe para
 * traducirlos a partículas. `/engine` nunca importa Phaser ni conoce que
 * existe una capa visual — este archivo es el único contrato entre ambos.
 *
 * Principio 6 de CLAUDE.md (legibilidad visual total): cada regla nueva del
 * motor define aquí su variante de evento. Ése es el "gancho" al que se
 * enganchará la representación en partículas de Fase 8. No se escribe código
 * de partículas en Fase 2 (sería prematuro y vive en `/game`), pero ninguna
 * regla queda sin su evento — así el feedback visual nunca queda por detrás
 * de la lógica de forma silenciosa.
 *
 * La unión agregada `DomainEvent` de todos los subsistemas se ensambla en el
 * barrel raíz (`index.ts`); cada bloque define sus propios eventos junto a su
 * lógica y los tipa con el `EventEmitter` genérico.
 */

/** Forma mínima que todo evento de dominio debe cumplir para el emisor tipado. */
export type DomainEventLike = { readonly kind: string };

/** Campos comunes a todo evento: cuándo (tiempo simulado) ocurrió. */
export interface DomainEventBase {
  /** `TickContext.elapsedSeconds` en el momento de la emisión. */
  readonly elapsedSeconds: number;
}
