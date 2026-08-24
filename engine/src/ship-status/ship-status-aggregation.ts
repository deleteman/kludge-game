import type { EntityRegistry } from "../composition/entity-registry.js";
import type { ChemicalSubstanceDefinition, ChemicalSubstanceId } from "../chemistry/chemical-substance.types.js";
import type { SectionAtmosphere } from "../atmosphere/section.types.js";
import { GAS, STANDARD_OXYGEN_FRACTION } from "../atmosphere/atmosphere-composition.types.js";
import { getGasFraction, standardSectionAtmosphere } from "../atmosphere/section.types.js";
import { sectionTaggedConcentration } from "../atmosphere/tagged-concentration.js";
import { OXYGEN_COMBUSTION_THRESHOLDS } from "../atmosphere/combustion-atmosphere.js";
import { REACTION_PARAMETERS } from "../chemistry/reaction/reaction-parameters.js";
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
    // Subfase 13f: el recorrido de "gases contaminantes con tag X" se extrajo a
    // `sectionTaggedConcentration` — vivía copiado acá, en
    // `sectionCorrosiveLevel` y hacía falta una tercera copia para el runtime
    // de hazards.
    const toxic = sectionTaggedConcentration(atmosphere, chemicalRegistry, "TOX");
    if (toxic > 0) {
      worstFraction = Math.min(
        worstFraction,
        1 - toxic / REACTION_PARAMETERS.toxicity.lethalConcentration,
      );
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
 * Agregación a nivel de nave de integridad de casco (Subfase 13f): PEOR
 * SECCIÓN GANA sobre la vida propia de cada sección
 * (`integrity/section-integrity.types.ts`).
 *
 * Reemplaza por completo el modelo de la Subfase 11g, que derivaba la
 * integridad del `RE` de las piezas INSTALADAS. Ese modelo estaba mal desde el
 * principio y el playtest de 13c lo destapó: instalar un `tubo-flexible` (RE-B)
 * desplomaba el indicador de casco de toda la nave y desmontarlo lo
 * "reparaba". Una manguera no es casco. El parche interino que 13c dejó
 * (filtrar por tag `EST` y ponderar por `damageResistance`) se borró entero
 * junto con `instanceHullContribution` y `weightedHullFraction`.
 *
 * "Peor sección gana" es además el mismo criterio que ya usan
 * `aggregateAtmosphere` y `aggregateLifeSupport`: los tres indicadores del HUD
 * se leen igual porque se calculan igual.
 *
 * Recibe fracciones ya calculadas y no el runtime de integridad a propósito:
 * `ship-status/` resume, no conoce dominios. Sin secciones: nominal.
 */
export function aggregateHullIntegrity(
  sectionFractions: ReadonlyArray<number>,
): ShipStatusIndicator {
  if (sectionFractions.length === 0) {
    return indicator(1);
  }
  return indicator(Math.min(...sectionFractions));
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
