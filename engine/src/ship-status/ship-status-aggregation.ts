import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance } from "../blueprint/blueprint.types.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";
import { GAS, STANDARD_OXYGEN_FRACTION } from "../atmosphere/atmosphere-composition.types.js";
import { getGasFraction, standardSectionAtmosphere } from "../atmosphere/section.types.js";
import { OXYGEN_COMBUSTION_THRESHOLDS } from "../atmosphere/combustion-atmosphere.js";
import { REACTION_PARAMETERS } from "../chemistry/reaction/reaction-parameters.js";
import {
  effectiveResistance,
  type EffectiveResistance,
} from "../wear/effective-resistance.js";
import { sectionContainingCell } from "../floorplan/floorplan.types.js";
import type { ShipFloorplan } from "../floorplan/floorplan.types.js";
import type { SectionId } from "../atmosphere/section.types.js";
import type { ShipStatusIndicator, ShipStatusLevel } from "./ship-status.types.js";

/**
 * Corte de 3 niveles a partir de una fracción [0,1] (Subfase 11g). Mismo
 * corte que `hpBarColor` en `game/src/ui/widgets/crew-strip.ts` (>0.5
 * nominal, >0.25 warning, resto critical) — se reutiliza el criterio, no se
 * inventa uno nuevo.
 */
export function fractionToLevel(fraction: number): ShipStatusLevel {
  if (fraction > 0.5) {
    return "nominal";
  }
  if (fraction > 0.25) {
    return "warning";
  }
  return "critical";
}

function indicator(fraction: number): ShipStatusIndicator {
  const clamped = Math.max(0, Math.min(1, fraction));
  return { level: fractionToLevel(clamped), fraction: clamped };
}

/**
 * Aporte de UNA instancia a la integridad de casco: su fracción de RE efectiva
 * y cuánto pesa. `null` si la pieza no cuenta como estructura.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PROVISIONAL — se elimina entero en la Subfase 13f.
 * ─────────────────────────────────────────────────────────────────────────
 * Derivar la integridad del casco del RE de los componentes INSTALADOS es un
 * error de modelado de la Subfase 11g, reportado por el operador en el playtest
 * de 13c: instalar un `tubo-flexible` (RE-B) desplomaba el indicador de casco de
 * toda la nave, y desmontarlo lo "reparaba". Una manguera no es casco.
 *
 * Parche interino, en dos partes:
 *  1. Solo cuentan las piezas con propiedad funcional `EST` (Estructura/soporte,
 *     GDD 5.1) — una manguera, un chip o un sensor dejan de afectar el casco.
 *  2. Entre las que sí son estructura, se PONDERA por su `damageResistance` de
 *     catálogo en vez de tomar el peor caso: el casco es el conjunto de su
 *     estructura, así que degradar una plancha (50) pesa más que un tornillo
 *     (20). Sin esto, la tornillería (EST, RE-B) reproduciría exactamente el
 *     mismo síntoma que motivó el arreglo.
 *
 * En 13f la integridad pasa a ser estado propio de la sección (HP dañado por
 * impactos, explosiones, corrosión y descompresión) y esta función desaparece.
 */
function instanceHullContribution(
  instance: PlacedComponentInstance,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): { readonly fraction: number; readonly weight: number } | null {
  const definition = componentRegistry.get(instance.componentDefinitionId);
  const catalogRE = definition?.data.material?.RE;
  if (!catalogRE) {
    return null;
  }
  const structure = definition?.data.functional?.find((property) => property.tag === "EST");
  if (!structure) {
    return null;
  }
  const weight = structure.damageResistance > 0 ? structure.damageResistance : 1;
  if (instance.condition === "destroyed") {
    return { fraction: 0, weight };
  }
  // Fase 13c: la resistencia efectiva incluye el desgaste acumulado, así que el
  // HUD de integridad de casco y el overlay `estructural` reaccionan a una
  // pieza canibalizada o corroída sin código propio.
  const level = effectiveResistance(catalogRE, instance.wear, instance.structuralResistanceOverride);
  return level === null ? null : { fraction: RE_LEVEL_FRACTION[level], weight };
}

