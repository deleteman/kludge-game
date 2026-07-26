import type { Tickable } from "../tasks/core-loop-mode.js";
import type { TickContext } from "../simulation/simulation-clock.types.js";
import type { EventEmitter } from "../simulation/event-emitter.js";
import type { EntityRegistry } from "../composition/entity-registry.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import { sectionCorrosiveLevel } from "../atmosphere/corrosive-atmosphere.js";
import { StructuralIntegrity } from "../failure/structural-failure.js";
import type { FailureDomainEvent } from "../failure/failure-events.types.js";
import type { PlacedComponentInstance, PlacedComponentInstanceId } from "../blueprint/blueprint.types.js";
import type { MissionAtmosphereRuntime } from "./mission-atmosphere-runtime.js";
import type { MutableShipState } from "./mutable-ship-state.js";

/**
 * Cicatriz de RE por componente instalado (Fase 11b) — primer llamador de
 * producción de `StructuralIntegrity` (`failure/structural-failure.ts`), que
 * hasta esta fase solo se ejercitaba a mano en tests (ver
 * `validation/case-07-neutralizacion-emergencia.test.ts`). Un tracker por
 * instancia con propiedad `material.RE`, alimentado por el nivel corrosivo de
 * la sección donde está anclada (`MissionAtmosphereRuntime` +
 * `sectionCorrosiveLevel`); cuando degrada, escribe
 * `structuralResistanceOverride` de vuelta en el `Blueprint` — misma
 * inmutabilidad que el resto del motor (`MutableShipState.set`).
 */
export class MissionStructuralRuntime implements Tickable {
  private readonly trackers = new Map<PlacedComponentInstanceId, StructuralIntegrity>();

  constructor(
    private readonly shipState: MutableShipState,
    private readonly shipFloorplan: ShipFloorplan,
    private readonly atmosphereRuntime: MissionAtmosphereRuntime,
    private readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
    private readonly chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>,
    private readonly emitter?: EventEmitter<FailureDomainEvent>,
  ) {}

  private trackerFor(instance: PlacedComponentInstance, catalogRE: "A" | "M" | "B"): StructuralIntegrity {
    let tracker = this.trackers.get(instance.instanceId);
    if (!tracker) {
      tracker = new StructuralIntegrity(instance.instanceId, instance.structuralResistanceOverride ?? catalogRE);
      this.trackers.set(instance.instanceId, tracker);
    }
    return tracker;
  }

  tick(ctx: TickContext): void {
    const blueprint = this.shipState.get();
    let changed = false;

    const updatedComponents = blueprint.placedComponents.map((instance) => {
      const catalogRE = this.componentRegistry.get(instance.componentDefinitionId)?.data.material?.RE;
      if (!catalogRE) {
        return instance;
      }
      const section = sectionContainingCell(this.shipFloorplan, instance.placement.position);
      if (!section) {
        return instance;
      }
      const atmosphere = this.atmosphereRuntime.atmosphereOf(section.id);
      const corrosiveLevel = atmosphere ? sectionCorrosiveLevel(atmosphere, this.chemicalRegistry) : null;

      const tracker = this.trackerFor(instance, catalogRE);
      tracker.tick(corrosiveLevel, ctx, this.emitter);

      const currentOverride = instance.structuralResistanceOverride ?? catalogRE;
      if (tracker.currentLevel !== currentOverride) {
        changed = true;
        return { ...instance, structuralResistanceOverride: tracker.currentLevel };
      }
      return instance;
    });

    if (changed) {
      this.shipState.set({ ...blueprint, placedComponents: updatedComponents });
    }
  }
}
