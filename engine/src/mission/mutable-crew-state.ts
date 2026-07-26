import type { CrewActor, CrewActorId } from "../crew/crew-actor.types.js";

/**
 * Caja mutable sobre el estado VIVO de la tripulación activa de una misión
 * (10f, capítulo 2). Análoga a `MutableShipState`: `CrewActor` es inmutable
 * (Fase 9), así que aplicar daño produce un actor nuevo; esta clase retiene
 * "cuál es el actual" para que `CrisisRuntime` (que aplica la consecuencia
 * `crew-damage`) y `MissionRuntime` (que escribe el HP de vuelta al save) lean
 * la misma fuente de verdad. El scheduler NO modela HP (`SchedulerActorSnapshot`
 * solo lleva status/sección), por eso el HP vive aparte, aquí.
 */
export class MutableCrewState {
  private readonly byId = new Map<CrewActorId, CrewActor>();
  private readonly order: ReadonlyArray<CrewActorId>;

  constructor(actors: ReadonlyArray<CrewActor>) {
    for (const actor of actors) {
      this.byId.set(actor.id, actor);
    }
    this.order = actors.map((actor) => actor.id);
  }

  get(id: CrewActorId): CrewActor | undefined {
    return this.byId.get(id);
  }

  /** Todos los actores activos, en el orden de registro. */
  all(): ReadonlyArray<CrewActor> {
    return this.order.map((id) => this.byId.get(id)!).filter((actor): actor is CrewActor => actor !== undefined);
  }

  set(actor: CrewActor): void {
    this.byId.set(actor.id, actor);
  }

  /** Primer actor vivo (`hp > 0`) en orden de registro, o `undefined` si no queda ninguno. */
  firstAlive(): CrewActor | undefined {
    return this.all().find((actor) => actor.hp > 0);
  }

  /**
   * Actor vivo con MÁS HP (desempate por orden de registro), o `undefined` si no
   * queda ninguno. Lo usa el castigo progresivo del cap. 2 para repartir las
   * descargas en vez de concentrarlas en un solo tripulante.
   */
  healthiestAlive(): CrewActor | undefined {
    return this.all()
      .filter((actor) => actor.hp > 0)
      .reduce<CrewActor | undefined>(
        (best, actor) => (best === undefined || actor.hp > best.hp ? actor : best),
        undefined,
      );
  }
}
