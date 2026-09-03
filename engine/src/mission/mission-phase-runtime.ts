import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { MatterState } from "../properties/material.types.js";
import type { PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type {
  ChemicalSubstanceDefinition,
  ChemicalSubstanceId,
} from "../chemistry/chemical-substance.types.js";
import {
  effectiveMatterState,
  nominalStateOf,
  phaseTransitionOf,
} from "../chemistry/phase/matter-state.js";
import type { PhaseDomainEvent } from "../chemistry/phase/phase-events.types.js";
import { WEAR_ORDER, worsenWear } from "../wear/wear.types.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * Cambio de estado del CONTENIDO de los reservorios instalados (Subfase 14a-3,
 * GDD §5.6 "líquido → sólido detiene flujo").
 *
 * Vigila cada reservorio con contenido y compara el estado que le corresponde a
 * la temperatura de su sección contra el que tenía el tick anterior. Solo actúa
 * en el CRUCE: es un evento de borde con registro del estado previo, no una
 * evaluación continua. Sin eso, una sala helada emitiría un evento por frame
 * para siempre y el desgaste sería un goteo que a cadencia de frame no se ve
 * (la lección de 13f ronda 1 sobre las tasas × `dtSeconds`).
 *
 * **Asimetría frío/calor** (decisión de la subfase): un reservorio es un
 * contenedor sellado que aguanta presión, así que su contenido no hierve por
 * estar en una sala caliente. Solo se modela el lado frío, que es el que fuerza
 * las paredes del tanque. Ver `reservoir/frozen-content.ts`.
 *
 * El daño reusa `worsenWear` —el mismo eje que la canibalización (13c), la
 * corrosión y el colapso de sección (13f)— en vez de abrir un segundo eje de
 * deterioro por instancia.
 */

export interface PhaseRuntimeDeps {
  readonly shipState: MutableShipState;
  readonly shipFloorplan: ShipFloorplan;
  /** Temperatura viva de la sección (`MissionAtmosphereRuntime.atmosphereOf`). */
  readonly sectionTemperatureOf: (sectionId: SectionId) => number | undefined;
  readonly substanceOf: (
    substanceId: ChemicalSubstanceId,
  ) => ChemicalSubstanceDefinition | undefined;
  readonly emitter?: EventEmitter<PhaseDomainEvent>;
}

export class MissionPhaseRuntime implements Tickable {
  /**
   * Estado en el que estaba el contenido de cada instancia el tick anterior. Es
   * estado de SIMULACIÓN y no se persiste: al cargar una partida se re-siembra
   * en el primer tick con lo que diga el mundo, que es la única fuente de verdad
   * (un flag guardado se desincronizaría del enfriador, como el reparto de
   * energía de 13g).
   */
  private lastStateByInstance = new Map<PlacedComponentInstanceId, MatterState>();

  constructor(private readonly deps: PhaseRuntimeDeps) {}

  tick(ctx: TickContext): void {
    const blueprint = this.deps.shipState.get();
    const seen = new Set<PlacedComponentInstanceId>();
    for (const content of blueprint.reservoirContents) {
      const instance = blueprint.placedComponents.find(
        (placed) => placed.instanceId === content.componentInstanceId,
      );
      if (!instance || instance.condition === "destroyed") {
        continue;
      }
      const sectionId = sectionContainingCell(
        this.deps.shipFloorplan,
        instance.placement.position,
      )?.id;
      const substance = this.deps.substanceOf(content.substanceId);
      if (!sectionId || !substance) {
        continue;
      }
      const temperatureCelsius = this.deps.sectionTemperatureOf(sectionId);
      if (temperatureCelsius === undefined) {
        continue;
      }
      seen.add(instance.instanceId);
      // El tanque sellado NO hierve (ver docblock): a efectos del contenido, un
      // estado gaseoso derivado se trata como el nominal. Lo único que este
      // runtime distingue es sólido / no sólido.
      const derived = effectiveMatterState(substance, temperatureCelsius);
      const state: MatterState = derived === "S" ? "S" : nominalStateOf(substance);
      const previous = this.lastStateByInstance.get(instance.instanceId);
      this.lastStateByInstance.set(instance.instanceId, state);
      if (previous === undefined || previous === state) {
        // Primer tick de este contenido: se SIEMBRA el estado sin emitir nada.
        // Si no, cargar una partida con un tanque ya congelado volvería a
        // cobrarle el desgaste, y guardar sería un castigo (14a-4 ronda 4a).
        continue;
      }
      const transition = phaseTransitionOf(previous, state);
      if (!transition) {
        continue;
      }
      const freezing = state === "S";
      const damaged = freezing ? this.damageContainer(instance.instanceId) : undefined;
      this.deps.emitter?.emit({
        kind: "reservoir-content-phase-change",
        instanceId: instance.instanceId,
        sectionId,
        substanceId: content.substanceId,
        transition,
        damagedContainer: damaged !== undefined,
        destroyedContainer: damaged === "destroyed",
        elapsedSeconds: ctx.elapsedSeconds,
      });
    }
    // Un reservorio vaciado (o desmontado) pierde su registro: si vuelve a
    // llenarse, se siembra de cero en vez de heredar el estado de la sustancia
    // anterior, que podía ser otra.
    for (const instanceId of [...this.lastStateByInstance.keys()]) {
      if (!seen.has(instanceId)) {
        this.lastStateByInstance.delete(instanceId);
      }
    }
  }

  /**
   * Sube un escalón de desgaste al tanque; si ya estaba en el peor, lo destruye.
   * Mismo criterio y misma forma que `damageMachinery` del colapso de sección
   * (13f) — no una segunda tabla de daño.
   */
  private damageContainer(
    instanceId: PlacedComponentInstanceId,
  ): "worn" | "destroyed" | undefined {
    const blueprint = this.deps.shipState.get();
    let outcome: "worn" | "destroyed" | undefined;
    const updated = blueprint.placedComponents.map((instance) => {
      if (instance.instanceId !== instanceId || instance.condition === "destroyed") {
        return instance;
      }
      const worst = WEAR_ORDER[WEAR_ORDER.length - 1];
      if (instance.wear === worst) {
        outcome = "destroyed";
        return { ...instance, condition: "destroyed" as const };
      }
      outcome = "worn";
      return { ...instance, wear: worsenWear(instance.wear) };
    });
    if (outcome) {
      this.deps.shipState.set({ ...blueprint, placedComponents: updated });
    }
    return outcome;
  }
}
