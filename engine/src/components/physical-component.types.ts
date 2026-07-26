import type { Brand } from "../shared/brand.types.js";
import type { Footprint } from "../geometry/grid-position.types.js";
import type { FunctionalProperties } from "../properties/functional.types.js";
import type { MaterialProperties } from "../properties/material.types.js";
import type { ComposableEntity } from "../composition/composable-entity.types.js";

export type ComponentId = Brand<string, "ComponentId">;

/**
 * Nivel 0 del GDD 7.1: pieza atómica indescomponible. Solo los átomos tienen
 * footprint fijo de catálogo (GDD 7.2) — un compuesto/ensamblaje no lo tiene
 * de catálogo; se calcula dinámicamente en la mesa de creación
 * (`workbench/footprint-calculator.ts`, Fase 7) y se guarda en
 * `CompositeComponentData.footprint`.
 */
export interface AtomicComponentData {
  readonly footprint: Footprint;
  readonly functional?: FunctionalProperties;
  readonly material?: MaterialProperties;
}

/** Nivel 1 (compuesto) y Nivel 2 (ensamblaje) del GDD 7.1 — mismo tipo, ver composition/. */
export interface CompositeComponentData {
  readonly functional?: FunctionalProperties;
  readonly material?: MaterialProperties;
  /**
   * Footprint calculado dinámicamente en la mesa de creación (GDD 10.1, Fase
   * 7) como el rectángulo mínimo que contiene las piezas de la disposición
   * elegida por el jugador. Opcional y retrocompatible: solo poblado para
   * compuestos nacidos en la mesa (`workbench/creation-naming.ts`); los
   * compuestos de catálogo pre-Fase-7 no lo tienen.
   */
  readonly footprint?: Footprint;
}

export type PhysicalComponentDefinition = ComposableEntity<
  ComponentId,
  AtomicComponentData,
  CompositeComponentData,
  ComponentId
>;