/** Media ponderada de los aportes de estructura; `null` si no hay ninguna pieza estructural. */
function weightedHullFraction(
  instances: ReadonlyArray<PlacedComponentInstance>,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): number | null {
  let weighted = 0;
  let totalWeight = 0;
  for (const instance of instances) {
    const contribution = instanceHullContribution(instance, componentRegistry);
    if (!contribution) {
      continue;
    }
    weighted += contribution.fraction * contribution.weight;
    totalWeight += contribution.weight;
  }
  return totalWeight > 0 ? weighted / totalWeight : null;
}

/** Nivel de RE efectivo mapeado a fracción [0,1], mismo orden A>M>B que `RE_ORDER`. */
const RE_LEVEL_FRACTION: Record<EffectiveResistance, number> = {
  A: 1,
  M: 0.5,
  B: 0.2,
  fallo: 0,
};

export interface SectionAtmosphereEntry {
  readonly atmosphere: SectionAtmosphere;
}

/** Presión estándar (Subfase 11h) — reutilizada, no re-hardcodeada, para expresar desviación como fracción [0,1]. */
const STANDARD_PRESSURE_KPA = standardSectionAtmosphere().pressureKpa;

/**
 * Agregación a nivel de nave de la atmósfera (Subfase 11g): peor sección
 * gana. Combina dos factores independientes, cada uno con su propia noción
 * de "peor sección":
 *  - Gas contaminante con tag `TOX`, contra el umbral letal (Espec. §1) que ya
 *    usa `REACTION_PARAMETERS.toxicity` — no se inventan umbrales nuevos.
 *  - Desviación de presión (Subfase 11h, escenario de fuga en Capítulo 1):
 *    `pressureKpa` por debajo de la atmósfera estándar también degrada el
 *    indicador — una fuga es un problema de atmósfera aunque no libere ningún
 *    gas tóxico.
 */
export function aggregateAtmosphere(
  sections: ReadonlyArray<SectionAtmosphereEntry>,
  chemicalRegistry: EntityRegistry<ChemicalSubstanceId, ChemicalSubstanceDefinition>,
): ShipStatusIndicator {
  if (sections.length === 0) {
    return indicator(1);
  }
  let worstFraction = 1;
  for (const { atmosphere } of sections) {
    const pressureFraction = atmosphere.pressureKpa / STANDARD_PRESSURE_KPA;
    worstFraction = Math.min(worstFraction, pressureFraction);
    for (const gasKey of atmosphere.gases.keys()) {
      if (gasKey === GAS.OXYGEN || gasKey === GAS.NITROGEN || gasKey === GAS.CO2) {
        continue;
      }
      const substance = chemicalRegistry.get(gasKey as ChemicalSubstanceId);
      const isToxic = substance?.data.tags.some((tag) => tag.name === "TOX");
      if (!isToxic) {
        continue;
      }
      const concentration = getGasFraction(atmosphere, gasKey);
      const sectionFraction = 1 - concentration / REACTION_PARAMETERS.toxicity.lethalConcentration;
      worstFraction = Math.min(worstFraction, sectionFraction);
    }
  }
  return indicator(worstFraction);
}

/**
 * Agregación a nivel de nave de soporte vital (Subfase 11g): respirabilidad
 * derivada de la fracción de O2 por sección, peor sección gana. No existe
 * ningún concepto de "soporte vital" separado de atmósfera en el GDD — se
 * deriva del mismo dato de O2 (`OXYGEN_COMBUSTION_THRESHOLDS.none` como cero
 * absoluto, `STANDARD_OXYGEN_FRACTION` como 100%).
 */
export function aggregateLifeSupport(sections: ReadonlyArray<SectionAtmosphereEntry>): ShipStatusIndicator {
  if (sections.length === 0) {
    return indicator(1);
  }
  let worstFraction = 1;
  for (const { atmosphere } of sections) {
    const oxygen = getGasFraction(atmosphere, GAS.OXYGEN);
    const breathable = Math.max(0, oxygen - OXYGEN_COMBUSTION_THRESHOLDS.none);
    const sectionFraction = breathable / (STANDARD_OXYGEN_FRACTION - OXYGEN_COMBUSTION_THRESHOLDS.none);
    worstFraction = Math.min(worstFraction, sectionFraction);
  }
  return indicator(worstFraction);
}

