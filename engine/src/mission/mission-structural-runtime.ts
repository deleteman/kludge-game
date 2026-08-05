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
import { RE_ORDER } from "../properties/material-order.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";
import { effectiveResistance } from "../wear/effective-resistance.js";
import { worsenWear } from "../wear/wear.types.js";
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
 * `sectionCorrosiveLevel`); cuando degrada, escribe de vuelta en el
 * `Blueprint` — misma inmutabilidad que el resto del motor
 * (`MutableShipState.set`).
 *
 * Fase 13c: la cicatriz pasó de `structuralResistanceOverride` a `wear`. Son el
 * mismo eje (un escalón de desgaste = un escalón de RE), así que el ritmo de la
 * Espec. §1 no cambió; lo que se evitó es que corrosión y desgaste contaran el
 * mismo daño dos veces sobre la misma pieza.
 *
 * NOTA DE ALCANCE: ningún capítulo autorado tiene todavía una sustancia `CORR`
 * viva en su atmósfera (el Cap.1 es una fuga de presión, no de ácido), así que
 * este escritor solo se ejercita en el caso de validación 7. El otro escritor
 * de desgaste (canibalización, `ship-task-effect.ts`) sí tiene camino real en
 * el Cap.1.
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

  private trackerFor(
    instance: PlacedComponentInstance,
    startingLevel: StructuralResistanceLevel,
  ): StructuralIntegrity {
    let tracker = this.trackers.get(instance.instanceId);
    if (!tracker) {
      tracker = new StructuralIntegrity(instance.instanceId, startingLevel);
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

      // El tracker arranca en la RE EFECTIVA (catálogo + desgaste acumulado):
      // una pieza canibalizada ya entra debilitada al ácido, no desde cero.
      const current = effectiveResistance(
        catalogRE,
        instance.wear,
        instance.structuralResistanceOverride,
      );
      if (current === null || current === "fallo") {
        return instance;
      }
      const tracker = this.trackerFor(instance, current);
      tracker.tick(corrosiveLevel, ctx, this.emitter);

      if (tracker.currentLevel !== current || tracker.hasFailed) {
        changed = true;
        // Desde 13c la cicatriz se escribe como DESGASTE, no como override de
        // RE: son el mismo eje (un escalón de desgaste = un escalón de RE, ver
        // `wear/effective-resistance.ts`), y mantener los dos habría contado el
        // mismo daño dos veces. El ritmo de la Espec. §1 no cambia — solo el
        // campo donde queda registrado.
        const steps = tracker.hasFailed
          ? RE_ORDER.length - RE_ORDER.indexOf(current)
          : RE_ORDER.indexOf(tracker.currentLevel) - RE_ORDER.indexOf(current);
        let wear = instance.wear;
        for (let step = 0; step < steps; step += 1) {
          wear = worsenWear(wear);
        }
        return { ...instance, wear };
      }
      return instance;
    });

    if (changed) {
      this.shipState.set({ ...blueprint, placedComponents: updatedComponents });
    }
  }
}
