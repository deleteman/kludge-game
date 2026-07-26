import type { Footprint } from "../geometry/grid-position.types.js";
import type { StructuralResistanceLevel } from "../properties/material.types.js";

/**
 * Masa virtual de una pieza que vuela (ASA 1, Fase 11a.1). NO es una propiedad
 * de material nueva — es una cantidad DERIVADA de dos que ya existen: el
 * footprint de catálogo (GDD 7.2) y la resistencia estructural `RE` (GDD 5.2).
 * El documento §3 es explícito en que no se introduce "masa" como propiedad
 * ("ambos factores ya existentes en el sistema"), así que esto es una regla,
 * no un dato.
 *
 * Misma escala cualitativa B/M/A que `RE`/`CE`/`CT` — el doc §1 pide
 * explícitamente no introducir una escala numérica nueva.
 */
export type VirtualMassLevel = "B" | "M" | "A";

/**
 * Umbrales de área (width × height, unidades de grid) que separan los buckets
 * de tamaño. Sin tabla numérica en ningún documento — valores de referencia
 * ajustables, mismo criterio de honestidad que `MAGNETIC_FIELD_PARAMETERS` y
 * `THERMAL_CONDUCTIVITY_PARAMETERS` (caso de validación 2).
 *
 * `largeFootprintArea` vivía en `KINETIC_IMPACT_PARAMETERS` hasta la 11a.1:
 * era el proxy de masa entero cuando la masa era solo el tamaño. Ahora que la
 * masa cruza tamaño con `RE`, el umbral pertenece a esta regla.
 */
export const VIRTUAL_MASS_PARAMETERS = {
  /** Área a partir de la cual una pieza cuenta como "mediana". */
  mediumFootprintArea: 2,
  /** Área a partir de la cual una pieza cuenta como "grande". */
  largeFootprintArea: 4,
} as const;

/**
 * Masa virtual = tamaño × `RE` (ASA 1). Resuelve el defecto que motiva la
 * regla: sin `RE`, una carcasa de plástico vacía y una plancha de metal
 * reforzada del mismo footprint tenían exactamente la misma masa, y por tanto
 * hacían el mismo daño estructural al impactar.
 *
 * `RE` ausente ⇒ pieza ligera (se evalúa como `RE` baja). La mayoría del
 * catálogo no declara `RE`: el defecto por ausencia tiene que ser el que no
 * regala daño.
 *
 * Tabla (extrapolación documentada — el doc no la fija, solo pide cruzar
 * ambos factores; es la media cualitativa de los dos, monótona en ambos ejes):
 *
 * |          | RE=B | RE=M | RE=A |
 * |----------|------|------|------|
 * | tamaño B |  B   |  B   |  M   |
 * | tamaño M |  B   |  M   |  A   |
 * | tamaño A |  M   |  A   |  A   |
 */
export function virtualMass(
  footprint: Footprint,
  re?: StructuralResistanceLevel,
): VirtualMassLevel {
  const size = sizeLevel(footprint);
  const resistance = re ?? "B";
  const score = LEVEL_SCORE[size] + LEVEL_SCORE[resistance];
  if (score >= 5) {
    return "A";
  }
  if (score >= 4) {
    return "M";
  }
  return "B";
}

const LEVEL_SCORE: Record<VirtualMassLevel, number> = { B: 1, M: 2, A: 3 };

/** Bucket de tamaño por área del footprint (documento §3, "tamaño como proxy de masa"). */
function sizeLevel(footprint: Footprint): VirtualMassLevel {
  const area = footprint.width * footprint.height;
  if (area >= VIRTUAL_MASS_PARAMETERS.largeFootprintArea) {
    return "A";
  }
  if (area >= VIRTUAL_MASS_PARAMETERS.mediumFootprintArea) {
    return "M";
  }
  return "B";
}
