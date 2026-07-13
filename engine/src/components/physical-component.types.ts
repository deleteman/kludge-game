import type { Brand } from "../shared/brand.types.js";
import type { Footprint } from "../geometry/grid-position.types.js";
import type { FunctionalProperties } from "../properties/functional.types.js";
import type { MaterialProperties } from "../properties/material.types.js";
import type { ComposableEntity } from "../composition/composable-entity.types.js";

export type ComponentId = Brand<string, "ComponentId">;

/**
 * Nivel 0 del GDD 7.1: pieza atómica indescomponible. Solo los átomos tienen
 * footprint fijo de catálogo (GDD 7.2) — un compuesto/ensamblaje no lo tiene
 * aquí, se calcula dinámicamente en la mesa de creación (Fase 7).
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
}

export type PhysicalComponentDefinition = ComposableEntity<
  ComponentId,
  AtomicComponentData,
  CompositeComponentData,
  ComponentId
>;
