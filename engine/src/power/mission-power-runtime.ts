import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { PowerScarSource, InstancePowerSource } from "../mission/mission-signal-runtime.js";
import type { MutableShipState } from "../mission/mutable-ship-state.js";
import { totalPowerBudget } from "./power-source.js";
import { allocateComponentPower, allocateSectionBudget, reconcilePowerScars } from "./power-allocation.js";

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
 * Corre en cada tick sin importar el modo (`planning`/`execution`), igual que
 * `MissionOverloadRuntime`: el reparto vivo debe reflejar de inmediato un
 * cambio del jugador durante la pausa táctica, que es precisamente cuándo se
 * opera el dial de asignación (Fase 13b, UI).
 */
export class MissionPowerRuntime implements Tickable, PowerScarSource, InstancePowerSource {
  private poweredInstanceIds = new Set<PlacedComponentInstanceId>();

  constructor(
    private readonly shipState: MutableShipState,
    readonly shipFloorplan: ShipFloorplan,
    private readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  ) {}

  tick(_ctx: TickContext): void {
    const blueprint = this.shipState.get();
    const totalUnits = totalPowerBudget(blueprint.placedComponents, this.componentRegistry);
    const sectionIds = this.shipFloorplan.sections.map((section) => section.id);
    const { grantedBySectionId, darkSectionIds } = allocateSectionBudget(
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

    const derivedUnpowered = reconcilePowerScars(
      blueprint.powerState.permanentlyDisconnectedSectionIds,
      darkSectionIds,
    );
    if (!sameSectionIds(derivedUnpowered, blueprint.unpoweredSectionIds)) {
      this.shipState.set({ ...blueprint, unpoweredSectionIds: derivedUnpowered });
    }
  }

  unpoweredSections(): ReadonlySet<SectionId> {
    return new Set(this.shipState.get().unpoweredSectionIds);
  }

  isInstancePowered(instanceId: PlacedComponentInstanceId): boolean {
    return this.poweredInstanceIds.has(instanceId);
  }
}

function sameSectionIds(a: ReadonlyArray<SectionId>, b: ReadonlyArray<SectionId>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}
