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

  /**
   * ¿Sigue en pie este tripulante? Criterio ÚNICO de "vivo" (13f ronda 2):
   * vivía copiado como `hp > 0` en `firstAlive`, `healthiestAlive` y en cada
   * runtime que aplica daño, y con el permadeath hay ahora un segundo eje
   * (`status: "dead"`) que tiene que decidir lo mismo en todos lados.
   */
  isAlive(id: CrewActorId): boolean {
    const actor = this.byId.get(id);
    return actor !== undefined && actor.hp > 0 && actor.status !== "dead";
  }

  /** Todos los que siguen en pie, en orden de registro. */
  allAlive(): ReadonlyArray<CrewActor> {
    return this.all().filter((actor) => this.isAlive(actor.id));
  }

  /**
   * Marca a un tripulante como baja definitiva (permadeath, GDD 6.1). No hay
   * vuelta atrás: `dead` es terminal en `CrewActorStatus`.
   */
  markDead(id: CrewActorId): void {
    const actor = this.byId.get(id);
    if (actor && actor.status !== "dead") {
      this.byId.set(id, { ...actor, hp: 0, status: "dead" });
    }
  }

  /** Primer actor vivo en orden de registro, o `undefined` si no queda ninguno. */
  firstAlive(): CrewActor | undefined {
    return this.allAlive()[0];
  }

  /**
   * Actor vivo con MÁS HP (desempate por orden de registro), o `undefined` si no
   * queda ninguno. Lo usa el castigo progresivo del cap. 2 para repartir las
   * descargas en vez de concentrarlas en un solo tripulante.
   */
  healthiestAlive(): CrewActor | undefined {
    return this.allAlive()
      .reduce<CrewActor | undefined>(
        (best, actor) => (best === undefined || actor.hp > best.hp ? actor : best),
        undefined,
      );
  }
}
