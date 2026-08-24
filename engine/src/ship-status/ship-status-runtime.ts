import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
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
  fractionToLevel,
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
/**
 * Suministro vs. demanda de energía para el indicador del HUD (Fase 13b, ronda
 * 5). Interfaz angosta y opcional, mismo criterio que `PowerScarSource`/
 * `InstancePowerSource`: `ShipStatusQuery` no necesita conocer el dominio
 * `power/` completo, y sin la fuente el indicador se comporta como antes.
 */
export interface PowerSupplySource {
  grantedTotalUnits(): number;
  requestedTotalUnits(): number;
}

/**
 * Vida de casco por sección (Subfase 13f). Interfaz angosta, mismo criterio
 * que `PowerSupplySource`: `ShipStatusQuery` resume, no conoce el dominio
 * `integrity/` completo. La implementa `MissionSectionIntegrityRuntime`.
 *
 * NO es opcional, a diferencia de `powerSupply`: sin ella el indicador de
 * casco quedaría clavado en nominal pase lo que pase, que es exactamente el
 * indicador muerto que la ronda 5 de playtest de 13b encontró con la energía.
 */
export interface SectionIntegritySource {
  fractionOf(sectionId: SectionId): number;
  allFractions(): ReadonlyArray<number>;
}

export class ShipStatusQuery {
  constructor(
    private readonly shipState: MutableShipState,
    private readonly shipFloorplan: ShipFloorplan,
    private readonly atmosphereRuntime: MissionAtmosphereRuntime,
    private readonly chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>,
    private readonly sectionIntegrity: SectionIntegritySource,
    private readonly powerSupply?: PowerSupplySource,
  ) {}

  snapshot(): ShipStatusSnapshot {
    const blueprint = this.shipState.get();
    const sections = this.shipFloorplan.sections.map((section) => ({
      atmosphere: this.atmosphereRuntime.atmosphereOf(section.id) ?? standardSectionAtmosphere(),
    }));

    return {
      atmosphere: aggregateAtmosphere(sections, this.chemicalRegistry),
      lifeSupport: aggregateLifeSupport(sections),
      // Subfase 13f: la integridad sale de la vida propia de cada sección, no
      // del RE de las piezas instaladas. Instalar o desmontar una manguera ya
      // no mueve este indicador.
      hullIntegrity: aggregateHullIntegrity(this.sectionIntegrity.allFractions()),
      // Fase 13b (ronda 5): además de la cicatriz permanente, el indicador mira
      // si la nave puede entregar lo que el jugador repartió — sin eso quedaba
      // clavado en nominal, porque `unpoweredSectionIds` solo lleva la cicatriz
      // del Cap.5 (hoy vacía) desde la ronda 2.
      energy: aggregateEnergy({
        unpoweredSectionCount: blueprint.unpoweredSectionIds.length,
        totalSectionCount: this.shipFloorplan.sections.length,
        grantedUnits: this.powerSupply?.grantedTotalUnits() ?? 0,
        requestedUnits: this.powerSupply?.requestedTotalUnits() ?? 0,
      }),
    };
  }

  /**
   * Integridad de casco de UNA sección (capa "estructural" del HUD del plano).
   * Desde 13f es directamente la vida de esa sección: la capa del plano y el
   * indicador de nave leen el MISMO dato que el motor usa para decidir el
   * colapso, así que la UI no puede contradecir al motor.
   */
  sectionHullIntegrity(sectionId: SectionId): ShipStatusIndicator {
    const fraction = this.sectionIntegrity.fractionOf(sectionId);
    return { level: fractionToLevel(fraction), fraction };
  }
}
