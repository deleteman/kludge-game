import type { DomainEventLike } from "./domain-event.types.js";

export type EventHandler<TEvent> = (event: TEvent) => void;

/** Función devuelta al suscribirse; invocarla cancela la suscripción. */
export type Unsubscribe = () => void;

/**
 * Emisor de eventos tipado y sin dependencias externas — el seam Observer
 * entre `/engine` y `/game` (CLAUDE.md). Genérico sobre una unión discriminada
 * por `kind`, de forma que cada subsistema lo instancia con su propio tipo de
 * evento y `/game` con la unión agregada `DomainEvent`.
 *
 * `on(kind, handler)` recibe solo los eventos de ese `kind`, con el payload
 * correcto estrechado por tipo (`Extract`). `onAny` recibe todos — útil para
 * logging o para un router de partículas único en `/game`.
 */
export class EventEmitter<TEvent extends DomainEventLike> {
  private readonly handlersByKind = new Map<string, Set<EventHandler<TEvent>>>();
  private readonly anyHandlers = new Set<EventHandler<TEvent>>();

  on<K extends TEvent["kind"]>(
    kind: K,
    handler: EventHandler<Extract<TEvent, { kind: K }>>,
  ): Unsubscribe {
    let set = this.handlersByKind.get(kind);
    if (!set) {
      set = new Set();
      this.handlersByKind.set(kind, set);
    }
    const typedHandler = handler as EventHandler<TEvent>;
    set.add(typedHandler);
    return () => {
      set?.delete(typedHandler);
    };
  }

  onAny(handler: EventHandler<TEvent>): Unsubscribe {
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }

  emit(event: TEvent): void {
    const set = this.handlersByKind.get(event.kind);
    if (set) {
      // Copia defensiva: un handler puede desuscribirse durante el despacho.
      for (const handler of [...set]) {
        handler(event);
      }
    }
    for (const handler of [...this.anyHandlers]) {
      handler(event);
    }
  }
}
