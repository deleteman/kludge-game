import type { Blueprint, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { DomainEventBase } from "../simulation/domain-event.types.js";
import type { Tickable } from "../tasks/core-loop-mode.js";
import { drawFrom } from "../reservoir/reservoir-ledger.js";
import { frozenContentOf } from "../reservoir/frozen-content.js";
import type { FrozenContentDeps } from "../reservoir/frozen-content.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { activeAutomaticValves, isAutomaticValveDefinition } from "./automatic-valve.js";
import type { AutomaticValveDeps } from "./automatic-valve.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * Caudal de una válvula automática abierta, en unidades de sustancia por
 * segundo (Subfase 14b-2).
 *
 * Calibrado contra la tarea que automatiza y no elegido en el aire:
 * `apply-substance` mueve el `amount` que el jugador pida en 8 s de trabajo de
 * un tripulante (`TASK_DURATIONS`). A 2 unidades/s la válvula entrega en esos
 * mismos 8 s unas 16 unidades — del orden de un viaje manual, sin tripulante y
 * sin parar. Es un multiplicador de conveniencia, no de potencia: automatizar
 * tiene que ahorrar el viaje, no volver trivial el recurso.
 *
 * Con `GAS_FRACTION_PER_SUBSTANCE_UNIT` (0.2) y una sección típica de ~20
 * celdas, 2 unidades/s son ~2% de fracción por segundo: una purga se nota en
 * segundos y no en un frame, que es lo que la hace legible.
 */
export const VALVE_FLOW_UNITS_PER_SECOND = 2;

/**
 * Qué acaba de verter una válvula, para que `/game` lo dibuje (Subfase 14b-2).
 *
 * Evento de dominio como cualquier otro —con su `kind` y su `elapsedSeconds`—
 * para que entre por el registro de efectos por evento y no por un canal
 * paralelo. `/engine` emite el hecho; qué partícula sale es decisión de
 * `/game`, que es lo que mantiene real la separación motor/render.
 */
export interface ValvePourEvent extends DomainEventBase {
  readonly kind: "valve-pour";
  readonly instanceId: PlacedComponentInstanceId;
  readonly sectionId: SectionId;
  readonly substanceId: ChemicalSubstanceId;
  readonly amount: number;
}

/** Familia de eventos de la válvula automática, para la unión `DomainEvent`. */
export type ValveDomainEvent = ValvePourEvent;

export interface ValveGasInjection {
  inject(sectionId: SectionId, substanceId: ChemicalSubstanceId, amount: number): void;
}

export interface MissionValveRuntimeDeps extends AutomaticValveDeps {
  readonly floorplan: ShipFloorplan;
  readonly gasInjection: ValveGasInjection;
  readonly frozen: FrozenContentDeps;
  readonly onPour?: (event: ValvePourEvent) => void;
}

/**
 * Vierte, tick a tick, lo que las válvulas automáticas abiertas sacan de su
 * propio reservorio (Subfase 14b-2). Molde: `MissionThermalRuntime`.
 *
 * Reusa **literalmente** el camino de la tarea `apply-substance`
 * (`ship-task-effect.ts`): `drawFrom` sobre el ledger y `gasInjection.inject`
 * sobre la sección. Eso es lo que hace que verter por señal y verter a mano no
 * puedan divergir — incluido el bloqueo por contenido CONGELADO, que vale para
 * los dos por la misma razón física (coherencia entre hermanos, eje 4: si un
 * tripulante no puede sacar nada de un tanque helado, una válvula tampoco).
 *
 * Se registra ANTES de `MissionAtmosphereRuntime` en el core loop: lo que se
 * vierte este tick tiene que difundirse este tick, no el siguiente.
 *
 * No guarda estado entre ticks a propósito. Una válvula no tiene inercia: si
 * la señal cae, deja de verter en el acto. Todo lo que persiste ya vive en el
 * ledger de reservorios.
 */
export class MissionValveRuntime implements Tickable {
  constructor(
    private readonly shipState: MutableShipState,
    private readonly deps: MissionValveRuntimeDeps,
  ) {}

  tick(ctx: TickContext): void {
    const blueprint = this.shipState.get();
    const active = activeAutomaticValves(blueprint, this.deps);
    if (active.length === 0) {
      return;
    }
    const requested = VALVE_FLOW_UNITS_PER_SECOND * ctx.dtSeconds;
    if (requested <= 0) {
      return;
    }
    // Se acumula sobre un solo blueprint y se escribe UNA vez: dos válvulas
    // vertiendo el mismo tick no pueden pisarse el ledger la una a la otra.
    let contents = blueprint.reservoirContents;
    const poured: ValvePourEvent[] = [];
    for (const valve of active) {
      if (this.isFrozen(blueprint, valve.instanceId)) {
        continue;
      }
      const drawn = drawFrom(contents, valve.instanceId, requested);
      if (drawn.drawn <= 0 || !drawn.substanceId) {
        // Tanque vacío: no vierte y NO emite evento. Un efecto que no cambió
        // nada no debe emitir (patrón 26) — si no, una válvula abierta sobre un
        // tanque agotado dejaría partículas para siempre.
        continue;
      }
      contents = drawn.contents;
      poured.push({
        kind: "valve-pour",
        elapsedSeconds: ctx.elapsedSeconds,
        instanceId: valve.instanceId,
        sectionId: valve.sectionId,
        substanceId: drawn.substanceId,
        amount: drawn.drawn,
      });
    }
    if (poured.length === 0) {
      return;
    }
    this.shipState.set({ ...this.shipState.get(), reservoirContents: contents });
    for (const event of poured) {
      this.deps.gasInjection.inject(event.sectionId, event.substanceId, event.amount);
      this.deps.onPour?.(event);
    }
  }

  /**
   * ¿Está esta válvula vertiendo ahora? Lectura para `/game` (partículas, panel
   * de instancia) y para el emisor de salida del actuador de 14a-4.
   *
   * Devuelve `undefined` —y no `false`— para todo lo que NO sea una válvula
   * automática, porque este método se compone con el lector de puertas en
   * `actuatorEmitterInputs` y ahí los tres valores significan cosas distintas:
   * `undefined` es "yo no sé de esta pieza, que conteste otro", y `false` es
   * "la conozco y NO está actuando". Devolver `false` a secas apagaría el
   * emisor de salida de cada puerta de la nave.
   *
   * Se recalcula por consulta en vez de cachearse en el tick: un estado
   * cacheado que solo se actualiza al verter diría "vertiendo" un frame después
   * de que la señal cayó.
   */
  isActuatorActive(instanceId: PlacedComponentInstanceId): boolean | undefined {
    const blueprint = this.shipState.get();
    const placed = blueprint.placedComponents.find(
      (candidate) => candidate.instanceId === instanceId,
    );
    if (!placed) {
      return undefined;
    }
    const definition = this.deps.registry.get(placed.componentDefinitionId);
    if (!definition || !isAutomaticValveDefinition(definition.data)) {
      return undefined;
    }
    return activeAutomaticValves(blueprint, this.deps).some(
      (valve) => valve.instanceId === instanceId,
    );
  }

  private isFrozen(blueprint: Blueprint, instanceId: PlacedComponentInstanceId): boolean {
    return (
      frozenContentOf(blueprint, this.deps.floorplan, instanceId, this.deps.frozen) !== undefined
    );
  }
}
