import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { PowerScarSource, InstancePowerSource } from "../mission/mission-signal-runtime.js";
import type { PowerSupplySource } from "../ship-status/ship-status-runtime.js";
import type { MutableShipState } from "../mission/mutable-ship-state.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { PowerDomainEvent } from "./power-events.types.js";
import { totalPowerBudget } from "./power-source.js";
import { allocateComponentPower, allocateSectionBudget } from "./power-allocation.js";

/**
 * Presupuesto de energía en vivo (Fase 13b, `nuevo-orden.md` Subfase 13b).
 * Molde: `MissionOverloadRuntime` (`mission/mission-overload-runtime.ts`) —
 * lee el `Blueprint` vivo, calcula, y solo lo reescribe si algo cambió.
 *
 * Implementa `PowerScarSource`/`InstancePowerSource` para que
 * `MissionSignalRuntime` consuma el resultado sin conocer el dominio de
 * energía — mismo desacople que ya existía entre `MissionSignalRuntime` y el
 * flag estático `unpoweredSectionIds` antes de esta fase (nadie lo
 * implementaba en producción hasta ahora).
 *
 * IMPORTANTE (fix de la ronda 3 de playtest): `CoreLoopModeMachine.tick()` es
 * NO-OP en modo `planning`, así que registrarse como `Tickable` NO alcanza —
 * el reparto nunca se recalcularía durante la pausa táctica, que es
 * precisamente cuándo el jugador opera el slider de asignación. Por eso el
 * recálculo se expone también como `recalculate()` público, que `MissionRuntime`
 * llama de forma síncrona tras cada escritura de asignación/prioridad. `tick()`
 * queda como el camino de ejecución (el reparto también debe seguir vivo
 * mientras corre la simulación, ej. si se destruye una fuente).
 */
export class MissionPowerRuntime implements Tickable, PowerScarSource, InstancePowerSource, PowerSupplySource {
  private poweredInstanceIds = new Set<PlacedComponentInstanceId>();
  private darkSectionIds: ReadonlySet<SectionId> = new Set<SectionId>();
  private grantedBySectionId: ReadonlyMap<SectionId, number> = new Map<SectionId, number>();
  private shortfallUnits = 0;
  /**
   * Último faltante ya avisado — el evento se emite POR FLANCO (solo cuando el
   * déficit aparece o cambia de magnitud), no en cada recálculo: `recalculate()`
   * corre en cada escritura de la UI y en cada tick de ejecución.
   */
  private lastNotifiedShortfall = 0;
  /**
   * `recalculate()` no recibe `TickContext` (se llama desde la UI en pausa),
   * pero todo evento de dominio necesita `elapsedSeconds`. Se guarda el último
   * visto en `tick()`; en pausa el reloj está congelado, así que sigue siendo
   * el tiempo simulado correcto.
   */
  private lastElapsedSeconds = 0;

  constructor(
    private readonly shipState: MutableShipState,
    readonly shipFloorplan: ShipFloorplan,
    private readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
    private readonly emitter?: EventEmitter<PowerDomainEvent>,
  ) {}

  tick(ctx: TickContext): void {
    this.lastElapsedSeconds = ctx.elapsedSeconds;
    this.recalculate();
  }