/**
 * Agregación a nivel de nave de integridad de casco (Subfase 11g): media
 * ponderada de la resistencia EFECTIVA (`wear/effective-resistance.ts`) de las
 * piezas ESTRUCTURALES instaladas — ver `instanceHullContribution` para el
 * porqué del filtro y de la ponderación, y para la nota de que todo esto es
 * provisional hasta la Subfase 13f. `condition === "destroyed"` aporta 0.
 * Sin ninguna pieza estructural: nominal.
 */
export function aggregateHullIntegrity(
  placedComponents: ReadonlyArray<PlacedComponentInstance>,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): ShipStatusIndicator {
  return indicator(weightedHullFraction(placedComponents, componentRegistry) ?? 1);
}

/**
 * Agregación de integridad de casco POR SECCIÓN (Fase 12a: capa "estructural"
 * del HUD del plano, hasta ahora sin overlay real — ver
 * `game/src/render/floorplan-renderer.ts`). Mismo criterio que
 * `aggregateHullIntegrity` a nivel nave, acotado a los componentes anclados
 * en `sectionId` (`sectionContainingCell`, mismo criterio de anclaje que usa
 * `MissionStructuralRuntime` para escribir la cicatriz de RE por instancia).
 * Sin piezas estructurales en la sección: "nominal" por default, misma
 * convención que la agregación a nivel nave.
 */
export function aggregateSectionHullIntegrity(
  placedComponents: ReadonlyArray<PlacedComponentInstance>,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
  shipFloorplan: ShipFloorplan,
  sectionId: SectionId,
): ShipStatusIndicator {
  const inSection = placedComponents.filter(
    (instance) => sectionContainingCell(shipFloorplan, instance.placement.position)?.id === sectionId,
  );
  return indicator(weightedHullFraction(inSection, componentRegistry) ?? 1);
}

export interface EnergyAggregationInput {
  /** Secciones con cicatriz PERMANENTE de energía (Cap.5); no incluye el déficit vivo de reparto. */
  readonly unpoweredSectionCount: number;
  readonly totalSectionCount: number;
  /** Unidades realmente otorgadas por el reparto vivo (Fase 13b). */
  readonly grantedUnits: number;
  /** Unidades que el jugador tiene repartidas. 0 = todavía no repartió nada. */
  readonly requestedUnits: number;
}

/**
 * Agregación a nivel de nave de energía (Subfase 11g; reescrita en la ronda 5
 * de playtest de 13b). Toma el PEOR de dos señales independientes:
 *
 * 1. Cicatriz permanente por sección (`unpoweredSectionIds`, semántica original
 *    de 11g — sacrificio del Cap.5, hoy sin contenido).
 * 2. Suministro vs. demanda (`grantedUnits / requestedUnits`): qué fracción de
 *    lo que el jugador repartió puede entregar la nave realmente. Sin esto el
 *    indicador quedaba MUERTO — desde la ronda 2 `unpoweredSectionIds` refleja
 *    solo la cicatriz permanente, siempre vacía, así que marcaba 100% nominal
 *    pasara lo que pasara (detectado en playtest).
 *
 * `requestedUnits === 0` (partida nueva, nada repartido todavía) cuenta como
 * nominal, NO como fallo: es la condición que evita revivir el bug de la ronda
 * 1 (todo en crítico desde el primer frame, disparando el overlay de alerta y
 * el CRT a máxima intensidad). No repartir energía no es una avería.
 *
 * Recibe un objeto y no cuatro números sueltos a propósito: dos parámetros son
 * "secciones" y dos son "unidades", y confundirlos daría un HUD que miente sin
 * fallar ningún test de tipos.
 */
export function aggregateEnergy(input: EnergyAggregationInput): ShipStatusIndicator {
  const { unpoweredSectionCount, totalSectionCount, grantedUnits, requestedUnits } = input;
  const scarFraction = totalSectionCount === 0 ? 1 : 1 - unpoweredSectionCount / totalSectionCount;
  const supplyFraction = requestedUnits > 0 ? grantedUnits / requestedUnits : 1;
  return indicator(Math.min(scarFraction, supplyFraction));
}
