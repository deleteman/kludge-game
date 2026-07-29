import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import { standardSectionAtmosphere } from "../atmosphere/section.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { MissionAtmosphereRuntime } from "../mission/mission-atmosphere-runtime.js";
import type { MutableShipState } from "../mission/mutable-ship-state.js";
import {
  aggregateAtmosphere,
  aggregateEnergy,
  aggregateHullIntegrity,
  aggregateLifeSupport,
  aggregateSectionHullIntegrity,
} from "./ship-status-aggregation.js";
import type { ShipStatusIndicator, ShipStatusSnapshot } from "./ship-status.types.js";

/**
 * Consulta de estado agregado a nivel de nave (Subfase 11g). Pull-based, no
 * `Tickable`: no acumula estado propio, solo resume en el momento los
 * runtimes que ya existen (`MissionAtmosphereRuntime`, `MutableShipState`) —
 * mismo criterio pull que `atmosphereOf`, no se emite ningún evento nuevo.
 * Mismos colaboradores que `MissionStructuralRuntime`, adrede: ambos
 * recorren todas las secciones/componentes de la misma forma.
 */
export class ShipStatusQuery {
  constructor(
    private readonly shipState: MutableShipState,
    private readonly shipFloorplan: ShipFloorplan,
    private readonly atmosphereRuntime: MissionAtmosphereRuntime,
    private readonly componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
    private readonly chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>,
  ) {}

  snapshot(): ShipStatusSnapshot {
    const blueprint = this.shipState.get();
    const sections = this.shipFloorplan.sections.map((section) => ({
      atmosphere: this.atmosphereRuntime.atmosphereOf(section.id) ?? standardSectionAtmosphere(),
    }));

    return {
      atmosphere: aggregateAtmosphere(sections, this.chemicalRegistry),
      lifeSupport: aggregateLifeSupport(sections),
      hullIntegrity: aggregateHullIntegrity(blueprint.placedComponents, this.componentRegistry),
      energy: aggregateEnergy(blueprint.unpoweredSectionIds.length, this.shipFloorplan.sections.length),
    };
  }

  /** Integridad de casco de UNA sección (Fase 12a, capa "estructural" del HUD del plano) — ver `aggregateSectionHullIntegrity`. */
  sectionHullIntegrity(sectionId: SectionId): ShipStatusIndicator {
    return aggregateSectionHullIntegrity(
      this.shipState.get().placedComponents,
      this.componentRegistry,
      this.shipFloorplan,
      sectionId,
    );
  }
}
