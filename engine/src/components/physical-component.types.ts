import type { Brand } from "../shared/brand.types.js";
import type { Footprint, GridPosition, Rotation } from "../geometry/grid-position.types.js";
import type { FunctionalProperties } from "../properties/functional.types.js";
import type { MaterialProperties } from "../properties/material.types.js";
import type { ComposableEntity } from "../composition/composable-entity.types.js";

export type ComponentId = Brand<string, "ComponentId">;

/**
 * Disposición de UNA pieza dentro de un compuesto nacido en la mesa (deuda #8,
 * Fase 12c.5): su referencia de catálogo, su `offset` relativo al origen (min
 * corner) del footprint del compuesto, su footprint base y su rotación. Con
 * esto `/game` puede dibujar la creación con los sprites reales de sus partes
 * en vez del rectángulo placeholder — `buildRecipeFromPieces` (la receta) sí
 * deduplica y descarta posiciones, así que el layout es un dato aparte.
 */
export interface CreationPart {
  readonly ref: ComponentId;
  readonly offset: GridPosition;
  readonly footprint: Footprint;
  readonly rotation: Rotation;
}

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
  /**
   * Disposición por-pieza de la creación (deuda #8, Fase 12c.5) — offset +
   * rotación de cada parte dentro del footprint. Opcional y retrocompatible:
   * ausente en compuestos de catálogo y en creaciones guardadas antes de 12c.5
   * (que caen al placeholder al dibujarse, como antes).
   */
  readonly layout?: ReadonlyArray<CreationPart>;
}

export type PhysicalComponentDefinition = ComposableEntity<
  ComponentId,
  AtomicComponentData,
  CompositeComponentData,
  ComponentId
>;
