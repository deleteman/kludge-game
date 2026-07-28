import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { ComponentId, PhysicalComponentDefinition } from "../components/physical-component.types.js";
import type { PlacedComponentInstance } from "../blueprint/blueprint.types.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";
import { GAS, STANDARD_OXYGEN_FRACTION } from "../atmosphere/atmosphere-composition.types.js";
import { getGasFraction, standardSectionAtmosphere } from "../atmosphere/section.types.js";
import { OXYGEN_COMBUSTION_THRESHOLDS } from "../atmosphere/combustion-atmosphere.js";
import { REACTION_PARAMETERS } from "../chemistry/reaction/reaction-parameters.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";
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

/** Nivel de RE mapeado a fracción [0,1], mismo orden A>M>B que `RE_ORDER` (`failure/structural-failure.ts`). */
const RE_LEVEL_FRACTION: Record<StructuralResistanceLevel, number> = {
  A: 1,
  M: 0.5,
  B: 0.2,
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
 * Agregación a nivel de nave de integridad de casco (Subfase 11g): peor
 * `structuralResistanceOverride ?? RE de catálogo` entre todos los
 * componentes instalados con propiedad de material RE. `condition ===
 * "destroyed"` fuerza crítico sin importar el RE.
 */
export function aggregateHullIntegrity(
  placedComponents: ReadonlyArray<PlacedComponentInstance>,
  componentRegistry: EntityRegistry<ComponentId, PhysicalComponentDefinition>,
): ShipStatusIndicator {
  let worstFraction = 1;
  let sawAny = false;
  for (const instance of placedComponents) {
    const catalogRE = componentRegistry.get(instance.componentDefinitionId)?.data.material?.RE;
    if (!catalogRE) {
      continue;
    }
    sawAny = true;
    if (instance.condition === "destroyed") {
      worstFraction = 0;
      continue;
    }
    const level = instance.structuralResistanceOverride ?? catalogRE;
    worstFraction = Math.min(worstFraction, RE_LEVEL_FRACTION[level]);
  }
  return indicator(sawAny ? worstFraction : 1);
}

/**
 * Agregación a nivel de nave de energía (Subfase 11g): fracción de secciones
 * CON suministro, derivada del flag existente `Blueprint.unpoweredSectionIds`
 * — MVP explícito, sin simulación de producción/consumo/flujo (no existe
 * ningún `PowerGrid`/`EnergyGrid` en el motor todavía).
 */
export function aggregateEnergy(unpoweredSectionCount: number, totalSectionCount: number): ShipStatusIndicator {
  if (totalSectionCount === 0) {
    return indicator(1);
  }
  return indicator(1 - unpoweredSectionCount / totalSectionCount);
}
