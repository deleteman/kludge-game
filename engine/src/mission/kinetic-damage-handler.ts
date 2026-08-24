import type { EventEmitter } from "../simulation/event-emitter.js";
import type { CrewActorId } from "../crew/crew-actor.types.js";
import type { CrewDomainEvent } from "../crew/crew-events.types.js";
import { applyKineticDamage } from "../crew/hp-resolution.js";
import { HP_LOSS_FRACTION } from "../crew/hp-resolution.js";
import type { EnemyActorId } from "../enemies/enemy-actor.types.js";
import type { EnemyDomainEvent } from "../enemies/enemy-events.types.js";
import type { KineticDomainEvent } from "../kinetics/kinetic-events.types.js";
import type { MutableCrewState } from "./mutable-crew-state.js";
import type { MutableEnemyState } from "./mutable-enemy-state.js";

export interface KineticDamageDeps {
  readonly kineticEvents: EventEmitter<KineticDomainEvent>;
  readonly crewState: MutableCrewState;
  readonly enemyState?: MutableEnemyState;
  readonly crewEmitter?: EventEmitter<CrewDomainEvent>;
  readonly enemyEmitter?: EventEmitter<EnemyDomainEvent>;
}

/**
 * Daño real por impacto cinético sobre actores (Subfase 13f). Es el llamador
 * de producción que le faltaba a `applyKineticDamage`
 * (`crew/hp-resolution.ts`): la función existía desde la Fase 11a y solo se
 * ejercitaba en el caso de validación 17, así que en partida real **un
 * proyectil que golpeaba a un tripulante o a un enemigo no le hacía nada**.
 *
 * Entra en 13f porque esta subfase ya tuvo que tocar justo este camino: el
 * evento ahora lleva `targetKind`, que es lo que permite distinguir a quién le
 * toca el daño — la pared se la lleva la sección
 * (`MissionSectionIntegrityRuntime`), el actor se la lleva acá.
 *
 * Consecuencia buscada: el cañón de riel del caso 17 deja de ser una maqueta.
 * Un imán acelerado contra el intruso del Cap.2 lo derriba de verdad, que es
 * la promesa del GDD (5.2/5.6) desde el principio.
 */
export function registerKineticDamage(deps: KineticDamageDeps): () => void {
  return deps.kineticEvents.on("kinetic-impact", (event) => {
    if (event.targetKind === "crew") {
      const actor = deps.crewState.get(event.targetRef as CrewActorId);
      if (!actor || actor.hp <= 0) {
        return;
      }
      const { actor: damaged, event: crewEvent } = applyKineticDamage(actor, event);
      deps.crewState.set(damaged);
      if (crewEvent) {
        deps.crewEmitter?.emit(crewEvent);
      }
      return;
    }

    if (event.targetKind === "enemy") {
      const enemy = deps.enemyState?.get(event.targetRef as EnemyActorId);
      if (!enemy || enemy.status === "defeated") {
        return;
      }
      // Los enemigos no pasan por `hp-resolution` (es de tripulación: barks,
      // permadeath, causa de muerte gráfica). Comparten la MISMA tabla de
      // fracciones de daño, `HP_LOSS_FRACTION`, para que un impacto no
      // signifique una cosa contra un tripulante y otra distinta contra un
      // enemigo.
      const hp = Math.max(0, enemy.hp - enemy.maxHp * HP_LOSS_FRACTION[event.severity]);
      const defeated = hp <= 0;
      deps.enemyState?.set({ ...enemy, hp, status: defeated ? "defeated" : enemy.status });
      if (defeated) {
        deps.enemyEmitter?.emit({
          kind: "enemy-defeated",
          enemyId: enemy.id,
          elapsedSeconds: event.elapsedSeconds,
        });
      }
    }
  });
}