  /**
   * Recalcula el reparto completo. Independiente del `TickContext` (nunca lo
   * usó), por eso se expone como método propio en vez de obligar a los
   * llamadores fuera del core loop a fabricar un contexto falso.
   */
  recalculate(): void {
    const blueprint = this.shipState.get();
    const totalUnits = totalPowerBudget(
      blueprint.placedComponents,
      this.componentRegistry,
      blueprint.powerState.dischargedSourceIds,
    );
    const sectionIds = this.shipFloorplan.sections.map((section) => section.id);
    const { grantedBySectionId, darkSectionIds, shortfallUnits, shedSectionIds } = allocateSectionBudget(
      totalUnits,
      blueprint.powerState.sectionAllocations,
      sectionIds,
    );

    const instancesBySection = new Map<SectionId, PlacedComponentInstance[]>();
    for (const instance of blueprint.placedComponents) {
      const section = sectionContainingCell(this.shipFloorplan, instance.placement.position);
      if (!section) {
        continue;
      }
      const bucket = instancesBySection.get(section.id);
      if (bucket) {
        bucket.push(instance);
      } else {
        instancesBySection.set(section.id, [instance]);
      }
    }

    const poweredInstanceIds = new Set<PlacedComponentInstanceId>();
    for (const [sectionId, instances] of instancesBySection) {
      const { poweredInstanceIds: sectionPowered } = allocateComponentPower(
        grantedBySectionId.get(sectionId) ?? 0,
        instances,
        blueprint.powerState.instancePriorities,
        this.componentRegistry,
      );
      for (const instanceId of sectionPowered) {
        poweredInstanceIds.add(instanceId);
      }
    }
    // Una instancia sin sección resoluble (attrezzo fuera del plano, fixture de
    // test sin `WalkableGrid`) no puede pasar por el triaje de prioridad — se
    // considera siempre alimentada por defecto, mismo criterio de "sin dato,
    // no gatear" que retrocompat con componentes sin `powerDraw`.
    for (const instance of blueprint.placedComponents) {
      if (!sectionContainingCell(this.shipFloorplan, instance.placement.position)) {
        poweredInstanceIds.add(instance.instanceId);
      }
    }
    this.poweredInstanceIds = poweredInstanceIds;
    this.darkSectionIds = darkSectionIds;
    this.grantedBySectionId = grantedBySectionId;
    this.shortfallUnits = shortfallUnits;

    // Aviso por FLANCO: el jugador pidió más de lo que la nave puede entregar
    // (típicamente perdió una fuente). El conflicto ya quedó resuelto arriba
    // apagando secciones de menor a mayor; esto solo lo comunica, una vez por
    // cambio de magnitud — `recalculate()` corre en cada escritura de la UI.
    if (shortfallUnits !== this.lastNotifiedShortfall) {
      if (shortfallUnits > 0) {
        this.emitter?.emit({
          kind: "power-shortfall",
          elapsedSeconds: this.lastElapsedSeconds,
          totalUnits,
          requestedUnits: totalUnits + shortfallUnits,
          shedSectionIds: [...shedSectionIds],
        });
      }
      this.lastNotifiedShortfall = shortfallUnits;
    }

    // `unpoweredSectionIds` refleja SOLO la cicatriz permanente (Cap.5, futuro)
    // — el déficit vivo de sesión (`darkSectionIds`) ya NO se mezcla acá desde
    // la ronda 2 de playtest de 13b: un mismo campo público sirviendo a la vez
    // de gating real (señales/HUD, necesita ser conservador) y de efecto
    // visual honesto (necesita reflejar cualquier sección en 0) causaba dos
    // bugs incompatibles entre sí. El déficit vivo se expone aparte, sin
    // mezclar, vía `sectionHasNoPowerGranted` — puramente cosmético.
    const permanent = blueprint.powerState.permanentlyDisconnectedSectionIds;
    if (!sameSectionIds(permanent, blueprint.unpoweredSectionIds)) {
      this.shipState.set({ ...blueprint, unpoweredSectionIds: permanent });
    }
  }

  unpoweredSections(): ReadonlySet<SectionId> {
    return new Set(this.shipState.get().unpoweredSectionIds);
  }

  isInstancePowered(instanceId: PlacedComponentInstanceId): boolean {
    return this.poweredInstanceIds.has(instanceId);
  }

  /**
   * Señal puramente cosmética (Fase 13b, ronda 2): la sección tiene 0
   * unidades otorgadas EN ESTE TICK, sin ninguna excepción por presupuesto
   * total en 0 — a diferencia de `unpoweredSectionIds`, que solo refleja la
   * cicatriz permanente. Consumida por el efecto visual ambiental
   * (`floorplan-scene.ts`), nunca por gating de señales/HUD.
   */
  sectionHasNoPowerGranted(sectionId: SectionId): boolean {
    return this.darkSectionIds.has(sectionId);
  }

  /**
   * Unidades realmente OTORGADAS a una sección en el último recálculo — puede
   * ser menor que lo pedido por el jugador cuando hay déficit (ronda 4). La UI
   * muestra ambas cosas para no fingir que el pedido se cumplió.
   */
  sectionPowerGranted(sectionId: SectionId): number {
    return this.grantedBySectionId.get(sectionId) ?? 0;
  }

  /** Unidades pedidas por encima del presupuesto disponible; 0 si no hay conflicto. */
  powerShortfallUnits(): number {
    return this.shortfallUnits;
  }

  /** `PowerSupplySource` (ronda 5): total realmente otorgado, para el indicador del HUD. */
  grantedTotalUnits(): number {
    let total = 0;
    for (const units of this.grantedBySectionId.values()) {
      total += units;
    }
    return total;
  }

  /** `PowerSupplySource` (ronda 5): total que el jugador tiene repartido — el pedido, intacto. */
  requestedTotalUnits(): number {
    return this.shipState
      .get()
      .powerState.sectionAllocations.reduce((sum, entry) => sum + Math.max(0, entry.units), 0);
  }
}

function sameSectionIds(a: ReadonlyArray<SectionId>, b: ReadonlyArray<SectionId>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}
